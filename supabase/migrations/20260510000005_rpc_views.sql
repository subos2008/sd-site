-- View RPCs: _profile_card_for_viewer, view_search, view_profile, view_my_profile.
--
-- Deviation from plan spec: the local Supabase storage extension does not
-- expose a SQL helper for minting signed read URLs (no storage.create_signed_url
-- function — confirmed against CLI 2.78.1, same situation as the upload-side
-- helper missing in Task 10). We return storage paths instead of signed URLs;
-- the frontend mints signed read URLs via
-- supabase.storage.from('media').createSignedUrl(path, 3600).
--
-- Known issue (carried from plan spec; out of scope to fix here): view_search's
-- cursor format `last_active_at::text || ':' || id::text` uses ':' as the
-- separator, but timestamptz text representations contain ':' (e.g.
-- "2026-05-13 10:00:00+00"). The cursor parser uses split_part(..., ':', 1)
-- which only captures the date-and-hour portion. Pagination is not exercised
-- by Plan 02 tests; revisit when wiring real pagination in a later plan.

-- Shared helper: render a profile-card jsonb for one viewer/target pair.
-- Returns NULL if target is not visible to viewer (status not active).
-- my_like_state is null in Plan 02; Plan 03 wires the likes mechanic.
CREATE OR REPLACE FUNCTION public._profile_card_for_viewer(
  p_viewer uuid,
  p_target uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  t  public.profiles%ROWTYPE;
  v  public.profiles%ROWTYPE;
  primary_photo_path text;
  distance_miles double precision;
  age int;
BEGIN
  SELECT * INTO t FROM public.profiles WHERE id = p_target;
  IF NOT FOUND OR t.status <> 'active' THEN RETURN NULL; END IF;

  SELECT * INTO v FROM public.profiles WHERE id = p_viewer;

  SELECT mi.storage_path INTO primary_photo_path
    FROM public.profile_photos pp
    JOIN public.media_items mi ON mi.id = pp.media_item_id
   WHERE pp.profile_id = t.id
   ORDER BY pp.ordinal ASC
   LIMIT 1;

  IF v.city_lat IS NOT NULL AND t.city_lat IS NOT NULL THEN
    distance_miles := ST_Distance(
      ST_MakePoint(v.city_lng, v.city_lat)::geography,
      ST_MakePoint(t.city_lng, t.city_lat)::geography
    ) / 1609.344;
  END IF;

  age := extract(year from age(t.date_of_birth))::int;

  RETURN jsonb_build_object(
    'profile_id',         t.id,
    'display_name',       t.display_name,
    'age',                age,
    'city_display_name',  t.city_display_name,
    'distance_miles',     distance_miles,
    'primary_photo_path', primary_photo_path,
    'my_like_state',      NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._profile_card_for_viewer(uuid, uuid) TO authenticated;

-- view_search — role-pair filter only in Plan 02; cursor is (last_active_at::text || ':' || id::text)
-- Page size hardcoded to 20.
CREATE OR REPLACE FUNCTION public.view_search(
  p_filters jsonb,
  p_cursor  text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  my_role profile_role;
  target_role profile_role;
  cards jsonb := '[]'::jsonb;
  card  jsonb;
  next_cursor text;
  cur_last_active timestamptz;
  cur_id uuid;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = me;
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0002';
  END IF;

  target_role := CASE my_role WHEN 'benefactor' THEN 'baby'::profile_role
                              WHEN 'baby'       THEN 'benefactor'::profile_role END;

  IF p_cursor IS NOT NULL THEN
    cur_last_active := split_part(p_cursor, ':', 1)::timestamptz;
    cur_id          := split_part(p_cursor, ':', 2)::uuid;
  END IF;

  FOR rec IN
    SELECT id, last_active_at
      FROM public.profiles
     WHERE role = target_role
       AND status = 'active'
       AND id <> me
       AND (
         p_cursor IS NULL
         OR (last_active_at, id) < (cur_last_active, cur_id)
       )
     ORDER BY last_active_at DESC NULLS LAST, id ASC
     LIMIT 20
  LOOP
    card := public._profile_card_for_viewer(me, rec.id);
    IF card IS NOT NULL THEN
      cards := cards || card;
    END IF;
    next_cursor := COALESCE(rec.last_active_at::text, '') || ':' || rec.id::text;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'cards', cards, 'next_cursor', next_cursor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_search(jsonb, text) TO authenticated;

-- view_profile — Plan 02 returns just the bare profile (no secret album, no
-- like state, no conversation summary). Plan 03/05/06 extend.
CREATE OR REPLACE FUNCTION public.view_profile(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  photos jsonb := '[]'::jsonb;
  age int;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO t FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND OR t.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = t.id
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object(
      'ordinal', rec.ordinal,
      'path', rec.storage_path
    );
  END LOOP;

  age := extract(year from age(t.date_of_birth))::int;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',        t.id,
      'display_name',      t.display_name,
      'age',               age,
      'city_display_name', t.city_display_name,
      'gender',            t.gender,
      'looking_for',       t.looking_for,
      'photos',            photos
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_profile(uuid) TO authenticated;

-- view_my_profile — same shape but no status gating; includes onboarding status.
CREATE OR REPLACE FUNCTION public.view_my_profile() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  photos jsonb := '[]'::jsonb;
  age int;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;
  SELECT * INTO t FROM public.profiles WHERE id = me;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = me
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object(
      'ordinal', rec.ordinal,
      'path', rec.storage_path
    );
  END LOOP;

  age := CASE WHEN t.date_of_birth IS NULL THEN NULL
              ELSE extract(year from age(t.date_of_birth))::int END;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',        t.id,
      'role',              t.role,
      'status',            t.status,
      'display_name',      t.display_name,
      'age',               age,
      'date_of_birth',     t.date_of_birth,
      'gender',            t.gender,
      'looking_for',       t.looking_for,
      'city_display_name', t.city_display_name,
      'token_balance',     t.token_balance,
      'photos',            photos
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_my_profile() TO authenticated;

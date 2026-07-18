-- 015: views v3 — location comes from the places gazetteer via
-- profiles.place_id. Distance uses the disc model: effective distance
-- between two profiles is max(0, centroid_distance - r_a - r_b), so
-- same/overlapping places read 0 and the radius filter widens by both
-- radii. Payload keys are unchanged: city_display_name now carries the
-- short place name (places.name).

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
  t_place public.places%ROWTYPE;
  v_place public.places%ROWTYPE;
  primary_photo_path text;
  distance_miles double precision;
  age int;
  my_like boolean;
BEGIN
  SELECT * INTO t FROM public.profiles WHERE id = p_target;
  IF NOT FOUND OR t.status <> 'active' THEN RETURN NULL; END IF;

  SELECT * INTO v FROM public.profiles WHERE id = p_viewer;

  SELECT * INTO t_place FROM public.places WHERE id = t.place_id;
  SELECT * INTO v_place FROM public.places WHERE id = v.place_id;

  SELECT mi.storage_path INTO primary_photo_path
    FROM public.profile_photos pp
    JOIN public.media_items mi ON mi.id = pp.media_item_id
   WHERE pp.profile_id = t.id
   ORDER BY pp.ordinal ASC
   LIMIT 1;

  IF v_place.id IS NOT NULL AND t_place.id IS NOT NULL THEN
    distance_miles := GREATEST(0,
      ST_Distance(v_place.geog, t_place.geog) / 1609.344
        - v_place.radius_miles - t_place.radius_miles);
  END IF;

  age := extract(year from age(t.date_of_birth))::int;

  my_like := EXISTS (
    SELECT 1 FROM public.likes WHERE liker_id = p_viewer AND likee_id = p_target
  );

  RETURN jsonb_build_object(
    'profile_id',         t.id,
    'display_name',       t.display_name,
    'age',                age,
    'city_display_name',  t_place.name,
    'distance_miles',     distance_miles,
    'primary_photo_path', primary_photo_path,
    'tagline',            t.tagline,
    'my_like_state',      my_like
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._profile_card_for_viewer(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.view_profile(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  place_name text;
  photos jsonb := '[]'::jsonb;
  interests jsonb := '[]'::jsonb;
  age int;
  my_like boolean;
  their_like boolean;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO t FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND OR t.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT name INTO place_name FROM public.places WHERE id = t.place_id;

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = t.id
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object('ordinal', rec.ordinal, 'path', rec.storage_path);
  END LOOP;

  FOR rec IN
    SELECT i.id, i.label_key, i.category
      FROM public.profile_interests pi
      JOIN public.interests i ON i.id = pi.interest_id
     WHERE pi.profile_id = t.id
       AND i.active = true
     ORDER BY i.category, i.ordinal, i.label_key
  LOOP
    interests := interests || jsonb_build_object(
      'id', rec.id, 'label_key', rec.label_key, 'category', rec.category);
  END LOOP;

  age := extract(year from age(t.date_of_birth))::int;
  my_like    := EXISTS (SELECT 1 FROM public.likes WHERE liker_id = me AND likee_id = t.id);
  their_like := EXISTS (SELECT 1 FROM public.likes WHERE liker_id = t.id AND likee_id = me);

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',         t.id,
      'display_name',       t.display_name,
      'age',                age,
      'city_display_name',  place_name,
      'gender',             t.gender,
      'looking_for',        t.looking_for,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
      'ethnicity',          t.ethnicity,
      'hair_color',         t.hair_color,
      'eye_color',          t.eye_color,
      'has_piercings',      t.has_piercings,
      'has_tattoos',        t.has_tattoos,
      'smoking',            t.smoking,
      'drinking',           t.drinking,
      'education',          t.education,
      'yearly_income_band', t.yearly_income_band,
      'net_worth_band',     t.net_worth_band,
      'photos',             photos,
      'interests',          interests,
      'my_like_state',      my_like,
      'their_like_state',   their_like
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.view_my_profile() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  place_name text;
  photos jsonb := '[]'::jsonb;
  interests jsonb := '[]'::jsonb;
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

  SELECT name INTO place_name FROM public.places WHERE id = t.place_id;

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path, mi.id AS media_item_id
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = me
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object(
      'ordinal', rec.ordinal,
      'path', rec.storage_path,
      'media_item_id', rec.media_item_id
    );
  END LOOP;

  FOR rec IN
    SELECT i.id, i.label_key, i.category
      FROM public.profile_interests pi
      JOIN public.interests i ON i.id = pi.interest_id
     WHERE pi.profile_id = me
       AND i.active = true
     ORDER BY i.category, i.ordinal, i.label_key
  LOOP
    interests := interests || jsonb_build_object(
      'id', rec.id, 'label_key', rec.label_key, 'category', rec.category);
  END LOOP;

  age := CASE WHEN t.date_of_birth IS NULL THEN NULL
              ELSE extract(year from age(t.date_of_birth))::int END;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',         t.id,
      'role',               t.role,
      'status',             t.status,
      'display_name',       t.display_name,
      'age',                age,
      'date_of_birth',      t.date_of_birth,
      'gender',             t.gender,
      'looking_for',        t.looking_for,
      'city_display_name',  place_name,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
      'ethnicity',          t.ethnicity,
      'hair_color',         t.hair_color,
      'eye_color',          t.eye_color,
      'has_piercings',      t.has_piercings,
      'has_tattoos',        t.has_tattoos,
      'smoking',            t.smoking,
      'drinking',           t.drinking,
      'education',          t.education,
      'yearly_income_band', t.yearly_income_band,
      'net_worth_band',     t.net_worth_band,
      'token_balance',      t.token_balance,
      'photos',             photos,
      'interests',          interests
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_my_profile() TO authenticated;

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
  me_place public.places%ROWTYPE;
  cards jsonb := '[]'::jsonb;
  card  jsonb;
  next_cursor text;
  cur_last_active timestamptz;
  cur_id uuid;
  rec record;
  target_role profile_role;

  f_min_age int;
  f_max_age int;
  f_distance int;
  f_interest_ids uuid[];
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = me;
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0002';
  END IF;

  SELECT pl.* INTO me_place
    FROM public.places pl
    JOIN public.profiles pr ON pr.place_id = pl.id
   WHERE pr.id = me;

  target_role := CASE my_role WHEN 'benefactor' THEN 'baby'::profile_role
                              WHEN 'baby'       THEN 'benefactor'::profile_role END;

  -- Parse filters; unknown keys are silently ignored.
  f_min_age := NULLIF(p_filters->>'min_age', '')::int;
  f_max_age := NULLIF(p_filters->>'max_age', '')::int;
  f_distance := NULLIF(p_filters->>'distance_miles', '')::int;
  IF p_filters ? 'interest_ids' THEN
    SELECT array_agg(value::uuid)
      INTO f_interest_ids
      FROM jsonb_array_elements_text(p_filters->'interest_ids');
  END IF;

  IF p_cursor IS NOT NULL THEN
    cur_last_active := split_part(p_cursor, ':', 1)::timestamptz;
    cur_id          := split_part(p_cursor, ':', 2)::uuid;
  END IF;

  FOR rec IN
    SELECT p.id, p.last_active_at
      FROM public.profiles p
      LEFT JOIN public.places pl ON pl.id = p.place_id
     WHERE p.role = target_role
       AND p.status = 'active'
       AND p.id <> me
       AND (p_cursor IS NULL OR (p.last_active_at, p.id) < (cur_last_active, cur_id))
       AND (f_min_age IS NULL
              OR p.date_of_birth IS NULL
              OR extract(year from age(p.date_of_birth))::int >= f_min_age)
       AND (f_max_age IS NULL
              OR p.date_of_birth IS NULL
              OR extract(year from age(p.date_of_birth))::int <= f_max_age)
       -- Disc-aware radius: widen the search by both places' radii so a
       -- metro search includes its overlapping sub-localities.
       AND (f_distance IS NULL
              OR me_place.id IS NULL
              OR pl.id IS NULL
              OR ST_DWithin(me_place.geog, pl.geog,
                   (f_distance + me_place.radius_miles + pl.radius_miles) * 1609.344))
       AND (f_interest_ids IS NULL
              OR EXISTS (
                SELECT 1 FROM public.profile_interests pi
                 WHERE pi.profile_id = p.id
                   AND pi.interest_id = ANY (f_interest_ids)
              ))
     ORDER BY p.last_active_at DESC NULLS LAST, p.id ASC
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

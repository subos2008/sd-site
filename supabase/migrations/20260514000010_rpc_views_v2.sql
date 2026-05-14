-- Plan 03: refresh view RPCs to include like state, interests, and the new bio/physical/lifestyle columns.
-- _profile_card_for_viewer keeps its existing return shape; new key 'my_like_state' goes from NULL to boolean.

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
  my_like boolean;
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

  my_like := EXISTS (
    SELECT 1 FROM public.likes WHERE liker_id = p_viewer AND likee_id = p_target
  );

  RETURN jsonb_build_object(
    'profile_id',         t.id,
    'display_name',       t.display_name,
    'age',                age,
    'city_display_name',  t.city_display_name,
    'distance_miles',     distance_miles,
    'primary_photo_path', primary_photo_path,
    'tagline',            t.tagline,
    'my_like_state',      my_like
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._profile_card_for_viewer(uuid, uuid) TO authenticated;

-- view_profile now includes bio/physical/lifestyle + interests + their_like_state
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
      'city_display_name',  t.city_display_name,
      'gender',             t.gender,
      'looking_for',        t.looking_for,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
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

-- view_my_profile: same shape minus *_like_state, plus role+status+token_balance.
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
      'city_display_name',  t.city_display_name,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
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

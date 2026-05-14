-- Onboarding RPCs: set_profile_role, set_profile_identity, set_profile_location,
-- complete_onboarding. All SECURITY DEFINER, all return jsonb {ok, ...}.

CREATE OR REPLACE FUNCTION public.set_profile_role(p_role profile_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  existing profile_role;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT role INTO existing FROM public.profiles WHERE id = me;
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_already_set');
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = me;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_role(profile_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profile_identity(
  p_display_name  text,
  p_date_of_birth date,
  p_gender        profile_gender,
  p_looking_for   profile_looking_for
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'display_name_required');
  END IF;

  IF p_date_of_birth > (now()::date - interval '18 years') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'under_18');
  END IF;

  UPDATE public.profiles
     SET display_name  = trim(p_display_name),
         date_of_birth = p_date_of_birth,
         gender        = p_gender,
         looking_for   = p_looking_for
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_identity(text, date, profile_gender, profile_looking_for)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profile_location(
  p_display_name text,
  p_lat          double precision,
  p_lng          double precision
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'city_display_name_required');
  END IF;

  IF p_lat IS NULL OR p_lat < -90  OR p_lat > 90 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lat_out_of_range');
  END IF;

  IF p_lng IS NULL OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lng_out_of_range');
  END IF;

  UPDATE public.profiles
     SET city_display_name = trim(p_display_name),
         city_lat          = p_lat,
         city_lng          = p_lng
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_location(text, double precision, double precision)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_onboarding() RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p  public.profiles%ROWTYPE;
  has_photo boolean;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = me;

  IF p.role IS NULL              THEN RETURN jsonb_build_object('ok', false, 'error', 'role_missing');        END IF;
  IF p.display_name IS NULL      THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing');    END IF;
  IF p.date_of_birth IS NULL     THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing');    END IF;
  IF p.city_display_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'location_missing');    END IF;

  SELECT EXISTS(SELECT 1 FROM public.profile_photos WHERE profile_id = me) INTO has_photo;
  IF NOT has_photo THEN
    RETURN jsonb_build_object('ok', false, 'error', 'photo_required');
  END IF;

  IF p.status <> 'pending_onboarding' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending_onboarding');
  END IF;

  UPDATE public.profiles
     SET status = 'active',
         last_active_at = now()
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;

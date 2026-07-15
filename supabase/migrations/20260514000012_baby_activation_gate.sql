-- Fork complete_onboarding by role.
--   benefactor: photo optional (no photo gate at all).
--   baby: config-driven photo minimum + required tagline/about/wants,
--         each bio field >= app_config.onboarding.babyMinBioChars.
-- Fails closed if the onboarding config row/keys are missing.
CREATE OR REPLACE FUNCTION public.complete_onboarding() RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me          uuid := auth.uid();
  p           public.profiles%ROWTYPE;
  cfg         jsonb;
  min_photos  int;
  min_bio     int;
  photo_count int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = me;

  IF p.role IS NULL              THEN RETURN jsonb_build_object('ok', false, 'error', 'role_missing');     END IF;
  IF p.display_name IS NULL      THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.date_of_birth IS NULL     THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.city_display_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'location_missing'); END IF;

  IF p.role = 'baby' THEN
    -- Fail closed: config must exist and be complete.
    SELECT value INTO cfg FROM public.app_config WHERE key = 'onboarding';
    IF cfg IS NULL THEN
      RAISE EXCEPTION 'app_config onboarding key missing' USING errcode = 'P0001';
    END IF;
    min_photos := (cfg->>'babyMinPhotos')::int;
    min_bio    := (cfg->>'babyMinBioChars')::int;
    IF min_photos IS NULL OR min_bio IS NULL THEN
      RAISE EXCEPTION 'app_config onboarding incomplete' USING errcode = 'P0001';
    END IF;

    SELECT count(*) INTO photo_count FROM public.profile_photos WHERE profile_id = me;
    IF photo_count < min_photos THEN
      RETURN jsonb_build_object('ok', false, 'error', 'photos_required');
    END IF;

    IF p.tagline IS NULL OR length(trim(p.tagline)) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'tagline_required');
    END IF;
    IF p.about IS NULL OR length(trim(p.about)) < min_bio THEN
      RETURN jsonb_build_object('ok', false, 'error', 'about_required');
    END IF;
    IF p.wants IS NULL OR length(trim(p.wants)) < min_bio THEN
      RETURN jsonb_build_object('ok', false, 'error', 'wants_required');
    END IF;
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

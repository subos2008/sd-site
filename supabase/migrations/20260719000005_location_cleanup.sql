-- 015 cleanup: places gazetteer is now the single source of truth for
-- location. Drops the transitional denormalised columns and the legacy
-- name+coords RPC, and points complete_onboarding at place_id.

-- 1. set_profile_location stops writing the legacy columns.
CREATE OR REPLACE FUNCTION public.set_profile_location(p_place_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  pl public.places%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO pl FROM public.places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'place_not_found');
  END IF;

  UPDATE public.profiles SET place_id = pl.id WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 2. complete_onboarding checks place_id (body otherwise identical to
--    20260514000012_baby_activation_gate.sql).
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

  IF p.role IS NULL          THEN RETURN jsonb_build_object('ok', false, 'error', 'role_missing');     END IF;
  IF p.display_name IS NULL  THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.date_of_birth IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.place_id IS NULL      THEN RETURN jsonb_build_object('ok', false, 'error', 'location_missing'); END IF;

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

-- 3. Drop the legacy RPC and columns.
DROP FUNCTION public.set_profile_location(text, double precision, double precision);

ALTER TABLE public.profiles
  DROP COLUMN city_display_name,
  DROP COLUMN city_lat,
  DROP COLUMN city_lng;

-- 4. `places` predates this migration (20260719000000_places.sql) but was never
--    added to the service_role grants that 20260514000015_grant_service_role_tables.sql
--    set up for every other app table. scripts/seed-dev-users.mjs now looks places
--    up directly with the service-role key (to resolve place_id by city name), which
--    fails with "permission denied for table places" without this grant — service_role
--    has BYPASSRLS but that does not substitute for the table-level GRANT Postgres
--    still requires.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.places TO service_role;

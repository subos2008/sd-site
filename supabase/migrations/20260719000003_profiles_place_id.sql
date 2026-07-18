-- 015: profiles reference a canonical place. TRANSITIONAL migration — the
-- new set_profile_location(place_id) also keeps the legacy denormalised
-- city_* columns in sync so existing views and complete_onboarding keep
-- working; 20260719000005_location_cleanup.sql removes both the legacy
-- columns and the legacy 3-arg set_profile_location.

ALTER TABLE public.profiles
  ADD COLUMN place_id bigint REFERENCES public.places(id);

CREATE INDEX profiles_place_id_idx ON public.profiles (place_id);

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

  UPDATE public.profiles
     SET place_id          = pl.id,
         -- transitional sync; removed by the cleanup migration
         city_display_name = pl.display_name,
         city_lat          = pl.lat,
         city_lng          = pl.lng
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_location(bigint) TO authenticated;

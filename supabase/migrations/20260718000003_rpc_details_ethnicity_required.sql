-- Drop the DEFAULT NULL on set_profile_details' p_ethnicity parameter.
-- The default was added in 20260718000001 only to keep the then-unthreaded
-- frontend caller resolvable with an 11-arg call. Every caller now threads
-- ethnicity explicitly (setProfileDetails in src/features/profile/api.ts
-- always sends p_ethnicity), so the default is dead. Signature change =>
-- DROP + CREATE (CREATE OR REPLACE cannot alter an argument list).
DROP FUNCTION IF EXISTS public.set_profile_details(
  int, body_type, hair_color, eye_color, boolean, boolean,
  smoking_habit, drinking_habit, education_level, income_band, net_worth_band, ethnicity
);

CREATE FUNCTION public.set_profile_details(
  p_height_cm          int,
  p_body_type          body_type,
  p_hair_color         hair_color,
  p_eye_color          eye_color,
  p_has_piercings      boolean,
  p_has_tattoos        boolean,
  p_smoking            smoking_habit,
  p_drinking           drinking_habit,
  p_education          education_level,
  p_yearly_income_band income_band,
  p_net_worth_band     net_worth_band,
  p_ethnicity          ethnicity
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

  IF p_height_cm IS NOT NULL AND (p_height_cm < 120 OR p_height_cm > 240) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'height_out_of_range');
  END IF;

  UPDATE public.profiles
     SET height_cm          = p_height_cm,
         body_type          = p_body_type,
         hair_color         = p_hair_color,
         eye_color          = p_eye_color,
         has_piercings      = p_has_piercings,
         has_tattoos        = p_has_tattoos,
         smoking            = p_smoking,
         drinking           = p_drinking,
         education          = p_education,
         yearly_income_band = p_yearly_income_band,
         net_worth_band     = p_net_worth_band,
         ethnicity          = p_ethnicity
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_details(
  int, body_type, hair_color, eye_color, boolean, boolean,
  smoking_habit, drinking_habit, education_level, income_band, net_worth_band, ethnicity
) TO authenticated;

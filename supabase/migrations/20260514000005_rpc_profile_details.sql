-- Plan 03: set_profile_details + set_profile_bio. SECURITY DEFINER pattern from spec §6.
-- Every nullable parameter is "leave unchanged-able" by passing NULL; explicit clear via
-- NULL is not supported here (Plan 03 spec doesn't need it — sections always submit full set).

CREATE OR REPLACE FUNCTION public.set_profile_details(
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
  p_net_worth_band     net_worth_band
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
         net_worth_band     = p_net_worth_band
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_details(
  int, body_type, hair_color, eye_color, boolean, boolean,
  smoking_habit, drinking_habit, education_level, income_band, net_worth_band
) TO authenticated;

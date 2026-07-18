-- 015: autocomplete over the places gazetteer. Prefix matches rank first,
-- then trigram similarity catches misspellings; population breaks ties so
-- "man" surfaces Manchester before Mangotsfield. Exposure is limited to
-- app_config location.enabledCountries — fail closed if config is missing.
-- Callable by anon: the pre-auth signup page is the primary caller, and
-- places are public reference data (RLS already allows anon SELECT).

CREATE OR REPLACE FUNCTION public.search_places(p_query text, p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q       text := trim(coalesce(p_query, ''));
  enabled text[];
  results jsonb;
BEGIN
  IF length(q) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'query_too_short');
  END IF;

  SELECT array_agg(t.c) INTO enabled
    FROM jsonb_array_elements_text(
      (SELECT value->'enabledCountries' FROM public.app_config WHERE key = 'location')
    ) AS t(c);
  IF enabled IS NULL THEN
    RAISE EXCEPTION 'location_config_missing' USING errcode = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'display_name', s.display_name)), '[]'::jsonb)
    INTO results
    FROM (
      SELECT id, name, display_name
        FROM public.places
       WHERE country_code = ANY (enabled)
         AND (name ILIKE q || '%' OR similarity(name, q) > 0.4)
       ORDER BY (name ILIKE q || '%') DESC, population DESC, name ASC, id ASC
       LIMIT LEAST(GREATEST(coalesce(p_limit, 10), 1), 20)
    ) s;

  RETURN jsonb_build_object('ok', true, 'places', results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_places(text, int) TO anon, authenticated;

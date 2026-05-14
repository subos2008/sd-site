-- Plan 03: interests RPCs.
-- list_interests: read-only, returns all active interests sorted by category/ordinal/label_key.
-- set_profile_interests: replaces the caller's full interest set in one transaction.

CREATE OR REPLACE FUNCTION public.list_interests() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'interests',
    (SELECT COALESCE(jsonb_agg(
       jsonb_build_object(
         'id',        i.id,
         'label_key', i.label_key,
         'category',  i.category,
         'ordinal',   i.ordinal
       ) ORDER BY i.category, i.ordinal, i.label_key
     ), '[]'::jsonb)
     FROM public.interests i
     WHERE i.active = true)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_interests() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profile_interests(p_interest_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  valid_count int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  -- Validate every id refers to an active interest. Reject the whole call on mismatch.
  IF p_interest_ids IS NULL THEN
    p_interest_ids := ARRAY[]::uuid[];
  END IF;

  SELECT count(*)::int INTO valid_count
    FROM public.interests
   WHERE active = true AND id = ANY (p_interest_ids);

  IF valid_count <> coalesce(cardinality(p_interest_ids), 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_or_inactive_interest');
  END IF;

  IF cardinality(p_interest_ids) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_interests');
  END IF;

  DELETE FROM public.profile_interests WHERE profile_id = me;

  INSERT INTO public.profile_interests (profile_id, interest_id)
    SELECT me, unnest(p_interest_ids);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_interests(uuid[]) TO authenticated;

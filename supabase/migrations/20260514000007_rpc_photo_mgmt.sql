-- Plan 03: profile-photo management RPCs (reorder, remove).
-- add_to_profile_photos remains the insert path (from Plan 02).

CREATE OR REPLACE FUNCTION public.reorder_profile_photos(p_ordered uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  expected_count int;
  given_count int := coalesce(cardinality(p_ordered), 0);
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  -- Every id must belong to the caller's profile_photos.
  SELECT count(*)::int INTO expected_count
    FROM public.profile_photos
   WHERE profile_id = me AND media_item_id = ANY (p_ordered);

  IF expected_count <> given_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_photo');
  END IF;

  -- Also reject if the user has more rows than they're submitting (partial reorder).
  IF (SELECT count(*) FROM public.profile_photos WHERE profile_id = me) <> given_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'photo_set_mismatch');
  END IF;

  -- Apply new ordinals via unnest WITH ORDINALITY.
  UPDATE public.profile_photos pp
     SET ordinal = ord.idx - 1
    FROM unnest(p_ordered) WITH ORDINALITY AS ord(media_item_id, idx)
   WHERE pp.profile_id = me
     AND pp.media_item_id = ord.media_item_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_profile_photos(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_profile_photo(p_media_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  rows_deleted int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  DELETE FROM public.profile_photos
    WHERE profile_id = me AND media_item_id = p_media_item_id;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  IF rows_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Renumber remaining photos to keep ordinals contiguous.
  WITH ranked AS (
    SELECT media_item_id, row_number() OVER (ORDER BY ordinal) - 1 AS new_ord
      FROM public.profile_photos
     WHERE profile_id = me
  )
  UPDATE public.profile_photos pp
     SET ordinal = ranked.new_ord
    FROM ranked
   WHERE pp.profile_id = me
     AND pp.media_item_id = ranked.media_item_id;

  -- Orphan media_items are swept by GC (out of scope here).
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_profile_photo(uuid) TO authenticated;

-- prepare_media_upload — atomically inserts a media_items row (deduping by hash)
-- and returns the deterministic storage path. The frontend then calls
-- supabase.storage.from('media').createSignedUploadUrl(path) to obtain a
-- 5-minute signed upload URL. (Deviation from plan: local Supabase storage
-- version does not expose storage.create_signed_upload_url SQL helper.)

CREATE OR REPLACE FUNCTION public.prepare_media_upload(
  p_kind            media_kind,
  p_hash            text,
  p_size_bytes      int,
  p_width           int,
  p_height          int,
  p_duration_seconds int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me              uuid := auth.uid();
  existing_id     uuid;
  existing_path   text;
  new_id          uuid;
  ext             text;
  s_path          text;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_hash IS NULL OR length(p_hash) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_hash');
  END IF;

  IF p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_size');
  END IF;

  -- Dedup: same owner + same hash → return existing row
  SELECT id, storage_path INTO existing_id, existing_path
    FROM public.media_items
   WHERE owner_id = me AND hash = p_hash;

  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'media_item_id', existing_id,
      'storage_path', existing_path,
      'deduped', true
    );
  END IF;

  ext := CASE p_kind WHEN 'photo' THEN 'jpg' WHEN 'video' THEN 'mp4' END;
  s_path := 'users/' || me::text || '/' || p_hash || '.' || ext;
  new_id := gen_random_uuid();

  INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash,
                                   size_bytes, width, height, duration_seconds, status)
  VALUES (new_id, me, s_path, p_kind, p_hash,
          p_size_bytes, p_width, p_height, p_duration_seconds, 'approved');

  RETURN jsonb_build_object(
    'ok', true,
    'media_item_id', new_id,
    'storage_path', s_path,
    'deduped', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_media_upload(media_kind, text, int, int, int, int)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_media_upload(p_media_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.media_items
                  WHERE id = p_media_item_id AND owner_id = me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  -- In MVP, media_items default to 'approved'; this RPC is a no-op now but exists
  -- as the hook point for pre-launch moderation queue.
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_media_upload(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_to_profile_photos(
  p_media_item_id uuid,
  p_ordinal       int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  k  media_kind;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT kind INTO k FROM public.media_items
   WHERE id = p_media_item_id AND owner_id = me;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF k IS DISTINCT FROM 'photo' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_photo');
  END IF;

  INSERT INTO public.profile_photos (profile_id, media_item_id, ordinal)
  VALUES (me, p_media_item_id, p_ordinal)
  ON CONFLICT (profile_id, media_item_id) DO UPDATE SET ordinal = EXCLUDED.ordinal;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_to_profile_photos(uuid, int) TO authenticated;

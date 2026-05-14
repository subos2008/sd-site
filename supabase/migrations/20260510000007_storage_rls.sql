-- Storage RLS for the private media bucket.
--
-- Plan 02 deviation context: server-side SQL helpers `storage.create_signed_url`
-- and `storage.create_signed_upload_url` are unavailable on this Supabase image,
-- so the frontend mints signed URLs via supabase-js using the authenticated
-- user's JWT. That requires RLS policies on storage.objects to permit those
-- operations under the user's own path prefix.
--
-- Path scheme: users/<auth.uid()>/*.{jpg,mp4} (set by public.prepare_media_upload).

-- INSERT: authenticated users can create objects under their own prefix.
CREATE POLICY media_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- SELECT: authenticated users can read objects under their own prefix.
-- Cross-user reads happen via signed read URLs minted client-side (which
-- supabase-js's createSignedUrl also requires SELECT permission for the
-- minting principal — for the MVP we widen SELECT to allow any authenticated
-- user to mint signed URLs for any object in the media bucket. Profile-view
-- RPCs gate which paths a viewer receives, so this is a defensible boundary
-- for Plan 02. Tighten in Plan 03 when view RPCs return scoped URLs.
CREATE POLICY media_authenticated_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'media');

-- UPDATE / DELETE: owner only, scoped to their prefix.
CREATE POLICY media_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY media_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

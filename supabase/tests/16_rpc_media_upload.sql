BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
        'media-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';

-- 1. Happy path: returns ok=true, media_item_id, signed_upload_url, storage_path
WITH r AS (SELECT public.prepare_media_upload('photo', 'sha256hash1_0000', 4096, 800, 600, NULL) AS body)
SELECT ok((SELECT body->>'ok' FROM r) = 'true',                       'ok=true on first upload');

WITH r AS (SELECT public.prepare_media_upload('photo', 'sha256hash1_0000', 4096, 800, 600, NULL) AS body)
SELECT ok((SELECT body->>'storage_path' FROM r)
            LIKE 'users/77777777-7777-7777-7777-777777777777/%',      'storage_path scoped to owner');

-- 2. Dedup: second call with same hash returns the same media_item_id
WITH r1 AS (SELECT (public.prepare_media_upload('photo','sha256hash2_0000',1024,400,300,NULL))->>'media_item_id' AS id1),
     r2 AS (SELECT (public.prepare_media_upload('photo','sha256hash2_0000',1024,400,300,NULL))->>'media_item_id' AS id2)
SELECT is(
  (SELECT id1 FROM r1),
  (SELECT id2 FROM r2),
  'same hash returns same media_item_id (dedup)'
);

-- 3. finalize_media_upload marks status approved (it was inserted as approved already in MVP)
WITH r  AS (SELECT (public.prepare_media_upload('photo','sha256hash3_0000',1024,400,300,NULL))->>'media_item_id' AS id),
     fr AS (SELECT public.finalize_media_upload((SELECT id FROM r)::uuid) AS body)
SELECT ok((SELECT body->>'ok' FROM fr) = 'true', 'finalize_media_upload ok');

-- 4. add_to_profile_photos happy
WITH r  AS (SELECT (public.prepare_media_upload('photo','sha256hash4_0000',1024,400,300,NULL))->>'media_item_id' AS id)
SELECT is(
  (SELECT public.add_to_profile_photos((SELECT id FROM r)::uuid, 0))::text,
  '{"ok": true}',
  'add_to_profile_photos ok'
);

-- 5. add_to_profile_photos rejects video kind
-- Seed a video media_items row as postgres (bypass deny-all RLS on media_items),
-- then resume as authenticated to call the RPC.
RESET ROLE;
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        '77777777-7777-7777-7777-777777777777',
        'users/77777777-7777-7777-7777-777777777777/v.mp4', 'video', 'videohash_0000000', 9999, 'approved');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';
SELECT is(
  (SELECT public.add_to_profile_photos('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 1))::text,
  '{"ok": false, "error": "not_a_photo"}',
  'add_to_profile_photos rejects video kind'
);

SELECT * FROM finish();
ROLLBACK;

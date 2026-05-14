BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee', '00000000-0000-0000-0000-000000000000',
        'pm@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

-- Seed three approved photos as superuser (media_items has deny-all RLS)
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES
  ('11111111-1111-4111-8111-1111111111aa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee',
   'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee/aa.jpg', 'photo', 'hashAAAAAAAAAAAA01', 1024, 'approved'),
  ('11111111-1111-4111-8111-1111111111bb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee',
   'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee/bb.jpg', 'photo', 'hashAAAAAAAAAAAA02', 1024, 'approved'),
  ('11111111-1111-4111-8111-1111111111cc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee',
   'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee/cc.jpg', 'photo', 'hashAAAAAAAAAAAA03', 1024, 'approved');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee';

-- Add all three (uses Plan 02's add_to_profile_photos)
SELECT public.add_to_profile_photos('11111111-1111-4111-8111-1111111111aa'::uuid, 0);
SELECT public.add_to_profile_photos('11111111-1111-4111-8111-1111111111bb'::uuid, 1);
SELECT public.add_to_profile_photos('11111111-1111-4111-8111-1111111111cc'::uuid, 2);

-- Reorder: reverse to cc, bb, aa
SELECT is(
  (SELECT public.reorder_profile_photos(ARRAY[
    '11111111-1111-4111-8111-1111111111cc'::uuid,
    '11111111-1111-4111-8111-1111111111bb'::uuid,
    '11111111-1111-4111-8111-1111111111aa'::uuid]))::text,
  '{"ok": true}',
  'reorder ok'
);

SELECT is(
  (SELECT media_item_id FROM public.profile_photos
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee'::uuid
    ORDER BY ordinal LIMIT 1),
  '11111111-1111-4111-8111-1111111111cc'::uuid,
  'cc is now ordinal 0'
);

-- Reorder with an id the user doesn't own (cc plus some random uuid)
SELECT is(
  (SELECT public.reorder_profile_photos(ARRAY[
    '11111111-1111-4111-8111-1111111111cc'::uuid,
    gen_random_uuid()]))::text,
  '{"ok": false, "error": "unknown_photo"}',
  'foreign photo id rejected'
);

-- Remove bb
SELECT is(
  (SELECT public.remove_profile_photo('11111111-1111-4111-8111-1111111111bb'::uuid))::text,
  '{"ok": true}',
  'remove ok'
);

-- Now expect 2 photos with ordinals 0,1 (contiguous after remove)
SELECT is(
  (SELECT count(*) FROM public.profile_photos
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee'::uuid)::int,
  2,
  'two photos remain after remove'
);

SELECT * FROM finish();
ROLLBACK;

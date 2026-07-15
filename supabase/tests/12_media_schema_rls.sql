BEGIN;
SELECT plan(9);

SELECT has_table('public', 'media_items', 'media_items table exists');
SELECT has_table('public', 'profile_photos', 'profile_photos junction exists');

-- UNIQUE(owner_id, hash) — dedup invariant
SELECT col_is_unique(
  'public', 'media_items', ARRAY['owner_id', 'hash'],
  'media_items (owner_id, hash) is unique'
);

-- kind enum
SELECT col_type_is('public', 'media_items', 'kind', 'media_kind', 'kind is media_kind enum');

-- profile_photos CHECK: only photos allowed (enforced via FK + trigger or CHECK)
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
        'mediatest@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

-- Second user, inserted here (still postgres role) so RLS fixtures can impersonate
-- it later without needing an authenticated role to write auth.users.
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
        'mediatest2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333',
   'users/33333333-3333-3333-3333-333333333333/photoA.jpg', 'photo', 'hashA', 1234, 'approved'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '33333333-3333-3333-3333-333333333333',
   'users/33333333-3333-3333-3333-333333333333/videoB.mp4', 'video', 'hashB', 5678, 'approved');

-- A photo media_item can be added
INSERT INTO public.profile_photos (profile_id, media_item_id, ordinal)
VALUES ('33333333-3333-3333-3333-333333333333',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0);
SELECT ok(
  EXISTS(SELECT 1 FROM public.profile_photos
         WHERE media_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'photo can be inserted into profile_photos'
);

-- A video media_item cannot be added
SELECT throws_ok(
  $$ INSERT INTO public.profile_photos (profile_id, media_item_id, ordinal)
     VALUES ('33333333-3333-3333-3333-333333333333',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1) $$,
  NULL, NULL,
  'video media_item is rejected by profile_photos kind check'
);

-- Dedup: same owner + same hash → unique violation
SELECT throws_ok(
  $$ INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
     VALUES (gen_random_uuid(),
             '33333333-3333-3333-3333-333333333333',
             'users/33333333-3333-3333-3333-333333333333/dup.jpg', 'photo', 'hashA', 9999, 'approved') $$,
  '23505', NULL,
  'duplicate (owner_id, hash) is rejected'
);

-- media_items: owner can SELECT their own rows directly; a non-owner sees none.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SELECT is(
  (SELECT count(*) FROM public.media_items WHERE owner_id = '33333333-3333-3333-3333-333333333333')::int,
  2,
  'owner can SELECT their own media_items directly'
);

SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SELECT is(
  (SELECT count(*) FROM public.media_items WHERE owner_id = '33333333-3333-3333-3333-333333333333')::int,
  0,
  'non-owner cannot SELECT another user''s media_items (RLS scopes to owner_id = auth.uid())'
);

SELECT * FROM finish();
ROLLBACK;

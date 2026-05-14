BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
        'comp@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';

-- 1. Missing role/identity/location/photo — must fail and NOT transition status
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "role_missing"}',
  'missing role rejected'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  'pending_onboarding',
  'status unchanged after failed completion'
);

-- 2. Fill in everything except a photo
SELECT public.set_profile_role('baby');
SELECT public.set_profile_identity('Lex', '1995-01-01'::date, 'female', 'male');
SELECT public.set_profile_location('Manchester', 53.48, -2.24);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "photo_required"}',
  'missing photo rejected'
);

-- 3. Add a photo, then succeed.
-- Seed media_items row as postgres (bypass deny-all RLS on media_items),
-- then resume as authenticated to call the RPC.
RESET ROLE;
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        '88888888-8888-8888-8888-888888888888',
        'users/88888888-8888-8888-8888-888888888888/p.jpg', 'photo', 'h_complete_hash_16ch', 1024, 'approved');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';
SELECT public.add_to_profile_photos('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 0);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": true}',
  'complete_onboarding succeeds with all preconditions met'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  'active',
  'status transitioned to active'
);

SELECT * FROM finish();
ROLLBACK;

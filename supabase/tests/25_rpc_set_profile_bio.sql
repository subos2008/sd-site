BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad2', '00000000-0000-0000-0000-000000000000',
        'd2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad2';

-- Happy path
SELECT is(
  (SELECT public.set_profile_bio(
    'Adventurer at heart',
    'I love hiking, fine dining, and unexpected weekend trips.',
    'Looking for an honest connection.'))::text,
  '{"ok": true}',
  'set_profile_bio ok'
);

SELECT is(
  (SELECT tagline FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad2'::uuid),
  'Adventurer at heart',
  'tagline persisted'
);

-- Tagline too long
SELECT is(
  (SELECT public.set_profile_bio(repeat('x', 121), NULL, NULL))::text,
  '{"ok": false, "error": "tagline_too_long"}',
  'tagline > 120 chars rejected'
);

-- About too long
SELECT is(
  (SELECT public.set_profile_bio('OK', repeat('y', 4001), NULL))::text,
  '{"ok": false, "error": "about_too_long"}',
  'about > 4000 chars rejected'
);

-- Unauthenticated
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_bio('x', 'y', 'z') $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;

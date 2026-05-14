BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
        'role-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

-- 1. Unauthenticated rejection
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_role('benefactor') $$,
  'P0001', NULL,
  'unauthenticated call raises P0001'
);

-- 2. Happy path
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SELECT is(
  (SELECT public.set_profile_role('benefactor'))::text,
  '{"ok": true}',
  'set_profile_role("benefactor") returns ok'
);
SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444'),
  'benefactor',
  'role is persisted'
);

-- 3. Second call rejected (immutable once set)
SELECT is(
  (SELECT public.set_profile_role('baby'))::text,
  '{"ok": false, "error": "role_already_set"}',
  'second call returns role_already_set error'
);
SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444'),
  'benefactor',
  'original role unchanged'
);

SELECT * FROM finish();
ROLLBACK;

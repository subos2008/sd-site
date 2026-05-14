BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
        'identity-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

-- Pre-req: role chosen (use SELECT-with-discarded-result; PERFORM is plpgsql-only)
SELECT public.set_profile_role('baby');

-- Happy path
SELECT is(
  (SELECT public.set_profile_identity('Sam', '1995-06-15'::date, 'female', 'male'))::text,
  '{"ok": true}',
  'set_profile_identity happy path returns ok'
);

SELECT is(
  (SELECT display_name FROM public.profiles WHERE id = '55555555-5555-5555-5555-555555555555'),
  'Sam',
  'display_name persisted'
);

-- Under 18 rejected (server side)
SELECT is(
  (SELECT public.set_profile_identity('Too Young', (now() - interval '17 years 6 months')::date,
                                       'female', 'male'))::text,
  '{"ok": false, "error": "under_18"}',
  'under-18 DOB returns under_18 error'
);

-- Empty display_name rejected
SELECT is(
  (SELECT public.set_profile_identity('', '1990-01-01'::date, 'female', 'male'))::text,
  '{"ok": false, "error": "display_name_required"}',
  'empty display_name rejected'
);

-- Unauthenticated rejected
RESET ROLE;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_identity('X', '1990-01-01'::date, 'female', 'male') $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;

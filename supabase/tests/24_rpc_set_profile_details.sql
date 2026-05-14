BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1', '00000000-0000-0000-0000-000000000000',
        'd1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1';

-- Happy path
SELECT is(
  (SELECT public.set_profile_details(
    178, 'athletic'::body_type, 'brown'::hair_color, 'blue'::eye_color,
    false, true,
    'never'::smoking_habit, 'socially'::drinking_habit, 'bachelors'::education_level,
    '100_250k'::income_band, '1m_5m'::net_worth_band))::text,
  '{"ok": true}',
  'set_profile_details ok'
);

SELECT is(
  (SELECT height_cm FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1'::uuid),
  178,
  'height_cm persisted'
);

SELECT is(
  (SELECT body_type::text FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1'::uuid),
  'athletic',
  'body_type persisted'
);

-- Out-of-range height rejected (returns error code, doesn't persist)
SELECT is(
  (SELECT public.set_profile_details(
    50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL))::text,
  '{"ok": false, "error": "height_out_of_range"}',
  'height_cm 50 rejected with structured error'
);

-- Unauthenticated raises
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_details(180, NULL, NULL, NULL, NULL, NULL,
                                        NULL, NULL, NULL, NULL, NULL) $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;

BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
        'comp@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';

-- 1. No role yet -> role_missing, status unchanged.
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

-- 2. Benefactor with role only, missing identity -> identity_missing.
SELECT public.set_profile_role('benefactor');
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "identity_missing"}',
  'missing identity rejected'
);

-- 3. Add identity, still missing location -> location_missing.
SELECT public.set_profile_identity('Rich', '1980-01-01'::date, 'male', 'female');
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "location_missing"}',
  'missing location rejected'
);

-- 4. Add location. Benefactor needs NO photo -> ok.
SELECT public.set_profile_location('London', 51.5074, -0.1278);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": true}',
  'benefactor completes with no photo (photo optional)'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  'active',
  'benefactor status transitioned to active'
);

SELECT * FROM finish();
ROLLBACK;

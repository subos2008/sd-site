BEGIN;
SELECT plan(6);

-- Fixture: two confirmed users, one active, one pending.
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'alice@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'bob@local.test',   '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');
-- Trigger created profiles; promote alice to active.
UPDATE public.profiles SET status = 'active', display_name = 'Alice'
 WHERE id = '11111111-1111-1111-1111-111111111111';

-- Switch to authenticated role as alice
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT ok(
  EXISTS(SELECT 1 FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'alice can SELECT her own active profile'
);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222'),
  'alice cannot SELECT pending_onboarding bob via direct SELECT'
);

-- alice can update her own display_name
UPDATE public.profiles SET display_name = 'Alice 2' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT display_name FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'Alice 2',
  'alice can UPDATE her own display_name'
);

-- alice cannot update bob — RLS silently filters bob's row from alice's UPDATE.
-- Assert bob's name is unchanged (becoming superuser to peek).
UPDATE public.profiles SET display_name = 'Hacked' WHERE id = '22222222-2222-2222-2222-222222222222';
RESET ROLE;
SELECT is(
  (SELECT display_name FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222'),
  NULL,
  'alice cannot UPDATE bob (RLS hides his row from her UPDATE, name stays NULL)'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

-- DELETE disallowed — no DELETE policy means RLS filters every row out, so the
-- DELETE silently affects 0 rows. Assert alice's row still exists.
DELETE FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
SELECT ok(
  EXISTS(SELECT 1 FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'DELETE on profiles is disallowed by RLS (alice row survives)'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

-- INSERT disallowed directly (trigger only)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT throws_ok(
  $$ INSERT INTO public.profiles (id, status) VALUES (gen_random_uuid(), 'active') $$,
  '42501', NULL,
  'direct INSERT on profiles is denied'
);

SELECT * FROM finish();
ROLLBACK;

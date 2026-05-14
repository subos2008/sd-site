BEGIN;
SELECT plan(2);

-- Insert directly into auth.users (service-role only path, but pgTAP runs as superuser).
DO $$
DECLARE u uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                          aud, role, created_at, updated_at, confirmation_token, email_change_token_new, recovery_token)
  VALUES (u, '00000000-0000-0000-0000-000000000000', 'trigger-test@local.test',
          '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
          '', '', '');
  PERFORM set_config('test.user_id', u::text, true);
END $$;

SELECT ok(
  EXISTS(SELECT 1 FROM public.profiles WHERE id = current_setting('test.user_id')::uuid),
  'trigger creates profile row'
);

SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = current_setting('test.user_id')::uuid),
  'pending_onboarding',
  'new profile is in pending_onboarding status'
);

SELECT * FROM finish();
ROLLBACK;

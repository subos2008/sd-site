BEGIN;
SELECT plan(3);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01', '00000000-0000-0000-0000-000000000000',
        'hb@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

UPDATE public.profiles SET last_active_at = now() - interval '1 hour'
  WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01';

SELECT is(
  (SELECT public.touch_last_active())::text,
  '{"ok": true}',
  'touch_last_active ok'
);

SELECT ok(
  (SELECT last_active_at > now() - interval '1 second'
     FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01'),
  'last_active_at bumped to now'
);

SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.touch_last_active() $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;

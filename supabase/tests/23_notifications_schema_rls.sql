BEGIN;
SELECT plan(6);

SELECT has_table('public', 'notifications', 'notifications table exists');
SELECT col_is_pk('public', 'notifications', 'id', 'id is PK');

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1', '00000000-0000-0000-0000-000000000000',
   'n1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2', '00000000-0000-0000-0000-000000000000',
   'n2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

-- Seed a notification as superuser
INSERT INTO public.notifications (id, recipient_id, kind, payload)
VALUES ('11111111-1111-4111-8111-111111111101',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1',
        'like',
        '{"actor_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2", "actor_name": "Other"}'::jsonb);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1';

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1'::uuid)::int,
  1,
  'recipient can SELECT their own notification'
);

-- mark read
UPDATE public.notifications SET read_at = now()
  WHERE id = '11111111-1111-4111-8111-111111111101'::uuid;
SELECT ok(
  (SELECT read_at IS NOT NULL FROM public.notifications WHERE id = '11111111-1111-4111-8111-111111111101'::uuid),
  'recipient can UPDATE read_at on own notification'
);

-- Other user cannot see it
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2';
SELECT is(
  (SELECT count(*) FROM public.notifications WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1'::uuid)::int,
  0,
  'other user cannot SELECT someone else notification'
);

-- Other user cannot INSERT (no policy for INSERT to authenticated; RPCs only)
SELECT throws_ok(
  $$ INSERT INTO public.notifications (id, recipient_id, kind, payload)
     VALUES (gen_random_uuid(),
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1'::uuid,
             'placeholder',
             '{}'::jsonb) $$,
  '42501', NULL,
  'direct INSERT into notifications is denied'
);

SELECT * FROM finish();
ROLLBACK;

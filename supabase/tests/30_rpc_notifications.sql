BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01', '00000000-0000-0000-0000-000000000000', 'nf1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc02', '00000000-0000-0000-0000-000000000000', 'nf2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

-- Seed two notifications for user 01 as superuser
INSERT INTO public.notifications (id, recipient_id, kind, payload, created_at)
VALUES
  ('11111111-1111-4111-8111-1111111111e1',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01', 'like',
   jsonb_build_object('actor_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc02', 'actor_name', 'Other'),
   now() - interval '5 minutes'),
  ('11111111-1111-4111-8111-1111111111e2',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01', 'like',
   jsonb_build_object('actor_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc02', 'actor_name', 'Other'),
   now() - interval '1 minute');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01';

WITH r AS (SELECT public.view_notifications(NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'notifications' FROM r)), 2, 'view_notifications returns 2');

-- Ordered newest first
WITH r AS (SELECT public.view_notifications(NULL) AS body)
SELECT is(
  (SELECT body->'notifications'->0->>'id' FROM r),
  '11111111-1111-4111-8111-1111111111e2',
  'most recent first'
);

-- unread count is 2
SELECT is(
  (SELECT public.notifications_unread_count())::text,
  '{"ok": true, "count": 2}',
  'unread count = 2'
);

-- Dismiss one — count drops to 1
SELECT is(
  (SELECT public.dismiss_notification('11111111-1111-4111-8111-1111111111e2'::uuid))::text,
  '{"ok": true}',
  'dismiss ok'
);

SELECT is(
  (SELECT public.notifications_unread_count())::text,
  '{"ok": true, "count": 1}',
  'unread count = 1 after dismiss'
);

SELECT * FROM finish();
ROLLBACK;

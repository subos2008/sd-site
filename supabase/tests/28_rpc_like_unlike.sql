BEGIN;
SELECT plan(7);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1', '00000000-0000-0000-0000-000000000000',
   'lk1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2', '00000000-0000-0000-0000-000000000000',
   'lk2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

UPDATE public.profiles SET status='active', display_name='Like1' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1';
UPDATE public.profiles SET status='active', display_name='Like2' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1';

-- 1. Happy path
SELECT is(
  (SELECT public.like_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid))::text,
  '{"ok": true}',
  'like_profile ok'
);

-- Row created
SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1'::uuid
      AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid)::int,
  1,
  'likes row created'
);

-- Notification created for likee (read as likee to bypass RLS on recipient_id)
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2';
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid
      AND kind = 'like'
      AND payload->>'actor_id' = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1')::int,
  1,
  'notification inserted for likee'
);
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1';

-- 2. Idempotent like — second call no-op, no duplicate notification
SELECT is(
  (SELECT public.like_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid))::text,
  '{"ok": true}',
  'second like still ok'
);

SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2';
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid
      AND kind = 'like')::int,
  1,
  'no duplicate notification on second like'
);
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1';

-- 3. Cannot like self
SELECT is(
  (SELECT public.like_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1'::uuid))::text,
  '{"ok": false, "error": "cannot_like_self"}',
  'cannot like self rejected'
);

-- 4. Unlike happy path
SELECT is(
  (SELECT public.unlike_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid))::text,
  '{"ok": true}',
  'unlike_profile ok'
);

SELECT * FROM finish();
ROLLBACK;

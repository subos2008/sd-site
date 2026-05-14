BEGIN;
SELECT plan(8);

SELECT has_table('public', 'likes', 'likes table exists');
SELECT col_is_pk('public', 'likes', ARRAY['liker_id', 'likee_id'], 'composite PK');

-- Fixture: two users (insert BEFORE switching role, since authenticated lacks auth.users write)
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', '00000000-0000-0000-0000-000000000000',
   'l1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', '00000000-0000-0000-0000-000000000000',
   'l2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

UPDATE public.profiles SET status='active' WHERE id IN
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';

-- INSERT own like: ok
INSERT INTO public.likes (liker_id, likee_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2');

SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid)::int,
  1,
  'liker can SELECT their own like'
);

-- Cannot impersonate someone else's like
SELECT throws_ok(
  $$ INSERT INTO public.likes (liker_id, likee_id) VALUES
       ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1') $$,
  '42501', NULL,
  'cannot INSERT a like with someone else as liker'
);

-- UPDATE is denied: with no UPDATE policy, RLS hides every row from UPDATE,
-- so the statement affects zero rows (rather than raising 42501).
WITH u AS (
  UPDATE public.likes SET created_at = now()
   WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM u)::int,
  0,
  'UPDATE on likes affects 0 rows (no UPDATE policy = deny-all via RLS)'
);

-- Switch to user 2: can SELECT (likee_id = me), cannot DELETE
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2';

SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid)::int,
  1,
  'likee can SELECT likes pointed at them'
);

-- Likee cannot DELETE the like (only liker can)
DELETE FROM public.likes
  WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid
    AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid;
SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid
      AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid)::int,
  1,
  'likee DELETE silently no-ops (RLS hides row from DELETE)'
);

-- Back to liker: DELETE succeeds
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';
DELETE FROM public.likes
  WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid
    AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid;

SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid)::int,
  0,
  'liker can DELETE their own like'
);

SELECT * FROM finish();
ROLLBACK;

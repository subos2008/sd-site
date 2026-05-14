BEGIN;
SELECT plan(10);

SELECT has_table('public', 'interests',         'interests table exists');
SELECT has_table('public', 'profile_interests', 'profile_interests junction exists');

SELECT col_is_pk('public', 'interests', 'id', 'interests.id is PK');
SELECT col_type_is('public', 'interests', 'label_key', 'text', 'label_key is text');

-- profile_interests composite PK
SELECT col_is_pk('public', 'profile_interests', ARRAY['profile_id', 'interest_id'],
                 'profile_interests PK is (profile_id, interest_id)');

-- interests is publicly readable to authenticated users (no RLS surprises)
INSERT INTO public.interests (id, label_key, category, ordinal, active)
VALUES (gen_random_uuid(), 'interest.hiking', 'activities', 0, true);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '00000000-0000-0000-0000-000000000000',
        'i1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

-- profile_interests: owner can insert/select their own row, not others'
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '00000000-0000-0000-0000-000000000000',
        'i2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

SELECT ok(
  (SELECT count(*) FROM public.interests WHERE active = true)::int >= 1,
  'authenticated can SELECT active interests'
);

-- user 1 inserts an interest mapping for themselves
INSERT INTO public.profile_interests (profile_id, interest_id)
  SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, id FROM public.interests LIMIT 1;

SELECT is(
  (SELECT count(*) FROM public.profile_interests WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid)::int,
  1,
  'owner can SELECT their own profile_interests'
);

-- switch to user 2; cannot SELECT user 1's profile_interests
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

SELECT is(
  (SELECT count(*) FROM public.profile_interests WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid)::int,
  0,
  'non-owner cannot SELECT others profile_interests'
);

-- cannot INSERT for someone else
SELECT throws_ok(
  $$ INSERT INTO public.profile_interests (profile_id, interest_id)
     SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, id FROM public.interests LIMIT 1 $$,
  '42501', NULL,
  'cannot INSERT profile_interests for another user'
);

-- cannot directly INSERT a row into interests
SELECT throws_ok(
  $$ INSERT INTO public.interests (id, label_key, category, ordinal, active)
     VALUES (gen_random_uuid(), 'interest.hack', 'other', 0, true) $$,
  '42501', NULL,
  'cannot INSERT into interests as authenticated'
);

SELECT * FROM finish();
ROLLBACK;

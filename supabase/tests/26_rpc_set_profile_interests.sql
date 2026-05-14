BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3', '00000000-0000-0000-0000-000000000000',
        'd3@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3';

-- list_interests returns all active rows
SELECT ok(
  jsonb_array_length((SELECT public.list_interests())->'interests') > 0,
  'list_interests returns at least one row'
);

-- Each entry has id, label_key, category
WITH r AS (SELECT (public.list_interests())->'interests'->0 AS first_one)
SELECT ok(
  (SELECT first_one ? 'id' AND first_one ? 'label_key' AND first_one ? 'category' FROM r),
  'interest objects have id, label_key, category'
);

-- Pick two interest ids
DO $$
DECLARE
  ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.interests LIMIT 2) sub;
  PERFORM set_config('test.ids', ids[1] || ',' || ids[2], true);
END $$;

-- set_profile_interests with two ids
SELECT is(
  (SELECT public.set_profile_interests(
    string_to_array(current_setting('test.ids'), ',')::uuid[]))::text,
  '{"ok": true}',
  'set_profile_interests ok'
);

SELECT is(
  (SELECT count(*) FROM public.profile_interests
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3'::uuid)::int,
  2,
  'two profile_interests rows inserted'
);

-- Replace with one id: prior two are removed, new one inserted
SELECT is(
  (SELECT public.set_profile_interests(
    ARRAY[(string_to_array(current_setting('test.ids'), ','))[1]::uuid]))::text,
  '{"ok": true}',
  'set_profile_interests replace ok'
);

SELECT is(
  (SELECT count(*) FROM public.profile_interests
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3'::uuid)::int,
  1,
  'profile_interests replaced (down to 1)'
);

SELECT * FROM finish();
ROLLBACK;

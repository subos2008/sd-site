BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba01', '00000000-0000-0000-0000-000000000000', 'sf1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02', '00000000-0000-0000-0000-000000000000', 'sf2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03', '00000000-0000-0000-0000-000000000000', 'sf3@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04', '00000000-0000-0000-0000-000000000000', 'sf4@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Viewer',
       date_of_birth='1980-01-01', city_lat=51.5074, city_lng=-0.1278, city_display_name='London',
       last_active_at=now()
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba01';

UPDATE public.profiles SET role='baby', status='active', display_name='Young',
       date_of_birth=(now() - interval '19 years')::date, city_lat=51.5074, city_lng=-0.1278,
       city_display_name='London', last_active_at=now() - interval '1 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02';

UPDATE public.profiles SET role='baby', status='active', display_name='Mid',
       date_of_birth='1995-01-01', city_lat=51.5074, city_lng=-0.1278,
       city_display_name='London', last_active_at=now() - interval '2 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03';

UPDATE public.profiles SET role='baby', status='active', display_name='Far',
       date_of_birth='1995-01-01', city_lat=55.9533, city_lng=-3.1883,  -- Edinburgh, ~330mi from London
       city_display_name='Edinburgh', last_active_at=now() - interval '3 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04';

-- Seed interest mapping under superuser before switching roles (RLS would block this for authenticated)
DO $$
DECLARE iid uuid;
BEGIN
  SELECT id INTO iid FROM public.interests LIMIT 1;
  INSERT INTO public.profile_interests (profile_id, interest_id) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03', iid);
  PERFORM set_config('test.iid', iid::text, false);
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba01';

-- 1. No filters: 3 babies
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 3, 'no filters returns 3 babies');

-- 2. min_age=25 excludes Young (19)
WITH r AS (SELECT public.view_search('{"min_age": 25}'::jsonb, NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 2, 'min_age=25 excludes the 19-year-old');

-- 3. distance_miles=50 excludes Edinburgh
WITH r AS (SELECT public.view_search('{"distance_miles": 50}'::jsonb, NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 2, 'distance 50mi excludes Edinburgh');

-- 4. interest_ids matches only those who share the interest (seeded above)
WITH r AS (SELECT public.view_search(
  jsonb_build_object('interest_ids', jsonb_build_array(current_setting('test.iid')::uuid)),
  NULL
) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 1, 'interest filter narrows to 1');

SELECT * FROM finish();
ROLLBACK;

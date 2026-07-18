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

INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000030, 'TestLondon',    'TestLondon, England',    'GB', 'England', 51.5074, -0.1278, 9000000, 'P', 'PPLC', 0),
  (900000032, 'TestEdinburgh', 'TestEdinburgh, Scotland','GB', 'Scotland', 55.9533, -3.1883, 500000, 'P', 'PPLA', 0);

UPDATE public.profiles SET role='benefactor', status='active', display_name='Viewer',
       date_of_birth='1980-01-01', place_id=900000030,
       last_active_at=now()
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba01';

UPDATE public.profiles SET role='baby', status='active', display_name='Young',
       date_of_birth=(now() - interval '19 years')::date, place_id=900000030,
       last_active_at=now() - interval '1 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02';

UPDATE public.profiles SET role='baby', status='active', display_name='Mid',
       date_of_birth='1995-01-01', place_id=900000030,
       last_active_at=now() - interval '2 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03';

UPDATE public.profiles SET role='baby', status='active', display_name='Far',
       date_of_birth='1995-01-01', place_id=900000032,  -- Edinburgh, ~330mi from London
       last_active_at=now() - interval '3 min'
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

-- The local DB may already contain other active profiles (seeded dev users,
-- e2e-created users) beyond this fixture's four rows, so assertions below
-- count only the fixture's own cards among the ones returned, and pin
-- exclusions by explicitly checking the excluded fixture id is absent —
-- rather than assuming no other rows exist in the world.

-- 1. No filters: all 3 fixture babies (Young, Mid, Far) are visible.
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     fixture_cards AS (
       SELECT (c->>'profile_id')::uuid AS profile_id
         FROM r, jsonb_array_elements(body->'cards') c
        WHERE (c->>'profile_id')::uuid IN (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04'
        )
     )
SELECT is((SELECT count(*) FROM fixture_cards), 3::bigint, 'no filters returns all 3 fixture babies');

-- 2. min_age=25 excludes Young (19); Mid and Far (both fixture ages >= 25) remain.
WITH r AS (SELECT public.view_search('{"min_age": 25}'::jsonb, NULL) AS body),
     fixture_cards AS (
       SELECT (c->>'profile_id')::uuid AS profile_id
         FROM r, jsonb_array_elements(body->'cards') c
        WHERE (c->>'profile_id')::uuid IN (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04'
        )
     )
SELECT ok(
  (SELECT count(*) FROM fixture_cards WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02') = 0
    AND (SELECT count(*) FROM fixture_cards) = 2,
  'min_age=25 excludes the 19-year-old and keeps the other two fixture babies'
);

-- 3. distance_miles=50 excludes Edinburgh (Far); Young and Mid (both London) remain.
WITH r AS (SELECT public.view_search('{"distance_miles": 50}'::jsonb, NULL) AS body),
     fixture_cards AS (
       SELECT (c->>'profile_id')::uuid AS profile_id
         FROM r, jsonb_array_elements(body->'cards') c
        WHERE (c->>'profile_id')::uuid IN (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04'
        )
     )
SELECT ok(
  (SELECT count(*) FROM fixture_cards WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04') = 0
    AND (SELECT count(*) FROM fixture_cards) = 2,
  'distance 50mi excludes Edinburgh and keeps the other two fixture babies'
);

-- 4. interest_ids matches only Mid, who shares the seeded interest.
WITH r AS (SELECT public.view_search(
  jsonb_build_object('interest_ids', jsonb_build_array(current_setting('test.iid')::uuid)),
  NULL
) AS body),
     fixture_cards AS (
       SELECT (c->>'profile_id')::uuid AS profile_id
         FROM r, jsonb_array_elements(body->'cards') c
        WHERE (c->>'profile_id')::uuid IN (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04'
        )
     )
SELECT ok(
  (SELECT array_agg(profile_id) FROM fixture_cards) = ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03'::uuid],
  'interest filter narrows the fixture to just Mid'
);

SELECT * FROM finish();
ROLLBACK;

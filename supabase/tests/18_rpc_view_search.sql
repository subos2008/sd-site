BEGIN;
SELECT plan(4);

-- Fixture: an active benefactor (viewer) and two active babies + one active benefactor (not visible).
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'd@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'b1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'b2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'd2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000030, 'TestLondon',     'TestLondon, England',     'GB', 'England', 51.5074, -0.1278, 9000000, 'P', 'PPLC', 0),
  (900000031, 'TestManchester', 'TestManchester, England', 'GB', 'England', 53.4808, -2.2426, 550000,  'P', 'PPLA', 0);

UPDATE public.profiles SET role='benefactor', status='active', display_name='Daddy',  date_of_birth='1985-01-01', place_id=900000030, last_active_at=now()             WHERE id='aaaaaaaa-0000-0000-0000-000000000001';
UPDATE public.profiles SET role='baby',       status='active', display_name='Baby1',  date_of_birth='1998-01-01', place_id=900000030, last_active_at=now() - interval '1 min' WHERE id='aaaaaaaa-0000-0000-0000-000000000002';
UPDATE public.profiles SET role='baby',       status='active', display_name='Baby2',  date_of_birth='1999-01-01', place_id=900000031, last_active_at=now() - interval '2 min' WHERE id='aaaaaaaa-0000-0000-0000-000000000003';
UPDATE public.profiles SET role='benefactor', status='active', display_name='Daddy2', date_of_birth='1980-01-01', place_id=900000031, last_active_at=now()             WHERE id='aaaaaaaa-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000001';

-- view_search returns cards for a benefactor viewer; the local DB may already
-- contain other active profiles (seeded dev users, e2e-created users), so
-- only assert on the subset of returned cards that belong to this fixture,
-- rather than the total count.
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     fixture_cards AS (
       SELECT c FROM r, jsonb_array_elements(body->'cards') c
        WHERE (c->>'profile_id')::uuid IN (
          'aaaaaaaa-0000-0000-0000-000000000002',
          'aaaaaaaa-0000-0000-0000-000000000003'
        )
     )
SELECT is(
  (SELECT count(*) FROM fixture_cards),
  2::bigint,
  'benefactor sees both fixture baby cards'
);

-- Each card has expected fields (path-based fallback: primary_photo_path)
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     c AS (
       SELECT card FROM r, jsonb_array_elements(body->'cards') card
        WHERE (card->>'profile_id')::uuid = 'aaaaaaaa-0000-0000-0000-000000000002'
     )
SELECT ok((SELECT card ? 'profile_id' AND card ? 'display_name' AND card ? 'age'
              AND card ? 'city_display_name' AND card ? 'distance_miles'
              AND card ? 'primary_photo_path' FROM c),
  'card has all required fields');

-- Ordering: London baby (closer + more recent) ranks ahead of the Manchester
-- baby among the fixture's own cards (unrelated rows may be interleaved, so
-- compare the two fixture cards' relative positions rather than assuming
-- either is literally first in the array).
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     positions AS (
       SELECT (card->>'profile_id')::uuid AS profile_id, ord
         FROM r, jsonb_array_elements(body->'cards') WITH ORDINALITY AS t(card, ord)
        WHERE (card->>'profile_id')::uuid IN (
          'aaaaaaaa-0000-0000-0000-000000000002',
          'aaaaaaaa-0000-0000-0000-000000000003'
        )
     )
SELECT ok(
  (SELECT ord FROM positions WHERE profile_id = 'aaaaaaaa-0000-0000-0000-000000000002')
    < (SELECT ord FROM positions WHERE profile_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'closer + more recent baby ranks ahead of the further, staler one'
);

-- A baby viewer sees benefactors only; again scope to the fixture's own rows.
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000002';
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     fixture_cards AS (
       SELECT c FROM r, jsonb_array_elements(body->'cards') c
        WHERE (c->>'profile_id')::uuid IN (
          'aaaaaaaa-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000004'
        )
     )
SELECT is(
  (SELECT count(*) FROM fixture_cards),
  2::bigint,
  'baby sees both fixture benefactor cards'
);

SELECT * FROM finish();
ROLLBACK;

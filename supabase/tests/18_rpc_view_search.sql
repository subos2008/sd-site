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

UPDATE public.profiles SET role='benefactor', status='active', display_name='Daddy',  date_of_birth='1985-01-01', city_lat=51.5074, city_lng=-0.1278, city_display_name='London', last_active_at=now()             WHERE id='aaaaaaaa-0000-0000-0000-000000000001';
UPDATE public.profiles SET role='baby',       status='active', display_name='Baby1',  date_of_birth='1998-01-01', city_lat=51.5074, city_lng=-0.1278, city_display_name='London', last_active_at=now() - interval '1 min' WHERE id='aaaaaaaa-0000-0000-0000-000000000002';
UPDATE public.profiles SET role='baby',       status='active', display_name='Baby2',  date_of_birth='1999-01-01', city_lat=53.4808, city_lng=-2.2426, city_display_name='Manchester', last_active_at=now() - interval '2 min' WHERE id='aaaaaaaa-0000-0000-0000-000000000003';
UPDATE public.profiles SET role='benefactor', status='active', display_name='Daddy2', date_of_birth='1980-01-01', city_lat=53.4808, city_lng=-2.2426, city_display_name='Manchester', last_active_at=now()             WHERE id='aaaaaaaa-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000001';

-- view_search returns array of baby cards for a benefactor viewer
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(
  jsonb_array_length((SELECT body->'cards' FROM r)),
  2,
  'benefactor sees 2 baby cards'
);

-- Each card has expected fields (path-based fallback: primary_photo_path)
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     c AS (SELECT (body->'cards'->0) AS card FROM r)
SELECT ok((SELECT card ? 'profile_id' AND card ? 'display_name' AND card ? 'age'
              AND card ? 'city_display_name' AND card ? 'distance_miles'
              AND card ? 'primary_photo_path' FROM c),
  'card has all required fields');

-- Ordering: London baby (closer + more recent) appears first for London viewer
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(
  (SELECT body->'cards'->0->>'display_name' FROM r),
  'Baby1',
  'closer + more recent baby ranks first'
);

-- A baby viewer sees benefactors only
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000002';
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(
  jsonb_array_length((SELECT body->'cards' FROM r)),
  2,
  'baby sees 2 benefactor cards'
);

SELECT * FROM finish();
ROLLBACK;

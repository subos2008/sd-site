BEGIN;
SELECT plan(5);

-- Fixture geometry: A is a metro (radius 8) at 53.00N. B is a town (radius 1)
-- 0.18 deg north = ~12.4 mi away. C is a town (radius 1) 2 deg south = ~138 mi.
INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000020, 'Metroville', 'Metroville, England', 'GB', 'England', 53.00, -2.00, 2000000, 'P', 'PPLA', 8),
  (900000021, 'Subtown',    'Subtown, England',    'GB', 'England', 53.18, -2.00, 9000,    'P', 'PPL',  1),
  (900000022, 'Fartown',    'Fartown, England',    'GB', 'England', 51.00, -2.00, 9000,    'P', 'PPL',  1);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'v@x',  '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'b1@x2', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'b2@x2', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('cccccccc-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'b3@x2', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Viewer', date_of_birth='1980-01-01', place_id=900000020, last_active_at=now()                       WHERE id='cccccccc-0000-0000-0000-000000000001';
UPDATE public.profiles SET role='baby',       status='active', display_name='SameMetro', date_of_birth='1998-01-01', place_id=900000020, last_active_at=now() - interval '1 min' WHERE id='cccccccc-0000-0000-0000-000000000002';
UPDATE public.profiles SET role='baby',       status='active', display_name='NearTown',  date_of_birth='1998-01-01', place_id=900000021, last_active_at=now() - interval '2 min' WHERE id='cccccccc-0000-0000-0000-000000000003';
UPDATE public.profiles SET role='baby',       status='active', display_name='FarAway',   date_of_birth='1998-01-01', place_id=900000022, last_active_at=now() - interval '3 min' WHERE id='cccccccc-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'cccccccc-0000-0000-0000-000000000001';

-- Same place: effective distance is exactly 0, never a misleading decimal.
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     c AS (SELECT e.card FROM r, jsonb_array_elements(r.body->'cards') AS e(card)
            WHERE e.card->>'display_name' = 'SameMetro')
SELECT is((SELECT (card->>'distance_miles')::double precision FROM c), 0::double precision,
          'same-place profiles read as distance 0');

-- Overlap-adjusted: ~12.4 centroid − 8 − 1 ≈ 3.4 effective.
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     c AS (SELECT e.card FROM r, jsonb_array_elements(r.body->'cards') AS e(card)
            WHERE e.card->>'display_name' = 'NearTown')
SELECT ok((SELECT (card->>'distance_miles')::double precision BETWEEN 2.5 AND 4.5 FROM c),
          'nearby town distance is disc-adjusted (~3.4 mi)');

-- Card city_display_name is the short place name.
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     c AS (SELECT e.card FROM r, jsonb_array_elements(r.body->'cards') AS e(card)
            WHERE e.card->>'display_name' = 'SameMetro')
SELECT is((SELECT card->>'city_display_name' FROM c), 'Metroville',
          'card shows the short place name');

-- Radius filter is disc-aware: 5-mile search from the metro INCLUDES the
-- overlapping near town (12.4 <= 5 + 8 + 1) but EXCLUDES the far town.
WITH r AS (SELECT public.view_search('{"distance_miles": 5}'::jsonb, NULL) AS body)
SELECT is((SELECT jsonb_array_length(body->'cards') FROM r), 2,
          '5-mile disc search includes same-place and overlapping town only');
WITH r AS (SELECT public.view_search('{"distance_miles": 5}'::jsonb, NULL) AS body)
SELECT ok((SELECT NOT jsonb_path_exists(body, '$.cards[*] ? (@.display_name == "FarAway")') FROM r),
          'far town excluded by disc search');

SELECT * FROM finish();
ROLLBACK;

BEGIN;
SELECT plan(7);

-- Fixture places (ids far above any GeoNames id in the seed).
-- Fixture names use arbitrary prefixes to avoid similarity matches with real place names.
INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000001, 'Blibford',       'Blibford, England',             'GB', 'England', 53.48, -2.24, 500000,  'P', 'PPL', 5),
  (900000002, 'Blibfordton',    'Blibfordton, England',          'GB', 'England', 53.40, -2.20, 8000,    'P', 'PPL', 1),
  (900000003, 'Blobham',        'Blobham, Greater London',       'GB', 'England', 51.45, -0.30, 20000,   'P', 'PPL', 2),
  (900000004, 'Blobham',        'Blobham, North Yorkshire',      'GB', 'England', 54.40, -1.73, 8000,    'P', 'PPL', 1),
  (900000005, 'Blobton',        'Blobton',                       'US', NULL,      40.70, -74.0, 9000000, 'P', 'PPL', 8);

-- The whole test runs as anon: signup-page autocomplete is pre-auth.
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';

WITH r AS (SELECT public.search_places('Blib') AS body)
SELECT is((SELECT body->>'ok' FROM r), 'true', 'anon can search places');

SELECT is((SELECT public.search_places('a'))::jsonb->>'ok', 'false', 'short query returns ok:false');

-- Prefix + population ranking: bigger town first for a shared prefix.
WITH r AS (SELECT public.search_places('Blib') AS body)
SELECT is((SELECT body->'places'->0->>'name' FROM r), 'Blibford',
          'higher-population prefix match ranks first');
WITH r AS (SELECT public.search_places('Blib') AS body)
SELECT is((SELECT body->'places'->1->>'name' FROM r), 'Blibfordton',
          'smaller prefix match ranks second');

-- Disambiguating context: two same-name places, distinct display_names.
WITH r AS (SELECT public.search_places('Blob') AS body)
SELECT is((SELECT jsonb_array_length(body->'places') FROM r), 2,
          'both same-name places returned');
WITH r AS (SELECT public.search_places('Blob') AS body)
SELECT isnt((SELECT body->'places'->0->>'display_name' FROM r),
            (SELECT body->'places'->1->>'display_name' FROM r),
            'display_names disambiguate');

-- Country filter: US fixture is invisible.
WITH r AS (SELECT public.search_places('Blob') AS body)
SELECT is((SELECT jsonb_array_length(body->'places') FROM r), 2,
          'only GB results returned (US filtered)');

SELECT * FROM finish();
ROLLBACK;

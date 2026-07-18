BEGIN;
SELECT plan(11);

-- Fixture places (ids far above any GeoNames id in the seed).
-- Fixture names use arbitrary prefixes to avoid similarity matches with real place names.
-- Collision-freedom against the local seed was verified with:
--   SELECT count(*) FROM places WHERE name ILIKE '<prefix>%' OR similarity(name, '<prefix>') > 0.4;
-- (0 rows for every prefix/typo used below; see task-3-report.md "Fix round 1").
INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000001, 'Blibford',       'Blibford, England',             'GB', 'England', 53.48, -2.24, 500000,  'P', 'PPL', 5),
  (900000002, 'Blibfordton',    'Blibfordton, England',          'GB', 'England', 53.40, -2.20, 8000,    'P', 'PPL', 1),
  (900000003, 'Blobham',        'Blobham, Greater London',       'GB', 'England', 51.45, -0.30, 20000,   'P', 'PPL', 2),
  (900000004, 'Blobham',        'Blobham, North Yorkshire',      'GB', 'England', 54.40, -1.73, 8000,    'P', 'PPL', 1),
  (900000005, 'Blustertown',    'Blustertown',                   'US', NULL,      40.70, -74.0, 9000000, 'P', 'PPL', 8);

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

-- Country filter (independent check): 'Bluster' prefix-matches ONLY the US
-- fixture (Blustertown), which shares no prefix with any GB fixture. A
-- regression that filtered the wrong country would show up here even though
-- assertions 5-6 (which require the GB fixtures to survive) would still pass.
WITH r AS (SELECT public.search_places('Bluster') AS body)
SELECT is((SELECT jsonb_array_length(body->'places') FROM r), 0,
          'non-enabled country (US) fixture is filtered out');

-- Trigram similarity fallback: 'Blipford' is a misspelling (not a prefix) of
-- the GB fixture 'Blibford'; similarity('Blibford','Blipford') = 0.5, safely
-- above the 0.4 threshold, and it does not prefix-match anything.
WITH r AS (SELECT public.search_places('Blipford') AS body)
SELECT is((SELECT jsonb_array_length(body->'places') FROM r), 1,
          'misspelling matches via trigram similarity');
WITH r AS (SELECT public.search_places('Blipford') AS body)
SELECT is((SELECT body->'places'->0->>'name' FROM r), 'Blibford',
          'similarity match returns the correct fixture');

-- A clearly-unrelated query matches nothing (prefix or similarity).
WITH r AS (SELECT public.search_places('Zqxvunrelated') AS body)
SELECT is((SELECT jsonb_array_length(body->'places') FROM r), 0,
          'unrelated query returns no results');

-- Fail-closed: if the location app_config row is missing, the RPC raises
-- rather than silently returning unfiltered (or empty) results. The DELETE
-- needs write access to app_config, so run it before switching back to the
-- anon role (RESET ROLE does not clear the request.jwt.claim.sub GUC, so it
-- is re-set explicitly for the throws_ok call).
RESET ROLE;
DELETE FROM public.app_config WHERE key = 'location';
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_ok(
  $$ SELECT public.search_places('Blib') $$,
  'P0001', 'location_config_missing',
  'fail-closed: raises when location config is missing'
);

SELECT * FROM finish();
ROLLBACK;

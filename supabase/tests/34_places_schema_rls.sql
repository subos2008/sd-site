BEGIN;
SELECT plan(7);

SELECT has_table('public', 'places', 'places table exists');
SELECT has_column('public', 'places', 'display_name', 'display_name column');
SELECT has_column('public', 'places', 'radius_miles', 'radius_miles column');
SELECT has_column('public', 'places', 'geog',         'geog generated column');

-- anon can read (public reference data)
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT lives_ok($$SELECT count(*) FROM public.places$$, 'anon can select places');
RESET ROLE;

-- authenticated can read but not write
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT count(*) FROM public.places$$, 'authenticated can select places');
SELECT throws_ok(
  $$INSERT INTO public.places (id, name, display_name, country_code, lat, lng, population, feature_class, feature_code, radius_miles)
    VALUES (900000099, 'X', 'X', 'GB', 0, 0, 0, 'P', 'PPL', 1)$$,
  '42501', NULL, 'authenticated cannot insert places');

SELECT * FROM finish();
ROLLBACK;

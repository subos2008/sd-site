BEGIN;
SELECT plan(5);

SELECT cmp_ok((SELECT count(*)::int FROM public.places WHERE country_code = 'GB'),
              '>', 3000, 'GB seed has thousands of rows');
SELECT is((SELECT radius_miles FROM public.places WHERE id = 2643743),
          8::double precision, 'London (geonameid 2643743) has metro radius 8');
SELECT cmp_ok((SELECT population FROM public.places WHERE id = 2643743),
              '>', 1000000::bigint, 'London population sanity');
SELECT cmp_ok((SELECT count(*)::int FROM public.places
                WHERE country_code = 'GB' AND feature_code = 'PPLX'),
              '>', 100, 'sub-locality (PPLX) rows are included');
SELECT is((SELECT count(*)::int FROM public.places WHERE country_code <> 'GB'),
          0, 'committed seed is GB-only');

SELECT * FROM finish();
ROLLBACK;

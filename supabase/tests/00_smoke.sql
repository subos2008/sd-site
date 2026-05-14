BEGIN;
SELECT plan(3);

-- pgTAP is included with Supabase's local Postgres.
SELECT has_extension('postgis', 'PostGIS extension is enabled');

SELECT has_table('public', 'app_config', 'app_config table exists');

SELECT ok(
  (SELECT count(*) FROM public.app_config) >= 4,
  'app_config has at least 4 rows seeded from shared/app-config.ts'
);

SELECT * FROM finish();
ROLLBACK;

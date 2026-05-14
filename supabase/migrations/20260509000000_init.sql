-- Enable PostGIS for distance queries on profile centroids.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Application configuration table.
-- Seeded by a build step from shared/app-config.ts (see scripts/gen-config.mjs).
-- RPCs read configuration values from this table at runtime.
CREATE TABLE IF NOT EXISTS public.app_config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

COMMENT ON TABLE public.app_config IS
  'Configuration values seeded from shared/app-config.ts at build time.';

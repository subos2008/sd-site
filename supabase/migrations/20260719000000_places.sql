-- 015: canonical place gazetteer (GeoNames-seeded). Public reference data:
-- readable by everyone, writable by nobody at runtime (rows arrive via the
-- generated seed migration, see scripts/build-places-seed.mjs).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.places (
  id            bigint PRIMARY KEY,   -- GeoNames geonameid
  name          text NOT NULL,
  display_name  text NOT NULL,        -- "Richmond, Greater London" — disambiguated, for autocomplete options
  country_code  text NOT NULL,        -- ISO-3166 alpha-2
  admin1_name   text,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  population    bigint NOT NULL DEFAULT 0,
  feature_class text NOT NULL,
  feature_code  text NOT NULL,
  radius_miles  double precision NOT NULL,
  geog          geography(Point, 4326) GENERATED ALWAYS AS
                  (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED
);

COMMENT ON TABLE public.places IS
  'Gazetteer seeded from GeoNames cities500 (CC BY 4.0). radius_miles is a population-derived disc radius used by the metro-aware distance model; see execution/015.';

CREATE INDEX places_name_trgm_idx   ON public.places USING gin (name gin_trgm_ops);
CREATE INDEX places_country_pop_idx ON public.places (country_code, population DESC);
CREATE INDEX places_geog_idx        ON public.places USING gist (geog);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY places_read ON public.places FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.places TO anon, authenticated;

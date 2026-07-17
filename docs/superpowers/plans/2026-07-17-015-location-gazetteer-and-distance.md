# 015: Location Gazetteer, Autocomplete, and Metro-Aware Distance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the postcodes.io geocoding dependency with a local GeoNames-seeded `places` gazetteer, make the onboarding location step a pick-from-list typeahead, move profiles to a canonical `place_id`, and switch distance to a population-radius disc model so same-metro users stop seeing "0 mi" false precision.

**Architecture:** A `places` table (GeoNames cities500, GB subset committed as a generated seed migration) is public reference data. Autocomplete is a `search_places` RPC (pg_trgm prefix + similarity, ranked by population, country-filtered via `app_config`). `profiles.place_id` replaces the three denormalised city columns; view RPCs join `places` and report effective distance `max(0, centroid_distance − r_a − r_b)`. The `geocode-city` edge function is deleted; no request leaves our infrastructure.

**Tech Stack:** Postgres (PostGIS, pg_trgm, pgTAP), Supabase RPCs (plpgsql, SECURITY DEFINER, jsonb envelope), React + react-query + zod contracts, MSW unit tests, Playwright e2e, Node seed-generation script (esbuild-free, curl+unzip).

## Global Constraints

- Migrations live in `supabase/migrations/` and are plain SQL; new ones in this plan use timestamps `20260719000000`–`20260719000005` (the repo already has `20260718…` files — do not go below that).
- pgTAP fixture rule (repo CLAUDE.md): INSERT into `auth.users` and any RLS-protected reference data (including `places`) BEFORE `SET LOCAL ROLE authenticated`. Switching to `anon` requires `SET LOCAL "request.jwt.claim.sub" = ''` first.
- All RPCs: `SECURITY DEFINER`, `SET search_path = public` (add `, storage, extensions` only where the current function already has it), return jsonb `{ok, ...}` envelopes, `GRANT EXECUTE ... TO authenticated`.
- `supabase db reset` may report `Error status 502: invalid response from upstream server` on CLI 2.78.1 — migrations still apply; verify with `supabase status` + a psql query, do not treat as failure.
- Do NOT prepend `PATH=/usr/bin:...` to `pnpm build` (breaks arm64 rollup bindings). Plain `pnpm build` only.
- No emoji anywhere (commits, docs, code). Do not mention Claude in commit messages. Commit each task; do NOT `git push` (hook enforces).
- GeoNames data is CC BY 4.0 — visible attribution ships in this plan (Task 8), not as a follow-up.
- Frontend errors must be surfaced: any query/mutation handled inline sets `meta: { suppressGlobalError: true }` AND renders the error (name + message) itself.
- Never excuse a failing check as pre-existing; fix it in the task where it surfaces.
- `pnpm test:db` requires local Supabase running (`supabase status` to check; `supabase start` if not).

---

### Task 1: `places` table, extensions, indexes, RLS

**Files:**
- Create: `supabase/migrations/20260719000000_places.sql`
- Test: `supabase/tests/34_places_schema_rls.sql`

**Interfaces:**
- Consumes: PostGIS (already enabled in `20260509000000_init.sql`, objects in `public`).
- Produces: `public.places` (columns `id bigint PK, name text, display_name text, country_code text, admin1_name text, lat/lng double precision, population bigint, feature_class text, feature_code text, radius_miles double precision, geog geography(Point,4326) generated`). SELECT-only for `anon`+`authenticated`. Later tasks rely on exactly these column names.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/34_places_schema_rls.sql`:

```sql
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: `34_places_schema_rls` FAILS (`places` table does not exist). All pre-existing tests still pass.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260719000000_places.sql`:

```sql
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
```

Known risk: if `CREATE TABLE` rejects the generated `geog` column (immutability complaint from the local PostGIS build), fall back to dropping the generated column and instead creating `CREATE INDEX places_geog_idx ON public.places USING gist ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography));` and using the same expression inline wherever later tasks reference `geog`. Log this as a deviation if taken.

- [ ] **Step 4: Apply and verify it passes**

Run: `supabase db reset` (502 warning is fine — verify with `supabase status`), then `pnpm test:db`
Expected: all tests pass, including `34_places_schema_rls` (7/7).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260719000000_places.sql supabase/tests/34_places_schema_rls.sql
git commit -m "Add places gazetteer table with trgm/gist indexes and read-only RLS"
```

---

### Task 2: GB seed generator script + committed seed migration

**Files:**
- Create: `scripts/build-places-seed.mjs`
- Create (generated, committed): `supabase/migrations/20260719000001_places_seed_gb.sql`
- Modify: `package.json` (add `gen:places` script)
- Test: `supabase/tests/35_places_seed.sql`

**Interfaces:**
- Consumes: `public.places` from Task 1.
- Produces: ~4–9k GB rows in `places` on every `supabase db reset`. Radius buckets (population → miles): `>=1,000,000 → 8`, `>=250,000 → 5`, `>=50,000 → 3`, `>=10,000 → 2`, else `1`. London is geonameid `2643743`. Retuning buckets = edit the script, re-run `pnpm gen:places`, commit the regenerated migration.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/35_places_seed.sql`:

```sql
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: `35_places_seed` FAILS (0 rows). `34` still passes.

- [ ] **Step 3: Write the generator script**

Create `scripts/build-places-seed.mjs`:

```js
#!/usr/bin/env node
// Regenerates the committed GB places seed migration from the GeoNames
// cities500 dump (CC BY 4.0, https://www.geonames.org/).
//
// Deterministic: the same input dump produces the same SQL. Downloads are
// cached in node_modules/.cache/geonames; delete the cache to refresh data.
// Re-run (pnpm gen:places) to retune radius buckets or refresh the dump,
// then commit the regenerated migration.
//
// Global import is a data refresh, not a re-platform: remove the GB filter
// (and extend the admin-name maps) to emit other countries. Launch exposure
// stays UK-only via app_config location.enabledCountries regardless.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const cacheDir = resolve(repoRoot, 'node_modules/.cache/geonames')
const zipPath = resolve(cacheDir, 'cities500.zip')
const txtPath = resolve(cacheDir, 'cities500.txt')
const admin2Path = resolve(cacheDir, 'admin2Codes.txt')
const outMigration = resolve(repoRoot, 'supabase/migrations/20260719000001_places_seed_gb.sql')

mkdirSync(cacheDir, { recursive: true })
if (!existsSync(txtPath)) {
  if (!existsSync(zipPath)) {
    console.log('Downloading GeoNames cities500.zip…')
    execFileSync('curl', ['-fsSL', '-o', zipPath,
      'https://download.geonames.org/export/dump/cities500.zip'], { stdio: 'inherit' })
  }
  execFileSync('unzip', ['-o', zipPath, '-d', cacheDir], { stdio: 'inherit' })
}
if (!existsSync(admin2Path)) {
  console.log('Downloading GeoNames admin2Codes.txt…')
  execFileSync('curl', ['-fsSL', '-o', admin2Path,
    'https://download.geonames.org/export/dump/admin2Codes.txt'], { stdio: 'inherit' })
}

// GB admin1 codes -> country-of-the-UK names (fallback context when no admin2).
const GB_ADMIN1 = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' }

// admin2Codes.txt: "GB.ENG.GLA<TAB>Greater London<TAB>ascii<TAB>geonameid"
const admin2 = new Map()
for (const line of readFileSync(admin2Path, 'utf8').split('\n')) {
  if (!line.startsWith('GB.')) continue
  const [code, name] = line.split('\t')
  admin2.set(code, name)
}

function radiusMiles(population) {
  if (population >= 1_000_000) return 8
  if (population >= 250_000) return 5
  if (population >= 50_000) return 3
  if (population >= 10_000) return 2
  return 1
}

// cities500 dump columns (tab-separated):
// 0 geonameid, 1 name, 2 asciiname, 3 alternatenames, 4 latitude, 5 longitude,
// 6 feature class, 7 feature code, 8 country code, 9 cc2, 10 admin1 code,
// 11 admin2 code, 12 admin3, 13 admin4, 14 population, ...
const rows = []
for (const line of readFileSync(txtPath, 'utf8').split('\n')) {
  if (!line) continue
  const f = line.split('\t')
  if (f[8] !== 'GB') continue
  if (f[6] !== 'P') continue
  const admin1Name = GB_ADMIN1[f[10]] ?? null
  const admin2Name = admin2.get(`GB.${f[10]}.${f[11]}`) ?? null
  const context = admin2Name ?? admin1Name
  const population = Number(f[14]) || 0
  rows.push({
    id: Number(f[0]),
    name: f[1],
    display_name: context ? `${f[1]}, ${context}` : f[1],
    country_code: f[8],
    admin1_name: admin1Name,
    lat: Number(f[4]),
    lng: Number(f[5]),
    population,
    feature_class: f[6],
    feature_code: f[7],
    radius_miles: radiusMiles(population),
  })
}
rows.sort((a, b) => a.id - b.id)
if (rows.length < 3000) {
  console.error(`Only ${rows.length} GB rows parsed — dump format changed or download truncated. Aborting.`)
  process.exit(1)
}

const esc = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`)
const chunks = []
for (let i = 0; i < rows.length; i += 1000) {
  const values = rows
    .slice(i, i + 1000)
    .map(
      (r) =>
        `(${r.id},${esc(r.name)},${esc(r.display_name)},${esc(r.country_code)},${esc(r.admin1_name)},${r.lat},${r.lng},${r.population},${esc(r.feature_class)},${esc(r.feature_code)},${r.radius_miles})`,
    )
    .join(',\n')
  chunks.push(
    `INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES\n${values}\nON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, display_name=EXCLUDED.display_name, country_code=EXCLUDED.country_code, admin1_name=EXCLUDED.admin1_name, lat=EXCLUDED.lat, lng=EXCLUDED.lng, population=EXCLUDED.population, feature_class=EXCLUDED.feature_class, feature_code=EXCLUDED.feature_code, radius_miles=EXCLUDED.radius_miles;`,
  )
}

writeFileSync(
  outMigration,
  `-- AUTO-GENERATED by scripts/build-places-seed.mjs from GeoNames cities500 (CC BY 4.0).
-- DO NOT EDIT BY HAND. Run \`pnpm gen:places\` to regenerate.
-- Source: https://download.geonames.org/export/dump/cities500.zip

${chunks.join('\n\n')}
`,
)
console.log(`Wrote ${rows.length} GB places to`, outMigration)
```

- [ ] **Step 4: Add the package script**

In `package.json` `"scripts"`, after `"gen:config"`:

```json
    "gen:places": "node scripts/build-places-seed.mjs",
```

- [ ] **Step 5: Generate the seed and verify it passes**

Run: `pnpm gen:places` (network fetch from download.geonames.org — allowed on the dev machine, never at migration/test time), then `supabase db reset`, then `pnpm test:db`
Expected: `35_places_seed` passes 5/5. Sanity: `git diff --stat` shows one new ~1–2 MB migration file.

If the row-count or PPLX-count thresholds are off because the live dump differs from assumptions, adjust the TEST thresholds to reality (they are sanity checks, not spec) and log a deviation.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-places-seed.mjs supabase/migrations/20260719000001_places_seed_gb.sql supabase/tests/35_places_seed.sql package.json
git commit -m "Seed GB places from GeoNames cities500 via generated migration"
```

---

### Task 3: `search_places` autocomplete RPC + country config

**Files:**
- Modify: `shared/app-config.ts` (add `location.enabledCountries`)
- Regenerate: `supabase/migrations/20260509000001_app_config_seed.sql` (via `pnpm gen:config`)
- Create: `supabase/migrations/20260719000002_rpc_search_places.sql`
- Test: `supabase/tests/36_rpc_search_places.sql`

**Interfaces:**
- Consumes: `public.places`, `public.app_config` (`key='location'`, `value->'enabledCountries'` jsonb array).
- Produces: `public.search_places(p_query text, p_limit int DEFAULT 10) RETURNS jsonb` — `{ok:true, places:[{id, name, display_name}]}` ranked prefix-first then population; `{ok:false, error:'query_too_short'}` for <2 chars; raises `location_config_missing` if config absent (fail closed, no ambient default). Granted to `authenticated` only.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/36_rpc_search_places.sql`:

```sql
BEGIN;
SELECT plan(7);

-- Fixture places (ids far above any GeoNames id in the seed).
INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000001, 'Testchester',    'Testchester, England',          'GB', 'England', 53.48, -2.24, 500000,  'P', 'PPL', 5),
  (900000002, 'Testchesterton', 'Testchesterton, England',       'GB', 'England', 53.40, -2.20, 8000,    'P', 'PPL', 1),
  (900000003, 'Richmondtest',   'Richmondtest, Greater London',  'GB', 'England', 51.45, -0.30, 20000,   'P', 'PPL', 2),
  (900000004, 'Richmondtest',   'Richmondtest, North Yorkshire', 'GB', 'England', 54.40, -1.73, 8000,    'P', 'PPL', 1),
  (900000005, 'Testville',      'Testville',                     'US', NULL,      40.70, -74.0, 9000000, 'P', 'PPL', 8);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
        'places-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated',
        now(), now(), '', '', '');

-- Unauthenticated call is rejected.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_ok($$SELECT public.search_places('Test')$$, 'P0001', 'unauthenticated',
                 'unauthenticated call rejected');

SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';

-- Too-short query.
SELECT is((SELECT public.search_places('a'))::jsonb->>'ok', 'false', 'short query returns ok:false');

-- Prefix + population ranking: bigger town first for a shared prefix.
WITH r AS (SELECT public.search_places('Testchest') AS body)
SELECT is((SELECT body->'places'->0->>'name' FROM r), 'Testchester',
          'higher-population prefix match ranks first');
WITH r AS (SELECT public.search_places('Testchest') AS body)
SELECT is((SELECT body->'places'->1->>'name' FROM r), 'Testchesterton',
          'smaller prefix match ranks second');

-- Disambiguating context: two same-name places, distinct display_names.
WITH r AS (SELECT public.search_places('Richmondtest') AS body)
SELECT is((SELECT jsonb_array_length(body->'places') FROM r), 2,
          'both same-name places returned');
WITH r AS (SELECT public.search_places('Richmondtest') AS body)
SELECT isnt((SELECT body->'places'->0->>'display_name' FROM r),
            (SELECT body->'places'->1->>'display_name' FROM r),
            'display_names disambiguate');

-- Country filter: US fixture is invisible.
WITH r AS (SELECT public.search_places('Testville') AS body)
SELECT is((SELECT jsonb_array_length(body->'places') FROM r), 0,
          'non-enabled country excluded');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: `36_rpc_search_places` FAILS (function does not exist).

- [ ] **Step 3: Add the country config**

In `shared/app-config.ts`, after the `payments` block (inside `APP_CONFIG`):

```ts
  location: {
    // Countries whose places the autocomplete exposes. The gazetteer data
    // model is global-ready; launch exposure is UK-only. See execution/015.
    enabledCountries: ['GB'],
  },
```

Run: `pnpm gen:config`
Expected: `supabase/migrations/20260509000001_app_config_seed.sql` regenerated with a `location` upsert.

- [ ] **Step 4: Write the RPC migration**

Create `supabase/migrations/20260719000002_rpc_search_places.sql`:

```sql
-- 015: autocomplete over the places gazetteer. Prefix matches rank first,
-- then trigram similarity catches misspellings; population breaks ties so
-- "man" surfaces Manchester before Mangotsfield. Exposure is limited to
-- app_config location.enabledCountries — fail closed if config is missing.

CREATE OR REPLACE FUNCTION public.search_places(p_query text, p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me      uuid := auth.uid();
  q       text := trim(coalesce(p_query, ''));
  enabled text[];
  results jsonb;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF length(q) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'query_too_short');
  END IF;

  SELECT array_agg(t.c) INTO enabled
    FROM jsonb_array_elements_text(
      (SELECT value->'enabledCountries' FROM public.app_config WHERE key = 'location')
    ) AS t(c);
  IF enabled IS NULL THEN
    RAISE EXCEPTION 'location_config_missing' USING errcode = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'display_name', s.display_name)), '[]'::jsonb)
    INTO results
    FROM (
      SELECT id, name, display_name
        FROM public.places
       WHERE country_code = ANY (enabled)
         AND (name ILIKE q || '%' OR similarity(name, q) > 0.3)
       ORDER BY (name ILIKE q || '%') DESC, population DESC, name ASC, id ASC
       LIMIT LEAST(GREATEST(coalesce(p_limit, 10), 1), 20)
    ) s;

  RETURN jsonb_build_object('ok', true, 'places', results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_places(text, int) TO authenticated;
```

- [ ] **Step 5: Apply and verify it passes**

Run: `supabase db reset`, then `pnpm test:db`
Expected: all pass; `36_rpc_search_places` 7/7.

- [ ] **Step 6: Commit**

```bash
git add shared/app-config.ts supabase/migrations/20260509000001_app_config_seed.sql supabase/migrations/20260719000002_rpc_search_places.sql supabase/tests/36_rpc_search_places.sql
git commit -m "Add search_places autocomplete RPC with config-driven country filter"
```

---

### Task 4: `profiles.place_id` + transitional `set_profile_location(p_place_id)`

**Files:**
- Create: `supabase/migrations/20260719000003_profiles_place_id.sql`
- Test: `supabase/tests/37_rpc_set_profile_location_v2.sql`

**Interfaces:**
- Consumes: `public.places` (Task 1).
- Produces: `profiles.place_id bigint REFERENCES places(id)`; `public.set_profile_location(p_place_id bigint) RETURNS jsonb` — `{ok:true}` or `{ok:false, error:'place_not_found'}`. TRANSITIONAL: it also writes the legacy `city_display_name`/`city_lat`/`city_lng` columns (from the place row) so the current views and `complete_onboarding` keep working until Tasks 6–7. The legacy 3-arg `set_profile_location(text, dp, dp)` continues to exist until Task 7 (PostgREST disambiguates by named args, so both can coexist).

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/37_rpc_set_profile_location_v2.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000010, 'Placetown', 'Placetown, England', 'GB', 'England', 53.48, -2.24, 500000, 'P', 'PPL', 5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
        'placeloc-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated',
        now(), now(), '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';

SELECT is(
  (SELECT public.set_profile_location(900000010::bigint))::text,
  '{"ok": true}',
  'happy path returns ok');

SELECT is(
  (SELECT place_id FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  900000010::bigint,
  'place_id persisted');

-- Transitional: legacy denormalised columns stay in sync until dropped.
SELECT is(
  (SELECT city_display_name FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  'Placetown, England',
  'legacy display name synced from place');

SELECT is(
  (SELECT city_lat FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  53.48::double precision,
  'legacy lat synced from place');

SELECT is(
  (SELECT public.set_profile_location(123456789012::bigint))::text,
  '{"ok": false, "error": "place_not_found"}',
  'unknown place rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: `37_rpc_set_profile_location_v2` FAILS (no such function / no `place_id` column).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260719000003_profiles_place_id.sql`:

```sql
-- 015: profiles reference a canonical place. TRANSITIONAL migration — the
-- new set_profile_location(place_id) also keeps the legacy denormalised
-- city_* columns in sync so existing views and complete_onboarding keep
-- working; 20260719000005_location_cleanup.sql removes both the legacy
-- columns and the legacy 3-arg set_profile_location.

ALTER TABLE public.profiles
  ADD COLUMN place_id bigint REFERENCES public.places(id);

CREATE INDEX profiles_place_id_idx ON public.profiles (place_id);

CREATE OR REPLACE FUNCTION public.set_profile_location(p_place_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  pl public.places%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO pl FROM public.places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'place_not_found');
  END IF;

  UPDATE public.profiles
     SET place_id          = pl.id,
         -- transitional sync; removed by the cleanup migration
         city_display_name = pl.display_name,
         city_lat          = pl.lat,
         city_lng          = pl.lng
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_location(bigint) TO authenticated;
```

- [ ] **Step 4: Apply and verify it passes**

Run: `supabase db reset`, then `pnpm test:db`
Expected: all pass; `37` 5/5; legacy `15_rpc_set_profile_location` (3-arg) still passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260719000003_profiles_place_id.sql supabase/tests/37_rpc_set_profile_location_v2.sql
git commit -m "Add profiles.place_id and place-based set_profile_location overload"
```

---

### Task 5: Frontend typeahead + geocode removal

**Files:**
- Modify: `shared/rpc-contracts.ts` (SetProfileLocationInput; add SearchPlaces contracts; remove Geocode contracts)
- Modify: `src/features/onboarding/api.ts`
- Modify: `src/features/onboarding/hooks.ts`
- Rewrite: `src/features/onboarding/components/LocationStep.tsx`
- Modify: `src/i18n/en/onboarding.json`
- Delete: `src/features/onboarding/geocode.ts`, `supabase/functions/geocode-city/` (whole directory)
- Modify: `e2e/onboarding.spec.ts` (3 location-step interactions)
- Test: `src/features/onboarding/__tests__/LocationStep.test.tsx` (new)

**Interfaces:**
- Consumes: `search_places` RPC (Task 3), `set_profile_location(p_place_id)` (Task 4).
- Produces: `searchPlaces(query: string)` in api.ts returning `SearchPlacesResult`; `useSearchPlaces(query: string)` query hook (enabled at `query.length >= 2`, `meta: { suppressGlobalError: true }`); `useSetLocation()` mutation now takes `{ place_id: number }`. `PlaceSuggestion` zod schema `{id: number, name: string, display_name: string}`.

- [ ] **Step 1: Write the failing component test**

Create `src/features/onboarding/__tests__/LocationStep.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { LocationStep } from '../components/LocationStep'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'

await initI18n()

const RPC = 'http://127.0.0.1:54321/rest/v1/rpc'

function myProfileHandler(role: 'benefactor' | 'baby') {
  return http.post(`${RPC}/view_my_profile`, () =>
    HttpResponse.json({
      ok: true,
      profile: {
        profile_id: '00000000-0000-4000-8000-000000000003',
        role, status: 'pending_onboarding',
        display_name: 'B', age: 25, date_of_birth: '1999-01-01',
        gender: 'female', looking_for: 'male', city_display_name: null,
        tagline: null, about: null, wants: null,
        height_cm: null, body_type: null, ethnicity: null, hair_color: null, eye_color: null,
        has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
        education: null, yearly_income_band: null, net_worth_band: null,
        token_balance: 0, photos: [], interests: [],
      },
    }),
  )
}

function renderStep() {
  const router = createMemoryRouter(
    [
      { path: '/onboarding/location', element: <LocationStep /> },
      { path: '/onboarding/photo', element: <p>photo step</p> },
    ],
    { initialEntries: ['/onboarding/location'] },
  )
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('LocationStep', () => {
  it('suggests places while typing, submits the picked place id, and advances', async () => {
    let locationCalledWith: unknown = null
    mswServer.use(
      myProfileHandler('benefactor'),
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({
          ok: true,
          places: [
            { id: 2643123, name: 'Manchester', display_name: 'Manchester, Greater Manchester' },
            { id: 2643124, name: 'Mancetter', display_name: 'Mancetter, Warwickshire' },
          ],
        }),
      ),
      http.post(`${RPC}/set_profile_location`, async ({ request }) => {
        locationCalledWith = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderStep()
    await userEvent.type(screen.getByRole('combobox'), 'Manch')
    await userEvent.click(
      await screen.findByRole('option', { name: /Manchester, Greater Manchester/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/photo step/i)).toBeInTheDocument()
    expect(locationCalledWith).toEqual({ p_place_id: 2643123 })
  })

  it('keeps continue disabled until a suggestion is picked', async () => {
    mswServer.use(
      myProfileHandler('benefactor'),
      http.post(`${RPC}/search_places`, () => HttpResponse.json({ ok: true, places: [] })),
    )
    renderStep()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    await userEvent.type(screen.getByRole('combobox'), 'Xy')
    expect(await screen.findByText(/no places found/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('shows an inline error when the search RPC fails', async () => {
    mswServer.use(
      myProfileHandler('benefactor'),
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderStep()
    await userEvent.type(screen.getByRole('combobox'), 'Manch')
    // The query client retries queries once (retry: 1, ~1s backoff) before
    // surfacing isError — allow for that.
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/features/onboarding/__tests__/LocationStep.test.tsx`
Expected: FAIL (no combobox — component still has the lookup-button flow).

- [ ] **Step 3: Update the contracts**

In `shared/rpc-contracts.ts`:

Replace the `SetProfileLocationInput` block:

```ts
export const SetProfileLocationInput = z.object({
  p_place_id: z.number().int().positive(),
})
export const SetProfileLocationResult = RpcResult(z.object({}))
```

Delete the whole `---- Geocode Edge Function ----` section (`GeocodeCityInput`, `GeocodeCityResult`).

Add, near the other Plan-03-era additions at the bottom:

```ts
// ---- 015: places autocomplete ----

export const PlaceSuggestion = z.object({
  id:           z.number().int(),
  name:         z.string(),
  display_name: z.string(),
})
export const SearchPlacesInput = z.object({
  p_query: z.string(),
  p_limit: z.number().int().optional(),
})
export const SearchPlacesResult = RpcResult(z.object({
  places: z.array(PlaceSuggestion),
}))
export type PlaceSuggestionT = z.infer<typeof PlaceSuggestion>
```

- [ ] **Step 4: Update api.ts and hooks.ts**

In `src/features/onboarding/api.ts`: add `SearchPlacesResult` to the contracts import, and replace `setProfileLocation`:

```ts
export const setProfileLocation = (placeId: number) =>
  callRpc('set_profile_location', { p_place_id: placeId }, SetProfileLocationResult)

export const searchPlaces = (query: string) =>
  callRpc('search_places', { p_query: query }, SearchPlacesResult)
```

In `src/features/onboarding/hooks.ts`: add `useQuery` to the react-query import, import `searchPlaces`, and replace `useSetLocation`:

```ts
export function useSetLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { place_id: number }) => setProfileLocation(args.place_id),
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useSearchPlaces(query: string) {
  return useQuery({
    queryKey: ['search-places', query],
    queryFn: () => searchPlaces(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
    // Handled inline in LocationStep (typeahead errors would be noisy as toasts).
    meta: { suppressGlobalError: true },
  })
}
```

- [ ] **Step 5: Rewrite LocationStep**

Replace `src/features/onboarding/components/LocationStep.tsx` entirely:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { PlaceSuggestionT } from '@shared/rpc-contracts'
import { useSearchPlaces, useSetLocation, useMyProfile } from '../hooks'
import { nextStepPath } from '../steps'

export function LocationStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setLocation = useSetLocation()
  const { data: me } = useMyProfile()
  const role = me?.ok ? me.profile.role : null

  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PlaceSuggestionT | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  // Debounce: fire the search RPC 250ms after the user stops typing.
  useEffect(() => {
    const id = setTimeout(() => setQuery(input.trim()), 250)
    return () => clearTimeout(id)
  }, [input])

  const search = useSearchPlaces(selected ? '' : query)
  const suggestions = search.data?.ok ? search.data.places : []
  const listOpen = !selected && query.length >= 2

  function onPick(place: PlaceSuggestionT) {
    setSelected(place)
    setInput(place.display_name)
  }

  async function onContinue() {
    if (!selected) return
    setServerError(null)
    try {
      const res = await setLocation.mutateAsync({ place_id: selected.id })
      if (!res.ok) {
        setServerError(res.error)
        return
      }
      navigate(nextStepPath(role ?? 'benefactor', 'location'))
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('location.title')}</h2>
      <label className="flex flex-col gap-1">
        <span>{t('location.placeName')}</span>
        <input
          className="border p-2 rounded"
          type="text"
          role="combobox"
          aria-expanded={listOpen && suggestions.length > 0}
          aria-controls="place-options"
          aria-autocomplete="list"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setSelected(null)
          }}
        />
      </label>
      {listOpen && (
        <ul id="place-options" role="listbox" className="border rounded divide-y">
          {suggestions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="w-full text-left p-2 hover:bg-slate-100"
                onClick={() => onPick(p)}
              >
                {p.display_name}
              </button>
            </li>
          ))}
          {search.isSuccess && suggestions.length === 0 && (
            <li className="p-2 text-sm text-slate-600">{t('location.noResults')}</li>
          )}
        </ul>
      )}
      {search.isError && (
        <div role="alert" className="text-red-700">
          {t('location.searchError')}{' '}
          {search.error instanceof Error
            ? `${search.error.name}: ${search.error.message}`
            : null}
        </div>
      )}
      <button
        type="button"
        className="bg-slate-800 text-white py-2 rounded"
        onClick={onContinue}
        disabled={!selected || setLocation.isPending}
      >
        {t('location.continue')}
      </button>
      {serverError && (
        <div role="alert" className="text-red-700">
          {serverError}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Update i18n**

In `src/i18n/en/onboarding.json`, replace the `location.*` keys with:

```json
  "location.title": "Where are you based?",
  "location.placeName": "City or town",
  "location.noResults": "No places found — try a nearby town or city.",
  "location.searchError": "Search failed.",
  "location.continue": "Continue",
```

(`location.lookup` and `location.notFound` are removed.)

- [ ] **Step 7: Delete the geocode path**

```bash
git rm src/features/onboarding/geocode.ts
git rm -r supabase/functions/geocode-city
```

- [ ] **Step 8: Run unit tests + typecheck**

Run: `pnpm vitest run src/features/onboarding` then `pnpm typecheck`
Expected: LocationStep tests PASS; typecheck clean (the compiler confirms no remaining reference to `geocodeCity`/`GeocodeCityResult`).

- [ ] **Step 9: Update the e2e location interactions**

In `e2e/onboarding.spec.ts` there are THREE identical location-step blocks (in `seedActiveCounterpart`, the benefactor test, and the baby test):

```ts
  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city or town/i).fill('Manchester')
  await page.getByRole('button', { name: /look up/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()
```

Replace each with:

```ts
  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city or town/i).fill('Manchester')
  await page.getByRole('option', { name: /^Manchester,/ }).first().click()
  await page.getByRole('button', { name: /continue/i }).click()
```

- [ ] **Step 10: Run e2e to verify the flow end-to-end**

Run: `pnpm test:e2e`
Expected: both onboarding tests PASS with zero external network (postcodes.io is gone from the stack).

- [ ] **Step 11: Commit**

```bash
git add -A shared/rpc-contracts.ts src/features/onboarding src/i18n/en/onboarding.json e2e/onboarding.spec.ts
git commit -m "Replace geocode lookup with places typeahead in onboarding"
```

---

### Task 6: View RPCs v3 — places join + disc-model distance

**Files:**
- Create: `supabase/migrations/20260719000004_rpc_views_v3.sql`
- Modify: `supabase/tests/18_rpc_view_search.sql`, `19_rpc_view_profile.sql`, `29_rpc_view_likes_tab.sql`, `31_rpc_view_search_filters.sql` (fixtures: `place_id` instead of `city_*`)
- Create: `supabase/tests/38_places_distance.sql`
- Modify: `src/lib/format.ts`, `src/lib/__tests__/format.test.ts`
- Modify: `src/features/search/components/ProfileCard.tsx`

**Interfaces:**
- Consumes: `profiles.place_id`, `places.geog`/`radius_miles` (Tasks 1, 4).
- Produces: view payloads keep the existing JSON keys — `city_display_name` is now sourced from `places.name` (short name, e.g. "Manchester"), and `distance_miles` becomes EFFECTIVE distance `GREATEST(0, centroid/1609.344 − r_viewer − r_target)`; `0` means same/overlapping places. `view_search`'s `distance_miles` filter becomes `ST_DWithin(viewer_geog, target_geog, (X + r_v + r_t) * 1609.344)`. Frontend `formatDistance` returns `''` for `<= 0` and `~N mi`/`~N km` otherwise. Zod contracts are unchanged (keys and types identical).

- [ ] **Step 1: Write the failing disc-model pgTAP test**

Create `supabase/tests/38_places_distance.sql`:

```sql
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: `38_places_distance` FAILS (profiles have `place_id` set but views still read `city_*`, which is NULL for these fixtures → distance NULL / city NULL).

- [ ] **Step 3: Write the views v3 migration**

Create `supabase/migrations/20260719000004_rpc_views_v3.sql`. It redefines all four view functions. `_profile_card_for_viewer`, `view_profile`, `view_my_profile` are copies of the current definitions in `supabase/migrations/20260718000002_rpc_views_ethnicity.sql` with ONLY the location parts changed; `view_search` gets the disc-aware filter. Full content:

```sql
-- 015: views v3 — location comes from the places gazetteer via
-- profiles.place_id. Distance uses the disc model: effective distance
-- between two profiles is max(0, centroid_distance - r_a - r_b), so
-- same/overlapping places read 0 and the radius filter widens by both
-- radii. Payload keys are unchanged: city_display_name now carries the
-- short place name (places.name).

CREATE OR REPLACE FUNCTION public._profile_card_for_viewer(
  p_viewer uuid,
  p_target uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  t  public.profiles%ROWTYPE;
  v  public.profiles%ROWTYPE;
  t_place public.places%ROWTYPE;
  v_place public.places%ROWTYPE;
  primary_photo_path text;
  distance_miles double precision;
  age int;
  my_like boolean;
BEGIN
  SELECT * INTO t FROM public.profiles WHERE id = p_target;
  IF NOT FOUND OR t.status <> 'active' THEN RETURN NULL; END IF;

  SELECT * INTO v FROM public.profiles WHERE id = p_viewer;

  SELECT * INTO t_place FROM public.places WHERE id = t.place_id;
  SELECT * INTO v_place FROM public.places WHERE id = v.place_id;

  SELECT mi.storage_path INTO primary_photo_path
    FROM public.profile_photos pp
    JOIN public.media_items mi ON mi.id = pp.media_item_id
   WHERE pp.profile_id = t.id
   ORDER BY pp.ordinal ASC
   LIMIT 1;

  IF v_place.id IS NOT NULL AND t_place.id IS NOT NULL THEN
    distance_miles := GREATEST(0,
      ST_Distance(v_place.geog, t_place.geog) / 1609.344
        - v_place.radius_miles - t_place.radius_miles);
  END IF;

  age := extract(year from age(t.date_of_birth))::int;

  my_like := EXISTS (
    SELECT 1 FROM public.likes WHERE liker_id = p_viewer AND likee_id = p_target
  );

  RETURN jsonb_build_object(
    'profile_id',         t.id,
    'display_name',       t.display_name,
    'age',                age,
    'city_display_name',  t_place.name,
    'distance_miles',     distance_miles,
    'primary_photo_path', primary_photo_path,
    'tagline',            t.tagline,
    'my_like_state',      my_like
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._profile_card_for_viewer(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.view_profile(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  place_name text;
  photos jsonb := '[]'::jsonb;
  interests jsonb := '[]'::jsonb;
  age int;
  my_like boolean;
  their_like boolean;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO t FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND OR t.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT name INTO place_name FROM public.places WHERE id = t.place_id;

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = t.id
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object('ordinal', rec.ordinal, 'path', rec.storage_path);
  END LOOP;

  FOR rec IN
    SELECT i.id, i.label_key, i.category
      FROM public.profile_interests pi
      JOIN public.interests i ON i.id = pi.interest_id
     WHERE pi.profile_id = t.id
       AND i.active = true
     ORDER BY i.category, i.ordinal, i.label_key
  LOOP
    interests := interests || jsonb_build_object(
      'id', rec.id, 'label_key', rec.label_key, 'category', rec.category);
  END LOOP;

  age := extract(year from age(t.date_of_birth))::int;
  my_like    := EXISTS (SELECT 1 FROM public.likes WHERE liker_id = me AND likee_id = t.id);
  their_like := EXISTS (SELECT 1 FROM public.likes WHERE liker_id = t.id AND likee_id = me);

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',         t.id,
      'display_name',       t.display_name,
      'age',                age,
      'city_display_name',  place_name,
      'gender',             t.gender,
      'looking_for',        t.looking_for,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
      'ethnicity',          t.ethnicity,
      'hair_color',         t.hair_color,
      'eye_color',          t.eye_color,
      'has_piercings',      t.has_piercings,
      'has_tattoos',        t.has_tattoos,
      'smoking',            t.smoking,
      'drinking',           t.drinking,
      'education',          t.education,
      'yearly_income_band', t.yearly_income_band,
      'net_worth_band',     t.net_worth_band,
      'photos',             photos,
      'interests',          interests,
      'my_like_state',      my_like,
      'their_like_state',   their_like
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.view_my_profile() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  place_name text;
  photos jsonb := '[]'::jsonb;
  interests jsonb := '[]'::jsonb;
  age int;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO t FROM public.profiles WHERE id = me;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT name INTO place_name FROM public.places WHERE id = t.place_id;

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path, mi.id AS media_item_id
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = me
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object(
      'ordinal', rec.ordinal,
      'path', rec.storage_path,
      'media_item_id', rec.media_item_id
    );
  END LOOP;

  FOR rec IN
    SELECT i.id, i.label_key, i.category
      FROM public.profile_interests pi
      JOIN public.interests i ON i.id = pi.interest_id
     WHERE pi.profile_id = me
       AND i.active = true
     ORDER BY i.category, i.ordinal, i.label_key
  LOOP
    interests := interests || jsonb_build_object(
      'id', rec.id, 'label_key', rec.label_key, 'category', rec.category);
  END LOOP;

  age := CASE WHEN t.date_of_birth IS NULL THEN NULL
              ELSE extract(year from age(t.date_of_birth))::int END;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',         t.id,
      'role',               t.role,
      'status',             t.status,
      'display_name',       t.display_name,
      'age',                age,
      'date_of_birth',      t.date_of_birth,
      'gender',             t.gender,
      'looking_for',        t.looking_for,
      'city_display_name',  place_name,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
      'ethnicity',          t.ethnicity,
      'hair_color',         t.hair_color,
      'eye_color',          t.eye_color,
      'has_piercings',      t.has_piercings,
      'has_tattoos',        t.has_tattoos,
      'smoking',            t.smoking,
      'drinking',           t.drinking,
      'education',          t.education,
      'yearly_income_band', t.yearly_income_band,
      'net_worth_band',     t.net_worth_band,
      'token_balance',      t.token_balance,
      'photos',             photos,
      'interests',          interests
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.view_search(
  p_filters jsonb,
  p_cursor  text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  my_role profile_role;
  me_place public.places%ROWTYPE;
  cards jsonb := '[]'::jsonb;
  card  jsonb;
  next_cursor text;
  cur_last_active timestamptz;
  cur_id uuid;
  rec record;
  target_role profile_role;

  f_min_age int;
  f_max_age int;
  f_distance int;
  f_interest_ids uuid[];
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = me;
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0002';
  END IF;

  SELECT pl.* INTO me_place
    FROM public.places pl
    JOIN public.profiles pr ON pr.place_id = pl.id
   WHERE pr.id = me;

  target_role := CASE my_role WHEN 'benefactor' THEN 'baby'::profile_role
                              WHEN 'baby'       THEN 'benefactor'::profile_role END;

  -- Parse filters; unknown keys are silently ignored.
  f_min_age := NULLIF(p_filters->>'min_age', '')::int;
  f_max_age := NULLIF(p_filters->>'max_age', '')::int;
  f_distance := NULLIF(p_filters->>'distance_miles', '')::int;
  IF p_filters ? 'interest_ids' THEN
    SELECT array_agg(value::uuid)
      INTO f_interest_ids
      FROM jsonb_array_elements_text(p_filters->'interest_ids');
  END IF;

  IF p_cursor IS NOT NULL THEN
    cur_last_active := split_part(p_cursor, ':', 1)::timestamptz;
    cur_id          := split_part(p_cursor, ':', 2)::uuid;
  END IF;

  FOR rec IN
    SELECT p.id, p.last_active_at
      FROM public.profiles p
      LEFT JOIN public.places pl ON pl.id = p.place_id
     WHERE p.role = target_role
       AND p.status = 'active'
       AND p.id <> me
       AND (p_cursor IS NULL OR (p.last_active_at, p.id) < (cur_last_active, cur_id))
       AND (f_min_age IS NULL
              OR p.date_of_birth IS NULL
              OR extract(year from age(p.date_of_birth))::int >= f_min_age)
       AND (f_max_age IS NULL
              OR p.date_of_birth IS NULL
              OR extract(year from age(p.date_of_birth))::int <= f_max_age)
       -- Disc-aware radius: widen the search by both places' radii so a
       -- metro search includes its overlapping sub-localities.
       AND (f_distance IS NULL
              OR me_place.id IS NULL
              OR pl.id IS NULL
              OR ST_DWithin(me_place.geog, pl.geog,
                   (f_distance + me_place.radius_miles + pl.radius_miles) * 1609.344))
       AND (f_interest_ids IS NULL
              OR EXISTS (
                SELECT 1 FROM public.profile_interests pi
                 WHERE pi.profile_id = p.id
                   AND pi.interest_id = ANY (f_interest_ids)
              ))
     ORDER BY p.last_active_at DESC NULLS LAST, p.id ASC
     LIMIT 20
  LOOP
    card := public._profile_card_for_viewer(me, rec.id);
    IF card IS NOT NULL THEN
      cards := cards || card;
    END IF;
    next_cursor := COALESCE(rec.last_active_at::text, '') || ':' || rec.id::text;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'cards', cards, 'next_cursor', next_cursor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_search(jsonb, text) TO authenticated;
```

- [ ] **Step 4: Migrate the existing pgTAP fixtures to `place_id`**

The four existing tests set `city_lat/city_lng/city_display_name` directly; the v3 views no longer read those columns, so each test needs fixture places inserted (BEFORE `SET LOCAL ROLE`) and profile UPDATEs switched to `place_id`. Use radius `0` fixtures where a test asserts centroid-like behaviour.

`supabase/tests/18_rpc_view_search.sql` — after the `auth.users` INSERT, add:

```sql
INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000030, 'TestLondon',     'TestLondon, England',     'GB', 'England', 51.5074, -0.1278, 9000000, 'P', 'PPLC', 0),
  (900000031, 'TestManchester', 'TestManchester, England', 'GB', 'England', 53.4808, -2.2426, 550000,  'P', 'PPLA', 0);
```

and replace the four profile UPDATEs' `city_lat=…, city_lng=…, city_display_name='London'` fragments with `place_id=900000030` (London rows) / `place_id=900000031` (Manchester rows). Assertion 3 ("closer + more recent baby ranks first") is unaffected — ordering is by `last_active_at`.

`supabase/tests/19_rpc_view_profile.sql` — same pattern: add the two-place INSERT (reuse ids `900000030`/`900000031`; each test rolls back, so ids can repeat across files), replace `city_lat=51.5, city_lng=-0.1, city_display_name='London'` with `place_id=900000030` on both rows. If an assertion checks `city_display_name`, its expected value becomes `'TestLondon'`.

`supabase/tests/29_rpc_view_likes_tab.sql` — add the TestLondon place INSERT, replace the three `city_lat=51.5, city_lng=-0.1, city_display_name='London'` fragments with `place_id=900000030`.

`supabase/tests/31_rpc_view_search_filters.sql` — add:

```sql
INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000030, 'TestLondon',    'TestLondon, England',    'GB', 'England', 51.5074, -0.1278, 9000000, 'P', 'PPLC', 0),
  (900000032, 'TestEdinburgh', 'TestEdinburgh, Scotland','GB', 'Scotland', 55.9533, -3.1883, 500000, 'P', 'PPLA', 0);
```

and replace London-coordinate fragments with `place_id=900000030`, Edinburgh's with `place_id=900000032`. Radius 0 keeps the existing distance-filter expectations exact (disc model degrades to centroid maths at radius 0 — that degradation IS one of the spec's acceptance criteria, so leave these radii at 0 deliberately and let `38` cover non-zero radii).

- [ ] **Step 5: Apply and verify db tests pass**

Run: `supabase db reset`, then `pnpm test:db`
Expected: ALL tests pass — 18/19/29/31 with migrated fixtures, 38 disc-model 5/5. (15/17/33 still pass: legacy columns still exist and the transitional RPC still writes them.)

- [ ] **Step 6: Write the failing frontend format test**

Replace the body of `src/lib/__tests__/format.test.ts`'s `formatDistance` describe block:

```ts
describe('formatDistance', () => {
  it('uses approx miles for en-GB', () => { expect(formatDistance(10, 'en-GB')).toBe('~10 mi') })
  it('uses approx km elsewhere',    () => { expect(formatDistance(10, 'fr-FR')).toBe('~16 km') })
  it('blank for null',              () => { expect(formatDistance(null, 'en-GB')).toBe('') })
  it('blank for overlapping (0)',   () => { expect(formatDistance(0, 'en-GB')).toBe('') })
  it('never rounds below ~1',       () => { expect(formatDistance(0.4, 'en-GB')).toBe('~1 mi') })
})
```

Run: `pnpm vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL (old exact-mile format).

- [ ] **Step 7: Update formatDistance**

In `src/lib/format.ts`:

```ts
// Distance: en-GB and en-US use miles; everyone else uses km.
// Disc-model semantics: 0 means same/overlapping places — the place name
// carries the information, so render nothing rather than a fake "0 mi".
const MILE_LANGS = ['en-GB', 'en-US']

export function formatDistance(miles: number | null, locale: string): string {
  if (miles == null || miles <= 0) return ''
  const useMiles = MILE_LANGS.includes(locale)
  const value = useMiles ? miles : miles * 1.609344
  const unit  = useMiles ? 'mi' : 'km'
  return `~${Math.max(1, Math.round(value))} ${unit}`
}
```

- [ ] **Step 8: Fix the card separator for empty distance**

In `src/features/search/components/ProfileCard.tsx`, replace the city/distance line:

```tsx
        <div className="text-sm text-slate-600">
          {card.city_display_name}
          {(() => {
            const d = formatDistance(card.distance_miles, i18n.language)
            return d ? ` · ${d}` : ''
          })()}
        </div>
```

- [ ] **Step 9: Run the full frontend suite**

Run: `pnpm vitest run` then `pnpm typecheck`
Expected: all pass (payload keys unchanged, so existing mocks still parse).

- [ ] **Step 10: Run e2e**

Run: `pnpm test:e2e`
Expected: PASS (onboarding writes place_id via the transitional RPC; search cards render from the joined place).

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/20260719000004_rpc_views_v3.sql supabase/tests/18_rpc_view_search.sql supabase/tests/19_rpc_view_profile.sql supabase/tests/29_rpc_view_likes_tab.sql supabase/tests/31_rpc_view_search_filters.sql supabase/tests/38_places_distance.sql src/lib/format.ts src/lib/__tests__/format.test.ts src/features/search/components/ProfileCard.tsx
git commit -m "Switch view RPCs to places join with disc-model distance"
```

---

### Task 7: Cleanup — drop legacy columns, legacy RPC, migrate remaining fixtures and seeds

**Files:**
- Create: `supabase/migrations/20260719000005_location_cleanup.sql`
- Modify: `supabase/tests/10_profiles_schema.sql`, `17_rpc_complete_onboarding.sql`, `33_baby_activation_gate.sql`
- Delete: `supabase/tests/15_rpc_set_profile_location.sql` (superseded by `37`)
- Modify: `scripts/seed-dev-users.mjs`

**Interfaces:**
- Consumes: everything above; frontend no longer references the legacy RPC signature (Task 5).
- Produces: `profiles` without `city_display_name`/`city_lat`/`city_lng`; `set_profile_location(bigint)` no longer writes legacy columns; `complete_onboarding` checks `place_id IS NULL` for `location_missing`; legacy `set_profile_location(text, double precision, double precision)` dropped. `places` is the single source of truth.

- [ ] **Step 1: Update the schema pgTAP test to the desired end state (failing)**

In `supabase/tests/10_profiles_schema.sql`, replace the two `city_lat`/`city_lng` `has_column` lines with:

```sql
SELECT has_column('public',   'profiles', 'place_id',          'place_id column');
SELECT hasnt_column('public', 'profiles', 'city_display_name', 'legacy city_display_name dropped');
SELECT hasnt_column('public', 'profiles', 'city_lat',          'legacy city_lat dropped');
SELECT hasnt_column('public', 'profiles', 'city_lng',          'legacy city_lng dropped');
```

and bump `SELECT plan(n);` by +2 (two lines became four).

Also update `17_rpc_complete_onboarding.sql` and `33_baby_activation_gate.sql`: before each file's `SET LOCAL ROLE authenticated`, insert a fixture place:

```sql
INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000040, 'Gateville', 'Gateville, England', 'GB', 'England', 51.5074, -0.1278, 100000, 'P', 'PPL', 3);
```

and replace each `SELECT public.set_profile_location('London', 51.5074, -0.1278);` with:

```sql
SELECT public.set_profile_location(900000040::bigint);
```

Delete the superseded legacy-signature test:

```bash
git rm supabase/tests/15_rpc_set_profile_location.sql
```

Also update `37_rpc_set_profile_location_v2.sql`: remove the two transitional assertions ('legacy display name synced from place', 'legacy lat synced from place') and drop `plan(5)` to `plan(3)` — the columns they query are about to disappear.

- [ ] **Step 2: Run to verify failures**

Run: `pnpm test:db`
Expected: `10` FAILS (`hasnt_column` — columns still exist). 17/33 pass already (new RPC exists). This is the RED state for the migration.

- [ ] **Step 3: Write the cleanup migration**

Create `supabase/migrations/20260719000005_location_cleanup.sql`:

```sql
-- 015 cleanup: places gazetteer is now the single source of truth for
-- location. Drops the transitional denormalised columns and the legacy
-- name+coords RPC, and points complete_onboarding at place_id.

-- 1. set_profile_location stops writing the legacy columns.
CREATE OR REPLACE FUNCTION public.set_profile_location(p_place_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  pl public.places%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO pl FROM public.places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'place_not_found');
  END IF;

  UPDATE public.profiles SET place_id = pl.id WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 2. complete_onboarding checks place_id (body otherwise identical to
--    20260514000012_baby_activation_gate.sql).
CREATE OR REPLACE FUNCTION public.complete_onboarding() RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me          uuid := auth.uid();
  p           public.profiles%ROWTYPE;
  cfg         jsonb;
  min_photos  int;
  min_bio     int;
  photo_count int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = me;

  IF p.role IS NULL          THEN RETURN jsonb_build_object('ok', false, 'error', 'role_missing');     END IF;
  IF p.display_name IS NULL  THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.date_of_birth IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.place_id IS NULL      THEN RETURN jsonb_build_object('ok', false, 'error', 'location_missing'); END IF;

  IF p.role = 'baby' THEN
    -- Fail closed: config must exist and be complete.
    SELECT value INTO cfg FROM public.app_config WHERE key = 'onboarding';
    IF cfg IS NULL THEN
      RAISE EXCEPTION 'app_config onboarding key missing' USING errcode = 'P0001';
    END IF;
    min_photos := (cfg->>'babyMinPhotos')::int;
    min_bio    := (cfg->>'babyMinBioChars')::int;
    IF min_photos IS NULL OR min_bio IS NULL THEN
      RAISE EXCEPTION 'app_config onboarding incomplete' USING errcode = 'P0001';
    END IF;

    SELECT count(*) INTO photo_count FROM public.profile_photos WHERE profile_id = me;
    IF photo_count < min_photos THEN
      RETURN jsonb_build_object('ok', false, 'error', 'photos_required');
    END IF;

    IF p.tagline IS NULL OR length(trim(p.tagline)) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'tagline_required');
    END IF;
    IF p.about IS NULL OR length(trim(p.about)) < min_bio THEN
      RETURN jsonb_build_object('ok', false, 'error', 'about_required');
    END IF;
    IF p.wants IS NULL OR length(trim(p.wants)) < min_bio THEN
      RETURN jsonb_build_object('ok', false, 'error', 'wants_required');
    END IF;
  END IF;

  IF p.status <> 'pending_onboarding' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending_onboarding');
  END IF;

  UPDATE public.profiles
     SET status = 'active',
         last_active_at = now()
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. Drop the legacy RPC and columns.
DROP FUNCTION public.set_profile_location(text, double precision, double precision);

ALTER TABLE public.profiles
  DROP COLUMN city_display_name,
  DROP COLUMN city_lat,
  DROP COLUMN city_lng;
```

- [ ] **Step 4: Apply and verify db tests pass**

Run: `supabase db reset`, then `pnpm test:db`
Expected: ALL pass, including updated 10/17/33/37; `15` is gone.

- [ ] **Step 5: Update the dev seed script**

In `scripts/seed-dev-users.mjs`: the fixtures keep their `city` names but drop `lat`/`lng`; the profile update uses a looked-up `place_id`. Replace the fixture `lat`/`lng` properties and the update block:

Fixture entries lose `lat:`/`lng:` (delete those two properties from all three fixtures).

After the `fixtures` array, add:

```js
// Resolve seeded GeoNames places by name (largest population wins).
const placeIds = new Map()
for (const cityName of new Set(fixtures.map((f) => f.city))) {
  const { data: places, error } = await supabase
    .from('places')
    .select('id, population')
    .eq('name', cityName)
    .eq('country_code', 'GB')
    .order('population', { ascending: false })
    .limit(1)
  if (error) throw new Error(`place lookup failed for ${cityName}: ${error.message}`)
  if (!places?.length) throw new Error(`no seeded place named ${cityName} — run migrations first`)
  placeIds.set(cityName, places[0].id)
}
```

and in the `.update({...})` object replace

```js
    city_display_name: f.city,
    city_lat: f.lat,
    city_lng: f.lng,
```

with

```js
    place_id: placeIds.get(f.city),
```

- [ ] **Step 6: Verify the seed runs**

Run: `SUPABASE_SERVICE_ROLE_KEY="$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '\"')" pnpm seed:dev`
(Or obtain the key from `supabase status` output by hand — keep the loopback guard intact.)
Expected: `seeded lex@local.test` etc., no errors.

- [ ] **Step 7: Full check**

Run: `pnpm lint && pnpm typecheck && pnpm vitest run && pnpm test:db && pnpm test:e2e`
Expected: everything green.

- [ ] **Step 8: Commit**

```bash
git add -A supabase/migrations/20260719000005_location_cleanup.sql supabase/tests scripts/seed-dev-users.mjs
git commit -m "Drop legacy city columns and geocode-era location RPC"
```

---

### Task 8: GeoNames attribution, leftovers sweep, docs

**Files:**
- Modify: `src/i18n/en/landing.json`, `src/features/landing/pages/LandingPage.tsx`
- Modify: `execution/README.md`, `docs/superpowers/plans/README.md`
- Test: `src/features/landing/__tests__/` (extend the existing landing test if one asserts footer content; otherwise the i18n render is covered by the page test)

**Interfaces:**
- Consumes: nothing new.
- Produces: visible CC BY 4.0 attribution (required by the license, in-scope for this plan per the spec).

- [ ] **Step 1: Add the attribution string**

In `src/i18n/en/landing.json`, after `"footer.copyright"`:

```json
  "footer.geonames": "Place data from GeoNames, licensed CC BY 4.0."
```

(Mind the comma on the preceding line.)

- [ ] **Step 2: Render it in the footer**

In `src/features/landing/pages/LandingPage.tsx`, after the `footer.copyright` paragraph:

```tsx
          <p className="mt-2 text-xs text-smoke">
            <a
              href="https://www.geonames.org/"
              target="_blank"
              rel="noopener noreferrer license"
              className="underline hover:text-bone"
            >
              {t('footer.geonames')}
            </a>
          </p>
```

- [ ] **Step 3: Leftovers sweep**

Run: `grep -rn "postcodes.io\|geocode" src shared supabase e2e scripts --include="*" | grep -v node_modules`
Expected: NO hits in code paths. (Hits in `docs/`, `execution/015…`, or plan files are fine — they are history/spec, not code.) Fix anything that appears.

- [ ] **Step 4: Update status tables**

- `execution/README.md`: set the 015 row to `Done` with plan link `[2026-07-17-015-location-gazetteer-and-distance.md](../docs/superpowers/plans/2026-07-17-015-location-gazetteer-and-distance.md)`.
- `docs/superpowers/plans/README.md`: add/update the row for this plan per that table's existing format.

- [ ] **Step 5: Final full check**

Run: `pnpm lint && pnpm typecheck && pnpm vitest run && pnpm test:db && pnpm test:e2e && pnpm build`
Expected: all green. (Reminder: plain `pnpm build`, no PATH prefix.)

- [ ] **Step 6: Commit**

```bash
git add src/i18n/en/landing.json src/features/landing/pages/LandingPage.tsx execution/README.md docs/superpowers/plans/README.md
git commit -m "Add GeoNames attribution and close out spec 015"
```

---

## Notes for the executor

- **Legacy v1 zod schemas** (`ProfileCard`, `ViewProfileResult`, `ViewMyProfileResult` in `shared/rpc-contracts.ts`) still mention `city_display_name` — leave them; the key is unchanged in v2/v3 payloads and those schemas are inert. Do NOT rename payload keys; that was considered and rejected (churn without user value).
- **Spec open questions resolved with defaults:** radius buckets as in Task 2; committed GB seed as a generated migration (gen-config precedent); denormalised columns dropped; distance display `~N mi` with blank-at-0 banding; default UI search radius untouched (FilterSheet has a free number input, no preset to widen — flag in review if beta density suggests adding one).
- **Interaction with spec 010:** already landed (role_hint work is committed); this plan's LocationStep rewrite is based on the current file as of `d9eb0d9`-era main.

### Plan 015 execution deviations

(Log each deviation here as a separate commit, before moving on.)

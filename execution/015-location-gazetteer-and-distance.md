# 015: Location gazetteer, autocomplete, and metro-aware distance

Status: not started. High-level spec — turn into a full plan via
`superpowers:writing-plans` before executing. Launch blocker: the current
location step has no autocomplete and the distance model misleads inside
large cities.

## Motivation

Two related gaps. First, the location box: users currently type a free-form
place name that is geocoded through the `geocode-city` edge function
(postcodes.io), UK-only, with no typeahead — misspellings and ambiguous
names produce bad or missing coordinates, and every signup depends on a
third-party service at runtime. Second, the metro problem: a profile's
location is a single centroid, so two users who both picked "Manchester"
show as 0 miles apart while a user in Stockport who typed "Manchester"
appears 7 miles from where they actually live, and a "within 5 miles"
search from the Manchester centroid silently excludes half the metro.

The fix for both is the same piece of infrastructure: a canonical `places`
table (a gazetteer) in our own Postgres, seeded from the GeoNames open
dataset. Autocomplete becomes an ordinary RPC against that table (no
third-party calls, works in local dev and tests unmocked), profiles
reference a canonical `place_id` instead of free text, and each place
carries a population-derived radius so search can treat places as discs
rather than points. Going global later is a data refresh, not a
re-platform. No third-party geocoding dependency is needed at all; the
decision remains cheaply reversible because the autocomplete contract
(query in, ranked place list out) is identical if a commercial API is ever
swapped in behind it.

Doing this pre-launch matters for schema reasons: switching profiles from
free-text city to canonical `place_id` costs nothing while only test users
exist; after launch it becomes a data-cleaning project.

## Current behaviour

- `src/features/onboarding/components/LocationStep.tsx` takes a typed
  place name, calls `src/features/onboarding/geocode.ts` →
  `supabase/functions/geocode-city` → postcodes.io `/places`, and stores
  the result via `set_profile_location(display_name, lat, lng)`.
- `profiles` stores `city_display_name`, `city_lat`, `city_lng`
  (`supabase/migrations/20260510000000_profiles.sql`).
- `view_search` v2 filters on centroid-to-centroid `ST_Distance / 1609.344
  <= distance_miles` and profile views report `distance_miles` the same way
  (`supabase/migrations/20260514000010_rpc_views_v2.sql`).
- Distance is displayed as exact miles.

## Desired behaviour

**Gazetteer.** A `places` table seeded from GeoNames `cities500.txt`
(every place worldwide with population >= 500, ~225k rows, CC-BY 4.0),
holding at minimum: GeoNames id, name, admin-region display context (e.g.
"Manchester, England"), country code, lat/lng, population, feature class,
and a derived `radius_miles`. Global data imported, UK-only exposure at
launch via a config-driven country filter. Sub-localities and neighbourhood
rows (Didsbury, Salford, Croydon) are included so users in big metros can
naturally pick their area instead of the metro name.

**Autocomplete.** The location step becomes a debounced typeahead combobox
backed by an RPC (prefix + `pg_trgm` similarity match, ranked by population
and feature class so "man" surfaces Manchester before Mangotsfield).
Options display with disambiguating context ("Richmond, London" vs
"Richmond, North Yorkshire"). The user must pick from the list — no
free-text fallback; someone whose hamlet is missing picks the nearest
town, which is acceptable (arguably preferable) for this product.

**Canonical reference.** Profiles gain a `place_id` FK to `places`;
`set_profile_location` takes a place id instead of name+coords. The
denormalised `city_display_name`/`city_lat`/`city_lng` columns are dropped
(or repointed as generated/joined values — executor's choice, but `places`
is the source of truth).

**Metro-aware distance (disc model).** Each place's `radius_miles` derives
from population at import time (bucketed: major metro on the order of 8
miles down to ~1 mile for villages; exact buckets are an open question
below). Effective distance between two profiles is
`max(0, centroid_distance − r_a − r_b)`; the search radius filter becomes
`ST_DWithin(a, b, (X + r_a + r_b) * 1609.344)`. Two Manchester users are
"nearby", Manchester–Stockport reads ~1 mile rather than 7, and behaviour
degrades to today's exact centroid maths when both radii are ~0.

**Coarse display.** Never show "0.0 miles" or false precision: profiles in
the same or overlapping places display as the place name ("Also in
Manchester" / "Nearby"), otherwise "~N miles" rounded. Search result
ordering must not sort purely by distance (many metro ties at 0) —
tie-break on recency/activity.

**Removal.** The `geocode-city` edge function and its client wrapper are
deleted; nothing else may call out to postcodes.io.

## Explicitly out of scope (design for, don't build)

- **Global exposure.** Data model and import are global from day one; the
  launch UI filters to GB. Turning on other countries (and km display for
  non-UK/US locales, per the design doc's `Intl` formatter setup) is a
  follow-up.
- **Alternate-language and alias place names** (GeoNames
  `alternateNames`): needed for serious international UX, not for UK
  launch.
- **UK enrichment from OS Open Names** (hamlet-level coverage) — only if
  coverage complaints materialise.
- **Postcode-district precision, GPS, travel/mobility radius**: possible
  future accuracy upgrades; the disc model plus sub-locality rows must not
  preclude them.
- **Browse-by-city SEO pages**: canonical place ids are what make these
  possible later; do not build them now.

## Constraints and known gotchas

- **Attribution:** GeoNames is CC-BY 4.0 — a visible credit is required
  (site footer and/or an /about credits line). Include it in this change,
  not as a follow-up.
- **Seeding vs migrations:** `supabase db reset` runs migrations locally
  and in CI, and pgTAP/RPC tests need places data present. A migration
  containing 225k global rows is unreasonable; decide the split between a
  committed, regeneratable GB subset (small enough for a migration or
  committed CSV) and a repeatable import script for the full dataset. The
  import script must be deterministic and re-runnable (upsert on GeoNames
  id).
- **Extensions/indexes:** needs `pg_trgm` enabled and a GIN trgm index for
  autocomplete, plus a GIST geography index if search moves to
  `ST_DWithin`. Current per-row `ST_Distance` maths in `view_search` is
  fine at MVP scale but the predicate rewrite should be index-friendly.
- **RLS:** `places` is public reference data — readable by `anon` and
  `authenticated`, writable by neither. Remember the repo pgTAP fixture
  rules when testing.
- **Ripple:** `set_profile_location` signature change touches onboarding
  RPCs, `rpc-contracts`, `LocationStep`, profile views (`view_profile`,
  `view_search`, card payloads currently exposing `city_display_name`),
  `/me` profile edit, seeded dev users (`scripts/seed-dev-users.mjs`),
  e2e helpers, and existing unit/e2e tests that mock `geocode-city`.
- **Interaction with spec 010:** both change the onboarding location step.
  Whichever executes second rebases on the other; the specs are otherwise
  independent.
- **No third-party calls in tests:** the whole point — after this change,
  `pnpm test`, `pnpm test:db`, and `pnpm test:e2e` must pass with no
  network access beyond local Supabase.

## Open questions (suggested defaults)

1. **Radius buckets.** Default: population >= 1M → 8 mi; 250k–1M → 5 mi;
   50k–250k → 3 mi; 10k–50k → 2 mi; below → 1 mi. Stored per row at import
   so buckets can be retuned by re-running the import, not by migration.
2. **GB seed placement.** Default: a generated, committed seed file
   (filtered from cities500 by an import script in `scripts/`) applied as
   a migration, so local resets and CI are self-contained; the global
   import path exists in the script but is not wired into migrations.
3. **Keep denormalised city columns?** Default: drop them; views join
   `places`. Keeps one source of truth and the FK makes backfill trivial
   pre-launch.
4. **Distance display banding.** Default: same-or-overlapping discs show
   the place name only; otherwise round to whole miles with a "~" prefix.
   Exact banding copy is an i18n/UX detail for the plan.
5. **Search default radius.** Default: keep the current filter values but
   verify the default presented in the UI is generous (25–50 miles) so
   thin launch density isn't hidden by a tight radius.

## Acceptance criteria

- Onboarding location step is a typeahead over local data: selecting from
  suggestions is the only way to set location, suggestions include
  disambiguating region context, and no request leaves our infrastructure
  (verified: e2e passes with no geocoding mocks and `geocode-city` is
  gone).
- Profiles reference a canonical `place_id`; two users selecting the same
  suggestion share the same place row.
- Distance semantics: two profiles in the same large city never display a
  misleading exact distance; a radius search from a metro place includes
  profiles in overlapping sub-localities (pgTAP-verified with fixture
  places for a metro, a sub-locality, and a distant town).
- Search results remain correctly filterable by `distance_miles` and the
  disc model degrades to centroid behaviour for village-sized places.
- GeoNames attribution is visible in the product.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, and
  `pnpm test:e2e` pass, with the seeded dev users and e2e helpers updated
  to the new location flow.

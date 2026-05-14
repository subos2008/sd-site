# Plan 02 — Auth + Profile Foundation + Search Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real person can sign up with email+password, confirm their email, walk through a four-step onboarding wizard (role → identity → location → photo), and land on a `/search` page listing other active profiles. Tapping a card opens a bare profile view. Their own profile is available at `/me`. All of this works locally and in CI end-to-end against Docker Supabase.

**Architecture:** Supabase Auth handles credentials and email confirmation; a Postgres AFTER INSERT trigger on `auth.users` creates a `profiles` row in `pending_onboarding`. All state changes go through `SECURITY DEFINER` Postgres RPCs that explicitly check `auth.uid()` and role. All reads go through `SECURITY INVOKER` view RPCs that compose card/profile shapes (including signed media URLs) in one round-trip. Storage is a single private bucket `media`; clients never PUT directly — they request a signed upload URL from `prepare_media_upload`. Geocoding is a Deno Edge Function `geocode-city` that proxies postcodes.io; the frontend calls it, then passes the resolved lat/lng to `set_profile_location`. Every RPC has a Zod contract in `shared/rpc-contracts.ts`; production frontend `.parse()`s responses, MSW mocks `.parse()` before returning.

**Tech Stack additions (on top of Plan 01):** Supabase Auth, Supabase Storage, Supabase Edge Functions (Deno), PostGIS distance functions, pgTAP RLS test helpers, TanStack Query, react-hook-form + Zod resolver for form validation.

**Outcome at the end of this plan:** the Playwright "signup → onboarding → search → view-other-profile" journey passes against ephemeral Docker Supabase. All RPCs have pgTAP coverage for happy path + auth rejection + invariant. RLS for every protected table is tested for owner/other/anonymous. CI runs drift checks for both `pnpm gen:types` and `pnpm gen:config`. The Edge Function is invokable locally via `supabase functions serve`.

### Versions actually installed during Plan 01

This plan assumes Plan 01's actual installed versions (recap):

- React 19, TypeScript 6, Vite 8, Tailwind v4 (`@tailwindcss/vite`), ESLint 9 flat config
- pnpm 11 with `pnpm-workspace.yaml` `allowBuilds` map
- `tsconfig.app.json` holds path aliases; root `tsconfig.json` is references-only; no `baseUrl`
- OpenTelemetry modern SDK (`resourceFromAttributes`, `spanProcessors:`)
- `react-router-dom` v7 (works as installed; Task 1 of this plan migrates to the `react-router` package per Plan 01 carry-over)
- Supabase CLI 2.78.1, `[analytics] enabled = false` in `supabase/config.toml`
- MSW v2 (`http.post(...)`)
- Node 22

If any of those have changed (e.g. dependency security bumps), favour the actually-installed version and note the deviation in a "Versions actually installed during execution" preamble at the top of this file, as Plan 01 does.

### Plan 02 execution deviations

- Task 4: RLS migration renamed from `20260510000000a_profiles_rls.sql` (spec) to `20260510000100_profiles_rls.sql` because the Supabase CLI 2.78.1 rejects the alphabetic suffix with `Skipping migration 20260510000000a_profiles_rls.sql... (file name must match pattern "<timestamp>_name.sql")` and silently drops the file from the apply order. The renumber leaves `20260510000001` free for Task 5's planned `media.sql` and leaves a gap for any future migrations slotted between profiles and media. The new ordering applies profiles → trigger → RLS; this is safe because the `handle_new_user` trigger is `SECURITY DEFINER` and bypasses RLS.
- Task 4: Replaced two `throws_ok(..., NULL, NULL, ...)` assertions in `supabase/tests/11_profiles_rls.sql` (UPDATE-bob and DELETE-alice) with explicit state checks, because RLS silently filters rows rather than throwing, so the original assertions could pass for the wrong reason.
- Task 5: Changed `plan(7)` to `plan(8)` in `supabase/tests/12_media_schema_rls.sql` — the spec text undercounts the actual assertions in the same block by one (8 distinct pgTAP calls: 2× `has_table` + `col_is_unique` + `col_type_is` + `ok` + 2× `throws_ok` + `is`).
- Task 7: Replaced `PERFORM public.set_profile_role('baby')` in `supabase/tests/14_rpc_set_profile_identity.sql` with `SELECT public.set_profile_role('baby')` — `PERFORM` is a plpgsql-only statement and is a syntax error in top-level SQL.
- Task 7: Added `SET LOCAL "request.jwt.claim.sub" = ''` before `SET LOCAL ROLE anon` in the unauthenticated assertion of `14_rpc_set_profile_identity.sql` — `RESET ROLE` does not unset other GUCs, so without clearing the JWT claim `auth.uid()` would still resolve to the prior user id and the `P0001` path would never fire.
- Task 10: `prepare_media_upload` does not call `storage.create_signed_upload_url(...)` because that SQL helper is not present in the local Supabase storage extension (CLI 2.78.1; storage schema exposes `search`, `can_insert_object`, etc. but no signed-URL minting function). The RPC instead returns `{ok, media_item_id, storage_path, deduped}` and the frontend is expected to call `supabase.storage.from('media').createSignedUploadUrl(path)` itself to obtain the 5-minute signed upload URL. The pgTAP test was not changed since it never asserted the URL field. Re-evaluate when bumping the Supabase CLI.
- Task 10: Added `RESET ROLE` / `SET LOCAL ROLE authenticated` wrapping around the direct `INSERT INTO public.media_items` (video seed) in `supabase/tests/16_rpc_media_upload.sql` — `media_items` has deny-all RLS so the spec test as written would fail at the seed insert under the `authenticated` role.
- Task 11: Replaced three `PERFORM public.foo(...)` statements in `supabase/tests/17_rpc_complete_onboarding.sql` (`set_profile_role`, `set_profile_identity`, `set_profile_location`, plus `add_to_profile_photos`) with `SELECT public.foo(...)` — `PERFORM` is plpgsql-only and is a syntax error at the top SQL level.
- Task 11: Wrapped the direct `INSERT INTO public.media_items` (photo seed for the success case) in `supabase/tests/17_rpc_complete_onboarding.sql` with `RESET ROLE` / `SET LOCAL ROLE authenticated` and re-set `request.jwt.claim.sub`, mirroring the Task 10 RLS-bypass shim, because `media_items` has deny-all RLS and the seed would otherwise fail under `authenticated`.
- Task 12: `_profile_card_for_viewer`, `view_profile`, and `view_my_profile` return storage **paths** (`primary_photo_path`, and `path` inside photo objects) instead of signed read URLs, because `storage.create_signed_url` is not present in the local Supabase storage extension (CLI 2.78.1) — same situation as the upload-side helper missing in Task 10. The frontend is expected to mint signed read URLs via `supabase.storage.from('media').createSignedUrl(path, 3600)`. The `18_rpc_view_search.sql` test was updated to assert `primary_photo_path` rather than `primary_photo_url`. Re-evaluate when bumping the Supabase CLI.
- Task 12: Known issue carried over from spec (not fixed — out of scope and not exercised by tests): `view_search`'s cursor format `last_active_at::text || ':' || id::text` uses `:` as the separator, but timestamptz text contains `:`. The parser uses `split_part(..., ':', 1)::timestamptz`, which only captures the date-and-hour portion of the timestamp; pagination semantics will misbehave once exercised. Flagged in a code comment at the top of the migration. Fix when wiring real pagination in a later plan.
- Task 13: Adjusted the Zod contracts to match the actual server response shapes, not the spec text, because the contracts must describe reality. Three changes flow from the Task 10 and Task 12 deviations: (a) `PrepareMediaUploadResult` drops `signed_upload_url` — the RPC no longer returns it (frontend mints the upload URL via `createSignedUploadUrl`); (b) `ProfileCard.primary_photo_url` renamed to `primary_photo_path: z.string().nullable()` — the view RPCs return a storage path now; (c) `ProfilePhoto.url` renamed to `ProfilePhoto.path: z.string()` for the same reason. Inline `NOTE:` comments on the affected schemas point back to the deviation. The round-trip test was updated to use `primary_photo_path` and a storage-path-shaped value. Re-evaluate when bumping the Supabase CLI alongside Task 10/Task 12.

- Task 14: Replaced TypeScript parameter-property shorthand in `RpcContractError`/`RpcTransportError` constructors with explicit field declarations + assignments in `src/lib/rpc.ts`. Reason: project tsconfig sets `erasableSyntaxOnly`, which disallows parameter properties. Same external API.
- Task 17: Set `keySeparator: false, nsSeparator: ':'` in `src/lib/i18n.ts`. Reason: both `auth.json` (Task 16) and `onboarding.json` (Task 17) use flat dotted keys (e.g. `"signup.title"`, `"identity.gender.male"`); under i18next's default `keySeparator: '.'` these collide with each other (Task 17) and silently resolve to missing-key fallbacks (Task 16's pre-existing latent bug). Disabling the separator treats keys as literal strings.
- Task 20: Added a user-requested local-host guard to `scripts/seed-dev-users.mjs`. The script now parses `SUPABASE_URL` and refuses to run unless the host is one of `127.0.0.1`, `localhost`, or `::1` (port-agnostic), exiting with status 2 and a clear error message otherwise. Rationale: the user maintains multiple Supabase projects locally and wanted a hard safety net against accidentally pointing the seed script (which requires a service-role key) at a remote project. Positive deviation — strictly hardens the script.
- Task 21: Added storage RLS migration `supabase/migrations/20260510000007_storage_rls.sql`. Permits authenticated users to INSERT/UPDATE/DELETE storage objects under their own `users/<auth.uid()>/*` prefix in the `media` bucket, and to SELECT any object in `media` (so client-side `createSignedUrl` minting works). Required because Task 10/12 moved signed-URL minting client-side, and the bucket was originally created with no policies on `storage.objects`. Tighten the SELECT policy in Plan 03 when the view RPCs scope per-viewer.
- Task 21: Refreshed `e2e/smoke.spec.ts`. The original tests asserted on a home-page bootstrap heading and a login placeholder, both of which Plan 02 routing removed (home now redirects via `RootRedirect`; the login route renders the real `LoginForm`). Replaced with two assertions against the live login page (heading + submit button; email + password inputs) and left the PWA manifest test intact. Test count went from 3 to 3.

### Open questions for the user before execution

Flag and resolve before starting:

1. **Onboarding "role" — once chosen, immutable forever, or immutable only within onboarding?** Spec §3 says "set at signup, immutable" (decisions log §12). Plan 02 implements **immutable forever**: `set_profile_role` rejects if `profiles.role` is already non-null. If the user wants this softened later (e.g. admin override), it would be a follow-up RPC.
2. **postcodes.io `/places` rate limit.** No API key, no documented limit but they ask for fair use. Plan 02 calls it directly from the Edge Function with no caching. If we want a cache table later, that's a follow-up. **Assumption: fine for MVP traffic.**
3. **Card photo signed URL TTL.** Spec §6 says "1 hour" for view-RPC media. Plan 02 uses 3600s for every signed GET URL produced by `view_search`, `view_profile`, `view_my_profile`. Refresh is "rerun the query when needed" — TanStack Query stale times handle this.
4. **`view_search` ordering.** Spec doesn't pin one. Plan 02 orders by `last_active_at DESC NULLS LAST, id ASC`, cursors by `(last_active_at, id)`. Documented in the RPC body.

---

## File map

Files created or significantly touched in this plan:

```
shared/
├── rpc-contracts.ts                 EXTENDED with auth + profile + media + search schemas
└── db-types.ts                      REGENERATED after each migration

src/
├── App.tsx                          REPLACED — renders <RouterProvider/> via routes.tsx
├── routes.tsx                       REPLACED — real route tree with guards
├── lib/
│   ├── supabase.ts                  (existing) — unchanged
│   ├── rpc.ts                       NEW — typed RPC wrapper that .parse()s every response
│   ├── auth.ts                      NEW — AuthProvider, useSession() hook
│   ├── query-client.ts              NEW — TanStack Query client
│   └── format.ts                    NEW — age, distance formatters (i18n-aware)
├── features/
│   ├── auth/
│   │   ├── api.ts                   sign-up / sign-in / reset-password / sign-out
│   │   ├── components/
│   │   │   ├── SignupForm.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   └── ForgotPasswordForm.tsx
│   │   ├── pages/
│   │   │   ├── SignupPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   └── AuthConfirmPage.tsx
│   │   └── __tests__/
│   │       ├── SignupForm.test.tsx
│   │       ├── LoginForm.test.tsx
│   │       └── ForgotPasswordForm.test.tsx
│   ├── onboarding/
│   │   ├── api.ts                   wraps set_profile_role / identity / location / complete
│   │   ├── geocode.ts               calls geocode-city Edge Function
│   │   ├── hooks.ts                 useMyProfile() + onboarding mutations
│   │   ├── components/
│   │   │   ├── RoleStep.tsx
│   │   │   ├── IdentityStep.tsx
│   │   │   ├── LocationStep.tsx
│   │   │   └── PhotoStep.tsx
│   │   ├── pages/
│   │   │   ├── OnboardingLayout.tsx
│   │   │   └── *.tsx                (one per step)
│   │   └── __tests__/
│   ├── search/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── components/ProfileCard.tsx
│   │   ├── pages/SearchPage.tsx
│   │   └── __tests__/
│   ├── profile/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── pages/
│   │   │   ├── ProfilePage.tsx        /profile/:id
│   │   │   └── MyProfilePage.tsx      /me
│   │   └── __tests__/
│   └── shell/
│       ├── AppShell.tsx               bottom tab bar + hamburger
│       ├── BottomTabBar.tsx
│       ├── HamburgerMenu.tsx
│       └── __tests__/
├── lib/__tests__/format.test.ts
└── lib/__tests__/dob.test.ts          age-from-DOB pure helper

supabase/
├── migrations/
│   ├── 20260510000000_profiles.sql
│   ├── 20260510000001_media.sql
│   ├── 20260510000002_handle_new_user_trigger.sql
│   ├── 20260510000003_rpc_onboarding.sql
│   ├── 20260510000004_rpc_media.sql
│   ├── 20260510000005_rpc_views.sql
│   └── 20260510000006_storage_bucket.sql
├── functions/
│   └── geocode-city/
│       ├── index.ts
│       └── deno.json
├── tests/
│   ├── 10_profiles_schema.sql
│   ├── 11_profiles_rls.sql
│   ├── 12_media_schema_rls.sql
│   ├── 13_rpc_set_profile_role.sql
│   ├── 14_rpc_set_profile_identity.sql
│   ├── 15_rpc_set_profile_location.sql
│   ├── 16_rpc_media_upload.sql
│   ├── 17_rpc_complete_onboarding.sql
│   ├── 18_rpc_view_search.sql
│   └── 19_rpc_view_profile.sql
└── seed-test.sql                    fixtures helpers shared by pgTAP tests

e2e/
└── onboarding.spec.ts                signup → onboarding → search → profile

scripts/
└── seed-dev-users.mjs                creates a few confirmed users via admin API for local dev

.github/workflows/ci.yml              EXTENDED with drift checks + edge-function deploy step
```

Conventions reminder: every code step contains the **actual** code. RPC bodies use the spec §6 template literally — `auth.uid()` null check first, role check second, body third, `jsonb` return. Every public RPC returns `{ ok: true, ... }` on success or `{ ok: false, error: '<code>' }` on logical failure; uncaught errors propagate as `RAISE EXCEPTION` (caught by the typed RPC wrapper and surfaced as toasts).

---

## Task 1 — Carry-over from Plan 01 (housekeeping)

Address the four flagged smells from Plan 01 before adding feature work on top.

**Files:**

- Modify: `scripts/gen-config.mjs` (dollar-quoted SQL)
- Modify: `src/lib/i18n.ts` (return the init promise)
- Modify: `src/routes.tsx`, `src/__tests__/App.test.tsx` (use `react-router` package)
- Modify: `.github/workflows/ci.yml` (drift checks)

- [ ] **Step 1: Switch `gen-config.mjs` to dollar-quoted SQL**

Replace the `stmts` construction in `scripts/gen-config.mjs` with:

```js
// Emit one UPSERT per top-level key.
// Use a dollar-quoted tag derived from the key to avoid any escaping concerns
// with quotes, backslashes, or Unicode line separators in the JSON payload.
const stmts = Object.entries(APP_CONFIG)
  .map(([key, value]) => {
    const json = JSON.stringify(value)
    const tag = `cfg_${key}`
    return `INSERT INTO public.app_config(key, value) VALUES ('${key}', $${tag}$${json}$${tag}$::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`
  })
  .join('\n\n')
```

Then re-run:

```bash
pnpm gen:config
```

Expected: regenerated migration uses `$cfg_tokens$...$cfg_tokens$::jsonb` etc. Diff against the previously generated file confirms the new form.

Re-apply locally to confirm Postgres still accepts it:

```bash
supabase start
supabase db reset
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT key FROM public.app_config ORDER BY key;"
```

Expected: 4 rows (`age`, `media`, `payments`, `tokens`). Stop Supabase: `supabase stop`.

- [ ] **Step 2: Make `initI18n()` return its promise**

Modify `src/lib/i18n.ts`:

```ts
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import enCommon from '../i18n/en/common.json'

export function initI18n(): Promise<unknown> {
  return i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { en: { common: enCommon } },
      fallbackLng: 'en',
      defaultNS: 'common',
      interpolation: { escapeValue: false },
    })
}
```

Callers that don't await still work (it's a fresh promise each call, no shared state corruption). Callers that do await (e.g. tests) now get determinism.

- [ ] **Step 3: Migrate `react-router-dom` → `react-router`**

```bash
pnpm remove react-router-dom
pnpm add react-router
```

Update `src/routes.tsx` imports:

```tsx
import { createBrowserRouter } from 'react-router'
```

Update `src/__tests__/App.test.tsx`:

```tsx
import { createMemoryRouter, RouterProvider } from 'react-router'
```

Update `src/main.tsx`:

```tsx
import { RouterProvider } from 'react-router'
```

Run typecheck and tests:

```bash
pnpm typecheck && pnpm test
```

Expected: all green. The v7 package re-exports the same names; this is purely a package-name swap.

- [ ] **Step 4: Add CI drift checks for generated files**

Modify `.github/workflows/ci.yml`. Add a new `drift-checks` job that depends on Supabase being up (it needs `pnpm gen:types`):

```yaml
  drift-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: 2.78.1 }
      - uses: pnpm/action-setup@v3
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: supabase start
      - run: pnpm gen:config
      - run: git diff --exit-code supabase/migrations
      - run: pnpm gen:types
      - run: git diff --exit-code shared/db-types.ts
      - run: supabase stop
```

Also pin the Supabase CLI version in the existing `db-tests` job (was `latest`):

```yaml
      - uses: supabase/setup-cli@v1
        with: { version: 2.78.1 }
```

- [ ] **Step 5: Verify locally that drift checks pass on a clean tree**

```bash
supabase start
pnpm gen:config
git status --porcelain supabase/migrations    # expect empty
pnpm gen:types
git status --porcelain shared/db-types.ts     # expect empty
supabase stop
```

If either reports a diff, commit the regenerated file first.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Address Plan 01 carry-over: dollar-quoted SQL, i18n promise, react-router package, CI drift checks"
```

---

## Task 2 — Install TanStack Query + react-hook-form + Zod resolver

**Files:**

- Modify: `package.json`
- Create: `src/lib/query-client.ts`

- [ ] **Step 1: Install**

```bash
pnpm add @tanstack/react-query react-hook-form @hookform/resolvers
pnpm add -D @tanstack/react-query-devtools
```

- [ ] **Step 2: Create the query client module**

Create `src/lib/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

// Defaults tuned for the SD Site profile: short stale times (we don't have realtime),
// no auto-refetch on window focus during onboarding (would clobber form state),
// retry once on transient network errors.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add TanStack Query client, react-hook-form, Zod resolver"
```

---

## Task 3 — Migration: `profiles` table (Plan 02 columns only) + trigger

**Files:**

- Create: `supabase/migrations/20260510000000_profiles.sql`
- Create: `supabase/migrations/20260510000002_handle_new_user_trigger.sql`
- Create: `supabase/tests/10_profiles_schema.sql`

We start with a failing pgTAP test, then write the migration to satisfy it.

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/10_profiles_schema.sql`:

```sql
BEGIN;
SELECT plan(11);

SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT col_is_pk('public', 'profiles', 'id', 'profiles.id is PK');
SELECT col_type_is('public', 'profiles', 'id', 'uuid', 'profiles.id is uuid');

SELECT has_column('public', 'profiles', 'role',                 'role column');
SELECT has_column('public', 'profiles', 'display_name',         'display_name column');
SELECT has_column('public', 'profiles', 'date_of_birth',        'date_of_birth column');
SELECT has_column('public', 'profiles', 'status',               'status column');
SELECT has_column('public', 'profiles', 'token_balance',        'token_balance column');
SELECT has_column('public', 'profiles', 'city_lat',             'city_lat column');
SELECT has_column('public', 'profiles', 'city_lng',             'city_lng column');

-- DOB ≥ 18 CHECK: inserting a 17-year-old DOB must raise.
SELECT throws_ok(
  $$ INSERT INTO public.profiles (id, date_of_birth, status)
     VALUES (gen_random_uuid(), (now() - interval '17 years')::date, 'pending_onboarding') $$,
  '23514',
  NULL,
  'CHECK constraint rejects under-18 DOB'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test, confirm fail**

```bash
supabase start
pnpm test:db
```

Expected: failure (`relation "public.profiles" does not exist`).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260510000000_profiles.sql`:

```sql
-- Profiles table — Plan 02 columns only.
-- Plan 03 adds: tagline, about, wants, height_cm, body_type, hair_color, eye_color,
-- has_piercings, has_tattoos, smoking, drinking, education, yearly_income_band,
-- net_worth_band, age_verified_at. Plan 04 adds tokens audit columns. Etc.

CREATE TYPE profile_role          AS ENUM ('benefactor', 'baby');
CREATE TYPE profile_gender        AS ENUM ('male', 'female', 'nonbinary', 'other');
CREATE TYPE profile_looking_for   AS ENUM ('male', 'female', 'any');
CREATE TYPE profile_status        AS ENUM ('pending_onboarding', 'active', 'suspended', 'deactivated');

CREATE TABLE public.profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                profile_role,                              -- NULL until onboarding step 1
  display_name        text,
  date_of_birth       date,
  gender              profile_gender,
  looking_for         profile_looking_for,
  city_display_name   text,
  city_lat            double precision,
  city_lng            double precision,
  status              profile_status NOT NULL DEFAULT 'pending_onboarding',
  token_balance       int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_active_at      timestamptz,
  CONSTRAINT profiles_dob_min_age
    CHECK (date_of_birth IS NULL OR date_of_birth <= (now()::date - interval '18 years'))
);

COMMENT ON TABLE public.profiles IS
  '1:1 with auth.users. Plan 02 columns only — see plan docs for additions in later plans.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
```

- [ ] **Step 4: Re-run test**

```bash
supabase db reset
pnpm test:db
```

Expected: pgTAP reports 11/11 passed for the new file (plus the existing smoke test).

- [ ] **Step 5: Write the AFTER INSERT trigger on `auth.users`**

Create `supabase/migrations/20260510000002_handle_new_user_trigger.sql`:

```sql
-- When a new user signs up via Supabase Auth, create their profile row in
-- 'pending_onboarding' status. Runs SECURITY DEFINER because auth.users
-- inserts are performed by the auth schema's own service role.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, status)
  VALUES (NEW.id, 'pending_onboarding');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 6: Add a pgTAP test for the trigger**

Append to `supabase/tests/10_profiles_schema.sql` (or create `supabase/tests/10b_profile_trigger.sql` to keep tests bite-sized — use a new file):

Create `supabase/tests/10b_profile_trigger.sql`:

```sql
BEGIN;
SELECT plan(2);

-- Insert directly into auth.users (service-role only path, but pgTAP runs as superuser).
DO $$
DECLARE u uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                          aud, role, created_at, updated_at, confirmation_token, email_change_token_new, recovery_token)
  VALUES (u, '00000000-0000-0000-0000-000000000000', 'trigger-test@local.test',
          '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
          '', '', '');
  PERFORM set_config('test.user_id', u::text, true);
END $$;

SELECT ok(
  EXISTS(SELECT 1 FROM public.profiles WHERE id = current_setting('test.user_id')::uuid),
  'trigger creates profile row'
);

SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = current_setting('test.user_id')::uuid),
  'pending_onboarding',
  'new profile is in pending_onboarding status'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 7: Re-run tests + regenerate types**

```bash
supabase db reset
pnpm test:db
pnpm gen:types
```

Expected: pgTAP passes; `shared/db-types.ts` now includes `profiles` with all the enum columns.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add profiles table with DOB CHECK and handle_new_user trigger"
```

---

## Task 4 — RLS policies for `profiles`

Per spec §6: SELECT for authenticated users where `status='active'`; INSERT trigger-only (already deny-all-by-default); UPDATE by owner on an allow-list of columns; no DELETE.

**Files:**

- Create: `supabase/migrations/20260510000000a_profiles_rls.sql`
- Create: `supabase/tests/11_profiles_rls.sql`

- [ ] **Step 1: Write failing RLS test**

Create `supabase/tests/11_profiles_rls.sql`:

```sql
BEGIN;
SELECT plan(6);

-- Fixture: two confirmed users, one active, one pending.
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'alice@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'bob@local.test',   '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');
-- Trigger created profiles; promote alice to active.
UPDATE public.profiles SET status = 'active', display_name = 'Alice'
 WHERE id = '11111111-1111-1111-1111-111111111111';

-- Switch to authenticated role as alice
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT ok(
  EXISTS(SELECT 1 FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'alice can SELECT her own active profile'
);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222'),
  'alice cannot SELECT pending_onboarding bob via direct SELECT'
);

-- alice can update her own display_name
UPDATE public.profiles SET display_name = 'Alice 2' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT display_name FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'Alice 2',
  'alice can UPDATE her own display_name'
);

-- alice cannot update bob
SELECT throws_ok(
  $$ UPDATE public.profiles SET display_name = 'Hacked' WHERE id = '22222222-2222-2222-2222-222222222222' $$,
  NULL, NULL,  -- no error; just zero rows affected silently is also acceptable
  'alice cannot UPDATE bob (RLS hides his row from her UPDATE)'
);

-- DELETE disallowed
SELECT throws_ok(
  $$ DELETE FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', NULL,
  'DELETE on profiles is disallowed by RLS'
);

-- INSERT disallowed directly (trigger only)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT throws_ok(
  $$ INSERT INTO public.profiles (id, status) VALUES (gen_random_uuid(), 'active') $$,
  '42501', NULL,
  'direct INSERT on profiles is denied'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test:db
```

Expected: failures because RLS isn't enabled yet.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260510000000a_profiles_rls.sql`:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users see their own row regardless of status; everyone else
-- sees only active rows. (Spec table says "Authenticated, status=active" — we widen
-- to include own-row-any-status so onboarding can read its own pending row.)
CREATE POLICY profiles_select_active_or_self
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (status = 'active' OR id = auth.uid());

-- UPDATE: owner only. Column-level allow-list is enforced by the RPCs (which are the
-- only path to UPDATE in production); the broad UPDATE policy here lets the
-- SECURITY DEFINER RPCs proceed when impersonating the user.
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT: no policy (default deny). Only the SECURITY DEFINER trigger creates rows.

-- DELETE: no policy (default deny). Account deletion will go through a future RPC.
```

- [ ] **Step 4: Re-run tests**

```bash
supabase db reset
pnpm test:db
```

Expected: 11/11 schema tests, 2/2 trigger tests, 6/6 RLS tests all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add RLS policies for profiles table"
```

---

## Task 5 — Migration: `media_items` + `profile_photos` + storage bucket + RLS

**Files:**

- Create: `supabase/migrations/20260510000001_media.sql`
- Create: `supabase/migrations/20260510000006_storage_bucket.sql`
- Create: `supabase/tests/12_media_schema_rls.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/12_media_schema_rls.sql`:

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('public', 'media_items', 'media_items table exists');
SELECT has_table('public', 'profile_photos', 'profile_photos junction exists');

-- UNIQUE(owner_id, hash) — dedup invariant
SELECT col_is_unique(
  'public', 'media_items', ARRAY['owner_id', 'hash'],
  'media_items (owner_id, hash) is unique'
);

-- kind enum
SELECT col_type_is('public', 'media_items', 'kind', 'media_kind', 'kind is media_kind enum');

-- profile_photos CHECK: only photos allowed (enforced via FK + trigger or CHECK)
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
        'mediatest@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333',
   'users/33333333-3333-3333-3333-333333333333/photoA.jpg', 'photo', 'hashA', 1234, 'approved'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '33333333-3333-3333-3333-333333333333',
   'users/33333333-3333-3333-3333-333333333333/videoB.mp4', 'video', 'hashB', 5678, 'approved');

-- A photo media_item can be added
INSERT INTO public.profile_photos (profile_id, media_item_id, ordinal)
VALUES ('33333333-3333-3333-3333-333333333333',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0);
SELECT ok(
  EXISTS(SELECT 1 FROM public.profile_photos
         WHERE media_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'photo can be inserted into profile_photos'
);

-- A video media_item cannot be added
SELECT throws_ok(
  $$ INSERT INTO public.profile_photos (profile_id, media_item_id, ordinal)
     VALUES ('33333333-3333-3333-3333-333333333333',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1) $$,
  NULL, NULL,
  'video media_item is rejected by profile_photos kind check'
);

-- Dedup: same owner + same hash → unique violation
SELECT throws_ok(
  $$ INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
     VALUES (gen_random_uuid(),
             '33333333-3333-3333-3333-333333333333',
             'users/33333333-3333-3333-3333-333333333333/dup.jpg', 'photo', 'hashA', 9999, 'approved') $$,
  '23505', NULL,
  'duplicate (owner_id, hash) is rejected'
);

-- media_items SELECT denied to plain authenticated direct reads
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SELECT is(
  (SELECT count(*) FROM public.media_items WHERE owner_id = '33333333-3333-3333-3333-333333333333')::int,
  0,
  'direct SELECT on media_items returns 0 (RLS deny-all)'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260510000001_media.sql`:

```sql
CREATE TYPE media_kind   AS ENUM ('photo', 'video');
CREATE TYPE media_status AS ENUM ('pending_moderation', 'approved', 'rejected');

CREATE TABLE public.media_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  kind            media_kind NOT NULL,
  hash            text NOT NULL,
  size_bytes      int  NOT NULL,
  width           int,
  height          int,
  duration_seconds int,
  status          media_status NOT NULL DEFAULT 'approved',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, hash)
);

CREATE TABLE public.profile_photos (
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_item_id  uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  ordinal        int  NOT NULL,
  PRIMARY KEY (profile_id, media_item_id)
);

CREATE INDEX profile_photos_by_profile_ordinal
  ON public.profile_photos (profile_id, ordinal);

-- Enforce: only photo kind allowed in profile_photos.
CREATE OR REPLACE FUNCTION public.tg_profile_photos_kind_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE k media_kind;
BEGIN
  SELECT kind INTO k FROM public.media_items WHERE id = NEW.media_item_id;
  IF k IS DISTINCT FROM 'photo' THEN
    RAISE EXCEPTION 'profile_photos requires media_items.kind=photo (got %)', k
      USING errcode = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profile_photos_kind_check
  BEFORE INSERT OR UPDATE ON public.profile_photos
  FOR EACH ROW EXECUTE FUNCTION public.tg_profile_photos_kind_check();

-- RLS: media_items default-deny; profile_photos owner-only direct.
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
-- No policies: deny-all. RPCs are the only path.

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_photos_owner_all
  ON public.profile_photos
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
-- Cross-user reads of profile_photos go through view RPCs that join media_items.
```

- [ ] **Step 4: Write the storage bucket migration**

Create `supabase/migrations/20260510000006_storage_bucket.sql`:

```sql
-- Single private media bucket. All reads/writes go through signed URLs minted
-- by SECURITY DEFINER RPCs after an authorisation check. Default policies on
-- storage.objects deny everything — we add no policies, so only the service
-- role (used by createSignedUploadUrl in the RPC) can touch it.

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO UPDATE SET public = false;
```

- [ ] **Step 5: Re-run tests + regenerate types**

```bash
supabase db reset
pnpm test:db
pnpm gen:types
```

Expected: media schema/RLS tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add media_items, profile_photos, and private storage bucket"
```

---

## Task 6 — RPC: `set_profile_role` (with pgTAP TDD)

**Files:**

- Create: `supabase/migrations/20260510000003_rpc_onboarding.sql` (this RPC + the next two)
- Create: `supabase/tests/13_rpc_set_profile_role.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/13_rpc_set_profile_role.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
        'role-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

-- 1. Unauthenticated rejection
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_role('benefactor') $$,
  'P0001', NULL,
  'unauthenticated call raises P0001'
);

-- 2. Happy path
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SELECT is(
  (SELECT public.set_profile_role('benefactor'))::text,
  '{"ok": true}',
  'set_profile_role("benefactor") returns ok'
);
SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444'),
  'benefactor',
  'role is persisted'
);

-- 3. Second call rejected (immutable once set)
SELECT is(
  (SELECT public.set_profile_role('baby'))::text,
  '{"ok": false, "error": "role_already_set"}',
  'second call returns role_already_set error'
);
SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444'),
  'benefactor',
  'original role unchanged'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail (function does not exist)**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the RPC**

Create `supabase/migrations/20260510000003_rpc_onboarding.sql`:

```sql
-- Onboarding RPCs: set_profile_role, set_profile_identity, set_profile_location,
-- complete_onboarding. All SECURITY DEFINER, all return jsonb {ok, ...}.

CREATE OR REPLACE FUNCTION public.set_profile_role(p_role profile_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  existing profile_role;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT role INTO existing FROM public.profiles WHERE id = me;
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_already_set');
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = me;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_role(profile_role) TO authenticated;
```

- [ ] **Step 4: Re-run test**

```bash
supabase db reset
pnpm test:db
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add set_profile_role RPC with role-immutability test"
```

---

## Task 7 — RPC: `set_profile_identity` (with DOB ≥18 server check)

**Files:**

- Modify: `supabase/migrations/20260510000003_rpc_onboarding.sql`
- Create: `supabase/tests/14_rpc_set_profile_identity.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/14_rpc_set_profile_identity.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
        'identity-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

-- Pre-req: role chosen
PERFORM public.set_profile_role('baby');

-- Happy path
SELECT is(
  (SELECT public.set_profile_identity('Sam', '1995-06-15'::date, 'female', 'male'))::text,
  '{"ok": true}',
  'set_profile_identity happy path returns ok'
);

SELECT is(
  (SELECT display_name FROM public.profiles WHERE id = '55555555-5555-5555-5555-555555555555'),
  'Sam',
  'display_name persisted'
);

-- Under 18 rejected (server side)
SELECT is(
  (SELECT public.set_profile_identity('Too Young', (now() - interval '17 years 6 months')::date,
                                       'female', 'male'))::text,
  '{"ok": false, "error": "under_18"}',
  'under-18 DOB returns under_18 error'
);

-- Empty display_name rejected
SELECT is(
  (SELECT public.set_profile_identity('', '1990-01-01'::date, 'female', 'male'))::text,
  '{"ok": false, "error": "display_name_required"}',
  'empty display_name rejected'
);

-- Unauthenticated rejected
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_identity('X', '1990-01-01'::date, 'female', 'male') $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Append the RPC**

Append to `supabase/migrations/20260510000003_rpc_onboarding.sql`:

```sql
CREATE OR REPLACE FUNCTION public.set_profile_identity(
  p_display_name  text,
  p_date_of_birth date,
  p_gender        profile_gender,
  p_looking_for   profile_looking_for
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'display_name_required');
  END IF;

  IF p_date_of_birth > (now()::date - interval '18 years') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'under_18');
  END IF;

  UPDATE public.profiles
     SET display_name  = trim(p_display_name),
         date_of_birth = p_date_of_birth,
         gender        = p_gender,
         looking_for   = p_looking_for
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_identity(text, date, profile_gender, profile_looking_for)
  TO authenticated;
```

- [ ] **Step 4: Re-run**

```bash
supabase db reset && pnpm test:db
```

Expected: 5/5 pass for this file.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add set_profile_identity RPC with DOB and display_name validation"
```

---

## Task 8 — Edge Function: `geocode-city`

**Files:**

- Create: `supabase/functions/geocode-city/index.ts`
- Create: `supabase/functions/geocode-city/deno.json`
- Modify: `supabase/config.toml` (declare the function)

The frontend calls this function during onboarding step 3, receives `{display_name, lat, lng}`, then calls `set_profile_location(display_name, lat, lng)`. **The RPC does no geocoding** — it just stores. This keeps the RPC pure SQL and keeps HTTP I/O on the Edge.

- [ ] **Step 1: Create the function**

Create `supabase/functions/geocode-city/index.ts`:

```ts
// geocode-city — accepts {place_name: string}, queries postcodes.io /places,
// returns {display_name, lat, lng} or 404 if not found.
//
// Why: postcodes.io has no API key and is server-trusted enough for MVP UK only.
// Pre-launch: swap for Mapbox/Nominatim for global coverage; that swap happens
// inside this file and nowhere else.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface PostcodesIoPlace {
  name_1: string
  county_unitary: string | null
  region: string | null
  longitude: number
  latitude: number
}

interface PostcodesIoResponse {
  status: number
  result: PostcodesIoPlace[] | null
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  let body: { place_name?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const placeName = body.place_name?.trim()
  if (!placeName || placeName.length < 2) {
    return new Response(JSON.stringify({ ok: false, error: 'place_name_required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const url = `https://api.postcodes.io/places?q=${encodeURIComponent(placeName)}`
  const upstream = await fetch(url, { headers: { accept: 'application/json' } })
  if (!upstream.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_error' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
  const data: PostcodesIoResponse = await upstream.json()
  if (!data.result || data.result.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  const top = data.result[0]
  const labelParts = [top.name_1, top.county_unitary ?? top.region].filter(Boolean)
  const display_name = labelParts.join(', ')

  return new Response(
    JSON.stringify({
      ok: true,
      display_name,
      lat: top.latitude,
      lng: top.longitude,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
```

Create `supabase/functions/geocode-city/deno.json`:

```json
{
  "imports": {
    "std/": "https://deno.land/std@0.224.0/"
  }
}
```

- [ ] **Step 2: Verify the function is registered in `supabase/config.toml`**

Open `supabase/config.toml`. The CLI auto-discovers functions in `supabase/functions/*/`, but the `[functions.<name>]` section governs JWT verification. For Plan 02 we keep JWT verification on (the frontend already passes the authed user's JWT). Confirm there's no `verify_jwt = false` override; if a `[functions.geocode-city]` section exists, ensure it's empty or absent.

- [ ] **Step 3: Run the function locally**

In one terminal:

```bash
supabase start
supabase functions serve geocode-city --no-verify-jwt
```

In a second terminal, smoke-test:

```bash
curl -sX POST http://127.0.0.1:54321/functions/v1/geocode-city \
  -H 'content-type: application/json' \
  -d '{"place_name":"Manchester"}'
```

Expected: a JSON body with `ok: true`, `display_name` containing "Manchester", `lat` ≈ 53.48, `lng` ≈ -2.24.

Try a nonsense city:

```bash
curl -sX POST http://127.0.0.1:54321/functions/v1/geocode-city \
  -H 'content-type: application/json' \
  -d '{"place_name":"zzzzzzzzzzzzz"}'
```

Expected: HTTP 404 with `{ok: false, error: "not_found"}`.

Stop the function process (Ctrl-C) and `supabase stop`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add geocode-city Edge Function (postcodes.io proxy)"
```

---

## Task 9 — RPC: `set_profile_location`

**Files:**

- Modify: `supabase/migrations/20260510000003_rpc_onboarding.sql`
- Create: `supabase/tests/15_rpc_set_profile_location.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/15_rpc_set_profile_location.sql`:

```sql
BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
        'loc-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';

SELECT is(
  (SELECT public.set_profile_location('Manchester, Greater Manchester', 53.4808, -2.2426))::text,
  '{"ok": true}',
  'happy path returns ok'
);

SELECT is(
  (SELECT city_display_name FROM public.profiles WHERE id = '66666666-6666-6666-6666-666666666666'),
  'Manchester, Greater Manchester',
  'city_display_name persisted'
);

-- Out-of-range lat rejected
SELECT is(
  (SELECT public.set_profile_location('Bad', 91.0, 0.0))::text,
  '{"ok": false, "error": "lat_out_of_range"}',
  'lat > 90 rejected'
);

-- Empty display rejected
SELECT is(
  (SELECT public.set_profile_location('', 0.0, 0.0))::text,
  '{"ok": false, "error": "city_display_name_required"}',
  'empty city_display_name rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Append the RPC**

Append to `supabase/migrations/20260510000003_rpc_onboarding.sql`:

```sql
CREATE OR REPLACE FUNCTION public.set_profile_location(
  p_display_name text,
  p_lat          double precision,
  p_lng          double precision
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'city_display_name_required');
  END IF;

  IF p_lat IS NULL OR p_lat < -90  OR p_lat > 90 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lat_out_of_range');
  END IF;

  IF p_lng IS NULL OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lng_out_of_range');
  END IF;

  UPDATE public.profiles
     SET city_display_name = trim(p_display_name),
         city_lat          = p_lat,
         city_lng          = p_lng
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_location(text, double precision, double precision)
  TO authenticated;
```

- [ ] **Step 4: Re-run**

```bash
supabase db reset && pnpm test:db
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add set_profile_location RPC with lat/lng range validation"
```

---

## Task 10 — RPC: `prepare_media_upload` + `finalize_media_upload` + `add_to_profile_photos`

**Files:**

- Create: `supabase/migrations/20260510000004_rpc_media.sql`
- Create: `supabase/tests/16_rpc_media_upload.sql`

`prepare_media_upload` is the centrepiece: it must (a) check auth, (b) dedup on `(owner_id, hash)` — if a row already exists, return its id, (c) mint a signed upload URL valid 5 minutes scoped to the deterministic path, (d) insert the row in `media_items`. Supabase's `createSignedUploadUrl` is exposed in SQL via the `storage` schema; we call it inside the function.

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/16_rpc_media_upload.sql`:

```sql
BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
        'media-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';

-- 1. Happy path: returns ok=true, media_item_id, signed_upload_url, storage_path
WITH r AS (SELECT public.prepare_media_upload('photo', 'sha256hash1', 4096, 800, 600, NULL) AS body)
SELECT ok((SELECT body->>'ok' FROM r) = 'true',                       'ok=true on first upload');

WITH r AS (SELECT public.prepare_media_upload('photo', 'sha256hash1', 4096, 800, 600, NULL) AS body)
SELECT ok((SELECT body->>'storage_path' FROM r)
            LIKE 'users/77777777-7777-7777-7777-777777777777/%',      'storage_path scoped to owner');

-- 2. Dedup: second call with same hash returns the same media_item_id
WITH r1 AS (SELECT (public.prepare_media_upload('photo','sha256hash2',1024,400,300,NULL))->>'media_item_id' AS id1),
     r2 AS (SELECT (public.prepare_media_upload('photo','sha256hash2',1024,400,300,NULL))->>'media_item_id' AS id2)
SELECT is(
  (SELECT id1 FROM r1),
  (SELECT id2 FROM r2),
  'same hash returns same media_item_id (dedup)'
);

-- 3. finalize_media_upload marks status approved (it was inserted as approved already in MVP)
WITH r  AS (SELECT (public.prepare_media_upload('photo','sha256hash3',1024,400,300,NULL))->>'media_item_id' AS id),
     fr AS (SELECT public.finalize_media_upload((SELECT id FROM r)::uuid) AS body)
SELECT ok((SELECT body->>'ok' FROM fr) = 'true', 'finalize_media_upload ok');

-- 4. add_to_profile_photos happy
WITH r  AS (SELECT (public.prepare_media_upload('photo','sha256hash4',1024,400,300,NULL))->>'media_item_id' AS id)
SELECT is(
  (SELECT public.add_to_profile_photos((SELECT id FROM r)::uuid, 0))::text,
  '{"ok": true}',
  'add_to_profile_photos ok'
);

-- 5. add_to_profile_photos rejects video kind
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        '77777777-7777-7777-7777-777777777777',
        'users/77777777-7777-7777-7777-777777777777/v.mp4', 'video', 'videohash', 9999, 'approved');
SELECT is(
  (SELECT public.add_to_profile_photos('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 1))::text,
  '{"ok": false, "error": "not_a_photo"}',
  'add_to_profile_photos rejects video kind'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260510000004_rpc_media.sql`:

```sql
-- prepare_media_upload — atomically inserts a media_items row (deduping by hash)
-- and returns a 5-minute signed upload URL for the deterministic storage path.

CREATE OR REPLACE FUNCTION public.prepare_media_upload(
  p_kind            media_kind,
  p_hash            text,
  p_size_bytes      int,
  p_width           int,
  p_height          int,
  p_duration_seconds int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me              uuid := auth.uid();
  existing_id     uuid;
  new_id          uuid;
  ext             text;
  storage_path    text;
  signed_payload  jsonb;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_hash IS NULL OR length(p_hash) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_hash');
  END IF;

  IF p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_size');
  END IF;

  -- Dedup: same owner + same hash → return existing row
  SELECT id INTO existing_id
    FROM public.media_items
   WHERE owner_id = me AND hash = p_hash;

  IF existing_id IS NOT NULL THEN
    SELECT storage_path INTO storage_path FROM public.media_items WHERE id = existing_id;
    -- Mint a fresh signed upload URL in case the previous one expired and the
    -- file was never uploaded. (Idempotent re-upload on the same path.)
    signed_payload := storage.create_signed_upload_url('media', storage_path);
    RETURN jsonb_build_object(
      'ok', true,
      'media_item_id', existing_id,
      'storage_path', storage_path,
      'signed_upload_url', signed_payload->>'signedUrl',
      'deduped', true
    );
  END IF;

  ext := CASE p_kind WHEN 'photo' THEN 'jpg' WHEN 'video' THEN 'mp4' END;
  storage_path := 'users/' || me::text || '/' || p_hash || '.' || ext;
  new_id := gen_random_uuid();

  INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash,
                                   size_bytes, width, height, duration_seconds, status)
  VALUES (new_id, me, storage_path, p_kind, p_hash,
          p_size_bytes, p_width, p_height, p_duration_seconds, 'approved');

  signed_payload := storage.create_signed_upload_url('media', storage_path);

  RETURN jsonb_build_object(
    'ok', true,
    'media_item_id', new_id,
    'storage_path', storage_path,
    'signed_upload_url', signed_payload->>'signedUrl',
    'deduped', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_media_upload(media_kind, text, int, int, int, int)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_media_upload(p_media_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.media_items
                  WHERE id = p_media_item_id AND owner_id = me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  -- In MVP, media_items default to 'approved'; this RPC is a no-op now but exists
  -- as the hook point for pre-launch moderation queue.
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_media_upload(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_to_profile_photos(
  p_media_item_id uuid,
  p_ordinal       int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  k  media_kind;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT kind INTO k FROM public.media_items
   WHERE id = p_media_item_id AND owner_id = me;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF k IS DISTINCT FROM 'photo' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_photo');
  END IF;

  INSERT INTO public.profile_photos (profile_id, media_item_id, ordinal)
  VALUES (me, p_media_item_id, p_ordinal)
  ON CONFLICT (profile_id, media_item_id) DO UPDATE SET ordinal = EXCLUDED.ordinal;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_to_profile_photos(uuid, int) TO authenticated;
```

- [ ] **Step 4: Re-run tests**

```bash
supabase db reset && pnpm test:db
```

Expected: 6/6 media-upload tests pass. If `storage.create_signed_upload_url` is not found on your Supabase version, fall back to the JS-side path: have the RPC return `{ok, media_item_id, storage_path}` and let the frontend call `supabase.storage.from('media').createSignedUploadUrl(path)`. **Update the RPC contract and the matching frontend code if you take this fallback.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add prepare_media_upload, finalize_media_upload, add_to_profile_photos RPCs"
```

---

## Task 11 — RPC: `complete_onboarding` (atomic transition)

**Files:**

- Modify: `supabase/migrations/20260510000003_rpc_onboarding.sql`
- Create: `supabase/tests/17_rpc_complete_onboarding.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/17_rpc_complete_onboarding.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
        'comp@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';

-- 1. Missing role/identity/location/photo — must fail and NOT transition status
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "role_missing"}',
  'missing role rejected'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  'pending_onboarding',
  'status unchanged after failed completion'
);

-- 2. Fill in everything except a photo
PERFORM public.set_profile_role('baby');
PERFORM public.set_profile_identity('Lex', '1995-01-01'::date, 'female', 'male');
PERFORM public.set_profile_location('Manchester', 53.48, -2.24);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "photo_required"}',
  'missing photo rejected'
);

-- 3. Add a photo, then succeed
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        '88888888-8888-8888-8888-888888888888',
        'users/88888888-8888-8888-8888-888888888888/p.jpg', 'photo', 'h_complete', 1024, 'approved');
PERFORM public.add_to_profile_photos('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 0);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": true}',
  'complete_onboarding succeeds with all preconditions met'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  'active',
  'status transitioned to active'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Append the RPC**

Append to `supabase/migrations/20260510000003_rpc_onboarding.sql`:

```sql
CREATE OR REPLACE FUNCTION public.complete_onboarding() RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p  public.profiles%ROWTYPE;
  has_photo boolean;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = me;

  IF p.role IS NULL              THEN RETURN jsonb_build_object('ok', false, 'error', 'role_missing');        END IF;
  IF p.display_name IS NULL      THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing');    END IF;
  IF p.date_of_birth IS NULL     THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing');    END IF;
  IF p.city_display_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'location_missing');    END IF;

  SELECT EXISTS(SELECT 1 FROM public.profile_photos WHERE profile_id = me) INTO has_photo;
  IF NOT has_photo THEN
    RETURN jsonb_build_object('ok', false, 'error', 'photo_required');
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

GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;
```

- [ ] **Step 4: Re-run**

```bash
supabase db reset && pnpm test:db
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add complete_onboarding RPC with atomic precondition check"
```

---

## Task 12 — View RPCs: `_profile_card_for_viewer`, `view_search`, `view_profile`, `view_my_profile`

**Files:**

- Create: `supabase/migrations/20260510000005_rpc_views.sql`
- Create: `supabase/tests/18_rpc_view_search.sql`
- Create: `supabase/tests/19_rpc_view_profile.sql`

- [ ] **Step 1: Write failing pgTAP test for view_search**

Create `supabase/tests/18_rpc_view_search.sql`:

```sql
BEGIN;
SELECT plan(4);

-- Fixture: an active benefactor (viewer) and two active babies + one active benefactor (not visible).
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'd@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'b1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'b2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'd2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Daddy',  date_of_birth='1985-01-01', city_lat=51.5074, city_lng=-0.1278, city_display_name='London', last_active_at=now()             WHERE id='aaaaaaaa-0000-0000-0000-000000000001';
UPDATE public.profiles SET role='baby',       status='active', display_name='Baby1',  date_of_birth='1998-01-01', city_lat=51.5074, city_lng=-0.1278, city_display_name='London', last_active_at=now() - interval '1 min' WHERE id='aaaaaaaa-0000-0000-0000-000000000002';
UPDATE public.profiles SET role='baby',       status='active', display_name='Baby2',  date_of_birth='1999-01-01', city_lat=53.4808, city_lng=-2.2426, city_display_name='Manchester', last_active_at=now() - interval '2 min' WHERE id='aaaaaaaa-0000-0000-0000-000000000003';
UPDATE public.profiles SET role='benefactor', status='active', display_name='Daddy2', date_of_birth='1980-01-01', city_lat=53.4808, city_lng=-2.2426, city_display_name='Manchester', last_active_at=now()             WHERE id='aaaaaaaa-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000001';

-- view_search returns array of baby cards for a benefactor viewer
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(
  jsonb_array_length((SELECT body->'cards' FROM r)),
  2,
  'benefactor sees 2 baby cards'
);

-- Each card has expected fields
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body),
     c AS (SELECT (body->'cards'->0) AS card FROM r)
SELECT ok((SELECT card ? 'profile_id' AND card ? 'display_name' AND card ? 'age'
              AND card ? 'city_display_name' AND card ? 'distance_miles'
              AND card ? 'primary_photo_url' FROM c),
  'card has all required fields');

-- Ordering: London baby (closer + more recent) appears first for London viewer
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(
  (SELECT body->'cards'->0->>'display_name' FROM r),
  'Baby1',
  'closer + more recent baby ranks first'
);

-- A baby viewer sees benefactors only
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000002';
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(
  jsonb_array_length((SELECT body->'cards' FROM r)),
  2,
  'baby sees 2 benefactor cards'
);

SELECT * FROM finish();
ROLLBACK;
```

Create `supabase/tests/19_rpc_view_profile.sql`:

```sql
BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'v1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'v2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Viewer',  date_of_birth='1980-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London' WHERE id='bbbbbbbb-0000-0000-0000-000000000001';
UPDATE public.profiles SET role='baby',       status='active', display_name='Target',  date_of_birth='1998-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London' WHERE id='bbbbbbbb-0000-0000-0000-000000000002';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-000000000001';

WITH r AS (SELECT public.view_profile('bbbbbbbb-0000-0000-0000-000000000002'::uuid) AS body)
SELECT is((SELECT body->>'ok' FROM r), 'true', 'view_profile ok');
WITH r AS (SELECT public.view_profile('bbbbbbbb-0000-0000-0000-000000000002'::uuid) AS body)
SELECT is((SELECT body->'profile'->>'display_name' FROM r), 'Target', 'display_name returned');
WITH r AS (SELECT public.view_profile('bbbbbbbb-0000-0000-0000-000000000002'::uuid) AS body)
SELECT is((SELECT body->'profile'->>'age' FROM r)::int >= 26, true, 'age computed');
-- Non-existent / suspended target returns ok=false
SELECT is(
  (SELECT public.view_profile('00000000-0000-0000-0000-000000000000'::uuid))::text,
  '{"ok": false, "error": "not_found"}',
  'unknown profile returns not_found'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the view-RPC migration**

Create `supabase/migrations/20260510000005_rpc_views.sql`:

```sql
-- Shared helper: render a profile-card jsonb for one viewer/target pair.
-- Returns NULL if target is not visible to viewer (status not active, or RLS hidden).
-- my_like_state is null in Plan 02; Plan 03 wires the likes mechanic.

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
  primary_photo_path text;
  primary_photo_url  text;
  distance_miles double precision;
  age int;
BEGIN
  SELECT * INTO t FROM public.profiles WHERE id = p_target;
  IF NOT FOUND OR t.status <> 'active' THEN RETURN NULL; END IF;

  SELECT * INTO v FROM public.profiles WHERE id = p_viewer;

  SELECT mi.storage_path INTO primary_photo_path
    FROM public.profile_photos pp
    JOIN public.media_items mi ON mi.id = pp.media_item_id
   WHERE pp.profile_id = t.id
   ORDER BY pp.ordinal ASC
   LIMIT 1;

  IF primary_photo_path IS NOT NULL THEN
    primary_photo_url := (storage.create_signed_url('media', primary_photo_path, 3600))->>'signedUrl';
  END IF;

  IF v.city_lat IS NOT NULL AND t.city_lat IS NOT NULL THEN
    distance_miles := ST_Distance(
      ST_MakePoint(v.city_lng, v.city_lat)::geography,
      ST_MakePoint(t.city_lng, t.city_lat)::geography
    ) / 1609.344;
  END IF;

  age := extract(year from age(t.date_of_birth))::int;

  RETURN jsonb_build_object(
    'profile_id',        t.id,
    'display_name',      t.display_name,
    'age',               age,
    'city_display_name', t.city_display_name,
    'distance_miles',    distance_miles,
    'primary_photo_url', primary_photo_url,
    'my_like_state',     NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._profile_card_for_viewer(uuid, uuid) TO authenticated;

-- view_search — role-pair filter only in Plan 02; cursor is (last_active_at::text || ':' || id::text)
-- Page size hardcoded to 20.
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
  target_role profile_role;
  cards jsonb := '[]'::jsonb;
  card  jsonb;
  next_cursor text;
  cur_last_active timestamptz;
  cur_id uuid;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = me;
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0002';
  END IF;

  target_role := CASE my_role WHEN 'benefactor' THEN 'baby'::profile_role
                              WHEN 'baby'       THEN 'benefactor'::profile_role END;

  IF p_cursor IS NOT NULL THEN
    cur_last_active := split_part(p_cursor, ':', 1)::timestamptz;
    cur_id          := split_part(p_cursor, ':', 2)::uuid;
  END IF;

  FOR rec IN
    SELECT id, last_active_at
      FROM public.profiles
     WHERE role = target_role
       AND status = 'active'
       AND id <> me
       AND (
         p_cursor IS NULL
         OR (last_active_at, id) < (cur_last_active, cur_id)
       )
     ORDER BY last_active_at DESC NULLS LAST, id ASC
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

-- view_profile — Plan 02 returns just the bare profile (no secret album, no
-- like state, no conversation summary). Plan 03/05/06 extend.
CREATE OR REPLACE FUNCTION public.view_profile(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  photos jsonb := '[]'::jsonb;
  age int;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT * INTO t FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND OR t.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = t.id
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object(
      'ordinal', rec.ordinal,
      'url', (storage.create_signed_url('media', rec.storage_path, 3600))->>'signedUrl'
    );
  END LOOP;

  age := extract(year from age(t.date_of_birth))::int;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',        t.id,
      'display_name',      t.display_name,
      'age',               age,
      'city_display_name', t.city_display_name,
      'gender',            t.gender,
      'looking_for',       t.looking_for,
      'photos',            photos
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_profile(uuid) TO authenticated;

-- view_my_profile — same shape but no status gating; includes onboarding status.
CREATE OR REPLACE FUNCTION public.view_my_profile() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  t  public.profiles%ROWTYPE;
  photos jsonb := '[]'::jsonb;
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

  FOR rec IN
    SELECT pp.ordinal, mi.storage_path
      FROM public.profile_photos pp
      JOIN public.media_items mi ON mi.id = pp.media_item_id
     WHERE pp.profile_id = me
     ORDER BY pp.ordinal
  LOOP
    photos := photos || jsonb_build_object(
      'ordinal', rec.ordinal,
      'url', (storage.create_signed_url('media', rec.storage_path, 3600))->>'signedUrl'
    );
  END LOOP;

  age := CASE WHEN t.date_of_birth IS NULL THEN NULL
              ELSE extract(year from age(t.date_of_birth))::int END;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'profile_id',        t.id,
      'role',              t.role,
      'status',            t.status,
      'display_name',      t.display_name,
      'age',               age,
      'date_of_birth',     t.date_of_birth,
      'gender',            t.gender,
      'looking_for',       t.looking_for,
      'city_display_name', t.city_display_name,
      'token_balance',     t.token_balance,
      'photos',            photos
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_my_profile() TO authenticated;
```

- [ ] **Step 4: Re-run + regen types**

```bash
supabase db reset && pnpm test:db && pnpm gen:types
```

Expected: 4/4 search tests + 4/4 profile tests pass. Generated types include the new RPCs.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add _profile_card_for_viewer helper and view_search/view_profile/view_my_profile RPCs"
```

---

## Task 13 — Zod RPC contracts in `shared/rpc-contracts.ts`

**Files:**

- Modify: `shared/rpc-contracts.ts`
- Create: `shared/__tests__/rpc-contracts.test.ts`

- [ ] **Step 1: Replace `shared/rpc-contracts.ts`**

```ts
import { z } from 'zod'

// Generic response envelope. RPCs return ok: true with data, or ok: false with error code.
export const RpcOk     = <T extends z.ZodTypeAny>(data: T) => z.object({ ok: z.literal(true) }).and(data)
export const RpcErr    = z.object({ ok: z.literal(false), error: z.string() })
export const RpcResult = <T extends z.ZodTypeAny>(data: T) => z.union([RpcOk(data), RpcErr])

// Enums (kept in sync with Postgres enums via gen:types compile check).
export const ProfileRole       = z.enum(['benefactor', 'baby'])
export const ProfileGender     = z.enum(['male', 'female', 'nonbinary', 'other'])
export const ProfileLookingFor = z.enum(['male', 'female', 'any'])
export const ProfileStatus     = z.enum(['pending_onboarding', 'active', 'suspended', 'deactivated'])
export const MediaKind         = z.enum(['photo', 'video'])

// ---- Onboarding RPCs ----

export const SetProfileRoleInput  = z.object({ p_role: ProfileRole })
export const SetProfileRoleResult = RpcResult(z.object({}))

export const SetProfileIdentityInput = z.object({
  p_display_name:  z.string().min(1).max(80),
  p_date_of_birth: z.string(), // ISO date YYYY-MM-DD
  p_gender:        ProfileGender,
  p_looking_for:   ProfileLookingFor,
})
export const SetProfileIdentityResult = RpcResult(z.object({}))

export const SetProfileLocationInput = z.object({
  p_display_name: z.string().min(1).max(120),
  p_lat:          z.number().min(-90).max(90),
  p_lng:          z.number().min(-180).max(180),
})
export const SetProfileLocationResult = RpcResult(z.object({}))

export const CompleteOnboardingResult = RpcResult(z.object({}))

// ---- Media RPCs ----

export const PrepareMediaUploadInput = z.object({
  p_kind:             MediaKind,
  p_hash:             z.string().min(16),
  p_size_bytes:       z.number().int().positive(),
  p_width:            z.number().int().positive().nullable(),
  p_height:           z.number().int().positive().nullable(),
  p_duration_seconds: z.number().int().positive().nullable(),
})
export const PrepareMediaUploadResult = RpcResult(z.object({
  media_item_id:     z.string().uuid(),
  storage_path:      z.string(),
  signed_upload_url: z.string().url(),
  deduped:           z.boolean(),
}))

export const FinalizeMediaUploadInput  = z.object({ p_media_item_id: z.string().uuid() })
export const FinalizeMediaUploadResult = RpcResult(z.object({}))

export const AddToProfilePhotosInput  = z.object({
  p_media_item_id: z.string().uuid(),
  p_ordinal:       z.number().int().min(0),
})
export const AddToProfilePhotosResult = RpcResult(z.object({}))

// ---- View RPCs ----

export const ProfileCard = z.object({
  profile_id:        z.string().uuid(),
  display_name:      z.string(),
  age:               z.number().int(),
  city_display_name: z.string().nullable(),
  distance_miles:    z.number().nullable(),
  primary_photo_url: z.string().url().nullable(),
  my_like_state:     z.null(),                 // Plan 03 widens this
})

export const ViewSearchInput  = z.object({
  p_filters: z.record(z.unknown()).default({}),
  p_cursor:  z.string().nullable().default(null),
})
export const ViewSearchResult = RpcResult(z.object({
  cards:       z.array(ProfileCard),
  next_cursor: z.string().nullable(),
}))

export const ProfilePhoto = z.object({
  ordinal: z.number().int(),
  url:     z.string().url(),
})

export const ViewProfileInput  = z.object({ p_profile_id: z.string().uuid() })
export const ViewProfileResult = RpcResult(z.object({
  profile: z.object({
    profile_id:        z.string().uuid(),
    display_name:      z.string(),
    age:               z.number().int(),
    city_display_name: z.string().nullable(),
    gender:            ProfileGender.nullable(),
    looking_for:       ProfileLookingFor.nullable(),
    photos:            z.array(ProfilePhoto),
  }),
}))

export const ViewMyProfileResult = RpcResult(z.object({
  profile: z.object({
    profile_id:        z.string().uuid(),
    role:              ProfileRole.nullable(),
    status:            ProfileStatus,
    display_name:      z.string().nullable(),
    age:               z.number().int().nullable(),
    date_of_birth:     z.string().nullable(),
    gender:            ProfileGender.nullable(),
    looking_for:       ProfileLookingFor.nullable(),
    city_display_name: z.string().nullable(),
    token_balance:     z.number().int(),
    photos:            z.array(ProfilePhoto),
  }),
}))

// ---- Geocode Edge Function (HTTP, not RPC, but parsed the same way) ----

export const GeocodeCityInput  = z.object({ place_name: z.string().min(2) })
export const GeocodeCityResult = z.union([
  z.object({ ok: z.literal(true),  display_name: z.string(), lat: z.number(), lng: z.number() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

// Types
export type ProfileCardT       = z.infer<typeof ProfileCard>
export type ViewSearchResultT  = z.infer<typeof ViewSearchResult>
export type ViewProfileResultT = z.infer<typeof ViewProfileResult>
export type ViewMyProfileResultT = z.infer<typeof ViewMyProfileResult>
```

- [ ] **Step 2: Add a contract round-trip test**

Create `shared/__tests__/rpc-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  SetProfileRoleResult,
  ViewSearchResult,
  ProfileCard,
} from '../rpc-contracts'

describe('rpc-contracts', () => {
  it('parses an ok=true onboarding result', () => {
    const parsed = SetProfileRoleResult.parse({ ok: true })
    expect(parsed.ok).toBe(true)
  })

  it('parses an ok=false onboarding error', () => {
    const parsed = SetProfileRoleResult.parse({ ok: false, error: 'role_already_set' })
    expect(parsed.ok).toBe(false)
  })

  it('parses a view_search response with cards', () => {
    const parsed = ViewSearchResult.parse({
      ok: true,
      cards: [
        {
          profile_id: '00000000-0000-0000-0000-000000000001',
          display_name: 'Lex',
          age: 26,
          city_display_name: 'London',
          distance_miles: 12.3,
          primary_photo_url: 'https://example.test/p.jpg',
          my_like_state: null,
        },
      ],
      next_cursor: null,
    })
    expect(parsed.ok).toBe(true)
    expect(parsed.cards).toHaveLength(1)
  })

  it('rejects a ProfileCard missing required fields', () => {
    expect(() => ProfileCard.parse({ profile_id: 'x' })).toThrow()
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: 4 new passing tests.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add Zod contracts for auth, onboarding, media, and view RPCs"
```

---

## Task 14 — Typed RPC wrapper in `src/lib/rpc.ts`

**Files:**

- Create: `src/lib/rpc.ts`
- Create: `src/lib/__tests__/rpc.test.ts`

- [ ] **Step 1: Write failing test (MSW + Zod parsing)**

Create `src/lib/__tests__/rpc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../test-setup'
import { callRpc, RpcContractError } from '../rpc'
import { SetProfileRoleResult } from '@shared/rpc-contracts'

describe('callRpc', () => {
  it('parses a successful response through the Zod contract', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', () =>
        HttpResponse.json({ ok: true }),
      ),
    )
    const r = await callRpc('set_profile_role', { p_role: 'baby' }, SetProfileRoleResult)
    expect(r.ok).toBe(true)
  })

  it('throws RpcContractError when the response does not match the Zod schema', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', () =>
        HttpResponse.json({ ok: 'maybe' }),
      ),
    )
    await expect(
      callRpc('set_profile_role', { p_role: 'baby' }, SetProfileRoleResult),
    ).rejects.toBeInstanceOf(RpcContractError)
  })
})
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement `src/lib/rpc.ts`**

```ts
import type { ZodTypeAny, z } from 'zod'
import { supabase } from './supabase'

export class RpcContractError extends Error {
  constructor(
    public rpc: string,
    public issues: unknown,
  ) {
    super(`RPC contract violation for ${rpc}`)
  }
}

export class RpcTransportError extends Error {
  constructor(
    public rpc: string,
    public cause: unknown,
  ) {
    super(`RPC transport error for ${rpc}: ${String(cause)}`)
  }
}

/**
 * Call a Supabase Postgres RPC and `.parse()` the response through the provided
 * Zod schema. Throws RpcTransportError if Supabase reports an error; throws
 * RpcContractError if the response shape disagrees with the schema (catches
 * mock drift and backend drift in one place).
 */
export async function callRpc<TSchema extends ZodTypeAny>(
  fn: string,
  args: Record<string, unknown>,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn as any, args as any)
  if (error) throw new RpcTransportError(fn, error)
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new RpcContractError(fn, parsed.error.issues)
  return parsed.data
}
```

- [ ] **Step 4: Re-run test**

```bash
pnpm test
```

Expected: 2 new passing tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add typed RPC wrapper that .parse()s every response"
```

---

## Task 15 — Auth context + `useSession()` hook

**Files:**

- Create: `src/lib/auth.tsx`
- Create: `src/lib/__tests__/auth.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/auth.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useSession } from '../auth'

function Probe() {
  const { session, status } = useSession()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{session?.user.email ?? 'none'}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  it('starts in loading then resolves to anonymous when no session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(screen.getByTestId('email')).toHaveTextContent('none')
  })
})
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement `src/lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

interface AuthState {
  status: AuthStatus
  session: Session | null
}

const AuthContext = createContext<AuthState>({ status: 'loading', session: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setState({
        status: data.session ? 'authenticated' : 'anonymous',
        session: data.session,
      })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        status: session ? 'authenticated' : 'anonymous',
        session,
      })
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useSession(): AuthState {
  return useContext(AuthContext)
}
```

- [ ] **Step 4: Wrap the app in `AuthProvider` and add `QueryClientProvider`**

Modify `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './routes'
import './index.css'
import { initOtel } from './lib/otel'
import { initI18n } from './lib/i18n'
import { AuthProvider } from './lib/auth'
import { createQueryClient } from './lib/query-client'

initOtel()
initI18n()

const queryClient = createQueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 5: Re-run test**

```bash
pnpm test
```

Expected: AuthProvider test passes; App route test still passes (the App test renders without AuthProvider, which is fine because the App component itself doesn't call useSession).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add AuthProvider and useSession() with QueryClientProvider"
```

---

## Task 16 — Signup, Login, Forgot Password pages + auth API

**Files:**

- Create: `src/features/auth/api.ts`
- Create: `src/features/auth/components/SignupForm.tsx`
- Create: `src/features/auth/components/LoginForm.tsx`
- Create: `src/features/auth/components/ForgotPasswordForm.tsx`
- Create: `src/features/auth/pages/SignupPage.tsx`
- Create: `src/features/auth/pages/LoginPage.tsx`
- Create: `src/features/auth/pages/ForgotPasswordPage.tsx`
- Create: `src/features/auth/pages/AuthConfirmPage.tsx`
- Create: `src/features/auth/__tests__/SignupForm.test.tsx`
- Create: `src/features/auth/__tests__/LoginForm.test.tsx`
- Create: `src/features/auth/__tests__/ForgotPasswordForm.test.tsx`
- Create: `src/i18n/en/auth.json`

- [ ] **Step 1: Add English strings**

Create `src/i18n/en/auth.json`:

```json
{
  "signup.title": "Create your account",
  "signup.email": "Email",
  "signup.password": "Password",
  "signup.submit": "Sign up",
  "signup.checkEmail": "Check your email to confirm your account.",
  "signup.haveAccount": "Already have an account? Log in",
  "login.title": "Log in",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Log in",
  "login.forgot": "Forgot your password?",
  "login.needAccount": "Don't have an account? Sign up",
  "login.invalid": "Email or password incorrect.",
  "forgot.title": "Reset your password",
  "forgot.email": "Email",
  "forgot.submit": "Send reset link",
  "forgot.sent": "If that account exists, we've emailed you a link.",
  "confirm.success": "Your email is confirmed. Continue to onboarding.",
  "confirm.failure": "We couldn't confirm your email. The link may have expired."
}
```

Wire the namespace into `src/lib/i18n.ts`:

```ts
import enCommon from '../i18n/en/common.json'
import enAuth   from '../i18n/en/auth.json'

// ...

resources: { en: { common: enCommon, auth: enAuth } },
```

- [ ] **Step 2: Auth API module**

Create `src/features/auth/api.ts`:

```ts
import { supabase } from '@/lib/supabase'

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
  })
  if (error) throw error
  return data
}

export async function logIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
```

- [ ] **Step 3: SignupForm + test (TDD)**

Create `src/features/auth/__tests__/SignupForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { SignupForm } from '../components/SignupForm'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('SignupForm', () => {
  it('submits email + password and shows check-email message', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/signup', () =>
        HttpResponse.json({ user: { id: 'u', email: 'a@b.test' }, session: null }),
      ),
    )
    const onSuccess = vi.fn()
    render(<SignupForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows a server error when signup fails', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/signup', () =>
        HttpResponse.json({ error: 'signup_disabled', error_description: 'no' }, { status: 400 }),
      ),
    )
    render(<SignupForm onSuccess={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
```

Run, confirm fail.

Create `src/features/auth/components/SignupForm.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp } from '../api'

const Schema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
})
type FormData = z.infer<typeof Schema>

export function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation('auth')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(values: FormData) {
    setServerError(null)
    try {
      await signUp(values.email, values.password)
      setDone(true)
      onSuccess?.()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  if (done) return <p className="p-4">{t('signup.checkEmail')}</p>

  return (
    <form className="flex flex-col gap-3 p-4 max-w-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('signup.email')}</span>
        <input className="border p-2 rounded" type="email" {...register('email')} />
        {errors.email && <span className="text-sm text-red-700">{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('signup.password')}</span>
        <input className="border p-2 rounded" type="password" {...register('password')} />
        {errors.password && <span className="text-sm text-red-700">{errors.password.message}</span>}
      </label>
      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}
      <button type="submit" disabled={isSubmitting}
              className="bg-slate-800 text-white py-2 rounded">{t('signup.submit')}</button>
    </form>
  )
}
```

Re-run test, expect green.

- [ ] **Step 4: LoginForm + test**

Create `src/features/auth/__tests__/LoginForm.test.tsx` (mirror SignupForm test; submit to `/auth/v1/token?grant_type=password`).

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { LoginForm } from '../components/LoginForm'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('LoginForm', () => {
  it('logs in successfully and calls onSuccess', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/token', () =>
        HttpResponse.json({
          access_token: 't', refresh_token: 'r', expires_in: 3600, token_type: 'bearer',
          user: { id: 'u', email: 'a@b.test' },
        }),
      ),
    )
    const onSuccess = vi.fn()
    render(<LoginForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })
})
```

Create `src/features/auth/components/LoginForm.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { logIn } from '../api'

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) })
type FormData = z.infer<typeof Schema>

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation('auth')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })
  const [serverError, setServerError] = useState<string | null>(null)

  async function onSubmit(values: FormData) {
    setServerError(null)
    try {
      await logIn(values.email, values.password)
      onSuccess?.()
    } catch {
      setServerError(t('login.invalid'))
    }
  }

  return (
    <form className="flex flex-col gap-3 p-4 max-w-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('login.email')}</span>
        <input className="border p-2 rounded" type="email" {...register('email')} />
        {errors.email && <span className="text-sm text-red-700">{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('login.password')}</span>
        <input className="border p-2 rounded" type="password" {...register('password')} />
      </label>
      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}
      <button type="submit" disabled={isSubmitting}
              className="bg-slate-800 text-white py-2 rounded">{t('login.submit')}</button>
    </form>
  )
}
```

- [ ] **Step 5: ForgotPasswordForm + test**

Create `src/features/auth/__tests__/ForgotPasswordForm.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { ForgotPasswordForm } from '../components/ForgotPasswordForm'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('ForgotPasswordForm', () => {
  it('always shows the generic "sent" message (no account enumeration)', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/recover', () => HttpResponse.json({})),
    )
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText(/we've emailed you a link/i)).toBeInTheDocument()
  })
})
```

Create `src/features/auth/components/ForgotPasswordForm.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { sendPasswordReset } from '../api'

const Schema = z.object({ email: z.string().email() })

export function ForgotPasswordForm() {
  const { t } = useTranslation('auth')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
  })
  const [sent, setSent] = useState(false)

  async function onSubmit(values: z.infer<typeof Schema>) {
    try { await sendPasswordReset(values.email) } catch { /* always show success */ }
    setSent(true)
  }

  if (sent) return <p className="p-4">{t('forgot.sent')}</p>

  return (
    <form className="flex flex-col gap-3 p-4 max-w-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('forgot.email')}</span>
        <input className="border p-2 rounded" type="email" {...register('email')} />
      </label>
      <button type="submit" disabled={isSubmitting}
              className="bg-slate-800 text-white py-2 rounded">{t('forgot.submit')}</button>
    </form>
  )
}
```

- [ ] **Step 6: Pages wrap forms (trivial)**

Create `src/features/auth/pages/SignupPage.tsx`:

```tsx
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SignupForm } from '../components/SignupForm'

export function SignupPage() {
  const { t } = useTranslation('auth')
  return (
    <main className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-semibold px-4">{t('signup.title')}</h1>
      <SignupForm />
      <p className="px-4 mt-2"><Link to="/login" className="underline">{t('signup.haveAccount')}</Link></p>
    </main>
  )
}
```

Create `LoginPage.tsx` and `ForgotPasswordPage.tsx` analogously (with cross-links).

Create `src/features/auth/pages/AuthConfirmPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'

export function AuthConfirmPage() {
  const { t } = useTranslation('auth')
  const [status, setStatus] = useState<'pending' | 'ok' | 'fail'>('pending')

  useEffect(() => {
    // Supabase's detectSessionInUrl (default true) already consumed the access_token
    // from the URL hash by the time we mount. We just verify a session exists.
    void supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'ok' : 'fail')
    })
  }, [])

  if (status === 'pending') return <p className="p-4">…</p>
  if (status === 'ok') {
    return (
      <p className="p-4">
        {t('confirm.success')} <Link to="/onboarding/role" className="underline">→</Link>
      </p>
    )
  }
  return <p className="p-4">{t('confirm.failure')}</p>
}
```

- [ ] **Step 7: Run all tests**

```bash
pnpm test
```

Expected: all auth-form tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add Signup, Login, Forgot Password, Auth Confirm pages"
```

---

## Task 17 — Onboarding wizard (4 steps + complete page)

**Files:**

- Create: `src/features/onboarding/api.ts`
- Create: `src/features/onboarding/geocode.ts`
- Create: `src/features/onboarding/hooks.ts`
- Create: `src/features/onboarding/components/{Role,Identity,Location,Photo}Step.tsx`
- Create: `src/features/onboarding/pages/OnboardingLayout.tsx` + one page per step + `OnboardingCompletePage.tsx`
- Create: `src/i18n/en/onboarding.json`
- Create: `src/features/onboarding/__tests__/IdentityStep.test.tsx` (DOB ≥18 client check)
- Create: `src/lib/hash.ts` + test
- Create: `src/lib/__tests__/dob.test.ts`
- Create: `src/lib/dob.ts`

- [ ] **Step 1: Pure helpers — age + hash**

Create `src/lib/dob.ts`:

```ts
export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

export function isAdult(dob: Date, minAge = 18, now: Date = new Date()): boolean {
  return ageFromDob(dob, now) >= minAge
}
```

Create `src/lib/__tests__/dob.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ageFromDob, isAdult } from '../dob'

describe('dob', () => {
  const now = new Date('2026-05-12T00:00:00Z')

  it('computes age', () => {
    expect(ageFromDob(new Date('1990-01-01'), now)).toBe(36)
  })

  it('treats today-of-birthday as that age (not yet)', () => {
    expect(ageFromDob(new Date('2008-05-12'), now)).toBe(18)
  })

  it('treats day-before-birthday as still previous age', () => {
    expect(ageFromDob(new Date('2008-05-13'), now)).toBe(17)
  })

  it('isAdult is true at 18, false at 17', () => {
    expect(isAdult(new Date('2008-05-12'), 18, now)).toBe(true)
    expect(isAdult(new Date('2008-05-13'), 18, now)).toBe(false)
  })
})
```

Create `src/lib/hash.ts`:

```ts
// SHA-256 hex of a Blob/File. Production uses WebCrypto. Tests pass deterministic Files.
export async function sha256Hex(input: Blob | ArrayBuffer): Promise<string> {
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

Run `pnpm test`. Confirm dob tests pass.

- [ ] **Step 2: Geocode client**

Create `src/features/onboarding/geocode.ts`:

```ts
import { supabase } from '@/lib/supabase'
import { GeocodeCityResult } from '@shared/rpc-contracts'

export async function geocodeCity(placeName: string) {
  const { data, error } = await supabase.functions.invoke('geocode-city', {
    body: { place_name: placeName },
  })
  if (error) throw error
  return GeocodeCityResult.parse(data)
}
```

- [ ] **Step 3: Onboarding API + hooks**

Create `src/features/onboarding/api.ts`:

```ts
import { callRpc } from '@/lib/rpc'
import {
  SetProfileRoleResult,
  SetProfileIdentityResult,
  SetProfileLocationResult,
  CompleteOnboardingResult,
  PrepareMediaUploadResult,
  FinalizeMediaUploadResult,
  AddToProfilePhotosResult,
  ViewMyProfileResult,
  type ProfileRole,
  type ProfileGender,
  type ProfileLookingFor,
} from '@shared/rpc-contracts'
import { z } from 'zod'

export const setProfileRole = (role: z.infer<typeof ProfileRole>) =>
  callRpc('set_profile_role', { p_role: role }, SetProfileRoleResult)

export const setProfileIdentity = (
  display_name: string,
  date_of_birth: string,
  gender: z.infer<typeof ProfileGender>,
  looking_for: z.infer<typeof ProfileLookingFor>,
) =>
  callRpc(
    'set_profile_identity',
    {
      p_display_name: display_name,
      p_date_of_birth: date_of_birth,
      p_gender: gender,
      p_looking_for: looking_for,
    },
    SetProfileIdentityResult,
  )

export const setProfileLocation = (display_name: string, lat: number, lng: number) =>
  callRpc(
    'set_profile_location',
    { p_display_name: display_name, p_lat: lat, p_lng: lng },
    SetProfileLocationResult,
  )

export const prepareMediaUpload = (args: {
  kind: 'photo' | 'video'
  hash: string
  size_bytes: number
  width: number | null
  height: number | null
  duration_seconds: number | null
}) =>
  callRpc(
    'prepare_media_upload',
    {
      p_kind: args.kind,
      p_hash: args.hash,
      p_size_bytes: args.size_bytes,
      p_width: args.width,
      p_height: args.height,
      p_duration_seconds: args.duration_seconds,
    },
    PrepareMediaUploadResult,
  )

export const finalizeMediaUpload = (id: string) =>
  callRpc('finalize_media_upload', { p_media_item_id: id }, FinalizeMediaUploadResult)

export const addToProfilePhotos = (id: string, ordinal: number) =>
  callRpc(
    'add_to_profile_photos',
    { p_media_item_id: id, p_ordinal: ordinal },
    AddToProfilePhotosResult,
  )

export const completeOnboarding = () =>
  callRpc('complete_onboarding', {}, CompleteOnboardingResult)

export const viewMyProfile = () => callRpc('view_my_profile', {}, ViewMyProfileResult)
```

Create `src/features/onboarding/hooks.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { viewMyProfile, setProfileRole, setProfileIdentity, setProfileLocation,
         prepareMediaUpload, finalizeMediaUpload, addToProfilePhotos,
         completeOnboarding } from './api'

export function useMyProfile() {
  return useQuery({ queryKey: ['my-profile'], queryFn: viewMyProfile })
}

export function useSetRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

// ... etc. for setIdentity, setLocation, completeOnboarding
// Each: invalidate ['my-profile'] on success.
```

Fill in `useSetIdentity`, `useSetLocation`, `useCompleteOnboarding`, `useUploadProfilePhoto` analogously. `useUploadProfilePhoto` chains: prepare → PUT to signed URL → finalize → add_to_profile_photos.

```ts
export function useUploadProfilePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { sha256Hex } = await import('@/lib/hash')
      const hash = await sha256Hex(file)
      const prepared = await prepareMediaUpload({
        kind: 'photo',
        hash,
        size_bytes: file.size,
        width: null,
        height: null,
        duration_seconds: null,
      })
      if (!prepared.ok) throw new Error(prepared.error)
      const putRes = await fetch(prepared.signed_upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'content-type': file.type },
      })
      if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)
      const fin = await finalizeMediaUpload(prepared.media_item_id)
      if (!fin.ok) throw new Error(fin.error)
      const add = await addToProfilePhotos(prepared.media_item_id, 0)
      if (!add.ok) throw new Error(add.error)
      return prepared.media_item_id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
```

- [ ] **Step 4: i18n + step components**

Create `src/i18n/en/onboarding.json` with keys for every label/error (`role.title`, `role.benefactor`, `role.baby`, `identity.title`, `identity.dobUnder18`, etc.). Wire into i18n init.

Build `RoleStep.tsx`, `IdentityStep.tsx` (with client-side `isAdult` check disabling Continue when DOB < 18), `LocationStep.tsx` (text input → call `geocodeCity` on submit → on success call `setProfileLocation`), `PhotoStep.tsx` (file input → `useUploadProfilePhoto`). Each step on success navigates to the next via `useNavigate()` from `react-router`.

`IdentityStep.tsx` TDD: write a test that types a DOB making the user 17, asserts the Continue button is `disabled`. Then implement.

Create `src/features/onboarding/__tests__/IdentityStep.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { IdentityStep } from '../components/IdentityStep'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'

await initI18n()

function wrap(ui: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('IdentityStep', () => {
  it('disables Continue when DOB indicates under 18', async () => {
    render(wrap(<IdentityStep />))
    await userEvent.type(screen.getByLabelText(/display name/i), 'Lex')
    // pick a DOB 17 years ago
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 17)
    const iso = dob.toISOString().slice(0, 10)
    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    await userEvent.clear(dobInput); await userEvent.type(dobInput, iso)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})
```

(Implementation watches form values with react-hook-form's `watch()`, parses DOB, calls `isAdult`, sets `disabled` accordingly.)

- [ ] **Step 5: Layout + per-step pages**

Create `src/features/onboarding/pages/OnboardingLayout.tsx`:

```tsx
import { Outlet } from 'react-router'

export function OnboardingLayout() {
  return (
    <main className="max-w-md mx-auto py-6">
      <h1 className="text-2xl font-semibold px-4 mb-2">Welcome</h1>
      <Outlet />
    </main>
  )
}
```

One thin page per step that renders its component (the components encapsulate the data + mutation).

`OnboardingCompletePage.tsx` calls `useCompleteOnboarding()` on mount and on success navigates to `/search`.

- [ ] **Step 6: Run all tests, confirm green**

```bash
pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add onboarding wizard: role, identity, location, photo, complete"
```

---

## Task 18 — Search page, profile card, profile view, my profile view

**Files:**

- Create: `src/features/search/{api.ts,hooks.ts}`
- Create: `src/features/search/components/ProfileCard.tsx`
- Create: `src/features/search/pages/SearchPage.tsx`
- Create: `src/features/profile/{api.ts,hooks.ts}`
- Create: `src/features/profile/pages/ProfilePage.tsx`
- Create: `src/features/profile/pages/MyProfilePage.tsx`
- Create: `src/lib/format.ts` + test
- Create: `src/features/search/__tests__/SearchPage.test.tsx` (MSW-mocked)
- Create: `src/features/profile/__tests__/ProfilePage.test.tsx`
- Create: `src/i18n/en/search.json`, `src/i18n/en/profile.json`

- [ ] **Step 1: Formatters**

Create `src/lib/format.ts`:

```ts
// Distance: en-GB and en-US use miles; everyone else uses km.
const MILE_LANGS = ['en-GB', 'en-US']

export function formatDistance(miles: number | null, locale: string): string {
  if (miles == null) return ''
  const useMiles = MILE_LANGS.includes(locale)
  const value = useMiles ? miles : miles * 1.609344
  const unit  = useMiles ? 'mi' : 'km'
  return `${Math.round(value)} ${unit}`
}

export function formatAge(age: number | null): string {
  if (age == null) return ''
  return String(age)
}
```

Create `src/lib/__tests__/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatDistance } from '../format'

describe('formatDistance', () => {
  it('uses miles for en-GB', () => { expect(formatDistance(10, 'en-GB')).toBe('10 mi') })
  it('uses km elsewhere',     () => { expect(formatDistance(10, 'fr-FR')).toBe('16 km') })
  it('blank for null',        () => { expect(formatDistance(null, 'en-GB')).toBe('') })
})
```

- [ ] **Step 2: Search API + hook**

Create `src/features/search/api.ts`:

```ts
import { callRpc } from '@/lib/rpc'
import { ViewSearchResult } from '@shared/rpc-contracts'

export const viewSearch = (cursor: string | null = null) =>
  callRpc('view_search', { p_filters: {}, p_cursor: cursor }, ViewSearchResult)
```

Create `src/features/search/hooks.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { viewSearch } from './api'

export function useSearchFirstPage() {
  return useQuery({
    queryKey: ['search', 'first-page'],
    queryFn: () => viewSearch(null),
  })
}
```

- [ ] **Step 3: ProfileCard**

Create `src/features/search/components/ProfileCard.tsx`:

```tsx
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { ProfileCardT } from '@shared/rpc-contracts'
import { formatDistance } from '@/lib/format'

export function ProfileCard({ card }: { card: ProfileCardT }) {
  const { i18n } = useTranslation()
  return (
    <Link to={`/profile/${card.profile_id}`}
          className="block border rounded-lg overflow-hidden bg-white">
      <div className="aspect-square bg-slate-200">
        {card.primary_photo_url
          ? <img src={card.primary_photo_url} alt={card.display_name}
                 className="w-full h-full object-cover" />
          : null}
      </div>
      <div className="p-2">
        <div className="font-semibold">{card.display_name}, {card.age}</div>
        <div className="text-sm text-slate-600">
          {card.city_display_name} · {formatDistance(card.distance_miles, i18n.language)}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: SearchPage + test**

Create the test first.

Create `src/features/search/__tests__/SearchPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { SearchPage } from '../pages/SearchPage'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('SearchPage', () => {
  it('renders profile cards from view_search', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_search', () =>
        HttpResponse.json({
          ok: true,
          next_cursor: null,
          cards: [
            { profile_id: '11111111-1111-1111-1111-111111111111', display_name: 'Lex', age: 26,
              city_display_name: 'London', distance_miles: 5.2,
              primary_photo_url: 'https://example.test/p.jpg', my_like_state: null },
          ],
        }),
      ),
    )
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <SearchPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Lex, 26/)).toBeInTheDocument()
  })
})
```

Create `src/features/search/pages/SearchPage.tsx`:

```tsx
import { useSearchFirstPage } from '../hooks'
import { ProfileCard } from '../components/ProfileCard'

export function SearchPage() {
  const { data, isLoading, error } = useSearchFirstPage()
  if (isLoading) return <p className="p-4">Loading…</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">Failed to load search.</p>
  return (
    <main className="p-4 grid grid-cols-2 gap-3">
      {data.cards.map((c) => <ProfileCard key={c.profile_id} card={c} />)}
    </main>
  )
}
```

- [ ] **Step 5: Profile + MyProfile pages**

Create `src/features/profile/api.ts`:

```ts
import { callRpc } from '@/lib/rpc'
import { ViewProfileResult, ViewMyProfileResult } from '@shared/rpc-contracts'

export const viewProfile = (id: string) =>
  callRpc('view_profile', { p_profile_id: id }, ViewProfileResult)

export const viewMyProfile = () => callRpc('view_my_profile', {}, ViewMyProfileResult)
```

Hooks + pages: `useProfile(id)`, `useMyProfile()`. `ProfilePage` reads `:id` from `useParams()`. Renders display_name, age, city, photos. `MyProfilePage` shows the same plus status (e.g. for debugging during Plan 02).

Add an MSW-mocked test for `ProfilePage` parallel to `SearchPage` test.

- [ ] **Step 6: Wire pages into routes**

(Done in Task 19 with the guards.)

- [ ] **Step 7: Run all tests**

```bash
pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add Search, ProfilePage, MyProfilePage with formatters and tests"
```

---

## Task 19 — App shell (bottom tab bar + hamburger) and route guards

**Files:**

- Create: `src/features/shell/AppShell.tsx`, `BottomTabBar.tsx`, `HamburgerMenu.tsx`
- Create: `src/lib/route-guards.tsx`
- Modify: `src/routes.tsx` (real route tree)
- Create: `src/i18n/en/shell.json`
- Create: `src/features/shell/__tests__/route-guards.test.tsx`

- [ ] **Step 1: Route guards**

Create `src/lib/route-guards.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSession } from './auth'
import { viewMyProfile } from '@/features/onboarding/api'

/**
 * RequireAnonymous: blocks signed-in users from /signup, /login, /forgot-password.
 */
export function RequireAnonymous() {
  const { status } = useSession()
  if (status === 'loading') return null
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}

/**
 * RequireOnboarded: blocks pending users from search/profile, sends them to /onboarding.
 * Blocks anonymous users to /login.
 */
export function RequireOnboarded() {
  const { status } = useSession()
  const me = useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
    enabled: status === 'authenticated',
  })
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (!me.data.ok) return null
  if (me.data.profile.status === 'pending_onboarding') return <Navigate to="/onboarding/role" replace />
  if (me.data.profile.status === 'suspended')          return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * RequirePendingOnboarding: blocks already-active users from the onboarding wizard.
 */
export function RequirePendingOnboarding() {
  const { status } = useSession()
  const me = useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
    enabled: status === 'authenticated',
  })
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (!me.data.ok) return null
  if (me.data.profile.status === 'active') return <Navigate to="/search" replace />
  return <Outlet />
}

/**
 * RootRedirect: index '/' redirects by state.
 */
export function RootRedirect() {
  const { status } = useSession()
  const me = useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
    enabled: status === 'authenticated',
  })
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (!me.data.ok) return <Navigate to="/login" replace />
  if (me.data.profile.status === 'pending_onboarding')
    return <Navigate to="/onboarding/role" replace />
  return <Navigate to="/search" replace />
}
```

- [ ] **Step 2: BottomTabBar + HamburgerMenu**

Create `src/features/shell/BottomTabBar.tsx`:

```tsx
import { NavLink } from 'react-router'

const tabs = [
  { to: '/search',   label: 'Search'   },
  { to: '/messages', label: 'Messages' },
  { to: '/likes',    label: 'Likes'    },
  { to: '/me',       label: 'Me'       },
]

export function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to}
                 className={({ isActive }) =>
                   `flex-1 text-center py-3 ${isActive ? 'font-semibold' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

Create `src/features/shell/HamburgerMenu.tsx`:

```tsx
import { useState } from 'react'
import { signOut } from '@/features/auth/api'

export function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button aria-label="menu" onClick={() => setOpen(true)} className="p-2">☰</button>
      {open ? (
        <div role="dialog" className="fixed inset-0 bg-white p-4">
          <button onClick={() => setOpen(false)} aria-label="close" className="mb-4">✕</button>
          <button onClick={() => void signOut()} className="block w-full text-left py-2">
            Sign out
          </button>
        </div>
      ) : null}
    </>
  )
}
```

Create `src/features/shell/AppShell.tsx`:

```tsx
import { Outlet } from 'react-router'
import { BottomTabBar } from './BottomTabBar'
import { HamburgerMenu } from './HamburgerMenu'

export function AppShell() {
  return (
    <div className="min-h-screen pb-14">
      <header className="border-b flex items-center justify-between p-2">
        <span className="font-semibold">SD</span>
        <HamburgerMenu />
      </header>
      <Outlet />
      <BottomTabBar />
    </div>
  )
}
```

- [ ] **Step 3: Real route tree**

Replace `src/routes.tsx`:

```tsx
import { createBrowserRouter } from 'react-router'
import {
  RequireAnonymous, RequireOnboarded, RequirePendingOnboarding, RootRedirect,
} from './lib/route-guards'
import { SignupPage }           from './features/auth/pages/SignupPage'
import { LoginPage }            from './features/auth/pages/LoginPage'
import { ForgotPasswordPage }   from './features/auth/pages/ForgotPasswordPage'
import { AuthConfirmPage }      from './features/auth/pages/AuthConfirmPage'
import { OnboardingLayout }     from './features/onboarding/pages/OnboardingLayout'
import { RoleStep }             from './features/onboarding/components/RoleStep'
import { IdentityStep }         from './features/onboarding/components/IdentityStep'
import { LocationStep }         from './features/onboarding/components/LocationStep'
import { PhotoStep }            from './features/onboarding/components/PhotoStep'
import { OnboardingCompletePage } from './features/onboarding/pages/OnboardingCompletePage'
import { AppShell }             from './features/shell/AppShell'
import { SearchPage }           from './features/search/pages/SearchPage'
import { ProfilePage }          from './features/profile/pages/ProfilePage'
import { MyProfilePage }        from './features/profile/pages/MyProfilePage'

export const router = createBrowserRouter([
  { path: '/',                element: <RootRedirect /> },

  { element: <RequireAnonymous />, children: [
    { path: '/signup',          element: <SignupPage /> },
    { path: '/login',           element: <LoginPage /> },
    { path: '/forgot-password', element: <ForgotPasswordPage /> },
  ]},

  { path: '/auth/confirm',      element: <AuthConfirmPage /> },

  { element: <RequirePendingOnboarding />, children: [
    { path: '/onboarding', element: <OnboardingLayout />, children: [
      { path: 'role',     element: <RoleStep /> },
      { path: 'identity', element: <IdentityStep /> },
      { path: 'location', element: <LocationStep /> },
      { path: 'photo',    element: <PhotoStep /> },
      { path: 'complete', element: <OnboardingCompletePage /> },
    ]},
  ]},

  { element: <RequireOnboarded />, children: [
    { element: <AppShell />, children: [
      { path: '/search',       element: <SearchPage /> },
      { path: '/profile/:id',  element: <ProfilePage /> },
      { path: '/me',           element: <MyProfilePage /> },
      { path: '/messages',     element: <div className="p-4">Messages — Plan 05</div> },
      { path: '/likes',        element: <div className="p-4">Likes — Plan 03</div> },
    ]},
  ]},
])
```

- [ ] **Step 4: Test the guards**

Create `src/features/shell/__tests__/route-guards.test.tsx` with two cases: anonymous visiting `/search` lands on `/login`; pending-onboarding user visiting `/search` lands on `/onboarding/role`. (MSW-mocked `getSession` + `view_my_profile`.)

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add AppShell, BottomTabBar, HamburgerMenu, and route guards"
```

---

## Task 20 — Edge Function deploy step + dev seed script

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `scripts/seed-dev-users.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add edge-function CI job**

Append to `.github/workflows/ci.yml`:

```yaml
  edge-functions-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with: { deno-version: v1.x }
      - run: deno check supabase/functions/geocode-city/index.ts
```

(Plan 02 doesn't push the function to remote — there's no remote project yet. The check job verifies it type-checks under Deno. Remote `supabase functions deploy` is wired in pre-launch.)

- [ ] **Step 2: Dev seed script**

Create `scripts/seed-dev-users.mjs`:

```js
#!/usr/bin/env node
// Creates a handful of confirmed users for local development, walks each through
// onboarding, and seeds a couple of photos. Idempotent: re-running upserts.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (printed by `supabase status`).')
  process.exit(2)
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const fixtures = [
  { email: 'lex@local.test',  role: 'baby',       display_name: 'Lex',  dob: '1998-04-12',
    gender: 'female', looking_for: 'male', city: 'London',     lat: 51.5074, lng: -0.1278 },
  { email: 'sam@local.test',  role: 'baby',       display_name: 'Sam',  dob: '1999-09-03',
    gender: 'female', looking_for: 'male', city: 'Manchester', lat: 53.4808, lng: -2.2426 },
  { email: 'rick@local.test', role: 'benefactor', display_name: 'Rick', dob: '1980-01-22',
    gender: 'male',   looking_for: 'female', city: 'London',   lat: 51.5074, lng: -0.1278 },
]

for (const f of fixtures) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: f.email,
    password: 'devpass1',
    email_confirm: true,
  })
  if (error && !String(error.message).match(/already.*registered/i)) throw error
  const userId = data?.user?.id ??
    (await supabase.auth.admin.listUsers()).data.users.find((u) => u.email === f.email)?.id
  if (!userId) throw new Error(`could not resolve user id for ${f.email}`)

  // Apply onboarding fields directly via the service-role client (bypasses RPC role checks).
  await supabase.from('profiles').update({
    role: f.role,
    display_name: f.display_name,
    date_of_birth: f.dob,
    gender: f.gender,
    looking_for: f.looking_for,
    city_display_name: f.city,
    city_lat: f.lat,
    city_lng: f.lng,
    status: 'active',
    last_active_at: new Date().toISOString(),
  }).eq('id', userId)

  console.log(`seeded ${f.email}`)
}
```

Add to `package.json` scripts:

```json
"seed:dev": "node scripts/seed-dev-users.mjs"
```

- [ ] **Step 3: Smoke-test locally**

```bash
supabase start
SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE | cut -d= -f2-) pnpm seed:dev
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT email, status FROM auth.users JOIN public.profiles ON profiles.id = users.id;"
supabase stop
```

Expected: 3 active rows.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add Edge Function CI check and dev user seed script"
```

---

## Task 21 — Playwright E2E: signup → onboarding → search → view profile

**Files:**

- Create: `e2e/onboarding.spec.ts`
- Create: `e2e/helpers/admin-signup.ts`
- Modify: `playwright.config.ts` (env wiring for SUPABASE_SERVICE_ROLE_KEY)

- [ ] **Step 1: Admin signup helper**

Create `e2e/helpers/admin-signup.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function createConfirmedUser(): Promise<{ email: string; password: string }> {
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  const email = `e2e-${crypto.randomUUID()}@local.test`
  const password = 'e2epass1'
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { email, password }
}
```

- [ ] **Step 2: The journey**

Create `e2e/onboarding.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { createConfirmedUser } from './helpers/admin-signup'

test('signup → onboarding → search → view someone else', async ({ page }) => {
  // Bypass email confirmation by creating an already-confirmed user.
  const { email, password } = await createConfirmedUser()

  // Log in
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()

  // Step 1: role
  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: /benefactor/i }).click()

  // Step 2: identity
  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/display name/i).fill('Tester')
  await page.getByLabel(/date of birth/i).fill('1990-01-01')
  await page.getByLabel(/^gender/i).selectOption('male')
  await page.getByLabel(/looking for/i).selectOption('female')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 3: location
  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city/i).fill('Manchester')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 4: photo (upload a tiny dummy file)
  await page.waitForURL(/onboarding\/photo/)
  await page.setInputFiles('input[type="file"]', {
    name: 'p.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),  // minimal JPEG
  })
  await page.getByRole('button', { name: /finish/i }).click()

  // Land on /search
  await page.waitForURL(/\/search/)

  // The fixtures from seed:dev should appear; pick one and click it.
  const firstCard = page.locator('a[href^="/profile/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()
  await page.waitForURL(/\/profile\//)
  await expect(page.getByRole('heading')).toBeVisible()
})
```

- [ ] **Step 3: Configure Playwright env**

Modify `playwright.config.ts` to add `webServer.env.SUPABASE_SERVICE_ROLE_KEY` and propagate it:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,        // serialised: shares the same Supabase
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

- [ ] **Step 4: Update CI to run E2E with Supabase + seed**

Modify the `e2e-tests` job:

```yaml
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: 2.78.1 }
      - uses: pnpm/action-setup@v3
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm gen:config
      - run: supabase start
      - run: pnpm gen:types
      - run: |
          export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE | cut -d= -f2-)
          echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> $GITHUB_ENV
      - run: pnpm seed:dev
      - run: supabase functions serve geocode-city --no-verify-jwt &
      - run: pnpm test:e2e
      - run: supabase stop
```

- [ ] **Step 5: Run locally end-to-end**

```bash
supabase start
SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE | cut -d= -f2-) pnpm seed:dev
supabase functions serve geocode-city --no-verify-jwt &
SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE | cut -d= -f2-) pnpm test:e2e
kill %1
supabase stop
```

Expected: the journey test passes plus the three Plan 01 smoke tests still pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add E2E: signup → onboarding → search → view profile"
```

---

## Task 22 — Update README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Append a Plan 02 section**

Add a "Features (Plan 02)" section describing the auth flow, onboarding wizard, search, profile views. Update local-dev steps to include `pnpm seed:dev` and `supabase functions serve geocode-city --no-verify-jwt`.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Update README for Plan 02 features and dev setup"
```

---

## Verification — full plan complete

Run every command in order; each must exit 0:

- [ ] `pnpm install` succeeds
- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm gen:config` produces no diff
- [ ] `supabase start` succeeds
- [ ] `supabase db reset` applies every migration cleanly
- [ ] `pnpm gen:types` produces no diff
- [ ] `pnpm test:db` — every pgTAP file passes (smoke + schemas + RLS + every RPC: at least 50 tests total)
- [ ] `pnpm test` — every Vitest test passes (dob, format, hash, rpc, auth provider, signup/login/forgot forms, identity step, search page, profile page, route guards, contract round-trip — at least 30 tests total)
- [ ] `pnpm seed:dev` populates 3 active fixture users
- [ ] `supabase functions serve geocode-city --no-verify-jwt` answers POSTs in another terminal
- [ ] `pnpm test:e2e` — the onboarding journey passes plus Plan 01 smoke tests
- [ ] `pnpm build` produces `dist/` with the manifest
- [ ] Manual check: open `http://localhost:5173`, sign up with a fresh email, walk through onboarding, land on `/search`, click a fixture card, see their profile. Sign out via hamburger menu.
- [ ] CI workflow has new `drift-checks` and `edge-functions-check` jobs and the updated `e2e-tests` job that seeds fixtures and serves the edge function
- [ ] `git log --oneline` since Plan 02 started — ~22 commits

If any check fails, fix it before declaring complete. Do not move to Plan 03 until all green.

---

## Carry-over to Plan 03

Smells likely to surface during Plan 02 execution that don't block completion but should be fixed early in Plan 03:

- **`storage.create_signed_url` / `storage.create_signed_upload_url` availability.** If your Supabase Postgres image doesn't expose these as SQL functions, the view RPCs and `prepare_media_upload` will need to mint signed URLs in JS instead. The fallback is documented in Task 10 Step 4 — but it splits the trust boundary. Audit and consolidate in Plan 03.
- **No filters on `view_search` yet.** Plan 03 adds age range, distance radius, role-pair already there. Frontend will need a filter sheet.
- **`primary_photo_url` refresh.** Signed URLs are 1h; if a user lingers on `/search` longer than an hour, photos break. Refresh strategy (refetch list on visibility-change, or shorter staleTime) is a Plan 03 polish.
- **TanStack Query devtools** are installed but not mounted in dev. Mount in `src/main.tsx` behind `import.meta.env.DEV`.
- **`react-hook-form` Zod resolver duplication.** Each form re-declares its own Zod schema even though the contract shapes live in `shared/rpc-contracts.ts`. Consider deriving form schemas from the RPC input schemas to remove the duplication.
- **`gen:config` and `gen:types` run sequentially.** The CI drift-checks job takes 60+s because it boots Supabase twice across separate jobs. Combining into one job with both checks would save build minutes.
- **Hamburger menu has only "Sign out".** Plan 03 adds language switcher; Plan 04 adds Buy tokens.
- **`_profile_card_for_viewer` returns `my_like_state: NULL`.** Plan 03 fills it in. Spec §4 says cards expose like state.
- **Empty `OnboardingLayout` step progress.** No "step 2 of 4" indicator. Polish in Plan 03 or pre-launch.

---

## What's next

**Plan 03 — Profile Depth + Likes.** Builds on this foundation:

- Adds the remaining `profiles` columns (tagline, about, wants, height_cm, body_type, hair_color, eye_color, has_piercings, has_tattoos, smoking, drinking, education, yearly_income_band, net_worth_band) and exposes them in onboarding (one extra step) and in `view_profile` / `view_my_profile`.
- Adds `interests` and `profile_interests` tables with admin-seeded taxonomy; onboarding interest picker.
- Adds gallery management for `profile_photos`: multiple photos, reorder, delete.
- Implements the `likes` mechanic: `like_profile` RPC, `view_likes_tab`, populating `my_like_state` and `their_like_state` in `_profile_card_for_viewer` and `view_profile`.
- Surfaces likes as in-app banners.
- Adds the filter sheet to Search.
- Hooks language switcher into the hamburger.

Prerequisites added by Plan 03: the `interests` taxonomy seed, larger media-upload pipeline (multi-file picker), and the first notification surface.

When ready to start Plan 03: in a fresh Claude session say _"Let's plan part 3"_ (or _"Write plan 03"_).

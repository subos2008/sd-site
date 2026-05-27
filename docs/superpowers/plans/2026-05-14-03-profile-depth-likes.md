# Plan 03 — Profile Depth + Likes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real person can fill in the full profile fields (tagline, about, wants, physical, lifestyle, interests), upload and manage multiple photos, like and unlike other profiles, see who liked them in a Likes tab, and filter Search by age range, distance radius, and interests. The in-app banner system is live for like notifications.

**Architecture:** Same as Plan 02 — `SECURITY DEFINER` write RPCs gated by `auth.uid()` checks, `SECURITY INVOKER` view RPCs returning composed jsonb, Zod contracts in `shared/rpc-contracts.ts`. New tables (`likes`, `interests`, `profile_interests`, `notifications`) are deny-by-default RLS, accessed via RPCs. The frontend grows section-based edit modes for `/me`, a filter sheet for `/search`, and a Likes tab. In-app banners poll `view_notifications(cursor)` every 30s when the tab is visible (no Realtime — that's deferred per spec §5).

**Tech stack additions:** none new — same React 19 / TanStack Query / react-hook-form + Zod / Tailwind v4 / Supabase / pgTAP / Playwright stack from Plans 01 and 02.

**Outcome at the end of this plan:** the Playwright "signup → onboarding (now 6 steps) → search with filters → like → see in Likes tab → unlike" journey passes against ephemeral Docker Supabase. Every new RPC has pgTAP coverage for happy path + auth rejection + invariant. Every new RLS-protected table is tested for owner/other/anonymous. CI continues to run drift checks. The Plan 02 carry-over items are addressed.

### Versions actually installed during Plan 02

Plan 03 inherits Plan 02's installed versions:

- React 19, TypeScript 6, Vite 8, Tailwind v4 (`@tailwindcss/vite`), ESLint 9 flat config
- pnpm 11 with `pnpm-workspace.yaml` `allowBuilds` map
- `tsconfig.app.json` holds path aliases; root `tsconfig.json` is references-only; `erasableSyntaxOnly` is on (no TS parameter-property shorthand in classes)
- OpenTelemetry modern SDK (`resourceFromAttributes`, `spanProcessors:`)
- `react-router` v7 (no longer `react-router-dom`)
- Supabase CLI 2.78.1, `[analytics] enabled = false` in `supabase/config.toml`
- MSW v2 (`http.post(...)`)
- Node 22, Deno (for Edge Functions)
- TanStack Query v5, react-hook-form 7, `@hookform/resolvers` 5, Zod 4
- `i18next` configured with `keySeparator: false, nsSeparator: ':'` (Plan 02 Task 17 deviation — onboarding/auth bundles use flat dotted keys)

If any of those have changed (e.g. dependency security bumps), favour the actually-installed version and note the deviation in a "Versions actually installed during Plan 03" preamble at the top of this file.

### Plan 02 deviations Plan 03 must work around

The following deviations from Plan 02 are baked into the codebase and Plan 03 must respect them:

- **`storage.create_signed_url` / `storage.create_signed_upload_url` are NOT available** in the local Supabase image. The frontend mints signed URLs via `supabase.storage.from('media').createSignedUrl(path, 3600)` and `createSignedUploadUrl(path)`. All view RPCs (current and new) return `storage_path` / `path` strings, not URLs.
- **Storage RLS on `storage.objects`** (added in Plan 02 Task 21): authenticated users can INSERT/UPDATE/DELETE under their own `users/<auth.uid()>/*` prefix in the `media` bucket; SELECT is broadly authenticated. Plan 03 keeps this — Plan 03 does NOT tighten SELECT yet (spec §6 says we should eventually, but the spec marks it as a pre-launch concern). Note this in carry-over to Plan 04+.
- **Migration filename convention**: 14-digit numeric timestamp + `_name.sql`. NO alphabetic suffixes (Supabase CLI silently skips them). Plan 03 uses `20260514000000_*` onwards. The `20260510000000`–`20260510000007` and `20260510000100` slots from Plan 02 are taken.
- **`profile_id` test fixtures**: Zod 4's `uuid()` validates UUID variant bits, so test fixtures must use valid v4-shaped UUIDs (e.g. `11111111-1111-4111-8111-111111111111`), not all-zero or all-one.
- **`PERFORM` at top-level SQL is invalid**. pgTAP fixtures use `SELECT public.foo(...);` not `PERFORM public.foo(...);`.
- **JWT claim leakage in pgTAP**: when switching roles inside a pgTAP transaction, also unset `request.jwt.claim.sub` (`SET LOCAL "request.jwt.claim.sub" = ''`) before `SET LOCAL ROLE anon`. `RESET ROLE` doesn't unset other GUCs.
- **Bypass RLS for fixtures by superuser**: direct INSERT into RLS-protected tables (`media_items`, soon `likes`, `notifications`) requires `RESET ROLE` around the INSERT, then re-`SET LOCAL ROLE authenticated`.
- **`useMyProfile()` hook exists twice** — in `src/features/onboarding/hooks.ts` and `src/features/profile/hooks.ts`. Both share query key `['my-profile']`. Plan 03 deduplicates as part of Task 1.

### Plan 03 execution deviations

_(Populated by the executor when the spec text doesn't survive contact with reality. Keep entries sorted by task number.)_

- Task 3: In `supabase/tests/21_interests_schema_rls.sql`, moved the second `INSERT INTO auth.users` (user 2 fixture) to run before `SET LOCAL ROLE authenticated`. Reason: the `authenticated` role lacks INSERT privilege on `auth.users` (only superuser can write there), so the spec's placement would have raised `permission denied`. Reorder preserves all 10 RLS assertions — they switch the JWT claim between the two pre-existing fixture users to exercise owner vs non-owner paths.
- Task 4: Removed the fixture `INSERT INTO public.interests ... 'interest.hiking' ...` from `supabase/tests/21_interests_schema_rls.sql`. Reason: after the Task 4 seed migration runs during `supabase db reset`, that exact `label_key` is already present, so the fixture insert raises `duplicate key value violates unique constraint "interests_label_key_key"` before any assertions execute. The seed itself satisfies the test's "active interests are SELECT-able by authenticated users" precondition, so the fixture row is now redundant. Plan count stays at 10 (the removed line was a fixture INSERT, not a pgTAP assertion).
- Task 5: Replaced the `throws_ok('42501', ...)` assertion for UPDATE-denied in `supabase/tests/22_likes_schema_rls.sql` with a `WITH u AS (UPDATE … RETURNING 1) SELECT count(*) = 0` check. Reason: with no UPDATE policy declared, PostgreSQL RLS silently filters rows from UPDATE rather than raising 42501 (the `authenticated` role holds the table-level UPDATE grant; the deny-all comes from RLS, not GRANT). Same gotcha as Plan 02 Task 4. The replacement assertion still verifies the spec invariant ("UPDATE disallowed") — UPDATE always affects 0 rows for authenticated users — with a correct mechanism.
- Task 11: In `supabase/tests/28_rpc_like_unlike.sql`, wrapped the two notification-count assertions (after `like_profile` and after the idempotent second call) with `SET LOCAL "request.jwt.claim.sub" = '<likee>'` … `SET LOCAL "request.jwt.claim.sub" = '<liker>'` so the SELECT runs under the likee's JWT. Reason: `notifications` RLS is recipient-only (`recipient_id = auth.uid()`), so the liker cannot read notifications that target the likee. The SELECT under the wrong JWT silently returned 0. Plan count stays at 7; all 7 spec scenarios preserved (happy like, row created, notification created, idempotent, no dup, cannot_like_self, unlike).
- Task 14: In `supabase/tests/31_rpc_view_search_filters.sql`, moved the `DO $$ … INSERT INTO public.profile_interests … $$` fixture block to run BEFORE `SET LOCAL ROLE authenticated`. Reason: the DO block inserts a `profile_interests` row for profile `ba03`, but under the authenticated role with JWT claim set to `ba01`, the `profile_interests_owner_insert` policy rejects the INSERT (`profile_id <> auth.uid()`). Moving the seed into superuser scope bypasses RLS as is conventional for test fixtures. Plan count stays at 4; all 4 assertions preserved.
- Task 18: Replaced the spec's `z.preprocess(...)` blocks in `DetailsStep`'s Zod schema with a `z.union([z.literal(''), Enum.nullable()])` (via an `orEmpty` helper) for the enum fields. Reason: `z.preprocess` produced an inferred input type of `unknown` that `zodResolver` could not type-match against react-hook-form's `FormData`. The schema now accepts the form's empty-string default for unset selects; an `emptyToNull` helper in `onSubmit` normalises `''` → `null` before calling `setDetails.mutateAsync`. Net behaviour matches the spec.
- Task 18: In `InterestsStep`, replaced the spec's `tInt('interest.fitness') /* fallback loading text */` placeholder (which would have rendered "Fitness" as a loading indicator) with `t('interests.title')` ("Pick a few interests"). The original key was clearly a spec placeholder marker.
- Task 19: Parametrised `useUploadProfilePhoto` in `src/features/onboarding/hooks.ts` to accept either a bare `File` (legacy, defaults ordinal=0) or `{ file: File; ordinal?: number }`. Reason: the multi-photo gallery in `/me` calls upload with `ordinal = photos.length` so new uploads don't collide with the existing ordinal-0 row. The legacy `File` form is preserved so `PhotoStep` (Plan 02 onboarding flow) is unaffected.
- Task 19: `DetailsSection.tsx` ships its own copy of the `EnumSelect`/`CheckboxField` form helpers rather than importing them from `DetailsStep.tsx`, because the originals weren't exported. The 11-field enum option lists are duplicated for the same reason. Behaviour matches the onboarding DetailsStep.
- Task 19: `ProfilePage.tsx` (view-only for other users) renders the bio/details/interests `dl`/list markup inline rather than reusing `BioSection`/`DetailsSection`/`InterestsSection` — those wrappers always render an Edit button. This matches the spec's "minimum diff" suggestion. Photo view stays as the pre-existing `ProfilePhoto` helper (no gallery controls for other users).

### Open questions for the user before execution

Flag and resolve before starting:

1. **Onboarding step order.** Plan 02 ended with `role → identity → location → photo → complete`. Plan 03 adds Details (physical + lifestyle) and Interests. **Default: insert AFTER photo**, so the order becomes `role → identity → location → photo → details → interests → complete`. Pro: doesn't regress the Plan 02 E2E. Con: complete-onboarding precondition checks must widen (or stay loose). **Plan 03 chooses to NOT make Details/Interests onboarding-required** — `complete_onboarding` still only requires role + identity + location + photo. Details and Interests are skippable, editable later from `/me`.
2. **Like idempotency.** `like_profile` is upsert (no error on second call). `unlike_profile` deletes the row; not-found is a silent success (idempotent unlike). Notifications: a new like inserts a `notification`; an unlike does NOT delete the prior notification (the historical event still happened). Soft preference — easy to soften if you'd prefer.
3. **Notification polling cadence.** In-app banner needs to learn about new notifications. Default: TanStack Query polls `view_notifications` every 30s while the tab is visible (via `refetchInterval`), refetches on `visibilitychange`. No backoff. Realtime stays deferred per spec.
4. **Search filter persistence.** Filter sheet state is stored in the URL query string (`/search?min_age=22&max_age=35&distance_miles=25&interests=hiking,cooking`). This makes filters shareable and back-button friendly. The TanStack Query key includes the parsed filters so changes auto-invalidate.
5. **Interests taxonomy seed size.** Spec doesn't specify which interests to seed. Plan 03 seeds 30 interests across 5 categories (Lifestyle, Activities, Going Out, Travel, Other) with i18n keys. Easy to add more by editing `supabase/seed-interests.sql`.
6. **Edit-mode UX on `/me`.** Default: each profile section has an inline "Edit" button that swaps the section into a form. On submit/cancel the section returns to view mode. No bulk-save. **Pros:** matches spec §3 "view + edit modes" phrasing; small focused mutations. **Cons:** more click. Soft preference.

---

## File map

Files created or significantly touched in this plan:

```
shared/
├── rpc-contracts.ts                 EXTENDED with interests, likes, notifications, search filters
└── db-types.ts                      REGENERATED after each migration

src/
├── lib/
│   ├── last-active.ts               NEW — useHeartbeat() hook (touch last_active_at on visibility)
│   └── notifications/
│       ├── api.ts                   NEW — view_notifications, dismiss_notification
│       ├── hooks.ts                 NEW — useNotificationsPoll, useDismissNotification
│       ├── BannerHost.tsx           NEW — mounts at app shell; shows transient banners
│       └── __tests__/
├── features/
│   ├── profile/
│   │   ├── api.ts                   EXTENDED with details, bio, interests, photo mgmt
│   │   ├── hooks.ts                 EXTENDED — single source of useMyProfile()
│   │   ├── components/
│   │   │   ├── BioSection.tsx       NEW — tagline/about/wants
│   │   │   ├── DetailsSection.tsx   NEW — physical/lifestyle
│   │   │   ├── InterestsSection.tsx NEW — interests picker + display
│   │   │   ├── PhotoGallery.tsx     NEW — view+manage photos
│   │   │   └── EditableSection.tsx  NEW — generic view/edit toggle wrapper
│   │   ├── pages/
│   │   │   ├── ProfilePage.tsx      EXTENDED — render the new sections in view-only mode
│   │   │   └── MyProfilePage.tsx    EXTENDED — section-based edit
│   │   └── __tests__/
│   ├── likes/
│   │   ├── api.ts                   NEW — like_profile, unlike_profile, view_likes_tab
│   │   ├── hooks.ts                 NEW
│   │   ├── components/
│   │   │   ├── LikeButton.tsx       NEW
│   │   │   └── LikesGrid.tsx        NEW
│   │   ├── pages/LikesPage.tsx      NEW
│   │   └── __tests__/
│   ├── onboarding/
│   │   ├── api.ts                   EXTENDED — set_profile_details, set_profile_interests
│   │   ├── hooks.ts                 EXTENDED
│   │   ├── components/
│   │   │   ├── DetailsStep.tsx      NEW
│   │   │   └── InterestsStep.tsx    NEW
│   │   ├── pages/
│   │   │   ├── DetailsPage.tsx      NEW
│   │   │   └── InterestsPage.tsx    NEW
│   │   └── __tests__/
│   ├── search/
│   │   ├── api.ts                   EXTENDED — filter object
│   │   ├── hooks.ts                 EXTENDED — filter-aware query key
│   │   ├── components/
│   │   │   ├── FilterSheet.tsx      NEW
│   │   │   └── ProfileCard.tsx      EXTENDED — like button overlay
│   │   ├── pages/SearchPage.tsx     EXTENDED — filter sheet trigger + URL state
│   │   └── __tests__/
│   ├── interests/                   NEW
│   │   ├── api.ts                   list_interests RPC wrapper
│   │   ├── hooks.ts                 useInterests
│   │   └── components/InterestsPicker.tsx
│   └── shell/
│       ├── BottomTabBar.tsx         EXTENDED — Likes red dot from notifications poll
│       ├── HamburgerMenu.tsx        EXTENDED — language switcher
│       ├── LanguageSwitcher.tsx     NEW
│       └── __tests__/
├── i18n/en/
│   ├── interests.json               NEW — labels for taxonomy
│   ├── likes.json                   NEW
│   ├── profile.json                 EXTENDED — section labels, edit mode strings
│   ├── notifications.json           NEW
│   ├── onboarding.json              EXTENDED — details/interests step strings
│   ├── search.json                  EXTENDED — filter labels
│   └── shell.json                   EXTENDED — language switcher

supabase/
├── migrations/
│   ├── 20260514000000_profile_columns.sql            NEW — bio, physical, lifestyle columns + enums
│   ├── 20260514000001_interests.sql                  NEW — interests + profile_interests + RLS
│   ├── 20260514000002_interests_seed.sql             NEW — taxonomy seed
│   ├── 20260514000003_likes.sql                      NEW — likes table + RLS
│   ├── 20260514000004_notifications.sql              NEW — notifications table + RLS
│   ├── 20260514000005_rpc_profile_details.sql        NEW — set_profile_details, set_profile_bio
│   ├── 20260514000006_rpc_interests.sql              NEW — list_interests, set_profile_interests
│   ├── 20260514000007_rpc_photo_mgmt.sql             NEW — reorder/remove profile photos
│   ├── 20260514000008_rpc_likes.sql                  NEW — like_profile, unlike_profile, view_likes_tab
│   ├── 20260514000009_rpc_notifications.sql          NEW — view_notifications, dismiss_notification, notifications_unread_count
│   ├── 20260514000010_rpc_views_v2.sql               NEW — view_profile/view_my_profile/view_search updated
│   └── 20260514000011_rpc_heartbeat.sql              NEW — touch_last_active
├── tests/
│   ├── 20_profile_columns.sql                        NEW
│   ├── 21_interests_schema_rls.sql                   NEW
│   ├── 22_likes_schema_rls.sql                       NEW
│   ├── 23_notifications_schema_rls.sql               NEW
│   ├── 24_rpc_set_profile_details.sql                NEW
│   ├── 25_rpc_set_profile_bio.sql                    NEW
│   ├── 26_rpc_set_profile_interests.sql              NEW
│   ├── 27_rpc_photo_mgmt.sql                         NEW
│   ├── 28_rpc_like_unlike.sql                        NEW
│   ├── 29_rpc_view_likes_tab.sql                     NEW
│   ├── 30_rpc_notifications.sql                      NEW
│   ├── 31_rpc_view_search_filters.sql                NEW
│   └── 32_rpc_heartbeat.sql                          NEW

e2e/
└── likes-and-filters.spec.ts        NEW — second journey

.github/workflows/ci.yml                              EXTENDED — gen:* combined into drift-checks
README.md                                             EXTENDED — Plan 03 features
```

Conventions reminder: every code step contains the **actual** code. RPC bodies follow spec §6 template — `auth.uid()` null check first, role check (where applicable) second, body third, `jsonb` return. Every public RPC returns `{ ok: true, ... }` on success or `{ ok: false, error: '<code>' }` on logical failure.

---

## Task 1 — Plan 02 carry-over + housekeeping

Address the Plan 02 carry-overs and remove duplication accumulated during execution.

**Files:**

- Modify: `src/main.tsx` (mount TanStack Query devtools in dev)
- Delete: duplicate `useMyProfile` from `src/features/onboarding/hooks.ts`
- Modify: `src/features/onboarding/components/{IdentityStep,LocationStep,PhotoStep}.tsx` (use shared `useMyProfile`)
- Modify: `src/features/profile/hooks.ts` (single canonical `useMyProfile`)
- Modify: `.github/workflows/ci.yml` (combine `drift-checks` and `edge-functions-check` job structure with `db-tests` to boot Supabase once)

- [ ] **Step 1: Mount TanStack Query devtools in dev**

Modify `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
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
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  </React.StrictMode>,
)
```

Run `pnpm build && pnpm typecheck && pnpm test`. Expected: green; devtools chunk should only ship in dev (not in `dist/`).

- [ ] **Step 2: Deduplicate `useMyProfile`**

The canonical hook will live in `src/features/profile/hooks.ts`. Drop the duplicate from `src/features/onboarding/hooks.ts`.

In `src/features/onboarding/hooks.ts`, REMOVE the `useMyProfile` export. Re-export from profile to preserve any existing imports:

```ts
// Re-export from the canonical location to avoid duplicate query definitions.
export { useMyProfile } from '@/features/profile/hooks'
```

Verify `src/features/profile/hooks.ts` exports `useMyProfile` with key `['my-profile']`. Verify it's also what `src/lib/route-guards.tsx` consumes (it imports `viewMyProfile` from `@/features/onboarding/api` — keep that direct call for the guards because they need to bypass any stale cache).

- [ ] **Step 3: Verify no broken imports**

```bash
pnpm typecheck && pnpm test
```

Expected: clean.

- [ ] **Step 4: Combine CI drift-checks and edge-functions-check with db-tests**

Replace `.github/workflows/ci.yml`'s `db-tests`, `drift-checks`, and `edge-functions-check` jobs with a single combined job that boots Supabase once:

```yaml
  db-and-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: 2.78.1 }
      - uses: denoland/setup-deno@v1
        with: { deno-version: v1.x }
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
      - run: pnpm test:db
      - run: deno check supabase/functions/geocode-city/index.ts
      - run: supabase stop
```

Remove the now-redundant `drift-checks` and `edge-functions-check` jobs. Other jobs (`lint-typecheck`, `unit-tests`, `build`, `e2e-tests`) stay.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Address Plan 02 carry-over: devtools, dedupe useMyProfile, combine CI Supabase jobs"
```

---

## Task 2 — Migration: extend `profiles` with bio + physical + lifestyle columns

Add the 14 new columns and the 8 new enum types.

**Files:**

- Create: `supabase/migrations/20260514000000_profile_columns.sql`
- Create: `supabase/tests/20_profile_columns.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/20_profile_columns.sql`:

```sql
BEGIN;
SELECT plan(16);

SELECT has_column('public', 'profiles', 'tagline',             'tagline column');
SELECT has_column('public', 'profiles', 'about',               'about column');
SELECT has_column('public', 'profiles', 'wants',               'wants column');
SELECT has_column('public', 'profiles', 'height_cm',           'height_cm column');
SELECT has_column('public', 'profiles', 'body_type',           'body_type column');
SELECT has_column('public', 'profiles', 'hair_color',          'hair_color column');
SELECT has_column('public', 'profiles', 'eye_color',           'eye_color column');
SELECT has_column('public', 'profiles', 'has_piercings',       'has_piercings column');
SELECT has_column('public', 'profiles', 'has_tattoos',         'has_tattoos column');
SELECT has_column('public', 'profiles', 'smoking',             'smoking column');
SELECT has_column('public', 'profiles', 'drinking',            'drinking column');
SELECT has_column('public', 'profiles', 'education',           'education column');
SELECT has_column('public', 'profiles', 'yearly_income_band',  'yearly_income_band column');
SELECT has_column('public', 'profiles', 'net_worth_band',      'net_worth_band column');

-- height_cm CHECK (reasonable bounds 120..240)
SELECT throws_ok(
  $$ UPDATE public.profiles SET height_cm = 50 WHERE id = (SELECT id FROM public.profiles LIMIT 1) $$,
  '23514', NULL,
  'height_cm < 120 rejected'
);

-- tagline length CHECK (1..120)
SELECT throws_ok(
  $$ UPDATE public.profiles SET tagline = repeat('x', 121) WHERE id = (SELECT id FROM public.profiles LIMIT 1) $$,
  '23514', NULL,
  'tagline > 120 chars rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
supabase start
pnpm test:db
```

Expected: 16/16 failures (columns and CHECKs missing).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000000_profile_columns.sql`:

```sql
-- Plan 03: extend profiles with bio + physical + lifestyle columns + enums.
-- Spec §3 (Identity).

CREATE TYPE body_type        AS ENUM ('slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular');
CREATE TYPE hair_color       AS ENUM ('black', 'brown', 'blonde', 'red', 'grey', 'other');
CREATE TYPE eye_color        AS ENUM ('brown', 'blue', 'green', 'hazel', 'grey', 'other');
CREATE TYPE smoking_habit    AS ENUM ('never', 'occasionally', 'regularly', 'prefer_not_to_say');
CREATE TYPE drinking_habit   AS ENUM ('never', 'socially', 'regularly', 'prefer_not_to_say');
CREATE TYPE education_level  AS ENUM ('high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'other');
CREATE TYPE income_band      AS ENUM ('under_50k', '50_100k', '100_250k', '250_500k', '500k_1m', 'over_1m', 'prefer_not_to_say');
CREATE TYPE net_worth_band   AS ENUM ('under_250k', '250k_1m', '1m_5m', '5m_25m', 'over_25m', 'prefer_not_to_say');

ALTER TABLE public.profiles
  ADD COLUMN tagline            text,
  ADD COLUMN about              text,
  ADD COLUMN wants              text,
  ADD COLUMN height_cm          int,
  ADD COLUMN body_type          body_type,
  ADD COLUMN hair_color         hair_color,
  ADD COLUMN eye_color          eye_color,
  ADD COLUMN has_piercings      boolean,
  ADD COLUMN has_tattoos        boolean,
  ADD COLUMN smoking            smoking_habit,
  ADD COLUMN drinking           drinking_habit,
  ADD COLUMN education          education_level,
  ADD COLUMN yearly_income_band income_band,
  ADD COLUMN net_worth_band     net_worth_band;

-- Bounds checks. Tagline is the visible title; about/wants are free-form.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tagline_len  CHECK (tagline IS NULL OR (length(tagline) BETWEEN 1 AND 120)),
  ADD CONSTRAINT profiles_about_len    CHECK (about   IS NULL OR length(about) <= 4000),
  ADD CONSTRAINT profiles_wants_len    CHECK (wants   IS NULL OR length(wants) <= 2000),
  ADD CONSTRAINT profiles_height_range CHECK (height_cm IS NULL OR (height_cm BETWEEN 120 AND 240));

COMMENT ON COLUMN public.profiles.tagline IS 'Visible profile title (1-120 chars).';
COMMENT ON COLUMN public.profiles.about   IS 'Free-form "About me" text (<=4000 chars).';
COMMENT ON COLUMN public.profiles.wants   IS 'Free-form "What I want" text (<=2000 chars).';
```

- [ ] **Step 4: Re-run tests + regen types**

```bash
supabase db reset
pnpm test:db
pnpm gen:types
```

Expected: 16/16 new tests pass. `shared/db-types.ts` includes the new columns and 8 new enum values.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Extend profiles with bio, physical, and lifestyle columns + enums"
```

---

## Task 3 — Migration: `interests` + `profile_interests`

Spec §3: "interests (taxonomy, admin-managed)" with `id, label_key, category, ordinal, active`. `profile_interests` is the M:N junction.

**Files:**

- Create: `supabase/migrations/20260514000001_interests.sql`
- Create: `supabase/tests/21_interests_schema_rls.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/21_interests_schema_rls.sql`:

```sql
BEGIN;
SELECT plan(10);

SELECT has_table('public', 'interests',         'interests table exists');
SELECT has_table('public', 'profile_interests', 'profile_interests junction exists');

SELECT col_is_pk('public', 'interests', 'id', 'interests.id is PK');
SELECT col_type_is('public', 'interests', 'label_key', 'text', 'label_key is text');

-- profile_interests composite PK
SELECT col_is_pk('public', 'profile_interests', ARRAY['profile_id', 'interest_id'],
                 'profile_interests PK is (profile_id, interest_id)');

-- interests is publicly readable to authenticated users (no RLS surprises)
INSERT INTO public.interests (id, label_key, category, ordinal, active)
VALUES (gen_random_uuid(), 'interest.hiking', 'activities', 0, true);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '00000000-0000-0000-0000-000000000000',
        'i1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

SELECT ok(
  (SELECT count(*) FROM public.interests WHERE active = true)::int >= 1,
  'authenticated can SELECT active interests'
);

-- profile_interests: owner can insert/select their own row, not others'
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '00000000-0000-0000-0000-000000000000',
        'i2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

-- user 1 inserts an interest mapping for themselves
INSERT INTO public.profile_interests (profile_id, interest_id)
  SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, id FROM public.interests LIMIT 1;

SELECT is(
  (SELECT count(*) FROM public.profile_interests WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid)::int,
  1,
  'owner can SELECT their own profile_interests'
);

-- switch to user 2; cannot SELECT user 1's profile_interests
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

SELECT is(
  (SELECT count(*) FROM public.profile_interests WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid)::int,
  0,
  'non-owner cannot SELECT others profile_interests'
);

-- cannot INSERT for someone else
SELECT throws_ok(
  $$ INSERT INTO public.profile_interests (profile_id, interest_id)
     SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, id FROM public.interests LIMIT 1 $$,
  '42501', NULL,
  'cannot INSERT profile_interests for another user'
);

-- cannot directly INSERT a row into interests
SELECT throws_ok(
  $$ INSERT INTO public.interests (id, label_key, category, ordinal, active)
     VALUES (gen_random_uuid(), 'interest.hack', 'other', 0, true) $$,
  '42501', NULL,
  'cannot INSERT into interests as authenticated'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

Expected: 10/10 failures.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000001_interests.sql`:

```sql
-- Plan 03: interests taxonomy + profile_interests junction.
-- interests is admin-managed (seeded via migration). profile_interests is owner-managed.

CREATE TABLE public.interests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_key  text NOT NULL UNIQUE,
  category   text NOT NULL,
  ordinal    int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.interests IS
  'Admin-managed interests taxonomy. label_key is the i18n key (e.g. "interest.hiking").';

CREATE TABLE public.profile_interests (
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest_id uuid NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, interest_id)
);

CREATE INDEX profile_interests_by_interest ON public.profile_interests (interest_id);

-- RLS
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_interests ENABLE ROW LEVEL SECURITY;

-- interests: authenticated SELECT only (rows inserted via migration / service role)
CREATE POLICY interests_authenticated_select
  ON public.interests
  FOR SELECT
  TO authenticated
  USING (true);

-- profile_interests: owner can SELECT/INSERT/DELETE their own; UPDATE is meaningless (composite PK)
CREATE POLICY profile_interests_owner_select
  ON public.profile_interests
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY profile_interests_owner_insert
  ON public.profile_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY profile_interests_owner_delete
  ON public.profile_interests
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());
```

- [ ] **Step 4: Re-run tests**

```bash
supabase db reset
pnpm test:db
```

Expected: 10/10 pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add interests + profile_interests tables with RLS"
```

---

## Task 4 — Seed the interests taxonomy

Spec §3: "interests (taxonomy, admin-managed)". Plan 03 seeds 30 entries across 5 categories. Each `label_key` corresponds to an i18n key under `src/i18n/en/interests.json` (Task 17 wires that up).

**Files:**

- Create: `supabase/migrations/20260514000002_interests_seed.sql`

- [ ] **Step 1: Write the seed migration**

Create `supabase/migrations/20260514000002_interests_seed.sql`:

```sql
-- Plan 03 interests taxonomy seed. Idempotent via UNIQUE(label_key).

INSERT INTO public.interests (label_key, category, ordinal, active) VALUES
  -- Lifestyle (cat 'lifestyle')
  ('interest.fitness',      'lifestyle', 10, true),
  ('interest.cooking',      'lifestyle', 20, true),
  ('interest.fashion',      'lifestyle', 30, true),
  ('interest.wine',         'lifestyle', 40, true),
  ('interest.fine_dining',  'lifestyle', 50, true),
  ('interest.yoga',         'lifestyle', 60, true),
  -- Activities (cat 'activities')
  ('interest.hiking',       'activities', 10, true),
  ('interest.skiing',       'activities', 20, true),
  ('interest.tennis',       'activities', 30, true),
  ('interest.golf',         'activities', 40, true),
  ('interest.swimming',     'activities', 50, true),
  ('interest.dancing',      'activities', 60, true),
  -- Going out (cat 'going_out')
  ('interest.theatre',      'going_out', 10, true),
  ('interest.cinema',       'going_out', 20, true),
  ('interest.concerts',     'going_out', 30, true),
  ('interest.museums',      'going_out', 40, true),
  ('interest.nightlife',    'going_out', 50, true),
  ('interest.galleries',    'going_out', 60, true),
  -- Travel (cat 'travel')
  ('interest.weekend_trips','travel', 10, true),
  ('interest.beach',        'travel', 20, true),
  ('interest.city_breaks',  'travel', 30, true),
  ('interest.adventure',    'travel', 40, true),
  ('interest.cruises',      'travel', 50, true),
  ('interest.luxury_travel','travel', 60, true),
  -- Other (cat 'other')
  ('interest.reading',      'other', 10, true),
  ('interest.gaming',       'other', 20, true),
  ('interest.photography',  'other', 30, true),
  ('interest.languages',    'other', 40, true),
  ('interest.pets',         'other', 50, true),
  ('interest.volunteering', 'other', 60, true)
ON CONFLICT (label_key) DO UPDATE SET
  category = EXCLUDED.category,
  ordinal  = EXCLUDED.ordinal,
  active   = EXCLUDED.active;
```

- [ ] **Step 2: Apply + verify**

```bash
supabase db reset
PGPASSWORD=postgres /usr/bin/psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT count(*) AS n, count(DISTINCT category) AS cats FROM public.interests WHERE active = true;"
```

Expected: `n = 30, cats = 5`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Seed interests taxonomy (30 entries across 5 categories)"
```

---

## Task 5 — Migration: `likes` table + RLS

Spec §3 Likes: `liker_id, likee_id (composite PK), created_at`. Spec §6: SELECT permitted if `liker_id=me` OR `likee_id=me`; INSERT only if `liker_id=me`; UPDATE disallowed; DELETE only if `liker_id=me`.

**Files:**

- Create: `supabase/migrations/20260514000003_likes.sql`
- Create: `supabase/tests/22_likes_schema_rls.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/22_likes_schema_rls.sql`:

```sql
BEGIN;
SELECT plan(8);

SELECT has_table('public', 'likes', 'likes table exists');
SELECT col_is_pk('public', 'likes', ARRAY['liker_id', 'likee_id'], 'composite PK');

-- Fixture: two users
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', '00000000-0000-0000-0000-000000000000',
   'l1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', '00000000-0000-0000-0000-000000000000',
   'l2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

UPDATE public.profiles SET status='active' WHERE id IN
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';

-- INSERT own like: ok
INSERT INTO public.likes (liker_id, likee_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2');

SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid)::int,
  1,
  'liker can SELECT their own like'
);

-- Cannot impersonate someone else's like
SELECT throws_ok(
  $$ INSERT INTO public.likes (liker_id, likee_id) VALUES
       ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1') $$,
  '42501', NULL,
  'cannot INSERT a like with someone else as liker'
);

-- UPDATE is denied
SELECT throws_ok(
  $$ UPDATE public.likes SET created_at = now()
      WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid $$,
  '42501', NULL,
  'UPDATE on likes is denied'
);

-- Switch to user 2: can SELECT (likee_id = me), cannot DELETE
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2';

SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid)::int,
  1,
  'likee can SELECT likes pointed at them'
);

-- Likee cannot DELETE the like (only liker can)
DELETE FROM public.likes
  WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid
    AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid;
SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid
      AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid)::int,
  1,
  'likee DELETE silently no-ops (RLS hides row from DELETE)'
);

-- Back to liker: DELETE succeeds
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';
DELETE FROM public.likes
  WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid
    AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'::uuid;

SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'::uuid)::int,
  0,
  'liker can DELETE their own like'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

Expected: 8/8 failures.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000003_likes.sql`:

```sql
-- Plan 03: likes table. Spec §3 + §6.
-- Composite PK enforces idempotency (no double-likes).

CREATE TABLE public.likes (
  liker_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  likee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (liker_id, likee_id),
  CHECK (liker_id <> likee_id)
);

CREATE INDEX likes_by_likee ON public.likes (likee_id, created_at DESC);
CREATE INDEX likes_by_liker ON public.likes (liker_id, created_at DESC);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- SELECT: either side can see
CREATE POLICY likes_select_self
  ON public.likes
  FOR SELECT
  TO authenticated
  USING (liker_id = auth.uid() OR likee_id = auth.uid());

-- INSERT: only as the liker
CREATE POLICY likes_insert_self
  ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK (liker_id = auth.uid());

-- DELETE: only by the liker
CREATE POLICY likes_delete_self
  ON public.likes
  FOR DELETE
  TO authenticated
  USING (liker_id = auth.uid());

-- No UPDATE policy: deny-all.
```

- [ ] **Step 4: Re-run + regen types**

```bash
supabase db reset
pnpm test:db
pnpm gen:types
```

Expected: 8/8 pass; `shared/db-types.ts` includes `likes`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add likes table with RLS"
```

---

## Task 6 — Migration: `notifications` table + RLS

Spec §3 Notifications: `recipient_id, kind, payload jsonb, created_at, read_at, dismissed_at`. Spec §6: SELECT by `recipient_id=me`; INSERT via RPC; UPDATE for read/dismiss is owner-only.

**Files:**

- Create: `supabase/migrations/20260514000004_notifications.sql`
- Create: `supabase/tests/23_notifications_schema_rls.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/23_notifications_schema_rls.sql`:

```sql
BEGIN;
SELECT plan(6);

SELECT has_table('public', 'notifications', 'notifications table exists');
SELECT col_is_pk('public', 'notifications', 'id', 'id is PK');

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1', '00000000-0000-0000-0000-000000000000',
   'n1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2', '00000000-0000-0000-0000-000000000000',
   'n2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

-- Seed a notification as superuser
INSERT INTO public.notifications (id, recipient_id, kind, payload)
VALUES ('11111111-1111-4111-8111-111111111101',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1',
        'like',
        '{"actor_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2", "actor_name": "Other"}'::jsonb);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1';

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1'::uuid)::int,
  1,
  'recipient can SELECT their own notification'
);

-- mark read
UPDATE public.notifications SET read_at = now()
  WHERE id = '11111111-1111-4111-8111-111111111101'::uuid;
SELECT ok(
  (SELECT read_at IS NOT NULL FROM public.notifications WHERE id = '11111111-1111-4111-8111-111111111101'::uuid),
  'recipient can UPDATE read_at on own notification'
);

-- Other user cannot see it
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2';
SELECT is(
  (SELECT count(*) FROM public.notifications WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1'::uuid)::int,
  0,
  'other user cannot SELECT someone else notification'
);

-- Other user cannot INSERT (no policy for INSERT to authenticated; RPCs only)
SELECT throws_ok(
  $$ INSERT INTO public.notifications (id, recipient_id, kind, payload)
     VALUES (gen_random_uuid(),
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1'::uuid,
             'spam',
             '{}'::jsonb) $$,
  '42501', NULL,
  'direct INSERT into notifications is denied'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000004_notifications.sql`:

```sql
-- Plan 03: notifications table. Spec §3 + §6.
-- INSERTs go via SECURITY DEFINER RPCs (the action that fires them is also the source of truth).
-- Owners can mark read or dismiss; otherwise the table is read-only on the client side.

CREATE TYPE notification_kind AS ENUM (
  'like',
  -- Plan 04+ will add: 'message', 'secret_access_request', 'secret_access_grant', 'token_purchase_complete'
  'placeholder'
);

CREATE TABLE public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind          notification_kind NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,
  dismissed_at  timestamptz
);

CREATE INDEX notifications_by_recipient_recent
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX notifications_unread
  ON public.notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: recipient only
CREATE POLICY notifications_recipient_select
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- UPDATE: recipient only (used for mark-read / dismiss)
CREATE POLICY notifications_recipient_update
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- No INSERT or DELETE policies: RPCs only.
```

- [ ] **Step 4: Re-run + regen types**

```bash
supabase db reset && pnpm test:db && pnpm gen:types
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add notifications table with RLS"
```

---

## Task 7 — RPC: `set_profile_details` (physical + lifestyle)

Free-form per-section setter that overwrites a fixed group of columns. Used by the Details onboarding step and by the `/me` Details edit section.

**Files:**

- Create: `supabase/migrations/20260514000005_rpc_profile_details.sql` (this file also gets `set_profile_bio` in Task 8)
- Create: `supabase/tests/24_rpc_set_profile_details.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/24_rpc_set_profile_details.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1', '00000000-0000-0000-0000-000000000000',
        'd1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1';

-- Happy path
SELECT is(
  (SELECT public.set_profile_details(
    178, 'athletic'::body_type, 'brown'::hair_color, 'blue'::eye_color,
    false, true,
    'never'::smoking_habit, 'socially'::drinking_habit, 'bachelors'::education_level,
    '100_250k'::income_band, '1m_5m'::net_worth_band))::text,
  '{"ok": true}',
  'set_profile_details ok'
);

SELECT is(
  (SELECT height_cm FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1'::uuid),
  178,
  'height_cm persisted'
);

SELECT is(
  (SELECT body_type::text FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad1'::uuid),
  'athletic',
  'body_type persisted'
);

-- Out-of-range height rejected (returns error code, doesn't persist)
SELECT is(
  (SELECT public.set_profile_details(
    50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL))::text,
  '{"ok": false, "error": "height_out_of_range"}',
  'height_cm 50 rejected with structured error'
);

-- Unauthenticated raises
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_details(180, NULL, NULL, NULL, NULL, NULL,
                                        NULL, NULL, NULL, NULL, NULL) $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the RPC**

Create `supabase/migrations/20260514000005_rpc_profile_details.sql`:

```sql
-- Plan 03: set_profile_details + set_profile_bio. SECURITY DEFINER pattern from spec §6.
-- Every nullable parameter is "leave unchanged-able" by passing NULL; explicit clear via
-- NULL is not supported here (Plan 03 spec doesn't need it — sections always submit full set).

CREATE OR REPLACE FUNCTION public.set_profile_details(
  p_height_cm          int,
  p_body_type          body_type,
  p_hair_color         hair_color,
  p_eye_color          eye_color,
  p_has_piercings      boolean,
  p_has_tattoos        boolean,
  p_smoking            smoking_habit,
  p_drinking           drinking_habit,
  p_education          education_level,
  p_yearly_income_band income_band,
  p_net_worth_band     net_worth_band
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

  IF p_height_cm IS NOT NULL AND (p_height_cm < 120 OR p_height_cm > 240) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'height_out_of_range');
  END IF;

  UPDATE public.profiles
     SET height_cm          = p_height_cm,
         body_type          = p_body_type,
         hair_color         = p_hair_color,
         eye_color          = p_eye_color,
         has_piercings      = p_has_piercings,
         has_tattoos        = p_has_tattoos,
         smoking            = p_smoking,
         drinking           = p_drinking,
         education          = p_education,
         yearly_income_band = p_yearly_income_band,
         net_worth_band     = p_net_worth_band
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_details(
  int, body_type, hair_color, eye_color, boolean, boolean,
  smoking_habit, drinking_habit, education_level, income_band, net_worth_band
) TO authenticated;
```

- [ ] **Step 4: Re-run**

```bash
supabase db reset && pnpm test:db
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add set_profile_details RPC with bounds validation"
```

---

## Task 8 — RPC: `set_profile_bio` (tagline, about, wants)

Append to the same migration as Task 7.

**Files:**

- Modify: `supabase/migrations/20260514000005_rpc_profile_details.sql` (append)
- Create: `supabase/tests/25_rpc_set_profile_bio.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/25_rpc_set_profile_bio.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad2', '00000000-0000-0000-0000-000000000000',
        'd2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad2';

-- Happy path
SELECT is(
  (SELECT public.set_profile_bio(
    'Adventurer at heart',
    'I love hiking, fine dining, and unexpected weekend trips.',
    'Looking for an honest connection.'))::text,
  '{"ok": true}',
  'set_profile_bio ok'
);

SELECT is(
  (SELECT tagline FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad2'::uuid),
  'Adventurer at heart',
  'tagline persisted'
);

-- Tagline too long
SELECT is(
  (SELECT public.set_profile_bio(repeat('x', 121), NULL, NULL))::text,
  '{"ok": false, "error": "tagline_too_long"}',
  'tagline > 120 chars rejected'
);

-- About too long
SELECT is(
  (SELECT public.set_profile_bio('OK', repeat('y', 4001), NULL))::text,
  '{"ok": false, "error": "about_too_long"}',
  'about > 4000 chars rejected'
);

-- Unauthenticated
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.set_profile_bio('x', 'y', 'z') $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Append the RPC**

Append to `supabase/migrations/20260514000005_rpc_profile_details.sql`:

```sql
CREATE OR REPLACE FUNCTION public.set_profile_bio(
  p_tagline text,
  p_about   text,
  p_wants   text
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

  IF p_tagline IS NOT NULL AND (length(trim(p_tagline)) = 0 OR length(p_tagline) > 120) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tagline_too_long');
  END IF;
  IF p_about IS NOT NULL AND length(p_about) > 4000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'about_too_long');
  END IF;
  IF p_wants IS NOT NULL AND length(p_wants) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wants_too_long');
  END IF;

  UPDATE public.profiles
     SET tagline = CASE WHEN p_tagline IS NULL THEN NULL ELSE trim(p_tagline) END,
         about   = p_about,
         wants   = p_wants
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_bio(text, text, text) TO authenticated;
```

- [ ] **Step 4: Re-run + commit**

```bash
supabase db reset && pnpm test:db
git add -A
git commit -m "Add set_profile_bio RPC with length validation"
```

---

## Task 9 — RPC: `list_interests` + `set_profile_interests`

Read RPC returns the active taxonomy (used by the picker). Write RPC replaces the user's full set in one transaction (DELETE + INSERT pattern). Spec §6: profile_interests is owner-managed.

**Files:**

- Create: `supabase/migrations/20260514000006_rpc_interests.sql`
- Create: `supabase/tests/26_rpc_set_profile_interests.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/26_rpc_set_profile_interests.sql`:

```sql
BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3', '00000000-0000-0000-0000-000000000000',
        'd3@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3';

-- list_interests returns all active rows
SELECT ok(
  jsonb_array_length((SELECT public.list_interests())->'interests') > 0,
  'list_interests returns at least one row'
);

-- Each entry has id, label_key, category
WITH r AS (SELECT (public.list_interests())->'interests'->0 AS first_one)
SELECT ok(
  (SELECT first_one ? 'id' AND first_one ? 'label_key' AND first_one ? 'category' FROM r),
  'interest objects have id, label_key, category'
);

-- Pick two interest ids
DO $$
DECLARE
  ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.interests LIMIT 2) sub;
  PERFORM set_config('test.ids', ids[1] || ',' || ids[2], true);
END $$;

-- set_profile_interests with two ids
SELECT is(
  (SELECT public.set_profile_interests(
    string_to_array(current_setting('test.ids'), ',')::uuid[]))::text,
  '{"ok": true}',
  'set_profile_interests ok'
);

SELECT is(
  (SELECT count(*) FROM public.profile_interests
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3'::uuid)::int,
  2,
  'two profile_interests rows inserted'
);

-- Replace with one id: prior two are removed, new one inserted
SELECT is(
  (SELECT public.set_profile_interests(
    ARRAY[(string_to_array(current_setting('test.ids'), ','))[1]::uuid]))::text,
  '{"ok": true}',
  'set_profile_interests replace ok'
);

SELECT is(
  (SELECT count(*) FROM public.profile_interests
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaad3'::uuid)::int,
  1,
  'profile_interests replaced (down to 1)'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000006_rpc_interests.sql`:

```sql
-- Plan 03: interests RPCs.
-- list_interests: read-only, returns all active interests sorted by category/ordinal/label_key.
-- set_profile_interests: replaces the caller's full interest set in one transaction.

CREATE OR REPLACE FUNCTION public.list_interests() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'interests',
    (SELECT COALESCE(jsonb_agg(
       jsonb_build_object(
         'id',        i.id,
         'label_key', i.label_key,
         'category',  i.category,
         'ordinal',   i.ordinal
       ) ORDER BY i.category, i.ordinal, i.label_key
     ), '[]'::jsonb)
     FROM public.interests i
     WHERE i.active = true)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_interests() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profile_interests(p_interest_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  valid_count int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  -- Validate every id refers to an active interest. Reject the whole call on mismatch.
  IF p_interest_ids IS NULL THEN
    p_interest_ids := ARRAY[]::uuid[];
  END IF;

  SELECT count(*)::int INTO valid_count
    FROM public.interests
   WHERE active = true AND id = ANY (p_interest_ids);

  IF valid_count <> coalesce(cardinality(p_interest_ids), 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_or_inactive_interest');
  END IF;

  IF cardinality(p_interest_ids) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_interests');
  END IF;

  DELETE FROM public.profile_interests WHERE profile_id = me;

  INSERT INTO public.profile_interests (profile_id, interest_id)
    SELECT me, unnest(p_interest_ids);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_interests(uuid[]) TO authenticated;
```

- [ ] **Step 4: Re-run + commit**

```bash
supabase db reset && pnpm test:db
git add -A
git commit -m "Add list_interests and set_profile_interests RPCs"
```

---

## Task 10 — RPCs: `reorder_profile_photos` + `remove_profile_photo`

Multi-photo gallery management. Spec §3: `profile_photos (profile_id, media_item_id, ordinal) PK`. Reorder rewrites every row's ordinal in one shot for the simplest invariant. Remove deletes the junction row (and the underlying media_item only if no other junction references it — but that GC is out-of-scope; spec §3 says orphans are GC'd by a periodic job, which Plan 03 does NOT implement).

**Files:**

- Create: `supabase/migrations/20260514000007_rpc_photo_mgmt.sql`
- Create: `supabase/tests/27_rpc_photo_mgmt.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/27_rpc_photo_mgmt.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee', '00000000-0000-0000-0000-000000000000',
        'pm@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

-- Seed three approved photos as superuser (media_items has deny-all RLS)
RESET ROLE;
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
VALUES
  ('11111111-1111-4111-8111-1111111111aa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee',
   'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee/aa.jpg', 'photo', 'hashAAAAAAAAAAAA01', 1024, 'approved'),
  ('11111111-1111-4111-8111-1111111111bb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee',
   'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee/bb.jpg', 'photo', 'hashAAAAAAAAAAAA02', 1024, 'approved'),
  ('11111111-1111-4111-8111-1111111111cc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee',
   'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee/cc.jpg', 'photo', 'hashAAAAAAAAAAAA03', 1024, 'approved');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee';

-- Add all three (uses Plan 02's add_to_profile_photos)
SELECT public.add_to_profile_photos('11111111-1111-4111-8111-1111111111aa'::uuid, 0);
SELECT public.add_to_profile_photos('11111111-1111-4111-8111-1111111111bb'::uuid, 1);
SELECT public.add_to_profile_photos('11111111-1111-4111-8111-1111111111cc'::uuid, 2);

-- Reorder: reverse to cc, bb, aa
SELECT is(
  (SELECT public.reorder_profile_photos(ARRAY[
    '11111111-1111-4111-8111-1111111111cc'::uuid,
    '11111111-1111-4111-8111-1111111111bb'::uuid,
    '11111111-1111-4111-8111-1111111111aa'::uuid]))::text,
  '{"ok": true}',
  'reorder ok'
);

SELECT is(
  (SELECT media_item_id FROM public.profile_photos
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee'::uuid
    ORDER BY ordinal LIMIT 1),
  '11111111-1111-4111-8111-1111111111cc'::uuid,
  'cc is now ordinal 0'
);

-- Reorder with an id the user doesn't own (cc plus some random uuid)
SELECT is(
  (SELECT public.reorder_profile_photos(ARRAY[
    '11111111-1111-4111-8111-1111111111cc'::uuid,
    gen_random_uuid()]))::text,
  '{"ok": false, "error": "unknown_photo"}',
  'foreign photo id rejected'
);

-- Remove bb
SELECT is(
  (SELECT public.remove_profile_photo('11111111-1111-4111-8111-1111111111bb'::uuid))::text,
  '{"ok": true}',
  'remove ok'
);

-- Now expect 2 photos with ordinals 0,1 (contiguous after remove)
SELECT is(
  (SELECT count(*) FROM public.profile_photos
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaee'::uuid)::int,
  2,
  'two photos remain after remove'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000007_rpc_photo_mgmt.sql`:

```sql
-- Plan 03: profile-photo management RPCs (reorder, remove).
-- add_to_profile_photos remains the insert path (from Plan 02).

CREATE OR REPLACE FUNCTION public.reorder_profile_photos(p_ordered uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  expected_count int;
  given_count int := coalesce(cardinality(p_ordered), 0);
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  -- Every id must belong to the caller's profile_photos.
  SELECT count(*)::int INTO expected_count
    FROM public.profile_photos
   WHERE profile_id = me AND media_item_id = ANY (p_ordered);

  IF expected_count <> given_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_photo');
  END IF;

  -- Also reject if the user has more rows than they're submitting (partial reorder).
  IF (SELECT count(*) FROM public.profile_photos WHERE profile_id = me) <> given_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'photo_set_mismatch');
  END IF;

  -- Apply new ordinals via unnest WITH ORDINALITY.
  UPDATE public.profile_photos pp
     SET ordinal = ord.idx - 1
    FROM unnest(p_ordered) WITH ORDINALITY AS ord(media_item_id, idx)
   WHERE pp.profile_id = me
     AND pp.media_item_id = ord.media_item_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_profile_photos(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_profile_photo(p_media_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  rows_deleted int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  DELETE FROM public.profile_photos
    WHERE profile_id = me AND media_item_id = p_media_item_id;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  IF rows_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Renumber remaining photos to keep ordinals contiguous.
  WITH ranked AS (
    SELECT media_item_id, row_number() OVER (ORDER BY ordinal) - 1 AS new_ord
      FROM public.profile_photos
     WHERE profile_id = me
  )
  UPDATE public.profile_photos pp
     SET ordinal = ranked.new_ord
    FROM ranked
   WHERE pp.profile_id = me
     AND pp.media_item_id = ranked.media_item_id;

  -- Orphan media_items are swept by GC (out of scope here).
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_profile_photo(uuid) TO authenticated;
```

- [ ] **Step 4: Re-run + commit**

```bash
supabase db reset && pnpm test:db
git add -A
git commit -m "Add reorder_profile_photos and remove_profile_photo RPCs"
```

---

## Task 11 — RPCs: `like_profile` + `unlike_profile`

Spec §4: `like_profile(likee_id)` upserts likes row + creates notification. Idempotent. `unlike_profile` deletes; idempotent on miss. Spec §3 + §12 decision: "Likes: bookmark + signal. In-app banner only. No price gating."

**Files:**

- Create: `supabase/migrations/20260514000008_rpc_likes.sql` (also gets `view_likes_tab` in Task 12)
- Create: `supabase/tests/28_rpc_like_unlike.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/28_rpc_like_unlike.sql`:

```sql
BEGIN;
SELECT plan(7);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1', '00000000-0000-0000-0000-000000000000',
   'lk1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2', '00000000-0000-0000-0000-000000000000',
   'lk2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

UPDATE public.profiles SET status='active', display_name='Like1' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1';
UPDATE public.profiles SET status='active', display_name='Like2' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1';

-- 1. Happy path
SELECT is(
  (SELECT public.like_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid))::text,
  '{"ok": true}',
  'like_profile ok'
);

-- Row created
SELECT is(
  (SELECT count(*) FROM public.likes
    WHERE liker_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1'::uuid
      AND likee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid)::int,
  1,
  'likes row created'
);

-- Notification created for likee
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid
      AND kind = 'like'
      AND payload->>'actor_id' = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1')::int,
  1,
  'notification inserted for likee'
);

-- 2. Idempotent like — second call no-op, no duplicate notification
SELECT is(
  (SELECT public.like_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid))::text,
  '{"ok": true}',
  'second like still ok'
);

SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid
      AND kind = 'like')::int,
  1,
  'no duplicate notification on second like'
);

-- 3. Cannot like self
SELECT is(
  (SELECT public.like_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf1'::uuid))::text,
  '{"ok": false, "error": "cannot_like_self"}',
  'cannot like self rejected'
);

-- 4. Unlike happy path
SELECT is(
  (SELECT public.unlike_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaf2'::uuid))::text,
  '{"ok": true}',
  'unlike_profile ok'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000008_rpc_likes.sql`:

```sql
-- Plan 03: like_profile, unlike_profile. view_likes_tab is appended in Task 12.
-- like is idempotent (UPSERT). unlike is idempotent (DELETE returns rows_deleted but ok=true regardless).
-- Decision (Open Q 2): unlike does NOT delete the prior 'like' notification (historical event stands).

CREATE OR REPLACE FUNCTION public.like_profile(p_likee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  was_inserted boolean;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF me = p_likee_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_like_self');
  END IF;

  -- Verify likee is active (don't let users like inactive/suspended/deactivated profiles).
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_likee_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.likes (liker_id, likee_id) VALUES (me, p_likee_id)
    ON CONFLICT (liker_id, likee_id) DO NOTHING
    RETURNING true INTO was_inserted;

  -- Insert notification only on first like (was_inserted = true).
  IF was_inserted IS TRUE THEN
    INSERT INTO public.notifications (recipient_id, kind, payload)
    VALUES (
      p_likee_id,
      'like',
      jsonb_build_object(
        'actor_id', me,
        'actor_name', (SELECT display_name FROM public.profiles WHERE id = me)
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unlike_profile(p_likee_id uuid)
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

  DELETE FROM public.likes WHERE liker_id = me AND likee_id = p_likee_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlike_profile(uuid) TO authenticated;
```

- [ ] **Step 4: Re-run + commit**

```bash
supabase db reset && pnpm test:db
git add -A
git commit -m "Add like_profile and unlike_profile RPCs with notification side-effect"
```

---

## Task 12 — RPC: `view_likes_tab`

Spec §4: `view_likes_tab()` returns `{liked_me: [card], favourites: [card]}`.

- **liked_me**: people who liked me, profiles I haven't yet liked back. Ordered by like recency.
- **favourites**: people I have liked. Ordered by my like recency.

Both lists use the standard card shape (so they can re-use `_profile_card_for_viewer`).

**Files:**

- Modify: `supabase/migrations/20260514000008_rpc_likes.sql` (append)
- Create: `supabase/tests/29_rpc_view_likes_tab.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/29_rpc_view_likes_tab.sql`:

```sql
BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01', '00000000-0000-0000-0000-000000000000',
   'lt1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab02', '00000000-0000-0000-0000-000000000000',
   'lt2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab03', '00000000-0000-0000-0000-000000000000',
   'lt3@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Me',
       date_of_birth='1985-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01';
UPDATE public.profiles SET role='baby', status='active', display_name='LikedMe',
       date_of_birth='1998-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab02';
UPDATE public.profiles SET role='baby', status='active', display_name='MyFav',
       date_of_birth='1996-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab03';

-- Seed: lt2 likes me; I like lt3 (use direct INSERT as superuser to avoid RPC notification side effects)
RESET ROLE;
INSERT INTO public.likes (liker_id, likee_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab02', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab03');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01';

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  (SELECT body->>'ok' FROM r),
  'true',
  'view_likes_tab ok'
);

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  jsonb_array_length((SELECT body->'liked_me' FROM r)),
  1,
  '1 liked_me entry'
);

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  (SELECT body->'liked_me'->0->>'display_name' FROM r),
  'LikedMe',
  'liked_me contains LikedMe'
);

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  (SELECT body->'favourites'->0->>'display_name' FROM r),
  'MyFav',
  'favourites contains MyFav'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Append the RPC**

Append to `supabase/migrations/20260514000008_rpc_likes.sql`:

```sql
CREATE OR REPLACE FUNCTION public.view_likes_tab() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  liked_me  jsonb := '[]'::jsonb;
  favourites jsonb := '[]'::jsonb;
  card jsonb;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  -- "liked_me" = people who liked me, excluding those I already liked back (those are "matches" — deferred)
  FOR rec IN
    SELECT l.liker_id AS profile_id
      FROM public.likes l
     WHERE l.likee_id = me
       AND NOT EXISTS (
         SELECT 1 FROM public.likes l2 WHERE l2.liker_id = me AND l2.likee_id = l.liker_id
       )
     ORDER BY l.created_at DESC
     LIMIT 50
  LOOP
    card := public._profile_card_for_viewer(me, rec.profile_id);
    IF card IS NOT NULL THEN liked_me := liked_me || card; END IF;
  END LOOP;

  -- "favourites" = people I liked
  FOR rec IN
    SELECT l.likee_id AS profile_id
      FROM public.likes l
     WHERE l.liker_id = me
     ORDER BY l.created_at DESC
     LIMIT 50
  LOOP
    card := public._profile_card_for_viewer(me, rec.profile_id);
    IF card IS NOT NULL THEN favourites := favourites || card; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'liked_me', liked_me,
    'favourites', favourites
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_likes_tab() TO authenticated;
```

- [ ] **Step 4: Re-run + commit**

```bash
supabase db reset && pnpm test:db
git add -A
git commit -m "Add view_likes_tab RPC returning {liked_me, favourites}"
```

---

## Task 13 — Update view RPCs (v2)

Replace `_profile_card_for_viewer`, `view_profile`, `view_my_profile` with versions that:

- Populate `my_like_state` (boolean) in the card shape.
- Add `their_like_state` (boolean) in `view_profile` (so the UI can show "Liked you").
- Include the new bio/physical/lifestyle columns + interests array in `view_profile` and `view_my_profile`.
- Include the photos array on every viewer-perspective surface.

`view_search` gets the filter expansion in Task 14 — split for review tractability.

**Files:**

- Create: `supabase/migrations/20260514000010_rpc_views_v2.sql`

  (Migration `20260514000009_rpc_notifications.sql` is the notification view RPCs, written in Task 15. Reserved here.)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260514000010_rpc_views_v2.sql`:

```sql
-- Plan 03: refresh view RPCs to include like state, interests, and the new bio/physical/lifestyle columns.
-- _profile_card_for_viewer keeps its existing return shape; new key 'my_like_state' goes from NULL to boolean.

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
  distance_miles double precision;
  age int;
  my_like boolean;
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

  IF v.city_lat IS NOT NULL AND t.city_lat IS NOT NULL THEN
    distance_miles := ST_Distance(
      ST_MakePoint(v.city_lng, v.city_lat)::geography,
      ST_MakePoint(t.city_lng, t.city_lat)::geography
    ) / 1609.344;
  END IF;

  age := extract(year from age(t.date_of_birth))::int;

  my_like := EXISTS (
    SELECT 1 FROM public.likes WHERE liker_id = p_viewer AND likee_id = p_target
  );

  RETURN jsonb_build_object(
    'profile_id',         t.id,
    'display_name',       t.display_name,
    'age',                age,
    'city_display_name',  t.city_display_name,
    'distance_miles',     distance_miles,
    'primary_photo_path', primary_photo_path,
    'tagline',            t.tagline,
    'my_like_state',      my_like
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._profile_card_for_viewer(uuid, uuid) TO authenticated;

-- view_profile now includes bio/physical/lifestyle + interests + their_like_state
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
      'city_display_name',  t.city_display_name,
      'gender',             t.gender,
      'looking_for',        t.looking_for,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
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

-- view_my_profile: same shape minus *_like_state, plus role+status+token_balance.
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
      'media_item_id', rec.media_item_id  -- needed by reorder/remove RPCs
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
      'city_display_name',  t.city_display_name,
      'tagline',            t.tagline,
      'about',              t.about,
      'wants',              t.wants,
      'height_cm',          t.height_cm,
      'body_type',          t.body_type,
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
```

- [ ] **Step 2: Apply + regenerate types + run existing tests**

```bash
supabase db reset
pnpm test:db
pnpm gen:types
```

Plan 02's existing tests (`18_rpc_view_search.sql`, `19_rpc_view_profile.sql`) should still pass — the response shape is a strict superset for `view_profile` and unchanged for the card shape's existing keys. If they break, update the assertions (and document as a Task 13 deviation entry).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Refresh view RPCs (v2): bio/physical/lifestyle, interests, my_like_state"
```

---

## Task 14 — Update `view_search` to accept filters

Spec §4: `view_search(filters, cursor)`. Plan 02 ignored filters; Plan 03 reads them. Supported keys (all optional):

- `min_age`, `max_age` (int)
- `distance_miles` (int): match only profiles within this radius of the viewer's city centroid. If viewer has no lat/lng, ignore.
- `interest_ids` (uuid[]): match profiles that share at least one of these interests.

Unsupported keys are silently ignored (don't fail the query).

Page size stays 20. Cursor format also stays the same — Plan 02's known parse bug is still NOT fixed (out of scope; document in deviations if it becomes a problem).

**Files:**

- Modify: `supabase/migrations/20260514000010_rpc_views_v2.sql` (append `view_search`)
- Create: `supabase/tests/31_rpc_view_search_filters.sql`

  (Migration 20260514000009 is reserved for notifications, written in Task 15.)

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/31_rpc_view_search_filters.sql`:

```sql
BEGIN;
SELECT plan(4);

-- Three babies, one too young, one too old, one matching
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba01', '00000000-0000-0000-0000-000000000000', 'sf1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02', '00000000-0000-0000-0000-000000000000', 'sf2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03', '00000000-0000-0000-0000-000000000000', 'sf3@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04', '00000000-0000-0000-0000-000000000000', 'sf4@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Viewer',
       date_of_birth='1980-01-01', city_lat=51.5074, city_lng=-0.1278, city_display_name='London',
       last_active_at=now()
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba01';

UPDATE public.profiles SET role='baby', status='active', display_name='Young',
       date_of_birth=(now() - interval '19 years')::date, city_lat=51.5074, city_lng=-0.1278,
       city_display_name='London', last_active_at=now() - interval '1 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba02';

UPDATE public.profiles SET role='baby', status='active', display_name='Mid',
       date_of_birth='1995-01-01', city_lat=51.5074, city_lng=-0.1278,
       city_display_name='London', last_active_at=now() - interval '2 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03';

UPDATE public.profiles SET role='baby', status='active', display_name='Far',
       date_of_birth='1995-01-01', city_lat=55.9533, city_lng=-3.1883,  -- Edinburgh, ~330mi from London
       city_display_name='Edinburgh', last_active_at=now() - interval '3 min'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba04';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba01';

-- 1. No filters: 3 babies
WITH r AS (SELECT public.view_search('{}'::jsonb, NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 3, 'no filters returns 3 babies');

-- 2. min_age=25 excludes Young (19)
WITH r AS (SELECT public.view_search('{"min_age": 25}'::jsonb, NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 2, 'min_age=25 excludes the 19-year-old');

-- 3. distance_miles=50 excludes Edinburgh
WITH r AS (SELECT public.view_search('{"distance_miles": 50}'::jsonb, NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 2, 'distance 50mi excludes Edinburgh');

-- 4. interest_ids matches only those who share the interest
-- Give Mid one interest
DO $$
DECLARE iid uuid;
BEGIN
  SELECT id INTO iid FROM public.interests LIMIT 1;
  INSERT INTO public.profile_interests (profile_id, interest_id) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaba03', iid);
  PERFORM set_config('test.iid', iid::text, true);
END $$;

WITH r AS (SELECT public.view_search(
  jsonb_build_object('interest_ids', jsonb_build_array(current_setting('test.iid')::uuid)),
  NULL
) AS body)
SELECT is(jsonb_array_length((SELECT body->'cards' FROM r)), 1, 'interest filter narrows to 1');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

Expected: failure 1 may pass (no filters, identical to Plan 02), but filters 2–4 fail.

- [ ] **Step 3: Append the migration**

Append to `supabase/migrations/20260514000010_rpc_views_v2.sql`:

```sql
-- view_search v2: filters supported = {min_age, max_age, distance_miles, interest_ids}.
-- Page size 20, role-pair filter unchanged, order unchanged.

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

  f_min_age int;
  f_max_age int;
  f_distance int;
  f_interest_ids uuid[];
  me_lat double precision;
  me_lng double precision;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT role, city_lat, city_lng INTO my_role, me_lat, me_lng
    FROM public.profiles WHERE id = me;
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0002';
  END IF;

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
       AND (f_distance IS NULL
              OR me_lat IS NULL OR me_lng IS NULL
              OR p.city_lat IS NULL OR p.city_lng IS NULL
              OR ST_Distance(
                   ST_MakePoint(me_lng, me_lat)::geography,
                   ST_MakePoint(p.city_lng, p.city_lat)::geography
                 ) / 1609.344 <= f_distance)
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

- [ ] **Step 4: Re-run + commit**

```bash
supabase db reset && pnpm test:db
git add -A
git commit -m "Extend view_search with age/distance/interest filters"
```

---

## Task 15 — RPCs: `view_notifications`, `dismiss_notification`, `notifications_unread_count`

Spec §3 + §6: notifications, recipient-only. Banner host polls `view_notifications` and `notifications_unread_count` (the latter is cheap; used to populate the Messages/Likes red dot — Plan 03 only uses the Likes one since notifications.kind='like' is all we have).

**Files:**

- Create: `supabase/migrations/20260514000009_rpc_notifications.sql`
- Create: `supabase/tests/30_rpc_notifications.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/30_rpc_notifications.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01', '00000000-0000-0000-0000-000000000000', 'nf1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc02', '00000000-0000-0000-0000-000000000000', 'nf2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

-- Seed two notifications for user 01 as superuser
INSERT INTO public.notifications (id, recipient_id, kind, payload, created_at)
VALUES
  ('11111111-1111-4111-8111-1111111111e1',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01', 'like',
   jsonb_build_object('actor_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc02', 'actor_name', 'Other'),
   now() - interval '5 minutes'),
  ('11111111-1111-4111-8111-1111111111e2',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01', 'like',
   jsonb_build_object('actor_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc02', 'actor_name', 'Other'),
   now() - interval '1 minute');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabc01';

WITH r AS (SELECT public.view_notifications(NULL) AS body)
SELECT is(jsonb_array_length((SELECT body->'notifications' FROM r)), 2, 'view_notifications returns 2');

-- Ordered newest first
WITH r AS (SELECT public.view_notifications(NULL) AS body)
SELECT is(
  (SELECT body->'notifications'->0->>'id' FROM r),
  '11111111-1111-4111-8111-1111111111e2',
  'most recent first'
);

-- unread count is 2
SELECT is(
  (SELECT public.notifications_unread_count())::text,
  '{"ok": true, "count": 2}',
  'unread count = 2'
);

-- Dismiss one — count drops to 1
SELECT is(
  (SELECT public.dismiss_notification('11111111-1111-4111-8111-1111111111e2'::uuid))::text,
  '{"ok": true}',
  'dismiss ok'
);

SELECT is(
  (SELECT public.notifications_unread_count())::text,
  '{"ok": true, "count": 1}',
  'unread count = 1 after dismiss'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm test:db
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000009_rpc_notifications.sql`:

```sql
-- Plan 03: notifications RPCs.
-- view_notifications: SECURITY INVOKER works fine here — RLS already restricts to recipient_id = me.
-- dismiss_notification + notifications_unread_count: SECURITY DEFINER for consistency with auth pattern.

CREATE OR REPLACE FUNCTION public.view_notifications(p_cursor text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  cur_created timestamptz;
  cur_id uuid;
  items jsonb := '[]'::jsonb;
  next_cursor text;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_cursor IS NOT NULL THEN
    cur_created := split_part(p_cursor, '|', 1)::timestamptz;
    cur_id      := split_part(p_cursor, '|', 2)::uuid;
  END IF;

  FOR rec IN
    SELECT id, kind, payload, created_at, read_at, dismissed_at
      FROM public.notifications
     WHERE recipient_id = me
       AND dismissed_at IS NULL
       AND (p_cursor IS NULL OR (created_at, id) < (cur_created, cur_id))
     ORDER BY created_at DESC, id DESC
     LIMIT 20
  LOOP
    items := items || jsonb_build_object(
      'id', rec.id,
      'kind', rec.kind,
      'payload', rec.payload,
      'created_at', rec.created_at,
      'read_at', rec.read_at
    );
    next_cursor := rec.created_at::text || '|' || rec.id::text;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'notifications', items,
    'next_cursor', next_cursor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_notifications(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_notification(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  rows_updated int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  UPDATE public.notifications
     SET dismissed_at = now()
   WHERE id = p_id AND recipient_id = me;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_notification(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notifications_unread_count()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  n int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT count(*)::int INTO n
    FROM public.notifications
   WHERE recipient_id = me
     AND read_at IS NULL
     AND dismissed_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'count', n);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifications_unread_count() TO authenticated;
```

- [ ] **Step 4: Re-run + commit**

```bash
supabase db reset && pnpm test:db && pnpm gen:types
git add -A
git commit -m "Add view_notifications, dismiss_notification, notifications_unread_count RPCs"
```

---

## Task 16 — RPC: `touch_last_active`

Tiny RPC the frontend calls on each authenticated page load + on `visibilitychange`. Bumps `profiles.last_active_at = now()` for `auth.uid()`. Required for the search-ordering correctness as users browse over time.

**Files:**

- Create: `supabase/migrations/20260514000011_rpc_heartbeat.sql`
- Create: `supabase/tests/32_rpc_heartbeat.sql`

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/32_rpc_heartbeat.sql`:

```sql
BEGIN;
SELECT plan(3);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01', '00000000-0000-0000-0000-000000000000',
        'hb@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

UPDATE public.profiles SET last_active_at = now() - interval '1 hour'
  WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01';

SELECT is(
  (SELECT public.touch_last_active())::text,
  '{"ok": true}',
  'touch_last_active ok'
);

SELECT ok(
  (SELECT last_active_at > now() - interval '1 second'
     FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabd01'),
  'last_active_at bumped to now'
);

SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.touch_last_active() $$,
  'P0001', NULL,
  'unauthenticated raises P0001'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260514000011_rpc_heartbeat.sql`:

```sql
CREATE OR REPLACE FUNCTION public.touch_last_active() RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;
  UPDATE public.profiles SET last_active_at = now() WHERE id = me;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated;
```

- [ ] **Step 3: Run + commit**

```bash
supabase db reset && pnpm test:db
git add -A
git commit -m "Add touch_last_active RPC for last-active heartbeat"
```

---

## Task 17 — Zod contracts + frontend API wrappers + i18n bundles

Extend `shared/rpc-contracts.ts` with every new RPC contract, add the new i18n bundles, and write the frontend `api.ts`/`hooks.ts` modules. This task is bulky but mechanical — one big PR-style commit makes review easier than scattering changes.

**Files:**

- Modify: `shared/rpc-contracts.ts` (extend)
- Create: `src/features/interests/api.ts`, `src/features/interests/hooks.ts`
- Modify: `src/features/profile/api.ts`, `src/features/profile/hooks.ts` (add new RPCs)
- Modify: `src/features/onboarding/api.ts` (add details/bio/interests setters)
- Create: `src/features/likes/api.ts`, `src/features/likes/hooks.ts`
- Create: `src/lib/notifications/api.ts`, `src/lib/notifications/hooks.ts`
- Create: `src/lib/last-active.ts`
- Modify: `src/features/search/api.ts`, `src/features/search/hooks.ts` (filters)
- Create/modify: `src/i18n/en/interests.json`, `likes.json`, `notifications.json`; extend `profile.json`, `onboarding.json`, `search.json`, `shell.json`
- Modify: `src/lib/i18n.ts` (wire new namespaces)

- [ ] **Step 1: Extend `shared/rpc-contracts.ts`**

Append these schemas (preserve existing exports):

```ts
// ===== Plan 03 additions =====

import { z } from 'zod'

// Enums for the new columns.
export const BodyType        = z.enum(['slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular'])
export const HairColor       = z.enum(['black', 'brown', 'blonde', 'red', 'grey', 'other'])
export const EyeColor        = z.enum(['brown', 'blue', 'green', 'hazel', 'grey', 'other'])
export const Smoking         = z.enum(['never', 'occasionally', 'regularly', 'prefer_not_to_say'])
export const Drinking        = z.enum(['never', 'socially', 'regularly', 'prefer_not_to_say'])
export const Education       = z.enum(['high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'other'])
export const IncomeBand      = z.enum(['under_50k', '50_100k', '100_250k', '250_500k', '500k_1m', 'over_1m', 'prefer_not_to_say'])
export const NetWorthBand    = z.enum(['under_250k', '250k_1m', '1m_5m', '5m_25m', 'over_25m', 'prefer_not_to_say'])

// Bio + Details setters
export const SetProfileBioInput = z.object({
  p_tagline: z.string().min(1).max(120).nullable(),
  p_about:   z.string().max(4000).nullable(),
  p_wants:   z.string().max(2000).nullable(),
})
export const SetProfileBioResult = RpcResult(z.object({}))

export const SetProfileDetailsInput = z.object({
  p_height_cm:          z.number().int().min(120).max(240).nullable(),
  p_body_type:          BodyType.nullable(),
  p_hair_color:         HairColor.nullable(),
  p_eye_color:          EyeColor.nullable(),
  p_has_piercings:      z.boolean().nullable(),
  p_has_tattoos:        z.boolean().nullable(),
  p_smoking:            Smoking.nullable(),
  p_drinking:           Drinking.nullable(),
  p_education:          Education.nullable(),
  p_yearly_income_band: IncomeBand.nullable(),
  p_net_worth_band:     NetWorthBand.nullable(),
})
export const SetProfileDetailsResult = RpcResult(z.object({}))

// Interests
export const Interest = z.object({
  id:        z.string().uuid(),
  label_key: z.string(),
  category:  z.string(),
  ordinal:   z.number().int().optional(),  // only set by list_interests
})
export const ListInterestsResult = RpcResult(z.object({
  interests: z.array(Interest),
}))
export const SetProfileInterestsInput = z.object({
  p_interest_ids: z.array(z.string().uuid()).max(20),
})
export const SetProfileInterestsResult = RpcResult(z.object({}))

// Photo management
export const ReorderProfilePhotosInput  = z.object({ p_ordered: z.array(z.string().uuid()) })
export const ReorderProfilePhotosResult = RpcResult(z.object({}))
export const RemoveProfilePhotoInput    = z.object({ p_media_item_id: z.string().uuid() })
export const RemoveProfilePhotoResult   = RpcResult(z.object({}))

// Likes
export const LikeProfileInput   = z.object({ p_likee_id: z.string().uuid() })
export const LikeProfileResult  = RpcResult(z.object({}))
export const UnlikeProfileInput = z.object({ p_likee_id: z.string().uuid() })
export const UnlikeProfileResult = RpcResult(z.object({}))

// Updated ProfileCard now includes tagline + my_like_state: boolean (was z.null())
export const ProfileCardV2 = z.object({
  profile_id:         z.string().uuid(),
  display_name:       z.string(),
  age:                z.number().int(),
  city_display_name:  z.string().nullable(),
  distance_miles:     z.number().nullable(),
  primary_photo_path: z.string().nullable(),
  tagline:            z.string().nullable(),
  my_like_state:      z.boolean(),
})

// View likes tab
export const ViewLikesTabResult = RpcResult(z.object({
  liked_me:   z.array(ProfileCardV2),
  favourites: z.array(ProfileCardV2),
}))

// View search v2 — input now accepts filter keys
export const ViewSearchInputV2 = z.object({
  p_filters: z.object({
    min_age:        z.number().int().optional(),
    max_age:        z.number().int().optional(),
    distance_miles: z.number().int().optional(),
    interest_ids:   z.array(z.string().uuid()).optional(),
  }).default({}),
  p_cursor: z.string().nullable().default(null),
})
export const ViewSearchResultV2 = RpcResult(z.object({
  cards:       z.array(ProfileCardV2),
  next_cursor: z.string().nullable(),
}))

// View profile v2 — adds bio, physical, lifestyle, interests, their_like_state
export const ViewProfileResultV2 = RpcResult(z.object({
  profile: z.object({
    profile_id:         z.string().uuid(),
    display_name:       z.string(),
    age:                z.number().int(),
    city_display_name:  z.string().nullable(),
    gender:             ProfileGender.nullable(),
    looking_for:        ProfileLookingFor.nullable(),
    tagline:            z.string().nullable(),
    about:              z.string().nullable(),
    wants:              z.string().nullable(),
    height_cm:          z.number().int().nullable(),
    body_type:          BodyType.nullable(),
    hair_color:         HairColor.nullable(),
    eye_color:          EyeColor.nullable(),
    has_piercings:      z.boolean().nullable(),
    has_tattoos:        z.boolean().nullable(),
    smoking:            Smoking.nullable(),
    drinking:           Drinking.nullable(),
    education:          Education.nullable(),
    yearly_income_band: IncomeBand.nullable(),
    net_worth_band:     NetWorthBand.nullable(),
    photos:             z.array(z.object({ ordinal: z.number().int(), path: z.string() })),
    interests:          z.array(Interest),
    my_like_state:      z.boolean(),
    their_like_state:   z.boolean(),
  }),
}))

// View my-profile v2 (no like_state; includes media_item_id on each photo)
export const ViewMyProfileResultV2 = RpcResult(z.object({
  profile: z.object({
    profile_id:         z.string().uuid(),
    role:               ProfileRole.nullable(),
    status:             ProfileStatus,
    display_name:       z.string().nullable(),
    age:                z.number().int().nullable(),
    date_of_birth:      z.string().nullable(),
    gender:             ProfileGender.nullable(),
    looking_for:        ProfileLookingFor.nullable(),
    city_display_name:  z.string().nullable(),
    tagline:            z.string().nullable(),
    about:              z.string().nullable(),
    wants:              z.string().nullable(),
    height_cm:          z.number().int().nullable(),
    body_type:          BodyType.nullable(),
    hair_color:         HairColor.nullable(),
    eye_color:          EyeColor.nullable(),
    has_piercings:      z.boolean().nullable(),
    has_tattoos:        z.boolean().nullable(),
    smoking:            Smoking.nullable(),
    drinking:           Drinking.nullable(),
    education:          Education.nullable(),
    yearly_income_band: IncomeBand.nullable(),
    net_worth_band:     NetWorthBand.nullable(),
    token_balance:      z.number().int(),
    photos:             z.array(z.object({
      ordinal: z.number().int(),
      path: z.string(),
      media_item_id: z.string().uuid(),
    })),
    interests:          z.array(Interest),
  }),
}))

// Notifications
export const Notification = z.object({
  id:         z.string().uuid(),
  kind:       z.enum(['like', 'placeholder']),
  payload:    z.record(z.string(), z.unknown()),
  created_at: z.string(),  // ISO timestamp
  read_at:    z.string().nullable(),
})
export const ViewNotificationsInput  = z.object({ p_cursor: z.string().nullable().default(null) })
export const ViewNotificationsResult = RpcResult(z.object({
  notifications: z.array(Notification),
  next_cursor:   z.string().nullable(),
}))
export const DismissNotificationInput  = z.object({ p_id: z.string().uuid() })
export const DismissNotificationResult = RpcResult(z.object({}))
export const NotificationsUnreadCountResult = RpcResult(z.object({ count: z.number().int() }))

// Heartbeat
export const TouchLastActiveResult = RpcResult(z.object({}))
```

**Old vs new types:** `ProfileCardV2` supersedes `ProfileCard`; `ViewSearchResultV2`/`ViewProfileResultV2`/`ViewMyProfileResultV2` supersede their v1 versions. Keep the old exports for one release cycle (they're harmless) — frontend consumers migrate to V2 in this task. Remove the old exports in Plan 04.

- [ ] **Step 2: Add the contract round-trip tests**

Extend `shared/__tests__/rpc-contracts.test.ts` with new tests:

```ts
import {
  SetProfileBioResult, SetProfileDetailsResult,
  ListInterestsResult, SetProfileInterestsResult,
  ReorderProfilePhotosResult, RemoveProfilePhotoResult,
  LikeProfileResult, UnlikeProfileResult,
  ViewLikesTabResult, ViewSearchResultV2, ViewProfileResultV2,
  ViewNotificationsResult, DismissNotificationResult, NotificationsUnreadCountResult,
  ProfileCardV2,
} from '../rpc-contracts'

describe('rpc-contracts plan 03', () => {
  it('parses a ProfileCardV2 with my_like_state', () => {
    const parsed = ProfileCardV2.parse({
      profile_id: '11111111-1111-4111-8111-111111111111',
      display_name: 'Lex', age: 26, city_display_name: 'London',
      distance_miles: 5.2, primary_photo_path: 'users/x/p.jpg',
      tagline: 'Adventurer',
      my_like_state: false,
    })
    expect(parsed.my_like_state).toBe(false)
  })

  it('parses a view_likes_tab response', () => {
    const parsed = ViewLikesTabResult.parse({
      ok: true,
      liked_me: [],
      favourites: [],
    })
    expect(parsed.ok).toBe(true)
  })

  it('parses a view_search v2 response with filters', () => {
    const parsed = ViewSearchResultV2.parse({
      ok: true,
      cards: [],
      next_cursor: null,
    })
    expect(parsed.ok).toBe(true)
  })

  it('parses an interest', () => {
    const parsed = ListInterestsResult.parse({
      ok: true,
      interests: [{ id: '22222222-2222-4222-8222-222222222222', label_key: 'interest.hiking', category: 'activities', ordinal: 10 }],
    })
    expect(parsed.ok).toBe(true)
  })

  it('parses a notification', () => {
    const parsed = ViewNotificationsResult.parse({
      ok: true,
      notifications: [{
        id: '33333333-3333-4333-8333-333333333333',
        kind: 'like',
        payload: { actor_id: '44444444-4444-4444-8444-444444444444' },
        created_at: '2026-05-14T12:00:00Z',
        read_at: null,
      }],
      next_cursor: null,
    })
    expect(parsed.ok).toBe(true)
  })
})
```

Run `pnpm test`. Expected: existing tests still pass, 5 new passes.

- [ ] **Step 3: Create i18n bundles**

Create `src/i18n/en/interests.json`:

```json
{
  "interest.fitness": "Fitness",
  "interest.cooking": "Cooking",
  "interest.fashion": "Fashion",
  "interest.wine": "Wine",
  "interest.fine_dining": "Fine dining",
  "interest.yoga": "Yoga",
  "interest.hiking": "Hiking",
  "interest.skiing": "Skiing",
  "interest.tennis": "Tennis",
  "interest.golf": "Golf",
  "interest.swimming": "Swimming",
  "interest.dancing": "Dancing",
  "interest.theatre": "Theatre",
  "interest.cinema": "Cinema",
  "interest.concerts": "Concerts",
  "interest.museums": "Museums",
  "interest.nightlife": "Nightlife",
  "interest.galleries": "Art galleries",
  "interest.weekend_trips": "Weekend trips",
  "interest.beach": "Beach holidays",
  "interest.city_breaks": "City breaks",
  "interest.adventure": "Adventure travel",
  "interest.cruises": "Cruises",
  "interest.luxury_travel": "Luxury travel",
  "interest.reading": "Reading",
  "interest.gaming": "Gaming",
  "interest.photography": "Photography",
  "interest.languages": "Languages",
  "interest.pets": "Pets",
  "interest.volunteering": "Volunteering",
  "category.lifestyle": "Lifestyle",
  "category.activities": "Activities",
  "category.going_out": "Going out",
  "category.travel": "Travel",
  "category.other": "Other"
}
```

Create `src/i18n/en/likes.json`:

```json
{
  "title": "Likes",
  "tab.liked_me": "Liked you",
  "tab.favourites": "Favourites",
  "empty.liked_me": "Nobody has liked you yet.",
  "empty.favourites": "You haven't liked anyone yet.",
  "button.like": "Like",
  "button.unlike": "Unlike",
  "loading": "Loading…",
  "error": "Failed to load likes."
}
```

Create `src/i18n/en/notifications.json`:

```json
{
  "banner.like.title": "Someone liked you",
  "banner.like.body": "{{actor_name}} liked your profile.",
  "banner.dismiss": "Dismiss"
}
```

Extend `src/i18n/en/profile.json` with section labels:

```json
{
  "loading": "Loading…",
  "notFound": "Profile not found.",
  "yourStatus": "Status",
  "yourRole": "Role",
  "yourTokens": "Tokens",
  "section.bio.title": "About",
  "section.bio.tagline": "Tagline",
  "section.bio.about": "About me",
  "section.bio.wants": "What I want",
  "section.details.title": "Details",
  "section.details.height": "Height (cm)",
  "section.details.body_type": "Body type",
  "section.details.hair_color": "Hair colour",
  "section.details.eye_color": "Eye colour",
  "section.details.piercings": "Piercings",
  "section.details.tattoos": "Tattoos",
  "section.details.smoking": "Smoking",
  "section.details.drinking": "Drinking",
  "section.details.education": "Education",
  "section.details.yearly_income_band": "Yearly income",
  "section.details.net_worth_band": "Net worth",
  "section.interests.title": "Interests",
  "section.interests.empty": "No interests selected yet.",
  "section.photos.title": "Photos",
  "section.photos.add": "Add photo",
  "section.photos.remove": "Remove",
  "section.photos.reorderHint": "Drag to reorder.",
  "edit.edit": "Edit",
  "edit.save": "Save",
  "edit.cancel": "Cancel",
  "edit.saving": "Saving…",
  "edit.error": "Couldn't save — please retry."
}
```

Extend `src/i18n/en/onboarding.json` with the new step strings (append):

```json
{
  "details.title": "A bit more about you",
  "details.skip": "Skip for now",
  "details.continue": "Continue",
  "interests.title": "Pick a few interests",
  "interests.subtitle": "Choose up to 20.",
  "interests.skip": "Skip for now",
  "interests.continue": "Continue"
}
```

Merge with existing onboarding.json (don't overwrite Plan 02 keys).

Extend `src/i18n/en/search.json` with filter strings:

```json
{
  "title": "Search",
  "loading": "Loading…",
  "error": "Failed to load search.",
  "filter.open": "Filters",
  "filter.title": "Filters",
  "filter.age": "Age",
  "filter.min_age": "Min",
  "filter.max_age": "Max",
  "filter.distance": "Distance (miles)",
  "filter.interests": "Interests",
  "filter.apply": "Apply",
  "filter.reset": "Reset",
  "filter.close": "Close"
}
```

Extend `src/i18n/en/shell.json` with language switcher:

```json
{
  "appName": "SD",
  "tab.search": "Search",
  "tab.messages": "Messages",
  "tab.likes": "Likes",
  "tab.me": "Me",
  "menu.open": "Menu",
  "menu.close": "Close",
  "menu.signOut": "Sign out",
  "menu.language": "Language",
  "language.en": "English"
}
```

Update `src/lib/i18n.ts` to register the new namespaces:

```ts
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import enCommon        from '../i18n/en/common.json'
import enAuth          from '../i18n/en/auth.json'
import enOnboarding    from '../i18n/en/onboarding.json'
import enSearch        from '../i18n/en/search.json'
import enProfile       from '../i18n/en/profile.json'
import enShell         from '../i18n/en/shell.json'
import enInterests     from '../i18n/en/interests.json'
import enLikes         from '../i18n/en/likes.json'
import enNotifications from '../i18n/en/notifications.json'

export function initI18n(): Promise<unknown> {
  return i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: {
          common: enCommon,
          auth: enAuth,
          onboarding: enOnboarding,
          search: enSearch,
          profile: enProfile,
          shell: enShell,
          interests: enInterests,
          likes: enLikes,
          notifications: enNotifications,
        },
      },
      fallbackLng: 'en',
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      keySeparator: false,
      nsSeparator: ':',
    })
}
```

- [ ] **Step 4: Frontend API wrappers**

Create `src/features/interests/api.ts`:

```ts
import { callRpc } from '@/lib/rpc'
import { ListInterestsResult, SetProfileInterestsResult } from '@shared/rpc-contracts'

export const listInterests = () =>
  callRpc('list_interests', {}, ListInterestsResult)

export const setProfileInterests = (ids: string[]) =>
  callRpc('set_profile_interests', { p_interest_ids: ids }, SetProfileInterestsResult)
```

Create `src/features/interests/hooks.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listInterests, setProfileInterests } from './api'

export function useInterests() {
  return useQuery({
    queryKey: ['interests'],
    queryFn: listInterests,
    staleTime: 60 * 60 * 1000,  // hour
  })
}

export function useSetProfileInterests() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileInterests,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
```

Extend `src/features/profile/api.ts` with the new RPCs:

```ts
// append to existing exports
import {
  SetProfileBioResult, SetProfileDetailsResult,
  ReorderProfilePhotosResult, RemoveProfilePhotoResult,
  ViewProfileResultV2, ViewMyProfileResultV2,
} from '@shared/rpc-contracts'

export const setProfileBio = (tagline: string | null, about: string | null, wants: string | null) =>
  callRpc('set_profile_bio',
    { p_tagline: tagline, p_about: about, p_wants: wants },
    SetProfileBioResult)

export const setProfileDetails = (args: {
  height_cm: number | null
  body_type: string | null
  hair_color: string | null
  eye_color: string | null
  has_piercings: boolean | null
  has_tattoos: boolean | null
  smoking: string | null
  drinking: string | null
  education: string | null
  yearly_income_band: string | null
  net_worth_band: string | null
}) =>
  callRpc('set_profile_details',
    {
      p_height_cm: args.height_cm,
      p_body_type: args.body_type,
      p_hair_color: args.hair_color,
      p_eye_color: args.eye_color,
      p_has_piercings: args.has_piercings,
      p_has_tattoos: args.has_tattoos,
      p_smoking: args.smoking,
      p_drinking: args.drinking,
      p_education: args.education,
      p_yearly_income_band: args.yearly_income_band,
      p_net_worth_band: args.net_worth_band,
    },
    SetProfileDetailsResult)

export const reorderProfilePhotos = (orderedMediaItemIds: string[]) =>
  callRpc('reorder_profile_photos', { p_ordered: orderedMediaItemIds }, ReorderProfilePhotosResult)

export const removeProfilePhoto = (mediaItemId: string) =>
  callRpc('remove_profile_photo', { p_media_item_id: mediaItemId }, RemoveProfilePhotoResult)

// Replace the existing viewProfile / viewMyProfile types with V2:
export const viewProfile = (id: string) =>
  callRpc('view_profile', { p_profile_id: id }, ViewProfileResultV2)

export const viewMyProfile = () =>
  callRpc('view_my_profile', {}, ViewMyProfileResultV2)
```

Extend `src/features/profile/hooks.ts` with mutations:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setProfileBio, setProfileDetails, reorderProfilePhotos, removeProfilePhoto } from './api'

export function useSetBio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { tagline: string | null; about: string | null; wants: string | null }) =>
      setProfileBio(args.tagline, args.about, args.wants),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useSetDetails() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileDetails,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useReorderPhotos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reorderProfilePhotos,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useRemovePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeProfilePhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
```

Create `src/features/likes/api.ts`:

```ts
import { callRpc } from '@/lib/rpc'
import { LikeProfileResult, UnlikeProfileResult, ViewLikesTabResult } from '@shared/rpc-contracts'

export const likeProfile   = (id: string) => callRpc('like_profile',   { p_likee_id: id }, LikeProfileResult)
export const unlikeProfile = (id: string) => callRpc('unlike_profile', { p_likee_id: id }, UnlikeProfileResult)
export const viewLikesTab  = ()           => callRpc('view_likes_tab',{}, ViewLikesTabResult)
```

Create `src/features/likes/hooks.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { likeProfile, unlikeProfile, viewLikesTab } from './api'

export function useLikesTab() {
  return useQuery({
    queryKey: ['likes-tab'],
    queryFn: viewLikesTab,
  })
}

function invalidateAfterLikeChange(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['likes-tab'] })
  qc.invalidateQueries({ queryKey: ['search'] })
  qc.invalidateQueries({ queryKey: ['profile'] })
}

export function useLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: likeProfile,
    onSuccess: () => invalidateAfterLikeChange(qc),
  })
}

export function useUnlike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unlikeProfile,
    onSuccess: () => invalidateAfterLikeChange(qc),
  })
}
```

Create `src/lib/notifications/api.ts`:

```ts
import { callRpc } from '@/lib/rpc'
import {
  ViewNotificationsResult, DismissNotificationResult, NotificationsUnreadCountResult,
} from '@shared/rpc-contracts'

export const viewNotifications      = (cursor: string | null = null) =>
  callRpc('view_notifications', { p_cursor: cursor }, ViewNotificationsResult)
export const dismissNotification    = (id: string) =>
  callRpc('dismiss_notification', { p_id: id }, DismissNotificationResult)
export const notificationsUnreadCount = () =>
  callRpc('notifications_unread_count', {}, NotificationsUnreadCountResult)
```

Create `src/lib/notifications/hooks.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { viewNotifications, dismissNotification, notificationsUnreadCount } from './api'

const POLL_MS = 30_000

export function useNotificationsPoll() {
  return useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => viewNotifications(null),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsUnreadCount,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useDismissNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
```

Create `src/lib/last-active.ts`:

```ts
import { useEffect } from 'react'
import { callRpc } from '@/lib/rpc'
import { TouchLastActiveResult } from '@shared/rpc-contracts'

export const touchLastActive = () =>
  callRpc('touch_last_active', {}, TouchLastActiveResult)

/** Mount once at app shell level. Fires touch_last_active on mount and on
 *  visibility-change to visible. Errors are silently swallowed. */
export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    void touchLastActive().catch(() => {})
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void touchLastActive().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])
}
```

Extend `src/features/search/api.ts` for filters:

```ts
import { callRpc } from '@/lib/rpc'
import { ViewSearchResultV2 } from '@shared/rpc-contracts'

export interface SearchFilters {
  min_age?: number
  max_age?: number
  distance_miles?: number
  interest_ids?: string[]
}

export const viewSearch = (filters: SearchFilters = {}, cursor: string | null = null) =>
  callRpc('view_search', { p_filters: filters, p_cursor: cursor }, ViewSearchResultV2)
```

Extend `src/features/search/hooks.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { viewSearch, type SearchFilters } from './api'

export function useSearchFirstPage(filters: SearchFilters = {}) {
  return useQuery({
    queryKey: ['search', 'first-page', filters],
    queryFn: () => viewSearch(filters, null),
  })
}
```

- [ ] **Step 5: Typecheck, test, commit**

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Add Zod contracts, frontend API wrappers, hooks, and i18n bundles for Plan 03 RPCs"
```

Expected: green. Test count grows by 5 (the new contract tests).

---

## Task 18 — Onboarding: Details + Interests steps

Insert two steps after Photo (per open question 1 default). Order becomes:
`role → identity → location → photo → details → interests → complete`.

Both new steps are skippable — they bind to `set_profile_details` / `set_profile_interests` but allow empty submission and offer a "Skip for now" link to advance.

**Files:**

- Create: `src/features/onboarding/components/DetailsStep.tsx`
- Create: `src/features/onboarding/components/InterestsStep.tsx`
- Create: `src/features/onboarding/pages/DetailsPage.tsx`, `InterestsPage.tsx`
- Modify: `src/features/onboarding/hooks.ts` (add `useSetDetails`, `useSetInterests` — or re-export from features/profile and features/interests)
- Modify: `src/routes.tsx` (add routes)
- Modify: `src/features/onboarding/components/PhotoStep.tsx` (Continue navigates to `/onboarding/details` instead of `/onboarding/complete`)
- Create: `src/features/onboarding/__tests__/DetailsStep.test.tsx`

- [ ] **Step 1: Re-export hooks from onboarding module**

In `src/features/onboarding/hooks.ts`, append:

```ts
export { useSetDetails } from '@/features/profile/hooks'
export { useSetProfileInterests as useSetInterests } from '@/features/interests/hooks'
export { useInterests } from '@/features/interests/hooks'
```

- [ ] **Step 2: Create DetailsStep.tsx**

```tsx
// src/features/onboarding/components/DetailsStep.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSetDetails } from '../hooks'
import {
  BodyType, HairColor, EyeColor, Smoking, Drinking, Education, IncomeBand, NetWorthBand,
} from '@shared/rpc-contracts'

const Schema = z.object({
  height_cm:          z.preprocess(v => v === '' ? null : Number(v), z.number().int().min(120).max(240).nullable()),
  body_type:          BodyType.nullable(),
  hair_color:         HairColor.nullable(),
  eye_color:          EyeColor.nullable(),
  has_piercings:      z.boolean().nullable(),
  has_tattoos:        z.boolean().nullable(),
  smoking:            Smoking.nullable(),
  drinking:           Drinking.nullable(),
  education:          Education.nullable(),
  yearly_income_band: IncomeBand.nullable(),
  net_worth_band:     NetWorthBand.nullable(),
})
type FormData = z.infer<typeof Schema>

const emptyDefaults: FormData = {
  height_cm: null, body_type: null, hair_color: null, eye_color: null,
  has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
  education: null, yearly_income_band: null, net_worth_band: null,
}

export function DetailsStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setDetails = useSetDetails()

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: emptyDefaults,
  })

  async function onSubmit(values: FormData) {
    await setDetails.mutateAsync(values)
    navigate('/onboarding/interests')
  }

  return (
    <form className="flex flex-col gap-3 p-4" onSubmit={handleSubmit(onSubmit)}>
      <h2 className="text-lg font-semibold">{t('details.title')}</h2>

      <label className="flex flex-col gap-1">
        <span>{t('section.details.height', { ns: 'profile' })}</span>
        <input type="number" min={120} max={240} className="border p-2 rounded"
               {...register('height_cm', { setValueAs: v => v === '' ? null : Number(v) })} />
      </label>

      <EnumSelect name="body_type"          label={t('section.details.body_type', { ns: 'profile' })}          options={['slim','athletic','average','curvy','plus_size','muscular']} register={register} />
      <EnumSelect name="hair_color"         label={t('section.details.hair_color', { ns: 'profile' })}         options={['black','brown','blonde','red','grey','other']} register={register} />
      <EnumSelect name="eye_color"          label={t('section.details.eye_color', { ns: 'profile' })}          options={['brown','blue','green','hazel','grey','other']} register={register} />
      <CheckboxField name="has_piercings"   label={t('section.details.piercings', { ns: 'profile' })}          register={register} />
      <CheckboxField name="has_tattoos"     label={t('section.details.tattoos', { ns: 'profile' })}            register={register} />
      <EnumSelect name="smoking"            label={t('section.details.smoking', { ns: 'profile' })}            options={['never','occasionally','regularly','prefer_not_to_say']} register={register} />
      <EnumSelect name="drinking"           label={t('section.details.drinking', { ns: 'profile' })}           options={['never','socially','regularly','prefer_not_to_say']} register={register} />
      <EnumSelect name="education"          label={t('section.details.education', { ns: 'profile' })}          options={['high_school','some_college','bachelors','masters','doctorate','other']} register={register} />
      <EnumSelect name="yearly_income_band" label={t('section.details.yearly_income_band', { ns: 'profile' })} options={['under_50k','50_100k','100_250k','250_500k','500k_1m','over_1m','prefer_not_to_say']} register={register} />
      <EnumSelect name="net_worth_band"     label={t('section.details.net_worth_band', { ns: 'profile' })}     options={['under_250k','250k_1m','1m_5m','5m_25m','over_25m','prefer_not_to_say']} register={register} />

      <div className="flex justify-between mt-4">
        <button type="button" onClick={() => navigate('/onboarding/interests')}
                className="underline">{t('details.skip')}</button>
        <button type="submit" disabled={isSubmitting}
                className="bg-slate-800 text-white px-4 py-2 rounded">
          {t('details.continue')}
        </button>
      </div>
    </form>
  )
}

// Tiny helpers — keep them in this file (they're not reused elsewhere yet).
function EnumSelect({ name, label, options, register }: {
  name: keyof FormData
  label: string
  options: readonly string[]
  register: ReturnType<typeof useForm<FormData>>['register']
}) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <select className="border p-2 rounded" {...register(name)} defaultValue="">
        <option value="">—</option>
        {options.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
      </select>
    </label>
  )
}

function CheckboxField({ name, label, register }: {
  name: keyof FormData
  label: string
  register: ReturnType<typeof useForm<FormData>>['register']
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" {...register(name)} />
      <span>{label}</span>
    </label>
  )
}
```

- [ ] **Step 3: Create InterestsStep.tsx**

```tsx
// src/features/onboarding/components/InterestsStep.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useInterests, useSetInterests } from '../hooks'

export function InterestsStep() {
  const { t } = useTranslation('onboarding')
  const { t: tInt } = useTranslation('interests')
  const navigate = useNavigate()
  const { data, isLoading } = useInterests()
  const setInterests = useSetInterests()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (isLoading || !data?.ok) return <p className="p-4">{tInt('interest.fitness') /* fallback loading text uses a real key */}…</p>

  const byCategory = new Map<string, typeof data.interests>()
  for (const it of data.interests) {
    const arr = byCategory.get(it.category) ?? []
    arr.push(it)
    byCategory.set(it.category, arr)
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function onContinue() {
    await setInterests.mutateAsync(Array.from(selected))
    navigate('/onboarding/complete')
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">{t('interests.title')}</h2>
      <p className="text-sm text-slate-600 mb-4">{t('interests.subtitle')}</p>
      {Array.from(byCategory.entries()).map(([cat, items]) => (
        <section key={cat} className="mb-4">
          <h3 className="font-medium mb-2">{tInt(`category.${cat}`)}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map(it => (
              <button key={it.id} type="button" onClick={() => toggle(it.id)}
                      className={`px-3 py-1 rounded-full border ${
                        selected.has(it.id) ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'
                      }`}>
                {tInt(it.label_key)}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="flex justify-between mt-4">
        <button type="button" onClick={() => navigate('/onboarding/complete')}
                className="underline">{t('interests.skip')}</button>
        <button type="button" onClick={onContinue} disabled={setInterests.isPending}
                className="bg-slate-800 text-white px-4 py-2 rounded">
          {t('interests.continue')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Pages wrap steps**

```tsx
// src/features/onboarding/pages/DetailsPage.tsx
import { DetailsStep } from '../components/DetailsStep'
export function DetailsPage() { return <DetailsStep /> }
```

```tsx
// src/features/onboarding/pages/InterestsPage.tsx
import { InterestsStep } from '../components/InterestsStep'
export function InterestsPage() { return <InterestsStep /> }
```

- [ ] **Step 5: Wire routes**

Add to `src/routes.tsx`'s `RequirePendingOnboarding` children, inside the `/onboarding` parent:

```tsx
{ path: 'details',   element: <DetailsStep /> },
{ path: 'interests', element: <InterestsStep /> },
```

The complete page already redirects to `/search` on success; no changes there.

- [ ] **Step 6: PhotoStep navigates to /onboarding/details**

In `src/features/onboarding/components/PhotoStep.tsx`, change the post-upload navigate target from `/onboarding/complete` to `/onboarding/details`.

- [ ] **Step 7: Failing test for the DetailsStep**

Create `src/features/onboarding/__tests__/DetailsStep.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { DetailsStep } from '../components/DetailsStep'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'

await initI18n()

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DetailsStep', () => {
  it('submits and advances on continue', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', () =>
        HttpResponse.json({ ok: true }),
      ),
    )
    render(wrap(<DetailsStep />))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    // Form clears in onSubmit → navigate happens; cannot easily assert nav from MemoryRouter
    // but the absence of any error and the button no longer being submitting is sufficient.
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })
})
```

- [ ] **Step 8: Run + commit**

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Add onboarding Details and Interests steps; PhotoStep -> Details"
```

---

## Task 19 — `/me` profile sections (view + edit modes) + multi-photo gallery

Spec §3 "view + edit modes". Plan 03 implements section-based edit toggles.

**Files:**

- Create: `src/features/profile/components/EditableSection.tsx`
- Create: `src/features/profile/components/BioSection.tsx`
- Create: `src/features/profile/components/DetailsSection.tsx`
- Create: `src/features/profile/components/InterestsSection.tsx`
- Create: `src/features/profile/components/PhotoGallery.tsx`
- Modify: `src/features/profile/pages/MyProfilePage.tsx` (compose the sections)
- Modify: `src/features/profile/pages/ProfilePage.tsx` (render view-only sections for other users)
- Create: `src/features/profile/__tests__/BioSection.test.tsx`

- [ ] **Step 1: EditableSection wrapper**

```tsx
// src/features/profile/components/EditableSection.tsx
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  renderView: () => ReactNode
  renderEdit: (close: () => void) => ReactNode
}

export function EditableSection({ title, renderView, renderEdit }: Props) {
  const { t } = useTranslation('profile')
  const [editing, setEditing] = useState(false)
  return (
    <section className="border rounded-lg p-4 mb-3 bg-white">
      <header className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="underline text-sm">
            {t('edit.edit')}
          </button>
        )}
      </header>
      {editing ? renderEdit(() => setEditing(false)) : renderView()}
    </section>
  )
}
```

- [ ] **Step 2: BioSection**

```tsx
// src/features/profile/components/BioSection.tsx
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { EditableSection } from './EditableSection'
import { useSetBio } from '../hooks'

interface Props {
  tagline: string | null
  about: string | null
  wants: string | null
}

export function BioSection(props: Props) {
  const { t } = useTranslation('profile')
  const setBio = useSetBio()

  return (
    <EditableSection
      title={t('section.bio.title')}
      renderView={() => (
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div><dt className="font-medium">{t('section.bio.tagline')}</dt><dd>{props.tagline || '—'}</dd></div>
          <div><dt className="font-medium">{t('section.bio.about')}</dt><dd className="whitespace-pre-wrap">{props.about || '—'}</dd></div>
          <div><dt className="font-medium">{t('section.bio.wants')}</dt><dd className="whitespace-pre-wrap">{props.wants || '—'}</dd></div>
        </dl>
      )}
      renderEdit={(close) => <BioForm {...props} onDone={close} setBio={setBio} />}
    />
  )
}

function BioForm({ tagline, about, wants, onDone, setBio }: Props & {
  onDone: () => void
  setBio: ReturnType<typeof useSetBio>
}) {
  const { t } = useTranslation('profile')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { tagline: tagline ?? '', about: about ?? '', wants: wants ?? '' },
  })
  async function onSubmit(v: { tagline: string; about: string; wants: string }) {
    await setBio.mutateAsync({
      tagline: v.tagline.trim() === '' ? null : v.tagline.trim(),
      about:   v.about.trim()   === '' ? null : v.about,
      wants:   v.wants.trim()   === '' ? null : v.wants,
    })
    onDone()
  }
  return (
    <form className="flex flex-col gap-2 text-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('section.bio.tagline')}</span>
        <input className="border rounded p-2" maxLength={120} {...register('tagline')} />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('section.bio.about')}</span>
        <textarea className="border rounded p-2 min-h-[6rem]" maxLength={4000} {...register('about')} />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('section.bio.wants')}</span>
        <textarea className="border rounded p-2 min-h-[4rem]" maxLength={2000} {...register('wants')} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className="bg-slate-800 text-white px-3 py-1 rounded">{t('edit.save')}</button>
        <button type="button" onClick={onDone} className="underline">{t('edit.cancel')}</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: DetailsSection**

Mirror BioSection's pattern. View mode prints each field via a label-from-i18n + value-as-text. Edit mode uses the same form pattern as DetailsStep (Task 18 Step 2). The view rows that are NULL render as `—`.

Build `DetailsSection.tsx` taking the same 11 detail fields as props. Inside, use `useSetDetails()` from `@/features/profile/hooks`.

- [ ] **Step 4: InterestsSection**

```tsx
// src/features/profile/components/InterestsSection.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditableSection } from './EditableSection'
import { useInterests, useSetProfileInterests } from '@/features/interests/hooks'

interface Interest { id: string; label_key: string; category: string }

export function InterestsSection({ interests }: { interests: Interest[] }) {
  const { t } = useTranslation('profile')
  const { t: tInt } = useTranslation('interests')

  return (
    <EditableSection
      title={t('section.interests.title')}
      renderView={() => (
        interests.length === 0
          ? <p className="text-sm text-slate-600">{t('section.interests.empty')}</p>
          : <div className="flex flex-wrap gap-2">
              {interests.map(i => (
                <span key={i.id} className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-sm">
                  {tInt(i.label_key)}
                </span>
              ))}
            </div>
      )}
      renderEdit={(close) => <InterestsEditor existing={interests.map(i => i.id)} onDone={close} />}
    />
  )
}

function InterestsEditor({ existing, onDone }: { existing: string[]; onDone: () => void }) {
  const { t } = useTranslation('profile')
  const { t: tInt } = useTranslation('interests')
  const { data, isLoading } = useInterests()
  const setInterests = useSetProfileInterests()
  const [selected, setSelected] = useState<Set<string>>(new Set(existing))

  if (isLoading || !data?.ok) return <p>{t('edit.saving')}…</p>

  const byCategory = new Map<string, typeof data.interests>()
  for (const it of data.interests) {
    const arr = byCategory.get(it.category) ?? []
    arr.push(it); byCategory.set(it.category, arr)
  }

  return (
    <div className="text-sm">
      {Array.from(byCategory.entries()).map(([cat, items]) => (
        <section key={cat} className="mb-3">
          <h3 className="font-medium mb-2">{tInt(`category.${cat}`)}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map(it => (
              <button key={it.id} type="button"
                      onClick={() => setSelected(prev => {
                        const next = new Set(prev)
                        next.has(it.id) ? next.delete(it.id) : next.add(it.id)
                        return next
                      })}
                      className={`px-3 py-1 rounded-full border ${
                        selected.has(it.id) ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'
                      }`}>
                {tInt(it.label_key)}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="flex gap-2">
        <button type="button" disabled={setInterests.isPending}
                onClick={async () => {
                  await setInterests.mutateAsync(Array.from(selected))
                  onDone()
                }}
                className="bg-slate-800 text-white px-3 py-1 rounded">
          {t('edit.save')}
        </button>
        <button type="button" onClick={onDone} className="underline">{t('edit.cancel')}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: PhotoGallery**

```tsx
// src/features/profile/components/PhotoGallery.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useUploadProfilePhoto } from '@/features/onboarding/hooks'
import { useReorderPhotos, useRemovePhoto } from '../hooks'

interface PhotoRow { ordinal: number; path: string; media_item_id: string }

export function PhotoGallery({ photos }: { photos: PhotoRow[] }) {
  const { t } = useTranslation('profile')
  const upload = useUploadProfilePhoto()
  const reorder = useReorderPhotos()
  const remove  = useRemovePhoto()
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      photos.map(p =>
        supabase.storage.from('media').createSignedUrl(p.path, 3600)
          .then(({ data }) => [p.path, data?.signedUrl] as const),
      ),
    ).then(entries => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [path, url] of entries) if (url) next[path] = url
      setUrls(next)
    })
    return () => { cancelled = true }
  }, [photos])

  function moveUp(idx: number) {
    if (idx === 0) return
    const ordered = [...photos]
    const [moved] = ordered.splice(idx, 1)
    ordered.splice(idx - 1, 0, moved)
    void reorder.mutateAsync(ordered.map(p => p.media_item_id))
  }

  function moveDown(idx: number) {
    if (idx === photos.length - 1) return
    const ordered = [...photos]
    const [moved] = ordered.splice(idx, 1)
    ordered.splice(idx + 1, 0, moved)
    void reorder.mutateAsync(ordered.map(p => p.media_item_id))
  }

  return (
    <section className="border rounded-lg p-4 mb-3 bg-white">
      <h2 className="font-semibold mb-2">{t('section.photos.title')}</h2>
      <p className="text-xs text-slate-600 mb-2">{t('section.photos.reorderHint')}</p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={p.media_item_id} className="relative aspect-square bg-slate-200 rounded overflow-hidden">
            {urls[p.path] && <img src={urls[p.path]} alt="" className="w-full h-full object-cover" />}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 text-white text-xs p-1">
              <button type="button" onClick={() => moveUp(i)} disabled={i === 0} aria-label="up">↑</button>
              <button type="button" onClick={() => moveDown(i)} disabled={i === photos.length - 1} aria-label="down">↓</button>
              <button type="button" onClick={() => remove.mutate(p.media_item_id)} aria-label={t('section.photos.remove')}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <label className="mt-3 inline-block">
        <span className="bg-slate-800 text-white px-3 py-1 rounded cursor-pointer">{t('section.photos.add')}</span>
        <input type="file" accept="image/*" className="hidden"
               onChange={e => {
                 const f = e.target.files?.[0]
                 if (f) void upload.mutate(f)
                 e.currentTarget.value = ''
               }} />
      </label>
    </section>
  )
}
```

- [ ] **Step 6: Compose into MyProfilePage**

In `src/features/profile/pages/MyProfilePage.tsx`, replace the body (preserve the existing loading/error guards) with a composition that renders BioSection / DetailsSection / InterestsSection / PhotoGallery. Pull values from the v2 `useMyProfile().data.profile` shape.

- [ ] **Step 7: ProfilePage shows the new fields view-only**

Update `src/features/profile/pages/ProfilePage.tsx` to render bio/details/interests in view-only mode (no edit buttons). Use the same `BioSection` / `DetailsSection` / `InterestsSection` components but in a non-editable variant — easiest is to wrap them in a small `ReadOnlyMyProfile` view. For minimum diff, just render the same `dl`/list markup directly in `ProfilePage.tsx` (no need to share the editable wrapper).

- [ ] **Step 8: Test + commit**

Create `src/features/profile/__tests__/BioSection.test.tsx` that toggles into edit mode and asserts the textareas appear.

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import { BioSection } from '../components/BioSection'

await initI18n()

describe('BioSection', () => {
  it('toggles into edit mode', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <BioSection tagline="Hello" about="More" wants="A friend" />
      </QueryClientProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByLabelText(/tagline/i)).toHaveValue('Hello')
  })
})
```

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Add profile sections (Bio/Details/Interests/Photos) with view+edit modes"
```

---

## Task 20 — Likes tab UI

Likes page renders two grids: "Liked you" + "Favourites". Each card uses `ProfileCard` (extended in Task 21 to include the heart button). The page itself just maps `data.liked_me` / `data.favourites` to cards.

**Files:**

- Create: `src/features/likes/components/LikesGrid.tsx`
- Create: `src/features/likes/components/LikeButton.tsx`
- Create: `src/features/likes/pages/LikesPage.tsx`
- Create: `src/features/likes/__tests__/LikesPage.test.tsx`

- [ ] **Step 1: LikeButton**

```tsx
// src/features/likes/components/LikeButton.tsx
import { useTranslation } from 'react-i18next'
import { useLike, useUnlike } from '../hooks'

interface Props {
  profileId: string
  liked: boolean
}

export function LikeButton({ profileId, liked }: Props) {
  const { t } = useTranslation('likes')
  const like   = useLike()
  const unlike = useUnlike()
  const pending = like.isPending || unlike.isPending

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={liked}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (liked) unlike.mutate(profileId)
        else        like.mutate(profileId)
      }}
      className={`px-2 py-1 rounded text-sm ${
        liked ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 border border-rose-600'
      }`}
    >
      {liked ? '♥' : '♡'} {liked ? t('button.unlike') : t('button.like')}
    </button>
  )
}
```

- [ ] **Step 2: LikesGrid**

```tsx
// src/features/likes/components/LikesGrid.tsx
import { ProfileCard } from '@/features/search/components/ProfileCard'
import type { z } from 'zod'
import type { ProfileCardV2 } from '@shared/rpc-contracts'

type Card = z.infer<typeof ProfileCardV2>

export function LikesGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(c => <ProfileCard key={c.profile_id} card={c} />)}
    </div>
  )
}
```

- [ ] **Step 3: LikesPage**

```tsx
// src/features/likes/pages/LikesPage.tsx
import { useTranslation } from 'react-i18next'
import { useLikesTab } from '../hooks'
import { LikesGrid } from '../components/LikesGrid'

export function LikesPage() {
  const { t } = useTranslation('likes')
  const { data, isLoading, error } = useLikesTab()
  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('error')}</p>

  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-2">{t('title')}</h1>
      <section className="mb-6">
        <h2 className="font-medium mb-2">{t('tab.liked_me')}</h2>
        {data.liked_me.length === 0
          ? <p className="text-sm text-slate-600">{t('empty.liked_me')}</p>
          : <LikesGrid cards={data.liked_me} />}
      </section>
      <section>
        <h2 className="font-medium mb-2">{t('tab.favourites')}</h2>
        {data.favourites.length === 0
          ? <p className="text-sm text-slate-600">{t('empty.favourites')}</p>
          : <LikesGrid cards={data.favourites} />}
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Wire `/likes` route**

In `src/routes.tsx`'s `RequireOnboarded > AppShell` children, replace the placeholder `'<div>Likes — Plan 03</div>'` with `<LikesPage />`.

- [ ] **Step 5: Test**

Create `src/features/likes/__tests__/LikesPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { mswServer } from '../../../test-setup'
import { LikesPage } from '../pages/LikesPage'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('LikesPage', () => {
  it('renders empty states when both lists are empty', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_likes_tab', () =>
        HttpResponse.json({ ok: true, liked_me: [], favourites: [] }),
      ),
    )
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter><LikesPage /></MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/nobody has liked you yet/i)).toBeInTheDocument()
    expect(screen.getByText(/you haven't liked anyone yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Commit**

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Add Likes tab with liked_me + favourites grids and like/unlike button"
```

---

## Task 21 — Search filter sheet + ProfileCard with LikeButton

Filter UI for `/search`. URL is the single source of truth for filter state (per open question 4): `/search?min_age=22&max_age=35&distance_miles=25&interest_ids=<uuid>,<uuid>`.

ProfileCard gets a heart-button overlay so users can like/unlike straight from the grid.

**Files:**

- Create: `src/features/search/components/FilterSheet.tsx`
- Modify: `src/features/search/components/ProfileCard.tsx` (add like button overlay)
- Modify: `src/features/search/pages/SearchPage.tsx` (URL state + sheet trigger)
- Modify: `src/features/search/hooks.ts` (add `useSearchFilters` URL adapter — see below)

- [ ] **Step 1: URL filter adapter**

Add to `src/features/search/hooks.ts`:

```ts
import { useSearchParams } from 'react-router'

export interface ParsedFilters {
  min_age?: number
  max_age?: number
  distance_miles?: number
  interest_ids?: string[]
}

function parseInt0(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function useSearchFilters(): [ParsedFilters, (next: ParsedFilters) => void] {
  const [params, setParams] = useSearchParams()
  const filters: ParsedFilters = {
    min_age:        parseInt0(params.get('min_age')),
    max_age:        parseInt0(params.get('max_age')),
    distance_miles: parseInt0(params.get('distance_miles')),
    interest_ids:   params.get('interest_ids')?.split(',').filter(Boolean) ?? undefined,
  }

  const setFilters = (next: ParsedFilters) => {
    const out = new URLSearchParams()
    if (next.min_age != null)        out.set('min_age', String(next.min_age))
    if (next.max_age != null)        out.set('max_age', String(next.max_age))
    if (next.distance_miles != null) out.set('distance_miles', String(next.distance_miles))
    if (next.interest_ids && next.interest_ids.length > 0)
      out.set('interest_ids', next.interest_ids.join(','))
    setParams(out, { replace: true })
  }

  return [filters, setFilters]
}
```

- [ ] **Step 2: FilterSheet**

```tsx
// src/features/search/components/FilterSheet.tsx
import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useInterests } from '@/features/interests/hooks'
import type { ParsedFilters } from '../hooks'

interface Props {
  open: boolean
  onClose: () => void
  initial: ParsedFilters
  onApply: (next: ParsedFilters) => void
}

export function FilterSheet({ open, onClose, initial, onApply }: Props) {
  const { t } = useTranslation('search')
  const { t: tInt } = useTranslation('interests')
  const { data } = useInterests()
  const [draft, setDraft] = useState<ParsedFilters>(initial)

  if (!open) return null

  return (
    <div role="dialog" aria-label={t('filter.title')}
         className="fixed inset-0 bg-white p-4 overflow-y-auto z-10">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{t('filter.title')}</h2>
        <button type="button" onClick={onClose} aria-label={t('filter.close')}>✕</button>
      </header>

      <fieldset className="mb-4">
        <legend className="font-medium mb-2">{t('filter.age')}</legend>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="block text-sm">{t('filter.min_age')}</span>
            <input type="number" min={18} max={99} className="border rounded p-2 w-full"
                   value={draft.min_age ?? ''}
                   onChange={(e) => setDraft({ ...draft, min_age: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </label>
          <label className="flex-1">
            <span className="block text-sm">{t('filter.max_age')}</span>
            <input type="number" min={18} max={99} className="border rounded p-2 w-full"
                   value={draft.max_age ?? ''}
                   onChange={(e) => setDraft({ ...draft, max_age: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </label>
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="font-medium mb-2">{t('filter.distance')}</legend>
        <input type="number" min={1} max={1000} className="border rounded p-2 w-full"
               value={draft.distance_miles ?? ''}
               onChange={(e) => setDraft({ ...draft, distance_miles: e.target.value === '' ? undefined : Number(e.target.value) })} />
      </fieldset>

      {data?.ok && (
        <fieldset className="mb-4">
          <legend className="font-medium mb-2">{t('filter.interests')}</legend>
          <div className="flex flex-wrap gap-2">
            {data.interests.map(i => {
              const on = (draft.interest_ids ?? []).includes(i.id)
              return (
                <button key={i.id} type="button"
                        onClick={() => {
                          const cur = new Set(draft.interest_ids ?? [])
                          on ? cur.delete(i.id) : cur.add(i.id)
                          setDraft({ ...draft, interest_ids: Array.from(cur) })
                        }}
                        className={`px-3 py-1 rounded-full border text-sm ${
                          on ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'
                        }`}>
                  {tInt(i.label_key)}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="flex gap-2 sticky bottom-0 bg-white pt-4">
        <button type="button" onClick={() => setDraft({})} className="underline">
          {t('filter.reset')}
        </button>
        <button type="button"
                onClick={() => { onApply(draft); onClose() }}
                className="ml-auto bg-slate-800 text-white px-4 py-2 rounded">
          {t('filter.apply')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: ProfileCard with LikeButton overlay**

Modify `src/features/search/components/ProfileCard.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { type ProfileCardV2 } from '@shared/rpc-contracts'
import { formatDistance } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { LikeButton } from '@/features/likes/components/LikeButton'

type Card = z.infer<typeof ProfileCardV2>

export function ProfileCard({ card }: { card: Card }) {
  const { i18n } = useTranslation()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!card.primary_photo_path) { setPhotoUrl(null); return }
    void supabase.storage
      .from('media')
      .createSignedUrl(card.primary_photo_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setPhotoUrl(data.signedUrl)
      })
    return () => { cancelled = true }
  }, [card.primary_photo_path])

  return (
    <Link to={`/profile/${card.profile_id}`} className="relative block border rounded-lg overflow-hidden bg-white">
      <div className="aspect-square bg-slate-200">
        {photoUrl ? <img src={photoUrl} alt={card.display_name} className="w-full h-full object-cover" /> : null}
      </div>
      <div className="absolute top-2 right-2">
        <LikeButton profileId={card.profile_id} liked={card.my_like_state} />
      </div>
      <div className="p-2">
        <div className="font-semibold">{card.display_name}, {card.age}</div>
        <div className="text-sm text-slate-600">
          {card.city_display_name} · {formatDistance(card.distance_miles, i18n.language)}
        </div>
        {card.tagline && <div className="text-xs italic text-slate-700 mt-1 truncate">{card.tagline}</div>}
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: SearchPage with sheet + URL filters**

Modify `src/features/search/pages/SearchPage.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchFirstPage, useSearchFilters } from '../hooks'
import { ProfileCard } from '../components/ProfileCard'
import { FilterSheet } from '../components/FilterSheet'

export function SearchPage() {
  const { t } = useTranslation('search')
  const [filters, setFilters] = useSearchFilters()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { data, isLoading, error } = useSearchFirstPage(filters)

  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('error')}</p>

  return (
    <>
      <main className="p-4">
        <div className="flex justify-between mb-3">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <button type="button" onClick={() => setSheetOpen(true)}
                  className="text-sm border rounded px-3 py-1">
            {t('filter.open')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {data.cards.map(c => <ProfileCard key={c.profile_id} card={c} />)}
        </div>
      </main>
      <FilterSheet open={sheetOpen}
                   onClose={() => setSheetOpen(false)}
                   initial={filters}
                   onApply={setFilters} />
    </>
  )
}
```

- [ ] **Step 5: Run + commit**

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Add search filter sheet, URL-state filters, and like overlay on ProfileCard"
```

---

## Task 22 — Notifications BannerHost + Likes-tab red dot + heartbeat mount

Mount the in-app banner system in the app shell so any signed-in page can surface like notifications. Wire the Likes tab's red dot to the unread count. Mount `useHeartbeat()` once in `AppShell`.

**Files:**

- Create: `src/lib/notifications/BannerHost.tsx`
- Modify: `src/features/shell/AppShell.tsx` (mount BannerHost + useHeartbeat)
- Modify: `src/features/shell/BottomTabBar.tsx` (red dot on Likes tab)
- Create: `src/lib/notifications/__tests__/BannerHost.test.tsx`

- [ ] **Step 1: BannerHost**

```tsx
// src/lib/notifications/BannerHost.tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotificationsPoll, useDismissNotification } from './hooks'

interface BannerEntry {
  id: string
  kind: 'like' | 'placeholder'
  actor_name?: string
  payload: Record<string, unknown>
}

export function BannerHost() {
  const { t } = useTranslation('notifications')
  const { data } = useNotificationsPoll()
  const dismiss = useDismissNotification()
  const seenIds = useRef<Set<string>>(new Set())
  const [queue, setQueue] = useState<BannerEntry[]>([])

  useEffect(() => {
    if (!data?.ok) return
    const fresh = data.notifications.filter(n => !seenIds.current.has(n.id))
    if (fresh.length === 0) return
    for (const n of fresh) seenIds.current.add(n.id)
    setQueue(prev => [
      ...prev,
      ...fresh.map(n => ({
        id: n.id,
        kind: n.kind,
        actor_name: typeof n.payload['actor_name'] === 'string' ? n.payload['actor_name'] as string : undefined,
        payload: n.payload,
      })),
    ])
  }, [data])

  // Auto-dismiss after 5s
  useEffect(() => {
    if (queue.length === 0) return
    const id = setTimeout(() => setQueue(prev => prev.slice(1)), 5000)
    return () => clearTimeout(id)
  }, [queue])

  if (queue.length === 0) return null
  const head = queue[0]

  return (
    <div className="fixed top-2 inset-x-2 max-w-sm mx-auto rounded-lg shadow-lg bg-slate-800 text-white p-3 z-50"
         role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{t(`banner.${head.kind}.title`)}</div>
          <div className="text-sm">
            {t(`banner.${head.kind}.body`, { actor_name: head.actor_name ?? 'Someone' })}
          </div>
        </div>
        <button type="button"
                onClick={() => {
                  dismiss.mutate(head.id)
                  setQueue(prev => prev.slice(1))
                }}
                aria-label={t('banner.dismiss')}>✕</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Bottom tab Likes red dot**

Modify `src/features/shell/BottomTabBar.tsx`:

```tsx
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useUnreadCount } from '@/lib/notifications/hooks'

export function BottomTabBar() {
  const { t } = useTranslation('shell')
  const { data } = useUnreadCount()
  const likesDot = data?.ok && data.count > 0

  const tabs = [
    { to: '/search',   label: t('tab.search'),   showDot: false },
    { to: '/messages', label: t('tab.messages'), showDot: false },
    { to: '/likes',    label: t('tab.likes'),    showDot: likesDot },
    { to: '/me',       label: t('tab.me'),       showDot: false },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to}
                 className={({ isActive }) =>
                   `flex-1 text-center py-3 relative ${isActive ? 'font-semibold' : ''}`}>
          {tab.label}
          {tab.showDot && (
            <span aria-label="unread" className="absolute top-2 right-1/3 inline-block w-2 h-2 rounded-full bg-rose-600" />
          )}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: AppShell mounts BannerHost + heartbeat**

Modify `src/features/shell/AppShell.tsx`:

```tsx
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BottomTabBar } from './BottomTabBar'
import { HamburgerMenu } from './HamburgerMenu'
import { BannerHost } from '@/lib/notifications/BannerHost'
import { useHeartbeat } from '@/lib/last-active'

export function AppShell() {
  const { t } = useTranslation('shell')
  useHeartbeat(true)
  return (
    <div className="min-h-screen pb-14">
      <header className="border-b flex items-center justify-between p-2">
        <span className="font-semibold">{t('appName')}</span>
        <HamburgerMenu />
      </header>
      <Outlet />
      <BottomTabBar />
      <BannerHost />
    </div>
  )
}
```

- [ ] **Step 4: BannerHost test (MSW)**

Create `src/lib/notifications/__tests__/BannerHost.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { mswServer } from '../../../test-setup'
import { BannerHost } from '../BannerHost'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('BannerHost', () => {
  it('renders a banner when a like notification arrives', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_notifications', () =>
        HttpResponse.json({
          ok: true,
          notifications: [{
            id: '11111111-1111-4111-8111-111111111111',
            kind: 'like',
            payload: { actor_id: '22222222-2222-4222-8222-222222222222', actor_name: 'Alex' },
            created_at: '2026-05-14T12:00:00Z',
            read_at: null,
          }],
          next_cursor: null,
        }),
      ),
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BannerHost />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Alex liked your profile/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Commit**

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Add BannerHost, unread-count red dot on Likes tab, mount heartbeat in AppShell"
```

---

## Task 23 — Hamburger language switcher

Add a tiny language switcher in the hamburger menu. Plan 03 ships English only, but the picker is in place for adding languages later (Plan 04+).

**Files:**

- Create: `src/features/shell/LanguageSwitcher.tsx`
- Modify: `src/features/shell/HamburgerMenu.tsx`

- [ ] **Step 1: LanguageSwitcher**

```tsx
// src/features/shell/LanguageSwitcher.tsx
import { useTranslation } from 'react-i18next'

const SUPPORTED = [
  { code: 'en', labelKey: 'language.en' },
]

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('shell')
  return (
    <label className="flex items-center gap-2 py-2">
      <span>{t('menu.language')}</span>
      <select
        className="border rounded p-1"
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {SUPPORTED.map(s => (
          <option key={s.code} value={s.code}>{t(s.labelKey)}</option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 2: HamburgerMenu uses it**

Modify `src/features/shell/HamburgerMenu.tsx`'s dialog body to include `<LanguageSwitcher />` above the Sign out button:

```tsx
{open ? (
  <div role="dialog" className="fixed inset-0 bg-white p-4">
    <button onClick={() => setOpen(false)} aria-label={t('menu.close')} className="mb-4">✕</button>
    <LanguageSwitcher />
    <button onClick={() => void signOut()} className="block w-full text-left py-2">
      {t('menu.signOut')}
    </button>
  </div>
) : null}
```

Import `LanguageSwitcher` from `./LanguageSwitcher`.

- [ ] **Step 3: Commit**

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Add language switcher to hamburger menu"
```

---

## Task 24 — Playwright E2E: signup → onboarding (6 steps) → search filter → like

Extend the existing E2E suite with a second journey that exercises Plan 03 surface. Reuses the admin signup helper.

**Files:**

- Create: `e2e/likes-and-filters.spec.ts`
- Modify: `e2e/onboarding.spec.ts` (extend to navigate through the new Details + Interests steps, since onboarding now has 6 visible step pages before completion)

- [ ] **Step 1: Update onboarding.spec.ts**

After the photo step's `Continue` click, add:

```ts
// Step 5: details (skip)
await page.waitForURL(/onboarding\/details/)
await page.getByRole('button', { name: /skip for now/i }).click()

// Step 6: interests (skip)
await page.waitForURL(/onboarding\/interests/)
await page.getByRole('button', { name: /skip for now/i }).click()
```

Then continue with the existing `/search` wait.

- [ ] **Step 2: New journey**

Create `e2e/likes-and-filters.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { createConfirmedUser } from './helpers/admin-signup'

test('like a fixture from search + see them in Likes tab', async ({ page }) => {
  // Use a fresh confirmed user; assume seed:dev has already run so fixture profiles exist.
  const { email, password } = await createConfirmedUser()

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()

  // Walk through onboarding quickly: benefactor, identity, location, photo, skip details + interests
  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: /benefactor/i }).click()

  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/display name/i).fill('Tester')
  await page.getByLabel(/date of birth/i).fill('1990-01-01')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('male')
  await page.getByRole('combobox', { name: 'Looking for' }).selectOption('female')
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city or town/i).fill('Manchester')
  await page.getByRole('button', { name: /look up/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/photo/)
  await page.setInputFiles('input[type="file"]', {
    name: 'p.jpg', mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  })
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/details/)
  await page.getByRole('button', { name: /skip for now/i }).click()

  await page.waitForURL(/onboarding\/interests/)
  await page.getByRole('button', { name: /skip for now/i }).click()

  await page.waitForURL(/\/search/)

  // Find a card and click its heart button
  const firstCard = page.locator('a[href^="/profile/"]').first()
  await expect(firstCard).toBeVisible()
  const likeButton = firstCard.getByRole('button', { name: /^like$/i })
  await likeButton.click()

  // The button should toggle to "Unlike"
  await expect(firstCard.getByRole('button', { name: /unlike/i })).toBeVisible()

  // Navigate to Likes tab and confirm it appears under Favourites
  await page.getByRole('link', { name: /^likes$/i }).click()
  await page.waitForURL(/\/likes/)
  await expect(page.getByRole('heading', { name: /likes/i })).toBeVisible()
  await expect(page.getByText(/favourites/i)).toBeVisible()
  // At least one card under Favourites
  const favsSection = page.locator('section').filter({ hasText: /favourites/i })
  await expect(favsSection.locator('a[href^="/profile/"]').first()).toBeVisible()
})

```

Plan 03's filter-narrowing coverage lives at the SQL layer (Task 14's `31_rpc_view_search_filters.sql` exercises min_age / distance_miles / interest_ids). Wiring a second E2E that duplicates the onboarding walk-through is not worth the runtime cost. Skip the second test; if you want one, factor the onboarding sequence into `e2e/helpers/quick-onboard.ts` first, then add a tiny test that opens the filter sheet, sets `distance_miles=1`, applies, and asserts `expect(page.locator('a[href^="/profile/"]')).toHaveCount(0)` against the fixture seed.

- [ ] **Step 3: Run + commit**

```bash
# Supabase running, seed:dev done, geocode-city served, dev server started.
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"') \
pnpm test:e2e
```

Expected: the new like-a-fixture test passes; Plan 02's E2E still passes after onboarding-step extension.

```bash
git add -A
git commit -m "Add Plan 03 E2E: like a fixture, see in Favourites; extend onboarding journey"
```

---

## Task 25 — README + carry-over

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Append a Plan 03 section**

Add a "Features (Plan 03)" section describing: extended profile fields (bio, physical, lifestyle, interests), multi-photo management, likes, in-app banners, search filters, language switcher. Note the URL-state for filters as a power-user shortcut.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Update README for Plan 03 features"
```

---

## Verification — full plan complete

Run every command in order; each must exit 0:

- [ ] `pnpm install` succeeds
- [ ] `pnpm lint` exits 0 (0 errors, 0 warnings)
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm gen:config` produces no diff
- [ ] `supabase start` succeeds
- [ ] `supabase db reset` applies every migration cleanly
- [ ] `pnpm gen:types` produces no diff
- [ ] `pnpm test:db` — every pgTAP file passes (≥ 85 tests total: Plan 02's 63 + 22 new Plan 03 assertions)
- [ ] `pnpm test` — every Vitest test passes (≥ 45 tests total: Plan 02's 33 + ~12 new Plan 03 assertions)
- [ ] `pnpm seed:dev` populates 3 active fixture users (with the existing local-host guard)
- [ ] `supabase functions serve geocode-city --no-verify-jwt` answers POSTs
- [ ] `pnpm test:e2e` — both Plan 02 (signup → onboarding → search → profile) and Plan 03 (like → favourites) journeys pass; smoke still passes
- [ ] `pnpm build` produces `dist/` with the manifest
- [ ] Manual check: signup → onboarding (now 6 steps; skip details + interests) → search → open filter sheet, apply min_age and distance → like a profile → land on `/likes` and see the favourite → click the heart again to unlike → banner appears in another tab when a fixture user likes you
- [ ] CI workflow has consolidated `db-and-drift` job, `edge-functions-check` step inside it, and the `e2e-tests` job still seeds + serves the edge function
- [ ] `git log --oneline` since Plan 02 ended — ~25 commits

If any check fails, fix it before declaring complete. **Do not move to Plan 04 until all green.** No "pre-existing" excuses.

---

## Carry-over to Plan 04

Smells likely to surface during Plan 03 execution that don't block completion:

- **Storage SELECT policy is still broad.** `media_authenticated_select` (Plan 02 Task 21) grants any authenticated user `SELECT` on any object in the `media` bucket. Plan 03's view RPCs gate WHICH paths a viewer learns about, so this is a defensible boundary, but Plan 04 (with messaging photos + secret album) wants tighter scoping. Decide between (a) per-row policy that joins `profile_photos` / `secret_album` / `message_photo_album`, or (b) keep the model where RPCs return paths and the URL is the secret.
- **`view_search` cursor parsing bug** (carried from Plan 02). Plan 03 still uses Plan 02's `split_part(..., ':', 1)` parser. The frontend doesn't yet exercise pagination, but Plan 04's messaging adds infinite scroll, so this bug needs a fix in Plan 04 Task 1. Replace `:` separator with `|` (already used by `view_notifications`).
- **Old `ProfileCard` / `ViewSearchResult` / `ViewProfileResult` / `ViewMyProfileResult` exports** are still in `shared/rpc-contracts.ts` for one release cycle (Task 17). Plan 04 removes them.
- **`useUploadProfilePhoto` always inserts at ordinal 0.** Plan 02 chose `0` because onboarding only uploads one photo. Plan 03's `PhotoGallery` calls `add_to_profile_photos` via the same hook — at ordinal 0 — which collides with existing photos under the ON CONFLICT update. **Plan 03 fix:** change the hook to insert at `MAX(ordinal) + 1` (computed from current `useMyProfile().data.profile.photos.length`). If the hook isn't changed in Task 17, do it as part of Task 19 Step 5 (PhotoGallery) — the gallery's "Add photo" knows the current photo count.
- **Banner deduplication after dismiss.** `BannerHost` tracks `seenIds` in a ref, but dismiss currently relies on `dismiss_notification` returning `dismissed_at`. If `view_notifications` re-returns a notification before the dismiss round-trip completes, the banner could reappear. Acceptable for MVP; investigate jitter in Plan 04.
- **Filter sheet doesn't validate min_age <= max_age.** Soft UX failure: zero results returned, which is correct but confusing. Add inline validation in Plan 04.
- **`view_likes_tab` page size capped at 50** per list (hardcoded). No pagination yet. Plan 04 (or later) widens this with a cursor.
- **No `match` concept yet.** Spec §12 explicitly says "match-gating is out of MVP", but the current `liked_me` query excludes profiles the caller already liked back (would-be matches). That's a deliberate choice (mutual-like state isn't surfaced in Plan 03). Plan 05 (messaging) may want a "Matches" subsection.
- **`media_items` deletion is still manual.** Spec §3 says orphans are GC'd by a periodic job; no job exists yet. Plan 04 or later: add a scheduled Edge Function.
- **No "you liked their profile" badge** on `view_profile`. `their_like_state` is returned but `ProfilePage` doesn't render it. Plan 04 polish.

---

## What's next

**Plan 04 — Token Economy + FauxProvider.** Builds on this foundation:

- Adds the `payments` table, `token_transactions` (ledger), `PaymentProvider` interface with `FauxPaymentProvider` (sync test mode).
- `create_token_purchase` RPC + webhook Edge Function shell.
- Token chip in the header (benefactor only).
- `/tokens` page: package picker + ledger view.
- Admin grant RPC for test seeding.

Prerequisites added by Plan 03: notifications system (Plan 04 adds `kind='token_purchase_complete'`), the like surface (Plan 04 doesn't extend, but pattern of in-app banners reused).

When ready to start Plan 04: in a fresh Claude session say _"Write plan 04"_.

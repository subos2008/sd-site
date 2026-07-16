# Separate Onboarding Flows Per Role — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork the onboarding wizard at the role step so benefactors take the shortest route to `/search` (role → identity → location → optional photo → complete) while babies must build a real profile first (role → identity → location → required photo minimum → required bio → optional details/interests → complete), with the baby minimums enforced as a server-side data invariant.

**Architecture:** Onboarding is a set of per-route pages under `/onboarding/*`, each currently hard-coding its own next route. We introduce a single role-aware step-sequence module (`steps.ts`) that every step consults for "where next", plus a `RequireRoleChosen` route guard. The role-specific data invariant (baby photo minimum + required tagline/about/wants) lives in the `complete_onboarding` RPC — the sole place a profile flips to `active` — reading its thresholds from the `app_config` table, which is seeded from `shared/app-config.ts`. The split-bio columns (`tagline`, `about`, `wants`) already exist from plan 03, so no schema migration is required; this is enforcement + flow wiring + config.

**Tech Stack:** React 18 + React Router (data router) + TanStack Query + react-hook-form + react-i18next (namespaced, `keySeparator: false`); Supabase Postgres with pgTAP; Vitest + MSW (unit), Playwright (E2E); Zod RPC contracts in `shared/rpc-contracts.ts`.

## Global Constraints

- **Role enum:** `profile_role` = `'benefactor' | 'baby'` (`ProfileRole` in `shared/rpc-contracts.ts`). The fork keys on this.
- **No ambient/production defaults.** The server invariant must **fail closed**: if the `app_config` `onboarding` row (or a required key inside it) is missing, `complete_onboarding` raises, never silently lets a baby through. Do not `COALESCE` a fallback minimum into the gate.
- **i18n keys are flat literal strings** (`keySeparator: false`, `nsSeparator: ':'`). Add keys like `photo.baby.title` as flat keys in `src/i18n/en/onboarding.json`, not nested objects. All new copy goes through `useTranslation('onboarding')`. English only. No fabricated numbers or fake urgency in any copy.
- **RPCs return storage paths, not signed URLs.** The client mints signed URLs via `supabase.storage.from('media').createSignedUrl(path, 3600)`.
- **RPC error is an open `z.string()`** (`RpcErr`), so new error codes need no contract change.
- **pgTAP fixture rule:** `INSERT INTO auth.users` (and seed RLS-protected reference rows) BEFORE `SET LOCAL ROLE authenticated`; use `RESET ROLE` to seed deny-all tables (`media_items`) as postgres, then re-impersonate. Full column set on `auth.users` insert including the `confirmation_token`/`email_change_token_new`/`recovery_token` = `''` triple.
- **Config → DB:** editing `shared/app-config.ts` requires `pnpm gen:config`, which regenerates `supabase/migrations/20260509000001_app_config_seed.sql` (auto-generated; do not hand-edit). Only top-level `APP_CONFIG` keys become `app_config` rows.
- **New migration timestamps** must sort after the latest (`20260514000011_rpc_heartbeat.sql`).
- **Build gotcha:** do NOT prepend `PATH=/usr/bin:...` to `pnpm build` (breaks arm64 rollup). Fine for `pnpm test` / `test:db` / `test:e2e`.
- **Git:** plain commit messages (no self-attribution). Push after every commit (`git@github.com:subos2008/sd-site.git`).
- **Every task ends green:** `pnpm lint`, `pnpm typecheck`, and the relevant test suite must pass before commit. Do not excuse a failure as pre-existing.

---

### Task 1: Config — baby onboarding minimums

**Files:**
- Modify: `shared/app-config.ts`
- Regenerate: `supabase/migrations/20260509000001_app_config_seed.sql` (via `pnpm gen:config`)
- Test: `shared/__tests__/app-config.test.ts` (create)

**Interfaces:**
- Produces: `APP_CONFIG.onboarding = { babyMinPhotos: number; babyMinBioChars: number }` — a top-level key so `gen-config` seeds it as `app_config` row `key='onboarding'`, `value = {"babyMinPhotos":3,"babyMinBioChars":40}`. `babyMinBioChars` applies to each of `about` and `wants` independently.

- [ ] **Step 1: Write the failing test**

Create `shared/__tests__/app-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { APP_CONFIG } from '../app-config'

describe('APP_CONFIG.onboarding', () => {
  it('defines positive baby onboarding minimums', () => {
    expect(APP_CONFIG.onboarding.babyMinPhotos).toBeGreaterThan(0)
    expect(Number.isInteger(APP_CONFIG.onboarding.babyMinPhotos)).toBe(true)
    expect(APP_CONFIG.onboarding.babyMinBioChars).toBeGreaterThan(0)
    expect(Number.isInteger(APP_CONFIG.onboarding.babyMinBioChars)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run shared/__tests__/app-config.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'babyMinPhotos')`.

- [ ] **Step 3: Add the config key**

In `shared/app-config.ts`, add a top-level `onboarding` key inside `APP_CONFIG` (place it after `age`):

```ts
  age: { minimum: 18 },
  onboarding: {
    // Baby (supply-side) activation gate. Structure is the fraud gate;
    // numbers are tuning — start modest, ratchet toward the incumbent bar
    // (~6 photos) as density and brand trust grow. See execution/010.
    babyMinPhotos: 3,
    babyMinBioChars: 40,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run shared/__tests__/app-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Regenerate the config seed migration**

Run: `pnpm gen:config`
Expected: prints `Wrote .../20260509000001_app_config_seed.sql`. Confirm the file now contains an `INSERT ... ('onboarding', $cfg_onboarding${"babyMinPhotos":3,"babyMinBioChars":40}$cfg_onboarding$::jsonb)` statement:

Run: `grep onboarding supabase/migrations/20260509000001_app_config_seed.sql`
Expected: the onboarding row is present.

- [ ] **Step 6: Apply migrations and verify the row lands in the DB**

Run: `supabase db reset` (tolerate the known 502 hiccup per CLAUDE.md; verify with the query below)
Run: `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '"')" -c "select value from public.app_config where key='onboarding';"`
Expected: `{"babyMinPhotos": 3, "babyMinBioChars": 40}`.

- [ ] **Step 7: Commit**

```bash
git add shared/app-config.ts shared/__tests__/app-config.test.ts supabase/migrations/20260509000001_app_config_seed.sql
git commit -m "Add baby onboarding minimums to app config"
git push
```

---

### Task 2: Server invariant — fork `complete_onboarding` by role

**Files:**
- Create: `supabase/migrations/20260514000012_baby_activation_gate.sql`
- Modify: `supabase/tests/17_rpc_complete_onboarding.sql` (retarget to benefactor photo-optional path)
- Create: `supabase/tests/33_baby_activation_gate.sql`

**Interfaces:**
- Produces: `public.complete_onboarding()` now returns, for `role='baby'`, the error codes `'photos_required'`, `'tagline_required'`, `'about_required'`, `'wants_required'` before the status flip; `role='benefactor'` no longer requires any photo. Preconditions `'role_missing'`, `'identity_missing'`, `'location_missing'`, `'not_pending_onboarding'` unchanged. Consumed by Task 9 (complete page error mapping).

- [ ] **Step 1: Write the new baby-gate pgTAP test (failing)**

Create `supabase/tests/33_baby_activation_gate.sql`. It proves: a baby cannot activate without the configured photo minimum and non-empty tagline/about/wants meeting `babyMinBioChars`, and can once all are met. Photo counts are read from `app_config` so the test tracks config.

```sql
BEGIN;
SELECT plan(9);

-- Fixture user (baby). auth.users first, then impersonate.
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
        'baby-gate@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated',
        now(), now(), '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

SELECT public.set_profile_role('baby');
SELECT public.set_profile_identity('Baby Gate', '1998-05-05'::date, 'female', 'male');
SELECT public.set_profile_location('London', 51.5074, -0.1278);

-- 1. No photos yet -> photos_required, status unchanged.
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "photos_required"}',
  'baby with zero photos rejected: photos_required'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333'),
  'pending_onboarding',
  'status unchanged after photos_required'
);

-- Seed exactly babyMinPhotos photos (read count from app_config so the test tracks config).
RESET ROLE;
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
SELECT gen_random_uuid(),
       '33333333-3333-3333-3333-333333333333',
       'users/33333333-3333-3333-3333-333333333333/p' || g || '.jpg',
       'photo', 'hash_baby_gate_' || g, 1024, 'approved'
FROM generate_series(
       1,
       (SELECT (value->>'babyMinPhotos')::int FROM public.app_config WHERE key = 'onboarding')
     ) g;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

-- Link each seeded media item as a profile photo.
DO $$
DECLARE m record; ord int := 0;
BEGIN
  FOR m IN SELECT id FROM public.media_items
           WHERE owner_id = '33333333-3333-3333-3333-333333333333' ORDER BY hash LOOP
    PERFORM public.add_to_profile_photos(m.id, ord);
    ord := ord + 1;
  END LOOP;
END $$;

-- 2. Photos now sufficient, but no bio -> tagline_required.
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "tagline_required"}',
  'baby with photos but no tagline rejected: tagline_required'
);

-- 3. Tagline set, about missing -> about_required.
SELECT public.set_profile_bio('Sweet and curious', NULL, NULL);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "about_required"}',
  'baby with tagline but no about rejected: about_required'
);

-- 4. about too short (below babyMinBioChars) -> about_required.
SELECT public.set_profile_bio('Sweet and curious', 'too short', NULL);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "about_required"}',
  'baby with short about rejected: about_required'
);

-- 5. about ok, wants missing -> wants_required.
SELECT public.set_profile_bio(
  'Sweet and curious',
  'I offer genuine company, good conversation and a warm presence for a generous partner.',
  NULL
);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "wants_required"}',
  'baby with about but no wants rejected: wants_required'
);

-- 6. Everything present -> ok, status active.
SELECT public.set_profile_bio(
  'Sweet and curious',
  'I offer genuine company, good conversation and a warm presence for a generous partner.',
  'Looking for a respectful, established partner who values discretion and kindness.'
);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": true}',
  'baby with all requirements met activates'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333'),
  'active',
  'baby status transitioned to active'
);

-- 7. Second call now that status is active -> not_pending_onboarding.
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "not_pending_onboarding"}',
  'already-active baby cannot re-complete'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run it to confirm it fails against the current function**

Run: `pnpm test:db 2>&1 | grep -A2 33_baby_activation_gate`
Expected: FAIL — the current `complete_onboarding` returns `'photo_required'` (singular, and only checks ≥1 photo), so assertion 1 fails.

- [ ] **Step 3: Write the migration that forks the function**

Create `supabase/migrations/20260514000012_baby_activation_gate.sql`:

```sql
-- Fork complete_onboarding by role.
--   benefactor: photo optional (no photo gate at all).
--   baby: config-driven photo minimum + required tagline/about/wants,
--         each bio field >= app_config.onboarding.babyMinBioChars.
-- Fails closed if the onboarding config row/keys are missing.
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

  IF p.role IS NULL              THEN RETURN jsonb_build_object('ok', false, 'error', 'role_missing');     END IF;
  IF p.display_name IS NULL      THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.date_of_birth IS NULL     THEN RETURN jsonb_build_object('ok', false, 'error', 'identity_missing'); END IF;
  IF p.city_display_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'location_missing'); END IF;

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

GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;
```

- [ ] **Step 4: Retarget test 17 to the benefactor photo-optional path**

The old test 17 asserted a baby needs exactly one photo. That behaviour moved to test 33. Rewrite `supabase/tests/17_rpc_complete_onboarding.sql` to (a) keep the role-agnostic precondition checks and (b) prove a **benefactor** activates with NO photo:

```sql
BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
        'comp@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';

-- 1. No role yet -> role_missing, status unchanged.
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

-- 2. Benefactor with role only, missing identity -> identity_missing.
SELECT public.set_profile_role('benefactor');
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "identity_missing"}',
  'missing identity rejected'
);

-- 3. Add identity, still missing location -> location_missing.
SELECT public.set_profile_identity('Rich', '1980-01-01'::date, 'male', 'female');
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "location_missing"}',
  'missing location rejected'
);

-- 4. Add location. Benefactor needs NO photo -> ok.
SELECT public.set_profile_location('London', 51.5074, -0.1278);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": true}',
  'benefactor completes with no photo (photo optional)'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  'active',
  'benefactor status transitioned to active'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 5: Apply and run the DB suite**

Run: `supabase db reset` (tolerate 502; verify with `supabase status`)
Run: `pnpm test:db`
Expected: PASS — all files including `17_rpc_complete_onboarding.sql` (6) and `33_baby_activation_gate.sql` (9).

- [ ] **Step 6: Regenerate db types (expect no diff)**

Run: `pnpm gen:types && git diff --stat shared/db-types.ts`
Expected: no change (function body edit only, no schema/enum change). If a diff appears, include it in the commit.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260514000012_baby_activation_gate.sql supabase/tests/17_rpc_complete_onboarding.sql supabase/tests/33_baby_activation_gate.sql
git commit -m "Enforce baby activation gate in complete_onboarding; benefactor photo optional"
git push
```

---

### Task 3: Central step-sequence module + role guard + routes

**Files:**
- Create: `src/features/onboarding/steps.ts`
- Create: `src/features/onboarding/__tests__/steps.test.ts`
- Create: `src/features/onboarding/components/BioStep.tsx` (stub only this task; filled in Task 7)
- Modify: `src/routes.tsx`
- Create: `src/lib/route-guards` addition `RequireRoleChosen` (in `src/lib/route-guards.tsx`)

**Interfaces:**
- Produces:
  - `type OnboardingStep = 'role' | 'identity' | 'location' | 'photo' | 'bio' | 'details' | 'interests' | 'complete'`
  - `stepsForRole(role: 'benefactor' | 'baby'): OnboardingStep[]`
  - `nextStepPath(role: 'benefactor' | 'baby', current: OnboardingStep): string` — returns `/onboarding/<next>`; if `current` is not in the role's sequence, returns `/onboarding/complete`.
  - `RequireRoleChosen` route element: renders `<Outlet/>` when the profile has a role, redirects to `/onboarding/role` when loaded and role is null, renders nothing while loading.
- Consumed by Tasks 4–8 (every step calls `nextStepPath`).

- [ ] **Step 1: Write the failing sequence tests**

Create `src/features/onboarding/__tests__/steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { stepsForRole, nextStepPath } from '../steps'

describe('onboarding step sequences', () => {
  it('benefactor path skips bio/details/interests', () => {
    expect(stepsForRole('benefactor')).toEqual([
      'role', 'identity', 'location', 'photo', 'complete',
    ])
  })

  it('baby path includes bio/details/interests', () => {
    expect(stepsForRole('baby')).toEqual([
      'role', 'identity', 'location', 'photo', 'bio', 'details', 'interests', 'complete',
    ])
  })

  it('routes benefactor from photo straight to complete', () => {
    expect(nextStepPath('benefactor', 'photo')).toBe('/onboarding/complete')
  })

  it('routes baby from photo to bio', () => {
    expect(nextStepPath('baby', 'photo')).toBe('/onboarding/bio')
  })

  it('routes baby from bio to details', () => {
    expect(nextStepPath('baby', 'bio')).toBe('/onboarding/details')
  })

  it('falls back to complete for an out-of-sequence step', () => {
    // A benefactor never has a bio step; if they land there, push forward.
    expect(nextStepPath('benefactor', 'bio')).toBe('/onboarding/complete')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/onboarding/__tests__/steps.test.ts`
Expected: FAIL — `../steps` not found.

- [ ] **Step 3: Implement `steps.ts`**

Create `src/features/onboarding/steps.ts`:

```ts
import type { z } from 'zod'
import type { ProfileRole } from '@shared/rpc-contracts'

export type OnboardingStep =
  | 'role' | 'identity' | 'location' | 'photo' | 'bio' | 'details' | 'interests' | 'complete'

type Role = z.infer<typeof ProfileRole>

const BENEFACTOR_STEPS: OnboardingStep[] = ['role', 'identity', 'location', 'photo', 'complete']
const BABY_STEPS: OnboardingStep[] = [
  'role', 'identity', 'location', 'photo', 'bio', 'details', 'interests', 'complete',
]

export function stepsForRole(role: Role): OnboardingStep[] {
  return role === 'baby' ? BABY_STEPS : BENEFACTOR_STEPS
}

export function nextStepPath(role: Role, current: OnboardingStep): string {
  const seq = stepsForRole(role)
  const idx = seq.indexOf(current)
  if (idx === -1) return '/onboarding/complete'
  const next = seq[idx + 1] ?? 'complete'
  return `/onboarding/${next}`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/onboarding/__tests__/steps.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the `RequireRoleChosen` guard**

Read `src/lib/route-guards.tsx` for the existing pattern (it already uses `viewMyProfile`/`useMyProfile` and `<Navigate>`/`<Outlet>` from `react-router`). Append:

```tsx
export function RequireRoleChosen() {
  const { data, isLoading } = useMyProfile()
  if (isLoading) return null
  if (!data?.ok || data.profile.role == null) {
    return <Navigate to="/onboarding/role" replace />
  }
  return <Outlet />
}
```

Ensure `useMyProfile`, `Navigate`, and `Outlet` are imported at the top of the file (match whatever the existing guards already import; `useMyProfile` comes from `@/features/profile/hooks`).

- [ ] **Step 6: Stub `BioStep` so the route compiles**

Create `src/features/onboarding/components/BioStep.tsx` (placeholder body, real UI in Task 7):

```tsx
export function BioStep() {
  return null
}
```

- [ ] **Step 7: Wire the routes — add bio route and wrap post-role steps**

In `src/routes.tsx`, add the import:

```tsx
import { BioStep } from './features/onboarding/components/BioStep'
```

and import `RequireRoleChosen` from `./lib/route-guards` (add to the existing guard import block). Replace the `/onboarding` children array so `role` stays open but the rest sit behind `RequireRoleChosen`, and `bio` is added between `photo` and `details`:

```tsx
        children: [
          { path: 'role', element: <RoleStep /> },
          {
            element: <RequireRoleChosen />,
            children: [
              { path: 'identity', element: <IdentityStep /> },
              { path: 'location', element: <LocationStep /> },
              { path: 'photo', element: <PhotoStep /> },
              { path: 'bio', element: <BioStep /> },
              { path: 'details', element: <DetailsStep /> },
              { path: 'interests', element: <InterestsStep /> },
              { path: 'complete', element: <OnboardingCompletePage /> },
            ],
          },
        ],
```

- [ ] **Step 8: Typecheck, lint, run unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS. (Existing onboarding component behaviour unchanged; steps module + guard compile.)

- [ ] **Step 9: Commit**

```bash
git add src/features/onboarding/steps.ts src/features/onboarding/__tests__/steps.test.ts src/features/onboarding/components/BioStep.tsx src/lib/route-guards.tsx src/routes.tsx
git commit -m "Add role-aware onboarding step sequence, RequireRoleChosen guard and bio route"
git push
```

---

### Task 4: RoleStep — navigate via the forked sequence

**Files:**
- Modify: `src/features/onboarding/components/RoleStep.tsx`

**Interfaces:**
- Consumes: `nextStepPath` from `../steps`. RoleStep already knows the chosen role (the argument to `choose`), so it does not need `useMyProfile`.

- [ ] **Step 1: Update the navigate call**

In `RoleStep.tsx`, import `nextStepPath` and replace the hard-coded next route. The `choose` handler becomes:

```tsx
import { nextStepPath } from '../steps'
// ...
async function choose(role: 'benefactor' | 'baby') {
  setServerError(null)
  const res = await setRole.mutateAsync(role)
  if (!res.ok) { setServerError(res.error); return }
  navigate(nextStepPath(role, 'role'))
}
```

(Keep the existing surrounding code — the two buttons, `setRole`, `serverError` state. `nextStepPath(role, 'role')` resolves to `/onboarding/identity` for both roles, so behaviour is unchanged here but now sourced from the sequence.)

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/onboarding/components/RoleStep.tsx
git commit -m "RoleStep advances via role-aware step sequence"
git push
```

---

### Task 5: IdentityStep + LocationStep — navigate via the forked sequence

**Files:**
- Modify: `src/features/onboarding/components/IdentityStep.tsx`
- Modify: `src/features/onboarding/components/LocationStep.tsx`
- Modify: `src/features/onboarding/__tests__/IdentityStep.test.tsx`

**Interfaces:**
- Consumes: `nextStepPath` from `../steps`; role from `useMyProfile()` (`@/features/profile/hooks`, re-exported by onboarding `hooks.ts`). Both are guaranteed a role by `RequireRoleChosen`, but read defensively.

- [ ] **Step 1: Update IdentityStep**

In `IdentityStep.tsx`, add role lookup and replace `navigate('/onboarding/location')`:

```tsx
import { nextStepPath } from '../steps'
import { useMyProfile } from '../hooks'
// inside component:
const { data: me } = useMyProfile()
const role = me?.ok ? me.profile.role : null
// after successful setIdentity.mutateAsync(values):
navigate(nextStepPath(role ?? 'benefactor', 'identity'))
```

(Identity is a shared early step; both roles go to `location` next, so the `role ?? 'benefactor'` fallback is safe here — `nextStepPath(_, 'identity')` is `/onboarding/location` for both roles. `RequireRoleChosen` guarantees a role in practice.)

- [ ] **Step 2: Update LocationStep**

In `LocationStep.tsx`, same pattern, replacing `navigate('/onboarding/photo')`:

```tsx
import { nextStepPath } from '../steps'
import { useMyProfile } from '../hooks'
// inside component:
const { data: me } = useMyProfile()
const role = me?.ok ? me.profile.role : null
// after successful setLocation.mutateAsync(resolved):
navigate(nextStepPath(role ?? 'benefactor', 'location'))
```

(`nextStepPath(_, 'location')` is `/onboarding/photo` for both roles.)

- [ ] **Step 3: Update the IdentityStep unit test to stub the profile query**

`IdentityStep` now calls `useMyProfile` (queries `view_my_profile`). `IdentityStep.test.tsx` does not currently import MSW, so add these imports at the top (alongside the existing ones):

```ts
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
```

Then, inside the existing test (before `render(wrap(<IdentityStep />))`), register a handler so the query resolves (the test only asserts the age-gate disables Continue, so a minimal benefactor profile is fine):

```ts
mswServer.use(
  http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
    HttpResponse.json({
      ok: true,
      profile: {
        profile_id: '00000000-0000-0000-0000-000000000001',
        role: 'benefactor', status: 'pending_onboarding',
        display_name: null, age: null, date_of_birth: null,
        gender: null, looking_for: null, city_display_name: null,
        tagline: null, about: null, wants: null,
        height_cm: null, body_type: null, hair_color: null, eye_color: null,
        has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
        education: null, yearly_income_band: null, net_worth_band: null,
        token_balance: 0, photos: [], interests: [],
      },
    }),
  ),
)
```

- [ ] **Step 4: Run the affected unit tests**

Run: `pnpm vitest run src/features/onboarding/__tests__/IdentityStep.test.tsx`
Expected: PASS (age-gate assertion still holds; query resolves).

- [ ] **Step 5: Typecheck + lint + full unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/components/IdentityStep.tsx src/features/onboarding/components/LocationStep.tsx src/features/onboarding/__tests__/IdentityStep.test.tsx
git commit -m "Identity and location steps advance via role-aware sequence"
git push
```

---

### Task 6: PhotoStep — split into per-role components (benefactor optional; baby minimum grid)

The two photo screens are genuinely different jobs (baby = manufacture inventory: a
required grid of N photos; benefactor = one optional snap on the way to the catalog).
Rather than one component branching on role internally, split them into two focused
components with a thin role dispatcher. The shared `/onboarding/photo` route is unchanged
(Tasks 3–5 untouched); the dispatcher reads role and renders the right screen.

**Files:**
- Create: `src/features/onboarding/components/BabyPhotoStep.tsx`
- Create: `src/features/onboarding/components/BenefactorPhotoStep.tsx`
- Modify: `src/features/onboarding/components/PhotoStep.tsx` (becomes a thin dispatcher)
- Create: `src/features/onboarding/__tests__/PhotoStep.test.tsx`
- Modify: `src/i18n/en/onboarding.json`

**Interfaces:**
- Consumes: `useMyProfile` (photos array + role), `useUploadProfilePhoto` (existing, accepts `{ file, ordinal }`), `nextStepPath`, `APP_CONFIG.onboarding.babyMinPhotos` from `@shared/app-config`.
- Behaviour:
  - **benefactor** (`BenefactorPhotoStep`): single optional upload; a "Continue" appears after an upload AND a "Skip for now" is always available; both call `nextStepPath('benefactor', 'photo')` → `/onboarding/complete`.
  - **baby** (`BabyPhotoStep`): grid of `babyMinPhotos` "+" placeholders (filled slots show a check), progress line "N of M", Continue enabled only when `photos.length >= babyMinPhotos`; navigates `nextStepPath('baby', 'photo')` → `/onboarding/bio`. No skip.
  - **dispatcher** (`PhotoStep`): reads role from `useMyProfile`; renders `<BabyPhotoStep/>` for baby, else `<BenefactorPhotoStep/>`. Returns nothing while the profile query is loading. (`RequireRoleChosen` guarantees a role by the time this route mounts; defaulting the non-baby branch to the benefactor screen is safe.)

**Error handling:** both screens wrap `upload.mutateAsync` in try/catch that sets a `serverError` shown in a `role="alert"` — this repo requires surfacing errors, never swallowing them. Do not drop it.

- [ ] **Step 1: Add i18n keys**

In `src/i18n/en/onboarding.json`, add these flat keys (alongside the existing `photo.*` keys):

```json
"photo.benefactor.title": "Add a profile photo",
"photo.benefactor.subtitle": "Optional — you can add one now or later from your profile.",
"photo.skip": "Skip for now",
"photo.baby.title": "Add your photos",
"photo.baby.subtitle": "Your first photo is your card photo — it's the first thing members see.",
"photo.baby.progress": "{{count}} of {{min}} photos added",
"photo.baby.addSlot": "Add photo",
"photo.baby.continue": "Continue"
```

- [ ] **Step 2: Write the failing PhotoStep tests**

Create `src/features/onboarding/__tests__/PhotoStep.test.tsx`. It renders the dispatcher `<PhotoStep/>` with a `view_my_profile` MSW mock for each role, which exercises the dispatch plus the rendered sub-component. Uses the repo's established scaffolding (top-level `await initI18n()`, `mswServer` from `../../../test-setup`, `createQueryClient`, a `wrap()` helper):

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'
import { PhotoStep } from '../components/PhotoStep'

await initI18n()

function profile(overrides: Record<string, unknown>) {
  return {
    ok: true,
    profile: {
      profile_id: '00000000-0000-0000-0000-000000000002',
      role: 'baby', status: 'pending_onboarding',
      display_name: 'B', age: 25, date_of_birth: '1999-01-01',
      gender: 'female', looking_for: 'male', city_display_name: 'London',
      tagline: null, about: null, wants: null,
      height_cm: null, body_type: null, hair_color: null, eye_color: null,
      has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
      education: null, yearly_income_band: null, net_worth_band: null,
      token_balance: 0, photos: [], interests: [],
      ...overrides,
    },
  }
}

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/onboarding/photo']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PhotoStep (baby)', () => {
  it('gates Continue until the photo minimum is met', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json(profile({ photos: [] })),
      ),
    )
    render(wrap(<PhotoStep />))
    // Continue is disabled with zero photos (min is 3).
    expect(await screen.findByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('enables Continue when the minimum is met', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json(profile({
          photos: [
            { ordinal: 0, path: 'a', media_item_id: '00000000-0000-0000-0000-0000000000a1' },
            { ordinal: 1, path: 'b', media_item_id: '00000000-0000-0000-0000-0000000000a2' },
            { ordinal: 2, path: 'c', media_item_id: '00000000-0000-0000-0000-0000000000a3' },
          ],
        })),
      ),
    )
    render(wrap(<PhotoStep />))
    expect(await screen.findByRole('button', { name: /continue/i })).toBeEnabled()
  })
})

describe('PhotoStep (benefactor)', () => {
  it('shows a skip option', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json(profile({ role: 'benefactor', photos: [] })),
      ),
    )
    render(wrap(<PhotoStep />))
    expect(await screen.findByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/features/onboarding/__tests__/PhotoStep.test.tsx`
Expected: FAIL — current PhotoStep has no role branch, no skip button, no gated Continue.

- [ ] **Step 4: Create `BabyPhotoStep`**

Create `src/features/onboarding/components/BabyPhotoStep.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { APP_CONFIG } from '@shared/app-config'
import { useUploadProfilePhoto, useMyProfile } from '../hooks'
import { nextStepPath } from '../steps'

export function BabyPhotoStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const upload = useUploadProfilePhoto()
  const { data: me } = useMyProfile()
  const [serverError, setServerError] = useState<string | null>(null)

  const photos = me?.ok ? me.profile.photos : []
  const min = APP_CONFIG.onboarding.babyMinPhotos
  const met = photos.length >= min
  const slots = Math.max(min, photos.length)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    setServerError(null)
    try {
      await upload.mutateAsync({ file, ordinal: photos.length })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'unknown')
    }
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('photo.baby.title')}</h2>
      <p className="text-sm text-slate-600">{t('photo.baby.subtitle')}</p>
      <p className="text-sm">{t('photo.baby.progress', { count: photos.length, min })}</p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i < photos.length
          return (
            <label
              key={i}
              className="relative aspect-square bg-slate-200 rounded flex items-center justify-center cursor-pointer text-2xl text-slate-500"
            >
              {filled ? '✓' : '+'}
              <span className="sr-only">{t('photo.baby.addSlot')}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                disabled={upload.isPending}
              />
            </label>
          )
        })}
      </div>
      {upload.isPending && <p>{t('photo.uploading')}</p>}
      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}
      <button
        type="button"
        className="bg-slate-800 text-white py-2 rounded disabled:opacity-50"
        disabled={!met}
        onClick={() => navigate(nextStepPath('baby', 'photo'))}
      >
        {t('photo.baby.continue')}
      </button>
    </section>
  )
}
```

- [ ] **Step 5: Create `BenefactorPhotoStep`**

Create `src/features/onboarding/components/BenefactorPhotoStep.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useUploadProfilePhoto, useMyProfile } from '../hooks'
import { nextStepPath } from '../steps'

export function BenefactorPhotoStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const upload = useUploadProfilePhoto()
  const { data: me } = useMyProfile()
  const [serverError, setServerError] = useState<string | null>(null)

  const photos = me?.ok ? me.profile.photos : []

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    setServerError(null)
    try {
      await upload.mutateAsync({ file, ordinal: photos.length })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'unknown')
    }
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('photo.benefactor.title')}</h2>
      <p className="text-sm text-slate-600">{t('photo.benefactor.subtitle')}</p>
      <label className="flex flex-col gap-1">
        <span>{t('photo.upload')}</span>
        <input type="file" accept="image/*" onChange={onFileChange} disabled={upload.isPending} />
      </label>
      {upload.isPending && <p>{t('photo.uploading')}</p>}
      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}
      <div className="flex gap-2">
        {photos.length > 0 && (
          <button
            type="button"
            className="bg-slate-800 text-white py-2 px-3 rounded"
            onClick={() => navigate(nextStepPath('benefactor', 'photo'))}
          >
            {t('photo.continue')}
          </button>
        )}
        <button
          type="button"
          className="underline py-2"
          onClick={() => navigate(nextStepPath('benefactor', 'photo'))}
        >
          {t('photo.skip')}
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Replace `PhotoStep` with the dispatcher**

Replace `src/features/onboarding/components/PhotoStep.tsx`:

```tsx
import { useMyProfile } from '../hooks'
import { BabyPhotoStep } from './BabyPhotoStep'
import { BenefactorPhotoStep } from './BenefactorPhotoStep'

export function PhotoStep() {
  const { data: me, isLoading } = useMyProfile()
  if (isLoading) return null
  const role = me?.ok ? me.profile.role : null
  return role === 'baby' ? <BabyPhotoStep /> : <BenefactorPhotoStep />
}
```

- [ ] **Step 7: Run PhotoStep tests**

Run: `pnpm vitest run src/features/onboarding/__tests__/PhotoStep.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Typecheck + lint + full unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/onboarding/components/PhotoStep.tsx src/features/onboarding/components/BabyPhotoStep.tsx src/features/onboarding/components/BenefactorPhotoStep.tsx src/features/onboarding/__tests__/PhotoStep.test.tsx src/i18n/en/onboarding.json
git commit -m "Split PhotoStep into per-role BabyPhotoStep and BenefactorPhotoStep via a dispatcher"
git push
```

### Task 7: BioStep — required tagline + split bio (baby)

**Files:**
- Modify: `src/features/onboarding/components/BioStep.tsx` (replace the Task 3 stub)
- Create: `src/features/onboarding/__tests__/BioStep.test.tsx`
- Modify: `src/i18n/en/onboarding.json`

**Interfaces:**
- Consumes: `useSetBio` (`@/features/profile/hooks`), `useMyProfile`, `nextStepPath`, `APP_CONFIG.onboarding.babyMinBioChars`.
- Behaviour: three fields — tagline (required, 1–120), "what do you have to offer" → `about` (required, ≥ `babyMinBioChars`), "what are you looking for" → `wants` (required, ≥ `babyMinBioChars`). Save button disabled until all three client-side minimums met. On successful save, navigate `nextStepPath('baby', 'bio')` → `/onboarding/details`. Benefit-framed copy; no fake numbers.

- [ ] **Step 1: Add i18n keys**

In `src/i18n/en/onboarding.json`, add:

```json
"bio.title": "Tell them about you",
"bio.subtitle": "This is what members read before they reach out. Make it yours.",
"bio.tagline.label": "Your tagline",
"bio.tagline.placeholder": "One line that sounds like you",
"bio.about.label": "What do you have to offer",
"bio.wants.label": "What are you looking for",
"bio.minChars": "At least {{min}} characters",
"bio.continue": "Continue"
```

- [ ] **Step 2: Write the failing BioStep test**

Create `src/features/onboarding/__tests__/BioStep.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'
import { BioStep } from '../components/BioStep'

await initI18n()

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/onboarding/bio']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BioStep', () => {
  it('keeps Continue disabled until tagline and both bio fields meet the minimum', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json({
          ok: true,
          profile: {
            profile_id: '00000000-0000-0000-0000-000000000003',
            role: 'baby', status: 'pending_onboarding',
            display_name: 'B', age: 25, date_of_birth: '1999-01-01',
            gender: 'female', looking_for: 'male', city_display_name: 'London',
            tagline: null, about: null, wants: null,
            height_cm: null, body_type: null, hair_color: null, eye_color: null,
            has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
            education: null, yearly_income_band: null, net_worth_band: null,
            token_balance: 0, photos: [], interests: [],
          },
        }),
      ),
    )
    render(wrap(<BioStep />))
    const continueBtn = await screen.findByRole('button', { name: /continue/i })
    expect(continueBtn).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/your tagline/i), 'Curious and kind')
    await userEvent.type(
      screen.getByLabelText(/what do you have to offer/i),
      'Genuine company, real conversation and a warm, easy presence for a generous partner.',
    )
    // Still disabled: wants is empty.
    expect(continueBtn).toBeDisabled()

    await userEvent.type(
      screen.getByLabelText(/what are you looking for/i),
      'A respectful, established partner who values discretion, kindness and time together.',
    )
    expect(continueBtn).toBeEnabled()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/features/onboarding/__tests__/BioStep.test.tsx`
Expected: FAIL — BioStep is the empty stub.

- [ ] **Step 4: Implement BioStep**

Replace `src/features/onboarding/components/BioStep.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { APP_CONFIG } from '@shared/app-config'
import { useMyProfile } from '../hooks'
import { useSetBio } from '@/features/profile/hooks'
import { nextStepPath } from '../steps'

export function BioStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setBio = useSetBio()
  const { data: me } = useMyProfile()
  const min = APP_CONFIG.onboarding.babyMinBioChars

  const [tagline, setTagline] = useState(me?.ok ? (me.profile.tagline ?? '') : '')
  const [about, setAbout] = useState(me?.ok ? (me.profile.about ?? '') : '')
  const [wants, setWants] = useState(me?.ok ? (me.profile.wants ?? '') : '')
  const [serverError, setServerError] = useState<string | null>(null)

  const valid =
    tagline.trim().length >= 1 &&
    about.trim().length >= min &&
    wants.trim().length >= min

  async function onContinue() {
    setServerError(null)
    const res = await setBio.mutateAsync({
      tagline: tagline.trim(),
      about: about.trim(),
      wants: wants.trim(),
    })
    if (!res.ok) { setServerError(res.error); return }
    navigate(nextStepPath('baby', 'bio'))
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('bio.title')}</h2>
      <p className="text-sm text-slate-600">{t('bio.subtitle')}</p>

      <label className="flex flex-col gap-1">
        <span>{t('bio.tagline.label')}</span>
        <input
          className="border rounded p-2"
          maxLength={120}
          placeholder={t('bio.tagline.placeholder')}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>{t('bio.about.label')}</span>
        <textarea
          className="border rounded p-2 min-h-[6rem]"
          maxLength={4000}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
        <span className="text-xs text-slate-500">{t('bio.minChars', { min })}</span>
      </label>

      <label className="flex flex-col gap-1">
        <span>{t('bio.wants.label')}</span>
        <textarea
          className="border rounded p-2 min-h-[4rem]"
          maxLength={2000}
          value={wants}
          onChange={(e) => setWants(e.target.value)}
        />
        <span className="text-xs text-slate-500">{t('bio.minChars', { min })}</span>
      </label>

      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}

      <button
        type="button"
        className="bg-slate-800 text-white py-2 rounded disabled:opacity-50"
        disabled={!valid || setBio.isPending}
        onClick={onContinue}
      >
        {t('bio.continue')}
      </button>
    </section>
  )
}
```

> Note: initial state seeds from `useMyProfile` at first render. If the profile query resolves after mount, the fields still start empty — acceptable for a fresh onboarding where about/wants are null. (A re-entry pre-fill is out of scope; babies fill this once.)

- [ ] **Step 5: Run BioStep test**

Run: `pnpm vitest run src/features/onboarding/__tests__/BioStep.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint + full unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/onboarding/components/BioStep.tsx src/features/onboarding/__tests__/BioStep.test.tsx src/i18n/en/onboarding.json
git commit -m "Add baby bio step: required tagline and split about/wants"
git push
```

---

### Task 8: DetailsStep + InterestsStep — baby-only path + benefactor safety redirect

**Files:**
- Modify: `src/features/onboarding/components/DetailsStep.tsx`
- Modify: `src/features/onboarding/components/InterestsStep.tsx`
- Modify: `src/features/onboarding/__tests__/DetailsStep.test.tsx`

**Interfaces:**
- Consumes: `nextStepPath`, `useMyProfile`. These steps are baby-only in the normal flow. Defensive: if a benefactor lands here (manual URL), redirect forward to their next step.

- [ ] **Step 1: Update DetailsStep**

In `DetailsStep.tsx`: import `nextStepPath`, `useMyProfile`, and `useEffect`. Add role lookup and a redirect, and replace both `navigate('/onboarding/interests')` calls (skip button and post-submit) with `navigate(nextStepPath('baby', 'details'))`:

```tsx
import { useEffect } from 'react'
import { nextStepPath } from '../steps'
import { useMyProfile } from '../hooks'
// inside component:
const { data: me } = useMyProfile()
const role = me?.ok ? me.profile.role : null
useEffect(() => {
  if (role === 'benefactor') navigate(nextStepPath('benefactor', 'details'))
}, [role, navigate])
// skip button and post-submit both:
navigate(nextStepPath('baby', 'details'))  // -> /onboarding/interests
```

- [ ] **Step 2: Update InterestsStep**

In `InterestsStep.tsx`: same pattern; replace both `navigate('/onboarding/complete')` calls with `navigate(nextStepPath('baby', 'interests'))` (→ `/onboarding/complete`) and add the benefactor redirect:

```tsx
import { useEffect } from 'react'
import { nextStepPath } from '../steps'
import { useMyProfile } from '../hooks'
// inside component:
const { data: me } = useMyProfile()
const role = me?.ok ? me.profile.role : null
useEffect(() => {
  if (role === 'benefactor') navigate(nextStepPath('benefactor', 'interests'))
}, [role, navigate])
// skip and continue both:
navigate(nextStepPath('baby', 'interests'))
```

- [ ] **Step 3: Update the DetailsStep unit test to stub the profile query as a baby**

`DetailsStep` now calls `useMyProfile`. In `DetailsStep.test.tsx`, add the `view_my_profile` MSW handler returning a `role: 'baby'` profile (so the benefactor redirect does NOT fire and the existing "submits and advances" assertion holds). Reuse the profile JSON shape from Task 5 Step 3 with `role: 'baby'`.

- [ ] **Step 4: Run affected unit tests**

Run: `pnpm vitest run src/features/onboarding/__tests__/DetailsStep.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + full unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/components/DetailsStep.tsx src/features/onboarding/components/InterestsStep.tsx src/features/onboarding/__tests__/DetailsStep.test.tsx
git commit -m "Details and interests steps are baby-only with benefactor safety redirect"
git push
```

---

### Task 9: OnboardingCompletePage — surface baby gate errors

**Files:**
- Modify: `src/features/onboarding/pages/OnboardingCompletePage.tsx`
- Modify: `src/i18n/en/onboarding.json`

**Interfaces:**
- Consumes: the new `complete_onboarding` error codes. The completion flow should normally never hit these (Continue is gated client-side), but a baby who removed a photo or edited bio to empty could. Map each code to a message + a link back to the step that fixes it.

- [ ] **Step 1: Add i18n keys**

In `src/i18n/en/onboarding.json`, add:

```json
"complete.error.photos_required": "You need a few more photos before your profile can go live.",
"complete.error.tagline_required": "Add a tagline so members know who they're meeting.",
"complete.error.about_required": "Tell members a little more about what you offer.",
"complete.error.wants_required": "Tell members what you're looking for.",
"complete.error.generic": "We couldn't complete your onboarding. Please try again.",
"complete.fixPhotos": "Add photos",
"complete.fixBio": "Edit your bio"
```

- [ ] **Step 2: Rewrite the complete page to branch on the error code**

Replace `OnboardingCompletePage.tsx` so a failed completion shows the mapped message and a targeted link:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCompleteOnboarding } from '../hooks'

const PHOTO_ERRORS = new Set(['photos_required'])
const BIO_ERRORS = new Set(['tagline_required', 'about_required', 'wants_required'])

export function OnboardingCompletePage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const complete = useCompleteOnboarding()
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const res = await complete.mutateAsync()
        if (res.ok) navigate('/search')
        else setErrorCode(res.error)
      } catch {
        setErrorCode('generic')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!errorCode) {
    return (
      <section className="flex flex-col gap-3 p-4 max-w-sm">
        <p>{t('complete.title')}</p>
      </section>
    )
  }

  const messageKey = `complete.error.${errorCode}`
  const message = t(messageKey, { defaultValue: t('complete.error.generic') })

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <div role="alert" className="text-red-700">{message}</div>
      {PHOTO_ERRORS.has(errorCode) && (
        <button
          type="button"
          className="bg-slate-800 text-white py-2 rounded"
          onClick={() => navigate('/onboarding/photo')}
        >
          {t('complete.fixPhotos')}
        </button>
      )}
      {BIO_ERRORS.has(errorCode) && (
        <button
          type="button"
          className="bg-slate-800 text-white py-2 rounded"
          onClick={() => navigate('/onboarding/bio')}
        >
          {t('complete.fixBio')}
        </button>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Typecheck + lint + full unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/onboarding/pages/OnboardingCompletePage.tsx src/i18n/en/onboarding.json
git commit -m "Surface baby activation-gate errors on the onboarding complete page"
git push
```

---

### Task 10: Benefactor post-activation nudge on /me

**Files:**
- Create: `src/features/profile/components/CompleteProfileNudge.tsx`
- Modify: `src/features/profile/pages/MyProfilePage.tsx`
- Modify: `src/i18n/en/profile.json`
- Create: `src/features/profile/__tests__/CompleteProfileNudge.test.tsx`

**Interfaces:**
- Consumes: the profile object from `useMyProfile` (already loaded in `MyProfilePage`). Shows a dismissible card when `role === 'benefactor'` AND the profile is missing details/interests (a proxy for "they skipped the removed onboarding steps"). Dismissal persists in `localStorage` (`sd.nudge.completeProfile.dismissed`). The card points the user to the Details and Interests sections already rendered below it on `/me`; it does not itself edit.

- [ ] **Step 1: Add i18n keys**

In `src/i18n/en/profile.json`, add:

```json
"nudge.completeProfile.title": "Finish your profile",
"nudge.completeProfile.body": "Add your details and interests below to get better matches.",
"nudge.completeProfile.dismiss": "Dismiss"
```

- [ ] **Step 2: Write the failing nudge test**

Create `src/features/profile/__tests__/CompleteProfileNudge.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '@/lib/i18n'
import { CompleteProfileNudge } from '../components/CompleteProfileNudge'

await initI18n()
beforeEach(() => localStorage.clear())

describe('CompleteProfileNudge', () => {
  it('renders for a benefactor with empty details/interests', () => {
    render(<CompleteProfileNudge role="benefactor" hasDetails={false} hasInterests={false} />)
    expect(screen.getByText(/finish your profile/i)).toBeInTheDocument()
  })

  it('does not render for a baby', () => {
    render(<CompleteProfileNudge role="baby" hasDetails={false} hasInterests={false} />)
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
  })

  it('does not render once details and interests are present', () => {
    render(<CompleteProfileNudge role="benefactor" hasDetails hasInterests />)
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
  })

  it('stays dismissed after clicking Dismiss', async () => {
    const { unmount } = render(
      <CompleteProfileNudge role="benefactor" hasDetails={false} hasInterests={false} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
    unmount()
    render(<CompleteProfileNudge role="benefactor" hasDetails={false} hasInterests={false} />)
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/features/profile/__tests__/CompleteProfileNudge.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 4: Implement the nudge**

Create `src/features/profile/components/CompleteProfileNudge.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const KEY = 'sd.nudge.completeProfile.dismissed'

interface Props {
  role: 'benefactor' | 'baby' | null
  hasDetails: boolean
  hasInterests: boolean
}

export function CompleteProfileNudge({ role, hasDetails, hasInterests }: Props) {
  const { t } = useTranslation('profile')
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === '1')

  if (role !== 'benefactor') return null
  if (hasDetails && hasInterests) return null
  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="border rounded-lg p-4 bg-amber-50 flex flex-col gap-2">
      <h2 className="font-semibold">{t('nudge.completeProfile.title')}</h2>
      <p className="text-sm text-slate-700">{t('nudge.completeProfile.body')}</p>
      <button type="button" className="self-start underline text-sm" onClick={dismiss}>
        {t('nudge.completeProfile.dismiss')}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Mount it in MyProfilePage**

In `MyProfilePage.tsx`, import the component and render it just under `<header>`. Compute the flags from the loaded profile `p`:

```tsx
import { CompleteProfileNudge } from '../components/CompleteProfileNudge'
// ... after `const p = data.profile`:
const hasDetails = p.height_cm != null || p.body_type != null || p.education != null
const hasInterests = p.interests.length > 0
// ... in JSX, right after </header>:
<CompleteProfileNudge role={p.role} hasDetails={hasDetails} hasInterests={hasInterests} />
```

- [ ] **Step 6: Run tests + typecheck + lint**

Run: `pnpm vitest run src/features/profile/__tests__/CompleteProfileNudge.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/components/CompleteProfileNudge.tsx src/features/profile/pages/MyProfilePage.tsx src/features/profile/__tests__/CompleteProfileNudge.test.tsx src/i18n/en/profile.json
git commit -m "Add dismissible complete-profile nudge for benefactors on /me"
git push
```

---

### Task 11: E2E — benefactor and baby onboarding paths

**Files:**
- Modify: `e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: `createConfirmedUser` from `e2e/helpers/admin-signup.ts` (role-agnostic; no change needed — it only creates the auth user, leaving role null so the wizard starts at `/onboarding/role`).

- [ ] **Step 1: Rewrite the spec into two role paths**

Replace the single walk-through in `e2e/onboarding.spec.ts` with two tests. The benefactor path must NOT visit details/interests and must reach `/search` without a photo. The baby path must upload `babyMinPhotos` (3) photos, fill the bio, then skip details/interests.

Benefactor test body (after login as a fresh confirmed user, landing on `/onboarding/role`):

```ts
// role
await page.getByRole('button', { name: /benefactor/i }).click()
// identity
await page.waitForURL(/onboarding\/identity/)
await page.getByLabel(/display name/i).fill('Rich')
await page.getByLabel(/date of birth/i).fill('1980-01-01')
await page.getByRole('combobox', { name: 'Gender' }).selectOption('male')
await page.getByRole('combobox', { name: 'Looking for' }).selectOption('female')
await page.getByRole('button', { name: /continue/i }).click()
// location
await page.waitForURL(/onboarding\/location/)
await page.getByPlaceholder(/city or town/i).fill('London')
await page.getByRole('button', { name: /look up/i }).click()
await page.getByRole('button', { name: /continue/i }).click()
// photo — benefactor skips
await page.waitForURL(/onboarding\/photo/)
await page.getByRole('button', { name: /skip for now/i }).click()
// completes straight to search (no details/interests)
await page.waitForURL(/\/search/)
```

Baby test body:

```ts
// role
await page.getByRole('button', { name: /baby/i }).click()
// identity
await page.waitForURL(/onboarding\/identity/)
await page.getByLabel(/display name/i).fill('Lex')
await page.getByLabel(/date of birth/i).fill('1999-01-01')
await page.getByRole('combobox', { name: 'Gender' }).selectOption('female')
await page.getByRole('combobox', { name: 'Looking for' }).selectOption('male')
await page.getByRole('button', { name: /continue/i }).click()
// location
await page.waitForURL(/onboarding\/location/)
await page.getByPlaceholder(/city or town/i).fill('London')
await page.getByRole('button', { name: /look up/i }).click()
await page.getByRole('button', { name: /continue/i }).click()
// photo — baby must add 3 (babyMinPhotos). Each slot is a file input.
await page.waitForURL(/onboarding\/photo/)
const fixture = 'e2e/fixtures/photo.jpg' // reuse the fixture the old spec used for setInputFiles
for (let i = 0; i < 3; i++) {
  await page.locator('input[type="file"]').nth(i).setInputFiles(fixture)
  // wait for the slot to register as filled before the next upload
  await expect(page.getByText(`${i + 1} of 3`)).toBeVisible()
}
await page.getByRole('button', { name: /continue/i }).click()
// bio
await page.waitForURL(/onboarding\/bio/)
await page.getByLabel(/your tagline/i).fill('Curious and kind')
await page.getByLabel(/what do you have to offer/i)
  .fill('Genuine company, real conversation and a warm, easy presence for a generous partner.')
await page.getByLabel(/what are you looking for/i)
  .fill('A respectful, established partner who values discretion, kindness and time together.')
await page.getByRole('button', { name: /continue/i }).click()
// details (skip)
await page.waitForURL(/onboarding\/details/)
await page.getByRole('button', { name: /skip for now/i }).click()
// interests (skip)
await page.waitForURL(/onboarding\/interests/)
await page.getByRole('button', { name: /skip for now/i }).click()
// completes to search
await page.waitForURL(/\/search/)
```

> Executor notes: (1) Reuse the exact login/setup and photo fixture path the current spec uses (read the current `onboarding.spec.ts` header). (2) Confirm the location field selector — the map agent saw a "city or town" placeholder and a "look up" button; match the actual labels. (3) The file-input `.nth(i)` indexing depends on the baby grid rendering `babyMinPhotos` inputs; if slot inputs are re-keyed on fill, switch to always targeting `.nth(0)` and asserting the progress text between uploads.

- [ ] **Step 2: Run E2E**

Run: `pnpm test:e2e onboarding.spec.ts`
Expected: PASS (both paths). If the baby photo grid re-render changes input indices, apply the `.nth(0)` fallback from the note.

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding.spec.ts
git commit -m "E2E: cover forked benefactor and baby onboarding paths"
git push
```

---

### Task 12: Seed script — keep dev users valid under the fork

**Files:**
- Modify: `scripts/seed-dev-users.mjs`

**Interfaces:**
- The seed script writes profile columns directly with the service-role client (bypassing RPCs), so the new RPC-level invariant does not block it. But seeded babies should look complete (photos are still not seeded here; bio is). Add `tagline`/`about`/`wants` to the two baby fixtures so `/me` and profile display render fully, and confirm the localhost guard is intact.

- [ ] **Step 1: Add bio fields to the baby fixtures**

In `scripts/seed-dev-users.mjs`, extend the two `role: 'baby'` fixtures with bio text and include those columns in the `profiles` update:

```js
{ email: 'lex@local.test',  role: 'baby', display_name: 'Lex', dob: '1998-04-12',
  gender: 'female', looking_for: 'male', city: 'London', lat: 51.5074, lng: -0.1278,
  tagline: 'London-based, curious and warm',
  about: 'I offer genuine company, good conversation and an easy, warm presence.',
  wants: 'A respectful, established partner who values discretion and kindness.' },
{ email: 'sam@local.test',  role: 'baby', display_name: 'Sam', dob: '1999-09-03',
  gender: 'female', looking_for: 'male', city: 'Manchester', lat: 53.4808, lng: -2.2426,
  tagline: 'Manchester student, bright and easy-going',
  about: 'Fun, grounded company and real conversation for the right person.',
  wants: 'Someone generous, respectful and discreet who enjoys good company.' },
```

And in the `.update({...})` object add:

```js
    tagline: f.tagline ?? null,
    about: f.about ?? null,
    wants: f.wants ?? null,
```

(The benefactor fixture has no bio fields, so `?? null` keeps it unchanged.)

- [ ] **Step 2: Verify the guard is intact and run the seed against local**

Confirm the `LOCAL_HOSTS` guard block is unchanged. Then:

Run: `supabase status` (get local URL + service-role key), then
Run: `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key> pnpm seed:dev`
Expected: exits 0, seeds 3 users; babies now carry tagline/about/wants.

- [ ] **Step 3: Sanity-check a seeded baby profile**

Run: `psql "<local DB_URL>" -c "select display_name, tagline is not null as has_tagline, about is not null as has_about from public.profiles where display_name in ('Lex','Sam');"`
Expected: both rows `has_tagline = t`, `has_about = t`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-dev-users.mjs
git commit -m "Seed babies with bio fields for the forked onboarding"
git push
```

---

## Final verification

- [ ] Run the full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e`. All green.
- [ ] Manual smoke: benefactor signup → role, identity, location, skip photo → `/search`. Baby signup → role, identity, location, 3 photos, bio, skip details/interests → `/search`. Baby cannot pass the photo step Continue with < 3 photos, nor the bio Continue without all three fields.
- [ ] Update `execution/README.md`: set spec 010's Status to "Done" and link this plan file. Commit + push.

## Mapping to the spec's acceptance criteria

- Benefactor reaches `/search` with only role/identity/location; photo optional at every point → Tasks 2 (server allows benefactor with no photo), 3–6 (flow skips bio/details/interests, photo has Skip).
- Baby cannot reach `active` without the configured photo minimum + required tagline/about/wants, enforced when the client is bypassed → Task 2 (`complete_onboarding` + pgTAP 33).
- Photo/bio minimums live in `shared/app-config.ts` and change without code changes elsewhere → Task 1 (config + `app_config` seed; server reads `app_config`, client reads `APP_CONFIG`).
- Neither role sees the other's step sequence or copy → Task 3 (sequence), Tasks 4–8 (per-role navigation + benefactor redirect), per-role i18n keys.
- Existing profiles + seeded dev users remain valid; `pnpm test`/`test:db`/`test:e2e` pass → Tasks 2, 5, 8 (test updates), 11 (E2E), 12 (seed).

## Out of scope (per spec — design for, don't build)

- Video verification: the baby path is structured so a verification step can slot in after `photo` (add `'verify'` to `BABY_STEPS` between `photo` and `bio` when built).
- Live local-count stats during baby signup: deliberately omitted; near-zero at launch.

## Execution deviations

_(The executor fills this section as reality meets the spec, one commit per deviation — repo convention.)_

- **Spec constraint #6 is already satisfied by plan 03.** The split-bio columns (`tagline`, `about`, `wants`) and the `set_profile_bio` RPC already exist, and `view_profile` / `view_my_profile` already return all three (`_profile_card_for_viewer` already returns `tagline`). So NO schema migration and NO view-RPC changes are required — the plan reuses the existing columns/RPC and only adds enforcement in `complete_onboarding`. If a task appears to need a bio migration, it does not.
- **No onboarding progress UI exists.** The spec's constraint that "step indicators/progress UI assume one fixed step sequence" does not hold: `OnboardingLayout.tsx` is a title + `<Outlet/>` with no step list or indicator. There is nothing to make role-aware there, so no task touches it. If a progress indicator is wanted later, `OnboardingLayout` is the place and `stepsForRole` already provides the per-role list.
- **Onboarding has no central sequence today.** Each step hard-codes its own `navigate('/onboarding/<next>')`. Task 3 introduces `steps.ts` as the single fork point; Tasks 4–8 replace each hard-coded target with `nextStepPath`. This is a deliberate (small) structural change, not incidental.
- **Task 4 dropped and then restored error surfacing.** The plan's Task 4 snippet for `RoleStep.choose` omitted the pre-existing `try/catch` that surfaces thrown `mutateAsync` errors to the user; the review caught it and a fix commit restored it (per the repo's error-surfacing rule). The remaining step tasks preserve their existing `try/catch`.
- **Task 6 split into per-role components (user decision, 2026-07-16).** The plan originally had one `PhotoStep` branching on role internally. Per the user, the two photo screens are genuinely different jobs (baby = required photo grid to manufacture inventory; benefactor = one optional snap), so Task 6 now produces two focused components — `BabyPhotoStep` and `BenefactorPhotoStep` — with `PhotoStep` reduced to a thin role dispatcher. The shared `/onboarding/photo` route and the step sequence are unchanged (Tasks 3–5 untouched). This is the agreed component-sharing philosophy: share step components that are identical across roles (identity, location), split those that genuinely differ.

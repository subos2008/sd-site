# Single-Page Role-Diverged Signup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace minimal email+password signup with a Secret-Benefits-style single page that captures core profile fields diverged by role, committing them through the email-confirm gate so the onboarding wizard shrinks to what signup can't collect.

**Architecture:** Signup captures fields into Supabase **auth user metadata** at `signUp()` (survives cross-device email confirmation, no anonymous DB writes). A run-once bootstrap on first authenticated entry commits the metadata-borne fields (role, body type, ethnicity) via existing RPCs; identity (username + DOB + role-derived gender/looking-for) commits at the now-DOB-only wizard step; location pre-fills the existing confirm step. A new `ethnicity` enum threads exactly where `body_type` threads. Non-sensitive attempt data (age, city, role, acquisition source) is handed to a fire-and-forget capture seam at submit — the seam is a typed stub here; the separate signup-attempt-capture plan fills its body.

**Tech Stack:** React 19, react-router 7, react-hook-form + zod, Tailwind v4, Supabase (Postgres RPC `SECURITY DEFINER`, supabase-js auth), i18next, vitest + Testing Library + MSW, Playwright, pgTAP.

## Global Constraints

- **Build quirk:** do NOT prepend `PATH=/usr/bin:/bin:/usr/local/bin:$PATH` to `pnpm build` (breaks arm64 rollup bindings). Fine for `pnpm test`/`test:db`.
- **`supabase db reset`** often ends with a spurious `502`; migrations still applied — verify with a psql query, don't re-reset.
- **pgTAP + RLS:** any fixture that writes RLS-protected rows must `INSERT INTO auth.users` (and reference data) BEFORE `SET LOCAL ROLE authenticated`; switching to `anon` needs `SET LOCAL "request.jwt.claim.sub" = ''` first.
- **e2e** needs `SUPABASE_URL=http://127.0.0.1:54321` and `SUPABASE_SERVICE_ROLE_KEY` in env (loopback guard); seed users present.
- **Password min length is 8** (our Zod), not SB's 6. Copy says "At least 8 characters".
- **Errors surface, never swallowed:** onboarding/auth mutations use `meta: { suppressGlobalError: true }` and render the error inline in their own component.
- **No decorative emoji; plain commit messages (no self-attribution). Commit each task; do not `git push`** (a hook blocks it — push only when Ryan asks).
- **Ethnicity enum values (SB's five, shipped verbatim):** `white, black, asian, hispanic, other`.
- **Role ⇒ gender/looking-for (product rule):** `baby → gender female, looking_for male`; `benefactor → gender male, looking_for female`.
- **Body-type chip relabels (baby):** `athletic`→"Fit", `plus_size`→"Full figured", others 1:1; `muscular` kept.
- **Special-category boundary:** ethnicity/body-type are NEVER sent to the attempt-capture seam — only `{ role, city, age, acquisition_source }` go there.

---

### Task 1: `ethnicity` schema, RPCs, contracts, types

**Files:**
- Create: `supabase/migrations/20260718000000_ethnicity.sql`
- Create: `supabase/migrations/20260718000001_rpc_details_ethnicity.sql`
- Create: `supabase/migrations/20260718000002_rpc_views_ethnicity.sql`
- Modify: `shared/rpc-contracts.ts` (add `Ethnicity`; add `p_ethnicity` to `SetProfileDetailsInput`; add `ethnicity` to both view results — near lines 150/169/255/288)
- Modify: `shared/db-types.ts` (regenerated, do not hand-edit)
- Test: `supabase/tests/15_rpc_set_profile_details.sql` (extend — confirm exact filename with `ls supabase/tests | grep details`)

**Interfaces:**
- Produces: SQL enum `ethnicity`; `set_profile_details(...)` gains trailing param `p_ethnicity ethnicity`; view RPCs return `ethnicity`. Zod `Ethnicity = z.enum(['white','black','asian','hispanic','other'])`; `SetProfileDetailsInput` gains `p_ethnicity: Ethnicity.nullable()`; both view-result objects gain `ethnicity: Ethnicity.nullable()`.

- [ ] **Step 1: Write the enum + column migration**

Create `supabase/migrations/20260718000000_ethnicity.sql`:

```sql
-- Ethnicity: captured on the single-page signup (SB's five values). Nullable,
-- like every other profile attribute. Threads where body_type threads.
CREATE TYPE ethnicity AS ENUM ('white', 'black', 'asian', 'hispanic', 'other');

ALTER TABLE public.profiles ADD COLUMN ethnicity ethnicity;

COMMENT ON COLUMN public.profiles.ethnicity IS 'Self-reported ethnicity (special-category data; only captured on completed signup).';
```

- [ ] **Step 2: Write the `set_profile_details` replacement migration**

Adding a parameter changes the signature, so `CREATE OR REPLACE` cannot be used — DROP then CREATE. Create `supabase/migrations/20260718000001_rpc_details_ethnicity.sql`:

```sql
-- set_profile_details gains p_ethnicity. Signature change => DROP + CREATE
-- (CREATE OR REPLACE cannot alter an argument list). Body is the original
-- plus the ethnicity column.
DROP FUNCTION IF EXISTS public.set_profile_details(
  int, body_type, hair_color, eye_color, boolean, boolean,
  smoking_habit, drinking_habit, education_level, income_band, net_worth_band
);

CREATE FUNCTION public.set_profile_details(
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
  p_net_worth_band     net_worth_band,
  p_ethnicity          ethnicity
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
         net_worth_band     = p_net_worth_band,
         ethnicity          = p_ethnicity
   WHERE id = me;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_details(
  int, body_type, hair_color, eye_color, boolean, boolean,
  smoking_habit, drinking_habit, education_level, income_band, net_worth_band, ethnicity
) TO authenticated;
```

- [ ] **Step 3: Write the view-RPC replacement migration**

Create `supabase/migrations/20260718000002_rpc_views_ethnicity.sql`. First read `supabase/migrations/20260514000010_rpc_views_v2.sql` in full and copy each `CREATE OR REPLACE FUNCTION` verbatim, adding one line `'ethnicity', t.ethnicity,` immediately after each `'body_type', t.body_type,` (two occurrences: `view_my_profile` and the profile/search view). `CREATE OR REPLACE` is fine here — return type is `jsonb`, unchanged. Do not alter any other line.

- [ ] **Step 4: Apply and verify the schema**

Run: `supabase db reset && pnpm gen:types`
Then verify (ignore any `502` from the reset):

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -tAc \
  "select 1 from pg_type where typname='ethnicity'; \
   select 1 from information_schema.columns where table_name='profiles' and column_name='ethnicity'"
```
Expected: two rows returning `1`.

- [ ] **Step 5: Add ethnicity to the Zod contracts**

In `shared/rpc-contracts.ts`: below `BodyType` (line ~150) add `export const Ethnicity = z.enum(['white', 'black', 'asian', 'hispanic', 'other'])`. In `SetProfileDetailsInput` add `p_ethnicity: Ethnicity.nullable(),` after `p_net_worth_band`. In BOTH view-result objects add `ethnicity: Ethnicity.nullable(),` immediately after each `body_type: BodyType.nullable(),`.

- [ ] **Step 6: Extend the pgTAP details test**

Run `ls supabase/tests | grep -i detail` to find the file. Add assertions that `set_profile_details(...)` with a trailing ethnicity arg stores it and a view RPC returns it. Follow the file's existing fixture pattern (INSERT auth.users BEFORE `SET LOCAL ROLE authenticated`). Bump the file's `plan(...)` count by the number of assertions added.

- [ ] **Step 7: Run DB + type checks**

Run: `pnpm test:db && pnpm typecheck`
Expected: pgTAP `Result: PASS`; `tsc -b` clean.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260718000000_ethnicity.sql \
  supabase/migrations/20260718000001_rpc_details_ethnicity.sql \
  supabase/migrations/20260718000002_rpc_views_ethnicity.sql \
  shared/rpc-contracts.ts shared/db-types.ts supabase/tests
git commit -m "Add ethnicity enum, thread through details + view RPCs and contracts"
```

---

### Task 2: Legal stub pages + routes

**Files:**
- Create: `src/features/legal/pages/LegalPage.tsx`
- Modify: `src/routes.tsx` (add two public routes near `/auth/confirm`, line ~41)
- Create: `src/i18n/en/legal.json`
- Modify: `src/lib/i18n.ts` (register `legal` namespace — mirror the existing `landing` registration)
- Test: `src/features/legal/__tests__/LegalPage.test.tsx`

**Interfaces:**
- Produces: routes `/legal/privacy` and `/legal/terms`; `LegalPage` component taking `doc: 'privacy' | 'terms'`.

- [ ] **Step 1: Write the failing test**

`src/features/legal/__tests__/LegalPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LegalPage } from '../pages/LegalPage'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('LegalPage', () => {
  it('renders the privacy heading', () => {
    const router = createMemoryRouter([{ path: '/', element: <LegalPage doc="privacy" /> }], {
      initialEntries: ['/'],
    })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { name: /privacy/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test -- src/features/legal`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the i18n namespace**

`src/i18n/en/legal.json`:

```json
{
  "privacy.title": "Privacy Policy",
  "privacy.body": "Placeholder privacy policy. Real copy lands before launch as part of compliance work.",
  "terms.title": "Terms of Service",
  "terms.body": "Placeholder terms of service. Real copy lands before launch as part of compliance work."
}
```

Register it in `src/lib/i18n.ts`: add `import enLegal from '../i18n/en/legal.json'` with the other imports, and `legal: enLegal,` in the `en` resources object.

- [ ] **Step 4: Create the page**

`src/features/legal/pages/LegalPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { AuthShell } from '@/features/auth/components/AuthShell'

export function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t } = useTranslation('legal')
  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold">{t(`${doc}.title`)}</h1>
      <p className="mt-6 leading-relaxed text-bone/70">{t(`${doc}.body`)}</p>
    </AuthShell>
  )
}
```

- [ ] **Step 5: Add the routes**

In `src/routes.tsx`, import `LegalPage` and add after the `/auth/confirm` route (public, no guard):

```tsx
  { path: '/legal/privacy', element: <LegalPage doc="privacy" /> },
  { path: '/legal/terms', element: <LegalPage doc="terms" /> },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- src/features/legal`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/legal src/routes.tsx src/i18n/en/legal.json src/lib/i18n.ts
git commit -m "Add legal stub pages and routes for signup certification links"
```

---

### Task 3: Role → gender/looking-for derivation

**Files:**
- Create: `src/features/auth/roleDerivation.ts`
- Test: `src/features/auth/__tests__/roleDerivation.test.ts`

**Interfaces:**
- Produces: `identityForRole(role: 'benefactor' | 'baby'): { gender: 'male' | 'female'; looking_for: 'male' | 'female' }`. Consumed by the shrunk IdentityStep (Task 6).

- [ ] **Step 1: Write the failing test**

`src/features/auth/__tests__/roleDerivation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { identityForRole } from '../roleDerivation'

describe('identityForRole', () => {
  it('maps baby to a woman seeking men', () => {
    expect(identityForRole('baby')).toEqual({ gender: 'female', looking_for: 'male' })
  })
  it('maps benefactor to a man seeking women', () => {
    expect(identityForRole('benefactor')).toEqual({ gender: 'male', looking_for: 'female' })
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test -- roleDerivation`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/features/auth/roleDerivation.ts`:

```ts
/**
 * Roles are gender-fixed in this model: baby = woman seeking men,
 * benefactor = man seeking women. Same-gender arrangements are out of scope.
 * The signup fork sets the role; gender and looking-for follow from it, so
 * the wizard never asks them.
 */
export function identityForRole(role: 'benefactor' | 'baby'): {
  gender: 'male' | 'female'
  looking_for: 'male' | 'female'
} {
  return role === 'baby'
    ? { gender: 'female', looking_for: 'male' }
    : { gender: 'male', looking_for: 'female' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- roleDerivation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/roleDerivation.ts src/features/auth/__tests__/roleDerivation.test.ts
git commit -m "Add role-to-gender/looking-for derivation"
```

---

### Task 4: Attempt-capture seam (typed stub)

**Files:**
- Create: `src/features/signup-attempt/api.ts`
- Test: `src/features/signup-attempt/__tests__/api.test.ts`

**Interfaces:**
- Produces: `interface SignupAttemptInput { role: 'benefactor' | 'baby'; city: string; age: number | null; acquisition_source: string | null }` and `recordSignupAttempt(input: SignupAttemptInput): void` — fire-and-forget, never throws. The signup-attempt-capture plan replaces the body with the real Postgres insert; this plan ships the stub so signup is testable and independently shippable.

> **Assumption (capture spec):** the capture spec is written but not yet implemented. This is the agreed interface; only `{ role, city, age, acquisition_source }` crosses it — never ethnicity/body-type (special-category boundary).

- [ ] **Step 1: Write the failing test**

`src/features/signup-attempt/__tests__/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { recordSignupAttempt } from '../api'

describe('recordSignupAttempt', () => {
  it('never throws (fire-and-forget)', () => {
    expect(() =>
      recordSignupAttempt({ role: 'baby', city: 'London', age: 22, acquisition_source: null }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test -- signup-attempt`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the stub**

`src/features/signup-attempt/api.ts`:

```ts
export interface SignupAttemptInput {
  role: 'benefactor' | 'baby'
  city: string
  age: number | null
  /** UTM/ref source captured from the signup URL; null when absent. */
  acquisition_source: string | null
}

/**
 * Records a signup ATTEMPT (non-sensitive fields only) for marketing
 * intelligence — including attempts that never complete. Fire-and-forget:
 * must never throw into the signup flow. The signup-attempt-capture plan
 * replaces this body with a Postgres insert via an anonymous-allowed path.
 * Ethnicity/body-type are special-category data and MUST NOT be passed here.
 */
export function recordSignupAttempt(input: SignupAttemptInput): void {
  if (import.meta.env.DEV) console.debug('[signup-attempt]', input)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- signup-attempt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/signup-attempt
git commit -m "Add fire-and-forget signup-attempt capture seam (stub)"
```

---

### Task 5: `signUp` metadata payload + bootstrap commit

**Files:**
- Modify: `src/features/auth/api.ts` (`signUp` signature + `options.data`)
- Create: `src/features/onboarding/useSignupBootstrap.ts`
- Modify: `src/features/onboarding/pages/OnboardingLayout.tsx` (call the hook)
- Test: `src/features/auth/__tests__/SignupForm.test.tsx` (already asserts `role_hint`; extend in Task 6) — bootstrap tested in `src/features/onboarding/__tests__/useSignupBootstrap.test.tsx`

**Interfaces:**
- Consumes: `SetProfileDetailsInput` (Task 1), `Ethnicity`/`BodyType`.
- Produces: `signUp(email, password, meta?: SignupMeta)` where `SignupMeta = { role?: 'benefactor'|'baby'; username?: string; city?: string; age?: number; body_type?: BodyTypeValue; ethnicity?: EthnicityValue }`, writing them to `options.data` (role as `role_hint` for back-compat with the shipped auto-commit). `useSignupBootstrap()` — run-once effect committing body_type + ethnicity from metadata via `set_profile_details`.

- [ ] **Step 1: Extend `signUp` to carry metadata**

Replace the body of `signUp` in `src/features/auth/api.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { z } from 'zod'
import type { BodyType, Ethnicity } from '@shared/rpc-contracts'

export interface SignupMeta {
  role?: 'benefactor' | 'baby'
  username?: string
  city?: string
  age?: number
  body_type?: z.infer<typeof BodyType>
  ethnicity?: z.infer<typeof Ethnicity>
}

export async function signUp(email: string, password: string, meta: SignupMeta = {}) {
  // Rides on auth.users.raw_user_meta_data so it survives the email
  // confirmation round trip even on a different device. `role_hint` name is
  // kept for the already-shipped RoleStep auto-commit.
  const data: Record<string, unknown> = {}
  if (meta.role) data.role_hint = meta.role
  if (meta.username) data.username = meta.username
  if (meta.city) data.city = meta.city
  if (meta.age != null) data.age = meta.age
  if (meta.body_type) data.body_type = meta.body_type
  if (meta.ethnicity) data.ethnicity = meta.ethnicity

  const { data: res, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      ...(Object.keys(data).length ? { data } : {}),
    },
  })
  if (error) throw error
  return res
}
```

- [ ] **Step 2: Write the failing bootstrap test**

`src/features/onboarding/__tests__/useSignupBootstrap.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { Session } from '@supabase/supabase-js'
import { mswServer } from '../../../test-setup'
import { useSignupBootstrap } from '../useSignupBootstrap'
import { AuthContext } from '@/lib/auth-context'
import { createQueryClient } from '@/lib/query-client'
import type { ReactNode } from 'react'

function wrap(meta: Record<string, unknown>) {
  const session = { user: { id: 'u1', user_metadata: meta } } as unknown as Session
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createQueryClient()}>
      <AuthContext.Provider value={{ status: 'authenticated', session }}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

describe('useSignupBootstrap', () => {
  it('commits body_type + ethnicity from metadata via set_profile_details', async () => {
    let body: unknown = null
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({ body_type: 'curvy', ethnicity: 'asian' }) })
    await waitFor(() => expect(body).not.toBeNull())
    expect(body).toMatchObject({ p_body_type: 'curvy', p_ethnicity: 'asian' })
  })

  it('does nothing when metadata has no captured fields', async () => {
    let called = false
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({}) })
    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })
})
```

- [ ] **Step 3: Run it, verify it fails**

Run: `pnpm test -- useSignupBootstrap`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the bootstrap hook**

`src/features/onboarding/useSignupBootstrap.ts`:

```ts
import { useEffect, useRef } from 'react'
import { useSession } from '@/lib/auth-context'
import { BodyType, Ethnicity } from '@shared/rpc-contracts'
import { setProfileDetails } from './api'

/**
 * On first authenticated entry after the single-page signup, commit the
 * sensitive profile fields that rode in auth metadata (body_type, ethnicity)
 * via set_profile_details. Role rides too but is committed by RoleStep's
 * existing auto-commit; identity/location need DOB/geocode and stay in the
 * wizard. Run-once, best-effort — a failure just leaves the details step to
 * collect them (pre-selected).
 */
export function useSignupBootstrap(): void {
  const { session } = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    const meta = session?.user?.user_metadata ?? {}
    const body_type = BodyType.safeParse(meta.body_type)
    const ethnicity = Ethnicity.safeParse(meta.ethnicity)
    if (!body_type.success && !ethnicity.success) return
    done.current = true
    void setProfileDetails({
      p_height_cm: null,
      p_body_type: body_type.success ? body_type.data : null,
      p_hair_color: null,
      p_eye_color: null,
      p_has_piercings: null,
      p_has_tattoos: null,
      p_smoking: null,
      p_drinking: null,
      p_education: null,
      p_yearly_income_band: null,
      p_net_worth_band: null,
      p_ethnicity: ethnicity.success ? ethnicity.data : null,
    }).catch(() => {
      // best-effort; details step will collect on failure
      done.current = false
    })
  }, [session])
}
```

Note: confirm `setProfileDetails`'s existing param object matches (it takes `p_*` keys per `shared/rpc-contracts.ts`); add `p_ethnicity` to the call site type if `api.ts` types it explicitly.

- [ ] **Step 5: Call the hook from the onboarding layout**

In `src/features/onboarding/pages/OnboardingLayout.tsx`, call `useSignupBootstrap()` at the top of the component (import it). It renders nothing.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- useSignupBootstrap && pnpm typecheck`
Expected: PASS; `tsc -b` clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth/api.ts src/features/onboarding/useSignupBootstrap.ts \
  src/features/onboarding/pages/OnboardingLayout.tsx src/features/onboarding/__tests__/useSignupBootstrap.test.tsx
git commit -m "Carry signup fields in auth metadata; bootstrap-commit body_type + ethnicity"
```

---

### Task 6: Single-page signup form + wizard shrink

**Files:**
- Modify: `src/features/auth/components/SignupForm.tsx` (the whole form)
- Create: `src/features/auth/components/ChipSelect.tsx` (single-select chip group)
- Modify: `src/features/auth/pages/SignupPage.tsx` (read `ref`/`utm_source`; pass to form)
- Modify: `src/features/onboarding/components/IdentityStep.tsx` (username prefilled + DOB; derive gender/looking-for; drop the two selects)
- Modify: `src/features/onboarding/components/LocationStep.tsx` (prefill input from metadata city)
- Modify: `src/features/onboarding/components/DetailsStep.tsx` (add ethnicity select; pre-select body_type/ethnicity from profile; friendly body-type labels)
- Modify: `src/i18n/en/auth.json`, `src/i18n/en/onboarding.json`, `src/i18n/en/profile.json` (labels)
- Test: `src/features/auth/__tests__/SignupForm.test.tsx`, `src/features/onboarding/__tests__/IdentityStep.test.tsx` (extend/adjust)

**Interfaces:**
- Consumes: `identityForRole` (Task 3), `recordSignupAttempt`/`SignupAttemptInput` (Task 4), `signUp`/`SignupMeta` (Task 5), `Ethnicity`/`BodyType` (Task 1).
- Produces: signup form emitting all captured fields to `signUp` metadata and `{role,city,age,acquisition_source}` to `recordSignupAttempt`; `ChipSelect` reused by both chip blocks.

- [ ] **Step 1: Write the failing form tests**

Replace/extend `src/features/auth/__tests__/SignupForm.test.tsx` — keep the existing check-email and role_hint cases; add:

```tsx
it('shows body-type chips for baby and not for benefactor', async () => {
  const { rerender } = render(<SignupForm roleHint="baby" />)
  expect(screen.getByRole('button', { name: /full figured/i })).toBeInTheDocument()
  rerender(<SignupForm roleHint="benefactor" />)
  expect(screen.queryByRole('button', { name: /full figured/i })).not.toBeInTheDocument()
  // ethnicity chips on both
  expect(screen.getByRole('button', { name: /^asian$/i })).toBeInTheDocument()
})

it('sends captured fields as signup metadata and records the attempt', async () => {
  let body: Record<string, unknown> | null = null
  mswServer.use(
    http.post('http://127.0.0.1:54321/auth/v1/signup', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ user: { id: 'u', email: 'a@b.test' }, session: null })
    }),
  )
  render(<SignupForm roleHint="baby" acquisitionSource="uni-flyer" />)
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
  await userEvent.type(screen.getByLabelText(/username/i), 'Lex')
  await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
  await userEvent.type(screen.getByLabelText(/location/i), 'London')
  await userEvent.type(screen.getByLabelText(/age/i), '22')
  await userEvent.click(screen.getByRole('button', { name: /curvy/i }))
  await userEvent.click(screen.getByRole('button', { name: /^asian$/i }))
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
  await screen.findByText(/check your email/i)
  expect(body).toMatchObject({
    data: { role_hint: 'baby', username: 'Lex', city: 'London', age: 22, body_type: 'curvy', ethnicity: 'asian' },
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test -- SignupForm`
Expected: FAIL (new fields/chips absent).

- [ ] **Step 3: Create the ChipSelect component**

`src/features/auth/components/ChipSelect.tsx`:

```tsx
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  accent,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  accent: string // e.g. 'bg-rose text-ink' when selected
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm text-bone/80">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                selected ? `${accent} border-transparent` : 'border-bone/20 text-bone/80 hover:border-bone/50'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 4: Rewrite `SignupForm`**

Rework `src/features/auth/components/SignupForm.tsx`: add `roleHint` (already) + `acquisitionSource?: string | null` props; add controlled state for username, city, age, body_type (baby), ethnicity; render the shared fields, then `ChipSelect` for body-type (baby only) and ethnicity (both), then the certification paragraph with `<Link>`s to `/legal/privacy` and `/legal/terms`. On submit: if `roleHint`, call `recordSignupAttempt({ role: roleHint, city, age: age ? Number(age) : null, acquisition_source: acquisitionSource ?? null })`, then `signUp(email, password, { role: roleHint, username, city, age: Number(age), body_type, ethnicity })`. Keep zod validation for email + password(min 8); age is a number input gated `>= 18` client-side (disable submit if under 18); chips optional. Use `authInput`/`authLabel`/`authError`/`authSubmit` from `AuthShell`. Body-type options (baby): `[{value:'slim',...},{value:'athletic',label:'Fit'},{value:'average',...},{value:'curvy',...},{value:'plus_size',label:'Full figured'},{value:'muscular',...}]` via i18n keys. Ethnicity options: white/black/asian/hispanic/other via i18n. Certification copy from `signup.certify` with interpolated links.

- [ ] **Step 5: Pass acquisition source from the page**

In `src/features/auth/pages/SignupPage.tsx` read `searchParams.get('ref') ?? searchParams.get('utm_source')` and pass as `acquisitionSource` to `<SignupForm>`.

- [ ] **Step 6: Add i18n keys**

`src/i18n/en/auth.json` — add: `signup.username`: "Username", `signup.usernamePlaceholder`: "Visible by all members", `signup.city`: "Location", `signup.cityPlaceholder`: "Enter your city", `signup.age`: "Age", `signup.bodyType`: "Body type", `signup.ethnicity`: "Ethnicity", `signup.under18`: "You must be at least 18.", `signup.certify`: "By clicking 'Sign up' I certify that I'm at least 18 years old and agree to the Tacit Privacy Policy and Terms.", plus `bodyType.slim/fit/average/curvy/fullFigured/muscular` and `ethnicity.white/black/asian/hispanic/other` label keys. (Keep certify simple text with two `<Link>`s rendered around the "Privacy Policy"/"Terms" words in the component; the i18n value may hold the sentence and the component wraps the link words, or split into `certify.pre`/`certify.mid`/`certify.post` — implementer's choice, keep it one visible sentence.)

- [ ] **Step 7: Shrink IdentityStep**

In `src/features/onboarding/components/IdentityStep.tsx`: remove the gender and looking-for `<select>`s and their form fields; prefill `display_name` from `session.user.user_metadata.username` (via `useSession`); on submit derive gender/looking-for with `identityForRole(role)` and call `setIdentity.mutateAsync({ display_name, date_of_birth, ...identityForRole(role ?? 'benefactor') })`. Keep the DOB ≥18 gating. Username field stays visible (labelled "Username", prefilled, editable) so an empty-metadata user is still handled.

- [ ] **Step 8: Prefill LocationStep**

In `src/features/onboarding/components/LocationStep.tsx`: initialise `input` state from `session.user.user_metadata.city` (via `useSession`) instead of `''`, so the signup city seeds the lookup. Leave the lookup/confirm flow unchanged.

- [ ] **Step 9: Add ethnicity to DetailsStep + friendly labels + pre-select**

In `src/features/onboarding/components/DetailsStep.tsx`: add `ethnicity` to the zod schema (`orEmpty(Ethnicity)`), the `emptyDefaults`, the `onSubmit` payload (`p_ethnicity` — confirm the details mutation/`setProfileDetails` accepts it after Task 5), and render an `EnumSelect` for ethnicity. Seed `defaultValues` from `me.profile` (body_type, ethnicity, etc.) so bootstrap-committed values pre-select. Relabel body-type/ethnicity option text via i18n instead of `v.replace(/_/g,' ')` for those two selects.

- [ ] **Step 10: Adjust the IdentityStep test**

Update `src/features/onboarding/__tests__/IdentityStep.test.tsx`: it must no longer expect gender/looking-for selects; add that submit sends role-derived gender/looking-for (mock `view_my_profile` to return `role: 'baby'`, assert the `set_profile_identity` body has `p_gender: 'female', p_looking_for: 'male'`). Keep the under-18 gate assertion.

- [ ] **Step 11: Run the full check suite**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: eslint clean, tsc clean, all tests pass.

- [ ] **Step 12: Screenshot-verify the form (manual)**

Ensure the dev stack is up (`/start-dev`), screenshot `/signup?role=baby` and `/signup?role=benefactor` at 390px, and confirm: baby has body-type + ethnicity chips, benefactor has ethnicity only, certification links present, Tacit styling intact. Save shots to the scratchpad.

- [ ] **Step 13: Commit**

```bash
git add src/features/auth src/features/onboarding src/i18n/en/auth.json \
  src/i18n/en/onboarding.json src/i18n/en/profile.json
git commit -m "Single-page role-diverged signup form; shrink onboarding wizard"
```

---

### Task 7: End-to-end flow test

**Files:**
- Create: `e2e/single-page-signup.spec.ts`

**Interfaces:**
- Consumes: the whole feature. Follows the existing Mailpit confirmation pattern (see `e2e/likes-and-filters.spec.ts` / the role-hint browser check).

- [ ] **Step 1: Write the e2e test**

`e2e/single-page-signup.spec.ts`: landing `/` → click "I'm a Sugar Baby" → fill email/username/password/city/age, pick a body-type chip and an ethnicity chip → Sign up → pull the confirm link from Mailpit (`http://127.0.0.1:54324/api/v1/messages`) → follow it → assert the wizard shows the DOB step (display name prefilled with the username), the location step input is pre-filled with the city, and the details step has the chosen body-type/ethnicity pre-selected → complete through to `/search`. Use unique email per run (vary by a passed-in suffix, since `Math.random` is fine in e2e). Assert against `role_hint` metadata via the app behaviour, not the DB.

- [ ] **Step 2: Run it**

Run: `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"') pnpm test:e2e -- e2e/single-page-signup.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run the whole e2e suite (guard against regressions in the shrunk wizard)**

Run: `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"') pnpm test:e2e`
Expected: all pass. (The onboarding specs assert role→identity→location flows; fix any that assumed gender/looking-for selects.)

- [ ] **Step 4: Commit**

```bash
git add e2e/single-page-signup.spec.ts
git commit -m "E2E: single-page signup through confirmation into shrunk wizard"
```

---

### Plan execution deviations

_(The executor fills this in as the spec meets reality — one commit per logged deviation, before moving on.)_

**Task 5 deviation:** the plan's bootstrap code used `p_*` keys and imported
`setProfileDetails` from `onboarding/api`; the real `setProfileDetails` lives
in `src/features/profile/api.ts` and takes friendly keys (mapped to `p_*` in
`callRpc`). The hook was adapted accordingly. Its new `ethnicity` arg was made
OPTIONAL (`ethnicity?: string | null`) rather than required, to mirror the DB
`p_ethnicity … DEFAULT NULL` and avoid touching the two other callers
(DetailsStep, DetailsSection) out of task scope — those are threaded in Task 6.
Also: `signUp`'s signature became `(email, password, meta)`, and its existing
SignupForm caller was updated to `{ role: roleHint }` to keep typecheck green.

**Task 7 deviation:** the plan assumed the e2e would pull the confirmation
link from Mailpit. Locally `enable_confirmations=false` and the Supabase
client uses `persistSession:false`, so `signUp()` returns an in-memory
session immediately and `RequireAnonymous` auto-navigates `/signup → / →
/onboarding/identity` on the `onAuthStateChange` event — no Mailpit round
trip or `page.goto` needed (a hard nav would drop the in-memory session).
The new spec relies on that client-side redirect. Consequence: the
SignupForm "Check your email…" copy has no e2e coverage on the local stack
(the guard redirects out first) — noted, not covered.

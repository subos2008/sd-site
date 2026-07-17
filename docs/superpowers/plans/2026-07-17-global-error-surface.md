# Global Error Surface + Sentry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a global error surface into the data layer — every query/mutation error and every render crash is shown to the user (persistent toast or recoverable boundary screen) and reported to Sentry — so no frontend error is ever silent, with per-mutation opt-out for components that handle errors inline.

**Architecture:** A small `src/lib/errors/` module: `app-error.ts` (normalize any throw into a render-ready `AppError`), `error-bus.ts` (module-level pub/sub feeding the toast), `sentry.ts` (env-gated init + capture), `ErrorToastHost.tsx` (persistent toast), and two error boundaries (`RootErrorBoundary` as the router root `errorElement`, `AppErrorBoundary` wrapping the providers). `query-client.ts` gains `QueryCache`/`MutationCache` `onError` that normalize → capture → report, skipping anything with `meta.suppressGlobalError`. OTel keeps doing traces; Sentry is errors-only.

**Tech Stack:** React 19, TanStack Query v5.100, React Router 7.15 (data router), react-i18next (namespaced, `keySeparator: false`), Vitest 4 + Testing Library + MSW, `@sentry/react` (new dependency).

## Global Constraints

- **No ambient/production defaults.** Sentry initializes ONLY when `VITE_SENTRY_DSN` is set (mirrors the OTel gating). `environment` comes from `VITE_SENTRY_ENVIRONMENT` and is left `undefined` when unset — never assume "production". `release` from `VITE_BUILD_ID`, undefined when unset.
- **Sentry PII: send everything, no scrubbing.** `sendDefaultPii: true`, NO `beforeSend`/`beforeBreadcrumb` redaction. This is a deliberate, informed product-owner decision (recorded in the design spec). Do not add scrubbing.
- **Sentry is errors-only.** `tracesSampleRate: 0` and NO browser-tracing integration — OTel (`src/lib/otel.ts`) owns tracing. Do not add Sentry performance/tracing.
- **Opt-out contract:** a query/mutation carrying `meta: { suppressGlobalError: true }` must NOT surface globally (no toast, no Sentry capture from the cache handler). Exact key: `suppressGlobalError`.
- **i18n:** new namespace `errors`; flat keys (`keySeparator: false`, `nsSeparator: ':'`). Register it in `src/lib/i18n.ts`. English only.
- **`captureError` must no-op when Sentry was never initialized** (dev/tests/local without a DSN stay clean).
- **AppErrorBoundary is the catastrophic fallback** — it wraps the providers, so it cannot use hooks/i18n and must not depend on app CSS. Inline styles, hardcoded English.
- Plain commit messages, no self-attribution. `git push` after each commit.
- Do NOT prepend `PATH=/usr/bin:...` to `pnpm build`/`pnpm add` (arm64 rollup). `pnpm add`, `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` are the checks.
- Every task ends green: `pnpm typecheck && pnpm lint && pnpm vitest run`.

## File structure

- `src/lib/errors/app-error.ts` — `AppError` type + `toAppError(unknown): AppError`.
- `src/lib/errors/error-bus.ts` — bounded queue + pub/sub (`reportError`, `subscribe`, `getSnapshot`, `dismiss`, `clear`).
- `src/lib/errors/sentry.ts` — `initSentry()`, `captureError()`, `__resetSentryForTest()`.
- `src/lib/errors/ErrorToastHost.tsx` — persistent toast, reads the bus via `useSyncExternalStore`.
- `src/lib/errors/RootErrorBoundary.tsx` — router `errorElement` (uses `useRouteError`).
- `src/lib/errors/AppErrorBoundary.tsx` — class boundary around the providers.
- `src/lib/query-client.ts` — add `QueryCache`/`MutationCache` `onError`.
- `src/routes.tsx` — wrap `routeConfig` under a root route with `errorElement`.
- `src/main.tsx` — `initSentry()`, `<AppErrorBoundary>`, `<ErrorToastHost/>`.
- `src/i18n/en/errors.json` + `src/lib/i18n.ts` — the `errors` namespace.
- The 8 inline-handled mutation hooks — add `meta.suppressGlobalError`.

---

### Task 1: Sentry module (env-gated init + capture)

**Files:**
- Create: `src/lib/errors/sentry.ts`
- Create: `src/lib/errors/__tests__/sentry.test.ts`
- Modify: `package.json` (add `@sentry/react`)

**Interfaces:**
- Produces: `initSentry(): void`, `captureError(err: unknown, context?: Record<string, unknown>): void`, `__resetSentryForTest(): void`.

- [ ] **Step 1: Add the dependency**

Run: `pnpm add @sentry/react`
Expected: `@sentry/react` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `src/lib/errors/__tests__/sentry.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException: vi.fn() }))
import * as Sentry from '@sentry/react'
import { initSentry, captureError, __resetSentryForTest } from '../sentry'

describe('sentry', () => {
  beforeEach(() => {
    __resetSentryForTest()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('does not initialize without a DSN', () => {
    initSentry()
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('initializes errors-only when a DSN is set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o.ingest.sentry.io/1')
    initSentry()
    expect(Sentry.init).toHaveBeenCalledOnce()
    const cfg = (Sentry.init as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as Record<string, unknown>
    expect(cfg.sendDefaultPii).toBe(true)
    expect(cfg.tracesSampleRate).toBe(0)
    expect(cfg.integrations).toEqual([])
  })

  it('captureError no-ops until initialized', () => {
    captureError(new Error('x'))
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('captureError forwards to Sentry once initialized', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o.ingest.sentry.io/1')
    initSentry()
    const e = new Error('boom')
    captureError(e, { rpc: 'foo' })
    expect(Sentry.captureException).toHaveBeenCalledWith(e, { extra: { rpc: 'foo' } })
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/lib/errors/__tests__/sentry.test.ts`
Expected: FAIL — `../sentry` not found.

- [ ] **Step 4: Implement `sentry.ts`**

Create `src/lib/errors/sentry.ts`:

```ts
import * as Sentry from '@sentry/react'

let initialized = false

/**
 * Initialise Sentry for error reporting only (OTel owns tracing).
 * Env-gated: no-op unless VITE_SENTRY_DSN is set — dev/tests/local stay off.
 * No ambient default to production. sendDefaultPii is intentionally true and
 * there is no beforeSend scrubbing (deliberate product decision).
 */
export function initSentry(): void {
  if (initialized) return
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined,
    release: import.meta.env.VITE_BUILD_ID as string | undefined,
    sendDefaultPii: true,
    tracesSampleRate: 0,
    integrations: [],
  })
  initialized = true
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

/** Test-only: reset the module init flag between tests. */
export function __resetSentryForTest(): void {
  initialized = false
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run src/lib/errors/__tests__/sentry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add package.json pnpm-lock.yaml src/lib/errors/sentry.ts src/lib/errors/__tests__/sentry.test.ts
git commit -m "Add env-gated Sentry error-reporting module"
git push
```

---

### Task 2: AppError normalization

**Files:**
- Create: `src/lib/errors/app-error.ts`
- Create: `src/lib/errors/__tests__/app-error.test.ts`

**Interfaces:**
- Consumes: `RpcTransportError`, `RpcContractError` from `src/lib/rpc.ts` (both have `.rpc: string`; `RpcTransportError` also has `.cause: unknown`).
- Produces: `type AppErrorKind = 'transport' | 'contract' | 'render' | 'unknown'`; `interface AppError { kind, name, message, rpc?, status?, method?, path? }`; `toAppError(err: unknown): AppError`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/errors/__tests__/app-error.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RpcTransportError, RpcContractError } from '@/lib/rpc'
import { toAppError } from '../app-error'

describe('toAppError', () => {
  it('maps a transport error to POST + rpc path', () => {
    const e = toAppError(new RpcTransportError('set_profile_role', { status: 500 }))
    expect(e.kind).toBe('transport')
    expect(e.name).toBe('RpcTransportError')
    expect(e.rpc).toBe('set_profile_role')
    expect(e.method).toBe('POST')
    expect(e.path).toBe('/rest/v1/rpc/set_profile_role')
    expect(e.status).toBe(500)
  })

  it('leaves status undefined when the cause has none', () => {
    const e = toAppError(new RpcTransportError('foo', { code: 'PGRST' }))
    expect(e.kind).toBe('transport')
    expect(e.status).toBeUndefined()
  })

  it('maps a contract error', () => {
    const e = toAppError(new RpcContractError('view_search', []))
    expect(e.kind).toBe('contract')
    expect(e.name).toBe('RpcContractError')
    expect(e.rpc).toBe('view_search')
    expect(e.message).toContain('view_search')
  })

  it('maps a plain Error to render kind', () => {
    const e = toAppError(new TypeError('cannot read x'))
    expect(e.kind).toBe('render')
    expect(e.name).toBe('TypeError')
    expect(e.message).toBe('cannot read x')
  })

  it('maps a non-Error throw to unknown', () => {
    const e = toAppError('a string')
    expect(e.kind).toBe('unknown')
    expect(e.message).toBe('a string')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/errors/__tests__/app-error.test.ts`
Expected: FAIL — `../app-error` not found.

- [ ] **Step 3: Implement `app-error.ts`**

Create `src/lib/errors/app-error.ts`:

```ts
import { RpcTransportError, RpcContractError } from '@/lib/rpc'

export type AppErrorKind = 'transport' | 'contract' | 'render' | 'unknown'

export interface AppError {
  kind: AppErrorKind
  name: string
  message: string
  rpc?: string
  status?: number
  method?: string
  path?: string
}

/**
 * Normalise any thrown value into a render-ready AppError. Supabase RPCs are
 * POSTs to /rest/v1/rpc/<fn>; the PostgrestError cause does not reliably carry
 * a numeric HTTP status, so `status` is best-effort (undefined when absent) —
 * method + path + message still make a bug report actionable.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof RpcTransportError) {
    const cause = err.cause as { status?: unknown } | null | undefined
    const status = typeof cause?.status === 'number' ? cause.status : undefined
    return {
      kind: 'transport',
      name: 'RpcTransportError',
      message: err.message,
      rpc: err.rpc,
      status,
      method: 'POST',
      path: `/rest/v1/rpc/${err.rpc}`,
    }
  }
  if (err instanceof RpcContractError) {
    return {
      kind: 'contract',
      name: 'RpcContractError',
      message: `Unexpected response from ${err.rpc}`,
      rpc: err.rpc,
    }
  }
  if (err instanceof Error) {
    return { kind: 'render', name: err.name || 'Error', message: err.message }
  }
  return { kind: 'unknown', name: 'UnknownError', message: String(err) }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/errors/__tests__/app-error.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/lib/errors/app-error.ts src/lib/errors/__tests__/app-error.test.ts
git commit -m "Add AppError normalization for the global error surface"
git push
```

---

### Task 3: Error bus (queue + pub/sub)

**Files:**
- Create: `src/lib/errors/error-bus.ts`
- Create: `src/lib/errors/__tests__/error-bus.test.ts`

**Interfaces:**
- Consumes: `AppError` from `./app-error`.
- Produces: `reportError(e: AppError): void`, `dismiss(index: number): void`, `clear(): void`, `getSnapshot(): AppError[]`, `subscribe(listener: () => void): () => void`. Newest error is at index 0; queue capped at 5; an incoming error identical (`kind`+`message`+`rpc`) to the head is coalesced.

- [ ] **Step 1: Write the failing test**

Create `src/lib/errors/__tests__/error-bus.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AppError } from '../app-error'
import { reportError, dismiss, clear, getSnapshot, subscribe } from '../error-bus'

const mk = (over: Partial<AppError> = {}): AppError => ({
  kind: 'transport', name: 'RpcTransportError', message: 'boom', rpc: 'foo', ...over,
})

describe('error-bus', () => {
  beforeEach(() => clear())

  it('reports an error and notifies subscribers', () => {
    const cb = vi.fn()
    const unsub = subscribe(cb)
    reportError(mk())
    expect(getSnapshot()).toHaveLength(1)
    expect(cb).toHaveBeenCalled()
    unsub()
  })

  it('coalesces an identical head error', () => {
    reportError(mk())
    reportError(mk())
    expect(getSnapshot()).toHaveLength(1)
  })

  it('stacks distinct errors newest-first and caps at 5', () => {
    for (let i = 0; i < 7; i++) reportError(mk({ message: `e${i}` }))
    const snap = getSnapshot()
    expect(snap).toHaveLength(5)
    expect(snap[0].message).toBe('e6')
  })

  it('dismisses by index', () => {
    reportError(mk({ message: 'a' }))
    reportError(mk({ message: 'b' }))
    dismiss(0) // removes newest ('b')
    expect(getSnapshot().map((e) => e.message)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/errors/__tests__/error-bus.test.ts`
Expected: FAIL — `../error-bus` not found.

- [ ] **Step 3: Implement `error-bus.ts`**

Create `src/lib/errors/error-bus.ts`:

```ts
import type { AppError } from './app-error'

const MAX_QUEUE = 5
let queue: AppError[] = []
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function sameError(a: AppError, b: AppError): boolean {
  return a.kind === b.kind && a.message === b.message && a.rpc === b.rpc
}

export function reportError(e: AppError): void {
  if (queue.length > 0 && sameError(queue[0], e)) return
  queue = [e, ...queue].slice(0, MAX_QUEUE)
  emit()
}

export function dismiss(index: number): void {
  queue = queue.filter((_, i) => i !== index)
  emit()
}

export function clear(): void {
  if (queue.length === 0) return
  queue = []
  emit()
}

export function getSnapshot(): AppError[] {
  return queue
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/errors/__tests__/error-bus.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/lib/errors/error-bus.ts src/lib/errors/__tests__/error-bus.test.ts
git commit -m "Add error-bus queue for the global error toast"
git push
```

---

### Task 4: Wire QueryCache/MutationCache onError with opt-out

**Files:**
- Modify: `src/lib/query-client.ts`
- Create: `src/lib/__tests__/query-client.test.ts`

**Interfaces:**
- Consumes: `toAppError` (`./errors/app-error`), `reportError` (`./errors/error-bus`), `captureError` (`./errors/sentry`).
- Produces: `createQueryClient()` now surfaces query & mutation errors globally, skipping any with `meta.suppressGlobalError === true`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/query-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/errors/sentry', () => ({ captureError: vi.fn(), initSentry: vi.fn() }))
vi.mock('@/lib/errors/error-bus', () => ({ reportError: vi.fn() }))

import { RpcTransportError } from '@/lib/rpc'
import { captureError } from '@/lib/errors/sentry'
import { reportError } from '@/lib/errors/error-bus'
import { createQueryClient } from '../query-client'

describe('createQueryClient global error surface', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports and captures a mutation error with no opt-out meta', () => {
    const client = createQueryClient()
    const onError = client.getMutationCache().config.onError!
    onError(new RpcTransportError('set_profile_role', { status: 500 }), undefined, undefined, {
      meta: undefined,
    } as never)
    expect(reportError).toHaveBeenCalledOnce()
    expect(captureError).toHaveBeenCalledOnce()
    expect((reportError as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toMatchObject({
      kind: 'transport',
      rpc: 'set_profile_role',
    })
  })

  it('suppresses surfacing when meta.suppressGlobalError is true', () => {
    const client = createQueryClient()
    const onError = client.getMutationCache().config.onError!
    onError(new RpcTransportError('set_profile_role', {}), undefined, undefined, {
      meta: { suppressGlobalError: true },
    } as never)
    expect(reportError).not.toHaveBeenCalled()
    expect(captureError).not.toHaveBeenCalled()
  })

  it('reports a query error with no opt-out meta', () => {
    const client = createQueryClient()
    const onError = client.getQueryCache().config.onError!
    onError(new RpcTransportError('view_search', {}), { meta: undefined } as never)
    expect(reportError).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/query-client.test.ts`
Expected: FAIL — the current `createQueryClient` has no `queryCache`/`mutationCache`, so `config.onError` is `undefined` and the `!` call throws.

- [ ] **Step 3: Implement the wiring**

Replace `src/lib/query-client.ts`:

```ts
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { toAppError } from './errors/app-error'
import { reportError } from './errors/error-bus'
import { captureError } from './errors/sentry'

function surfaceError(error: unknown, meta: Record<string, unknown> | undefined): void {
  if (meta?.suppressGlobalError === true) return
  const appError = toAppError(error)
  captureError(error, { kind: appError.kind, rpc: appError.rpc, status: appError.status })
  reportError(appError)
}

// Defaults tuned for the SD Site profile: short stale times (we don't have realtime),
// retry once on transient network errors. QueryCache/MutationCache onError form the
// global error surface — every error is shown + reported unless a query/mutation opts
// out via meta.suppressGlobalError (components that surface the error inline themselves).
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => surfaceError(error, query.meta),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => surfaceError(error, mutation.meta),
    }),
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

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/query-client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite, typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS (existing tests unaffected — they mock successful RPCs, so `onError` never fires).

```bash
git add src/lib/query-client.ts src/lib/__tests__/query-client.test.ts
git commit -m "Surface query/mutation errors globally via QueryCache/MutationCache onError"
git push
```

---

### Task 5: ErrorToastHost + errors i18n namespace

**Files:**
- Create: `src/i18n/en/errors.json`
- Modify: `src/lib/i18n.ts`
- Create: `src/lib/errors/ErrorToastHost.tsx`
- Create: `src/lib/errors/__tests__/ErrorToastHost.test.tsx`

**Interfaces:**
- Consumes: `subscribe`, `getSnapshot`, `dismiss` (`./error-bus`); `AppError` shape.
- Produces: `ErrorToastHost` component (renders the persistent toast queue).

- [ ] **Step 1: Add the i18n namespace file**

Create `src/i18n/en/errors.json`:

```json
{
  "toast.dismiss": "Dismiss",
  "boundary.title": "Something went wrong",
  "boundary.body": "An unexpected error occurred. You can try reloading the page.",
  "boundary.reload": "Reload"
}
```

- [ ] **Step 2: Register the namespace**

In `src/lib/i18n.ts`, add the import (after the other `en/*` imports):

```ts
import enErrors from '../i18n/en/errors.json'
```

and add `errors: enErrors,` to the `resources.en` object (e.g. after `notifications: enNotifications,`).

- [ ] **Step 3: Write the failing test**

Create `src/lib/errors/__tests__/ErrorToastHost.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '@/lib/i18n'
import type { AppError } from '../app-error'
import { reportError, clear } from '../error-bus'
import { ErrorToastHost } from '../ErrorToastHost'

await initI18n()

const transport: AppError = {
  kind: 'transport', name: 'RpcTransportError', message: 'boom',
  rpc: 'set_profile_role', method: 'POST', path: '/rest/v1/rpc/set_profile_role', status: 500,
}

describe('ErrorToastHost', () => {
  beforeEach(() => clear())

  it('renders nothing when there are no errors', () => {
    render(<ErrorToastHost />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders a reported error with its transport detail line', () => {
    render(<ErrorToastHost />)
    act(() => reportError(transport))
    expect(screen.getByText('RpcTransportError')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.getByText(/\/rest\/v1\/rpc\/set_profile_role/)).toBeInTheDocument()
  })

  it('dismisses an error on click', async () => {
    render(<ErrorToastHost />)
    act(() => reportError(transport))
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm vitest run src/lib/errors/__tests__/ErrorToastHost.test.tsx`
Expected: FAIL — `../ErrorToastHost` not found.

- [ ] **Step 5: Implement `ErrorToastHost.tsx`**

Create `src/lib/errors/ErrorToastHost.tsx`:

```tsx
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { subscribe, getSnapshot, dismiss } from './error-bus'

export function ErrorToastHost() {
  const { t } = useTranslation('errors')
  const errors = useSyncExternalStore(subscribe, getSnapshot)

  if (errors.length === 0) return null

  return (
    <div className="fixed top-2 inset-x-2 max-w-sm mx-auto z-50 flex flex-col gap-2">
      {errors.map((e, i) => (
        <div
          key={i}
          role="alert"
          aria-live="assertive"
          className="rounded-lg shadow-lg bg-red-700 text-white p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm">{e.name}</div>
              <div className="text-sm break-words">{e.message}</div>
              {e.kind === 'transport' && (
                <div className="text-xs font-mono opacity-90 mt-1 break-all">
                  {e.method} {e.path}
                  {e.status != null ? ` · ${e.status}` : ''}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(i)}
              aria-label={t('toast.dismiss')}
              className="text-white/90 shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm vitest run src/lib/errors/__tests__/ErrorToastHost.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/i18n/en/errors.json src/lib/i18n.ts src/lib/errors/ErrorToastHost.tsx src/lib/errors/__tests__/ErrorToastHost.test.tsx
git commit -m "Add persistent ErrorToastHost and errors i18n namespace"
git push
```

---

### Task 6: Error boundaries + mount everything

**Files:**
- Create: `src/lib/errors/RootErrorBoundary.tsx`
- Create: `src/lib/errors/AppErrorBoundary.tsx`
- Create: `src/lib/errors/__tests__/boundaries.test.tsx`
- Modify: `src/routes.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `captureError` (`./sentry`); `useRouteError` (`react-router`).
- Produces: `RootErrorBoundary` (route `errorElement`), `AppErrorBoundary` (class boundary). `router` now wraps `routeConfig` under a root `errorElement`; `main.tsx` calls `initSentry()`, wraps in `<AppErrorBoundary>`, mounts `<ErrorToastHost/>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/errors/__tests__/boundaries.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { initI18n } from '@/lib/i18n'

vi.mock('../sentry', () => ({ captureError: vi.fn(), initSentry: vi.fn() }))
import { captureError } from '../sentry'
import { RootErrorBoundary } from '../RootErrorBoundary'
import { AppErrorBoundary } from '../AppErrorBoundary'

await initI18n()

function Boom(): never {
  throw new Error('kaboom')
}

describe('error boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('RootErrorBoundary shows a recoverable screen and captures the error', async () => {
    const router = createMemoryRouter([
      { path: '/', element: <Boom />, errorElement: <RootErrorBoundary /> },
    ])
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
    expect(captureError).toHaveBeenCalled()
  })

  it('AppErrorBoundary catches a render crash and captures it', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(captureError).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/errors/__tests__/boundaries.test.tsx`
Expected: FAIL — boundary modules not found.

- [ ] **Step 3: Implement `RootErrorBoundary.tsx`**

Create `src/lib/errors/RootErrorBoundary.tsx`:

```tsx
import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { captureError } from './sentry'

export function RootErrorBoundary() {
  const { t } = useTranslation('errors')
  const error = useRouteError()

  useEffect(() => {
    captureError(error)
  }, [error])

  return (
    <main className="p-6 max-w-md mx-auto flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{t('boundary.title')}</h1>
      <p className="text-slate-600">{t('boundary.body')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-slate-800 text-white py-2 px-4 rounded self-start"
      >
        {t('boundary.reload')}
      </button>
    </main>
  )
}
```

- [ ] **Step 4: Implement `AppErrorBoundary.tsx`**

Create `src/lib/errors/AppErrorBoundary.tsx` (class component, no hooks/i18n/app-CSS — it wraps the providers and must survive a provider crash):

```tsx
import { Component, type ReactNode } from 'react'
import { captureError } from './sentry'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    captureError(error)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 24, maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please reload the page.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 5: Run to verify boundaries pass**

Run: `pnpm vitest run src/lib/errors/__tests__/boundaries.test.tsx`
Expected: PASS (2 tests). (Console will show React's expected "error boundary" logging — that's fine.)

- [ ] **Step 6: Wire the router root errorElement**

In `src/routes.tsx`, add the import:

```tsx
import { RootErrorBoundary } from './lib/errors/RootErrorBoundary'
```

and replace the `router` export so the whole tree sits under a root route with the boundary (a route with no `element` renders an implicit `<Outlet/>`):

```tsx
export const router = createBrowserRouter([
  { errorElement: <RootErrorBoundary />, children: routeConfig },
])
```

- [ ] **Step 7: Wire main.tsx (Sentry init + boundary + toast host)**

In `src/main.tsx`, add imports:

```tsx
import { AppErrorBoundary } from './lib/errors/AppErrorBoundary'
import { ErrorToastHost } from './lib/errors/ErrorToastHost'
import { initSentry } from './lib/errors/sentry'
```

Add `initSentry()` right after `initOtel()`:

```tsx
initOtel()
initSentry()
initI18n()
```

Wrap the tree and mount the toast host:

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        <ErrorToastHost />
        {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
```

- [ ] **Step 8: Full suite, typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

```bash
git add src/lib/errors/RootErrorBoundary.tsx src/lib/errors/AppErrorBoundary.tsx src/lib/errors/__tests__/boundaries.test.tsx src/routes.tsx src/main.tsx
git commit -m "Add render error boundaries and mount the global error surface"
git push
```

---

### Task 7: Opt out inline-handled mutations + integration proof

**Files:**
- Modify: `src/features/onboarding/hooks.ts` (`useSetRole`, `useSetIdentity`, `useSetLocation`, `useCompleteOnboarding`, `useUploadProfilePhoto`)
- Modify: `src/features/profile/hooks.ts` (`useSetBio`, `useSetDetails`)
- Modify: `src/features/interests/hooks.ts` (`useSetProfileInterests`)
- Create: `src/features/onboarding/__tests__/inline-error-optout.test.tsx`

**Interfaces:**
- Consumes: the `meta.suppressGlobalError` contract from Task 4.
- These mutations already surface errors inline (their own `serverError` alert); adding the meta prevents a duplicate global toast.

- [ ] **Step 1: Add the meta to each mutation**

In `src/features/onboarding/hooks.ts`, add `meta: { suppressGlobalError: true },` to the `useMutation({ ... })` options object of `useSetRole`, `useSetIdentity`, `useSetLocation`, `useCompleteOnboarding`, and `useUploadProfilePhoto` (alongside their existing `mutationFn`/`onSuccess`). Example for `useSetRole`:

```ts
export function useSetRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileRole,
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
```

Apply the same one-line `meta` addition to the other four hooks in this file.

- [ ] **Step 2: Add the meta in the other two hook files**

In `src/features/profile/hooks.ts`, add `meta: { suppressGlobalError: true },` to `useSetBio` and `useSetDetails`. In `src/features/interests/hooks.ts`, add it to `useSetProfileInterests`. (Do NOT add it to `useReorderPhotos`/`useRemovePhoto` — those have no inline handling, so they should surface globally.)

- [ ] **Step 3: Write the integration test**

Create `src/features/onboarding/__tests__/inline-error-optout.test.tsx`. It proves that when an onboarding mutation fails, the step's INLINE error shows but NO global toast appears (the toast renders the error `name` + the `/rest/v1/rpc/...` line, which the inline alert does not):

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import { clear } from '@/lib/errors/error-bus'
import { ErrorToastHost } from '@/lib/errors/ErrorToastHost'
import { RoleStep } from '../components/RoleStep'
import type { ReactNode } from 'react'

await initI18n()

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        {ui}
        <ErrorToastHost />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('inline-handled onboarding mutations opt out of the global toast', () => {
  beforeEach(() => clear())

  it('shows the inline error but no global toast when set_profile_role fails', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    render(wrap(<RoleStep />))
    await userEvent.click(screen.getByRole('button', { name: /benefactor/i }))
    // Inline error appears (RoleStep sets serverError from the thrown message).
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    // The global toast's distinctive transport line must NOT be present.
    expect(screen.queryByText(/\/rest\/v1\/rpc\/set_profile_role/)).toBeNull()
  })
})
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/onboarding/__tests__/inline-error-optout.test.tsx`
Expected: PASS. (If it fails because the toast line IS present, the `meta` was not applied to `useSetRole`.)

- [ ] **Step 5: Full suite, typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

```bash
git add src/features/onboarding/hooks.ts src/features/profile/hooks.ts src/features/interests/hooks.ts src/features/onboarding/__tests__/inline-error-optout.test.tsx
git commit -m "Opt inline-handled mutations out of the global error surface"
git push
```

---

### Task 8: Docs — CLAUDE.md + env vars

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (env-var documentation; if no env section exists, add one)

**Interfaces:** none (documentation).

- [ ] **Step 1: Update the CLAUDE.md error-handling guidance**

In `CLAUDE.md`, under "## Working preferences" (or wherever the error-handling rule lives — search for "surface errors"), replace/extend the aspirational rule with a pointer to the implemented surface. Add this bullet (adjust surrounding wording to fit):

```markdown
- **Frontend errors surface globally by default.** `src/lib/query-client.ts`
  wires `QueryCache`/`MutationCache` `onError` into a global surface: every
  query/mutation error shows a persistent `ErrorToastHost` toast (error name +
  message, and for RPC failures `POST /rest/v1/rpc/<fn>` + status) and is sent
  to Sentry. Render crashes are caught by `RootErrorBoundary` (router
  `errorElement`) and `AppErrorBoundary` (around the providers). To handle an
  error inline instead (e.g. a form-adjacent message), set
  `meta: { suppressGlobalError: true }` on that `useMutation`/`useQuery` and
  render the error yourself — do NOT swallow it. Sentry is env-gated on
  `VITE_SENTRY_DSN` (off in dev/tests); it currently sends full PII with no
  scrubbing by deliberate decision — see
  `docs/superpowers/specs/2026-07-17-global-error-surface-design.md` and the
  compliance follow-up before any live deployment.
```

- [ ] **Step 2: Document the new env vars**

In `README.md`, in the environment/configuration section (create a short "### Frontend env vars" subsection if none exists), document:

```markdown
- `VITE_SENTRY_DSN` — Sentry DSN for frontend error reporting. **Unset ⇒ Sentry is off** (dev/tests/local). No default.
- `VITE_SENTRY_ENVIRONMENT` — Sentry environment tag (e.g. `production`, `staging`). Unset ⇒ no environment tag; never assumed to be production.
- `VITE_BUILD_ID` — build identifier (git commit sha) used as the Sentry release. Optional.
```

- [ ] **Step 3: Commit**

(No code change; nothing to test.)

```bash
git add CLAUDE.md README.md
git commit -m "Document the global error surface and its Sentry env vars"
git push
```

---

## Self-review notes

- **Spec coverage:** app-error (T2), error-bus (T3), sentry env-gated + PII-on + errors-only (T1), global default + opt-out (T4), persistent toast + i18n (T5), root-route + provider boundaries + mounts (T6), inline reconciliation via opt-out (T7), CLAUDE.md + env docs (T8). Compliance follow-up is in the design spec (non-code). OTel trace_id correlation is an explicitly deferred open question — not implemented.
- **Type consistency:** `AppError`/`toAppError` (T2) consumed by T4/T5; `reportError`/`subscribe`/`getSnapshot`/`dismiss`/`clear` (T3) consumed by T4/T5/T7; `captureError`/`initSentry` (T1) consumed by T4/T6; `meta.suppressGlobalError` defined in T4, applied in T7.
- **Known caveat:** `RpcTransportError.cause` (a Supabase PostgrestError) usually has no numeric `status`, so `AppError.status` is often `undefined`; the toast still shows `POST /rest/v1/rpc/<fn>` + the message. This is intended (documented in T2).

## Execution deviations

_(The executor fills this section as reality meets the spec, one commit per deviation — repo convention.)_

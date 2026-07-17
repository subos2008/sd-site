# Global error surface + Sentry — design

Status: approved (2026-07-17). Next step: turn into an implementation plan via
`superpowers:writing-plans`. Resolves issues #2 (global error surface) and #1
(Sentry) filed during spec 010.

## Motivation

The project rule (CLAUDE.md): the frontend must **surface errors to the user,
never swallow them** — show the error name + message in the UI (and for API
errors the HTTP status + method + path), so a non-technical bug report is
actionable without opening the console; and distinguish an error state from an
empty state. This must be done **architecturally** — a global surface wired
into the data layer plus a render error boundary — not ad-hoc per call.

Today none of that exists:

- `src/lib/query-client.ts` sets only retry/staleTime defaults — no
  `QueryCache`/`MutationCache` `onError`.
- There is no render error boundary anywhere (a component crash white-screens).
- Errors surface only where a component happens to implement a local
  `try/catch` + inline alert (RoleStep, PhotoStep, BioStep, and the
  Details/Interests stopgaps added at the end of spec 010). Components without
  it (many queries, most mutations) let thrown errors vanish.

There is already `src/lib/otel.ts` (`initOtel`) doing **distributed tracing**
(OTLP exporter, fetch instrumentation, env-gated on
`VITE_OTEL_EXPORTER_OTLP_ENDPOINT`). That captures spans/performance, not
aggregated exceptions — complementary to, not a substitute for, error
reporting.

## Decisions (resolved during brainstorming)

1. **Global default + explicit opt-out.** Every query/mutation error surfaces
   globally by default; a query or mutation can opt OUT (`meta:
   { suppressGlobalError: true }`) when it handles the error contextually.
2. **Sentry for errors; OTel stays for traces.** Sentry is added purely for
   exception aggregation/grouping/alerting. OTel keeps doing traces. (Optional
   nicety: stamp the OTel `trace_id` onto Sentry events for cross-linking —
   see Open questions.)
3. **Send everything to Sentry — no scrubbing.** Deliberate, informed decision
   by the product owner (the risks of shipping signed media URLs and message
   content to a third party were laid out explicitly). `sendDefaultPii: true`,
   no `beforeSend` redaction. See "Compliance follow-up".
4. **Dedicated persistent error toast.** A separate top-of-screen toast host
   (parallel to `BannerHost`) that stays until dismissed — errors must not
   auto-vanish before a user can read/screenshot them.
5. **Root-route `errorElement` + top-level boundary.** A router-integrated
   boundary for render crashes in routes, plus a thin boundary around the
   providers for the rare crash above the router. Both recover to a
   "something went wrong — reload" screen and report to Sentry.

## Architecture

A small `src/lib/errors/` module plus two mount points. Each unit has one
responsibility and a narrow interface.

### `src/lib/errors/app-error.ts`

Normalizes any thrown value into a structured, render-ready shape.

```ts
export type AppErrorKind = 'transport' | 'contract' | 'render' | 'unknown'

export interface AppError {
  kind: AppErrorKind
  name: string        // error class/name, e.g. "RpcTransportError"
  message: string     // human-readable
  rpc?: string        // RPC function name, when known
  status?: number     // HTTP-ish status, transport errors only
  method?: string     // 'POST' for RPC calls
  path?: string       // '/rest/v1/rpc/<fn>' for RPC calls
}

export function toAppError(err: unknown): AppError
```

Mapping (imports `RpcTransportError` / `RpcContractError` from `src/lib/rpc.ts`):
- `RpcTransportError` → `kind:'transport'`, `rpc`, `method:'POST'`,
  `path:'/rest/v1/rpc/<rpc>'`, `status` from the Supabase cause when present.
- `RpcContractError` → `kind:'contract'`, `rpc`, message "unexpected response
  from <rpc>".
- A thrown `Error` from a render → `kind:'render'` (name/message from the Error).
- Anything else → `kind:'unknown'` with a stringified message.

### `src/lib/errors/error-bus.ts`

A tiny module-level pub/sub. Needed because react-query cache callbacks fire
**outside** React; the toast host can't receive them via props/context.

```ts
export function reportError(e: AppError): void
export function subscribe(listener: (errors: AppError[]) => void): () => void
export function getSnapshot(): AppError[]   // for useSyncExternalStore
export function dismiss(index: number): void
export function clear(): void
```

Holds a small bounded queue (cap ~5). De-dupes: an incoming error identical
(`kind` + `message` + `rpc`) to the head within a short window is coalesced
(optionally with a repeat count) rather than stacked.

### `src/lib/errors/sentry.ts`

```ts
export function initSentry(): void        // idempotent; no-op if no DSN
export function captureError(err: unknown, context?: Record<string, unknown>): void
```

- Uses `@sentry/react`. **Env-gated**, mirroring the OTel pattern: active only
  when `VITE_SENTRY_DSN` is set. No ambient default to production.
- `environment` from `VITE_SENTRY_ENVIRONMENT` (explicit; unset ⇒ leave
  undefined, never assume "production").
- `release` from the build id (`VITE_BUILD_ID`, the git sha — aligns with spec
  040; unset ⇒ undefined).
- `sendDefaultPii: true`. **No `beforeSend` scrubbing** (per decision 3).
- Errors-only: do NOT enable Sentry's browser-tracing integration
  (`tracesSampleRate: 0`, no `browserTracingIntegration`) — OTel owns tracing.
- `captureError` no-ops when Sentry was never initialized (so dev/tests without
  a DSN are clean), and attaches the `AppError` fields (`kind`, `rpc`,
  `status`) as tags/context.

### `src/lib/errors/ErrorToastHost.tsx`

Subscribes to the bus via `useSyncExternalStore` and renders the persistent
toast queue. Visual language consistent with `BannerHost` (fixed top, max-w,
shadow) but **manual dismiss only** (a close button; no 5s auto-dismiss),
`role="alert"` / `aria-live="assertive"`. Renders: error name, message, and for
transport errors a mono line `status · POST · /rest/v1/rpc/<fn>`. Copy via
i18n (`errors` namespace, flat keys). Mounted once at the top level (in
`main.tsx`, inside `AppErrorBoundary`, beside `RouterProvider`) so it works on
auth pages too.

### `src/lib/errors/RootErrorBoundary.tsx`

A component used as the router root route's `errorElement`. Reads the error via
`useRouteError()`, calls `captureError()`, and renders a recoverable screen
(message + "Reload" action). Copy via i18n.

### `src/lib/errors/AppErrorBoundary.tsx`

A class component (`getDerivedStateFromError` + `componentDidCatch` →
`captureError`) wrapping the providers in `main.tsx`, catching crashes above the
router. Renders the same recoverable fallback.

## Data flow

```
                        throw / reject
  component render ─────────────────────────► nearest ErrorBoundary
                                                 │ captureError() → Sentry
                                                 └ render "reload" fallback

  useQuery / useMutation ── error ──► QueryCache/MutationCache.onError
                                          │ if meta.suppressGlobalError → stop
                                          │ toAppError(err)
                                          ├ captureError()  → Sentry
                                          └ reportError()   → error-bus → ErrorToastHost (toast)
```

- `src/lib/query-client.ts`: construct the client with
  `new QueryCache({ onError })` and `new MutationCache({ onError })`.
  - Query: `onError: (error, query) => handle(error, query.meta)`
  - Mutation: `onError: (error, _vars, _ctx, mutation) => handle(error, mutation.meta)`
  - `handle` returns early when `meta?.suppressGlobalError === true`; otherwise
    `captureError` + `reportError(toAppError(error))`.

## Reconciling existing inline handling

The onboarding step mutations keep their contextual inline `serverError` alerts
(form-adjacent is better UX than a top toast for a form submit) and set
`meta: { suppressGlobalError: true }` so there is no double surface. Hooks to
update (add the meta): `useSetRole`, `useSetIdentity`, `useSetLocation`,
`useUploadProfilePhoto`, `useCompleteOnboarding` (onboarding), `useSetBio`,
`useSetDetails` (profile), `useSetProfileInterests` (interests). Their existing
inline rendering is unchanged. Everything else surfaces globally by default.

(The Details/Interests inline handling added as a stopgap at the end of spec 010
stays as intentional inline handling under this model — it opts out like the
others. No stopgap removal needed.)

## Mount points

- `src/main.tsx`: call `initSentry()` (after `initOtel()`); wrap the provider
  tree in `<AppErrorBoundary>`; mount `<ErrorToastHost />` beside
  `<RouterProvider>`.
- `src/routes.tsx`: wrap the existing `routeConfig` array under a single
  pathless root route carrying `errorElement: <RootErrorBoundary />`, so every
  route inherits the boundary.

## Testing

Unit:
- `toAppError`: each input (`RpcTransportError`, `RpcContractError`, plain
  `Error`, non-Error) → correct `kind` and fields (transport → status/`POST`/
  `/rest/v1/rpc/<fn>`).
- `error-bus`: subscribe receives reported errors; dedupe coalesces identical
  head errors; queue cap respected; dismiss/clear work.
- `ErrorToastHost`: renders name/message/transport line; dismiss removes it;
  multiple errors queue; no auto-dismiss.
- `query-client` onError: a rejecting mutation reports to the bus + captures;
  a mutation with `meta.suppressGlobalError` reports NOTHING.
- `RootErrorBoundary` / `AppErrorBoundary`: rendering a throwing child yields
  the fallback and calls `captureError`.
- `captureError` no-ops when Sentry uninitialized (assert no throw, and that a
  spy/mock isn't called).

Integration (jsdom + MSW, existing patterns):
- A component whose query rejects (MSW 500 / contract mismatch) → a toast
  appears with the mapped fields.
- A component that throws during render → boundary fallback shows.
- An opted-out mutation rejecting → no toast.

Sentry SDK itself is not unit-tested against the network; the `sentry.ts`
env-gating logic and the `captureError` no-op path are.

## Deliverables

- The `src/lib/errors/` module (6 files above), the `query-client.ts` wiring,
  the `main.tsx` + `routes.tsx` mount changes, the opt-out meta on the listed
  hooks, the `errors` i18n namespace, and tests.
- `@sentry/react` added as a dependency.
- **Update project `CLAUDE.md`**: replace the aspirational error-handling rule
  with a pointer to the implemented surface — how errors surface (global toast
  by default), how to opt a mutation out (`meta.suppressGlobalError`) when
  handling inline, that render crashes are caught by the boundaries, and that
  Sentry is env-gated on `VITE_SENTRY_DSN`. Do this as part of implementation
  so the guidance matches the code.
- Document the new env vars (`VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`,
  `VITE_BUILD_ID`) wherever env vars are documented (e.g. README / `.env`
  example), with no production defaults.

## Compliance follow-up (non-blocking, flagged)

Sending full PII — including live signed media URLs (time-limited photo-access
tokens, ~1h) and message content — to Sentry is a deliberate product-owner
decision. Before any real (non-local) deployment with a live DSN, ensure: a
Sentry Data Processing Agreement is in place; the Sentry project uses the EU
data region; and the privacy policy discloses third-party error processing.
This is a paper-trail/compliance task for the UK/ICO posture, not a code change.

## Out of scope / follow-ups

- Web push, offline queueing of errors, user-facing "report feedback" dialogs.
- OTel `trace_id` ↔ Sentry event correlation (see Open questions) — can be a
  fast-follow once both exist.
- The `view_search` pgTAP test isolation (issue #3) is unrelated.

## Open questions (suggested defaults)

1. **Correlate OTel trace_id onto Sentry events?** Default: yes if cheap — set
   a Sentry tag from the active OTel span's trace id in `captureError` when a
   span is active; skip if it complicates the SDK wiring. Non-blocking; the
   surface works without it.
2. **Toast auto-dismiss for transient/low-severity errors?** Default: no — all
   errors persist until dismissed, per decision 4. Revisit only if it proves
   noisy in practice.

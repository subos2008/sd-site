# 040: Proper PWA with a tested update-deployment path

Status: not started. High-level spec — turn into a full plan via
`superpowers:writing-plans` before executing.

## Motivation

Web/PWA-only distribution is a strategic commitment
(`marketing/lessons-learned.md`): the app stores are closed to this
category, so the PWA install surface and its update path ARE our app store
and our release channel. That raises the bar from "installable" to
"operable": we must be able to deploy an update and know that installed,
long-running clients actually receive it promptly — a stale service worker
that strands users on an old client is dangerous once the API and database
evolve underneath it (Supabase RPC/schema changes), and in this category a
broken update path can't be fixed by telling users to reinstall from a
store. The update mechanism must be tested, not assumed.

## Current state

- `vite-plugin-pwa` in `vite.config.ts` with `registerType: 'autoUpdate'`
  and `devOptions.enabled: true`; generated SW/Workbox output in
  `dev-dist/` (gitignored).
- Placeholder manifest: name "SD Site", short_name "SD", 192/512 icons
  (one maskable), `display: standalone`, `start_url: '/'`.
- No in-app update UX (no `useRegisterSW` usage in `src/`), no version
  visibility, no defined offline/caching policy, no deploy pipeline in the
  repo yet (hosting is planned as S3 + CloudFront).

## Desired behaviour

**Update path (the core of this spec):**

- A deliberate update strategy, implemented and documented. Suggested
  default: switch to `registerType: 'prompt'` with `useRegisterSW`, showing
  a non-blocking "update available — refresh" toast; user accept triggers
  skip-waiting and reload. Rationale: auto-reloading under a user
  mid-conversation is unacceptable once messaging exists. (Counter-option
  to evaluate in the plan: keep autoUpdate while sessions are trivial,
  switch before messaging ships.)
- Long-lived installed clients must discover updates without a navigation:
  periodic `registration.update()` polling (e.g. hourly) plus a check on
  `visibilitychange` — installed PWAs can stay open for days.
- CDN/cache correctness, coordinated with the deploy infrastructure:
  `index.html` and `sw.js` served with no-cache (or very short max-age);
  hashed assets long-cache/immutable. A long-cached `sw.js` at the CDN is
  the classic way PWA updates silently stop working; the acceptance test
  below must catch it.
- Version visibility: build identifier (git commit hash) baked in at build
  time and surfaced somewhere findable (e.g. the hamburger menu and a
  console log), so support conversations can establish which version a
  user is running.

**PWA correctness:**

- Manifest hardening: real `name`/`short_name`/`description` (blocked on
  the brand name — spec 020; use current placeholders until then), `id`
  and `scope` fields, correct theme/background colours, apple-touch-icon
  and iOS status-bar meta tags.
- A deliberate offline/caching policy. Suggested default: precache the app
  shell (Workbox defaults), network-only for all Supabase API traffic, and
  do NOT runtime-cache authenticated content — profile photos and signed
  URLs cached on a shared device are a privacy problem in this category,
  which outweighs offline richness. Offline UX is a friendly "you're
  offline" state, not stale profile data.
- Installability verified: Lighthouse PWA/installability checks pass.

**Testing (the "test that works" part):**

- An automated or scripted-manual test of the actual update flow: build
  version A, load/install it, deploy version B, assert the running client
  detects and applies B (toast appears; after accept, the new build id is
  live). Playwright can drive most of this against a local static server
  with two sequential builds; the plan decides how much is automatable vs
  a documented runbook executed per release.
- A deploy-time smoke check (curl) asserting the cache-control headers on
  `index.html`, `sw.js`, and a hashed asset are correct in the real
  hosting environment.

## Out of scope (design for, don't build)

- Web push notifications (retention channel; separate spec — but the SW
  architecture chosen here shouldn't preclude adding push handlers).
- Install-prompt marketing UX (A2HS guidance page, iOS Safari
  instructions, install nudges) — a follow-up once branding exists; this
  spec makes installs correct, the follow-up makes them likely.

## Constraints and known gotchas

- Deploy infrastructure doesn't exist in the repo yet; the cache-header
  requirements must land in that infrastructure work (CloudFront
  behaviours/response headers) — coordinate rather than duplicate. Until
  then the header smoke check runs against whatever staging serves builds.
- `pnpm build` on this machine: do NOT prepend `PATH=/usr/bin:...` (see
  CLAUDE.md — breaks the arm64 rollup bindings).
- `devOptions.enabled: true` means the dev server also runs the SW —
  historically a source of confusing stale-cache behaviour in development;
  the plan should decide whether to keep it and document the escape hatch
  (unregister via devtools) either way.
- E2E suite currently ignores the SW; check Playwright contexts don't
  start flaking once prompt-mode registration and toasts exist.

## Open questions (suggested defaults)

1. Prompt vs autoUpdate at this stage — default: prompt-with-toast now, so
   the tested mechanism is the one we'll still be using when messaging
   ships.
2. Update poll interval — default: 60 minutes plus `visibilitychange`.
3. Where the version shows — default: hamburger menu footer line plus
   console log on boot.

## Acceptance criteria

- Deploying a new build causes an already-open, installed client to show
  the update toast within one poll interval, and accepting it loads the
  new build (verified by the build id changing) — demonstrated by the
  update-flow test.
- Cache-header smoke check passes against the hosting environment:
  `index.html` and `sw.js` not long-cached; hashed assets immutable.
- Lighthouse reports the app installable; iOS add-to-home-screen yields a
  standalone app with correct icon and title.
- Build id visible in the UI and logged on boot.
- No authenticated API responses or signed-URL images are served from SW
  caches (verified by inspecting cache storage after a browse session).
- `pnpm test` / `pnpm test:e2e` remain green with the new registration
  flow.

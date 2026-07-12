# SD Site

A niche dating site, UK-first, installable PWA. React SPA on AWS, Supabase backend.

## Status

Plan 03 complete: auth, onboarding (now 6 steps), search with filters, full profiles with edit modes, multi-photo galleries, the likes mechanic with an in-app banner system, and a language switcher are all live on top of Plan 02's foundation. Token economy, messaging, and the secret album come in later plans.

## Stack

- Frontend: Vite + React + TypeScript + Tailwind + react-router + react-i18next
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions)
- Testing: Vitest + RTL + MSW + Playwright + pgTAP
- Observability: OpenTelemetry (no-op when env unset)
- Build: pnpm, GitHub Actions CI

## Features (Plan 02)

- **Auth.** Email + password signup with email confirmation, login, forgot password, and sign-out.
- **Onboarding wizard.** Four steps — role, identity, location, photo — ending at `/onboarding/complete`, which flips profile status to `active` and lands the user on `/search`.
- **Search.** `/search` lists active opposite-role profiles ordered by `last_active_at`. Each card opens `/profile/:id`.
- **Profile views.** `/profile/:id` for other people and `/me` for the signed-in user.
- **App shell.** Bottom tab bar plus a hamburger menu containing sign-out.

## Features (Plan 03)

Plan 03 deepens profiles and adds the likes mechanic on top of the Plan 02 foundation.

- **Extended profile fields.** Bio, physical attributes (height, body type, ethnicity), lifestyle (smoking, drinking, children, education, occupation), and free-text interests. Editable from `/me`, optional and skippable at onboarding.
- **Multi-photo management.** Up to six profile photos with ordinal-based ordering; the first is the primary card photo. Add, reorder, and delete from `/me`.
- **Onboarding extension.** Two new skippable steps after photo — `/onboarding/details` and `/onboarding/interests` — bringing onboarding to six visible steps before completion.
- **Likes mechanic.** A heart button on every search card and profile page toggles like/unlike. `/likes` shows two sections: "Liked you" and "Favourites" (people you liked). Likes are private until both sides like (matching arrives in a later plan).
- **In-app banners.** A `BannerHost` polls notifications and surfaces "X liked your profile" banners with a red unread dot on the Likes tab.
- **Search filters.** `/search` has a filter sheet for minimum age, maximum age, distance (miles), and interest IDs. Filters are reflected in the URL as a power-user shortcut: `/search?min_age=25&max_age=40&distance_miles=20&interest_ids=hiking,music`. Open `/search` with any of those params and the sheet picks them up.
- **Language switcher.** A dropdown in the hamburger menu picks the active language. Plan 03 ships English only; the picker is in place for adding more languages in later plans.

## Local development

Prerequisites: Node 22, pnpm 11, Docker, Supabase CLI.

```bash
# 1. Install
pnpm install

# 2. Start the local Supabase sandbox (Docker required)
supabase start

# 3. Apply migrations
supabase db reset

# 4. Regenerate generated files (idempotent)
pnpm gen:config
pnpm gen:types

# 5. Seed dev users (lex / sam / rick — all password "devpass1")
#    SAFETY: pnpm seed:dev refuses to run unless SUPABASE_URL is a local-loopback host.
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"') \
pnpm seed:dev

# 6. (Onboarding location step calls this) Serve the geocode-city Edge Function
supabase functions serve geocode-city --no-verify-jwt &

# 7. Run the dev server
pnpm dev
```

## Tests

```bash
pnpm test          # vitest unit + component tests
pnpm test:db       # pgTAP database tests (requires supabase running)
pnpm test:e2e      # Playwright E2E (requires supabase + geocode-city function + seed)
pnpm typecheck     # tsc -b
pnpm lint
pnpm build
```

CI runs all of the above on every PR.

## Credentials safety

Scripts and tests that use a Supabase service-role key (`scripts/seed-dev-users.mjs`,
`e2e/helpers/admin-signup.ts`) refuse to run unless `SUPABASE_URL` resolves to
`127.0.0.1`, `localhost`, or `::1`. This prevents credentials intended for one
Supabase project from accidentally being used against another.

## Configuration

The single source of truth for application configuration is `shared/app-config.ts`. The frontend imports it directly. The Postgres `app_config` table is seeded by a generated migration produced by `pnpm gen:config`. Edit `shared/app-config.ts`, run `pnpm gen:config`, restart Supabase.

## Project layout

See `docs/superpowers/specs/2026-05-09-sd-site-design.md` for the full design.
See `docs/superpowers/plans/README.md` for the implementation plan series, including the status of each milestone and pointers to each plan file.
See `marketing/README.md` for the marketing strategy: channel plan, phased launch plan, sourced competitor case studies, and the lessons-learned playbook (quiet growth via affiliates, brand-harvest SEO, and product-led trust — see `marketing/lessons-learned.md`). Marketing constraints also feed product decisions: web/PWA-only distribution, credits pricing, and verification-by-default all originate there.

## Picking this up in a fresh session

If you (or a fresh Claude session) are coming back to this repo cold:

1. **Bring the local sandbox up:** follow the **Local development** section above. `supabase start && supabase db reset && pnpm gen:types && pnpm seed:dev` recreates everything that lives outside the repo (Docker volumes, generated types, fixture users).
2. **Find the current milestone:** `docs/superpowers/plans/README.md` shows which plan is complete and which is next.
3. **Read the carry-over for the next milestone:** every plan ends with a **Carry-over to Plan N+1** section listing follow-ups the current plan deferred. Those are the most useful pointers for the next plan to address first. (Plan 03's carry-overs are at the bottom of `docs/superpowers/plans/2026-05-14-03-profile-depth-likes.md` — they cover a `view_search` cursor bug, dead V1 Zod schemas, a too-broad storage SELECT policy, and several smaller items.)
4. **Read the execution deviations:** each plan also has a `### Plan N execution deviations` section near the top that records every place the spec didn't survive contact with reality and why. These are load-bearing context for future tasks (e.g. Plan 02 + 03 both record that the local Supabase image doesn't expose `storage.create_signed_url`, which is why every signed URL is minted client-side).
5. **Write the next plan, then execute it.** A fresh Claude session can be asked to `Write plan NN` — it'll read the spec, the README, and the prior plans, then invoke its `superpowers:writing-plans` skill. Execution uses `superpowers:subagent-driven-development` (fresh subagent per task with two-stage review).

## What's not in the repo

Things that are local-only and won't follow a `git clone`:

- **`node_modules/`, `dist/`, `dev-dist/`, `test-results/`** — gitignored build/test outputs. Recreated by `pnpm install`, `pnpm build`, `pnpm test:e2e`.
- **Local Supabase Docker volumes** — the running database, storage bucket, and seeded fixture users. Recreated by `supabase start && supabase db reset && pnpm seed:dev`.
- **`.git.broken.bak/`** — a one-off backup of a corrupted `.git` directory from a mid-execution Dropbox sync conflict during Plan 02. Safe to delete (`rm -rf .git.broken.bak`); the live `.git` and `origin/main` are healthy.

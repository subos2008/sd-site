# SD Site

A niche dating site, UK-first, installable PWA. React SPA on AWS, Supabase backend.

## Status

Plan 02 complete: auth, onboarding, search, profile views, and the app shell are live. Discovery, messaging, and matching come in later plans.

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
See `docs/superpowers/plans/README.md` for the implementation plan series.

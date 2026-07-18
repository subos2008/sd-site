---
name: start-dev
description: Use when starting local development on sd-site, when the user wants to run, view, or demo the site locally, or when something needs the dev stack up (Vite dev server, local Supabase, seeded dev users).
---

# Start the sd-site local dev stack

Bring up everything the site needs locally, idempotently: check each piece, start only what is missing, then report URLs. Run all commands from the repo root.

## Quick reference

| Piece | URL | Check |
|---|---|---|
| App (Vite) | http://localhost:5173 | `lsof -iTCP:5173 -sTCP:LISTEN` |
| Supabase API | http://127.0.0.1:54321 | `supabase status` |
| Supabase Studio | http://127.0.0.1:54323 | comes up with `supabase start` |
| Mailpit (auth emails) | http://127.0.0.1:54324 | comes up with `supabase start` |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres | `psql` |

Dev logins (after seeding): `lex@local.test`, `sam@local.test` (babies), `rick@local.test` (benefactor) — all password `devpass1`.

## Steps

### 1. Supabase stack

```bash
supabase status
```

If it errors or reports services stopped (ignore `imgproxy`, `analytics`, `vector`, `pooler` — those are always stopped): `supabase start` (needs Docker running).

### 2. Database state

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -tAc \
  "select (select count(*) from supabase_migrations.schema_migrations), (select count(*) from public.app_config)"
```

Both counts nonzero → migrations and config seed applied, skip ahead. Otherwise:

```bash
supabase db reset && pnpm gen:types
```

Known quirk: `supabase db reset` often ends with `Error status 502: invalid response from upstream server`. Migrations still applied cleanly — re-run the psql check to confirm rather than resetting again.

### 3. Dev users

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -tAc "select count(*) from auth.users"
```

If 0, seed (the script refuses non-loopback `SUPABASE_URL` by design — keep it that way):

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"') \
pnpm seed:dev
```

### 4. Vite dev server

If nothing listens on 5173, start it in the background (plain `pnpm dev` — no env vars needed; `src/lib/supabase.ts` defaults to the local sandbox):

```bash
pnpm dev   # run in background
for i in $(seq 1 20); do curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ | grep -q 200 && break; sleep 0.5; done
```

### 5. Report

Tell the user the app URL, Studio URL, Mailpit URL, and the dev logins. Do not open a browser for them unless they ask.

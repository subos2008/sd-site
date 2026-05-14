# SD Site — Design

**Date:** 2026-05-09
**Status:** draft, awaiting user review
**Owner:** Ryan

A niche dating site for sugar dating. Installable PWA, React SPA on S3 + CloudFront, Supabase backend. UK-first with i18n built in from day one. Token-based economy where benefactors pay to message and unlock secret content; babies use the site free.

---

## 1. Scope

### MVP

In scope for the first shippable build:

- Email/password signup with email confirmation
- Onboarding wizard (role, identity, location, physical/lifestyle, photos)
- Two roles, opposite-role only: **benefactor** and **baby**
- Profile (tagline, wants, about, physical, lifestyle, interests, location, photos, secret album)
- Search and browse with filters and distance
- One-on-one messaging with text and photo attachments
- Likes (bookmark + signal)
- Secret album mechanic with request/grant/unlock state machine
- Token economy with `FauxPaymentProvider` (no real payments at launch of MVP build)
- In-app banner notifications + tab-level unread dots
- PWA manifest + service worker (installable, offline app shell)
- i18n infrastructure (English the only language at MVP, more added by adding folders)

Out of MVP, captured in the **Pre-launch checklist** (§10):

- Real payment processor (Segpay)
- Identity / age verification (Yoti / Persona / Veriff style, required for UK Online Safety Act)
- Content moderation queue and automated NSFW detection
- Push notifications
- Transactional engagement email beyond auth
- Reporting and blocking
- Rate limiting
- Admin moderation dashboard
- Sentry / error tracking
- Mux / Cloudflare Stream for video transcoding
- Location autocomplete UX
- Privacy policy, T&Cs, cookie consent
- Penetration test / security review

Explicitly out of scope, may revisit later:

- Secret questions (third secret-content type alongside photos and videos)
- Access tab in main navigation
- Cross-user media deduplication
- Match-gating (mutual-like-required-to-message)
- Per-section pricing differences
- Token refunds for unanswered messages

### Non-goals

- SEO-friendly public profiles (logged-in-only app)
- Email engagement loops at MVP
- Mobile native apps (PWA only)

---

## 2. Architecture

### Stack — Approach A (lean now, swap services in when they hurt)

**Frontend:**

- Vite + React + TypeScript
- Tailwind + shadcn/ui (or radix-ui primitives)
- react-router for routing
- TanStack Query for server state
- Zustand for ephemeral client state
- react-i18next for i18n
- vite-plugin-pwa for manifest + service worker

**Backend:**

- Supabase managed Postgres + Auth + Storage + Edge Functions
- All token mutations and access transitions live in Postgres functions for atomicity
- RLS enforces every direct read; mutations route through `SECURITY DEFINER` RPCs that explicitly check the caller
- Edge Functions handle webhook receipt (payments) and external service calls (geocoding)

**Payments:**

- `PaymentProvider` interface
  - `SegpayProvider` (real, integrated pre-launch)
  - `FauxPaymentProvider` (auto-completes; supports synchronous test mode behind an env flag)
- Webhook handling code is identical regardless of provider

**Geocoding:**

- postcodes.io for UK (free, no API key, called from an Edge Function so the result is server-trusted)
- Swap target post-launch: Mapbox or Nominatim for global

**Media:**

- Supabase Storage, single private bucket `media`
- No transcoding in MVP; videos served directly. Limits: 60s max, 50MB max, mp4 only
- Pre-launch: Mux or Cloudflare Stream

**Hosting:**

- S3 + CloudFront + Route 53 + ACM for HTTPS
- GitHub Actions deploys on merge to `main`

**Observability:**

- OpenTelemetry, no-op when env vars unset (see §8)

**Testing:**

- Vitest + React Testing Library + MSW (frontend)
- pgTAP (Postgres functions and RLS)
- Playwright (4 critical E2E journeys)
- All against ephemeral Docker Supabase via the Supabase CLI

### Why Approach A

- Smallest service surface area
- Fastest path to working end-to-end build
- The `PaymentProvider` abstraction with a faux implementation is exactly the same shape any other deferred service would take (transcoding, push, error tracking)
- All deferred items are listed in the pre-launch checklist with concrete vendor candidates

---

## 3. Data model

16 tables. Postgres on Supabase. PostGIS extension for distance.

### Identity

```
profiles                                          -- 1:1 with auth.users
  id (uuid, PK = auth.users.id)
  role enum ('benefactor' | 'baby')               -- set at signup, immutable
  display_name
  date_of_birth date                              -- editable; CHECK ≥ 18 years
  gender enum
  looking_for enum
  tagline text
  about text
  wants text
  city_display_name                               -- geocoded display label
  city_lat, city_lng double precision             -- centroid
  height_cm int
  body_type, hair_color, eye_color enum
  has_piercings, has_tattoos boolean
  smoking, drinking, education enum
  yearly_income_band, net_worth_band enum
  status enum ('pending_onboarding'|'active'|'suspended'|'deactivated')
  token_balance int default 0                     -- cache; ledger is source of truth
  age_verified_at timestamptz                     -- pre-launch; null = not verified
  created_at, updated_at, last_active_at timestamptz
  CHECK (date_of_birth <= now()::date - interval '18 years')

profile_interests (profile_id, interest_id) PK    -- M:N

interests                                         -- taxonomy, admin-managed
  id, label_key (i18n key), category, ordinal, active
```

### Media — content-addressed records, junction tables decide where they appear

```
media_items
  id, owner_id (profile_id)
  storage_path                                    -- "users/{owner_id}/{hash}.{ext}"
  kind enum ('photo' | 'video')
  hash text                                       -- sha256, computed client-side
  size_bytes int, width, height, duration_seconds
  status enum ('pending_moderation'|'approved'|'rejected') default 'approved'
  created_at
  UNIQUE (owner_id, hash)

profile_photos        (profile_id, media_item_id, ordinal) PK   -- public profile, photos only
secret_album          (profile_id, media_item_id, ordinal) PK   -- mixed photos AND videos
message_photo_album   (profile_id, media_item_id, ordinal) PK   -- editable favourites; photos only
verification_video    (profile_id PK, media_item_id)            -- 1:1, admin-only
```

CHECK constraints enforce kind: `profile_photos`, `message_photo_album` photo-only; `verification_video` video-only; `secret_album` no restriction.

`media_items` has no `deleted_at`. Orphans (no junction reference and no `messages.media_item_id` reference) are swept by a periodic GC job with a 24h grace window. GC runs as a scheduled Edge Function or pg_cron job.

### Likes

```
likes
  liker_id, likee_id (composite PK)
  created_at
```

### Conversations & messages

```
conversations
  id, benefactor_id, baby_id                      -- UNIQUE(benefactor_id, baby_id)
  unlocked_at timestamptz                         -- NULL = first message locked on daddy's side
  read_receipts_unlocked_at timestamptz           -- NULL = daddy can't see baby's read state
  initiated_by enum ('benefactor' | 'baby')
  benefactor_last_read_at, baby_last_read_at timestamptz
  created_at, last_message_at

messages
  id, conversation_id, sender_id, kind enum ('text' | 'photo')
  body text                                       -- nullable; required if kind='text'
  media_item_id uuid                              -- nullable; required if kind='photo'
  is_first_message boolean
  flags_requests_secret_access, flags_grants_secret_access boolean
  created_at
  CHECK ((kind='text' AND body IS NOT NULL AND media_item_id IS NULL)
      OR (kind='photo' AND body IS NULL AND media_item_id IS NOT NULL))
```

### Secret access — global grant + per-pair unlock (consolidated)

```
secret_access
  requester_id, owner_id (composite PK)
  requested_at, requested_via_message_id          -- nullable; set if implicit on first message
  granted_at, granted_via_message_id              -- nullable; granted_at not null = granted
  unlocked_at, unlocked_tokens_spent, unlocked_transaction_id  -- nullable; benefactor→baby only
```

No status enum. Existence = at least requested. `granted_at` not null = granted. `unlocked_at` not null = paid (only meaningful when requester is a benefactor).

### Tokens

```
token_transactions                                -- append-only ledger; balance = SUM(delta)
  id, profile_id, delta int (signed)
  reason enum ('purchase'|'spend_message'|'spend_unlock'|'admin_grant'|'free_test_grant'|'refund')
  related_resource_type, related_resource_id
  created_at

payments
  id, profile_id, provider enum ('segpay'|'faux')
  provider_ref text UNIQUE                        -- idempotency
  package_id text                                 -- references APP_CONFIG.payments.packages
  status enum ('pending'|'completed'|'failed'|'refunded')
  tokens_credited int
  created_at, completed_at
```

Token packages live in `shared/app-config.ts`, not in the database. There is no `token_packages` table.

### Notifications

```
notifications
  id, recipient_id, kind, payload jsonb, read_at, created_at
```

Kinds: `like_received`, `secret_access_requested`, `secret_access_granted`, `message_received`, `payment_completed`. Surfaces as in-app banners and tab-level unread dots. Pre-launch: also drives push notifications.

### Configuration

```
app_config (key text PK, value jsonb)
```

Seeded by a build-step migration generated from `shared/app-config.ts`. RPCs read from this table at runtime; clients import the source file directly. The two stay in sync because they're built from the same file.

---

## 4. Key flows

### Conventions

- All state changes are Postgres RPCs called via `supabase.rpc()`
- Write RPCs are mostly `SECURITY DEFINER`, every one starts with explicit `auth.uid()` and role checks
- Read RPCs are `SECURITY INVOKER` and rely on RLS
- Every RPC returns `{ ok: true, ... }` or `{ ok: false, error: '<code>' }`
- Token spend and the action it pays for are in the same transaction. No "deducted but didn't happen" failure mode
- Webhooks are idempotent via `payments.provider_ref` UNIQUE

### Read RPCs (one per screen)

| Screen          | RPC                                          | Returns                                                                                                                                                                      |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search          | `view_search(filters, cursor)`               | array of cards `{profile_id, display_name, age, city_display_name, distance_miles, primary_photo_url, my_like_state}` + next cursor                                          |
| Profile (other) | `view_profile(profile_id)`                   | profile + interests + photos + secret-album summary `{photo_count, video_count, granted, unlocked, items_or_null}` + my_like_state + their_like_state + conversation_summary |
| My profile      | `view_my_profile()`                          | profile + interests + photos + secret album items (full, no gate) + verification status                                                                                      |
| Messages tab    | `view_messages_tab(cursor)`                  | merged list: conversation summaries + pending access requests, sorted by recency                                                                                             |
| Conversation    | `view_conversation(conversation_id, cursor)` | conversation metadata + messages page + their last_read_at (if visible) + my last_read_at                                                                                    |
| Likes tab       | `view_likes_tab()`                           | `{liked_me: [card], favourites: [card]}`                                                                                                                                     |
| Notifications   | `view_notifications(cursor)`                 | banner-shaped notifications with denormalised actor info                                                                                                                     |

A shared SQL helper `_profile_card_for_viewer(viewer, target)` returns the standard card shape used by Search, Likes, and Messages tab. Consistent shape on the frontend, consistent access logic on the backend.

### Write RPCs

**Signup & onboarding** — Auth flow uses Supabase Auth; profile row is created by a `handle_new_user()` AFTER INSERT trigger on `auth.users`. The wizard upserts profile fields step by step. On final step:

- Status moves from `pending_onboarding` to `active`
- At least one profile photo is required before transition
- Geocoding happens server-side via `geocode_city(text)` (calls postcodes.io from an Edge Function, returns `{display_name, lat, lng}`)
- DOB step's "Continue" button is disabled if entered DOB doesn't satisfy ≥ 18 years; same enforced server-side via CHECK

**Like / unlike** — `like_profile(likee_id)` upserts likes row + creates notification. Idempotent.

**Send first message (daddy → baby)** — `send_first_message(baby_id, body, request_secret_access bool)`:

1. Token check & deduct (10 tokens), ledger row, balance update
2. Create conversation `(unlocked_at = now(), initiated_by='benefactor')`
3. Insert message (`is_first_message=true`, `flags_requests_secret_access`)
4. If requesting: upsert `secret_access` row with `requested_at = now()` (existence indicates request)
5. Insert notification for baby

**Send first message (baby → daddy)** — `send_first_message_from_baby(daddy_id, body, grant_secret_access bool)`:

1. Create conversation `(unlocked_at = NULL, initiated_by='baby')`
2. Insert message
3. If granting: upsert `secret_access` with `granted_at` set
4. Insert notification for daddy

The conversation is locked on daddy's side until he pays.

**Unlock conversation (daddy)** — `unlock_conversation(conversation_id)`:

1. Token check & deduct (10 tokens), ledger, balance
2. Set `conversations.unlocked_at = now()`
3. RLS now allows him to read all messages in the conversation

**Send subsequent message** — `send_message(conversation_id, kind, body, media_item_id, grant_secret_access)`:

- Verify sender is in the conversation, conversation is unlocked
- Insert message
- If grant flag and not yet granted: insert/update `secret_access`
- Insert notification
- No token charge

**Photo upload + send** — Client computes SHA-256, calls `prepare_media_upload`, PUTs to signed URL, calls `finalize_media_upload`, optionally `add_to_message_photo_album`, then sends with `kind='photo'` and the media_item_id. The favourites album is curated independently of what's been sent.

**Request secret access (explicit, baby → daddy from his profile)** — `request_secret_access(owner_id)`:

1. Upsert `secret_access` (requester = me, owner = owner_id, requested_at = now())
2. Insert notification for owner
3. Free, no tokens

**Grant secret access (explicit)** — `grant_secret_access(requester_id)`:

- Set `secret_access.granted_at = now()` for the row where requester = requester_id and owner = me
- Insert notification for requester
- Free, no tokens. Ignoring a request requires no action — state stays at requested; user can grant later from the same surface

**Unlock secret album (benefactor pays)** — `unlock_secret_album(baby_id)`:

1. Verify `secret_access` exists with `granted_at` set, owner = baby_id
2. Token check & deduct (10 tokens), ledger row
3. Update `secret_access.unlocked_at`, `unlocked_tokens_spent`, `unlocked_transaction_id`
4. RLS now allows benefactor to read media items in baby's secret album

**Unlock read receipts (benefactor pays, per conversation)** — `unlock_read_receipts(conversation_id)`:

1. Token check & deduct (10 tokens), ledger
2. Set `conversations.read_receipts_unlocked_at = now()`
3. View RPC for the conversation now includes the baby's `last_read_at`

**Mark messages read** — `mark_messages_read(conversation_id, up_to)`:

- Update the caller's `last_read_at` on the conversation row
- No token charge, no notification

**Buy tokens** — `create_token_purchase(package_id)`:

- Returns a redirect URL from `PaymentProvider.createCheckoutSession()`
- User pays on provider's hosted page (real Segpay) or auto-completes (Faux)
- Provider POSTs to webhook Edge Function `/webhooks/payments/{provider}` (Faux mimics this internally)
- Webhook verifies signature (Segpay) or test secret (Faux), looks up payment by `provider_ref`, calls `complete_payment` RPC
- `complete_payment` (service-role only): updates payment status, inserts ledger transaction, updates token balance, inserts notification

In test mode (`FAUX_PAYMENT_SYNC=true`), the FauxProvider completes everything synchronously inside `create_token_purchase` so tests don't race the webhook.

---

## 5. Frontend structure

### Routes

```
/                       redirect by auth + onboarding state
/login, /signup, /forgot-password
/onboarding             multi-step wizard
/search                 default landing for active users
/profile/:id
/me                     view + edit modes
/messages               conversations + pending access requests
/messages/:id           conversation view (or locked-card view)
/likes                  Liked-you / Favourites
/tokens                 purchase + ledger (benefactors only)
/settings               account, notifications, language, log out
/legal/*
```

### App shell

- Bottom tab bar (mobile primary): **Search · Messages · Likes · Me**. Red dot on Messages and Likes for unread.
- Top bar: site logo. Token balance is **not** in the top bar — it lives in the hamburger menu (link to `/tokens`).
- In-app banners (iOS-style, top-of-screen, auto-dismiss) for live events when the app is open.
- Sheet/modal system for: photo upload, token purchase confirm, unlock confirm (one reusable `<UnlockSheet>` for conversation, album, read receipts).
- Toast queue for transient feedback.

### Folder structure

```
/
  src/                            Vite SPA
    app/                          routing, top-level providers, error boundaries
    features/
      search/                     api.ts, hooks.ts, components/, __tests__/
      profile/
      messaging/
      onboarding/
      likes/
      tokens/
      settings/
    components/                   shared primitives: Avatar, MediaThumb (handles black-box locked state),
                                  MediaUploader (with "no nudity" reminder), ProfileCard,
                                  TokenChip, UnlockButton, UnlockSheet, PaywallCard
    lib/                          supabase client, typed RPC wrapper, i18n setup,
                                  date/distance/locale formatters, hash function
    i18n/en/*.json
  shared/                         app-config.ts, rpc-contracts.ts (Zod schemas), db-types.ts (generated)
                                  imported by both src/ and supabase/functions/
  supabase/
    functions/                    Edge Functions (Deno): webhook handlers, geocoder
    migrations/                   schema migrations + generated app_config seed
```

### Data layer

- TanStack Query owns all server data. One hook per view RPC.
- Typed RPC client wraps `supabase.rpc()`. Each RPC is wrapped with its Zod schema (`shared/rpc-contracts.ts`), `.parse()`d on response — bad shapes fail loud at the boundary.
- Mutations call write RPCs and invalidate relevant queries on success. Optimistic updates only for likes and draft message append. Token-spending mutations are never optimistic — wait for the server confirmation before updating balance.
- Zustand for ephemeral state only: open modal id, draft message, upload progress, install-prompt-dismissed flag. No server data lives in Zustand.
- **No Realtime subscriptions in MVP.** Pull-to-refresh, window-focus refetch, and short stale times handle freshness. Realtime is a pre-launch consideration once the test surface can absorb it.

### i18n

- react-i18next, namespace per feature
- All visible strings via `t()` from day one. Linter rule: no string literals in JSX.
- Default English. Adding a language = drop a folder.
- Locale-aware formatters via `Intl.NumberFormat`, `Intl.RelativeTimeFormat`, `Intl.DateTimeFormat`. Distance in miles for en-GB/en-US, km elsewhere.

### PWA

- vite-plugin-pwa generates manifest + service worker
- Manifest: name, short_name, icons (192/512/maskable), theme_color, background_color, display: `standalone`, start_url: `/`
- Service worker: app shell cache-first, API network-only, images cache-first with cap
- Install prompt UX in `/settings`; iOS gets "Add to Home Screen" instructions

### Locked-content rendering

- Locked photo/video tile: solid black box (no blur), small lock icon
- Locked conversation: full-screen card replacing message list — lock icon, "[Her name] sent you a message!", gold **Unlock Message** button, smaller fainter copy explaining cost. Composer hidden.
- Locked first message in messages-tab list: `🔒 Unlock conversation — 10 tokens`
- Locked read receipts: small gold pill in place of the "Read" indicator — `🔒 Unlock read receipts`. Tap → `<UnlockSheet>` confirm.
- Locked secret album: black-box tiles + visible counts ("Unlock to view N photos and Y videos"). Gold key Unlock CTA below the gallery.

### Auth

- Supabase Auth, email + password
- Email confirmation required before onboarding
- Password reset via email link
- Magic link is a future option

### Access requests in messages tab

When a baby clicks **Request access** on a daddy's profile:

- A `secret_access` row is created (status `requested`)
- A notification is created for the daddy
- The request appears as a special row in the daddy's messages tab list (not a conversation row)
- Tapping opens a sheet showing the requester's mini-profile + **Grant** / **Ignore** buttons
- Granting sets `secret_access.granted_at`. Ignoring closes the sheet (state stays at requested; daddy can grant later)
- No chat thread is created. If daddy wants to message her, that's the normal first-message flow with its own 10-token charge

---

## 6. Security & RLS model

### Default-deny RLS, RPCs as the only API

Clients never write directly to a table. Reads almost always go through view RPCs. RLS is deny-by-default with allow-listed exceptions.

Per-table policies:

| Table                                                                                           | SELECT                                  | INSERT                                  | UPDATE                      | DELETE            |
| ----------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------- | --------------------------- | ----------------- |
| `profiles`                                                                                      | Authenticated, `status='active'`        | Trigger only                            | Owner, allow-listed columns | Disallowed        |
| `interests`, `app_config`                                                                       | Authenticated                           | Migration only                          | Migration only              | Disallowed        |
| `profile_interests`                                                                             | Owner                                   | Owner                                   | Owner                       | Owner             |
| `media_items`                                                                                   | Disallowed (RPCs only)                  | RPC only                                | System only                 | Disallowed        |
| Junction tables (`profile_photos`, `secret_album`, `message_photo_album`, `verification_video`) | Owner direct; RPC for others            | Owner                                   | Owner                       | Owner             |
| `likes`                                                                                         | `liker_id=me` OR `likee_id=me`          | `liker_id=me`                           | Disallowed                  | `liker_id=me`     |
| `conversations`                                                                                 | Participant                             | RPC only                                | RPC only                    | Disallowed        |
| `messages`                                                                                      | Participant AND (unlocked OR sender=me) | RPC only                                | Disallowed                  | Disallowed        |
| `secret_access`                                                                                 | Requester or owner                      | RPC only                                | RPC only                    | Disallowed        |
| `token_transactions`                                                                            | `profile_id=me`                         | Disallowed (RPC only, SECURITY DEFINER) | Disallowed                  | Disallowed        |
| `payments`                                                                                      | `profile_id=me`                         | Webhook only                            | Disallowed                  | Disallowed        |
| `notifications`                                                                                 | `recipient_id=me`                       | RPC only                                | Owner can mark read         | Owner can dismiss |

### RPC categories

- **Read RPCs (view models)** — `SECURITY INVOKER`, rely on RLS. Compose what the client could _almost_ do itself, but assemble it into one round-trip and gate sensitive media (returning `items: null` when not unlocked, never returning storage paths to non-unlockers).
- **Write RPCs (state changes)** — `SECURITY DEFINER`. Bypass RLS atomically. Every one starts with explicit `auth.uid()` check, role check, authorisation check.

Template:

```sql
CREATE FUNCTION send_first_message(...) RETURNS jsonb
SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING errcode='P0001'; END IF;
  IF (SELECT role FROM profiles WHERE id = me) != 'benefactor' THEN
    RAISE EXCEPTION 'forbidden' USING errcode='P0002'; END IF;
  -- ... rest of body
END;
$$ LANGUAGE plpgsql;
```

pgTAP tests assert each function rejects unauthenticated, wrong-role, and impersonation attempts.

### Storage

- Single private bucket `media`
- Default-deny on all reads
- Files at `users/{owner_id}/{hash}.{ext}` (deterministic, dedup-safe)
- Uploads: `prepare_media_upload` returns a signed PUT URL valid 5 minutes, scoped to one path
- Reads: every view RPC that returns media generates **signed GET URLs valid 1 hour** at response time; client refetches as needed
- Storage RLS denies everything; the only path is via signed URLs from RPCs that ran the access check

### Auth boundaries

- **Anonymous**: marketing pages, signup, login, password reset
- **Authenticated, `pending_onboarding`**: onboarding wizard + sign out
- **Authenticated, `active`**: full app, role-gated UI (token bar/buy only for benefactors)
- **`suspended`**: lockout screen with appeal email
- **`deactivated`**: same as anonymous, sessions invalidated

### Age verification

- Client: DOB picker freely editable, but Continue button disabled if DOB doesn't satisfy ≥ 18
- Server: `profiles.date_of_birth` CHECK constraint fires on every UPDATE
- Pre-launch: identity verification flow sets `age_verified_at`. Verified DOB takes precedence; subsequent edits clear `age_verified_at` and force re-verification

### Webhook security

- Edge Function `/webhooks/payments/{provider}`
- Signature validation against `SEGPAY_WEBHOOK_SECRET`; failure → 401, logged
- Idempotency: `payments.provider_ref` UNIQUE
- Webhook is the only caller allowed to invoke `complete_payment` RPC, enforced by service-role JWT

### Rate limiting & abuse — pre-launch

Plan: per-user token bucket in a Postgres function, capped on signup attempts/IP, login attempts/account, messages sent/hour, media uploads/hour, profile views/hour.

### Auditability

- `token_transactions` is the financial audit trail (append-only, immutable)
- `payments` is the external-payment audit trail
- `audit_log` table for privileged operations is pre-launch
- All RPCs log structured messages on errors

---

## 7. Configuration

### Single source of truth: `shared/app-config.ts`

```ts
export const APP_CONFIG = {
  tokens: {
    firstMessageCost: 10,
    unlockAlbumCost: 10,
    unlockReadReceiptsCost: 10,
    freeStartingTokens: 100, // dev/faux mode only
  },
  media: {
    maxVideoSeconds: 60,
    maxUploadMB: 50,
    allowedPhotoMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedVideoMimeTypes: ['video/mp4'],
  },
  age: { minimum: 18 },
  payments: {
    provider: 'faux', // 'faux' | 'segpay'
    packages: [
      { id: 'starter', tokens: 50, priceCents: 4999, currency: 'GBP' },
      { id: 'plus', tokens: 150, priceCents: 12999, currency: 'GBP' },
      { id: 'premium', tokens: 500, priceCents: 39999, currency: 'GBP' },
    ],
  },
} as const
```

Three consumers, all populated from this one file at build time:

| Consumer                 | How                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                 | Direct `import` — Vite inlines values into the bundle                                                                                                                                               |
| Edge Functions (Deno/TS) | Same `import`; deployed alongside source                                                                                                                                                            |
| Postgres RPCs            | Build script `pnpm gen:config` reads the file and emits `supabase/migrations/<timestamp>_app_config_seed.sql` (idempotent UPSERT into `app_config`). RPCs read from the table — fast local SQL read |

To change a price, edit one file. CI generates the SQL migration and rebuilds the frontend. They cannot drift.

---

## 8. Observability

### OpenTelemetry threaded throughout

`lib/otel.ts` initialises the OTEL SDK at app start, reading `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION` from env.

If the endpoint env var is unset, the exporter is a no-op (`NoopSpanExporter`). Spans are still created and dropped silently. Same code path either way.

One configuration helper for both **frontend** (`@opentelemetry/sdk-trace-web` + auto-instrumentation for fetch/XHR) and **edge functions** (Deno-compatible OTEL SDK). Same env var contract.

**Where spans go:**

- Frontend: auto-instrumented for HTTP/fetch (covers all Supabase RPC calls). Manual spans wrap key user actions (signup step, send*message, unlock*\*, upload_media)
- Edge Functions: root span per request; child spans for external calls (postcodes.io, Segpay)
- Postgres RPCs: `set_config('app.trace_id', $1, true)` at the start of every RPC. Trace ID comes from caller's active span context, sent in RPC arguments. Postgres logs correlate with traces by trace_id

**Standard attributes:**

- `user.id`, `user.role`
- `app.feature`, `app.rpc_name`
- `app.entity_type`, `app.entity_id`
- HTTP attributes (auto)
- **Display names, emails, message bodies, token amounts may go into spans where useful for debugging.** No hard rules in code.

**GDPR review pre-launch:** OTEL store contents will create UK GDPR obligations (data subject access, right to erasure, sub-processor agreements if managed backend, retention policies, privacy policy notice). Doesn't change the design but the legal review must cover it.

---

## 9. Testing strategy

### Layers

| Layer                | Tool               | Covers                                                                                     |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Postgres unit        | pgTAP              | Each RPC: auth, role, atomic state transitions, RLS, CHECK constraints, ledger consistency |
| TS pure-function     | Vitest             | State machines, formatters, distance calc, hash, validators                                |
| Frontend component   | Vitest + RTL + MSW | Component behaviour with mocked RPC responses; locked/unlocked/granted states              |
| Frontend integration | Vitest + RTL       | Multi-step user flows in the app, against a real Docker Supabase                           |
| E2E                  | Playwright         | 4 critical journeys end-to-end                                                             |

### Critical pgTAP coverage

Each function gets:

- Happy path
- Auth rejection (unauth, wrong role, suspended, deactivated)
- Authorisation rejection (other people's resources)
- Idempotency (duplicate calls don't double-spend or double-create)
- Atomicity (simulate failure mid-RPC, assert no partial state)
- Ledger reconciliation (`SUM(delta) = profile.token_balance` for every spend test)

### RLS policy tests

Parameterised tests verify, for every protected table:

- Row owner can / cannot do each verb per the policy table
- Other authenticated user can / cannot do each verb
- Anonymous always rejected
- Specifically for `messages`: baby-initiated locked conversation hides messages from daddy until `unlocked_at` set
- Specifically for `secret_album`: non-unlocked benefactor can SELECT counts but not items

### E2E journeys (Playwright, 4)

1. Signup → email confirm (admin-API bypass) → onboarding (all steps) → land on Search
2. Daddy buys tokens via FauxProvider (sync mode) → balance updates → daddy sends first message to a baby → 10 tokens deducted → message appears in his thread → notification created for her
3. Baby sends message first (no token cost) → daddy sees locked-conversation card → unlock → reads & replies (free)
4. Baby requests access via daddy's profile → request appears as request row in daddy's messages tab → grant → baby can view his secret album (free)

Other coverage (likes, secret album request/grant/unlock, read receipts, PWA install) lives in pgTAP + frontend component tests.

### Test environment lifecycle

- **Two real Supabase environments:** staging + production
- **Production smoke tests** post-deploy: small read-only set
- **All automated tests run against ephemeral Docker Supabase** via the Supabase CLI (`supabase start`). No Supabase MAU billing for tests
- **Local dev uses the same Docker Supabase**

### Per-test isolation

- pgTAP / RPC integration tests: wrap each in a transaction, ROLLBACK at end
- Playwright: each test creates uniquely-named users (`test-{nanoid()}@local.test`) and asserts only on its own users. After suite, `supabase stop` wipes everything

### Email verification in tests

Bypass via Supabase admin API with `email_confirm: true`. No email sent. The actual confirmation redirect handler is covered by a unit test with a stubbed token. One staging-only manual check before each release.

### Anti-flakiness rules

- No `setTimeout` / `waitFor(ms)` in tests
- All async-by-design code has a synchronous test mode (FauxProvider example: `FAUX_PAYMENT_SYNC=true` makes payment complete inline)
- All time-dependent code accepts an injected clock; production passes `() => new Date()`, tests pass a controlled value
- All UUIDs from `crypto.randomUUID()` in production; tests pass deterministic UUIDs from factories

### Mock-drift prevention

The contract chain:

1. **Generated TS types from Postgres** (`supabase gen types typescript --local`) — the foundation. Compile-time check.
2. **Zod schemas in `shared/rpc-contracts.ts`** — single source of truth for input/output shapes.
   - Production frontend: `.parse()` every RPC response
   - Production Edge Functions: `.parse()` every webhook body
   - Test mocks (MSW): `.parse()` mock responses before returning. Drifted mocks fail the test.
3. **Contract tests in CI** — call each RPC against local Docker Supabase with realistic inputs, assert response parses through the Zod schema. Catches "I changed the function but not the contract."

If anything in the chain drifts, the typecheck, contract test, or production runtime fails loud.

### Coverage targets (initial, not enforced)

- Postgres RPCs: every public function has all five categories above
- Frontend: 80% line coverage on `features/*`, lower bar on shared components, higher bar on flows touching tokens
- E2E: 4 journeys non-skippable in CI

### CI

- GitHub Actions: lint → typecheck → unit (Vitest, pgTAP) → contract tests → E2E (Playwright against ephemeral Supabase) → build → deploy preview to staging on merge to `main`
- Branch protection: all green to merge

### Test infrastructure deferred

- Pre-built test factories: extract them only after the first 5–10 real tests reveal the pattern. Don't pre-build.
- Storybook: not in MVP

---

## 10. Pre-launch checklist

Items deferred from MVP, must be done before public launch:

**Compliance & legal**

- UK age verification flow (Yoti / Persona / Veriff style). Required by UK Online Safety Act.
- Identity / photo verification (device camera+mic short video selfie) — uses verification_video table already in schema
- Privacy policy, T&Cs, cookie consent (GDPR)
- GDPR review specifically of OTEL store contents (data subject access, right to erasure, retention)
- Security review / pen test
- Sub-processor agreements (Supabase, Segpay, OTEL backend, etc.)

**Payments**

- Real Segpay onboarding completed
- Flip `APP_CONFIG.payments.provider` from `'faux'` to `'segpay'`
- Real card details tested end-to-end on staging

**Content & safety**

- Reporting and blocking flow
- NSFW image moderation (manual review queue + automated detection: AWS Rekognition, Hive, or similar)
- Default `media_items.status` flipped from `'approved'` to `'pending_moderation'`
- Admin moderation dashboard
- Rate limiting / abuse controls

**Reliability & operations**

- Error tracking (Sentry)
- Uptime monitoring + alerting
- Backup verification
- Incident runbook

**UX polish**

- Location autocomplete (typed dropdown, debounced, postcodes.io `/places`)
- Push notifications for new messages and secret access granted (web-push or OneSignal)
- Transactional engagement email (Resend) for likes received, requests received, etc.
- Realtime subscriptions for in-conversation messages (replace polling)

**Performance**

- Mux or Cloudflare Stream for video transcoding/HLS delivery
- CDN cache tuning
- Bundle size review

**Multi-region readiness**

- Swap postcodes.io for global geocoder (Mapbox or Nominatim)
- Compliance review for any market beyond UK
- Locale and currency expansion

---

## 11. Open questions / future considerations

Not blocking MVP but worth thinking about:

- **Access tab** in main navigation — possibly add post-launch if data shows users want it
- **Secret questions** as a third secret-content type alongside photos and videos
- **Per-pair vs per-conversation read-receipts** — currently per-conversation. Re-evaluate after seeing real usage
- **Token price per action** — currently all 10 tokens. May want differential pricing post-launch (e.g., album unlock more expensive than first message)
- **Mobility/travel radius** for location matching — would replace simple centroid+radius search
- **Secret album gifts** — can a baby gift access to a daddy without him paying tokens, as a relationship-builder? Not in MVP
- **Profile-level analytics for users** — "who viewed your profile" — common feature, not in MVP

---

## 12. Decisions log

For history. Each item was a deliberate choice during brainstorming.

- **MVP scope** — profiles + search + messaging + likes + secret album + tokens (data model live, faux payments)
- **Roles** — benefactor + baby, opposite-role only. Set at signup, immutable.
- **Geography** — UK first, i18n from day one. Compliance deferred to pre-launch.
- **Profile fields** — split bio into Wants and About. Tagline as title. Physical, lifestyle, interests, location, photos, secret album. Verification deferred.
- **Location** — single city/town/district name field at signup, geocoded to centroid. Distance via PostGIS. Radius filter on search. Autocomplete pre-launch.
- **Messaging** — text + photo (one per message, photo replaces text). Curated favourites album for chat photos. "No nudity" reminder on every upload surface.
- **Secret album** — single album per user (mixed photos + videos). Locked black boxes (not blurred). Counts visible to anyone, items only after grant + (for benefactors) unlock.
- **Secret access** — global grant, per-pair benefactor unlock. Implicit checkboxes on first message and first reply (ticked by default). Babies request via profile button.
- **Token economy** — 10 tokens for first message, 10 for unlock album, 10 for unlock read receipts. Per-conversation unlock for read receipts. No refunds.
- **Likes** — bookmark + signal. In-app banner only. No price gating.
- **Payment provider** — `PaymentProvider` interface, `FauxPaymentProvider` for MVP, `SegpayProvider` pre-launch.
- **DOB** — editable; ≥18 enforced client-side and server-side via CHECK.
- **Notifications** — banners + tab red dots. No bell. Push pre-launch.
- **Tabs** — Search, Messages, Likes. Token balance in hamburger.
- **Access requests** — appear as special rows in messages tab, not as conversations.
- **Realtime** — deferred. Polling for MVP.
- **Configuration** — single `shared/app-config.ts` source of truth, build-step seeds Postgres `app_config` table.
- **OTEL** — threaded throughout, no PII rules in code (GDPR review pre-launch).
- **Test environments** — two real Supabase (staging + prod), all automated tests on ephemeral Docker Supabase.
- **Mock-drift prevention** — generated types + Zod schemas + contract tests in CI.
- **E2E count** — 4 journeys.
- **Three unlock RPCs** — `unlock_conversation`, `unlock_secret_album`, `unlock_read_receipts`. Not parameterised.
- **Storage** — single private bucket, signed URLs from RPCs after access check. No public bucket.
- **Media model** — `media_items` content-addressed by hash, junction tables decide where it appears. No `visibility` enum. No `deleted_at`; orphans GC'd.
- **Moderation** — `status` field present, default `'approved'` in MVP. Default flips to `'pending_moderation'` pre-launch with queue + auto-detection.

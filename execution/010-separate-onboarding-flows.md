# 010: Separate onboarding flows per role

Status: not started. High-level spec — turn into a full plan via
`superpowers:writing-plans` before executing.

## Motivation

See `marketing/onboarding-notes.md`. Secret Benefits runs asymmetric
onboarding and it solves two problems we have: demand-side conversion (the
catalog is the sales pitch — get benefactors to it with minimal friction)
and supply-side inventory quality (a baby profile without photos is a
bounce, not a user; requiring photos before market access manufactures
inventory at the door, gates fraud where fakes enter, and means the supply
side never sees launch-stage catalog thinness). The supply-side activation
event this flow produces ("activated profile with photos") is also the
event our affiliate supply-side CPL will pay on (`marketing/channels.md`),
so the onboarding gate and the payout gate become the same measurement.

## Reference: Secret Benefits' baby-side requirements (observed July 2026)

What the incumbent actually requires from babies at signup, as a
calibration point for how much friction the supply side of this category
tolerates:

- **Tagline: required.**
- **Bio: required, with a minimum character count**, and split into two
  prompts: "what do you have to offer" and "what are you looking for".
- **Photos: a minimum number required — apparently six**, presented as a
  grid of "+" placeholders to fill.

The point of the high bar is anti-fake economics as much as profile
quality: six real photos plus a structured minimum-length bio makes a fake
profile expensive to manufacture at exactly the door where fakes enter.
The incumbent can demand this because it has brand trust and visible
liquidity; whether a brand-new site can demand the same on day one is an
open question below — but the mechanism (structured required fields +
photo minimum as the fraud gate) is the thing to copy, and the specific
minimums should be config-driven (`shared/app-config.ts`) so the bar can
be tuned without a code change.

## Current behaviour

One symmetric flow for both roles (`'benefactor' | 'baby'`, chosen in
`src/features/onboarding/components/RoleStep.tsx`):

role → identity → location → photo → details → interests →
`/onboarding/complete`, which flips profile status to `active` and lands on
`/search`. Photo, details, and interests are all skippable for everyone.

## Desired behaviour

Fork the flow at the role step.

**Benefactor path — shortest route to the catalog:**
- role → identity → location → photo (kept, still skippable, framed as
  suggested) → complete → `/search`.
- Details and interests are removed from the benefactor onboarding
  entirely and become post-activation prompts (e.g. a nudge card on `/me`
  and/or an in-app banner after activation). They remain editable from
  `/me` as today.

**Baby path — profile before market:**
- role → identity → location → photo (required: a minimum photo count,
  config-driven, rendered as a grid of "+" placeholders per the Secret
  Benefits reference above) → bio (required: tagline plus a
  minimum-character bio split into "what do you have to offer" / "what are
  you looking for") → details/interests (kept as steps, still skippable,
  copy reframed) → complete → `/search`.
- A baby profile cannot reach `active` status without meeting the photo
  minimum and required bio fields. This must be enforced server-side (the
  completion RPC / database layer), not just in the client flow — the rule
  is a data invariant, not a UI preference, and it is also the fraud gate.
- Step copy on the baby path is benefit-framed ("get seen", "your first
  photo is your card photo"), not administrative. No fabricated numbers or
  fake urgency anywhere.

## Explicitly out of scope (design for, don't build)

- **Video verification.** Future feature; the baby path should be
  structured so a verification step can slot in after photos later without
  another rework.
- **Live local-count stats during baby signup** ("your profile goes live
  to N members in London"). Deliberate follow-up only after launch cities
  have real density — at launch the honest number is near zero and would
  work against the flow. See the caveat in `marketing/onboarding-notes.md`.

## Constraints and known gotchas

- The `active` status flip currently happens at `/onboarding/complete`;
  the baby photo requirement changes the preconditions for that flip.
  Check RLS policies and any views keyed on profile status.
- Server-side enforcement will need pgTAP coverage; remember the repo
  fixture rule (INSERT into `auth.users` before `SET LOCAL ROLE
  authenticated`).
- Existing unit and Playwright E2E tests cover the symmetric six-step flow
  and seeded users; both will need updating. `e2e/helpers/admin-signup.ts`
  and `scripts/seed-dev-users.mjs` may assume the old flow.
- All new copy goes through i18n (react-i18next) with per-role keys;
  English only for now, per the language-switcher setup.
- Onboarding step indicators/progress UI currently assume one fixed step
  sequence; the layout (`OnboardingLayout.tsx`) will need per-role step
  lists.
- The split bio ("what do you have to offer" / "what are you looking
  for") and tagline are new profile fields — a schema migration plus
  updates to profile views/RPCs, profile edit on `/me`, and the profile
  display pages, not just an onboarding change. Decide how the existing
  free-text `bio` maps or migrates.
- Log deviations in the plan file as the repo convention requires.

## Open questions (suggested defaults)

1. Where to set the baby minimums at launch. Secret Benefits demands ~6
   photos plus tagline plus minimum-length split bio, but it has brand
   trust and visible liquidity behind that ask; a brand-new site setting
   the identical bar may pay more in abandonment than it saves in fakes.
   Default: adopt the same structure (photo minimum + required tagline +
   required split bio) with the numbers in `app_config` — start photos at
   a lower minimum (e.g. 3) and the bio minimum modest, then ratchet
   toward the incumbent's bar as density and brand trust grow. The
   structure is the fraud gate; the numbers are tuning.
2. Where do the benefactor details/interests prompts live post-activation?
   Default: a dismissible prompt card on `/me` plus one banner via the
   existing `BannerHost` after first activation; no recurring nag.
3. Should an existing incomplete signup mid-flow at deploy time be
   migrated? Default: no migration; the fork applies from the role step,
   and pre-fork part-completed profiles just follow the new rules on their
   next step load.
4. Does a baby who skipped details/interests get the same post-activation
   prompts as benefactors? Default: yes, reusing the same mechanism.

## Acceptance criteria

- A benefactor can go from signup to `/search` having provided only role,
  identity, and location; photo remains optional for them at every point.
- A baby cannot reach `active` status (and therefore `/search`) without
  meeting the configured photo minimum and the required bio fields
  (tagline plus split bio), and the constraints hold when the client is
  bypassed (verified by pgTAP tests against the completion path).
- The photo minimum and bio minimum-length values live in
  `shared/app-config.ts` and change without a code change elsewhere.
- Neither role sees the other role's step sequence or copy.
- Existing profiles and the seeded dev users remain valid; `pnpm test`,
  `pnpm test:db`, and `pnpm test:e2e` pass with flows updated to match.

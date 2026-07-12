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
- role → identity → location → photo (required: at least 1 photo, UI
  encourages more, up to the existing 6) → details/interests (kept as
  steps, still skippable, copy reframed) → complete → `/search`.
- A baby profile cannot reach `active` status without at least one photo.
  This must be enforced server-side (the completion RPC / database layer),
  not just in the client flow — the rule is a data invariant, not a UI
  preference.
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
- Log deviations in the plan file as the repo convention requires.

## Open questions (suggested defaults)

1. Minimum baby profile beyond photos — is a bio required? Default: no;
   photo required, bio and details encouraged but skippable at launch.
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
- A baby cannot reach `active` status (and therefore `/search`) without at
  least one photo, and the constraint holds when the client is bypassed
  (verified by a pgTAP test against the completion path).
- Neither role sees the other role's step sequence or copy.
- Existing profiles and the seeded dev users remain valid; `pnpm test`,
  `pnpm test:db`, and `pnpm test:e2e` pass with flows updated to match.

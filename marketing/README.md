# Marketing

Marketing strategy and working documents for SD Site. UK-first launch, in a
jurisdiction where the product is legal. Everything here assumes we operate
openly and within each platform's published rules — no cloaking, no
misrepresenting the product to ad reviewers. Where a platform bans the
category, we treat that channel as closed and route around it.

## Documents

- [lessons-learned.md](lessons-learned.md) — the case studies distilled into
  our playbook. We follow the Secret Benefits quiet-growth model; this doc
  records the concrete commitments, rejections, and where it re-ranks
  channels.md. Read this first.
- [channels.md](channels.md) — acquisition channels ranked per the playbook
  (affiliates primary, brand-harvest SEO, product-led loops; PR reactive
  only; OOH excluded), with first steps for each.
- [launch-plan.md](launch-plan.md) — phased launch plan (waitlist → seeded
  closed beta → quiet open launch via affiliates), including
  two-sided-marketplace seeding.
- [brand-name.md](brand-name.md) — the naming workstream (spec 020): why
  Secret Benefits is the benchmark, the formula and tests derived from it,
  the candidate shortlist, and the knockout-screen process.
- [founder-anonymity.md](founder-anonymity.md) — what Secret Benefits did to
  stay faceless, what UK law allows, and our position: pseudonymous in
  marketing, accountable on paper.
- [onboarding-notes.md](onboarding-notes.md) — Secret Benefits' asymmetric
  onboarding (lightweight for the demand side, full-profile-before-market
  for the supply side) and why we should copy it; spec in
  `execution/010-separate-onboarding-flows.md`.
- [case-studies/](case-studies/README.md) — how six competitors launched and
  acquired users, individually sourced, with cross-cutting conclusions.

## The constraint landscape

The question is not just "Meta and Google won't take our ads". The whole
mainstream acquisition stack is closed or restricted for this category, and
that shapes everything:

| Gatekeeper | Status | Notes |
|---|---|---|
| Meta ads (FB/IG) | Closed | Dating ads need written eligibility; sugar/compensated dating is explicitly ineligible. Organic pages also get removed under the same policy. |
| Google Ads | Closed | Dating is a restricted vertical requiring certification; "compensated dating or sexual arrangements" is expressly disallowed (ads policy tightened February 2021). |
| Google Play | Closed | Compensated-dating apps banned since 1 September 2021 (announced July 2021). |
| Apple App Store | Closed in practice | Sugar dating apps are rejected/removed under 1.1.4. |
| TikTok / Snap / Reddit ads | Closed | Dating heavily restricted; this sub-category not accepted. |
| X (Twitter) | Partially open | Dating ads permitted with restrictions; organic adult-adjacent content tolerated. The one large platform worth testing. |
| Mainstream programmatic (DV360 etc.) | Closed | Inherits Google policy. |

Two consequences worth internalising:

1. **Being a PWA is a strategic asset, not a fallback.** The app stores are
   closed to this category, so "installable PWA" (already our architecture) is
   the distribution model, not a compromise. Install prompts, push
   notifications, and home-screen presence all work without a store listing.
2. **Channels that competitors built their businesses on — SEO, PR, affiliates,
   adult-friendly ad networks — are the main road, not the workaround.**
   Seeking (the category leader) was built substantially on earned media and
   SEO, not Meta/Google ads.

## Regulatory and infrastructure gotchas (UK-first)

Not marketing channels, but they gate marketing decisions:

- **ASA / CAP Code.** UK ads (including OOH, print, influencer posts) must not
  be placed in media where under-18s are a significant audience, must not
  objectify or be gratuitously sexual, and dating-service ads get complaints
  by default. Media owners (e.g. TfL) apply their own stricter acceptance
  policies. Get copy cleared early; expect some placements to refuse us.
- **Online Safety Act 2023.** As a service likely to be accessed by children
  unless we prevent it, we need robust age assurance (18+) — this is now a
  compliance requirement, and also a positive PR/trust angle. Budget for an
  age-verification provider.
- **Payments.** Dating is a high-risk category for acquirers (MCC 7273), and
  Stripe's restricted-business list generally excludes dating services — do
  not assume the Stripe integration pattern used in other projects here will
  be available. Expect to need a high-risk-friendly processor (e.g. Segpay,
  CCBill, Verotel, or a high-risk acquirer relationship). Resolve this before
  the token-economy plan, since it constrains pricing and checkout UX.
- **Positioning discipline.** The product is a dating site. All copy —
  onsite, ads, PR quotes, affiliate creatives — must be consistent with
  dating, not with transactional arrangements. This is both a legal-exposure
  issue and what keeps the remaining ad channels open. Affiliates must be
  contractually bound to approved creatives (rogue affiliate copy is the
  classic way dating brands get banned from networks and into the press for
  the wrong reasons).

## The student demographic

University students are a classic supply-side demographic in this category —
adults who use it, legally, to help fund their studies — and the marketing
can acknowledge that rather than pretend otherwise. The guardrails that keep
it defensible under the CAP Code and in the press:

- **18+ audiences only.** University student media is fine; anything that
  reaches sixth-formers or mixed-age audiences (school-adjacent OOH, general
  "youth" media) is not. Verify the age profile of any placement.
- **Agency framing, not desperation framing.** "Date on your terms while you
  study" survives an ASA complaint; "drowning in tuition debt? there's an
  answer" is textbook socially-irresponsible advertising and invites both a
  ruling and a pile-on. Never lead with financial hardship.
- **Say dating, not income.** The studies-funding reality can be present in
  PR and content (it's what journalists will ask about anyway — have honest
  numbers and a spokesperson ready), but ad creative stays a dating
  proposition. Copy that promises money for companionship is what collapses
  the legal distinction the whole business rests on.
- Competitor precedent ("sugar baby university" campus campaigns) shows both
  that the channel works and that it draws regulator and press heat — budget
  for complaints and have response lines prepared before running it.

## What we deliberately do not do

- No misclassifying ads or landing-page cloaking to pass Meta/Google review.
  It fails within weeks, burns the domain and payment accounts, and is the
  single most common self-inflicted death in this vertical.
- No paying for fake profiles or engagement. Marketplace seeding (see
  launch-plan.md) is done with real, incentivised early users.

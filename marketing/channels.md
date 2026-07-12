# Acquisition channels

Ranked according to the playbook in [lessons-learned.md](lessons-learned.md)
(the Secret Benefits quiet-growth model), which governs this document. The
ORB framing still applies — owned channels (the PWA, email list, our SERPs)
are the destination; borrowed channels (affiliates) and rented channels (ad
networks, X) fill them — but the engine is now affiliates plus brand
harvesting, not content-empire SEO plus PR.

Evidence base: [case-studies/](case-studies/README.md), especially
[secret-benefits.md](case-studies/secret-benefits.md) for why this ranking
works and [richmeetbeautiful.md](case-studies/richmeetbeautiful.md) for what
is excluded.

## Tier 1 — the quiet engine (build from day one)

### 1. Affiliate / review-site ecosystem (borrowed; the primary channel)

The "best sugar dating sites" listicle ecosystem owns the category's money
keywords, and a top-3 global player was built on it with zero earned media.
We buy distribution here rather than fighting for it ourselves.

- Get listed in the listicles that already rank, prioritising UK-facing
  review/comparison sites — a smaller pond than the US ecosystem Secret
  Benefits rides, so early placements are winnable and defensible.
- Run the programme direct/invite-only, not on public CPA network rate
  cards: we choose who promotes us and keep creative control.
- Pay CPA on credit purchases, not signups — affiliate incentives align
  with real revenue and with our activated-profile funnel metric.
- Approved-creatives clause, actively enforced. Rogue affiliate copy is an
  ASA liability that attaches to us, and this vertical's affiliates keep
  publishing fake-fresh reviews of dead brands — the channel must be
  policed continuously, not just contracted.
- First steps: ref-code attribution into Postgres (before adopting any
  affiliate platform), payout terms defined against credit purchases,
  shortlist of the top 10 UK-relevant review sites, affiliate agreement
  drafted with the creatives clause.
- Expectations: the first placements matter more than volume; rankings last
  exactly as long as payouts do, so this is a permanent cost of revenue, not
  a launch expense.

### 2. Brand-harvest SEO (owned)

Secret Benefits does not rank for non-brand terms; its affiliates do, and it
harvests the branded demand they create. We copy that inversion.

- Own every navigational SERP for our name before anyone else does: brand,
  "brand login", "brand review", "is brand legit", "brand app". These are
  our pages, live from launch.
- The brand name itself is channel infrastructure: memorable, clean,
  spellable, and free of category keywords that inherit platform risk.
- A modest blog for long-tail trust queries (safety, how-it-works, is-it-
  legal-in-the-UK) — trust content, not a content empire.
- Comparison/alternatives pages ("alternatives to Seeking") stay: they are
  affiliate-style content we own, catching high-intent switchers.
- City pages remain worth shipping (cheap, UK-tractable, feed launch-city
  density) but are a secondary investment, not the flagship.
- KPI: monthly branded search volume for our name — the signal that
  affiliate spend is compounding into brand equity rather than accruing
  only to the affiliates.

### 3. Product-led loops (owned)

Product decisions are the marketing under this model; these are the ones
with channel weight (build details belong in product plans):

- Visible verification badge (video selfie), surfaced in search results and
  profiles — converts the category's scam anxiety, and doubles as Online
  Safety Act groundwork.
- Free for the supply side; credits (not subscriptions) for the paying side.
- Discretion features (secret album, private profiles) as the brand promise.
- Referral designed for private 1:1 sharing (link/code), never social
  broadcast — nobody advertises membership of this category on their feed.

## Tier 2 — paid tests and secondary channels

### 4. Dating-friendly ad networks (rented; vetted placements only)

Networks serving adult and dating inventory accept the category and offer UK
geo-targeting: ExoClick, TrafficStars, Adsterra-class display and push
networks, plus native networks with dating verticals.

- Placement quality is vetted, not bought blind: no escort-adjacent or
  sex-work-adjacent placements, even where they convert — the positioning
  and legal risk outweighs the traffic (see lessons-learned.md on Secret
  Benefits' referral profile, which we deliberately do not copy).
- Expect low CPCs, low conversion, and a real bot problem; measure to
  activated-profile level before scaling.
- First steps: one network, one UK campaign, £500-1k test budget, strict
  attribution.

### 5. X (Twitter) — the one big platform partially open (rented)

Dating ads are permitted with restrictions, and organic policy tolerates the
category. Under the quiet model the organic presence is low-key and
functional (brand answers, support, occasional dating-culture posts), not a
provocation machine. Small paid test is worthwhile; expect policy
volatility; never a single point of failure.

### 6. Podcast and newsletter sponsorships (borrowed)

Host-read ads on dating/relationships/lifestyle podcasts and paid slots in
dating-culture newsletters. Acceptance is host-by-host; each yes carries
implicit host endorsement. Unique promo codes for attribution. Mid-tail UK
rates are reasonable.

### 7. Student media and student-city targeting (rented)

The supply side skews toward university students funding their studies —
see "The student demographic" in [README.md](README.md) for the guardrails
(18+ placements, agency framing, dating proposition in creative). The
RichMeetBeautiful case study maps the criminal line precisely; our copy
never goes near debt-relief framing.

- University student papers/sites and student-focused publishers with
  verified adult audiences accept ads mainstream platforms won't; pitch
  several, expect refusals.
- Time pushes to term rhythm (freshers period, January), and layer
  student-city geo onto ad-network tests (#4) and student-life podcasts
  (#6).
- Expect the occasional ASA complaint; that's priced in, per README.

## Tier 3 — hedges and reactive channels

### 8. Press: reactive capability plus an optional annual report (borrowed; downgraded)

We do not launch or grow via PR under this playbook, but a UK company cannot
be anonymous (Companies House), so journalists will find us — the choice is
answering well or stonewalling badly.

- Maintain: press kit page, media@ address, one named spokesperson with
  prepared lines for the hostile version of every category story (the
  student angle first — engage it honestly per README guardrails).
- Option, post-scale: an annual UK data report with fact-checkable numbers
  only — the proven mechanic (Seeking, Ashley Madison) without the
  provocation. A hedge against affiliate-channel concentration, exercised
  only when the numbers are defensible.

### 9. Reddit / forums / communities (rented, organic only)

Participate honestly (flagged affiliation) where subreddit rules allow.
High effort, modest reach; useful for early qualitative feedback and for
seeding honest answers on the "is brand legit" queries we want to own.

## Not in this playbook

- **OOH/billboards.** A loud-playbook tool with the worst risk profile in
  our category (see richmeetbeautiful.md); excluded by lessons-learned.md.
- **Stunt/outrage marketing and engineered ad rejections.** Same exclusion,
  same evidence.

## Channel → funnel wiring

Whatever the channel, the destination is owned:

- Every channel lands on the site with UTM/ref attribution captured into
  Postgres at signup (add `acquisition_source` to profiles early — it's a
  one-column migration now, an unanswerable question later). Affiliate ref
  codes ride the same rails.
- Pre-launch, everything points at the waitlist (email capture) — see
  [launch-plan.md](launch-plan.md).
- Email is the retention channel: onboarding sequence, "X liked you"
  digests (already have the notifications infrastructure), win-back. The
  list is the only audience no platform can take away.
- The two metrics that decide everything (per lessons-learned.md): cost per
  activated supply-side profile in a target city, per channel; and monthly
  branded search volume for our name.

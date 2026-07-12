# Launch plan

Phased launch for a two-sided dating marketplace, UK-first, following the
quiet-growth playbook in [lessons-learned.md](lessons-learned.md): the launch
mechanism is affiliate listings, waitlist conversion, and product-led trust —
not a PR moment. The hard problem at launch is not attention — it's density:
a new user in the first week must see enough active, credible profiles on
the other side to come back. Every phase below is really about manufacturing
that density honestly.

## Marketplace physics (read first)

- **Supply side leads.** In this category the constrained side is attractive,
  active profiles on the female side; the paying side follows wherever supply
  is. Seed supply first, always.
- **Density beats breadth.** 500 active users in London beats 5,000 spread
  across the UK, because search results (already ordered by `last_active_at`)
  look alive. Launch city-by-city: London first, then expand when a city
  crosses a liquidity threshold (e.g. a new user's first search returns 20+
  profiles active within 7 days).
- **Free-for-supply-side is committed** (lessons-learned.md), as is credits
  pricing for the paying side. Both are marketing infrastructure decisions
  and feed directly into the token-economy plan.
- **Never fake supply.** Density comes from seeding, incentives, and
  concierge onboarding below — the Ashley Madison fembot case study is the
  permanent reminder of the alternative.

## Phase 0 — now, pre-launch (runs alongside remaining build plans)

Goal: an owned audience waiting, the affiliate machinery ready, and
attribution plumbing in place, before messaging/payments ship.

- Waitlist landing page on the production domain: value proposition,
  city selector, email capture, role selector (so we can see supply/demand
  mix per city in advance).
- Founding-member offer: free premium period at launch for waitlist signups —
  concrete, costs nothing now, and gives the supply side a reason to be first.
- `acquisition_source` captured at signup (UTM/ref → Postgres); the same
  rails carry affiliate ref codes later.
- Affiliate groundwork (channel #1): attribution design, payout terms
  against credit purchases, the UK review-site shortlist, and the affiliate
  agreement with its approved-creatives clause — drafted now so listings can
  switch on at open launch without a legal scramble.
- Navigational SERP pages (channel #2): brand, "brand review", "is brand
  legit", safety/how-it-works content — live before any affiliate or
  scraper writes them for us. City-page template ready. Baseline the
  branded-search KPI at zero.
- Press capability, reactive-only (channel #8): press kit page, media@
  address, named spokesperson with prepared lines. Drafted, not pitched.
- Resolve the payments question (high-risk processor — see
  [README.md](README.md)). This now formally blocks the token-economy plan:
  credits pricing is a strategic commitment, so the processor decision comes
  first.

## Phase 1 — closed beta (London), invite-only

Goal: real activity from real users; kill the dead-marketplace first
impression before anyone pays.

- Invite from the waitlist in batches, supply side first at roughly 2-3:1
  before opening demand-side invites.
- Personally onboard the first ~100 supply-side users (concierge profile
  help, photo guidance, video verification walkthrough). Slow, unscalable,
  and exactly what makes early profiles credible. These users become the
  referral seed.
- Verification-by-default from day one: the badge is the product's trust
  story and the thing that beats the model we're copying (Secret Benefits'
  fake-profile complaints are its ceiling).
- Weekly activity email ("new members near you", "X liked you" digest) using
  the existing notifications infrastructure — beta users must have a reason
  to return before messaging ships.
- Measure: activation (photo + verified + complete profile), D7 return,
  first-search results count, supply/demand ratio. These numbers decide when
  Phase 2 opens, not the calendar.

## Phase 2 — quiet open launch (London)

Goal: convert the waitlist, switch on the affiliate engine, and let the
quiet machine start compounding. No press push.

- Open self-serve signup for London; founding-member premium unlocks for
  waitlist converts.
- Affiliate listings go live (#1) — the actual launch lever. First UK
  review-site placements negotiated in Phase 0 activate against a live,
  verifiable product.
- Navigational SERPs (#2) updated from "coming soon" to live product; city
  pages published for London plus waitlist-strong cities (as
  waitlist-for-your-city pages).
- Small paid tests where attribution is proven: one ad network (#4, vetted
  placements), X (#5). Private referral codes (#3) enabled for beta users.
- Press kit stays current for reactive use — if coverage happens, we answer
  well; we do not pitch a launch story.
- Not Product Hunt / Hacker News — wrong audience and assured hostile
  comments; UK review sites are our launch venue.

## Phase 3 — city expansion + steady state

- Expansion trigger: London hits liquidity threshold and a second city's
  waitlist crosses a set size; repeat Phase 1→2 per city with the playbook,
  compressing each time.
- Steady-state cadence: every later product milestone (messaging, token
  economy, secret album) is announced to the list and the changelog;
  affiliates get refreshed approved creatives. Press engagement remains
  reactive.
- Optional hedge, post-scale: the annual UK data report (channel #8) —
  exercised only when we have fact-checkable numbers and want insurance
  against affiliate-channel concentration. It is not a growth dependency.
- Affiliate policing is a standing task from Phase 2 onward: creative
  audits, takedown of fake or non-compliant reviews, payout integrity.

## Measurement

Per channel, one funnel, all in Postgres: visit (UTM/ref) → waitlist/signup →
activated profile (photo + verified + role + city) → D7 return → (later)
first credit purchase. The two deciding metrics (lessons-learned.md):

1. Cost per **activated supply-side profile in a target city**, per channel —
   not clicks, not raw signups. Kill anything that can't be attributed.
2. **Monthly branded search volume** for our name — the proof that the
   affiliate engine is compounding into brand equity rather than renting it.

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
- **Dating users multi-home — recruit switchers.** Nobody expects a new
  dating site to be their only dating site; switchers from incumbents add
  us to their rotation and tolerate early low density far better than
  new-to-category users. Comparison/alternatives content
  ([channels.md](channels.md) #2) is a launch asset, not just an SEO play.
- **Be honest about early density.** "New in your city" framing, real
  member counts where we show numbers, and clear empty states — never a
  fake impression of liquidity. (An empty search result and a failed fetch
  must also look different in the UI.)
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
- Affiliate groundwork (channel #1): attribution design, payout terms for
  both sides (demand-side CPA on credit purchases; gated supply-side CPL on
  verified, active profiles), the UK review-site shortlist, and the
  affiliate agreement with its approved-creatives clause and payout gates —
  drafted now so listings can switch on at open launch without a legal
  scramble.
- Navigational SERP pages (channel #9): brand, "brand review", "is brand
  legit" — live before any affiliate or scraper writes them for us. Trust
  and safety guides (channel #6) and the city-page template ready. Baseline
  the branded-search KPI at zero.
- Press capability, reactive-only (channel #11): press kit page, media@
  address, designated spokesperson — not the founder, per
  [founder-anonymity.md](founder-anonymity.md) — with prepared lines.
  Drafted, not pitched.
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
- Affiliate listings go live (#1) — the actual launch lever, serving both
  sides: demand-side placement in the listicles, plus supply-side presence
  in their "for sugar babies" sections with our creatives. Supply-side CPL
  starts gated and capped from day one.
- Comparison/alternatives pages (#2) published — switcher recruitment is
  the demand-side tactic most tolerant of launch-stage density.
- Navigational SERPs (#9) updated from "coming soon" to live product; city
  pages published for London plus waitlist-strong cities (as
  waitlist-for-your-city pages).
- Supply-side density layer activates for London: private referral codes
  (#5) for the concierge-onboarded cohort, trust/safety guides (#6) live,
  student media (#7) timed to the next term-rhythm window.
- Small paid tests where attribution is proven: one ad network (#3, vetted
  placements), X (#4).
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
- Optional hedge, post-scale: the annual UK data report (channel #11) —
  exercised only when we have fact-checkable numbers and want insurance
  against affiliate-channel concentration. It is not a growth dependency.
- Affiliate policing is a standing task from Phase 2 onward: creative
  audits, takedown of fake or non-compliant reviews, payout integrity.

## Measurement

Per channel, one funnel, all in Postgres: visit (UTM/ref) → waitlist/signup →
activated profile (photo + verified + role + city) → D7 return → (later)
first credit purchase. The deciding metrics, per side (lessons-learned.md
and [channels.md](channels.md)):

1. **Supply side:** cost per activated, verified supply-side profile in a
   target city — not clicks, not raw signups. This is also the event the
   affiliate supply-side CPL pays on, so the metric and the payout gate are
   the same measurement.
2. **Demand side:** cost per activated demand-side profile and per first
   credit purchase.
3. **Brand:** monthly branded search volume for our name — the proof that
   the affiliate engine is compounding into brand equity rather than
   renting it.

Kill anything that can't be attributed.

# Launch plan

Phased launch for a two-sided dating marketplace, UK-first. The hard problem
at launch is not attention — it's density: a new user in the first week must
see enough active, credible profiles on the other side to come back. Every
phase below is really about manufacturing that density honestly.

## Marketplace physics (read first)

- **Supply side leads.** In this category the constrained side is attractive,
  active profiles on the female side; the paying side follows wherever supply
  is. Seed supply first, always.
- **Density beats breadth.** 500 active users in London beats 5,000 spread
  across the UK, because search results (already ordered by `last_active_at`)
  look alive. Launch city-by-city: London first, then expand when a city
  crosses a liquidity threshold (e.g. a new user's first search returns 20+
  profiles active within 7 days).
- **Free-for-supply-side pricing** is the standard structural subsidy in this
  market. Decide before the token-economy plan whether the female side pays
  at all; that decision is marketing infrastructure, not just pricing.

## Phase 0 — now, pre-launch (runs alongside remaining build plans)

Goal: an owned audience waiting, and attribution plumbing in place, before
messaging/payments ship.

- Waitlist landing page on the production domain: value proposition,
  city selector, email capture, role selector (so we can see supply/demand
  mix per city in advance).
- Founding-member offer: free premium period at launch for waitlist signups —
  concrete, costs nothing now, and gives the supply side a reason to be first.
- `acquisition_source` captured at signup (UTM/ref → Postgres).
- Start SEO now (it's the slowest channel): blog live on the main domain,
  city-page template, first 10 informational guides. See
  [channels.md](channels.md) #1.
- Press kit page + media address, so PR (#2) can start the moment there's
  something to show.
- Resolve the payments question (high-risk processor — see README) before the
  token-economy plan locks in a checkout design.

## Phase 1 — closed beta (London), invite-only

Goal: real activity from real users; kill the dead-marketplace first
impression before anyone pays.

- Invite from the waitlist in batches, supply side first at roughly 2–3:1
  before opening demand-side invites.
- Personally onboard the first ~100 supply-side users (concierge profile
  help, photo guidance). Slow, unscalable, and exactly what makes early
  profiles credible. These users become the referral seed.
- Weekly activity email ("new members near you", "X liked you" digest) using
  the existing notifications infrastructure — beta users must have a reason
  to return before messaging ships.
- Measure: activation (photo + complete profile), D7 return, first-search
  results count, supply/demand ratio. These numbers decide when Phase 2
  opens, not the calendar.

## Phase 2 — open launch (London), the PR moment

Goal: one coordinated attention spike, converted into the owned funnel.

- Open self-serve signup for London. Everything in the launch story funnels
  to signup or waitlist-for-your-city.
- The launch story (see channels.md #2): UK-built, age-verified,
  safety-first entrant in a category the app stores and ad platforms have
  abandoned — that framing is itself newsworthy and differentiating.
- Same week: affiliate listings go live (#3), X organic + small paid test
  (#5), first ad-network test (#4) if attribution is proven.
- Founding-member premium unlocks for waitlist converts.
- Not Product Hunt / Hacker News — wrong audience and assured hostile
  comments; UK press and category review sites are our equivalent.

## Phase 3 — city expansion + steady state

- Expansion trigger: London hits liquidity threshold and a second city's
  waitlist crosses a set size; repeat Phase 1→2 per city with the playbook,
  compressing each time.
- Steady-state cadence: every later product milestone (messaging, token
  economy, secret album) is re-launch material — announce to list, press
  where it carries a story, changelog always.
- Annual data report (channels.md #2) becomes the recurring PR tentpole once
  the user base supports honest aggregate stats.

## Measurement

Per channel, one funnel, all in Postgres: visit (UTM) → waitlist/signup →
activated profile (photo + role + city) → D7 return → (later) first purchase.
Judge channels on cost per **activated supply-side profile in a target
city** — not clicks, not raw signups. Kill anything that can't be attributed.

# Acquisition channels

Organised according to the playbook in [lessons-learned.md](lessons-learned.md)
(the Secret Benefits quiet-growth model), which governs this document — and
structured around the fact that this is a two-sided marketplace. Evidence
base: [case-studies/](case-studies/README.md).

## One funnel, two audiences (read first)

The affiliate/review ecosystem serves both sides of the marketplace, not
just the paying one. Prospective supply-side members google their way in
exactly like demand-side members do — "best sugar dating sites", "how to
find a sugar daddy", "is X legit" — and land on the same listicles, which
maintain "best for sugar babies" sections and sugar-baby-guide content for
precisely that audience. For the supply side the listicles answer the
question that matters most to them: where are the paying members actually
active? The traffic skews male (audience panels for the category leader
suggest roughly 75/25), but the female quarter of several million monthly
visits is a serious supply channel in its own right.

What differs per side is the economics, not the funnel:

- **Demand side:** CPA on credit purchases — affiliate incentives aligned
  with real revenue.
- **Supply side:** supply-side profiles are free, but realistically we must
  pay for them too — verified female activations are the scarce resource,
  and dating-vertical affiliates expect per-lead rates for them (gender- and
  geo-tiered CPL is industry standard). The danger is that paying per free
  signup is the strongest possible incentive for affiliates to manufacture
  fake women, so the payout is gated, not withheld: payable only on video
  verification plus an activity window (e.g. still active at day 30),
  delayed payout, clawbacks, per-affiliate caps, and manual sampling.
  Verification-by-default (#10) is the payment gate. Price the bounty from
  demand-side math: if an active verified London profile drives £X of
  credit purchases over six months, a defensible CPL is a fraction of £X.

The dedicated supply-side channels below are not there because listicles
can't deliver women — they can — but because they are **city-targetable**
and the national affiliate channel isn't. Referral, local content, and
student media can concentrate supply in London for launch density;
listicle traffic lands wherever it lands.

## Primary channel — both sides

### 1. Affiliate / review-site ecosystem (borrowed)

The "best sugar dating sites" listicle ecosystem owns the category's money
keywords, and a top-3 global player was built on it with zero earned media.
We buy distribution here rather than fighting for it ourselves.

- Get listed in the listicles that already rank, prioritising UK-facing
  review/comparison sites — a smaller pond than the US ecosystem Secret
  Benefits rides, so early placements are winnable.
- Run the programme direct/invite-only, not on public CPA network rate
  cards; manual approval, small first cohort (3-5 partners), expand slowly.
- Payouts per "One funnel, two audiences": demand-side CPA on credit
  purchases plus gated supply-side CPL on verified, active female profiles.
- Equip affiliates for the supply-side audience explicitly: creatives and
  talking points for their "for sugar babies" sections, and a listing that
  answers supply-side questions (free membership, video verification,
  safety practices). Track supply-side signups and verification rates per
  affiliate — a partner delivering real verified women earns placement
  upgrades and better terms; one delivering unverifiable signups gets
  clawbacks and the door.
- Finding quality partners: reverse-engineer rather than cold-search — run
  the money keywords and treat every ranking page as a candidate; pull
  competitors' referring domains (Ahrefs/Semrush) and see who carries their
  tracking links. Quality signals: real organic rankings, meaningful UK
  traffic share, ASA-compliant ad disclosure, willingness to sign the
  creatives clause, no fake-review farming. This is a relationship
  business: an experienced dating-vertical affiliate manager is the
  highest-leverage marketing hire in the plan, and deal flow happens at the
  industry's events (Affiliate World, TES).
- Approved-creatives clause, actively enforced — rogue affiliate copy is an
  ASA liability that attaches to us, and this vertical's affiliates keep
  publishing fake-fresh reviews of dead brands. Police it continuously.
- First steps: ref-code attribution into Postgres, payout terms defined
  (both sides), top-10 UK review-site shortlist, affiliate agreement
  drafted with the creatives clause and the supply-side payout gates.

## Demand-side channels

### 2. Switcher-targeting SEO (owned)

Dating users multi-home, and switchers tolerate small platforms — they add
a new site to their rotation rather than demanding it replace anything.
That makes them the cheapest demand to convert and the kindest to a
low-density launch.

- Comparison/alternatives pages ("alternatives to Seeking", "X vs Y")
  catching high-intent users who already know the category.
- These are affiliate-style content we own — same keywords the affiliates
  fight over, captured directly where we can rank.

### 3. Dating-friendly ad networks (rented; vetted placements only)

Networks serving adult and dating inventory accept the category and offer UK
geo-targeting: ExoClick, TrafficStars, Adsterra-class display and push
networks, plus native networks with dating verticals.

- Placement quality is vetted, not bought blind: no escort-adjacent or
  sex-work-adjacent placements, even where they convert — the positioning
  and legal risk outweighs the traffic.
- Expect low CPCs, low conversion, and a real bot problem; measure to
  activation and first purchase before scaling.
- First steps: one network, one UK campaign, £500-1k test budget, strict
  attribution.

### 4. X (Twitter) (rented)

Dating ads are permitted with restrictions, and organic policy tolerates the
category. Low-key functional organic presence plus a small paid test.
Expect policy volatility; never a single point of failure.

## Supply-side density layer

City-targetable supply acquisition — how we concentrate verified women in
launch cities, which the national affiliate channel cannot do.

### 5. Referral loops (owned)

- Two-sided incentives (premium credit both ways) designed for private 1:1
  sharing — link/code, never social broadcast; nobody advertises membership
  of this category on their feed.
- The concierge-onboarded founding cohort ([launch-plan.md](launch-plan.md)
  Phase 1) is the seed; referral is how supply compounds city by city.

### 6. Trust and safety content (owned)

The cautious end of the supply side arrives through questions: is it safe,
is it legal in the UK, how do first meetings work, how do I avoid scams.

- Honest, safety-forward guides targeting those informational queries —
  ranking for them builds exactly the trust that converts the cautious side
  of the marketplace, and doubles as Online Safety Act-aligned messaging.
- City pages live here too (cheap, UK-tractable, feed launch-city density).

### 7. Student media and student-city targeting (rented)

The supply side skews toward university students funding their studies —
see "The student demographic" in [README.md](README.md) for the guardrails
(18+ placements, agency framing, dating proposition in creative). The
RichMeetBeautiful case study maps the criminal line precisely; our copy
never goes near debt-relief framing.

- University student papers/sites and student-focused publishers with
  verified adult audiences accept ads mainstream platforms won't; pitch
  several, expect refusals and the occasional ASA complaint (priced in).
- Time pushes to term rhythm (freshers period, January); layer student-city
  geo onto ad-network tests (#3) and podcast picks (#8).

### 8. Podcast and newsletter sponsorships (borrowed; pick shows per side)

Host-read ads carry implicit host endorsement, and audience gender skew is
knowable per show — so this channel serves whichever side the show serves.
Female-skewed dating/relationships/lifestyle podcasts are a rare paid
supply-side channel that can also be city-skewed; male-skewed shows serve
demand. Unique promo codes per show for attribution. Acceptance is
host-by-host; expect refusals.

## Brand and cross-side infrastructure

### 9. Brand-harvest SEO (owned)

Secret Benefits does not rank for non-brand terms; its affiliates do, and it
harvests the branded demand they create. We copy that inversion.

- Own every navigational SERP for our name before anyone else does: brand,
  "brand login", "brand review", "is brand legit", "brand app" — live from
  launch.
- The brand name itself is channel infrastructure: memorable, clean,
  spellable, free of category keywords that inherit platform risk.
- KPI: monthly branded search volume — the signal that affiliate spend is
  compounding into brand equity rather than accruing only to affiliates.

### 10. Product-led trust (owned; underpins both sides)

- Visible verification badge (video selfie), surfaced in search results and
  profiles — converts the category's scam anxiety on both sides, gates the
  supply-side affiliate payout, and doubles as OSA groundwork.
- Free for the supply side; credits (not subscriptions) for the paying side.
- Discretion features (secret album, private profiles) as the brand promise.

### 11. Press: reactive capability plus an optional annual report (borrowed; downgraded)

We do not launch or grow via PR under this playbook, but a UK company cannot
be anonymous (see [founder-anonymity.md](founder-anonymity.md)), so
journalists will find us — the choice is answering well or stonewalling
badly.

- Maintain: press kit page, media@ address, a designated spokesperson (not
  the founder) with prepared lines for the hostile version of every
  category story — the student angle first.
- Option, post-scale: an annual UK data report with fact-checkable numbers
  only — the proven mechanic (Seeking, Ashley Madison) without the
  provocation. A hedge against affiliate-channel concentration.

### 12. Reddit / forums / communities (rented, organic only)

Participate honestly (flagged affiliation) where subreddit rules allow.
High effort, modest reach; useful for early qualitative feedback and for
seeding honest answers on the "is brand legit" queries we want to own.

## Not in this playbook

- **OOH/billboards.** A loud-playbook tool with the worst risk profile in
  our category (see richmeetbeautiful.md); excluded by lessons-learned.md.
- **Stunt/outrage marketing and engineered ad rejections.** Same exclusion,
  same evidence.
- **Ungated supply-side bounties.** We do pay for supply-side activations —
  but never on raw signups. No verification event, no activity window, no
  payout. This is the fraud line that keeps the fake-profile poison out.

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

Metrics, per side (per lessons-learned.md):

1. **Supply side:** cost per activated, verified supply-side profile in a
   target city (the same event the affiliate CPL pays on).
2. **Demand side:** cost per activated demand-side profile and per first
   credit purchase.
3. **Brand:** monthly branded search volume for our name.

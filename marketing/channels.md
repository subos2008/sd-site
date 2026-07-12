# Acquisition channels

Ranked by expected long-run contribution given the constraint landscape in
[README.md](README.md). The ORB framing: build **owned** channels (SEO
content, email list, the PWA itself) as the destination; use **rented**
channels (X, Reddit, ad networks) and **borrowed** channels (affiliates, PR,
podcasts) to fill them.

## Tier 1 — build from day one

### 1. SEO and content (owned; the workhorse)

Every incumbent in this vertical is SEO-heavy because paid mainstream channels
are closed. This is the compounding asset.

- **Programmatic city/local pages.** "Dating in London / Manchester / Leeds…"
  pages backed by real (anonymised, aggregate) profile counts once we have
  them. UK-first gives a tractable page set (~50–100 towns/cities).
- **Informational content.** The category has enormous question-shaped search
  volume (what is it, is it legal in the UK, safety, first-meeting advice,
  allowance norms). Honest, safety-forward answers rank and also build the
  trust the brand needs.
- **Comparison/alternative pages.** "X vs Y", "alternatives to Seeking" —
  high-intent traffic from people already convinced of the category, only
  choosing a provider.
- First steps: keyword map (UK geo + informational + comparison), publish the
  blog on the main domain (`/blog` or `/guides`, not a subdomain), ship
  city landing pages as a template early even with thin launch-city data.
- Expectations: 6–12 months to meaningful traffic; the moat thereafter.

### 2. Digital PR / earned media (borrowed; the category superpower)

Sugar dating is press catnip; the category leader was substantially built on
it. UK tabloids and mainstream outlets cover this category eagerly.

- **Data-driven PR.** Once there's a user base: aggregate, anonymised stats
  (average allowance by city, demand by region, behavioural trends) packaged
  as an annual report. Journalists reprint these endlessly; each pickup is a
  branded backlink that feeds channel 1.
- **Founder availability.** A named spokesperson willing to do interviews and
  defend the model articulately. Controversial-but-legal categories get
  disproportionate coverage per pound spent.
- **Newsjacking.** Comment quickly (via a PR wire or direct journalist
  relationships) whenever dating economics, cost-of-living-and-relationships,
  or dating-app-fatigue stories run.
- Constraint: prepare lines for the hostile version of every story. The
  students-funding-their-studies angle is the one journalists will reach for
  first — engage it honestly with the guardrails in README.md ("The student
  demographic") rather than dodging it.
- First steps: press kit page, media@ address, one launch story ("the
  UK-built, safety-first entrant — age-verified, no app-store data games"),
  pitch list of UK journalists who cover dating/tech/relationships.

### 3. Affiliate / partner traffic (borrowed; how this vertical actually buys traffic)

Dating is one of the largest affiliate verticals; the infrastructure exists
precisely because mainstream ads don't work here.

- **Dating review/comparison sites.** UK-facing "best sugar dating sites"
  pages convert extremely well; get listed, then pay per lead or per signup.
- **CPA networks with dating verticals** (e.g. CrakRevenue and similar) give
  reach into hundreds of small publishers without one-by-one deals.
- Pay-per-lead (double-opt-in email) or pay-per-sale once payments exist.
- Non-negotiable: approved-creatives-only clause, and actually police it.
  Rogue affiliate copy is the top cause of platform bans and bad press.
- First steps: pick affiliate tracking (even a simple ref-code + Postgres
  attribution table before adopting a platform), define payouts, approach the
  top 10 UK-relevant review sites directly.

## Tier 2 — test with small budgets once Tier 1 is moving

### 4. Dating-friendly ad networks (rented; the paid channel that is open)

Networks serving adult and dating inventory accept the category and offer UK
geo-targeting: ExoClick, TrafficStars, TrafficJunky, Adsterra-class display
and push networks, plus native networks with dating verticals.

- Traffic quality is far below Meta/Google; expect low CPCs, low conversion,
  and a real bot problem. Run with strict attribution and treat as
  performance arithmetic: cost per activated profile, per side of the
  marketplace.
- Creatives must match landing pages and our positioning discipline.
- First steps: one network, one UK campaign, £500–1k test budget, measure to
  activated-profile level before scaling.

### 5. X (Twitter) — the one big platform partially open (rented)

Dating ads are permitted with restrictions, and organic policy tolerates the
category. Worth both an organic presence (brand voice, dating-culture
commentary, PR amplification) and a small paid test. Expect policy volatility;
never make it a single point of failure.

### 6. Podcast and newsletter sponsorships (borrowed)

Host-read ads on dating/relationships/lifestyle podcasts and paid slots in
dating-culture newsletters. Sponsorship acceptance is host-by-host — many will
decline, some won't; each yes delivers an engaged audience with implicit host
endorsement. UK podcast ad rates are reasonable at the mid-tail. Use unique
promo codes for attribution.

## Tier 3 — situational

### 7. Referral programme (owned/product-led)

Two-sided referral once messaging exists (invite → premium credit for both
sides). In this category people don't broadcast membership, so expect lower
K-factor than mainstream apps — design for private 1:1 sharing (link/code),
not social-feed sharing.

### 8. Out-of-home and print (rented)

Dating brands use OOH heavily precisely because digital is closed. Realistic
for us post-launch in one city (London) as a PR-multiplier: a witty,
ASA-cleared campaign generates earned coverage worth more than the media
spend. Expect TfL and some media owners to refuse the category; billboards,
taxis and lifestyle print are more accepting. Not a performance channel —
don't measure it like one.

### 9. Student media and student-city targeting (rented)

The supply side skews toward university students funding their studies —
see "The student demographic" in [README.md](README.md) for the guardrails
(18+ placements, agency framing, dating proposition in creative).

- University student papers/sites and student-focused publishers with
  verified adult audiences accept ads mainstream platforms won't; acceptance
  is editor-by-editor, so pitch several.
- Time pushes to term rhythm: freshers period and January (post-Christmas,
  pre-loan-instalment) are when the audience is most reachable — reachable,
  not desperate; keep the copy on the right side of that line.
- Layer geography onto other channels: student-heavy postcodes for OOH (#8),
  student-city geo-targeting in ad-network tests (#4), student-life podcasts
  in #6.
- Expect some placements to be refused and the occasional complaint to the
  ASA; that's priced in, per README.

### 10. Reddit / forums / communities (rented, organic only)

Participate honestly (flagged affiliation) where subreddit rules allow;
sponsor AMAs rather than astroturfing. High effort, modest reach, but good
for early qualitative feedback and SEO-adjacent brand searches.

## Channel → funnel wiring

Whatever the channel, the destination is owned:

- Every channel lands on the site with UTM/ref attribution captured into
  Postgres at signup (add `acquisition_source` to profiles early — it's a
  one-column migration now, an unanswerable question later).
- Pre-launch, everything points at the waitlist (email capture) — see
  [launch-plan.md](launch-plan.md).
- Email is the retention channel: onboarding sequence, "X liked you" digests
  (already have the notifications infrastructure), win-back. The list is the
  only audience no platform can take away.

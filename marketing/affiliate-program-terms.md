# Affiliate program terms — draft v0 and sanity check

Drafted 2026-07-17. Answers the third question in the Brooks outreach
("a sanity check on our program terms") from our own analysis: since no
terms existed yet, this proposes v0 and stress-tests it against the
verified benchmarks in [partner-space.md](partner-space.md). Interacts
with spec 100 (attribution build) and Plan 04 (token pricing). Nothing
here is offered to a partner until the founder signs it off.

## Proposed terms (v0)

- **Model:** lifetime revenue share on all purchases by
  partner-attributed users, calculated net of refunds and chargebacks.
  No PPS and no demand-side CPL at launch (no cash before revenue; CPL
  is also the category's fraud magnet).
- **Supply-side CPL — revised 2026-07-17, founder decision pending:**
  the supply-side research ([supply-side-channels.md](supply-side-channels.md))
  found the category's proven supply mechanism is a small per-registration
  payment (~$2–4 market rate: SugarDaddyMeet $2/confirmed reg, Seeking $2
  CPL) — and at that rate the cash exposure is bounded (500 verified
  female activations ≈ £1–2k). Option on the table: pay a
  **verification-gated supply-side CPL** (only on activated, verified
  female profiles — our verification gate is the anti-fraud control),
  capped monthly. This reverses v0's blanket no-CPL for the supply side
  only; it is the one upfront cash outlay in the model.
- **Base rate: 50%.**
- **Founding-partner premium: 65% for the first 6 months** of the
  program, locked to the first handful of signed partners. Positioned
  above Seeking's alleged in-house 45% (unverified) and inside the
  market's "up to 80%" ceiling (LoveRevenue) without giving the ceiling
  away permanently.
- **Both-sides premium:** the 65% rate *continues past the launch
  window* for any partner sustaining a supply-side delivery threshold
  (N verified, activated female profiles per month — N set from beta
  data). This is the mechanism that pays for supply-side delivery out
  of revenue rather than cash: a pure consumer revshare pays £0 for
  female signups, so the premium tier is what makes both-sides delivery
  worth a partner's while.
- **Attribution:** ref-code capture at first visit, 30-day cookie
  window, last-click, lifetime attach at account creation (the account,
  once attributed, stays attributed). Postback/S2S supported if the
  partner requires it (spec 100).
- **Payouts:** monthly, NET-30, £50 minimum, to bank or the processor's
  partner-payout rails if available. (Competitive weakness vs
  LoveRevenue's Net-15 twice-monthly — acceptable while cash is tight;
  revisit post-launch.)
- **Compliance:** approved creatives only (contractual, enforced);
  clawback for fraud/incentivised signups; partner-visible reporting
  with an audit right (spec 100).

## Sanity check against the benchmarks

**1. The $140-per-sale problem.** Seeking pays affiliates a flat ~£110
per first sale via CrakRevenue. At our expected average transaction of
£20–40, a referred payer must spend roughly **£170–£220 lifetime** for
our 50–65% revshare to out-earn that bounty — i.e. repeat-purchase
5–10 times. Pre-beta we cannot prove retention, and affiliates will
discount our claims to zero. Consequences:

- **Media buyers are unreachable at launch** — they need fast fixed
  bounties to recycle into ad spend. Accept this; do not bid for them.
- **SEO/content owners are the fit** — their marginal cost per click is
  ~zero, so lifetime revshare compounds for them with no new work. The
  economics of our offer *self-select the partner class we ranked first*
  (review-site owners, partner-space.md) — the model and the target are
  coherent.
- After beta, real conversion/retention numbers (shared under NDA)
  become the pitch's load-bearing evidence. Until then the draw is the
  founding rate + uncontested shelf position.

**2. Differentiation holds.** Secret Benefits (the closest comp) offers
CPA+CPL only, no revshare. A lifetime-revshare program in this exact
category is genuinely unoffered shelf space — v0's structure is not
me-too. (Re-verify Seeking's alleged 45% in-house revshare before using
"we beat Seeking's rate" in any pitch.)

**3. Margin check on 65%.** High-risk processing will cost roughly
10–15% of revenue; 65% revshare + ~12% fees leaves ~23% gross on
referred revenue during the premium window. Thin but survivable —
because it applies only to referred users, only during the window or
while the both-sides threshold is met, and buys distribution we
otherwise cannot afford. Do not go above 65% without beta LTV data; 80%
would be underwater after fees for no strategic gain.

**4. Chargeback interaction.** Net-of-chargebacks plus NET-30 monthly
payout gives a natural buffer: most friendly-fraud disputes surface
within the payout lag. Keep a clawback clause for disputes arriving
after payout.

**5. Open items before any partner sees this:**

- Founder sign-off on rates and the 6-month window.
- N (supply-side threshold) — needs beta activation data; leave
  bracketed in early conversations.
- Cookie window and last-click vs first-click — confirm against what
  candidate partners' tracking stacks expect (ask in first calls).
- Whether the chosen processor's partner-payout rails change the payout
  mechanics (underwriting pack, section 7).
- Token pricing (Plan 04) moves every number here; re-run the maths
  when prices are final.

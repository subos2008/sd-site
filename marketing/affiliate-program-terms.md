# Affiliate program terms — draft v1 and sanity check

Drafted 2026-07-17; revised same day after the founder called out the
rev-share anchoring: the market runs on payout MENUS (LoveRevenue:
revshare OR PPS OR CPL; MySugarDaddy: CPA/revshare/hybrid; Seeking:
$2 CPL + 45% hybrid), and our real constraint was never "revshare" — it
is "payouts funded by realized revenue, cash exposure bounded". v1
reframes the program accordingly. Benchmarks from
[partner-space.md](partner-space.md), [uk-review-sites.md](uk-review-sites.md),
[supply-side-channels.md](supply-side-channels.md). Interacts with spec
100 (attribution) and Plan 04 (token pricing). Nothing here is offered
to a partner until the founder signs it off.

## Governing principle

Every payout is funded from **attributed realized revenue** (net of
refunds and chargebacks), and total monthly cash exposure is **capped**.
The instrument varies by partner; the principle does not. The one
deliberate exception is the small supply-side CPL (below), which is the
model's single upfront cash outlay and is capped and verification-gated.

## The menu (consumer side)

Partners choose the structure that fits how they operate. Same
principle, different risk allocation:

| Option | Terms (v1 draft) | Who it fits | Risk allocation |
|---|---|---|---|
| A. Lifetime revshare | 50% base; **65% founding premium** (first 6 months / first partners; continues while a supply-side delivery threshold is met) | SEO/review/content owners (zero marginal cost, long-tail mindset) | Partner carries LTV risk; our downside ~zero |
| B. Hybrid | Small CPL (~£2, confirmed+verified registrations) + 35–40% revshare tail | The category convention (Seeking's shape); partners wanting some immediate signal | Shared |
| C. Capped CPA per sale | Bounty ≈ first-purchase value (£20–40), optionally laddered: further milestone bounties released as attributed spend realizes | Partners who insist on bounties; keeps us cash-safe because the bounty never outruns realized revenue | We carry conversion risk per sale, bounded |

**Not offered at launch:** big-bounty CPA at the market's $140-class
rates — that is fronting unproven LTV, and it is the one instrument we
genuinely cannot afford until beta retention data exists. Media buyers
who need it are explicitly out of scope for launch.

## Supply side

- **Verification-gated supply-side CPL** at the market rate (~£2–4 per
  **activated, verified female profile** — market benchmarks:
  SugarDaddyMeet $2/confirmed reg, Seeking $2 CPL), monthly cap,
  clawback on fraud. Bounded cash (~£1–2k per 500 profiles), the
  category's proven supply mechanism, and our verification gate is the
  anti-fraud control the original channels.md design called for.
  Founder decision pending — this is the model's only upfront cash.
- Alternative/complement: menu option A's premium tier conditioned on
  supply-side delivery (pays for supply from revenue instead of cash).

## Common terms (all options)

- **Attribution:** ref-code at first visit, 30-day cookie, last-click,
  lifetime attach at account creation; postback/S2S supported (spec
  100). The contract and the implementation must agree.
- **Payouts:** monthly, NET-30, £50 minimum. (Weaker than LoveRevenue's
  Net-15 twice-monthly; acceptable while cash is tight.)
- **Compliance:** approved creatives only, enforced; clawbacks for
  fraud/incentivised signups; partner-visible reporting with audit
  right (spec 100).

## Sanity check

**1. The $140-per-sale problem (unchanged).** Seeking pays ~£110/sale
via CrakRevenue. At £20–40 ATV, option A out-earns that only if a
referred payer spends £170–220 lifetime — unprovable pre-beta, so
partners discount it. v1's answer is structural instead of
rhetorical: partners who won't carry LTV risk take option B or C
rather than walking. Post-beta, real retention data (shared under NDA)
re-prices everything.

**2. Differentiation still holds, reframed.** Secret Benefits offers
CPA+CPL only. Offering the full menu — including a lifetime-revshare
lane no sugar incumbent offers — is still unoffered shelf space, without
betting the program's identity on the least-liked instrument.

**3. Margin checks.** Option A at 65% + ~12% high-risk processing
leaves ~23% of referred revenue — thin, launch-window/threshold-gated
only; 65% is the ceiling. Option B's tail (35–40%) plus £2 CPL is
comfortably inside that envelope. Option C is margin-safe by
construction if the bounty stays ≤ first-purchase value; the ladder
must release strictly behind realized spend.

**4. Chargebacks.** Net-of-chargebacks + NET-30 gives a buffer window;
clawback clause for late disputes. Option C bounties follow the same
rule (a refunded first purchase claws back its bounty).

**5. Open items before any partner sees this:**

- Founder sign-off: the menu rates, the 6-month premium window, and
  the supply-side CPL yes/no.
- Supply-side threshold N and the monthly cash caps — bracket until
  beta data.
- Cookie window / click-attribution norms — confirm against candidate
  partners' stacks in first calls.
- Processor partner-payout rails (underwriting pack section 7).
- Token pricing (Plan 04) moves every number; re-run the maths when
  final.

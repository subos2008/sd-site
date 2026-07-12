# 020: Brand name and corporate structure

Status: not started. This spec is research-and-decision work, not code; the
output is two decisions (name, structure) plus the artefacts that implement
them. Professional advice is a required step, not an optional one — the
structure decision has tax consequences that this spec deliberately does
not resolve.

## Motivation

The brand name is on the critical path for nearly everything in
`marketing/`: affiliate listings, navigational SERP pages
(`channels.md` #9), the billing descriptor (chargeback design), the
waitlist landing page, and trademark/domain acquisition all block on it.
The corporate structure blocks payments onboarding (the acquirer
application fixes the legal-entity story) and determines how much founder
anonymity is actually achievable (`marketing/founder-anonymity.md`).
The two interact — the company name should be neutral and unconnected to
the brand — so they are one spec.

## Workstream 1: the brand name

Criteria, from `marketing/channels.md` and `lessons-learned.md`:

- No category keywords ("sugar", "arrangement", "daddy", etc.) — names
  that flirt with the keywords inherit the category's platform risk
  (Google Play banned by stated purpose; Seeking had to buy its way out of
  its own name).
- Memorable, spellable, sayable — the brand-harvest SEO model depends on
  people searching the name; branded search volume is a headline KPI.
- Works as a discreet billing descriptor (users must recognise it on a
  statement without it being embarrassing on one).
- .com available or acquirable; UK/EU trademark screen clean for the
  relevant classes (dating/social networking services).
- Compatible with whatever positioning we choose — positioning itself is
  an open decision; the case studies suggest unclaimed white space around
  verification/discretion, but the name should not lock us into one story.

Process: shortlist (10-20 candidates) → knockout screen (domain, trademark
databases, existing dating-industry use, unfortunate meanings) → check the
survivors against the billing-descriptor and SERP tests → decide.
Deliverables: the name, the registered .com (via a corporate registrar
with registrant withheld, multi-year, Cloudflare-fronted — the Secret
Benefits domain mechanics documented in `marketing/founder-anonymity.md`),
a trademark filing decision, and the neutral operating-company name.

## Workstream 2: corporate structure

The question: where to incorporate, and how anonymous the founder can be.
We do NOT have to be a UK-registered company to serve UK users. The
category's observed norm is offshore: Secret Benefits operates as Digital
Barter Limited (Cyprus); WhatsYourPrice/MissTravel bill through W8Tech
Cyprus Limited; RichMeetBeautiful ran through Digisec Media (Malta/Cyprus).
The clustering is partly a payments decision — the high-risk acquiring and
adult-billing ecosystem concentrates in Cyprus/Malta.

Facts that hold regardless of jurisdiction (verify with counsel, but these
frame the decision):

- **UK regulatory exposure follows the users, not the registration.** OSA
  duties, ICO/UK GDPR, and ASA jurisdiction over UK-targeted ads apply to
  an offshore company serving the UK exactly as to a UK one.
- **Tax follows management and control.** A company managed and controlled
  from the UK by a UK-resident founder is generally UK tax-resident
  wherever incorporated; incorporating offshore does not reduce UK tax for
  a UK-based founder without real substance abroad. Privacy structuring is
  legitimate; concealing income or control from HMRC is evasion. Anti-
  avoidance rules (transfer of assets abroad, etc.) apply to UK residents
  with offshore structures and need professional advice.
- **Counterparties see through everything.** Acquirers, banks, and PSPs
  perform beneficial-owner KYC regardless of public registers. The
  anonymity at stake is public-register anonymity (doxxing protection,
  casual discovery), never anonymity from the state or processors.
- **Companies House quirk to verify:** an overseas company generally only
  registers at Companies House (disclosing directors) if it has a UK
  establishment (a physical place of business); a web business with no UK
  premises may avoid UK public registration entirely while still being UK
  tax-resident and HMRC-registered. Confirm with counsel.

### Options to price and compare

**A. UK Ltd (baseline).** Neutral company name, agent registered office,
service addresses. Founder's name public at Companies House (ECCTA
identity verification now mandatory); PSC register discloses >25% owners.
Cheapest, simplest, most trusted by UK counterparties; least anonymous.

**B. Cyprus (or Malta) company.** Nominee/professional directors are legal
and routine; the public registry shows the nominees; beneficial-owner
register access is restricted (no longer public after the 2022 CJEU
ruling). Colocated with the vertical's acquirers and corporate service
providers who understand the business. Costs: formation plus ongoing
service-provider, accounting, and (if pursuing non-UK tax residency)
substance costs; banking is slower; UK tax advice essential for a
UK-resident founder.

**C. Hybrid.** E.g. offshore operating/billing company with the founder
engaged as a contractor/consultant, or a UK service company alongside an
offshore opco. More moving parts, more advice needed; sometimes what the
payments providers themselves suggest for the vertical.

### Decision criteria

Public anonymity gained; total annual cost (formation, agents, accounting,
advice); acquirer acceptance in this vertical (ask the candidate
processors which structures they onboard fastest — this may decide it);
tax compliance complexity for a UK-resident founder; and how much of any
trust story we are comfortable carrying in the product rather than the
corporate registration.

### Process

1. Get quotes and structure proposals from two Cyprus/Malta corporate
   service providers (the ones the dating/adult vertical actually uses)
   and one UK accountant with offshore experience.
2. Ask candidate high-risk acquirers (the payments workstream) which
   entity structures they prefer — run these conversations together.
3. UK tax advice on the founder's position under each option.
4. Decide; incorporate; open banking/PSP onboarding.

## Interactions

- `marketing/founder-anonymity.md` — the posture doc; updates with the
  decision.
- The payments/high-risk-processor workstream (`marketing/README.md`,
  `lessons-learned.md`) — same counterparties, same timeline; do together.
- Spec 010 and the token-economy plan are downstream of the billing
  descriptor and entity decisions only loosely; they need not block.

## Open questions (suggested defaults)

1. How much annual cost is the anonymity worth? Default: get the real
   quotes before deciding; if the delta is small relative to payments
   costs, option B is the category norm for a reason.
2. Trademark: file at decision time or defer? Default: file UK at least —
   it is cheap relative to the cost of losing the name later.
3. Who is the second human (nominee arrangements still need a real
   controlling mind for KYC)? Default: founder remains the KYC'd UBO
   everywhere private; no public role.

## Acceptance criteria

- A chosen brand name with the .com registered (registrant withheld,
  multi-year, Cloudflare-fronted) and a trademark decision recorded.
- A chosen corporate structure with professional advice documented, the
  entity formed, and the founder's tax position confirmed in writing by an
  adviser.
- `marketing/founder-anonymity.md` updated from "open decision" to the
  chosen position.
- The acquirer application can name its merchant entity.

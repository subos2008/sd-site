# September 2026 launch plan

Master schedule for the MVP launch. This is the coordination document that
answers "what do we need to do next / today": it sequences the build plans
(`docs/superpowers/plans/`), the execution specs (`execution/`), the design
spec's pre-launch checklist (spec section 10), and the marketing phases
(`marketing/launch-plan.md`) onto a calendar with a critical path.

**How to use it:** ask Claude "what's next for launch?" — it should read this
file plus `execution/README.md` and `docs/superpowers/plans/README.md`, and
answer from the "This week" section and the timeline. Update the "This week"
section and the workstream statuses as things complete; log date slips in the
decisions log at the bottom.

Authored 2026-07-17. Dates below are week-commencing (Mondays).

## What "September launch" means

Founder's definition (2026-07-17): **everything in place to go live with
marketing partners when students get to uni.** That fixes the date to the
freshers window, which is external and does not move:

- Scottish universities: welcome weeks from ~7 Sep
- Most English universities: students arrive w/c 14 Sep and 21 Sep

**The partner model (decided 2026-07-17, refined same day):** there is
no marketing budget until there is revenue, so the governing principle
is **partner payouts funded from attributed realized revenue, with cash
exposure capped** — not any single payout instrument. The program offers
the market's standard menu (revshare / hybrid CPL+revshare / capped CPA
per sale — see `marketing/affiliate-program-terms.md`); big prepaid
bounties are the only thing off the table until beta LTV data exists.
Research also showed a single both-sides partner is unlikely to exist:
plan for separate demand-side deals (UK review-shelf sites) and
supply-side deals (sugar-baby content ecosystem + small
verification-gated CPL). Consequences:

- **Payments are launch-blocking.** A revshare partner will not send
  consumer traffic until checkout works; there is no revenue to share
  without it. The previous "launch free, flip payments later" fallback is
  dead for the demand side.
- **Rev-share attribution and reporting are launch-blocking.** No partner
  takes revshare on trust: click/ref → signup → token purchase → partner
  statement (net of refunds and chargebacks — dating chargeback rates make
  this clause non-optional) must be built, provable, and in the contract.
- **Paid supply-side CPL is dropped** (it was the cash-burning channel).
  Supply density comes from the partner's supply-side audiences plus our
  own free machinery: concierge onboarding, referral codes, student media
  only where it costs ~nothing or the partner runs it.

Therefore the dates:

- **Mon 14 Sep — launch, London.** Self-serve signup open; partner traffic
  switches on. If payments slip (see risks), the structured fallback is a
  **supply-first launch**: free supply-side channels go live on 14 Sep to
  capture the freshers window (which is a supply-side window — students
  are the supply side and that half needs no payments), and the partner's
  consumer-side traffic switches on the day payments + attribution are
  live. The freshers window is captured either way; only revenue start
  moves.
- **Fri 28 Aug — partner-ready gate.** Rev-share agreement(s) signed,
  tracking proven end-to-end in beta, creatives approved, placements
  scheduled.
- **Mon 17 Aug — closed beta opens.** Four weeks of invite-only, London,
  supply-side-first, concierge-onboarded density building.

**The date is calendar-gated, not metrics-gated.** Missing freshers means
waiting until January for a comparable supply-side moment, so the date
holds and scope flexes. Beta metrics inform how hard partner consumer
traffic runs at launch, not whether we launch.

## Critical path

**Chain 1 — entity → payments → revenue (THE critical path, external,
start NOW):** brand + corporate-structure decision (spec 020, professional
advice required) → incorporate + open bank account → high-risk acquirer
application (Segpay / CCBill / Verotel class, MCC 7273) → underwriting
(typically 4–8 weeks; wants a live site, ToS, privacy policy) → live
payments → partner consumer traffic can start. Application in by ~7 Aug is
a coin flip for 14 Sep. Now that payments gate revenue AND the partner
deal, this chain gets every accelerant we have: underwriting pack prepared
in parallel starting now, two applications run concurrently if terms
allow, and the jurisdiction decision weighs **speed to a bank account and
acquirer** against name-anonymity (see workstream A — the offshore route
is slower to set up; this trade-off is the central question for the
solicitor consultation).

**Chain 2 — partner deal:** spec 030 outreach (reframed: launch partner
with existing dating traffic, not a hire) → shortlist → rev-share terms +
approved-creatives clause negotiated → tracking integrated and proven in
beta → signed by 28 Aug → traffic on 14 Sep (consumer side gated on
payments). Partner relationships have the longest human lead time we
control; outreach starts this week.

**Chain 3 — brand → domain → waitlist:** brand knockout screen (020) →
domain purchased (corporate registrar, registrant withheld, Cloudflare) →
production infra → waitlist page live (no later than W/C 3 Aug) → beta
invites 17 Aug.

**Chain 4 — product build:** beta-entry set in 4 working weeks (by 14
Aug); revshare attribution (new spec 100) done and partner-verified by 28
Aug; everything else ships during beta.

## Workstreams

### A. Founder anonymity and corporate structure (spec 020)

The founder's name and home address must not be publishable from anything we
ship. Full detail in `marketing/founder-anonymity.md`; this is the action
list.

**One decision to make first, because it picks the jurisdiction:** is
keeping the founder's *name* off public registers a hard requirement, or
only the *address*? **New constraint from the partner model:** payments are
now launch-blocking, so incorporation/banking speed matters as much as
privacy.

- **Address privacy is fully achievable either way**: agent registered
  office + director service address means the home address never appears at
  Companies House or the ICO register. Table stakes; do it regardless.
- **Name privacy is NOT achievable as a UK company.** Director names and
  >25% PSC entries are public, ECCTA identity verification is mandatory,
  and nominee layering to defeat the PSC register is criminal evasion.
  A UK Ltd is, however, the FASTEST route to an entity + bank + acquirer
  application.
- **Name privacy IS achievable offshore** (Cyprus/Malta — the category
  norm, colocated with the high-risk acquiring ecosystem): EU
  beneficial-owner registers are no longer public post-2022 CJEU ruling,
  nominee directors are lawful and routine. Costs: setup/maintenance fees,
  intermediaries, **slower setup and banking**, and no change to UK
  obligations (OSA/ICO/ASA follow the users; a UK-managed company is
  generally UK tax-resident regardless).
- **The question for the solicitor this week:** can the offshore route
  produce a banked entity in time for a ~7 Aug acquirer application? If
  not, the choice is UK-speed-with-address-privacy vs
  offshore-name-privacy-with-a-later-revenue-start. Decide with dates
  attached, not in the abstract.

Checklist (jurisdiction-independent items can start immediately):

- [ ] Engage an accountant/solicitor who knows UK tax residence +
      offshore structures (books the decision; ask the speed question)
- [ ] Decide: UK-with-address-privacy vs offshore-with-name-privacy,
      priced in days-to-banked-entity
- [ ] Neutral operating-company name, unconnected to the brand
- [ ] Agent registered office + service addresses; home address appears
      nowhere, ever (also check historic exposure from any past companies —
      the expanded CH address-suppression regime can scrub old filings)
- [ ] Domain via corporate registrar (SafeNames class), registrant
      withheld, multi-year registration, Cloudflare-proxied from day one
- [ ] ICO registration under the company name + agent address
- [ ] No founder in site copy, PR, marketing, socials — the public human,
      if ever needed, is a designated spokesperson role (open item: who —
      note the launch partner may also front some public surfaces)
- [ ] Billing descriptor = neutral/brand name (part of acquirer setup)
- [ ] Trademark filed by the company, not the individual
- [ ] Generic support/press identities ("the [brand] team", media@)

### B. Payments (launch-blocking — gates revenue and the partner deal)

- [x] Underwriting pack drafted (2026-07-17):
      `docs/payments/underwriting-pack.md` — application-ready text for
      business description, processing profile, chargeback controls, and
      compliance posture. Open inputs: entity/brand/domain (spec 020),
      founder KYC docs + volume sanity-check, final price points (Plan 04)
- [ ] Shortlist high-risk processors (Segpay, CCBill, Verotel; ask
      candidate partners which acquirers they see work in this vertical —
      partner knowledge de-risks this pick)
- [ ] Run two applications in parallel if terms allow
- [ ] Application(s) submitted target ~7 Aug; chase weekly
- [ ] Real-provider integration behind `APP_CONFIG.payments.provider`
      (Plan 04 ships FauxProvider first, so code is not blocked)
- [ ] Test real card end-to-end on production before partner traffic
- Fallback if approval misses 14 Sep: supply-first launch (free side
  captures the freshers window); partner consumer traffic switches on the
  day payments + attribution are live. Revenue start moves; the window
  does not.

### C. Product build (chain 4)

Existing planned work, in execution order:

| Item | What | Needed by | Status |
|---|---|---|---|
| Spec 015 | Location gazetteer + autocomplete + metro distance | Beta (schema must precede real users) | Not started |
| Plan 04 | Token economy + FauxProvider | Beta (admin grants for testers) | To be written |
| Plan 05 | Messaging (text + photo) | During beta, before launch | To be written |
| Plan 06 | Secret album + read receipts | During beta, before launch | To be written |
| Spec 040 | PWA update path + manifest hardening | Beta (installed clients must update) | Not started |

New build items with no spec yet — write as execution specs 050–100:

| Proposed | What | Needed by |
|---|---|---|
| 050 | Age assurance (OSA, 18+ provider: Yoti/Persona/Veriff class) + identity/photo verification flow (video selfie → `verification_video`, admin review, badge). Verification-by-default is the beta trust story — beta-blocking. | Beta |
| 060 | Reporting + blocking flow, moderation queue (flip `media_items.status` default to `pending_moderation`), admin dashboard, rate limiting. Basic report/block by beta; full moderation by launch. | Beta / launch |
| 070 | Production deployment: AWS (S3 + CloudFront + Route 53 + ACM — the `spa-aws-deploy` skill scaffolds this), production Supabase project, Sentry (with the PII-scrubbing compliance follow-up from the global-error-surface spec), backups, uptime monitoring, incident runbook. | Waitlist page (W/C 3 Aug) |
| 080 | Waitlist landing page + invite gating: value prop, city selector, role selector, email capture, `acquisition_source` (UTM/ref) capture at signup, invite-code redemption for beta. | W/C 3 Aug |
| 090 | Transactional + digest email: provider selection (dating is a restricted category at some ESPs — verify acceptable-use before integrating), weekly activity digest on the existing notifications infra. | Beta |
| 100 | Partner rev-share attribution + reporting: ref codes → signup → activation → every token purchase attributed to partner; partner statement (revenue net of refunds/chargebacks); postback/S2S pixel support if the partner requires it; payout record-keeping. Extends Plan 04's ledger and 080's `acquisition_source`. A partner must be able to verify our numbers or the deal dies. | Partner-ready gate (28 Aug) |

### D. Compliance and legal

- [ ] ToS + privacy policy + cookie consent (needed for acquirer
      underwriting AND before beta users touch the site)
- [ ] Rev-share partner agreement: revshare %, cookie/attribution window,
      net-of-chargebacks clause, approved-creatives clause (rogue partner
      copy is the classic category self-injury), termination, reporting
      access. Get the template drafted with counsel alongside the 020 work.
- [ ] OSA: age assurance live (spec 050); illegal-content and children's
      access risk assessments documented; user reporting route (spec 060)
- [ ] ICO registration (under company, workstream A)
- [ ] GDPR review of OTEL/Sentry contents; Sentry PII scrubbing before any
      live deployment (flagged in the global-error-surface design doc)
- [ ] Security review / pen test before launch
- [ ] ASA/CAP check on all launch copy and partner creatives (agency
      framing, "dating" not "income", 18+ placements only)

### E. The launch partners (spec 030 — this IS the launch)

Two deal lanes, revenue-funded (a single both-sides partner is unlikely
to exist — research finding, 2026-07-17). The market intelligence lives
in four docs: `marketing/partner-space.md` (landscape, incumbent program
terms table, venues), `marketing/uk-review-sites.md` (demand-side shelf
owners + approach order), `marketing/supply-side-channels.md` (how
female signups are delivered), `marketing/affiliate-program-terms.md`
(our menu — founder sign-off pending).

- [x] Spec 030 reframed; space research done; candidate shortlist exists
      (2026-07-17 — see the four docs above)
- [ ] Outreach live: Mark Brooks emailed (draft in
      `marketing/outreach/2026-07-17-mark-brooks.md` + Gmail — founder
      sends); GDI London tickets (15–16 Sep, launch week); CrakRevenue
      advertiser conversation
- [ ] Demand lane: approach order datinghelp.co.uk (Webels ApS) →
      datingscout.co.uk → sugararrangement.net (uk-review-sites.md)
- [ ] Supply lane: sugar-baby content sites (SugarDating101-class) +
      decide the verification-gated supply-side CPL
      (affiliate-program-terms.md, founder decision)
- [ ] Founder sign-off on the program-terms menu before any partner
      sees numbers
- [ ] Tracking integration test with first partner during beta (spec 100)
- [ ] Signed deal(s) by Fri 28 Aug; placements/campaigns scheduled for
      14 Sep
- Our own free machinery still runs regardless of partners: concierge
  onboarding of the first ~100 supply-side users, referral codes,
  navigational SERP pages, trust/safety guides, press kit (reactive only)

## Timeline

Four working weeks to beta, eight to launch. The date holds; scope flexes.

**W/C 20 Jul — decisions week**
- Book the accountant/solicitor consultation; put the speed-vs-anonymity
  question (workstream A) at the top of the agenda
- Spec 020: run the brand-name knockout screen — name decided this week
  or early next
- Reframe spec 030 to the launch-partner model; start outreach
- Start the payments underwriting pack (workstream B) — needs no entity
- Write + start executing the Plan 015 gazetteer plan
- Draft execution specs 050–100

**W/C 27 Jul — entity week**
- Decide jurisdiction/structure with dates attached; begin incorporation
  + bank account
- Buy the domain (corporate registrar, withheld, Cloudflare)
- Spec 070 started: production infra build
- Execute Plan 04 (tokens + FauxProvider); finish 015
- Partner agreement template drafted with counsel; shortlist processors
  (ask partner candidates which acquirers work)
- Shortlist age-assurance provider

**W/C 3 Aug — production week**
- Spec 070 done: AWS + prod Supabase + Sentry (scrubbed) live
- Spec 080: waitlist landing page live on the real domain (hard date)
- Acquirer application(s) submitted (~7 Aug target)
- Execute Plan 05 (messaging); spec 050 build starts; spec 100 design
  agreed with lead partner candidate (their tracking requirements)
- ToS + privacy policy up

**W/C 10 Aug — beta-readiness week**
- Finish spec 050; spec 060 basic report/block; spec 040 PWA update path;
  spec 090 digest email; spec 100 build
- E2E pass on production infra; backup verification
- Concierge prep: invite list, photo guidance, verification script
- Beta go/no-go Fri 14 Aug against the beta-entry gate below

**Mon 17 Aug — closed beta opens (Phase 1)**
- Supply-side invites first (2–3:1 before demand side), concierge
  onboarding of the first ~100, weekly digest running
- Measure: activation (photo + verified + complete), D7 return,
  first-search result count, supply/demand ratio

**W/C 17 + 24 Aug — beta iterates, partner deal closes**
- Execute Plan 06 (secret album); moderation dashboard (060 remainder)
- Partner tracking (spec 100) proven end-to-end with real beta events;
  partner verifies our numbers
- Rev-share agreement signed; creatives ASA-checked and approved;
  placements scheduled
- **Fri 28 Aug — partner-ready gate** (see Gates)

**W/C 31 Aug + 7 Sep — launch-readiness**
- Fix what beta users hit; density push via concierge referrals
- SERP + comparison pages final; city pages ready
- Security review; chase acquirer underwriting weekly; supply-first
  fallback decision if approval hasn't landed by Fri 4 Sep
- Real card tested end-to-end on production the day payments go live
- Launch freeze W/C 7 Sep; final go/no-go Fri 11 Sep

**Mon 14 Sep — launch, London**
- Self-serve signup on; partner supply-side traffic on; partner consumer
  traffic on IF payments live (else the day they are); founding-member
  premium unlocks for waitlist converts
- No press push, no Product Hunt/HN; press kit stays reactive
- **Tue-Wed 15–16 Sep — GDI London Conference (Richmond)**: the dating
  industry's UK event lands in launch week; attend with a live product
  (see `marketing/partner-space.md`; book tickets in July)

**W/C 14 – 28 Sep — freshers campaign window**
- Partner campaigns running across both English arrival waves; partner
  creative audits + attribution integrity checks from day one
- Consumer traffic throttled to whatever density supports; supply-side
  at full tilt — that is what the window is for
- 25–28 Sep: TES Prague (the affiliate vertical's deal venue) — optional,
  for widening the affiliate pipeline with launch numbers in hand; the
  next TES is March 2027

## Gates

**Beta entry (Fri 14 Aug for Mon 17 Aug):** production deploy + domain
live; 015 gazetteer in; age assurance + verification flow working;
report/block exists; ToS/privacy up; PWA update path tested; invite gating
works; digest email sends. Payments NOT required (beta is free).

**Partner-ready (Fri 28 Aug):** rev-share agreement signed; spec 100
attribution proven end-to-end in beta and verified by the partner;
creatives approved and ASA-checked; placements scheduled for w/c 14 Sep.

**Launch (Mon 14 Sep — date holds, scope flexes):** messaging + tokens
live end-to-end; moderation queue operational; SERP + comparison pages
live; **payments live + real card tested** for consumer-side switch-on —
if not, supply-first launch is invoked explicitly and the consumer-side
start date is set with the partner.

## Top risks

1. **Acquirer underwriting misses 14 Sep** — now the #1 risk: it gates
   revenue and the partner's consumer traffic. ~7 Aug application is a
   coin flip. Mitigation: underwriting pack prepared now, parallel
   applications, partner-recommended acquirers, jurisdiction chosen with
   speed priced in; supply-first fallback protects the window itself.
2. **No partner signed by 28 Aug** — the launch definition fails.
   Mitigation: outreach this week; multiple candidates in parallel; the
   fallback is running the review-site affiliate motion ourselves on
   revshare terms (weaker, but the same deal shape).
3. **Jurisdiction decision stalls or offshore setup is slow** — chain 1
   queues behind it. Mitigation: consultation this week with the speed
   question explicit; be willing to trade name-privacy for revenue start.
4. **Partner distrust of our numbers** — revshare dies without credible
   attribution. Mitigation: spec 100 built early, partner verifies during
   beta, reporting access in the contract.
5. **Build crunch** — beta-entry set in 4 working weeks plus spec 100 by
   28 Aug. Mitigation: gate is minimal; 06 + moderation dashboard ship
   during beta; beta can slip to 24 Aug without moving 14 Sep.
6. **Age-assurance provider acceptance** — some providers are picky about
   category. Vet acceptable-use policies during selection; have a second
   choice.
7. **Thin density at launch** — 4 weeks of beta is short. Mitigation:
   concierge onboarding is the density engine; partner supply-side
   audience supplements it; throttle consumer traffic rather than fake
   liquidity.

## This week (W/C 20 Jul)

1. Book the accountant/solicitor consultation with the speed-vs-anonymity
   question on the agenda (founder action — only you can do this)
2. Underwriting pack: drafted (`docs/payments/underwriting-pack.md`) —
   founder actions remaining: gather KYC docs (passport, proof of
   address), sanity-check the volume projections
3. Spec 030: reframed and space research done (2026-07-17) — see
   `marketing/partner-space.md`. Outreach actions now live: email Mark
   Brooks (mark@courtlandbrooks.com — revshare willingness, UK
   shelf-space owners), book GDI London tickets (15–16 Sep, launch
   week, re-verify dates), contact CrakRevenue as an advertiser, verify
   the three UK review-site candidates
4. Run the brand-name knockout screen (spec 020 workstream 1)
5. Write + execute the 015 gazetteer plan
6. Draft execution specs 050–100

## Decisions log

- 2026-07-17 — Plan authored. Initially assumed metrics-gated open launch
  W/C 28 Sep.
- 2026-07-17 — Founder defined the target: everything in place to go live
  with marketing partners when students get to uni. Re-planned as
  calendar-gated: beta Mon 17 Aug, partner-ready Fri 28 Aug, launch Mon
  14 Sep (freshers window).
- 2026-07-17 — Partner model decided: no marketing budget before revenue,
  so launch via rev-share partner(s) already in the dating space bringing
  traffic on both sides, paid a consumer-side revenue share. Payments and
  revshare attribution (new spec 100) become launch-blocking; paid
  supply-side CPL dropped; "launch free" fallback replaced by supply-first
  launch (free side on 14 Sep, consumer side the day payments are live).
  `marketing/launch-plan.md` and `marketing/channels.md` still describe
  the CPA/CPL model and need a revision pass.
- 2026-07-17 (later) — Founder called out the rev-share anchoring after
  the space research showed the market runs on payout menus. Model
  refined: the principle is payouts-funded-from-realized-revenue with
  capped cash exposure; the instrument is per-partner (menu in
  `marketing/affiliate-program-terms.md`). Supply-side CPL reinstated as
  an option (small, verification-gated, capped — market rate ~£2–4).
  Expect two deal lanes (demand-side review shelf, supply-side content
  ecosystem) rather than one both-sides partner.

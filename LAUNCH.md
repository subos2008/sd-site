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

Therefore:

- **Mon 14 Sep — open launch (Phase 2), London.** Affiliate listings live,
  supply-side channels on (student media, referral codes, trust/safety
  guides), self-serve signup open, founding-member premium unlocks.
- **Fri 28 Aug — partner-ready gate.** Review sites need lead time to slot
  us into listicles and student media has booking deadlines, so partners
  must be signed, creatives approved, and placements booked by end of
  August. "Live with partners on the 14th" is won or lost here.
- **Mon 17 Aug — closed beta opens (Phase 1).** Four weeks of invite-only,
  London, supply-side-first, concierge-onboarded density building before
  the doors open.

**The date is calendar-gated, not metrics-gated.** This inverts the posture
in `marketing/launch-plan.md`: missing the freshers window means waiting
until January (or next September) for a comparable supply-side moment, so
the date holds and *scope* flexes instead. Beta metrics inform what we
throttle at launch (e.g. hold demand-side affiliate spend until density
supports it), not whether we launch.

**The calendar-critical half of the launch is the free half.** Freshers is
a supply-side window; students are the supply side, and every channel that
must hit the window (student media, supply-side affiliate CPL, referral
codes) is free-side machinery. The paying demand side is not term-gated —
so if payments underwriting slips past 14 Sep, we launch anyway on the
founding-member free period and flip payments on when approved. Payments
timing is a revenue risk, not a launch-date risk.

## Critical path

Three chains run in parallel. The longest one is not code.

**Chain 1 — entity → payments (longest lead, external parties, start NOW):**
brand + corporate-structure decision (spec 020, needs professional advice)
→ incorporate + open bank account → high-risk acquirer application (Segpay /
CCBill / Verotel class, MCC 7273) → underwriting (typically 4–8 weeks,
wants to see a live site, ToS, privacy policy) → live payments. Application
in by ~7 Aug gives a coin-flip chance of approval by 14 Sep; the free-launch
fallback above absorbs a miss. The entity must exist by early August, which
means the structure decision (and the professional advice behind it) must
happen **by end of July**. **Spec 020 is the single most urgent item.**

**Chain 2 — brand → domain → waitlist → partners:** brand name knockout
screen (020 workstream 1) → domain purchased (corporate registrar,
registrant withheld, Cloudflare) → production infrastructure deployed →
waitlist landing page live (no later than W/C 3 Aug) → 2+ weeks of waitlist
building → beta invites 17 Aug. In parallel: affiliate-expert engagement
(spec 030) → review-site negotiations → partner-ready 28 Aug → placements
live 14 Sep. Partner relationships have the longest human lead time in this
chain — outreach starts this week.

**Chain 3 — product build:** the remaining code, sequenced below. The
beta-entry set must land in 4 working weeks (by 14 Aug). Feasible with the
subagent workflow only because the gate is deliberately smaller than the
full list; everything else ships during beta.

## Workstreams

### A. Founder anonymity and corporate structure (spec 020)

The founder's name and home address must not be publishable from anything we
ship. Full detail in `marketing/founder-anonymity.md`; this is the action
list.

**One decision to make first, because it picks the jurisdiction:** is
keeping the founder's *name* off public registers a hard requirement, or
only the *address*?

- **Address privacy is fully achievable either way**: agent registered
  office + director service address means the home address never appears at
  Companies House or the ICO register. This part is table stakes; do it
  regardless.
- **Name privacy is NOT achievable as a UK company.** Director names and
  >25% PSC entries are public, ECCTA identity verification is mandatory,
  and nominee layering to defeat the PSC register is criminal evasion.
- **Name privacy IS achievable offshore** (Cyprus/Malta — the category
  norm: Secret Benefits, W8Tech, Digisec all sit there): EU beneficial-owner
  registers are no longer public post-2022 CJEU ruling, nominee directors
  are lawful and routine, and the high-risk acquiring ecosystem is
  colocated. Costs: setup/maintenance fees, professional intermediaries,
  and no change to UK obligations — OSA/ICO/ASA follow the users, and a
  UK-managed company is generally UK tax-resident regardless (privacy
  structuring is legitimate; hiding from HMRC is not). Offshore setup also
  takes longer — if this route is chosen, it starts immediately or it
  threatens the early-August entity deadline.

Checklist (jurisdiction-independent items can start immediately):

- [ ] Engage an accountant/solicitor who knows UK tax residence +
      offshore structures (required by spec 020; books the decision)
- [ ] Decide: UK-with-address-privacy vs offshore-with-name-privacy
- [ ] Neutral operating-company name, unconnected to the brand
- [ ] Agent registered office + service addresses; home address appears
      nowhere, ever (also check historic exposure from any past companies —
      the expanded CH address-suppression regime can scrub old filings)
- [ ] Domain via corporate registrar (SafeNames class), registrant
      withheld, multi-year registration, Cloudflare-proxied from day one
- [ ] ICO registration under the company name + agent address
- [ ] No founder in site copy, PR, marketing, socials — the public human,
      if ever needed, is a designated spokesperson role (open item: who)
- [ ] Billing descriptor = neutral/brand name (part of acquirer setup)
- [ ] Trademark filed by the company, not the individual
- [ ] Generic support/press identities ("the [brand] team", media@)

### B. Payments (revenue risk, not launch-date risk)

- [ ] Shortlist high-risk processors (Segpay, CCBill, Verotel, plus any the
      affiliate-expert search surfaces); note integration and payout models
- [ ] Application submitted as soon as entity + bank exist (target ~7 Aug)
- [ ] ToS, privacy policy, and a live site exist before underwriting review
- [ ] Real-provider integration behind `APP_CONFIG.payments.provider`
      (Plan 04 ships FauxProvider first, so code is not blocked on this)
- Committed fallback: if approval misses 14 Sep, launch on the
  founding-member free period and flip payments on when approved. The
  freshers window is supply-side; demand-side monetisation is not
  term-gated.

### C. Product build (chain 3)

Existing planned work, in execution order:

| Item | What | Needed by | Status |
|---|---|---|---|
| Spec 015 | Location gazetteer + autocomplete + metro distance | Beta (schema must precede real users) | Not started |
| Plan 04 | Token economy + FauxProvider | Beta (admin grants for testers) | To be written |
| Plan 05 | Messaging (text + photo) | During beta, before open launch | To be written |
| Plan 06 | Secret album + read receipts | During beta, before open launch | To be written |
| Spec 040 | PWA update path + manifest hardening | Beta (installed clients must update) | Not started |

New build items with no spec yet — write as execution specs 050–090:

| Proposed | What | Needed by |
|---|---|---|
| 050 | Age assurance (OSA, 18+ provider: Yoti/Persona/Veriff class) + identity/photo verification flow (video selfie → `verification_video`, admin review, badge). Verification-by-default is the beta trust story — this is beta-blocking. | Beta |
| 060 | Reporting + blocking flow, moderation queue (flip `media_items.status` default to `pending_moderation`), admin dashboard, rate limiting. Basic report/block by beta; full moderation by open launch. | Beta / open launch |
| 070 | Production deployment: AWS (S3 + CloudFront + Route 53 + ACM — the `spa-aws-deploy` skill scaffolds this), production Supabase project, Sentry (with the PII-scrubbing compliance follow-up from the global-error-surface spec), backups, uptime monitoring, incident runbook. | Waitlist page (W/C 3 Aug) |
| 080 | Waitlist landing page + invite gating: value prop, city selector, role selector, email capture, `acquisition_source` (UTM/ref) capture at signup, invite-code redemption for beta. | W/C 3 Aug |
| 090 | Transactional + digest email: provider selection (dating is a restricted category at some ESPs — verify acceptable-use before integrating), weekly activity digest ("new members near you", likes digest) on the existing notifications infra. | Beta |

### D. Compliance and legal

- [ ] ToS + privacy policy + cookie consent (needed for acquirer
      underwriting AND before beta users touch the site)
- [ ] OSA: age assurance live (spec 050); illegal-content and children's
      access risk assessments documented; user reporting route (spec 060)
- [ ] ICO registration (under company, workstream A)
- [ ] GDPR review of OTEL/Sentry contents; Sentry PII scrubbing before any
      live deployment (flagged in the global-error-surface design doc)
- [ ] Security review / pen test before open launch
- [ ] ASA/CAP check on all launch copy (agency framing, "dating" not
      "income", 18+ placements only) — student-media creatives especially

### E. Marketing partners (the launch definition — Phase 0 → 2)

- [ ] Brand name decided (spec 020 workstream 1 — shortlist exists in
      `marketing/brand-name.md`, knockout screen not yet run)
- [ ] Spec 030: dating-vertical affiliate expert — outreach starts this
      week; this person's relationships are what "live with marketing
      partners" means in practice. Consider launch-partner economics
      (rev share / advisor) per the spec, not just a hire.
- [ ] Affiliate agreement drafted: approved-creatives clause, payout gates,
      demand-side CPA + gated supply-side CPL terms
- [ ] UK review-site shortlist → negotiations → signed by 28 Aug
- [ ] Student media booked (booking deadlines are August; placements run
      in the freshers window; ASA-cleared creatives; 18+ placements only)
- [ ] Waitlist live + founding-member offer (spec 080)
- [ ] Navigational SERP pages (brand, "brand review", "is brand legit")
      live before affiliates/scrapers write them for us
- [ ] Comparison/alternatives pages ready to publish at launch
- [ ] Press kit + media@ + prepared reactive lines (spokesperson question
      from workstream A) — reactive only, no pitching
- [ ] Concierge onboarding prep: photo guidance, verification walkthrough
      script, the first ~100 supply-side invite list
- [ ] Trust/safety guides + city page template ready

## Timeline

Four working weeks to beta, eight to launch. The date holds; scope flexes.

**W/C 20 Jul — decisions week**
- Book the accountant/solicitor consultation (founder action; the
  jurisdiction decision must land by end of July)
- Spec 020: run the brand-name knockout screen — name decided this week
  or early next
- Write + start executing the Plan 015 gazetteer plan (beta-blocking schema)
- Draft execution specs 050–090 (an afternoon of Claude work)
- Start spec 030 affiliate-expert outreach (longest human lead time in
  the partner chain)

**W/C 27 Jul — entity week**
- Decide jurisdiction/structure (with the professional advice); begin
  incorporation + bank account
- Buy the domain (corporate registrar, withheld, Cloudflare)
- Spec 070 started: production infra build
- Execute Plan 04 (tokens + FauxProvider); finish 015
- Shortlist age-assurance provider and payments processors
- Draft affiliate agreement + review-site shortlist

**W/C 3 Aug — production week**
- Spec 070 done: AWS + prod Supabase + Sentry (scrubbed) live
- Spec 080: waitlist landing page live on the real domain (hard date —
  every day late is a day less waitlist before beta)
- Acquirer application submitted (~7 Aug target)
- Execute Plan 05 (messaging); spec 050 build starts (age assurance +
  verification)
- ToS + privacy policy up; student media bookings enquired

**W/C 10 Aug — beta-readiness week**
- Finish spec 050; spec 060 basic report/block; spec 040 PWA update path;
  spec 090 digest email
- E2E pass on production infra; backup verification
- Concierge prep: invite list, photo guidance, verification script
- Beta go/no-go Fri 14 Aug against the beta-entry gate below

**Mon 17 Aug — closed beta opens (Phase 1)**
- Supply-side invites first (2–3:1 before demand side), concierge
  onboarding of the first ~100, weekly digest running
- Measure: activation (photo + verified + complete), D7 return,
  first-search result count, supply/demand ratio

**W/C 17 + 24 Aug — beta iterates, partners close**
- Execute Plan 06 (secret album); moderation dashboard (060 remainder)
- Affiliate agreements signed, creatives ASA-checked and approved,
  review-site placements and student media booked
- **Fri 28 Aug — partner-ready gate** (see Gates)

**W/C 31 Aug + 7 Sep — launch-readiness**
- Fix what beta users hit; density push via concierge referrals (#5)
- SERP + comparison pages final; city pages ready
- Security review; chase acquirer underwriting weekly; free-launch
  fallback decision if approval hasn't landed by Fri 4 Sep
- Launch freeze W/C 7 Sep; final go/no-go Fri 11 Sep

**Mon 14 Sep — open launch (Phase 2), London**
- Self-serve signup on; affiliate listings live (demand CPA + gated
  supply CPL); student media running through both freshers waves;
  referral codes for the concierge cohort; founding-member premium
  unlocks for waitlist converts
- No press push, no Product Hunt/HN (per marketing plan); press kit
  stays reactive

**W/C 14 – 28 Sep — freshers campaign window**
- Placements running across both English arrival waves; affiliate
  policing starts (creative audits, payout integrity)
- Throttle demand-side spend to whatever density supports; supply-side
  channels run at full tilt — that is what the window is for

## Gates

**Beta entry (Fri 14 Aug for Mon 17 Aug):** production deploy + domain
live; 015 gazetteer in; age assurance + verification flow working;
report/block exists; ToS/privacy up; PWA update path tested; invite gating
works; digest email sends. Payments NOT required (beta is free).

**Partner-ready (Fri 28 Aug):** affiliate agreements signed; creatives
approved and ASA-checked; review-site placements committed for w/c 14 Sep;
student media booked; supply-side CPL gates and tracking (acquisition_source
→ activated-verified-profile event) proven end-to-end in beta.

**Open launch (Mon 14 Sep — date holds, scope flexes):** messaging + tokens
live end-to-end; moderation queue operational; SERP + comparison pages
live; payments live OR the free-launch fallback explicitly invoked. Beta
density decides how hard we run demand-side spend, not whether we launch.

## Top risks

1. **Partner lead times** — review sites and student media move on their
   own schedules; if agreements aren't signed by 28 Aug, the 14 Sep
   go-live has nothing to switch on. Mitigation: spec 030 outreach starts
   this week; the affiliate expert exists precisely to compress this.
2. **Jurisdiction decision stalls** — chains 1 and 2 queue behind it, and
   the offshore route (if chosen) has the longer setup. Mitigation: the
   consultation is this week's #1 action.
3. **Build crunch** — the beta-entry set in 4 working weeks. Mitigation:
   the gate is deliberately minimal; 06 + moderation dashboard ship during
   beta; if needed, beta slips a week (to 24 Aug) without moving 14 Sep.
4. **Acquirer underwriting misses 14 Sep** — likely a coin flip from a
   ~7 Aug application. Mitigation: committed free-launch fallback; the
   freshers window is supply-side, monetisation is not term-gated.
5. **Age-assurance provider acceptance** — some providers are picky about
   category. Vet acceptable-use policies during selection, have a second
   choice.
6. **Thin beta density at launch** — 4 weeks of beta is short. Mitigation:
   concierge onboarding is the density engine and starts before beta via
   the invite list; "new in your city" honest framing; throttle demand
   spend rather than fake liquidity.

## This week (W/C 20 Jul)

1. Book the accountant/solicitor consultation (founder action — the one
   thing only you can do this week; the decision must land by end of July)
2. Run the brand-name knockout screen (spec 020 workstream 1)
3. Start spec 030 affiliate-expert outreach (longest partner lead time)
4. Write + execute the 015 gazetteer plan
5. Draft execution specs 050–090

## Decisions log

- 2026-07-17 — Plan authored. Initially assumed metrics-gated open launch
  W/C 28 Sep.
- 2026-07-17 — Founder defined the target: everything in place to go live
  with marketing partners when students get to uni. Re-planned as
  calendar-gated: beta Mon 17 Aug, partner-ready Fri 28 Aug, open launch
  Mon 14 Sep (freshers window). Date holds, scope flexes; committed
  free-launch fallback if payments underwriting misses the date.

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

Working definition (assumption — adjust if wrong):

- **Mon 31 Aug — closed beta opens (Phase 1).** Invite-only, London,
  supply-side first, concierge onboarding, free. No payments needed.
- **W/C 28 Sep — quiet open launch (Phase 2), London.** Self-serve signup,
  affiliate listings switch on, founding-member premium unlocks. Timed to
  the UK university term start (freshers), which `marketing/channels.md`
  identifies as the supply-side rhythm window.
- Phase 2 remains **metrics-gated, not calendar-gated** (per
  `marketing/launch-plan.md`): if beta density or payments aren't ready,
  open launch slips to October and the beta extends. The calendar target
  exists to force the pre-work; the gate decides the day.

## Critical path

Three chains run in parallel. The longest one is not code.

**Chain 1 — entity → payments (longest lead, external parties, start NOW):**
brand + corporate-structure decision (spec 020, needs professional advice)
→ incorporate + open bank account → high-risk acquirer application (Segpay /
CCBill / Verotel class, MCC 7273) → underwriting (typically 4–8 weeks,
wants to see a live site, ToS, privacy policy) → live payments. Working
backwards from a 28 Sep open launch, the acquirer application must be in by
mid-August, which means the entity must exist by mid-August, which means the
structure decision (and the professional advice behind it) must happen by
end of July. **Spec 020 is the single most urgent item in this plan.**

**Chain 2 — brand → domain → waitlist:** brand name knockout screen (020
workstream 1) → domain purchased (corporate registrar, registrant withheld,
Cloudflare) → production infrastructure deployed → waitlist landing page
live → 4+ weeks of waitlist building → beta invites on 31 Aug. Working
backwards: the waitlist page must be live by W/C 3 Aug, so the name must be
decided by end of July. Same deadline as chain 1, same spec.

**Chain 3 — product build:** the remaining code, sequenced below. Roughly
9 build items in 6 weeks to beta. Feasible with the subagent workflow but
tight; the sequencing below front-loads what beta strictly needs and lets
the rest ship during beta.

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
  structuring is legitimate; hiding from HMRC is not).

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

### B. Payments (blocks Plan 04's real mode + open launch revenue)

- [ ] Shortlist high-risk processors (Segpay, CCBill, Verotel, plus any the
      affiliate-expert search surfaces); note integration and payout models
- [ ] Application submitted as soon as entity + bank exist (target mid-Aug)
- [ ] ToS, privacy policy, and a live site exist before underwriting review
- [ ] Real-provider integration behind `APP_CONFIG.payments.provider`
      (Plan 04 ships FauxProvider first, so code is not blocked on this)
- Fallback if underwriting slips past open launch: launch with
  founding-member free premium only, flip payments on when approved

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
      "income", 18+ placements only)

### E. Marketing (Phase 0 → Phase 1, from `marketing/launch-plan.md`)

- [ ] Brand name decided (spec 020 workstream 1 — shortlist exists in
      `marketing/brand-name.md`, knockout screen not yet run)
- [ ] Waitlist live + founding-member offer (spec 080)
- [ ] Navigational SERP pages (brand, "brand review", "is brand legit")
      live before affiliates/scrapers write them for us
- [ ] Affiliate groundwork: agreement drafted (approved-creatives clause,
      payout gates), UK review-site shortlist, CPA/CPL terms
- [ ] Spec 030: dating-vertical affiliate expert search — start outreach
      now; relationship lead times are long and this person materially
      de-risks the Phase 2 switch-on
- [ ] Press kit + media@ + prepared reactive lines (spokesperson question
      from workstream A)
- [ ] Concierge onboarding prep: photo guidance, verification walkthrough
      script, the first ~100 supply-side invite list
- [ ] Trust/safety guides + city page template ready

## Timeline

Six working weeks to beta. Code items assume the subagent-driven workflow;
external items (advice, incorporation, underwriting) are the schedule risks.

**W/C 20 Jul — decisions week**
- Spec 020: run the brand-name knockout screen; engage accountant/solicitor
  (the booking is this week even if the meeting is next)
- Write + start executing the Plan 015 gazetteer plan (beta-blocking schema)
- Draft execution specs 050–090 (an afternoon of Claude work)
- Start spec 030 affiliate-expert outreach

**W/C 27 Jul — entity week**
- Decide: brand name + jurisdiction/structure (with the professional advice)
- Buy the domain (corporate registrar, withheld, Cloudflare)
- Begin incorporation + bank account
- Execute Plan 04 (tokens + FauxProvider); finish 015
- Shortlist age-assurance provider and payments processors

**W/C 3 Aug — production week**
- Spec 070: production infra live (AWS + prod Supabase + Sentry scrubbed)
- Spec 080: waitlist landing page live on the real domain — waitlist
  building starts (hard date: every week late = a week less waitlist)
- Execute Plan 05 (messaging)
- ToS + privacy policy drafted

**W/C 10 Aug — payments week**
- Acquirer application submitted (entity + bank + live site + ToS ready)
- Spec 050: age assurance + verification flow build
- Finish Plan 05; write Plan 06
- SERP pages live; affiliate agreement drafted

**W/C 17 Aug — safety week**
- Spec 060: reporting/blocking + basic moderation
- Spec 040: PWA update path
- Spec 090: digest email
- Execute Plan 06 (secret album) — can slip into beta without moving beta

**W/C 24 Aug — hardening week**
- E2E pass on production infra, security review, backup verification
- Seed/concierge prep: invite list, photo guidance, verification script
- Beta go/no-go on Fri 28 Aug against the beta-entry gate below

**Mon 31 Aug — closed beta opens (Phase 1)**
- Supply-side invites first (2–3:1 before demand side), concierge
  onboarding of the first ~100, weekly digest running
- Measure: activation (photo + verified + complete), D7 return,
  first-search result count, supply/demand ratio

**September — beta iterates**
- Ship anything that slipped (06, moderation dashboard); fix what beta
  users hit; chase acquirer underwriting weekly
- W/C 14 Sep: open-launch go/no-go review against the Phase 2 gate

**W/C 28 Sep — quiet open launch (Phase 2), if gates pass**
- Self-serve signup (London), affiliate listings on, comparison pages
  live, founding-member premium unlocks, student media in the freshers
  window. No press push, no Product Hunt/HN (per marketing plan).

## Gates

**Beta entry (31 Aug):** production deploy + domain live; 015 gazetteer in;
age assurance + verification flow working; report/block exists; ToS/privacy
up; PWA update path tested; invite gating works; digest email sends.
Payments NOT required (beta is free).

**Open launch (28 Sep):** beta density metrics healthy (a new user's first
search looks alive; supply/demand ratio holding); messaging + tokens live
end-to-end; real payments approved and tested — or the explicit fallback
(free founding period, payments to follow) is chosen; moderation queue
operational; affiliate agreements signed and creatives approved; SERP +
comparison pages live.

## Top risks

1. **Acquirer underwriting timing** — external, 4–8 weeks, and the
   application can't start until the entity exists. Mitigation: spec 020
   this week; fallback: launch free, charge later.
2. **Jurisdiction decision stalls** — everything in chain 1 and 2 queues
   behind it. Mitigation: the accountant/solicitor engagement is this
   week's #1 action; the decision needs days of advice, not weeks.
3. **Build crunch** — 9 items in 6 weeks. Mitigation: beta-entry gate is
   deliberately smaller than the full list; 06 and the moderation
   dashboard may ship during beta.
4. **Waitlist too small by 31 Aug** — beta with nobody to invite.
   Mitigation: waitlist page W/C 3 Aug is a hard date; concierge
   recruitment (direct, personal) does not depend on waitlist volume.
5. **Age-assurance provider acceptance** — some providers are picky about
   category. Vet acceptable-use policies during selection, have a second
   choice.

## This week (W/C 20 Jul)

1. Book the accountant/solicitor consultation (founder action — the one
   thing only you can do this week)
2. Run the brand-name knockout screen (spec 020 workstream 1)
3. Write + execute the 015 gazetteer plan
4. Draft execution specs 050–090
5. Start affiliate-expert outreach (spec 030)

## Decisions log

- 2026-07-17 — Plan authored. Assumed "September launch" = beta 31 Aug +
  metrics-gated quiet open launch W/C 28 Sep (freshers window). Confirm.

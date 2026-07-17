# Payments underwriting pack

Draft 2026-07-17. The application dossier for high-risk acquirer/processor
onboarding (Segpay / CCBill / Verotel class; dating is MCC 7273). Prepared
before the entity exists so the application can be submitted the day the
bank account opens (LAUNCH.md chain 1; target ~7 Aug 2026). Items marked
`[TBD-020]` are blocked on the brand/entity decision (spec 020); items
marked `[FOUNDER]` need founder documents or decisions. Everything else is
ready text that can be pasted into application forms.

**Ground rule: declare the category accurately.** These processors know the
dating vertical; the specialist ones exist for it. Misdescribing the
business to get a lower-risk rating is how merchants end up terminated and
on the MATCH list, which follows the principals to every future
application. We apply as what we are: an online dating service.

## 1. Business summary

- **Legal entity:** `[TBD-020]` — name, number, jurisdiction, registered
  office (agent address).
- **Trading name / brand:** `[TBD-020]`.
- **Website:** `[TBD-020]` (production domain; must be live with the
  site-readiness items in section 8 before underwriting review).
- **Directors / beneficial owners:** `[FOUNDER]` — KYC documents in
  section 9. Service address on public registers; certified residential
  documents go to the acquirer privately (normal and unavoidable — KYC
  privacy is contractual, not public).
- **Business description (application text):** "Online dating website and
  installable web app for adults (18+), UK market. Members create
  verified profiles, search, and communicate. Free registration;
  communication features are paid for with prepaid credit packages
  (one-off card purchases, no subscription or recurring billing).
  Identity and age verification are required for all members before their
  profile is visible."
- **Category:** online dating service, MCC 7273. The positioning-
  discipline rule from `marketing/README.md` applies to this document
  doubly: all copy here and on-site is a dating proposition, and the ToS
  prohibited-uses list (section 6) is part of the underwriting story.
- **Company history:** new business, no processing history. Founder
  background summary `[FOUNDER]` (relevant professional history;
  acquirers underwrite the principals when the company is new).
- **Funding:** self-funded; no outside investors. `[FOUNDER]` confirm
  phrasing.

## 2. Product and pricing

- **Model:** prepaid credit ("token") packages purchased by card; tokens
  are spent in-product on communication features (first message to a new
  member, unlocking a conversation, unlocking a member's private album).
  No subscriptions, no negative-option billing, no free-trial-to-paid
  conversion, no auto-top-up at launch. (This is the low-friction end of
  dating billing — say so; recurring billing is where most dating
  chargeback pain lives.)
- **Price points:** `[TBD]` final package sizes from Plan 04; working
  assumption £10–£100 per package, average transaction value ~£20–£40.
- **Currency / market:** GBP, UK cardholders; card-present-equivalent SCA
  via 3-D Secure 2 on all transactions (UK SCA mandate — helpful for
  underwriting: liability shift + mandatory-by-market).
- **Delivery:** instant digital delivery; token balance credited
  atomically on payment confirmation, recorded in a double-entry ledger
  (Plan 04) that provides transaction-level evidence for disputes.
- **Refund policy:** unused token packages refundable within 14 days on
  request; partial-use handled pro-rata at our discretion; refunds issued
  to the original card. Self-serve refund request from the account page —
  a cardholder who can refund does not need to charge back.

## 3. Projected processing profile

`[TBD]` — finalise numbers with the founder before submission; the ramp
below is the shape acquirers expect from a new dating merchant and should
be adjusted to honest expectations, not optimism.

| Metric | Months 1–3 | Months 4–6 | Months 7–12 |
|---|---|---|---|
| Monthly volume | £2k–£10k | £10k–£30k | £30k–£75k |
| Transactions/month | 100–400 | 400–1,200 | 1,200–3,000 |
| Average transaction | £20–£40 | £20–£40 | £20–£40 |
| Max single transaction | £100 | £100 | £150 |

- Seasonality note for the application: launch aligned to the UK
  university autumn term; expect a September–October ramp.
- Settlement account: `[TBD-020]` (the business bank account).
- Reserve expectations: rolling reserve is standard for new high-risk
  merchants (typically 5–10%, 90–180 days). Accept in principle;
  negotiate the percentage and release schedule, and ask for scheduled
  review/reduction after 6 months of clean processing.

## 4. Chargeback and fraud controls

The section underwriters actually read. Our controls:

- **3-D Secure 2 on every transaction** (SCA-mandated in the UK) —
  fraud-liability shift on authenticated transactions.
- **AVS + CVV checks** via the processor.
- **Clear billing descriptor** — neutral company/brand descriptor
  `[TBD-020]` with support contact; descriptor shown to the customer at
  checkout and on the receipt ("this will appear on your statement as
  ..."), the single cheapest chargeback-prevention measure.
- **Email receipts** for every purchase with descriptor, amount, support
  contact, and refund-policy link.
- **Instant delivery + ledger evidence:** every token credit and spend is
  timestamped in a double-entry ledger tied to the authenticated account;
  compelling-evidence packages for friendly-fraud disputes include
  login/device history, verification status, and usage after purchase.
- **Verified accounts only:** every paying customer has passed 18+ age
  assurance and identity verification before they can use paid features —
  stolen-card fraudsters do not generally submit ID verification.
- **Velocity limits:** per-account and per-card purchase caps at launch
  (`[TBD]` exact numbers in Plan 04 config); manual review above
  threshold.
- **Self-serve refunds** (section 2) and a monitored support inbox with a
  48-hour first-response SLA.
- **Chargeback alerts:** enrol in Verifi CDRN / Ethoca via the processor
  from day one; refund-on-alert policy while volume is small.
- **No recurring billing** — eliminates the largest dating-vertical
  dispute class (forgotten subscriptions).
- Target chargeback rate: <1% (scheme threshold); design target well
  under.

## 5. Compliance posture

- **Age assurance (18+):** required for all members before profile
  activation; provider `[TBD]` (Yoti/Persona/Veriff class — spec 050).
  UK Online Safety Act duty, and an underwriting positive.
- **Identity verification:** video-selfie verification of members
  (verification-by-default is the product's trust story).
- **Content moderation:** user-generated photos held in a moderation
  queue before visibility (`pending_moderation` default), NSFW detection
  + human review, in-product report/block, admin moderation dashboard
  (spec 060).
- **Prohibited uses enforced (ToS):** no commercial sexual services, no
  escort advertising, no solicitation of payment for sexual acts, no
  under-18s. Enforcement: verification gate, moderation queue, report
  review, account termination. This is the paragraph that distinguishes a
  dating service from what acquirers are actually worried about — it must
  match the live ToS text.
- **Data protection:** ICO registration `[TBD-020]`; GDPR-compliant
  privacy policy; UK data-subject rights honoured.
- **Regulatory:** UK Online Safety Act duties addressed (age assurance,
  reporting routes, risk assessments); ASA/CAP-compliant marketing;
  affiliate creatives contractually restricted to approved copy.

## 6. Website readiness checklist (pre-review)

Underwriters browse the site before approving. All of these must be live
on the production domain before the application is submitted:

- [ ] Terms of service (with the prohibited-uses section above)
- [ ] Privacy policy + cookie consent
- [ ] Refund policy page (matching section 2 exactly)
- [ ] Contact/support page with the company legal name, registered
      (agent) address, and support email
- [ ] Pricing clearly displayed before checkout
- [ ] Billing-descriptor notice at checkout
- [ ] 18+ statement and age-assurance flow visible at signup
- [ ] Working checkout in the processor's test mode

## 7. Processor targets

Apply to two in parallel if terms allow. Shortlist (to be refined by
partner-candidate advice — ask candidates which acquirers they see work in
this vertical):

| Processor | Why | Notes |
|---|---|---|
| Segpay | Named in the design spec; dating/high-risk specialist; EU/UK entity for local acquiring | First choice pending rate quote |
| CCBill | Long-standing dating/adult-adjacent specialist; fast onboarding reputation | Strong second application |
| Verotel | EU high-risk specialist | Backup |
| Epoch | Adult/dating specialist | Backup |

Questions for each: UK/GBP local acquiring? MCC assignment? Setup +
transaction + reserve terms for a new dating merchant? 3DS2 support?
Payout schedule? Chargeback tooling (CDRN/Ethoca) included? Affiliate/
revshare payout support (some dating processors offer partner-payout
rails — relevant to spec 100)?

## 8. Document checklist (gather now)

Corporate (available after incorporation, `[TBD-020]`):

- [ ] Certificate of incorporation
- [ ] Memorandum/articles (or jurisdiction equivalent)
- [ ] Shareholder / UBO register extract
- [ ] Bank account details + bank letter or statement

Principal KYC (`[FOUNDER]` — can be gathered this week):

- [ ] Passport (certified copy)
- [ ] Proof of residential address (utility bill/bank statement <3 months
      — goes to the acquirer privately; not public)
- [ ] Brief professional bio / CV for the application narrative

Product evidence (ready when the site is):

- [ ] Screenshots: signup + age gate, verification flow, pricing page,
      checkout with descriptor notice, refund policy
- [ ] Test credentials for the underwriter to browse the site

## 9. Open items

- Entity, brand, domain, bank: spec 020 (decision due end of July).
- Final price points and velocity limits: Plan 04.
- Age-assurance provider named: spec 050 selection.
- Volume projections: founder to sanity-check section 3 before
  submission.
- Whether processors' partner-payout rails change the spec 100 design.

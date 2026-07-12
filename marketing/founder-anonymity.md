# Founder anonymity

What Secret Benefits actually did, what a UK-domiciled founder can and
cannot do, and our position. Companion to
[lessons-learned.md](lessons-learned.md), which already concluded "our
version of quiet is low-profile and accountable, not hidden" — this doc is
the detail behind that line.

Caveat: the UK company-law specifics below are current to early 2026 and
should be confirmed with an accountant/solicitor before incorporation
decisions; the Economic Crime and Corporate Transparency Act (ECCTA) rollout
is ongoing and rules are tightening, not loosening.

## What Secret Benefits did

From [case-studies/secret-benefits.md](case-studies/secret-benefits.md),
their opacity is a stack of deliberate choices, none individually exotic:

1. **Offshore, fragmented corporate identity.** Operator reported as
   Digital Barter Limited (Cyprus); LinkedIn presence in New Zealand; a New
   York contact address on newswire releases. No single authoritative "this
   is the company" surface exists.
2. **No named humans, ever.** No founder, no executives, no interviews, no
   conference appearances, no LinkedIn profiles tied to the brand. There is
   nobody for a journalist to profile or doorstep.
3. **Infrastructure privacy.** Domain registered via a corporate
   brand-protection registrar with registrant withheld; Cloudflare in front
   of everything.
4. **No PR surface.** The only "press releases" are affiliate-disclosed
   review-shaped advertisements. There is no press office to query and no
   quote history to mine.
5. **Affiliates as the public face.** All public discussion of the product
   is conducted by commercially-incentivised third parties.

The payoff was real: category exposes (BBC documentaries, student sugar-baby
investigations) attached themselves to Seeking and Brandon Wade — the
competitor with a face — while Secret Benefits, a similar-scale business,
went essentially unexamined.

The costs were also real: junk data-broker records, a 3.4/5 Trustpilot with
no reply capability worth trusting, zero partnership/hiring/fundraising
surface, and no goodwill bank with any regulator. That trade was available
to them because they are (apparently) offshore and answer mainly to payment
processors.

## What a UK founder can and cannot do

### Cannot (without breaking the law or leaving the UK)

- **Anonymous directorship.** Directors' names are public at Companies
  House, and ECCTA identity verification is now mandatory (new directors
  from November 2025; existing directors verified via confirmation
  statements on a rolling basis). There is no compliant way to be an
  unnamed director of a UK company.
- **Hidden beneficial ownership.** Anyone holding >25% ownership or control
  appears on the public PSC (persons with significant control) register.
  PSC rules look through nominee arrangements to the person with actual
  control; layering offshore entities to defeat the register is criminal
  evasion, not planning.
- **Anonymity from the state and counterparties.** Payment
  processors/acquirers (especially high-risk ones), banks, the ICO, and —
  under the Online Safety Act — Ofcom all know exactly who we are
  regardless of what the public register shows. OSA duties follow the
  service's UK user base, not the place of incorporation, so the Secret
  Benefits offshore move would not even remove the UK regulatory surface.

### Can (legitimately)

- **Separate brand from company.** The company name need not resemble the
  product ("[Neutral] Digital Ltd" trading as the brand). A Companies House
  search for the brand then returns nothing; connecting the two requires
  the ICO register, terms-of-service small print, or payment descriptors —
  friction that filters out casual searchers but not journalists.
- **Service addresses everywhere.** Registered office and directors'
  service addresses can be an agent's address; residential addresses stay
  off the public register (and historic exposure can be suppressed under
  the expanded address-suppression regime).
- **No founder marketing.** Nothing requires a founder to be the public
  face. The public human, when one is needed (reactive press per
  [channels.md](channels.md) #8), can be a hired communications person or a
  "head of community/safety" — a real, named employee whose actual name is
  used. No pseudonymous humans in public: fake personas are exactly the
  fabricated-identity behaviour we reject elsewhere.
- **Infrastructure privacy.** WHOIS privacy, Cloudflare, generic support
  identities ("the SD Site team") — same as Secret Benefits, all fine.
- **Serious-risk protection.** Companies House can suppress details where
  there is a serious risk of violence or intimidation. Hard to obtain
  prospectively, but worth knowing it exists given the harassment profile
  of this category.

## Our position

**Pseudonymous in marketing, accountable on paper.** Concretely:

1. UK limited company with a neutral name unconnected to the brand; agent
   registered office; directors' service addresses.
2. Founder is on the register (unavoidable) but appears nowhere in
   marketing, PR, site copy, conference talks, or social media. No founder
   story, no origin-myth content — the Seeking case study shows the founder
   narrative is a channel, and we are choosing not to run that channel.
3. The named public human, if and when needed, is a designated
   spokesperson role, not the founder. Prepared lines exist for "who owns
   this site?" — the honest answer names the company and its safety/
   compliance posture, not the individuals.
4. Assume identification eventually happens. A journalist who cares will
   connect brand → ToS → company → register in an afternoon. The plan is
   not to prevent that; it is to make the discovery boring: a compliant UK
   company, verified users, honest numbers, no scandal to attach it to.
   This is the reactive-press capability from channels.md doing its job.
5. We do not do the offshore version. It would not remove OSA/ICO/ASA
   exposure for a UK-targeted service, it would poison the high-risk
   payments relationship we still need to win (acquirers price opacity as
   risk), and it forfeits the trust differentiator the whole playbook is
   built on.

## Open items

- Incorporation structure and name: decide before payments onboarding
  (the acquirer application fixes the legal-entity story).
- Whether any second person (co-founder, adviser, hired spokesperson) is
  willing to hold the public-facing role; if not, the reactive-press lines
  default to written statements from "the company".
- Legal review of the above once counsel is engaged; ECCTA implementation
  detail moves quickly.

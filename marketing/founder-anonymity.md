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
their opacity is a stack of deliberate choices, none individually exotic.
The concrete, observed mechanics:

1. **Offshore, fragmented corporate identity.** The operating entity is
   reported as **Digital Barter Limited, Cyprus** (named in VIDA Select's
   review; a cancellation address circulating in user reviews points to an
   office in **Nicosia**). The company LinkedIn page places the business in
   **Auckland, New Zealand**. Their own 2025 GlobeNewswire release gives a
   **New York street address**. Data brokers hold visibly junk records on
   them (one profile calls them a deadpooled US company founded in 2021).
   Whether the fragmentation is deliberate misdirection or just neglect,
   the effect is the same: no single authoritative "this is the company"
   surface exists, and every journalist starts from contradictions.
2. **No named humans, ever.** No founder, no executives, no interviews, no
   conference appearances, no staff LinkedIn profiles tied to the brand,
   skeletal Crunchbase/Tracxn entries with no people and no funding
   history. There is nobody to profile or doorstep. Category exposés (BBC
   documentaries, student sugar-dating investigations) consequently
   attached to Seeking and Brandon Wade — the competitor with a face.
3. **Infrastructure privacy, done properly and early.** How the domain is
   anonymised (verifiable in Verisign's RDAP record): secretbenefits.com
   was registered on 6 August 2014 through **SafeNames Ltd** — a corporate
   brand-protection registrar used by enterprises, not a consumer
   registrar — with all registrant contact details withheld, the registrar
   acting as the public-facing contact. Post-GDPR WHOIS redaction hides
   most registrant data by default anyway; using a corporate registrar on
   top of that means even the registrar relationship reveals nothing
   consumer-grade (no GoDaddy account to subpoena-fish or social-engineer),
   and the registration is paid up to **2033**, so it never lapses into a
   moment of exposure or loss. Nameservers point at **Cloudflare**, which
   proxies all traffic — the origin host, hosting provider, and server IP
   are invisible. Net effect: the domain, the most public asset the
   business owns, connects to nothing and nobody.
4. **No PR surface.** The only "press releases" ever issued are
   affiliate-disclosed, review-shaped advertisements pushed through paid
   newswire syndication (GlobeNewswire → Yahoo Finance). There is no press
   office to query and no quote history to mine.
5. **Affiliates as the public face.** All public discussion of the product
   is conducted by commercially-incentivised third parties. Even the
   affiliate programme itself is private: Secret Benefits is absent from
   public CPA network catalogues (CrakRevenue lists Ashley Madison and
   AdultFriendFinder; not them), so there is no public rate card, no
   network profile, and no partner-facing corporate identity to scrape.
6. **Ambiguous satellites.** A separate **secretbenefits.co.uk** site
   (with its own /affiliates page) styles itself "the UK's leading sugar
   dating app"; its relationship to the .com is unverifiable — a regional
   shell, or a third-party clone they tolerate. Either way it further
   muddies attribution.

**The category pattern worth noticing:** this is not just Secret Benefits.
WhatsYourPrice and MissTravel bill through **W8Tech Cyprus Limited**;
RichMeetBeautiful ran through **Digisec Media (Malta/Cyprus entities)**.
Three of the four commercial operators we studied are structured through
Cyprus/Malta — almost certainly because the high-risk payments and adult
billing ecosystem (acquirers, PSPs, corporate service providers who
understand the vertical) clusters there. Offshore structuring in this
category is the norm, not the exception, and it is partly a payments
decision, not only a privacy one.

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

### Cannot (as a UK-registered company)

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

**Jurisdiction and structure are now an open decision** — see
`execution/020-brand-name-and-corporate-structure.md`. We do not have to be
a UK-registered company to serve UK users: incorporation elsewhere (the
category's norm is Cyprus/Malta, per the pattern above) is lawful, offers
materially more public anonymity than Companies House (EU beneficial-owner
registers are no longer publicly accessible following the 2022 CJEU ruling,
and nominee directors are legal and routine in Cyprus), and colocates us
with the high-risk payments ecosystem this vertical actually uses. What
offshore incorporation does NOT do: remove OSA/ICO/ASA exposure for a
UK-targeted service, or remove UK tax obligations for a UK-resident founder
(a company managed and controlled from the UK is generally UK tax-resident
wherever it is incorporated — privacy structuring is legitimate; hiding
from HMRC is not). The spec lays out the options; professional tax and
corporate advice decides it.

**Wherever we incorporate, the marketing posture is the same** —
pseudonymous in marketing, accountable to regulators and counterparties.
Concretely:

1. Operating company (whichever jurisdiction) with a neutral name
   unconnected to the brand; agent registered office; service addresses;
   corporate-grade domain registration with registrant withheld and
   Cloudflare in front (the Secret Benefits mechanics in point 3 above,
   which are available to us regardless of jurisdiction).
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
5. If we do go offshore, it is the compliant version: proper tax treatment
   of a UK-managed company, full KYC transparency with acquirers and banks
   (they know who we are regardless of the public register), and OSA/ICO/
   ASA obligations met exactly as a UK company would. The anonymity gained
   is public-register anonymity — protection from doxxing and casual
   discovery — not anonymity from the state, processors, or a determined
   journalist. Whatever brand positioning we eventually choose (still an
   open decision), any trust element of it must then be carried by the
   product and its practices rather than by a Companies House entry —
   which is how Secret Benefits' segment of the market works anyway.

## Open items

- Incorporation structure and name: decide before payments onboarding
  (the acquirer application fixes the legal-entity story). Spec:
  `execution/020-brand-name-and-corporate-structure.md`.
- Whether any second person (co-founder, adviser, hired spokesperson) is
  willing to hold the public-facing role; if not, the reactive-press lines
  default to written statements from "the company".
- Legal review of the above once counsel is engaged; ECCTA implementation
  detail moves quickly.

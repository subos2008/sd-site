# Single-page, role-diverged signup — design

Authored 2026-07-17. Status: approved design, pre-plan.

## Goal

Replace the minimal email+password signup with a Secret-Benefits-style
single-page form that captures core profile fields up front, diverged by
role, so the landing-page fork carries momentum straight into a rich signup
and the post-confirmation wizard shrinks to the few things signup can't
collect. This is conversion work: the form is the sales pitch, and the
counterparty is sold in the headline before any field is asked.

Builds on the already-shipped landing page and `?role=` fork
(`abc07ec`…`3bfa836`), the auth-page restyle (`d4a1715`), and the
dead-session healing (`6424c6a`).

## The two forms

Both roles share a header — `100% free signup` eyebrow, role title, and a
gendered benefit subline selling the counterparty — then the same field
stack, then a role-specific chip block, then the button and an 18+
certification line.

Shared fields (in order): **Email** · **Username** ("Visible by all
members") · **Password** ("Minimum length: 8 characters") · **Location**
("Enter your city") · **Age**.

Role divergence:

| | Baby | Benefactor (daddy) |
|---|---|---|
| Subline | "Meet wealthy & successful **men** for free." | "Meet attractive, ambitious **women** for free." |
| Accent | rose | champagne |
| Body Type chips | Slim / Fit / Average / Curvy / Full figured / Muscular | — (not shown) |
| Ethnicity chips | White / Black / Asian / Hispanic / Other | White / Black / Asian / Hispanic / Other |

"Username" is our existing `display_name` field, relabelled — users
recognise "username" better than "display name", and because `display_name`
now moves to signup the wizard never asks it, so the term is consistent
everywhere. Body-type chips map to the existing `body_type` enum:
`athletic`→"Fit", `plus_size`→"Full figured", the rest 1:1; `muscular` is
kept in the baby chipset (muscular women exist). Chips are single-select.

Under the button: "By clicking 'Sign up' I certify that I'm at least 18
years old and agree to the Tacit Privacy Policy and Terms." — with real
links to `/legal/privacy` and `/legal/terms` (stub pages, this spec).

### Age vs date of birth (decided: age at signup, DOB in wizard)

Signup asks **Age** (a number), used only client-side to gate ≥18 and back
the certification. It is not stored. **Date of birth** remains the stored
truth (schema keeps its ≥18 CHECK) and is collected once in the wizard.
Accepted consequence: the DOB question appears in the funnel after signup;
the signup age field is a friction-reducer and legal gate, not data.

### Gender and looking-for are derived from role (no longer asked)

Role fully determines both: **baby → gender female, looking_for male**;
**benefactor → gender male, looking_for female**. The wizard's identity
step drops its Gender and Looking-for controls; the frontend derives both
from role and passes them to `set_profile_identity` unchanged. This encodes
the "roles are gender-fixed" product decision into the product itself —
same-gender arrangements are out of scope for this model.

## Data model change: `ethnicity`

Ethnicity is new; it threads exactly where `body_type` already threads
(`shared/rpc-contracts.ts` lines 150/169/255/288 and four migrations).

- **New migration** — `CREATE TYPE ethnicity AS ENUM ('white','black',
  'asian','hispanic','other')` and `ALTER TABLE public.profiles ADD COLUMN
  ethnicity ethnicity` (nullable, like every other profile attribute).
- **New migration** — replace `set_profile_details` to take
  `p_ethnicity ethnicity` and `SET ethnicity = p_ethnicity`. Adding a
  parameter changes the function signature, so this is `DROP FUNCTION IF
  EXISTS set_profile_details(...); CREATE FUNCTION …` — `CREATE OR REPLACE`
  cannot change an argument list. (Gotcha to carry into the plan.)
- **New migration** — replace the view RPCs (`view_my_profile`, and the
  profile/search view in `rpc_views_v2`) to return `ethnicity` alongside
  `body_type`.
- **`shared/rpc-contracts.ts`** — add `Ethnicity` enum; add `p_ethnicity`
  to `SetProfileDetailsInput`; add `ethnicity` to both view-result objects.
- **`pnpm gen:types`** regen; **pgTAP** — extend the details test and the
  view tests; **i18n** — ethnicity labels (+ the "Fit"/"Full figured"
  body-type relabels).

US-centric wording ("Hispanic" is unusual on UK forms) is a known
imperfection; we ship SB's five verbatim for now and revisit wording later.

## Data flow: capture → bootstrap → wizard

The email-confirmation gate sits between signup and first authenticated
render, so captured fields must survive a round trip that may finish on a
different device. They ride in Supabase **auth user metadata** (the same
mechanism as the already-shipped `role_hint`), never in an anonymous DB
write or localStorage.

1. **Signup** (`signUp`) writes `options.data = { role_hint, username,
   city, age, body_type?, ethnicity }` (age carried only for completeness;
   not persisted to the profile). No profile RPC runs while anonymous.
2. **Post-confirm bootstrap** — a run-once effect on first authenticated
   entry (extends the existing role-hint auto-commit in `RoleStep`, or a
   dedicated bootstrap hook) commits what it can, each independently:
   - `set_profile_role(role)` — already implemented.
   - `set_profile_details(…, body_type, ethnicity)` — independent of DOB.
   - **Location:** the signup city is a free-text *string*, not yet
     geocoded. It is carried to the wizard's location step and pre-fills it;
     the user confirms via the existing lookup flow. (City names are
     ambiguous; reusing the tested confirm step beats a silent
     bootstrap-time geocode that guesses.)
   - `set_profile_identity(username, dob, gender, looking_for)` **cannot**
     run here — no DOB yet. Username stays in metadata until the DOB step.
3. **Wizard**, now shrunk:
   - **Identity step → DOB only.** On submit it combines username (metadata)
     + DOB (form) + gender/looking_for (derived from role) into one
     `set_profile_identity` call. Username field may be shown pre-filled and
     editable, or carried silently — plan decides.
   - **Location step** pre-filled with the signup city; user confirms.
   - **Baby** then continues photos → bio → details → interests. The
     activation gate (min photos, min bio) is unchanged. In the details
     step, `body_type` and `ethnicity` arrive pre-selected from bootstrap
     (editable); the step still collects height/hair/eyes/income/etc.
   - **Benefactor** continues photo (skippable) → search, as today.

Nothing in the wizard is *removed* structurally — steps that now receive
pre-filled data still render so the user can review/complete them; only the
Gender and Looking-for controls are deleted outright.

## Error handling

Bootstrap commits are independent and best-effort: a failed
`set_profile_details` (or a geocode we deferred anyway) simply leaves that
wizard step to collect the data, pre-filled from metadata where possible —
never a silent swallow (per repo error-surfacing rules; these mutations use
`suppressGlobalError` and surface inline in their step). A metadata value
that fails Zod validation on read is ignored and the corresponding step
falls back to empty. The dead-session healing already in place covers the
case where the confirmed session outlives its profile.

## Legal stub pages

`/legal/privacy` and `/legal/terms` — minimal `AuthShell`-framed pages with
placeholder body copy and the Tacit wordmark, so the certification links
resolve. Real legal copy is out of scope (tracked in launch/compliance
work). Routes are public (no guard).

## Testing

- **Unit/component:** signup form renders the right field set per role
  (baby has body-type chips, benefactor doesn't; both have ethnicity);
  submit sends all captured fields as `options.data`; the bootstrap effect
  calls role/details with the right args; the DOB step derives
  gender/looking_for from role and calls `set_profile_identity` once.
- **pgTAP:** `set_profile_details` accepts and stores `ethnicity`; view
  RPCs return it; existing body-type assertions still pass.
- **e2e:** landing fork → single-page signup (fill all fields) → confirm via
  Mailpit → land in wizard with DOB step, location pre-filled, and (baby)
  body-type/ethnicity pre-selected in details → reach search. Extends the
  existing role-hint e2e.

## Non-goals

- Folding the *entire* profile into one page (photos/bio stay in the
  wizard; the baby activation gate is deliberate).
- Bootstrap-time geocoding (deferred to the confirm step by choice).
- Same-gender arrangements (explicitly out of model).
- Real legal copy; UK-specific ethnicity wording.

## Suggested implementation order (for the plan)

1. `ethnicity` schema: enum + column + `set_profile_details` + view RPCs +
   contracts + `gen:types` + pgTAP.
2. Legal stub pages + routes.
3. Signup form: role-diverged fields, chips, certification, copy, i18n.
4. `signUp` metadata payload + bootstrap commit (role/details) extension.
5. Wizard shrink: identity→DOB (+ derive gender/looking_for), location
   pre-fill, details pre-select; delete Gender/Looking-for controls.
6. e2e + component tests; remove the dev diagnostics overlay.

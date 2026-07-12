# Onboarding notes: the Secret Benefits asymmetry

Observed directly on secretbenefits.com (July 2026): the two sides of the
marketplace get different onboarding. Men go through a lightweight signup —
photo upload suggested but not required — and land straight in the catalog
of female profiles. Women must upload profile photos and build a full
profile as part of signup, before they can see the market at all.

This is deliberate design, and each half solves a different problem.

## The men's flow is conversion design

- The catalog is the sales pitch: nothing on a landing page sells the
  product like browsing real local profiles. Get the demand side to the
  catalog with near-zero friction.
- Photo is suggested, not required, because demand-side users in this
  category are privacy-shy; a hard photo gate suppresses conversion on the
  side whose value to the marketplace is their wallet, not their face.
- Monetisation waits for the moment of maximum intent — unlocking a
  specific woman's conversation. The onboarding and the credits pricing are
  the same design: browse free, commit per-target. (This is also our
  chargeback-control structure: purchases tied to a real target, never
  speculative wallet-loading.)

## The women's flow is inventory manufacturing

- A supply-side profile without photos is not a user, it is a bounce; her
  profile is the product the demand side pays for. Gating market access
  behind profile completion converts curiosity traffic into inventory at
  the door, before she can window-shop and drift away.
- The asymmetric friction sticks because the incentives differ per side:
  she has a motive to be findable and attractive to the paying side, so
  she tolerates the work; he has a motive to browse, so he wouldn't.

## Second-order effects that matter for us

1. **Anti-fraud at the cheapest point.** Scammers want to get in and DM
   fast; requiring photos (and, for us, video verification) raises the
   cost of fakery exactly where fakes enter. Since the affiliate
   supply-side CPL ([channels.md](channels.md)) pays on "activated,
   verified profile", the onboarding gate and the payout gate become the
   same event — the flow manufactures the thing we measure and pay for.
2. **It protects the supply side from launch density.** At launch the
   catalog is thin. A woman who browsed before committing would see that
   and leave; one who completes her profile first has committed before the
   thinness is visible, and her experience thereafter is inbound attention
   — which, on a supply-scarce marketplace, is strong from day one. The
   empty-marketplace first impression is asymmetric: it kills demand-side
   conversion, but the supply side never needs to face it.
3. **Our onboarding should fork by role.** The current flow (role →
   identity → location → photo → details → interests → search) is
   symmetric with a skippable photo step. Spec for the change:
   [../execution/010-separate-onboarding-flows.md](../execution/010-separate-onboarding-flows.md).

## Caveats and follow-ups

- The supply-side gate has its own abandonment cost ("build a full profile
  before you can even look"). The signup copy has to do the motivating —
  "get seen", benefit-framed steps — without fabricating anything.
- Follow-up, post-density: once launch cities have real numbers worth
  showing, surface live stats during supply-side signup ("your profile
  goes live to N verified members in London"). Not at launch — the honest
  number would be near zero and would work against the flow. Revisit when
  the liquidity threshold in [launch-plan.md](launch-plan.md) is met.

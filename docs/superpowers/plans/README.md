# SD Site — Implementation Plans

Implementation plans for the SD Site MVP, decomposed into sequential milestones. Each plan produces working, testable software on its own.

**Spec:** [`../specs/2026-05-09-sd-site-design.md`](../specs/2026-05-09-sd-site-design.md)

## Plan order

| #   | Plan                                                  | Status        | Outcome                                                                                                                                                                                              |
| --- | ----------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | [Project Foundations](./2026-05-09-01-foundations.md)              | ✅ complete    | Empty PWA shell that builds, deploys, tests; contract chain (Zod + generated types), OTEL no-op, i18n, Docker Supabase, CI green. No user-facing features.                                           |
| 02  | [Auth + Profile Foundation + Search Shell](./2026-05-10-02-auth-profile-search.md) | ✅ complete    | Person can sign up, complete onboarding (DOB ≥18, geocoding, single profile photo), browse other active profiles, view a bare profile. End-to-end.                                                   |
| 03  | [Profile Depth + Likes](./2026-05-14-03-profile-depth-likes.md) | ✅ complete    | Full profile fields (physical, lifestyle, interests), multiple photos, like/unlike, Likes tab, search filters, in-app banners.                                                                       |
| 04  | Token Economy + FauxProvider                          | to be written | Buy tokens via FauxProvider (sync test mode), balance display, ledger, webhook scaffolding. Admin grant for testing.                                                                                 |
| 05  | Messaging (text + photo)                              | to be written | First-message token charge, baby-initiated locked-card flow, unlock-conversation paywall, replies, photo messages with curated favourites album.                                                     |
| 06  | Secret Album + Read Receipts                          | to be written | Secret album upload, request/grant state machine (implicit + explicit), 10-token album unlock, locked/granted/unlocked rendering, read-receipts pill + unlock. Access requests as messages-tab rows. |
| 015 | [Location Gazetteer + Distance](./2026-07-17-015-location-gazetteer-and-distance.md) | ✅ complete    | GeoNames-seeded `places` gazetteer replaces postcodes.io; pick-from-list `PlaceCombobox` typeahead on signup and profile edit; profiles keyed on `place_id`; population-radius disc distance model; CC BY 4.0 attribution shipped in footer. |

## How to start the next plan

When the current plan is complete, ask Claude something like:

> _"Let's plan part 2"_ — or — _"Write plan 03"_

A fresh Claude session will read this README, the spec, and the existing plans, then invoke the `superpowers:writing-plans` skill to produce the next plan.

## How to execute a plan

Each plan document starts with a header pointing at the recommended sub-skill:

- **`superpowers:subagent-driven-development`** — recommended; fresh subagent per task with two-stage review
- **`superpowers:executing-plans`** — inline execution with batch checkpoints

Plans use checkbox (`- [ ]`) syntax for task tracking.

## Conventions

- Plan filenames: `YYYY-MM-DD-NN-<slug>.md` (date the plan was authored, NN is the plan number, slug is short)
- Each plan must be independently runnable on top of the previous plans being complete
- Each plan ends with a **What's next** section pointing at the next plan and any prerequisites it adds

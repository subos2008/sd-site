---
name: launch-next
description: Use when asked what to do next, what to do today or this week, for a launch status check or a mini project plan, or before picking up launch-related work in this repo.
---

# Launch: what's next

## Core rule: files, not memory

Multiple agents and sessions work this repo concurrently. Whatever this
conversation remembers about launch state is presumed stale — even from
earlier this session. Every time this skill runs, re-read the sources
below before answering, and run `git log --oneline -15` plus `git status`
to catch movement (including uncommitted work) the docs haven't absorbed
yet. If a remembered fact conflicts with a file, the file wins, silently.

## Sources (read in order)

1. `LAUNCH.md` — dates, gates, critical-path chains, workstreams A–E,
   "This week", decisions log. **This file governs**; if anything —
   including this skill — disagrees with it, LAUNCH.md wins.
2. `execution/README.md` — spec status table.
3. `docs/superpowers/plans/README.md` — build-plan status table.
4. `marketing/partner-space.md` and the docs it links — when the
   question touches partners, terms, or outreach.
5. `docs/payments/underwriting-pack.md` — when it touches payments
   readiness.

## Approximate external lead times (planning inputs, not gospel)

| Dependency | Lead time |
|---|---|
| UK Ltd incorporation + bank account | ~1–2 weeks (offshore routes: longer — ask counsel) |
| High-risk acquirer underwriting | 4–8 weeks from application |
| Review-site placement after a deal signs | ~2–4 weeks |
| Student media bookings | deadlines in August for September runs |
| Fixed external dates (2026) | GDI London 15–16 Sep; TES Prague 25–28 Sep; freshers weeks w/c 14 + 21 Sep |

## The answer's shape

Produce, in order:

1. **Where we are** — today's date against the next gate (beta /
   partner-ready / launch — take the dates from LAUNCH.md), with days
   remaining.
2. **Critical path check** — the external chains (entity → payments;
   partner deals) — moving or blocked, and what unblocks each.
3. **Do now** — a numbered list split into **founder-only** actions and
   **agent-doable** work, drawn from LAUNCH.md "This week" cross-checked
   against the status tables. An item marked to-do that the tables show
   done (or vice versa) is a finding — report it and fix the doc.
4. **Slips and risks** — timeline items now behind, each with the
   downstream date it threatens and the lead time that makes it urgent.
5. **Doc maintenance** — if the reading revealed stale state (completed
   items unticked, passed dates, unlogged decisions), update LAUNCH.md as
   part of answering and say what was updated.

Scale to the question: "what do I do today" gets part 3 with a one-line
part 1; "full status" gets all five parts.

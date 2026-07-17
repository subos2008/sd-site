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

## Authority: artifacts are ground truth, LAUNCH.md is the map

`LAUNCH.md` is the coordination layer — dates, gates, critical-path
chains, workstreams, "This week", decisions log. It is a snapshot, and
work lands in the artifacts first (specs, plan docs, marketing research,
code, git history), so **when LAUNCH.md disagrees with an artifact,
presume LAUNCH.md is the stale one** and verify against the artifact.
Part of this skill's job is closing that gap — see Reconciliation.

## Sources (read in order)

1. `LAUNCH.md` — the map to check everything else against.
2. `execution/README.md` — spec status table.
3. `docs/superpowers/plans/README.md` — build-plan status table.
4. `marketing/partner-space.md` and the docs it links — when the
   question touches partners, terms, or outreach.
5. `docs/payments/underwriting-pack.md` — when it touches payments
   readiness.
6. `git log --oneline -15` + `git status` — always.

## Approximate external lead times (planning inputs, not gospel)

| Dependency | Lead time |
|---|---|
| UK Ltd incorporation + bank account | ~1–2 weeks (offshore routes: longer — ask counsel) |
| High-risk acquirer underwriting | 4–8 weeks from application |
| Review-site placement after a deal signs | ~2–4 weeks |
| Student media bookings | deadlines in August for September runs |
| Fixed external dates (2026) | GDI London 15–16 Sep; TES Prague 25–28 Sep; freshers weeks w/c 14 + 21 Sep |

## Reconciliation (when LAUNCH.md and artifacts diverge)

Classify each divergence:

- **Mechanical drift** — an item LAUNCH.md marks to-do that an artifact
  shows done (or vice versa), passed dates, stale statuses, missing links
  to new docs. Update LAUNCH.md as part of answering and list exactly
  what was changed and on what evidence.
- **Material divergence** — research or new work that invalidates a
  decision, moves a date/gate, changes scope, or belongs in the decisions
  log. Do NOT silently rewrite these: present the divergence, the
  evidence, and the proposed LAUNCH.md edit to Ryan in the answer, and
  apply it on his confirmation. (Running as a subagent with no user
  channel: report the proposed edit as a finding instead of applying it.)

## The answer's shape

Produce, in order:

1. **Where we are** — today's date against the next gate (beta /
   partner-ready / launch — dates from LAUNCH.md, sanity-checked), with
   days remaining.
2. **Critical path check** — the external chains (entity → payments;
   partner deals) — moving or blocked, and what unblocks each.
3. **Do now** — a numbered list split into **founder-only** actions and
   **agent-doable** work, drawn from LAUNCH.md "This week" cross-checked
   against the artifacts.
4. **Slips and risks** — timeline items now behind, each with the
   downstream date it threatens and the lead time that makes it urgent.
5. **Reconciliation report** — mechanical fixes applied (what and why),
   and material divergences proposed to Ryan for confirmation. "None"
   is a valid report.

Scale to the question: "what do I do today" gets part 3 with a one-line
part 1; "full status" gets all five parts.

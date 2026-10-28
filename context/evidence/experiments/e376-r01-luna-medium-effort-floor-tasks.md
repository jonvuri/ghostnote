---
title: E376 — R01 Luna at medium effort on the floor tasks p13 and p14
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E376 — R01 Luna at medium effort on the floor tasks p13 and p14

Date: 2026-10-28. Stage: **development**. This is a probe requested by the
operator after [E375](e375-r01-package-v5-three-repeat-development-pass.md),
where Luna at `low` failed p13 and p14 in every format and repeat (0/30). It
is not a cohort change or a candidate comparison. Subscription CLI calls were
made within the operator's standing scope. No API billing or Bitwig contact
occurred.

## Harness changes

- **Probe profile.** `codex-current-medium` is `codex-current` (Luna, Codex
  0.163.0) at `model_reasoning_effort="medium"`. The runner admits it only
  in development subsets, never in a full pass or the rigorous stage.
- **Codex context policy v3.** The v2 template pins `reasoning.effort: "low"`,
  so a medium request would fail the audit. Version 3 requires
  `reasoning.effort` to equal the profile's declared effort and otherwise
  compares every field as v2 did. A low request under a medium profile, or
  the reverse, still fails. For `codex-current` the check is unchanged in
  effect.

Both files are among the v5 execution manifest's recorded source hashes. The
start check (package, prompts, plan, scoring and feedback) is unaffected, and
the manifest test now compares everything except those two source hashes.
237 focused tests pass.

## Run (`dev-v5-luna-medium-floor`)

Package `pilot-development-v5`, cohort `codex-current-medium`, tasks p13 and
p14 on all five eligible arms, three repeats: 30 runs, a recorded subset with
its own seeded order. It ran from 00:23 to 00:29 UTC with 69 submissions and
no halt, stall, quota pause or control failure. Every captured request carried
`reasoning.effort: "medium"` and passed policy v3.

| Cells (first attempt, within budget) | Luna `low` (E375) | Luna `medium` |
|---|---|---|
| p13 read a derived-onset window, 15 runs | 0 (0) | **1 (3)** |
| p14 group existing notes, 15 runs | 0 (0) | **8 (10)** |
| Median output on initial answers | 321 | 429 (1.3×) |

By arm, first attempt out of three (within budget in parentheses):

| Arm | p13 | p14 |
|---|---|---|
| C3 FIELDS | 0 (0) | 1 (2) |
| C4 FIELDS | 0 (0) | 1 (2) |
| C3 JSON | 0 (0) | **3 (3)** |
| C4 JSON | 0 (1) | **3 (3)** |
| C4 detached FIELDS | 1 (2) | 0 (0) |

Luna reported reasoning tokens on 6 of 69 submissions (444–516 each) and 0
on the rest; at `low` it reported none (E365).

## Findings

- **p14 is no longer at the floor.** At medium, Luna computed the
  onset-preserving spreads on both JSON arms every time. FIELDS arms passed
  once each, and the detached arm failed on source-state mismatches or a
  duplicate note definition. The remaining C3 FIELDS failures are timing-equation
  mismatches, as at low.
- **p13 stays at the floor.** Answers still omit in-range notes, include
  notes outside the range or sort by group rather than onset, in both C3
  (explicit onsets) and C4. The one first-attempt pass was on detached C4
  FIELDS.
- **Format signal.** At medium, neither task separates C3 from C4 (p14: C3
  FIELDS 1 versus C4 FIELDS 1, C3 JSON 3 versus C4 JSON 3).

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/): `dev-v5-luna-medium-floor/`
(plan, results SHA-256 `663bfc25…`, session and progress log),
`analysis-v5-luna-medium-floor.json` (`dfb61184…`) and
`summary-v5-luna-medium-floor.json` (`26ae2c57…`). Raw attempt directories
remain in the ignored `.tmp/`.

## Limits

One synthetic instance per task, three repeats per arm. The low-effort
comparison comes from E375's full-plan order, the medium run from a subset
order. Reasoning usage is client-reported and mostly zero.

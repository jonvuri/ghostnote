---
title: E377 — R01 Luna at medium effort on the remaining v5 tasks
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E377 — R01 Luna at medium effort on the remaining v5 tasks

Date: 2026-10-28. Stage: **development**. The operator asked how much medium
effort raises Luna on the tasks other than the floor tasks of
[E376](e376-r01-luna-medium-effort-floor-tasks.md). This is a development
probe with the E376 profile `codex-current-medium` and Codex context policy
v3; it is not a cohort change or a candidate comparison. Subscription CLI
calls were made within the operator's standing scope. No API billing or
Bitwig contact occurred.

## Run (`dev-v5-luna-medium-rest`)

Package `pilot-development-v5`, tasks p01–p12, p15 and p16 on every eligible
arm, three repeats: 231 runs, a recorded subset with its own seeded order.
It ran from 00:43 to 01:32 UTC with 390 submissions and no halt, stall, quota
pause or control failure. Together with E376, it covers all 87 v5 cells at
medium, three repeats each. The low-effort comparison is Luna's cohort in
[E375](e375-r01-package-v5-three-repeat-development-pass.md), over the same
cells.

| Same 231 runs | Luna `low` (E375) | Luna `medium` |
|---|---|---|
| First-attempt passes | 119 (51.5%) | **136** (58.9%) |
| Within two corrections | 143 | **174** |
| Median output on initial answers | 349 | 468 (1.3×) |
| Submissions with reported reasoning tokens | 0 | 69 of 390 (21,057 tokens) |

Over all 87 cells (with E376), Luna went from 119/261 to 145/261 on the first
attempt and from 143 to 187 within budget. Haiku `low` scored 252/261 in E375.

Per task, first attempt out of runs (within budget in parentheses):

| Task | `low` | `medium` |
|---|---|---|
| p01 sounding at T | 0/18 (3) | 5/18 (6) |
| p02 read group timing | 6/15 (6) | 6/15 (8) |
| p03 author six notes | 15/18 (15) | 15/18 (16) |
| p04 author a timed group | 6/15 (10) | 7/15 (11) |
| p05 edit one velocity | 13/18 (15) | 13/18 (15) |
| p06 transpose every pitch-34 note | 15/18 (15) | 15/18 (16) |
| p07 halve spreads, move anchor | 6/15 (6) | 8/15 (8) |
| p08 shift and transpose [F, T) | 0/18 (1) | 2/18 (8) |
| p09 near-miss delete | 5/18 (10) | 10/18 (13) |
| p10 refuse ambiguous selector | **9/18** (17) | **4/18** (17) |
| p11 preserve window | 16/18 (17) | 18/18 (18) |
| p12 preserve exact wider state | 12/12 (12) | 12/12 (12) |
| p15 move a member between groups | 7/15 (7) | 8/15 (12) |
| p16 retime two groups | 9/15 (9) | 13/15 (14) |

Performed arms over the eight performed tasks, first attempt of 24 (within
budget):

| Arm | `low` | `medium` |
|---|---|---|
| Ghostnote FIELDS | 15 (17) | 18 (21) |
| Ghostnote JSON | 14 (16) | 13 (17) |
| C3 FIELDS | 15 (19) | 14 (19) |
| C4 FIELDS | 14 (18) | 18 (21) |
| Producer Pal MIDI JSON | 13 (19) | 15 (21) |
| Producer Pal bar\|beat | 2 (4) | 4 (10) |

Source arms over all eight source tasks (with E376), first attempt of 24:
C3 FIELDS 6 → 10, C4 FIELDS 15 → 16, C3 JSON 6 → 13, C4 JSON 11 → 15;
detached FIELDS (21 runs) 8 → 9.

## Findings

- **Medium raises Luna moderately, not uniformly.** It adds 17
  first-attempt passes over these 231 runs (+7 points) and 31 within budget.
  It does not close the gap to Haiku `low`.
- **Gains are concentrated in boundary and multi-step tasks.** These are p09
  (5 → 10), p16 (9 → 13), p01 (0 → 5) and, within budget, p08 (1 → 8). Easy
  edits and preservation (p03, p05, p06, p11, p12) barely change, mostly
  because they were already near Luna's ceiling.
- **The refusal task gets worse.** p10 fell from 9/18 to 4/18. At medium,
  Luna more often deletes one of the two matching notes (11 of 18 initial
  answers return a surface) instead of returning `REFUSE ambiguous-selector`.
  Corrections still recover it (17/18 within budget at both efforts).
- **The C3/C4 gap narrows at medium.** On the source tasks, C3 FIELDS rose
  from 6 to 10 of 24 and C4 FIELDS stayed near 15–16. Medium partly fixes
  C3's failure to recompute explicit onsets (p16 C3 FIELDS 0 → 2 of 3).
  p07 and p15 on C3 FIELDS remain 0/3.
- **bar|beat stays the hardest arm** (4/24 first attempt, 10/24 within budget).
- **Cost.** Median output per initial answer rose 1.3×; Luna still reports
  reasoning tokens on a minority of submissions.

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/): `dev-v5-luna-medium-rest/`
(plan, results SHA-256 `5505d5dc…`, session and progress log),
`analysis-v5-luna-medium-rest.json` (`39b5f04c…`) and
`summary-v5-luna-medium-rest.json` (`d4b38d2d…`). Raw attempt directories
remain in the ignored `.tmp/`.

## Limits

Development evidence on reused inputs and one synthetic seed; three repeats
per cell and per effort. The medium runs use subset orders and the low runs
the full-plan order. Usage is client-reported; Luna's reported reasoning is
mostly zero, so the token cost of medium is uncertain.

---
title: E374 — R01 package v5 (group-timing tasks): build, rehearsal and one-repeat check
kind: evidence
state: done
updated: 2026-10-27
owner: R01
---

# E374 — R01 package v5 (group-timing tasks): build, rehearsal and one-repeat check

Date: 2026-10-27. Stage: **development**. These results support design
iteration only; they are not a candidate comparison. Subscription CLI calls
were made within the operator's standing scope. No API billing or Bitwig
contact occurred.

## Package and offline rehearsal

Package `pilot-development-v5`
([D63](../../../spec/r01-research/decisions/d63-r01-package-v5-group-timing-tasks.md)) is v4 plus
four synthetic source tasks, `p13`–`p16`. The build has 16 tasks, 120 scheduled
cells, 87 eligible cells and 33 exclusions. Every v4 cell, prompt and card is
byte-identical. Each new task is eligible on C3 FIELDS, C4 FIELDS, C3 JSON,
C4 JSON and detached C4 FIELDS. Their prompts are 1,211–1,730 local tokens.

All 87 goldens pass. The rehearsal scores 105 task-specific variants as 568
wrong answers and rejects all of them, each as a semantic mismatch rather than
a parse error. No variant equals the oracle. All 81 gratuitous refusals are
rejected and all 81 unreduced respellings pass. The unencodable list is
unchanged (two p11 baseline duplicates). No new fixture requires C4 `order`
cells. The retired v4 execution manifest still regenerates apart from its
source-file hashes. The 236 focused tests pass, three more than after D62.

| Artifact | SHA-256 |
|---|---|
| [package manifest](../data/r01-pilot-inputs/v5/package/manifest.json) | `7330ed2f93336646…` |
| [execution manifest](../data/r01-pilot-inputs/v5/execution/manifest.json) | `40365bf9a1feced1…` |
| [rehearsal](../data/r01-pilot-inputs/v5/execution/rehearsal.json) | `71fb61a3f7736bd5…` |
| plan (`planSha256`) | `a05154fe13c038a8…` |

## One-repeat check (`dev-v5-r1`)

One repeat, both cohorts, 174 runs, from 20:38 to 21:14 UTC. `start` matched
the v5 execution manifest. The binaries (Claude Code 2.1.302 at SHA-256
`5262ce9d…`, Codex 0.163.0) and Node v24.11.1 were unchanged. The run completed
with 270 submissions, no halt, no quota pause and no control failure. One Luna
correction stalled (p15 detached FIELDS, attempt 1); its identical
resubmission answered, and the run continued.

| | Haiku 5.5 | Luna |
|---|---|---|
| First-attempt passes, all 87 cells | **82** | **39** |
| Within two corrections | 87 | 49 |
| First attempt on p13–p16 (20 cells) | **19** (95%) | **5** (25%) |
| Within budget on p13–p16 | 20 | 6 |
| Submissions | 95 | 175 |
| Input / output tokens (client-reported) | 315,887 / 226,354 | 909,957 / 119,429 |
| Median output on initial answers | 1,724 | 349 (4.9×) |

On p01–p12, Haiku passed 63/67 and Luna 34/67 on the first attempt, close to
E372's 64 and 35.

Per new task, first attempt out of five cells (within budget in parentheses):

| Task | Haiku | Luna |
|---|---|---|
| p13 read a derived-onset window | 4 (5) | 0 (0) |
| p14 group existing notes | 5 (5) | 0 (0) |
| p15 move a member between groups | 5 (5) | 2 (3) |
| p16 retime two groups | 5 (5) | 3 (3) |

By arm on p13–p16, first attempt out of four (within budget in parentheses):

| Arm | Haiku | Luna |
|---|---|---|
| C3 FIELDS | 4 (4) | 0 (0) |
| C4 FIELDS | 4 (4) | 2 (2) |
| C3 JSON | 3 (4) | 0 (0) |
| C4 JSON | 4 (4) | 2 (2) |
| C4 detached FIELDS | 4 (4) | 1 (2) |

Across all eight source tasks, C3 FIELDS passed 8/8 for Haiku and 2/8 for
Luna; C4 FIELDS passed 8/8 and 5/8.

## Failing answers on p13–p16

Every failing answer on the new tasks was read.

- **Haiku p13 C3 JSON** omitted `fa`, an untimed member of the timing-free
  group, and was correct on correction.
- **Luna p13** failed on every arm. On C3 FIELDS, where every onset is
  explicit, it omitted both untimed group members and the loose note `lb` and
  included `sc`, which sits at the excluded upper bound. On C4 FIELDS it listed
  14 notes, including notes outside the range; on C4 JSON it omitted the in-range
  members of the first and third groups.
- **Luna p14** failed on every arm. On C3 it wrote negative spreads (for
  example `-19/128` for a note whose spread is 0), which contradict the
  unchanged onsets, so the answer fails the timing equation. On C4 FIELDS the
  spreads were also wrong, and the new group block was placed after the
  `NOTES` block, which changes note-array order. Detached FIELDS answers
  defined `na` twice or used `REF` outside a group.
- **Luna p15 and p16 on C3** updated the group context correctly but did not
  recompute the explicit onsets: `da` became `259/64` instead of `65/16`, and
  `aa` became `557/256` instead of `347/128`. The parser rejects the resulting
  timing-equation mismatch. On C4, where onsets are derived, Luna passed p15
  and p16 on FIELDS and JSON.

These are model errors in the operations under test. No wording, card or
scorer defect was found. The p14 block-order failure is a property of C4 under
exact note-order scoring, which the contract states; it did not decide the
result, because the spreads were also wrong.

## Calibration decision: no v6

The target band on the new tasks was Haiku about 80–90% and Luna about 40–60%.
Haiku (95%) is just above its band. Luna (25%) is below, because p13 and p14
failed on every arm. The brief allows one revision only if the new tasks fall
well outside the band or a defect appears. Package v6 was not built, for three
reasons:

- No defect appeared.
- Luna's failures are the targeted operations (range reads over derived
  onsets, decomposition arithmetic, recomputing explicit onsets). Easing them
  would move Haiku to the ceiling.
- p15 and p16 already separate the formats for Luna (C4 FIELDS and JSON 4/4,
  C3 FIELDS and JSON 0/4), and Haiku still misses an occasional cell.

The three-repeat pass of v5 followed.

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/): `dev-v5-r1/` (plan,
results SHA-256 `fe941fca…`, session and progress log),
`analysis-v5-r1.json` (`9a5a2b05…`, every submission classified with
`pilot-analysis.mjs`) and `summary-v5-r1.json` (`582191b5…`, per-task,
per-arm and per-cell counts). Raw attempt directories remain in the ignored
`.tmp/`.

## Limits

This is one repeat on reused works A–C and one synthetic seed. Each new task
has one instance and five cells per cohort, so the per-arm counts on p13–p16
are four runs each. Usage is client-reported.

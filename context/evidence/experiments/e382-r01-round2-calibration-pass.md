---
title: E382 — R01 round 2 calibration pass (one instance, one repeat, four cohorts)
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E382 — R01 round 2 calibration pass

Date: 2026-10-28. Stage: **development**, round 2
([brief](../../work/r01-round-2-difficulty-scaling.md) step 4). The operator
accepted R01-D13 and approved the pass, with `gpt-5.6-terra` as the only
Terra ("Just 5.6 first."). Subscription CLI calls only; no API billing or
Bitwig contact. This is calibration evidence: one instance per level and one
repeat, so every cell is a single observation.

## Run

Package `round2-development-v1`, `--instances 1 --repeats 1`, on Claude Code
2.1.302 and Codex 0.163.0 (pins and authentication checked before the
start). The pass ran from 13:33 to 18:32 UTC: **448/448 runs in 639
submissions**. There was no control failure, halt, quota pause or stall. The
slowest submission used 26% of its limit (57 s of 220 s), so no timeout
decided an outcome. Plan, results and session are in
[`round2-calibration-r1/`](../data/r01-pilot-runs/round2-calibration-r1/), and
the measures are in
[`analysis-round2-calibration-r1.json`](../data/r01-pilot-runs/analysis-round2-calibration-r1.json).
Attempt captures stay in ignored `.tmp/`.

| Cohort | First attempt | Within budget | Submissions | Median generated / reasoning tokens (first attempt) | Median elapsed |
|---|---|---|---|---|---|
| Haiku 5.5 `low` | 104/112 | 112/112 | 121 | 3,713 / 1,013 | 13.2 s |
| Luna `medium` | 49/112 | 66/112 | 226 | 1,386 / 0 | 14.4 s |
| Haiku 4.5 (thinking 1,024) | 85/112 | 94/112 | 159 | 2,935 / 647 | 18.8 s |
| `gpt-5.6-terra` `low` | 96/112 | 109/112 | 133 | 2,321 / 149 | 28.8 s |

## Ladders: first-attempt passes over primary arms

Each entry is level:passes/arms (six arms on performed families, C3 and C4
FIELDS on source families). Values below half are in bold.

| Family | Haiku 5.5 | Luna | Haiku 4.5 | Terra |
|---|---|---|---|---|
| derived-read (groups) | 1:2/2 2:2/2 4:2/2 8:1/2 | **1:0/2 2:0/2 4:0/2 8:0/2** | 1:2/2 2:1/2 **4:0/2 8:0/2** | 1:2/2 2:2/2 4:2/2 8:1/2 |
| group-retime (groups) | all 2/2 | 1:1/2 2:2/2 4:1/2 8:1/2 | 1–4:2/2 **8:0/2** | all 2/2 |
| regroup (groups) | all 2/2 | 1:1/2 **2:0/2 4:0/2 6:0/2** | 1:2/2 2:1/2 4:2/2 **6:0/2** | 1:2/2 2:1/2 4:1/2 6:2/2 |
| member-move (moves) | all 2/2 | 1–4:2/2 6:1/2 | all 2/2 | all 2/2 |
| range-edit (notes) | 64:5/6 128:6/6 256:4/6 512:4/6 | **64:0/6 128:2/6 256:2/6 512:1/6** | 64:4/6 128:4/6 256:4/6 **512:1/6** | 64:4/6 128:5/6 256:4/6 **512:0/6** |
| selective-delete (near misses) | all 6/6 | **1:1/6 3:1/6 6:1/6** | 1:6/6 3:5/6 6:5/6 | 1:6/6 3:5/6 6:5/6 |
| preserve-performed (notes) | 128:6/6 256:5/6 512:6/6 | 128:5/6 256:6/6 512:4/6 | all 6/6 | all 6/6 |
| preserve-exact (notes) | all 2/2 | all 2/2 | all 2/2 | all 2/2 |

- **Haiku 5.5** stays at or above half on every level. Only range-edit (4/6
  at 256 and 512) and the eight-group read (1/2) fall below the ceiling.
  Its ladders do not reach failure.
- **Terra `low`** is close to Haiku 5.5 overall. It breaks only on range-edit
  at 512 (0/6), and two 512-note answers were complete documents that
  omitted most notes (298 and 480 dropped); corrections recovered both.
- **Haiku 4.5** spans pass to fail on four families: read (breaks at 4),
  retime (8), regroup (6) and range-edit (512).
- **Luna `medium`** is at its floor at level 1 on read, regroup (after 1/2
  at level 1), range-edit and selective-delete. On selective-delete, 9 of
  its failed submissions were gratuitous refusals.
- **Preservation** is at the ceiling for every cohort up to 512 notes, apart
  from Luna's scattered misses. It measures cost here, not a breaking point.

Fitted breaking points per cohort × arm × family are in the analysis file.
With one instance they have no interval and follow the single observations
above, so this record does not report them as estimates.

## Formats

These are single observations, so they are signals for the development pass
to test, not results.

- **C3 versus C4 FIELDS on group edits** repeats round 1 for Luna. On retime,
  C4 passes 4/4 and C3 1/4, and all three C3 failures are validator-caught. On
  regroup, Luna's C3 fails all four levels at the validator. Terra fails C4
  regroup at 2 and 4 while passing C3. Haiku 5.5 passes both everywhere.
- **bar|beat** is the hardest performed arm on range-edit. It fails every
  level for Luna, Haiku 4.5 and Terra, and Haiku 5.5's 512-note bar|beat
  pass generated 74,832 tokens (243 s), against 13,907–27,436 for its other
  arms.
- **Error visibility.** Validator-caught failures are 38 of Luna's 160 failed
  submissions (24%) and 7 of Haiku 4.5's 65; for Luna's C3 FIELDS they are
  22 of 39 (56%). Other arms are mostly silent wrong states. Under the
  brief's agentic criterion (at least a third for some format), C3 FIELDS
  qualifies for Luna in this pass.

## Cost at the ceiling

Where every arm passes, output size follows the format. On 512-note
preservation (Haiku 5.5, all six arms pass), first answers are 6,413 local
tokens for bar|beat, 9,239 for MIDI JSON, 9,765 for C3 FIELDS, 10,284 for C4
FIELDS, 11,885 for baseline FIELDS and 16,500 for baseline JSON (2.6× from
smallest to largest). Elapsed time scales with it, from 25 s for bar|beat to
65 s for baseline JSON. Terra is slower at the same sizes (102–226 s).

## Terra decision rule

The brief's rule was fixed before these data:

- Luna is below half at level 1 on three of six non-preservation families
  (read, range-edit, delete) and at half on a fourth (regroup), so its
  breaking point is not informative there. Terra's is not at level 1 on any
  family (row 1 of the rule).
- Luna still separates C3 from C4 on retime and regroup, which is format
  information Terra does not give. Terra separates formats on range-edit
  (bar|beat) and in the other direction on regroup (row 2).

Both rows partly hold. Under row 2, Terra would be added as a third Codex
cohort rather than replacing Luna. This reading needs the operator's
decision.

## Level adjustment (proposed, not built)

R01-D11 allows per-cohort ladders, with all formats in a cohort sharing one.
Proposed for the development pass:

| Cohort | Proposal |
|---|---|
| Haiku 5.5, Terra | Raise group families: read and retime 2, 4, 8, 16; regroup and move 2, 4, 6, 10. Keep range-edit 128, 256, 512 (material-limited). Selective-delete stays at its ceiling; drop it or extend near misses beyond 6. |
| Haiku 4.5 | Keep read, retime, regroup and range-edit; raise move to 2, 4, 6, 10. |
| Luna | Lower range-edit to 16, 32, 64, 128. Report read, regroup and delete as floor families unless a lower first rung (for example a one-member read) is added. |
| All | Run preservation at 512 only, as a cost measure. |

Per-cohort ladders need a package containing the union of levels and a
runner selection that gives each cohort its own task list. Neither is built.

## Checks

- No task, prompt or scorer defect was found. The failures inspected were
  model errors, all of them planted boundary cases: tie order, omitted
  untimed or loose notes, near misses, the range bounds and abbreviated
  documents.
- One analysis label was wrong: a parsed but incorrect JSON answer was
  labelled `no-answer`. It is fixed in `round2-analysis.mjs`, and the
  retained analysis was regenerated with the fix.
- 259 focused tests pass.

## Limits

One instance and one repeat per cell. Non-monotone ladders (Terra regroup
1/2, 1/2, 2/2) are single-observation noise as much as signal. Cohorts run
at different efforts, so cross-cohort differences are not matched-effort
rankings (R01-D9). The 512-note material is one piano part.

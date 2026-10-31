---
title: E388 — R01 round 2 format-dependent families and v4 calibration packages (offline)
kind: evidence
state: done
updated: 2026-10-30
owner: R01
---

# E388 — R01 round 2: format-dependent families and v4 calibration packages

Date: 2026-10-30. Stage: **development**, round 2, step 6.1 of the
[brief](../../work/r01-round-2-difficulty-scaling.md#next-steps-handoff-2026-10-30-after-e387-format-dependent-families).
Offline only: no model call, API billing or Bitwig contact. The design
choices are proposed in [R01-D20](../../../spec/r01-research/decisions/r01-d20-round-2-format-dependent-family-designs-and-calibration.md)
(awaiting the operator).

## What was built

- **Generators.** [`round2-families.mjs`](../../../brain/benchmarks/r01-candidates/round2-families.mjs)
  builds four synthetic families from seed `r01-round2-families-v1`. Each
  family has a level parameter, an expected state computed without any codec,
  and level-aware wrong answers. The families are query-selected edit,
  overlapping memberships, edit within large state and interpretation
  maintenance. The task rules are `r01-round2-task-rules-v4`.
- **Wiring.** Package version 4 is synthetic, with no windows file. Selection
  v4 (seed `r01-round2-order-v4`) labels its full pass `calibration`. The
  execution manifest uses v4 controls (v3's plus R01-D19 and R01-D20) and
  records a null windows hash. Packages v1–v3 regenerate unchanged.
- **Packages.** [`v4/haiku`](../data/r01-round2/v4/haiku/) and
  [`v4/luna`](../data/r01-round2/v4/luna/) each hold 16 tasks (4 families ×
  4 levels × instance 1) and 32 eligible C3/C4 FIELDS cells. Their prompts
  are byte-identical between cohorts.

| Package | Manifest SHA-256 | Execution manifest | Plan |
|---|---|---|---|
| `round2-development-v4-haiku` | `1b1f33b5…` | `1031af81…` | `db5e9e0e…`, 32 runs |
| `round2-development-v4-luna` | `36a07600…` | `e229f6b3…` | `316dcd5b…`, 32 runs |

## Rehearsal and tests

- **Rehearsal, per package.** All 32 goldens and all 32 equivalent
  (unreduced) spellings pass. All 316 task-specific wrong answers (158
  variants) and 32 gratuitous refusals are rejected. No variant fails to
  distinguish, and none is unencodable. A misreading that cannot occur at a
  level is omitted there: for example, the anchor rule at two edits, which
  include no anchor edit.
- **Focused tests.** 272 pass: 265 existing and 7 new in
  `round2-families.test.mjs`. The new tests check that every level validates,
  keeps block-traversal order (no order cells) and round-trips in both
  surfaces. They also recompute each family's rule independently:
  - query-edit selection and bound cases;
  - owned-only timing and one-group removal in overlap-edit;
  - exactly the expected changed notes and groups in large-edit;
  - interp-maintain lifecycle against `structured.mjs` `editNote` for
    instances 1–3 without anchor edits, and by rule otherwise.

  Finally, they check that the retained packages regenerate and match their
  pins.

## Sizes (golden output, local o200k tokens; instance 1)

| Family | Levels | C3 FIELDS | C4 FIELDS | C4/C3 | Timeout |
|---|---|---|---|---|---|
| query-edit | 4–32 groups | 969–6,707 | 741–4,789 | 0.71–0.76 | 180–530 s |
| overlap-edit | 2–8 memberships | 1,297–2,219 | 952–1,726 | 0.73–0.78 | 200–260 s |
| large-edit | 64–384 notes | 3,713–20,645 | 2,599–14,664 | 0.70–0.71 | 350–1,360 s |
| interp-maintain | 2–12 edits | 1,094–4,085 | 957–3,492 | 0.85–0.87 | 190–370 s |

Prompts range from 1,777 to 21,579 tokens. C4 answers are 13–30% smaller in
every family. This is the format's intrinsic size cost, not agent evidence.

## Observations

- **Formats differ in where structure lives.** In C3, CONTEXT carries every
  group's anchor, delay, spread map and member orders. A group retime
  therefore changes CONTEXT and every owned member's explicit onset; ownership
  must be read from the spread map. In C4, ownership is visible as NOTE
  against REF. Removing a note from one overlay is a single REF line in C4,
  but a CONTEXT member list (and order list) plus the row's groups cell in C3.
- **Large-edit capped at 384 notes.** At 512 notes the C3 answer would be
  about 28k tokens, above the 19k proven in v2. The risk is an output-limit
  truncation that would look like a format failure (R01-D20).

## Next

The operator decides R01-D20 and approves calibration: 32 runs per cohort,
in parallel, about an hour. From `brain/`, one process per package:

```
node --import tsx benchmarks/r01-candidates/cli-pilot-runner.mjs start \
  ../.tmp/r01-tooling/producer-pal ../.tmp/r01-tooling/tooling \
  round2-development-v4-haiku ../.tmp/NEW_OUTPUT
```

Use the same command with `round2-development-v4-luna` and a second output
directory. Then analyse both runs with `round2-analysis.mjs DIR:COHORT …`.

## Limits

- No model call; this is an offline scorer rehearsal and size measurement.
- The levels are uncalibrated guesses, shared by both cohorts.
- Synthetic structure only; no musical material or intent.
- One instance per level by design. Calibration results choose levels and
  are not format comparisons.

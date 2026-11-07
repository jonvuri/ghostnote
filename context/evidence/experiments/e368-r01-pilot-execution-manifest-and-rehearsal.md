---
title: E368 — R01 pilot execution manifest and task-specific offline rehearsal
kind: evidence
state: done
updated: 2026-10-26
owner: R01
---

# E368 — R01 pilot execution manifest and task-specific offline rehearsal

Date: 2026-10-26. Stage: **development**. No model call, Bitwig contact or
library write occurred. This record completes step 3 of the R01 brief's
[resume section](../../work/r01-format-comparison.md#resume-development-runs)
for package `pilot-development-v2`
([E367](e367-r01-pilot-inputs-v2-dense-windows-velocities.md)).

## Result

The [execution manifest](../data/r01-pilot-inputs/v2/execution/manifest.json)
(SHA-256 `5928812f…a976`) is labeled `development`, with status
`pinned-not-submitted`. It pins:

- the package manifest (SHA-256 `f59aca29…1030`), the windows file, task-rule
  schema, synthetic and velocity seeds, and the package tooling pins;
- for each of 67 eligible cells, the payload (encoded input), prompt, card and
  golden-oracle hashes; for each task, a canonical hash of its private oracle;
  and the reason for each of the 17 exclusions;
- the full-pass selection (order seed `r01-pilot-order-v1`, three repeats, at
  most two corrections, 120 s), both cohort configuration hashes and profiles,
  the canonical hash of `plan.json` as the runner writes it (`dc5427d2…9814`),
  and the materialized order per cohort: 201 initial runs each (402 total,
  1,206 maximum submissions), 102 exclusion slots.

The pilot runner now refuses to `start` package `pilot-development-v2` unless
the package hash and each run's prompt hash match the manifest. A full pass
must also match the plan hash and per-cohort order. A recorded subset keeps
its own seeded order and is checked run by run.

The [task-specific rehearsal](../data/r01-pilot-inputs/v2/execution/rehearsal.json)
(SHA-256 `71945307…9684`) accepts all 67 goldens. It rejects all 389 scored
task-specific wrong answers and all 61 gratuitous refusals. Every rejection is
a semantic mismatch: 55 answer, 208 performed-state, 84 exact-source and 42
required-refusal mismatches. No parser failure occurs on a well-formed wrong
answer.

| Task | Wrong answers (each encoded for every eligible arm) |
|---|---|
| p01 count | total off by one; onsets before eight bars instead of quarter 8; fields swapped; counts as strings; missing field |
| p02 group timing | delay and spread swapped; onset omits delay; onset omits spread; another member's spread; decimal instead of rational |
| p03 author | one note missing; an extra note; two onsets swapped; one pitch an octave off; velocities defaulted to 100 |
| p04 author group | onset omits common delay (delay 0); spreads doubled; group omitted; performance order reversed; provenance `inferred`; label omitted |
| p05 velocity | untouched target; neighbor edited; whole onset edited; whole pitch edited; target deleted; other velocities reset to 64 |
| p06 transpose | untouched target; transposed down; one semitone; neighbor transposed; whole onset transposed; copy added with original kept; duration changed |
| p07 halve spreads | untouched; spreads doubled; spreads quartered; common delay halved too; protected group dropped; loose note moved |
| p08 shift range | untouched; end time moved instead of onset; end time preserved; shifted earlier; shifted by 1/4; range one quarter late; every note shifted |
| p09 delete | untouched target; neighbor deleted; target and neighbor deleted; whole pitch deleted; whole onset deleted |
| p10 refusal | wrong code `ambiguous`; `unsupported`; code with explanation; lowercase; first match deleted; both deleted; input returned |
| p11 preserve | one note dropped; velocities reset to 64; onsets quantized to 1/16; duplicate added; durations halved |
| p12 preserve exact | annotation dropped; note order swapped; non-grid onset rounded to 1/512; pan zeroed; chance dropped; channel defaulted |

Variants are derived from each task's input and oracle, not from the
generator's target rules: edited targets come from the input/oracle difference,
and neighbors are adjacent notes in onset/pitch/ID order.

Two kinds of variant are excluded from the rejection counts and listed:

- **Not distinguishing in these inputs (3).** A variant equal to the oracle
  under the task's own comparison is dropped. Window A has no note at onset 8,
  no duplicate pitch/onset address and no onset exactly at p08's upper bound.
  This removes p01's inclusive-bound and collapsed-duplicate counts and p08's
  inclusive upper bound.
- **Unencodable in an arm (2).** The baseline FIELDS and JSON encoders refuse
  p11's duplicate note (rule R04, duplicate normalized event address), so a
  model cannot express that state in those arms. The other four p11 arms
  score and reject it.

## Artifacts and reproduction

- [`pilot-execution.mjs`](../../../brain/benchmarks/r01-candidates/pilot-execution.mjs)
  declares the wrong answers, runs the rehearsal and builds the manifest.
  [`cli-pilot-runner.mjs`](../../../brain/benchmarks/r01-candidates/cli-pilot-runner.mjs)
  adds `checkExecution` and the start-time check.
- From `brain/`: `node --import tsx benchmarks/r01-candidates/pilot-execution.mjs PINNED_PP pilot-development-v2 NEW_DIR`.
  A second build regenerated both files byte-identically. The output contains
  no timestamp.
- 225 focused tests pass (221 + 4 in `pilot-execution.test.mjs`): byte-identical
  regeneration, rehearsal counts and reasons, variant naming and dropping, and
  start refusals for a changed package, seed, prompt, order and stage.

## Limits

The rehearsal tests the scorer, not models. The wrong answers are plausible
misreadings chosen by the author and do not cover all model errors. The plan
hash includes the cohort profiles; a profile change requires a new manifest.
Development stage only; works A–C remain development material.

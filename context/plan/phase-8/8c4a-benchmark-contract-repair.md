---
title: Phase 8c4a — Benchmark contract repair
kind: plan
state: complete
status: Complete. E156 records the repaired contracts and frozen calibration package.
updated: 2026-09-27
parent: README.md
prev: 8c3-full-symbolic-format-matrix.md
next: 8c4b-focused-compact-calibration.md
evidence: E137, E140-E146, E155; D21, D23
---

# Phase 8c4a — Benchmark contract repair

Complete. [E156](../../evidence/experiments/e156-compact-bar-contract-repair-freezes-calibration.md)
records the passing offline package and the pending Phase 8c4b approval gate.

## Purpose

Repair the benchmark defects found after Phase 8c3. Build one new versioned
package for a focused compact-bar recovery sequence. Make no provider call in
this session.

Keep the Phase 8c3 cohort, responses, report, and `block` decision frozen. Use
them only as diagnostic evidence. Do not reuse a prior provider-bearing
fixture in the new sequence.

## Representations

Implement these three arms:

1. positional compact-bar v1 as the compact control;
2. the same rows with one document-level declaration:

   ```text
   FIELDS id voice start duration pitch velocity
   N n1 lead 0 1/2 60 80
   ```

3. exact-object JSON with MIDI integers as the structured task control.

Both compact arms use the same fixed document and patch headers for `BASE`,
source identity, and `OMITS`. They have the same optional overlays for bars,
tracks, regions, meter, tempo, harmony, and groove. Each overlay must refer to
the same event IDs and must not duplicate the note plane. The `FIELDS` line is
the only difference between the compact arms. Do not add repeated labels,
grouped note rows, pitch-class/register values, or a side ledger.

## Contract repair

Write a task-to-scorer table and mutation tests before provider work.

- Analysis must define every input column, inversion numbering, chord
  function, and the relation between them. Report independent chord facts so
  one convention error does not hide the cause of a failed row.
- Motif operations must use operation-specific fields and formulas. Remove
  irrelevant parameters. Use `rhythmic-scale` instead of the ambiguous word
  `augment`. State which event properties must stay unchanged.
- Progression must state strict voice order, pitch-class coverage, ranges,
  cadence rules, and the exact same-voice movement formula that the scorer
  uses. Keep component results beside the all-constraints result.
- Every multiline grammar must include an actual two-row example.
- An unavailable or output-limit response must stay outside scored
  denominators.

Add deterministic structured diagnostics for parse and musical-contract
errors. Define at most one feedback repair turn. Keep initial and repaired
results separate. Initial musical success remains the primary format result.

## Offline capability work

Add parser, renderer, canonical-order, round-trip, stable-ID,
exact-preservation, sparse-patch, base-conflict, omission, invalid-value,
size, and token-estimate tests. Test optional structural overlays separately
from the minimal note document.

Use exact-object JSON as the internal semantic authority for these tests. It
is a benchmark control, not the selected public language.

## Fresh cohorts and freeze

Generate disjoint calibration, development, and targeted-holdout cohorts.
Record full and semantic hashes. Prove that they do not overlap each other or
any Phase 8c1 through 8c3 provider-bearing cohort.

Use comprehension analysis, continuation motif, and progression generation
as decision families. Add fresh structure, role-continuation, revoice, local
transformation, and rhythm guards. Use repeated identical prompts only as
named nondeterminism sentinels.

Before the session ends, freeze:

- the package and cohort hashes;
- models, inference settings, and output limits for calibration;
- calibration eligibility bands and stopping rules;
- offline size and capability gates;
- calls and estimated cost by provider; and
- the exact repair-turn policy.

Stop at the calibration approval boundary. Operator approval is required in
Phase 8c4b.

## Acceptance criteria

- Each instruction requirement maps to a tested scorer check.
- Positive, negative, and one-property mutation tests pass.
- The compact arms differ only by the declared `FIELDS` feature. All document
  and patch capabilities are otherwise identical.
- Optional overlays preserve one event identity set and one note plane.
- Initial, repaired, unavailable, and failed results have distinct states.
- Fresh cohort overlap checks pass.
- The next run has an exact scope, cost estimate, hashes, and stopping rule.
- The complete brain check, `context/check.rb`, and `git diff --check` pass.
- No provider, cache, runtime, or live Bitwig state changes.

## Out of scope

- Provider calls.
- Selecting either compact arm.
- Reusing or revising the Phase 8c3 matrix.
- Public contract work in Phase 8f.

## Retrospective target

Record whether a contract-to-scorer table or an output-state test would have
prevented each Phase 8c3 measurement defect.

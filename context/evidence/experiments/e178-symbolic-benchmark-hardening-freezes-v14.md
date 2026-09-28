---
title: E178 — Symbolic benchmark hardening freezes v14
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-follow-up-symbolic-benchmark-hardening.md
---

# E178 — Symbolic benchmark hardening freezes v14

## Verdict

The complete symbolic benchmark audit is complete. The corrected v14 package
passes offline and freezes a fresh Phase 8c4d targeted-holdout plan. No
provider or token-count request occurred.

The audit covers E137 through E177 and every package from compact-bar v0
through compact-format v13. The durable backlog records each issue, affected
version, repair, protocol decision, and remaining historical authority.

## Corrected package

[`compact-format-v14`](../../../brain/benchmarks/compact-format-v14/README.md)
contains only these provider arms:

- compact-bar `FIELDS`;
- compact-bar local labels; and
- exact-object JSON as the structured control.

Positional v1 and all other historical formats are offline regression sources
only.

The package separates structural parse, canonical form, semantic accuracy,
component accuracy, result state, and planned and scored denominators. It
tests prompt visibility, focused mutations, aggregation, cost reservations,
network preflight, and failure states.

The `FIELDS` candidate SHA-256 is
`de5c64a3746e4b555a9b9ef0ad37e1763caef696d3ea3722ccc3422c9ee07b0f`.
The local-label candidate SHA-256 is
`5f3e5ae56f77d78d985887938cd5f91399c48d351385fa79c7a431a8c8ea89db`.
The exact-object control SHA-256 is
`3de94454d58e1bd631ff3f73acb1d59dfa98ec2e479c67e7af86ed2c2f0c8844`.

## Fresh cohort and scope

The old reserved v10 holdout is invalid. Candidate, prompt, task, scorer,
sampling, and decision metrics changed.

V14 freezes 20 new fixtures:

- eight four-case analysis fixtures;
- eight input-bearing affine-continuation fixtures; and
- four document-serialization guards.

The cohort has no full-task, semantic-task, or analysis-case overlap with the
explicit historical snapshot. Its SHA-256 is
`5979ba82fd271bda2a0f2eef3eaafbc987d9d7da0634d69267c1761ab7ee3f64`.

Each decision fixture has two repeats. Each guard has one. Provider schedules
are balanced in adjacent three-arm blocks. Every arm runs first 12 times per
provider. Provider artifacts must retain planned, start, and completion
ordinals.

## Provider plan

The plan contains 108 messages per provider and 324 in total. It uses OpenAI
`gpt-5.4-mini-2026-03-17`, Gemini `gemini-3.8-flash`, and Claude
`claude-haiku-4-5-20251001`. Effective reasoning, thinking, and output settings
are frozen. Temperature stays at the provider default and is omitted from the
request.

The recent-cost estimate is USD 2.715000. The provider hard limits are USD
0.850000, USD 0.350000, and USD 1.850000. The total hard limit is USD 3.050000.
The guard reserves the full token-bound maximum before each message, retains a
failed reservation, and reconciles exact provider line items.

The protocol SHA-256 is
`749f890e5093ebfafdcedd435f8d9c87039b6ee28815bef7b72f73b723937123`.
The run-plan SHA-256 is
`33062e821d4d1679c680e340e8637d57c3fa12f686ab4bfe3fc90064851646df`.
The deterministic SHA-256 is
`c89260fcd29e7965f501c627f8b4994d291d372dbf4b99d3a394cefe5ba39a01`.

## Historical limits found by the audit

Two historical packages have time-variant freshness checks. Symbolic-format
v2 scans later package JSON. Compact-format v12 does the same, and v13 reuses
four v12 cases. Their current pinned checks therefore do not reproduce their
original freshness values. Frozen evidence remains historical authority; do
not edit those packages.

Several historical runs also shuffled or threaded work and then sorted saved
results. Their realized request order is not recoverable. V14 closes both
regressions with an explicit historical source list and retained ordinals.

## Consequence

Phase 8c4d can request operator approval of the exact v14 plan. Do not make a
provider call before that approval. The package does not select a public
format or unblock Phase 8f.

## Retrospective

The v10 cycle could have stopped before paid development if visibility,
repeat, and realized-order checks had been approval gates. V14 makes them
offline gates.

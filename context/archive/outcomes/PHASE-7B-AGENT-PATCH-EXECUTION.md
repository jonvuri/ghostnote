---
title: Phase 7b — Agent patch execution and reference dogfood
kind: plan
state: complete
status: Complete. Guarded agent note patches pass exact live reference dogfood; 7c is next.
updated: 2026-09-22
parent: ../../plan/phase-7/README.md
prev: ../../plan/phase-7/7a-symbolic-context-and-read-only-analysis.md
next: ../../plan/phase-7/7c-documentation-provider.md
---

# Phase 7b — Agent patch execution and reference dogfood

## Purpose

Implement the selected patch compiler and connect it to the existing guarded
Bitwig write seam. Prove one reference-conditioned revision with exact readback
and an operator verdict.

## Work completed

1. Added strict `ghostnote-note-patch-v0` and invariant validation against the
   complete exact source identity.
2. Compiled `transpose`, `delete`, `move` and `insert` into complete candidate
   state and explicit typed note operations.
3. Added a read-only preview with exact before and candidate states, guards,
   defaults, invariants, losses and a stable preview digest.
4. Added refusals for stale and conflicting identities, unsupported fields,
   unwritable pressure, ambiguous channels, invalid grids and ranges,
   collisions, overlaps and invariant failure.
5. Connected accepted previews to `Workspace.apply`, fresh exact preflight,
   independent complete readback and retained reversal data.
6. Added `reference-context-v0` with separate seed/reference identities,
   permission, coverage, extracted evidence, bounded raw context and complete
   independent copy and structure comparisons.
7. Added the proposal union only to the frozen experimental 7b tool profile.
   The stable deterministic v1 tool stayed unchanged.
8. Ran one live reference-conditioned task and received an explicit operator
   verdict.
9. Review hardening bound projected permission to the exact reference, capped
   complete candidates at 4,096 notes and made insertion defaults explicit.

## Result

[E121](../../evidence/experiments/e121-guarded-agent-note-patches-pass-live-reference-dogfood.md)
records the fixtures, refusal proof, live task, exact hashes, proposal, reference
comparison, timings, readback, operator verdict and cleanup. S06, S07 and S09
are implemented.

The agent added four upper notes to a fixed 16-note line. The compiler emitted
an insert-only typed write. The independent complete readback had no
discrepancy. The operator replied `Accepted.` The run then reversed the dogfood
change and removed the declared temporary fixture. Both temporary slots read
back empty, and the prior launcher selection was restored.

## Acceptance record

| Criterion | Result |
|---|---|
| Agent-selected edit | The host agent selected the four-note insertion. The compiler did not choose it. |
| Exact target guards and readback | Apply checked the revision mark and source hash, then used a fresh complete read and a separate complete readback. |
| Unnamed fields | Complete candidates retain them. Reconstruction preserves all 16 channels. Insert-only work does not clear the clip. |
| Reference proof | Permission, identities, complete and used coverage, extracted evidence and exact/structural overlap measures are present. |
| Optional helpers | No Musicpy, theory, audio, capture or documentation provider ran. |
| Operator verdict | The operator auditioned the identified result and replied `Accepted.` |
| Reversal | The exact dogfood change reversed through its recorded ID. Fixture cleanup used its separate owned setup boundary. |
| Verification | The 17 focused tests and 1,070-test brain check pass. The retained live handshake, extension checks, context check and diff check passed. |

## Verification cost

Target and reference acquisition took 3,920.729 ms and 3,875.596 ms. Local
compiler phases took 2.166 ms in total. Complete-reference comparison took
1.220 ms. The inclusive preview took 4.322 ms. Accepted apply took
16,044.461 ms, including a 3,801.443 ms fresh preflight, 8,173.118 ms recorded
apply and 3,744.445 ms independent readback. E121 lists the nested adapter spans
and bridge counts.

No verification reduction was made. R1 remains blocked. Apply still performs a
fresh complete preflight and a separate complete readback.

## Limits

- Both modules and the proposal tool input are experimental v0 contracts.
- Only realized-note `transpose`, `delete`, `move` and `insert` are supported.
- A complete candidate cannot exceed the 4,096-note exact-source capacity.
- Insertions need one unique source channel.
- Same-pitch overlap refuses. The compiler does not shorten notes.
- Raw reference event context needs a named reason and bounded coverage.
- Reference measures are descriptive. They do not decide permission or quality.
- The run used two small 16-beat clips. It does not define a latency SLA.

## Retrospective

The four-operation language avoided full-score regeneration. The task needed
only one four-note insertion and no repair pass.

The first live fixture found that Bitwig enables chance, occurrence, recurrence
and repeat controls on inserted notes. The compiler had expected false values.
Independent readback caught the mismatch. Put host-normalized creation defaults
in one shared contract and cover them in the fake adapter before live work.

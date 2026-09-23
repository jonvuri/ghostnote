---
title: Phase 7f — Hybrid workstation dogfood
kind: plan
state: complete
status: Complete. E127 records the real audio-guided run, accepted B, and closes S16.
updated: 2026-09-23
parent: README.md
prev: 7e-audio-capture-and-analysis-composition.md
next: ../phase-8/README.md
---

# Phase 7f — Hybrid workstation dogfood

## Outcome

[E127](../../evidence/experiments/e127-phase7f-hybrid-audio-guided-dogfood.md)
records the completed real-project run. The operator selected B. The run used
`audio-capture-v0`, `audio-facts-v0`, sensory v1, guarded parameter changes,
identified audition files, and the frozen
`phase-7f-audio-guided-sound-design-v0` profile. Its strict
`ghostnote-hybrid-run-record-v0` artifact closes S16.

The run added exact non-zero launcher play-start support and an audio-clip
range observation fallback. The final live parameter is 0.5. Temporary capture
files were removed after evidence was recorded.

## Purpose

Exercise the smallest useful combination of the Phase 7 modules, the Bitwig
adapter, computer use, and host-agent reasoning. Decide which experimental
interfaces should graduate, change, or be removed.

## Work

1. Select one real musical goal from the priority menu.
2. State the operating mode, enabled modules, permissions, and acceptance
   criteria before the run.
3. Use computer use for visual discovery and unsupported UI work.
4. Use workstation modules for exact state, deterministic evidence, compiled
   operations, capture, and readback.
5. Keep Ghostnote and computer-use mutations serialized.
6. Make every subjective result auditionable and wait for the operator verdict.
7. Record latency, calls, interventions, target errors, verification cost,
   unsupported boundaries, and exact exit state.
8. Trace each custom-format seam used in the run. Record producer and consumer
   versions, projections, translations, defaults, validation, and data loss.
9. Compare the observed seams with the 6i interface map. Confirm that connected
   formats have compatible semantics and do not claim the same authority.
10. Classify every experimental interface as graduate, revise, retain for more
   dogfood, or remove.

## Selected implementation boundary

Use the [contract baseline](../../evidence/format/WORKSTATION_CONTRACTS.md) and
close [S16](../../evidence/format/WORKSTATION_SEAMS.md). Repeat conformance for
every other seam used by the chosen run. Record the exact experimental tool
profile and accepted/emitted schemas. A component fixture alone does not prove
a composed path.

Keep the run record separate from provider results and blind keys. Link source,
artifact, evidence, request, operation and change IDs. Include independent
readback, external UI changes, the explicit operator verdict and exit state.
If preset composition crosses a new module boundary, close S15's artifact-wrapper
blocker first. Do not infer unsaved device state from a saved preset.

## Verification cost

Use the [6j operation and timing rules](../../evidence/format/WORKSTATION_VERIFICATION.md)
for this session. Measure implemented seam costs separately from host/provider
work. Keep unknown costs explicit. Any proposed reuse must pass its
[equivalent-evidence brief](VERIFICATION_REDUCTIONS.md).

## Acceptance criteria

- Each evidence claim is labeled exact, derived, agent-interpreted, UI-observed,
  or operator-confirmed.
- One unavailable module does not disable unrelated work.
- External UI changes do not become Ghostnote-owned reversible changes.
- Risk-bearing Ghostnote writes keep exact guards and independent readback.
- Reference-conditioned work records permission and copy-overlap evidence.
- Every custom-format seam used in the run passes a producer-to-consumer
  conformance check or records a precise incompatibility.
- The result identifies redundant formats, hidden translations, duplicate
  authority, and format ceremony that did not add value.
- The operator gives the only aesthetic acceptance verdict.
- The final project and filesystem state are explicit.
- The result identifies the next Phase 7 run or hands selected work to Phase 8.

## Out of scope

- Graduating every experimental module together.
- Reopening D22 through a hidden preset-loading route.
- Automatic aesthetic acceptance.

## Retrospective target

Record which module composition added value and which composition added only
ceremony.

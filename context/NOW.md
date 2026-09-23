---
title: Current state
kind: status
state: active
updated: 2026-09-23
phase: phase-7
session: 7f-hybrid-workstation-dogfood
---

# Now

Phase 7e is complete. [E125](evidence/experiments/e125-audio-capture-composes-with-verified-file-analysis.md)
connects guarded launcher capture to independent verified-file analysis. Phase
6 is complete. Phase 3 remains deferred. Phase 5 still has generalized
closeout work after its accepted public result.

## Next session

Run [7f: hybrid workstation dogfood](plan/phase-7/7f-hybrid-workstation-dogfood.md).
Read the [contracts](evidence/format/WORKSTATION_CONTRACTS.md),
[seam ledger](evidence/format/WORKSTATION_SEAMS.md),
[verification rules](evidence/format/WORKSTATION_VERIFICATION.md), E120–E125,
and the [dogfood menu](plan/phase-7/MENU.md). Select one real musical goal and
operating mode. Close S16 with an explicit run record. Close S15 only if the
selected task crosses its blocked artifact seam.

## 7e handoff

- `audio-capture-v0` accepts one exact saved Bitwig project and one guarded
  launcher loop. It captures the project master and does not claim that other
  project output is excluded.
- The extension reserves a recorder owner token before activation. Status and
  stop are owner-bound. Guarded launch checks the durable source in the launch
  handler.
- The capture module accepts one new stable stereo PCM24 WAVE at 44.1 kHz. It
  returns range, path, format, duration, bytes, full SHA-256, provider versions,
  sample coverage, ownership, warnings, and timings.
- Capture does not start an analysis provider. `captureAndAnalyze` verifies the
  returned artifact again and makes a separate `audio-facts-v0` request.
- The live proof restored the entry track list and recorder state. It removed
  the WAVE, disposable project, and temporary directory.
- Failure cleanup retries bounded transport stop before recorder stop. A failed
  transport confirmation makes the effects verdict unknown.

## Boundaries

S03, S04, S06, S07, S09, S11, S12, audio S13, S14 and the implemented parts of
S17 are complete. S05 remains conditional on a theory task. S08 stays outside
the compiler. S10 is conditional on a paired MIDI task. S15 remains conditional
on a cross-module preset artifact. S16 remains for 7f. R1 is still blocked: do
not remove the fresh note preflight or final readback.

## Retrospective

The full file SHA-256 let analysis re-identify captured bytes without recorder
state. The first live fixture refusal showed that a probe must record cleanup
identity at the first owned creation boundary and must not hide cleanup errors.
The review found that recorder cleanup alone did not prove transport cleanup.

---
title: Current state
kind: status
state: active
updated: 2026-09-23
phase: phase-7
session: 7e-audio-capture-and-analysis-composition
---

# Now

Phase 7d is complete. [E124](evidence/experiments/e124-audio-facts-and-sensory-packets-connect-verified-files.md)
connects verified local audio to selected FFmpeg facts and pure sensory v1
routing. Phase 6 is complete. Phase 3 remains deferred. Phase 5 still has
generalized closeout work after its accepted public result.

## Next session

Run [7e: audio capture and analysis composition](plan/phase-7/7e-audio-capture-and-analysis-composition.md).
Read the [contracts](evidence/format/WORKSTATION_CONTRACTS.md),
[seam ledger](evidence/format/WORKSTATION_SEAMS.md),
[verification rules](evidence/format/WORKSTATION_VERIFICATION.md), E103, E105,
E119 and E124. Implement `audio-capture-v0`. Close S11, capture-to-S12 and
capture startup in S17. Keep capture and 7d analysis as separate calls.

## 7d handoff

- `audio-facts-v0` accepts verified stereo PCM24 WAVE at 44.1 kHz. It has a
  16 MiB artifact limit and a selected range from 0.05 to 60 seconds.
- Runtime preflight completes before executable discovery. Provider processes
  consume private copies of retained bytes. Final verification rejects a path
  change during analysis.
- Silence uses -90 dBFS and 0.05 seconds. At most one uncovered sample across
  the complete range can gate dependent facts. Low analog noise can still be
  silent.
- Sensory v1 checks source, provider, formula, tolerance, channel, range and
  frame compatibility. It does not recompute facts or emit a verdict.
- The real run reproduced E118 brightness, loudness, crest and silence
  controls. It also passed one nonzero single-channel range. No Bitwig or
  librosa provider ran.

## Boundaries

S03, S04, S06, S07, S09, supplied-file S12, audio S13, S14 and the implemented
parts of S17 are complete. S05 remains conditional on a theory task. S08 stays
outside the compiler. S10 is conditional on a paired MIDI task. S11 and
capture-to-S12 remain for 7e. R1 is still blocked: do not remove the fresh note
preflight or final readback.

## Retrospective

Rolloff justified its cost only for level-controlled brightness. Review made
the silence tolerance global, linked request cancellation to startup, and kept
provider timeouts distinct. Future external-process modules must validate the
request and bounded source bytes before discovery.

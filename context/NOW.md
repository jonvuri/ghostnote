---
title: Current state
kind: status
state: active
updated: 2026-09-23
phase: phase-8
session: 8a-bwmod-publication-review
---

# Now

Phase 7 is complete. [E127](evidence/experiments/e127-phase7f-hybrid-audio-guided-dogfood.md)
records the real hybrid audio-guided run and closes S16. The operator selected
B. On `perc a`, `Dist TUBE-CULTURE / Output Tilt Slope` changed from
`0.3749999701976776` to `0.5`. The paired result was +519.485 Hz rolloff,
0.0 LU, and 0 s silence.

The saved project reopened with the selected 0.5 value before the final run.
The final live parameter is also 0.5. The clip play start remains exactly
`0.28698158264160156`. Transport is stopped. MasterRecorder is inactive with
no lease. The owned A/B WAVE files were removed. Bitwig shows the live project
as modified; the run did not issue a whole-project save outside the bounded
write permission.

## Next session

Start [8a](plan/phase-8/8a-bwmod-publication-review.md). Review publication and
extraction only. Do not publish without explicit approval.

Phase 5 still has generalized closeout work after its accepted public result.
Phase 3 remains deferred. Phase 8 is an independently schedulable backlog.

## 7f handoff

- `phase-7f-audio-guided-sound-design-v0` freezes stable-v1, description v23,
  audio capture v0, audio facts v0, sensory v1, and the S16 record v0.
- Audio capture accepts an exact non-zero play start. MIDI clips use
  `playingStep`; audio clips use owned slot state plus transport-beat advance.
- `audio-facts-v0` and the sensory brightness route graduate. Keep
  `audio-capture-v0` for more dogfood. Revise the hybrid run record.
- Dist TUBE-CULTURE did not settle its target-bound write callback. Exact
  change IDs plus later complete inventories proved both writes.
- A paired analysis needs a named common-musical-range projection when recorder
  lead and tail differ.
- The machine records are
  [run](evidence/experiments/e127-phase7f-hybrid-run.json) and
  [audio](evidence/experiments/e127-phase7f-audio-evidence.json).

## Boundaries

S03, S04, S06, S07, S09, S11, S12, audio S13, S14, S16, and the implemented
parts of S17 are complete. S05 remains conditional on a theory task. S08 stays
outside the compiler. S10 is conditional on a paired MIDI task. S15 remains
conditional on a cross-module preset artifact. R1 is still blocked: do not
remove the fresh note preflight or final readback.

## Retrospective

The module composition found two real gaps: audio clips need a different range
observation, and full recorder files do not guarantee paired sample coverage.
Add the common-range projection to the composition boundary. Make final S16
closeout update costs and UI state directly instead of patching the record.

---
title: Current state
kind: status
state: active
updated: 2026-09-21
phase: phase-7
session: 7b-agent-patch-execution-and-reference-dogfood
---

# Now

Phase 7a is complete. [E120](evidence/experiments/e120-symbolic-context-connects-complete-live-state.md)
connects complete exact state to the frozen compact agent context. Phase 6 is
complete. Phase 3 remains deferred. Phase 5 still has generalized closeout work
after its accepted public result.

## Next session

Run [7b: agent patch execution and reference dogfood](plan/phase-7/7b-agent-patch-execution-and-reference-dogfood.md).
Read the [contracts](evidence/format/WORKSTATION_CONTRACTS.md),
[seam ledger](evidence/format/WORKSTATION_SEAMS.md),
[verification rules](evidence/format/WORKSTATION_VERIFICATION.md), and E120.
Implement `note-compiler-v0` and `reference-context-v0`. Close S06, S07 and S09.
Keep the stable deterministic musical v1 grammar unchanged.

## 7a handoff

- `ghostnote-exact-note-source-v0` preserves complete clips, all 16 channels,
  guarded marks and every observed note field. `exact-note-json-v0` supplies the
  `exact-note-source-v0` SHA-256 domain, aliases and source-scoped event IDs.
- `symbolic-context-v0` renders `compact-bar-v0` with source, provider, coverage,
  capability and authority metadata outside the frozen strict context object.
- The module registry discovers without startup and checks schemas, request ID,
  source digest, deadlines and response correlation. Optional Music21 remains
  missing and isolated.
- The live four-beat proof used the 2,048-step reader, three pages and one reset.
  Complete acquisition took 2,321.882 ms. Exact hashing took 10.811 ms. Cold and
  warm module requests took 18.285 ms and 0.775 ms.
- The selected clip had C3, G3 and C4 at beat 0 for four beats. The agent proposed
  transposing `e-2` by 12 semitones against source hash
  `583479b910d2d3ae10c9ceb7acf56c63813be6672152110208f930bd98084960`.
  The proposal was not compiled, validated or applied.

## Boundaries

S03, S04 and in-process S17 are implemented. S05 remains conditional on a theory
task. S10 remains conditional on a paired MIDI task. The live decoder omits
default `isMuted: false`; the context projection applies that named rule only to
live sources. Supplied exact state without mute refuses.

No project write occurred. Entry and exit revision, scene epoch, content epoch,
generation and selection were equal. The strict agent-context corpus fingerprint
and stable public surface did not change.

## Retrospective

The agent used pitch and pitch span. It ignored equal velocity values. Keep
adapter-specific default elision out of supplied-state projections. Validate
type-only unions and cross-field guards at each module boundary.

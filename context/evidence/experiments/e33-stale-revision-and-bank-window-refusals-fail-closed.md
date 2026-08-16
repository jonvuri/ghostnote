---
id: E33
kind: evidence
state: active
source: phase-1-session-5e-refusal-boundaries
---

# E33 — Stale revision and bank-window refusals fail closed [K] (2026-08-16)

**Verdict: Phase 1 exit criteria 3 and 5 are met. A stale two-operation batch
applied zero operations. The fake covers each bank-window refusal path, with
existing live evidence for both track and scene window behavior.**

## Stale-revision live proof

`probe:5e-refusal` passed 11/11. It confirmed all 10 durable track identities
and the documented project, row, observation, transport, and selection
baseline. Live readback claimed an empty slot on `gn-B` row 3. Cursor 0 created
the probe clip. Independent cursor 1 confirmed that it held no notes.

The probe read revision 617. An intervening writer advanced the shared revision
to 618. A two-operation note batch submitted against revision 617 returned
`stale-revision`, expected 617, actual 618, and no applied stages. Independent
readback found no notes, so neither operation landed.

The probe submitted the same two writes against revision 618. Both writes
applied in one stage. Independent readback found both requested note identities.
Cleanup deleted the positive-control clip and restored track 0, row 1. Final
checks found 10 tracks, 10 scenes, the exact empty schema-v1 observation value,
and a stopped transport.

## Bank-window qualification

The focused fake matrix passed 20/20. The standing conformance suite covers:

- a track-overflowing project that refuses all writes;
- a hidden track that reads as `unreachable`, not absent;
- a full structural batch of track creates and copies that refuses before its
  first mutation;
- a scene-create batch whose cumulative demand exceeds the window;
- operations that name unreachable scene rows;
- unreachable rows in `Snapshot.unreachable`; and
- incomplete track and scene windows in `deltaComplete()`.

The live basis is already banked. E5/e05b measured 54 project tracks through a
32-track window and found 22 tracks and 160 clips outside the addressable set.
E15-A proved that `TrackBank.itemCount()` reports the project total independently
from the configured window. E16r confirmed that result under `ALL_CHANNELS`,
identified Master and FX returns as the first rows displaced, and proved why
track growth must be checked before mutation. E21 proved the scene equivalent by
shrinking the window: `sceneBank.itemCount()` still reported the project total,
unreachable rows remained unobserved, and over-budget scene operations refused
before mutation.

Session 5e did not create a fresh live overflow. The qualification is fake
regression plus the existing banked live evidence. It does not claim a new
destructive overflow sweep.

## Verification

- Focused fake refusal matrix: 20/20.
- Focused live stale-revision proof: 11/11.
- Full offline check: 541/541, with typecheck green.
- Context check: 151 active documents and all links pass.
- `git diff --check`: pass.

## Decision impact

D6, D10, and D15 are unchanged. The result closes Session 5e and Phase 1 exit
criteria 3 and 5. Session 5f is next.

## Retrospective

The batch receipt lists encoded wire calls, not contract operations. A probe
must count the semantic write calls it expects. No repository instruction
change is needed.

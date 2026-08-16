---
id: E28
kind: evidence
state: active
source: phase-1-session-5d-concurrent-editing-rerun
---

# E28 — Clip cursor confirmation needs a bounded retry [K] (2026-08-16)

**Verdict: the 5d rerun stopped before the human write window. One 25 ms
confirmation check refused a valid occupied clip. Phase 1 exit criterion 2
remains unproved.**

## Live result

The standing probe confirmed all 10 durable track identities, the exact empty
observation record, the stopped transport, and the documented project and scene
windows. Live readback selected zero-based row 9 for the write target on `gn-B`,
the drag source on `gn-lay`, and the drag destination on `gn-lay4`.

The probe created its write and drag clips. During the independent pre-run grid
capture, cursor 1 did not confirm track index 2, row 0 after the single 25 ms
`cursorPoint` settle. The adapter failed closed with `AddressUnresolvedError`.
The run never reached the operator prompt or the production write window. No
concurrent-editing claim was measured.

## Diagnosis

`LiveAdapter.pointAtClip` sends the track and slot point frames, waits once for
the 25 ms cursor budget, and reads `cursor.status` once. D6 requires polling.
Existing live evidence in the same adapter records that cursor-following state
can need about 100 ms. A status mismatch is stale state, not proof that the
occupied clip is unreachable.

The failure also exposed a cleanup gap in the standing probe. It assigns the
owned clip baselines only after the complete grid capture. When that capture
failed, the drag baseline still held its empty initializer. Cleanup read the
correct owned pitch-108 fingerprint and refused to compare it with the empty
initializer. This refusal prevented an unsafe deletion, but it left one owned
clip for directed cleanup.

## Cleanup

A separate read pointed cursor 1 at `gn-lay`, zero-based row 9, and confirmed
one note at pitch 108, beat 3.5, velocity 64, and duration 0.25 beats. Directed
cleanup deleted only that verified clip and restored the pre-run selection.

Final readback found the three claimed cells empty, selection at track 0 and row
1, the exact empty schema-v1 observation record, and the transport stopped. No
probe residue remains.

## Verification

- Full offline check: 532/532, with typecheck green.
- Context check: all active documents and links pass.
- `git diff --check`: pass.

## Decision impact

D6 is unchanged, but the production adapter does not yet implement its polling
rule for clip confirmation. A focused repair must add a bounded retry, cover a
lagging cursor and a cursor that never arrives, and make the standing probe's
owned cleanup fingerprints available before the full grid capture. Run 5d again
only after that repair passes offline and live.

## Retrospective

Store cleanup fingerprints when the probe creates owned content. Do not defer
them until a larger diagnostic read completes. No repository instruction change
is needed.

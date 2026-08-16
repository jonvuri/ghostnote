---
id: E29
kind: evidence
state: active
source: phase-1-session-5d-repair-cursor-confirmation
---

# E29 — Clip pointing owns pin state and bounded confirmation [K] (2026-08-16)

**Verdict: clip cursor confirmation is repaired. The point operation now owns
the pin lifecycle, retries exact status within eight attempts, and refuses when
the cursor never arrives. The 5d probe stores both cleanup fingerprints before
the complete grid capture.**

## Production repair

`LiveAdapter.pointAtClip` now unpins the clip cursor before each complete track
and slot point. It waits 25 ms on the first attempt and 144 ms on retries. It
checks the exact track position and scene row, then pins and records the held
clip only after that check passes. Eight failed attempts return
`AddressUnresolvedError`.

The first repair sweep showed why pin ownership is part of the point operation.
Cursor 1 was still pinned by earlier evidence, so repeated track and slot frames
could not move it. Timing alone could not repair that state.

## Cleanup repair

The standing 5d probe registers immutable target and drag fingerprints before
it creates either owned clip. Cleanup now verifies each exact fingerprint before
deletion. It can move the drag clip home, verify it, and remove both owned clips
after a later setup failure.

The grid reader also distinguishes pointable clips from Group and output rows.
Those rows can report aggregate launcher occupancy, but they do not own a clip
that the launcher cursor can point at. Their occupancy remains in the mutation
comparison.

## Live result

`probe:5d-cursor` passed three consecutive complete sweeps. Each run read all 19
pointable occupied visible clips through fixed cursor 1. Each run restored its
entry selection exactly. Revision 509, scene epoch 2, content epoch 298, all 100
visible occupancy readings, the empty observation record, and the stopped
transport remained unchanged.

A fourth final sweep started and ended at the documented selection, track 0 and
row 1. It confirmed the same unchanged project state.

The diagnostic failures displaced selection before the repaired sweep could
restore it. Directed final cleanup restored the documented fixture selection to
track 0, row 1. No project content was created or removed.

## Verification

- Focused adapter and cleanup tests: 39/39.
- Full offline check: 535/535, with typecheck green.
- Context check: all active documents and links pass.
- `git diff --check`: pass.

## Decision impact

D6 now states the complete pin lifecycle and the eight-attempt confirmation
bound. Session 5d can be run again. This repair does not prove the human
concurrent-editing criterion.

## Retrospective

A point operation must own pin state. It must not depend on the cursor state a
prior probe left behind. No repository instruction change is needed.

---
title: E415 — B19 track deletes land late, and a later delete by index hits another track
kind: evidence
state: done
updated: 2026-11-08
owner: B19
---

# E415 — B19 track deletes land late, and a later delete by index hits another track

## Result

Bitwig removes a deleted track after the `track.delete` request returns, seconds
later for a track with many clips, and it resolves the bank index when it
removes the track, not when the request arrives. A delete sent by index while
an earlier delete is still pending therefore removes whichever track has moved
into that index. Before the fix, three back-to-back `delete_track` calls of 16
tracks with 128 clips each all read back `differs` with no track removed; when
the removals landed, 32 of the 48 targets went, and so did 11 of 16 canary
tracks and the project's `FX 1` track. One call of 16 alone deleted only its
targets but still read back `differs`, as P01 found
([brief](../../work/p01-edit-path-performance.md), findings of the metadata
session). E414's 112 "dropped" teardown deletions were most likely deletes of
this kind that landed on rows already gone or past the end of the bank.

[D72](../../decisions/d72-track-deletes-wait-for-the-removal.md) records the
fix: each stage of track deletes waits until the deleted tracks have left the
bank, and `track.delete` names its track. With the fix, the same three calls
each read back `verified` in 4.1–6.4 s, and only the 48 targets went. The
extension's identity check alone does not prevent the misdirection: raw
back-to-back deletes passed the check, and Bitwig again removed `FX 1` and none
of the second call's targets.

| Run | Grid | Route | Readback per call | Targets deleted | Other tracks deleted |
|---|---|---|---|---:|---|
| R1 | 32 targets, 8 canaries, no clips | `delete_track` 2 × 16, back to back | `verified` (4.0 s) | 32 / 32 | none |
| R2 | 48 targets, 16 canaries, 128 clips per track | `delete_track` 3 × 16, back to back | `differs`, none removed (7.9–8.9 s) | 32 / 48 | 11 canaries, `FX 1` |
| R3 | 16 targets, 16 canaries, 128 clips per track | `delete_track` 1 × 16 | `differs`, none removed (5.4 s) | 16 / 16 | none |
| F1 (fixed) | as R2 | `delete_track` 3 × 16, back to back | `verified`, 16 removed (4.1–6.4 s) | 48 / 48 | none |
| F2 (guard only) | as R2 | raw `batch.run` of guarded `track.delete`, 3 × 16, back to back, no wait | no refusal | 32 / 48 | `FX 1` |

In R2 the second and third calls sent indices from a track list in which some
of the first call's tracks were already gone and others were not; the
removals then landed over 35 s in no index order. In F2 every guarded frame
found its expected track at its index when it arrived, so the extension's view
lags the removal in the same way as the brain's.

Scenes did not reproduce the fault: on 48 tracks × 64 scratch rows (2,880
clips), three back-to-back `delete_scene` calls of 8 rows each read back
`verified` in 1.2 s, and only the target rows went (run S1; each scratch row
carried a binary identity in its clips).

## Build and method

- Bitwig 6.1.4, API 25, project `gn-scale-test`. R1–R3 and S1 ran on the
  B19 session 2 normal build (95 methods, `0439995f8f3d9953`). F1 and F2 ran
  on the fixed build: same method set and hash, normal archive SHA-256
  `d09c6b2a2e1fdb75f2df2b58ec912c5adcacce4ef2fbb0e2fa9badde68b8efa4`, marker
  `rig.info.trackDeleteIdentity`; `probe:hello` passed after the operator
  replaced the controller (fresh start 2026-11-08 18:28:18 UTC).
- Driver: `brain/src/probes/b19-delete-repro.ts`. It adds target tracks
  `gn-dr-dNN` and, after them, canary tracks `gn-dr-kNN`, optionally fills
  every scratch slot with a clip and waits until all are present, sends the
  deletes, records each call's readback and `track.delete` indices, and polls
  `slot.occupancy` each second until the listing has not changed for 120 s.
  `brain/src/probes/b19-scene-delete-repro.ts` does the same for scenes.
- Data: [b19-delete-repro](../data/b19-delete-repro/).

## Cleanup

After each run, the drivers deleted the remaining scratch tracks in awaited
calls of 16 (each `verified`) and the added scenes. R2 and F2 each deleted
`FX 1`, which the tools cannot recreate; the operator restored the saved
project after R2, and after F2 the project equals entry except `FX 1`
(10 tracks, 10 scenes, the same 25 clips). The operator allowed scratch work
in `gn-scale-test` and stated that its state does not matter.

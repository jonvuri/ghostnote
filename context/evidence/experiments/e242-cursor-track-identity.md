---
title: E242 — Cursor track identity
kind: evidence
state: done
updated: 2026-10-07
owner: phase-8h4a4
---

# E242 — Cursor track identity

## Status

[8h4a4](../../plan/phase-8/8h4a4-cursor-track-identity.md) is complete. The
adapter confirms a cursor target by the track `channelId`, not by the cursor
track position. The E240 defect is fixed: cursor-pointed clip addresses and
device targets resolve on tracks inside and after a group. The anchor reads
`gn-E16` and `gn-sel`, which failed in E240.

Two limits remain. Neither writes to a wrong target:

1. **Collapsed children, rows other than 0.** A fresh cursor point does not
   reach another row of a child of a collapsed group. The `clip`, launch,
   play, and metadata reads, the stage confirmation of writes, and the note
   observer arm refuse with `AddressUnresolvedError`. A note write refuses
   before it changes the clip. The `clip.read` notes path expands the group
   (D34) and is not affected.
2. **Same device type on two tracks.** A DirectParameter inventory never
   settles when the device cursor moves from one device to a device with the
   same parameter ID list on another track. This does not depend on groups.

## The change

- Extension: `cursor.status` and `cursor.playState` report `trackChannelId`
  (from the clip's track, marked interested in `markClip`). The note observer
  arm confirms only the `channelId`; it no longer compares the position with
  the bank index. `rig.info` reports the build marker
  `cursorIdentity: cursor-channel-id-v1`; `probe:hello` checks it. A reply
  field does not move the method hash: `normal-v1` stays 87 methods,
  `ca139a3e62a55e68`.
- Brain (`adapter.ts`): `pointAtClip`, the writer page check and its reset,
  and the capture play read compare `trackChannelId`. The device target
  checks already compared `trackChannelId`. Their extra
  `trackPosition === row.index` comparisons are removed. The
  `parentRestored` check compares two cursor positions with each other and
  stays.
- The `batch.run` guards compare `channelId` values and the scene guard, not
  positions. No change was necessary.
- Unit tests: a group child with bank index 5 and cursor position 0 reads and
  writes; a group child device reads, reuses its target, and reads a nested
  parameter. Both tests fail on the earlier adapter with the anchor error.

## Live results

Owned unsaved project, normal profile. Bank order: `before` (0), the group
(1), `in` (2) and `in2` (3) inside the group, and `after` (4). Each track had
a Polysynth and declared clips in rows 0 and 1. Only `before` has a bank index
equal to its cursor position.

| Run | Result |
|---|---|
| Matrix, group expanded | 24 of 24 steps pass: reads, note insert and remove, `clip.update` and restore, observer arm, device read, reuse, `param.set` and restore |
| Matrix, group collapsed | 22 of 24 pass. The observer arm on row 1 of `in` and `in2` refuses (limit 1) |
| Collapsed rows, fresh adapter per address | `in`, `in2`: row 0 reads; row 1 refuses for each of the four cursor addresses and the note insert. `after`: every row reads and writes |
| Anchor (read-only) | `gn-A`, `gn-E16` (collapsed `Group 5`), and `gn-sel` read row 0. `gn-E16` row 1 metadata refuses (limit 1) |

In the collapsed matrix, the other row-1 steps on `in` and `in2` passed
because pool cursors were still on row 1 from the expanded run. The exact
`channelId` and row match makes that a correct result, but a fresh point
cannot repeat it. The collapsed-rows run is the reliable result.

The refused note insert left rows 0 and 1 unchanged (read through
`clip.read`). The control insert on `after` landed in row 1 and was removed.

## Limit 1: collapsed children

A slot selection on a child of a collapsed group does not take (E240, E241).
The cursor confirms the target track by `channelId` and stays on row 0.
Before D33 the bank did not list these children, so such addresses did not
resolve at all. The reader solves the same problem with an expansion for each
read (D34). A cursor route could use the same expansion. That is a separate
session; the operator decides when.

## Limit 2: DirectParameter IDs

`Rig.beginDirectParameterObservation` clears the parameter IDs when the
target track changes. Bitwig calls the ID observer only when the ID list
changes. After a Polysynth on one track, a Polysynth on another track gives
the same list, so no callback arrives and `idsGeneration` stays -1 (70 polls
in the diagnostic). The read then reports the device without `params`, and a
parameter address is unstable. A move of cursor 0 to a track with no device
first makes the callback arrive (55 parameters on each track). The driver
uses this hop; the product does not. See `device-ids-observer.log`.

## Artifacts and verification

Data is in [phase8h4a4-cursor](../data/phase8h4a4-cursor/).
`brain/src/probes/phase8h4a4-cursor-identity.ts verify-offline <dir>` checks
every claim above from the retained artifacts.
`phase8h4a4-cursor-identity.test.ts` runs it. `device-ids-observer.log` is
transcribed console output: the rerun overwrote the matrix artifact of those
runs.

## Restoration

The driver deleted the owned tracks; the operator closed the project without
saving. The anchor `gn-scale-test` matches the E234 baseline
(`baseline-final.json`), with `Group 5` collapsed. Fresh normal hello passes
`normal-v1`, 87 methods, `ca139a3e62a55e68`, and `cursorIdentity`
`cursor-channel-id-v1`.

---
title: E251 — Collapsed-group live verification
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8i2
---

# E251 — Collapsed-group live verification

## Status

[8i2](../../plan/phase-8/8i2-collapsed-group-live-verification.md) is
complete. On the D43 build, the collapsed-group routes pass live in
`gn-scale-test`. These routes are the D34 read and the `cursor.pointExpanded`
clip point, with pinned finders and pinned pool cursors. Each collapsed read
returned the same document as the expanded control arm. Each write read back
`verified` and reverted exactly. The slot and mixer selection and the collapse
state did not change. No owned cursor was unpinned after a tool call, and no
tool sent a track pin frame. No product path changed, and no tool description
changed (`ghostnote-description-v35`).

## Fixture

`gn-scale-test` with `Group 5` (child `gn-E16`, rows 0 and 1 read only). The
driver made three owned tracks with product tools: `gn-8i2-a` and `gn-8i2-b`,
each with clips in rows 0 and 1 and a Tool device, and `gn-8i2-deep`, with
clips in rows 0 and 1. The operator grouped a and b (`Group 9`), and grouped
deep three times (`Group 10` > `Group 1` > `Group 1`, the D34 depth of
three). The driver is `brain/src/probes/phase8i2-groups.ts`. It uses product
tools only, and it reads the selection, the `track.list` `hidden` flags, the
`revision.get` `unpinnedCursorTracks`, and the `rig.stats` pin counters after
each tool.

## Results

| Arm | Steps | Result |
|---|---:|---|
| Expanded control (every group expanded, also `Group 5`) | 19 | 19 of 19; no `cursor.pointExpanded` |
| Collapsed (every group collapsed) | 19 | 19 of 19; the 6 documents equal the control arm |
| Delete `b` after a read and `read_devices` of `b`, then read `a` | 4 | Passed; 6 re-pins; no cursor unpinned in a later call |
| Project switch and back (operator), then reads of `gn-E16`, `a`, deep | 5 | Passed; 0 re-pins; no cursor unpinned |
| Cleanup | 1 | The track list equals the E234 baseline; `Group 5` is collapsed |

Each arm contains: `read_launcher_clip` of rows 0 and 1 of `gn-E16`, `a`, and
deep; `check_launcher_clips` of the six refs (all `current`); a 16-note
`edit_launcher_clip` on row 1 of `a` and of deep, its `revert_change`, and a
read that equals the read before the edit; `read_devices` of `a`,
`set_device_enabled` and its revert, and a device read that equals the first.

In the collapsed arm, only the four edits and reverts sent
`cursor.pointExpanded`, one each. The reads use the D34 reader route, which
needs no pool cursor.

### Plan correction: the device route

The plan expected the device route on a collapsed child to point a pool
cursor through `cursor.pointExpanded`. It does not. `cursor.pointExpanded` is
a clip point (`adapter.ts`, the clip route). `read_devices` and
`set_device_enabled` point a pinned pool cursor with `cursor.pointTrack` at
the hidden child (the same route as for a top-level track; E243 used it too).
This route passed with the selection and collapse state kept.

### Pins

Without a host event, a re-pin comes only from a cursor that had no track and
gets one: in every step, the rise of `repins` equals the fall of
`untargeted`. The delete of `b`, which held six owned cursors after the read
and the device read, caused 6 re-pins. The cleanup delete of six tracks caused
17. After each delete, the next call listed no unpinned cursor.

The project switch is operator-reported. Bitwig reports no switch counter. The
counters did not move: before the switch every `gn-scale-test` cursor was
already pinned, and a switch brings the pins of the project (E250). In "New 2"
no cursor got a track, so no re-pin ran. In E250 the switch back to "ice
jungle" caused 11 re-pins, because "ice jungle" brought its own unpinned saved
state.

### A track delete moves the mixer selection (host behaviour)

The delete of `b` moved the mixer selection from `Group 10` (not related to
`b`) to `Instrument Layer`. The slot selection did not change. Control arm:
two top-level scratch tracks, the mixer selection on `Group 10`.

| Delete | Owned cursors on the track | Re-pins | Mixer selection after |
|---|---|---:|---|
| `quiet` (never read) | none | 0 | the scratch neighbour (`gn-8i2-ctl-pointed`) |
| `pointed` (after `read_devices`) | one pool cursor | 2 | `FX 1` |

The quiet delete has no owned cursor on the track, and it moves the mixer
selection. Thus Bitwig moves the mixer selection on a track delete; the pins
do not drive it. `delete_track` reports no selection effect. The E250 note
("the new track was selected, then deleted") is the same host move.

## Cost

Raw `clip.read` and tool times, collapsed arm (expanded arm in brackets).

| Path | Collapsed | Expanded | Reference |
|---|---:|---:|---|
| Raw `clip.read`, one group (`gn-E16`, `a`) | 281–287 ms | 258–263 ms | E241: median 262 ms |
| Raw `clip.read`, three levels (deep) | 374–378 ms | 351–361 ms | E241: median 378 ms (nested) |
| `read_launcher_clip`, one group | 466–474 ms; 12 calls | 441–455 ms | E250: 365–403 ms (top level) |
| `read_launcher_clip`, three levels | 565–567 ms; 12 calls | 536–544 ms | — |
| `check_launcher_clips`, six refs | 2,447 ms; 34 calls | 2,313 ms | — |
| `edit_launcher_clip`, 16 inserts, one group; three levels | 1,576 ms; 1,862 ms; 36 calls | 1,524; 1,698 ms; 43 calls | E250: 1,354 ms (top level) |
| `revert_change` of the edit | 1,865; 2,213 ms | 1,734; 2,032 ms | — |
| `read_devices`; `set_device_enabled` | 520 ms; 731 ms | 521; 720 ms | E250: 524–697 ms; E247: 905 ms |

No path regressed more than 20 percent against E241. A collapsed one-group
read costs about 25 ms more than the expanded one (the expansion and
collapse waits). The tool read of a grouped track costs about 100 ms more than a
top-level read (E250); this is the D34 climb and the top-level wait, as in
E241. The collapsed edit has 7 fewer calls than the expanded edit: one
`cursor.pointExpanded` replaces the track point, the clip pins, and the
selection borrow and restore. Heap: no new
allocation; the fixture clips held 4 notes.

## Open observations

- A track delete moves the mixer selection (host behaviour, above). The
  `delete_track` result does not report it.
- `add_tracks` moves the mixer selection to the new track (setup rows).

## Artifacts and verification

Brain: typecheck and 2,108 of 2,108 tests pass (`npm run check`).

Data is in [phase8i2-groups](../data/phase8i2-groups/). `delete-first.json`
is the first delete run: it deleted `b` and then stopped on a driver check
(the collapse state was compared with the entry, which listed `b`). `delete.json`
is the rerun after the delete. `state.json` holds the fixture IDs and the
control documents. `phase8i2-groups.ts verify-offline <dir>` checks every
claim above from the retained artifacts; `phase8i2-groups.test.ts` runs it.

## Restoration

The cleanup deleted the fixture groups and tracks. The `gn-scale-test` track
list equals the E234 baseline (`baseline-final.json`), and `Group 5` is
collapsed. The mixer selection is `gn-sel`; the slot selection is `gn-A`
row 0. `gn-E16` was only read. The deployed normal archive is unchanged
(89 methods, `0ef817f4bac8a8a7`).

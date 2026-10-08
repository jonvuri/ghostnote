---
title: E250 — Reader follow-mode repair
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8i1
---

# E250 — Reader follow-mode repair

## Status

The reader failure of the second 8i dogfood trial is repaired. Every owned
cursor track now stays pinned
([D43](../../decisions/d43-owned-cursor-tracks-stay-pinned.md)). In "ice
jungle", a project that was saved with the ghostnote cursor records, every
read and write route passed live. The selection stayed where the person put
it. Tool descriptions are `ghostnote-description-v35`.

## Cause

In a project that was saved with the cursor records, Bitwig makes an
unpinned owned cursor follow the selection. This happens also when the
cursor was made with `shouldFollowSelection=false` (D6). The diagnosis before
this session showed it with an operator click: the idle reader and pool
cursors 0, 1, and 7 moved to Drum Machine; the pinned fine cursor stayed. The
saved records do not hold a decoded follow flag. The field `0x1bf5` holds a
track reference for the cursors that were pinned at the save, and null for
the others.

This session measured the second half on the 8i0 build, with raw wire calls
in "ice jungle":

| Pool cursor 2 | `cursor.pointTrack` to | Cursor after | Mixer selection |
|---|---|---|---|
| Track pinned | Ice Shells | Ice Shells | Drum Machine (unchanged) |
| Track unpinned | Undertow Bass | Undertow Bass | **Undertow Bass**; the reader and cursor 0 followed |
| Track pinned, clip unpinned, `slot.select` row 1, then row 0 | Ice Shells | row 1, then row 0 | unchanged |

Thus a point of an unpinned cursor drives the selection, and a pinned cursor
track still moves and binds the selected row. The reader read failed as
follows. The open unpinned the reader track. Finder 0 pointed at the target,
so the application selected the target, and the reader followed it there.
The park wait saw no park and sent none, and ran to the deadline. The raw
diagnosis replies are in
[diagnosis/](../data/phase8i1-follow/diagnosis/).

## Repair

- The extension pins every owned cursor track in its first task
  (`Rig.ownCursorTrack`, 14 tracks). The reader open, the group point, and
  the adapter send no track unpin; a point changes only the clip pin.
  `cursor.pinTrack` refuses `pinned: false`; `cursor.pointTrack` pins before
  it points. The adapter sends no track pin frames.
- The host keeps no pin on a cursor without a track, removes the pin when
  the track under a cursor is deleted, and brings the pins of the active
  project on a project switch. Live: after the scratch-track delete, the
  reader and finder 0 read unpinned; after a switch to "New 2", all 14 read
  unpinned and 13 had no track. The extension now pins a cursor again when
  its pin goes and when it gets a track. In "ice jungle", four deletes caused
  18 re-pins; a switch back to "ice jungle" caused 11, with none unpinned
  and none without a track.
- `revision.get` lists each owned cursor on a track that reads unpinned.
  The brain refuses with `unhealthy` while one is listed. Live, before the
  re-pin on delete, `check_bitwig_connection` refused with the two names.
  The list is kept beside the mark, not in it (see the regression below).
- The selection lease accepted the restore only when the mixer showed the
  target. An unpinned point had moved the mixer there. With pinned tracks,
  two of three reads reported `lease-lost` and left the slot selection on
  the target. The lease now also holds while the mixer shows the track of
  the claim.
- The reader sends the park again every 20 slow polls while it is on
  another track. A deadline refusal names its phase, the reader track, and
  the finder state. The reply keeps the reader state at the open, the fourth
  poll, and the report. No raw read needed a second park.
- A verification read that throws after an applied write no longer loses
  the receipt. The take marks each address unverified with the read error.
  `add_launcher_clip` then reports the creation as an effect with its revert,
  and records the change (the earlier fake reproduction now passes). Other
  tools report the effect with a readback that is not `verified`.

## Regression found and fixed

The first form of the list was a field of `RevisionMark`. A mark is part of
the published snapshot reference, and the decoder accepts exactly its
fields. Live, every guarded edit then refused `target-changed` (`The base ref
is not current at the write`). The list now lives in a side table. A test
reads through the live adapter with the list present and decodes the
reference.

## Live acceptance

The deployed normal archive has SHA-256
`aae2c7e346c413dc409c572a3e52dc44f983f08ac232ea302e4c0b14f0bc1fb0`, 89
methods, `0ef817f4bac8a8a7`, and the marker `cursorTrackPins.rule:
owned-tracks-pinned-v1`. The method table did not change.

Raw `clip.read` in "ice jungle", five reads of Drum Machine, Ice Shells rows
0 and 1, and Undertow Bass: 163–211 ms, park in 0–1 polls, no park resend.
Each read restored the entry slot and left the mixer unchanged. The operator
then clicked Undertow Bass and FX 1: the mixer moved to FX 1, and no owned
cursor moved.

The driver `phase8i1-follow.ts follow`
([follow.json](../data/phase8i1-follow/follow.json)) ran the tool surface
in "ice jungle" after a project switch. After every tool, no owned cursor
was unpinned and no track pin frame was sent:

| Tool | ms | Wire calls | Reference |
|---|---:|---:|---|
| `check_bitwig_connection` | 23 | 2 | E247: 25 ms, 2 |
| `read_launcher_clip` (4 existing clips) | 365–403 | 12 | E247: 415–477 ms |
| `read_devices` (3 existing tracks) | 524–697 | 19–25 | E247: 542–652 ms |
| `add_tracks` | 838 | 38 | E247: 835–841 ms, 46 |
| `add_launcher_clip`, typical | 2,158 | 77 | E247: 2,323 ms, 85 |
| `edit_launcher_clip`, 16 inserts | 1,354 | 42 | E248: 1,367–1,428 ms |
| `set_launcher_clip_properties` | 1,365 | 42 | E249: 1,414–1,436 ms |
| `add_devices`, Tool | 1,363 | 51 | E247: 1,447–1,544 ms, 67 |
| `read_device_controls` | 744 | 20 | E247: 764–823 ms |
| `set_device_controls`, one | 2,398 | 66 | E247: 2,555–2,650 ms, 74 |
| `revert_change`: control, device, properties, edit, creation | 2,859; 1,380; 1,350; 1,469; 370 | 67; 50; 41; 42; 11 | E247: targeted edit 1,581 ms |
| `delete_track` | 476 | 25 | — |

The existing tracks were only read. The scratch track was deleted, and the
track list equals the entry. The reads of existing clips kept the entry
selection exactly. In "New 2", `phase8h4c-edit.ts cost`
([cost.json](../data/phase8i1-follow/cost/cost.json)): one read and one
16-note insert took 1,723–1,793 ms with 54–56 wire calls (E248:
1,790–1,832 ms). No path regressed; the calls fell where the track pin
frames left.

## Open observations

- Not run live: the collapsed-group routes (a read and a `cursor.pointExpanded`
  of a child track), where the pinned finders climb with `selectParent`.
  Neither "ice jungle" nor "New 2" has a group track.
- `createNewLauncherClip` makes Bitwig select the new clip, and the creation
  records no borrow. `add_launcher_clip` therefore leaves the slot selection
  on the new clip. This does not depend on the pins.
- A tool other than `add_launcher_clip` whose verification read throws
  reports `differs`, not `unavailable`. Most result schemas have no
  `unavailable` status.
- The mixer selection of "ice jungle" ends on Undertow Bass after the
  scratch-track runs (the new track was selected, then deleted). The slot
  selection is Ice Shells row 1.

## Verification

- Brain: typecheck; 2,107 of 2,107 tests. New: the pin list beside the mark
  and the `unhealthy` refusal, the verification-read failure on a creation,
  a rename, and the executor. The adapter fakes model D43.
- Extension: 20 clip reader test groups; archive registrations agree.
- `probe:hello` passes with the new marker check.

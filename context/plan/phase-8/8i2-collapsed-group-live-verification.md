---
title: Phase 8i2 collapsed-group live verification
kind: plan
state: done
status: Complete (E251). The collapsed-group read and point routes pass live on the D43 build; no product path changed.
updated: 2026-10-08
parent: README.md
prev: 8i0-clip-metadata-and-colour-tolerance.md
next: 8i3-long-device-write-profile.md
evidence: E240, E241, E242, E243, E250, E251; D34, D43
---

# Phase 8i2 collapsed-group live verification

**Complete.** [E251](../../evidence/experiments/e251-collapsed-group-live-verification.md):
every arm passed with no product change. Correction to Work item 2: the
device route on a collapsed child does not use `cursor.pointExpanded` (a clip
point). It points a pinned pool cursor with `cursor.pointTrack`, and it passed.

## Cause

The 8i1 repair ([E250](../../evidence/experiments/e250-reader-follow-mode-repair.md),
[D43](../../decisions/d43-owned-cursor-tracks-stay-pinned.md)) pins every
owned cursor track. This includes the three parent finders that climb with
`selectParent` in the D34 expansion. E250 did not run the collapsed-group
routes live, because neither "ice jungle" nor "New 2" has a group track. The
D34 read (E241) and the `cursor.pointExpanded` route (E243) passed before
D43, when the finders and the pool cursors were not pinned. A pinned cursor
can behave differently when it climbs to a parent or points into a hidden
child. This is a verification session. It changes no product path unless a
route fails.

## Entry reads

- `context/NOW.md`, E250 (open observations and the 8i1 retrospective), D43.
- E241 and D34 (expand-parent read), E243 (collapsed-child cursor route),
  E242 (cursor identity by `channelId`).
- `extension/.../ParentGroups.java`, `GroupPoint.java`, `ClipReader.java`,
  `ClipReadRoute.java`, and `Rig.ownCursorTrack` / `repinLater`.
- `brain/src/probes/phase8i1-follow.ts` (selection and pin readback),
  `phase8h4a3-expand.ts` and `phase8h4a5-collapsed-cursor.ts` (the earlier
  group matrices). Some old commands send `cursor.pinTrack` with
  `pinned: false`; D43 makes the extension refuse that frame. Do not reuse
  those commands. Use product tools or add a new driver mode.
- The [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
  rows for `read_launcher_clip` and the E241 grouped read times.

## Fixture

Use `gn-scale-test`. It has `Group 5`
([baseline-final.json](../../evidence/data/phase8h4a5-cursor/baseline-final.json)).
Check the current project and the track list against that baseline first.
Ask the operator to collapse the group, or to open the project, when the
state is not as the matrix needs. Do not toggle groups or select tracks by
computer use. If the matrix needs a nested group or clips on rows above 0 of
a child, make owned fixtures with product tools and remove them at the end.

Record the entry state before the first call: the track list, the group
collapse state, the slot and mixer selection, and `rig.stats` (`unpinned`
and `repins`).

## Work

1. Add a `groups` mode to `phase8i1-follow.ts`, or a new `phase8i2-groups.ts`
   driver. Use product tools only. Print the wire call sequence with its
   gaps. After each call, read back the selection, the pins
   (`revision.get` `unpinnedCursorTracks` and `rig.stats`), and the group
   collapse state.
2. Run the matrix on a collapsed group:
   - `read_launcher_clip` of row 0 and of a row above 0 of a child track;
     the same for a child in a nested group (up to the D34 depth of three);
   - `check_launcher_clips` of those refs;
   - a targeted `edit_launcher_clip` on a collapsed child, then its
     `revert_change`;
   - one device route on a collapsed child (`read_devices`, then
     `set_device_enabled` and its revert): this points a pool cursor through
     `cursor.pointExpanded`;
   - `launch_clip` is not necessary; do not start the transport.
   Repeat the read and the edit with the group expanded as a control arm.
3. Test the host events that can change the pin state (8i1 retrospective):
   - delete an owned fixture child track that a finder or a pool cursor
     points at, then read another child;
   - switch to another project and back (the operator does the switch), then
     read a child.
   After each event, `unpinnedCursorTracks` must be empty in a later call,
   and the selection must not follow a cursor.
4. If a route fails, stop the matrix. Record the failure with its wire
   sequence. Make a small repair only when the cause is proved with a control
   arm; otherwise write a repair plan and hand off. A repair that changes the
   extension needs a deploy and an operator controller replacement.

## Cost model

No new path. Each read is the D34 expansion route; the cost comes from E241
and E250.

| Case | Host work | Expected cost |
|---|---|---|
| `read_launcher_clip`, child of a collapsed group | Mark, finder climb, expand, one capture, collapse, end mark (E241) | About 262 ms (E241 grouped read); the pins remove the unpin and pin frames (E250: 365–403 ms for a top-level read in "ice jungle") |
| Nested child (three levels) | Up to three finder climbs | About 378 ms (E241) |
| Targeted edit on a collapsed child | The E248 edit route through `cursor.pointExpanded` | About 1.8 s for a read and a 16-note insert (E248, E250) |
| Device route on a collapsed child | One `cursor.pointExpanded` and the device bank | `set_device_enabled` 905 ms (E247) plus the expansion |

Heap: no new allocation; fixture clips stay small (typical clip or less).
A regression of more than 20 percent against E241 needs a named cause.

## Acceptance

- Every matrix arm returns the same document as the expanded control arm,
  and every write reads back `verified` and reverts exactly.
- After every call, the slot and mixer selection equal the entry state (or
  the documented `add_launcher_clip` exception, if an arm adds a clip), and
  the group collapse state equals the entry state.
- `unpinnedCursorTracks` is empty after each host event, in a later call.
  `rig.stats` `repins` counts the expected re-pins and no more.
- No regression above 20 percent against E241, or a named cause.
- `gn-scale-test` ends at its baseline: no fixture residue and no changed
  collapse state.
- `npm run check` passes when the driver or code changes; `context/check.rb`
  and `git diff --check` pass.

## Records and handoff

Record the result as E251 (check the number is free) and add the index row.
Update E250's open observations to point to E251. Update
[8i](8i-agent-native-hybrid-dogfood.md) and `context/NOW.md`: route to
[8i3](8i3-long-device-write-profile.md). State that no tool description
changed, or bump `TOOL_DESCRIPTION_VERSION` if a repair changes one.

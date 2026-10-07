---
title: E243 — Collapsed-child cursor route and parameter settle
kind: evidence
state: done
updated: 2026-10-07
owner: phase-8h4a5
---

# E243 — Collapsed-child cursor route and parameter settle

## Status

[8h4a5](../../plan/phase-8/8h4a5-collapsed-cursor-and-parameter-settle.md) is
complete. Both E242 limits are fixed in the normal profile:

1. Every row of a child of a collapsed group reads and writes through the
   cursor route, also two group levels deep and on the person's own path. No
   read or write reached another row.
2. A device after a device of the same type on another track reads its
   parameters, sets one, and restores it, with no hop. Its remote controls
   settle.

The session also found and fixed a wrong-row write: `clip.launchSettings` sent
an unconfirmed point in its turn. On a collapsed child this writes row 0
(P2).

## Probes (probe profile)

Owned unsaved project. Bank order: `before`, the group, `in`, `in2`, `after`.
Clips in rows 0, 1, and 2 of each track. Polysynth on `before` and `in`,
Phase-4 on `in2` and `after`. The probe build added `directparam.callbacks`
and `directparam.hop`, and moved `branch.mixer` and `branch.setMixer` from
historical to probe, so that the driver can expand and collapse the group.

| Probe | Result |
|---|---|
| P1, pinned cursor across a collapse | Yes. After the collapse, `cursor.status`, `cursor.launchSettings`, `cursor.playState`, and `cursor.clipMetadata` report row 1. `cursor.setNotes` and `cursor.setClipMetadata` land in row 1 only. The same from an entry selection inside and outside the group. |
| P2, same-request point | Wrong row. With the group collapsed and the cursor unpinned, a `batch.run` with point frames and `cursor.setNotes` for `in` row 1 wrote row 0. The guard must stay strict. |
| P3, side effects | One expand and collapse changes no revision, scene epoch, content epoch, `track.list` order, or selection. A collapse can move the mixer selection from a child to the group track (P1 inside entry). |
| P4, same-type switch | The ID observer does not fire. The name and value observers fire for every ID (55 for Polysynth, 103 for Phase-4), also with equal values and with unequal values. They arrive before `begin`, which cleared them. The remote pages settle. The display observer did not fire in any run. |
| P5, hops | No candidate works. A selection of the bank item past the device count does not move the device cursor. With a reselect in the same task, or in a later request, the ID observer still does not fire. |

## The change

- **Clip reads.** The `clip.read` reply has a `launch` block (`ClipLaunch`,
  the same method as `cursor.launchSettings`), outside the `metadata` block.
  The D32 fingerprint stays `ghostnote-launcher-source/1`. The reader marker is
  `clip-reader-v3`. The adapter serves `clip`, `clipMetadata`, and
  `clipLaunch` from the `clip.read` capture of the clip. One snapshot reads
  each clip once and points no cursor. A reply without a block refuses; there
  is no cursor fallback. A launch value outside the API sets refuses.
  `clipPlay` stays on the cursor path.
- **Cursor route.** `cursor.pointExpanded` (normal profile, 88 methods,
  `68d457c4c4d1d7b3`) points one pool cursor through the D34 expansion. It
  removes the pins, finds the parents, expands each collapsed group, selects
  the row and points in one task, waits for the target by `channelId` and row,
  pins the track and the clip, and restores the person's selection while the
  group is expanded. Then it collapses and selects the entry mixer track again.
  It runs in the write gate as a clip read. `ParentGroups` (the finders and the
  climb) and `SelectionEntry` (the capture, the restore, and the close) are
  shared with `ClipReader`; the reader behaviour is unchanged. Marker:
  `groupPoint: expand-collapsed-point-v1`.
- **Route choice.** The plan assumed that `list_tracks` knows the parent and
  its state. It does not: `track.list` reports bank positions only. A second
  track bank with the visible-only filter (the filter that D33 removed from the
  product bank) now gives the answer. `track.list` marks a track that this bank
  does not list `hidden: true`: it is inside a collapsed group. The adapter
  points a hidden track only with `cursor.pointExpanded`. Other tracks keep the
  present route with no extra request. If the first status reports the target
  track on another row (a group that collapsed after the list was read, E242),
  the adapter changes to the expansion route at once. The route records no
  selection borrow. A route that cannot confirm refuses `collapsed-group-row`.
- **Writes.** The stage check before the turn now also confirms the clip of
  `clip.launchSettings`, and the encoder omits its point frames when the
  cursor is held, as for `clip.update`. The note observer arm uses the same
  route.
- **DirectParameter settle.** `DirectParameterSwitch` records the name and
  value callbacks under the target that the cursor reports at that time
  (track, device name, and index, or the nested route). A new target discards
  the earlier callbacks. When the ID observer does not fire, the current target
  settles with the last ID list when each ID has a name and a value under that
  target. `directparam.list` reports `settledBy` (`ids`, `switch`, or
  `target`). Marker: `parameterSettle: same-ids-switch-v1`. No change was
  necessary for the remote pages.

## Live acceptance (normal profile)

Owned unsaved project, the fixture above, and a track `deep` inside an inner
group inside an outer group. Each target was read from a fresh adapter. Each
write was checked with `clip.read` on every row of the track.

| Run | Result |
|---|---|
| Product tools on `in` row 2, group collapsed | 16 of 16: `read_clip`, `inspect_clip_block`, `set_clip_launch` and restore, `set_clip_metadata` and restore, `write_notes`, `erase_notes`, `write_notes`, `inspect_devices`, `inspect_device_parameters` (direct and remote controls), `set_parameter` and restore, `set_device_enabled` and restore. No residue; the selection did not change. |
| Matrix, group collapsed | 60 of 60. Reads, note insert and remove, `clip.update` and restore, `clip.launchSettings` and restore, and the observer arm, on rows 0, 1, 2 of each track. Each `in` and `in2` step used `cursor.pointExpanded` and no normal point; no top-level step used it. After each step the group was collapsed. |
| Matrix, group expanded | 60 of 60. No step used `cursor.pointExpanded`. |
| Person's own path | The operator selected `in` row 1 and collapsed the group. Two passes of reads and a note round trip on `in` row 2: 4 of 4, the selection did not change, and the group stayed collapsed. |
| Refusal after an expansion | A stale scene guard refused the `batch.run` after the route confirmed `in` row 2 (`StaleAddressError`). The track did not change; the group was collapsed; the next read passed. |
| Nested, outer group collapsed | `deep` rows 0, 1, 2: reads, note round trip, launch round trip, 9 of 9. |
| Devices, no hop | `before`, `in`, `in2`, `after`, `before`: device read, parameter read, `param.set` and restore, and the remote controls, 5 of 5. `in` and `after` settled by `switch`. |
| Anchor, read only | `gn-E16` (collapsed `Group 5`) rows 0, 1, 2 through the route; `gn-A` and `gn-sel` row 0 on the present route. Row 15 of `gn-E16` is empty and reads as no clip with no point. |

`gn-E16` holds clips only in rows 0, 1, and 2 (E241). The first anchor run
also asked for row 15 and correctly reported no clip (`anchor-row15.json.gz`).

### Cost

| Step | Track in no group | `in`, group expanded | `in`, group collapsed |
|---|---|---|---|
| Five reads of one row (clip, launch, play, metadata, notes) | 800–841 ms | 925–938 ms | 1013–1086 ms |
| Note insert and remove, with six full-track `clip.read` checks | 4407–4473 ms | 5437–5504 ms | 6140–6238 ms |

The device step (a device read, two sets, three reads, and the remote
controls) took 6004–6046 ms on each track, with the group collapsed. A
`switch` settle cost the same as a settle on the ID observer.

A track in no group used no `cursor.pointExpanded` and made the same requests
as before. Its times are the same in both matrices. The extra time on a
collapsed child is the route (once for each confirmed point) and the reader
expansion (D34).

## Observations

- **Mixer selection after a direct read (not new).** A direct adapter read on
  the present route restores only the slot. The mixer selection stays on the
  target track (`reads` steps on row 0 of a track in no group). The same in
  both matrices and the anchor; the route does not cause it.
- **Driver artifact.** The matrix observer step calls `pointAtClip` directly
  in a selection scope. A direct point is not a borrow, so the scope does not
  restore; the slot selection stayed on the target for top-level tracks. The
  product arm runs inside `apply`, and the note round trips (which arm it)
  left the selection unchanged.
- **First tools run.** The driver restored `write_notes` with a second
  `write_notes`, but the tool adds notes. The marker stayed in `in` row 2
  (`tools-first.json.gz`); a note removal cleaned it. The rerun restores with
  `erase_notes` and `write_notes`.
- The DirectParameter display observer did not fire in any probe run
  (`displayCount` 0). Reads report no display text; this session did not
  change that.

## Artifacts and verification

Data is in [phase8h4a5-cursor](../data/phase8h4a5-cursor/).
`brain/src/probes/phase8h4a5-collapsed-cursor.ts verify-offline <dir>` checks
every claim above from the retained artifacts.
`phase8h4a5-collapsed-cursor.test.ts` runs it.

Unit tests: the `clip.read` launch block and its validation, metadata and
launch with no notes request (one `clip.read`, no point), the route choice
(hidden, not hidden, the fallback signature, and an earlier extension), the
`collapsed-group-row` mapping, the write confirmation of note writes and
`clip.launchSettings`, the extension route order, and the DirectParameter
settle on equal ID lists (`ClipReaderTest`).

## Restoration

The driver deleted the owned tracks; the operator closed the project without
saving. The anchor `gn-scale-test` matches the E234 baseline
(`baseline-final.json`), with `Group 5` collapsed (`gn-E16` is `hidden`).
Normal `ghostnote` is loaded: archive SHA-256
`46cde14347a24b6efc7999251fb798665fd4cad9d00d0f50293e45859354bce7`. Fresh
hello passes `normal-v1`, 88 methods, `68d457c4c4d1d7b3`, `clip-reader-v3`,
`expand-collapsed-point-v1`, and `same-ids-switch-v1`.

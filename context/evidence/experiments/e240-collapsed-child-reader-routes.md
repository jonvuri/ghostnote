---
title: E240 — Collapsed-child reader routes
kind: evidence
state: done
updated: 2026-10-07
owner: phase-8h4a2
---

# E240 — Collapsed-child reader routes

## Status

**Superseded in part by
[E241](e241-expand-parent-acceptance.md) and
[D34](../../decisions/d34-the-reader-expands-collapsed-parent-groups.md).**
The operator found that a person cannot make the entry state that
`expand-parent` failed. 8h4a3 promoted the route and fixed its gaps. The
results below remain the 8h4a2 record.

[8h4a2](../../plan/phase-8/8h4a2-collapsed-child-reader-routes.md) is
complete. No route passed the complete matrix. The product reader keeps its
refusal. The brain now gives the refusal a reason that says to expand the
group.

- `show-in-editor` and `cursor-step` fail in the same way as the product
  route: in a collapsed group, the reader binds only row 0.
- `expand-parent` reads every row correctly, but it fails one selection case.
  When the entry mixer track is another child of the collapsed group, the
  mixer selection moves to the group track. The restore reports success.
- After its one E232 retry, the adapter now refuses a second row mismatch on
  the requested track with `CollapsedGroupRowError`. The surface reason is
  `collapsed-group-row`, and the refusal says to expand the group.
- The extension is unchanged. The research routes are in
  `research-routes.patch.gz`.

**Separate finding (high priority, not fixed).** In the session, every
cursor-pointed `clip` address failed on a track inside or after a group. These
reads include the metadata, launch, and play reads of `read_clip`.
`pointAtClip` compares `cursor.status.trackPosition` with the flat bank index.
The cursor position is the position among sibling tracks, so it does not count
the children of a group. The anchor shows the defect
(`cursor-position-anchor.log`). See [Cursor position](#cursor-position).

## Method

The owned unsaved project was `New 9`, with 64 scenes, the probe profile, and
rig config SHA-256 `256bbf07…43b0` (`contentFilter` `ALL_CHANNELS`, D33). One
child track for each route held the E232 fixtures: distinct clips in rows 0,
1, and 63, with row 2 empty. An `other` track outside the group held a row-0
clip. The operator grouped the four children with Cmd+G.

Each route read its own child in all six row orders, from three entry
selections: the other track at row 0, the target slot, and another row of the
target. That gives 54 reads for each route in each view. A read passes only
when it binds the requested track and row, returns exactly the declared note,
keeps the D30 capture rules, and restores the slot track, slot row, and mixer
track. Each set of notes was compared with a product read made while the group
was expanded (`reference`).

The views were: expanded; collapsed (A); and collapsed again after an
expand-and-collapse by the operator (B). The driver is
`brain/src/probes/phase8h4a2-collapsed.ts`.

The routes replace only the select-and-point step. The D30 close, the
confirmation, the release, the E99 lease, and the bound-target guard did not
change.

- `show-in-editor`: `ClipLauncherSlot.showInEditor()` on the target slot
  instead of the row selection, then point.
- `cursor-step`: bind as the product route, with no capture. Then step the
  reader clip with `selectFirst` and `selectNext`, one task for each step, up
  to 64 steps. A step that does not move within 40 polls refuses
  `step-stuck`. At the target row, pin the clip and park. Then claim the lease
  again and point: the pinned clip binds the target row (E232).
- `expand-parent`: a probe-only cursor track that follows no selection, and
  its `createParentTrack(0, 0)` handle (two handles, allocated at init). The
  open task points the finder at the target. At park, if the parent is a
  collapsed group, the route expands it, waits for the host to report it, and
  binds as the product route. The close task collapses it again.

## Results

Final build (collapse before the restore):

| Route | Expanded | Collapsed A | Collapsed B | Refusals when collapsed | Wrong notes |
|---|---:|---:|---:|---|---:|
| product | 54 | 17 | 17 | 36 `bound-target-mismatch` | 0 |
| `show-in-editor` | 54 | 17 | 17 | 36 `bound-target-mismatch` | 0 |
| `cursor-step` | 54 | 17 | 17 | 36 `step-stuck` | 0 |
| `expand-parent` | 54 | **53** | **53** | none | 0 |

- **Product and `show-in-editor`.** Rows 1 and 63 bound row 0 and refused.
  The 17 passes are row-0 reads. One more row-0 read failed its selection
  restore (see below).
- **`cursor-step`.** In the collapsed group the reader stayed at row 0. No
  `selectNext` moved it (path `[[0, true]]` on every read). The plan asked
  whether a step passes empty slots. This could not be measured, because no
  step moved.
- **`expand-parent`.** The parent handle was the group on every read:
  collapsed at entry, expanded for the read, and collapsed again. Median total
  time was 168 ms, against 167 ms for product row-0 reads.
- **Entry selections.** A slot selection on a child of the collapsed group did
  not take (`taken: false` on all 36 target and sibling entries of each
  route). These entries therefore ran from the selection that the previous
  read left.

### The one `expand-parent` failure

The first read of each collapsed run had its entry mixer track on another
child of the collapsed group, which an earlier read had left there. The
restore reported `restored: true`, but the mixer selection then moved to the
group track. The `hidden-mixer` case makes this entry for each of the other
three children and reads each row twice (18 reads):

| Build | Collapsed | Result |
|---|---:|---|
| product route | 0 of 18 | `lease-lost`; the mixer selection moves to the target |
| `expand-parent`, collapse after restore | 0 of 18 | restored, then moved to the group track |
| `expand-parent`, collapse before restore | 0 of 18 | the same |

In the expanded `hidden-mixer` run the setup read restored the mixer, so the
entry state did not form. That run is not evidence for this case.

The product route also fails this entry state, so the gap is not new. But
`expand-parent` reports a successful restore that the host does not keep, and
the plan accepts only a route that passes the complete matrix. The operator
chose to keep the refusal.

### Research runs

- The first `cursor-step` build did not claim the lease again after its
  second park. In the expanded group it read the correct notes but lost the
  lease on 36 of 54 reads (`matrix-expanded-no-reclaim`).
- The `restore-first` artifacts are the full matrix with the collapse after
  the restore. The results are the same as for the final build.
- The first `reference` attempt on the first build failed an assertion that
  the driver did not retain. A rerun on the same build passed 12 of 12
  (`reference-first-build`).

## Product change

`LiveAdapter.readClipNotes` keeps the E232 retry. A second mismatch on another
row of the requested track throws `CollapsedGroupRowError` (contract
`write-boundary.ts`), with `boundRow`. The surface refuses with
`reason: 'collapsed-group-row'`: the track can be inside a collapsed group,
and the person must expand it. A mismatch on another track still refuses with
no retry. The `group-slot` refusal no longer says that a collapsed child
"works the same way". It says that only row 0 reads.

Live, on the product child (`refusal-*`):

| View | Row 0 | Rows 1 and 63 |
|---|---|---|
| Expanded | reads, one `clip.read` | read, one `clip.read` each |
| Collapsed | reads, one `clip.read` | `collapsed-group-row` after two `clip.read` refusals |

Tests: the adapter retry test now expects `CollapsedGroupRowError` after the
second mismatch. The refusal catalogue includes the new error. A surface test
checks the reason and the advice to expand the group.

## Cursor position

`pointAtClip` (adapter) confirms a cursor target with
`cursor.status.trackPosition === trackIndex`. In `New 9`, with the group
**expanded** at bank index 0, every cursor-pointed `clip` read failed. The
observed position of each child was its order inside the group, and the
`other` track at bank index 5 had position 1. These values come from console
output that the driver did not retain.

The anchor shows the same defect (`cursor-position-anchor.log`, a read-only
`clip` read of one slot on each track):

| Track | Bank index | Result |
|---|---:|---|
| `gn-A` (before the group) | 2 | read |
| `gn-E16` (inside the collapsed `Group 5`) | 5 | failed; cursor position 0 |
| `gn-sel` (after the group) | 8 | failed; cursor position 7 |

The cursor position is the position among sibling tracks: a child counts
inside its group, and a group counts as one track at its level. This holds
whether the group is expanded or collapsed. The flat bank index counts every
child. Thus every cursor-pointed clip address fails on a child of any group
and on any track after a group. This includes the `clip`, launch, and play
reads of `read_clip`, and the stage confirmation of `clip.update` and the note
write ops. The `clip.read` notes path is not affected, because it checks the
`channelId`.

D33 widened the defect: before it, the bank did not hold the children of a
collapsed group, so tracks after a collapsed group still matched. Expanded
groups had the defect before D33. E234 did not see it, because its group runs
used `clip.read` and the snapshot tools. [E242](e242-cursor-track-identity.md)
fixes it.

## Artifacts and verification

Data is in [phase8h4a2-collapsed](../data/phase8h4a2-collapsed/).
`brain/src/probes/phase8h4a2-collapsed.ts verify-offline <dir>` checks every
claim above from the retained artifacts. `phase8h4a2-collapsed.test.ts` runs
it. `research-routes.patch.gz` is the extension diff of the research build,
including the unit test of each route order (16 reader test groups).

## Restoration

The driver deleted all owned tracks (`cleanup`): the `New 9` track list
matched its entry list, and the reader and write gate were idle. The operator
closed `New 9` without saving. The normal archive rebuilt to the baseline
SHA-256 `9038d30e…f590`. Fresh normal hello passes `normal-v1`, 87 methods,
`ca139a3e62a55e68`, `clip-reader-v2`, `subscribe-before-unpin-v1`,
`batch-scene-guard-v1`, `selection-project-v1`, and `ALL_CHANNELS`. The
anchor `gn-scale-test` matches the E234 `baseline-final.json`. The rig config
is unchanged.

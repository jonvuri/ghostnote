---
title: E234 — Write boundary and reader hardening
kind: evidence
state: done
updated: 2026-10-06
owner: phase-8h4a
---

# E234 — Write boundary and reader hardening

## Status

[8h4a](../../plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) is
complete. It closes the four E233 defects below the tool surface:

1. `batch.run` checks a scene guard before the first operation. A human scene
   insert or delete between the stash read and the apply refuses with no host
   mutation, live and on the fake.
2. A selection observed in an earlier project is no selection. No tool refuses
   because of it, and it is never restored.
3. The `clip.read` reply holds the clip metadata block. Snapshot reads, checks,
   and the survey make no metadata point. The block is byte-equal to the
   `cursor.clipMetadata` reply, so the fingerprint domain stays
   `ghostnote-launcher-source/1`.
4. A clip read, write, copy, move, launch, snapshot, or check on a group
   track's own slot refuses with `group-slot`.
5. The product track bank uses the `ALL_CHANNELS` content filter by default
   ([D33](../../decisions/d33-the-product-track-bank-lists-all-channels.md)), so
   the children of a collapsed group stay listed. The `list_tracks`
   description states the group mark (description v25).

The normal wire keeps 87 methods and hash `ca139a3e62a55e68`: the change adds
fields, not methods. Three deliberate build markers identify the build:
`clip-reader-v2`, `batch-scene-guard-v1`, and `selection-project-v1`.
`rig.info` also reports the applied `contentFilter`, and hello checks it.
[D32](../../decisions/d32-pull-snapshot-references-use-the-revision-mark.md)
and the [pull snapshot contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md)
state the new guards.

## Implementation

- `brain/src/contract/write-boundary.ts`: `SceneGuard`, `sceneGuardMismatch`
  (the rule of the guarded `slot.launchWithOptions`; an empty current project
  fails closed), `sceneGuardError`, `GroupSlotError`, and the group-slot
  assertions. Both adapters call them. `launcherSlotsOf` (contract `ops.ts`)
  lists the slots of each op exhaustively.
- `BatchRequest.ifScene`. The executor sends the stash mark with every batch
  that names a launcher row. A first-stage refusal is `StaleAddressError`
  (`why`: `project-changed` or `extension-restarted` when not a scene change).
  The live adapter sends the guard with each stage until the batch's own scene
  op has run. A later-stage refusal returns a `stale-scene` receipt; the
  executor then reads only row-free addresses and marks the rows unverified.
- Extension `batch.run`: `expectedGeneration`, `expectedProject`, and
  `expectedSceneEpoch`, all or none, checked after `ifRevision` and before the
  revision claim. A mismatch replies `stale-scene` with the failed `field`.
- `ClipMetadata.read` in the extension makes the `cursor.clipMetadata` reply
  and the `clip.read` `metadata` block. The reader marks the values at init and
  reads the block from its own cursor in the close task. The live adapter uses
  the block for every clip whose notes the same read captures, and points a
  pool cursor only for other clips or a reply without the block.
- `Rig` records the project in which each selection value was observed.
  `selection.status` reports `slotProject`, `mixerProject`, and `project`.
  When the slot value is from another project, the extension reads the slot
  selection again from the marked `isSelected` values; exactly one selected
  slot becomes current. The brain treats a remaining mismatch as no selection
  and sends no `slot.status` for its index. A restore to a track that is gone
  does not refuse. The reader does not restore an entry selection from another
  project.
- `list_tracks` marks a group track with `group: true` and
  `launcherSlots: 'mirror-children'`. The tool descriptions are frozen, so the
  mark is in the result only. The refusal has `reason: 'group-slot'`. Resolve
  reports `group-slot`; read, apply, and the audio capture launch refuse.
- `check_clip_snapshots` uses an outer selection scope again. The 8h3e
  workaround is removed, because the general rule covers it.
- The fake adapter models the selection and the project in which it was
  observed, and applies the same rule.

## Unit evidence

- `engine/write-boundary.test.ts` (fake): a scene delete after the post-read
  mark and before the apply refuses, and the clip that slid into the row is
  not written; an ordinary executor write carries the guard and refuses a
  scene insert; a project change and a restart refuse with their reasons; an
  empty project fails closed; a group slot refuses read, write, copy, move,
  launch, snapshot acquisition, and check, while the child clip reads and
  checks `current`.
- `adapters/live/adapter.test.ts`: the guard fields on every stage, the
  first-stage refusal as `StaleAddressError`, no fields without a guard, the
  metadata block with no metadata point and equal digests, the stale-project
  selection with no `slot.status` for its index, the restore to a missing
  track, and the group-slot refusals before any `clip.read` or `batch.run`.
- `adapters/live/wiremap.test.ts`: both replies come from `ClipMetadata.read`,
  and the guard runs before the revision claim and the first op.
- Surface: each tool with an outer selection scope runs without a refusal and
  without a restore after a project change on the fake:
  `acquire_clip_note_source`, `check_clip_snapshots`, `transform_clip_music`
  preview and apply, `add_clip`, `write_notes`, `revert_change`,
  `wrap_existing_device_modulation`, and its reversal. `list_tracks` marks the
  group; `read_clip`, `write_notes`, `add_clip`, `delete_clip`,
  `copy_clip_down`, `move_clip_block`, and `launch_clip` refuse with
  `group-slot`.

## Live method

Sections 1–3 and the first group run used normal archive SHA-256
`97e2dc8862c0854c930d2c017a052a4803075ea971eb5107abde70ee01b7e9c6` (no
content filter). The D33 rerun used
`9038d30e8d39e5b4fb4eb623998451ab91625107a69d9be7de6b73823c2ff590`
(`ALL_CHANNELS`). Each loaded after operator replacement, and fresh hello
passed `normal-v1`, 87 methods, `ca139a3e62a55e68`, and the markers. P was the
owned unsaved project `New 6`; Q was `New 7`; the D33 group rerun used
`New 8`. The driver is `brain/src/probes/phase8h4a-boundary.ts`.
Fixtures use E231 typical density (256 notes in 64 beats, all 16 channels).

## 1. Apply guard

The driver acquired a reference to the guard-track clip, then held the
executor batch (with `ifSnapshot`) on the wire. The `batch.run` frame waited
after every brain check and cursor preflight; only the extension guard ran
after the hold. Add Scene appends after the selected scene, so the operator
added one scene and dragged it to the top. The deletion removed that scene.

| Case | Guard sent | Extension reply | Revision | Target and column |
|---|---|---|---|---|
| Insert above row 2 | epoch 5, `New 6` | `stale-scene`, `sceneEpoch` 5 → 6 | 11 → 11 | Unchanged, one row lower |
| Delete above row 3 | epoch 6, `New 6` | `stale-scene`, `sceneEpoch` 6 → 7 | 11 → 11 | Unchanged, one row higher |

Both raised `StaleAddressError`. The raw reads before and after are equal on
every guard-track clip.

Two side runs are retained:

- `apply-guard-insert-preflight`: the first hold sat before the live apply. The
  scene change came first, and the cursor preflight refused
  (`AddressUnresolvedError`: the writer cursor reported the clip one row off).
  The same preflight refusal occurred once more on the first write after an
  operator scene drag; a second attempt bound correctly. This is the E3
  scene-index staleness. It fails closed; nothing was written.
- `apply-guard-delete-timeout`: the hold expired after 10 minutes, before the
  scene change. No batch was sent.

D27 check: the guard and the operations run in one handler call, in one
controller-thread task, so no controller callback can run between them. The
guard reads the extension's last delivered scene count. A host change not yet
delivered is not seen. No host fence is claimed.

## 2. Selection

The operator selected `gn-8h4a-child-b` row 0 in P (track index 8; Q has five
tracks), then switched to Q without a selection change there.

| Tool | Refused | Q selection before → after | `slot.select` frames |
|---|---|---|---|
| `acquire_clip_note_source` | no | 0:0 → 0:0 | 0 |
| `check_clip_snapshots` | no | 0:0 → 0:0 | 0 |
| `transform_clip_music` preview | no | 0:0 → 0:0 | 0 |
| `transform_clip_music` apply | no | 0:0 → 0:0 | 4 |
| `write_notes` | no | 0:0 → 0:0 | 3 |
| `revert_change` | no | 0:0 → 0:0 | 4 |
| `read_clip` | no | 0:0 → 0:0 | 2 |

Host behavior: on the switch back to Q, `selection.status` reported Q's own
selection, slot 0:0, with `slotProject` and `mixerProject` both `New 7`. The
mixer value has no re-read, so the host observers fired for Q. Q had a current
selection from the fixture write. The stale-index branch therefore did not
occur live; it has unit and fake cases. The reader restored Q's entry
selection. No tool sent `slot.status` or `slot.select` for P's index.

Finding: the probe `WireTransport` rejects with a plain `Error`, not
`BridgeError`. `captureSelection` caught only `BridgeError`, so a `slot.status`
refusal for a missing track index refused the whole tool in E233. The product
client throws `BridgeError`. The 8h4a rule no longer sends that request.

## 3. Metadata block

Each shape compares the raw `clip.read` block with the `cursor.clipMetadata`
reply of a pointed pool cursor, and the adapter digest with a digest computed
from the pointed reply.

| Shape | Canonical JSON equal | Digest equal | Metadata points in the snapshot read |
|---|---|---|---:|
| Typical, exact palette colour | yes | yes | 0 |
| Typical, default colour | yes | yes | 0 |
| Loop length 32 beats | yes | yes | 0 |
| Named, loop off, play start 4 | yes | yes | 0 |
| Empty new clip, default colour | yes | yes | 0 |

The domain stays `ghostnote-launcher-source/1`. References minted before 8h4a
stay comparable.

The 16-clip survey (four tracks, rows 0–3):

| Pass | Wall | Result bytes | Metadata points | Cursor points | `clip.read` | Stale |
|---|---:|---:|---:|---:|---:|---|
| All current | 4.62 s | 11,204 | 0 | 0 | 16 | none |
| After a velocity edit and a nudge | 4.59 s | 128,186 | 0 | 0 | 16 | exactly clips 1 and 16 |

E233 measured 8.75 s; E231 measured 3.47 s for notes only. The remaining
difference to E231 is the reader route itself.

## 4. Group slots

The operator grouped `gn-8h4a-child-a` (rows 0 and 1) and `gn-8h4a-child-b`
(row 0) with Cmd+G. The group track was `Group 7`.

| Filter | View | Group-slot refusals | Host calls by the refused tools | Children |
|---|---|---|---|---|
| none | Expanded | 9 of 9 | 0 `batch.run`, 0 `clip.read` | All three read 256 notes and check `current` |
| none | Collapsed | 9 of 9 | 0 `batch.run`, 0 `clip.read` | Not listed; `read_clip` answers `readable: false` |
| `ALL_CHANNELS` | Collapsed | 9 of 9 | 0 `batch.run`, 0 `clip.read` | Listed. Row 0 of each child reads and checks `current`; child A row 1 refuses `bound-target-mismatch` |

The tools were `read_clip`, `write_notes`, `add_clip`, `delete_clip`,
`copy_clip_down`, `move_clip_block`, `launch_clip`,
`acquire_clip_note_source`, and `check_clip_snapshots` (a reference with the
group's channel ID). `list_tracks` marked the group in both views.

Finding: with the group collapsed, the flat track bank listed 11 items and did
not hold either child; `itemCount` was also 11, so no blind spot is reported.
`read_clip` on a hidden child says "a track that was deleted never resolves
again".

Cause: the rig content filter, not the host. E16 measured that the flat bank's
default filter (`ALL_VISIBLE_CHANNELS`) drops the children of a collapsed
group, and that `setContentFilter(ALL_CHANNELS)` restores them, also at
runtime. `Rig` applies a filter only when `rig.json` sets `contentFilter`. The
live `rig.json` sets none. The E221–E223 group runs set
`contentFilter: "ALL_CHANNELS"` (recorded in their rig configs, for example
`phase8g5a-group/new5-two-child-collapsed.json` and 43 `phase8g5c-storage`
artifacts). E222's statement that a collapsed child stays addressable is true
only under that filter. The 8h4a plan carried the result without its
configuration.

D33 rerun: with `ALL_CHANNELS` the collapsed `Group 2` and both children were
listed. Row 0 of each child read 256 notes and checked `current`. Row 1 of
child A refused in the reader (`bound-target-mismatch`: the reader bound row
0), and `acquire_clip_note_source` refused with `AddressUnresolvedError` and
returned no snapshot. This is the E221 collapsed-child binding limit: a slot
selection in a collapsed child does not move the cursor from row 0. It fails
closed. Expand the group to read the other rows.

No group operation behaved differently before the refusal was added in a way
that this run could see: the new checks run before any host call.

## Artifacts and restoration

Data is in [phase8h4a-boundary](../data/phase8h4a-boundary/).
`brain/src/probes/phase8h4a-boundary.ts verify-offline <dir>` rechecks every
claim above, and `phase8h4a-boundary.test.ts` runs it.

Brain check passes 1,936 tests. Extension check passes, the wire goldens are
current, the binding corpus passes 15 tests, every retained offline verifier
passes, and the publication candidate check passes. Both check logs are
retained.

The driver deleted the owned tracks in Q (one), P (seven), and `New 8` (two);
each group delete removed its children. Each project matched its entry
tracks, and the reader and the write gate were closed. The operator closed
`New 6`, `New 7`, and `New 8` without saving.

`gn-scale-test` is in front. Before D33 all ten track IDs matched the E231
baseline (`baseline-restored.json`). Under `ALL_CHANNELS` it lists 11 tracks:
the same ten IDs and `gn-E16`, which sits inside the collapsed `Group 5`
(`baseline-all-channels.json`, equal to `baseline-final.json` after the last
run). The rig config is unchanged (SHA-256 `256bbf07…43b0`). Fresh normal hello
passes with the markers and the filter check.

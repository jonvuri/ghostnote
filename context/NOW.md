---
title: Current state
kind: status
state: active
updated: 2026-10-06
phase: phase-8-agent-native-live-engine
session: 8h4a3-complete
---

# Now

8h4a, 8h4a2, and 8h4a3 are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md),
[E241](evidence/experiments/e241-expand-parent-acceptance.md)). The reader
now expands collapsed parent groups for each read
([D34](decisions/d34-the-reader-expands-collapsed-parent-groups.md)). E240
found an open product defect in cursor target confirmation (below). Fix it
before 8h4b, or plan it as a separate session. That choice belongs to the
operator.

## Open defect: cursor position on grouped projects (E240)

`LiveAdapter.pointAtClip` confirms a cursor target with
`cursor.status.trackPosition === trackIndex`. The cursor position is the
position among sibling tracks. The flat bank index (D33, `ALL_CHANNELS`)
counts every group child. Thus each cursor-pointed clip address fails with
`AddressUnresolvedError` on a child of any group, and on every track after a
group, expanded or collapsed. This includes the `clip`, launch, and play reads
of `read_clip` and the stage confirmation of `clip.update` and the note
writes. The `clip.read` notes path checks the `channelId` and is not affected.

The anchor shows the defect: `gn-E16` (bank 5, position 0) and `gn-sel`
(bank 8, position 7) fail, and `gn-A` reads
([cursor-position-anchor.log](evidence/data/phase8h4a2-collapsed/cursor-position-anchor.log)).
A likely fix confirms by the cursor track's `channelId`, not by position.
The fix needs a live check on a grouped project.

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md): complete.
   - [8h4a2](plan/phase-8/8h4a2-collapsed-child-reader-routes.md): complete
     (E240). No route passed the full matrix.
   - [8h4a3](plan/phase-8/8h4a3-expand-parent-acceptance.md): complete
     (E241, D34). The reader expands collapsed parent groups.
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md): the
   `agent-native-v1` profile, the shared result vocabulary,
   `read_launcher_clip`, and the clip and event ID registry.
3. [8h4c](plan/phase-8/8h4c-document-edit-limb.md): `edit_launcher_clip`.
4. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): the
   observation workflow and old musical tools retired; Launcher clip names.
5. [8h4e](plan/phase-8/8h4e-device-structure-migration.md): device structure
   (depends only on 8h4b).
6. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): track-kind
   arms, the default profile cut, measurements, and the 8h closeout.

## What 8h4a–8h4a3 give 8h4b

- `batch.run` refuses a changed generation, project, or scene epoch before
  any op. The executor sends the stash mark for every batch with a launcher
  row; a refusal is `StaleAddressError` (`why` for project or restart).
- A selection from an earlier project is no selection; no tool refuses for it.
- `clip.read` returns the metadata block. Snapshot reads make no metadata
  point; the 16-clip survey takes 4.6 s. The fingerprint stays
  `ghostnote-launcher-source/1`.
- Machine refusal reasons on `Refusal.reason`: `group-slot` (`GroupSlotError`)
  and `collapsed-group-row` (`CollapsedGroupRowError`). 8h4b maps these to
  machine codes. `list_tracks` marks `group: true`.
- [D33](decisions/d33-the-product-track-bank-lists-all-channels.md): the
  product track bank uses `ALL_CHANNELS`, so a collapsed group's children stay
  listed. [D34](decisions/d34-the-reader-expands-collapsed-parent-groups.md):
  every row of a collapsed child reads; the group opens and closes in Bitwig
  during the read. A read of a grouped track takes about 260 ms (nested 380
  ms). A target that the reader cannot expand (more than three levels) refuses
  `collapsed-group-row` after the one E232 retry.
- Tool descriptions are not frozen outside dogfood sessions. Bump the
  description version with each change (now v25; 8h4a2 and 8h4a3 changed
  none).

The plans reserve E235–E239 for 8h4b–8h4f in session order. Record a decision
(D34) only for a choice that changes an active rule.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`3ed03556c92514f462edc92798b303ee52d26758c1217e93cde2e8214c3ece00`). The active
anchor is `gn-scale-test`. It lists 11 tracks: the ten E231 IDs and `gn-E16`
inside the collapsed `Group 5`
([baseline-final.json](evidence/data/phase8h4a-boundary/baseline-final.json),
rechecked in E241). Fresh hello passes `normal-v1`, 87 methods,
`ca139a3e62a55e68`, `clip-reader-v2`, `confirm-before-release-v1`,
`subscribe-before-unpin-v1`, `expand-collapsed-parent-v1`,
`batch-scene-guard-v1`, `selection-project-v1`, and `contentFilter`
`ALL_CHANNELS`. Rig config SHA-256:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Add the index row in the same session as a new E or D record. Start a live edit
matrix from a rewritten clip so that a rerun is valid. A new launcher clip's
default colour is outside the exact palette; set a palette colour before
`clip.update`. The scene epoch counts scene-count callbacks across projects.
Report note channels 1-based to the operator. `context/check.rb` needs
`LANG=en_US.UTF-8`. Bitwig cannot insert a scene above row 0: the operator
adds one and drags it. The first write after an operator scene change can
refuse in the cursor preflight (E3); retry once. Probe `WireTransport` throws
plain `Error`, not `BridgeError`. Driver waits for the operator need no short
timeout. A slot selection on a child of a collapsed group does not take, and
`slot.select` does not move the mixer selection (E240, E241). The parent
handle of a group track repeats the group; the parent of a top-level track is
the project proxy, with the master ID and `isGroup` true (E241). The first
read of a session can lose its lease (E232 open observation; once more in
E241).

8h4a2 retrospective: the plan's matrix covered the reader route but not the
other tools on a grouped track. A five-minute `read_clip` smoke on the
fixture would have found the cursor-position defect at the start. When a
session builds a new live fixture shape, run each product read tool on it
once before the matrix. Also, retain driver errors in an artifact: one
reference failure was lost because the driver threw before it wrote.

8h4a3 retrospective: a matrix of grouped targets did not include a top-level
target, and its entries never put the slot selection inside the group. Two
fail-closed product defects survived until a top-level timing run and a read
in the anchor. A promotion matrix needs the unaffected baseline case (a track
in no group) and the entry that a person makes on the real path. The anchor
was the cheapest place to find the second.

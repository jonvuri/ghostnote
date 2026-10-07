---
title: Current state
kind: status
state: active
updated: 2026-10-07
phase: phase-8-agent-native-live-engine
session: 8h4a5-planned
---

# Now

8h4a through 8h4a4 are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md),
[E241](evidence/experiments/e241-expand-parent-acceptance.md),
[E242](evidence/experiments/e242-cursor-track-identity.md)). The reader
expands collapsed parent groups for each read
([D34](decisions/d34-the-reader-expands-collapsed-parent-groups.md)).
Cursor targets now confirm by the track `channelId`, so cursor-pointed reads,
writes, and device targets work inside and after groups (E242). The next
session is
[8h4a5](plan/phase-8/8h4a5-collapsed-cursor-and-parameter-settle.md). It fixes
the two E242 limits below, then 8h4b follows.

## Open limits (E242), planned for 8h4a5

Both fail closed.

- **Rows other than 0 of a collapsed child.** A fresh cursor point does not
  reach them: the `clip`, launch, play, and metadata reads, write stage
  confirmation, and the note observer arm refuse with
  `AddressUnresolvedError`. The `clip.read` notes path is not affected. A
  fix could reuse the D34 expansion for the cursor point. In the anchor this
  affects `gn-E16` rows 1-15. 8h4c edits there reach the limit.
- **Same device type on two tracks.** After a device read on one track, a
  device with the same DirectParameter ID list on another track never
  settles its inventory (`Rig.beginDirectParameterObservation` clears the
  IDs; Bitwig does not call the ID observer again). The device reports no
  `params`, and a parameter address is unstable. Not group related; 8h4e
  device work reaches it.

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md): complete.
   - [8h4a2](plan/phase-8/8h4a2-collapsed-child-reader-routes.md): complete
     (E240). No route passed the full matrix.
   - [8h4a3](plan/phase-8/8h4a3-expand-parent-acceptance.md): complete
     (E241, D34). The reader expands collapsed parent groups.
   - [8h4a4](plan/phase-8/8h4a4-cursor-track-identity.md): complete (E242).
     Cursor targets confirm by `channelId`.
   - [8h4a5](plan/phase-8/8h4a5-collapsed-cursor-and-parameter-settle.md):
     next. Clip metadata and launch reads move to `clip.read`; cursor points
     reach collapsed children; same-type devices settle their parameters.
     Probes first; evidence E243.
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

## What 8h4a–8h4a4 give 8h4b

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
- `cursor.status` and `cursor.playState` report `trackChannelId`. Confirm a
  cursor target by it, never by `trackPosition` (a sibling position, not the
  bank index).
- Tool descriptions are not frozen outside dogfood sessions. Bump the
  description version with each change (now v25; 8h4a2 through 8h4a4
  changed none).

The plans reserve E235–E239 for 8h4b–8h4f in session order; the next free
number after them is E243 (8h4a5). Record a decision (next D35) only for a choice that
changes an active rule.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`210ea5852bf889f57ae96cd3eedf4c760093f1044073a023bc7bf66be2c8b672`). The active
anchor is `gn-scale-test`. It lists 11 tracks: the ten E231 IDs and `gn-E16`
inside the collapsed `Group 5`
([baseline-final.json](evidence/data/phase8h4a-boundary/baseline-final.json),
rechecked in E242). Fresh hello passes `normal-v1`, 87 methods,
`ca139a3e62a55e68`, `clip-reader-v2`, `confirm-before-release-v1`,
`subscribe-before-unpin-v1`, `expand-collapsed-parent-v1`,
`batch-scene-guard-v1`, `selection-project-v1`, `cursor-channel-id-v1`, and
`contentFilter` `ALL_CHANNELS`. Rig config SHA-256:
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

8h4a3 retrospective: a matrix of grouped targets did not include a top-level
target, and its entries never put the slot selection inside the group. Two
fail-closed product defects survived until a top-level timing run and a read
in the anchor. A promotion matrix needs the unaffected baseline case (a track
in no group) and the entry that a person makes on the real path. The anchor
was the cheapest place to find the second.

8h4a4 retrospective: two results came from the fixture, not the change. A
matrix step passed only because a pool cursor was still on its row from an
earlier run, and one device type on every track hid a DirectParameter limit
behind what looked like a group failure. Check each target from a fresh
adapter, and use different device types on the fixture tracks.

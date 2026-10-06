---
title: Current state
kind: status
state: active
updated: 2026-10-06
phase: phase-8-agent-native-live-engine
session: 8h4a-complete
---

# Now

8h4a is complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md)).
The next session implements
[8h4b — Document read and identity registry](plan/phase-8/8h4b-document-read-and-identity-registry.md)
under the [8h parent plan](plan/phase-8/8h-cache-promotion-and-interface-simplification.md).

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md): complete.
   - [8h4a2](plan/phase-8/8h4a2-collapsed-child-reader-routes.md): research
     reader routes for rows other than 0 of a track in a collapsed group
     (probe profile, operator steps). Independent of 8h4b–8h4f; run it before
     or after 8h4b.
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

## What 8h4a gives 8h4b

- `batch.run` refuses a changed generation, project, or scene epoch before
  any op. The executor sends the stash mark for every batch with a launcher
  row; a refusal is `StaleAddressError` (`why` for project or restart).
- A selection from an earlier project is no selection; no tool refuses for it.
- `clip.read` returns the metadata block. Snapshot reads make no metadata
  point; the 16-clip survey takes 4.6 s. The fingerprint stays
  `ghostnote-launcher-source/1`.
- A group track's own slot refuses with `group-slot` (`GroupSlotError`,
  refusal `reason`). `list_tracks` marks `group: true`. 8h4b maps these
  refusals to machine codes.
- [D33](decisions/d33-the-product-track-bank-lists-all-channels.md): the
  product track bank uses `ALL_CHANNELS`, so a collapsed group's children stay
  listed. Only row 0 of a collapsed child reads; other rows refuse
  `bound-target-mismatch` (E221). 8h4a2 owns this.
- Tool descriptions are not frozen outside dogfood sessions. Bump the
  description version with each change (now v25).

The plans reserve E235–E239 for 8h4b–8h4f in session order, and E240 for
8h4a2. Record a decision (D34) only
for a choice that changes an active rule.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`9038d30e8d39e5b4fb4eb623998451ab91625107a69d9be7de6b73823c2ff590`). The
active anchor is `gn-scale-test`. Under `ALL_CHANNELS` it lists 11 tracks: the
ten E231 IDs and `gn-E16` inside the collapsed `Group 5`
([baseline-final.json](evidence/data/phase8h4a-boundary/baseline-final.json)).
Fresh hello passes `normal-v1`, 87 methods, `ca139a3e62a55e68`,
`clip-reader-v2`, `confirm-before-release-v1`, `subscribe-before-unpin-v1`,
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
timeout.

8h4a retrospective: the plan took "a collapsed child stays addressable" from
E222, which ran with a research rig config (`ALL_CHANNELS`). When a plan
carries a live result forward, carry its rig configuration with it. A hold
placed before the live adapter's preflight did not reach the extension guard;
hold at the wire frame that the guard protects.

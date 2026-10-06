---
title: Current state
kind: status
state: active
updated: 2026-10-06
phase: phase-8-agent-native-live-engine
session: 8h4-planned
---

# Now

8h4 is planned in six sessions under the
[8h parent plan](plan/phase-8/8h-cache-promotion-and-interface-simplification.md).
The next session implements
[8h4a — Write boundary and reader hardening](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md).

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md): the scene
   guard at `batch.run`, the selection after a project switch, metadata in the
   `clip.read` reply, and the `group-slot` refusal.
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

## Decisions taken in planning

- New tools go into a new `agent-native-v1` profile. 8h4f makes it the
  default. `stable-v1` stays frozen as the rollback through 8i. The 7b profile
  retires in 8h4d.
- The edit limb is `edit_launcher_clip`.
- A group track's own launcher slots refuse with `group-slot` (E222).
- The live audio-track creation and Audio/Hybrid duplication arms are in 8h4f.

The plans reserve E234–E239 in session order. Record a decision (D33) only for
a choice that changes an active rule.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`737464bb29b2520c5009e8d883e9d9c8914cb9a08c80776820e89e2c48cb5a77`). The
active anchor is `gn-scale-test`; all ten track IDs match the E231 baseline.
Fresh hello passes `normal-v1`, 87 methods, `ca139a3e62a55e68`,
`clip-reader-v1`, `confirm-before-release-v1`, and
`subscribe-before-unpin-v1`. Rig config SHA-256:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Add the index row in the same session as a new E or D record. Start a live edit
matrix from a rewritten clip so that a rerun is valid. A new launcher clip's
default colour is outside the exact palette; set a palette colour before
`clip.update`. The scene epoch counts scene-count callbacks across projects.
Report note channels 1-based to the operator. `context/check.rb` needs
`LANG=en_US.UTF-8`.

Planning retrospective: the 8h parent named 8h4 as one session, but its scope
had grown to nine topics from three sources (8a, E135, E233). Split a parent
item into sessions when its input list grows, not at the end.

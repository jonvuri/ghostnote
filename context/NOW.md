---
title: Current state
kind: status
state: active
updated: 2026-10-07
phase: phase-8-agent-native-live-engine
session: 8h4b-next
---

# Now

8h4a through 8h4a5 are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md),
[E241](evidence/experiments/e241-expand-parent-acceptance.md),
[E242](evidence/experiments/e242-cursor-track-identity.md),
[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md)).
Every row of a child of a collapsed group now reads and writes, through the
reader (D34) and through the cursor route `cursor.pointExpanded` (E243). A
device after a same-type device settles its parameters. The next session is
[8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md).

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) and
   8h4a2–8h4a5: complete (E234, E240–E243; D33, D34).
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md): next.
   The `agent-native-v1` profile, the shared result vocabulary,
   `read_launcher_clip`, and the clip and event ID registry.
3. [8h4c](plan/phase-8/8h4c-document-edit-limb.md): `edit_launcher_clip`.
4. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): the
   observation workflow and old musical tools retired; Launcher clip names.
5. [8h4e0](plan/phase-8/8h4e0-direct-parameter-display-probe.md): probe of
   the DirectParameter display observer (E244). `Rig` discards the observer
   object, so it observes no ID; the probe tests that cause.
6. [8h4e](plan/phase-8/8h4e-device-structure-migration.md): device structure
   (depends only on 8h4b; uses E244 for display text).
7. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): track-kind
   arms, the default profile cut, measurements, and the 8h closeout.

## What 8h4a–8h4a5 give 8h4b

- `batch.run` refuses a changed generation, project, or scene epoch before
  any op; a refusal is `StaleAddressError`. A selection from an earlier
  project is no selection.
- `clip.read` returns the `metadata` and `launch` blocks (`clip-reader-v3`).
  The adapter serves `clip`, `clipMetadata`, and `clipLaunch` from the
  capture; one snapshot reads each clip once and points no cursor. Only
  `clipPlay` and writes use a pool cursor. The fingerprint stays
  `ghostnote-launcher-source/1`.
- `track.list` marks a child of a collapsed group `hidden: true`. The adapter
  points such a track only with `cursor.pointExpanded`, which expands, points,
  pins, restores the selection, and collapses (D34 order). Other tracks keep
  the present route at no extra cost. The extra time on a collapsed child is
  about 250 ms for a read and 1.8 s for a note round trip (E243).
- Machine refusal reasons on `Refusal.reason`: `group-slot` and
  `collapsed-group-row` (the reader or the cursor route could not expand the
  target). 8h4b maps these to machine codes. `list_tracks` marks
  `group: true`; it does not yet expose `hidden`.
- Confirm a cursor target by `trackChannelId`, never by `trackPosition`.
  `directparam.list` reports `settledBy` (`ids`, `switch`, `target`).
- Tool descriptions are at v25; 8h4a2 through 8h4a5 changed none. Update
  them in the session that changes the behaviour they describe, and bump the
  version (AGENTS.md, Implementation sessions, step 3).

The plans reserve E235–E239 for 8h4b–8h4f in session order; the next free
number after them is E244 (8h4e0), then E245. Record a decision (next D35) only for a choice that
changes an active rule.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`46cde14347a24b6efc7999251fb798665fd4cad9d00d0f50293e45859354bce7`). The active
anchor is `gn-scale-test`. It lists 11 tracks: the ten E231 IDs and `gn-E16`
(`hidden`) inside the collapsed `Group 5`
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
`gn-E16` holds clips only in rows 0, 1, and 2. Fresh hello passes `normal-v1`,
88 methods, `68d457c4c4d1d7b3`, `clip-reader-v3`, `confirm-before-release-v1`,
`subscribe-before-unpin-v1`, `expand-collapsed-parent-v1`,
`batch-scene-guard-v1`, `selection-project-v1`, `cursor-channel-id-v1`,
`expand-collapsed-point-v1`, `same-ids-switch-v1`, and `contentFilter`
`ALL_CHANNELS`. The probe profile has 103 methods (`dcecae0adfbf52e4`). Rig
config SHA-256:
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
timeout. A slot selection on a child of a collapsed group does not take; a
pinned cursor keeps its row across a collapse (E243 P1). An unconfirmed point
in a `batch.run` turn on a collapsed child writes row 0 (E243 P2): every
cursor write must confirm its row before the turn. A direct adapter read on
the present route restores only the slot; the mixer selection stays on the
target (not new, E243). `write_notes` adds notes; restore with `erase_notes`.
The first read of a session can lose its lease (E232 open observation).

8h4a5 retrospective: the plan assumed that `list_tracks` knows a track's
parent and that a hop could make the ID observer fire. Neither was true, and
only the probes showed it. A plan that names a data source should cite the
field or the line that holds it. The P2 probe also found a wrong-row write in
`clip.launchSettings` that no earlier matrix covered: an acceptance matrix
must include each write op that takes the same address, not only the ones
named in the earlier limit.

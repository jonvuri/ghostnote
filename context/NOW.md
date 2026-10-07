---
title: Current state
kind: status
state: active
updated: 2026-10-07
phase: phase-8-agent-native-live-engine
session: 8h4c-next
---

# Now

8h4a through 8h4b2 are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md)–[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
[E235](evidence/experiments/e235-document-read-and-identity-registry.md),
[E245](evidence/experiments/e245-document-read-compactness-and-gain.md)).
The `agent-native-v1` profile reads a Launcher clip as a Document 1.0
snapshot (`read_launcher_clip`) and checks base refs (`check_launcher_clips`).
A new host note reads with no `WITH` object; a typical read is about 11 KB.
The next session is [8h4c](plan/phase-8/8h4c-document-edit-limb.md):
`edit_launcher_clip`.

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) and
   8h4a2–8h4a5: complete (E234, E240–E243; D33, D34).
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md) and
   [8h4b2](plan/phase-8/8h4b2-document-read-compactness-and-gain.md):
   complete (E235, E245; D35). E245 records bytes and Claude tokens.
3. [8h4c](plan/phase-8/8h4c-document-edit-limb.md): next. `edit_launcher_clip`.
4. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): the
   observation workflow and old musical tools retired; Launcher clip names.
5. [8h4e0](plan/phase-8/8h4e0-direct-parameter-display-probe.md): probe of
   the DirectParameter display observer (E244).
6. [8h4e](plan/phase-8/8h4e-device-structure-migration.md): device structure
   (depends only on 8h4b; uses E244 for display text).
7. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): track-kind
   arms, the default profile cut, measurements, and the 8h closeout.

## What 8h4b and 8h4b2 give 8h4c

- One result module, `brain/src/surface/agent-native-result.ts`: read,
  write, and failure envelopes, `FAILURE_CODES`, `VERDICT_CODES`, and
  `REFUSAL_CODES`. Return a `failureResult`; do not throw to the agent and do
  not add a second envelope.
- `workspace.documents` is the identity registry. `entry.snapshot` is the D32
  `Authority` for `guardAuthority`; `entry.events` maps `channel:pitch:cell`
  to event ID; `entry.contentHash` is the R27 base. A write that keeps an ID
  at a new cell must record it through a new registry method (the identity
  table row "authorized portable update").
- `projectLauncherClip` and `launcherClipCells` project a fresh read with
  given IDs. `playRange` is uncovered: the typed metadata has no play-stop
  marker. Add it before a write that changes the range.
- Gain (E245, HOST-BINDING "Gain zero"): portable gain is raw cubed, spelled
  shortest (`portableGain`); write `hostGain(portable)` through the E24 setter
  scale. Raw 0 is unity and also an inspector -inf note. Portable 0 writes the
  silent raw value `1e-323`, never setter 0. Portable gain is 0..8 (D35).
- An enabled control with a neutral value projects to the portable default;
  an untouched note keeps its raw flags. Release velocity default is `100/127`
  (D35). `d9MappedFields` already applies these rules.
- The read wrapper has `coverage: {status}` and `loss` only when timing moved.
- Tool descriptions are at v27 (`TOOL_DESCRIPTION_V27_SHA256`). The v25 stable
  artifact still reproduces; v26 is a frozen fingerprint.
- A typical read takes about 575–610 ms and returns about 11 KB (E245).

The plans reserve E236–E239 for 8h4c–8h4f in session order and E244 for
8h4e0; the next free number is E246. Record a decision (next D36) only for a
choice that changes an active rule.

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

8h4b2 retrospective: the plan's preferred release-velocity rule conflicted
with R04 snapshot omission. A plan that offers a binding-level default should
check it against the format's omission rule. A host value probe should include
the lowest finite setting beside -inf. The inspector shows velocity as a
percentage (100 is 78.7 percent); give the operator percentages.

8h4b retrospective: the byte target came from an 8c measurement that omitted
most host fields, and no session had measured Document 1.0 against it. A plan
that adopts a numeric target from an earlier format should cite the
measurement that shows the new format can meet it. A probe that polls during
an operator edit must treat a reader refusal as not settled.

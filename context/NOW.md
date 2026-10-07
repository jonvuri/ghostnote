---
title: Current state
kind: status
state: active
updated: 2026-10-07
phase: phase-8-agent-native-live-engine
session: 8h4b2-next
---

# Now

8h4a through 8h4b are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md)–[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
[E235](evidence/experiments/e235-document-read-and-identity-registry.md)).
The `agent-native-v1` profile reads a Launcher clip as a Document 1.0
snapshot (`read_launcher_clip`) and checks base refs (`check_launcher_clips`).
Every live identity claim agreed with a raw read. The next session is
[8h4b2](plan/phase-8/8h4b2-document-read-compactness-and-gain.md): it fixes
the E235 format findings (gain meaning, neutral enable flags, the release
velocity default, other distractions) before 8h4c writes documents.

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) and
   8h4a2–8h4a5: complete (E234, E240–E243; D33, D34).
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md):
   complete (E235), except the 40 percent byte target and per-model tokens.
3. [8h4b2](plan/phase-8/8h4b2-document-read-compactness-and-gain.md): next.
   Gain correctness and read compactness (E245).
4. [8h4c](plan/phase-8/8h4c-document-edit-limb.md): `edit_launcher_clip`.
5. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): the
   observation workflow and old musical tools retired; Launcher clip names.
6. [8h4e0](plan/phase-8/8h4e0-direct-parameter-display-probe.md): probe of
   the DirectParameter display observer (E244).
7. [8h4e](plan/phase-8/8h4e-device-structure-migration.md): device structure
   (depends only on 8h4b; uses E244 for display text).
8. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): track-kind
   arms, the default profile cut, measurements, and the 8h closeout.

## What 8h4b gives 8h4c

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
- Tool descriptions are at v26 (`TOOL_DESCRIPTION_V26_SHA256`, built from the
  agent-native list). The v25 stable artifact still reproduces.
- A typical read takes about 600–680 ms and returns about 91 KB (E235).

The plans reserve E236–E239 for 8h4c–8h4f in session order, E244 for 8h4e0,
and E245 for 8h4b2; the next free number is E246. Record a decision (next D35)
only for a choice that changes an active rule.

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

8h4b retrospective: the byte target came from an 8c measurement that omitted
most host fields, and no session had measured Document 1.0 against it. A plan
that adopts a numeric target from an earlier format should cite the
measurement that shows the new format can meet it. A probe that polls during
an operator edit must treat a reader refusal as not settled.

8h4a5 retrospective: the plan assumed that `list_tracks` knows a track's
parent and that a hop could make the ID observer fire. Neither was true, and
only the probes showed it. A plan that names a data source should cite the
field or the line that holds it. The P2 probe also found a wrong-row write in
`clip.launchSettings` that no earlier matrix covered: an acceptance matrix
must include each write op that takes the same address, not only the ones
named in the earlier limit.

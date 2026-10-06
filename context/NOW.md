---
title: Current state
kind: status
state: active
updated: 2026-10-06
phase: phase-8-agent-native-live-engine
session: 8h3e-complete
---

# Now

[8h3e](plan/phase-8/8h3e-cache-machinery-trim.md) is complete and staged, not
committed ([E233](evidence/experiments/e233-pull-snapshot-references.md),
[D32](decisions/d32-pull-snapshot-references-use-the-revision-mark.md)). The
next session plans 8h4 from the
[8h parent plan](plan/phase-8/8h-cache-promotion-and-interface-simplification.md).

## Result

- A D32 snapshot reference holds the product `RevisionMark`, the durable
  address, and one `ghostnote-launcher-source/1` digest
  (`brain/src/contract/clip-snapshot.ts`, `engine/clip-snapshots.ts`).
- `RunOptions.ifSnapshot` refuses before any host mutation unless every
  reference is `current`. The experimental profile returns a reference from
  `acquire_clip_note_source`, checks it in proposal `apply`, and adds
  `check_clip_snapshots`. The stable profile is unchanged.
- 23 live verdicts match independent raw reads. Three P→Q→P detours each
  overflowed the 24-event ring and refused; none was quiet.
- The resident-grid research code is removed. Probe: 98 methods,
  `659635435255b259`. Research uses `ghostnote probe` (`copyProbeExtension`).
- The pull snapshot contract, host binding, identity rules, migration
  contract, `Authority`, and the 8h plan state D32.

## 8h4 inputs

Document integration on the D32 reference and the clip and event ID registry;
no adapter checks the scene epoch at apply, so a scene change between the stash
read and the write is unguarded (E233);
the stale selection after a project switch (`preserveSelection` refuses in Q);
about 300 ms of metadata cursor point per checked clip; group-slot handling
(E222).

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`737464bb29b2520c5009e8d883e9d9c8914cb9a08c80776820e89e2c48cb5a77`). The
active anchor is `gn-scale-test`; all ten track IDs match the E231 baseline.
Fresh hello passes `normal-v1`, 87 methods, `ca139a3e62a55e68`,
`clip-reader-v1`, `confirm-before-release-v1`, and
`subscribe-before-unpin-v1`. Rig config SHA-256:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Add the index row in the same session as a new E or D record: E230–E232 and
D31 had no index rows until 8h3e. Start a live edit matrix from a rewritten
clip so that a rerun is valid. A new launcher clip's default colour is outside
the exact palette; set a palette colour before `clip.update`. The scene epoch
counts scene-count callbacks across projects. Report note channels 1-based to
the operator. `context/check.rb` needs `LANG=en_US.UTF-8`.

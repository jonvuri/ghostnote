---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h3c-complete
---

# Now

[8h3c — Cold-reader promotion](plan/phase-8/8h3c-cold-reader-promotion.md)
is complete. Changes are staged for review. No commit was made.

Read [E230](evidence/experiments/e230-cold-reader-promotion.md),
[D31](decisions/d31-mutation-and-reversal-use-the-d23-cell-boundary.md),
and the staged diff for review. The next implementation session is
[8h3d — Change awareness](plan/phase-8/8h3d-change-awareness.md).

## Result

- Product notes use one memoized `clip.read` capture per clip, with checked
  `notes-v1` pages. E131 is a named diagnostic only. Missing or incompatible
  configuration refuses.
- Master park, eight paired fixtures on all 16 channels, full selection
  restore, normal and synthetic refusals, and all five write-gate cases pass.
- D31 applies occupied `1/512` cells to mutation and reversal. Raw disabled
  controls survive reconstruction. A normalized onset with triplet duration
  reconstructs and verifies.
- Brain check passes 1,887 tests, with one review-fix test. Extension
  check passes with 13 reader test groups. Artifact, context, and diff
  checks pass.

## Live baseline

The operator closed owned `New 6` without saving and fully restored normal
`ghostnote`. No fixture or research archive remains. The active anchor is
`gn-scale-test`; all ten track IDs match the earlier baseline.

Fresh hello passes `normal-v1`, 87 methods, hash `ca139a3e62a55e68`,
`clip-reader-v1`, and `closeRule: confirm-before-release-v1`.
Initialization is `2026-10-05T15:29:49.499Z`. Normal archive SHA-256:
`c3dcc97abdcd69e99a07510dc11bb9e15b729f4051891eb3ebb7d5b3329c23fe`.
Rig config SHA-256 is unchanged:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Confirm the frozen close copy before unsubscribe. Release Empty callbacks
have separate counters and cannot change that copy. Every callback before
release remains a tripwire event. A deadline before bind can leave mixer
selection at master park; its reply reports `refused-before-bind`.

Name the product park target before implementation. Include normalized
onset plus triplet-duration reconstruction in acceptance. Record only owned
requests for concurrent probe costs. Check slot and mixer selection separately,
and use MIDI velocity for nominal fixtures while preserving exact raw-field
comparisons. `context/check.rb` needs `LANG=en_US.UTF-8`.

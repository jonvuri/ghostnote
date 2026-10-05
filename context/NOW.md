---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h2a-complete
---

# Now

[8h2a](plan/phase-8/8h2a-replay-cold-read.md) is complete.
[E227](evidence/experiments/e227-replay-cold-read.md) records the results.
Session changes are staged for review. No commit was made.

The user accepted the replay batch and `clipExists` start signal as named
assumptions in [D30](decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md).
Next: write the 8h1 plan again from E227 and D30. [8h2b](plan/phase-8/8h2b-exact-reader-consolidation.md)
follows 8h1.

## Live state

- The original rig config is restored (SHA-256 `256bbf07…43b0`). The normal
  archive is deployed. The research archive is removed.
- The operator closed the owned `New 2` without saving. The UI shows
  `gn-scale-test`, which research did not change.
- Normal hello passes: `normal-v1`, 85 methods, hash `bba7383dce25c0f0`.
  Initialization at `2026-10-05T07:48:57.336Z` is newer than deployment.

## Inputs for 8h1

- A full-width 1/512 bind is a complete cold read. In 160 of 160 binds the
  replay was one batch, and the tasks from the first callback and from the
  target `clipExists` callback saw every callback. Reads took 46–698 ms up
  to 1,048,513 cells. E131 takes 11 s at 64 beats.
- Callback-only decode is exact for every note field, with no `getStep`.
- Edits by the user or the host need no refusal. A Ghostnote write issued
  during the replay can follow the confirmation (6 of 10 trials). 8h2b queues
  Ghostnote writes behind an open read.
- One replay batch blocks the controller thread for up to 316 ms at one million
  cells. Each release delivers one Empty callback for each cell.
- The cache may only need to bound memory, not avoid cold reads. A
  cold read on demand followed by a release keeps no grid resident.
- Host gain reads back twice the written value (E2). A repeated equal setter
  leaves a cursor's `getStep` cache stale; rebind for a fresh read.

## Retrospective

The gain doubling was already in E2, but no fixture document linked it, so
two fixture runs failed. When a fixture writes a note field, search the
evidence index for that field name before trusting a read-back.

---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h1b-complete
---

# Now

[8h1b](plan/phase-8/8h1b-sounding-cell-cost-reduction.md) is complete.
[E226](evidence/experiments/e226-sounding-cell-cost-reduction.md) records the
results. Session changes are staged for review. No commit was made. Next:
[8h2a](plan/phase-8/8h2a-replay-cold-read.md), a replay cold read. It runs
before 8h1 and [8h2b](plan/phase-8/8h2b-exact-reader-consolidation.md),
because a fast cold read changes what 8h1 needs.

## Live state

- The original rig config is restored (SHA-256 `256bbf07…43b0`). The normal
  archive is deployed. The research archive is removed.
- The operator closed the owned `New 2` without saving. The UI shows
  `gn-scale-test`, which research did not change.
- Normal hello passes: `normal-v1`, 85 methods, hash `bba7383dce25c0f0`.
  Initialization at `2026-10-05T06:02:58.322Z` is newer than deployment.

## Inputs for 8h2a and 8h1

- A full-width 1/512 proxy received all 1,048,513 cells, with values, 130–150 ms
  after a bind. The first and last callbacks were 33 ms apart. 8h2a tests this
  push as a complete cold read with a D27 completion signal and a start signal.
- Release rule: a full-width cursor that leaves residence unsubscribes its
  clip. Resubscribe replays one million cells in about 130 ms, but 8h1 must
  treat it as a rebind with identity and window checks. Unpin and an empty slot
  selection do not release. Release the authority after each use.
- Admission: `SoundingCellBudget` admits by measured cells after a read and
  evicts least recently used residents. Each cell costs about 280 bytes for
  each full-width proxy. A canary readmission takes 6–7.4 s.
- The coarse sentinel is refused: 1/16 beat misses an in-cell 1/512 nudge.
  Keep one 1/512 proxy for each resident clip.
- Loop and length changes give no note-step callback; use metadata observers.
- Still open from E225: the retained read data (about 264 MiB at 131,072
  notes), the 210 ms research diagnostic calls, and the 10 s first anchor
  switch.

## Retrospective

Two first runs used wrong host assumptions: a selected empty slot does not
move a cursor clip, and new notes have chance enabled. Before a matrix or
action plan relies on a default or a selection side effect, read it once
from the host. Both failed runs are kept as diagnostics.

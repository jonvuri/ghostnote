---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h3a-complete
---

# Now

[8h3a — Cold-read dealbreaker check](plan/phase-8/8h3a-cold-read-dealbreaker-check.md)
is complete. [E228](evidence/experiments/e228-cold-read-dealbreaker-check.md)
records 1,042 verified verdicts and 500 qualifying soak binds, with 250 playing.
No dealbreaker remains open. [D30](decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md)
coverage is updated; its assumptions are not revoked.

Product rules for 8h3c:

- Bind from empty park. Select the target row before pointing the reader.
- Finish scheduled writes before the read opens. A scheduling reply is not
  an execution barrier. Queue writes behind an open read.
- The user accepts temporary visible selection changes for modal use.
  Capture selection before park preparation. Restore slot track, slot row,
  and mixer track at close under the E99 lease; unsubscribe for release.
  A lost lease must refuse restoration.
- Flag every step callback after close and before release. Refuse the frozen
  capture on a violation. Use no fixed watch delay.

The replay reader remains the planned replacement for E131 on every read and
write path. The resident note cache has no speed role. Keep identity,
generation, and snapshot validity for patches against snapshots.

Next: [8h3b — Replay fetch cost](plan/phase-8/8h3b-replay-fetch-cost.md).
Then 8h3c promotion, 8h3d change awareness, and 8h3e cache trim.
Changes are staged for review. No commit was made.

## Live state

- The operator closed `New 3` without saving. No fixture tracks remain in the
  active project. `gn-scale-test` is the anchor; research did not change it.
- The original config is restored (SHA-256 `256bbf07…43b0`). The normal
  archive is deployed. The research archive is removed.
- Fresh normal hello passes at `2026-10-05T12:05:58.299Z`: `normal-v1`,
  85 methods, hash `bba7383dce25c0f0`. See
  [restoration.json](evidence/data/phase8h3a-dealbreakers/restoration.json).

## Facts that are easy to lose

- D23 settles one 1/512 view. Stable code keeps `1/768` until 8h3c removes it.
- E225 proved 4,194,304 steps. Normal limits stay unchanged until 8h3c.
- Non-following cursors can change visible selection when pointed. E131 also
  borrows selection. Modal acceptance keeps the lease and restore guards.
- E227 fetched 131,072 notes in 379 ms. 8h3b profiles that cost.
- Host gain reads back twice the written value (E2). An equal setter can leave
  `getStep` stale; rebind for a fresh verification read.

## Retrospective

Use terminal phase labels and a countdown for operator checks. Verify actual
transport state; `play()` toggles it. Keep historical attempt data separate
from the qualifying set.

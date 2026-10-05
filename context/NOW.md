---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h3-planned
---

# Now

The replay cold read ([E227](evidence/experiments/e227-replay-cold-read.md),
[D30](decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md))
changed the 8h route. The replay reader is the planned replacement for E131 on
every read and write path. The resident note cache has no speed role. The
identity, generation, and snapshot-validity machinery stays, because the
compact-bar format sends patches against snapshots.

The planning session replaced 8h1 and 8h2b with five sessions, 8h3a to 8h3e. See the
[8h session split](plan/phase-8/8h-cache-promotion-and-interface-simplification.md#session-split).
The planning changes are staged for review. No commit was made.

Next: [8h3a — Cold-read dealbreaker check](plan/phase-8/8h3a-cold-read-dealbreaker-check.md).
Then [8h3b — Replay fetch cost](plan/phase-8/8h3b-replay-fetch-cost.md),
[8h3c — Cold-reader promotion](plan/phase-8/8h3c-cold-reader-promotion.md),
[8h3d — Change awareness](plan/phase-8/8h3d-change-awareness.md), and
[8h3e — Cache machinery trim](plan/phase-8/8h3e-cache-machinery-trim.md)
(outline only). Interface simplification is now 8h4.

## Live state

- The original rig config is restored (SHA-256 `256bbf07…43b0`). The normal
  archive is deployed. The research archive is removed.
- The UI shows `gn-scale-test`, which research did not change.
- Normal hello passes: `normal-v1`, 85 methods, hash `bba7383dce25c0f0`.

## Facts that are easy to lose

- D23 settles one 1/512 view. No triplet policy remains to select. The stable
  code still has the `1/768` view until 8h3c removes it.
- E225 proved width up to 4,194,304 steps, but the normal runtime limits are
  not changed. 8h3c makes that width the product limit.
- Every bind calls the target track's `selectSlot(row)`. D6, E1, and E14 show
  that this moves the user's slot selection when the row is not already
  selected. Non-following cursors do not follow the user's selection, but
  pointing them can still change it. E227 used row 0 only. 8h3a measures it.
- The bridge fetch took 379 ms for 131,072 notes (E227). 8h3b profiles it.
- Host gain reads back twice the written value (E2). A repeated equal setter
  leaves a cursor's `getStep` cache stale; rebind for a fresh read.

## Retrospective

Two facts were misstated during the assessment: the width limit (proved in
E225 but not promoted) and the triplet policy (settled in D23). The stable code
did not yet show either. "Facts that are easy to lose" above now records both.

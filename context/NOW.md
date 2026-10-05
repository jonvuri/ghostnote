---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h1a-continuation-complete
---

# Now

[8h1a](plan/phase-8/8h1a-cache-limit-knee-sweep.md) is complete.
[E225](evidence/experiments/e225-cache-limit-knee-sweep.md) records all rows and
selected research limits. Session changes are staged for review. No commit
was made. Next: [8h1b](plan/phase-8/8h1b-sounding-cell-cost-reduction.md).

## Live state

- The original rig config is restored (SHA-256 `256bbf07…43b0`). The normal
  archive is deployed. The research archive is removed.
- The operator discarded the owned `New 2` project and restored `ghostnote`.
  The UI shows only `gn-scale-test`, with its unsaved marker. No research
  wrote to this saved anchor. Do not save or discard its changes by assumption.
- Normal hello passes: `normal-v1`, 85 methods, hash `bba7383dce25c0f0`.
  Initialization at `2026-10-05T04:23:10.842Z` is newer than deployment.
  Controller replacement did not reset the JVM.

## Findings for 8h1b

- Warm-read scaling is fixed. Cursor slot bank 0 passes the binding matrix.
- Combined exact reads pass at 131,072 notes and 4,194,304 steps. Warm median
  is 2.82 s. Native transpose and restore are exact. Row 127 and its E131
  pair are exact. The operator rates the UI as responsive enough.
- Peak live heap is 2,013 MiB. Retained read data adds about 264 MiB.
  Complete research diagnostic calls reach 210 ms. The first anchor switch
  takes 10 s. These costs need work before promotion.
- Brain check (1,843 tests), extension check, wire goldens, context check, and
  diff checks pass. Data and restoration identity are in
  [continuation/](evidence/data/phase8h1a-knee/continuation/).

## Retrospective

Use project `itemCount` and check bank coverage before inventory. Wait for the
project name before measuring switch drain. Poll small binding waves inside the
deadline. Wait for each live process to exit before starting another. The driver
now has a process lock and rejects inexact full reads. Keep failed runs as
diagnostics; use only clean runs for conclusions.

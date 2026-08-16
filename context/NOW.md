---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-4
---

# Now

Phase 1 is **ready to begin session 4**. The complete 3g observation and v1
description program is closed offline and live.

## Baseline

- `copy_track` is ordinary track CRUD. Device alternates and clip blocks are
  independent managed representations.
- The observation record is empty. The project has its exact 10 baseline track
  ids, including `FX 1` and Master, with no probe residue.
- The hidden per-project record survives a full restart. Its field is absent
  from the controller pane, and the pane remains responsive.
- `ghostnote-description-v1` remains the frozen 15-tool cohort at SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- The wire golden remains 149 methods / `bd01617c718f5c50`.

## Session 3g-e — complete 2026-08-16, verified live

The read-only raw view returns the complete canonical record. Descriptive
reporting reconciles instruction, managed-event, and ordinary-use totals. It
cross-tabulates requested scope against separate device-event, clip-event, and
track-copy counts. It reports silent, accepted, and vetoed responses with choice
diversity. It adds no score, recommendation, redirect, or dispatch rule.

The six-case production record survived save, full restart, and reopen exactly.
The initial cleanup exposed and recovered a positional multi-track deletion
defect. `delete_track` now rejects repeated ids and removes several tracks from
the highest observed position to the lowest. The corrected cleanup passed live
and restored all 10 baseline ids and the prior empty record.

Verification: brain typecheck and **492/492** tests; extension Gradle test;
context check; `git diff --check`; live conformance **52/0/6**; restart smoke
**P0-P7**; corrected cleanup **3/3**.

## Next session

Start [session 4](plan/phase-1/4-control-layer.md). Replace the probe panel with
the smallest product control layer for directed reversal, status, and navigation.
Keep the observation setting hidden at construction.

## Retrospective

Audit the order of every structural batch. Durable ids become positional wire
targets before send, so an earlier removal can invalidate a later frame.

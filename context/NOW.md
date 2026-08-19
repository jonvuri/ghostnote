---
title: Current state
kind: status
state: active
updated: 2026-08-19
phase: phase-2
session: 2h-conformance
---

# Now

Phase 2 session 2h passes offline and live. E44 records the complete public
musical proof, the writer-window repair, the workload measurements, and exact
live cleanup. Async batch completion stays deferred.

## Start here

1. Review the staged 2h changes.
2. Commit and push the reviewed candidate.
3. Record the required remote CI result for the exact candidate. Session 2h can
   then close and session 2i can start.

## Verification

- `npm run check`: 623/623 pass.
- `./gradlew test build copyExtension`: pass; deployed extension was reloaded.
- `npm run probe:hello`: all checks pass; 138 methods, hash
  `87619942d7eac74d`, and `fineSteps` 512.
- `npm run probe:2h-conformance`: pass. Generation uses 6 stages, including 3
  property stages. One clip took 6.575 s. Three clips took 17.409 s.
- Live cleanup restored 10 tracks, 10 scenes, 22 occupied cells, selection at
  track 0 row 1, stopped transport, the empty schema-v1 observation value,
  cursor homes and pin state, and `Last change`.
- Remote CI: pending a reviewed commit.

## Baseline

- Project: `gn-scale-test`.
- Selection: track 0, row 1.
- Transport: stopped.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- The project has 10 tracks, 10 scenes, and 22 occupied cells.
- All writer cursors and the fine cursor are unpinned on `gn-lay` row 0.

## Retrospective

The failed variation rows ended at each writer cursor's 64-step boundary. The
diagnosis became direct when expected note positions were compared with the
cursor window. For future note-loss failures, compare the first missing step
with the active grid width before changing settle timing. No repository
instruction change is needed.

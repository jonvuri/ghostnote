---
title: Current state
kind: status
state: active
updated: 2026-08-19
phase: phase-2
session: 2i-dogfood-1
---

# Now

Phase 2 session 2h is complete. E44 records the public musical proof, the
writer-window repair, workload measurements, exact cleanup, and passing remote
CI for candidate `5c1207bc282a45cabcaf0f837a2cd0150388da48`. Async batch
completion stays deferred.

## Start here

1. Start [session 2i](plan/phase-2/2i-dogfood-1.md) only for an
   operator-selected musical task through the ordinary MCP client.
2. Use an operator-selected project. Do not alter the conformance fixture.
3. Keep the natural request, tool calls, result, reversal path, and operator
   response in the observation record.
4. Measure a comparable three-clip expression write if the project permits it.
   Profile the non-property latency before changing async completion.

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
- [Remote CI run 32258673507](https://github.com/jonvuri/ghostnote/actions/runs/32258673507):
  first-attempt success for the exact candidate. Both jobs passed.

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
with the active grid width before changing settle timing. For a first-attempt
green CI run, keep the run URL and public run and job metadata. Inspect raw logs
only if the workflow or result is unclear. No repository instruction change is
needed.

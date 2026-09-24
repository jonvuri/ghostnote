---
title: Current state
kind: status
state: active
updated: 2026-09-24
phase: phase-7-follow-up
session: phase7b-flush-boundary-settlement
---

# Now

Run the
[flush-boundary clip settlement](plan/phase-7/7b-follow-up-flush-boundary-settlement.md)
experiment in a fresh session. Test whether `ControllerExtension.flush()`
brackets complete `addStepDataObserver` replay after target, grid, and page
changes. Measure passive and requested flushes separately. Keep the experiment
probe-only until every empty and populated transition matches late settled
truth.

[E131](evidence/experiments/e131-consolidated-clip-acquisition.md) completes the
acquisition session. One `1/512` sparse view is not complete. A `1/512` and
`1/768` sparse union matches the complete reader on the controlled fixtures,
but conservative observer settlement makes it slower. Keep sparse enrichment
as a probe. The complete dual-grid reader remains authoritative. Its
reconciliation now retains a note that only one grid reports and refuses
ambiguous nearby identities. No cache was added.

API 25 documents `flush()` only as an output opportunity. E14 measured passive
flush near 1 Hz, and every Ghostnote bridge request already uses
`scheduleTask(..., 0)`. Neither mechanism is a documented input completion
fence. The new experiment must test first, dirty, and quiet flush cycles against
the complete dual-grid reader. Do not use `addNoteStepObserver`; E53 proves it
has no initial replay.

The experimental acquisition tool remains available at
`GHOSTNOTE_TOOL_PROFILE=phase-7b-agent-note-patch-v0`. Do not start the
independent played-range consolidation trial until E132 classifies the flush
boundary as complete, partial, or rejected.

The deployed extension uses Controller API 25, 157 methods, and method hash
`905bc2531512025b`. The live sparse fixture probe passed and removed its owned
track and five owned clips. It restored the four-track selection and stopped
transport. The live acquisition check was read-only and passed on the selected
empty clip. No test residue remains.

After E132, resume the
[played-range consolidation guidance](plan/phase-7/7b-follow-up-played-range-consolidation.md)
in a fresh Codex chat. Prefer one of the two affected row-0 `Deep House Kit`
clips in project `26.36-4 orangebeat`.

## Retrospective

Keep an empty-view control whenever silence is used as completion evidence.
Do not turn an output lifecycle callback into an input guarantee without a
direct live comparison.

# R01-D17 — Continuing a run halted by stalls during host sleep

Date: 2026-10-30. Status: **accepted by the operator** ("Yes, add the
continuation option and resume.").

## Context

The Luna-only development pass of package v2 (R01-D15, R01-D16) halted as
`halted-transport` after 298 of 684 runs. Submission 414
(`r2-range-L512-i2--c4-fields`, initial) started at 15:12:23 local time;
the lid closed 36 s later, and the Mac stayed in clamshell sleep, apart from
maintenance wakes, until 19:17:56. Monotonic timers barely advance during
sleep, so the 1,120 s limit fired only at 18:00, during a maintenance wake.
The stall rule's one identical resubmission (415) started then, and the Mac
slept again almost immediately; it timed out at 19:19. Neither submission
returned an answer. The power log attributes both stalls to host sleep, not
to the model, the network or the task.

## Decision

- `cli-pilot-runner.mjs resume … --after-stall-halt` (development runs only)
  requires a `halted-transport` run whose last two submissions are stalls
  that timed out without an answer. It keeps both stalls, marked
  `elapsedExcluded: "host sleep"`, and resubmits the same attempt with
  identical bytes as `resubmitted-after-stall-halt`. A further stall gets the
  normal one resubmission, then halts. Finished runs carry forward unchanged.
- Round-2 measures exclude marked submissions from elapsed time
  (`elapsedExcludedSubmissions` is reported). Stall resubmission counts include
  the new role.

## Consequences

- Runs must keep the host awake: lid open, or power with an external
  display. The operator manages this. Agents must not start `caffeinate` or
  change power settings; they tell the operator when a long run needs the lid
  open and power supplied (operator instruction, 2026-10-30: "Don't start
  caffeinate or change any power options yourself, just inform me of the need
  to keep the lid open and power supplied.").

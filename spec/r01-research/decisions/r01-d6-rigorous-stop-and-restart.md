# R01-D6 — Rigorous-stage stop rules and cohort restart

Date: 2026-10-28. Status: accepted by the operator (freeze-review item 6).

## Decision

The development stop rules carry over: a control failure halts; a stall gets
one identical resubmission and a second consecutive stall halts; a quota
pause resumes with a labeled resubmission.

If a rigorous full pass halts, the cohorts that completed are kept. Each
incomplete cohort may be restarted **once**, from its first run, as a new
output that names the halted pass. Each restarted cohort's order must equal
the pinned execution manifest's order for that cohort; the runner checks it.
The halted partial runs stay recorded, and none of their results count. A
restart cannot itself be restarted: a second halt stops the rigorous stage
for operator review.

No other subset (tasks or repeats) runs in the rigorous stage.

## Note

The planner seeds each cohort's order from the order seed and that cohort's
configuration hash, so a cohort-only plan already reproduces the full plan's
order for that cohort. The check makes this explicit.

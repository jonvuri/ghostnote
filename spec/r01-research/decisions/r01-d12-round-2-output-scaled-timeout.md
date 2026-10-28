# R01-D12 — Round 2: timeout scales with expected output

Date: 2026-10-28. Status: accepted by the operator (round 2 brief, open
decision 5).

## Decision

The per-submission timeout scales with the task's expected output size, in
place of the fixed 120 seconds. Elapsed time is reported as a measure; the
limit must not decide outcomes on large windows. The exact formula is fixed
in implementation, is the same for every format within a level, and is pinned
in each execution manifest. The stall rule (one identical resubmission after
a timeout without an answer) is unchanged.

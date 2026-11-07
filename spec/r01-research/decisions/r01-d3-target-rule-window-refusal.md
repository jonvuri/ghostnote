# R01-D3 — Target-rule failure refuses the window

Date: 2026-10-28. Status: accepted by the operator (freeze-review item 3).

The real-source target rules of task revision 5 (p01 boundary time, p05
edit target, p06 transpose pitch, p08 shift/transpose range and p09 near
miss) threw when a window held no eligible case. No fallback was defined.

## Decision

A window on which any target rule of its role finds no eligible case is a
**window refusal** with reason `no-task-target` and the failing rule
recorded. Roles check these rules: A — p08; B — p05 and p09; C — p01 and p06.
The rules run on the window's notes after the stage's synthetic velocities
are applied.

Under densest-window selection, the next window is the next candidate in the
same order: all admissible windows of the work's pool assets, by note count
descending, then the earlier asset in seeded order, then the earlier start.
When no candidate passes, the work is exhausted and the next work in the
seeded order takes the role. The tasks and their rules are unchanged; when no
refusal occurs, the result equals input v2's rule.

---
title: Phase 5u — settlement budget and nested remote reliability
kind: plan
state: active
status: Active next. Measure settlement variance and repair the short nested remote path.
updated: 2026-09-03
parent: README.md
prev: 5t-grid-generalization-and-colourcopy-closeout.md
next: 5v-semantic-parameter-units-and-fail-closed-guidance.md
evidence: E55, E58, E61, E91, E96, dogfood session 01a0690e-1761-76b1-9e8e-635bfa35e583
---

# Phase 5u — settlement budget and nested remote reliability

## Purpose

Determine why the post-fix ColourCopy wrapper still timed out during active
verification. Define one measured retry policy for operations that wait for
host state. Do not select a larger retry count without timing evidence.

## Starting facts and questions

Dogfood session `01a0690e-1761-76b1-9e8e-635bfa35e583` produced the requested
three-modulator wrapper and later rebuilt it with four modulators. Both wrapper
calls returned `complete: false`. The nested supplementary remote inventory did
not settle during the final active-behavior checks, although later reads found
the structure and pages.

`verifyModulation()` defaults to three inventory attempts with 200 ms between
attempts. This gives the short path only about 0.6 seconds, including the reads.
General device composition uses a separate 40-attempt, 250 ms policy. The 5t
live probe proved relocated Polysynth targets. It did not prove the same nested
ColourCopy path used by this dogfood run.

Investigate the operator's questions without assuming their answers:

- Why does any operation use the short path?
- Is three attempts too short for normal host settlement variance?
- Should each operation allow many more retries, or should related operations
  share one deadline and progress policy?
- How can a generous policy stay responsive when state will never settle?

## Work order

1. Inventory every retry, polling, generation, and outer workflow retry used by
   device, parameter, remote, page, wrapper, and composition operations. Record
   attempts, intervals, effective deadlines, cancellation behavior, and nested
   multiplication.
2. Reproduce the exact nested ColourCopy failure in a disposable project. Use
   the same wrapper shape and at least two free-running routes from the dogfood
   task. Record complete timing events from relocation through final behavior
   readback.
3. Collect cold, warm, first-generation, re-armed-generation, and delayed-host
   timing distributions. Separate late valid state from stale, partial, and
   never-complete generations.
4. Define one shared settlement policy if the measurements support it. Prefer a
   bounded deadline with progress evidence, cancellation checks, and one fresh
   generation per attempt. Prevent nested loops from multiplying into an
   unreported long wait.
5. Apply the policy to every proved equivalent path. Keep different policies
   only when measured host behavior requires them, and document the reason.
6. Add deterministic delayed-settlement, stale-generation, no-progress,
   cancellation, and never-settles tests. Report the elapsed time and final
   cause on an incomplete result.
7. Prove the repaired wrapper on nested ColourCopy. Reverse all owned test
   cases and restore the documented baseline.

## Acceptance criteria

- One table records all settlement policies before and after the repair.
- Retry limits come from observed distributions and a stated safety margin.
- Two free-running nested ColourCopy routes complete active verification on
  cold and warm wrapper runs.
- A fresh complete generation cannot be hidden by stale held state.
- A never-complete observer stops at the stated bound, identifies its last
  progress, and remains cancellable.
- Offline tests prove delayed success, stale rejection, cancellation, and
  bounded failure without real-time test loops.
- The public wrapper reports `complete: true` only after every required
  behavior witness passes.
- Exact reversal and live cleanup pass.

## Out of scope

- Semantic parameter-unit conversion.
- Selection or application-focus behavior.
- Updating an existing wrapper in place.
- A new final musical verdict. Session 5t resumes that gate after 5x.

## Handoff

Session 5v audits semantic parameter units and defines the fail-closed public
contract. Carry forward the measured settlement policy for its live probes.

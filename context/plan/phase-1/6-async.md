---
title: Phase 2, session 2x — async batch completion
kind: plan
state: complete
status: Completed on 2026-08-19. E47 records offline boundary tests and the
        passing ordinary-MCP live proof with clean teardown.
updated: 2026-08-19
parent: ../phase-2/README.md
prev: ../phase-2/2i-long-clip-follow-up.md
next: ../phase-2/2j-dogfood-2.md
scope: PHASE-1-ENGINE.md item 7
evidence: E8, E15-D, E15-F, E44, E45, E47 · D10
---

# Phase 2, session 2x — async batch completion

> **Purpose.** Give long musical calls explicit background completion and
> cancellation, so recovery never races work that can still change the project.

## Disposition

Phase 1 closed without this work. E45 activated it before the second dogfood
use. One musical request exceeded the client's 60-second timeout and continued
to mutate while the caller began recovery. The direct tools remain available.

## Scope reconfirmation

The original brief targeted a deferred Bridge response and the 2N expression
stage cost. Current code and E45 change the binding problem:

- Production `LiveAdapter.apply()` does not use the Bridge `delayMs` path. It
  sends one synchronous `batch.run` for each planned stage and returns only after
  all stages complete.
- E45 measured 15.482 seconds for one two-clip source read and about 32 seconds
  for six final reads. The full corrected request took more than two minutes.
  Long exact reads and verification dominated. E44 already found that expression
  waits were a small part of the workload.
- A deferred extension frame would shorten neither the musical preflight nor the
  executor stash and verification reads. It would not prevent the MCP client
  timeout that E45 observed.
- The MCP SDK already supplies an `AbortSignal` to each tool handler. The surface
  did not use it and exposed no operation identity after a timeout.

Session 2x therefore moves completion and cancellation to the MCP boundary. It
does not change the Bridge, the revision counter, or `planStages`.

## Scope

### In

1. A background musical tool that accepts the frozen patch-v1 input and returns
   an operation id immediately.
2. Explicit `accepted`, `running`, `cancelling`, `completed`, `cancelled`, and
   `failed` states. Only the last three are terminal.
3. Inspection that returns the complete direct-tool result after completion and
   lists every verified recorded change after cancellation.
4. Explicit cancellation at workspace boundaries. A read can finish before the
   stop takes effect. A project-write unit that already started must finish its
   independent readback and session recording before cancellation is terminal.
5. MCP request cancellation on the existing direct tools. The direct path stays
   available for short calls.
6. A versioned public-description cohort and offline tests for completion and
   both sides of the write boundary.

### Out

- A Bridge protocol change or a deferred extension response.
- Removing or changing the staged adapter path.
- Coalescing `note.props` across clips. E15-F remains load-bearing.
- Streaming progress beyond what `notify` already does for free (E8-C).

## Decisions

- The background path sits beside the direct tools.
- An operation registry belongs to one workspace session. A process restart
  ends its operation-status lifetime, just as it ends the session stash.
- Cancellation is cooperative and honest. `cancelling` is not terminal. A
  terminal state means the operation has no remaining project mutation.
- One executor write remains indivisible at this layer. Cancellation does not
  hide a write that already landed or skip its verification and recording.
- The expression-stage optimization is ○ for this session. E44 and E45 show that
  it does not address the measured latency bound, while E15-F shows its safety
  risk.

## Exit criteria

1. Start returns an operation id before the musical work completes. Inspection
   reaches a terminal result with the direct tool's verified readback.
2. Cancellation during preflight reaches terminal with no write.
3. Cancellation after a project write starts does not become terminal until the
   change is verified and recorded. No mutation occurs after terminal status.
4. Direct musical tools remain available and honor MCP request cancellation at
   workspace boundaries.
5. The extension and wire method golden do not change. E15-F and revision thread
   confinement remain intact.
6. The full offline suite, extension build, context check, and diff check pass.
7. An ordinary MCP live proof completes and cancels background operations on a
   disposable fixture, then restores the documented baseline.

## Risks

- A caller can lose an operation id before it receives the start reply. The start
  reply is small and performs no DAW work before it returns.
- Cancellation can remain `cancelling` for the duration of one current workspace
  call. It must never claim terminal status early.
- A process exit removes the in-memory operation registry. It does not erase
  changes already recorded in the project session stash.
- Background failures must be observed through inspection. The registry catches
  every task rejection so no unhandled rejection can terminate the MCP process.

## Current outcome

Three public tools start, inspect, and cancel clip-music operations.
`ghostnote-description-v3` freezes their wording. The full offline suite passes
644 tests. The live start returned in 3 ms, completion reached one verified
exact change in 10.8 seconds, and preflight cancellation reached terminal with
no write. Teardown removed the disposable clip and restored accepted-row
occupancy and entry selection. E47 records the complete result.

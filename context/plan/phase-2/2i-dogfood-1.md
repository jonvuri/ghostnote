---
title: Phase 2, session 2i — dogfood round one
kind: plan
state: complete
status: Complete 2026-08-19. The operator kept six verified full-phrase
        variations. E45 records three correctness repairs and activates the
        deferred async-completion follow-up.
updated: 2026-08-19
parent: README.md
prev: ../../archive/outcomes/PHASE-2-SESSION-2H-CONFORMANCE.md
next: 2i-long-clip-follow-up.md
scope: Phase 2 dogfood gate, first use
evidence: Phase 2 observation record and 2h conformance
---

# Phase 2, session 2i — dogfood round one

> **Purpose.** Use ghostnote for music, not for a test, and record where the
> surface helps or obstructs the work.

## Entry rule

The operator starts this session because they want to make music through the
ordinary MCP client. A scripted acceptance prompt or a request invented only to
exercise coverage does not qualify.

Use an operator-selected musical project. Do not use or alter the conformance
fixture baseline.

## Scope

1. Start from a real musical intention and use only the public MCP surface for
   the clip work under test.
2. Keep the natural conversation, tool calls, description version, results,
   refusals, reversals, and operator responses in the observation record.
3. Record whether the musical result was useful and whether the operator kept,
   changed, or reverted it.
4. Record friction as facts: missing vocabulary, unclear schema, incorrect tool
   choice, excess calls, weak report, poor musical result, or excessive delay.
5. Fix a safety or correctness defect immediately in a focused repair. Do not
   redesign wording or granularity from one ordinary preference.

## Latency investigation

Do not count this investigation as the real musical task. During or after that
task, measure a comparable multi-clip write if the project permits it. Use the
E44 workload as the baseline: write full expression to three launcher clips in
one MCP request. It took 17.409 s across 6 stages. The 3 property waits took
507 ms, or 2.9% of the total.

Profile the remaining time across readback, cursor work, the bridge, and other
settles. Record whether the blocking request interrupts the operator's work.
Start a focused latency repair because the named interaction exceeds 10 s.
Activate the deferred async session only if evidence shows that it can remove
at least 2 s or 20% of the request time, or if blocking materially interrupts
use. Otherwise, optimize the dominant measured cost and keep async deferred.

## Exit criteria

1. One real musical task reaches a useful or clearly rejected outcome.
2. The agent does not require direct DAW interaction to create the tested clip
   content.
3. Every write retains its changeset, readback, and reversal path.
4. The observation record identifies the exact surface version used.
5. Findings are concise and do not claim a repeated pattern yet.
6. The latency record identifies the dominant measured cost and gives an async
   verdict against the stated threshold.

## Current result

[E45](../../evidence/experiments/e45-first-real-musical-dogfood.md) records the
natural task, two vetoed attempts, focused correctness repairs, the verified
six-clip result, the accepted operator response, and the blocking latency
evidence. The focused long-clip follow-up owns clip-length updates, paged note
writes, and reversal qualification. Session 2x owns timeout-safe completion and
cancellation.

The full offline check passes 629/629. The extension build and deployment,
context check, and `git diff --check` pass.

## Retrospective

Confirm whether a musical unit means a beat-grid span or a complete clip before
planning variations. Compare long requests with both cursor widths and the
client timeout before mutation.

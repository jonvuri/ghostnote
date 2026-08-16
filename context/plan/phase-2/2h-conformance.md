---
title: Phase 2, session 2h — conformance and workload proof
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: 2g-mcp-surface.md
next: 2i-dogfood-1.md
scope: Phase 2 exit criteria 1 through 3 and async gate
evidence: E24, E32–E40 · D8–D10, D15, D16, D18–D20
---

# Phase 2, session 2h — conformance and workload proof

> **Purpose.** Prove the complete musical path and use measured workload cost to
> decide whether async completion enters the phase.

## Scope

1. Extend fake and live conformance through the public musical surface.
2. Cover generation, every transformation verb, explicit channels, straight and
   triplet positions, several clips, clip lifecycle, direct writes, requested
   variations, readback, reversal, and editor navigation.
3. Reuse the complete note-property matrix. Prove all 20 exact members through
   the new path, including gain through the E24 inverse. Prove pressure refusal
   before mutation.
4. Verify through an independent handle and preserve concurrent-editing,
   revision, cursor, and bank-window protections.
5. Measure representative one-clip and N-clip expression workloads. Record stage
   count, total time, and the share caused by the `2N` property path.
6. Apply the activation rule settled in 2a. Async completion runs only when the
   measured cost blocks the named useful workload.
7. Restore the exact live baseline after every proof run.

## Conditional branch

If the workload activates [async completion](../phase-1/6-async.md), run that
brief as session 2x. Then repeat every affected workload and conformance case
before 2i. A failed optimization can close as evidence without replacing the
working staged path.

## Exit criteria

1. One offline invocation covers the complete musical contract against the fake.
2. One live invocation covers every runnable case and names evidence for each
   deliberate skip.
3. All public writes have recorded changesets, independent readback, and
   fidelity-aware directed reversal.
4. The async decision cites recorded measurements, not expected cost.
5. Cleanup restores tracks, rows, clips, selection, transport, observation
   record, and `Last change` to the documented baseline.
6. Full offline checks, extension build, context check, `git diff --check`, and
   the required remote CI candidate pass.

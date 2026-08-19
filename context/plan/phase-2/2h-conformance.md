---
title: Phase 2, session 2h — conformance and workload proof
kind: plan
state: active
status: Offline and live conformance pass. Workload evidence defers async
        completion. Remote CI waits for the reviewed candidate commit.
updated: 2026-08-19
parent: README.md
prev: ../../archive/outcomes/PHASE-2-SESSION-2G-MCP-SURFACE.md
next: 2i-dogfood-1.md
scope: Phase 2 exit criteria 1 through 3 and async gate
evidence: E24, E32–E40 · D8–D10, D15, D16, D18–D20
---

# Phase 2, session 2h — conformance and workload proof

> **Purpose.** Prove the complete musical path and use measured workload cost to
> decide whether async completion enters the phase.

## Result

Local work is complete. One shared public-path harness passes against the fake
and live Bitwig. It covers generation, all eight transformation verbs, four
requested variations, explicit MIDI channels, mixed straight and triplet grids,
all 20 exact note properties, pressure refusal, stale revision, readback,
editor navigation, and directed reversal.

The live proof found that a 64-step writer silently drops fine-grid notes after
its window. The three writer cursors now use the existing 512-step fine width.
The live four-variation case keeps all eight notes in every row and reverses
without clip residue.

The one-clip expression workload used 2 stages and took 6.575 s. Its property
wait share was 2.6%. The three-clip workload used 6 stages and took 17.409 s.
Its property wait share was 2.9%. The named workload completes in one public
request, and the property path is not the main cost. Async completion stays
deferred.

E44 records the full proof and deliberate live skips. `npm run check` passes
623/623. The extension build, deployment, handshake, context check, and diff
check pass locally. The required remote CI result remains pending until the
reviewed changes have a commit.

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

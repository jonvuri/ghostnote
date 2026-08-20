---
title: Phase 2, session 2i follow-up — long-clip editing
kind: plan
state: complete
updated: 2026-08-19
parent: README.md
prev: 2i-dogfood-1.md
next: ../phase-1/6-async.md
scope: Existing long-clip metadata, note writes, and reversal qualification
evidence: E45, E46
---

# Phase 2, session 2i follow-up — long-clip editing

> **Purpose.** Repair the known long-clip limits before the second dogfood use.

## Entry rule

E45 records an accepted musical result and three known long-clip gaps. Keep this
repair separate from the second dogfood task. Do not change the accepted clips
in `26.05-2 moon`.

## Scope

1. Add a reversible public operation that updates the length and complete
   measured metadata of an existing launcher clip.
2. Write exact notes at positions beyond the fixed 512-step writer window. Page
   the writer when the selected exact grid requires it.
3. Confirm and pin the exact clip target before each page. Restore the writer
   page origin after the operation.
4. Correct reversal qualification for captured host durations that the current
   note grid cannot replay. Do not report `canBeUndone: true` when reversal will
   refuse.
5. Prove the complete path by extending a disposable 32-beat clip to four
   phrases and writing exact notes beyond the first writer page.

## Out of scope

- Asynchronous request completion and cancellation. Session 2x owns them.
- A second natural musical task. Session 2j owns it.
- Further edits to the accepted session 2i clips.

## Exit criteria

1. One public request can update an existing clip's complete metadata and report
   exact independent readback.
2. Exact note writes beyond one cursor page land on the intended track, row,
   channel, and beat.
3. Reversal restores the prior metadata and notes, or reports a truthful limit
   before mutation.
4. A failed page or target check causes no partial write.
5. Focused offline and live tests, the full offline check, extension build,
   context check, and `git diff --check` pass.

## Outcome

Complete. `set_clip_metadata` provides one reversible public request for the
complete measured state and exact readback. Note writes page the fixed writer
window, confirm the exact pinned target on every required page before mutation,
use page-local positions, and restore page zero. Batch-wide preflight prevents a
later staged failure from leaving an earlier write unrecorded. Read-based note
properties use one settled turn per required page. Captured durations that no
writable grid can replay now fail the fidelity floor before mutation.

E46 records the live proof. A disposable Lead clip after the accepted rows
extended from 32 to 128 beats. An exact channel-7 note with `pan: -0.25` landed
at beat 96. Reversal restored the prior 32-beat empty clip, and final cleanup
removed it. The accepted rows were not changed.

## Retrospective prompt

Check whether one cursor-window reference can define both reader and writer
paging rules. Add it only if it prevents another partial implementation.

## Retrospective

The encoder's page calculation now drives preflight, identity writes, and
settled property turns. Keep the reader separate because it reconciles binary
and triplet grids across different page counts. No broader cursor-window
reference is needed.

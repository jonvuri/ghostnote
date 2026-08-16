---
title: Phase 1, session 5d repair — cursor confirmation
kind: plan
state: planned
status: Planned 2026-08-16 after E28. Repair bounded clip confirmation and
        failure-safe owned cleanup, then repeat 5d.
updated: 2026-08-16
parent: 5-proving.md
prev: 5d-concurrent-editing.md
next: 5d-concurrent-editing.md
scope: Repair only; rerun 5d after this session
evidence: E1, E26, E27, E28 · D6, D15
needs: Bitwig foregrounded for a focused cursor sweep
---

# Phase 1, session 5d repair — cursor confirmation

> **Purpose.** Make clip confirmation tolerate measured cursor-state lag and
> keep the 5d probe cleanup-safe when setup fails early.

## Scope

1. Retry a clip point when `cursor.status` still names another track or row.
   Re-send the complete track and slot point on each bounded attempt.
2. Record a held clip only after live status confirms its exact track and row.
3. Refuse with `AddressUnresolvedError` when the cursor never arrives. Do not
   turn the retry into an unbounded wait.
4. Store the standing probe's exact owned target and drag fingerprints before
   the complete grid capture can fail.
5. Add offline regressions for a lagging clip cursor, a cursor that never
   arrives, and early setup failure cleanup.
6. Run a focused live sweep that reads all occupied visible clips through the
   fixed witness cursor and restores the entry selection without mutation.
7. Leave the human concurrent-editing proof for a separate 5d rerun.

## Exit criteria

1. A transient status mismatch is retried and the requested occupied clip is
   read through the confirmed cursor.
2. A cursor that never confirms fails within the documented attempt bound.
3. A setup failure after owned clip creation can verify and remove both owned
   clips without a manually reconstructed baseline.
4. The focused live sweep completes three times with exact selection restore
   and no project mutation.
5. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

## Out of scope

- claiming Phase 1 exit criterion 2;
- changing cursor allocation or structural invalidation rules;
- stale-revision, bank-window, managed A/B, or full conformance proof.

## Session retrospective

Pending.

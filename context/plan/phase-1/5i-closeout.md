---
title: Phase 1, session 5i — closeout
kind: plan
state: complete
status: Complete 2026-08-16. The decision audit passed. All six Phase 1 exit
        criteria map to direct evidence. Phase 1 is closed, and optional async
        completion is deferred until Phase 2 produces a measured need.
updated: 2026-08-16
parent: 5-proving.md
prev: 5h-ci.md
next: 6-async.md
scope: Phase 1 exit criteria 7 and 8; phase handoff
evidence: Session 5 evidence set · D6, D8, D14–D20
---

# Phase 1, session 5i — closeout

> **Purpose.** Close Phase 1 from evidence, correct the current plan, and hand
> the repository to the next selected session.

## Preconditions

Sessions 5a through 5h are complete. Every live session left the project at its
documented baseline. The candidate revision passed full live conformance and
remote CI.

## Decision audit

Confirm that the active decision set contains these final rules:

1. D6 and D16 carry durable track identity and positional clip, scene, and
   device identity with their epoch and window limits.
2. D15 requires independent-handle verification.
3. D17 retires the take store, preserves the stash, and keeps partial revert at
   whole-address granularity.
4. D18 defines two independent managed representations: layer chains and clip
   blocks. It keeps ordinary track copy outside take bookkeeping.
5. D14 records Bitwig-native A/B and no ghostnote-specific switcher.
6. D8 and D16 contain the measured gain verdict and pressure refusal.
7. D19 and D20 still bound reversal and directed destruction.

Amend a decision only when Session 5 evidence changed it. Preserve the earlier
rationale and state the correction explicitly.

## Phase closeout

1. Map all six original phase-exit criteria to exact evidence and qualifications.
2. Record the standing regression matrix from session 5h.
3. Update the current Phase 1 README and roadmap status. Do not rewrite the
   archived combined engine plan; the current context rules keep archived prose
   frozen.
4. Correct any active Phase 2 premise that disagrees with the measured property
   or managed-take model.
5. Write the Phase 1 outcome record and reduce `NOW.md` to the next handoff.
6. Decide whether optional Session 6 runs now or moves to Phase 2.

## Session 6 recommendation

Defer Session 6 to Phase 2 unless Session 5 evidence creates a direct need for
deferred batch completion. No Phase 1 exit criterion depends on it, and its wire
and thread-confinement risk is larger than its current Phase 1 value.

## Exit criteria

1. Each Phase 1 criterion is complete or explicitly qualified from linked
   evidence. No status relies on an inference.
2. The decision audit passes and the gain verdict is consistent in every active
   document.
3. Phase 1 status is closed in the current plan and roadmap.
4. The selected next session is explicit in `NOW.md`.
5. The context check, full offline check, and `git diff --check` pass.
6. Only closeout changes are staged. Nothing is committed.

## Outcome

The decision audit passed without an amendment. D6 and D16 define durable track
identity and bounded positional identity. D15 requires independent-handle
verification. D17 retires the take store but keeps the stash and whole-address
partial revert. D18 keeps layer chains and clip blocks independent and leaves
track copy as ordinary CRUD. D14 uses Bitwig-native A/B with no ghostnote
switcher. D8 and D16 record exact gain through the measured inverse and refuse
pressure. D19 and D20 keep reversal directed and destruction at zero initiative.

The six evidence-backed Phase 1 criteria are recorded in the
[Phase 1 outcome](../../archive/outcomes/PHASE-1.md). The standing regression
matrix remains in E40 and is reproduced in that outcome record. Phase 2 now
states the stash and managed-take model directly. Session 6 moves to Phase 2 as
an optional optimization and does not precede the musical clip surface.

---
title: Phase 8g1 — Review fixes
kind: plan
state: complete
status: Complete. R1 and R2 closed offline; all required checks pass.
updated: 2026-10-02
parent: 8g-shadow-project-cache.md
prev: 8g-intermediate-review-and-session-split.md
next: 8g2-project-continuity.md
---

# Phase 8g1 — Review fixes

## Entry and scope

Read the [review ledger](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md),
R1 and R2, and the [cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md).
Preserve the staged implementation and immutable evidence. This session is an
offline fix. It does not require fixture creation or controller deployment.
Keep 8g active and all live eligibility gates closed. Do not enter 8h.

## Owned files and interfaces

- `ShadowCacheProbe.java` and `ShadowCacheProbeTest.java`: typed outcomes,
  mismatch counters, retirement, and diagnostic output.
- `phase8g-ui-note-controls.ts` and its test: warm result validation shared by
  the live finish path and retained verifier.
- `phase8g-followup-artifacts.test.ts`: rehashed report mutants.
- `phase8g-followup-artifacts.ts` only if its integration needs a change.
- Review ledger, this plan, parent plan, and NOW: finding closure and handoff.

`ShadowProjectCache.compare` supplies the actual outcome set. Do not broaden a
mismatch into a resource refusal or window change. Preserve the existing total
counter interface; use explicit cause diagnostics where needed by 8g measurements.

## Work and independent oracles

1. Enumerate each typed comparison failure from the core. Check its accounting
   through the adapter, not only through a helper with the same branches.
2. Construct metadata, membership, field, and coverage mismatches in the host
   model. A fixture supplies the expected failure cause. A later successful
   comparison cannot erase that failure.
3. Apply the warm failure rule in retained note verification. A current mismatch
   must fail even when explicit recovery succeeds. Validate closed gates and
   absent output for each supported non-match observation. Reject unknown or
   malformed current outcomes. Keep historical refusal labels separate.
4. Clone the actual retained native note report in test memory. Change each warm
   mismatch cause, recompute both hashes and sizes, and require bundle rejection.
   Do not rewrite the retained report or manufacture a new live result.

## Acceptance criteria

- Each typed mismatch increments the total exactly once and exposes its cause.
  Matching scans, changed windows, and budget refusals have distinct accounting.
- Failed comparisons retire residence and expose no current cached snapshot.
- Direct and rehashed retained note mutants reject all current warm mismatch
  causes. A successful later recovery cannot certify them.
- The unchanged retained match still passes its independent edited-field oracle.
  Supported terminal refusals remain qualified observations with closed gates.
- Historical refused reads can retain prior comparison labels without becoming
  current content or a new accepted edit.
- No live gate, stable method, or write authority changes.

## Required checks and cleanup

Run the affected adapter and TS tests, then brain and extension `check`, all five
artifact verifiers, active wire check, context check, and staged/unstaged diff
checks. No live cleanup is needed because this session makes no live changes.
If a fix unexpectedly requires a host assumption, record that dependency for
8g2 and keep the finding open. Do not replace missing evidence with a flag.

## Stop and handoff

Stop after both findings have focused regression proof and the checks pass.
Update the ledger with the exact proof. Stage only this session's changes; do
not commit. Use the repository retrospective and handoff procedure.
Suggested commit message: `fix: account for shadow mismatches and verify warm results`.

## Result and handoff

R1 and R2 are closed. See the [closure proof](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md#finding-closure-in-8g1).
The adapter exposes mismatch counts by cause, retires failed residence, and
keeps matches, window changes, and refusals separate. The live finish path and
retained verifier share warm-result validation. Direct and rehashed mutants
fail even when later recovery matches. The original retained report still passes.

All 41 affected TS tests pass. Brain `check` passes typecheck and 1,692 tests.
Extension `check` passes 41 adapter groups, other model checks, and four archive
checks. Five artifact verifiers, active wire checks, context links, and
staged/unstaged diff checks pass. No live state or retained evidence changed.
No commit was made. Start [8g2](8g2-project-continuity.md).

## Retrospective

Use the shared warm-result rule when comparison outcomes change. Keep rehashed
report mutants beside retained verification tests. No instruction change is needed.

---
title: Phase 8i11 claim replacement repair
kind: plan
state: archived
status: Complete (E260). A duplicate current claim returns repair duplicate-claim, R15 names the onset floor, reference revision 5 states step 7 for unmoved notes, descriptions v46; the operator rerun had no refusal.
updated: 2026-10-19
parent: README.md
prev: 8i10-unprompted-overlay-trials.md
next: 8i12-automated-dogfood-process-proof.md
evidence: E256, E259, E260; D45, D47
---

# Phase 8i11 claim replacement repair

Historical Phase 8 record. Procedures and project retention instructions below
apply to the completed trials. Use the [dogfood archive](../../archive/outcomes/PHASE-8-DOGFOOD.md)
for results, related sessions, and the end of project tracking.

The 8i10 reruns passed, but the claim edits cost five refusals
([E259](../../evidence/experiments/e259-unprompted-overlay-trials.md#decision-rule-after-the-reruns)):

- R13 or R14 "duplicate current claim", twice (T1 rerun step 2, T2 rerun
  step 1). Each patch put claims under new IDs for every note, also for
  notes that the edit did not move. The earlier claims of an unmoved note
  stay current, so the event has two current claims of one type. The
  refusal has no `detail.repair`.
- R15 "timing equation does not match", three times in T1 rerun step 2,
  each with the `groove-timing` repair. A 1/1024 `sourceAt` is valid; the
  main fault was a balanced patch that rounded onsets up to the cell
  (`atDelta` `+1/1024`). R15 maps the source through the R07 import, which
  floors onsets, so `atDelta` must be in (−1/512, 0]. The repair states
  the equations but not the floor, and the message "timing equation does
  not match" is misleading when the sum balances.

## Work

1. `claimRepair` (`brain/src/surface/document-help.ts`): a case for a
   duplicate current claim (R13 nominal, R14 groove). The correction names
   the event when the codec path gives it, and the two fixes: put the claim
   under the existing ID (OVERLAY_PUT replaces it), or OVERLAY_REMOVE the
   existing claim in the same patch. New IDs are for notes that the same
   edit moves: their earlier claims become stale.
2. The `groove-timing` correction adds one sentence: with a known source,
   the event onset is the floor of `sourceAt` to the 1/512-beat cell, so
   `atDelta` = event.at − sourceAt is in (−1/512, 0]; claim values can be
   finer than a cell. If the codec can tell a balanced sum with a positive
   `atDelta` from an unbalanced sum, the refusal names the floor case.
3. Method note, step 7 (`MODEL-REFERENCE.md`, revision 5): a note that the
   edit does not move keeps its current claims, or gets new values under
   the same IDs. Keep the step general; no request-to-term mapping (E259
   operator review).
4. Bump the description version (the read description carries the
   reference SHA-256), regenerate the reference artifacts, and update the
   publication candidates.

## Cost model

No host call and no new live path: the repair is built from the codec
refusal, as in 8i9 (E256). The reference grows by about one sentence.

## Acceptance

- Unit tests: the two refused patch shapes of E259 (new IDs for unmoved
  notes; a balanced claim with a positive `atDelta`) return the new repair
  cases with no host call, and the corrected patches seal and apply.
- The method test of 8i10 covers the new step 7 text.
- Descriptions and reference revision bumped; artifacts and publication
  candidates regenerated; all brain tests pass.
- One operator rerun of T1 steps 1 and 2 in a fresh thread, with the
  E259 prompts: no duplicate-claim refusal, or a single refusal that the
  repair corrects in the next call. Record it in a new E record.

## Out of scope

Changes to the codec rules, claim persistence across threads, and
request-to-term guidance.

## Result

Complete ([E260](../../evidence/experiments/e260-claim-replacement-repair.md)).
The codec message of a duplicate current claim names both IDs and the
event; the repair case is `duplicate-claim`. A balanced R15 claim with a
positive `atDelta` refuses at `.data.atDelta` with the floor message. Model
reference revision 5, descriptions v46. In the operator rerun of T1 steps 1
and 2, the agent put new claims only for the moved notes, with no refusal
(E259: 4 in step 2). The new repairs were not exercised live.

---
title: Phase 1, session 5h — CI and regression policy
kind: plan
state: planned
status: Not started. Requires a pushed candidate revision after session 5g.
updated: 2026-08-16
parent: 5-proving.md
prev: 5g-live-conformance.md
next: 5i-closeout.md
scope: Phase 1 exit criterion 6; Session 5 regression policy
evidence: E8, E15, E23 · D11, D15
needs: Candidate commit pushed by the operator; GitHub Actions access
---

# Phase 1, session 5h — CI and regression policy

> **Purpose.** Replace the untested CI claim with a real run for the Phase 1
> candidate, and define which proofs remain standing regressions.

## Preconditions

The repository now has an `origin`, but `.github/workflows/ci.yml` still says
that CI has never executed. Repository sessions do not commit. The operator must
commit and push the reviewed Phase 1 candidate before this proof can name the
exact revision.

## Scope

1. Identify the pushed candidate SHA.
2. Run or inspect GitHub Actions for that exact SHA. If a manual dispatch is
   required, obtain operator authorization before triggering it.
3. Require the brain job to run `npm run check` with
   `GHOSTNOTE_REQUIRE_ORACLE=1`.
4. Require the extension job to build with the configured Java toolchain.
5. Repair workflow-only defects if needed, then repeat the proof against the new
   pushed candidate SHA.
6. Replace the stale workflow header with the measured CI status and evidence.
7. Publish a regression matrix with four classes:
   - unattended offline CI;
   - unattended live, run manually against Bitwig;
   - human-assisted live;
   - one-shot evidence retained as a runnable probe.
8. Keep E8b in the human-assisted class. Do not present it as unattended.

## Exit criteria

1. Both CI jobs pass for one named candidate SHA.
2. The run URL, SHA, job results, and date are recorded in evidence.
3. The offline fake pipeline and oracle check run rather than self-skip.
4. The workflow no longer claims that it has never executed.
5. Every Session 5 probe has a regression class and an owner.
6. The local offline check, context check, and `git diff --check` pass.

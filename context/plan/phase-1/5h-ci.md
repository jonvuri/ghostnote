---
title: Phase 1, session 5h — CI and regression policy
kind: plan
state: complete
status: Complete 2026-08-16. Both CI jobs pass for candidate 01b7162, and E40
        records the four-class regression policy.
updated: 2026-08-16
parent: 5-proving.md
prev: 5g-live-conformance.md
next: 5i-closeout.md
scope: Phase 1 exit criterion 6; Session 5 regression policy
evidence: E8, E15, E23, E39, E40 · D11, D15
needs: none
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

## Result

[GitHub Actions run 31974448060](https://github.com/jonvuri/ghostnote/actions/runs/31974448060)
passed both jobs for candidate
`01b716265a20cbf91e6c2c1e357fb69d489ee707` on 2026-08-16.

The brain job used Node 24.19.0 and ran `npm run check` with
`GHOSTNOTE_REQUIRE_ORACLE=1`. TypeScript passed. All 545 tests passed with zero
failures and zero skips. The fake conformance rows and all four Python-oracle
comparisons ran and passed.

The extension job used Temurin 21.0.12. `./gradlew --no-daemon build` completed
successfully with the configured Java 21 release target.

E40 records the run URL, SHA, job results, and the four-class regression matrix.
It gives each Session 5 probe an owner. E8b stays human-assisted. The workflow
header now reports the measured status instead of the old untested claim.

The local offline check, context check, and `git diff --check` pass. Session 5i
is next.

## Retrospective

Keep the Actions run URL with downloaded logs. The archive does not contain the
run ID. No repository instruction change is needed.

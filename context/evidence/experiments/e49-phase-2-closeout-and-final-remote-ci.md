---
id: E49
kind: evidence
state: active
source: phase-2-session-2k
---

# E49 — Phase 2 closes with exact live baseline and final remote CI [K] (2026-08-20)

**Verdict: all Phase 2 exit criteria pass. The accepted musical project matches
its complete launcher baseline, and both remote CI jobs pass for the exact final
product candidate. Phase 3 has no evidence to run now. Phase 4 is next.**

## Final remote CI

[GitHub Actions run 32338482416](https://github.com/jonvuri/ghostnote/actions/runs/32338482416)
ran from the `main` push for exact candidate
`5e51b4ce6131437adbab0ab8cd38a0150d0355d3`. The run started at 06:10:28 UTC,
completed at 06:10:59 UTC, and reported `success` on its first attempt.

| Job | Result | Proof |
|---|---|---|
| `brain (offline suite)` | Pass | Job 96332573062 completed the install and `typecheck + offline tests` steps. The workflow requires the Python oracle through `GHOSTNOTE_REQUIRE_ORACLE=1`. |
| `extension (compile)` | Pass | Job 96332573440 completed the Java setup and Gradle build steps. |

Remote `main` resolves to the same candidate SHA. The CI run therefore covers
the long-clip repair, background completion and cancellation, operation timing,
and second dogfood implementation that followed the earlier 2h candidate.

## Closeout verification

- Full local offline check: 646/646 pass, including typecheck.
- Extension Gradle test build: pass.
- Context check: 176 active documents and links pass.
- `git diff --check`: pass.
- Live handshake: pass for Bitwig 6.0.6, host API 25, the 139-method golden, and
  deployment age.
- Read-only `probe:2k-baseline`: pass. It confirms the complete 7-track by 8-row
  launcher grid, all 14 accepted clips, the 43-note two-progression result, and
  both accepted dogfood observation links.

The conformance fixture remains at its exact E44 baseline. Sessions 2i through
2k used `26.05-2 moon`; disposable long-clip and async checks restored their
entry state.

## Phase verdict

Every Phase 2 criterion is complete with the qualifications in the Phase 2
outcome. E45 and E48 are two distinct accepted natural uses. Direct writes stay
stash-backed and verified. Requested or fidelity-required alternates use clip
blocks. The final description v4 cohort, permission partition, observation
schema 2, and async verdict are fixed.

Optional Phase 3 remains deferred. The two natural uses did not repeat a
textual comparison, navigation, or partial-revert problem. Its project-wide
human-change log also remains blocked by incomplete observer coverage. Phase 4
is next.

## Retrospective

Keep one read-only closeout probe for the complete accepted project. This makes
content residue and observation linkage one standing regression.

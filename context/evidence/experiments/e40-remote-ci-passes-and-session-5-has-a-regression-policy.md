---
id: E40
kind: evidence
state: active
source: phase-1-session-5h-ci
---

# E40 — Remote CI passes and Session 5 has a regression policy [K] (2026-08-16)

**Verdict: GitHub Actions passed both jobs for the exact Phase 1 candidate. The
offline fake pipeline and the Python oracle ran without a skip. Each Session 5
probe now has a regression class and an owner.**

## Remote CI proof

[GitHub Actions run 31974448060](https://github.com/jonvuri/ghostnote/actions/runs/31974448060)
ran from the `main` push on 2026-08-16. It checked out candidate
`01b716265a20cbf91e6c2c1e357fb69d489ee707`. The run started at 21:45:43 UTC,
completed at 21:46:10 UTC, and reported `success`.

| Job | Result | Measured proof |
|---|---|---|
| `brain (offline suite)` | Pass | Node 24.19.0 ran `npm run check` with `GHOSTNOTE_REQUIRE_ORACLE=1`. TypeScript passed. All 545 tests passed with 0 failures and 0 skips. The fake conformance rows ran, including revision, bank, scene-window, and coverage refusals. All four `bwmod` Python-oracle comparisons passed. |
| `extension (compile)` | Pass | Temurin 21.0.12 ran `./gradlew --no-daemon build`. Gradle 9.6.1 completed all three actions and reported `BUILD SUCCESSFUL`. `options.release = 21` remains the bytecode rule. |

The two supplied log archives were byte-identical. SHA-256 was
`bfada75ee3fea66ec55249fa187487a1c48c5a191f957c856c0b6f29bf33c0fa`.
They each contained both job logs. They were temporary inspection inputs and
were removed after this record was complete.

## Regression classes and owners

An owner is responsible for starting the check and restoring its documented
baseline. A live check always starts with the documented fixture and current
extension. It does not become CI because it can run without human input.

| Class | Owner | Standing checks | When to run |
|---|---|---|---|
| Unattended offline CI | GitHub Actions | `npm run check`, including the fake conformance suite and required Python oracle; extension Gradle build | Each push and pull request |
| Unattended live, manual start | Repository operator | `probe:5-selection` (E23); `probe:5-fidelity` (E24); `probe:5d-repair` (E27); `probe:5d-cursor` (E29); `probe:5d-cleanup` (E31); `probe:5e-refusal` stale case (E33); `probe:5g-repair` (E36, E38); `probe:hello`, `probe:conformance`, and `probe:conformance-cleanup` (E39) | Before a release candidate when the related production or bridge path changes |
| Human-assisted live | Repository operator and human editor | `probe:e08b` (E8); `probe:5d-concurrent` (E32); `probe:5f-ab` (E34) | Before a release candidate when selection interference or managed A/B changes |
| One-shot evidence, runnable probe retained | Repository operator | `probe:5c-arm-cross`, `probe:5c-read-cross`, `probe:5c-arm-below`, and `probe:5c-read-below` (E25); bank probes `probe:e05b`, `probe:e15`, `probe:e16r`, and `probe:e21` used by E33 | Only to challenge the evidence or after the related Bitwig behavior, bank model, or observer contract changes |

E8b stays human-assisted. The operator must edit the project during its write
window. It is not an unattended live check.

The Session 5 failed-run evidence E26, E28, E30, E35, and E37 has no separate
standing command. Its mechanisms are covered by the repaired probes and the
offline tests named above. The records remain active diagnosis evidence.

## Qualification

The unattended live class means that a probe needs no human input after manual
start. It still needs Bitwig, the extension, and the exact fixture baseline.
GitHub Actions does not run this class.

The one-shot bank probes can leave objects outside the configured window. E33
therefore keeps their banked evidence and the unattended fake refusal matrix.
Do not create a fresh overflow for routine regression.

## Verification

- Remote CI run: both jobs passed for the named candidate.
- Local offline check: 545/545, with typecheck green.
- Context check: all active documents and links pass.
- `git diff --check`: pass.

## Decision impact

D11 and D15 are unchanged. The run proves D11's required Python oracle and Java
release configuration on a clean GitHub-hosted runner. The regression policy
keeps independent-handle and live-readback claims outside offline CI.

## Retrospective

Keep the Actions run URL with downloaded logs. The archive does not contain the
run ID. No repository instruction change is needed.

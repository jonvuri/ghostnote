---
title: Phase 1 outcome — write engine and managed takes
kind: outcome
state: complete
updated: 2026-08-16
phase: phase-1
evidence: E23–E40 · D6, D8, D14–D20
---

# Phase 1 outcome

Phase 1 is complete. It delivers a typed write engine with stash-backed,
verified application; bounded directed reversal; ordinary track-copy CRUD; layer
chains and clip blocks as independent managed take representations; observation,
status, and change navigation; and full live and remote-CI proof.

## Exit evidence

| Criterion | Result | Evidence and qualification |
|---|---|---|
| 1. Complete note-property contract | Complete | [E24](../../evidence/experiments/e24-gain-inverse-and-complete-note-contract.md) proves 20 exact properties through an independent handle. Gain uses the measured divide-by-two encoder. Pressure is refused before mutation. |
| 2. Pinned writes during human edits | Complete | [E32](../../evidence/experiments/e32-pinned-writes-survive-human-clip-and-track-edits.md) proves all 40 writes landed on the pinned target while the human moved another clip and changed selection. The executor borrowed and restored selection once. |
| 3. Stale revision rejects the batch | Complete | [E33](../../evidence/experiments/e33-stale-revision-and-bank-window-refusals-fail-closed.md) proves a stale two-operation batch applied zero stages and caused zero independent-read mutation. |
| 4. Managed A/B uses native controls | Complete | [E34](../../evidence/experiments/e34-managed-native-ab-and-ordinary-copy-stay-independent.md) proves independent layer-chain solo and clip launch. A mixed instruction keeps the two events correlated but separate. Track copy remains ordinary CRUD. |
| 5. Bank overflow refuses before mutation | Complete, qualified | [E33](../../evidence/experiments/e33-stale-revision-and-bank-window-refusals-fail-closed.md) supplies the fake refusal matrix. E5/e05b, E15-A, E16r, and E21 supply existing live track and scene window measurements. No fresh destructive overflow sweep was run. |
| 6. Candidate passes remote CI | Complete | [E40](../../evidence/experiments/e40-remote-ci-passes-and-session-5-has-a-regression-policy.md) records GitHub Actions run 31974448060 for exact candidate `01b716265a20cbf91e6c2c1e357fb69d489ee707`. All 545 brain tests passed with no skip, including the required Python oracle. The Java 21 extension build passed. |

[E39](../../evidence/experiments/e39-full-live-conformance-passes-after-pin-settlement-repair.md)
also records one complete live conformance invocation: 53 runnable cases
passed, no case failed, and 6 deliberate skips retain named prior evidence. Exact
cleanup restored the documented project baseline.

## Decision audit

No Session 5 evidence requires a decision amendment.

- D6 and D16 use durable track identity and bounded positional clip, scene, and
  device identity with epoch and window limits.
- D15 requires independent-handle verification.
- D17 retires the take store, keeps the stash, and limits partial revert to whole
  addresses.
- D18 defines layer chains and clip blocks as independent managed
  representations. Track copy is ordinary CRUD.
- D14 uses Bitwig-native A/B and requires no ghostnote-specific switcher.
- D8 and D16 make gain exact through its measured inverse and refuse pressure.
- D19 keeps agent-edit reversal directed and bounded to owned changesets.
- D20 gives destruction zero agent initiative and a separately named tool seam.

## Standing regression matrix

| Class | Owner | Checks | Trigger |
|---|---|---|---|
| Offline CI | GitHub Actions | `npm run check`, including fake conformance and the required Python oracle; extension Gradle build | Every push and pull request |
| Unattended live, manual start | Repository operator | `probe:5-selection`, `probe:5-fidelity`, `probe:5d-repair`, `probe:5d-cursor`, `probe:5d-cleanup`, `probe:5e-refusal`, `probe:5g-repair`, `probe:hello`, `probe:conformance`, and `probe:conformance-cleanup` | Before a candidate when the related production or bridge path changes |
| Human-assisted live | Repository operator and human editor | `probe:e08b`, `probe:5d-concurrent`, and `probe:5f-ab` | Before a candidate when selection interference or managed A/B changes |
| One-shot evidence | Repository operator | `probe:5c-arm-cross`, `probe:5c-read-cross`, `probe:5c-arm-below`, `probe:5c-read-below`, `probe:e05b`, `probe:e15`, `probe:e16r`, and `probe:e21` | Only to challenge evidence or after the related host behavior changes |

E40 owns the complete command list and baseline rules. A live probe does not
become CI only because it can run unattended after manual start. Routine
regression must not manufacture a new bank overflow.

## Handoff

Phase 2 starts with the musical clip vocabulary and MCP surface. Direct writes
remain stash-backed. Clip blocks protect requested or fidelity-required clip
alternates. Deferred async batch completion is a Phase 2 option only after a
measured workload justifies its wire and thread-confinement risk.

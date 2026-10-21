---
title: Current state
kind: status
state: active
updated: 2026-10-20
phase: phase-9-overlap-investigation
session: 9b.6-doctor-61x-after-operator-audit
---

## Next session

**9b.6 — Doctor on 6.1.x, after the operator update audit.** Read the
[session brief](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x),
[E316](evidence/experiments/e316-grid-doctor-606-acceptance.md),
[E315 caller trace](evidence/experiments/e315-grid-doctor-document-undo.md),
and [symbol manifest](plan/phase-9/9b-grid-symbol-manifest.md).
The operator's general feature audit and a copy of 6.0.6 precede the update.
Resolve and trace the new jar before live validation. Adapt the pinned
driver and first-attempt policy for the new fingerprint; V20 deliberately
requires 6.0.6 and the E313 retry record. Do not reuse its cache for 6.1.x.

**9b.5 is complete.** The authorized V20 pass proves all 76 member-role
checks, both document Undo stages, and the final edit-counter transition.
All three scratch tracks are removed. Paired control and complete preserved
state match the baseline. The accepted research cache is written only after
teardown. It grants no product write authority. Step 2 still requires the
separate 6.1.x result; 9b.7 owns product cache enforcement.

Keep both attempt records and the accepted cache. Do not repeat the completed
6.0.6 doctor or 9a audio flow. E310's resource, outer-modulator, Gates-attachment,
flavour, scale, and non-boolean-write limits remain. Public descriptions stay
v52. E316 records the per-call timing comparisons and their limits.

## Deployment and live state

V20 is loaded and verified: `phase-8-probe-v1`, 118 methods,
`2e939035ea90b8b0`, marker `9b-grid-doctor-v20` on all direct handlers and
`rig.info`, initialization `2026-10-21T04:38:35.619Z`. Bridge PID 42943.
Archive SHA-256:
`9627bb8d23587de365aee75ae0703e81b32c71faeb5eb13c29e8dec791b0d481`.
Run `npm run probe:hello` from `brain/` before later live work. The normal
profile is not restored. Controller replacement remains an operator action.

Project: `gn-grid-spike`. Only `grid-probe`, `FX 1`, and `Master` remain.
No scratch track, bound claim, lock, or unfinished native task remains.
The doctor is phase 3, used, released, and not failed. Old claims and managed
native IDs do not transfer to another session.

E316 entry/exit tracks, mixer, complete device banks, and selection match
E314 recovery and the E310 baseline. `grid-probe` is selected, muted, and
at -10 dB. Both control pairs match normalized E276: four modules and two
cables. Keep it unchanged. A separate post-disconnect read confirms clean
status and preserved mixer/selection. Native witnesses report engine active;
transport is stopped at admitted stages. No save, engine, transport, restart,
or controller command is sent. Saved-file identity and the UI save marker
are untested. This is an in-memory baseline check.

## Material to preserve

- E316 [acceptance/cache copy](evidence/data/phase9b-doctor/live-v20/accepted.json),
  [report](evidence/data/phase9b-doctor/live-v20/report.json),
  [entry](evidence/data/phase9b-doctor/live-v20/before.json),
  [exit](evidence/data/phase9b-doctor/live-v20/after.json),
  [final read-only status](evidence/data/phase9b-doctor/live-v20/final-read-only.json),
  [capture archive](evidence/data/phase9b-doctor/live-v20/captures.zip),
  [call log](evidence/data/phase9b-doctor/live-v20/calls.json.gz), and
  [V20 attempt](evidence/data/phase9b-doctor/live-v20/attempt-record.json).
  Keep both local attempt files and the accepted cache in `.local/grid-doctor/`.

- E315 [caller trace](evidence/data/phase9b-doctor/v20-preparation/undo-caller-trace.json),
  [candidate table](evidence/data/phase9b-doctor/v20-preparation/candidate.json),
  [selectors](evidence/data/phase9b-doctor/v20-preparation/selectors.json),
  [archive verification](evidence/data/phase9b-doctor/v20-preparation/verification.json),
  test logs, and the [V20 supplement](../brain/src/probes/grid_doctor/undo-selectors-v20.json).

- [E314 recovery report](evidence/data/phase9b-doctor/recovery-v19/report.json),
  [entry snapshot](evidence/data/phase9b-doctor/recovery-v19/before.json),
  [exit snapshot](evidence/data/phase9b-doctor/recovery-v19/after.json),
  [control archive](evidence/data/phase9b-doctor/recovery-v19/control-captures.zip),
  [final status](evidence/data/phase9b-doctor/recovery-v19/final-status.json),
  hello log, and call log.

- [E313 report](evidence/data/phase9b-doctor/live-v19/report.json),
  [failure](evidence/data/phase9b-doctor/live-v19/failure.json),
  [inspection](evidence/data/phase9b-doctor/live-v19/preset-2-inspection.json),
  [final read-only state](evidence/data/phase9b-doctor/final-read-only.json),
  [capture archive](evidence/data/phase9b-doctor/live-v19/captures.zip),
  [call log](evidence/data/phase9b-doctor/live-v19/calls.json.gz),
  [attempt record](evidence/data/phase9b-doctor/attempt-record.json), and
  [Undo failure trace](evidence/data/phase9b-doctor/undo-failure-trace.json).
- E312 [candidate table](evidence/data/phase9b-doctor/candidate.json),
  [selectors](evidence/data/phase9b-doctor/selectors.json),
  [archive identity](evidence/data/phase9b-doctor/preparation.json), test logs,
  and the [undo supplement](../brain/src/probes/grid_doctor/undo-selectors.json).
- E311 [resolver report](evidence/data/phase9b-resolvers/report.json) and
  [tests](evidence/data/phase9b-resolvers/tests.txt). Original 69 roles and
  55 types remain unchanged; E312 adds three V19 undo candidates.
- E310 [report](evidence/data/phase9b-writes/live-v18-factory/report.json),
  [final status](evidence/data/phase9b-writes/live-v18-factory/final-status.json),
  independent snapshots, and control archive. Keep E310's resource,
  outer-modulator, Gates-attachment, flavour, scale, and non-boolean limits.
- E308 [entry snapshot](evidence/data/phase9b-writes/live-v17/before.json),
  E309 [recovery](evidence/data/phase9b-writes/v18-recovery/process-recovery.json),
  E304 [catalog](evidence/data/phase9b-focused/catalog-updated.json), and saved
  `gn-grid-spike-baseline.bwpreset`. The E289 edited project is not a baseline.

Do not repeat the completed 9a audio flow. The 6.1.x update follows the
general feature audit, with 6.0.6 copied aside. See the
[roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.

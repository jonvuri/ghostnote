---
title: Current state
kind: status
state: active
updated: 2026-10-21
phase: phase-9-overlap-investigation
session: 9b6-doctor-614-preparation
---

## Next session

**Start 9b.6 offline preparation for Bitwig 6.1.4.** The general update audit
is complete and accepted for its tested normal-product scope in
[E330](evidence/experiments/e330-update-audit-614-acceptance.md).
All required cases, Sampler observations/listening, persistence, cleanup,
and the final clean save pass. Public descriptions remain v52.

Read the [9b.6 brief](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x),
[E316](evidence/experiments/e316-grid-doctor-606-acceptance.md),
[E315 caller trace](evidence/experiments/e315-grid-doctor-document-undo.md),
[E311 resolver instructions](evidence/experiments/e311-grid-offline-resolvers.md),
[symbol manifest](plan/phase-9/9b-grid-symbol-manifest.md), and
[performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).

Resolve and trace the new jar before live validation. Adapt the pinned driver,
candidate resources, host guard, and first-attempt policy for its fingerprint.
V20 deliberately requires 6.0.6 and E313's specific retry record. Do not reuse
its cache or reset old attempts. Prepare and test the new probe offline.
Controller replacement remains an operator action. Obtain fresh scratch
consent before the new-build doctor. E330 grants no native write authority.
Step 2 still needs the separate 6.1.4 doctor; 9b.7 owns product cache enforcement.
Do not repeat the completed 6.0.6 doctor or 9a audio flow.

## Deployment and live state

- App: `/Applications/Bitwig Studio.app`, **6.1.4**, API 25.
- Jar SHA-256: `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
- Deployed **normal** profile: `normal-v1`, 92 methods, hash
  `8be1975eaa99d78f`; initialization `2026-10-21T13:31:16.452Z`.
- Archive SHA-256: `25a5be4398f8825a7eabd2a541e49559ed60002f2d8d6b9db795f45664e4d9d2`.
  Bridge PID 69259 was verified at the final command. Recheck before live work.
- Active project: cleaned `gn-upgrade-audit`, stopped. Only `Inst 1`,
  `Audio 2`, `FX 1`, and `Master` remain. Complete preserved state matches
  entry. Mixer and Launcher selection are `Inst 1`, row 0.
- The operator saved the clean working file. SHA-256:
  `573084e28ef7e241e3d52fd24265b1302d6f8cc22695270e3d11386e80d4398f`,
  34,259 bytes. The final clean file was not reopened a second time.
- No owned audit track, active driver, lock, failure, or uncertain write
  remains in the accepted continuation. Prior failure records are retained.
- The operator retains `gn-upgrade-audit-switch` under the working folder.
  Its four default tracks were verified during the switch check.
- The operator activated the audit engine for listening; exclusive ownership
  was not independently measured. The agent sent no engine, transport,
  save, controller, or native Grid command during the audit.

Backup: `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`.
Working folder: `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/`.
The copied 6.0.6 launch and recovery check passed. Original-project asset
checks were not exhaustive. Do not modify backups or donor sources.

## Material to preserve

- E330 [acceptance and matrix hashes](evidence/data/bitwig-upgrade-audit/continuation-4-614/acceptance.json),
  [final report](evidence/data/bitwig-upgrade-audit/continuation-4-614/report.json),
  [clean-save proof](evidence/data/bitwig-upgrade-audit/continuation-4-614/cleanup-saved.json),
  [cleanup](evidence/data/bitwig-upgrade-audit/continuation-4-614/cleanup.json),
  and all audit attempts, recoveries, pinned parent proofs, tests, and logs.
  [E330](evidence/experiments/e330-update-audit-614-acceptance.md) consolidates
  the earlier E317–E329 results and their limits. Do not rerun passed cases.
- Keep the separate [persistence project copy](evidence/data/bitwig-upgrade-audit/continuation-4-614/saved-project.bwproject)
  unchanged: 72,901 bytes, SHA-256
  `b01ba21f2f2a6d790fddbc9663a278721d23d14935a4dc067f76e4bdf809970b`.
  Keep host preset exports, operator reports, and the observation input;
  the observation checkpoint itself contains live snapshots.
- E316 [accepted cache copy](evidence/data/phase9b-doctor/live-v20/accepted.json),
  [report](evidence/data/phase9b-doctor/live-v20/report.json),
  [V20 attempt](evidence/data/phase9b-doctor/live-v20/attempt-record.json),
  all entry/exit captures and logs, and both attempts plus the accepted cache
  in `.local/grid-doctor/`. The accepted research cache grants no product
  write authority. E316's per-call timing limits remain.
- E315 [caller trace](evidence/data/phase9b-doctor/v20-preparation/undo-caller-trace.json),
  candidate table, selectors, archive verification, and
  [V20 supplement](../brain/src/probes/grid_doctor/undo-selectors-v20.json).
  Keep E313's failed attempt and E314's recovery evidence unchanged.
- E310 [factory result](evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md),
  control captures, and saved `gn-grid-spike-baseline.bwpreset`.
  Resource, outer-modulator, Gates-attachment, flavour, scale, and non-boolean
  write limits remain. The E289 edited project is not a baseline.

Historical Grid control: E316 verified `gn-grid-spike` with only `grid-probe`,
`FX 1`, and `Master`; `grid-probe` was selected, muted, and at -10 dB. Both
control pairs matched normalized E276: four modules and two cables. Keep
that control unchanged. E316 proved in-memory preservation, not saved-file
identity. Old claims and native IDs do not transfer to another session.
See the [roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.

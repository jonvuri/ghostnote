---
title: Current state
kind: status
state: active
updated: 2026-10-22
phase: phase-9-overlap-investigation
session: 9b6h-guarded-doctor-614
---

## Next session

**Start [9b.6h: guarded doctor on 6.1.4](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6h--guarded-doctor-on-614).**
[D52](decisions/d52-grid-upgrade-admission-policy.md) settles the upgrade
admission policy: offline structural resolution stays required; complete
offline bounded admission is replaced by a body-change report, bounded
traces of changed bodies only, runtime entry guards, and the consent-gated
doctor with per-call timing. [E338](evidence/experiments/e338-grid-doctor-614-offline-closeout.md)
closes 9b.6g: all 55 type roles, 76 member roles, and 16 fields resolve on
both jars; the conditional bounds of checkpoints 1–17 stand; no command has
offline bounded admission, and that criterion does not converge.

Read D52, E338, [checkpoint 17](evidence/data/phase9b-doctor/614-resolution/checkpoint-17/README.md),
E316, E315, the symbol manifest, the performance ledger, and the 9b.6
steps 3–5. Work items 1–3 (body-change report, changed-body decisions,
runtime guards with modeled host cost) are offline and come first. Items
4–5 (driver, probe, deployment, operator replacement, consent, one doctor
pass) follow. Item 6 (toolkit consolidation and `/tmp` cleanup after
manifest hash verification) can move to 9b.7. The 98 diagnostic modules
under `brain/src/probes/grid_doctor/` are the trace tools; the
[2026-10-22 handoff](plan/phase-9/9b6g-agent-handoff-2026-10-22.md) gives
tool navigation and artifact recovery.

Retained limits to cover by guard or timing, not proof: the `agent_debug`
tracking-mode writer, the global property listener monitor, generic
listener registrations on the Hgx chain, the replay worker hang (parity on
both builds), the 6.1.4 validation observer notification, and the cold
first factory call in a fresh process. Keep the strict comparator and
original selectors. V20 still requires 6.0.6 and E313's specific retry
record. Controller replacement is an operator action. Fresh scratch
consent and project verification remain required before the new-build
doctor. E330 grants no native write authority. Step 2 stays open; 9b.7
owns product cache enforcement and the upgrade tool. Do not repeat the
accepted 6.0.6 doctor or the 9a audio flow.

## Deployment and live state

Last verified in E330. E331–E337 and the 9b.6g checkpoints make no live request.

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

- [E338](evidence/experiments/e338-grid-doctor-614-offline-closeout.md) and its
  [preservation check](evidence/data/phase9b-doctor/614-resolution/preservation.json):
  224 entry files unchanged.
- 9b.6g [checkpoints 1–17](evidence/data/phase9b-doctor/614-resolution/)
  and the [handoff supplement](evidence/data/phase9b-doctor/614-resolution/handoff-2026-10-22/README.md):
  diagnostic source snapshots, development archives, selected reports, and
  the immutable [entry inventory](evidence/data/phase9b-doctor/614-resolution/entry-inventory.json).
  Do not regenerate the entry inventory.
- E337's operation bindings, variant traces, tests, development attempts, and
  [preservation check](evidence/data/phase9b-doctor/614-bindings/preservation.json).
  No new-build candidate, attempt, cache, or deployment exists.
- E336's census, traces, plans, diagnostic attempts, tests, and
  [preservation check](evidence/data/phase9b-doctor/614-fixtures/preservation.json).
  No new-build candidate, attempt, cache, or deployment exists.
- All [E331–E335 evidence](evidence/data/phase9b-doctor/), original selectors,
  and diagnostic code. Their source hashes and preserved files are indexed
  by E336's entry and exit inventories.
- [E330](evidence/experiments/e330-update-audit-614-acceptance.md): acceptance,
  clean-save proof, all audit attempts, recoveries, parent proofs, and logs.
  Keep the separate saved-project copy unchanged: 72,901 bytes, SHA-256
  `b01ba21f2f2a6d790fddbc9663a278721d23d14935a4dc067f76e4bdf809970b`.
  Keep host exports, operator reports, and observation input. Do not rerun
  passed cases. The final clean working file was not reopened a second time.
- [E316](evidence/experiments/e316-grid-doctor-606-acceptance.md):
  accepted 6.0.6 research cache, both attempts, captures, and logs, including
  `.local/grid-doctor/`. This cache grants no product write authority.
  Keep E315's table, caller trace, selectors, and V20 supplement. Keep E313's
  failed attempt and E314's recovery evidence unchanged. Per-call timing
  limits remain.
- [E310](evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md):
  factory control and `gn-grid-spike-baseline.bwpreset`. Resource,
  outer-modulator, Gates-attachment, flavour, scale, and non-boolean write
  limits remain. The E289 edited project is not a baseline.

Historical Grid control: E316 verified `gn-grid-spike` with only `grid-probe`,
`FX 1`, and `Master`; `grid-probe` was selected, muted, and at -10 dB. Both
control pairs matched normalized E276: four modules and two cables. Keep
that control unchanged. E316 proved in-memory preservation, not saved-file
identity. Old claims and native IDs do not transfer to another session.
See the [roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.

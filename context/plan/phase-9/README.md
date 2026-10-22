---
title: Phase 9 — Overlap investigation
kind: plan
state: active
status: E330 accepts the normal-product update audit. E334 traces ownership and event dispatch. Next is 9b.6d receiver contracts and admission.
updated: 2026-10-21
parent: ../ROADMAP.md
prev: ../phase-8/README.md
next: ../phase-10/README.md
---

# Phase 9 — Overlap investigation

[9a — Live Grid editing spike](9a-live-grid-editing-spike.md) is complete.
Native module and cable operations pass on the fixed Poly Grid fixture.
The operator audio test and exact baseline restoration pass. The result is
limited to the tested operations, fixture, and pinned Bitwig build.
Start with the [E299 close-out](../../evidence/experiments/e299-grid-spike-close-out.md)
for the verdict and limits.

[9b — Grid breadth, build discovery, and build-out planning](9b-grid-breadth-discovery-and-build-out.md)
is active. It has three steps: breadth dimensions that can break the 9a
model (knob-modulation inputs, stateful modules, the module catalog, FX and
Note Grid, scale); runtime symbol discovery across Bitwig builds with a
consent-gated self-test; then the real build-out plan. Sessions are lighter
than 9a. The [symbol manifest](9b-grid-symbol-manifest.md) collects the
obfuscated symbols for step 2. See [NOW](../../NOW.md) for the current
session and the live state.

[E300](../../evidence/experiments/e300-grid-survey-preflight.md) records
the first survey preflight. V13 refuses reads after its used audio session
and only admits the original named Poly Grid fixture. The catalog seed and
symbol manifest are recorded; no stock preset was loaded.
[E301](../../evidence/experiments/e301-reusable-grid-survey-reader.md)
prepares and deploys the reusable reader.
[E302](../../evidence/experiments/e302-stock-grid-survey.md) completes the first
survey: 55 observed type UUIDs and a complete 31-module catalog inventory.
E304 extends the reader to focused values, mapping endpoints, Gates data,
Wavetable resource identity, and a 31-module patch. E308 passes the selected
boolean and mapping writes. [E310](../../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md)
passes the Gates detached factory and disposal case after E309 recovery.
Session 9b.3 and the bounded breadth investigation are complete.
[E311](../../evidence/experiments/e311-grid-offline-resolvers.md) completes
9b.4: all 69 manifest rows and 55 type dependencies resolve offline.
[E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md)
completes the 6.0.6 doctor with 76 roles, both Undo stages, final counters,
and clean teardown. The
[general update audit](9b-update-audit.md) has an offline driver and passing
checks ([E317](../../evidence/experiments/e317-update-audit-offline-preparation.md)).
Use the [driver guide](9b-update-audit-driver.md) for the normal-product
checks, including Sampler. [E318](../../evidence/experiments/e318-update-audit-614-deployment.md)
records the 6.1.4 handoff and normal deployment. Hello passes after replacement.
[E320](../../evidence/experiments/e320-update-audit-614-device-compatibility.md)
records successful recovery, passed note/clip/mixer/control/structure cases,
and two adapter corrections. Sampler stopped on a parameter-name mismatch.
[E321](../../evidence/experiments/e321-update-audit-sampler-library-export.md)
verifies the host export and tests the name fix. [E322](../../evidence/experiments/e322-update-audit-sampler-recovery.md)
passes recovery and the corrected live identity check. [E324](../../evidence/experiments/e324-update-audit-sampler-case-pass.md)
completes both Sampler export/reversal checks and the full fixture comparison.
[E325](../../evidence/experiments/e325-update-audit-selection-write-pass.md)
passes the selection write/reversal. Selection restoration passes.
[E326](../../evidence/experiments/e326-update-audit-collapsed-group-pass.md)
passes the collapsed-group case after a snapshot correction. Complete
ungrouped fixture and selection restoration now pass.
[E327](../../evidence/experiments/e327-update-audit-project-switch-pass.md)
passes project return and a fresh mixer write/reversal. Original Sampler
observations and saved-file capture now pass.
[E328](../../evidence/experiments/e328-update-audit-reopen-pass.md) passes
reopen file identity, full fixture equality, and fresh writes. The operator
confirmed the after-reopen Sampler observations.
[E329](../../evidence/experiments/e329-update-audit-listening-and-cleanup.md)
passes listening, the final observation checkpoint, and live cleanup.
[E330](../../evidence/experiments/e330-update-audit-614-acceptance.md) completes
the clean save and accepts the tested normal-product scope.
[E331](../../evidence/experiments/e331-grid-doctor-614-resolver-refusal.md)
records the 6.1.4 Grid resolver refusal: 53 missing type roles and 76 blocked
members. [E332](../../evidence/experiments/e332-grid-doctor-614-command-contracts.md)
traces changed ownership and disposal contracts.
[E333](../../evidence/experiments/e333-grid-doctor-614-ownership-admission.md)
refuses admission for document history and global tracking work.
[E334](../../evidence/experiments/e334-grid-doctor-614-admission-boundaries.md)
traces inherited parent getters and queued tracking dispatch. History bounds
and native command non-reentrancy remain unproved. Next is
[9b.6d](9b-grid-breadth-discovery-and-build-out.md#session-9b6d--complete-receiver-contracts-and-admission).
No new probe is deployed. The 6.1.4 live doctor remains incomplete.
General acceptance grants no native Grid write authority.

The normal archive is deployed and its loaded profile is verified on 6.1.4.
E316 records the last verified V20 state on 6.0.6: all scratch tracks deleted,
reader and writer released and unlocked, with full preserved-state and
normalized E276 control checks passed. Public descriptions
remain v52. Do not repeat the completed 9a audio flow. The former Phase 9
publication and release plans are in [Phase 10](../phase-10/README.md).

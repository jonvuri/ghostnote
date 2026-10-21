---
title: Phase 9 — Overlap investigation
kind: plan
state: active
status: The 6.0.6 doctor is complete (E316). Next is the general update audit, then 9b.6.
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
and clean teardown. Start the
[general update audit](9b-update-audit.md): implement its offline driver
while the operator preserves 6.0.6 and installs 6.1.x. Run the normal-product
checks, including Sampler, after the operator handoff. Then start
[9b.6 on 6.1.x](9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x).

The research probe remains deployed. V20 is loaded and verified. All scratch
tracks are deleted; the reader and writer are released and unlocked. Full
preserved-state and normalized E276 control checks pass. Public descriptions
remain v52. Do not repeat the completed 9a audio flow. The former Phase 9
publication and release plans are in [Phase 10](../phase-10/README.md).

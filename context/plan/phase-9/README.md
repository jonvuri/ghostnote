---
title: Phase 9 — Overlap investigation
kind: plan
state: active
status: 9a is complete (E299). E302 surveys stock Grids on V14; 9b.2a improves read coverage before write probes.
updated: 2026-10-20
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
Full stock graphs remain incomplete or refused. Session 9b.2a targets schema,
modulation, and resource read coverage before 9b.3 write probes.

The research probe stays deployed by operator choice. V14 is loaded and
verified. All scratch tracks are deleted. The V13 audio test was complete; do
not repeat that workflow. The former Phase 9 publication
and release plans are in [Phase 10](../phase-10/README.md).

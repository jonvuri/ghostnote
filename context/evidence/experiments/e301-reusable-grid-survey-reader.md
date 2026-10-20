---
title: E301 — Reusable Grid survey reader preparation
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E301 — Reusable Grid survey reader preparation

## Result

V14 is built, checked, and deployed. Operator controller replacement and live
verification are pending. The user authorized removal of the E300 read
restrictions and a flexible session for this and later surveys.

`probe.gridRead` now routes bind, schema, read, status, and release to a
[separate reader](../../../extension/src/main/java/com/ghostnote/extension/handlers/GridSurveyHandlers.java).
It accepts explicitly named native devices in any project. The completed
audio test's `used` flag no longer owns this reader. Each release permits
another bind. The method count and hash stay at 118 / `2e939035ea90b8b0`;
the new build marker is `9b-grid-survey-v14`.

The [session](../../../extension/src/main/java/com/ghostnote/extension/GridSurveySession.java)
keeps project, track, device, epoch, native-thread, and jar checks. The
reader and retained audio path exclude each other while either owns native
work. A timeout keeps the reader locked, including after late completion.
The old audio allowance and retired write routes are not reset or widened.
No new obfuscated symbol, graph cap, or public tool is added. Descriptions
remain v52.

## Driver and scope

The [survey driver](../../../brain/src/probes/phase9b-grid-survey.ts) accepts
a project, a new output directory, and up to 32 preset paths. It creates one
scratch track at a time, mutes it, inserts the preset, reads, and deletes
the track. The public track tools retain their independent readback and
selection handling. Preset insertion uses an explicit track/empty-chain
guard and a second device-bank cursor for readback.

The [read helper](../../../brain/src/probes/phase9b-grid-survey-read.ts)
finds `module_grid` through two schema reads instead of fixed child index 7.
It extends unknown projections, records absent-field removals, compares two
final graphs, and checks module membership and cable references. The control
must match the E276 baseline after instance UUID and managed-ID normalization.
Cap refusals remain results. Uncertain writes stop for inspection without
automatic retry. Existing track structure is checked between presets;
device/mixer state and selection are compared at entry and exit.

A read-only CLI mode supports an existing target and an optional projection.
The low-level session also permits other bounded native descriptor paths.
Batch setup is limited to 32 visible tracks. Results cover the explicit
projection; outer modulators, opaque content, and unsupported classes can
remain unknown. Raw schemas and captures support later analysis.

## Checks, deployment, and cost

`./gradlew check` passes, including the reader, asynchronous failures,
factory, attachment, audio protocol, new survey session, and archive-profile
checks. TypeScript typecheck and 83 focused tests pass; the seven survey
tests also pass after the final input/cleanup checks. The
[verification record](../data/phase9b-survey-reader/verification-offline.json)
lists the commands. These cover discovery
at a different child index, projection changes, control comparison, cap
refusal, changing graphs, timeout behavior, input bounds, wire inventory,
the retained audio driver, and product call budgets. Context links and diff
checks pass. Fixture creation and cleanup still need their live run.

`./gradlew copyProbeExtension` copied the archive. Its bytes match the built
probe archive; see the [deployment record](../data/phase9b-survey-reader/deployment-v14.json).
No controller manipulation or live request ran in this preparation. V13 was
last observed in E300; no claim is made that V14 is loaded.

The [cost model](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b2--scratch-reader-and-survey-continuation)
retains 4,096 shared work units and 1 MiB per result. The per-preset discovery
budget is at most 64 schemas, 34 captures, bind, status, and release
(101 wire calls). Fixture setup reuses measured public operations, with
bounded driver polls. Only weak native target references survive a session.
The 8 MiB temporary-host-heap allowance per capture is a planning estimate,
not a new measurement. Live wire/document time, graph size, cap behavior,
and heap samples must be recorded after replacement.

## Next

Continue 9b.2 after the operator replaces the controller with the final
matching `ghostnote probe` product and selects the host project. Run
`npm run probe:hello`; verify V14, a fresh initialization, and the unchanged
method inventory. Run the saved control and stock sample, delete owned
scratch tracks, and record the survey in E302 or the next free E number.
Select 9b.3 writes from those results.

---
title: E303 — Focused Grid reader preparation
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E303 — Focused Grid reader preparation

## Result

The offline part of [9b.2a](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b2a--focused-reader-coverage)
is prepared. V15 is built and deployed. Controller replacement and live
acceptance are pending. No live bridge call, project edit, engine command,
transport command, or save ran in this preparation.

The marker is `gridReadProbe: 9b-grid-focused-v15`. The probe profile stays
`phase-8-probe-v1`, with 118 methods and hash `2e939035ea90b8b0`.
Public tool descriptions remain v52. No product tool or pinned member changed.

`./gradlew copyProbeExtension` deployed
`~/Documents/Bitwig Studio/Extensions/ghostnote-0.0.1.bwextension`
at `2026-10-20T16:49:09.868Z`. Its SHA-256 is
`ca36ac069a0bacb9f48769c5c0f8d4c2b7f3facf052fc2b4049087e6e00113c8`.
This proves the archive copy, not the loaded Java classes.

## Changes

`probe.gridRead` schema requests accept
`schemaHeaders: { fields: [406], limit: 256 }`. They report all property
descriptors and full relationship counts. They enumerate headers only for
the requested relationships, under one shared header limit. Each relationship
reports `headersRequested`, `returnedCount`, `childrenComplete`, and
`truncated`. A truncated requested relationship makes the schema incomplete.
An omitted nonempty relationship has `childrenComplete: false` and
`truncated: false`. Missing or scalar requested IDs are refused.
Requests without `schemaHeaders` keep the V14 behavior.

The survey driver now requests only field 406 at the device and field 173
at its contents. It requires complete headers for both routes. Class schema
inventory requests counts without child headers.

The new [focused reader](../../../brain/src/probes/phase9b-grid-focused-read.ts)
uses catalog pairs before and after the reads. It captures each module's
atom membership before and after its configured atom reads. Each successful
read has two equal captures. It checks module UUID/type/name, unique atom
membership, positive managed IDs, relationship counts, and reference
membership. Managed IDs join references only within that bound session.

Only the selected root atom and configured connection/resource classes
expand. Other related classes expose managed IDs only. The driver saves
their schemas and marks identity-only data. It does not infer resource
content, connection semantics, or write permission from these leaves.
Caps and incomplete pairs remain explicit limits. Timeout handling keeps
the existing no-retry rule and unfinished-work lock.

The [query](../data/phase9b-focused/focused-query.json) requests stored
parameter values, mappings 3615/3616/11497, inport source/index, Gates data
6609/6613, and Wavetable relationships 11161/11162. It omits editor color
and engine state. Unknown mapping/resource schemas can require a revised
driver projection after live discovery; no further extension change is
currently planned.

The [sample](../data/phase9b-focused/sample-plan.json) contains the baseline,
SEMtex Motion Seq, Stutter Steps, Grid Multi FX, and WT Parkour. E302
establishes Gates and Wavetable in WT Parkour. Sampler/Audio File content
is still unconfirmed.

The [catalog provenance](../data/phase9b-focused/catalog-provenance.json)
regroups E302's 55 UUIDs and 63 observed names. Each alias retains its preset
paths and source evidence. Canonical names remain null. Filename matches
remain lexical observations. This adds no live observation.

## Cost and verification

The [pre-implementation model](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#9b2a-implementation-bounds)
limits schema headers to 256 total across at most 64 requested fields.
Captures keep the existing 4,096 shared work units, depth 12, 256 scalar-array
entries, 32 projection classes, 1,024 fields, and 1 MiB result limit.
The existing bounded path recheck and target/epoch guards remain.

Per preset, the driver permits 64 modules, 256 atoms per module, 256 schema
calls, and 1,024 graph calls. Bind/status/release give a maximum of 1,283
read-session calls, with a 30.792-second wire floor at 24 ms per call.
It writes full captures to disk and bounds retained result summaries to
4 MiB, plus the current graphs, catalog, and membership records. Fixture
setup, selection checks, cursor parking, and deletion keep the E302 model.
There is no native Grid write stage or subscription.

The temporary host-heap planning allowance is 48 MiB per capture. This is
above E302's observed 38 MiB process-heap increase, but is not an enforced
allocation bound or a measured peak. Native getter allocations remain
unbounded by this estimate. Live wire/document/heap measurements are pending.
No regression or stable performance claim is made.

Checks passed:

- `./gradlew gridReadTest`: schema, capture, session, timeout, and retained
  native write safety controls.
- 195 TypeScript tests: focused/survey readers, product call budgets, and
  the live adapter's offline checks. The shared run passed 194 tests. After
  the final input guard, all six focused tests passed, including one new test.
- `npm run typecheck`.
- Catalog regrouping: all 55 UUIDs and 63 name observations retained.
- Context file links and `git diff --check`.

## Continuation

The operator must fully remove the controller and add the final
`ghostnote probe` entry in the complete list. A toggle, detected-controller
button, or earlier duplicate does not establish a fresh class load.
After confirmation, run `npm run probe:hello` and check the V15 marker,
profile, method count/hash, and initialization time after deployment.
Check competing clients and recheck the project, target, and selection.

Run the prepared sample on muted owned scratch tracks in the chosen
`gn-grid-spike` project. Keep `grid-probe` unchanged. Inspect the new schemas,
then select explicit mapping/resource fields as needed. Check complete
connections and resource identity before defining any 9b.3 write scope.
Compare paired control fields with E276, record costs and preserved state,
park both cursors, and delete the scratch tracks. Use E304 or the next free
record for live acceptance. Session 9b.2a is not complete.

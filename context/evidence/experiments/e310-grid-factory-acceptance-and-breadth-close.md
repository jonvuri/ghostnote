---
title: E310 — Gates factory acceptance and bounded write close-out
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E310 — Gates factory acceptance and bounded write close-out

## Result

Session 9b.3 is complete. The V18 factory-only case passes creation, paired
independent descriptor reads, disposal, and paired disposal reads. Its owned
scratch track is deleted. Reader and writer are released and unlocked.
Entry and exit tracks, device banks, mixer, and selection are equal. The
entry snapshot also equals E308's original snapshot after E309 recovery.
Both control pairs match normalized E276: four modules and two cables.

Together with E308, all three selected cases pass within their fixed scope:

| Case | Verdict | Evidence |
|---|---|---|
| Gates `DEVICE_PHASE` boolean | Pass: false → true → false, paired readback | E308 |
| Grid Modulator Out → Lowpass mapping | Pass: remove and restore one edge, exact stored fields and preserved routing | E308 |
| Detached Gates factory | Pass: fresh instance, paired defaults, disposal of 236 owned objects, paired disposal readback | E310 |
| Gates attachment | Refused by scope: existing attachment guards are specific to Amplify | E305, E310 |

The failed E308 factory claim is not resumed. E309 proves full process exit
and recovery. This run uses a new fixture, claim, and detached object. It does
not retroactively prove native disposal of E308's object. The passed boolean
and mapping commands are not repeated.

## Loaded build and live checks

The operator confirms controller reload. The full
[hello check](../data/phase9b-writes/v18-recovery/hello-after-reload.txt) passes:
`phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, marker
`9b-grid-writes-v18`, and initialization `2026-10-20T20:38:10.868Z`.
The direct reader/writer markers and `rig.info` agree. The deployed archive
is the unchanged E308 V18 archive. No new build or deployment runs.

The process check finds no competing driver or established bridge client.
Only Bitwig PID 24537 listens on port 8686. One foreground factory-only
chain runs in `gn-grid-spike`. Fresh guards check project, target, selection,
ownership, edit state, and source freshness. Native witnesses report the
engine active, edit idle, and verified parents. Transport is stopped by the
bind requirement. No engine, transport, or save command is sent.

The [report](../data/phase9b-writes/live-v18-factory/report.json),
[case result](../data/phase9b-writes/live-v18-factory/results.json), and
[final status](../data/phase9b-writes/live-v18-factory/final-status.json)
retain the result. The [capture validation](../data/phase9b-writes/live-v18-factory/capture-validation.json)
rechecks all six accepted snapshots offline, all three pairs, the full
before/after comparison, and equality with E308's original snapshot.
The full control captures and schemas are in
[control-captures.zip](../data/phase9b-writes/live-v18-factory/control-captures.zip).
The complete [call log](../data/phase9b-writes/live-v18-factory/calls.json.gz)
is compressed. Bytes were checked before raw copies were removed.

## Detached defaults and lifecycle

The factory returns Gates type `8d644ad7-8d77-4f05-a36e-04a57f719635`, with a
fresh module UUID and 17 atoms. The ownership walk contains 236 objects.
The two independent descriptor captures agree. They report:

- Step Count 8; data size and array length 64.
- Data entries are 1 at indices divisible by 3 and 0 at the other indices.
- Use Device Phase true; Mute when stopped false; Mode 0.
- No external audio-input connection or modulation mapping.

These are factory defaults, not the WT Parkour values. WT Parkour's selected
Gates uses Device Phase false and Mode 1. The detached reader uses stable
ownership-order IDs; native UUID still proves fresh module identity.
References remain inside the proved owned tree. The 19-module fixture and
its selected Gates state remain unchanged across the factory stages.

Disposal is a separate command task after both detached reads. The two
later tasks independently check the disposed flag on every retained owned
object and return `disposed: true`. The driver then releases the claim,
parks both survey cursors on a preserved track, deletes its scratch track,
and checks absence. No native attachment, undo, or audio test runs.

## Cost and verification

The unchanged V18 model uses 13 protocol/guard calls, nine document tasks,
two commands, and eight snapshots, including both pre-command snapshots.
The full fixture/control workflow logs 235 calls and 6,818.363 ms summed wire
time. This is not wall time. Hello and the final six status/mixer calls are
outside that log.

| Stage | Wire time | Document task time | Descriptor work |
|---|---:|---:|---:|
| Bind | 52.562 ms | 4.854 ms | Route validation |
| Initial read pair | 47.861 / 48.960 ms | 4.225 / 1.322 ms | 791 each |
| Detached read pair | 46.719 / 47.298 ms | 1.612 / 1.277 ms | 1,218 each |
| Disposed read pair | 48.365 / 48.613 ms | 1.807 / 1.242 ms | 791 each |
| Create command | 49.590 ms | 5.479 ms | 791 pre-command |
| Dispose command | 45.723 ms | 1.993 ms | 1,218 pre-command |

Native creation takes 3.058 ms; disposal takes 0.298 ms. Snapshot times range
from 0.597 to 3.326 ms. Read replies are 5,163–7,487 bytes. The nine document
task heap deltas are 0–2 MiB; these are process samples, not peak bounds.
The 236-entry detached map stays inside the existing 256-object ownership,
4,096-work, one-second snapshot, and result-size limits. Keep the 48 MiB
planning allowance. No product call budget or public description changes.

The unchanged control pairs take 47.586–49.313 ms wire. Each has 1,606 query
and 278 graph work units. Wire times remain within 20 percent of E304.
Document times are 5.224/3.591 ms at entry and 7.441/4.189 ms at exit. First
capture document times exceed E304's 3.518 ms by more than 20 percent. The
cause is not proved; do not claim a stable document-time bound. The initial
factory-baseline read is also slower than the prewarmed E308 sample. The
same-work code has not gained a host call; these runs do not isolate cold
work from host timing variation. No write is repeated for timing.

V18's type checking, 18 focused TypeScript tests, Java Grid harness, metadata
checks, and archive checks remain the E308 results. No implementation changes
need a repeat. This run supplies the missing host acceptance. Document link
and diff checks pass.

## Breadth disposition and limits

The breadth step is complete as a bounded investigation, not as general Grid
product support. E302 and E304 retain the catalog, family, and read evidence.

| Dimension | Disposition | Bound or unproved part |
|---|---|---|
| a — Knob modulation | Extension to the read model; selected Grid mapping read and write pass | Sources outside module membership have unproved owners; no outer-modulator write |
| b — Stateful modules | Extension needed; Gates data/defaults and detached lifecycle pass; Wavetable resource identity reads pass | No resource loading, array write, Sampler, Audio File, or Gates attachment |
| c — Module catalog | First pass complete: 65 UUIDs, 89 observed aliases, 56 lexical filename matches | Editable names are not canonical; no full factory catalog or file decoder |
| d — Grid flavours | Same container model in Poly, FX, and Note catalog reads; focused FX reads pass | Different I/O schemas; no FX/Note write acceptance |
| e — Scale | Focused reads pass at 31 modules and selected parts of a 50-module patch | 64-module driver bound; 83-module Stutter Steps remains refused |
| f — Non-decimal values | Typed boolean command passes on Gates | Integer/indexed/bipolar writes remain unproved |

Readable projections cover the observed oscillator, filter, modulation,
sequencer, and I/O examples in the E304 captures. They do not establish
complete support for those families. The catalog and observed schemas retain
the exact type and descriptor scope. The symbol manifest covers the admitted
read, boolean, mapping, factory, and lifecycle paths; no new native member is
added in E310. Public descriptions remain v52.

## Exit and next

The only tracks are `grid-probe`, `FX 1`, and `Master`. `grid-probe` is muted
at -10 dB and selected. No scratch track, uncertain claim, write lock, or
unfinished native task remains. V18 remains loaded; the normal profile is
not restored. Saved-file identity and the UI save marker are not tested.

Continue with [9b.4 offline resolvers](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b4--offline-resolvers).
The conditional 9b.3a listening session is not needed for these stored-state
results. No new audible-behavior claim follows. Keep the limits above for
build-out planning; do not expand the write scope from a catalog match.

---
title: E304 — Focused Grid reader live acceptance
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E304 — Focused Grid reader live acceptance

## Result

Session 9b.2a is complete within the scope below. V15 passes selective route
discovery, focused parameter and resource reads, and the 31-module check.
Three bounded write probes are selected for 9b.3. No native Grid write ran.

After operator replacement, [hello](../data/phase9b-focused/hello-v15.txt)
passed: `phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`,
marker `9b-grid-focused-v15`, initialization `2026-10-20T17:03:31.091Z`.
No competing probe driver or Ghostnote client was found. No extension was
built or deployed in this continuation.

The [report](../data/phase9b-focused/focused-report.json) contains six batches,
ten successful preset passes, costs, and preservation checks. The batches
created and deleted 13 muted scratch tracks. The captures are stored in
each run's `captures.zip`; every archive was checked against the original
JSON bytes before those generated files were removed. Call logs and duplicate
batch results use gzip JSON, also checked against the original bytes.
Summaries, schemas, and fixture records remain plain JSON.

## Route and scale coverage

Selective schemas identify the old refusing relationship:
`device_contents.components_to_execute` (6199) has 421 children in SEMtex
Motion Seq and 388 in Stutter Steps. V15 reports those counts and returns
zero headers for them. Requested field 173 is complete in both cases.

SEMtex has 50 modules. The first broad focused pass reaches the driver's
1,024-capture limit. Stutter has 83 modules; its first whole catalog reaches
4,096 work units. The driver stops and cleans up. Its initial catalog refusal
raised an assertion instead of a preset result; the saved failure and exit
records show no uncertain write and no remaining scratch track.

The continuation reads catalog entries as paired single-module captures,
before and after the detailed reads. It checks every module's atom
membership and selects ten observed SEMtex module indices for detailed
reads. The 1,024-capture ceiling stays fixed. Stutter is then refused at the
64-module driver scope, after successful route discovery. Host caps were
not raised.

| Preset | Members | Configured atom reads | Capture calls | Result |
|---|---:|---:|---:|---|
| Saved baseline, revised driver | 4 | 32 | 111 | Membership, 95 stored values, and 2 cables match E276 |
| WT Parkour | 19 | 180 | 621 | All configured reads agree; 22 projected audio edges have member endpoints |
| Grid Multi FX | 31 | 179 | 750 | All configured reads agree; 36 projected audio edges have member endpoints |
| SEMtex Motion Seq, selected modules | 50 | 63 | 669 | All memberships and selected reads agree |
| Stutter Steps | 83 reported by schema | None admitted | 0 with revised driver | Outside the 64-module scope |

These are explicit projections. They do not cover all module state,
engine state, editor state, or every possible connection class.

## Parameter and connection results

The [expanded SEMtex pass](../data/phase9b-focused/live-v15-v3/preset-1-focused-summary.json)
reads 17 mappings. Five have both source-side 3616 and target-side 3615
records in the selected reads. Each mapping's source 3635 agrees with the
source atom. Destination reference 3739 resolves through
`device_atom_reference.atom` (65) to the target parameter. Array membership,
unique atom IDs, reference membership, and cross-capture field agreement
pass. Managed IDs are valid only within this bound session.

One complete example connects module 13, `Modulator Out`, source atom 1,
to module 24, `Lowpass`, decimal atom 0. Mapping amount 3611 is **129 in
native units**, enabled 11481 is true, and transfer function 11338 is
`LINEAR`. Source 11497 is empty. No percentage interpretation is established.

The source's settings 6194 lead to inport list 614. Its first connection
reads source component 248 as the same module's nitro atom 2, with outport
index 249 equal to 0. This proves the internal input route and the Grid
mapping endpoints. It does not trace the nitro program or prove DSP behavior.

Four other mapping sources are outside all 50 modules' atom memberships.
Their target references are readable. Their owners were not traversed, so
they remain **sources outside Grid module membership**, not verified outer
Bitwig modulator instances. No outer-modulator write is admitted.

## Stateful results

WT Parkour's Gates module has type UUID
`8d644ad7-8d77-4f05-a36e-04a57f719635`. Data atom 5 exposes 64 floats at
6609; 6613 is also 64. Step Count atom 4 stores integer 8 at 828.
`Use Device Phase` atom 7 and `Mute when stopped` atom 9 store false at
boolean field 210. Mode atom 10 stores indexed value 1 at 457.
These reads agree in pairs. The file name was not used to infer this content.

The [final resource pass](../data/phase9b-focused/live-v15-v6/preset-0-focused-summary.json)
follows Wavetable resource/playback fields 11161/11162 through
`wavetable_resource` 11287, `wavetable_reference_handle` 1204,
`wavetable_reference` 4766, and `file_reference`. It reads:

- Name: `Sine Feedback.wt`; Wavetable name: `Sine Feedback`.
- Package identity:
  `Bitwig/Essentials:13/wavetables/Wavetables/Analog/Sine Feedback.wt`.
- Local path under the installed Essentials package, state `FOUND`,
  file length 8,204 bytes, empty project path and sub-path.
- Cycle size 128 and table size 32.

The [final query](../data/phase9b-focused/focused-query-v6.json) records the
explicit fields. Each added projection came from a saved live schema.
The file bytes, checksum, playback buffer, and resource loading behavior
were not tested. Sampler and Audio File remain unconfirmed.

The [catalog](../data/phase9b-focused/catalog-updated.json) now contains
65 UUIDs and 89 observed UUID/name pairs, including E302. There are 56 exact
filename overlaps among 232 files. Aliases retain preset and capture
provenance; canonical names remain null. The
[schema inventory](../data/phase9b-focused/observed-schemas.json) has
39 descriptor/runtime pairs. No new obfuscated member was pinned.

## Cost and verification

The six scratch batches use 7,321 logged wire calls and 298,116.948 ms of
summed call time. Public frames can overlap, so this sum is not wall time.
There are 5,154 graph calls, including bounded discovery refusals.
Wire time is 37.614–58.648 ms, median 47.380 ms. Document time is
0.102–3.522 ms, median 0.421 ms. Graph heap deltas are 0–4 MiB.
Schema document time reaches 1.954 ms, with heap deltas of 0–2 MiB.
The first cold bind takes 67.160 ms on the wire.

After partitioning, complete captures use at most 1,089 shared work units.
The first whole 50-module catalog used 3,874. The 31-module case has 750
captures, 29 schemas, and bind/status/release: 782 read-session calls.
At 24 ms per turn, its floor is 18.768 seconds. Its many calls buy per-atom
coverage and paired membership checks; E302's seven-call catalog covered
only module identity. They are different workloads.

The final unchanged semantic control reads take 47.837/49.935 ms wire and
3.518/4.751 ms document. Their wire times remain within E276's
43.599–50.752 ms range. No comparable regression over 20 percent was found.
No read or write was repeated only for timing.

Keep the 48 MiB planning allowance. These process samples do not measure
peak allocation, native getter allocation, or unrelated host activity.
They do not establish a general memory bound. Product call budgets and
public descriptions v52 remain unchanged.

All 16 focused/survey tests and TypeScript typecheck pass. The
[offline report driver](../../../brain/src/probes/phase9b-grid-focused-report.py)
checks membership, connection endpoints, cross-capture fields, Gates sizes,
catalog provenance, control values, preservation, and the final normalized
baseline. Context links and diff checks pass.

## Preservation and next

Every later entry and completed exit matches the first entry snapshot:
original tracks, device banks, mixer, and selection. The first aborted
batch's cleanup is confirmed by the next complete entry. Both survey
cursors were parked before each scratch deletion.

The [final paired read](../data/phase9b-focused/preserved-v15/summary.json)
matches E276 after instance UUID/managed-ID normalization: four modules and
two cables on `grid-probe`. The [final state](../data/phase9b-focused/final-state.json)
has only `grid-probe`, `FX 1`, and `Master`; the reader is released and
unlocked, with no uncertain task. `grid-probe` remains muted at -10 dB.
No engine, transport, or save command ran. Engine activity, file identity,
and the UI save marker were not independently tested.

[9b.3](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b3--bounded-write-probes)
can test one Gates boolean, one proved Grid mapping edge, and the Gates
factory case. Each needs the independent descriptor readback specified
there. Resource loading, outer modulation, cross-flavour writes, and the
83-module case remain outside that write scope.

Lesson: count relationships before graph traversal, and select the fields
needed for the question. A schema cap can describe an execution list rather
than Grid membership. A paired identity leaf is not parameter or resource
readback.

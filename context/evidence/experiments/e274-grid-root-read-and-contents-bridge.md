---
title: E274 — Grid root read and contents bridge
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E274 — Grid root read and contents bridge

## Result

Continuation: [E275](e275-grid-dsp-walk-and-scoped-discovery.md) records the V2
live result and V3 preparation. Use E275 and NOW for the current deployment.

The first live [9a](../../plan/phase-9/9a-live-grid-editing-spike.md) capture
reached the correct native device on the document thread. Two captures agree.
They contain only the outer device and its display settings. They contain no
Grid modules or cables. The semantic read gate fails on this path. No internal
write, manual parameter change, or CRUD experiment ran.

The `9a-grid-read-v2` archive adds one explicit root relationship. It is built,
tested offline, and deployed. Operator replacement and its live measurement
are pending. This change is a research lead, not a successful module read.

## Fixture and independent baseline

The operator supplied project
`/Users/jonvuri/Documents/Bitwig Studio/Projects/gn-grid-spike/gn-grid-spike.bwproject`.
The preset was found at
`/Users/jonvuri/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset`.
Its SHA-256 is `1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
It has 10,451 bytes and byte-round-trips through the pinned bwpreset parser.

The UI and saved preset agree on this patch. Coordinates and port IDs below
come from the preset. The UI confirms relative positions, cable direction,
and the two displayed gain values.

| Preset index | Module | Cell x, y | Observed value |
|---|---|---|---|
| 0 | Sine | -4, -2 | Pitch 0 st, offset 0 Hz, ratio 1:1 |
| 1 | Amplify | -1, -2 | UI 25%; stored VALUE 0.6299605249474366 |
| 2 | Audio Out | 0, -2 | Input from module 1 |
| 3 | Amplify | -1, 0 | UI 50%; stored VALUE 0.7937005259840998; disconnected |

Cables are `0/OUT -> 1/IN` and `1/OUT -> 2/IN`. The two Amplify modules share
type UUID `a6cd650b-c4de-46c6-8741-c07a0a9bfec2`. This is a type ID, not an
instance ID. The stored gain values are not the displayed percentages. Their
conversion remains unclassified; these pairs do not establish a general rule.

Track `grid-probe` has channel ID `c784d25c-b753-47ca-af8d-c83d11cfd990`.
It is muted at -10 dB. The audio engine is inactive. Poly Grid is enabled.
The default outer Vibrato and Expressions modulators remain present. They
are part of the baseline. The project also has the default FX 1 and Master.

The project tab had an unsaved marker before capture. After capture, the agent
saved the current fixture with the UI save command. The marker cleared. The
patch values and topology were not changed. The editor remains open. The
[fixture record](../data/phase9a-grid-read/fixture-baseline.json) has the
post-save project hash. The [capture file record](../data/phase9a-grid-read/live-01/files.json)
retains the earlier hash. No equality claim is made between those project files.
The preset was not changed. Other open projects were not saved or modified.

Reproduce the preset summary without changing the file:

```sh
python3 tools/grid-spike/inspect_preset.py '/Users/jonvuri/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset'
```

See the [preset baseline](../data/phase9a-grid-read/preset-baseline.json).
The helper imports the pinned external parser. It does not copy its source.

## First live read

The operator confirmed controller replacement. `npm run probe:hello` passed:
`phase-8-probe-v1`, 112 methods, `1632f304f2cdb820`, marker
`9a-grid-read-v1`, initialized at `2026-10-18T13:51:31.960Z`.
No other phase8 or phase9 driver was running. The state read confirmed project
`gn-grid-spike` and the selected `grid-probe` track before capture.

The [entry](../data/phase9a-grid-read/live-01/entry.json),
[binding](../data/phase9a-grid-read/live-01/binding.json),
[first capture](../data/phase9a-grid-read/live-01/capture-0.json), and
[second capture](../data/phase9a-grid-read/live-01/capture-1.json) record the run.
The runtime root is `com.bitwig.flt.document.core.master.device.S2E`, descriptor
`native_device`, class ID 163. The observed device UUID is
`e3aebd87-3e23-4de1-8d96-da410b00d77d`. This UUID has not been tested across reload.

Both captures have two nodes, 82 work units, and no traversal error. Their raw
node arrays agree. `complete: true` applies to the selected descriptor scope;
it does not mean a complete Grid graph. The driver reported
`semanticGate: not-yet-evaluated`. Independent comparison now establishes the
missing modules and cables. Mixer and slot selection were unchanged. The
probe epoch was released. No repeated speculative live call followed this result.

## Cause and bounded revision

Offline inspection followed the observed S2E class through Kdw, UZp, Ibf, ar,
and OEf. The `ilU.W2P()` descriptor defines `device_contents`, ID 406, as a
`cYz` relationship with flags 409. `cYF.eJS()` tests flag bit 1. The existing
`vWM.cG3` filter excludes such properties. Thus the file serializer filter
omits the runtime device contents from this root walk.

`OEf.Wrf()` checks the document context, then returns field `wi2`. The inherited
getter chain reaches that field. This is an existing contents object. The
relationship accessors use the descriptor's indexed child dispatch. No factory,
preset export, command, or setter is needed for this bridge.

V2 admits property 406 only at depth zero, only on runtime class S2E, and only
when its name is `device_contents`, it is a relationship, and its enabled check
passes. Other properties keep the serializer filter. Filter exceptions still
fail the capture. The bridge is tagged `explicit-root-bridge`; it is not
reported as a serializer-selected property. Existing work, depth, byte, scalar,
time, identity, and asynchronous bounds still apply. The driver requires one
contents child before it accepts raw captures. It still makes no semantic pass
claim.

The [inspection record](../data/phase9a-grid-read/environment-v2.json) hashes
24 named class inspections. Vendor bytecode remains outside Git. The host jar
and source pins are unchanged from [E273](e273-grid-descriptor-read-probe.md).

## Cost and checks

The [call trace](../data/phase9a-grid-read/live-01/calls.json) has 16 wire calls:
seven entry reads, one cursor point, two cursor status polls, one device list,
one bind, two captures, one final selection read, and one release.

| V1 operation | Wire elapsed | Document task | Queue | Result |
|---|---|---|---|---|
| Bind | 81.573 ms | See binding record | See binding record | Identity only |
| Capture 0 | 47.393 ms | 3.857 ms | 0.076 ms | 5,260 graph bytes |
| Capture 1 | 48.148 ms | 1.050 ms | 0.080 ms | 5,259 graph bytes |

The capture wire times differ by 1.6%. The document walk times are 2.693 and
0.768 ms; first-use overhead is a possible cause, not a measured attribution.
Process heap samples show zero change in both captures. They do not measure
peak allocation or retained heap. These numbers describe two outer nodes, not
a four-module graph. They cannot establish a Grid speedup or largest-case cost.
See the [measurement record](../data/phase9a-grid-read/v1-measurements.json).

V2 adds descriptor traversal, not a wire call or write stage. It retains the
plan's four-turn read target and 8 MiB planning estimate. The contents walk
and its cost remain unmeasured. Rerun the matching live capture after replacement;
compare scope and node/work counts before interpreting any timing change.
No product call budget changed.

Extension build, archive registration checks, and the Grid harness pass. New
controls prove that an explicit root bridge does not admit a filtered child
relationship, bypass a filter failure, or bypass depth and child-read failures.
Brain typecheck and all 236 focused wire, adapter, and call-budget tests pass.
The saved preset parses and byte-round-trips. Public descriptions remain v52,
44 tools. No public tool description changed.
Context validation passes with 630 active documents. The
[verification record](../data/phase9a-grid-read/verification-v2.json) records
these checks. Fixture file hashes were checked again after the save.

## Handoff and verdict

The [v2 deployment](../data/phase9a-grid-read/deployment-v2.json) has SHA-256
`452a6a095e71d2e460396c7e65bcf94857855614d55a5309f13dcfbcc4559450`.
The profile and method table stay unchanged. The deliberate marker is
`9a-grid-read-v2`. The running controller was V1 at deployment.

| Dimension | Verdict |
|---|---|
| Java access to correct outer host device | Proved on this fixture |
| Complete module and cable read | Failed on V1 scope; V2 unmeasured |
| Independent preset/UI baseline | Recorded |
| Scalar delta, selection-away read, save/reload identity | Not attempted |
| Module create, update, delete | Not attempted; read gate required |
| Cable create, retarget, delete | Not attempted; read gate required |
| Engine adoption, edited persistence, mutation recovery | Not attempted |
| Cleanup | No patch mutation; epoch released; fixture saved |

Next, the operator must fully remove the controller and add the final matching
`ghostnote probe` product in the complete list. After confirmation, run the
hello and capture driver against a new output directory. Continue the existing
9a semantic gate only if all required modules and cables are present. The
normal profile has not been restored; the research archive remains deployed.

## Retrospective

A serializer-complete walk can omit live device contents. Record the selected
scope and require fixture module/cable coverage before treating a read as useful.
The V2 driver now also checks the explicit contents relationship. The fixture
recipe is recorded in the plan so the next operator need not infer it.

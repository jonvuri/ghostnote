---
title: E276 — Grid semantic read and guarded value probe
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E276 — Grid semantic read and guarded value probe

## Result

The four-module semantic read gate passes on the saved Poly Grid fixture.
V3 reads all four module types, distinct instance UUIDs, stored parameter
values, grid positions, ports, and both directed patch cables. Two settled
reads agree at each stage. The result matches the independent saved preset.
It also follows one manual value change, returns to baseline, survives a
change of selected device, and matches after project save and reload.

Module UUIDs change when the project reloads. They identify instances within
that loaded document only. The outer Poly Grid UUID remains unchanged in this
one reload. Neither fact is a general persistent-identity contract.

No internal write has run. V4 adds one guarded research method for the next
step: change the disconnected Amplify between the two manually observed
values. Its offline checks pass. It requires operator controller replacement
and a fresh hello before use. Module and cable CRUD remain unproved.

## Environment and entry

The operator confirmed replacement. V3 hello passed with 112 methods,
`1632f304f2cdb820`, profile `phase-8-probe-v1`, marker `9a-grid-read-v3`, and
initialization `2026-10-18T14:14:57.505Z`. Initialization is later than V3
deployment. No competing phase8 or phase9 driver ran.

Bitwig is 6.0.6, API 25, on macOS 15.8 arm64, with Azul Java 25. The jar hash
is `382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.
The [environment record](../data/phase9a-grid-read/environment-v4.json) has
source pins and hashes of the narrow local bytecode inspections. Vendor
bytecode is not part of these artifacts. No external implementation was
copied into the new value probe.

The project is `gn-grid-spike`, track `grid-probe`, channel
`c784d25c-b753-47ca-af8d-c83d11cfd990`, with Poly Grid at index 0. The track
is muted at -10 dB. The first UI check in this continuation showed active
device meters, stopped transport, and an unsaved project marker. This differs
from the prior inactive-engine observation. The semantic baseline still
matched the saved preset before any manual test. This continuation did not
start transport or change the engine state.

## Scoped discovery

[Contents schema](../data/phase9a-grid-read/live-03-contents-schema/capture-0.json)
found `module_grid` at child index 7 of property 173. The
[Grid schema](../data/phase9a-grid-read/live-04-grid-schema/capture-0.json)
found four modules in property 6428, `auxiliary_devices`. This relationship
is excluded by the file serializer. It is an explicit live projection.

The saved query files and paired schema captures `live-03` through `live-22`
record each step. They inspect one object's descriptors and immediate child
headers. They do not evaluate arbitrary getters or recursively walk the DSP
implementation. The [semantic query](../data/phase9a-grid-read/semantic-query.json)
selects the measured fields. Unknown selected fields or values still fail.
The DSP code, UI panels, colors, engine helpers, and internal DSP wiring are
outside this semantic projection. It is not a device serializer.

| Object | Observed fields |
|---|---|
| `module_grid` | 6428: modules |
| `module` | 15: instance UUID; 404: name; 406: contents; 6679/6680: x/y; 6977: active |
| `module_contents` | 6369: type UUID; 6370: name; 173: component atoms |
| Value atoms | Preset identifier, stored value, and GUI value; decimal 712, boolean 210, integer 828, indexed 457 |
| `audio_source_atom` | 3640: output port identifier |
| `audio_destination_atom` | 7124: input port identifier; 7125: source atom reference |

The source reference on a destination points to the actual source atom.
The capture identity map resolves that same atom under its owning module.
This establishes direction without using list adjacency or module names.

## Read gate evidence

| Stage | Evidence and result |
|---|---|
| Baseline | [live-23](../data/phase9a-grid-read/live-23-semantic-baseline/capture-0.json): 53 nodes; 4 modules; 2 directed cables; complete; equal paired reads |
| Manual delta | [live-24](../data/phase9a-grid-read/live-24-manual-value/capture-0.json): disconnected Amplify UI changed from 50% to 60%; only its 712 and 949 values changed |
| Restore | [live-25](../data/phase9a-grid-read/live-25-value-restored/capture-0.json): UI restored to 50%; exact baseline nodes restored |
| Other selection | [live-26](../data/phase9a-grid-read/live-26-other-device-selected/capture-0.json): temporary Tool selected on FX 1; Grid nodes unchanged; mixer selection stayed on channel `0c4835e2…` |
| Save | [live-27](../data/phase9a-grid-read/live-27-before-reload/capture-0.json): Tool insertion undone; FX 1 name and empty device chain restored; grid-probe selected; project saved |
| Reload | [live-28](../data/phase9a-grid-read/live-28-after-reload/capture-0.json): project closed and reopened by exact path; fresh epoch; semantic content equal; module UUIDs and managed object IDs changed |
| Outer identity | [live-29](../data/phase9a-grid-read/live-29-host-identity/capture-0.json): UUID remains `e3aebd87-3e23-4de1-8d96-da410b00d77d` |

The UI showed Sine -> Amplify 25% -> Audio Out and a disconnected Amplify
below. It showed 60% after the manual change. All reflected stored values
match [the preset parser result](../data/phase9a-grid-read/preset-baseline.json).
The three observed Amplify display/native pairs are 25% / 0.6299605249474366,
50% / 0.7937005259840998, and 60% / 0.8434326653017492. These observations do
not define a general display conversion. The next write uses the exact
observed native pair, not a normalized 0–1 assumption.

`read_semantics.py` derives the result from raw references and values. Its
comparison checks every saved scalar parameter, input port, module type,
position, and directed cable. Nine offline tests check baseline, delta,
restore, selection, reload, and rejection of incomplete graphs, duplicate
identity, missing fields, external sources, and incorrect cable direction.

The [saved project hash](../data/phase9a-grid-read/live-27-before-reload/files.json)
is `7a53a705b385e1c3912963b181bf75217a7b19cc6f55fef14fe89362d048e8ee`
(33,682 bytes). The baseline preset is unchanged:
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
Every read epoch was released. The other open project, `gn-scale-test`, still
had its original unsaved marker. This continuation did not save or modify it.

## Command discovery and V4

The local bytecode gives the following candidates. None has run through this
probe. There is no live CRUD verdict from these symbols alone.

| Operation | Candidate and limit |
|---|---|
| Native parameter update | `ParameterValueTarget.setCurrentValue(double)` calls `HHL.kyi(double)`. On `tqm`, public final `ccA.kyi(double)` dispatches to `bcf.eOi(double)`. It opens an edit, clamps against `rNl` bounds, sets through `d_(double)`, then closes the edit with `hoE()`. V4 uses this exact path. |
| Cable connect/disconnect | Public `UL.ffA(a)` dispatches to `xts.eOi(a)`, with connect/disconnect operation labels and edit begin/end. Null selects disconnect. Port compatibility, notifications, and failure recovery still need proof. |
| Module insertion | `gOr.ffA(String, int, int, ITE)` loads modules and invokes an insertion callback. The string input, factory ownership, completion contract, and error path remain unclassified. |
| Layout | `DbL.ffA(int,int)` and `DbL.eOi(int,int)` update grid fields and placement. Their intended transaction boundary still needs proof. |
| Module deletion | `DbL.bm_()` reaches the parent Grid and closes an edit. Incident-cable cleanup and the correct caller remain unproved. |

V4 adds `probe.gridValue`. The normal profile excludes it. The existing
`probe.gridRead` still has no write operation. The new method accepts only
the fourth module, with the exact Amplify type, position (-1,0), active and
unipolar state, no input cable, and no output consumer. It requires the
current module UUID, current value, fresh bound epoch, and exact 53-node
expected graph. It admits only 50% -> 60% or the reverse, using the observed
native values. It rechecks project, track, device, and document identity.

The command uses the existing document queue. It refuses a task that reaches
the mutation point more than four seconds after queueing. A timeout poisons
the handler until reload. Error messages state whether the setter was entered;
that flag is not a success claim. There is no automatic write retry. A return
reports `command-returned; fresh read required`. The driver then makes two
fresh reads and checks the exact value delta and all other projected nodes.
The returned pre-write graph is not called readback. An error after setter
entry requires inspection before another write.

The V4 driver `value` mode performs one change only. Observe its UI result,
then use a new invocation to restore 50%. If a command or readback fails,
inspect the saved result and UI first. Restore through the known UI route if
needed. Do not infer an atomic failure or repeat an uncertain write.

## Cost and verification

[V3 measurements](../data/phase9a-grid-read/v3-measurements.json) include all
12 semantic captures. Each uses 53 nodes, 278 graph steps, and 1,606 shared
query work units, plus the separately bounded final route check. Each complete
workflow uses 15 sequential wire calls: entry and route checks, bind, two
captures, selection check, and release. The capture itself uses one wire
request and asynchronous document/completion scheduling. This fits the planned
four-turn capture target. Wire time is 43.599–50.752 ms; document work is 4.806–14.228 ms. The first
projection took 14.228 ms; later document tasks took 4.806–8.983 ms. Graphs
are 35,828–35,831 bytes. Heap samples change by 0 or 2 MiB. V2 took
48.016 ms on the wire for an incomplete DSP walk. Wire time did not regress
by 20 percent. The cold document task grew by more than 20 percent because
V3 adds explicit navigation and per-class field scans. Later repeated tasks
bound that cost on this fixture. The exact per-call times are retained.

V4 adds one bounded pre-write graph capture and one mutation stage in its
write request. The driver adds that request and two independent reads: 18
wire calls for one guarded change including setup and release. Budget about
144 ms additional transport and up to 8 MiB temporary capture memory. This
is a plan, not a measurement. V4 must repeat the live measurement after
replacement. No product call budget changes. The 16-module/24-cable case and
peak or retained heap remain unmeasured; the 4,096-work cap can refuse it.

Checks: extension `gridReadTest`, `check`, normal/probe archives and profile
verification pass; TypeScript typecheck passes; 236 focused wire-map, adapter,
and call-budget tests pass; nine semantic tests pass. The write tests use the
captured fixture and refuse wrong UUIDs, changed snapshots, changed values,
connected inputs/outputs, moved modules, bipolar mode, and invalid inputs.
[Verification](../data/phase9a-grid-read/verification-v4.json) records the results.
Descriptions remain v52 (44 public tools). No public description changed.

## Next live step

The [V4 deployment record](../data/phase9a-grid-read/deployment-v4.json) identifies
the archive. The research profile has 113 methods, hash `0bf393706e47e7ed`,
and marker `9a-grid-value-v4`. Wait for operator replacement, then run
`npm run probe:hello` from `brain/`. Require this profile, count, hash, marker,
and an initialization later than deployment. A toggle is not a replacement.

From `brain/`, use the absolute project and preset paths in the saved file
record and an unused absolute output directory:

```sh
node --import tsx src/probes/phase9a-grid-read.ts project <project> <preset> <output> <semantic-query.json>
node --import tsx src/probes/phase9a-grid-read.ts value <project> <preset> <output-60> <semantic-query.json> 60
# Inspect the UI for 60%, then restore in a separate call.
node --import tsx src/probes/phase9a-grid-read.ts value <project> <preset> <output-50> <semantic-query.json> 50
```

Continue the [9a plan](../../plan/phase-9/9a-live-grid-editing-spike.md) only
from the measured outcome. The read gate passes on this fixture. Module
C/U/D, cable C/U/D, internal-write readback, engine adoption, edited-state
persistence, and internal-write recovery are not attempted. V4 remains the
research deployment; the normal profile has not been restored.

## Retrospective

Inspect one schema and its immediate child headers before following a
relationship. This found the module container without another full DSP walk.
Test reload identity before designing handles: the module UUIDs changed even
though the outer device UUID did not. Keep this distinction in the write guards.

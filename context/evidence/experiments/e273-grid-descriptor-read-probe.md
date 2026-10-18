---
title: E273 — Grid descriptor read probe preparation
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E273 — Grid descriptor read probe preparation

## Status

Continuation: [E274](e274-grid-root-read-and-contents-bridge.md) records the
V1 live result and the V2 contents bridge. The preparation state below is
historical. Use E274 and NOW for the current deployment and next step.

[9a](../../plan/phase-9/9a-live-grid-editing-spike.md) is active. The first
read probe is built, tested offline, and deployed. Operator replacement and
the saved disposable fixture are pending. No internal live read or write has
run. A source inspection is not a live access verdict.

The normal 8i15 controller passed the entry hello. The entry project was
`gn-scale-test`, with 12 tracks and 10 scenes. It has a `Poly Grid` track at
index 9, channel ID `a61f595f-34a7-433e-a115-bffc577d164a`, selected in the
mixer. This differs from the old 11-track baseline. No change was made to it.
The slot selection has an old `lie sword` project tag and is not a current
slot selection. See the [entry state](../data/phase9a-grid-read/entry-state.json).

## Environment and sources

- Host: Bitwig Studio 6.0.6, bundle version 6.0.6, API 25. Live Java: Azul 25.
- OS: macOS 15.8, arm64. Build JDK and javap: Temurin 26.0.1.
- Installed `bitwig.jar` SHA-256:
  `382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.
- Reference root: `/Users/jonvuri/Development/ghostnote/reference`. This
  worktree does not have the untracked clones. No clone was changed.
- openwig: `d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d`, clean.
- bwpreset: `202bf50c31ac551f1e5d345bab5a39c1bed32a12`, clean.
- Control Deck: `45933855dcbfd1bd130beea18dd3f02bf794a838`, clean.

The [environment record](../data/phase9a-grid-read/environment.json) has the
class inspection hashes. Reproduce from the repository root:

```sh
python3 tools/grid-spike/inspect_host.py --bytecode-dir /tmp/gn9a-bytecode-new
```

The script refuses another jar hash. It inspects 17 named classes, with a
60-second deadline for each javap process. The optional output directory must
be new. Keep bytecode, vendor jars, keys, and extracted definitions out of Git.

Provenance: openwig's `_walkObj`, `_runOnDocumentThread`, and default symbol
file supplied research leads. openwig is GPL-3.0-or-later. Its implementation
was not copied or translated into this patch. The Java reader was written
from the inspected host signatures and serializer bytecode. It uses a flat
graph, exact typed methods, indexed children, a Java identity map, and strict
failure reporting. No GPL source or symbol file is bundled. bwpreset is MIT;
its model constants were read as comparison leads. No parser code was copied.
No external license compatibility conclusion is claimed.

## Narrow symbol path

openwig's default obfuscated names do not match this jar. The installed
serializer provides the following path:

| Role | Installed symbol and inspection |
|---|---|
| Device target | `ControlSurfaceProxy.getDeepestTarget()` resolves the deepest proxy, then returns its target |
| Document identity | `ControlSurfaceDocumentObjectProxy.getDocument()` |
| Document queue | `ControlSurfaceObject.exec(Runnable)` posts a document event; it must start on the control-surface thread |
| Thread check | `ControlSurfaceObject.isDocumentThread()` |
| Object descriptor | `HEV.mW_(): cYx` |
| Class and property names | `cXZ.lSJ(): String`, a field getter |
| Class ID | `cXV.pea(): int`, a field getter |
| Property list | `cXV.ciZ(): List`, the `cYF[]` view used by the serializer |
| Property ID | `cYs.QiZ(): int` |
| Serialization gate | `cYF.nM_()` and `vWM.cG3.ffA(cYF, HEV)`; no fallback |
| Scalar value | `cYF.eOi(HEV): Object` |
| Relationship count and child | `cYH.wi2(HEV): int`, `cYH.eOi(HEV, int): FZ1` |

The serializer's property loop calls `nM_`, then the filter, then the property
serializer. `vWM.cG3` uses `serial.WAr`, which excludes `cYF.eJS()` properties.
The indexed relationship getters avoid a complete child-list allocation.
No unknown getter scan, native command, setter, factory, or file serializer
was invoked. Descriptor names are a source finding; the live schema and Grid
field meanings remain unproved.

## Probe boundary

`probe.gridRead` is research-only. Operations are `bind`, `read`, and
`release`. The request must name project `gn-grid-spike`, track `grid-probe`,
its channel ID, a top-level device index, and device name `Poly Grid`.
The driver points an existing owned track cursor. It does not change project
content or select a Grid in the editor.

A bind returns a random epoch. It keeps weak references to the actual document,
track, and host-device objects. A read requires the same epoch, route, and
objects. It checks object identity on the document thread before and after
capture, then checks the public target again on the controller thread. It
keeps no module handles. Each capture uses `IdentityHashMap`, not an identity
hash, to assign distinct local IDs to equal or repeated objects. IDs do not
survive a capture or reload.

The graph has raw class/property IDs and names, typed scalar values, and
directed parent-child references. Integer values are decimal strings to retain
64-bit precision. Parameter domains are `unknown`. A relationship reference
is not yet a semantic cable endpoint. The module/cable interpretation must
come from the fixture comparisons.

Bounds: depth 12; 4,096 work units, including nodes, properties, relationship
entries, and array entries; 1 MiB encoded graph; 4,096 characters per string;
256 array entries; 32,768 scalar characters per property. The reader stops at
16 errors. Error messages have an 80-character bound. Unknown objects, binary
values, nonfinite numbers, filter failures, and limits make the capture
incomplete. There is a one-second cooperative walk deadline. An individual
host getter cannot be preempted. A five-second asynchronous deadline gives one
failure, invalidates the epoch, and prevents another request until reload.
A late result cannot report success after timeout.

## Reproduction and next live gate

The deployed archive is recorded in
[deployment.json](../data/phase9a-grid-read/deployment.json). SHA-256:
`713c6cc79bab0e2981ecbc489833ea8993522f0dd1e8714200c0206767e188fa`.
Expected profile: `phase-8-probe-v1`; 112 methods; hash
`1632f304f2cdb820`; marker `gridReadProbe: 9a-grid-read-v1`.
The normal method table stays at 92 methods, `8be1975eaa99d78f`.
Descriptions stay v52, 44 tools. No public tool description changed.

The operator must fully remove the old controller and add the final matching
`ghostnote probe` product in the complete list. Wait for confirmation. Then,
from `brain/`, run `npm run probe:hello`. It checks the new marker, profile,
method table, and initialization time. Do not use a power toggle or the orange
detected-controller button as a reload.

Prepare and save the fixture in the plan: one Poly Grid, at most 8 modules
and 12 cables, duplicate types with distinct values and positions, and a spare
compatible cable destination. Save a baseline preset. Record exact UI module,
port, value, position, and cable observations before capture. Then run:

```sh
node --import tsx src/probes/phase9a-grid-read.ts state
node --import tsx src/probes/phase9a-grid-read.ts capture /absolute/fixture.bwproject /absolute/baseline.bwpreset /absolute/new-capture-directory
```

The driver checks the exact build and project, hashes both files, binds one
host device, and captures twice. It saves each raw result before it checks
completeness. An incomplete capture stops the driver. Equal raw graphs do not
pass the semantic gate. Next compare with UI and bwpreset, make one manual
scalar change, restore it, repeat after a selection change, and reacquire
after save/reload. Continue to command discovery only if every read criterion
in the plan passes. These steps remain in 9a; they are not a new product plan.

## Cost and verification

The plan's initial cost model applies to both admitted fixture sizes. The
implementation adds a separate bind before capture: one wire call with a
document task and a controller completion. Each later capture is one wire
call with those same two queued tasks, one cold read, and no write stage.
Release is one wire call. The driver records all wire calls, bytes, queue time,
document time, completion time, and before/after process heap. Process heap
samples are not an allocation peak or retained-heap measurement.

The separate bind costs one more wire call than a combined acquire/read path.
This makes the observed host-object identity explicit before the first graph
read. The ledger's 24 ms wire turn does not bound document scheduling. Keep
the four-turn capture target and 8 MiB heap estimate as unmeasured budgets.
No live timing or largest-fixture result is claimed. No product call budget
changed; no regression percentage can yet be calculated.

Offline checks: the extension build, archive registration checks, 20 existing
clip-reader test groups, and the new Grid harness pass. The Grid harness covers
distinct equal objects, repeated references, cycles, fresh scalar reads,
work/depth/byte/string/array limits, unknown values, filter and child failures,
stale document/track/device/epoch inputs, queue failure, read failure, timeout,
late completion, and profile isolation. Brain typecheck passes. The focused
wire, live-adapter, and call-budget cohort passes 236/236. Context validation
and `git diff --check` pass. See the
[verification record](../data/phase9a-grid-read/verification.json).

## Verdicts

| Dimension | Current verdict |
|---|---|
| Java access to the live target | Not attempted; bytecode path located |
| Module read and cable read | Not attempted |
| Module create, parameter/layout update, delete | Not attempted |
| Cable create, retarget, delete | Not attempted |
| Independent semantic readback | Not attempted |
| Engine adoption | Not attempted |
| Save/reload persistence | Not attempted |
| Recovery and baseline restoration | Not attempted; no live mutation |

The probe archive remains deployed. Controller replacement is unconfirmed.
The fixture files and UI baseline are not yet supplied. No capability record
is promoted by these offline results.

## Retrospective

The worktree has no reference clones or installed Node dependencies. Record
the external reference root in the plan, and use the lockfile with the local
package cache. Inspect the current serializer bytecode before trying bootstrap
names; that resolved this build without a speculative live getter scan.

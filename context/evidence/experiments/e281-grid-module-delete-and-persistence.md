---
title: E281 — Grid module deletion and persistence
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E281 — Grid module deletion and persistence

## Result

V7 deletes the spare Amplify through the native host command. Two isolated
and two connected deletion calls pass exact paired readback. A connected
deletion removes the incoming cable with the module. One undo restores both;
one redo removes both. The original three-module path and all other projected
fields remain equal. The deletion survives save/reload. The exact saved
baseline project bytes are restored, then reopened and verified against the
unchanged preset. The outer device identity is unchanged.

This completes the deletion gate in
[9a](../../plan/phase-9/9a-live-grid-editing-spike.md). The spike continues
with module creation. The engine stayed inactive. No outgoing consumer,
failed command, arbitrary module, layout write, or DSP adoption was tested.
No factory or insertion command was invoked. No new archive was built in
this continuation; V7 remains loaded.

## Entry and preservation

The operator confirmed controller replacement. `npm run probe:hello` passed:
`phase-8-probe-v1`, 115 methods, hash `252339a249e3a8ae`, and deliberate marker
`9a-grid-delete-v7`. Initialization was `2026-10-18T15:59:11.505Z`, after the
[E280 deployment](../data/phase9a-grid-retarget/deployment-v7.json).
The [hello record](../data/phase9a-grid-delete/hello-v7-summary.json) retains
the checks. No competing phase8 or phase9 driver was found. All live drivers
ran in one foreground sequence.

The project and `/tmp/gn-grid-spike-e280-baseline.bwproject` had the same
verified SHA-256 before the first write. The fixture tab was already starred
after controller replacement. Track `grid-probe` was muted at -10 dB and
armed. Transport was stopped at 1.1.1.00; the engine was inactive. All driver
runs checked project, selection, current module identities, and saved file
hashes. All epochs were released. The other open `gn-scale-test` project kept
its prior unsaved marker; it was not edited or saved.

## Live sequence

Data: [phase9a-grid-delete](../data/phase9a-grid-delete/).
The [UI witness](../data/phase9a-grid-delete/ui-witness-v7.json) separates
visual observations from keyboard actions checked by graph reads.
`python3 -B tools/grid-spike/verify_delete_evidence.py` reproduces the
[measurements](../data/phase9a-grid-delete/v7-measurements.json). It checks
exact raw deltas, semantics, undo/redo, edited reload, baseline file equality,
selection, deployment markers, outer identity, and call counts.

| Capture | Operation and result |
|---|---|
| `live-72-baseline` | Two equal reads match the saved preset. |
| `live-73-delete-isolated` | Delete the disconnected spare. Exact after reads and UI agree. |
| `live-74-undo-isolated` | One undo restores the exact 53-node graph, including UUIDs. |
| `live-75-redo-isolated` | One redo restores the exact 45-node graph. |
| `live-76-delete-isolated-repeat` | Undo, then repeat deletion for timing. Before and after reads pass. |
| `live-77-connect` | Undo deletion, then connect Sine OUT to spare Amplify IN. Reads and UI pass. |
| `live-78-delete-connected` | Native deletion removes spare and incoming cable together. Original path remains. |
| `live-79-undo-connected` | One undo restores the exact connected graph. |
| `live-80-redo-connected` | One redo restores the exact deleted graph. |
| `live-81-delete-connected-repeat` | Undo, then repeat connected deletion for timing. |
| `live-82-saved-deletion` | Save three-module state. Fixture tab is unstarred. |
| `live-83-reloaded-deletion` | Reopen saved state. All projected semantics persist; module UUIDs change. |
| `live-84-restored-baseline` | Close fixture, restore verified backup bytes, reopen. Two reads match preset. |
| `live-85-outer-identity` | Two reads equal E277's final outer identity capture. |
| `live-86-read-repeat` | Two further baseline reads agree; matched timing passes. |

Each deletion removes exactly eight projected nodes: the spare module, its
contents, and six atoms. Grid membership changes from four to three entries.
The other 45 nodes remain equal. The connected input is owned by the deleted
module; this does not test cleanup of cables to other destination modules.

The saved deleted project had 33,022 bytes and SHA-256
`fc44f631c2d1bfe71cb8a9958142802d94a9606cce931823b6c555a0d28ea2e6`.
The [restore record](../data/phase9a-grid-delete/baseline-restore.json) proves
that only the closed fixture file was restored. Its final 34,128 bytes have
SHA-256 `af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`,
exactly equal to entry. The preset remains 10,451 bytes with SHA-256
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
Outer Poly Grid UUID remains `e3aebd87-3e23-4de1-8d96-da410b00d77d`.
The final UI shows the four-module baseline with 25% and 50% Amplify values.

## Cost

| Deletion | Wire time | Document time |
|---|---:|---:|
| First isolated | 70.793 ms | 28.300 ms |
| Isolated repeat | 48.489 ms | 14.844 ms |
| First connected | 43.753 ms | 9.274 ms |
| Connected repeat | 47.189 ms | 10.309 ms |

All five write workflows, including cable setup, use 18 calls. Summed wire
time is 541.234–604.460 ms, plus 150 ms explicit settlement. The plan was
about 550 ms plus settlement. The first deletion is 49% slower on the wire
and 84% slower on the document thread than V6's respective write maxima.
Deletion performs a native ownership removal and reference cleanup, rather
than one cable setter. Cold class/JVM work can also contribute; this run does
not isolate its share. Both matched repeats return below V6's document-time
maximum and within 2% of its wire maximum. Retain the first cost as a limit.

Thirty-eight semantic reads take 45.806–89.029 ms wire and 0.951–6.109 ms
document time. The first deletion's first after read accounts for the wire
outlier: 50.456 ms queue wait, 6.109 ms document work, and 67.166 ms total
completion. This is 76% above V6's read maximum. The isolated deletion repeat
and the final read repeat do not reproduce it. Final reads take 48.081 and
48.405 ms wire, with about 0.12 ms queue wait. The queue delay is measured;
its upstream cause is not established.

Graphs have 45 or 53 nodes, 30,217–35,829 encoded bytes, 235–279 graph steps,
and 1,379–1,607 query steps. Deletion command captures retain the 53-node
before graph. Heap samples rise 4 MiB per delete, within the 8 MiB plan;
reads sample 0–2 MiB. These are heap samples, not peak or retained heap.
The engine was inactive. Product call budgets do not change.

## Module creation source trace

The [host inspection](../data/phase9a-grid-delete/environment-factory-trace.json)
records the unchanged jar hash, clone revisions, and added class fingerprints.
`tools/grid-spike/inspect_host.py` now reproduces this fixed symbol set.
Vendor bytecode stays in temporary files. No vendor definitions or bytecode
are added to the repository.

The trace extends [E280](e280-grid-retarget-and-module-delete-probe.md):

- `DbL.pvN(UUID)` requests module contents from `Lqu.asI()` / `xQx.ffA(UUID)`,
  then calls `DbL.ffA(Wxc)`. It is a real type factory candidate. The string
  insertion overload remains a file loader; it does not accept a type UUID.
- `xQx` enables copying in its `JtC` constructor. Both its UUID cache-hit path
  and the file-load path call `JtC.eOi(Object)`. That method calls
  `HEV.ffA(WAr.Uhv)`, then `oQq.ffA(copy)`. `Buu` performs the descriptor copy;
  `oQq` visits the copy and calls `IYr.bg_()` on applicable members. Thus the
  factory requests a copy of cached contents, rather than direct ownership
  of the cached template. The live ownership and defaults still need proof.
- The cold path resolves the UUID to a file, checks file metadata, synchronizes
  per file, parses `Wxc`, and stores the template. Factory latency therefore
  can include blocking file I/O and cache synchronization. No cache was
  cleared and no cold-factory measurement was made.
- `DbL.ffA(Wxc)` allocates a module, assigns a random instance UUID, installs
  contents and name, sets dimensions from the first layout, sets initial size
  fields, then calls `G_()`. Initialization reaches `OEf.ao_()`, which binds
  internal helpers. Returning a Java object alone is not an initialization
  or live-attachment proof.
- The module's disposal path reaches `DHY.dC_()`, which removes per-object
  map entries, then `HEV.dC_()`. The latter handles ownership teardown,
  recursively disposes owned children, and marks the object disposed.
  Contents also have `Ymq`, `vWM`, and `pyQ` disposal overrides. Disposal
  must target only a proved detached factory result. It must never target
  a live module or cached template.
- The examined factory wrapper and `Buu` copy path do not supply a general
  rollback contract for a failure during initialization. A factory that
  throws before returning provides no result handle for caller cleanup.
  This remains a limit to address in the detached probe design.

The next selected work is a bounded factory lifecycle probe, then native
collection attachment only if that gate passes. The plan specifies its
scope, costs, failure reporting, readback, and acceptance. No V8 implementation
or deployment is claimed by this record.

## Verification and retrospective

The [verification record](../data/phase9a-grid-delete/verification-v7-live.json)
records the live checks, parser tests, evidence verifiers, context validation,
and diff checks. V7 implementation checks remain in E280. No public tool or
description changed: descriptions remain v52, with 44 tools. Normal methods
remain 92, hash `8be1975eaa99d78f`; the normal profile is not restored.

Retrospective: the exact project backup made destructive persistence testing
reversible after undo history was lost on reload. Keep that step in later
module tests. For factory work, trace initialization and disposal together;
a type constructor signature alone is not a sufficient probe contract.

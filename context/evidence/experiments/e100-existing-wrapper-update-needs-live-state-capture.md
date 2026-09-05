---
title: E100 — existing-wrapper update needs complete live state capture
kind: evidence
state: active
updated: 2026-09-05
parent: ../../plan/phase-5/5x-existing-wrapper-update-operation.md
---

# E100 — existing-wrapper update needs complete live state capture

## Verdict

Ghostnote cannot expose an honest existing-wrapper update operation with the
current host API. It can rebuild an owned wrapper and keep the nested device
instance. It cannot prove that the rebuild preserves all prior wrapper state.

The missing capability is one complete current-state source. This can be a live
preset export or an equivalent API that reads and edits every modulator object,
route, amount, setting, and opaque companion state.

## State inventory

| Source | State available | State absent |
|---|---|---|
| Wrapper checkpoint version 1 | Track, container and entry names, positions, insertion change, original device order, enabled state, and nested device parameter fingerprint | Modulator inventory, routes, amounts, grid positions, settings, source artifact, and final revision mark |
| Live container inventory | Parent-child structure, entry name, nested device name and enabled state | Modulator objects, route graph, amounts, grid positions, hidden settings, and opaque state |
| Remote pages | Page names and the controls that the host exposes | Complete object identity, route targets, modulation amounts, hidden settings, and a proof that all state is exposed |
| Nested parameter reads | Complete observed DirectParameter base fingerprint for the existing device | Wrapper modulator state and plug-in opaque bytes |
| Original composition request | Requested type, target, and amount during the original call | Later operator edits and a complete live snapshot; the checkpoint does not retain the request |
| Temporary composed preset | Exact authored bytes before the first load | Current live state; the workflow deletes the file after insertion |

Remote pages and parameter samples can prove selected behavior. They cannot
reconstruct the preset object stream. A matching page name does not prove a
matching route, amount, grid pair, or hidden setting.

## Candidate strategies

| Strategy | Host and API feasibility | Code and migration estimate | Fidelity | Rollback, selection, and recovery | Decision |
|---|---|---|---|---|---|
| Edit the current live wrapper | The API has no modulator create, replace, retarget, amount, or delete operations. | Host capability work is required. Repository scope cannot close it. | Cannot start. | No project mutation is available. | Refuse. |
| Retain an owned source artifact and reload it | Ghostnote can retain and edit the bytes it authored. It cannot merge later live edits into those bytes. | Approximately two focused sessions after a complete state-capture API exists: checkpoint and artifact persistence, then guarded load and live proof. Existing version 1 checkpoints need refusal. | Exact only for the retained original artifact. It is not exact for the current live wrapper. | Reload replaces the container. It needs the 5u settlement policy and one 5w selection scope. Recovery must keep the old container until the new one passes. | Unsafe with the current API. |
| Perform one guarded rebuild | Device relocation can keep the nested device instance and its observed scalar fingerprint. A new wrapper can reproduce recorded requests. | Approximately three to five engineering days for a version 2 checkpoint, staged relocation, recovery, reversal, tests, and live proof. | It cannot detect or preserve an unobserved operator edit to the old wrapper. | The old container can remain until the new wrapper passes. Failure after extraction can keep the device top-level or in one proved container. This does not repair state fidelity. | Mechanically feasible but not a safe update. |
| Refuse wrappers without enough provenance | A session-issued version 2 checkpoint can bind retained bytes and requests. | Less than one day for the refusal alone. | It protects version 1 wrappers. It cannot prove that a version 2 live wrapper still matches retained bytes. | Refusal occurs before mutation and has no selection cost. | Required later, but insufficient alone. |

## Verb boundary

Add, replace, retarget, amount, and delete have the same safety boundary. Each
changes state in the live wrapper object stream. The host exposes no complete
current object stream to edit and no complete live state to compare after a
rebuild. A narrower add-only name would not make the preservation claim true.

## Required future contract

A future update operation must first obtain one complete current wrapper
artifact or equivalent state model. It must fingerprint that state before any
mutation and include the fingerprint in a new checkpoint version. It can then:

1. Apply one explicit edit to the captured state.
2. Load a candidate wrapper without removing the current wrapper.
3. Prove the before and after inventories, retained settings, routes, grid
   positions, nested device identity, and scalar fingerprint.
4. Move the same nested device only after the candidate wrapper passes its
   empty-state checks.
5. Remove the old wrapper only after the complete new witness passes.
6. Return one recovery checkpoint for every applied stage.

Version 1 checkpoints must refuse before mutation. The operation must use the
5u settlement policy and one 5w selection scope. It must use the 5v normalized,
displayed, discrete, and semantic value distinctions.

## Result

No code or public schema changed. The correct current action is to keep
`wrap_existing_device_modulation` and its guarded reversal, and to refuse to
describe reverse-and-rebuild as an update.

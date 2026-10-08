---
title: Current state
kind: status
state: active
updated: 2026-10-08
phase: phase-8-agent-native-live-engine
session: 8h4f-next
---

# Now

8h4a through 8h4e are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md)–[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
[E235](evidence/experiments/e235-document-read-and-identity-registry.md),
[E245](evidence/experiments/e245-document-read-compactness-and-gain.md),
[E236](evidence/experiments/e236-document-edit-limb.md),
[E246](evidence/experiments/e246-edit-cost-and-reader-heap.md),
[E237](evidence/experiments/e237-musical-and-clip-surface-migration.md),
[E244](evidence/experiments/e244-direct-parameter-display-observer.md),
[E238](evidence/experiments/e238-device-structure-migration.md)).
`agent-native-v1` lists 41 tools. It has no device-alternate lifecycle:
`read_devices`, `compose_devices`, and five layer-chain limbs replace it (D18),
and the A/B and collapse recipes pass live. `stable-v1` is unchanged. The next
session is [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md).

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) and
   8h4a2–8h4a5: complete (E234, E240–E243; D33, D34).
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md) and
   [8h4b2](plan/phase-8/8h4b2-document-read-compactness-and-gain.md):
   complete (E235, E245; D35).
3. [8h4c](plan/phase-8/8h4c-document-edit-limb.md) and
   [8h4c2](plan/phase-8/8h4c2-edit-cost-and-reader-heap.md): complete (E236,
   E246; D36–D38).
4. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): complete
   (E237, D39).
5. [8h4e0](plan/phase-8/8h4e0-direct-parameter-display-probe.md) and
   [8h4e](plan/phase-8/8h4e-device-structure-migration.md): complete (E244,
   E238).
6. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): next.
   Track-kind arms, the default profile cut, and measurements.
7. [8h4g](plan/phase-8/8h4g-performance-review-and-closeout.md): performance
   review of every path, then the 8h closeout.

## What 8h4e gives the next sessions

- `brain/src/surface/agent-native-devices.ts` builds the device tools from
  the stable specs (`agentNativeDeviceTools`): 12 additions and 5 in-place
  replacements (`set_device_enabled`, `wrap_existing_device_modulation`,
  `delete_device`, `revert_change`, `check_revert`).
  `AGENT_NATIVE_DEVICE_RETIRED` holds the 17 retired names. Each has a
  migration row.
- Schema text is per profile. `deviceControlSchemas`,
  `modulatorAuthoringSchemas`, and `existingDeviceModulationWrapperSchemas`
  take the tool names. The `stable-v1` text must not change. A retained tool
  whose schema names a retired tool needs an agent-native copy.
- `compose_devices` selects a private backend (`compositionBackend`). For the
  benchmark, `composeDevices(..., { backend })` forces one backend.
- New contract pieces:
  - the op `chain.solo` and its proof `verifyChainSolo`;
  - the read option `ReadOptions.structure` (no parameter inventory);
  - the `DeviceState` fields `paramsDisplayComplete` and `isPlugin`.
- Normal profile: 89 methods, `0ef817f4bac8a8a7` (new: `chain.setSolo`).
  Probe profile: 106 methods, `582a1fa5cab5e3fb`. The older probe drivers
  (8h4a5, 8h4b, 8h4e0) still check 88 and 105, because they record past
  runs.
- Live adapter:
  - `containerScope` skips the named-slot descent for a layer container.
  - After a delete of the device under the cursor, the adapter recovers the
    stranded device cursor with a hop to another listed track. In a project
    with no other pointable track, the read stays `unstable`; that case is
    not measured live.
  - `check_revert` on a `compose_devices` change ID runs the guards of the
    first reversal stage (`previewGeneralDeviceReversal`).
- Open for 8h4g:
  - A staged 4-chain `compose_devices` takes about 65 s, more than the 60 s
    client timeout, and the tool has no background route.
  - Each structural stage waits the fixed 4,000 ms `deviceInsert` budget.
  - `delete_device` of one container is about 100 wire calls.
  - A 281-ID plug-in read takes about 4 s.

  The ledger lists each of these.
- Tool descriptions are at v31 (`TOOL_DESCRIPTION_V31_SHA256`). v30 is
  frozen.
- The next free evidence number is E248 (E239 stays reserved for 8h4f, E247
  for 8h4g). The next decision is D40.
- Cost rules (AGENTS.md): read the
  [performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md), keep the
  call-budget tests current, and remeasure a changed live path.

## Live baseline

Normal `ghostnote` is loaded: archive SHA-256
`dee27f1edd2755bc55f26b297c1a41f457c389ea18dc12485cedfdb2e3a7d89c` (the
8h4e build), initialized at `2026-10-08T00:51:48.572Z`. A fresh hello passes
`normal-v1`, 89 methods, `0ef817f4bac8a8a7`. The 8h4e owned project ("New 5")
holds only the default tracks. The operator closes it without saving. The
active anchor is `gn-scale-test` with its 11 tracks
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
Rig config SHA-256:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Add the index row in the same session as a new E or D record. Start a live edit
matrix from a rewritten clip with a palette colour. Report note channels
1-based to the operator. `context/check.rb` needs `LANG=en_US.UTF-8`. Bitwig
cannot insert a scene above row 0. The first write after an operator scene
change can refuse in the cursor preflight (E3); retry once. Probe
`WireTransport` throws plain `Error`, not `BridgeError`. The fine writer
cursor window is 2,048 steps; page it with `cursor.scrollToStep`. Bitwig
reports note pressure as 0 (D37). The normal profile has no `transport.stop`;
a live launch leaves the transport playing for the operator to stop.
`check-publication-candidates.py --write` after a reviewed spec change.
For plug-in work, the operator turns the audio engine on in the owned project
(a CLAP plug-in lists no parameters with it off, E244).

Each wire call costs one control-surface turn (about 24 ms); count turns
when you estimate a live cost. `phase8h4c-edit.ts cost` prints executor
phases and wire calls. `phase8h4d-workflow.ts workflow` compares the two
profiles on one workflow. The Ghostnote revision does not count a person's
note edit (8h4a): it cannot guard a read that the executor reuses.

8h4e retrospective: the cost model treated a container read as about 4
turns, but the adapter moved into each empty named slot and retried 8 times
(3 s). Also, a parameter read after a device delete found a stranded cursor.
Neither showed in the fake adapter. Before the cost model is final, trace one
live call of each new path, also after a delete of the device under the
cursor. The 8h4d rule was correct, but a trace runs only on a route that the
plan names.

8h4d retrospective: trace one call of each new live path before the cost
model is final. Write the cost model at the start of the session.

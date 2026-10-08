---
title: E238 — Device structure migration
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8h4e
---

# E238 — Device structure migration

## Status

[8h4e](../../plan/phase-8/8h4e-device-structure-migration.md) is complete.
`agent-native-v1` lists 41 tools. It retires 17 more stable tools, and each
of them has a row in the
[migration contract](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).
The managed device-alternate lifecycle is not in its discovery. It adds 12
tools: `read_devices`, `read_device_controls`, `set_device_controls`,
`read_preset_modulation`, `edit_preset_modulation`, `add_devices`,
`compose_devices`, `duplicate_layer_chain`, `rename_layer_chain`,
`move_devices`, `copy_devices`, and `set_layer_chain_solo`. Five tools change
in place: `set_device_enabled`, `wrap_existing_device_modulation`,
`delete_device`, `revert_change`, and `check_revert`. `stable-v1` does not
change: its registration hash (53 tools) and the v25 artifact still reproduce.
Tool descriptions are at v31 (`TOOL_DESCRIPTION_V31_SHA256`).

The A/B audition recipe and the winner-collapse recipe pass live with the
generic limbs. The typed single-chain delete refuses before a write. In the
benchmark, the offline backend is 5 to 8 times faster than the staged backend.
The private backend boundary stays as D18 states it.

## Changes

1. **Surface** (`brain/src/surface/agent-native-devices.ts`). This file holds
   the new tools and the five tools that change in place. The vocabulary is
   `container`, `containerKind`, and `layer_chain` (D18). A route step into a
   layer chain is `through: 'layer-chain'`.
   - The parameter bodies move to `device-controls.ts`. Both profiles use
     them.
   - `modulator-authoring.ts`, `existing-device-modulation-wrapper.ts`, and
     `device-controls.ts` build their schemas from the tool names of one
     profile. The schema text of each profile names only the tools of that
     profile.
2. **`compose_devices`.** The tool selects one private backend:
   - offline: an Instrument Layer of 1–4 layer chains with one native device
     each, appended at position 2 or earlier, with no outer modulators. Each
     layer chain is renamed after the insertion. Only this path accepts
     `modulatorEdits`.
   - drum-machine: a Drum Machine request.
   - staged: all other requests.

   `revert_change` with the returned change ID runs the guarded staged
   reversal. `reverse_device_source_composition` is retired. `check_revert`
   reports the composition reversal.
3. **`delete_device`.** The result lists the layer chains of each container
   that it removes. An entry with `layerChain` refuses with code `unsupported`
   and reason `layer-chain-delete`, and it tells the agent to use computer
   control and then call `read_devices`.
4. **Layer-chain solo on and off.** The contract has a new op `chain.solo`,
   with the proof `verifyChainSolo`: the target has the new flag, and each
   sibling keeps its earlier flag. The extension has a new normal method
   `chain.setSolo`. The normal profile has 89 methods (`0ef817f4bac8a8a7`);
   the probe profile has 106 (`582a1fa5cab5e3fb`).
5. **Display text (E244).** `Rig` sets the listed IDs on the display observer
   when a `directparam.list` request sees a newly settled generation. The
   text counts only under the target stamp of that set
   (`DirectParameterDisplay`). The live adapter waits for `displayComplete`,
   for 4 extra polls at most, and then returns the parameters without
   `display` (`displayComplete: false`).
   - An empty ID list on a plug-in reads as standing `unavailable`.
   - CLAP callbacks in the form `CONTENTS/ROOT_GENERIC_MODULE/<id>` map to
     the listed ID. This applies to names, values, text, and the write
     completion.
6. **`ReadOptions.structure`.** A device read returns only the name and the
   container, and it reads no parameters.
7. **Live adapter fixes found by the live run** (see "Defects found live").

## Live runs

The runs used an owned unsaved project with the audio engine on. The normal
build is 89 methods, `0ef817f4bac8a8a7`, initialized at
`2026-10-08T00:51:48.572Z`. The driver is
`brain/src/probes/phase8h4e-devices.ts`. The data is in
[phase8h4e-devices](../data/phase8h4e-devices/). Each command made its own
track and deleted it.

### Recipes (`recipes.json`)

| Step | Tool | Wall time |
|---|---|---:|
| Compose A (Polysynth), B (Phase-4); offline | `compose_devices` | 7,199 ms |
| Structure read | `read_devices` | 460–495 ms (one container); 613–750 ms (two top-level devices after it) |
| Controls of a layer-chain device, display 55/55 and 103/103 | `read_device_controls` | 701–731 ms (same target: 712–714 ms) |
| One control write in a layer chain | `set_device_controls` | 2,324–2,398 ms |
| Solo A exclusive, B exclusive, A on, B off, A off | `set_layer_chain_solo` | 828–868 ms each |
| Solo B exclusive again (already set; no write) | `set_layer_chain_solo` | 182 ms |
| Copy B to "B copy" | `duplicate_layer_chain` | 5,199 ms |
| Rename "B copy" to C | `rename_layer_chain` | 953 ms |
| Delete one layer chain (refused before a write) | `delete_device` | 1 ms |
| Move the winner's device to the track end | `move_devices` | 5,957 ms |
| Delete the emptied container | `delete_device` | 3,132 ms |
| Restore the device to position 0 | `move_devices` | 5,366 ms |

A `read_devices` call after each step proved the solo flags, the layer-chain
names, and the device order. The final order is `[Phase-4, Tool]`.

### Composition benchmark (`benchmark.json`)

Two runs of each request. Each request appends one Instrument Layer to an
empty track, with layer chains L1–L4 that hold Polysynth, Phase-4, FM-4, and
Organ. Each composition was verified and then reverted with `revert_change`.
Each revert left an empty track.

| Request | Offline | Staged | Revert, offline | Revert, staged |
|---|---:|---:|---:|---:|
| 2 layer chains | 7,250–7,330 ms | 36,525–37,145 ms (9 stages) | 1,695–1,754 ms | 21,256–21,264 ms |
| 4 layer chains | 7,770–7,779 ms | 64,878–64,937 ms (17 stages) | 1,691–1,715 ms | 38,366–38,510 ms |

**Backend boundary.** The offline backend serves an Instrument Layer of one
through four layer chains, each with one native device and no outer
modulators, appended at position 2 or earlier. It is 5.0 times (2 chains) and
8.4 times (4 chains) faster, and its reversal removes one container. The staged
backend serves all other requests. The latency alone supports keeping the
offline backend.

The staged 4-chain request takes about 65 s, which is more than the 60 s MCP
client timeout (E45). `compose_devices` has no background route. 8h4g must
resolve this.

### CLAP (`clap.json`)

u-he Diva lists 281 IDs, and all 281 have display text (`displayComplete`).
A `set_device_controls` write on `CONTENTS/PID0` (0.37 to 0.75) verified with
the listed ID. Readback gives 0.75 and the text "150.00". The revert restored
the earlier value. This closes the inferred CLAP write defect of E244.

| Step | Wall time |
|---|---:|
| `read_device_controls`, new target and same target | 3,919–4,011 ms |
| `set_device_controls`, one write | 8,302 ms |

## Defects found live

1. **Empty-slot descent.** `containerScope` moved into the named slot of
   each container. An Instrument Layer has one named slot, FX, and it is
   empty. A move into an empty slot never settles, so each read retried 8
   times (about 3 s). Result: `read_devices` took 3.8 s and a solo took 16 s.
   - Fix: a container that already lists layer chains skips the descent, and
     layer-chain routes ask for no slot.
   - Effect: `read_devices` takes 0.5 s and a solo takes 0.85 s.
   - A slot address still refuses, because `slotsComplete` stays false.
2. **Stranded device cursor.** After the device under the cursor is deleted,
   `devcursor.status` reports no device. A `devcursor.selectAt` on the same
   track does not move it, and pointing at the same track again does nothing.
   This occurred with and without a display set. Moving the track cursor to
   another track and back recovers the cursor.
   - Before the fix, the staged reversal stopped at `reversal-boundary`, and
     every later parameter read on that track was `unstable`.
   - Fix: the adapter recovers only when a status that it already reads shows
     the stranded cursor. A normal read pays no extra call.

## Review fixes (offline)

A review found three P2 defects. Each one is fixed and has a regression test.
The tests fail on the earlier code.

1. **A refused backend write reported success.** `compose_devices` (Drum
   Machine, and the offline backend) did not check the recorded change.
   - Fix: a change that the revision guard refused whole is now
     `target-changed`, with no effect.
   - Fix: a Drum Machine that does not read back is now `unavailable`, with
     its effect.
2. **The composition preview skipped the guards.** `check_revert` always
   promised a reversal.
   - Fix: it runs `previewGeneralDeviceReversal`, which uses the same guards
     that `reverseGeneralDeviceSources` checks before its first write.
   - After an operator change, the preview reports `wouldWriteAnything:
     false` with `why`, and `revert_change` refuses at `reversal-boundary`.
   - Later reversal stages check their guards again.
3. **The cursor recovery assumed a second track.**
   - Fix: the hop tries the nearest other listed tracks, at most three. A
     track that the extension refuses goes to the next one. With no
     pointable track, the read stays `unstable`.
   - The live recovery is proved only with other tracks present. A one-track
     project is not measured live.

## Cost against the plan model

| Path | Model | Measured | Difference |
|---|---:|---:|---|
| `read_devices` | 100 ms | 460–750 ms | The top-level bank read re-points the track cursor and reads `device.list` twice (about 12 turns). The container read adds about 8 turns |
| `set_layer_chain_solo` | 150 ms | 828–868 ms | Two limb reads, plus the executor preflight and readback reads |
| `read_device_controls`, new target | +24 ms | +0 calls | The arm runs on the poll that the old loop needed anyway |
| `move_devices`, one device | 4.3 s | 5.4–6.0 s | Reads before and after the 4,000 ms stage |
| Offline composition | 5 s | 7.2–7.8 s | Insertion, verification, and layer-chain renames |
| Staged composition, 2 and 4 chains | 25–30 s; 45–50 s | 37 s; 65 s | Each stage waits the fixed 4,000 ms `deviceInsert` budget |

Offline call budgets (`call-budget.test.ts`):

| Path | Calls |
|---|---|
| `read_devices` | `devices` 1, `read` 1 |
| A solo or a rename | `read` 4, `apply` 1, `delta` 1 |
| A no-op solo | `read` 1 |
| A move | `devices` 2, `read` 4, `apply` 1, `delta` 1 |

## Restoration

Each driver command deleted its own track. The owned project holds only the
Bitwig default tracks. The operator closes it without saving.

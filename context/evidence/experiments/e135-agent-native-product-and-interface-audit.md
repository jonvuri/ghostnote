---
title: E135 — Independent agent-native interface comparison
kind: evidence
state: active
updated: 2026-09-25
parent: ../../plan/phase-8/8a-agent-native-product-and-interface-audit.md
---

# E135 — Independent agent-native interface comparison

## Verdict

Two independent 8a runs selected the same main product posture. Ghostnote is a
small set of semantic sensors and precise limbs for an agent that already owns
reasoning, vision, typing, and clicking. It is not a second planner, task memory,
or complete workstation abstraction.

The comparison found three material questions. Follow-up review settled them:

1. Do not use the first run's fixed 88-method normal-runtime target.
   `WIRE_METHODS_USED` also contains optional audio-capture and coupled
   observation methods. Session 8b must map every method to its host-object
   allocations before it removes a registration.
2. Defer the final clip-read name and single-clip or bounded-batch request shape
   to 8f. Keep the complete E131 route unchanged until cache promotion.
3. Retire the managed device-alternate lifecycle. Preserve its useful behavior
   as ordinary layer-chain reads and limbs. Keep the offline composer as a
   private `compose_devices` fast path.

The second and third findings change the target interface, not current product
behavior. The stable profile, E131 reader, and Phase 7b profile remain unchanged.

## Comparison

| Area | First 8a run | Independent 8a run | Settled result |
|---|---|---|---|
| Product posture | Sensors and limbs | Sensors and limbs | Adopt this posture. |
| Observation workflow | Retire from normal use | Retire from normal use | Remove public workflow in 8h after automatic capture and stored-record migration are handled. |
| Normal wire target | Named 88 methods | Required ownership and allocation mapping first | Do not set a count from imports alone. Session 8b owns the measured partition. |
| Clip sensor | Selected `read_clips` | Left name and cardinality open | Session 8f decides between `read_launcher_clip` and `read_launcher_clips`. |
| Device composers | Kept separate public operations | Proposed one composition family | Expose `compose_devices`; dispatch to private offline or staged backends. |
| Device alternates | Kept the managed lifecycle | Kept the managed lifecycle | Both runs inherited the same assumption. Retire that lifecycle after follow-up review. |

The remaining differences were smaller wording, classification, and migration
details. The final audit applies the clearer version without adding a product
choice.

## Bitwig-aligned naming follow-up

The public target uses Bitwig object names when they prevent a false capability
claim:

| Current name | Target name or rule |
|---|---|
| `check_connection` | `check_bitwig_connection` |
| `read_clip`, `acquire_clip_note_source` | `read_launcher_clip` or `read_launcher_clips`; 8f decides cardinality |
| `add_clip` | `add_launcher_clip` |
| `copy_clip_down` | `copy_launcher_clips` |
| `move_clip_block` | `move_launcher_clips` |
| `delete_clip` | `delete_launcher_clip` |
| `set_clip_launch` | `set_launcher_clip_launch_settings` |
| `set_clip_metadata` | `set_launcher_clip_properties` |
| `show_changed_clip` | `show_launcher_clip_in_detail_editor` |
| `add_track` | `add_instrument_tracks` while only instrument creation is implemented |
| `copy_track` | `duplicate_instrument_track` under current proof; `duplicate_track` only after wider live proof |
| `inspect_device_parameters`, `set_parameter` | `read_device_controls`, `set_device_controls` |
| `inspect_preset_modulation`, `author_modulators` | `read_preset_modulation`, `edit_preset_modulation` |

Keep `launch_clip`, `add_scenes`, `delete_scene`, `add_devices`,
`set_device_enabled`, and the selected layer-chain names. `launch` already
identifies Launcher behavior. Scene and Device Enable are Bitwig terms.

E16 selected an instrument-track fixture and never ran an audio-track arm. The
product refusal therefore records missing evidence, not a failed capability.
The installed API exposes both `Application.createAudioTrack()` and
`Application.createInstrumentTrack()`. The production create handler calls only
the latter. Audio-track creation and duplication need focused live proof before
the public name can broaden.

## Layer-chain result

Instrument Layer and FX Layer are ordinary `container` devices. Their named
parallel children are `layer_chain` objects. A result already scoped to one
container can use the field name `chains`. Do not use bare `chain` in a public
tool name because Bitwig uses that noun for several different structures.

The target surface keeps these elemental capabilities:

| Target | Purpose |
|---|---|
| `read_devices` | Read top-level devices and complete addressed layer chains. |
| `duplicate_layer_chain` | Branch one existing chain under a unique name. |
| `rename_layer_chain` | Give a chain a durable address. |
| `move_devices` | Move ordered devices through proved track and layer routes. |
| `copy_devices` | Copy devices through proved layer routes. |
| `set_layer_chain_solo` | Set exact `exclusive`, `on`, or `off` solo state. |
| `delete_device` | Remove an emptied container through the existing destructive seam. |

For A/B audition, compose or duplicate named chains, edit them with ordinary
device limbs, and set one chain to exclusive solo. For collapse, read the full
structure, move the winner out, verify it, delete the container, restore the
top-level position, and read again. Each stage uses fresh state.

Typed deletion of one layer chain is unavailable. Refuse before a write and
direct the agent to computer control. Reacquire structured state after the UI
action. Ghostnote does not own or reverse that action.

## Composer result

Use one public `compose_devices` operation. Keep two private execution paths:

| Backend | Advantage | Boundary |
|---|---|---|
| Offline preset | Builds and validates a complete supported native container before one project insertion. It can bootstrap an empty Instrument Layer and create supported device-local modulators. | Limited to shapes and sources represented by validated assets and file surgery. |
| Staged live | Supports VST3, CLAP, arbitrary presets, existing-device moves or copies, several devices per chain, and broader positioning. | Requires several observable project writes and more failure stages. |

E18a measured a filled four-chain preset insertion at 463-465 ms and a plain
device insertion at 469-500 ms in the same probe. The offline path therefore
costs no more than the first online insertion in that probe. A staged four-chain
composition also needs chain naming, four source insertions, and four
relocations before verification.

This is not an end-to-end comparison. Session 8h must benchmark equivalent
two-chain and four-chain requests. Keep the offline backend while it remains a
measured fast or uniquely capable path.

## Decision effect

[D18](../../decisions/d18-branching-the-hybrid-model-at-l3-open-settled-2026-08-06-by-the-.md)
now treats layer chains as composable device structure, not managed alternates.
Launcher clip blocks remain outside this amendment. Session 8f reviews their
public read boundary.

## Retrospective

Independent execution exposed tool-count assumptions, but both runs inherited
the same device-alternate concept. Future interface audits must review whether
each product concept still earns its lifecycle, not only whether its tools have
the correct grain.

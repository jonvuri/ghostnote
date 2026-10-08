---
id: D18
kind: decision
state: active
source: DECISIONS.md
updated: 2026-10-08
---

# D18 — Layer chains are composable structure, not managed device alternates **[REVISED 2026-09-25]**

Ghostnote does not have a first-class device-alternate object or lifecycle.
Instrument Layer and FX Layer are ordinary container devices. Their named
parallel children are `layer_chain` objects. Agents can compose these objects
for A/B work and for other device-routing tasks.

This revision changes the device side of the 2026-08-14 decision. Launcher clip
blocks remain the current clip-content representation until the Phase 8 clip
interface work reviews them. Track duplication remains ordinary typed CRUD. It
does not create take lineage or lifecycle state.

## Reason

Rapid audition is the useful behavior from the former device-alternate model.
Normal layer chains already provide it:

- each chain holds ordered devices and device state;
- container-local solo can make one chain audible;
- Bitwig Shift-click gives the user exclusive solo;
- a typed operation can set and verify exact solo state; and
- normal structure operations can build and collapse the same layout.

The managed lifecycle added six public names, automatic observation capture,
special creation and filling rules, and two destructive rebuild workflows. It
did not add a distinct host object. E80 inspected this machinery but did not use
it. E127 completed a newer A/B task with ordinary parameter changes, audio
capture, and audition. The lifecycle cost is no longer justified.

## Unchanged clip and track boundaries

Launcher clip blocks remain the current scoped representation for launcher-clip
content and launch settings. They do not include arrangement clips, sends,
track-mixer state, routing, or project state. A mixed instruction can create
separate clip and device structures, but they are not one atomic alternate.
Session 8f can revise the public clip boundary after it reviews the complete
compact document and cache contract.

The current `copy_track` capability remains typed CRUD. Rename it to
`duplicate_instrument_track` while E16 is the only live proof. E16 tested an
instrument track; it did not prove that audio-track duplication fails. Broaden
the name to `duplicate_track` only after each supported track kind passes the
same live identity, content, cost, and readback checks.

A duplicate returns a durable identity and uses normal guards and readback, but
it creates no take, lineage, or cleanup obligation. It can be audible
immediately, can add engine load, consumes one track-bank row, and is not
automatically reversible. These costs do not turn it into an alternate
workflow.

## Vocabulary

Use `container` for the parent device. Its kind identifies Instrument Layer or
FX Layer. Use `layer_chain` for one named parallel child. In a result already
scoped to one container, the field can be `chains`.

Do not use bare `chain` in a public tool name. Bitwig also has track device
chains, fixed nested chains, selector chains, drum chains, and a device named
Chain. Do not use `entry` as the canonical child noun. It is clear, but it is
not Bitwig's object term.

## Target capabilities

| Capability | Target |
|---|---|
| Read | `read_devices` returns top-level devices and addressed layer chains, including order, solo and mixer state, capacity, coverage, and completeness. |
| Compose | `compose_devices` creates complete supported containers. One public tool selects a private offline or staged backend. |
| Branch | `duplicate_layer_chain` copies one complete chain to a new unique name. |
| Name | `rename_layer_chain` changes the durable chain name. |
| Move | `move_devices` moves ordered devices between the track and chains, between chains, and through proved top-level positioning routes. |
| Copy | `copy_devices` creates new device instances on proved layer-chain routes. |
| Audition | `set_layer_chain_solo` uses idempotent `exclusive`, `on`, or `off` modes. |
| Remove container | The existing destructive `delete_device` tool removes an emptied layer container. |

Every limb checks complete source and destination structure and reads back its
own effect. A route that is unavailable or cannot be proved refuses before a
write.

## Recipes

For A/B audition:

1. Compose named chains or duplicate one chain.
2. Apply ordinary device edits to each chain.
3. Set one chain to exclusive solo.
4. Repeat step 3 while the user auditions.

For winner collapse:

1. Read the complete container and top-level device order.
2. Move the winning chain's devices to the track.
3. Verify that all requested devices moved and the winning chain is empty.
4. Delete the container through `delete_device`.
5. Restore the extracted devices to the former container position.
6. Read the complete final order.

The collapse is not atomic. Each step uses fresh structure. Layer-chain name,
mute, solo, volume, pan, and colour do not become top-level device state.
Cross-device modulation preservation is not claimed beyond measured routes.

Do not add a specialized collapse tool unless dogfood shows that agents cannot
execute this guarded recipe reliably.

## Unavailable deletion

Bitwig's typed operations cannot delete one layer chain. A duplicate chain has
no typed inverse. Removing one chain while retaining its container therefore
refuses before a write. The refusal tells the agent to use computer control.

This UI remediation is allowed under the Phase 8 sensor-and-limb posture. The
agent confirms focus and target, performs the visible deletion, and reacquires
structured device state. Ghostnote does not record or reverse that UI action.

## Composition backend

Keep the offline preset composer as a private `compose_devices` fast path. It
builds a complete supported native structure before one project insertion.
E18a measured a filled four-chain preset insertion at 463-465 ms and a plain
device insertion at 469-500 ms in the same probe. A staged four-chain request
normally needs a container insertion, chain renames, four device insertions,
and four relocations before verification.

The offline path also creates the first chain of an Instrument Layer, which
ships empty, and authors supported native device-local modulators that have no
typed live creation route. Its validation happens before one project write.
Its owned reversal removes one container.

The staged backend remains the general path. It supports VST3, CLAP, presets,
existing-device moves and copies, several devices per chain, caller positions,
and shapes outside the offline template. Phase 8h must benchmark identical
two-chain and four-chain requests. The current evidence proves the operation
count and insertion-cost advantage, not an end-to-end speed ratio.

## Observation and destruction

Remove the device-alternate observation event with the public observation
workflow. The agent conversation owns its A/B intent and user verdict. Project
state remains available through `read_devices`.

D20 is unchanged. `delete_device` keeps a separate destructive name and zero
initiative. Moving or copying devices does not authorize container deletion.
D16 and D19 continue to own exact effects and guarded reversal. A layer-chain
A/B layout is not general loss protection for unrelated edits.

## Implemented surface (8h4e, E238)

`agent-native-v1` implements this decision. `stable-v1` keeps the retired
lifecycle tools as the rollback.

- Read: `read_devices` (positions 0–2 expose layer chains).
- Compose: `compose_devices`. The offline backend serves an Instrument Layer
  of one through four layer chains, each with one native device and no outer
  modulators, appended at position 2 or earlier. It was 5.0 and 8.4 times
  faster than the staged backend for 2 and 4 layer chains. The staged backend
  serves all other requests. `revert_change` with the returned change ID
  reverses either backend.
- Branch, name, move, copy, and audition: `duplicate_layer_chain`,
  `rename_layer_chain`, `move_devices`, `copy_devices`, and
  `set_layer_chain_solo`. Solo `on` and `off` use the new `chain.solo` op.
- Remove container: `delete_device`. It reports the removed layer chains. An
  entry with `layerChain` refuses before a write and directs the agent to
  computer control.
- Recipes: the `read_devices` description states the A/B and collapse
  recipes. Both passed live.

## Measured costs (8h4g, E247)

A device insertion and a layer-chain copy now poll their structural proof
(deadline 4,000 ms), and a relocation uses its own proof poll; each stage
waited a fixed 4,000 ms before.

- `compose_devices`: offline 3.4 s (2 layer chains) and 4.0 s (4); staged
  17.5 s and 30.5 s (E238: 36.8 s and 64.9 s). The offline backend stays the
  fast path: 5.2 and 7.6 times faster. Each reversal restores an empty track
  (offline 1.4 s; staged 12.6 s and 21.0 s).
- Branch and collapse limbs: `duplicate_layer_chain` 1.4 s (E238: 5.2 s),
  `move_devices` 1.3–1.8 s (E238: 5.4–6.0 s), `delete_device` 3.1 s,
  `set_layer_chain_solo` about 1.0 s.
- The A/B recipe and the winner collapse pass live again.

## Superseded history

The 2026-08-06 decision selected a three-mechanism hybrid. The 2026-08-14
revision removed managed track forks after E22 proved that Group follows hidden
primary focus. It retained managed device alternates and clip blocks. The 8a
audit and its independent rerun initially assumed that the remaining device
lifecycle should stay. The follow-up review deconstructed it into the ordinary
layer operations above.

The capability evidence remains valid. E17 and E18a-h establish chain creation,
naming, solo, movement, state, deletion limits, and rebuild cost. E34 proves
exclusive-solo audition. E63 records one managed dogfood use and its setup gap.
E80 and E127 show later agent behavior. E135 records the Phase 8 comparison and
the selected target.

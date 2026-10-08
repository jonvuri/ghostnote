---
title: Phase 8h4e — Device structure migration
kind: plan
state: done
status: Complete (E238). agent-native-v1 replaces the device-alternate lifecycle with read_devices, compose_devices, and generic layer-chain limbs; the offline backend is 5.0 to 8.4 times faster than the staged backend.
updated: 2026-10-08
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4e0-direct-parameter-display-probe.md
next: 8h4f-tracks-profile-cut-and-closeout.md
evidence: E17, E18a-h, E34, E59, E63, E73, E80, E126, E127, E135, E238, E244; D18, D20
---

# Phase 8h4e — Device structure migration

## Why

D18 (2026-09-25 amendment) and E135 treat Instrument Layer and FX Layer
chains as ordinary device structure. The managed alternate lifecycle and
three public composers remain. This session needs only the 8h4b profile and
result module; it does not depend on 8h4c or 8h4d.

## Work, in order

### 1. Sensors and control names

- Merge `inspect_devices` and `inspect_device_alternates` into
  `read_devices`. Return ordered devices, addressed layer chains, solo and
  mixer state, capacities, coverage, and completeness. Use `container`,
  `containerKind`, and `layer_chain`.
- `inspect_device_parameters` → `read_device_controls`; `set_parameter` →
  `set_device_controls`. Keep cohort writes, domain checks, and selector
  kinds. A 27-control success stays at or below 3,181 bytes (E126).
  Report DirectParameter display text for the full inventory (E244):
  - After each settle of a new target, set the listed IDs on the display
    observer that `Rig` keeps. A switch sends no text, so a set is
    necessary for each new target.
  - The text is part of the settle: one display callback for each listed ID
    under the current target stamp. Clear the text at each target change.
    The expected cost is one turn (about 24 ms) for each new target, for any
    count (281 IDs measured). If the text does not arrive in a short budget,
    report no `display` for that parameter and mark the read incomplete.
    Never report text that has no callback under the current stamp.
  - Keep the set while the target stays the same; a write readback then has
    the text of the written ID in the same turn.
  - Map the CLAP callback form `CONTENTS/ROOT_GENERIC_MODULE/<id>` to the
    listed ID for values, text, and the write completion. Today a CLAP write
    lands but cannot confirm (inferred in E244). Verify a product CLAP write
    live.
  - Report an empty CLAP ID list as "parameters unavailable (audio engine
    off or plug-in not loaded)", not as "no parameters".
  - Update the tool description (`display`) and bump
    `TOOL_DESCRIPTION_VERSION`. Cost model: one extra wire call and one turn
    for each new target of a parameter read.
- `inspect_preset_modulation` → `read_preset_modulation`;
  `author_modulators` → `edit_preset_modulation`.
- `add_native_devices` and `add_device` → one `add_devices` with explicit
  sources. Keep exact-name diagnostics.

### 2. Layer-chain limbs

Add `duplicate_layer_chain`, `rename_layer_chain`, `move_devices`,
`copy_devices`, and `set_layer_chain_solo`. Reuse the current alternate
engines' proved primitives. `set_layer_chain_solo` has idempotent
`exclusive`, `on`, and `off` modes; prove `on` and `off` live. A typed
single-chain delete refuses before a write and directs the agent to computer
control, then to a fresh `read_devices`.

### 3. Composition

- Expose one `compose_devices`. It selects the private offline preset backend
  when the request fits it, and guarded staged operations otherwise.
  Merge `compose_device_structure`, `compose_drum_machine`, and
  `compose_device_sources`. Reversal uses the returned change ID;
  `reverse_device_source_composition` retires.
- Benchmark equivalent two-chain and four-chain requests through both
  backends, live, with verification. State the backend boundary. Keep the
  offline backend on latency alone only if the benchmark supports it.
- `wrap_existing_device_modulation` and its reversal stay (deferred in 8a).

### 4. Alternate retirement

Remove `create_device_alternates`, `fill_device_alternate`,
`switch_device_alternate`, `remove_device_alternate`, and
`keep_device_alternate` from `agent-native-v1`, with the device-alternate
observation outcome. 8h4d (E237) already stopped its capture in
`agent-native-v1`; the outcome still gates the product status. Keep legacy
alternate assets only for `stable-v1`.
Document the A/B audition and winner collapse recipes in the tool text.

## Cost model (written at the session start)

Units from the [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md):
one wire call is one turn (about 24 ms). The live adapter waits the fixed
`deviceInsert` budget (4,000 ms) after each `device.insert`,
`device.relocate`, `chain.create`, and `chain.relocate` stage, and the
`trackStruct` budget (144 ms) after `chain.rename` and `device.delete`. These
waits, not the turns, set the cost of a structural limb.

| Path | Typical case | Largest admitted case | Primitive and difference |
|---|---|---|---|
| `read_devices` | One bank read and one container read (about 4 turns, 100 ms) | Three containers in the slot scopes, 5 chains of 4 devices each: about 8 turns (200 ms) | Same reads as `inspect_devices` plus `inspect_device_alternates`; one call instead of two |
| `read_device_controls` | The current inventory plus one display set and one more poll: +1 turn (24 ms) for a new target | 281 IDs (Diva): still +1 turn | E244: one turn for any count. The same target adds nothing |
| `set_device_controls` | Unchanged: the target is held, so the display text of the written ID arrives in the write turn | 27-control cohort: unchanged | E244 Q4 |
| `set_layer_chain_solo` | One container read, one tick stage, one or more readback polls: about 6 turns (150 ms). A no-op (already in the mode) is one read | Same | `switch_device_alternate`: same op and readback |
| `rename_layer_chain` | One read, one stage, 144 ms settle, readback: about 0.3 s | Same | `chain.rename` inside `create_device_alternates` |
| `duplicate_layer_chain` | One read, select, duplicate, 4,000 ms settle, mint and rename, readback: about 4.5 s | A chain of 4 devices: same budget (the settle covers plug-in load) | `chain.create` (E17ak) |
| `move_devices`, `copy_devices` | One device: one read, one 4,000 ms stage, readback: about 4.3 s | 4 devices: 4 stages, about 16.5 s | `fill_device_alternate`: same ops |
| Collapse recipe, 2 devices | read, move 2 (8.3 s), read, delete (0.3 s), restore 2 (8.3 s), read: about 17.5 s | 4 devices: about 34 s | `keep_device_alternate`: the same writes in one call |
| `compose_devices`, offline backend | One preset insertion (4,000 ms settle) and verification: about 5 s | 4 chains: same insertion | E18a: 463–465 ms insertion before the settle |
| `compose_devices`, staged backend | 2 chains: container, rename passes, 2 insertions, 2 relocations: about 7 stages, 25–30 s | 4 chains: about 11 stages, 45–50 s | No earlier end-to-end number; the benchmark measures it |

Heap: each result is under 20 KB; no new cache. The benchmark and the live
recipes measure these numbers; E238 records the differences.

## Live acceptance

Owned unsaved project. Run the A/B recipe with two chains and the collapse
recipe end to end; each step uses fresh structure. Run the typed
single-chain delete refusal. Run both composition benchmarks.

## Acceptance criteria

- No managed alternate lifecycle remains in `agent-native-v1` discovery.
- The A/B and collapse recipes pass live with the generic limbs.
- The benchmark states the selected backend boundary.
- Each retired or renamed tool has a migration row. D18 states the
  implemented surface.
- Brain check, extension check, wire goldens, context check, and
  `git diff --check` pass. Record the evidence as E238.

## Out of scope

- A specialized collapse operation, unless dogfood (8i) shows that agents
  cannot run the recipe.

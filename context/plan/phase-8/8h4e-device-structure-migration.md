---
title: Phase 8h4e — Device structure migration
kind: plan
state: planned
status: Planned. Replaces the device-alternate lifecycle with read_devices, compose_devices, and generic layer-chain limbs, and benchmarks the two composition backends.
updated: 2026-10-07
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4e0-direct-parameter-display-probe.md
next: 8h4f-tracks-profile-cut-and-closeout.md
evidence: E17, E18a-h, E34, E59, E63, E73, E80, E126, E127, E135; D18, D20
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
  Report DirectParameter display text as
  [8h4e0](8h4e0-direct-parameter-display-probe.md) (E244) recommends.
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

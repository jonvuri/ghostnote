---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f-f
---

# Now

Phase 1 is in **session 3f-f: bootstrap and creation surface**.

## Baseline

- `copy_track`, nested address grammar, chain observation, `chain.create`,
  `chain.relocate` and `chain.activate` are complete.
- A chain is addressed by container position plus name. Its `channelId` is minted
  again on project load and is used only as a within-turn creation witness.
- Product container reads and writes use the same cursor-free
  `Rig.slotLayerBanks`; they do not move `cursorDevice0`.
- `chain.relocate` covers top→chain, chain→top and chain→chain move/copy on one
  track. Complete source/destination sequence readback proves removal, append,
  population and order; acknowledgement is not evidence.
- Only `chain.relocate` may route a nested device. `device.delete`, `param.set`
  and every other nested-device write still refuse through
  `assertDevicesRoutable`; `chain.move` is product-reachable only through this
  typed verb.
- Every observed sibling carries exact solo state or switching refuses.
  `chain.activate` makes one named chain the sole soloed sibling and accepts
  success only after an independent complete container readback proves it.
- `switch_device_alternate` exposes switching without mixing in creation or
  reduction. Automatic reversal reports that it cannot restore the prior active
  alternate; the caller can switch back explicitly by name.
- ⚠ An untouched shipped chain auto-renames to its first inserted device in
  Bitwig. Lifecycle writes therefore use explicitly named chains; the live
  conformance row discovered and now exercises that boundary.
- The current wire golden is 147 methods / `7f212c48cd3dab75`; a rebuilt and
  redeployed jar was proved fresh after a controller reload through `hello()`.
- Brain typecheck and 431/431 offline tests pass. Live conformance passes
  51/0/6, including exact exclusive switching and an unchanged unrelated track.
  Production MCP smoke passes 7/7 and removes its copied fixture track.

## Session 3f-f — bootstrap and creation surface

Purpose: make both supported container cases autonomous and expose the minimum
production inspection, creation and fill surface.

Acceptance:

1. Bundle or provision the Instrument Layer seed needed to establish its first
   addressable chain; runtime operator-authored setup is forbidden.
2. Keep the fresh FX Layer path autonomous through its shipped chain, while
   explicitly naming every chain before relying on its `ChainAddress`.
3. Expose production inspection, creation and fill operations for both supported
   container cases, returning only independently resolved structure.
4. State the object boundary honestly: alternates carry devices and device state,
   not clips, sends, routing or track mixer state.
5. Make only the minimum deliberate surface-vocabulary changes these tools need;
   do not begin winner collapse or selective reduction.
6. Pass offline checks, extension build, live conformance, production MCP smoke,
   context check and `git diff --check` with no residue.

Out of scope: winner collapse and selective reduction.

## Following slices

| Slice | Focus |
|---|---|
| 3f-g | directed winner collapse at the original signal-chain position |
| 3f-h | selective reduction by rebuild while several alternates survive |
| 3f-i | complete lifecycle production smoke and handoff to 3g |

Selective reduction is a Phase 1 requirement, not optional. Session 3g does not
start until creation, filling, switching, collapse and selective reduction are
autonomous, live-proven to their stated boundary, and mechanically honest on the
production surface.

## Constraints carried forward

- A fresh FX Layer has one chain; a fresh Instrument Layer has zero. The latter
  needs the bundled seed scoped in 3f-f, never runtime operator setup.
- Explicitly name a chain before relying on its `ChainAddress`; an untouched
  shipped chain can auto-name itself when first filled.
- Every typed chain delete refuses. Reduction therefore relocates devices and
  deletes the container; selective reduction rebuilds the surviving set.
- Relocation and rebuild must preserve multi-device order. Collapse must restore
  the container's original signal-chain position rather than append at
  `chainEnd`.
- Moving devices does not carry chain-level state. Reapply or report name, mute,
  solo, volume, pan and colour; chains have no sends.
- Keep cross-device modulation outside the claim until its indexed route is
  measured, and measure the audible effect on the rebuilt track itself.
- Device-alternate tools may reopen `layer` or `chain` in the surface vocabulary
  only deliberately, with a rewritten reason in `naming.ts`. Session 3f owns the
  minimum wording needed by each tool; 3g reviews and freezes the versioned
  description cohort.

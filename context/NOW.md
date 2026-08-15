---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f-e
---

# Now

Phase 1 is in **session 3f-e: container-local exclusive switching**.

## Baseline

- `copy_track`, nested address grammar, chain observation, `chain.create` and
  `chain.relocate` are complete.
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
- ⚠ An untouched shipped chain auto-renames to its first inserted device in
  Bitwig. Lifecycle writes therefore use explicitly named chains; the live
  conformance row discovered and now exercises that boundary.
- The current wire golden is 146 methods / `c1120b1c567369d3`; a rebuilt and
  redeployed jar was proved after a full Bitwig restart through `hello()`.
- Brain typecheck and 426/426 offline tests pass. Live conformance passes
  50/0/6, including a real device-filled chain, all relocation directions,
  move/copy conservation and ordered multi-device fill. Disposable containers
  and fixture tracks are deleted in cleanup.

## Session 3f-e — switching

Purpose: observe and set container-local exclusive solo through a stable
`ChainAddress`, then expose the corresponding production operation.

Acceptance:

1. Add exact chain-solo observation to the existing stable `ChainAddress`
   readback; unknown or partial state refuses rather than being guessed.
2. Add one typed switching verb that makes the addressed alternate active and
   every sibling in the same container inactive.
3. Prove the final exclusive state by independent container readback; wire
   acknowledgement or selection is not proof.
4. Prove an unrelated track's chain state does not change.
5. Make fake and live adapters run the same switching assertions, and expose the
   minimum production operation without mixing in creation or reduction.
6. Pass brain checks, extension build, live conformance, production smoke as
   applicable, context check and `git diff --check` with no residue.

Out of scope: the Instrument Layer seed, general creation/fill surface, winner
collapse and selective reduction.

## Following slices

| Slice | Focus |
|---|---|
| 3f-f | Instrument Layer seed/bootstrap and the production creation surface |
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

---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f-g
---

# Now

Phase 1 is in **session 3f-g: directed winner collapse**.

## Baseline

- `copy_track`, nested address grammar, chain observation, `chain.create`,
  `chain.rename`, `chain.relocate` and `chain.activate` are complete.
- The bundled one-entry empty Instrument Layer seed is live-proved. Fresh
  Instrument and FX containers are autonomous and every entry is explicitly
  named before its durable address is used.
- A chain is addressed by container position plus name. Its `channelId` is minted
  again on project load and is used only as a within-turn creation witness.
- Product container reads and writes use the same cursor-free
  `Rig.slotLayerBanks`; they do not move `cursorDevice0`.
- `chain.relocate` covers top→chain, chain→top and chain→chain move/copy on one
  track. Complete source/destination sequence readback proves removal, append,
  population and order; acknowledgement is not evidence. Before the first
  stage, both adapters project the complete caller-ordered request across source
  positions, container compaction, destination identity and cumulative capacity.
- Only `chain.relocate` may route a nested device. `device.delete`, `param.set`
  and every other nested-device write still refuse through
  `assertDevicesRoutable`; `chain.move` is product-reachable only through this
  typed verb.
- Every observed sibling carries exact solo state or switching refuses.
  `chain.activate` makes one named chain the sole soloed sibling and accepts
  success only after an independent complete container readback proves it.
- `switch_device_alternate` exposes switching without mixing in creation or
  reduction. Automatic reversal reports that it cannot restore the prior soloed
  alternate; the caller can switch back explicitly by name.
- `inspect_device_alternates`, `create_device_alternates` and
  `fill_device_alternate` expose complete readback, autonomous named creation and
  ordered move/copy fill. Inspection reports raw `soloed` observations and names
  an `exclusiveActive` entry only from a complete all-known sibling read with
  exactly one solo. They state the device-only object boundary explicitly.
- Creation validates all requested names before insertion. A requested first
  name matching the seed entry is still written explicitly through a temporary
  unique name, so later fill never relies on an untouched auto-naming entry.
- ⚠ An untouched shipped chain auto-renames to its first inserted device in
  Bitwig. Lifecycle writes therefore use explicitly named chains; the live
  conformance row discovered and now exercises that boundary.
- The current wire golden is 147 methods / `7f212c48cd3dab75`; a rebuilt and
  redeployed jar was proved fresh after a controller reload through `hello()`.
- Brain typecheck and 439/439 offline tests pass, including atomic multi-device
  fill refusal, non-sorted move compaction and pre-insertion name validation.
  Fresh live conformance passes 51/0/6, including both zero-stage projected-fill
  refusals. Production MCP smoke passes every P0-P10 check with the truthful
  solo-state structure, removes its copied track, and final cleanup removes both
  conformance-owned fixture tracks.

## Session 3f-g — directed winner collapse

Purpose: implement the common destructive lifecycle by extracting one named
winner at the container's original signal position and deleting the container.

Acceptance:

1. Name the surviving alternate explicitly and preflight its complete ordered
   device sequence before the destructive boundary.
2. Move every winner device out in order and restore the container's original
   signal-chain position rather than appending at the end.
3. Reapply or report chain-level state that moving devices does not carry.
4. Delete the container only after extraction is independently proved; keep the
   destructive tool seam separate from benign creation/fill.
5. Measure the audible effect on the rebuilt track itself and keep unmeasured
   cross-device modulation outside the claim.
6. Pass offline checks, extension build, live conformance, production MCP smoke,
   context check and `git diff --check` with no residue.

Out of scope: selective reduction while several alternates survive.

## Following slices

| Slice | Focus |
|---|---|
| 3f-h | selective reduction by rebuild while several alternates survive |
| 3f-i | complete lifecycle production smoke and handoff to 3g |

Selective reduction is a Phase 1 requirement, not optional. Session 3g does not
start until creation, filling, switching, collapse and selective reduction are
autonomous, live-proven to their stated boundary, and mechanically honest on the
production surface.

## Constraints carried forward

- A fresh FX Layer has one chain; a fresh Instrument Layer has zero. Production
  creation uses the bundled one-entry seed for the latter.
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

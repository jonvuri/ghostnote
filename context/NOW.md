---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f-d
---

# Now

Phase 1 is in **session 3f-d: typed fill/extract relocation**.

## Baseline

- `copy_track`, nested address grammar, chain observation and `chain.create` are
  complete. `chain.create` is the only typed write inside a container.
- A chain is addressed by container position plus name. Its `channelId` is minted
  again on project load and is used only as a within-turn creation witness.
- Product reads and creation writes use the same cursor-free
  `Rig.slotLayerBanks`; they do not move `cursorDevice0`.
- Every other nested-device write still refuses through `assertDevicesRoutable`.
  `chain.move` remains measured probe surface and is not product-reachable.
- The current wire golden is 146 methods / `c1120b1c567369d3`; a rebuilt and
  redeployed jar was proved after a full Bitwig restart through `hello()`.
- Brain typecheck and 423/423 offline tests pass. Post-review live conformance
  passes 49/0/6, including both `chain.create` batch refusals against a
  disposable FX Layer with the whole container deleted in cleanup.
- The refused-rename report is proved by the offline `L-chain-create` live-adapter
  test. There is no safe production setup that makes the extension reject the
  valid identity it just returned, and 3f-c added no product fault hook to force
  one.

## Session 3f-d — relocation

Purpose: add one typed, slot-scoped primitive that fills and extracts chains
without weakening the nested-device refusal for any other operation.

Acceptance:

1. Add one typed fill/extract verb covering top→chain, chain→top and
   chain→chain within the measured slot scopes. Promote `chain.move` only
   through that verb.
2. Prove source removal and destination placement through structural readback
   independent of the writer; acknowledgement and writer-selected handles are
   not evidence.
3. Moving conserves the observable device population; copying adds exactly one.
   Multiple devices preserve their order.
4. Put a real device into a chain so nested observation joins conformance live.
5. Preserve the current refusal on every nested-device write not owned by this
   verb. Do not add switching, creation-surface, seed, collapse or selective-
   reduction work.
6. Pass brain checks, the extension build, live conformance, the context check
   and `git diff --check` with no residue.

Out of scope: solo switching, the seed asset, public device-alternate tools,
collapse or selective reduction.

## Following slices

| Slice | Focus |
|---|---|
| 3f-e | container-local exclusive switching and its production tool |
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

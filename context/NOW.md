---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f-c
---

# Now

Phase 1 is in **session 3f-c: close the post-`chain.create` live evidence gap**.
This is a verification prelude, not a capability slice. Do not promote device
relocation until it is green.

## Baseline

- `copy_track`, nested address grammar, chain observation and `chain.create` are
  complete. `chain.create` is the only typed write inside a container.
- A chain is addressed by container position plus name. Its `channelId` is minted
  again on project load and is used only as a within-turn creation witness.
- Product reads and creation writes use the same cursor-free
  `Rig.slotLayerBanks`; they do not move `cursorDevice0`.
- Every other nested-device write still refuses through `assertDevicesRoutable`.
  `chain.move` remains measured probe surface and is not product-reachable.
- The current wire golden is 146 methods / `c1120b1c567369d3`.
- Brain typecheck and 423/423 offline tests pass. The last live run passed
  49/0/6, but it preceded three fixes to batch preconditions and rename-failure
  reporting.

## Session 3f-c — live closure

Purpose: prove the post-review `chain.create` fixes against the real adapter and
leave a clean baseline for 3f-d relocation.

Acceptance:

1. Rebuild and redeploy the extension, restart Bitwig, and prove the running jar
   matches the 146-method golden through `hello()`.
2. Extend `C-chain-create` with a batch of distinct names whose projected total
   exceeds the four-wide chain bank. It must refuse before any copy and leave the
   container unchanged.
3. Run full live conformance. The existing paired-name batch refusal and the new
   summed-bank refusal must pass against a disposable FX Layer, with the whole
   container deleted in cleanup.
4. Keep the refused-rename path as an offline live-adapter test unless a safe,
   non-production fault can construct it. Do not add a product fault hook merely
   to force the extension to reject the identity it just reported; state the
   evidence boundary explicitly.
5. Rerun brain checks, the extension build, the context check and
   `git diff --check`; update this file to hand off to 3f-d.

Out of scope: a relocation op, `chain.move` promotion, solo switching, the seed
asset, public device-alternate tools, collapse or selective reduction.

## Following slices

| Slice | Focus |
|---|---|
| 3f-d | typed fill/extract relocation with independent structural readback |
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

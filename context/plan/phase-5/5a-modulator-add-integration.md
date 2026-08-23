---
title: Phase 5a — checkpointed modulator add
kind: plan
state: complete
status: Complete. E65 records the passing exact live witness and cleanup.
updated: 2026-08-22
parent: README.md
evidence: D1, D3, E10b, E13, E64, E65
---

# Phase 5a — checkpointed modulator add

## Purpose

Add one small product path from `bwmod` to the executor. The path adds a curated
modulator to a preset, loads the result as a new device, and returns the executor
take. It then proves live modulation through one exact remote-control selector.

## Scope

1. Accept an absolute template path, a curated donor id, one route, and one
   remote page and control witness.
2. Apply `addModulator()` and run `validate()` before any project write.
3. Keep the sampled-preset footprint refusal. Do not add a fallback estimate.
4. Load the generated preset through `device.insert` and retain its take and
   minted device address.
5. Resolve one exact remote page and control selector from readback. Sample that
   selector and compare its base value with `modulatedValue`.
6. Report a structural preset insertion separately from its exact absence
   restore. The take's exact label means that deletion restores the prior
   absence. It does not mean that the inserted preset has byte-exact readback.
7. Reverse the take in the focused live proof and restore the exact entry track
   list.

## Acceptance criteria

- Offline tests prove the edited bytes, pre-load validation, exact selector,
  live-divergence rule, executor take, minted address, and device deletion.
- An unmeasured donor on a sampled preset refuses before `apply()`.
- A route with no observed base-to-modulated divergence is not verified.
- The focused live proof loads a routed Polysynth, observes modulation through
  the returned selector, reverses it, and leaves no track or device residue.
- `npm run check` and the extension build pass.

## Out of scope

- Replace, retarget, delete, composition, containers, and cross-device routes.
- Public MCP tools.
- New templates or donors.
- Footprint measurement.

## Current verification

- `npm run check` passes 768/768.
- The extension Gradle build passes, and the updated extension is deployed.
- The focused live probe passes all five checks. It resolves page 3 `FILTER`,
  control 0 `Filt Freq`, observes 0.0036105915451828396 maximum divergence with
  zero base spread, reverses the device, and restores the exact entry track list.
- [E65](../../evidence/experiments/e65-checkpointed-modulator-add-is-live.md)
  records the implementation, proof, cleanup, and qualifications.

## Implementation finding

Remote inventory stability must compare page and control selectors. It must not
compare `modulatedValue`, because that value changes when modulation works. The
extension must also seed a new remote generation from an already confirmed
current device. Selecting the same device does not emit a new page-name callback.
The live host also exposes `Filt Freq` on three pages. An exact witness must name
the page and control. A name-only match refuses and reports its candidates.
Verification also requires an observed false automation state and a positive
divergence threshold. The integration fixture reads and validates the exact
temporary preset before the executor returns.

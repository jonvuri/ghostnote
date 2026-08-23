---
title: Current state
kind: status
state: active
updated: 2026-08-23
phase: phase-5
session: phase-5i-composition-dogfood-and-closeout
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 sessions 5a
through 5h are complete. `compose_device_structure` exposes the owned native
composer through one format-hidden public tool. It guards on complete current
device order and enabled state, validates all named requests before write,
returns requested, validated, observed, and verified facts, records one
insertion, and reverses it through `revert_change`. Session 5i remains to
dogfood composition and close the phase.

## Accepted live baseline

Project `26.05-2 moon` has seven tracks and 14 clips. The accepted Phase 2
musical results remain exact. `Harmony – Open Minor` has the saved top-level
chain `Key Filter+ → Repro-5 → Chorus+ → Reverb` with the nine accepted Chorus+
and Reverb values from E63. No scratch track, device, clip, or launcher residue
remains.

## Phase 4 closeout

- The public version-5 cohort exposes device inspection, arbitrary parameter
  inventory, explicit native, VST3, CLAP, and preset insertion, scalar control,
  bypass, and directed deletion.
- The final native, plugin, deep-route, drum-pad, remote, managed-chain,
  interference, reversal, and clip matrix passes every E61 budget.
- The full brain check passes 758/758. Extension build passes. Live conformance
  passes 54/54 with six expected skips. Cleanup restores the exact entry state.
- The live Bitwig 6.0.6/API 25 handshake passes all 148 methods with hash
  `eb3391803ef4eea4`.
- GitHub Actions run 32603767285 passes both jobs for exact candidate
  `b11bfc6aceee7857b534ee2f315a08cec0388ad2`.
- [E64](evidence/experiments/e64-phase-4-closes-with-saved-device-baseline.md)
  and the [Phase 4 outcome](archive/outcomes/PHASE-4.md) record the audit and
  qualifications.

## Next action

Implement [session 5i](plan/phase-5/5i-composition-dogfood-and-closeout.md).
Build one useful patch through `compose_device_structure`, use the existing
parameter tools on its nested devices, reverse it, audit every Phase 5 exit
criterion, and close the phase with exact baseline and remote CI evidence.

Session source: [Phase 5](plan/phase-5/README.md). Completed proofs:
[E65](evidence/experiments/e65-checkpointed-modulator-add-is-live.md),
[E66](evidence/experiments/e66-tier-1-topology-editors-are-live.md),
[E67](evidence/experiments/e67-sampled-preset-authoring-is-live.md),
[E68](evidence/experiments/e68-container-cross-device-routing-is-live.md),
[E69](evidence/experiments/e69-donor-scope-and-footprints-are-complete.md),
[E70](evidence/experiments/e70-public-modulator-authoring-is-live.md),
[E71](evidence/experiments/e71-owned-template-composition-is-live.md), and
[E72](evidence/experiments/e72-public-device-structure-composition-is-live.md).
Remaining plan: [5i](plan/phase-5/5i-composition-dogfood-and-closeout.md).

## Retrospective

Carry cancellation as explicit host state. Do not infer it from the shape of a
caught error.

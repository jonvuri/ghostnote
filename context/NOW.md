---
title: Current state
kind: status
state: active
updated: 2026-08-23
phase: phase-5
session: phase-5c-sampled-preset-integration
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 sessions 5a,
5b, and 5c are complete. Checkpointed add, replace, retarget, and delete are live
and revertible on Tier-1 and multisample presets.

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

Plan the next small Phase 5 session around container list selection and
cross-device routing. Prove one container modulator reaches one exact control on
a nested device through the checkpointed executor path. Keep explicit list
selection, live behavior readback, reversal, and exact cleanup.

Session source: [Phase 5](plan/phase-5/README.md). Completed proofs:
[E65](evidence/experiments/e65-checkpointed-modulator-add-is-live.md),
[E66](evidence/experiments/e66-tier-1-topology-editors-are-live.md), and
[E67](evidence/experiments/e67-sampled-preset-authoring-is-live.md).

## Retrospective

A modulator page proves structure, not behavior. Use a free-running source for
live divergence unless the probe also supplies the required trigger.

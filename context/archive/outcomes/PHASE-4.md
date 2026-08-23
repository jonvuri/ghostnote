---
title: Phase 4 outcome — sound design
kind: outcome
state: complete
status: Complete 2026-08-22. All exit evidence, the saved device baseline,
        local and live checks, and final remote CI pass.
updated: 2026-08-22
phase: phase-4
evidence: E50–E64 · D2, D5–D10, D15, D16, D20
---

# Phase 4 outcome

Phase 4 is complete. It delivers arbitrary named parameter discovery and
control for native, VST3, and CLAP devices, a deterministic native catalog,
recursive device addressing, remote-control readback, explicit insertion and
bypass, managed mixed-chain construction and reversal, measured performance,
and a six-tool public MCP cohort.

## Exit evidence

| Criterion | Result | Evidence and qualification |
|---|---|---|
| 1. Arbitrary native, VST3, and CLAP parameters | Complete | [E55](../../evidence/experiments/e55-direct-parameter-core-is-live.md) proves the general path. [E56](../../evidence/experiments/e56-native-device-catalog-is-reproducible-and-resolved.md) proves the native catalog and typed Polysynth view. [E57](../../evidence/experiments/e57-vst3-and-clap-parameter-control-is-live.md) proves explicit plugin formats. [E64](../../evidence/experiments/e64-phase-4-closes-with-saved-device-baseline.md) repeats all three formats. |
| 2. Revertible multi-device FX chain | Complete, qualified | [E59](../../evidence/experiments/e59-managed-fx-chain-is-live.md) proves guarded native, preset, VST3, and CLAP construction, parameter and bypass checkpoints, current-position reversal, interference refusal, and exact cleanup. Existing-device deletion remains unrecoverable. |
| 3. Native catalog resolution | Complete | E56 generates all 151 Bitwig 6.0.6 device entries and resolves the used Polysynth and Sampler candidates. [E63](../../evidence/experiments/e63-device-dogfood-exposes-ab-selection-gap.md) and E64 resolve the accepted Chorus+ and Reverb devices live. |
| 4. Device-side scale | Complete | [E50](../../evidence/experiments/e50-device-populated-scale-confirms-d7.md) measures 48 tracks and 384 devices. It keeps D7 at `256/128/8/16/64`. |
| 5. Exact 32-beat read performance | Complete | [E52](../../evidence/experiments/e52-dedicated-read-window-closes-the-exact-read-gate.md) and [E54](../../evidence/experiments/e54-clip-mutation-settlement-is-bounded.md) remove repeated channel and mutation settlement. E64 measures a 1,638 ms median against the 2,661.5 ms gate. |
| 6. Measured device workflows | Complete | [E60](../../evidence/experiments/e60-device-performance-gate-finds-observer-loops.md) finds the repeated observer cost. [E61](../../evidence/experiments/e61-device-observer-efficiency-unblocks-surface.md) repairs it and fixes the budgets. E64 passes every budget. |

## Final public cohort

Description version `ghostnote-description-v5` adds six device tools for
inspection, parameter inventory, explicit insertion, scalar control, bypass,
and directed deletion. Its SHA-256 is
`0bda24861be2f57ddd1f39188d4f3c7d70cd3da67ea6ffd81d9ae4fe6d98cb68`.
Versions 1 through 4 remain frozen.

The general route uses DirectParameter inventories. Typed display, automation,
modulation, origin, and discrete metadata appear only when observed. Optional
remote controls return exact page and control selectors or explicit instability
without partial results.

## Qualifications

- Parameter values are normalized scalar bases. A static base can differ from
  what is heard when modulation or automation is active.
- DirectParameter display text is unavailable. Typed and remote views supply
  display text only when observed.
- The remote host window is 16 pages of eight controls. A larger or unstable
  inventory refuses.
- Device positions are not identities. Guards use complete names and enabled
  states. An indistinguishable same-name replacement remains possible.
- Existing-device deletion has no automatic reversal. Device state is opaque.
- Plugin availability, parameter counts, and timings are specific to the tested
  machine. The native catalog is specific to Bitwig 6.0.6.
- Phase 4 does not author modulator topology.

## Standing regression matrix

| Class | Owner | Checks | Trigger |
|---|---|---|---|
| Offline CI | GitHub Actions | `npm run check`, including fake conformance, device guards, public surface goldens, and the Python `bwmod` oracle; extension Gradle build | Every push and pull request |
| Unattended live, manual start | Repository operator | `probe:4h-device-performance`, `probe:4i-device-surface`, `probe:conformance`, cleanup, handshake, and read-only saved baseline | Before a candidate when device routing, parameters, observers, public tools, adapter, bridge, host version, or budgets change |
| Focused live | Repository operator | `probe:4a-scale`, `probe:4d-native-catalog`, and relevant Phase 4 probes | After a related scale, catalog, native-device, or route change |
| One-shot evidence | Repository operator | E63 sound-design dogfood and A/B verdict | Only for a new natural task or to challenge the evidence. Do not replay it as routine conformance. |

Every live owner records entry state and removes owned fixtures. Conformance
cleanup removes its two known tracks. The final baseline verifies the accepted
launcher state and then reads the saved Chorus+ and Reverb values.

## Final remote CI

[GitHub Actions run 32603767285](https://github.com/jonvuri/ghostnote/actions/runs/32603767285)
passed on its first attempt for exact candidate
`b11bfc6aceee7857b534ee2f315a08cec0388ad2`. Both jobs passed.

## Phase 5 handoff

Phase 5 must use remote-control readback as its live modulation verification
instrument. Read the base value and `modulatedValue` from the exact returned
page and control selector. `bwmod.validate()` proves only that a preset can
load. It does not prove that a route produces modulation.

The proven `brain/src/bwmod/` library is the implementation input. The next
work is executor and take integration, followed by a small, provenance-aware
template and donor pipeline. Keep sampled-preset footprint refusals strict.

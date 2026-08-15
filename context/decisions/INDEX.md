---
title: Decision index
kind: index
state: active
updated: 2026-08-14
---

# Decision index

This is the authoritative index for design decisions. Each decision file opens
with the original decision heading and preserves its amendments and rationale.

| ID | Decision | Detail |
|---|---|---|
| D1 | Modulator topology is authored by template-time `.bwpreset` file surgery **[SETTLED]** | [open](d1-modulator-topology-is-authored-by-template-time-file-surgery-set.md) |
| D2 | Host capability tiers **[Tier 1 SETTLED; Tier 2 = "Tier 1 + stub relocation", SETTLED by E12]** | [open](d2-host-capability-tiers-tier-1-settled-tier-2-tier-1-stub-relocati.md) |
| D3 | `bwmod` library shape **[SETTLED and BUILT 2026-07-24 — `brain/src/bwmod/`]** | [open](d3-library-shape-settled-and-built-2026-07-24.md) |
| D4 | Process topology and the human surface **[SETTLED 2026-07-24]** | [open](d4-process-topology-and-the-human-surface-settled-2026-07-24.md) |
| D5 | Checkpoints are branchable takes, not a linear undo stack **[SETTLED 2026-07-24]** | [open](d5-checkpoints-are-branchable-takes-not-a-linear-undo-stack-settled.md) |
| D6 | Addressing: pinned non-following cursors, identity never index **[SETTLED 2026-07-25]** | [open](d6-addressing-pinned-non-following-cursors-identity-never-index-set.md) |
| D7 | Pre-allocation scaffold sizes **[SETTLED 2026-07-25]** | [open](d7-pre-allocation-scaffold-sizes-settled-2026-07-25.md) |
| D8 | Checkpoint fidelity, measured **[SETTLED 2026-07-25]** | [open](d8-checkpoint-fidelity-measured-settled-2026-07-25.md) |
| D9 | Grid and units **[SETTLED 2026-07-25]** | [open](d9-grid-and-units-settled-2026-07-25.md) |
| D10 | Batch execution mechanics **[SETTLED 2026-07-25]** | [open](d10-batch-execution-mechanics-settled-2026-07-25.md) |
| D11 | Toolchain **[SETTLED 2026-07-25]** | [open](d11-toolchain-settled-2026-07-25.md) |
| D12 | Transport and the contract boundary **[SETTLED 2026-07-25]** | [open](d12-transport-and-the-contract-boundary-settled-2026-07-25.md) |
| D13 | There is no named-action escape hatch **[SETTLED; group exception retired by E22/D18 revision]** | [open](d13-there-is-no-escape-hatch-settled-2026-07-19-e6.md) |
| D14 | The human control layer **[SETTLED 2026-07-25, E14 rows A–I]** | [open](d14-the-human-control-layer-settled-2026-07-25-e14-rows-a-i.md) |
| D15 | Verification discipline **[SETTLED 2026-07-25]** | [open](d15-verification-discipline-settled-2026-07-25.md) |
| D16 | The executor: write-set, stash, revert **[SETTLED 2026-07-26, PHASE-1 session 1]** | [open](d16-the-executor-write-set-stash-revert-settled-2026-07-26-phase-1-s.md) |
| D17 | Take store retired; project-native scoped takes and stash survive **[REVISED 2026-08-14]** | [open](d17-the-take-store-persistence-branching-partial-revert-settled-2026.md) |
| D18 | Managed takes use layer chains and clip blocks; track copying is ordinary CRUD **[REVISED 2026-08-14]** | [open](d18-branching-the-hybrid-model-at-l3-open-settled-2026-08-06-by-the-.md) |
| D19 | Undo: Bitwig's stack is the human's; agent-edit reversal is ours **[SETTLED 2026-08-06; separated out 2026-08-07]** | [open](d19-undo-bitwig-s-stack-is-the-human-s-agent-edit-reversal-is-ours-s.md) |
| D20 | Destruction: zero initiative, directed execution behind an annotated seam **[SETTLED 2026-08-07]** | [open](d20-destruction-zero-initiative-directed-execution-behind-an-annotat.md) |

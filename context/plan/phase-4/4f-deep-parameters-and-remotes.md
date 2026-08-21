---
title: Phase 4, session 4f — deep parameters and remote controls
kind: plan
state: planned
status: Planned after 4c. Extend confirmed parameter routing into nested chains
        and add the remote-control checkpoint instrument.
updated: 2026-08-21
parent: README.md
prev: 4e-plugin-parameter-proof.md
next: 4g-managed-fx-chain.md
scope: Nested device parameters, drum pads, and remote-control pages
evidence: E4c, E4d, E7, E18e · D6, D7, D8
---

# Phase 4, session 4f — deep parameters and remote controls

> **Purpose.** Reuse the parameter core at depth and expose stable remote-control
> page readback for Phase 5.

## Scope

1. Extend device target acquisition through named layer-chain paths. Resolve a
   name to one current chain position and refuse duplicate names.
2. Descend one segment at a time. After each selection, confirm the parent path,
   nested state, device name, and current device position before continuing.
3. Prove recursive parameter enumeration and write at depth 2 with the same
   DirectParameter inventory and checkpoint rules as a top-level device.
4. Add drum-pad addressing by pad channel. Use
   `selectFirstInChannel(drumPadBank.getItemAt(i))`; do not translate a pad index
   into `selectFirstInKeyPad`.
5. Define remote-control page inventory with page index, page name, control
   index, control name, base value, `modulatedValue`, and mapping state.
6. Select a page, wait for two equal confirmed observations, write one remote
   with `setImmediately`, and verify the mapped parameter or remote readback.
7. Preserve the selected device path while the user changes the Bitwig
   selection. Restore any borrowed editor selection after the operation.

## Required boundaries

- Do not create or route modulators. Phase 5 owns topology authoring.
- Do not claim a layer name is unique without checking the complete visible
  chain bank.
- Do not insert into a non-existent layer index. That is a silent no-op.
- Do not promise recursive reach beyond the measured and configured bank
  windows.
- Do not make remote pages the fallback for arbitrary parameter enumeration.

## Exit criteria

1. The same parameter contract enumerates, changes, verifies, and restores a
   device at depth 1 and depth 2.
2. Every descent confirms the expected path and refuses an ambiguous or stale
   chain.
3. One populated drum pad is addressed through its channel and its nested device
   parameter is read and restored.
4. Remote pages enumerate by name and index. One control write lands and restores
   with `modulatedValue` reported.
5. A user selection change does not retarget a held deep write.
6. Bank-window and empty-layer failures report unreachable or absent correctly.
7. Focused tests, full conformance, the brain check, extension tests, context
   check, and `git diff --check` pass.

## Retrospective target

Record whether path confirmation can share observations with parameter
stabilization. Do not merge them unless the identity proof stays explicit.

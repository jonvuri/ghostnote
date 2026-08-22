---
title: Phase 4, session 4f — deep parameters and remote controls
kind: plan
state: complete
status: Complete. E58 records confirmed depth-2 and drum-pad parameter control,
        remote-control replay, selection isolation, and cleanup.
updated: 2026-08-22
parent: README.md
prev: 4e-plugin-parameter-proof.md
next: 4g-managed-fx-chain.md
scope: Nested device parameters, drum pads, and remote-control pages
evidence: E4c, E4d, E7, E18e, E58 · D6, D7, D8
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

## Result

Device addresses now carry recursive named-chain or drum-pad parents. Each
named descent confirms one complete layer inventory, rejects duplicate names,
selects the observed position, and confirms the nested cursor before the next
step. A current-chain sibling bank supplies the position proof because Bitwig
reports `-1` from `Device.position()` on a nested cursor.

The same DirectParameter contract enumerated 55 named Polysynth parameters at
depth 1 and depth 2. `OSC1 Pulse Width` moved from `0.5` to `0.55` and restored
to `0.5` at each depth. A Polysynth on Drum Machine channel 3 passed the same
proof through `selectFirstInChannel`.

The depth-2 device exposed nine named remote pages. `Osc1Pitch` moved from
`0.5` to `0.55` and restored to `0.5`. Readback included its finite
`modulatedValue`. Remote addresses keep both names and indices, and writes use
`setImmediately` with independent readback. A separate observer generation
binds page data to the confirmed track, device name, and current-chain position.
Complete page readback requires all eight bank rows and the exact existing-
control count.

A selection change at the batch boundary did not retarget the held depth-2
write. The borrowed selection was restored. Duplicate, empty, stale, and
outside-window routes remain separate refusals.

The full brain check passes 703 tests, including typecheck. Extension tests and
the fresh 146-method handshake pass. The focused live proof passes. Full live
conformance passes 54/54 with six expected skips. Exact fixture cleanup and the
final read-only 2k baseline pass. The context and staged diff checks pass. E58
records the complete proof.

Path confirmation and parameter stabilization share the serialized cursor and
target observations. Their acceptance rules remain separate: identity proves
the route, then two equal current-generation inventories prove parameter or
remote stability.

The review repair added regression coverage for stale remote generations and
malformed existing controls. Both cases now stay unstable.

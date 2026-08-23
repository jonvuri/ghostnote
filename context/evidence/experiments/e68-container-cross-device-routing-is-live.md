---
id: E68
kind: evidence
state: active
source: phase-5-session-5d-container-cross-device-routing
---

# E68 — Container cross-device routing is live [K] (2026-08-23)

**Verdict: an explicit container list retarget now runs through the checkpointed
executor, reaches one exact nested-device control, and reverses without residue.**

## Product path

`authorModulatorEdit()` now accepts `listIndex` for a container retarget. It
reads, edits, reports, and validates that exact `0x1a46` list. Omitting the index
on a multi-list preset still refuses before `apply()`.

The internal device address now models a named device-chain slot. Remote
verification can descend through `devcursor.selectFirstInSlot` and confirm the
first device in a Chain device's `CHAIN` slot. It selects and confirms the parent,
then repeats the descent. This rejects the silent empty-slot no-op. Slot keys use
a separate namespace from layer-chain names. A slot index other than 0 refuses
before `apply()`. This uses the measured E11e route.

Container replace and delete stay refused in this session. They need metadata
reference semantics across several device lists.

## Live proof

The focused probe created one owned instrument track and used the human-saved
E11e `gn_crossdev_outer` preset.

| Check | Result |
|---|---|
| Selected list | Outer container list 0, one `LFO` |
| Old route | `CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/1:CONTENTS/MIX` |
| New route | `CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/0:CONTENTS/F1FREQ` |
| Structural witness | Outer `LFO` page count was 1 |
| Behavior witness | Nested page 3 `FILTER`, control 0 `Filt Freq` |
| Samples | 10 samples at 80 ms intervals |
| Maximum divergence | 0.0023881105470904274 |
| Base spread | 0 |
| Automation | False on every sample |
| Reversal | Deleted the observed insertion; no unrestored state |
| Cleanup | Removed the owned track and restored the exact seven-track entry list |

The first two live observer attempts used layer-chain names. Both edits,
reversals, and cleanup passed, but nested inventory did not resolve. The final
probe used the measured `CHAIN` device slot and passed.

## Verification

- `npm run check`: 788/788 pass.
- Focused live-adapter and authoring tests: 108/108 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: all handshake and deploy-freshness checks pass.
- `npm run probe:phase5d-authoring`: all selected-list, route, behavior,
  reversal, and cleanup checks pass.

## Qualification

This result proves retarget on the outer list of one Chain preset. It does not
prove add, replace, or delete on a selected container list. It does not add a
public tool. Named-slot observation supports the first device only.

## Retrospective

A cursor selection call can succeed without moving. Prove a parent-child edge
before a nested observer can report stable data.

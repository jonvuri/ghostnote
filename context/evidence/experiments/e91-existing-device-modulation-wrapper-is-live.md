---
id: E91
kind: evidence
state: active
source: phase-5-session-5p-existing-device-modulation-wrapper
---

# E91 — Existing-device modulation wrapper is live [K] (2026-08-30)

**Verdict: one public workflow moves an existing native FX or VST3 device into
an owned modulated FX Layer, proves its observed state and active route, and
restores the same device through guarded reversal.**

## Public lifecycle

`wrap_existing_device_modulation` requires the complete current top-level name
and enabled-state order, one exact DirectParameter target, and one or more
manifest-backed modulators. It then records these ordered stages:

1. Insert and position the owned FX Layer.
2. Change the shipped entry name away and back to mark `Layer 1` as explicit.
3. Move the existing device into the empty entry.
4. Prove the complete parent-child edge, enabled state, parameter fingerprint,
   modulator pages, and active behavior.

The explicit name step prevents Bitwig from replacing the layer name when the
first device arrives. Every chain move carries the complete top-level name and
enabled-state guard into the extension immediately before mutation.

`reverse_existing_device_modulation_wrap` accepts only the exact checkpoint and
recorded owned insertion from this session. It checks the complete structure
and scalar fingerprint, moves the device out, restores its prior signal
position, proves the entry is empty, and deletes only the owned container.

## Live matrix

The final Bitwig Studio 6.0.6 run passed both cases:

- Native Delay+ preserved its enabled state and all 23 DirectParameter rows.
  Its fingerprint stayed
  `e9f860bc65c90016511980af293a8ce9d6b5c0414c6b013a81a9b2c1741a70d9`.
  Blur Amount reached a maximum divergence of `0.494476318359375` while its
  base stayed fixed.
- Zebra3 VST3 preserved its enabled state and all 2,185 DirectParameter rows.
  Its fingerprint stayed
  `9736b6a5c567a0dd90e1812d52391e11c9ee2c1f0a9bbc384fc4c489dc36d3e4`.
  Cutoff reached a maximum divergence of `0.45879265666007996` while its base
  stayed fixed.
- Both routes reported no automation. Both reversals restored one exact
  top-level device and removed the empty owned container.
- Cleanup removed the owned track and restored the exact five-track entry list.

The result states that relocation keeps the same instance. It reports observed
scalar preservation separately and does not claim byte-exact opaque-state
readback.

## Guard and observer repairs

The session also closed these live gaps:

- DirectParameter generations now start after exact cursor acquisition. The
  extension reuses rows only when track, device, nesting state, and route still
  identify the same target.
- Live container mapping now preserves the nested enabled-state field that the
  extension already returns.
- `chain.move` now checks the caller's complete top-level name and enabled-state
  order immediately before relocation.
- Public reversal accepts only the exact checkpoint that this session issued.
  Changed fields cannot reuse the owned insertion clearance.
- A post-write read failure returns the last proved checkpoint and an unknown
  current location. Reversal moves a tail insertion into the observable window
  before it checks and removes the empty container.

A saved Delay+ preset can expose its preset filename as the nested structural
name. This source form does not pass the name-preservation witness. Session 5q
owns explicit preset-source composition and must keep that distinction.

## Verification

- `npm run check`: 942/942 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: the fresh 149-method contract, Bitwig 6.0.6 API 25,
  and exact five-track baseline pass.
- `npm run probe:phase5p-wrapper`: native FX, VST3, both reversals, and exact
  cleanup pass.
- Description cohort `ghostnote-description-v18` is frozen at
  `56e8db1cb0ceb56579400b00e0011622054bd7a1ef9a042787937f4ed6dbd3ae`.

## Retrospective

Mark a shipped default entry name as explicit before filling it. Preserve every
identity field that the extension observes. Bind destructive checkpoints to the
exact issued value. Arm observer generations only after the exact target is
acquired.

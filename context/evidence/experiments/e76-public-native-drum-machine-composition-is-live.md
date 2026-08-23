---
id: E76
kind: evidence
state: active
source: dogfooding-d02-session-1
---

# E76 — Public native Drum Machine composition is live [K] (2026-08-23)

**Verdict: one public call creates a native Drum Machine and maps MIDI notes 36
through 51 to separate native devices on pads 0 through 15.**

## Public boundary

`compose_drum_machine` accepts one durable `trackId` and one through 16 pad
assignments. Each assignment contains one MIDI note and one exact native device
name. The schema exposes no UUID, path, preset, focus, selection, or pad-channel
control.

The operation resolves all exact native names before it writes. It reads the
complete top-level device order and enabled state. One recorded change inserts
one Drum Machine, then fills the requested empty pads in caller order. Each pad
write settles separately.

Readback returns the observed top-level kind and one exact MIDI-note,
pad-channel, and nested-device witness for each request. Missing or different
readback reports an unverified partial change. It does not hide the recorded
change ID.

Staged review added two hardening rules. A late pad-preflight failure returns a
recorded partial receipt after an earlier stage writes. Reversal includes only
pad stages that succeeded. Final verification uses two equal, complete
reachable-pad inventories. It rejects an extra nested device and any occupied
unrequested pad.

## Reversal boundary

The existing typed `drumpad.insertDevice` primitive now has product guards for
track identity, top-level container identity, pad range, and empty-pad state.
The pad inventory reports the complete nested device count and names for every
occupied reachable pad.

`revert_change` checks the complete top-level order and enabled state. It also
checks the exact occupied-pad set and requires one exact nested device in each
owned pad. A renamed device, a new occupied pad, or an extra device in an owned
pad blocks removal. A valid reversal removes only the owned Drum Machine.

## Live proof

The registered MCP surface reported 46 tools. `tools/list` exposed
`compose_drum_machine` with required fields `trackId` and `pads`. Each pad item
required `midiNote` and `deviceName`.

The live probe created one scratch instrument track in project `New 2`. One MCP
call created one Drum Machine with these mappings:

- MIDI 36 → pad 0 → `v1 Kick`
- MIDI 38 → pad 2 → `v1 Snare`
- MIDI 42 → pad 6 → `v1 Hat`
- MIDI 46 → pad 10 → `v0 Hat`

Complete top-level and nested readback verified all four mappings. Public
`revert_change` removed the complete Drum Machine. Cleanup removed the scratch
track. The exact entry track list was restored.

Fresh Codex session `01a030d1-b936-7460-841b-12d685238356` exposed the tool. It
reported only `trackId` and the 1–16 `{midiNote, deviceName}` assignments. It
called no Ghostnote tool and changed no Bitwig content.

## Verification

- Focused contract, adapter, surface, and cohort tests: 236/236 pass.
- Review-focused contract, adapter, reversal, and surface tests: 131/131 pass.
- `npm run check`: 846/846 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: all checks pass with 148 methods and hash
  `eb3391803ef4eea4`.
- `npm run probe:d02-drum-machine`: all checks pass through registered MCP.
- The review-hardening rerun of `npm run probe:d02-drum-machine` passes and
  restores the exact entry track list.
- The deployed extension was fresh before the final live proof.
- The live project has no scratch track, device, or clip residue.

## Retrospective

Return a partial receipt when a later stage fails after an earlier write. Verify
owned containers from a complete inventory, not from first-device witnesses.

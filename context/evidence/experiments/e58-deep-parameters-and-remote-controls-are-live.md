---
id: E58
kind: evidence
state: active
source: phase-4-session-4f-deep-parameters-and-remotes
---

# E58 — Deep parameters and remote controls are live [K] (2026-08-22)

**Verdict: confirmed named descent reaches DirectParameters at depth 1 and
depth 2, drum-pad channel selection reaches its first device, and named remote
controls write and restore with modulated-value readback.**

## Contract and target confirmation

Device addresses can now carry a recursive named-chain or drum-pad parent.
Each named-chain descent reads the complete configured layer and device banks.
It rejects duplicate names, empty layers, full-window ambiguity, and stale
cursor replies. The cursor confirms the parent path, nested state, device name,
and current-chain position before parameter observation starts.

Bitwig reports `Device.position() == -1` for a nested device cursor. A sibling
device bank on the current chain supplies the identity and position proof. The
top-level equality check remains as a separate fallback. Parameter and remote
inventories require target-bound generations. Remote settlement records the
observed track, device name, and current-chain position. Each page then requires
two equal observations from that generation.

Drum-pad addresses use a channel number. The extension selects the target with
`selectFirstInChannel`. It does not reinterpret the channel as a MIDI key.

Remote-control addresses contain the page name and index and the control name
and index. The inventory reports base value, `modulatedValue`, mapping state,
and automation state when available. A write uses `setImmediately` and requires
independent exact readback. A page settles only when all eight bank rows are
present and its parsed controls equal the reported existing-control count.

## Live proof

The probe created one owned track in project `26.05-2 moon`. It built nested FX
Layer containers with Polysynth at depth 1 and depth 2. Each Polysynth exposed
55 named DirectParameters. `OSC1 Pulse Width` moved from `0.5` to `0.55`, then
restored to `0.5` at both depths.

The probe also put Polysynth on Drum Machine channel 3. Channel-based selection
reached that device. The same 55-parameter inventory and exact write and restore
passed.

The depth-2 Polysynth exposed nine named remote pages. The selected `Osc1Pitch`
control moved from `0.5` to `0.55`, then restored to `0.5`. Each read included a
finite `modulatedValue`.

A selection change fired at the write batch boundary. The held depth-2 address
still received the parameter write. The borrowed selection was restored. This
proves that a user selection change does not retarget the confirmed cursor.

## Cleanup and verification

The focused probe removed its owned track and restored the seven-track project.
Full live conformance passed 54 rows with six expected skips. Exact-ID cleanup
then removed the two generated conformance tracks. The final read-only 2k
baseline passed the complete 7-by-8 launcher grid and both accepted observation
records.

The full brain check passes 703 tests, including typecheck. Extension tests, the
fresh 146-method handshake, and the focused live proof pass. The context and
staged diff checks pass.

## Retrospective

Path confirmation and parameter stabilization can share the serialized device
cursor and its target observations. Keep the identity check and the two-equal
parameter-generation check separate. A nested cursor needs an explicit sibling
identity check because its reported position is not usable.

The review repair added a separate remote generation and complete bank-row
validation. A stale same-named device reply and a malformed existing control now
remain unstable instead of entering a checkpoint.

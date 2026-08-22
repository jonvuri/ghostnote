---
id: E62
kind: evidence
state: active
source: phase-4-session-4i-device-surface
---

# E62 — The public device surface is live [K] (2026-08-22)

**Verdict: six registered MCP tools now expose device inspection, parameter
discovery, insertion, scalar control, bypass, and directed deletion. The fake
and live paths pass with exact cleanup.**

## Frozen cohort

Description version `ghostnote-description-v5` adds `inspect_devices`,
`inspect_device_parameters`, `add_device`, `set_parameter`,
`set_device_enabled`, and `delete_device`. Its SHA-256 fingerprint is
`0bda24861be2f57ddd1f39188d4f3c7d70cd3da67ea6ffd81d9ae4fe6d98cb68`.
Versions 1 through 4 remain frozen.

The surface uses explicit `bitwig`, `vst3`, `clap`, and `preset` sources. The
generic plugin source stays rejected. Device positions are current positions,
not ids. A structural edit requires a new complete inventory.

## Parameter and safety result

The public inventory returns DirectParameter ids without prior parameter
knowledge. Typed display, modulation, automation, origin, and discrete metadata
appear only when observed. Empty or negative discrete metadata does not appear.
Optional remote pages use exact returned page and control names and positions.
The live top-level sample reported explicit observer instability and returned no
partial remote inventory. Earlier deep-route proof remains the accepted stable
remote-control path.

Direct writes use returned ids or exact remote selectors. Bypass writes use the
same fresh name-and-enabled sequence guard. Both paths use exact readback and
report partial completion if a later setting fails. Directed deletion has its
own destructive tool. It deletes from the highest current position and states
that an existing device cannot be reconstructed.

## Registered MCP live result

One owned empty track received a Polysynth, Zebra3 VST3, Zebra3 CLAP, and a
Sampler preset through the registered MCP server. Complete inspection returned
positions 0 through 3 and enabled state for all four devices.

Polysynth returned 55 named DirectParameters. The probe selected `OSC1 Pulse
Width` from the result, changed its normalized base value, verified the exact
readback, and restored it. It bypassed Polysynth, verified the state, and
restored it. The final deletion removed all four devices. Track cleanup restored
the exact seven track ids and entry selection.

| Public operation | Time | E61 budget |
|---|---:|---:|
| VST3 insert | 1,728 ms | 2,000 ms |
| CLAP insert | 1,729 ms | 2,000 ms |
| Native inventory | 1,199 ms | 3,500 ms |
| Top-level scalar change and exact readback | 5,938 ms | 6,000 ms |
| Bypass and exact readback | 1,118 ms | not separate |
| Four-device directed cleanup | 14,443 ms | not separate |

The first public insertion design took about 3,150 ms because it repeated
complete device-order reads from the managed workflow. The final path accepts
`expectedDevices` from the latest complete inspection, checks that exact order,
and uses the common executor's proved insertion mint. This removed the redundant
reads and kept both plugin samples inside E61.

## Verification

The focused public-surface suite covers more than eight discovered parameters,
typed metadata, exact remote selectors or explicit instability, exact scalar and
bypass reversal, four source formats, and exact cleanup. The full brain check
passes 758/758. Extension tests pass. Full live conformance passes 54/54 with six
expected skips. Its two fixture tracks were removed, and the accepted seven-track
baseline passes.

## Retrospective

The old generic plugin wording caused no caller migration. No alias is needed.
Direct and remote observers do not share one stable generation. Separate public
views preserve exact standing. The top-level live remote view still reported
instability, so it returned no partial selectors.

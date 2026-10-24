---
title: Device and parameter inputs
kind: note
state: active
updated: 2026-10-24
---

# Device and parameter inputs

User outcomes include loading an instrument, setting its sound, building a
layered chain, comparing alternatives, and keeping the selected result.

## Current boundary

The product reads device order and controls, appends devices, enables and
deletes them, moves and copies supported routes, composes containers, and
duplicates, renames, or solos layer chains. DirectParameter IDs work on native,
VST3, and CLAP devices. Remote-page controls are a separate view.

Sources: [v53 descriptions](../../../evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json),
[device implementation](../../../../brain/src/surface/agent-native-devices.ts),
[E254](../../../evidence/experiments/e254-device-control-identity-and-route-claims.md),
and [E330](../../../evidence/experiments/e330-update-audit-614-acceptance.md).

Device positions are not persistent IDs. Layer-chain names must be unique.
`read_devices` exposes container chains only at top-level positions 0–2.
The control setter admits 64 settings on at most four device routes. Values
are normalized, with display text and typed domains where observed. An empty
plug-in inventory can mean that the engine is off or the plug-in is unloaded.

Composition has two backends. A narrow native shape uses an offline preset;
other admitted shapes use guarded host stages. The shape limits and six-unit
work budget both apply. A plug-in counts two units; modulation adds further
units. A nominally valid five-chain shape can exceed the work budget.

## Work records

| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |
|---|---|---|---|---|---|---|
| DP-1 | Physical-unit parameter input | Candidate | — | `device.units` write | bwpreset units and descriptors; openwig normalization leads | Each parameter needs an authoritative descriptor and timebase. Prove forward and inverse conversion, boundaries, discrete choices, and host display. Preserve refusal for other parameters. |
| DP-2 | Remote-page creation and target assignment | Candidate | — | `remote-pages` create, `remote-pages` write | bwpreset page and remote builders | Separate reading and setting a control from creating its page. Prove page ownership, target paths, duplicate names, target deletion and reindexing, and persistence. |
| DP-3 | Wider nested navigation, chain coverage, and device moves | Candidate | — | `device.nested-reach` read, `device.nested-reach` move-or-copy | Existing route guards; DrivenByMoss abstractions | Name the blocked workflow first. Measure observer, bank, and traversal costs. Extend one route with exact owner and selection checks. No blanket arbitrary nesting claim. |
| DP-4 | More container and slot types | Candidate | — | `container.other-types` create | bwpreset slot import; existing composer | Define signal routing and preserve opaque device state. Test copied versus moved instances, automation, slot occupancy, and persistence. |
| DP-5 | Preset and device discovery beyond explicit IDs and paths | Candidate | — | `device.discovery` read | acidcat library index; typed browser paths | Separate offline search from live browser selection. Return exact identities. Confirm the inserted device independently. See MA-1 and MA-2 for file search and insertion. |
| DP-6 | Export a device's current state as a preset file | Candidate | action-based route only; no file verification | `device.preset-export` create | Control Deck bitwig_save_device_preset: selects the device in the editor, invokes the Save to Library action, then sends Enter after fixed sleeps; bwpreset authors files offline from definitions, not from a live device | A named action is not an identity-safe route (D13; action evidence records focus hazards). Prove that a preset file appeared with the requested name and that its bytes load back to the same device state. Decide whether the operator keeps save authority, as current live-work rules assume. Check whether a typed API route exists on the current build before adopting the action. |

Status, qualifier, and cell values come from [`data/records.json`](data/records.json); `data/check_records.py` verifies that this table agrees with it. IDs are navigation keys, not priorities. External implementations on these rows, with pinned paths, predicates, and counterexamples, are in the [external register](external-register.md#devices-and-parameters).

## Evidence that affects priority

[E98](../../../evidence/experiments/e98-parameter-units-and-semantic-writes-fail-closed.md)
found no documented inverse from display text to a normalized value. A few
observed points do not establish that inverse. Native preset units also need
a proved bridge before they can drive arbitrary live DirectParameters.

Control Deck has a real direct-ID setter, but its common path uses 128 steps
and a 0.02 tolerance. Its [controller](../../../../reference/bitwig-control-deck/controller/ControlDeck.control.js)
is not a precision upgrade. WigAI's
[facade](../../../../reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java)
uses remote pages in the inspected parameter path. An eight-control API is
not equivalent to the full parameter inventory.

bwpreset [units](../../../../reference/bwpreset/bwpreset/units.py),
[builder](../../../../reference/bwpreset/bwpreset/build.py), and
[slots](../../../../reference/bwpreset/bwpreset/slots.py) provide specific
offline leads. Its high-level authoring API expects a Grid root. General
binary syntax support does not make that API a stock-device editor.

Control Deck has an action-based preset export route (DP-6). It does not
verify a saved file or its reloaded state. bwpreset builds files offline from
definitions; it does not read a live device. The action-route hazards
recorded for SM-11 apply to the Control Deck route.

## Planning inputs

The later comparison should separate breadth of reachable targets from ease
of expressing a value. Physical units can improve everyday use without
adding a new device type. Wider banks can add reach but also permanent host
cost. Remote-page authoring is independent of the Phase 11 Grid tool plan.

For an A/B workflow, current tools already compose or duplicate chains, solo
one chain, and move the winner out. Those steps are not atomic, and layer
metadata does not follow extracted devices. A convenience tool is a different
proposal from adding a missing host primitive.

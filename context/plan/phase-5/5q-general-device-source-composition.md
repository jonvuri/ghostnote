---
title: Phase 5q — general device-source composition
kind: plan
state: complete
status: Complete at the current four-entry boundary. Session 5r owns wider composition.
updated: 2026-08-31
parent: README.md
evidence: D1, D2, D7, D15, D16, E62, E71-E73, E92
---

# Phase 5q — general device-source composition

## Purpose

Remove the native-only composition restriction. Build entries from the same
explicit source kinds that Ghostnote already inserts or moves.

## Scope

1. Define one device-source union: exact native catalog name, VST3 class UID,
   CLAP id, explicit user preset path, existing-device move, or existing-device
   copy.
2. Give every container entry a unique caller-supplied entry name. Use that
   identity for targets and readback. Permit repeated device names and repeated
   source kinds.
3. Insert new sources at top level through the existing guarded device path,
   then relocate them into the owned container. Move existing sources without
   replacing their state.
4. Treat preset devices and embedded samples as opaque device state. Do not
   splice their binary bodies into the container template.
5. Support per-device and outer-container modulators with general targets.
6. Return each source insertion or relocation receipt, the final complete
   structure, and every modulation witness. Preserve all completed stages after
   a later failure.
7. Add guarded reversal in reverse stage order. Preserve pre-existing devices
   unless their exact move-back guards agree.

## Result

`compose_device_sources` and `reverse_device_source_composition` implement the
complete guarded lifecycle. One request composes native, VST3, CLAP, and
sampled-preset sources in caller order. A separate request composes an existing
copy and move. This split is required because the current complete chain window
accepts at most four entries. Session 5r owns the wider entry bank.

Outer FX Layer routes late-bind only to entry 0. Live routes that targeted
entries that did not yet exist caused the complete outer list to disappear.
Later entries can use preset-local modulation or no modulation. Session 5r owns
later-entry outer routes with a wider pre-authored or measured shape.

Each accepted stage returns a receipt and updates one exact issued checkpoint.
The checkpoint records the entry names that exist during partial preparation.
Reversal uses those names, restores moved existing devices, deletes only owned
insertions and copies, and removes only a proved empty owned container.
Review repairs require that empty proof for every checkpoint state. They reject
intervening top-level edits after extraction and compare the final nested state
with every completed entry.

## Acceptance criteria

- One request composes native, VST3, CLAP, and sampled-preset sources in caller
  order. A separate request covers existing move and copy sources. Combining
  all five categories needs a fifth entry and remains in 5r.
- Two entries can contain devices with the same observed name and remain
  independently addressable through unique entry names.
- An invalid source refuses before its stage. Earlier completed stages remain
  explicit and reversible.
- Existing-device moves preserve their observed scalar fingerprints. Copies
  are reported as new instances and never described as state-identical.
- Complete readback proves every entry, device order, enabled state, and target
  witness.
- Reversal restores every pre-existing device and removes only owned inserted
  devices and the empty owned container when guards agree.
- Focused source matrices, surface conformance, the full brain check, extension
  tests, and live cleanup pass.

## Out of scope

- Raising observer or entry capacity.
- New container shapes beyond those proved in 5o.
- Drum Machine pad composition, which remains a separate per-note workflow.
- Parameter-base writes; use `set_parameter` after composition.

## Handoff

Session 5r removes the remaining shape, position, and capacity restrictions.

---
title: Phase 5k — semantic preset modulation inspection
kind: plan
state: complete
status: Complete. Public semantic inspection binds every list or refuses the complete result.
updated: 2026-08-27
parent: README.md
evidence: D1, D2, D3, E13, E68, E70, E71, E86
---

# Phase 5k — semantic preset modulation inspection

## Purpose

Let an agent inspect one human-saved preset before it requests a topology edit.
Return semantic device and container locations instead of raw modulator-list
indexes.

## Scope

1. Add a read-only preset inspection path for an explicit absolute
   `.bwpreset` path.
2. Report the file fingerprint, host tier, container kind, ordered entries,
   device positions and names, semantic modulator locations, and public
   modulator inventories.
3. Represent a location as `self`, `container`, or an ordered entry and device
   path. Use positions plus observed names so duplicate names remain distinct.
4. Bind each semantic location to its internal `0x1a46` list inside the server.
   Do not return the list index.
5. Express decoded targets with the general parameter target from 5j when the
   route resolves. Mark an unresolved route explicitly.
6. Require the file fingerprint on a later write so a stale inspection cannot
   edit a different file.

## Acceptance criteria

- Plain native, native container, VST3, CLAP, sample-less Sampler, and sampled
  Sampler fixtures return complete, typed results.
- Each reported semantic location maps to exactly one modulator list.
- Duplicate entry or device names remain addressable by their ordered path.
- An ambiguous or incomplete mapping is reported as unsupported. It is never
  guessed.
- Results contain no raw route string, list index, object id, footprint, stub,
  or byte offset.
- The operation makes no Bitwig or preset-file change.
- Focused schema and fixture tests and the full brain check pass.

## Out of scope

- Topology writes.
- Donor-library expansion.
- Live container creation or device movement.

## Handoff

Session 5l uses the internal binding to complete every operation on a selected
container list. Session 5n exposes the read result beside public authoring.

## Result

Complete. `inspect_preset_modulation` returns a fingerprint, host tier and
format, container and entry structure, semantic locations, and public modulator
inventories. It supports the required six fixture classes. Repeated names remain
addressable by ordered positions. An incomplete mapping is unsupported.

The result contains no binary selector. Known targets use the 5j
DirectParameter identity. Unknown targets are explicit. The fingerprint guard
is ready for the 5l write boundary. The full brain check passes 906/906. [E86](../../evidence/experiments/e86-semantic-preset-modulation-inspection-is-complete.md)
records the exact matrix and qualifications.

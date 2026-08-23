---
title: Phase 5h — public structure composition
kind: plan
state: planned
status: Planned after 5g. Expose one format-hidden composition tool.
updated: 2026-08-23
parent: README.md
evidence: D1, D3, D15, D16, E4g, E4h, E62, E65-E71
---

# Phase 5h — public structure composition

## Purpose

Expose the proved 5g composition path through one public write tool. Let an
agent request an ordered Instrument Layer structure with named native devices,
modulators, and targets without knowledge of preset files or binary format.

## Public grain

Add one tool, provisionally `compose_device_structure`. Composition has a new
object boundary: one request creates one complete container and its nested
device and modulation topology. It does not belong in `insert_device` or
`author_modulators`.

## Scope

1. Accept a durable track id and an ordered list of one through four entries.
2. Accept each native device by exact catalog name. Keep the first public
   cohort native-only. Refuse duplicate device names until nested readback can
   identify equal-name entries without ambiguity.
3. Accept optional named modulator types, named target recipes, and normalized
   amounts for each entry.
4. Resolve the one shipped template and all GUID, chain-span, list, donor,
   route, and witness details inside the composition layer.
5. Use the complete current top-level device order and enabled state as the
   executor guard.
6. Return the requested and observed entry order, observed device names,
   public modulator inventory, exact witness results, validation warnings, and
   the recorded change.
7. State the reversal boundary: `revert_change` removes the inserted container
   while its last proved top-level position remains valid.
8. Follow the recorded-write boundary. If cancellation or an error occurs after
   insertion is recorded, propagate it. Never report that nothing was written.
9. Add the tool to a new frozen description cohort and the complete surface
   conformance test.

## Hidden controls

The public schema and result must not contain these details:

- a preset path or template file name;
- a device UUID;
- a chain marker, byte span, or list index;
- a donor asset id;
- an internal modulation route;
- a footprint, reference stub, or byte offset.

## Acceptance criteria

- One public tool creates the complete 5g structure through the ordinary
  Workspace and executor seam.
- Schema tests prove that all binary and asset controls stay hidden.
- Exact native-device name resolution refuses an unknown or ambiguous name
  before the project write.
- Entry count, duplicate-name, target compatibility, and modulator support are
  validated before `apply()`.
- The result reports one recorded insertion and distinguishes requested,
  observed, and verified facts.
- Failed live witnesses remain post-write verification failures. They do not
  become false pre-write refusals.
- Cancellation before insertion writes nothing. Cancellation after a recorded
  insertion keeps the recorded change visible.
- Offline tests cover the complete public request, each refusal boundary,
  format-detail hiding, recorded change, and reversal wording.
- A focused live call creates the planned two-entry structure, proves every
  entry and behavior witness, reverses it through `revert_change`, and restores
  the exact entry track list.
- `npm run check`, the extension Gradle tests, deploy freshness, and the focused
  public live probe pass.

## Out of scope

- User-supplied templates and arbitrary preset paths.
- VST3, CLAP, and preset-device entries.
- Embedded samples and sample selection.
- More template shapes or more than four entries.
- Parameter values. Use the existing device parameter tools after composition.
- General public editing of an arbitrary container preset.

## Retrospective target

Keep asset mechanics below the public boundary. Report a recorded project
change even when later verification or cancellation fails.

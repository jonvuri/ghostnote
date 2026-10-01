---
title: Phase 8f2 reference codec outcome
kind: outcome
state: complete
updated: 2026-10-01
next: ../../plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md
---

# Phase 8f2 outcome

## Result

The [pure TypeScript library](../../../brain/src/document/index.ts) implements
Ghostnote Document 1.0 FIELDS and JSON parsing, shared structural and semantic
validation, canonical serialization, and content/dependency hashes. It uses
exact rational arithmetic. Separate import APIs decode binary64 values exactly
and report displacement, promotion, changed overlap intervals, and collisions.

Guarded patch and desired materializers preserve the defined defaults and
annotations. They reject partial bases and dangling references. Patch edits
make retained claims stale in dependency order. Explicit replacements can
reaffirm a claim. Removing a claim leaves event state unchanged. Undo preserves
stale state. Portable pressure remains represented.

The [versioned corpus](../../../spec/ghostnote-document-v1/conformance/v1/README.md)
links all 32 rules to tests. The eight authored input pairs and independent
hashes remain unchanged. Generated canonical pairs match them. The golden
patch produces the authored result. Historical header, ID, extra-note, and
empty-output cases have explicit source paths and adaptations.

The [Model format reference](../../../spec/ghostnote-document-v1/MODEL-REFERENCE.md)
has revision 1, a checked content identity, validated examples, and task-selected
optional sections. The [guide](../../../spec/ghostnote-document-v1/CODEC.md)
defines native I/O, strict errors, offline commands, ownership, and extraction.
A temporary standalone consumer compiles and checks the independent complete
hash without a runtime package dependency.

## Specification corrections

R28 now requires each accepted document to fit both canonical encodings within
8 MiB. An input-only limit could accept FIELDS that its converted JSON reader
would refuse. Native input uses its JSON size; decoded FIELDS uses its source
and canonical sizes. Count thresholds can be unreachable before this byte bound.

R07 defines changed overlap intervals within a clip, including different
channels and pitches. R28 bounds import analysis to 131072 overlap pairs per
plane. A larger pair set produces a resource error and no partial report.
The codec itself still represents overlaps. These corrections change no golden
example or hash.

## Verification

- Brain typecheck and all 1458 tests pass, including 252 document tests.
- `npm run document:conformance` passes. Generated schema, canonical pairs,
  reference identity, prompts, and measurements match their maintained sources.
- JSON Schema 2020-12 meta-schema validation and local Ajv compilation pass.
  Structurally valid off-grid timing still fails the semantic validator.
- `npm run document:standalone` passes and removes its temporary consumer.
- Context/specification links and diff whitespace checks pass.

[Measured reference sizes](../../../spec/ghostnote-document-v1/conformance/v1/measurements.json)
are 3575 bytes for Core, 4650 with Patch, 5856 with Timing overlays, and 7916
with all sections. The retained FIELDS instruction plus example is 729 bytes.
The new reference has broader field, coverage, timing, patch, and lifecycle
requirements. Provider token counts for the new prompts are unavailable;
available historical full-prompt counts have their own scope. No provider
request was made. Matrix and addendum denominators remain separate.

`normal-v1`, cache code, live projects, and frozen benchmark files are unchanged.
Temporary Python cache files from read-only baseline inspection were removed.
The session changes are staged for review and are not committed.

## Handoff and retrospective

Start [8f3](../../plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md).
Use the codec and [host handoff](../../../spec/ghostnote-document-v1/HOST-HANDOFF.md)
for mappings, partial bases, identity recovery, D9/D21 migration, and cache rules.
8g, 8h, 8i, and 9b retain their implementation and publication boundaries.

For a byte limit, test canonical output in each encoding as well as input.
Use minimal fixtures for a type-specific case when a paired example contains
several claims. This prevents a test from selecting the wrong claim.

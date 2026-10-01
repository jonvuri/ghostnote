---
title: Phase 8f2 — Reference codec and model format reference
kind: plan
state: planned
status: Ready. 8f1 supplies the specification, schema, paired examples, and case inventory.
updated: 2026-10-01
parent: 8f-consolidated-compact-bar-and-cache-contracts.md
prev: ../../archive/outcomes/PHASE-8F1-DOCUMENT-SPECIFICATION.md
next: 8f3-ghostnote-bindings-and-cache-contracts.md
evidence: E109, E116, E196, E209, E213; D25
---

# Phase 8f2 — Reference codec and model format reference

## Purpose

Implement the [8f1 specification](../../../spec/ghostnote-document-v1/SPEC.md).
Provide a reference parser and canonical serializer for each encoding, one
semantic validator, and lossless conversion. Provide a compact versioned
Model format reference for model prompts and skills.

## Entry and implementation boundary

Read the specification and its [field rules](../../../spec/ghostnote-document-v1/FIELDS.md),
[grammar](../../../spec/ghostnote-document-v1/fields.ebnf),
[schema](../../../spec/ghostnote-document-v1/schema.json),
[paired examples](../../../spec/ghostnote-document-v1/EXAMPLES.md), and
[case inventory](../../../spec/ghostnote-document-v1/CONFORMANCE.md).
The examples are authored inputs with independent expected hashes. Verify and
regenerate them through the codec. The 8f1 checks are not codec conformance.
Review existing pure musical modules and the retained benchmark
adapters for regression cases. Keep the frozen adapters and results unchanged.

Use a pure library boundary that the TypeScript brain can consume and Phase
9b can extract. It must work without Bitwig, cache state, credentials, or a
provider service. Define native objects for this boundary. Other runtime
domains may use different types.

## Reference implementation

1. Implement FIELDS and JSON parsing into the same semantic document model.
   Validate the declared version, structure, field types, and semantic rules.
2. Implement canonical serializers and content hashing. Conversion must
   preserve notes, metadata, patches, coverage, and every supported overlay.
3. Use exact rational arithmetic for external timing. Use integer ticks for
   realized timing where useful. Do not route timing through floating-point
   arithmetic during parse, render, conversion, or hashing.
4. Implement explicit acquisition/import normalization utilities under the
   8f1 policy. Keep them separate from lossless codec conversion. Accept host
   numeric inputs only through that declared boundary.
5. Return useful errors with location, rule, and offending field or reference.
   Define bounded input size and arithmetic limits. Handle unsupported versions
   and extensions under the specification's policy.
6. Support accepted noncanonical input with canonical output. If a recovery
   API is justified, separate it from conformance validation and report the
   recovery. Do not infer missing musical values or silently discard fields.
7. Add a small offline entry point for validation and conversion, suitable for
   examples and a future clean-consumer check.

## Conformance coverage

Tests must cover meaningful behavior and independent expected values:

- FIELDS-to-model and JSON-to-model agreement for every fixture;
- lossless cross-encoding round trips and canonical serialization stability;
- equal semantic hashes across equivalent encodings;
- complete documents, empty clips, sparse patches, and no-op patches;
- rational reduction, signed overlay components, large values, and invalid
  denominators;
- onset and duration normalization, cell boundaries, minimum duration, and
  normalization idempotence;
- duplicate IDs, missing fields, conflicting bindings, unknown versions,
  unsupported extensions, and bounded-input failures;
- all initial overlay types, stable references, dependencies, and dangling
  references;
- overlay removal without note changes, stale interpretations after edits,
  and separation of intended timing from normalization displacement; and
- defaults, clearing, omission, and preservation semantics.

Link every normative rule to its test or fixture. Reuse suitable retained
failure cases as offline regressions, including header failures, renamed IDs,
extra notes, and empty outputs. A benchmark response is not automatically a
valid version 1.0 document. Record any adaptation needed for a regression case.

## Model format reference

Produce one canonical **Model format reference**, also called the format
card. Include its format version and content identity. State the core syntax,
units, normalized timing boundary, defaults, complete/patch distinction,
overlay rules, and common errors. Prefer FIELDS examples for model use.

Provide a short core reference with optional overlay sections selected by the
task. Keep one maintained source for prompt and skill use. Validate every
example through the codec and link each instruction to a normative rule.
Do not require a repository tutorial or expose cache mechanics.

Measure the complete reference-plus-example prompt size against the retained
FIELDS baseline. Report bytes and available provider-token counts separately.
Any provider-bearing validation needs a new bounded scope and approval.
A new full selection matrix is not a prerequisite.

## Outputs and acceptance

- Pure reference library and offline validation/conversion entry point.
- Versioned conformance corpus with a rule-to-test index.
- Canonical examples and hashes for both encodings.
- Model format reference with tested examples and prompt-size measurements.
- A usage guide for the I/O boundary and future standalone extraction.

Every supported document and patch round-trips without semantic loss.
Codec operations do not quantize. Normalization runs only through its declared
API. The normative corpus and focused regression checks pass. The appropriate
brain checks, context links, and diff checks pass. Fixture and generated
artifacts have an explicit owner and baseline. No live project change is
needed for pure conformance.

## Out of scope

Cache implementation, stable live integration, general notation export,
provider selection, and external publication belong to later work.

## Retrospective target

Record any rule that was difficult to implement or explain in the model
reference. Correct the specification and examples together when needed.

---
title: Phase 8f — Document format and cache contracts
kind: plan
state: planned
status: 8f1 is complete. Start 8f2, then 8f3, before shadow cache implementation.
updated: 2026-10-01
parent: README.md
prev: 8c4f-full-matrix-decision.md
next: 8g-shadow-project-cache.md
evidence: E109, E114-E121, E128-E139, E209, E212-E213; D21, D23, D25
---

# Phase 8f — Document format and cache contracts

## Entry and purpose

[D25](../../decisions/d25-fields-json-document-format-and-publication.md)
selects FIELDS and JSON after operator review of the completed benchmark work.
It opens this phase through an explicit product decision with evidence limits.
The [8c4f closeout](8c4f-full-matrix-decision.md) retains the history.
Do not infer a new frozen benchmark pass from this decision.

Create one version 1.0 document model with lossless FIELDS and JSON encodings
for exact model note and rhythm communication. Prefer FIELDS for model I/O.
Use JSON or equivalent native objects near that boundary. Other internal types
must suit their domains. Settle the separate host binding and cache contract.

## Session order

| Session | Work | Required handoff |
|---|---|---|
| [8f1 outcome](../../archive/outcomes/PHASE-8F1-DOCUMENT-SPECIFICATION.md) | Complete: shared semantics, grammar, JSON schema, rational timing, and overlays | [Specification and case inventory](../../../spec/ghostnote-document-v1/SPEC.md) |
| [8f2](8f2-reference-codec-and-model-format-reference.md) | Reference codec, canonicalization, tests, and model format reference | Tested library, corpus, examples, format card, and size measurements |
| [8f3](8f3-ghostnote-bindings-and-cache-contracts.md) | Host mappings, identity, overlay lifecycle, migration, verification, and cache contracts | Explicit contracts and cases for 8g, 8h, and 8i |

Start each child after the preceding handoff meets its acceptance criteria.
Revise specification and implementation together when a later child exposes
a concrete defect. Version 1.0 is the target specification; external release
and standalone packaging remain in Phase 9b.

## Common requirements

- One event identity set owns realized note state. Complete documents and
  sparse patches have deterministic default, clearing, and preservation rules.
- Both encodings preserve all supported notes, metadata, coverage, patches,
  and overlays. Empty clips are supported.
- Timing uses exact rational strings. Realized note timing is normalized to
  the accepted `1/512` plane at acquisition/import. Codec conversion is lossless
  after that boundary. Nominal rhythmic intent can retain unrestricted rationals.
- D23 remains accepted. Duration rounding and minimum-duration behavior must
  be specified. Existing low-level D9 behavior changes only through an explicit
  migration and live acceptance gate.
- Optional overlays cover nominal rhythm, groove, harmony, roles and motifs,
  meter, tempo, and regions. They have stable references, dependencies, and
  provenance. Removing an overlay leaves notes unchanged. Edits must preserve,
  recompute, invalidate, or remove interpretations under defined rules.
- The model format reference is versioned and checked against the specification.
  Its examples pass the reference codec. Include overlay vocabulary only when
  needed by the task.
- All fields have declared authority, coverage, defaults, and writability.
  The benchmark's omissions do not decide the product's field coverage.
- The public document keeps internal observer, queue, and proxy mechanics out
  of musical syntax. Useful coverage and health facts remain visible.

## Verification and evidence

Map every normative rule to a conformance fixture. Check both encodings,
canonical hashes, patch behavior, timing normalization, overlay lifecycle,
invalid inputs, and relevant historical failure cases. Adapt retained cases
explicitly; do not rewrite frozen benchmark packages.

Keep provider-dependent music results separate from language conformance.
Measure the new model reference and examples for size. Any paid model check
requires a new bounded plan and approval. No new selection matrix is required.

Use 8d and 8e evidence for lifecycle and limits. Focused live checks in 8f3
may settle an unresolved binding rule. Restore their fixtures to baseline.
Implementation and promotion of the cache remain in 8g and 8h.

## Exit criteria

All three child sessions meet their criteria. The specification, codec,
conformance corpus, model reference, host mappings, migration decisions, and
cache contracts have explicit owners. Pure checks, context links, and diff
checks pass. Any necessary live evidence includes cleanup.

Hand [8g](8g-shadow-project-cache.md) its shadow contract,
[8h](8h-cache-promotion-and-interface-simplification.md) its integration and
migration contract, and [8i](8i-agent-native-hybrid-dogfood.md) its fresh agent
trials. Earmark accepted artifacts for
[9b](../phase-9/9b-compact-bar-publication-review.md).

## Retrospective target

Record which requirement needed host evidence and which was a language-design
choice. Keep acquisition loss, codec conformance, and musical task errors
separate in the handoff.

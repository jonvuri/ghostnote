---
title: Current state
kind: status
state: active
updated: 2026-10-01
phase: phase-8-agent-native-live-engine
session: phase8f1-document-specification-complete
---

# Now

[8f1 is complete](archive/outcomes/PHASE-8F1-DOCUMENT-SPECIFICATION.md).
[Ghostnote Document 1.0](../spec/ghostnote-document-v1/SPEC.md) defines FIELDS and
JSON, fields/defaults, coverage, complete state, patches, rational timing,
overlays, canonicalization, hashes, and resource limits. It is a target contract,
not an external release. [D25](decisions/d25-fields-json-document-format-and-publication.md)
remains the operator selection.

Start [8f2](plan/phase-8/8f2-reference-codec-and-model-format-reference.md) next.
Read the specification, field table, grammar, schema,
[paired examples](../spec/ghostnote-document-v1/EXAMPLES.md), and
[conformance inventory](../spec/ghostnote-document-v1/CONFORMANCE.md).
Schema and independent example calculations pass. The reference codec,
conformance corpus, and model format reference are not built.

Onsets floor to `1/512`. Durations round to nearest, ties up, with a one-cell
minimum. The import step reports displacement; conversion does not quantize.
Nominal rhythm remains exact. Overlay edits use dependency bases and stale state.
[The host handoff](../spec/ghostnote-document-v1/HOST-HANDOFF.md) assigns unresolved
field mappings, partial bases, identity, D9/D21 migration, and cache rules to 8f3.

Keep `normal-v1`, cache code, live projects, and frozen benchmark artifacts
unchanged during pure codec work. Keep the matrix and addendum denominators
separate. 8g implements the shadow cache; 8h integrates the format; 8i tests
fresh agent use. [9b](plan/phase-9/9b-compact-bar-publication-review.md) owns publication.

## Retrospective

Use the field/default table and rule-to-case index together. Check onset and
duration displacement separately. Store primary specification artifacts in
top-level `spec/`; keep session memory and outcomes in `context/`.

---
title: Current state
kind: status
state: active
updated: 2026-10-01
phase: phase-8-agent-native-live-engine
session: phase8f-plan-freeze
---

# Now

[D25](decisions/d25-fields-json-document-format-and-publication.md) records the
operator selection: one document model with FIELDS and JSON encodings for exact
model note/rhythm I/O. Prefer FIELDS for model communication and equivalent
objects near I/O. Other internal types suit their domains.

The operator approved rational-only external timing and the D23 `1/512`
acquisition boundary. Nominal rhythm remains exact in optional overlays.
Overlay identity, provenance, dependencies, and edit invalidation are required.
Duration rounding and minimum-duration rules still need specification.

[Phase 8f](plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md) now has
three approved session plans. Start
[8f1](plan/phase-8/8f1-document-model-and-v1-specification.md) next. It defines
version 1.0 semantics, grammar, schema, timing, and overlays. Then
[8f2](plan/phase-8/8f2-reference-codec-and-model-format-reference.md) implements
the codec, tests, and model format reference. Finally
[8f3](plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md) settles the host
binding, identity, migration, verification, and cache contracts.
The new specification and implementation are not built yet.

[8c4f is closed](plan/phase-8/8c4f-full-matrix-decision.md) by operator decision.
The [product review](evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md) retains
the comparison and score limits. Frozen matrix and adjudicated artifacts remain
unchanged. Their different denominators must stay separate.

[9b](plan/phase-9/9b-compact-bar-publication-review.md) earmarks the specification,
tooling, corpus, format card, and benchmark evidence for publication after 8i.
The product review starts its README. Phase 8g implements the shadow cache;
8h integrates the selected document and 8i tests fresh agent use.

## Immediate work

1. Implement 8f1 from its approved scope and acceptance criteria.
2. Keep the cache, `normal-v1`, and live Bitwig projects unchanged in pure work.
3. Hand exact artifact paths and unresolved host rules to 8f2 and 8f3.

## Retrospective

Keep settled selection in a decision and implementation details in child plans.
Use separate criteria for codec loss, acquisition loss, and musical errors.

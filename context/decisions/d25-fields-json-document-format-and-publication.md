---
id: D25
kind: decision
state: active
source: phase8c4f-operator-format-selection
updated: 2026-10-01
---

# D25 — FIELDS and JSON document format **[SETTLED 2026-10-01]**

## Selection and scope

Adopt one Ghostnote document model with `FIELDS` and JSON encodings. Use it
when model communication needs exact note and rhythm input or output.
Prefer `FIELDS` for model-facing reads and proposals. Prefer JSON or native
objects with the same meaning for processing near that I/O boundary.
Other internal types must suit their own domains.

The two encodings must preserve all supported document and patch values
through conversion. They are two serializations of one semantic model.
Both use one event identity set. An independent notation body and event ledger
are not part of the selected model communication contract.

Develop a version 1.0 specification, grammar, JSON schema, reference parser,
canonical serializers, conformance tests, and examples. Provide a versioned
**Model format reference**, also called the format card, for prompts and skills.
Its examples must use the reference implementation.

The selection does not freeze the experimental benchmark grammar. Phase 8f1
must settle field coverage, complete documents, sparse patches, and extensions.
The fresh JSON benchmark arm has the same five omitted fields as compact.
It does not establish complete host-state coverage.

## Timing

Use rational-only timing in the external document. Canonical timing values
use reduced numerator/denominator text, or an integer when the denominator is
one. JSON carries the same timing strings. Decimal and floating-point timing
are not additional external spellings.

Normalize more precise realized note timing to the accepted `1/512`-beat
plane at the acquisition or import boundary. Host floating-point values can
enter that boundary; their conversion must have explicit rules.
Serialization and FIELDS/JSON conversion must not quantize again.

[D23](d23-normalized-clip-acquisition-uses-one-1-512-view.md) remains accepted.
Observed off-grid onsets map down to the occupied cell. Same-channel,
same-pitch source onsets can collapse inside a cell. Do not claim source
losslessness below that boundary. Phase 8f1 must define duration rounding,
minimum positive durations, and any other import rounding rules.

Retain unrestricted exact nominal rationals in timing overlays. For example,
an event acquired at `85/256` beat can have nominal triplet position `1/3`.
Acquisition error must be distinguishable from intended groove deviations.
The external timing rule does not require rational objects throughout the
runtime. Integer ticks or other domain types can be appropriate internally.

[D9](d9-grid-and-units-settled-2026-07-25.md) still governs the existing
low-level write path. Phase 8f3 must specify its mapping to the selected
document before 8h changes stable behavior.

## Overlays

Version 1.0 must specify optional overlays linked to core event IDs. Initial
use cases are nominal rhythm, groove and timing intent, harmony, roles and
motif groups, meter, tempo, and named regions.

Each overlay has stable identity within its declared lifecycle. Define its
event references, dependencies, authority, and provenance. Distinguish
measured, declared, and inferred information. An overlay describes meaning or
relationships; the core event owns realized note state. Removing an overlay
must leave the notes unchanged.

Both encodings must preserve supported overlays. Define patch behavior for
preservation, recomputation, invalidation, and removal. A retained event ID
does not prove that an old harmony or timing interpretation remains valid.
Use overlays only when the task needs them.

## Evidence and gate

The operator selects this direction after reviewing the
[product review](../evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md), the
[corrected matrix](../evidence/experiments/e209-offline-score-repair-updates-eight-arm-matrix.md),
and the [adjudicated addendum](../evidence/experiments/e213-audit-adjudications-update-native-composite-scoring.md).
This closes the product choice in Phase 8c4f and opens Phase 8f.

This is an operator product decision with the reported evidence limits.
It does not change frozen gate results or establish a paired comparison
between FIELDS and native formats. Keep the two cohorts separate. Keep notation accuracy,
ledger accuracy, profile compliance, and agreement separate. Generation
requirements still fail often enough to need explicit product handling.

D25 supersedes [D24](d24-forward-compact-benchmarks-retain-fields-and-local-labels.md)
for forward product selection. Local labels remain historical evidence.
No further candidate-selection run is required by this decision. New paid
validation needs its own scope and approval.

## Work and publication

The approved sequence is
[8f1](../archive/outcomes/PHASE-8F1-DOCUMENT-SPECIFICATION.md),
[8f2](../plan/phase-8/8f2-reference-codec-and-model-format-reference.md),
and [8f3](../plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md).
Cache implementation, live surface integration, and fresh agent trials remain
in 8g, 8h, and 8i.

Earmark the accepted specification, tooling, conformance corpus, format card,
examples, and benchmark reproduction evidence for Phase 9.
[Phase 9b](../plan/phase-9/9b-compact-bar-publication-review.md) owns public
packaging and publication review. The product review is the starting point
for the eventual README. Acceptance in Phase 8i supplies the publication
candidate. Version 1.0 is the target contract, not a current external release.

## Retrospective

Check an arm's exact schema before reusing historical field-coverage claims.
Keep format conversion loss separate from acquisition loss and musical errors.

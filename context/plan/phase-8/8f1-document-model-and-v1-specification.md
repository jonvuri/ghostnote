---
title: Phase 8f1 — Document model and version 1.0 specification
kind: plan
state: planned
status: Ready after D25. Define the shared document contract before implementing its codec.
updated: 2026-10-01
parent: 8f-consolidated-compact-bar-and-cache-contracts.md
prev: 8c4f-full-matrix-decision.md
next: 8f2-reference-codec-and-model-format-reference.md
evidence: E109, E114-E121, E138-E139, E209, E212-E213; D21, D23, D25
---

# Phase 8f1 — Document model and version 1.0 specification

## Purpose

Define one version 1.0 document model for exact note and rhythm communication.
Give it equivalent FIELDS and JSON encodings. Follow
[D25](../../decisions/d25-fields-json-document-format-and-publication.md).
The specification must support model reads and desired results, including
complete documents and sparse patches.

## Read first

- [Format product review](../../evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md).
- [Consolidated direction](../../evidence/format/CONSOLIDATED_COMPACT_BAR.md)
  and [format limits](../../evidence/format/COMPACT_BAR_LIMITATIONS.md).
- [Existing groove context](../../evidence/format/AGENT_MUSICAL_LANGUAGE.md)
  and its [pure module](../../../brain/src/musical/agent-context.ts).
- [D23](../../decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md),
  [D9](../../decisions/d9-grid-and-units-settled-2026-07-25.md), and
  [D21](../../decisions/d21-musical-patch-and-public-tool-grain.md).

## Document contract

1. Name the format and its version identifier. Define version and extension
   handling. Keep the version 1.0 target distinct from an external release.
2. Specify events, document metadata, coverage, and references. Decide which
   fields are portable and which belong to the Ghostnote host binding.
3. Resolve channel, mute, release velocity, articulation, expression, pressure,
   and recurrence coverage. For each field, name its type, unit, authority,
   default, omission meaning, and supported operation. A host restriction
   does not require loss of an otherwise supported document value.
4. Define complete desired documents and sparse add, remove, and update forms.
   Specify preservation, explicit clearing, duplicate IDs, reference errors,
   ordering, and no-op behavior. Include empty documents and clips.
5. Define equivalent FIELDS and JSON forms for all supported values. Use one
   declared field binding for positional rows. Specify optional fields and
   overlays without a second note list.
6. Write a normative grammar and JSON schema. Define the semantic rules that
   syntax alone cannot check.
7. Define accepted noncanonical spellings, canonical output, and the semantic
   hash domain. FIELDS and JSON must produce the same content identity after
   normalization. Layout differences must not change that identity.
8. Give each normative rule a reference and at least one conformance case
   requirement for 8f2. Make unsupported input and resource limits explicit.

The benchmark's six-field core is a starting point. Do not describe either
benchmark arm as a complete host-state format or copy its omissions without
a field decision.

## Rational timing and normalization

Use reduced rational timing strings in both encodings. Whole values use an
integer spelling. Decimal, exponent, and floating-point timing spellings are
outside the external contract. Numeric fields outside timing have their own
declared types.

Define realized note timing on the normalized `1/512`-beat plane. Define a
single acquisition/import normalization step for finer rational or host
floating-point inputs. The codec preserves its input values after that step;
FIELDS/JSON conversion does not perform a second normalization.

Keep D23's floor rule for observed onsets and its collision boundary. Select
the duration rounding rule, minimum positive duration, handling of notes
shorter than one cell, and handling of adjacency or overlap after rounding.
Specify model-proposal and import behavior when realized values are off-grid.
Do not silently repair an invalid canonical document.

Nominal overlay positions, divisions, and signed timing components may use
exact rationals outside the realized grid. Separate normalization displacement
from intentional timing deviation. Include a worked `1/3` nominal position
with acquired `85/256` realized onset. The format's exact conversion claim
applies to represented values under the declared acquisition boundary.

## Initial overlays

Specify a bounded initial set with these concrete uses:

| Overlay | Required use case |
|---|---|
| Nominal rhythm | Describe triplet and higher-cardinality positions on normalized events. |
| Groove and timing intent | Preserve swing during nominal quantization; transfer a template or phase between parts. |
| Harmony | Attach chord or key interpretations to an event group or region. |
| Roles and motif groups | Identify a melody, bass role, or motif group for continuation and transformation. |
| Meter and tempo | State beat context and tempo changes for interpretation. |
| Regions | Name spans and event groups that a task can address. |

Define stable overlay IDs, event references, field dependencies, provenance,
and authority. Distinguish declared, measured, and inferred facts. Removing
an overlay must leave realized notes unchanged. Overlay values must survive
FIELDS/JSON conversion.

Define preservation, recomputation, invalidation, and removal after note or
context edits. Specify how additions and removals affect group membership.
Reject dangling references or report them according to one explicit policy.
Do not treat retained event IDs as proof that an interpretation is current.

Reuse the existing groove evidence for the timing relationships. Revise its
equations explicitly for normalized acquisition. Do not label quantization
error as template swing, phase, or local intent. Separate source observations
from model interpretations and proposals.

## Outputs and acceptance

- A version 1.0 specification with FIELDS grammar and JSON schema.
- A field, defaults, coverage, normalization, and extension reference.
- Complete, patch, empty, and overlay examples in both encodings.
- A normative rule list and conformance case inventory for 8f2.
- A short record of remaining host-binding decisions for 8f3.

Every supported semantic value has a representation in both encodings.
All rounding and omission behavior is explicit. Examples use one event
identity set. Overlay lifecycle rules are defined. No speculative host
capability is required by the portable grammar. Context links and diff checks
pass. Implementation checks in 8f2 will validate the specification.

## Out of scope

Reference codec implementation, cache implementation, stable tool migration,
new provider runs, and external publication belong to later sessions.

## Retrospective target

Record which benchmark conventions became normative rules and which changed
to meet product requirements. Identify any unresolved requirement before 8f2.

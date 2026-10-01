---
title: Phase 8f3 — Ghostnote bindings and cache contracts
kind: plan
state: planned
status: Start after the 8f2 reference codec and conformance corpus pass.
updated: 2026-10-01
parent: 8f-consolidated-compact-bar-and-cache-contracts.md
prev: 8f2-reference-codec-and-model-format-reference.md
next: 8g-shadow-project-cache.md
evidence: E24, E109, E114-E121, E128-E139; D8-D9, D15-D16, D21, D23, D25
---

# Phase 8f3 — Ghostnote bindings and cache contracts

## Purpose

Bind the accepted version 1.0 document to measured Ghostnote capabilities.
Settle the separate internal cache contract and the migration required by 8h.
Use the [8f2 reference codec](8f2-reference-codec-and-model-format-reference.md)
at the I/O boundary. Let internal host and cache types suit their domains.

## Read first

- [D25](../../decisions/d25-fields-json-document-format-and-publication.md),
  the 8f1 specification, and the 8f2 corpus and model reference.
- [Cache identity and lifecycle](../../evidence/format/CACHE_IDENTITY_AND_LIFECYCLE.md).
- [Cache scale and degradation](../../evidence/format/CACHE_SCALE_AND_DEGRADATION.md).
- [Interface audit](../../evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md).
- [Current musical language](../../evidence/format/AGENT_MUSICAL_LANGUAGE.md)
  and [workstation seams](../../evidence/format/WORKSTATION_SEAMS.md).

## Host binding

Define mappings for normalized reads, complete desired documents, sparse
patches, and independent readback. Resolve:

- the public Launcher-clip read name and single-clip or bounded-batch scope;
- clip metadata, length, loop, play range, and unsupported coordinates;
- complete coverage of all supported MIDI channels and note fields;
- which document fields are observable, writable, preserved, or unavailable;
- pressure, expression, recurrence, release velocity, and other measured
  property limits;
- defaults for new notes and preservation of unnamed existing properties;
- base guards, clip references, event IDs, and source/content hash domains;
- event remapping after human edits, clip moves, restart, and ambiguous matches;
- independent readback projected into the same normalized document; and
- explicit partial results, loss declarations, conflicts, and refusals.

Document how normalized proposals map to the existing low-level D9 encoder.
Do not change that encoder or reversal fidelity by a prose implication.
Account for the selected onset and duration rules, cell collisions, adjacent
notes, overlaps, and writes outside measured host capabilities.

A model document is a proposal for desired state. Fresh observed state and
the guarded host path still determine what can be applied.

## Overlay lifecycle in live work

Map the existing groove context and other accepted interpretations to the
8f1 overlay contract. Use the same core event IDs. Define:

- source generation, content dependencies, provider/rule identity, and
  provenance for measured, declared, and inferred overlays;
- preservation when an edit does not change an overlay's dependencies;
- recomputation or explicit stale state when pitch, timing, tempo, membership,
  or other dependencies change;
- handling of deleted, reminted, or ambiguous event IDs;
- patch behavior for adding, removing, or changing overlays; and
- what a read returns when an overlay is stale or cannot be recovered.

Removing an overlay must not mutate the host notes. Stable identity does not
prove current interpretation. Normalization displacement must remain separate
from intentional groove. Specify the authority required for a groove proposal
to become a realized-note edit.

## Internal cache contract

Define types and invariants for project generation, structural epochs,
logical clip reference, current address, content generation, and fingerprint.
Specify observer binding, occupied and dirty coordinates, channel enrichment,
normalized coverage, admission, eviction, and limits.

Specify healthy, warming, rebuilding, partial, overflow, and invalid states.
Define immutable snapshots, incremental repair, full rebuild, late-callback
handling, exact fallback, and diagnostic comparison. A caller must not mistake
partial or unhealthy state for complete state.

Internal handles, queues, observer mechanics, and proxy indices stay in the
cache contract. Only useful coverage and health facts cross the public I/O
boundary. Do not require the cache to store serialized FIELDS or JSON.

## Verification posture

Apply the 8a risk tiers to normalized reads, sparse patches, bounded observable
edits, destructive or ambiguous changes, and computer-use changes followed
by reacquisition. For each class, name the required freshness, verification,
and reversal evidence and its consumer.

Define when an immutable healthy cache snapshot can later serve a write
preflight or be shared with preparation. Keep promotion conditional on 8g
evidence. Do not retain a stash, complete candidate, or extra readback step
without the failure it prevents.

Use pure binding fixtures and existing evidence first. Run focused live checks
only for a concrete unresolved host rule. Restore every temporary fixture to
its baseline. Use the repository's controller reload sequence when a live
check needs a new extension.

## Migration and handoff

Give exact-source, context-v0, note-patch-v0, groove-v0, and other experimental
forms an explicit retain, migrate, or retire disposition. Map supported old
values to the new contract. State incompatibilities and preserved fields.
Keep frozen benchmark artifacts as historical evidence.

Hand 8g the cache state machine, limits, and shadow-comparison cases. Hand 8h
the public naming, codec integration, host bindings, overlay lifecycle, risk
policy, and rollback plan. Hand 8i the model reference and bounded trial cases.

## Outputs and acceptance

- Ghostnote host-binding and field-coverage reference.
- Clip/event identity, defaults, conflict, and overlay lifecycle reference.
- Cache contract and state-machine reference.
- Risk and verification policy by operation class.
- Compatibility and migration map, with evidence for any decision amendment.
- Binding corpus and an inventory of publication candidates for 9b.

All represented fields have authority and writability rules. Complete and
sparse changes have deterministic preservation semantics. Identity has
session, restart, and ambiguity rules. Coverage and normalization loss are
visible. The public read name states Launcher scope. Overlay dependencies
survive or invalidate according to their contract.

Binding checks, the relevant pure conformance checks, context links, and diff
checks pass. Any necessary live check has explicit cleanup and readback.
Required decision amendments precede the corresponding 8h behavior change.
Phase 8f closes when all three child sessions meet their criteria.

## Out of scope

Product cache implementation belongs to 8g. Stable tool migration belongs to
8h. Fresh composed agent trials belong to 8i. Public release belongs to 9b.

## Retrospective target

Record which contract required new host evidence and which used existing
evidence. Keep language choices independent of cache implementation convenience.

---
title: Phase 8f — Consolidated compact-bar and cache contracts
kind: plan
state: planned
status: Settle the public musical document and internal cache boundary from the measured evidence.
updated: 2026-09-25
parent: README.md
prev: 8e-cache-scale-limits-and-degradation.md
next: 8g-shadow-project-cache.md
evidence: E109, E114-E121, E128-E134; D21, D23
---

# Phase 8f — Consolidated compact-bar and cache contracts

## Purpose

Settle one normalized agent-facing clip document for reads, theory, complete
desired state, and sparse patches. Separately settle the internal cache
contract that supplies observed state.

Do not expose observer handles, dirty queues, stale proxy indices, or rebuild
mechanics as musical syntax. Do not let agent-facing text become authoritative
host state.

## Compact-bar decisions

Resolve the open questions in the
[consolidated compact-bar direction](../../evidence/format/CONSOLIDATED_COMPACT_BAR.md):

- final text or object syntax and version identifier;
- normalized start and duration rules;
- declared D23 loss and unsupported shapes;
- complete-document and sparse-patch forms;
- absent-field, default, and preservation semantics;
- clip references and logical event IDs;
- event remapping after human edits;
- supported metadata and all MIDI channels;
- expression, pressure, recurrence, and read-only fields;
- conflict and ambiguity reports;
- independent observation and readback projection; and
- migration from the current exact-source, context-v0, and note-patch-v0 split.

Use the 8c comparison to explain each unusual syntax or semantic choice. Use
the 8d lifecycle evidence for identity and restart behavior. Use the 8e limits
for coverage declarations and fallback.

## Cache contract decisions

Define internal types and invariants for:

- project generation and structural epochs;
- logical clip reference, current address, content generation, and fingerprint;
- observer binding and normalized coverage;
- occupied and dirty coordinates;
- channel reconciliation and enriched fields;
- healthy, warming, rebuilding, partial, overflow, and invalid states;
- incremental repair and complete rebuild;
- immutable read snapshots; and
- exact fallback and diagnostic comparison.

The cache contract must expose enough health and coverage for callers to avoid
using incomplete state. It must not expose probe-only timing details to agents.

## Verification posture

Apply the risk tiers selected by 8a. Define the minimum evidence for:

- read-only normalized state;
- a sparse patch against a fresh base;
- an observable bounded edit;
- a destructive or structurally ambiguous change; and
- a computer-use mutation followed by reacquisition.

State whether directed reversal remains required for each supported write
class. Do not retain a complete-candidate, stash, or readback step without a
named risk and consumer.

## Publication-preparation outputs

- A versioned compact-bar specification draft.
- A grammar or strict schema and canonical rendering rules.
- A conformance corpus with valid and invalid examples.
- A loss, defaults, conflict, and identity reference.
- A prior-art comparison linked to the 8c benchmark.
- A cache contract and state-machine reference.
- A compatibility and migration note for existing experimental formats.
- Updated decisions for any superseded identity, fidelity, or reversal rule.

Rerun the deterministic 8c corpus against the selected contract. Run the remote
model comparison again when access is available. Do not make provider results
part of language conformance.

## Acceptance criteria

- One agent-facing event identity set owns realized musical state.
- Complete and sparse forms have deterministic preservation semantics.
- All represented fields have explicit authority, default, and writability.
- Normalization loss and ambiguous host state are visible.
- Clip and event identities have session, restart, and ambiguity rules.
- Cache coverage and health cannot be mistaken for complete state.
- The public document contains no internal observer or proxy mechanics.
- The existing v0 formats have an explicit retain, migrate, or retire decision.
- The conformance corpus, canonical hashes, context check, and diff check pass.
- The result is publication-ready documentation, not an external publication.

## Out of scope

- Product cache implementation.
- Stable public-tool migration.
- External publication or compatibility promises.

## Retrospective target

Record which contract decision required live host evidence and which was only a
language-design choice. Do not use cache implementation convenience as the sole
reason for public syntax.

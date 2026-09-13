---
title: Phase 6i — Workstation contract synthesis
kind: plan
state: planned
status: Run after 6h. Define the smallest experimental Phase 7 surface.
updated: 2026-09-13
parent: README.md
prev: 6h-agent-sensory-packet-utility.md
next: 6j-verification-cost-audit.md
---

# Phase 6i — Workstation contract synthesis

## Purpose

Combine the Phase 6 results into small independent workstation contracts. Define
the smallest experimental surface needed for Phase 7 dogfood. Do not implement
the provider modules in this session. Review all custom and non-standard
interfaces as one system before Phase 7 implements them.

## Starting facts

- E103 proves exact project-local master capture.
- E104 selects exact-version SQLite FTS5 document retrieval.
- E105 selects FFmpeg and a long-lived librosa worker for audio facts.
- E113 selects no perceptual provider.
- E109 and E110 select exact note facts and replaceable theory and voicing
  helpers.
- Sessions 6f through 6h, including 6f1 and 6f2, select the agent context,
  patch, groove, reference, and sensory-packet boundaries.
- The agent musical language has a version registry and a pure conformance
  corpus. It is one interface family in the larger workstation system.

## Work

1. Inventory every custom or non-standard interface that Phase 7 can use. This
   includes public tool schemas, extension wire frames, exact-state and change
   records, agent context and proposal languages, reference and sensory packets,
   documentation records, audio artifacts and facts, and preset or donor
   manifests.
2. For each interface, record its owner, purpose, authority, producers,
   consumers, transport or storage form, version, identity, provenance,
   coverage, units, defaults, loss rules, failure behavior, and stability.
3. Draw the producer-to-consumer seams. Confirm that each interface has one
   focused purpose and one authority boundary. Require an explicit projection
   or translation when two formats share data.
4. Check common field semantics across every seam. Include identities, hashes,
   beat and time units, provider versions, coverage, warnings, failures, and
   ownership.
5. Define small, versioned contracts for the Bitwig adapter, documentation,
   symbolic context, exact patch compilation, audio capture, and audio facts.
6. Define shared source identity, artifact identity, provenance, coverage,
   provider, capability, warning, and failure fields.
7. Separate exact observations, derived measurements, agent interpretations,
   edit proposals, verified outcomes, and operator verdicts.
8. Define module discovery and startup behavior. A missing executable, Python
   environment, model, cache, or Bitwig connection must disable only the module
   that needs it.
9. Record which Phase 6 probes are retained as regression tools, extracted into
   product code, archived as evidence only, or removed in Phase 8b.
10. Define an explicitly experimental Phase 7 dogfood surface. It is not the
   stable public contract and can change or disappear after a run.
11. Update the Phase 7 menu from the selected exploration results.

## Acceptance criteria

- Each module has explicit inputs, outputs, dependencies, startup behavior, and
  failure isolation.
- The interface inventory covers every custom format used at a planned Phase 7
  boundary. Each format is classified as retain, merge, revise, or retire.
- Each retained format has a distinct purpose and authority. Any overlap has a
  named projection, translation, or consolidation plan.
- Each connected producer and consumer has a compatible fixture or a precise
  blocker. Boundary adapters are explicit and testable.
- The interface map covers exact state to agent context to proposal to compiler
  to guarded write and readback. It also covers capture to audio facts to a
  sensory packet and documentation source to retrieval result.
- Each read result declares source identity, provider version, coverage, and
  fact or estimate authority.
- The symbolic contract keeps complete exact state outside agent-generated
  prose and patches.
- Each risk-bearing patch requires exact target guards and independent readback.
- No rule, model, or agent label is reported as an exact fact.
- The operator retains every aesthetic acceptance decision.
- Phase 7 has one focused implementation brief per module boundary.
- No provider implementation, dependency installation, or live mutation occurs.

## Out of scope

- Implementing all providers proved feasible in Phase 6.
- A stable public theory, generation, capture, or audio-analysis surface.
- A second DAW adapter.
- A public perceptual provider.
- Broad analysis capabilities without a selected Phase 7 task.

## Retrospective target

Record which interface overlap was hardest to resolve and which shared field
prevented the most adapter-specific special cases without hidden shared state.

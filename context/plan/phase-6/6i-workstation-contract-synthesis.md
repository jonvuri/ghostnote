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
the provider modules in this session.

## Starting facts

- E103 proves exact project-local master capture.
- E104 selects exact-version SQLite FTS5 document retrieval.
- E105 selects FFmpeg and a long-lived librosa worker for audio facts.
- E113 selects no perceptual provider.
- E109 and E110 select exact note facts and replaceable theory and voicing
  helpers.
- Sessions 6f through 6h, including 6f1 and 6f2, select the agent context,
  patch, groove, reference, and sensory-packet boundaries.

## Work

1. Define small, versioned contracts for the Bitwig adapter, documentation,
   symbolic context, exact patch compilation, audio capture, and audio facts.
2. Define shared source identity, artifact identity, provenance, coverage,
   provider, capability, warning, and failure fields.
3. Separate exact observations, derived measurements, agent interpretations,
   edit proposals, verified outcomes, and operator verdicts.
4. Define module discovery and startup behavior. A missing executable, Python
   environment, model, cache, or Bitwig connection must disable only the module
   that needs it.
5. Record which Phase 6 probes are retained as regression tools, extracted into
   product code, archived as evidence only, or removed in Phase 8b.
6. Define an explicitly experimental Phase 7 dogfood surface. It is not the
   stable public contract and can change or disappear after a run.
7. Update the Phase 7 menu from the selected exploration results.

## Acceptance criteria

- Each module has explicit inputs, outputs, dependencies, startup behavior, and
  failure isolation.
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

Record which shared contract field prevents the most adapter-specific special
cases without creating hidden shared runtime state.

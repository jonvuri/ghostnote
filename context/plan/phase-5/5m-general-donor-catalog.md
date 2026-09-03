---
title: Phase 5m — general donor catalog
kind: plan
state: done
status: Complete as asset curation. E96 narrows the public catalog to 12 exact relocated live witnesses.
updated: 2026-09-01
parent: README.md
evidence: D1, D2, D3, E12, E13, E67, E69, E88
---

# Phase 5m — general donor catalog

## Purpose

Replace the fixed public type enums with one measured donor catalog. Make a new
curated donor available without another write-tool code change.

## Scope

1. Record the complete Bitwig 6.0.6 modulator-type inventory that can serialize
   as a preset modulator object.
2. Capture one human-authored, routed donor for each supported type. Record its
   public name, category, source, route capability, object footprint, witness
   mode, and provenance.
3. Measure each donor footprint on a sampled preset when a bounded measurement
   is possible. Keep a proved Tier-1-only refusal when it is not.
4. Generate the runtime catalog and public type vocabulary from the manifest.
   Do not maintain a separate enum in each tool.
5. Add a read-only public catalog result with the exact supported types,
   categories, sampled-preset standing, and witness requirements.
6. Preserve the rule that donor objects are transplanted from owned presets and
   are never synthesized.

## Acceptance criteria

- Every current host type is supported or has one explicit, live-proved reason
  that it cannot enter the product cohort.
- Every supported add donor contains a route that can be safely retargeted.
- Every sampled-capable donor has a measured non-null footprint and provenance.
- A Tier-1-only donor refuses on a sampled preset before a project write.
- Adding a manifest entry updates the public catalog without editing write-tool
  source code.
- Structural, free-running, and note-driven witness modes are explicit. A
  note-driven source is not called inactive because no note was present.
- Asset generation, donor tests, the full brain check, and focused live load
  checks pass.

## Out of scope

- Third-party modulator formats.
- Synthesizing donor bytes.
- Public topology writes.
- Container asset shapes.

## Handoff

Session 5n combines this catalog with the general targets and complete
list-scoped editors.

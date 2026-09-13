---
title: Phase 7a — Symbolic context and read-only analysis
kind: plan
state: planned
updated: 2026-09-13
parent: README.md
prev: ../phase-6/6j-verification-cost-audit.md
next: 7b-agent-patch-execution-and-reference-dogfood.md
---

# Phase 7a — Symbolic context and read-only analysis

## Purpose

Implement the selected agent-facing symbolic context as an independent,
read-only experimental module. Prove it in one real analysis and revision task
without writing the proposed revision.

## Work

1. Extract the exact-note boundary selected by E109.
2. Render the 6f context form from complete exact clip state.
3. Add only the Music21, rule, or measurement fields selected by sessions 6f
   through 6h.
4. Report exact facts, derived measurements, and alternatives separately.
5. Make missing optional providers reduce declared capabilities without
   disabling exact context rendering or the Bitwig adapter.
6. Run one module-only dogfood task from the priority menu.

## Acceptance criteria

- Each result declares source identity, exact note coverage, schema version,
  provider versions, capabilities, and missing capabilities.
- Ambiguous theory results expose alternatives and do not become exact facts.
- The selected representation preserves the fields promised by session 6f.
- The module works without a capture, audio-analysis, or documentation module.
- No project write occurs.
- Focused tests, the full brain check, context check, and `git diff --check`
  pass.

## Out of scope

- Applying an agent proposal.
- Audio analysis.
- A stable public contract.
- Broad theory fields not selected by a dogfood task.

## Retrospective target

Record which context field the agent used and which field it ignored.

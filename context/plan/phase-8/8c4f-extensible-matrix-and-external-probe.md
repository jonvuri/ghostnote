---
title: Extensible matrix and external-format probe
kind: plan
state: complete
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4f-extensible-matrix-and-external-probe
---

# Phase 8c4f extensible matrix and external-format probe

## Goal

Turn the repaired compact benchmark into a reusable full-format matrix. Check a
small sample of notable public formats before a large provider run.

## Acceptance criteria

1. Keep fixtures, format adapters, scoring, and run policy in separate modules.
2. Make a new format pluggable through one adapter contract.
3. Carry the v19 analysis, affine, and revoice repairs into the shared suite.
4. Keep component accuracy as the primary gate. Keep canonical form as a
   diagnostic.
5. Rank public notations by practical use and label repository adaptations.
6. Freeze two fixtures per decision family and one literal control for each of
   the top three suitable public text formats.
7. Freeze the exact provider, model, schedule, estimate, and hard cost limit.
8. Do not make provider calls without approval of the frozen plan.
9. After approval and execution, manually audit one full case in every
   family-format cell.

## Boundaries

Do not change the cache, `normal-v1`, or a live Bitwig project. Do not treat the
old `one-cycle-mini` syntax as Tidal or Strudel mini-notation. Do not claim that
a composite result measures the native notation alone.

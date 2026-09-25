---
title: Phase 8g — Shadow project cache
kind: plan
state: planned
status: Implement the measured cache behind an experimental boundary while E131 remains authoritative.
updated: 2026-09-25
parent: README.md
prev: 8f-consolidated-compact-bar-and-cache-contracts.md
next: 8h-cache-promotion-and-interface-simplification.md
evidence: E130-E134; D23
---

# Phase 8g — Shadow project cache

## Purpose

Implement the project-wide persistent occupancy cache without changing stable
read or write authority. Compare every eligible cache result with the existing
reader and exercise the lifecycle, limits, and fallback rules selected in
8d through 8f.

## Implementation boundary

- Use one fixed `1/512` observer for each active cached clip.
- Keep sparse occupied and dirty coordinates.
- Treat callbacks as channel-free invalidations.
- Re-read all 16 channels at each dirty coordinate.
- Enrich full note fields only for occupied coordinates that a caller needs.
- Track project generation, structural epochs, current address, content
  generation, coverage, and cache health.
- Rebuild or fall back according to the selected lifecycle and limit policies.
- Publish diagnostics through an experimental profile or probe boundary.

Do not use a cache result for a product write, exact guard, or stable response
in this session. E131 remains authoritative.

## Shadow comparisons

Compare normalized cache snapshots with settled `1/512` authority for:

- initialization and ordinary warm reads;
- every supported note mutation;
- field-only changes and all MIDI channels;
- clip, scene, and track structural changes;
- project switch, controller reload, save, close, and reopen;
- working-set admission, eviction, overflow, and rebuild;
- callback bursts, late callbacks, and interrupted rebuilds; and
- real read-only and note-patch workflows.

Keep D23 sub-cell loss separate from implementation mismatches. Use E131 as an
additional diagnostic where an exact source difference needs explanation.

## Measurements

- Cold and warm cache latency by phase.
- Authority-scan latency and avoided host work.
- Initialization, replay, rebuild, and recovery time.
- Cache hit, miss, fallback, eviction, and invalidation counts.
- Dirty queue size and drain latency.
- Extension-owned memory and object counts.
- Mismatch counts by cause and lifecycle event.
- Tool calls, response bytes, and agent-visible delay in shadow dogfood.

## Acceptance criteria

- Every in-contract shadow result matches normalized authority.
- Every cache state declares complete, warming, rebuilding, overflow, invalid,
  or another selected health state.
- A caller cannot receive an unhealthy or partial snapshot as complete.
- Late callbacks from an old binding or project generation cannot mutate the
  current cache.
- Structural repair and rebuild follow the 8d state machine.
- Limits and fallback match 8e.
- Memory remains proportional to the selected sparse and handle model.
- No stable public tool or write path changes authority.
- All temporary fixtures are removed and the stable comparison path remains.
- Focused checks, the brain check, extension checks, context check, wire checks,
  live hello, and `git diff --check` pass.

## Promotion gate

Do not enter 8h with an unexplained in-contract mismatch, silent overflow,
unbounded rebuild, or unresolved project-generation race. Record unsupported
states as explicit fallback cases instead of weakening completeness.

## Retrospective target

Record the most common reason for fallback and the largest cost that shadow
comparison adds. This identifies what promotion can simplify safely.

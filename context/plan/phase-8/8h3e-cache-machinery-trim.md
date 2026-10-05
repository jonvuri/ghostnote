---
title: Phase 8h3e — Cache machinery trim and promotion
kind: plan
state: planned
status: Outline. Keep identity, generations, and snapshot validity; retire the resident note grid. Write the full plan after 8h3d.
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3d-change-awareness.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E224, E225, E226, E227; D26, D27, D28, D30
---

# Phase 8h3e — Cache machinery trim and promotion

## Status

Outline only. Write the full plan after
[8h3d](8h3d-change-awareness.md), from its change-awareness design. This
session replaces the earlier 8h1 cache promotion plan.

## Why

A cold read takes 46–698 ms ([E227](../../evidence/experiments/e227-replay-cold-read.md)).
A resident note grid therefore gives no speed benefit. It costs about
280 bytes of host heap for each sounding cell (E226), and it needs admission,
eviction, canary, and budget logic.

The compact-bar format still needs project state and change awareness. An
agent works on snapshots and sends patches against them. Ghostnote must name
which clip a snapshot came from and tell whether it is still current.

## Expected scope

Keep and promote:

- the identity domain: ProjectGeneration, StructuralEpoch, BindingGeneration,
  and clip reference tokens ([cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md));
- topology, occupancy, and slot inventory (D28, E222, E223);
- snapshot validity, by the 8h3d design: a pull check at use time, and step
  deltas for watched clips if 8h3d selects them; and
- the 8h promotion stages, each with a flag, a comparison, and a rollback.

Retire, or keep only as research:

- the resident note grid for each cached clip;
- sounding-cell admission and eviction, except a budget for watched clips;
- the canary bind and replay settlement, which D30 replaces; and
- the retained read-data and research diagnostics terms that E225 and E226
  left open.

## Out of scope

- Reader and writer changes (8h3c).
- Selection of the change-awareness design (8h3d).
- Interface simplification and public naming (8h4).

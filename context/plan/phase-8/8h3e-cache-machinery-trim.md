---
title: Phase 8h3e — Cache machinery trim and promotion
kind: plan
state: planned
status: Outline. Keep identity, generations, and pull snapshot validity; retire the resident note grid. 8h3c2 is complete; write the full plan next.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3c2-reader-row-binding.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E224, E225, E226, E227, E231, E232; D26, D27, D28, D30
---

# Phase 8h3e — Cache machinery trim and promotion

## Status

Outline only. [8h3c2](8h3c2-reader-row-binding.md) is complete
([E232](../../evidence/experiments/e232-reader-row-binding.md)): the reader
binds every row. Write the full plan first. [8h3d](8h3d-change-awareness.md)
selected pull only ([E231](../../evidence/experiments/e231-change-awareness.md)).
This session replaces the earlier 8h1 cache promotion plan.

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
- snapshot validity by pull (E231): read at use time and compare the
  `pull-fp-v1` fingerprint. Use the executor's write-set read for writes.
  Return a stale verdict with the new snapshot; never patch a stale base; and
- the 8h promotion stages, each with a flag, a comparison, and a rollback.

Retire, or keep only as research:

- the resident note grid for each cached clip;
- sounding-cell admission and eviction (E231 selected no watched clips);
- the canary bind and replay settlement, which D30 replaces; and
- the retained read-data and research diagnostics terms that E225 and E226
  left open.

## Out of scope

- Reader and writer changes (8h3c, 8h3c2).
- Watched clips. `ChangeWatchProbe` stays research (E231).
- Interface simplification and public naming (8h4).

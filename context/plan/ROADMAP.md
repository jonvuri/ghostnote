---
title: ghostnote roadmap
kind: plan
state: active
updated: 2026-08-22
---

# Roadmap

| Phase | State | Purpose |
|---|---|---|
| 0 — foundation | done | Contract, fake adapter, UI probe, decision consolidation |
| [1 — write engine and managed takes](phase-1/README.md) | done | Safe writes, track-copy CRUD, two scoped take representations, observation, status, navigation, live proof |
| [2 — clip surface](phase-2/README.md) | done | Musical clip vocabulary, public surface, long-clip support, dogfood, and final proof |
| [3 — session view](phase-3/README.md) | deferred | Phase 2 found no evidence to run it now |
| [4 — sound design](phase-4/README.md) | done | Device and parameter surface |
| [5 — authoring](phase-5/README.md) | next | Structure and modulation authoring; `bwmod` already exists |
| [6 — breadth and release](phase-6/README.md) | planned | Independently schedulable breadth, packaging, and release work |

## Cross-phase work

| Brief | State | Purpose |
|---|---|---|
| [capability knowledge base](../archive/outcomes/KNOWLEDGE-BASE.md) | done 2026-08-15 | Minted [`evidence/capability/`](../evidence/capability/INDEX.md) and seeded it from host-API and `reference/BitX` facts |

That detour changed no product behaviour. Phase 1 paused between sessions 3f-g
and 3f-h while it ran, and resumed at 3f-h unchanged. Maintenance
of the capability axis needs no standing plan: the rules are in
[`context/README.md`](../README.md) and in the
[capability index](../evidence/capability/INDEX.md).

The [current execution state](../NOW.md) owns the immediate next step. Historical
phase plans are retained under `archive/plans/`.

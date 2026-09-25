---
title: Current state
kind: status
state: active
updated: 2026-09-25
phase: phase-8-agent-native-live-engine
session: phase8a-product-and-interface-audit
---

# Now

Run
[Phase 8a — Agent-native product posture and interface audit](plan/phase-8/8a-agent-native-product-and-interface-audit.md).
Audit the complete public and experimental surface before changing production
behavior. Use E129's completed live gate as the current hybrid example.

[E134](evidence/experiments/e134-project-observer-scale-sweep.md) supports a
later project-wide persistent occupancy-cache design. Corrected fixed views
passed through 131,072 steps, the required 128 clips, and the 256-clip stretch
target. The first run's 2,048-step and 64-observer limits were experiment
artifacts.

The future cache must treat callbacks as channel-free coordinate invalidations,
re-read all 16 channels, and re-resolve clip addresses after structural
compaction. Keep the complete E131 reader until that separate design and
implementation session is complete.

[E131](evidence/experiments/e131-consolidated-clip-acquisition.md) remains the
authoritative comparison route. The stable reader, profile, and note-write path
must not change.

[E129](evidence/experiments/e129-played-range-consolidation-guidance.md) now
records the exact refusal, visible consolidation, new complete acquisition,
guarded insertion, exact reversal, and cleanup. The trial left only the three
original row-0 clips, restored track 2 and row 0 selection, and stopped
transport.

After 8a, establish the lean runtime, make the compact-bar comparisons durable,
resolve cache identity and limits, settle the separate public format and
internal cache contracts, implement the cache in shadow mode, promote it in
stages, simplify the surface, and finish with fresh hybrid dogfood. The former
breadth and release backlog is [Phase 9](plan/phase-9/README.md).

## Retrospective

One semantic range guard plus visible computer use was sufficient. Keep UI-only
changes outside Ghostnote's reversal claim. A later owned cleanup can need a
scoped delete when the UI change supersedes the setup record. In 8a, prefer one
concrete surface simplification over a general request for less ceremony.

---
title: Current state
kind: status
state: active
updated: 2026-09-25
phase: phase-8-agent-native-live-engine
session: phase8b-runtime-and-surface-cleanup
---

# Now

Run
[Phase 8b — Runtime and surface cleanup foundation](plan/phase-8/8b-runtime-and-surface-cleanup.md).
Use the
[completed agent-native interface audit](evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md)
as the disposition authority. Separate normal product runtime from active probes
before cache limit work. Do not apply the broader 8h public-tool migration.

[E135](evidence/experiments/e135-agent-native-product-and-interface-audit.md)
and the revised [D18](decisions/d18-branching-the-hybrid-model-at-l3-open-settled-2026-08-06-by-the-.md)
settle the 8h device target. Treat layer chains as ordinary device structure,
remove the managed-alternate lifecycle, and expose one `compose_devices`
operation with private offline and staged backends. Keep current compatibility
behavior until 8h.

E135 also records the target public names. Launcher-only tools state
`launcher_clip`; instrument-only track creation and duplication state
`instrument_track`; device parameters and Remote Controls share the
`device_control` family. Session 8b keeps the current compatible names.

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

After 8b, make the compact-bar comparisons durable,
resolve cache identity and limits, settle the separate public format and
internal cache contracts, implement the cache in shadow mode, promote it in
stages, simplify the surface, and finish with fresh hybrid dogfood. The former
breadth and release backlog is [Phase 9](plan/phase-9/README.md).

## Retrospective

The largest mismatch was duplicate workflow memory. Retire the public
observation workflow in 8h instead of asking the agent to copy conversation
state into a second store. For 8b, map host-object allocations before method
removal. A method count alone does not measure runtime cost. Both independent
audits also inherited the managed-alternate concept, so future audits must test
the concept itself and not only its tool grain.

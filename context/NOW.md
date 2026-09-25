---
title: Current state
kind: status
state: active
updated: 2026-09-25
phase: phase-7-follow-up
session: phase7b-played-range-consolidation-live-trial
---

# Now

Run the independent
[played-range consolidation trial](plan/phase-7/7b-follow-up-played-range-consolidation.md)
in a fresh chat. Start the server with
`GHOSTNOTE_TOOL_PROFILE=phase-7b-agent-note-patch-v0`. Use the complete E131
acquisition route before and after visible consolidation. Do not use an
observer fast path.

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

After the live trial, start
[Phase 8 — Agent-native live engine](plan/phase-8/README.md). First audit the
complete product posture and interface. Then establish the lean runtime, make
the compact-bar comparisons durable, resolve cache identity and limits, settle
the separate public format and internal cache contracts, implement the cache in
shadow mode, promote it in stages, simplify the surface, and finish with fresh
hybrid dogfood. The former breadth and release backlog is now
[Phase 9](plan/phase-9/README.md).

## Retrospective

Record exact baseline identities before fixture setup. Do not rely on cleanup
observation as the only identity record. Keep internal cache mechanics separate
from the agent-facing compact-bar contract. Treat a phase-number change as one
link migration and run the context checker before staging it.

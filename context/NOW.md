---
title: Current state
kind: status
state: active
updated: 2026-09-23
phase: phase-7
session: 7d-audio-facts-and-sensory-packets
---

# Now

Phase 7c and its cache follow-up are complete.
[E123](evidence/experiments/e123-automatic-user-guide-cache-is-cold-to-warm.md)
makes the approved user-guide cache automatic on a missing entry and preserves
explicit offline reuse. Phase 6 is complete. Phase 3 remains deferred. Phase 5
still has generalized closeout work after its accepted public result.

## Next session

Run [7d: audio facts and sensory packets](plan/phase-7/7d-audio-facts-and-sensory-packets.md).
Read the [contracts](evidence/format/WORKSTATION_CONTRACTS.md),
[seam ledger](evidence/format/WORKSTATION_SEAMS.md),
[verification rules](evidence/format/WORKSTATION_VERIFICATION.md), E105, E118,
E119, E122 and E123. Implement `audio-facts-v0` and sensory packet v1. Close S12,
S13 and the audio part of S17. Keep capture separate until 7e.

## 7c cache handoff

- Normal workflow opens download only a missing approved guide. Offline mode,
  API requests, and device requests never enter the download path.
- Concurrent cold opens share one keyed download. Failures permit a later retry.
  Invalid existing entries fail closed without replacement.
- Cold downloads abort after 90 seconds. Response headers and streamed bytes
  enforce the 128 MiB source limit before a cache write.
- The complete-guide task ranked page 426 first. The offline repeat used the
  same source hash and top result with zero download time.
- Cold download took 14,035.587 ms, extraction 1,455.579 ms, index build 36.406
  ms, and query 0.503 ms. The offline warm source open took 43.358 ms and its
  query took 0.495 ms. The 62 MiB temporary cache and index were removed.

## Boundaries

S03, S04, S06, S07, S09, S14 and the implemented parts of S17 are complete. S05
remains conditional on a theory task. S08 remains outside the compiler. S10 is
conditional on a paired MIDI task. S11–S13 remain for 7d and 7e. R1 is still
blocked: do not remove the fresh preflight or final readback.

## Retrospective

The shared cold path fit inside the existing source opener and cache helper. No
bootstrap service was needed. The explicit offline mode made network use
testable and prevented warm-run surprises. When a manual network helper becomes
automatic, review its deadline and byte limits at the new call site.

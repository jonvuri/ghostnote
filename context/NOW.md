---
title: Current state
kind: status
state: active
updated: 2026-09-23
phase: phase-7
session: 7d-audio-facts-and-sensory-packets
---

# Now

Phase 7c is complete. [E122](evidence/experiments/e122-documentation-provider-connects-verified-offline-sources.md)
connects verified installed and cached documentation to source-routed, bounded
FTS5 results. Phase 6 is complete. Phase 3 remains deferred. Phase 5 still has
generalized closeout work after its accepted public result.

## Next session

Run [7d: audio facts and sensory packets](plan/phase-7/7d-audio-facts-and-sensory-packets.md).
Read the [contracts](evidence/format/WORKSTATION_CONTRACTS.md),
[seam ledger](evidence/format/WORKSTATION_SEAMS.md),
[verification rules](evidence/format/WORKSTATION_VERIFICATION.md), E105, E118,
E119 and E122. Implement `audio-facts-v0` and sensory packet v1. Close S12, S13
and the audio part of S17. Keep capture separate until 7e.

## 7c handoff

- `documentation-v0` uses explicit API, workflow, or device routing. Each hit
  has source and manifest identity, versions, compatibility, exact locator,
  excerpt coverage, provider/extractor/index identity, and retrieval rank.
- The retained cache manifest v1 gate now returns the verified bytes. Extraction
  consumes those bytes and does not reopen the weaker Python probe path.
- Disposable FTS5 indexes bind source, extractor, provider, SQLite and tokenizer
  identity. Stored record and search-row hashes detect corrupt or stale indexes.
- The offline installed-API task ranked `MasterRecorder.html` first and guided a
  future capture-control outline. No Bitwig connection or project write occurred.
- Cold installed-API source open took 66.687 ms. The cold module request took
  61.184 ms; the warm request took 15.542 ms. Temporary cache and index roots were
  removed.

## Boundaries

S03, S04, S06, S07, S09, S14 and the implemented parts of S17 are complete. S05
remains conditional on a theory task. S08 remains outside the compiler. S10 is
conditional on a paired MIDI task. S11–S13 remain for 7d and 7e. R1 is still
blocked: do not remove the fresh preflight or final readback.

## Retrospective

The compatibility field prevented the broadest unsupported answer. Keep version
and compatibility separate when older material is useful only for general
workflows. Hash index content after SQLite insertion so build and validation use
the same row order.

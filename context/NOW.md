---
title: Current state
kind: status
state: active
updated: 2026-09-21
phase: phase-7
session: 7a-symbolic-context-and-read-only-analysis
---

# Now

Phase 6 is complete, including 6d2 and the
[6j audit](archive/outcomes/PHASE-6J-VERIFICATION-COST-AUDIT.md). Phase 7 owns
focused module implementation and dogfood. Phase 8 owns breadth, release and
probe-runtime retirement. Phase 3 remains deferred. Phase 5 still has generalized
closeout work after its accepted public result.

## Next session

Run [7a: symbolic context and read-only analysis](plan/phase-7/7a-symbolic-context-and-read-only-analysis.md).
Read the [contracts](evidence/format/WORKSTATION_CONTRACTS.md),
[inventory](evidence/format/WORKSTATION_INTERFACES.md),
[seam ledger](evidence/format/WORKSTATION_SEAMS.md), and
[verification rules](evidence/format/WORKSTATION_VERIFICATION.md).
Build the complete exact-source wrapper and compact context connection first.
Close S03/S04/S17, plus S05 only if theory is enabled and S10 only for a selected
paired MIDI task. The first proof explains one complete clip and returns an
unapplied revision. It needs no optional Python provider.

## Audit handoff

- [E119](evidence/experiments/e119-offline-verification-cost-audit.md) confirms
  20 pages and two resets for 32 beats with the selected 2,048-step reader.
  Scheduled waits total 3,168 ms before host/bridge work. The 80-page count uses
  a 512-step reader. Record the advertised width; current live latency is unknown.
- Exact-source hashing, context validation/rendering, provider work and live
  verification are separate costs. Unbuilt seams have unknown latency.
- Read-only providers need source, version, coverage and authority, with no
  mutation stash or reversal. Future writes keep exact candidate validation,
  target guards, independent readback and recorded partial effects.
- [R1–R4](plan/phase-7/VERIFICATION_REDUCTIONS.md) are optional successor briefs.
  No optimization was made. Do not remove a check without equivalent evidence.

## Existing boundaries

The contracts remain experimental. Stable schemas and guards are unchanged.
Keep complete host state outside agent output. Exact source and context hashes
have different domains. Retain deterministic musical v1 and note proposal v0 as
distinct inputs. Standalone groove proposals need a later compiler revision.

Use extracted references by default. The first audio task uses E118 FFmpeg
fields; capture is a later separate operation. Music21 is optional for a named
theory task. No perceptual provider or Notochord dependency is selected.
[D22](decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md) retains
the non-native preset limit. Phase 8b owns the 153 registered/82 used method
classification. Method counts alone do not measure retirement savings.

## Retrospective

Record reader width beside page counts and label inclusive timings. Use the seam
and cost ledgers together. A component test does not prove an unbuilt connection.

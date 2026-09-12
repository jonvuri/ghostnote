---
title: Current state
kind: status
state: active
updated: 2026-09-12
phase: phase-6
session: 6c-deterministic-audio-analysis-tool-survey
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 has an
accepted public result, but its generalized closeout remains. The operator
moved current work to Phase 6. Phase 7 owns the next dogfood loop. The former
breadth and release phase is now Phase 8.

## Next session

Run [Phase 6c: deterministic audio-analysis tool survey](plan/phase-6/6c-deterministic-audio-analysis-tool-survey.md).
Use E103's exact project-local WAV route and a controlled synthetic cohort.
Compare established local providers for signal, spectral, temporal, pitch,
stereo, and modulation facts. Keep perceptual judgment in session 6d.

## Documentation retrieval gate

[E104](evidence/experiments/e104-exact-version-document-cache-and-routed-lexical-retrieval-pass.md)
selects source-routed SQLite FTS5. It found all nine expected items in its top
five; local LSA found four. Installed API and localization are exact for 6.0.6.
Exact release notes have a stable official archive route. No 6.0.6 user guide
exists, so the 5.3 guide is a general-workflow fallback only. Source bytes and
indexes stay outside the repository.

## Audio capture gate

[E103](evidence/experiments/e103-master-recorder-produces-exact-project-local-wav.md)
opens sessions 6c and 6d. Controller API 25 `MasterRecorder` produced three
exact project-local WAV files. Each was stereo 24-bit PCM at 44.1 kHz,
non-silent, unclipped, and independently hashed. The route needs a known saved
project directory because the API returns no file path.

The extension now registers 153 methods with wire hash `78368fe47ea0e814`.
The three new methods are probe-only MasterRecorder start, stop, and status.

## Workstation direction

Explore Ghostnote as a modular music MCP workstation. Treat Bitwig information,
operations, and feedback as one adapter. Optimize modules for deterministic,
reliable, fast work and for short, reliable feedback loops. Use computer use
for complex one-off interaction and recovery when it is available.

Prefer high-leverage bulk operations, fast single operations, exact state
readback, offline exact-version documentation, deterministic audio analysis,
focused perceptual models, and semantic music theory tools. Prefer interfaces
to free, lightweight, mature tools over new implementations. Each module must
compose through a small interface and must also work independently. The
operator owns aesthetic judgment.

## Preset detour closeout

[E101](evidence/experiments/e101-plugin-preset-files-have-two-direct-routes.md)
records the matrix. H2P is `indexed-direct`, VSTPRESET is `direct`, the tested
FXP is `unsupported`, and FXB is `unproved`. The API 25 popup route could not
establish a safe preset transaction. Each live probe restored its exact entry
baseline.

[E102](evidence/experiments/e102-clap-discovered-h2p-is-an-indexed-direct-route.md)
proves that indexed H2P is a CLAP preset route on this machine. Repro-5 and Diva
are installed only as CLAP devices. Both loaded indexed H2P files with stable
readback, and both ignored unindexed copies.

[D22](decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md) closes
the product direction. H2P, VSTPRESET, FXP, FXB, and CLAP-discovered preset
loading are out of scope. D03b and D04 are canceled. The D03-only extension
handlers and popup-browser banks are removed.

## Probe surface audit

The extension now registers 153 methods. The product wire can emit 82; 71
registered methods remain outside the product path. Six are explicitly banned
by D13. Most of the remainder support historical capability probes. The brain
also retains 250 files under `src/probes`; the product server does not import
that directory. Outside it, one client helper supports malformed-frame tests,
and the wire-golden tools preserve probe method history.

The reduced extension with the 6a probe is deployed and loaded. It reports 153
methods and wire hash `78368fe47ea0e814`.

No general cleanup round existed. [Phase 8b](plan/phase-8/8b-probe-runtime-retirement.md)
now owns the full classification and retirement pass. Do not remove older
probe methods ad hoc because some still enforce live regression decisions.

## Later work

[Phase 7a](plan/phase-7/7a-workstation-dogfood-menu.md) records the first
workstation dogfood menu. [Phase 8](plan/phase-8/README.md) retains publication,
redistribution, and probe-runtime work from the former Phase 6.

## Retrospective

Version compatibility and source-family routing prevented broad older guide
pages from claiming exact installed behavior. Keep provenance checks ahead of
ranking.

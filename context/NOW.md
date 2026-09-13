---
title: Current state
kind: status
state: active
updated: 2026-09-13
phase: phase-6
session: 6f-workstation-interface-and-verification-synthesis
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 has an
accepted public result, but its generalized closeout remains. Phase 6 sessions
6a through 6e are complete. Phase 7 owns the next dogfood loop. Phase 8 owns
breadth, release, and probe-runtime retirement.

## Next session

Run [Phase 6f: workstation interface and verification synthesis](plan/phase-6/6f-workstation-interface-and-verification-synthesis.md).
Define independent module interfaces from E103 through E110. Finish the
verification-cost audit and prepare the Phase 7 dogfood surface.

## Phase 6 provider gates

[E110](evidence/experiments/e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md)
selects Music21 as the primary private semantic-analysis provider and Musicpy
as a voicing specialist candidate. The exact-note layer from
[E109](evidence/experiments/e109-exact-note-structure-is-the-semantic-boundary.md)
owns the input contract, constraints, and exact readback. It wraps the theory
providers instead of replacing them. The live transform preserved all declared
invariants and restored the four-track baseline.

[E108](evidence/experiments/e108-paid-gemini-fails-blind-controls.md),
[E107](evidence/experiments/e107-gpt-audio-fails-blind-controls-and-gemini-is-unavailable.md),
and [E106](evidence/experiments/e106-local-clap-does-not-clear-the-perceptual-provider-gate.md)
reject the tested remote and local perceptual providers. Do not publish a
perceptual tool.

[E105](evidence/experiments/e105-ffmpeg-and-librosa-form-the-audio-fact-boundary.md)
selects FFmpeg and a long-lived librosa worker for typed audio facts and bounded
estimates.

[E104](evidence/experiments/e104-exact-version-document-cache-and-routed-lexical-retrieval-pass.md)
selects source-routed SQLite FTS5. Installed API and localization are exact for
Bitwig 6.0.6. The 5.3 user guide is a general-workflow fallback only.

[E103](evidence/experiments/e103-master-recorder-produces-exact-project-local-wav.md)
proves the project-local MasterRecorder route. It needs a known saved project
directory because the API returns no file path.

## Workstation direction

Build independent modules for deterministic operations and short feedback
loops. Every artifact needs explicit identity, provenance, coverage, and
provider version. Treat Bitwig as one adapter. Use computer use for complex
one-off interaction and recovery. Keep rule and model labels separate from
exact facts. The operator owns aesthetic judgment.

## Existing boundaries

[D22](decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md) closes
non-native preset loading. The extension registers 153 methods, while the
product wire can emit 82. Phase 8b owns classification and retirement of the
remaining probe runtime. Do not remove older probe methods ad hoc.

## Retrospective

The ambiguous pentatonic control exposed false precision from an established
library. Keep it in future harmony-provider tests.

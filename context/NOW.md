---
title: Current state
kind: status
state: active
updated: 2026-09-13
phase: phase-6
session: 6f-agent-facing-symbolic-representation
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 has an
accepted public result, but its generalized closeout remains. Phase 6 sessions
6a through 6e and 6d2 are complete. Three agent-facing explorations are next.
Contract synthesis and the verification audit follow them. Phase 7 owns focused
module implementation and the next dogfood loop. Phase 8 owns breadth, release,
and probe-runtime retirement.

## Next session

Run [Phase 6f: agent-facing symbolic representation](plan/phase-6/6f-agent-facing-symbolic-representation.md).
Compare exact, bar-synchronized, notation, and patch forms. Select one musical
context form and one exact edit form for host-agent round trips. Do not write
model output to Bitwig in this session.

Sessions 6g and 6h then test reference-conditioned musical work and sensory
packets. Session 6i defines the workstation contracts. Session 6j closes the
verification-cost audit.

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
reject the tested providers under the factual gate. [E111](evidence/experiments/e111-perceptual-provider-gate-must-measure-listener-agreement.md)
shows that this gate did not measure the product gap. The next gate uses human
agreement on affect, musical organization, texture, motion, and arrangement.
No perceptual provider is selected. Do not publish a perceptual tool.

[E113](evidence/experiments/e113-loudness-beats-the-affect-head-but-the-reference-gate-blocks-selection.md)
completes the listener-agreement run. Integrated loudness predicted 26 of 27
derived arousal pair directions. The MuSe head predicted 12 of 27. The
loudness result does not pass the product gate because the reference is derived
from absolute traces, source loudness was not controlled, and the per-song
audio license chain is incomplete. Every other dimension lacks matching
listener pair votes. The tested raw scorers also label silence.

[E112](evidence/experiments/e112-independent-survey-adds-probe-psychoacoustic-and-symbolic-perceptual-routes.md)
re-surveys the candidates. It adds psychoacoustic metrics, symbolic tension,
and a probe over a frozen embedding as cheaper routes to the same dimensions.
It also records that `essentia-tensorflow` has no usable arm64 build here, that
the VGGish heads are reachable as ONNX, and that a head must not be scored on
its own training corpus.

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

Keep open-ended musical reasoning in the host agent. Give it compact musical
context, deterministic MIDI and audio evidence, and constrained crafting tools.
Keep complete exact state outside agent output. Compile proposed patches, guard
their targets, and verify them through independent readback.

Build independent modules for deterministic operations and short feedback
loops. Every artifact needs explicit identity, provenance, coverage, and
provider version. Reference-conditioned work also needs source permission and
copy-overlap evidence. Treat Bitwig as one adapter. Use computer use for complex
one-off interaction and recovery. Keep measurements, agent interpretations,
and operator verdicts separate.

## Existing boundaries

[D22](decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md) closes
non-native preset loading. The extension registers 153 methods, while the
product wire can emit 82. Phase 8b owns classification and retirement of the
remaining probe runtime. Do not remove older probe methods ad hoc.

## Retrospective

Feasibility evidence did not justify one combined implementation session.
Future exploration closeouts must separate a selected provider from scheduled
product work. Collect direct pair votes and control loudness before model
download in a future perceptual run.

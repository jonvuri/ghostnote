---
title: Current state
kind: status
state: active
updated: 2026-09-13
phase: phase-6
session: 6f1-established-symbolic-representations-and-model-familiarity
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 has an
accepted public result, but its generalized closeout remains. Phase 6 sessions
6a through 6f and 6d2 are complete. Four agent-facing explorations are next.
Contract synthesis and the verification audit follow them. Phase 7 owns
focused module implementation and the next dogfood loop. Phase 8 owns breadth,
release, and probe-runtime retirement.

## Next session

Run [Phase 6f1: established symbolic representations and model familiarity](plan/phase-6/6f1-established-symbolic-representations-and-model-familiarity.md).
Compare MIDI-Like, REMI, a compound event form, TidalCycles, synchronized ABC,
and the E114 bar baseline. Use isomorphic renamed controls to separate apparent
model familiarity from grammar quality. Keep harmony, existing-input
transformation, continuation, and groove tasks in scope.

Session 6f2 then proves the finest reliable Bitwig timing grid and tests explicit
groove intent and reproducibility across jazz, funk, and hip-hop material.
Session 6g uses those results for reference-conditioned continuation. Session
6h then tests sensory packets. Session 6i defines the workstation contracts.
Session 6j closes the verification-cost audit.

## Phase 6 symbolic representation

[E114](evidence/experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md)
selects compact bar-synchronized events for agent musical context. It selects
`ghostnote-note-patch-v0` for edit requests. The compiler owns exact state,
source and identity guards, pattern expansion, named defaults, and complete
candidate-state validation. The selected arm passed all 20 constraints across
GPT-5.4 Mini and Gemini 3.8 Flash. The direct API proof is not a fresh
host-agent session proof. Phase 7 must test that integration.

Session 6f1 tests established representations and behavioral evidence of model
familiarity. Session 6f2 tests nominal and realized groove timing, simultaneous
timing references, deterministic realization, and finer live grid support.

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

The archived E2 plan asked for a `1/128`-beat probe, but the retained probe
stopped at `1/32` beat. Later work selected a `1/64`-beat floor without measuring
the host maximum. State beat resolution and its conventional note-value
equivalent together, and do not treat a planned maximum as measured evidence.

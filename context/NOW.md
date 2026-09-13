---
title: Current state
kind: status
state: active
updated: 2026-09-12
phase: phase-6
session: 6e-semantic-music-analysis-and-manipulation
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 has an
accepted public result, but its generalized closeout remains. Current work is
Phase 6. Phase 7 owns the next dogfood loop. Phase 8 owns breadth, release, and
probe-runtime retirement.

## Next session

Run [Phase 6e: semantic music analysis and manipulation](plan/phase-6/6e-semantic-music-analysis-and-manipulation.md).
Define typed analysis over exact note data. Compare local libraries with direct
agent analysis. Test one constrained before-and-after transformation.

## Perceptual audio gate

[E108](evidence/experiments/e108-paid-gemini-fails-blind-controls.md) rejects
Gemini 3.8 Flash after a paid retry completed all 27 requests. It passed three
of five classifications on each repeat and two, three, and three of four
supported direction pairs. Its decisions were not repeatable. Exact silence
received three different false labels with confidence from `0.95` to `0.98`.

[E107](evidence/experiments/e107-gpt-audio-fails-blind-controls-and-gemini-is-unavailable.md)
rejects GPT-Audio-1.5 after an authenticated remote run. Its choices repeated
exactly three times, but it passed only three of five classifications and two
of four supported direction pairs. Wrong answers reported confidence from
`0.85` to `0.99`. Gemini 3.8 Flash accepted the key but returned
`503 UNAVAILABLE` on three bounded inference attempts before the paid retry.

[E106](evidence/experiments/e106-local-clap-does-not-clear-the-perceptual-provider-gate.md)
rejects two local CLAP checkpoints as a general provider. The general model
classified four of five controls. The music model classified one of five. Both
passed four simple direction pairs with exact three-repeat score agreement.

The adapters correctly refused stereo judgment at unknown or mono channel
boundaries. Do not publish a perceptual tool. No local or remote candidate
passed the blind gate.

## Deterministic audio-analysis gate

[E105](evidence/experiments/e105-ffmpeg-and-librosa-form-the-audio-fact-boundary.md)
selects two private providers. FFmpeg supplies stream identity, signal
aggregates, silence, spectral rolloff, and diagnostic spectrograms. A long-lived
librosa worker supplies voiced pitch, onsets, stereo correlation, and
amplitude-modulation rate. All selected results passed declared tolerances and
three-repeat determinism checks.

Raw YIN returned a plausible pitch for digital silence. The selected pYIN route
requires voiced state and returns null. Essentia was accurate but had a
31-second Python worker startup and an AGPL or commercial-license boundary.
The cost is once per worker, not once per sound. A broader feature review found
that Essentia is the technical breadth leader, but it did not change the
FFmpeg-plus-librosa verdict. Vamp with Sonic Annotator is the first fallback to
test if later work needs beat, key, or chord estimates. Aubio did not build in
the current environment. No public tool was added.

## Documentation retrieval gate

[E104](evidence/experiments/e104-exact-version-document-cache-and-routed-lexical-retrieval-pass.md)
selects source-routed SQLite FTS5. It found all nine expected items in its top
five. Installed API and localization are exact for 6.0.6. The 5.3 user guide is
a general-workflow fallback only.

## Audio capture gate

[E103](evidence/experiments/e103-master-recorder-produces-exact-project-local-wav.md)
proves the project-local MasterRecorder route. It needs a known saved project
directory because the API returns no file path. The extension registers 153
methods with wire hash `78368fe47ea0e814`.

## Workstation direction

Build independent, replaceable modules for deterministic operations and short
feedback loops. Prefer mature local tools and explicit artifact identity. Treat
Bitwig as one adapter. Use computer use for complex one-off interaction and
recovery. Keep perceptual judgments separate from exact facts. The operator
owns aesthetic judgment.

## Preset detour closeout

[D22](decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md) closes
non-native preset loading. E101 and E102 retain the measured route matrix. The
D03-only runtime was removed.

## Probe surface audit

The extension registers 153 methods. The product wire can emit 82. Phase 8b
owns classification and retirement of the remaining probe runtime. Do not
remove older probe methods ad hoc.

## Retrospective

Exact silence exposed both false perception and unstable labels. Keep silence
as the first control for every perceptual provider.

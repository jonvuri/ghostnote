---
title: Current state
kind: status
state: active
updated: 2026-09-12
phase: phase-6
session: 6d-perceptual-audio-model-evaluation
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 has an
accepted public result, but its generalized closeout remains. Current work is
Phase 6. Phase 7 owns the next dogfood loop. Phase 8 owns breadth, release, and
probe-runtime retirement.

## Next session

Run [Phase 6d: perceptual audio-model evaluation](plan/phase-6/6d-perceptual-audio-model-evaluation.md).
Use E103 for exact project-local audio and E105 for deterministic facts. Test
blind classification and directional judgment. Keep aesthetic authority with
the operator.

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

Digital silence exposed a plausible but false pitch. Require an independent
energy or voiced-state gate for every pitch estimate.

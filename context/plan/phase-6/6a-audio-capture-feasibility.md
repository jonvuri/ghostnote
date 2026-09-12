---
title: Phase 6a — Audio capture feasibility
kind: plan
state: complete
status: Complete. E103 proves three exact project-local MasterRecorder WAV files.
updated: 2026-09-12
parent: README.md
next: 6b-exact-version-offline-documentation-retrieval.md
---

# Phase 6a — Audio capture feasibility

## Purpose

Determine whether Ghostnote can obtain a bounded recording of Bitwig output as
an ordinary audio file. Prefer a typed, host-native route. Avoid system-level
loopback unless a native, universal route exists.

This session gates deterministic and perceptual audio analysis. It does not
select analysis tools or judge musical quality.

## Starting facts

- Bitwig Studio 6.0.6 runs Controller API 25 on this machine.
- `ControllerHost.createMasterRecorder()` exists since API 20.
- `MasterRecorder` exposes active state, start, stop, toggle, and duration.
- The API does not return audio bytes, an output path, or an artifact identity.
- `ffmpeg` is installed at `/opt/homebrew/bin/ffmpeg`.
- JumpAudio, JumpAudioMic, Overbridge, and RME CoreAudio components are installed.
  None is yet proved to provide a safe general loopback route.
- No BlackHole or Rogue Amoeba Loopback driver was found.

## Route order

### 1. Host-native master recording

1. Inspect `MasterRecorder` use in local API documentation and installed
   controller code.
2. Add only the narrow probe surface needed to observe active state and duration
   and to call start and stop.
3. Use a fresh disposable project with one owned deterministic signal and a fixed
   two- to four-bar playback range.
4. Snapshot likely Bitwig recording and project directories before the call.
5. Start recording, play the fixed range, stop recording, and diff the filesystem.
6. Identify every new artifact by path, format, size, timestamp, and content hash.
7. Repeat three times. Confirm independent non-silent files and stable ownership.
8. Remove every owned project and file artifact and restore the entry baseline.

Do not infer success from `duration()` alone. The route passes only if Ghostnote
can identify and read one exact audio artifact.

### 2. Project-native recording or render

If route 1 fails, evaluate whether supported typed project APIs can record a
known track or master source into an owned audio clip or file. Do not use named
actions. Require exact source, range, artifact identity, and cleanup.

### 3. Computer-use export

If no typed route works, test one bounded Bitwig export through computer use.
Use a fixed range and destination in a temporary directory. Measure UI steps,
modal state, latency, repeatability, focus changes, overwrite behavior, and exact
cleanup. Treat this as an independent provider, not a hidden Bitwig-adapter call.

### 4. Loopback boundary

Consider system-level loopback only after the first three routes fail. First
determine whether macOS or the active hardware supplies a native route that does
not require proprietary software or persistent audio-device reconfiguration.
Do not install a driver in this session.

Any loopback probe must prevent feedback. Keep capture monitoring disabled, cap
the duration, set a conservative level, and stop on an unexpected peak.

## Evaluation rubric

| Dimension | Required evidence |
|---|---|
| Source fidelity | Exact track or master source and fixed musical range |
| Artifact identity | Stable path or returned bytes, format, channels, rate, and hash |
| Reliability | Three consecutive captures with explicit completion |
| Speed | Setup, capture, settlement, and artifact-read times |
| Isolation | No microphone or unrelated system audio in the file |
| Safety | No feedback path, overwrite ambiguity, or retained-project mutation |
| Cleanup | Exact removal of owned project and filesystem artifacts |
| Portability | macOS dependency and likely Windows/Linux boundary |

## Acceptance criteria

- One route produces a readable WAV, FLAC, or another lossless ordinary file, or
  the session records why each non-loopback route fails.
- The source, range, channel count, sample rate, duration, and file hash are
  explicit.
- Three repeated captures complete without ambiguous files or manual artifact
  selection.
- A basic local check proves that each file is non-silent and not clipped.
- The route does not capture microphone or unrelated system audio.
- The result states all UI, permission, audio-device, and project-state effects.
- All owned live and filesystem artifacts are removed after the proof.
- The result gives a clear gate for sessions 6c and 6d.

## Out of scope

- Selecting a production audio-analysis library.
- Sending project audio to an external model.
- Evaluating perceptual or aesthetic judgments.
- Adding a public capture tool before the route passes.
- Installing or requiring a proprietary loopback product.
- Capturing retained user projects.

## Retrospective target

Record which initial API or filesystem fact most reduced the live search space.

## Result

[E103](../../evidence/experiments/e103-master-recorder-produces-exact-project-local-wav.md)
proves route 1. Three consecutive two-bar captures produced one exact WAV each
under the saved project's `master-recordings` directory. Each file was stereo
24-bit PCM at 44.1 kHz, non-silent, unclipped, and independently hashed.

The typed API does not return a path. A capture provider must receive or already
know the saved project directory, snapshot it before start, and refuse any
result other than one new stable lossless audio file. Routes 2 through 4 were
not tested because the first route passed.

Sessions 6c and 6d are open. Session 6b is next.

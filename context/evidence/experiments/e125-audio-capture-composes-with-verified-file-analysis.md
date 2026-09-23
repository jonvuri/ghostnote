---
title: E125 — Audio capture composes with verified file analysis
kind: evidence
state: active
updated: 2026-09-23
parent: ../../plan/phase-7/7e-audio-capture-and-analysis-composition.md
---

# E125 — Audio capture composes with verified file analysis [K]

## Verdict

The `audio-capture-v0` module captured one guarded launcher loop through
Bitwig's project MasterRecorder. It returned one exact project-local PCM WAVE
artifact without starting an analysis provider. A separate composed request
verified the artifact again and passed it to `audio-facts-v0`.

The live run used Bitwig Studio 6.0.6, Controller API 25, extension 0.0.1,
Node 24.11.1, and FFprobe/FFmpeg 8.1.2. The extension reported 153 methods and
method hash `78368fe47ea0e814`. The deployed build was fresh.

## Implemented boundary

The request requires an exact real `.bwproject` path, its full file-byte
SHA-256, an operator-established directory association, a matching live
project detector, and current generation, revision, scene, and content guards.
Bitwig does not expose the loaded project path. The association warning stays
in the result.

The source is the project master output during one launcher-clip loop. The
launcher clip controls the musical range. The contract does not claim that it
excludes other project-master output. The initial profile accepts 2 to 32 beats
from beat 0 on a 0.25-beat observation grid.

The typed live adapter owns recorder status, start, stop, transport stop, and
guarded launcher playback. The extension reserves a recorder owner token before
asynchronous activation. Status and stop are owner-bound. The guarded launch
checks project, revision, scene, content, durable track identity, row, and clip
occupancy in the same handler turn as launch.

The storage adapter snapshots `master-recordings`. It accepts exactly one new
stable regular lossless file and rejects zero, multiple, reused, changed, or
unsettled paths. It retains the bytes, computes a full SHA-256, and uses the
built-in narrow PCM WAVE header reader. Capture does not start FFprobe, FFmpeg,
librosa, or a loudness process.

The result keeps requested musical range and observed sample coverage separate.
It reports capture lead and tail. It does not claim sample-exact musical start
or stop alignment.

## Isolation fixtures

The focused suites prove:

- capture-only work does not start the analysis module;
- analysis-only work remains available after a capture guard failure;
- an analysis failure retains the successful capture result and artifact ID;
- invalid saved-project bytes and an active recorder refuse before effects;
- a concurrent recorder start has one winning lease and no losing stop;
- zero, multiple, reused, changed, same-size-replaced, and invalid-header files
  do not become artifacts;
- activation, stop, and settlement deadlines report their stage and effects;
- playback failure retries bounded transport stop and reports unknown effects
  when transport cleanup cannot be confirmed;
- recorder dropout, short duration, reconnect, and guarded launcher-identity
  changes fail closed; and
- provider discovery runs again for each state-changing capture request.

## Live result

The disposable project was `gn-7e-audio-capture`. Its owned source was an
eight-beat Polysynth launcher clip. The live detector returned the project name
without the Bitwig dirty-state `*` UI marker.

| Field | Observed value |
|---|---|
| Source manifest SHA-256 | `68d1711eba19ffdbcaf53a5756f2b3e7fad7a0bcb0d5354304cc39e3123a0fe2` |
| Requested range | `[0,8)` beats, one launcher loop, 0.25-beat steps |
| Observed playback start to wrap | 4,387 ms |
| File format | stereo 24-bit PCM WAVE, 44.1 kHz |
| File samples and duration | 239,616 samples, 5.433469 s |
| Recorder duration | 5,284 ms |
| File bytes | 1,437,880 |
| File SHA-256 | `1a2ac920798b5516850a5c584a1512abf6381dfd418ba14e415e81e1fa48fab7` |
| Alignment limit | not proved; 788 ms lead and 273 ms tail |
| Separate crest result | 13.016484 dB |
| Separate silence result | 2.747596 s at the 7d threshold |

The separate analysis result retained the same path, byte count, SHA-256,
sample range `[0,239616)`, and channels `[0,1]`. The full file SHA-256 was the
explicit field that kept capture and analysis independent. The analysis call
could re-identify the exact bytes without access to recorder state or capture
lifecycle state.

## Timing

| Capture boundary | Elapsed time |
|---|---:|
| Bitwig discovery | 41.173 ms |
| Saved-project association inside capture | 0.572 ms |
| Live source preflight | 743.297 ms |
| Recording-directory snapshot | 0.663 ms |
| Recorder activation | 141.073 ms |
| Playback and range observation | 5,225.408 ms |
| Recorder stop | 148.550 ms |
| Artifact settlement | 109.578 ms |
| Artifact read and SHA-256 | 3.218 ms |
| Header validation | 0.947 ms |
| Complete capture payload | 6,528.843 ms |

The registry's first saved-project preflight repeats the project association
before Bitwig startup. This run did not instrument that first pass separately,
so its isolated cost remains unknown. It prevents an invalid or missing project
from starting the live provider.

Analysis discovery took 158.510 ms. The separate analysis request used 2.814 ms
for source read and hash, 0.243 ms for header and scope validation, 60.128 ms
for provider probing, 52.544 ms for silence, 49.367 ms for crest inputs,
0.040 ms for output validation, and 0.818 ms for final source verification.
These values describe one machine and one artifact. They are not a latency
service level.

## Verification and cleanup

The 61 focused tests and the 1,130-test brain check pass. The extension Gradle
check, fresh live handshake, live composed probe, context check, and diff check
pass.

The live probe stopped transport and MasterRecorder, released the recorder
lease, removed the captured WAVE file, deleted its source track, and restored
the exact entry track list. The disposable saved project and its directory were
then removed. `gn-scale-test` was reactivated with its prior dirty state.

## Retrospective

The first live fixture attempt tried to verify clip identity before the empty
slot held a clip. It refused before recorder start. Fixture cleanup also learned
the owned track identity too late. The corrected probe first verifies only the
track cursor, records ownership immediately, creates the clip, and then verifies
the clip cursor. It also reports cleanup failures together with the original
failure. Future live fixtures must acquire cleanup identity at the first
confirmed creation boundary and must not hide cleanup errors.

The staged review found that recorder cleanup alone did not prove transport
cleanup after a playback failure. The capture failure path now retries bounded
transport stop and keeps the effects verdict unknown if confirmation fails.

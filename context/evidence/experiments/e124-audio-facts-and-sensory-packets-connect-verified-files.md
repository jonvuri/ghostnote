---
title: E124 — Audio facts and sensory packets connect verified files
kind: evidence
state: active
updated: 2026-09-23
parent: ../../plan/phase-7/7d-audio-facts-and-sensory-packets.md
---

# E124 — Audio facts and sensory packets connect verified files [K]

## Verdict

The `audio-facts-v0` module accepts verified local files without a Bitwig
connection. It reproduces the selected E118 brightness, loudness, crest and
silence controls. The pure sensory v1 router retains compatible facts and
computes only the declared paired deltas.

The run used Node 24.11.1 and FFprobe/FFmpeg 8.1.2. It used generated temporary
WAVE files. It did not read or change a Bitwig project.

## Implemented boundary

The v0 input accepts stereo 24-bit PCM WAVE at 44.1 kHz. The artifact limit is
16 MiB. A request selects one or both channels and a `[start,end)` range from
0.05 to 60 seconds. The declaration includes a full file-byte SHA-256, creator
and permission basis.

Stable bounded reads verify file identity, size, bytes, format, range and
channels before executable discovery. The module retains those bytes. Each
provider process reads a private temporary copy. A final stable read and hash
reject a path change during analysis.

The silence gate uses -90 dBFS and a 0.05-second minimum interval. It applies
only when the complete selected range has at most one uncovered sample. Thus,
low analog noise can still qualify as effective silence. The gate does not
require zero-valued samples. FFmpeg interval timestamps round to the nearest
sample before interval union and coverage calculation.

Rolloff uses FFmpeg's 85% magnitude cutoff. It uses complete 8,192-sample Hann
frames, no overlap, no padding and an incomplete-tail discard. The result is
the median across selected channels and complete frames. Loudness is integrated
EBU R128 LUFS. Crest is the largest channel peak dBFS minus the largest channel
RMS dBFS.

The tolerances are 0.1 LUFS, 0.001 dB crest, one sample for silence and two FFT
bins (`10.7666015625 Hz`) for rolloff. Brightness requires a loudness difference
of at most 0.2 LU.

## Controlled results

All eight primary source hashes match E118. Each file contains 176,400 stereo
samples and 1,058,444 bytes.

| Control | A | B | Sensory result |
|---|---:|---:|---|
| Brightness level | -24 LUFS | -24 LUFS | Level-compatible |
| Spectral rolloff | 226.099 Hz | 3,999.790 Hz | B minus A = 3,773.691 Hz |
| Explicit loudness | -26.7 LUFS | -14.7 LUFS | B minus A = 12 LUFS |
| Crest on identical bytes | 1.755905 dB | 1.755905 dB | No change |
| Silence duration | 4 s | 4 s | Brightness insufficient |

The silent pair returns null loudness and rolloff facts. It emits no direction.
An additional real-provider control selects samples `[4410,48510)` and channel
1. Channel 0 is silent. Channel 1 is non-silent only in the selected range. The
result reports zero seconds of silence with the exact declared coverage. Thus,
the control detects an ignored range or channel selection.

## Refusal and isolation fixtures

The focused suite covers:

- forged retained bytes before executable discovery;
- unsupported format, range, channel order and oversized input;
- source mutation after provider use;
- nontrivial stream-time-base conversion;
- silence with a low noise floor, a global one-sample allowance and partial
  silence without a gate;
- missing and timed-out executables without damage to another module;
- request cancellation during startup and provider timeout identity;
- impossible provider values;
- equal metrics with equal or different source hashes;
- brightness at and outside the 0.2 LU boundary;
- formula, frame, channel, field and provenance mismatch;
- loudness, crest, silence and brightness routing; and
- refusal of the unmapped `presence` property before provider work.

The module does not start librosa. It does not emit pitch, perceptual labels or
diagnostic images. Missing executable capability is local to the audio module.

## Timing and limits

Cancellation starts after 2 seconds for module startup, 20 seconds for a module
request and 5 seconds for each executable process. The registry permits at most
1 second for terminal cleanup after its deadline. Selected brightness providers
can run in parallel after the silence gate.

| Boundary | Elapsed time |
|---|---:|
| Generated fixture setup | 231.827 ms |
| Nine-source verification, inclusive | 5.650 ms |
| One-time executable discovery | 75.336 ms |
| Brightness requests, inclusive | 249.168 / 170.407 ms |
| Loudness requests, inclusive | 149.780 / 146.086 ms |
| Crest requests, inclusive | 133.164 / 133.924 ms |
| Silence requests, inclusive | 87.488 / 88.447 ms |
| Nonzero single-channel request, inclusive | 87.653 ms |
| Four packet routes, inclusive | 1.076 ms |

Brightness A used 41.983 ms for FFprobe, 44.631 ms for silence, 83.983 ms for
loudness and 70.717 ms for rolloff. Output validation took 0.036 ms. The final
path verification took 0.665 ms. Brightness B used 42.235, 43.350, 82.471 and
68.873 ms for the same provider phases. Its output and final verification took
0.004 and 0.660 ms. E124 retains the full per-request spans in the probe output.

These values describe one machine and one generated cohort. They are not a
latency service level. Fixture setup is not request work.

## Verification and cleanup

The focused audio suite passes 19 tests. The real provider probe passes and
reproduces the retained hashes and values. The full brain and context checks
pass. All generated WAVE files and provider temporary directories were removed.

## Retrospective

Review found that registry startup preceded runtime request preflight and that
a declared byte limit did not prove a stable bounded read. Follow-up review
made the silence tolerance global, linked request cancellation to startup, and
kept provider timeouts distinct. Future external-process modules should use the
same preflight and cancellation rules.

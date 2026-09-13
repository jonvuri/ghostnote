---
title: E105 — FFmpeg and librosa form the audio-fact boundary
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/phase-6/6c-deterministic-audio-analysis-tool-survey.md
---

# E105 — FFmpeg and librosa form the audio-fact boundary

## Verdict

Select two private and replaceable providers. Use `ffprobe` and `ffmpeg` for
stream identity, decoded signal aggregates, silence intervals, spectral
rolloff, and spectrogram rendering. Use one long-lived librosa worker for
voiced pitch, onset, zero-lag stereo correlation, and amplitude-modulation
rate.

The selected outputs are deterministic facts or bounded estimates. They make
no perceptual or aesthetic claim. No public tool was added.

Essentia was accurate but is not selected. Its Python worker import took more
than 31 seconds, and its open license is AGPLv3 for non-commercial
applications. Aubio did not build in the current Python and NumPy environment.

## Source cohort and tolerances

The probe generated five stereo 24-bit PCM WAV files at 44.1 kHz. It also read
one exact project-local Bitwig capture from the E103 route. The generated
sources were digital silence, separate 440 Hz and 880 Hz channel tones, three
512-sample transients, exact inverted stereo, and a 1 kHz carrier with 5 Hz
amplitude modulation.

The confirmatory source manifest hash was
`aa0212563c43002255f8505887baefc7aedf878a6fc553a998923ded95fced19`.
The tolerances were set in that manifest before the confirmatory run:

| Fact | Tolerance | Basis |
|---|---:|---|
| Sample peak | 2.384186e-7 linear full scale | Two 24-bit quantization steps |
| Signal aggregate | 5e-7 linear full scale | Text precision and decoded floating-point math |
| Spectral rolloff | 10.766602 Hz | Two 8,192-sample FFT bins |
| Pitch | 5.1 cents | The selected pYIN grid is 0.1 semitone |
| Onset time | 0.025 s | More than two 256-sample hops |
| Stereo correlation | 1e-6 coefficient | Exact inverted stereo construction |
| Modulation rate | 0.25 Hz | Four-second source resolution |

Every result includes the input SHA-256, typed units, result kind, and sample or
frame coverage. Stream fields and decoded sample aggregates are exact for the
declared bytes. Spectral, pitch, onset, stereo, and modulation results are
estimates. Silence intervals are thresholded. A spectrogram is a rendered
diagnostic, not a numeric fact or a judgment.

## Exact Bitwig source

The E103 probe ran against a fresh saved disposable project. It restored the
exact four-track entry list. The cohort used this first capture:

| Source | Value |
|---|---|
| Host | Bitwig Studio 6.0.6, Controller API 25 |
| Range | Eight beats at the visible 110 BPM |
| Sound source | Polysynth on one owned instrument track |
| File bytes | 1,195,192 |
| Format | Stereo 24-bit PCM WAV, 44.1 kHz |
| Duration | 4.516281 s |
| SHA-256 | `52650b7e902652e3941fdf30c86bf46380f42e7c9192b337829769471455fad5` |

The recorder probe made two other bounded sibling files to preserve its proved
three-run contract. They were not cohort inputs. All three files and the
complete disposable project were removed after the survey.

## Accuracy

The standard-library WAV decoder and NumPy 2.4.6 supplied the independent
numeric check. Known signal construction supplied the primary expected values.

| Area | Provider result | Error | Verdict |
|---|---|---:|---|
| Stream identity | FFprobe sample rate, channels, samples, duration | 0 | Pass |
| Peak, RMS, DC | FFmpeg across all six sources | At most 3.7443e-7 linear | Pass |
| Silence interval | FFmpeg: 0.0 to 1.0 s | 0 s | Pass |
| Spectral rolloff | FFmpeg: 446.814 Hz, 882.861 Hz | 6.814 Hz, 2.861 Hz | Pass |
| Pitch | librosa: 441.272 Hz, 882.543 Hz | 4.996 cents each | Pass |
| Silence pitch | librosa: null, zero voiced fraction | No false pitch | Pass |
| Modulated carrier pitch | librosa: 1002.132 Hz | 3.686 cents | Pass |
| Onsets | librosa: 0.104490, 0.406349, 0.905578 s | 4.490 to 6.349 ms late | Pass |
| Stereo correlation | NumPy in librosa worker: -1.0 | 0 | Pass |
| Modulation rate | librosa worker: 5.012531 Hz | 0.012531 Hz | Pass |

Essentia reported pitch within 0.188 Hz, onset errors from 6.032 to 16.871 ms,
and an exact 5 Hz modulation rate. Its float32 cross-correlation result was
`-0.99995929`, which missed the declared stereo tolerance. FFmpeg
`aphasemeter` reported `-0.99707` for the same exact inverse channels. Do not
use either output as an exact whole-stream correlation.

FFmpeg rendered all six spectrograms with a stable SHA-256 on each repeat. A
visual check of the tone image showed the expected stationary low-frequency
lines and no time-varying content. The generated images are diagnostic only.

## Determinism and cost

Each provider analyzed the same six source hashes three times in one process.
All three canonical result hashes matched for each provider:

| Provider | Version | Result SHA-256 |
|---|---|---|
| Independent check | NumPy 2.4.6 | `2b74ecd1576580ab7faf04adc8fb166499682f8491ae7023a5b208ac347b8f29` |
| FFmpeg | 8.1.2 | `28fcbf303efd25f364c4bd8521d5d6108b1915ddc372f1c05ffc72a5c6a46b12` |
| librosa | 1.0.0 | `19cc6d0fde3750bc3d7b561d23d1e8a1aaa66cd90c60066cdc5a4f8c49d1e233` |
| Essentia | 2.1b6.dev1389 | `33c0b75a7ecc6de1f5532dcbfc2d2b7127d8f5f057bb489483ec6be9a69e88d2` |

The latency values cover one complete six-source query. The warm range is the
second and third run. Resident memory is the highest observed current-version
run. Disk is the installed formula or isolated virtual environment.

| Provider | Startup or first run | Warm query | Peak resident memory | Disk |
|---|---:|---:|---:|---:|
| FFmpeg wrapper | 34.3 ms version process | 519.4–525.3 ms | 59.0 MB parent; 20.7 MB child | 53,532 KiB |
| librosa worker | 4,238.9 ms cold lazy run | 482.1–483.9 ms | 552,091,648 bytes | 308,560 KiB |
| Essentia worker | 31,460–32,908 ms import | 957.9–1,014.9 ms | 250,822,656 bytes | 73,984 KiB |
| Independent check | 41.1 ms first run | 30.0–30.5 ms | 136,331,264 bytes | NumPy formula: 41,152 KiB |

The Essentia import is a one-time cost for each Python worker process. It is not
a per-source cost when the worker stays active. A worker restart pays the cost
again. The measurement does not describe the direct C++ extractor or
Essentia.js. The warm value covers the complete six-source cohort and does not
define a uniform per-source cost.

Librosa's import is lazy, so its measured 1.1 ms import is not its startup
cost. The first analysis is the useful cold value. A rejected 0.01-semitone
pYIN grid needed 17.7 to 19.7 seconds per query and 3,629,645,824 bytes of
resident memory. The selected 0.1-semitone grid stays within 5.1 cents.

## License, platform, and activity

| Candidate | License and platforms | Activity and local boundary | Result |
|---|---|---|---|
| FFmpeg | LGPLv2.1+ by default. The installed `--enable-gpl` build is GPLv2+. Official downloads cover Linux, Windows, and macOS. | Local 8.1.2 was released 2026-06-17. Use the executable as a separate process. | Select |
| librosa | ISC. Version 1.0 requires Python 3.12 or later. Its Python dependencies support macOS, Linux, and Windows. | Version 1.0.0 was released 2026-08-11. The measured host was macOS 15 ARM64 with Python 3.13.5. | Select as a long-lived worker |
| Essentia | Official terms say AGPLv3 for non-commercial applications or a commercial license. Wheels cover Linux and macOS. Extractor binaries also cover Windows. | Python 3.13 resolved 2.1b6.dev1389 from 2025-07-24. The 2026-05-19 dev1438 wheels require Python 3.14. | Reject for this boundary |
| aubio | GPLv3+. Package metadata lists POSIX, macOS, and Windows. | Version 0.4.9 is from 2019-02-08. Its source build failed on macOS ARM64 with Python 3.13 and the current NumPy C API. | Reject |

Primary sources:

- <https://ffmpeg.org/legal.html>
- <https://ffmpeg.org/download.html>
- <https://github.com/librosa/librosa/blob/main/LICENSE.md>
- <https://librosa.org/blog/posts/1.0/>
- <https://essentia.upf.edu/licensing_information.html>
- <https://essentia.upf.edu/download.html>
- <https://pypi.org/project/essentia/>
- <https://pypi.org/project/aubio/>

## Broader feature follow-up

The local Essentia probe was narrow. It tested loading, pitch, onset, envelope,
and correlation. A later documentation review found that Essentia has the
broadest technical feature set. It includes EBU R128 loudness, multiple pitch
and beat trackers, key and chord analysis, tonal extraction, streaming graphs,
and TensorFlow model inference.

The table gives documented feature maturity for this application. `A` is a
mature first-class capability. `B` has a material limitation. `C` needs
substantial wrapper or validation work. `D` is impractical in the current
ecosystem. `—` means no credible first-class capability. These grades do not
replace the measured provider adoption result above.

| Capability | FFmpeg | librosa | Essentia | aubio |
|---|---:|---:|---:|---:|
| Decode and metadata | A | B | B | C |
| Signal, level, and loudness | A | B | A | C |
| Spectral and timbre descriptors | B | A | A | B |
| Pitch and fundamental frequency | — | A | A | B |
| Onset, tempo, and rhythm | C | A | A | B |
| Stereo and modulation | B | B | A | C |
| Key, chords, and tonality | — | B | A | — |
| Streaming and real-time use | A | B | A | B |
| Visualization | A | A | C | D |
| Learned embeddings and tags | — | — | B | — |

Vamp with Sonic Annotator is the best next deterministic benchmark for
high-level music features. Its replaceable plugin and process boundary fits the
Ghostnote provider design. AudioFlux is the strongest permissive challenger,
but its PyPI package is still marked alpha. LibXtract is a useful lightweight C
primitive library, but it needs separate decode and high-level orchestration.
Madmom, Meyda, Essentia.js, TarsosDSP, and openSMILE have larger maintenance,
scope, runtime, model, or license limits for this boundary.

Additional primary sources:

- <https://essentia.upf.edu/algorithms_reference.html>
- <https://essentia.upf.edu/streaming_extractor_music.html>
- <https://www.vamp-plugins.org/sonic-annotator/>
- <https://pypi.org/project/audioflux/>
- <https://github.com/jamiebullock/LibXtract>

The broader review does not change the verdict. Select FFmpeg plus a long-lived
librosa worker. Reconsider Vamp first if later work needs deterministic beat,
key, or chord estimates. Measure Essentia's direct C++ extractor separately if
its unique breadth becomes necessary, and resolve its license before adoption.

## Failure behavior

The wrapper verifies that each source exists, matches its declared SHA-256, and
is stereo 24-bit PCM at 44.1 kHz before it starts a provider. A missing source
failed in 150 ms. A hash mismatch failed in 80 ms. Both failures occurred
before FFmpeg started. The exact source was restored and the complete cohort
passed again.

Raw `librosa.yin` returned 2004.545 Hz for digital silence. The selected
`librosa.pyin` boundary returned null pitch, a zero voiced fraction, and no
model judgment. Essentia returned 0 Hz with zero confidence for silence. Its
Python binding also rejected an unexpected float64 array instead of converting
it silently. The wrapper now makes its required float32 conversion explicit.

## Provider contract

1. Accept an absolute local path, expected SHA-256, declared PCM format, sample
   range, and channel selection.
2. Verify identity and format before decode. Do not retry a missing, changed,
   unsupported, or ambiguous source.
3. Return a schema version, provider and version, input identity, typed value,
   unit, result kind, and exact coverage for every fact.
4. Keep `ffprobe` and `ffmpeg` as an executable provider. Pin the filter graph
   and parse its text into typed JSON. Do not expose raw log text as a contract.
5. Keep librosa in a long-lived isolated worker. Use pYIN with voiced state for
   pitch. Return null when no frame is voiced. Pin every frame, hop, threshold,
   and resolution setting.
6. Use the worker's NumPy array kernel for zero-lag stereo correlation and the
   declared envelope FFT for modulation rate. Keep these algorithms separate
   from pYIN and onset interfaces so they remain replaceable.
7. Keep spectrogram output diagnostic. Return its parameters and content hash.
   Do not infer an aesthetic or perceptual verdict from it.

## Cleanup

The temporary WAV files, spectrograms, result JSON, Python environments, UV
cache, numba cache, and disposable Bitwig project were removed. Bitwig remains
on the same empty four-track baseline. The repository retains only the probe,
measurements, and source identities.

## Retrospective

The digital-silence check caught the most misleading output. Raw YIN returned a
plausible numeric pitch for a source with no signal. Require an independent
energy or voiced-state gate for every pitch estimate.

---
title: E103 — MasterRecorder produces an exact project-local WAV
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/phase-6/6a-audio-capture-feasibility.md
---

# E103 — MasterRecorder produces an exact project-local WAV

## Verdict

The host-native route passes. Controller API 25 `MasterRecorder` writes one
ordinary WAV file to the saved project's `master-recordings` directory. A
filesystem snapshot identifies the exact file without manual selection.

Three consecutive captures passed. Sessions 6c and 6d can use this route. Do
not test project recording, computer-use export, or loopback unless this route
later fails its provider requirements.

## Static evidence

The installed API 25 documentation states that `MasterRecorder` controls the
project master recording. It exposes active state, start, stop, toggle, and
duration. It returns no path and no audio bytes.

The official Bitwig guide states that Master Recording captures the project
master track output and is independent of transport state. It also states that
the files are in the project's `master-recordings` directory:

- <https://www.bitwig.com/userguide/latest/master_recording/>
- <https://www.bitwig.com/userguide/latest/working_with_projects_and_exporting/>

No installed controller script used `MasterRecorder`. The API and project
folder facts reduced the live search to one saved disposable project and one
directory diff.

## Live source and range

The live host was Bitwig Studio 6.0.6 with Controller API 25. The extension
reported 153 methods and hash `78368fe47ea0e814`.

The disposable project was `gn-6a-master-recorder`. Its only sounding source
was an owned instrument track with Polysynth. The clip contained eight short
notes over eight beats. The project UI showed 110 BPM and 4/4. Each run created
a fresh clip, launched it from step 0, and stopped at the first step wrap after
step 28. This bounded the source range to bars 1 and 2.

The default audio track remained unarmed. The probe created no audio-input
track, enabled no monitor path, and changed no audio-device setting. Bitwig's
documented source was the project master output. Thus, the files did not
capture a microphone or unrelated system audio.

## Artifact results

The project directory was known before each run. The probe took a recursive
snapshot, started Master Recording, stopped it after the fixed range, and
required exactly one new lossless audio file. Times below are file modification
times in UTC.

| Run | Relative path | Bytes | Modified | Duration | SHA-256 |
|---:|---|---:|---|---:|---|
| 1 | `master-recordings/gn-6a-master-recorder - 2026-09-12 17.41.26.wav` | 1,201,336 | `2026-09-12T22:41:31.020Z` | 4.539501 s | `3b9988e3a3e55ef849e1788f36f327067bcad2722414a3fa5d4b6d181bc7187e` |
| 2 | `master-recordings/gn-6a-master-recorder - 2026-09-12 17.41.32.wav` | 1,198,264 | `2026-09-12T22:41:36.558Z` | 4.527891 s | `15f1f425c31b2e031812950f9af6e3c8bf777c83a1c569cd79aa4e7d7c0825ce` |
| 3 | `master-recordings/gn-6a-master-recorder - 2026-09-12 17.41.37.wav` | 1,192,120 | `2026-09-12T22:41:42.026Z` | 4.504671 s | `417b346c0c06318aa1d8f38525a3f7af66cab379b9a03b9ce276ecdc19fa3dc3` |

All files were stereo, 44.1 kHz, 24-bit little-endian PCM WAV. `ffmpeg`
`volumedetect` reported mean levels from -39.8 to -39.7 dB and a -27.3 dB peak
for each file. Each file was non-silent and was not clipped.

## Timing

| Run | Clip setup | Recorder active | Eight-beat playback | Recorder stop | File settle | Analysis | Total after setup |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 416 ms | 47 ms | 4,440 ms | 143 ms | 102 ms | 88 ms | 4,820 ms |
| 2 | 545 ms | 49 ms | 4,431 ms | 145 ms | 103 ms | 56 ms | 4,784 ms |
| 3 | 543 ms | 48 ms | 4,415 ms | 148 ms | 103 ms | 62 ms | 4,776 ms |

The complete command took 20.9 seconds. This includes process startup, bridge
connection, one-time track and device setup, three clip setups, capture,
analysis, and cleanup.

## Effects and cleanup

The typed capture calls did not need focus, a modal dialog, or a permission
prompt. Computer use created and saved the disposable project. It also restarted
Bitwig to load the deployed controller builds. A controller toggle reused the
old extension class loader.

The probe deleted its clip and source track after each use. The exact four-track
entry list was restored before the project closed. The transport and Master
Recorder were stopped. The complete disposable project directory and all three
WAV files were removed.

The pre-session empty unsaved project was saved before the required Bitwig
restart. An equivalent empty unsaved project was restored after the proof. The
safety copy was moved to Trash at
`ghostnote-6a-preserved-entry-20260912`; it remains recoverable.

## Provider boundary

`MasterRecorder` does not return the file path. A provider must know the saved
project directory before it starts, snapshot `master-recordings`, and require
one new stable audio file after stop. It must refuse an unsaved project, an
unknown project path, multiple new candidates, or a file that does not settle.

The capture API is part of Bitwig Controller API 20 and later. The typed route
has no macOS-only audio dependency and should apply to Bitwig on Windows and
Linux. The evidence probe used the Homebrew `ffmpeg` path only for local file
validation. A production analyzer must discover its executable independently.

No public capture tool was added in this session.

## Retrospective

The project-folder rule reduced the search most. It turned an API with no
returned path into an exact one-file directory diff.

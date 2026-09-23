---
title: E127 — Hybrid audio-guided sound-design dogfood passes
kind: evidence
state: active
updated: 2026-09-23
parent: ../../plan/phase-7/7f-hybrid-workstation-dogfood.md
---

# E127 — Hybrid audio-guided sound-design dogfood passes [K]

## Verdict

The real hybrid run completed with profile
`phase-7f-audio-guided-sound-design-v0`. It used the real `perc a` launcher
clip and its `Dist TUBE-CULTURE` device. The candidate raised `Output Tilt
Slope` from `0.3749999701976776` to `0.5`.

Separate `audio-capture-v0` and `audio-facts-v0` calls produced a valid paired
brightness comparison. Candidate B raised the 85% spectral rolloff by
519.485 Hz. Both sides measured -19.7 LUFS and 0 s of silence. The operator
auditioned identified A and B files and selected B. The candidate remains live.

The [S16 run record](e127-phase7f-hybrid-run.json) and
[audio evidence](e127-phase7f-audio-evidence.json) contain the complete machine
records. The root session ID is
`phase7f-6bceb873-21b7-4410-af10-7c80d87284d7`.

## Frozen run charter

- Operating mode: `hybrid`.
- Stable profile: `stable-v1`, description `ghostnote-description-v23`.
- Experimental profile: `phase-7f-audio-guided-sound-design-v0`.
- Enabled modules: audio capture v0, audio facts v0, sensory router v1, and
  hybrid run record v0.
- Intended seams: S01, S02, S11, S12, S13, S16, and S17.
- Permission: project-local temporary WAVE files and bounded device-parameter
  writes with recorded change IDs. No external reference was permitted.
- Acceptance: exact source discovery, two owned captures, separate verified
  analysis, independent write readback, compatible silence/loudness/rolloff
  evidence, no more than 0.2 LU difference, identified audition, explicit
  operator verdict, exact cleanup, and a complete S16 record.
- Expected exit: chosen parameter live, rejected state superseded through a
  recorded change, transport stopped, recorder inactive, exact play start
  preserved, temporary captures removed, and no unrelated project write.

The run used Codex in the IDE with model family GPT-5. Reasoning effort was not
exposed to the run. It used Bitwig Studio 6.0.6, Controller API 25, extension
0.0.1, method hash `78368fe47ea0e814`, Node 24.11.1, and FFprobe/FFmpeg 8.1.2.

## Exact source and operations

The supplied file path omitted the project directory level. The exact file was
`/Users/jonvuri/Dropbox/Bitwig Projects/6.0/26.25-6 fire/26.25-6 fire.bwproject`.
Its SHA-256 was
`f39d4bb301226ec4935e414448d105a1ea2b1bfabf72025f88e6317853ca722a`.

The preferred `keys` track had a real launcher clip but no device. The operator
selected `perc a`. Exact Ghostnote discovery found:

| Field | Exact value |
|---|---|
| Track ID | `2598ed2d-9e8c-40f4-8435-33609aad552a` |
| Launcher row | `6` zero-based |
| Clip | `MO_AP_fx_texture_spring_logs` |
| Loop | `[0,4)` beats |
| Play start | `0.28698158264160156` beats |
| Device | position 0, `Dist TUBE-CULTURE` |
| Parameter | `CONTENTS/PIDd`, `Output Tilt Slope` |
| Baseline | `0.3749999701976776` normalized |
| Candidate | `0.5` normalized |

The run needed two guarded writes after a system restart left the candidate
live. Change `b64b7f12-dc49-4e65-84ba-e8e6123d10ab` restored the baseline for
A. Change `a6ed5de7-509c-434d-80d2-3a916d6cb0b4` applied B. Separate complete
parameter inventories verified both values. B remains live, so the recovery
change is superseded and the candidate change is retained.

The plug-in did not settle its target-bound write callback within the bounded
window. Both stable calls therefore returned partial results with their exact
change IDs. A later independent inventory observed each requested value. The
run record keeps the callback failure and the verified readback as separate
claims.

## Capture, analysis, and comparison

Audio launcher clips report `playingStep` as `-1`. The capture controller now
uses owned slot state plus monotonic transport-beat advance for this case. MIDI
clips keep the prior step-based proof. The request preserves an exact non-zero
play start and observes one complete loop from that point.

| Field | A | B |
|---|---:|---:|
| Artifact SHA-256 | `cd89f6c811cca4cb02641b0c8f0770509ef1f19d3c3061a530dcb8462436f589` | `83aabe34984f734dc20b108f5b41c6dfa5651fc534817faffdc15d07189aa46e` |
| Artifact bytes | 931,000 | 943,288 |
| Capture total | 4,500.277 ms | 4,551.056 ms |
| Common analysis samples | 96,182 | 96,182 |
| Integrated loudness | -19.7 LUFS | -19.7 LUFS |
| 85% spectral rolloff | 4,949.945 Hz | 5,469.430 Hz |
| Silence | 0 s | 0 s |

Recorder lead and tail made the full file lengths unequal. Each full artifact
first passed byte, hash, header, and scope verification. S12 then projected it
to one 96,182-sample musical range and verified it again. The projection kept
the file path, byte count, and SHA-256 unchanged. It dropped only unequal
recorder lead and tail from the paired analysis scope.

Both projections used stereo channels `[0,1]`, 44.1 kHz, equal sample counts,
the same formulas, units, settings, provider versions, and complete coverage.
Sensory v1 passed the silence gate and the 0.2 LU gate. It returned 0.0 LU and
+519.485 Hz for B minus A. This evidence guided the audition. It did not make
the aesthetic verdict.

## S16 and authority separation

The run record links one request ID, two source IDs, two artifact hashes, three
evidence IDs, ten stable tool operations, and two change IDs. S01, S02, S11,
S12, S13, S16, and S17 record producer and consumer versions, projections,
translations, defaults, validation, and dropped data.

- Exact adapter and byte observations own target identity, parameter values,
  clip metadata, file bytes, and cleanup identity.
- `audio-facts-v0` owns loudness, rolloff, and silence measurements.
- The agent owns the interpretation that tilt was a plausible brightness
  control.
- Independent inventories own the verified write outcomes.
- Computer control owns the failed temporary play-start edit, its UI undo, the
  identified A/B playback, and the final visible state.
- The operator alone owns the `accepted-B` verdict.

The run made no external reference request. It recorded the system restart and
project reopen as external UI state. It refreshed exact Ghostnote state before
it resumed.

## Costs and limits

The run needed one operator source choice and one explicit A/B verdict. Earlier
attempts found four useful boundaries: `keys` had no device, a 32-beat source
did not fit the capture timeout, audio clips did not expose `playingStep`, and
full recorder files did not have equal sample coverage. One temporary UI
play-start edit was undone to its exact original value before the successful
run.

Bitwig still does not expose the loaded project path. Capture still includes
all project-master output. API 25 still cannot write exact displayed or
semantic parameter values. The target-bound plug-in callback still needs a
more reliable completion rule.

## Exit state

Fresh exact readback confirmed `Output Tilt Slope` at `0.5` and play start at
`0.28698158264160156`. Transport is stopped. MasterRecorder is inactive with
no lease. The workspace restored the entry selection. The UI shows the
`perc a` row-6 clip selected and shows a modified project marker.

The saved project reopened with the candidate value 0.5 before the final run.
It retains SHA-256
`f39d4bb301226ec4935e414448d105a1ea2b1bfabf72025f88e6317853ca722a`.
The run did not issue a whole-project save because that action could include
state outside the bounded parameter permission. Both exactly owned captures
were removed after evidence was written. `master-recordings` contains no WAVE
files.

## Interface decisions

| Interface | Decision | Reason |
|---|---|---|
| `audio-capture-v0` | Retain for more dogfood | It captured both real artifacts, but audio-clip range proof and sample scope need more runs. |
| `audio-facts-v0` | Graduate | It independently verified and analyzed both real files. |
| Sensory v1 brightness route | Graduate | It enforced compatibility, silence, and level gates without taking verdict authority. |
| `ghostnote-hybrid-run-record-v0` | Revise | The record is useful, but seam text and post-run final-state updates are too verbose and manual. |

## Verification

The 139 focused capture, adapter, and run-record tests pass. The 1,146-test
brain check, context check, JSON validation, live final-state query, file
cleanup check, extension check, and diff check pass.

## Retrospective

The composed modules found real incompatibilities before the audition. The
initial full-file comparison added ceremony because recorder lead and tail were
not paired coverage. Add a named common-musical-range projection to the
composition boundary. Also make final S16 state an explicit closeout update so
the runner does not freeze pre-verdict cost and UI details.

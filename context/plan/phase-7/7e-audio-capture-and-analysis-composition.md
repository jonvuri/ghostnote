---
title: Phase 7e — Audio capture and analysis composition
kind: plan
state: complete
status: Complete. E125 connects guarded launcher capture to independent file analysis; 7f is next.
updated: 2026-09-23
parent: README.md
prev: 7d-audio-facts-and-sensory-packets.md
next: 7f-hybrid-workstation-dogfood.md
---

# Phase 7e — Audio capture and analysis composition

## Purpose

Implement the E103 MasterRecorder boundary as an independent capture module.
Compose one exact capture with the 7d file-analysis module without coupling
their lifecycles or failures.

## Work completed

1. Required an exact saved project file, byte hash, directory association, and
   matching live source guards before capture.
2. Snapshotted the project-local recording directory and bounded one launcher
   loop on the project master output.
3. Added typed recorder, transport, and guarded launcher routes to the Bitwig
   adapter. Added extension-local recorder ownership.
4. Accepted exactly one new stable PCM WAVE artifact. Refused zero, multiple,
   reused, changed, invalid, and unsettled candidates.
5. Returned complete artifact identity without starting an analysis provider.
6. Verified the artifact again and passed it to 7d in a separate registry call.
7. Proved capture-only, analysis-only, capture-failure, and analysis-failure
   arms in focused tests and one live composed run.

## Result

[E125](../../evidence/experiments/e125-audio-capture-composes-with-verified-file-analysis.md)
records the implemented contracts, live artifact, separate analysis, timings,
failure fixtures, and cleanup. It closes S11, capture-to-S12, and capture
startup in S17.

The source contract is deliberately narrow. It captures the project master
during one guarded launcher loop. The launcher clip controls the range, but the
contract does not claim that other project output is excluded. The result keeps
musical range and sample coverage separate.

The capture result contains no retained analysis object. Composition uses the
artifact path, byte count, full file SHA-256, format, and scope to verify the
file again before `audio-facts-v0` starts.

## Implemented boundary

The session implemented
[audio-capture-v0](../../evidence/format/WORKSTATION_CONTRACTS.md) and closed
[S11, capture-to-S12, and capture startup in S17](../../evidence/format/WORKSTATION_SEAMS.md).
The typed adapter now exposes the selected recorder route with an explicit
version and deployment check. Product capture does not call the raw probe
client.

Capture remains a state-changing operation. It refuses an already active
recorder before start, establishes the saved-directory association, controls
the master and launcher range, and uses bounded stop and settlement handling.
Failure cleanup confirms transport stop before it can report known effects.
Failures retain known candidates and uncertain effects. The built-in header
reader starts no loudness or librosa analysis. Musical range and sample
coverage remain separate because E103 does not prove sample-exact alignment.

## Verification cost

The live capture payload took 6,528.843 ms. Playback and range observation took
5,225.408 ms. Recorder activation took 141.073 ms, stop took 148.550 ms, file
settlement took 109.578 ms, retained-byte hashing took 3.218 ms, and header
validation took 0.947 ms. E125 keeps capture, verification, analysis startup,
provider work, and final source verification separate. The first registry
project preflight was not instrumented separately and remains unknown.

## Acceptance record

| Criterion | Result |
|---|---|
| Separate modules | Capture and analysis retain separate schemas, capabilities, startup, requests, and failures. |
| Artifact fields | Source, range, path, format, channels, sample rate, duration, bytes, full SHA-256, and provider versions are explicit. |
| Saved project | Missing, changed, non-real, or mismatched project paths refuse before recorder start. |
| Failure isolation | Capture failure leaves analysis available. Analysis failure returns the successful capture unchanged. |
| Failure cleanup | Playback failure retries bounded transport stop. An unconfirmed stop reports unknown effects. |
| Cleanup | The recorder lease, transport, track, WAVE file, saved project, and temporary directory were restored or removed. |
| Verification | The 61 focused tests, 1,130-test brain check, extension check, fresh handshake, live composed probe, context check, and diff check pass. |

## Out of scope

- System loopback capture.
- Automatic analysis inside the capture provider.
- Perceptual labels or aesthetic acceptance.
- A stable public contract.

## Retrospective

The full file SHA-256 kept capture and analysis independent. The first live
fixture refusal also showed that cleanup identity must be recorded immediately
after owned creation, before later fixture setup can fail. Probe cleanup errors
must remain visible beside the original failure.

The staged review found one missing cleanup proof. Recorder cleanup did not
prove transport cleanup after playback failure. The failure path now retries a
bounded stop and reports unknown effects when it cannot confirm transport stop.

---
title: E119 — Offline verification-cost audit
kind: evidence
state: active
updated: 2026-09-21
parent: ../../plan/phase-6/6j-verification-cost-audit.md
---

# E119 — Offline verification-cost audit

## Result

The existing exact reader needs 20 bulk pages for 32 beats with a 2,048-step
reader. It needs 80 with a 512-step reader. The offline transport test confirms
both paths. E116's 32-plus-48 page statement applies to the smaller width, not
the selected default. This result corrects the current reading of E116. It does
not change the host timing or fidelity result in that experiment.

The existing context functions have a small local cost on these fixtures.
A caller that parses, renders, then fingerprints invokes validation three times
and rendering twice. The benchmark measures that sequence. It does not claim
that an unbuilt Phase 7 caller already uses it.

No live host, model endpoint, optional provider, or network was used. No product
code changed. No live baseline or selection needed restoration.

## Exact-read work bound

Sources are `readFineClipNotes` in the
[live adapter](../../../brain/src/adapters/live/adapter.ts), the configured
[reader width](../../../extension/src/main/java/com/ghostnote/extension/RigConfig.java),
and the [settlement budgets](../../../brain/src/contract/budgets.ts).
For positive observed extent L in beats and advertised reader width W:

- Binary pages = `ceil(512 * L / W)`.
- Triplet pages = `ceil(768 * L / W)`.
- Each scan with more than one page adds one page-zero reset.
- Each page and reset schedules a complete 144 ms wait.

The extent is the greater of observed play stop and loop end. A nonpositive
extent uses the existing four-beat fallback. The reader scans all 16 channels
per page and reuses that result for channel addresses in one snapshot.

| Extent | Width | Binary pages | Triplet pages | Resets | Scheduled waits |
|---:|---:|---:|---:|---:|---:|
| 4 beats | 2,048 | 1 | 2 | 1 | 576 ms |
| 8 beats | 2,048 | 2 | 3 | 2 | 1,008 ms |
| 32 beats | 2,048 | 8 | 12 | 2 | 3,168 ms |
| 128 beats | 2,048 | 32 | 48 | 2 | 11,808 ms |
| 32 beats | 512 | 32 | 48 | 2 | 11,808 ms |

These are code-derived scheduled delays, not measured live wall times or
upper latency bounds. Target acquisition, metadata, host scans, bridge calls,
reconciliation, revision work, and selection restore add time. E116's observed
73.494–470.067 ms host page scans used a different controlled workload. Do not
multiply that range into a promised full-read latency.

The new `6j: exact-read page cost follows the advertised reader width` case in
[adapter tests](../../../brain/src/adapters/live/adapter.test.ts) runs the real
reader against the existing cursor transport model. It checks late-page note
readback, all 16 returned channel entries, page count, reset count, and grid
settlement calls. Waits are disabled. Thus, this is a work-count proof, not a
new live timing measurement.

## Context measurement

Run from `brain`:

```sh
node --import tsx src/probes/phase6j-verification-cost.ts
```

The [probe](../../../brain/src/probes/phase6j-verification-cost.ts) uses the two
frozen three-event contexts and generated 128- and 1,024-event compact contexts.
The larger inputs have reversed event order, rational durations, and one track.
They test existing JSON parsing, schema validation, rendering, and text hashing.
Their source hash is fixture metadata. It is not a new exact-source serializer.

Runtime: Node 24.11.1, macOS ARM64, Apple M4 Pro. Each function has 20 warm-up
calls followed by 15 samples of 25 calls. Values below are medians of batch
means, in milliseconds per call. Startup and module import are excluded. The
retained run started after the test and typecheck processes completed.

| Fixture | JSON bytes | Text bytes | JSON parse | Validate | Render, with validation | Fingerprint, with render/validation | Hash existing text | Parse → render → fingerprint |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| compact-3 | 1041 | 714 | 0.0024 | 0.0156 | 0.0124 | 0.0134 | 0.0012 | 0.0368 |
| groove-3 | 2146 | 1423 | 0.0054 | 0.0211 | 0.0260 | 0.0221 | 0.0014 | 0.0710 |
| compact-128 | 16365 | 16568 | 0.0298 | 0.1507 | 0.1722 | 0.1820 | 0.0101 | 0.5504 |
| compact-1024 | 129311 | 132202 | 0.2620 | 1.1231 | 1.3915 | 1.4754 | 0.0800 | 4.4045 |

The render and fingerprint columns include other work. Do not add the columns
or subtract their medians to infer isolated render time. Small-case order can
vary with warm-up, garbage collection, and timer noise. These results are not
latency ceilings. The 1,024-event case is a size sample, not an input limit or a
worst case for long rational strings, groove references, or annotation counts.
The future module must set explicit request limits.

JSON fixture SHA-256 values identify the exact measured inputs:

| Fixture | JSON SHA-256 |
|---|---|
| compact-3 | `6a0c9f42632fea01349922cfcf77be8f6acd55f79cdf9bbd29b54eb67882fbc8` |
| groove-3 | `f80b8e3f744dc0deb86af64e52e167f24aa21edf2a0ef9270233e252382fbdc8` |
| compact-128 | `50beccb3e26860654e50cc8871c197c0c3b01da2beda285d5ef8d77b65154391` |
| compact-1024 | `ca21b97931eb247666b59b02d32b93908d09b31712aed3944c044f9c4be30d6d` |

The frozen context corpus fingerprint remained
`988840b62a1e6d5cb0daa05185c0f33f176d2af77083e595f3c75a663de462b0`.
Each benchmark checks equal rendered-text hashes and unchanged inputs before
and after measurement. JSON fixture hashes, rendered-text hashes, and the
planned exact-note-source digest are different domains.

## Limits and verification

No measurement was made for the unbuilt exact-source wrapper, proposal compiler,
reference adapter, sensory v1 router, capture adapter, module registry, or worker
protocol. Their latency stays unknown. E109 Python timings cannot fill these
gaps. Existing component results do not prove producer/consumer compatibility.

Type checking passed. The focused live-adapter, executor, settlement, and agent
context suites passed 174 tests. The tests used no live connection. Temporary
benchmark output and test logs were removed after their results were recorded.
The audit and successor rules are in the
[verification reference](../format/WORKSTATION_VERIFICATION.md).

## Retrospective

Always record the advertised reader width with page counts. Also state whether
a timing includes validation or rendering. These two distinctions prevented
incorrect scan and hashing cost claims.

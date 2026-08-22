---
id: E55
kind: evidence
state: active
source: phase-4-session-4c-direct-parameter-core
---

# E55 — DirectParameter core is live [K] (2026-08-22)

**Verdict: one confirmed serialized device cursor enumerated 32 named Sampler
parameters, changed one normalized base value, verified independent readback,
and restored the exact captured value.**

## Live result

The probe used the top-level Sampler on `MS20 Water Bass` in project
`26.05-2 moon`. The stable inventory contained 32 unique parameter IDs and
names. It selected `Pitch Transpose`, captured `0.5`, wrote `0.55`, and read
`0.55` through a new acquisition. Exact replay restored `0.5`.

The route uses `setDirectParameterValueNormalized(id, value, 1)`. It keeps the
general base value normalized from 0 through 1. It does not invent display,
modulation, or automation state that DirectParameter did not report.

## Acquisition boundary

A generation reset does not make Bitwig repeat DirectParameter IDs when the
device cursor already holds the same target. The adapter first moves through a
different visible track. It confirms that track, waits for the DirectParameter
observer to follow, and then clears the generation.

The return has two separate settlement boundaries. The parent cursor status can
name the target before the device-bank reply follows it. The adapter therefore
polls the device-bank track identity before it selects the positional device.
It then confirms the durable track ID, track position, device position, device
name, and both pin states. It accepts only the current generation after two
equal consecutive parameter inventories.

A parameter inventory that does not settle is `unstable`. It is not `missing`
or outside the bank window. A stable device or container stays readable with
`params` absent when only its parameter observer is unstable.

## Write and checkpoint boundary

Each parameter write has its own serialized stage. The adapter reacquires the
device and parameter before the write. It reacquires them again after the write
and compares the normalized value within `2e-3`. A non-taking write produces a
failed operation receipt and an executor disagreement.

The stash records the observed base value and replays it through `param.set`.
Typed handles can also preserve `modulatedValue` and `hasAutomation` as
warnings. These fields remain optional for direct-only parameters.

## Verification and cleanup

The full offline suite passed 679 tests. Typecheck and extension tests passed.
Full live conformance passed 54 cases with six expected skips. The live
DirectParameter probe passed all four checks. The fresh extension handshake and
the complete read-only accepted-project baseline passed.

An earlier failing conformance pass left `gn-conf-A` and `gn-conf-B`. Cleanup
deleted only those two tracks by their verified channel IDs. The accepted
project returned to seven tracks, 14 clips, and its exact recorded phrases.

## Retrospective

One serialized cursor is sufficient for correct enumeration, write, readback,
and reversal. The live run does not justify a wider cursor pool. Session 4h must
measure complete parameter batches before it adds concurrency.

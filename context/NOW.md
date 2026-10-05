---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h1a-first-pass
---

# Now

[8h1a](plan/phase-8/8h1a-cache-limit-knee-sweep.md) first pass is complete.
[E225](evidence/experiments/e225-cache-limit-knee-sweep.md) records it. All live
cache results keep `complete:false` and `eligible:false`. E131 keeps stable
authority.

Results: clip width costs nothing through 4,194,304 steps. The host keeps about
350 bytes for each sounding 1/512 cell in each bound cursor clip proxy, so the
clip-length limit is a sounding-cell budget. Each allocated observer costs
about 70 KiB, or 33 KiB with no cursor slot bank. Subscription changes nothing
measurable. The middle allocation (2,048 observers by 256 scenes, 1,024-track
bank) crashed Bitwig with an out-of-memory error; the maximum must not load.
Five implementation knees are fixed in the research cache (see E225).

Next: the 8h1a continuation session in the plan's Status section. Start with the
warm-read slowdown: 32 ms of enrichment host work with 2 allocated observers,
211 ms with 4,096. Suspect `eligibility` → `recorderTotal` → a sum over all
views for each coordinate. Then rerun binding with 0 cursor slots, isolate the
flat bank, derive deadlines, and run one combined arm.

[D29](decisions/d29-saved-anchor-project-replaces-protected-new-3.md): the saved
`gn-scale-test` replaces protected `New 3`. Restart Bitwig between loads. Open
`gn-scale-test`, then New Project for an owned project. Measure the live heap
with `jcmd <pid> GC.class_histogram` (the `BitwigStudio --launch` process) and
stop at 2 GiB. The driver is `npm run probe:phase8h1a-knee`.

The original config SHA-256 `256bbf07…43b0` is restored. The research archive is
removed and the normal extension is deployed. Normal hello: see the session
summary. Research build marker was `8h1a-knee-sweep-v7`; probe profile is 98
methods, hash `d89cee6bf21c1f96`.

Brain typecheck and all 1,831 tests pass. Extension `check`, all four archive
registrations, wire goldens, the new 8h1a artifact verifier, context, and diff
checks pass. Entry HEAD is `7441723`. Session changes are staged for review. No
commit is made.

## Retrospective

Change one dimension per load and measure the live heap by class. The first
pass changed four at once, could not attribute the cost, and crashed the host.
Profile research diagnostics at small scale before a sweep: four of five knees
were O(n) work in our own code, not host limits.

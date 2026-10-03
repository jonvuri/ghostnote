---
title: Current state
kind: status
state: active
updated: 2026-10-03
phase: phase-8-agent-native-live-engine
session: 8g3-snapshot-and-global-budgets-complete
---

# Now

Next session: [8g4 — Native topology and ordering](plan/phase-8/8g4-native-topology-and-ordering.md).

[8g3](plan/phase-8/8g3-snapshot-and-global-budgets.md) is complete. See
[E219](evidence/experiments/e219-snapshot-budgets-and-combined-storage.md):

- Snapshot enrichment uses a private candidate in bounded batches (40 ms
  adapter target, 50 ms hard limit, 5 s deadline). Each batch and the
  publication recheck the guard. Excess, deadline, cancellation, and guard
  change retire it and release its estimate.
- One resource ledger (`resourceAccounting`) reports the recorder, snapshot,
  authority, registry, and identity domains. Each domain applies its limit. No
  combined limit is selected. Heap is unmeasured.
- Live: the 16 MiB snapshot estimate passes equality at 16,777,216 bytes and
  refuses two bytes over. Two residents refuse each overlap and recover after
  eviction. Retirement during enrichment releases the candidate. Ping p95 under
  load is 25.06 ms. A TypeScript oracle agrees with the Java estimate.
- Recorder, authority staging, pending, width, and observer boundaries stay
  model-only or earlier evidence. Live inventory still refuses. All results stay
  `complete:false` and `eligible:false`. Do not enter 8h.

8g4 can use the shadow product: comparisons take 2–3 s, and each enrichment
poll runs one batch. `compareStart` accepts `maxEnrichmentCoordinates` as a
research control.

The staged diff contains only 8g3. Entry HEAD is `051a96b`. No commit is made.
Build markers: shadow `8g3-shadow-budgets-v2`, definition `e219-2`. Deploy the
8g controls product with `./gradlew copyShadowProbeExtension`.

The live state is at baseline. Hello passes on the normal profile with 85
methods, hash `bba7383dce25c0f0`, and init `2026-10-03T02:23:49.735Z`. Config
SHA-256 is `256bbf07…43b0`. The `New 1` API state equals the entry capture.
Fixture `New 10` was closed without saving. Original `New 1` remains open and
unsaved. Never save or close it. The 8g controls archive is removed.

## Retrospective

The first run used one 40 ms time budget per enrichment poll. A warm JIT
finished enrichment in one batch, so no partial work could be interrupted. For
interruption tests, use a deterministic count cap, not a timing budget. A run
must also clear owned clips at its start; the second attempt failed calibration
on notes left by the first. In this shell, `ruby context/check.rb` needs
`LANG=en_US.UTF-8`. No repository instruction change is needed.

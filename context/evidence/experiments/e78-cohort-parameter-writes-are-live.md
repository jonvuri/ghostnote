---
id: E78
kind: evidence
state: active
source: dogfooding-d02-session-3
---

# E78 — Cohort parameter writes are live [K] (2026-08-23)

**Verdict: four remote-control writes on one stable depth-2 device route now use
one preflight inventory and one complete readback. Each scalar keeps an
independent receipt and exact reversal.**

## Cohort execution

`set_parameter` partitions consecutive settings by track, complete device
route, and parameter view. A repeated scalar target starts a new cohort. This
keeps caller order and prevents two values from sharing one prior state.

Each cohort reads the complete top-level name and enabled fingerprint. It then
acquires one stable DirectParameter or remote-control inventory. That snapshot
supplies all scalar prior values and the guarded execution path. One complete
post-write inventory verifies every requested value.

The engine splits the cohort result into one recorded change per scalar target.
Each change has its own prior snapshot, receipt, verification result, and change
ID. `revert_change` can therefore restore one value without changing its cohort
siblings.

The live adapter serializes complete parameter mutation pipelines that share
the device cursor. It does not parallelize acquisition, writes, or readback on
that cursor. A structural or target-identity failure stops later settings in
the cohort. Earlier verified cohorts remain available as partial results.

## Offline proof

Fake, live-adapter, public-surface, encoder, and extension-source regressions
cover stable trace count, one-time acquisition, scalar receipts, failure stop,
concurrent requests, mixed-route order, exact reversal, and the durable nested
remote guards.

The focused cohort passes 247/247. The full brain check passes 856/856.
Extension tests pass.

## Live proof

The deployed extension reloaded fresh in project `New 2`. The 148-method
handshake passed with hash `eb3391803ef4eea4`.

The live probe created one owned scratch track. It inserted an FX Layer inside
an FX Layer, then inserted native Polysynth at depth 2. The public
`set_parameter` call changed the first four safe remote controls. The trace had
two inventory starts: one preflight and one complete readback. It carried four
guarded `remote.set` writes inside four ordered `batch.run` frames.

The public call returned four unique scalar change IDs and `verified: true`.
Its reported time was 4.381 seconds. The measured wall time was 4.383 seconds,
against the 33.3-second source baseline and the 16.65-second acceptance target.
This is an 86.8 percent reduction from the baseline.

Independent readback matched all four requested values. Four separate
`revert_change` calls restored the exact prior values. Cleanup removed the owned
scratch track and restored the exact four-track entry list.

## Retrospective

Assert every required guarded wire field in an encoder regression before the
first live run. This would have caught the missing remote track guard offline.

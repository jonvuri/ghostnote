---
title: E217 — A task scheduled from a mid-batch callback runs after the batch
kind: evidence
state: active
updated: 2026-10-03
parent: ../../plan/phase-8/8g2b-step-delta-read-window.md
---

# E217 — A task scheduled from a mid-batch callback runs after the batch

## Result

The 8g2b ordering rule **passes** for the measured scope. A zero-delay task that
a mid-batch callback schedules runs after the rest of that delivery batch.
No confirmation ran inside its batch. This is a named assumption for the
[8g2b step-delta window](../../plan/phase-8/8g2b-step-delta-read-window.md),
together with [D26](../../decisions/d26-step-data-delivery-is-a-named-assumption.md).
It is not a host input fence. No result becomes eligible.

| Run | Marker | Same-callback detours | Mid-batch callbacks | After batch | Inside batch |
|---|---|---|---|---|---|
| Run 1 | `e217-callback-ordering-v1` | 100 | 33 ticks | 33 | 0 |
| Run 2 | `e217-callback-ordering-v2` | 100 | 45 ticks, 16 RPCs | 61 | 0 |

- Each confirmation ran 20–26 ms after its callback, that is, in a later host
  cycle. In E216 the batch remainder arrived 19–76 µs after the tick. All 94
  confirmations saw a changed step count. Every depth-2 confirmation also ran
  after the batch.
- Bridge RPC callbacks run inside batches: 28 in run 1 and 16 in run 2. In run 2
  each RPC also scheduled a confirmation. All 16 ran after their batch. The
  bridge dispatches each request with `host.scheduleTask`, so an RPC callback
  uses the same task queue as a tick.
- 20 separate-callback detours per run gave no mid-batch callback. They are a
  control only.

## Method

`DeliveryCoherenceProbe` has an ordering mode. Each tick records the step
callback count and schedules a zero-delay confirmation chain of depth 2. In v2,
`deliveryPing` RPC records schedule a confirmation too. The driver
[`e217-callback-ordering.ts`](../../../brain/src/probes/e217-callback-ordering.ts)
runs `next, prev` in one callback against the E216 fixtures. P is `New 8` and Q
is `New 9`. Half of the runs flood the bridge with four concurrent pings for
400 ms.

The [analyzer](../../../brain/src/probes/e217-callback-ordering-lib.ts) groups
step callbacks into one batch when the gap between them is 2 ms or less. Batches
are about 23 ms apart. A mid-batch callback has step callbacks of its batch on
both sides. The rule fails if a depth-1 confirmation runs before the last step
of its batch, or if a confirmation is missing. Reports retain compact traces
within 3 ms of each batch. `verify` recomputes every summary. Applied to E216
focused-1, the analyzer finds its 11 mid-batch foreign ticks.

## Limits

Batch boundaries are inferred from time gaps. The host does not expose them.
Commands and observers share one controller process. The fixtures have one
witness clip per project and use controller-issued project actions. Run 2 ran
with two shadow observers bound to P. Native input and other host versions are
not measured. Separate shadow work in other callbacks can still change the step
count; the 8g2b window treats any change as a refusal.

## Artifacts

[Retained reports](../data/e217-callback-ordering/). Brain tests check the
analyzer and both retained runs.

| File | SHA-256 |
|---|---|
| `fixture-state.json` | `996218fd1569b67765a99cfb5f41bc44c2b060aa64d28440fe1e186ae3b3d7eb` |
| `smoke.json` | `d5c285b8f0d6759fe85ccabd786bbea905fd1118307db7decf1752b7fac7ee35` |
| `run-1.json` | `3d77f4596779f58dc8c110fdcea898e5aac1b7b528220612c7e4552f02d4d016` |
| `run-2.json` | `73d5713d42af8ccc6f12b15f79d0cf5c12e8b5e4a647549a60b6e7fd03faa8e9` |

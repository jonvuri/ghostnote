---
id: D10
kind: decision
state: active
source: DECISIONS.md
---

# D10 — Batch execution mechanics **[SETTLED 2026-07-25]**

**One request carries N ops; the brain partitions them into stages by declared
settle class and awaits a settle between stages. There is no `delayMs` knob,
because a caller cannot get pacing wrong if pacing is not expressible.**

- **The batch is the unit** (standing rule 4). E8 measured 240 note writes at 25ms
  as one batch versus 5804ms as separate RPCs — **232×**. Every `instant` op shares
  stage 0.
- **Settle budgets are NAMES with measured values**: `tick` 24ms, `noteWrite` 25,
  `gridChange` 144, `trackStruct` 144, `insertFile` 268, `paramsLive` 194,
  `deviceInsert` 600. Where a readback exists, poll instead of waiting.
- **`OP_SETTLE_BEFORE` is the mirror of `OP_SETTLE`** and is not interchangeable
  with it: it guards an op that READS state an earlier stage invalidated, which no
  amount of waiting afterwards can repair (E15-D).
- **The revision counter lives extension-side** (E8). A stale `ifRevision` rejects
  the batch WHOLE, applying zero ops. It guards ORDERING across processes but
  cannot detect OMISSION — hence standing rule 7, all writes through the daemon.
- ⚠ **All-or-nothing holds WITHIN a stage, not across stages.** A later stage can
  fail after an earlier one landed, and the receipt says which. E47 keeps this
  implementation. E45's timeout was dominated by brain-side exact reads and
  verification, so one deferred extension frame would not fix it. Background
  completion and cancellation now sit above the adapter instead.
- ⚠ **`note.props` must NOT be hoisted or coalesced across clips.** It resolves
  its note against the clip the cursor held at TURN START, so a props op that
  re-points loses everything, silently (E15-F). Interleaving write-then-props
  per clip is what makes the shipped plan correct. Cost: N clips with expression
  pay 2N stages and N × `gridChange`. **That is the price of correctness**, and
  the optimization was rejected with evidence rather than deferred.
- **The expression cost remains accepted after E47.** E44 measured it as a small
  part of the activated workload. E45 measured exact reads and verification as
  the latency bound. Session 2x does not trade E15-F correctness for a smaller
  non-binding cost.
- **Progress UX is free**: interleave `notify` ops into a batch (E8-C).
- **Background wall-clock time is explicit.** Operation status reports live
  `elapsedMs` from acceptance and freezes it at terminal state. E48 measures
  34,470 ms at the server and 34,569 ms through client polling for the accepted
  two-clip dogfood batch.

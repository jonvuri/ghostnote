---
id: E8
kind: evidence
state: active
source: FINDINGS.md
---

# E8 — Concurrency & safety mechanics: the batch/revision machinery holds (2026-07-20)

**Verdict: ● the §8 batch-execution and safety mechanisms all behave under
load and interference.** A server-side batch handler collapses N round-trips to
one control-surface turn (**232× faster** for the fast note-write class); staged
`delayMs` pacing respects the ~600ms device-insert settle (E3); mid-batch
`showPopupNotification` is a usable progress signal that does not stall the
batch; a monotonic revision counter rejects stale writes whole; and writes land
on a pinned cursor's target through concurrent user editing (E1b extended from
reads to writes). Probes `e08-batch` (A–D, automated) + `e08b-interference`
(the user-at-keyboard write test). This is **infrastructure de-risking**, not an
open architectural question — and the batch executor + revision counter are
real Phase-1 carry-forward code (`ProbeHandlers.batchRun`, `revision`).

### The batch executor — one request, one turn (Finding A, ●)

The Bridge already marshals every RPC onto the single control-surface thread via
`host.scheduleTask(…, 0)`, so **N separate requests pay N scheduling turns** (the
~24ms tick floor each, E5). A `batch.run` handler carries N ops in one request →
one task → **one turn**, dispatching each op through the existing handler table
(`dispatch(method, params)` reused verbatim per op). Measured on 240 single-note
writes to one clip:

| path | client wall | server work |
|---|---|---|
| `batch.run` (240 ops, 1 request) | **25 ms** | 1 367 µs for all 240 `setStep`s |
| 240 separate RPCs | **5 804 ms** | — |

**232× faster wall-clock.** The E2 two-turn write rule applies **once to the
whole batch**, not per op: all 240 writes land in one turn and become verifiable
one turn later, regardless of N. ⇒ the batch is the right primitive for the fast
op classes (note/param writes); a per-op-RPC design would pay the tick tax N
times for nothing.

### Staged pacing for ops that settle across turns (Finding B, ●)

A single synchronous turn is wrong for ops that materialise across turns — a
device insert (~600ms, E3), a track create (~144ms) — because a later op that
depends on the settle (a write into a just-inserted device) would run before the
device exists. `batch.run` takes an optional `delayMs`: ops are then handed to
`host.scheduleTask` one settle-budget apart, and the response **returns
immediately** (`{paced:true, scheduled:N}`) rather than blocking. A mixed batch
of 3 note writes + 2 Polysynth inserts paced at 650ms returned in 26ms and
drained fully in **3.3s** with all 5 ops landed (3 notes + 2 devices), confirmed
by readback. ⇒ **batches mixing note and structural/device ops stage naturally:
a fast phase in one turn, structural ops paced at their settle budget.**
Completion is confirmed by the standing verify-by-readback rule, not by the
batch response (which only acknowledges acceptance for a paced batch).

⚠ **Async-completion is a Phase-1 design point, not yet built.** The Bridge
writes a handler's response when it *returns*, so a paced batch cannot deliver a
single "all done" response at the end within the current contract — the probe
polls readback instead. A production executor that wants a completion callback
needs an async-response protocol (a handler returning a "deferred" sentinel and
the executor writing the final frame later). Recorded for `DECISIONS`.

### Mid-batch notification is a clean progress signal (Finding C, ●)

`showPopupNotification` invoked as ops interleaved into a paced batch
(`notify 0% → write → notify 50% → write → notify 100%`) fired all three popups
spaced across the batch without stalling it (notes still landed on schedule).
Because `notify` is just another dispatched method, progress UX is free — no
special batch machinery. ⇒ **the progress-UX baseline is "interleave notify ops
in a paced batch."**

### The stale-revision guard — optimistic concurrency (Finding D, ●)

A monotonic `long revision` counter on the executor implements the §8 stale-write
rejection:
- `batch.run({ops, ifRevision})`: if `ifRevision` is present and ≠ the current
  revision, the batch is **rejected whole** — nothing applied — returning
  `{applied:false, rejected:true, reason:"stale-revision", expected, actual}`.
  Verified: after an interfering `revision.bump`, a batch tagged with the old
  revision applied **zero** of its ops (note count unchanged), and resubmitting
  against the fresh revision applied cleanly.
- Acceptance claims the next revision immediately (`++revision`), so a second
  batch against the old revision is rejected even while a paced batch is still
  draining — correct in-flight semantics.

**Where revision state lives (the settled question):** on the **executor**
(`ProbeHandlers`), NOT on the `Rig` (which holds pre-allocated Bitwig handles) —
revision is executor policy, not a DAW object. And because **every request is
dispatched on the one control-surface thread**, the counter is touched
single-threaded and is **naturally serialized with the writes it guards** — no
lock, no atomic needed. That thread-confinement is the load-bearing property: it
is what makes "check revision, then apply, then bump" atomic for free.

### Write-under-interference — E1b extended to writes (Finding E, ●)

`e08b` pinned a pool cursor to gn-A (track + clip pin, the robust E1/E4 hold) and
streamed **40 paced note writes** over a ~16s window while the user clicked,
dragged, and switched clips/tracks elsewhere. Result across **21 observed
selection changes**: all **40/40 writes landed on gn-A's exact target cells** and
the cursor stayed pinned to (gn-A, slot 0). ⇒ the pinned-cursor addressing model
survives concurrent user editing **during a live batch**, not just for reads
(E1b) — the write path has the same immunity.

⚠ **Note-adjacency truncation (a real fidelity gotcha, found via a test
"FAIL").** The first `e08b` run failed an exact content match despite 40/40 cells
written: consecutive **same-pitch** notes each with `dur=1` (4 steps at
stepSize 0.25) truncate each other to `0.25` — Bitwig ends a note where the next
same-pitch note begins. This is correct DAW behavior, not a batch defect; the
test expectation was wrong (encoded a duration Bitwig won't keep). Fixed by
writing one distinct pitch per note. ⇒ **for snapshots/checkpoints: a written
note duration is not guaranteed to survive if another note follows on the same
pitch — readback is the source of truth (as everywhere in this spike), and a
checkpoint stores what `getStep` reports, never what was requested.**

### Decision impact → DECISIONS ("batch execution mechanics")

- **Batch execution model:** the executor sends **one `batch.run` request
  carrying N ops**, never N round-trips. Fast ops (note/param writes) run
  synchronously in one control-surface turn (232× the throughput); structural/
  device ops are **staged with `delayMs`** at their settle budget (~600ms device,
  ~144ms track, E3). The E2 two-turn write→verify rule applies once per batch.
- **Revision / optimistic concurrency:** a monotonic revision counter lives **on
  the executor**, thread-confined to the control-surface thread (no locking).
  Writes carry `ifRevision`; a mismatch **rejects the whole batch, applies
  nothing**. Acceptance bumps the revision so in-flight batches invalidate later
  stale submissions. This is the §8 stale-write guard, now demonstrated.
- **Progress UX:** interleave `showPopupNotification` ops into a paced batch —
  fires without stalling, no special machinery.
- **Async batch completion is an open Phase-1 build item** (not a blocker): the
  current Bridge writes a response on handler return, so a paced batch reports
  acceptance, not completion. A completion callback needs a deferred-response
  protocol. Verification today is by readback, which is the standing rule anyway.
- **Write-under-interference holds** — the pinned-cursor model is safe for
  optimistic apply while the user keeps editing. Combined with revision guarding,
  the two interference vectors (the user moves the selection; the user changes
  state we assumed) are both covered: pinning defeats the first, revision the
  second.
- **Note-duration is a readback-only fidelity fact** — same-pitch adjacency
  truncates; snapshot what `getStep` reports.

### Carry-forward

`ProbeHandlers.batchRun` (synchronous fast path + `delayMs` staged pacing, per-op
dispatch through the existing table + per-op error capture) and the `revision`
counter with `revision.get`/`revision.bump` + the `ifRevision` guard are
**Phase-1-quality infrastructure** — the batch executor is real Phase-1 code, not
a throwaway probe. Lift them; the only addition Phase 1 needs is (a) snapshot/
replay for revert composed on top (E3's primitive) and (b) the async-completion
protocol for paced batches.

---

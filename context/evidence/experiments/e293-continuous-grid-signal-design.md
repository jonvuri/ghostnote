---
title: E293 — Continuous Grid signal and frozen failure design
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E293 — Continuous Grid signal and frozen failure design

## Result

The [replacement design](../../plan/phase-9/9a-continuous-signal-design.md)
defines the continuous-signal protocol, bounded settlement, valid meter evidence,
zero/half/unity criteria, frozen first-failure samples, recovery, exact
restoration, and revised costs. It replaces V12's note pulses and quiet gates.
The unchanged Sine → Amplify → Audio Out fixture needs no test note. Stopped
transport with positive output is expected. Keep 9a active.

A read-only freshness trace must precede implementation. Offline inspection
found that V12's `DxI.EbT` also advances during invalid-packet decay. It cannot
alone prove fresh DSP output at zero. The design requires a valid-packet
witness with coherent value and age evidence. If that witness is unavailable,
the test must refuse, and a separate observable design session is required.
This session completes the design requirements; it does not establish that
the required observable is available on this host.

No runtime code, build, deployment, tool description, or live state changed.
No live request, note, factory, controller replacement, or fixture write ran.
V12 remains loaded with its session used and locked. E292's exact baseline
restoration remains valid historical evidence. The operator's later brief
activation means that current engine state needs verification before future
live work. Do not rerun V12 or its final restoration read. Descriptions remain
v52 with 44 tools. DSP adoption remains unproved.

## Protocol and evidence decisions

The eight windows are B+, B0, B-return, N+, N0, N-half, N-return, and R+.
The eleven graph stages and paired independent graph checks remain. Calibration
must pass before construction. Remove the note lease, note command path, and
note-release criteria. Retain note observation only for external-input refusal.
The engine remains connected during the continuous-signal sequence.

Each window reserves 1 second for settlement. Eight fixed paired-meter
checkpoints run at 250 ms intervals through 2 seconds. The final four form a
stable plateau. Collect once at 2.25 seconds, with a 2.5-second expiry. No retry
or adaptive selection of a passing plateau is allowed. Fresh valid packets
are required for both zero and positive measurements, independently for fixture
and master. Stable values need not emit value-change callbacks.

Zero is code at most 1 in every plateau sample. Positive controls require
codes 32–110, within-window spread at most 2, and full-gain agreement within
3 codes. Half gain uses the full quantization interval against both unity
plateaus; the whole amplitude-ratio interval must be within 0.40–0.60. Master
samples remain at most 1 throughout. Missing data never means silence.

The first failure seals its buffer in place. Cached status returns raw sample
values, times, packet witnesses, missing endpoints, first reason, and stage.
Later callbacks, abort, recovery, restoration, and release cannot replace or
extend it. Separate live completion state from the frozen failure. Keep a
fixed trigger slot for overflow. The primitive sample cap is 64 KiB and the
encoded report cap is 128 KiB. Status performs no document task.

Failure permits no inverse edit. Once native completion is proved, one
four-call read-only recovery remains available. Exact restoration still closes
only the fixture without save, checks or restores exact baseline bytes,
reopens, requires inactive state, reacquires identities, and runs the final
16-call paired baseline workflow once. Other projects remain untouched.

## Source inspection

The [manifest](../data/phase9a-continuous-signal-design/source-inspection.json)
records the pinned jar hash and seven `javap -p -c` inspections. Vendor output
stays outside Git in `/tmp/gn9a-continuous-signal-design`. No reference clone
was used. The jar matches E290's pin.

`DxI.ffA(hwy)` writes `EbT` at offset 142 in the valid branch. Its invalid
branch calls `mIz`, which also writes `EbT` at offset 84 after decay. This
corrects the earlier assumption that advancing `EbT` proves valid packet
freshness. `UoA.wi2(double)` returns without emitting an event when peak is
unchanged. The public combined peak uses `Cic.Uhv()[2]` and `Bsp.NaF()`;
the observer converts amplitude with exponent 0.3333 and scale 127.
A direct value read removes dependence on a change callback, but does not
supply the missing valid-packet proof. The next planned session traces that
proof before any implementation or live write.

## Read-cost investigation

The [analysis artifact](../data/phase9a-continuous-signal-design/read-cost-analysis.json)
is derived from E292's retained JSON and records source hashes. No timing
request was repeated.

| Read | Wire ms | Queue ms | Document ms | Traversal ms | Other document ms |
|---|---:|---:|---:|---:|---:|
| Prepare first | 67.652 | 0.121 | 29.060 | 6.812 | 22.248 |
| Prepare second | 44.802 | 0.168 | 19.389 | 8.513 | 10.876 |
| Restoration first | 67.971 | 0.381 | 43.544 | 21.241 | 22.303 |
| Restoration second | 62.796 | 0.369 | 19.600 | 7.453 | 12.147 |

All four have 53 nodes and 278 graph work steps. Encoded graph size is
35,828–35,829 bytes. Heap rises are 4/2/2/2 MiB; these are neither peak heap
nor GC measurements. The first restoration read is 99% above E289's 21.860 ms
maximum. Its traversal and residual both exceed its second read. Preparation
has a smaller first traversal but a larger first total. Thus no single cause
is isolated. Keep 43.544 ms as the observed maximum.

The source locates the timer boundaries. `GridGraphRead.capture` records its
traversal timer before repeated byte accounting. `GridEngineHandlers.queue`
records document time after guards, capture, witnesses, validation, and copies,
but before final response-size encoding. Other document time is subtraction,
not an isolated guard or reflection measurement. The small queue wait is
outside that document timer. Reopen work, JVM activity, byte accounting,
reflection, and guard costs remain possible contributors, not established
causes. No optimization is justified by attributing the residual to one part.

The implementation session must add scalar component timings inside the
existing calls and retain the old boundaries. Compare matched graph shape,
engine state, stage, and first/second reads in the admitted future sequence.
Do not add a timing retry or another restoration read. This addresses the
recorded increase without claiming it is explained or fixed.

## Revised cost and verification

The [cost model](../data/phase9a-continuous-signal-design/cost-model.json)
has 248 calls: prepare/run/restore 16/216/16. It retains
59 fixture captures, two detached captures, 11 graph edits, and one factory.
It removes four window calls and all 16 note writes from V12. Eight windows
use 64 checkpoint document tasks plus 16 begin/collect tasks. There are 72
timer entries and at most 64 controller deliveries. The rough scheduling
model is 384 units at 24 ms, or 9.216 seconds, including work inside dwell.
It is not a measured elapsed-time floor or a count of distinct host turns.

Plan 10 seconds warm requests, 1.95 seconds cursor settlement, and 18–20
seconds window dwell: about 30–32 seconds plus operator work. The graph-stage
allowance rises from 650 to 750 ms to reserve room for observed read variance
and measurement work. This does not establish their causal shares. Temporary
Java heap remains 16 MiB per graph stage. Native memory and cold work remain
unmeasured. Failure adds at most two cached calls and four recovery calls.
Product call budgets do not change. The [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
keeps measured V12 costs separate from this model.

[Verification](../data/phase9a-continuous-signal-design/verification.json) records
context validation, diff checks, source-hash verification, and offline budget
and ratio arithmetic checks pass. The design enumerates the implementation's
negative tests, including decay with advancing `EbT`, constant valid zero,
frozen samples after 10,000 later callbacks, late completion, and unchanged
16-call restoration. No runtime tests or live measurements were needed for
this documentation-only change. Session files are staged, not committed.

## Retrospective

Trace all writers of a proposed freshness field, including decay and reset,
before using it as an evidence gate. Keep timer boundaries beside measurement
comparisons so a residual is not mistaken for a named component. The new
contract includes both checks; no repository-wide instruction change is needed.

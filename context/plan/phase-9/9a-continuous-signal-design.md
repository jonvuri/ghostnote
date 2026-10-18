---
title: 9a — Continuous signal and frozen failure evidence
kind: plan
state: active
status: E294 finds no sufficient witness in the Java receive path. Design the observable before implementation. V12 remains used and locked.
updated: 2026-10-19
parent: 9a-live-grid-editing-spike.md
---

# 9a — Continuous signal and frozen failure evidence

## Scope and entry state

[E293](../../evidence/experiments/e293-continuous-grid-signal-design.md) records
this design. It replaces the signal, failure-report, and cost sections of the
[E290/V12 contract](9a-engine-adoption-design.md). Keep that contract as the
historical protocol and native update trace. Its note pulses, Q0/Q1 silence,
and note-release gates must not enter the replacement implementation.

The unchanged fixture is Sine X → Amplify A at 25% → Audio Out O. Spare
Amplify S at 50% is disconnected. It has no envelope or gate. Positive signal
with stopped transport is expected. Send no test notes, note-offs, transport
commands, or clip writes. Remove the note lease and note-command symbols from
the replacement engine probe. Keep the playing-note subscription only to
reject external notes; an empty note set is not proof of silence.

The result will test gain response during continuous output in this fixed Poly
Grid. It will not prove voice identity, uninterrupted or sample-accurate audio,
engine revision acknowledgement, or adoption by arbitrary Grid patches.
Graph readback, native command completion, and meter evidence remain separate.

V12 stays loaded: 118 methods, hash `2e939035ea90b8b0`, marker
`9a-grid-engine-v12`. Its session is used and locked. E292's exact restoration
passed. Do not repeat its prepare, run, or final restoration read. The operator
later briefly activated the engine. Current engine state is not established
by that earlier restoration. This design session makes no live request.

## Freshness prerequisite before implementation

The [offline inspection](../../evidence/data/phase9a-continuous-signal-design/source-inspection.json)
finds a limit in E290's witness: `DxI.EbT` advances in both the valid branch of
`DxI.ffA(hwy)` and `DxI.mIz()`, the invalid-packet decay path. Its constructor
also assigns it. A new `EbT` value is meter activity, not proof of a valid
DSP packet. A connected engine and an advancing `EbT` can accompany decay
to zero. Never accept that combination as a fresh zero result.

The public combined peak resolves `Cic.Uhv()[2]` and `Bsp.NaF()`. The getter
returns the current peak. `UoA.wi2(double)` does not emit an event when the
value is unchanged. Thus a missing callback can mean a constant signal or
zero. A cached callback cannot prove a fresh measurement. Keep public meter
callbacks for diagnostics and immediate master-leak refusal. Use timed native
snapshots for measurement; do not reset or resubscribe to induce callbacks.

[E294](../../evidence/experiments/e294-grid-valid-packet-witness-trace.md)
completes the trace with `fresh-meter-evidence-unavailable` in the inspected
Java receive path. The decoder consumes a 22-byte payload whose final byte
selects valid update or decay. It does not retain that validity. The document
update token `Svr.jCQ` can advance before invalid meter records are decoded.
Polling times and lease counters do not supply a per-target packet witness.

The raw validity byte is reachable in shared memory, but its native publication
order, coherent value snapshot, and per-target age are unproved. The reader
also changes shared cursor state. Do not use a raw address, a global token,
or `EbT` as a substitute. E294 traces Java writer sites and the event-dispatch
thread boundary; it does not prove synchronization with the native producer.
A valid zero update and invalid decay from zero can leave equal cached values.
This is a bounded negative result, not proof that every host observable fails.

The [next observable design session](#next-session--observable-design-after-the-packet-trace)
must resolve this gap before runner implementation. Keep these requirements.
Establish an existing, target-bound valid-packet sequence or timestamp,
with a value snapshot from the same update. It must distinguish valid zero
from decay, reset, initial binding, and stale cached values. Read it on the
correct document thread. Trace all writers and prove the synchronization
boundary. Do not infer validity from `EbT`, positive controls, or engine state.
Do not install hooks, replace a decoder, call packet/flush/reset methods, or
change the fixture to obtain a witness.

If no such read-only witness exists, record `fresh-meter-evidence-unavailable`.
Plan a separate observable design session; do not implement or deploy the
signal runner under a weaker claim. The timing and budget below require the
witness to fit one fixed snapshot task with no extra subscription or wire call.
A different mechanism requires a revised design and cost model first.

## Admission and fixed graph protocol

Use one session and at most one factory attempt per fresh initialization.
Mark the factory attempt before entry. A refused calibration consumes the
session. Never reset counters or retry to obtain a timing sample. Retain all
ownership, native edit, managed-ID, layout, and disposal rules from the
[attachment contract](9a-native-attachment-design.md).

Before future live work, inspect the current project, selection, transport,
engine state, and running drivers. If the engine is active, the operator must
deactivate it before inactive preparation. Preserve the live material listed
in NOW. The operator confirmed that `gn-scale-test` was open by chance. Its
unsaved changes are not important; it needs no inspection, preservation, or
restoration for 9a. A new deployment requires operator full
removal and selection of the final matching `ghostnote probe` product in the
complete controller list. A toggle or earlier duplicate can load cached
classes. Do not operate that Settings list. After confirmation, run
`npm run probe:hello` from `brain/` and verify the profile, actual method
count/hash, new marker, archive hash, and fresh initialization time.

The fresh cohort must pass paired baseline reads before activation. Reacquire
identities. Require `gn-grid-spike`, `grid-probe`, first device Poly Grid,
original graph, rectangles, empty Grid selection, idle edit, and public
selection. Keep MW/Expressions and the outer device identity. Track state:
muted, -10 dB, armed, active, no solo. Transport stays stopped at 1.1.1.00.
Verify saved project/backup SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`
and preset SHA-256
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.

Require operator isolation confirmation and a UI witness at most 60 seconds
old: no playing clips, incoming hardware notes, external audio input, active
sends, cue or alternate outputs, other sounding tracks, or automation that
changes the fixture. These route facts remain attestations where the probe
has no native read. Refuse an unexpected route; do not repair it. Native
checks require the same document, track, master, existing meter objects,
CONNECTED state, and non-null connection identity in every active task.
A reconnect, target change, note event, transport start, or loss of mute locks
the session. No engine toggle, bypass, reload, or outer-device replacement is
permitted from baseline measurement through graph restoration.

Each graph stage keeps 18 calls: two before captures, a command guard capture,
one edit, two independent after captures, release, and route/selection checks.
Both client and server must check the exact named delta. No failed or unavailable
read permits the next write. A newly attached Amplify N starts at unity at
(2, 0). Audio gain and native control values differ: A's saved 25% is native
`0.6299605249474366`; N's half gain is native `0.7937005259840998`.
Zero and unity are native 0 and 1.

| Stage | Only permitted change | Signal window after paired graph readback |
|---|---|---|
| Entry | None; four modules, X→A→O, S disconnected | B+: positive baseline |
| 1 | A: 25%→0 | B0: zero |
| 2 | A: 0→25% | B-return: baseline restored; calibration gate |
| 3 | Factory and attach N, disconnected at unity | None; exact attachment witnesses |
| 4 | Connect A OUT→N IN; retain A→O | None; three cables |
| 5 | Retarget O IN from A OUT to N OUT | N+: unity; X→A→N→O, no bypass |
| 6 | N: unity→0 | N0: zero |
| 7 | N: 0→half | N-half: half gain |
| 8 | N: half→unity | N-return: returned unity |
| 9 | Retarget O IN from N OUT to A OUT | None; original output route |
| 10 | Disconnect N IN | None; original two cables |
| 11 | Delete isolated N | R+: positive baseline; exact original graph |

Eight windows replace ten. There is no quiet entry or final quiet window.
Calibration B+, B0, B-return must pass before factory entry. Stages 9–11 are
success stages only, never automatic failure cleanup. Keep five modules,
three cables, 61 projected nodes, depth 12, 4,096 graph/query work, and 1 MiB
per graph response as hard maxima. Factory ownership has a 256-object cap
(the proved Amplify has 77). No undo/redo or edited-state save is part of this
signal test. Existing identities and rectangles stay exact during the run.

## Bounded settlement and measurement

Begin each window only after the preceding paired graph checks and release.
Record command-completion and readback times, but use window-begin monotonic
time t0 as the conservative start of post-edit settlement. Entry uses the
same window after engine admission. Begin clears only probe data and records
both meter snapshots and their valid-packet witnesses. Initial snapshots do
not count as measurement.

Schedule eight snapshot tasks at t0 + 250, 500, 750, 1,000, 1,250, 1,500,
1,750, and 2,000 ms. Each task reads both meters and route/engine guards in
one fixed document task. The first four are settlement evidence. Only the
last four define the measurement plateau. Thus at least 1 second is reserved
for settlement, and the plateau spans at least 650 ms with the allowed jitter.
No adaptive extension, retry, earliest-good-window search, or polling loop is
permitted. Set one independent deadline at 2,500 ms to lock and freeze an
uncollected window even if the client disappears.

A checkpoint may execute 0–100 ms after its scheduled time. Early, missing,
out-of-order, duplicate, or overlapping tasks make the window unavailable.
At most one native task can be outstanding. If its predecessor has not
finished at the next boundary, fail instead of queuing another. Delivery to
the controller must finish before that next boundary; the last must finish
before collect. A timer does not cancel native work. Cancel remaining timer
entries on failure; already queued callbacks must check the window generation
and lock before any host access. A late native return may update task-completion
state only, outside the frozen evidence.

For each plateau snapshot require, independently for fixture and master:

- A proved valid-packet witness newer than the preceding checkpoint, including
  the 1,000 ms checkpoint. Its packet must be after t0 and no more than 250 ms
  old at the snapshot. The trace must supply a clock or receipt-time mapping
  that proves this age; a sequence alone does not prove it.
- Peak value and validity belong to the same target and update. Reject a torn
  snapshot. If reads require a before/after sequence check, a mismatch fails;
  it does not cause an internal retry.
- Finite, nonnegative amplitude and integer meter code 0–127. Use the public
  transfer `floor(clamp(amplitude^0.3333, 0, 1) * 127)`. Store amplitude and
  code. No prior held peak or callback value can substitute for a snapshot.
- Monotonic sample order, unchanged engine/target tokens, and wall/monotonic
  elapsed-time difference at most 50 ms. Reject clock discontinuity.

Collect once at 2,250 ms; its document task must enter by 2,500 ms. It checks
all scheduled results and the current identities/connection, then seals the
result. Begin and collect use one wire call each. No document-thread sleep,
open edit during a window, or scheduled note task is allowed. A missing fresh
zero packet is unavailable, never a passing zero. Constant valid packets may
pass with no value-change callbacks.

## Predetermined gain criteria

Apply the same rules on server and client. Thresholds cannot change after a
live result. All observed master codes, including settlement, callbacks between
graph stages, and checkpoint snapshots, must be at most 1. Empty master data
cannot pass. This is observed meter silence, not a sample-by-sample audio
proof. Any external playing-note event fails isolation throughout the session.

For each plateau, let `lo` and `hi` be the minimum and maximum of its four
fixture codes. Require `hi - lo <= 2`. Settlement samples may contain a gain
transition; they cannot supply plateau values. All positive full-gain windows
must have `32 <= lo <= hi <= 110`, to exclude weak signal and saturation.
B-return, N+, N-return, and R+ must each match B+: the extrema across the two
plateaus must differ by at most 3 codes. N-return must also match N+ by that
rule. All four B0 and N0 plateau codes must be at most 1, with valid-packet
freshness. B0 needs B+ and B-return as positive controls. N0 needs N+ before it
and N-return after it. Do not label an unbracketed zero as a final pass.

For N-half, require a code below both unity plateaus. Let Hlo/Hhi be its
extrema, and Ulo/Uhi the extrema across N+ and N-return. With `p = 1/0.3333`,
the conservative amplitude-ratio interval is:

`[(Hlo/(Uhi+1))^p, ((Hhi+1)/Ulo)^p]`.

Require the entire interval to lie within [0.40, 0.60]. This includes meter
quantization and all plateau variation. Do not divide meter codes by two.
At N-half collect, check provisionally against N+; after N-return check the
full bracket before stage 9. Keep the half plateau summary until then.
A half-gain failure locks the run and does not trigger graph restoration edits.

## First-failure report and recovery

Use one first-failure latch for callbacks, scheduler, guards, native errors,
watchdogs, client abort, and result validation. The first failure atomically
locks writes and seals the active buffer. Record the offending sample before
sealing when it fits; on overflow keep the full prefix and a separate fixed
trigger slot. No ring overwrite, post-failure append, delayed timestamp update,
or replacement by a later cleanup error is permitted. Repeated status calls,
operator delay, recovery, final restoration, and release must leave the first
failure payload byte-equivalent. Live completion flags are separate fields.

Keep at most 2,048 callback records (sequence, relative monotonic time, kind,
code/note state), eight paired checkpoint records, a fixed trigger slot, and
bounded metadata in 64 KiB of primitive sample storage. Intern identity tokens
once per window. Retain no native object in a report. Seal the buffer in place
instead of copying it at failure. Cache the last completed window until the
next window starts; retain its small plateau summary for gain comparisons.
On failure outside a window, mark that last window as prior evidence with its
own stage/time; never label it as a current failure sample.

The frozen report contains protocol/build/controller and engine generations,
project/track/master identities, stage and window, first reason and source,
failure monotonic and wall times, start times, scheduled/actual checkpoint
times, sequence, codes, amplitudes, valid-packet witnesses, `EbT` diagnostics,
packet ages, counts, and a completed/missing flag for every endpoint. Include
cached last graph-readback status, factory/command attempted flags, native
completion and edit state at failure. Missing values stay explicit nulls.
No post-failure document read may fill a missing endpoint.

`status` and `abort` must remain cache-only after the lock. Return the frozen
sample payload under a 128 KiB encoded-response cap, including on collect
refusal. Budget bounded reason strings and use compact scalar rows. Reserve
space for the trigger and metadata before sampling. If encoding still fails,
return a prebounded envelope with the original failure and an explicit
report-unavailable reason; never erase the original latch or claim samples
were returned. Verify worst-case encoding offline. Report late completion,
restoration progress, and at most four secondary errors separately. These
cannot change the frozen payload. Export evidence before controller replacement.

No note cleanup remains. Failure sends at most one cached abort and one cached
status call. It performs no inverse edit, undo, redo, delete, save, or factory
retry. Keep the 4-second pre-operation deadline, 5-second response watchdog,
and 60-second cooperative automated-run deadline. Watchdogs cannot cancel
native work or establish completion. Pending sampler tasks count as native
work. While any task is unfinished, permit cache-only status and operator
inspection. A blocked host can require restart.

After native completion, allow one four-call recovery: bind the original
proved target, two bounded diagnostic reads, release. No cursor move, schema
walk, graph write, or unlock is allowed. A failed recovery read is not retried.
If target identity changed, omit recovery and use operator restoration. Keep
recovery results separate from the frozen first failure.

## Exact baseline restoration

On success or failure, require stopped transport and operator engine
deactivation. If native completion or host state is uncertain, inspect or
restart before any further document operation. Close only `gn-grid-spike`
without saving. Confirm it is closed. Preserve the live material listed in
NOW; `gn-scale-test` has no preservation requirement.

Check the saved project and verified backup. If both equal the baseline hash,
reopen the saved file. Otherwise restore the closed fixture from the verified
backup, check exact bytes and hash, then reopen. Never save a semantically
restored graph over the baseline. The preset must keep its recorded hash.

Reopening can activate the engine. The operator must deactivate it again.
Reacquire UUIDs; do not require pre-reopen module UUIDs. Run the final workflow
once, still 16 calls, with two exact baseline captures. Require original graph
semantics, rectangles, idle edit, empty Grid selection, intended outer device
and modulators, muted -10 dB armed active track, stopped 1.1.1.00 transport,
no playing notes, inactive engine, unstarred tab, and exact file hashes.
Release epochs, weak references, and the session without clearing the used
allowance, write lock, or frozen failure. If any condition fails, report the
actual state. Do not claim exact restoration or repeat the restoration read.

## Revised costs before implementation

Typical and maximum scope are the same fixed four→five→four-module cycle with
at most three cables. The maximum dwell includes scheduler tolerance, not
extra samples or retries. These are design allowances, not measurements.

| Component | Wire calls | Work |
|---|---:|---|
| Prepare | 16 | Two baseline captures; inactive admission |
| Eleven graph stages | 198 | 55 captures, two detached captures; one factory, one attachment, five value edits, four cable edits, one delete |
| Eight signal windows | 16 | Begin/collect witness tasks; 64 timed paired meter snapshots |
| Run controls | 2 | Session begin and final cached status |
| Final exact restoration | 16 | Two baseline captures and release |
| Total | 248 | 59 fixture captures, two detached captures, 11 graph edits, one factory, zero note writes |

Prepare/run/restore are 16/216/16 calls, down from V12's 16/220/16.
There are 80 window document tasks: 16 boundaries plus 64 checkpoints.
Schedule eight checkpoint launches and one expiry per window (72 timer
entries), plus at most 64 controller completion deliveries. At the ledger's
24 ms unit, 248 wire turns give 5,952 ms. Counting all 136 additional scheduled
entries separately gives a conservative 384-unit / 9,216 ms scheduling model.
This is not 384 guaranteed distinct host turns. Document queue/completion may
add turns; scheduled work overlaps dwell and must not be added twice.

Allow 750 ms warm wire per 18-call graph stage (8.25 seconds), 1.20 seconds
for prepare/restoration, and 0.432 seconds for window/run-control calls:
9.882 seconds, rounded to 10 seconds. Add 1.95 seconds cursor settlement
(13 × 150 ms), plus 18 seconds nominal dwell (8 × 2.25 seconds), or 20 seconds
at the admitted maximum. Plan about 30–32 seconds plus operator work. Record
actual document entry and completion times; the 60-second cooperative limit
still ends the run. Native blocking has no finite time guarantee.

The 750 ms graph allowance is 100 ms above E290's 650 ms plan and 32–34%
above E289's 558–567 ms attachment workflows. This reserves room for the
observed read variance and added measurements; it does not attribute that
variance to a cause. Keep the unmeasured 60 ms active attachment document
estimate separate from the observed 43.544 ms read maximum. E292 measured
only preparation, refusal, and restoration; it supplied no active attachment
cost. Compare matched graph shape, stage, engine state, and first/second read
in the future run. Explain increases over 20 percent with evidence or keep
them explicitly unexplained. Do not reset or repeat a used session for timing.

Keep 16 MiB temporary Java heap per graph stage, 64 KiB fixed sample storage,
128 KiB encoded signal/failure response, and 1 MiB graph response. Two VU
subscriptions and one isolation-only note subscription remain; no new host
subscription is assumed. Their memory and callback costs are unmeasured.
Stream graphs and completed windows to disk. Cold work is one symbol/descriptor
resolution set, initial paired reads, meter binding, first engine activation,
first factory lookup/possible file parse, and reacquisition after reopen.
No cache-cold or native engine memory bound is claimed. Checkpoint CPU, native
engine heap, peak/retained Java heap, and process-memory delta need measurement.

Failure adds at most two cache-only calls plus four recovery calls and two
captures, zero writes. Final restoration is already included. Report operator
work, hello, deployment, cancelled timers, late tasks, and restart separately.
Product call budgets and public descriptions v52 remain unchanged.

## Read-cost investigation and planned sessions

The [derived measurements](../../evidence/data/phase9a-continuous-signal-design/read-cost-analysis.json)
retain all four E292 reads. Queue waits are 0.121–0.381 ms. All graphs have
53 nodes and 278 work steps. The 43.544 ms maximum is 99% above E289's
21.860 ms maximum. Its graph traversal is 21.241 ms, with 22.303 ms left
inside the document timer. The second restoration read is 19.600 ms:
7.453 ms traversal and 12.147 ms other document work. Both portions change.
Preparation is 29.060/19.389 ms, with traversal 6.812/8.513 ms. A faster
traversal can accompany a slower total. Heap samples do not identify GC.

`GridGraphRead.capture` records traversal time before its repeated byte-size
encoding. `GridEngineHandlers.queue` records document time after guards,
navigation, capture, native witnesses, validation, and copies, but before the
final response-size check. The residual includes several components; it is
not a measured guard cost. Small queue waits and equal graph scope exclude
neither JVM nor reopen effects. No isolated cause follows from these samples.

### Next session — valid-packet witness trace

Completed by [E294](../../evidence/experiments/e294-grid-valid-packet-witness-trace.md).
The inspected Java path does not supply the required valid-packet witness.
The 248-call plan remains conditional. No runner implementation or deployment
follows from this trace. V12 remains used and locked.

### Next session — observable design after the packet trace

Source: E294's receive-path table, writer audit, and native-publication limit;
E293's continuous-signal and failure contract. Select a complete independent
observable before runner implementation. Compare a bounded offline trace of
the native shared-memory producer/publication protocol with other existing
host signal evidence. Do not assume either route is available.

For each candidate, specify the exact target binding, valid-zero proof,
freshness and age source, value/validity synchronization, read thread, lifetime,
limits, and refusal behavior. A raw validity byte with a document token is
insufficient. A native trace must identify the producer, record layout, all
relevant writers, and publication/read ordering; do not infer a sequence from
an unclassified header word. Other evidence must meet the same signal criteria.
Record the source boundary and remaining limits for each rejected candidate.

Keep the unchanged fixture, muted track, stopped transport, no test notes,
first-failure freeze, one-session limit, and exact restoration. Make no live
call, new subscription, hook, native-memory read, decoder call, or deployment
in this design session. If a candidate needs a different mechanism or scope,
write that proposed contract explicitly before implementation. Recalculate
calls, tasks, cold work, write stages, heap, and evidence caps for the typical
and maximum cases. Preserve the final 16-call restoration workflow. Retain
the unexplained 43.544 ms read maximum and the planned component timings.

Acceptance: select a justified observable with reproducible source evidence,
negative cases for stale/invalid/torn zero, and a revised cost model; or record
that no admitted candidate is proved and plan a specific next research session.
Do not implement the runner or weaken freshness to force a pass. Keep 9a active.

### Then — replacement probe implementation and offline checks

Source: this design plus an accepted observable design that resolves E294.
The negative trace alone does not admit implementation. Implement the fixed
continuous-signal state machine, timed snapshots, atomic frozen report, and
cache-only status. Remove note injection and quiet-before-note assumptions
from Java, the TypeScript driver, and their tests. Retain V12 evidence as
history. Use a fresh deliberate build marker; derive its real inventory.

Add scalar timings inside existing calls: guards and symbol resolution,
navigation/projection, traversal, graph byte accounting, native witnesses,
validation/copies, response encoding, queue and completion. Preserve old timer
boundaries for comparison and avoid counting nested times twice. Add no read,
reflection walk, or forced GC for timing. Use the admitted before/after pairs
for comparison; final restoration stays 16 calls with one paired read.

Offline checks must cover the complete 248-call sequence and zero note calls;
all stage refusals; unchanged continuous values without callbacks; valid zero
with no callback; advancing `EbT` from decay with no valid packet; stale,
missing, torn, reordered, duplicate, and late evidence; clock discontinuity;
all quantization boundaries and bracketing controls; drifting plateau; master
leak and foreign notes; mute loss; target/connection replacement; client loss;
freeze at the first sample and at overflow; repeated status and abort after
10,000 later callbacks; late native completion; and failure during recovery
and restoration. Assert byte-equivalent frozen payloads and no new host calls
from cache-only status. Test maximum payload encoding and primitive storage.
Retain attachment ownership/disposal tests and independent graph predictions.
Run focused Java/TypeScript checks, typecheck, profile inventory checks, product
call budgets, live adapter frame checks, context validation, and diff checks.
No public description change is expected; verify that in the implementation.

### Then — fresh bounded live gate

Source: this design and the implementation E record. After offline acceptance,
verify current state, deploy, obtain operator replacement, and pass fresh hello.
Run one admitted session. Preserve full samples and separate graph/signal
verdicts. Measure the revised call/timer budgets and read components using
existing calls. Calibration refusal must precede construction. Complete exact
restoration and retain the first failure if any. A pass requires every signal
and graph gate plus restoration. Keep 9a active until its bounded verdict is
recorded; wider Phase 9 scope remains unselected.

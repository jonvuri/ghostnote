---
title: 9a — Engine adoption design
kind: plan
state: superseded
status: Historical V12 protocol. E296 selects operator audio acceptance; V12 remains used and locked.
updated: 2026-10-19
parent: 9a-live-grid-editing-spike.md
---

# 9a — Engine adoption design

## Replacement after E296

The [operator audio test](9a-operator-audio-test.md) is the current contract.
It replaces the automated signal requirement, note lifecycle, failure report,
cost model, and next-session instructions. The interim
[continuous-signal design](9a-continuous-signal-design.md) is deferred.
The remaining sections preserve E290/V12 history and the native update trace.
Do not execute the historical driver procedure below.

The unchanged Sine → Amplify → Audio Out fixture has no envelope or gate.
Positive output with stopped transport is expected. E293 also finds that
`DxI.EbT` advances during invalid-packet decay. It is not sufficient proof of
a fresh valid packet. The replacement requires a read-only valid-packet witness
before implementation. V12 stays loaded with its session used and locked;
do not repeat prepare, run, or its final restoration read.

## Decision and scope

[E290](../../evidence/experiments/e290-grid-engine-adoption-design.md) records
this design. [E289](../../evidence/experiments/e289-native-grid-attachment-and-persistence.md)
proves document attachment with an inactive engine. Keep 9a active. This
contract adds a separate signal test. It does not claim that the engine has
adopted a module, or authorize implementation or live writes in E290.

Use the exact four-module fixture. Insert one native Amplify at (2, 0), then
put it between the existing 25% Amplify and Audio Out. Measure the same input
at new-module gains 1, 0, 0.5, and 1. Keep the engine active from calibration
through the successful graph-restoration stages. Do not reload the project, toggle the engine, bypass the
device, or replace the outer Grid between these measurements.

The observable is the fixture track's engine-fed peak meter, with a fresh
packet witness and bounded note pulses. It is independent of the module
serializer, parameter readback, command receipt, and UI. The existing Amplify
supplies a positive/zero/positive calibration before the factory is used.
If the muted track does not produce a usable meter signal, stop before
construction. Do not unmute it or substitute a different fixture in this run.

A pass proves adoption for newly triggered voices in this fixed Poly Grid
while its engine connection remains active. It does not prove replacement of
a graph inside an already sounding voice, sample-accurate transitions, arbitrary
modules, feedback, other Grid devices, or general failure atomicity.

## Native update trace

The [manifest](../../evidence/data/phase9a-engine-adoption/environment-design.json)
pins Bitwig 6.0.6's jar to
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.
It records 27 exact class names and `javap -p -c` hashes. Use fully qualified
names: short obfuscated names occur in several packages. Vendor bytecode is
local at `/tmp/gn9a-engine-design/exact`; it is not part of the repository.
No reference clone supplies this trace.

| Source and method | Observed path and implication |
|---|---|
| `device.gOr.ffA(had,int)` | Calls inherited insertion, `NHx.cG3(had,int)`, the optional `UZp.eOi(DbL)`, and `mIz()`. Keep the native body and virtual dispatch from the attachment contract. |
| `device.NHx.ffA(had,int)` | Calls `HEV.ffA(cYy,HEV,HEV,int)` before `List.add`, parent assignment, and initialization. `YYz.MkF()` defines owned relationship `auxiliary_devices`, property 6428, flags 409. |
| `ramona.core.HEV.ffA(cYy,HEV,HEV,int)` | Performs owned-child preparation, calls the registered `aPZ` listeners, and propagates the event to its parent. `aPZ` dispatches `jbx.aboutToInsertItem`. This precedes completed membership. |
| `cYM` constructor; `cYO.aboutToInsertItem` | The protocol change recorder subscribes to the document root. Its listener forwards the event to `cYM.ffA(cYy,HEV,HEV,int)`. |
| `cYM.ffA(cYy,HEV,HEV,int)` | Applies the connection's property/target filter. For a new child it serializes with `cYP` and queues `cRI` with parent ID, property ID, index, and bytes. For a known child it can queue `cRO` with its managed ID. Scalar changes use the matching typed recorder. |
| `cYQ.ffA(cYs,HEV)`; `cYP` | Admission depends on the live connection, descriptor, owner path, and suppressed changes. `cYF.asI()` checks flag 4, whereas the file filter's `eJS()` checks flag 1. A file projection is not the engine projection. Do not infer delivery from a file round trip. |
| `cYV.ffA(uX1)` → `cYQ.pvN()` → `cYQ.cG3(HEV)` | The document-context completion path assembles pending changes through `cYM.ffA(HEV)` and `protocol.ITE.cG3(HEV)`. It appends a batch to the sender queue and notifies its thread. This is not a DSP acknowledgement. |
| `cYQ.hhJ()` / `ffA(List)` | The sender drains queued batches through `protocol.ilU`, with monitor and semaphore waits. `master.Svr.ffA(cYQ,cL,int,int,int,boolean)` installs the connection and labels its work “Send changes to engine”. Do not call sender or flush methods from the probe. |
| `master.Ymq.AAO()`; `Svr.jnZ()`; `rjH` | `AAO()` checks document access and reads the engine-state field. `rjH.cG3` is CONNECTED, `eOi` CONNECTING, and `ffA` NOT_CONNECTED. `jnZ()` reads the connection field. Require CONNECTED plus the same non-null connection; neither alone proves signal processing. |
| `device.UZp.eOi(DbL)` → `bGD.ffA(DbL)` | Reaches `Ozt()` on the device's control collection. This hook alone does not establish audio computation. Retain it, but do not use it as the DSP witness. |
| `AbstractChannelProxy` meter binding | Resolves `ytV.ZzB()` → `cyR.pvN()` → `Cic.Uhv()` → `Bsp`. Peak callbacks read `Bsp.NaF()` and subscribe through `Bsp.cG3(Npn)`. A target bind also emits an initial value; that value is not fresh DSP evidence. |
| `DxI.ffA(platform.hwy)`; `rrr` | A valid meter packet updates peak values and `DxI.EbT` (`Instant`). An invalid packet can run decay; deactivation can reset values. Read the existing packet time; never call the packet decoder, reset, or subscription helpers by reflection. |
| `AbstractChannelProxy$VuMeterObserver` | Converts amplitude to `floor(clamp(amplitude^0.3333,0,1) * (range-1))`. Its `-1` channel maps to index 2. Meter codes are not linear amplitude or dB. |

Here `device` means `com.bitwig.flt.document.core.master.device`; `master`
means `com.bitwig.flt.document.core.master`. The manifest gives every full
name. The local API documents also specify peak/RMS selection, range 128,
and `Track.startNote(key,velocity)` / `stopNote(key,velocity)`.

The trace reaches host-side dispatch, transport, and meter packet decoding.
It does not inspect the native engine's compiler, scheduler, or render loop.
No traced sender result is an audio fence. Connection/filter eligibility and
meter availability must pass on the actual target. Do not change private
filters, flush queues, walk the whole DSP graph, or invoke a compiler to make
a test pass. A successful signal sequence supplies the missing behavioral
proof; an absent or stale signal leaves adoption unproved.

## Admission and fresh allowance

At design entry, V11 was loaded with both factory attempts used. E291 prepares
V12 with an engine-test marker and explicit active-engine admission. E292
loads V12 and uses its single session; Q0 refuses signal before a note. Do not
remove V11's inactive-engine check or reset its counters at runtime.

The new cohort admits one test session and at most one factory attempt per
controller initialization, one per epoch. Mark the attempt before factory
entry. A refused calibration uses no factory attempt but still ends the test
session. There is no automatic retry. Another run needs a planned fresh
initialization, exact restored baseline, and operator replacement.

After offline acceptance, deploy from `extension/` with
`./gradlew copyProbeExtension`. The operator must fully remove the old
controller and choose the final matching `ghostnote probe` product in the
complete list. A power toggle, earlier duplicate, or orange detected-controller
button is insufficient. Wait for confirmation. Then run `npm run probe:hello`
from `brain/`; verify profile, method count/hash, fresh initialization time,
and the new deliberate markers. Record the archive hash. Do not invent the
future method hash or count in this design.

Before engine activation, require fresh paired baseline reads and these facts:

- Project `gn-grid-spike`; track `grid-probe`; first device `Poly Grid`.
  Reacquire UUIDs. Match E289's graph, native rectangles, outer identity,
  idle edit state, empty Grid selection, and public selection.
- Exact saved project and backup hash
  `af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
  Preset hash `1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
- Track muted, -10 dB, armed, active, and not muted by another solo. No active
  sends, cue route, alternate output, external input signal, playing clip,
  other sounding track, or incoming hardware notes. Refuse an unexpected route;
  do not repair it in this test. The master meter must be quiet.
- Transport stopped at 1.1.1.00 and engine inactive. The operator activates
  only this fixture's engine after admission. No audio settings change.
  Require a fresh UI witness (at most 60 seconds old), then a native active
  connection witness bound to the same document. Stopped transport persists.
- Resolve all native symbols and existing meter objects before any note or
  graph write. Both meters must be existing `DxI` objects reached from their
  respective public channel targets. Read their `EbT` fields only. Refuse a
  different class, missing meter, missing connection, or missing identity.

Keep one weak reference to the existing connection for this bounded session.
Compare object identity in each document task; expose only a scalar generation
token. Require `Ymq.AAO() == rjH.cG3` and the same non-null `Svr.jnZ()`.
Invalidate the session on disconnect, reconnect, project/route change, or
controller initialization change. Release the weak reference at session end.
Do not retain a native module handle. A connected state alone is insufficient;
the calibration and fresh meter packets must also pass.

## Independent signal window

Add a research-only window recorder for the fixture and master peak observers,
range 128, channel -1. Bind each observer to a pinned channel identity and
controller generation. Record the fixture's public `playingNotes()` events
in the same bounded window. Require an empty note set before each pulse,
exactly the owned key 60 on during the plateau, and its off event before
collect. A missing note event makes even a zero-gain result unavailable.
Unexpected notes fail isolation. These observers add no wire call.
The current `branch.vu` is insufficient: it has a held
peak and no packet time or callback sequence. Do not use its previous `hold`.

Each window has one begin call and one collect call. Begin clears only the
probe's samples, records monotonic time, sequence, route, engine generation,
and native meter packet time. Never reset the host meter. The host schedules
note-on at 250 ms and note-off at 850 ms, on key 60 with velocity 80 and
note-off velocity 0. Capture the plateau from 400 to 800 ms. Collect at 1,250 ms;
allow at most 2,000 ms total, one collect, and no polling loop. A quiet window
uses the same two time boundaries but sends no note. There are no held notes
between graph stages and no clip or transport write.

Use controller scheduling, not a document-thread sleep or an open native edit.
Before note-on recheck target, mute, stopped transport, and the engine token.
Record note-on attempt before sending it. An independent scheduled note-off
must run even if the client disconnects or a window fails. Check the original
pinned target; never send it to a new bank occupant. Cancel a pending note-on
on abort. Note-off for an attempted note is the only automatic live cleanup
allowed after uncertainty. If its delivery cannot be established, the operator
deactivates the fixture engine. A watchdog does not guarantee note-off when
the host thread is blocked.

Store at most 2,048 scalar callback samples across both meters and the note observer per window in
a fixed buffer of at most 64 KiB. Overflow fails the window. Record callback
sequence/time, meter code, channel identity, packet times, engine token, note
attempts, and failure stage. Collect returns at most 128 KiB. Drop the buffer
before the next window. Initial bind values and callbacks before the window
cannot satisfy the measurement. Check the existing `DxI.EbT` again in the
collect document task for both targets. Require valid packet times from this
window, after note-on for a pulse. Packet time is a liveness witness, not a DSP revision.
A clock discontinuity, stale packet, identity change, or missing plateau data
makes the result unavailable. Never convert missing data to silence.

Pre-register these criteria; do not change thresholds after a live result:

- Quiet: code at most 1. All master samples must be quiet. Each positive pulse
  must have a fresh rise, a plateau callback, and a return to quiet by collect.
- Positive baseline: plateau peak `B` in 32–110. This supplies headroom and
  excludes weak noise and saturation. Repeated unity results must be within
  3 codes of `B`. Gain-zero pulse plateaus must be at most 1, with fresh packet
  evidence and positive controls before and after them.
- Half gain: convert the code's quantization interval `[v/127,(v+1)/127]`
  through exponent `1/0.3333`. Require the entire resulting amplitude-ratio
  interval against the bracketing unity observations to lie in 0.40–0.60.
  Require a lower code than unity. Do not divide raw meter codes by two.
- The first quiet window, baseline positive/zero/positive sequence, and packet
  freshness gate must all pass before construction. If mute suppresses this
  meter, note pulses cannot excite this patch, release is too slow, or zero
  packets do not advance the witness, record an observable limit and stop.
  There is no fallback to audible output, a UI meter, export, or an unmuted run.

A native connection and fresh meter packet cannot exclude every unrelated
engine fault. Exact graph deltas, isolated routing, fixed stimulus, zero gain,
half gain, and returned unity jointly establish the bounded causal result.

## Ordered protocol and graph readback

Use a fixed state machine. No request accepts an arbitrary UUID, value, route,
or count. Each native write uses the established 18-call workflow shape:
two before captures, one command guard capture, two independent after captures,
release, and the existing route/selection checks. Adapt its fixture admission
to the exact states below; the V11 driver cannot run these states unchanged.
No write proceeds after a failed or unavailable read. Retain all attachment
ownership, managed-ID, layout, edit-close, and disposal rules from the
[attachment contract](9a-native-attachment-design.md).

Let A be the original 25% Amplify, S the disconnected 50% spare, N the new
Amplify, O Audio Out, and X Sine. The table gives linear audio gain.
The native control has a cubic scale. Use `0.6299605249474366` for 25% and
`0.7937005259840998` for 50%. Zero and unity stay 0 and 1. E291 corrects
E290's use of “native linear gains”; the saved fixture and E277 supply the
native values. Do not send 0.25 or 0.5 to the raw native setter.

| Stage | Single permitted change | Required graph and signal |
|---|---|---|
| Entry | No graph write | Four modules; X→A→O; S disconnected. Quiet window Q0, then pulse B+ at A=0.25. |
| 1 | A: 0.25→0 | Exact value delta; pulse B0 is quiet. |
| 2 | A: 0→0.25 | Exact baseline graph; pulse B-return matches B+. Calibration passes before factory. |
| 3 | Construct and attach N at (2,0) | Five modules; N gain 1 and disconnected. Two detached captures; registered managed ID; all E289 witnesses. Engine stays active. |
| 4 | Connect A OUT→N IN | Three cables; original X→A and A→O remain. N has exactly one input. |
| 5 | Retarget O IN from A OUT to N OUT | X→A→N→O; three cables, no direct A→O bypass. Pulse N+ matches B+. |
| 6 | N: 1→0 | Pulse N0 is quiet; all other values and edges unchanged. |
| 7 | N: 0→0.5 | Pulse N-half meets the ratio criterion. |
| 8 | N: 0.5→1 | Pulse N-return matches B+ and N+. |
| 9 | Retarget O IN from N OUT to A OUT | Original output route restored; N still has its input. |
| 10 | Disconnect N IN | Only the original two cables remain. |
| 11 | Delete the isolated N | Exact four-module baseline with original in-memory identities. Pulse R+ matches B+. Final quiet window Q1. |

All stages run with stopped transport and a muted track. Native construction
and attachment occur between pulses, while the engine connection is active.
There are eight pulse windows and two quiet windows. Note pulses do not overlap.
Graph changes, notes, and engine state must be separate receipts. A command
return cannot satisfy the graph or signal gate.

Bound the graph to five modules, three cables, 61 projected nodes, depth 12,
4,096 graph/query work, and 1 MiB per graph/command response. Retain the
77-object factory ownership proof (hard cap 256). Existing module rectangles,
selection, defaults, parent checks, outer modulators, and identities remain
exact except for the table's named deltas. Reacquire identities after any
reopen; reopening during the signal sequence invalidates that run.

No undo/redo or edited-state save/reopen is part of this signal gate. E289
retains those document proofs. This gate ends with exact baseline restoration;
there is no intermediate engine-state or undo-to-audio claim.

## Failure recovery and exact restoration

Keep separate states for native task completion, write lock, graph readback,
engine connection, signal window, and attempted note. The response watchdog
must not mark native work complete. A late native return runs only the existing
owned-edit cleanup; it cannot unlock writes or turn a timeout into success.
Retain the 4-second pre-operation deadline and 5-second response watchdog.
The whole automated test has a 60-second cooperative deadline. None cancels
native parsing, monitors, engine compilation, or a blocked controller thread.

| Failure | Permitted response |
|---|---|
| Admission or observable calibration fails | End the session. If calibration changed A, do not continue graph writes. Stop the owned note, deactivate the engine, and discard the fixture changes through the restoration process. |
| Factory/attachment fails | Follow every attachment failure rule. Dispose only a proved detached result before insertion entry. Never dispose after insertion entry or retry the factory. |
| Cable/value/delete fails, or graph readback differs | Latch the write lock. Do not run the inverse stage, undo, redo, delete, or save. Preserve the original and cleanup errors. |
| Meter stale, overflowed, silent in a positive stage, leaked to master, or out of tolerance | Stop the test and lock graph writes. Note-off remains permitted for the owned pulse. Do not run stages 9–11 as automatic failure cleanup. |
| Engine/target changes or transport starts | Cancel pending note-on; stop the owned note only on its original proved target. Operator stops transport and deactivates the fixture engine. Reconnection cannot resume the test. |
| Native task unfinished | Cached status and operator inspection only. Queue no diagnostic document reads or inverse writes. A restart may be needed. |

Once native completion is proved, permit one recovery workflow: fresh bind,
two fixed-projection diagnostic reads, and release (four calls, zero graph
writes). Cap it at five modules and three cables. It cannot move the cursor,
construct, discover schema, or unlock the session. If the signal task alone
failed, include its cached report in the same recovery result. Incomplete
evidence is an acceptable failure result. Do not retry a failed recovery read.

For success and failure, finish as follows:

1. Finish or stop the owned note. Require no active pulse and stopped transport.
   The operator deactivates the fixture engine. On uncertainty, inspect or
   restart the host before any further document operation. Controller
   replacement alone does not prove document or engine recovery.
2. Close only `gn-grid-spike` without saving. Confirm it is closed before any
   file replacement. Preserve the live material listed in NOW. The operator
   later confirmed that `gn-scale-test` has no preservation requirement for 9a.
   Keep the verified backup unchanged.
3. Check saved project and backup hashes. If the saved file still equals the
   exact baseline, reopen it directly. Otherwise replace the closed fixture
   file from the verified backup, check byte equality and hash, then reopen.
   Do not save a semantically restored graph over the exact baseline file.
4. Reopening can activate the engine (E288). The operator deactivates it again.
   Reacquire UUIDs and perform the final paired baseline read workflow. Require
   baseline semantics and rectangles, idle edit, empty Grid selection, unchanged
   outer identity, muted -10 dB armed track, stopped 1.1.1.00 transport, no owned
   notes, an inactive engine, and an unstarred fixture tab. Check project,
   backup, and preset hashes again. Release all epochs and meter sessions.

If recovery cannot reach these conditions, record the actual state and stop.
Do not label a semantically equal read as exact file or engine restoration.

## Cost model before implementation

Typical and largest admitted graph are identical: one four-to-five-to-four
module cycle, at most three cables, one factory attempt, no batch. The maximum
window wait is longer; graph scope and call count do not grow. Keep the full
18-call guard sequence for each native stage so that costs are reviewable.

| Component | Calls | Reads and write stages |
|---|---:|---|
| Eleven native stages | 198 | 55 fixture captures; two detached captures. One factory, one attachment edit, five value edits, four cable edits, one deletion. Factory and attachment share stage 3. |
| Ten signal windows | 20 | Begin/collect each read fixed meter/route/engine witnesses. Eight note-on and eight note-off stages. Two quiet windows. |
| Entry and final reopened baseline | 30 | Two 15-call workflows, four fixture captures. |
| Session control | 4 | One entry `rig.info`, begin, final cached status, and release. No graph write. |
| Total | 252 | 59 fixture captures, two detached captures, 20 fixed meter witness tasks, 11 graph-edit stages, 16 note stages, one factory. |

The window boundary callbacks add at most 20 scheduled host turns beyond the
252 sequential wire turns: about 272 × 24 ms = 6,528 ms as a rough scheduling
floor. Document queue/completion can add turns. Timer turns occur inside the
window dwell; do not add their floor a second time to elapsed time. Each of
the 13 graph workflows has 150 ms cursor settlement: 1,950 ms total.

Plan 9 seconds summed warm request latency, excluding window dwell, plus
12.5 seconds typical window dwell (20 seconds maximum) and 1.95 seconds
cursor settlement: about 24 seconds typical and 32 seconds at the maximum
window allowance. These are planning estimates, not a bound on native work.
Collect must not hide a polling loop. Host scheduling beyond 2 seconds fails
that window. Operator actions, deployment, hello, engine activation, close,
file restoration, and reopen time are separate and must be recorded.

E289 measured 18 calls at 558–567 ms plus 150 ms settlement, with a 45–48 ms
document command and 4–6 MiB sampled heap. Keep a 650 ms warm-wire estimate
for each graph stage (7.15 seconds total), about 1.1 seconds for the two read
workflows, and about 0.58 seconds for 24 window/control calls. The active-engine
attachment command has an initial 60 ms document-time estimate, about 25–32%
above E289, for protocol serialization and active connection work. This is a
hypothesis to measure, not a measured cause. Queue/send time and signal
settlement are separate from document time. A native engine compile can occur
after the document command returns.

Budget 16 MiB temporary Java heap per graph stage, plus a 64 KiB fixed sample
buffer and at most 128 KiB encoded window result. Stream results to disk and
drop each window; do not accumulate full graphs or native handles in the
extension. Sample Java heap at the same points as E289. These samples do not
measure peak or retained heap, native engine memory, or total process memory.
The engine's additional graph/voice allocation is unknown; record process
memory before/after when available and state that limit.

Cold work includes one symbol/descriptor resolution set, two initial fixture
reads, observer/meter binding, first engine activation, and the first factory
lookup/possible file parse. These fit the stated call shapes but have no
measured latency bound. Do not call the factory cache cold without evidence.
No engine activation or factory retry is allowed to obtain a better sample.

Failure recovery adds four calls (about 96 ms floor), two graph captures,
zero graph writes, and at most one outstanding owned note-off. Cached status
is separate. An unfinished native task has no finite recovery-time estimate.
The final restoration workflow is already in the success total; extra recovery
and operator work are reported separately. Product call budgets do not change.

## Next sessions and acceptance

### Probe implementation and offline checks

Implementation: [E291](../../evidence/experiments/e291-grid-engine-probe-implementation.md).
V12 implements this section and passes the offline checks. E292 records its
deployment, operator replacement, and live quiet-gate refusal. Exact inactive
restoration and release pass. The next work is the
[baseline signal and failure evidence design](9a-live-grid-editing-spike.md#next-session--baseline-signal-and-failure-evidence-design),
not a repeat of this used session.

Source: E290 and this contract. Implement the fixed state machine, active-engine
witness, identity-bound meter recorder, note lease, and phase-specific graph
admission. Verify exact native signatures and the read-only meter/connection
accessors against the pinned jar before using them. Trace any additional
accessor in the implementation E record. Do not weaken the observable when an
accessor is absent. Update the marker/inventory consumers for the new cohort.

Test admission and every failure row, including a suppressed or stale meter,
wrong channel after bank movement, missing or foreign note events, bind-time
value, callback backlog, zero
packets without freshness, out-of-order/overflow data, clock change, disconnect,
late native completion, client loss after note-on, failed note-off, target loss,
and no disposal after insertion entry. Test nonlinear meter quantization and
wrong half-gain ratios. Prove that cleanup cannot send a note to a replacement
target or run an inverse graph edit. Preserve the V11 inactive-engine tests.

Assert the 252-call successful sequence, 59 fixture captures, one factory,
11 graph edits, 16 note writes, ten windows, and failure-only recovery budget.
Do not add product tools or change public descriptions for this research probe.
Run Java checks, native symbol checks, TypeScript typecheck, focused driver and
failure tests, context validation, and diff checks. If the implementation needs
a different cost or observable contract, revise it before deployment.

### Bounded live engine gate

Source: E290; starts only after the implementation and operator replacement
checks above pass. Run the protocol once. Calibration refusal is a useful
negative result, not permission to widen scope. Record graph results and DSP
results separately, all stage timings, callback/packet freshness, payloads,
heap, engine entry/exit, and restoration evidence. Compare attachment and read
costs with E289. Explain any increase above 20%; do not claim an isolated cause
from one sample. A repeat needs its own verified baseline and fresh allowed
initialization. Finish with the exact restoration checks even after failure.

Design-session acceptance is this reviewable protocol, native source trace,
independent observable, failure limits, restoration procedure, and cost model.
Live acceptance additionally requires every graph and signal criterion. 9a
stays active until its operation verdicts are reviewed; wider Phase 9 scope
remains unselected.


## V12 driver and implementation details (E291)

The new research method is `probe.gridEngine`. The prepared profile has
118 methods, hash `2e939035ea90b8b0`, and marker `9a-grid-engine-v12`.
V12 refuses the legacy Grid write methods. Their V11 implementation and tests
remain for the inactive-engine evidence. No product tool or description changes.

Run the driver from `brain/`:

```sh
node --import tsx src/probes/phase9a-grid-engine.ts prepare /absolute/entry.json /absolute/new-prepare-output
node --import tsx src/probes/phase9a-grid-engine.ts run /absolute/active.json /absolute/new-run-output
node --import tsx src/probes/phase9a-grid-engine.ts restore /absolute/restored.json /absolute/new-restore-output
```

Each input is a JSON object of at most 8 KiB. Each output directory must be
new. `observedAt` is the UI witness time as Unix milliseconds. Set `projectPath`,
`backupPath`, and `presetPath` to the exact files listed above. All three
commands verify their hashes. The driver never replaces or saves a file.

`prepare` needs `engineInactive: true` and `isolationConfirmed: true`. The
latter records operator verification of every routing, external-input, clip,
other-track, hardware-note, selection, modulator, and outer-identity condition
in admission above. The server also checks the exact native graph, rectangles,
empty Grid selection, idle edit, native inactive state, muted -10 dB armed
active track, no solo, stopped transport, and current track/device route.
Check stopped position 1.1.1.00 in the UI; this driver does not change position.

After prepare passes, the operator activates the engine. Make a new active
witness with `engineActive: true` and `isolationConfirmed: true`. Run once.
Do not combine activation with prepare or skip prepare. The server keeps its
entry identity through activation. The complete automatic signal run has a
60-second cooperative deadline; operator time is outside that deadline.

After success or failure, complete the operator restoration procedure above.
Only then make a new witness with `engineInactive: true` and
`restorationConfirmed: true`. This flag records fixture-only close without save,
exact file verification or replacement while closed, reopen, engine deactivation,
unchanged outer identity and modulators, stopped position, and the unstarred tab.
`restore` reacquires module identities and checks the native inactive baseline.
It then releases the session. This final read workflow is admitted once; a
failed restoration read stops without a retry. An owned note lease can be discarded only after
native deactivation and no playing notes are proved. A new session still refuses.

The success command budgets are prepare 16, run 220, and restore 16: 252 total.
`recover` accepts the saved `target` object and a new output directory. It has
four calls: bind, two reads, release. A failed recovery read stops without a
retry. `status` returns cached state without a document task. After a driver
failure, one cached abort request and one cached status request are additional
control calls. Neither runs an inverse edit. Do not run recovery while cached
status reports unfinished native work. Restoration is required even if recovery
cannot supply complete evidence.

The note command uses the exact native body of public `Track.startNote` and
`Track.stopNote`: `GkS.Ye3()` then `iwZ.ffA/eOi(0, 60, HLJ.ffA(80/0))`.
The public proxy first queues a task and resolves its target later. V12 runs
the same body inside its identity-checked document task. This removes the
second queue between identity proof and note delivery. The packet accessor
remains read-only. The native metadata check also loads the installed
`libs.jar` for signature dependencies; it initializes no vendor class.

The two probe meters use the existing pinned cursor track and one new master
track handle with zero scenes. They add two VU subscriptions and one playing-note
subscription at initialization. Normal and capture profiles allocate none of
these engine-probe resources. Each note boundary queues one fixed document
task; the sixteen note tasks have no wire calls. Initial subscriptions and
callback traffic have no measured host cost yet. The live record must include
these costs and must not claim the 64 KiB window buffer is the entire host heap.

A cable to N OUT can change the graph reader's traversal order. Both Java and
TypeScript predict the exact new capture-local numbering from the permitted
delta. They do not ignore changed IDs or compare only node counts. The graph
reader stops before it allocates node 62. The three-cable bound applies only
to the engine path; the inactive attachment path keeps its two-cable bound.

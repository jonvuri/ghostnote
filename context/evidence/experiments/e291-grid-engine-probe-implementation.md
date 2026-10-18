---
title: E291 — Grid engine probe implementation
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E291 — Grid engine probe implementation

## Result

V12 implements the [E290 contract](../../plan/phase-9/9a-engine-adoption-design.md).
The offline checks pass. The archive is built but not deployed. V11 remains
loaded, with both factory attempts used. No live request, note, graph edit,
engine activation, controller replacement, or fixture write ran in this session.
[9a](../../plan/phase-9/9a-live-grid-editing-spike.md) stays active. DSP adoption
and live costs remain unproved. The next planned session deploys V12 and runs
the bounded live gate after operator replacement and a fresh hello.

The prepared profile has 118 methods, hash `2e939035ea90b8b0`, and marker
`9a-grid-engine-v12`. It adds only `probe.gridEngine`. Normal and capture
profiles keep their method sets and host-resource allocations. Public descriptions stay
v52, 44 tools; no description changed. The old attachment driver retains its
V11 cohort checks. The current hello and read driver require V12.

## Implementation and corrections

The Java protocol admits one session and one factory attempt per initialization.
It fixes the order of eleven graph stages and ten signal windows. V12 refuses
legacy Grid writes, so they cannot bypass calibration or the factory allowance.
Two before reads, a command guard, and two after reads check each graph stage.
The server predicts the exact permitted graph and native witness. The client
predicts the same deltas independently. A new cable can change traversal order;
both predictions assign the resulting capture-local IDs before comparison.

E290's stage table incorrectly called 0.25 and 0.5 native linear values. The
saved fixture uses a cubic control scale: native 25% is
`0.6299605249474366`; native 50% is `0.7937005259840998`. E277 and the existing
fixture guards already contain these values. The implementation and contract
now separate audio gain from native control value. The meter quantization
criterion and call budget do not change.

The recorder allocates fixed arrays for at most 2,048 scalar samples. It checks
observer identity, sequence, monotonic time, wall-clock continuity, both meter
packet times, playing-note events, master silence, plateau data, and release.
It does not use the held peak from `branch.vu`. Missing or stale zero packets
are unavailable. Calibration refusal ends the run before construction. The
half-gain gate inverts the meter's nonlinear quantization interval; it does not
halve meter codes. A completed window drops its sample buffer.

The native engine binding has weak identities for the existing connection,
fixture/master channels, and their existing meters. A mismatch latches the
binding invalid. A reconnect cannot revive it. Entry identity persists across
operator activation. Read-only `Ymq.AAO`, `Svr.jnZ`, and `DxI.EbT` accessors
supply the connection and packet witnesses. No meter reset, subscription, or
packet decoder is called through reflection.

The note lease installs note-off before it returns the begin response. Client
loss does not remove that timer. Each boundary queues one document task. The
lease checks the original weak channel identity in that task. It records the
attempt before the native note command. A failed note-on can still require
note-off; a replacement target never receives cleanup. A failed note-off is
not retried. A blocked host still has no guaranteed cleanup deadline.

The [additional source manifest](../data/phase9a-engine-adoption/environment-implementation.json)
records the note trace. Public `AbstractTrackProxy.startNote/stopNote` calls
`exec`, then resolves its target in the queued lambda. Its body obtains
`GkS.Ye3()` and calls `iwZ.ffA/eOi(0, 60, HLJ.ffA(80/0))`. V12 runs that exact
body in its own guarded document task. This prevents a second queue between
target proof and note delivery. The symbol check uses the local pinned
`bitwig.jar` and its `libs.jar` dependency. It initializes no vendor class.

Graph reads stop before node 62. Engine reads and native witnesses admit at
most three cables. The inactive attachment path retains its two-cable bound.
Attachment retains the 77-object ownership proof, exact defaults, native edit
ownership, managed-ID registration, and prohibition on disposal after insertion
entry. Existing attachment failure tests remain in the Java check.

## Failure and restoration

A failure latches the protocol lock. Native task completion remains separate
from the response watchdog. Late completion cannot unlock the protocol. The
client sends only cached abort/status controls after a failed run; it sends no
inverse edit or diagnostic document read. One recovery workflow is available
after native completion: bind, two bounded diagnostic reads, release. A failed
read cannot be retried. Partial witness errors remain diagnostic evidence.

The driver has separate `prepare`, `run`, and `restore` commands. Operator
activation and restoration stay between commands. The server checks the native
inactive baseline at entry and after restoration. It checks the four exact
rectangles, empty Grid selection, idle edit, muted -10 dB armed active track,
no solo, stopped transport, and fixed track/device route. The client checks
exact project, backup, and preset hashes. Operator attestations cover routing
that is not read by this probe, external input, other projects, outer identity
and modulators, stopped position, fixture-only close without save, reopen,
engine state, and the unstarred tab. These attestations are not native proofs.

An outstanding note lease can be discarded after native deactivation and an
empty playing-note state. A replacement channel cannot receive its note-off.
Restoration does not reset the session allowance or unlock graph writes. See
the [driver procedure](../../plan/phase-9/9a-engine-adoption-design.md#v12-driver-and-implementation-details-e291)
for inputs and the exact operator boundary.

## Verification and cost

[Verification](../data/phase9a-engine-adoption/verification-implementation.json)
records the commands. Java checks include graph/node bounds, the complete
value/cable/delete cycle, baseline layout, sequence and factory limits,
nonlinear ratios, missing or suppressed meter data, stale zero packets,
foreign or missing note events, master leakage, callback order, clock change,
overflow, target replacement, disconnect/reconnect, client loss, late note
execution, failed note delivery, and no cleanup on a replacement target.
The retained attachment tests cover late native completion and all native
attachment ownership/disposal failure points. These are offline models and
signature checks; they do not prove host callback timing or DSP behavior.

TypeScript checks cover the 252-call success path, every graph-stage failure,
every signal-window refusal, admission, independent graph deltas, meter
quantization, and four-call recovery. Calibration failures never reach the
factory. Typecheck, the wire inventory/marker checks, product call budgets,
and the live adapter frame-budget checks pass. Context and diff checks pass.

The successful prepare/run/restore budgets are 16/220/16 calls. Total:
252 wire calls, 59 fixture captures, two detached captures, one factory,
11 graph edits, 16 note writes, and ten windows. Failure can add one cached
abort and one cached status call; recovery adds four calls and two captures.
There are at most 20 scheduled boundaries and 16 note document tasks. The
sample arrays occupy 32 KiB before object overhead, within the 64 KiB limit.
Window JSON is capped at 128 KiB; each graph response is capped at 1 MiB.

The probe adds one master handle with zero scenes, two VU subscriptions, and
one playing-note subscription at initialization. Their host allocation and
callback costs remain unmeasured. The [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
retains E290's 24–32 second planning estimate and 16 MiB temporary Java heap
allowance per graph stage. The 60 ms attachment estimate is still an untested
25–32% allowance above E289's 45–48 ms. The next live session must measure it
and explain any increase above 20%. No live regression result is claimed here.

## Preservation and retrospective

The [preservation record](../data/phase9a-engine-adoption/preservation-implementation.json)
checks the saved project, backup, preset, and deployed V11 archive. They retain
their recorded hashes. Live engine and editor state come from the operator and
E289; this session makes no new UI or host observation. The unsaved
`gn-scale-test` tab is untouched.

Retrospective: put both the audio gain and native control value in a stage
contract. Also identify every readback limit before extending a proven helper;
the graph reader and native witness had separate two-cable limits. The updated
contract and tests retain these distinctions. No repository-wide instruction
change is needed.

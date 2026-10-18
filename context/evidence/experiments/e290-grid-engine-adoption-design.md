---
title: E290 — Grid engine adoption design
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E290 — Grid engine adoption design

## Result

The pre-implementation engine adoption design is complete. The
[contract](../../plan/phase-9/9a-engine-adoption-design.md) defines the native
update trace, independent signal observable, fixed stage order, failure
recovery, exact baseline restoration, cost model, and next-session acceptance.
Keep [9a](../../plan/phase-9/9a-live-grid-editing-spike.md) active.

No runtime code, tool description, build, deployment, controller, or live
project changed. No live request, note, engine activation, or factory call ran.
V11 remains loaded with both factory attempts used. The operator's entry
statement and E289 supply the inactive-engine and restored-live-baseline state;
this session does not claim a new live observation. Descriptions remain v52,
44 tools. Engine adoption is still unproved.

## Source trace and observable

The [inspection manifest](../data/phase9a-engine-adoption/environment-design.json)
records the unchanged host jar, 27 exact bytecode inspections, and two local
API document hashes. No reference clone was used. Reproduce each inspection
with the manifest's `javap -p -c` command and full class name. Vendor bytecode
remains outside Git in `/tmp/gn9a-engine-design/exact`.

Native insertion notifies relationship listeners before completed membership.
The protocol listener `cYO` forwards insertion to `cYM`, which filters the
change and queues either serialized child data or a managed-ID reference.
Document-context completion assembles the batch; a sender thread delivers it
through `protocol.ilU`. The installed document engine connection uses this
path. A close, queued batch, send, or positive managed ID is not proof that an
audio block used the new module. The `UZp` insertion hook also reaches device
control collection work; it is not itself a DSP observable.

The independent candidate is the fixture track's peak meter. The trace follows
its public observer to `Bsp`/`rrr` and `DxI` meter-packet decoding. A valid
packet updates the peak values and packet time; initial binding, decay, and
engine deactivation can also change the visible value. The proposed recorder
therefore requires channel/engine identity, callback sequence and time, and a
fresh native packet witness. The public meter uses a cube-root-like transfer,
not linear amplitude. The design specifies its inverse and quantization bounds.

Before construction, calibrate with the original Amplify at 25%, 0%, then 25%.
Keep the track muted. Stop if the meter is unavailable under mute, the fixed
note cannot excite the patch, zero packets lack freshness, or release exceeds
the window. No live evidence yet establishes these conditions. This explicit
admission gate avoids treating silence as a successful DSP result.

After calibration, attach one Amplify, connect it in series before Audio Out,
and measure gains 1, 0, 0.5, and 1. Exact paired graph reads must exclude a
bypass and all other deltas. The engine remains active throughout. The final
positive control follows native graph restoration. Eight bounded note pulses
and two quiet windows provide independent signal evidence without transport
or clip writes. A pass applies to newly triggered voices, not a graph change
inside an already sounding voice.

The trace stops at the host-side protocol and meter decoder. It does not prove
native engine compilation, scheduling, or a revision acknowledgement. The
design pairs the traced `Ymq.AAO()` CONNECTED state with `Svr.jnZ()` identity;
a non-null connection alone is insufficient. The live gate must establish the
candidate observable before spending its factory allowance.

## Bounds, failure, and restoration

The proposed cohort admits one session and one factory attempt per fresh
controller initialization. It cannot borrow or reset V11's used allowance.
The future deployment requires operator removal and replacement with the final
matching probe product, followed by a fresh hello and deliberate build markers.

Each graph stage retains the attachment contract's checked edit ownership,
exact readback, no disposal after insertion entry, and non-cancellation limit.
The test adds a separate signal state and bounded note lifecycle. Client loss
or a failed window permits the owned note-off only; it never triggers inverse
graph edits. An uncertain native task blocks diagnostic reads until completion.
Then one four-call diagnostic workflow is permitted, with no retry or unlock.

On success or failure, deactivate the engine and close only the fixture without
saving. Verify or restore the exact baseline bytes while the fixture is closed.
Reopen, deactivate again if needed, reacquire identities, and require paired
baseline reads, native rectangles, selection, idle edit, file hashes, and an
unstarred fixture. Preserve the other projects. A watchdog cannot guarantee
note-off or recovery when the host thread is blocked; operator inspection or
restart remains necessary in that case.

The [file check](../data/phase9a-engine-adoption/preservation-design.json)
confirms project and backup hash
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f` and
preset hash `1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
No file restore, project save, or reopen was needed or performed here.

## Cost and verification

The [budget](../data/phase9a-engine-adoption/cost-model.json) describes one fixed
cycle: 252 sequential wire calls, 59 fixture captures, two detached captures,
20 fixed meter witness tasks, 11 graph edits, one factory, and 16 note writes.
Window callbacks add at most 20 scheduled host turns. The rough 272-turn floor
is 6,528 ms. Plan 9 seconds warm request latency, 1.95 seconds cursor settlement,
and 12.5–20 seconds window dwell: about 24–32 seconds before operator work.
The typical and maximum graph scopes are identical: five modules, three cables.

E289's attachment alone uses 18 calls at 558–567 ms, with 45–48 ms document
work. The proposed attachment retains that call shape; its initial 60 ms
active-engine document estimate is 25–32% higher. Protocol serialization and
active connection work are a hypothesis for the allowance, not a measured
cause. Most of the full-test cost is the ten other graph stages and the signal
windows. A future live result must report matching command/read costs and
explain increases above 20 percent. No new live cost or regression is measured
in this design session. Product budgets remain unchanged.

Keep 16 MiB temporary Java heap per graph stage, a 64 KiB bounded meter buffer,
and a 128 KiB window response cap. Stream evidence. Native engine heap, cold
activation, first-use symbol work, factory cache misses, and blocked host work
remain unbounded by measurement. Recovery adds four calls and two captures,
with no graph writes, after native completion.

The [verification record](../data/phase9a-engine-adoption/verification-design.json)
records source checks, cost arithmetic, fixture hashes, context validation, and
diff checks. No runtime or live test is claimed. Next: implement and check the
bounded probe under the contract, then run the separately planned live gate.

Retrospective: short obfuscated names collide across packages. Use full class
names in inspection filenames and manifests. Keep protocol dispatch, document
readback, and signal evidence separate so that a successful edit cannot be
mistaken for engine adoption.

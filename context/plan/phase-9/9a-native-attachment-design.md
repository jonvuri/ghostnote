---
title: 9a — Native collection attachment design
kind: plan
state: active
status: E289 passes the bounded attachment sequence. Both V11 attempts are used; 9a remains active.
updated: 2026-10-19
parent: 9a-live-grid-editing-spike.md
---

# 9a — Native collection attachment design

This is the implementation contract for the completed attachment stage of
[9a](9a-live-grid-editing-spike.md). [E284](../../evidence/experiments/e284-native-grid-attachment-design.md)
records the offline trace. [E283](../../evidence/experiments/e283-detached-grid-factory-lifecycle.md)
supplies the factory proof. Keep 9a active.
[E286](../../evidence/experiments/e286-grid-attachment-witness-wire-fix.md) records
the V9 pre-factory refusal and V10 encoding fix. Do not bypass a used attempt
allowance or a latched write lock.

## Scope and entry

Admit one native Amplify at (2, 0) in the exact four-module, two-cable baseline.
The typical and maximum cases are the same. Use one factory call and one
insertion body call. No batch, copy mode, alternative position, automatic retry,
or selection restoration is allowed. A new probe initialization permits at most
two factory attempts, one per epoch. Count an attempt immediately before the
factory call, including a call that fails. A second insertion needs a verified
baseline and a new epoch. It must produce another new UUID with equal defaults.

Resolve all symbols before the factory call. Pin the jar to
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.
Use exact declaring classes and signatures. Check the document thread, project,
track, device, epoch, Grid object, collection order, UUIDs, parameters, cables,
and outer identity. Preserve V8's complete fresh guard capture, 4-second
pre-operation deadline, and 5-second response watchdog. Require a muted track,
stopped transport, and inactive engine at live entry. Verify the backup hash.

Before construction, check the existing rectangles, selection, and idle edit
state below. After construction, retain V8's fresh UUID, exact runtime class,
null owner/parent, initialized helpers, owned contents, and 77-object evidence
checks. Keep the hard ownership limits of 256 objects, depth 12, and 1 second.
Capture the detached result twice and check E283's defaults. Read its dimensions.
Then repeat the route, membership, rectangles, selection, edit-state, deadline,
and watchdog checks immediately before edit admission. Do all these steps in
one document task. Do not hold an open edit across native file loading.

## Native entry and edit admission

Do not call either public collection wrapper. `gOr.ffA(Collection,int,int,
boolean,ITE)` adds the selection callback. `gOr.eOi` omits it when `ITE` is null,
but ignores edit refusal and has no guaranteed close on failure. Opening an
outer edit around `eOi` does not fix those defects.

Use the following native sequence, with explicit checks between steps:

1. Read the native insert label through `gOr.ffA(Collection):String`.
   Call the inherited `ikl.ffA(String,wfl[]):boolean` on the Grid with an
   empty `wfl[]`, as the wrapper does. Require a returned `true`.
2. Prove that this request owns the new edit. Call `gOr.aJp()` to retain the
   wrapper's native edit association. Verify that `gOr.pvN` is the current
   `cZv` object. Do not write that field directly.
3. Mark `insertionAttempted` before invoking the package-private
   `gOr.ffA(Collection,int,int,boolean,RHk)` with the singleton, 2, 0, false,
   and null. Resolve the `RHk` overload explicitly. There is no `ITE` callback.
4. In `finally`, close once through inherited `ikl.hoE():boolean`, but only
   with the ownership proof below. Record its returned boolean and fresh edit
   state. Do not use `gOr.hhJ()`, which discards the close result.

The inherited start reaches `Ibf.ffA(String,String,Set)`. The empty set follows
the wrapper's path and avoids the nonempty-lock acquisition loop. A `true`
return alone is insufficient: detached or non-recording roots and replay mode
can bypass normal edit creation. Require a live document context from `mSv()`,
`uX1.MkF() == true`, a non-null current `Ibf`, and the corresponding `cZl` and
`daR`. Read the existing journal from `cZl.W2P`, keyed by the current `Ibf`.
Do not call `cZl.ffA(Ibf)` or `Ode()` to create a missing journal. Refuse a
missing entry. Require `cZl.EbT() == false` and `cZl.Mkn() == false` (replay states).
Check all of this on the document thread; no probe writes these fields.

Before start, require `Ibf.SRu` empty, `pvN == 0`, `QiZ == 0`, `wi2 == 0`,
`MkF == null`, and `daR.eOi() == false`. Refuse any outer edit. After a true
return, require the same context objects, one stack frame, `pvN == 1`,
`QiZ == 0`, `wi2 == 0`, `MkF == null`, and an active `daR` edit. Retain the
stack-frame identity and current `daR.NaF()` / `cZl.jBn()` edit identity only
inside this task. Require a non-null current edit. These checks are mandatory
even when Java assertions are disabled.

Before close, require the same context, sole stack-frame identity, counters,
and current edit identity. Do not close an edit if any check fails. After close,
require `true`, the idle counters and empty stack, and `daR.eOi() == false`.
The completed edit can remain in undo history; a non-null `daR.NaF()` alone
does not mean an edit is still open. Do not clear native undo history or reset
private fields. A start throw has no owned-edit receipt and permits no close.
A close throw or false return is uncertain and permits no second close.

## Graph hooks and selection

The selected body keeps every graph step in `eOi` between start and callback.
With false copy mode and null `RHk`, it sets the new module's x/y, calls
`NHx.Uhv(had)`, and runs `llL` on a copy of the full module list. Virtual dispatch
reaches `gOr.ffA(had,int)`: the base membership path, Grid relationship hooks,
the `UZp` helper when present, and `mIz()` bounds/notification work remain active.
Do not replace this path with a list append or invoke those hooks twice.

The native list path records the relationship before `List.add`, then assigns
the parent and runs initialization/notification hooks. Undo records can therefore
exist before membership and parent agree. This is the reason for the disposal
rule below. The body also requires `NHx.vl() == 0`; check it explicitly before
insertion. Do not treat its assertion as an admission guard.

`oaA` calls `Gn.ffA(Collection)` to replace module selection and
`Gn.nrP(HEV)` to set focus. The former removes prior selections and adds new
ones. The latter reaches `Gn.eJS(HEV)` and its focus update. Neither is a graph
insertion hook. Omit the callback entirely. A return with unchanged mixer
selection alone does not prove unchanged Grid selection.

For the Grid witness, read the existing `NHx.kG` map entry keyed by the current
`Ibf.NaF()` display name. Do not call `NHx.cG3(String)` to obtain it: that method
creates and attaches a `KgN` when the entry is absent. Read existing `nST.ffA`
(`Tu`) and the selected-object list `JD1` and focus field `GC`. These fields
are declared in `YJr`, which `Gn` inherits. Require an
existing, non-disposed state object; otherwise refuse. Limit the selected list
to four members before and five after. Compare ordered object identities and
focus identity within the task, and emit module UUIDs and scalar equality
results only. Omit the `focus` member when focus is absent, as the bridge
encoder does. A present focus contains its module UUID. Test the complete
response/request JSON round trip. Do not stringify arbitrary native objects. Keep the baseline
selection references task-local; no detached module handle enters an epoch.

Add the same bounded selection witness to both independent before and after
reads, along with the existing public `selection.status` checks. Report a missing
or unrepresentable witness as incomplete; do not silently substitute mixer
selection. If focus is non-null, require an `mbe` whose inherited `QAi.pvN()`
returns a selected module. That getter reads one field. Refuse other focus
forms in this first probe. Check the visible selection in the UI.
Any selection delta fails acceptance; do not hide it with a restoring write.

## Managed identity after attachment

[E287](../../evidence/experiments/e287-grid-attachment-managed-identity.md)'s first V10 request completes insertion and close. Its two recovery reads
have one difference from the detached-default prediction: the new Nitro atom's
property 14 changes from 0 to 4000. All other projected fields and native
witnesses agree. Keep the write lock; this observation does not pass the live gate.

The pinned host trace maps property 14 to `HEV.WKy()`. Document registration
in `uX1.NaF(HEV)` assigns the next ID when the prior ID is zero, then registers
the object. `uX1.ffA(int)` reads that registry. Do not hard-code 4000 or omit
property 14 from equality checks.

V11 must resolve the getter and registry lookup before construction. After
close, navigate the new module's contents and child index 4 through the fixed
projection descriptors. Require the exact `dkb` class, contents owner, the same
live document context, a positive ID, and registry lookup identity with that
atom. Emit the ID and a registration proof in the scalar attachment receipt.
Do not invoke the ID setter or registration method. Refuse a zero, missing,
foreign, or unregistered result. Do not retry or dispose after insertion.

Use the receipt ID for only the new Nitro atom's property 14 in the expected
61-node graph. Keep detached ID 0 as a factory default. Require the ID to differ
from existing projected IDs, and require exact equality in both independent
reads. All other before nodes, defaults, relationships, and witnesses remain
exact. Tests must reject missing, invalid, duplicate, and changed IDs and a
wrong registry object. A saved V10 recovery pair can test this graph rule, but
cannot prove V11's command-time native registry check.

This adds two bounded descriptor steps and scalar identity/registry reads in
the existing document task. It adds no host turn, graph capture, write stage,
or retained native handle. Typical and maximum scope remain five modules,
18 calls, 650 ms warm wire plus 150 ms settlement, and 16 MiB temporary heap.
Measure the added local work on V11 after operator inspection, exact baseline
reopening, replacement, and a fresh hello. V10 remains locked until then.

## Layout admission

Read `cI_()` (x), `kyi()` (y), `pfb()` (width), and `rdo()` (height) for all five
modules. The first two read `DtR` integer fields. The last two read `QHo` byte
fields. Keep the signed native values; reject zero or negative dimensions.
Cross-check x/y with the semantic capture. The four baseline positions are
Sine (-4, -2), Amplify 25% (-1, -2), Audio Out (0, -2), and Amplify 50% (-1, 0).
E283 did not capture width/height. Do not assign measured dimensions from its UI.

Require width and height in 1–8, x/y in -16–16, and every exclusive right/bottom
edge in -16–24. Use checked arithmetic before any allocation. Require five
distinct object identities and no overlapping rectangles, including the new
rectangle at (2, 0). Require `max(y + height) - min(y) <= 16`. The new module's
native detached position must be (0, 0); use (2, 0) only in the simulation.
Refuse an unexpected position or rectangle. Do not search for another position.

Simulate `llL.ffA(List,Collection)` on scalar copies:

1. Stable-sort by x ascending, inserted member first on an x tie, then y
   ascending. Preserve input order when all keys are equal.
2. Allocate one integer per row in the admitted vertical span, initialized to
   the minimum signed integer. Rectangles use half-open bounds.
3. For each rectangle, set predicted x to the maximum of its original x and
   each occupied row's right edge. Then set each such row to predicted x + width.
4. Require every predicted x to equal the input x, including the new module's
   x of 2. No y, width, or height can change. Keep the predicted order and
   rectangles as scalar evidence. The native list itself is not sorted by this
   simulation or by `llL`, which receives a copy.

The maximum simulation has five rectangles and 16 row slots. Native dimensions
must be read again in each after capture and after undo/redo and reload. A
fifth module at the requested coordinates is insufficient if another moved.
This is a conditional admission design; the live rectangles still need to pass.

## Failure states and cleanup

Keep separate fields for factory attempt/return, ownership proof, edit start
attempt/return, edit ownership, insertion attempt/return, close attempt/return,
disposal attempt/proof, selection equality, and readback status. Include the
operation ID, failed stage, original exception, cleanup exception, native-stage
timings, and `uncertain` status. An exception report must retain the stage
record, not only the deepest exception message.

| Last proved state | Permitted action | Result |
|---|---|---|
| Refused before factory | No edit or cleanup | No mutation attempted |
| Factory threw before return, or ownership proof failed | No disposal of an unproved object | Stop writes; partial native allocation is unknown |
| Owned detached result; insertion was never attempted | Recheck null owner/parent, absence from the bounded live list, and the complete recorded owned tree; then use V8 disposal and verify all objects | Detached cleanup only; it does not repair a failed edit |
| Start returned false and edit state stayed idle | Do not invoke insertion or close; perform proved detached cleanup | Admission refused |
| Start threw, or returned with unexpected edit state | Do not close an unknown edit; no insertion | Stop writes, even if detached cleanup succeeds |
| Owned edit; association or another pre-insertion check failed | Close once only if the owned-edit proof still holds; perform proved detached cleanup | Report the failed stage and close outcome; stop this run |
| Insertion was attempted, whether it returned or threw | Never run detached disposal; close once only if the owned-edit proof holds | Document/undo ownership is possible; require independent readback |
| Close failed, ownership changed, or after read disagreed/failed | No retry, second close, delete, undo, redo, or save | Stop writes; retain a bounded diagnostic path |
| Watchdog fired | Latch uncertainty, stop writes, retain actual task-running state | Native work is not cancelled; a late result cannot convert timeout to success |

Once insertion is attempted, neither a null parent nor absence from the live
list proves that disposal is safe. Even after successful undo, the host can
own the module through redo history. Let the native document lifecycle manage
it. Drop task-local references when work finishes. Do not keep a detached
object in a recovery registry. A possible unowned allocation after a failed
insertion remains an explicit host-restart limit.

Close is edit bookkeeping, not rollback. Closing after a body throw can retain
a partial edit. Never report atomic recovery merely because close returned or
the semantic graph equals the baseline. Do not infer that `hoE` false means a
verified rollback.

Replace V8's single `timedOut` gate with separate write-lock and native-task
completion state in the proposed probe. Timeout must not set native work to
finished. Use a task `finally` signal that survives suppressed late callbacks.
If the watchdog fires before the body starts, skip insertion; close only an
already proved owned edit and dispose only a still-proved detached result.
Once the native body is entered, the watchdog cannot interrupt it. Late work
must still follow the owned-edit close rule. Keep terminal JSON diagnostics,
but never send a second reply or clear the write lock on late completion.

Permit one recovery workflow only after the document task is known to have
finished. It has a fresh bind, two fixed-projection reads, and release. It
cannot move the cursor, invoke schema discovery, construct a module, or clear
the write lock. Recheck the same project and route; refuse changed targets.
Admit at most five members, two cables, and the existing graph work/depth/byte
caps. Return incomplete evidence if damage exceeds these bounds. Preserve the
edit and membership diagnostics even when the graph read fails. If native work
has not finished, allow only cached status and operator inspection; queue no
document reads behind uncertain work. There is no diagnostic retry loop.

After uncertainty, the operator inspects or restarts the host before further
writes. Do not save the uncertain project. Preserve the verified backup at
`/tmp/gn-grid-spike-e280-baseline.bwproject`, SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
Reopen that baseline through the documented restoration process, reacquire
identities, and verify paired reads. Controller replacement alone does not
prove recovery of a damaged document or unfinished native operation.

## Cost and proof sequence

Keep 18 sequential wire calls: five fixture captures (two before, command guard,
two after), two local detached captures, one construction stage, and one native
insertion edit. At about 24 ms per bridge turn, 18 turns give a rough 432 ms
floor; queued document work and completion can add turns. Budget 650 ms summed
warm wire time plus 150 ms cursor settlement and client overhead. Keep 16 MiB
temporary heap planning, 4,096 graph/query work, depth 12, and 1 MiB encoded
graph limits. Cap the whole command response at 1 MiB, including the two detached
captures. Cap exception text at 4 KiB. Do not retain several full native graphs. Heap samples remain distinct from peak and retained heap.

The selection, edit, membership, and rectangle witnesses are bounded local
reads inside these existing calls. They add no wire turn or write stage. The
after projection has 61 nodes instead of 53. Allow up to about 42 KiB per graph
before the new scalar witnesses; this is an estimate. Capture payload sizes.
E283 measured 508.250–590.554 ms summed wire and 2–4 MiB sampled heap. The new
plan adds edit checks, ownership transfer, notifications, and layout in place
of disposal. First-use symbol/class work and factory cache misses remain
unmeasured. Make no cold-cache bound or cancellation claim.

The failure-only recovery workflow adds four wire calls (about 96 ms transport
floor), two bounded captures, and zero write stages. It is outside the success
budget. A native task that never finishes has no finite recovery-time estimate.
Undo and redo each add one action call and a separate paired-read workflow.
Save/reload, baseline restoration, UI checks, and the repeat are separate costs.
Record first/repeat wire, queue, document, factory, start, body, close, payload,
and heap results. Explain any regression above 20% against the matching E283
sample. Product call budgets do not change.

Implement fake-host checks before deployment for all failure-table rows, true
start without a real edit, outer-edit refusal, wrong frame/edit identity,
exceptions before and after membership, close false/throw, late native work,
timeout before queued execution, and recovery caps/target changes. Assert no
disposal after insertion entry and no close without owned-edit proof. Check
selection accessor absence without state creation. Check layout ties, negative
origins, edge contact, overlap, bounds, overflow, and exact no-movement output.
Check actual native signatures and overload resolution against the pinned jar.

On the new build, update all marker/inventory consumers and test the 18-call
driver budget. Deploy only when these checks pass. The operator then fully
removes the old controller and selects the final matching `ghostnote probe`
product in the complete list. Wait for confirmation and a fresh passing hello.
Do not use the orange detected-controller button or a power toggle as a reload.

The live gate requires a fresh fifth UUID, exact native defaults, position
(2, 0), unchanged existing rectangles, intended Grid owner and parent, and
exact ordered five-member readback. Both after reads must agree, preserve the
two cables and outer graph, and preserve public and Grid selection. Check UI,
single undo and redo, and a second independently timed insertion from the
verified baseline. Save an edited state, reload, reacquire UUIDs, and compare
semantic state and rectangles. Finally restore the exact baseline file, reopen,
and verify fresh paired reads and file hashes. E289 passes this document
attachment gate. Engine adoption and general failure atomicity remain unproved.


## Attachment run sequence

[E285](../../evidence/experiments/e285-native-grid-attachment-probe.md) implements
this contract. E286 fixes null-focus encoding. E287 records V10's insertion
and the managed-ID readback stop. V11 adds the native registration receipt and
is deployed. V10 remains locked with one factory attempt and its recovery
workflow used. Do not make another V10 Grid request.

[E288](../../evidence/experiments/e288-v11-restored-baseline.md) confirms operator
recovery, replacement, fresh hello, and baseline reads.
[E289](../../evidence/experiments/e289-native-grid-attachment-and-persistence.md)
completes the sequence below with an inactive engine. Both V11 attempts are
used. Do not repeat this sequence on the current initialization. The baseline
is restored and reopened; the Grid editor is open. The next 9a session is
[engine probe implementation and offline checks](9a-live-grid-editing-spike.md#next-session--engine-probe-implementation-and-offline-checks),
under the [E290 design](9a-engine-adoption-design.md).
The commands below remain the reproducible protocol for this completed gate.

Before the first insertion, inspect the UI and record an inactive engine in
an entry JSON file. Use these fields:

```json
{
  "project": "gn-grid-spike",
  "engineInactive": true,
  "observedAt": "<fresh UTC time from the UI observation>",
  "projectPath": "/Users/jonvuri/Documents/Bitwig Studio/Projects/gn-grid-spike/gn-grid-spike.bwproject",
  "presetPath": "/Users/jonvuri/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset",
  "backupPath": "/tmp/gn-grid-spike-e280-baseline.bwproject"
}
```

The record must be at most 60 seconds old at admission. Confirm stopped
transport, a muted track, the four-module baseline, outer identity, and visible
selection. From `brain/`, run:

```sh
node --import tsx src/probes/phase9a-grid-attachment.ts attach /tmp/gn-attachment-entry.json <new-absolute-output-directory>
```

The driver makes 18 calls on success. It refuses an unsettled cursor after
one poll. The handler requires two independent after reads. A client assertion
failure releases with `uncertain: true`; this locks writes. A wire failure
requests only cached `attachmentStatus`. Do not repeat the insertion command.
Once status reports native completion, the single diagnostic workflow is:

```sh
node --import tsx src/probes/phase9a-grid-attachment.ts recover <failed-output>/target.json <new-recovery-directory>
```

Recovery has four calls. It cannot move a cursor or unlock writes. A cached
status request is outside this four-call budget. An unfinished native task
permits status and operator inspection only. Use the failure rules above.

After successful attachment, check visible selection and layout. Test one undo
and redo. Use the following read-only mode after each action and after reload;
it captures paired graphs, native rectangles, edit state, and Grid selection:

```sh
node --import tsx src/probes/phase9a-grid-read.ts attachment <project-path> <preset-path> <new-absolute-output-directory>
```

This mode uses 15 calls when the cursor settles on its first poll. It does not
consume a factory attempt. Restore and verify the baseline before the second
insertion; use a fresh UI record and epoch. From the repository root, compare
the two saved insertions:

```sh
python3 tools/grid-spike/verify_attachment_evidence.py <first-output> <repeat-output>
```

The verifier proves the saved readback checks only. Finish the separate UI,
undo/redo, edited-state save/reload, and exact baseline-restoration gates above.
Do not infer those gates from an offline verifier result. Record live costs and
compare them with E283 before extending the attachment scope.

---
title: E333 — Grid doctor ownership and disposal admission
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E333 — Grid doctor ownership and disposal admission

## Result

Session 9b.6b ends with a measured offline refusal. Disposal can use a global
tracking queue that the scratch-object limit does not bound. App debug
commands can enable that mode. New ownership helpers also scan document
history outside the owned scratch tree. No bounded admission is established
for these paths. No probe is prepared or deployed.

The [trace](../data/phase9b-doctor/614-ownership/trace.json) records all direct
references in the installed jar to the selected investigation types. It
retains the required method bodies, branch offsets, exception tables, class
hashes, method handles, and dynamic-call bootstrap entries. These are trace
inputs, not a complete resolver or live candidate table. The 55-type and
76-member requirements and complete-table resilience tests remain in
[9b.6c](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6c--establish-bounded-admission-and-complete-resolution).

## Method and scope

The [diagnostic](../../../brain/src/probes/grid_doctor/ownership.py) checks
the installed jar hash against E332. It checks every imported seed method
against the jar, including its class hash, flags, references, branches, and
exception table. The jar SHA-256 is
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
The diagnostic reads class files as data. It does not initialize vendor
classes or contact the host.

The trace starts from E332's document, edit, journal, relationship hooks,
and disposal tail. Eight explicit investigation expansions follow recorded
references. They include the object/edit helper, the set implementation,
and the relationship predicate. Expansion names are evidence inputs for
this jar. They are not reusable selectors. The utility always refuses live
admission. The reproduction command is in the
[README](../../../brain/src/probes/grid_doctor/README.md#614-ownership-and-disposal-admission).

The census covers 31,627 classes, 393,713 methods, and 6,574,509 instructions.
It retains 6,073 reference sites, including constant-pool method handles,
and 475 method traces. Direct references do not prove complete virtual
dispatch. Reflection, native code, and external jars remain outside the
caller census. No missing external caller is treated as absence proof.

## Document set and object/edit ownership

`dfI.dnz` is a final set. Both document constructors allocate `cQy(10)`.
`cQy` uses `cQz` identity hashing and equality, with strong object references
in the `eTi` array. Ten is initial expected capacity, not a maximum size.

There are exactly eight direct field-reference sites: two constructor
writes and six reads in three `dfL` hooks. All six reads pass the set to
`add` or `remove`. This census finds no bulk clear, replacement after
construction, or transfer of the set to a cleanup helper. It does not prove
that an arbitrary document has an empty set at entry or exit.

Let R denote `dfI.cfM(property, parent)`. It delegates to
`zjj.cfM(property, parent)`: return true for property flag `0x20`, or for an
ancestor relationship with that flag. The ancestor walk has no fixed
iteration count. The complete resolver still needs its receiver contracts
and the admitted fixture's descriptor proof. R is separate from the
document replay field `dfI.iHb`.

| Hook | Set and helper behavior |
| --- | --- |
| Insertion | With R false, an owned relationship, and ordinary recording enabled, remove the object from `dnz`. On successful removal, call `dfI.cfM(object, journal.Hnt())` before the journal insertion record. With R true and an owned relationship, remove the object and call `dfI.UNj(object)` on success. |
| Removal | With R true, an owned relationship, and the final boolean false, add the object to `dnz`. When the final boolean is true, call `dfI.hUR(object)`. |
| One-to-one replacement | Apply the same recording-side transfer to the new object. With R true and the final boolean false, add the previous object. With R true, remove the new object and notify `UNj` on success. The final true branch notifies `hUR` for the previous object. |

The ownership test compares `deT.ODA()` or `deU.ODA()` with `cUb.Hnt`.
This table describes those bytecode branches. It does not assign a new
public meaning to the final boolean or validate fixture descriptors.

During document replay, `iHb` skips ordinary journal recording and the
recording-side transfer. The R-true branches are outside that replay check.
They can still add or remove set entries. Unchanged outer Undo code is
therefore insufficient to prove an unchanged ownership contract.

The object/edit helpers operate on document list `dfI.Z1C` and helper `dgJ`:

- `dfI.IwV(object)` creates or extends pending helper `dEI`. Each helper
  retains an identity set of objects.
- At normal `dfI.wGc()` completion, `Z1C.removeIf` removes empty helpers.
  The pending helper is then appended and `dEI` is cleared. The bootstrap
  points to `dgJ.cfM(): boolean`, which tests its set for emptiness.
- `dfI.cfM(object, edit)` scans `Z1C`. A matching `dgJ` stores that edit and
  is removed from the list. Its match checks object identity or `LaE`.
  Later `dgJ.appendChanges` delegates to the stored edit.
- `dfI.UNj(object)` and `hUR(object)` scan the list and reach `dgJ.FzB`.
  That method removes matching entries from each helper's set. Its
  LambdaMetafactory bootstrap targets the static two-object `dgJ.cfM`
  predicate. The predicate tests identity or `LaE`. Bootstrap evidence is
  now retained; the shared contract comparator still refuses dynamic calls.

The inherited `LaE` dispatch and all possible callback receivers are not
fully resolved by this diagnostic. No rule variant admits them. In
particular, a helper transfer can occur before a later journal operation
fails. The three relationship hooks, document transfer helpers, `dgJ`
transfer/cleanup, and `dfI.wGc()` have no exception handler that restores
those changes. Document Undo and journal Undo still have no replay cleanup
handler. Retain the uncertain-state latch. Never retry or clear native
state after such a failure.

The recording getter remains E332's 17-byte equivalent body, with access
changed from private to package access. This session records its new
caller chain but adds no access or command rule variant. Keep all journal,
recording-edit, replay-head, owned-head, identity, and selection checks.

## Global disposal tracking

`thz.Hnt` is private, static, and volatile. The complete direct-reference
census finds two bytecode writers: `thz.cfM()` enables tracking and
`thz.MRY()` disables it. Each takes the global set's monitor, clears that
set, and writes the flag. Neither drains the reference queue. There is no
flag assignment in the static initializer. This is not a runtime mode
measurement.

The app debug class `com/bitwig/flt/app/agent_debug/tfK` calls these methods
from its `start` and `stop` command branches. The stop branch can skip the
flag clear when its boolean argument is true. The same class calls the
tracker report and mode getter. No constant-pool method handle to `thz`
appears in the scan. This does not exclude reflection or external callers.

Tracking producers include `oDc.ix_()` at offset 138, `oDc.VPt()` at offset
68, and two calls in app method `TL.Hnt(aBF)` at offsets 369 and 376. The
queue is therefore not confined to a doctor scratch tree or one document.

When the flag is false, `thz.cfM(Object)` returns at offset 6. When true,
it enters the global set monitor, calls `IwV()`, allocates a `Wb` weak
reference registered with the global queue, and adds it to a linked hash
set. The drain polls at offset 3 and branches from offset 21 back to 0 until
the queue returns null. No counter bounds the loop. The report method also
drains the queue, then scans the global set and allocates a result list.
Do not use that report as a bounded read-only admission check.

The monitor handlers release the monitor and rethrow. They do not undo
object disposal or restore the tracking set. `oDc.ix_()` marks the object
disposed before its tracking tail. A tail failure can thus follow a real
mutation. A writer echo or visible graph equality cannot prove recovery.

For N disposed objects, enabled tracking adds N flag reads, N monitor
entries, up to N reference allocations, queue removal work, and global-set
insertion or resize work. Queue length, retained global references, and
monitor wait are independent of the existing 256-owned-object limit. A
single false flag read cannot exclude a later enable. First use can also
initialize the queue and set. Their current initialization and runtime mode
are not measured. No finite host-work or memory admission follows from
this offline trace. Do not change the flag, drain the queue, acquire a new
vendor lock, or assume that the mode is disabled to pass the doctor.

## Verification and cost

The [new suite](../data/phase9b-doctor/614-ownership/ownership-tests.txt)
passes 11 tests. It checks seed identity and changed-seed refusal, complete
jar enumeration, work limits, exclusive report creation, bootstrap identity,
missing and malformed bootstrap data, all set consumers, flag writers,
and the debug caller. These are diagnostic tests, not complete-table
resilience tests.

The [regression suite](../data/phase9b-doctor/614-ownership/regression-tests.txt)
passes 39 tests, including the complete renamed 6.0.6 resolver model and
the E332 trace procedure on both jars. Total: 50 tests. This does not
establish complete 6.1.4 resolution or live acceptance.

The [pre-implementation model](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6b-ownership-and-disposal-trace--model-before-implementation)
sets the offline limits. The final trace takes 11,538.089 ms, peaks at
188,383,232 bytes RSS, and retains 14 code classes. The report is 6,138,076
bytes. All scan and report limits hold. These are local process samples;
the workload differs from E332 and supplies no cross-version latency claim.
No live timing or product call budget changes. E315/E316 remain the old
live cost model. Public tool descriptions remain v52.

## Preservation and next work

The [preservation check](../data/phase9b-doctor/614-ownership/preservation.json)
checks the prior attempts, cache, selectors, E331/E332 evidence, accepted
V20 evidence, deployed normal archive, saved audit copy, and clean working
file. Their bytes match. The local doctor record inventory is unchanged.
There is no new-build candidate, attempt, acceptance cache, or archive.
No bridge, controller, engine, transport, save, or native command runs.
The last verified live state remains E330.

Continue with 9b.6c. Establish bounded ownership and tracking admission,
including mode stability and inherited callback contracts, before a new
probe can be prepared. Then complete all 55 types and 76 members through
the shared resolver, with all inherited resilience and first-attempt tests.
If admission still cannot be bounded, retain a specific refusal. Step 2,
the live doctor, teardown, E316 timing comparison, and the explicit two-build
result remain incomplete. Product cache enforcement remains in 9b.7.

## Retrospective

A field-use census must include every relationship hook and the storage
implementation. A constructor capacity does not bound retained history.
Check global mode writers and producers before applying a local scratch
limit to a new disposal tail.

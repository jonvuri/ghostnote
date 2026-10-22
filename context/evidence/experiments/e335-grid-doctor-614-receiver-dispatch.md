---
title: E335 — Grid doctor receiver and event dispatch on 6.1.4
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E335 — Grid doctor receiver and event dispatch on 6.1.4

## Result

Session 9b.6d ends with a specific measured refusal. The new trace finds a
relationship predicate override that always returns true, allocation in an
ancestor relationship step, and a round-trip callback that can dispatch
another application event. The fixed doctor's descriptor receivers and
command paths do not yet exclude these behaviors. History growth remains
unbounded by the scratch-object limit. No complete table or probe is ready.

The [trace](../data/phase9b-doctor/614-receivers/trace.json) reports
`runtime-receiver-and-command-closure-unproved`. This is an offline proof
gap. It is not an observed live re-entry, mode change, or failed write.
The complete shared 55-type/76-member resolver, its two-build resilience
checks, and the new-build driver remain incomplete. Continue with
[9b.6e](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6e--fixture-contracts-and-command-closure).

## Method

The [diagnostic](../../../brain/src/probes/grid_doctor/receiver_trace.py)
reads the installed jar as data. It reproduces E334's 204 method traces
before it uses the explicit
[investigation plan](../data/phase9b-doctor/614-receivers/trace-plan.json).
The jar SHA-256 remains
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
No vendor class is loaded or initialized. The plan contains investigation
names and source edges. It is not a reusable selector or candidate table.

The scan distinguishes a symbolic reference owner from the declaring class.
It follows superclass declarations and checks interface fields before a
superclass field. Duplicate declarations refuse. Missing external
interfaces and ambiguous interface fields stay unresolved. Method interface
dispatch is not inferred. A symbolic declaration does not select a runtime
virtual target. In particular, calls to the abstract `Rzi.UNj()` slot need
the separate `dqr` override trace.

The report retains 74 resolved reference sites and 603 unresolved references
with matching names and signatures. It finds no matching method handle.
The unresolved references include interface and external owners; they are
not 603 proved callers of the selected targets. They prevent an absence
claim outside the resolved class references. The report retains complete
instructions, branches, exception tables, bootstrap entries, and class hashes.
Reproduction is in the
[guide](../../../brain/src/probes/grid_doctor/README.md#614-receiver-and-event-contracts).

## Receiver and descriptor results

All 2,818 concrete object subclasses use `AVL.wxc()`, `oDc.H_()`, and
`oDc.lkC()` for the three new object slots. `H_()` returns the object itself.
`wxc()` still calls the context getter and context state. These declarations
do not complete `xmC()` admission or prove the fixed runtime context.
E334's parent getters and covariant delegates remain trace inputs.

The descriptor census changes the proposed guard requirements:

| Slot | In-jar result | Admission consequence |
| --- | --- | --- |
| `deS.X_()` | 3,514 concrete descriptor classes use 19 declaring classes. The base `der` body serves 3,445 receivers. | The base result cannot stand for every descriptor. Bind the fixed fixture's descriptor classes and their overrides. |
| `dfb.nVd()` | Four concrete relationship classes inherit the `0x20` test. `deX` overrides it with `iconst_1; ireturn`. | A clear base flag does not prove a false relationship predicate. Check the actual subtype and ancestor relationships. |
| `dfb.E3(object)` | `deT` delegates to its typed relationship getter. Four classes use `deU`, which allocates a new `CbE` wrapper. | One ancestor step can allocate. The depth bound must cover allocation as well as loop work. |
| `bnq.iHb()` and `J_()` | Two concrete relationship classes use their own property getters and the shared `UAH.J_()` parent getter. | Preserve both receiver contracts and the wrapper constructor. |

The inherited flag field is `deZ.FzB`, not a field declared by `dfb`.
The symbolic field census finds its constructor assignment as the only
resolved in-jar write. This does not prove runtime flag values or exclude
reflection and external code. It also cannot override `deX.nVd()` behavior.

The fixed fixture's descriptor IDs have not been bound to these receiver
contracts. No runtime descriptor or history is measured. No 6.1.4 role is
admitted from this census.

## Event drain and re-entry

The new trace completes the queued paths left open in E334:

1. `Dr2.cfM(gGV)` appends to its list and calls `postedToQueue`.
   `Dr2.ucQ()` posts a single event through the app's `dnm` queue. For a
   batch, it copies the list to an array and queues a runnable. The bootstrap
   at offset 104 targets `Dr2.cfM(gGV[])`.
2. That batch callback calls each `gGV.process()` at offset 64. The method
   calls the concrete event's `run()`. `ControlSurfaceObject$1.run()` calls
   the supplied runnable. The batch also calls `dpN.s_()` between events;
   this is not a proof that callbacks cannot dispatch another event.
3. The main loop `dpN.Wby()` obtains an event from `dnm.cfM()` at offset 70
   and calls `MRY(eoG)` at 83. `MRY` pushes an event on a deque and calls
   `Hnt(eoG)`. Its virtual dispatch reaches `CHR.cfM(eoG)` for `gGV`, or
   the inherited `dpN.cfM(eoG)` runnable branch for `eov`. That branch calls
   `eov.run()`, which calls the supplied runnable. E334's queued `leaks`
   callback can therefore use this same drain.
4. The incoming census also finds `dqr.UNj()`: it takes the same queue at
   offset 41, removes an event at 46, and calls `dpN.MRY(eoG)` at 65 unless
   the event is `eoL`. Its painting check is assertion-gated. No branch
   excludes the queued debug runnable by type.

Two waiting paths call the abstract context slot `Rzi.UNj()`:

- `XKG.cfM(Set)` calls it at offset 124 until a callback sets a boolean.
  Back edges 127 → 114 and 140 → 114 cover normal and caught-exception
  paths. The edit-opening method calls this helper at offset 295.
- `cQq.Hnt()` calls it at 126 until its completion field is true, with a
  129 → 115 back edge. Its synchronous request method calls `Hnt()` at 242.
  The incoming census finds `AJH.MRY(cQq)` calling that request at 60.

These are concrete event-pump mechanisms. Reachability from each fixed
doctor command remains unproved. The census does not establish a live
re-entry or justify assuming that every native command reaches one.

There is a limited exclusion: `XKG.cfM(Set, Runnable)` runs the callback
directly when its foreign-owner map is empty. An empty input set takes this
branch. `LBo.run()` sets the completion boolean before the waiting loop.
This excludes that wait for that exact empty-set call. It does not establish
the sets used by nested commands, replay, cleanup, or failure callbacks.
The existing empty-lock-array and idle-lock guards remain necessary.

Both resolved tracker flag writes remain `thz.cfM()` and `thz.MRY()`.
Their E334 debug dispatch remains queued. A false mode read followed by an
unproved command path is therefore insufficient admission. No mode change,
queue drain, debug request, or new vendor monitor is used.

## History and cost limits

The scan retains all resolved references to document fields `dnz`, `Z1C`,
and `dEI`, plus the identity-set storage array. E333's ownership transfers,
ordinary-recording branch, replay branch, and failure limits remain.
No rollback or finite fixed-sequence growth bound is established.

For one hook, keep E334's H + S × D work model: H is retained helper count,
S is total helper-set entries, and D is ancestor depth. The new `deU.E3`
trace adds possible wrapper allocation proportional to ancestor steps in
the relationship predicate. Storage capacity, pending-helper entries, and
all growth during normal edits, replay, cleanup, and failures still need
separate bounds. Neither a size read nor 256 scratch objects supplies them.

The [scan](../data/phase9b-doctor/614-receivers/scan.txt) takes 13,347.272 ms
and peaks at 196,411,392 bytes RSS. It reads 31,627 classes, 393,713 methods,
and 6,574,509 instructions. It uses 1,241,300 hierarchy edges and 2,409
cached symbolic lookups. It retains 238 method traces. The report is
1,797,252 bytes. All
[declared limits](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6d-receiver-and-event-contracts--model-before-implementation)
hold. The workload differs from E334. No live latency, cross-version
performance, or product budget claim follows. Descriptions remain v52.

## Verification and preservation

The [new suite](../data/phase9b-doctor/614-receivers/receiver-tests.txt)
passes 23 tests. It covers inherited symbolic references, overrides,
renaming and enumeration of a local model, unrelated additions, interface
field precedence and ambiguity, missing and duplicate declarations,
hierarchy and lookup bounds, changed seeds and plans, complete enumeration,
the batch bootstrap, the flag override, allocation, and both pump callers.
These are diagnostic checks, not complete-table resilience checks.

The [regression suite](../data/phase9b-doctor/614-receivers/regression-tests.txt)
passes 64 tests with both jars supplied. It retains the old complete
resolver, E332's shared two-jar trace, and E333/E334 diagnostics. Total: 87
tests. The new-build complete resolver, driver, live role checks,
teardown, and E316 timing comparison remain unrun.

The [preservation check](../data/phase9b-doctor/614-receivers/preservation.json)
compares 168 entry files and the local doctor record inventory. Original
selectors, attempts, caches, E331–E334 evidence, the normal deployment,
saved audit copy, and clean working project keep their bytes. No new-build
candidate, attempt, acceptance cache, or archive is produced. This session
makes no bridge or native request. E330 remains the last verified live state.

## Next work and retrospective

Session 9b.6e must bind all fixed-fixture roles and descriptor subtypes, then
trace their command calls through the two event-pump paths. It must retain
explicit unresolved edges instead of treating a missing symbolic caller as
proof of absence. Complete history growth and callback exclusion before
driver preparation. All 9b.6a resilience and first-attempt criteria remain.
Step 2 stays open; product cache enforcement remains in 9b.7.

Inventory overrides before deriving a guard from a base method body. Keep
symbolic declaration lookup separate from virtual dispatch: an override
can have no incoming references under its own declaring class name.

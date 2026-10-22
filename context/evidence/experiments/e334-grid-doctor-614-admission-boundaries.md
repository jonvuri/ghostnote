---
title: E334 — Grid doctor admission boundaries on 6.1.4
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E334 — Grid doctor admission boundaries on 6.1.4

## Result

Session 9b.6c ends with a specific measured refusal. The new trace identifies
the inherited ancestor walk, parent getter declarations, and debug command
dispatch. It does not establish bounded document history or prove that a
native command cannot dispatch another event before it returns. Bounded
admission and the complete 55-type/76-member table remain incomplete.
No probe is prepared or deployed.

The [trace](../data/phase9b-doctor/614-admission/trace.json) reports
`history-bounds-and-command-nonreentrancy-unproved`. This is an admission
proof gap, not an observed concurrent mode change or a live failure.
A shared event thread narrows the investigation; it does not by itself
prove mode stability. No selector or dynamic-call equivalence rule changes.
Continue with the explicit
[9b.6d session](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6d--complete-receiver-contracts-and-admission).

## Method

The [diagnostic](../../../brain/src/probes/grid_doctor/admission.py) reads
the jar as data. It checks the jar against E333 and reproduces all 475 seed
method traces, including instructions, bootstrap entries, class hashes,
branches, and exception tables. The jar SHA-256 remains
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.

The [trace plan](../data/phase9b-doctor/614-admission/trace-plan.json) contains
explicit investigation inputs for this jar. E333 supplies the object base,
ancestor predicate, tracker, and debug helper. Incoming references lead to
the command registry and socket reader. The existing extension entry point
supplies `ControlSurfaceObject.exec`. The plan also retains 44 explicit
method bodies, including the parent getter delegates. These names are not
reusable selectors, and the plan is not a candidate table.

Superclass lookup keeps declaring classes separate from concrete receiver
classes. It refuses missing, duplicate, private, static, native, and abstract
method results. It does not infer interface default dispatch. A complete jar
scan retains incoming direct references and method handles for the selected
debug classes and tracker. Reproduction is in the
[README](../../../brain/src/probes/grid_doctor/README.md#614-admission-boundaries).
No vendor class is loaded or initialized.

## Inherited ownership contract

All 2,818 concrete in-jar subclasses of `oDc` inherit
`AVL.LaE(OLR): boolean`. The only other exact declaration is the abstract
interface method. The body starts with assertion checks. It obtains the
receiver's parent at offset 51, compares that parent with the argument at
61, and follows `OLR.J_()` at 67. The back edge is 73 → 55. It returns true
for an ancestor identity and false at null. It has no fixed iteration cap,
visited set, or exception cleanup handler. The helper's separate identity
comparison remains necessary because this walk starts at the parent.

The exact parent slot has 35 declarations across the jar. Within the 2,818
concrete object receivers, 2,762 use the base `oDc.J_()` declaration. The
other 56 use 31 covariant bridge declarations. The base body reads field
`oDc.IwV` and returns. The trace retains the bridge bodies and their direct
getter delegates, including superclass calls and casts. This does not prove
the fixed fixture's runtime class set, every downstream virtual target, or
external subclasses. A cast failure must not be treated as an empty parent.

`AVL.xmC()` is final and shared by all these object receivers. It reads
thread-local state and can call `wxc()`, `H_()`, and descriptor `X_()`.
Thus even the assertion path has receiver dependencies. Assertions cannot
supply a production ownership or bounded-work guard.

The separate relationship predicate remains `zjj.cfM(dfb, oDc)`. It tests
`dfb.nVd()` and otherwise walks the parent's relationship chain through
`lkC`, `iHb`, and `bnq.J_`. The flag getter tests bit `0x20`. Its ancestor
loop has a 29 → 5 back edge. No runtime descriptor flag is measured here.
The fixed fixture's required descriptor contracts are still unproved.

E333's history behavior remains relevant in normal edits and replay.
`dnz` retains objects; `Z1C` retains helpers; `dEI` retains the pending
helper; each helper retains an identity set. Replay skips ordinary journal
recording but does not skip every R-true ownership branch. Transfers can
precede a later failure. There is no proved rollback for these changes.
Keep journal identity, recording-edit, replay-head, owned-head, freshness,
selection protection, the write lock, and the uncertain-state latch.

For a proposed cost bound, let H be the retained helper count, S the total
retained helper-set entries, and D the largest traversed ancestor depth.
Helper matching can require work proportional to H + S × D for one hook.
The document set's storage capacity and pending helper also need limits.
None of H, S, D, or that capacity follows from the 256-owned-object scratch
limit. These are required model inputs, not measured or admitted limits.

## Tracking mode dispatch

The new trace follows the mode writer through these steps:

1. `MVg` creates a socket-reader thread. It parses a request and calls
   `lBQ.cfM(String, Map)`.
2. `lBQ.FzB()` registers the `leaks` command. Offset 78 selects `pYi.MRY`.
   The LambdaMetafactory entry at offset 112 targets `lBQ.Hnt(CuM)`.
   That callback reaches E333's `tfK.cfM(String, int, boolean)` helper.
3. The registry runs `pYi.cfM` commands inline. For the other mode it calls
   `dpN.TVZ().asyncExec`, then polls a result queue for up to 20 seconds.
   The queued bootstrap calls the stored command callback. The `leaks`
   command therefore uses the queued branch, not the inline branch.
4. `dpN.asyncExec` wraps the runnable in an `eov` and posts it through
   `TbN().cfM(eoG)`. `CHR.Grk()` obtains this same application singleton
   through `dpN.TVZ()` and casts it.
5. Ghostnote queues its native work with `ControlSurfaceObject.exec`.
   Its `isDocumentThread()` delegates to `sdu.Grk()`, which checks
   `CHR.Grk().isEventDispatchThread()`. The proxy's `postEvent` reaches
   `sdu.cfM(gGV)`. That method has a control-surface-thread branch through
   `Dr2.cfM(gGV)` and another branch to the application event queue.

This establishes the debug command's queue route and the native task's
thread check. It does not complete the control-surface event drain or prove
that every native callback returns without a nested event pump. No new
vendor monitor is acquired. No lock-order contract is assumed.

The tracker still reads its volatile flag before entering its global set
monitor. A false read skips the tracking tail at that instant. Enabled
tracking still drains the uncapped global queue and can allocate or resize.
The debug stop branch can leave tracking enabled when `keep_watching` is
true. No runtime mode, class-initialization state, or queue size is measured.
The report method is not used as an admission check. The diagnostic never
changes the flag, drains the queue, or sends a debug request.

## Verification and cost

The [new tests](../data/phase9b-doctor/614-admission/admission-tests.txt)
pass 14 cases. They cover superclass lookup, local model renaming and
reordering, unrelated additions, distinct override receivers, required
signature and receiver changes, duplicate and missing declarations,
unsupported dispatch, hierarchy limits, changed seed instructions, plan
identity, scan limits, and the queued command's bootstrap and mode.
These are diagnostic tests. They do not replace complete-table resilience
checks on both jars.

The [regression tests](../data/phase9b-doctor/614-admission/regression-tests.txt)
pass 50 cases. They include the old complete renamed resolver model,
E332's shared trace procedure on both jars, and E333's ownership scan.
Total: 64 tests. The complete reusable 6.1.4 resolver, first-attempt driver
tests, live role checks, teardown, and E316 timing comparison remain unrun.

The [scan](../data/phase9b-doctor/614-admission/scan.txt) takes 11,300.429 ms
and peaks at 211,877,888 bytes RSS. It scans 31,627 classes, 393,713 methods,
and 6,574,509 instructions. It records 507,978 hierarchy edges, 398 sites,
204 method traces, and 16 retained code classes. The report is 1,660,925
bytes. All [declared limits](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6c-admission-boundary-trace--model-before-implementation)
hold. This workload differs from E333. It supplies no live latency or
cross-version performance claim. Product budgets and public descriptions
remain unchanged at v52.

## Preservation and next work

The [preservation check](../data/phase9b-doctor/614-admission/preservation.json)
checks 161 prior inputs, including original selectors, all retained doctor
attempts and caches, E331–E333 evidence, the deployed normal archive, the
saved audit evidence copy, and the clean working file. Their bytes match.
The local doctor record inventory is unchanged. No new-build candidate,
attempt, acceptance cache, or archive exists. The last verified live state
remains E330; this session makes no bridge or native request.

Session 9b.6d must finish receiver and descriptor contracts before it can
turn the proposed history variables into enforceable limits. It must trace
native event re-entry and mode exclusion before any disabled-mode admission.
The plan carries forward all 55 types, 76 members, complete-table resilience,
new-fingerprint attempt tests, and operator deployment requirements. A
partial table cannot be bundled. Step 2 stays open; product cache enforcement
remains in 9b.7.

## Retrospective

Trace a mode writer through command registration and dispatch before
inferring concurrency from a global volatile field. A shared event thread
reduces the proof scope, but nested dispatch still needs a command trace.

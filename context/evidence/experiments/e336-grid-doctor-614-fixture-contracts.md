---
title: E336 — Grid doctor fixture contracts on 6.1.4
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E336 — Grid doctor fixture contracts on 6.1.4

## Result

Session 9b.6e ends with a measured offline refusal. The complete local
member census finds three required contracts with no exact match on 6.1.4:
`disposal`, `members`, and `journal-recording-edit`. The membership result
is new. Its terminal getter replaces `Collections.EMPTY_LIST` with
`Collections.emptyList()`. The strict comparator remains unchanged.

The census covers every role, but it is not the complete reusable resolver.
Receiver and operation bindings, fixed descriptor subtypes, command closure,
and history growth remain unproved. No candidate table or probe is ready.
Continue with [9b.6f](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6f--role-bindings-and-traced-variants).
The live doctor, two-build result, and step 2 remain incomplete.

## Complete local contract census

The [utility](../../../brain/src/probes/grid_doctor/role_contracts.py) validates
the preserved source jar against all E315 selectors, 55 types, and 76 members.
It then applies the same local method comparator to both jars. It streams
all class bodies once per jar and retains at most 128 matches per role.
Match counts are complete even when the retained sample is truncated.
The source and target hashes remain E315 and E330, respectively.

The [report](../data/phase9b-doctor/614-fixtures/role-contracts.json) gives:

| Local result | 6.0.6 | 6.1.4 |
| --- | ---: | ---: |
| Unique executable contract | 17 | 15 |
| Ambiguous executable contract | 37 | 36 |
| Missing executable contract | 0 | 3 |
| Field requiring operation binding | 16 | 16 |
| Abstract method requiring dispatch binding | 5 | 5 |
| Unsupported source contract | 1 | 1 |
| Total member roles | 76 | 76 |

The unsupported source is `managed-id`. Its assertion path has an unchecked
bootstrap constant. This is a limit of the local comparator, not a failure
of E315's existing resolver. The old table still passes that resolver.
All 55 type roles remain explicitly unbound in this local census. A unique
method body does not prove its lookup receiver or its callees. Ambiguity is
not resolved by enumeration order or a weaker fallback. Fields are not
selected from their signatures alone.

### Membership getter

The exact `insert-body` contract has one match on each jar. Its member
identity binding maps the old membership call to `IcG.Grk(): List`.
Superclass lookup then gives these routes:

- 6.0.6: `gOr.eJS` → declaration `xWk.eJS` → special call `cbl.eJS` →
  declaration `NHx.eJS`.
- 6.1.4: `IcG.Grk` → declaration `EYY.Grk` → special call `Vzt.Grk` →
  declaration `BZG.Grk`.

Both builds use a five-byte delegate. The delegate is not a new behavior.
The source terminal getter loads `Collections.EMPTY_LIST` at offset 28.
The new terminal getter calls `Collections.emptyList()` at offset 28.
Both terminal bodies have 42 bytes and call `unmodifiableList` at offset 38
for a non-null backing list. The report retains both routes, all instructions,
class hashes, and the caller contract digest. The source terminal contract
matches itself; the new terminal contract does not match the old one.

This is a specific required-body difference, even if the collection result
is expected to be equivalent. No JDK implementation or runtime receiver
proof is supplied here. Do not silently normalize the field read and call.
A future variant must state its external-call and initialization assumptions.
E332's disposal-tail and recording-access differences also remain refused.

## Lock construction and waiting paths

The [focused trace](../data/phase9b-doctor/614-fixtures/trace.json) uses the
existing receiver diagnostic with a new
[plan](../data/phase9b-doctor/614-fixtures/trace-plan.json). It reproduces all
238 E335 seed traces before use. Plan names are investigation inputs only.
It retains 345 methods and ten resolved incoming sites. Its selected
signatures have no unresolved incoming site; this is not complete command
closure or an absence proof for interface, reflection, native, or external
calls. E334's mode-writer census and E335's queue paths remain applicable.

The explicit empty-array begin route can now be followed farther:

1. `AVL.cfM(String, IOJ[])` allocates a set and adds the array entries.
2. The set overload reaches `XKG.cfM(String, String, Set)`, which creates
   `core/Swj`. That constructor stores the same set.
3. `WzZ.cfM()` allocates `kJI`, whose constructor creates an empty set.
   `core/Swj.cfM(kJI)` iterates its supplied set and adds each lock.
4. In the exact empty-array route, the collected set is empty. The main
   edit opener tests it at offset 203. Branch 208 → 355 skips the lock wait
   at offset 295. This is stronger than an idle lock-count observation.

This conclusion is conditional on these exact receiver bodies. It covers
this begin route only. It does not exclude waits in insertion, replay,
disposal, close, or failure callbacks. The fixed runtime receiver proof is
still required. The construction also allocates sets and a collector; it is
not a zero-allocation path.

Other collectors cannot inherit this exclusion. The census finds 229
concrete `WzZ` receivers. All but one use its allocating collection getter;
`core/BKi` returns a shared collector. The per-receiver fill methods differ.
`kJI.cfM(oDc, oDc)` walks two ancestor chains, reads `cj_()` lock objects,
and adds non-null locks. Back edges are 310 → 279 and 347 → 316. There is
no fixed iteration counter in these loops. No nested lock-set bound follows
from the entry counter being zero.

The second waiting path is a synchronous `ping` request. `AJH.bLK()` obtains
`cQq` and calls `AJH.MRY(cQq)` when non-null; otherwise it calls `tco()`.
`Ljp.Yt()` supplies descriptor `ping`, ID 951, with `not_engine: true`.
`AJH.MRY` passes that descriptor to `cQq.cfM`, which calls `Hnt()` at 242.
E335's completion wait and context event pump remain. The descriptor's
`not_engine` attribute is not an event-pump exclusion. Reachability from each
fixed doctor command remains unproved. No ping or other request is sent.

## Context receivers and retained history

The scoped hierarchy has six concrete context classes and abstract `Rzi`.
Its concrete `UNj()` implementations are `dqr`, `ql`, and `core/JXO`.
`ql` delegates to `qf.hbP`; `core/JXO` calls `AUY.l_` and has an exception
branch. These downstream bodies are not closed here. The actual fixed
fixture context is not selected from this census.

For the 2,818 concrete object classes, 1,712 use `AVL.ULc()` and 1,106 use
`dve.ULc()`. The latter returns null. The base route calls `Rzi.cfM(AVL)`,
which walks parents until it finds a stored context or reaches null. Thus
`xmC` context access cannot assume one receiver body or constant depth.
These counts do not identify the fixed fixture's runtime objects.

The trace retains the pending-helper, transfer, completion, and cleanup
bodies from E333. It does not establish fixed-sequence bounds for `dnz`,
`Z1C`, `dEI`, helper-set entries, capacities, or ancestor depth. E335's
`deX.nVd()` override, `X_()` variants, and `deU.E3()` allocation still require
fixed descriptor bindings. Preserve the H + S × D model and account for
wrapper allocation. Neither 256 scratch objects nor a single size read
bounds these paths. No runtime mode change, queue drain, or new vendor
monitor is used. All freshness, selection, ownership, journal, replay,
write-lock, and uncertainty guards remain unchanged.

## Cost and verification

The [role scan](../data/phase9b-doctor/614-fixtures/role-scan.txt) takes
24,227.186 ms and peaks at 332,120,064 bytes RSS. It scans 777,386 methods
and 12,935,844 instructions across both jars. It retains 133 code classes;
the report is 1,107,556 bytes.

The [focused scan](../data/phase9b-doctor/614-fixtures/trace-scan.txt) takes
11,964.105 ms and peaks at 201,424,896 bytes RSS. It scans 31,627 classes,
393,713 methods, and 6,574,509 instructions. It uses 615,692 hierarchy edges
and 12 cached lookups, and retains 129 code classes. Its report is
1,686,636 bytes. Both final scans meet the
[model](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6e-fixture-contracts--model-before-implementation).
These workloads differ from prior sessions. They do not establish a live
latency or cross-version regression result. Product budgets and descriptions
remain unchanged at v52.

The 11 [role tests](../data/phase9b-doctor/614-fixtures/role-tests.txt) cover
renaming, enumeration, unrelated receiver and dependency additions, changed
signatures and operation references, missing and duplicate candidates,
bounded complete counts, unsupported contracts, source validation, work
limits, both jar censuses, and the membership routes. The
six [fixture tests](../data/phase9b-doctor/614-fixtures/fixture-tests.txt) reproduce
the trace and check the empty-set branch, other collector loops, ping ID,
context hierarchy, and null context override. These are diagnostic tests;
they do not replace the complete-table resilience suite.

The 87 [regression tests](../data/phase9b-doctor/614-fixtures/regression-tests.txt)
retain the old resolver and E331–E335 diagnostics. All 104 tests pass with
both jars supplied. The full new resolver,
new-build driver, live role checks, teardown, and E316 timing comparison
remain unrun. No Java or TypeScript behavior changes. The
[documentation check](../data/phase9b-doctor/614-fixtures/document-checks.json)
checks 647 local links and anchors in nine documents. Python syntax and
`git diff --check` pass.

## Preservation and next work

The [preservation check](../data/phase9b-doctor/614-fixtures/preservation.json)
compares 186 entry files with exit bytes. All match. Original selectors, attempts,
caches, earlier evidence and diagnostic code, deployed archive, saved audit
copy, and clean working project remain unchanged. No new-build candidate,
attempt, acceptance cache, archive, or live scratch object is created.
No bridge, native, controller, transport, engine, or save request runs.
E330 remains the last verified live state.

The [diagnostic attempts](../data/phase9b-doctor/614-fixtures/diagnostic-attempts.zip)
retain the intermediate reports and plans. The first broad context-slot
scan exceeded the 512-trace limit because the slot name also matches
unrelated classes. The next plan incorrectly named an inherited method as
a declaration and refused. A membership-edge check also refused until it
accounted for the old build's existing override. No limit or comparator
was weakened to pass these checks.

Session 9b.6f must bind roles with operation edges and descriptor contracts,
trace the required variants, and keep incomplete results closed. Its plan
carries forward all 9b.6e admission and complete-table criteria. Product
cache enforcement remains in 9b.7.

## Retrospective

Scope a virtual slot census by its receiver hierarchy before retaining
method bodies. Check symbolic owners and declarations on both builds:
the old source can already have an override between a call and the pinned
base member. A stable outer body does not prove a stable terminal getter.

---
title: E337 — Grid doctor operation bindings on 6.1.4
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E337 — Grid doctor operation bindings on 6.1.4

## Result

Session 9b.6f ends with a measured offline refusal. Exact operation edges
link 36 executable role contracts, nine fields, and 25 type inputs on
6.1.4. Seven fields have no operation binding. All five abstract roles
still need runtime dispatch contracts. Disposal, membership, and recording
access remain incompatible with the strict comparator. Managed ID remains
unsupported. No complete table or bounded probe is ready.

The new [report](../data/phase9b-doctor/614-bindings/bindings.json) covers
all 55 type roles and 76 member roles on both jars. It is a diagnostic,
not a candidate table. Continue with
[9b.6g](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6g--descriptor-anchors-and-bootstrap-contracts).
The full resolver, live doctor, two-build acceptance, and step 2 remain
incomplete. No host request or deployment occurs.

## Shared operation procedure

The [binding utility](../../../brain/src/probes/grid_doctor/role_bindings.py)
validates the source jar against the complete E315 table. It reproduces
both E336 local censuses and both membership routes before use. Jar hashes
remain E315 and E330. Vendor classes are read as data, never initialized.

Each round compares exact local contracts. It preserves type and member
identity across methods. It resolves symbolic references to class
declarations separately from runtime dispatch. A complete unique method
pool can start an operation trace. A linked declaring class permits a
complete rescan of that class, including roles whose global pool exceeds
128 retained matches. A truncated global pool cannot select a method.
All additions in a round must agree before the round is retained. Missing,
duplicate, conflicting, unsupported, and ambiguous results stay closed.

The procedure also finds source methods that reference the 16 required
fields on their declaring classes. This gives 35 source witness methods.
Only a method on an already linked declaring class can bind a field this
way. Fourteen witnesses match on the source jar; nine match on 6.1.4.
The report retains their exact contract digests, references, branch offsets,
exception tables, and source and target class hashes. Field access flags
and lookup declarations must also agree. An idle value never selects a field.

| Diagnostic member result | 6.0.6 | 6.1.4 |
| --- | ---: | ---: |
| Exact executable operation contract | 38 | 36 |
| Field bound through an operation | 9 | 9 |
| Abstract descriptor slot reached by an operation edge | 1 | 1 |
| Other abstract roles without dispatch binding | 4 | 4 |
| Ambiguous executable contracts | 5 | 4 |
| Unbound declaring class with truncated global pool | 11 | 11 |
| Fields without an operation binding | 7 | 7 |
| Missing or conflicting required executable contract | 0 | 3 |
| Unsupported managed-ID source contract | 1 | 1 |
| Total | 76 | 76 |

Both builds link 25 of 55 type inputs. Every linked source-build type and
selected executable role agrees with E315. The old complete resolver still
passes separately; this new procedure does not yet replace it. The source
membership body remains ambiguous in the operation procedure. E336's
separate delegate route still identifies its terminal body for diagnosis.
No result above proves a fixed fixture's runtime receiver or full callee
contract. In particular, the abstract descriptor edge has no executable body.

## Field identities on 6.1.4

| Role | Operation-linked field |
| --- | --- |
| Filter instance | `serial/iYN.Hnt` |
| Frame stack | `core/XKG.eLY` |
| Instant edits | `core/XKG.lYc` |
| Long edits | `core/XKG.E3` |
| Lock count | `core/XKG.TMF` |
| Lock set | `core/XKG.wGc` |
| Journal map | `dfI.TtY` |
| Associated edit | `device/IcG.lYc` |
| Display map | `device/BZG.hUR` |

Package prefixes are `com/bitwig/ramona/` for `serial` and `core`, and
`com/bitwig/flt/document/core/master/` for `device`. The report gives full
names and descriptors. These are trace results, not name-based selectors.
The five edit-state fields are now distinguished by operation use. Their
runtime values and final throwaway-edit invariants remain live requirements.

The seven unbound fields are the initialization helper, remote helper,
selection state, selected modules, focus, connected state, and inactive
state. Their receiver types need other anchors. The four remaining
ambiguous executable roles on 6.1.4 are name, instance UUID, height, and
recording. The report lists all eleven roles with truncated global pools.
They require receiver or descriptor evidence, not larger retained samples.

## Managed-ID bootstrap and required variants

The [variant diagnostic](../../../brain/src/probes/grid_doctor/role_variants.py)
retains the managed-ID source and the complete signature pool on the
operation-linked target object. Each build has one target in this pool.
This is an investigation input only. The strict comparator still refuses
its unchecked dynamic constant.

The source is `HEV.WKy(): int`; the new hypothesis is `oDc.vdx(): int`.
Both have 95 code bytes. The body tests the sign bit on an assertion path,
then masks with `0x7fffffff`. At offset 22, `LambdaMetafactory.metafactory`
creates a `Supplier` that captures the object. Its implementation handle is
`HEV.BDz` on 6.0.6 and `oDc.QuY` on 6.1.4. These private synthetic methods
call the abstract descriptor getter, then the descriptor name getter.
The name getter resolves to `cXZ.lSJ` and `dev.WVl`, respectively.

At offset 7 in each supplier body, a second bootstrap calls
`StringConcatFactory.makeConcatWithConstants`. Its recipe is
`Object of type \u0001 has been disposed`. Thus support for only the outer
lambda handle would leave a required dynamic dependency unchecked.
The report keeps both bootstrap handles, method types, recipe arguments,
method traces, and class hashes. It does not execute either bootstrap.

The assertion helpers are `cJT.eOi` and `cQi.MRY`. Their false branches
reach `Ymq` and `fNT` methods. The supplier overload can call `Supplier.get`
and another reporting method. The trace retains one further direct call
level and the relevant class initializers. It explicitly lists unclosed
virtual calls and bodies beyond that level. No assertion-mode, descriptor
receiver, initialization, allocation, or external-call bound is established.
This is not evidence of a new 6.1.4 failure; the same dependency pattern
exists on the source build.

The other variant traces reproduce E332's disposal and recording snapshots
and E336's membership routes. No comparator variant is admitted:

- Disposal still adds the tracking tail after mutation. E333–E336's global
  queue, mode stability, and failure limits remain.
- Recording access still changes from private to package access. An equal
  body alone cannot satisfy the strict access contract.
- Membership still changes a static field read to `Collections.emptyList()`.
  Both paths reference `Collections`, but the new path has an external
  invocation. This session does not trace the deployed JDK implementation
  or measure its initialization state. No zero-allocation or equivalent-cost
  claim follows. Both builds already have a superclass delegate.

## Admission limits

No fixed descriptor ID, subtype, context receiver, or command closure is
admitted by these operation links. E336's empty-array begin exclusion
still covers only that exact route. Other lock collectors, the synchronous
ping path, replay, close, disposal, and failure callbacks remain outside
complete closure. E335's nested event pump and mode-writer evidence remain.

No fixed-sequence bound for `dnz`, `Z1C`, `dEI`, helper sets, capacity, or
ancestor depth is established. Preserve the H + S × D model, pending
helpers, and wrapper allocation. Neither the new field bindings nor a
scratch-object count supplies those bounds. All live guards remain intact.
No driver, build guard, resources, marker, attempt policy, or cache changes.

## Verification, cost, and preservation

The [binding suite](../data/phase9b-doctor/614-bindings/binding-tests.txt)
passes all 15 tests on both jars and inert models. It covers renaming, enumeration, unrelated
members, required signatures and operations, field access and lookup,
missing and duplicate candidates, conflicting anchors, truncated pools,
abstract dispatch refusal, changed inputs, work limits, bootstrap evidence,
source identity, and exclusive report creation. These diagnostic checks do
not replace the full complete-table resilience suite.

The [regression suite](../data/phase9b-doctor/614-bindings/regression-tests.txt)
passes the first 87 old resolver and E331–E335 checks. The combined process
then reaches the unchanged RSS threshold in the census and fixture groups.
The fresh-process [census group](../data/phase9b-doctor/614-bindings/role-regression-tests.txt)
passes 11 tests; the [fixture group](../data/phase9b-doctor/614-bindings/fixture-regression-tests.txt)
passes six. All 119 checks pass across these groups, as recorded in the
[verification summary](../data/phase9b-doctor/614-bindings/verification.json).
The failed combined attempt is retained. No limit is raised.

The final scan takes 26,431.782 ms and peaks at 344,113,152 bytes RSS.
It retains 133 code classes and writes 1,095,413 bytes. Both census passes
scan 777,386 methods and 12,935,844 instructions. Binding work compares
1,443 target methods over 16,859 normalized target instructions. All declared
bounds hold. The measured scan and
limits are recorded in the
[ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6f-operation-bindings--model-before-implementation)
and [scan output](../data/phase9b-doctor/614-bindings/binding-scan.txt).
This workload differs from prior scans. It establishes no live latency or
cross-version regression result. Product budgets and descriptions remain v52.

The [preservation check](../data/phase9b-doctor/614-bindings/preservation.json)
compares all 208 entry files and the local doctor record inventory. All match. Original
selectors, prior diagnostic code and evidence, attempts, accepted cache,
deployed normal archive, saved audit copy, and clean working project keep
their bytes. The [development attempts](../data/phase9b-doctor/614-bindings/diagnostic-attempts.zip)
retain intermediate reports. The first report's instruction count was
incorrectly replaced by a zero hierarchy counter. The final report and
new test correct this reporting error; no limit was raised.

No new-build candidate, attempt, acceptance cache, archive, or scratch
object is created. No bridge, native, controller, engine, transport, or save
request runs. E330 remains the last verified live state. Full-table tests,
new-build driver checks, live role checks, teardown, and E316 per-call
comparison remain later gates in 9b.6g and 9b.6. Product cache enforcement
remains in 9b.7.

## Retrospective

A field needs a traced use site, not only a linked receiver and signature.
For dynamic calls, inspect the implementation handle's body: a lambda can
lead to a second bootstrap and abstract dispatch. Keep those dependencies
explicit before adding comparator support. Run large diagnostic test groups
in separate processes. The scanner's process peak-RSS guard includes earlier
tests in that process.

---
title: E332 — Grid doctor 6.1.4 command contracts
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E332 — Grid doctor 6.1.4 command contracts

## Result

Session 9b.6a ends with a specific offline refusal. The 6.1.4 relationship
hooks change object/edit bookkeeping. Object disposal adds a conditional
global tracking call. These are command changes, not only added class
members. The old complete table cannot be reused.

The [migration report](../data/phase9b-doctor/614-structural/migration.json)
traces these changes without vendor initialization or a host request.
The [source control](../data/phase9b-doctor/614-structural/source-control.json)
runs the same procedure on 6.0.6. It passes the traced subset only.
Neither report is a complete candidate table. No selector, driver, resource,
host guard, attempt policy, probe archive, or cache changes.

The reusable local contract comparison is implemented. The complete reusable
resolver is not. Eight type roles have trace inputs; 47 remain outside this
trace. No new-build member table is validated. The 55-type/76-member
acceptance criterion remains in
[9b.6b](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6b--trace-new-ownership-and-disposal-contracts).
The live doctor, timing comparison, and step 2 remain incomplete.

## Method and shared contracts

The [utility](../../../brain/src/probes/grid_doctor/migrate.py) first checks
the preserved jar against all E315 types, members, and caller-trace entries.
The new jar is the installed 6.1.4 jar with SHA-256
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
The source jar retains E315's SHA-256. Both are read as data.

The [local contract](../../../brain/src/probes/grid_doctor/contracts.py)
removes vendor symbol names. It retains access flags, signatures, literal
values, instruction order, branch targets, exception handlers, and repeated
type/member identities. Unrelated fields and methods do not enter its key.
Cross-method bindings require consistent receiver, field, and call identities.
Missing and multiple exact matches cause refusal. No build number, target
name, whole-class hash, or candidate position selects the new journal.

The journal Undo body supplies one exact anchor. Its references identify
the document, edit, and manager trace inputs. Related document methods must
match that binding. The project getter and its document Undo edge identify
the project caller. Twelve E315 caller-method local contracts match on the
new jar. The three changed entries are the two relationship hooks and the
recording-edit getter's access flags.

| Role | 6.0.6 | 6.1.4 trace input |
| --- | --- | --- |
| Project root | `master/Svr` | `master/g2L` |
| Edit document | `cZl` | `dfI` |
| Journal | `daR` | `dhu` |
| Edit | `cZv` | `dfT` |
| Manager | `core/Ibf` | `core/XKG` |
| Context | `core/uX1` | `core/Rzi` |
| Document object | `core/ikl` | `core/AVL` |
| Object | `core/HEV` | `core/oDc` |

The report includes exact package names, class hashes, parent edges, member
counts, and shape differences. These eight entries are trace inputs, not
accepted runtime type identities. The hook receiver is the unique class
with the bound document field and both required hook signatures. Its object
argument supplies the object hypothesis. Changed hook bodies are refused.

## Undo and changed ownership hooks

The matched project chain is `g2L.XO()` → `g2L.KiO()` → `dfI.tp2()`, followed
by label refresh `g2L.WVl()`. The document method checks `hbP()`, obtains
the current journal through `ejd()`, checks `dhu.TMF()`, sets replay field
`dfI.iHb`, calls `dhu.lYc()`, and clears the field on normal return.
The journal retains its replay head in `hUR`, replays the edit, clears that
head, and moves undo head `wGc` to the preceding edit on normal return.
The document and journal commands still have no replay exception handler.
The uncertain-state latch remains necessary.

Undo and Redo have equal local wrapper shapes. The shared member bindings
to the journal Undo command distinguish them. An exact wrapper match alone
does not select Undo or establish the complete replay contract.

The hooks are now on `dfL`. Insertion grows from 133 to 206 code bytes.
Removal grows from 95 to 149 bytes. Both still test the document replay
field before ordinary journal recording. Their new branches also use
document set `dfI.dnz`:

- Insertion can remove the object from the set and call
  `dfI.cfM(object, edit)` with the journal's recording edit. Another branch
  removes an object from the set and calls `dfI.UNj(object)`.
- Removal can add the object to the set. A final conditional branch calls
  `dfI.hUR(object)`.

The report retains branch offsets, references, and direct callees. These
branches extend the old recording/replay ownership contract. Their complete
lifetime, recovery, and attachment effects are not established here. No
variant admits them. The next session must trace their producers, consumers,
and cleanup before it revises the guards.

The recording-edit getter changes from private `daR.YLA()` to package-access
`dhu.Hnt()`. Its 17-byte body has the same local contract when access flags
are excluded: use the first recording field when non-null, otherwise use
the other edit field. The new insertion hook calls it. The strict flags
comparison refuses this change; the body comparison is diagnostic only.

## Changed disposal cost

The object disposal hypothesis is `oDc.ix_()`. Its instruction prefix through
offset 136 matches the old `HEV.dC_()` local contract before the final return.
It still traverses
owned children and sets the disposed flag. It then calls `thz.cfM(Object)`.
The method grows from 138 to 142 bytes. This prefix match does not admit a
new command.

The added helper checks a static volatile boolean. When enabled, it takes
the global set's monitor, drains a reference queue through `thz.IwV()`,
allocates a `Wb` reference, and inserts it into the set. The helper has
monitor-release exception handlers. The queue-drain loop has no static
iteration cap in the traced body. The weak-reference constructor and drain
body are included in the report.

The old disposal cost model does not cover this enabled branch. Neither the
runtime flag nor a queue bound is measured. The agent does not change this
flag or initialize its class. The next session must establish the mode and
its cost or refuse this disposal path. A guessed disabled mode cannot
justify reusing the old bound.

## Verification and cost

The [contract suite](../data/phase9b-doctor/614-structural/contract-tests.txt)
passes 12 tests. It runs the same trace procedure against both jars. Inert
tests cover renaming, enumeration, unrelated member additions on receivers
and referenced types, required signature/access changes, reference identity,
operation binding conflicts, literals, branches, handlers, missing and
duplicate candidates, and unsupported bootstrap constants.

The [legacy suite](../data/phase9b-doctor/614-structural/legacy-tests.txt)
passes all 27 tests, including the complete renamed 6.0.6 resolver model
and Undo/Redo ambiguity refusal. Total: 39 tests. This does not establish
full renamed-model or added-member resilience for a complete 6.1.4 resolver.
That resolver does not yet exist. Dynamic calls also need bootstrap evidence;
the new local comparator refuses a required unchecked dynamic call.

The pre-implementation model is in the
[ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6a-contract-trace-migration--model-before-implementation).
The new-build diagnostic takes 14,508.833 ms and peaks at 326,320,128 bytes
RSS. It performs 4,073 method comparisons over 13,724 normalized
instructions. It streams 20,332 class-code reads and retains 130 old and
10 new code classes. The report is 161,815 bytes. All declared bounds hold.
This work differs from E331's shape census and E315's complete resolution;
these samples do not establish a latency regression or a cold-disk bound.

No Java, TypeScript, live path, public description, or product call budget
changes. Public descriptions remain v52. The old live model remains the
record of old behavior; it is not a measured 6.1.4 disposal model.

## Preservation and next step

The [preservation check](../data/phase9b-doctor/614-structural/preservation.json)
checks the old attempts/cache, selectors, accepted evidence, deployed normal
archive, saved audit copy, and clean working file. Their bytes match.
No new-build attempt or cache exists. No bridge, controller, engine,
transport, save, native write, or deployment command runs. The last verified
live state remains E330.

Continue with the explicit 9b.6b plan. It carries forward all incomplete
resolution and resilience criteria, the changed ownership and disposal
traces, and the later probe preparation gates. A partial table must not be
bundled. Controller replacement and fresh scratch consent remain later
operator actions.

## Retrospective

A stable command wrapper can hide changes in its callbacks. Trace replay
hooks and disposal tails before treating added class members as unrelated.
Keep local contracts separate from cross-method identity checks: both are
needed to distinguish Undo from Redo without whole-class dependencies.

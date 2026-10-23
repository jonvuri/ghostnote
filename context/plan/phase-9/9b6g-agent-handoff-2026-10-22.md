# 9b.6g agent handoff — 2026-10-22

## Purpose and current state

Continue session **9b.6g: sustained offline resolution and probe preparation**
in `/Users/jonvuri/Development/ghostnote`. The user paused the investigation
and requested this handoff for another agent. This document records the
paused state. Its preparation did not resume the investigation.

The symbolic resolution work passes for all **55 type roles, 76 member
roles, and 16 fields** on both Bitwig jars. Many local behavior comparisons
and conditional cost models also pass. **No complete command has bounded
admission. The new probe is not ready.** The remaining work is chiefly
runtime provenance, complete command paths, stable storage, and enforceable
work and growth limits. No concrete external blocker or demonstrated
incompatibility has been established.

No live request, vendor class initialization, native write, controller
replacement, deployment, doctor attempt, or acceptance-cache change occurred
during 9b.6g. No changes are staged or committed. Do not mistake the large
number of passing local checks for completed admission.

**Continuation on 2026-10-22.** Five parallel offline investigations
completed the stopping points in sections 1–5 below as conditional results.
[Checkpoint 17](../../evidence/data/phase9b-doctor/614-resolution/checkpoint-17/README.md)
records them. Sections 1–5 describe the state before that continuation.
Use the plan work list for the current state.
[E338](../../evidence/experiments/e338-grid-doctor-614-offline-closeout.md)
then closed 9b.6g under [D52](../../decisions/d52-grid-upgrade-admission-policy.md).
This document is historical. Its tool navigation and artifact recovery
sections remain useful for 9b.6h.

The current plan is the source of acceptance criteria. This handoff adds
navigation and working details. Keep **one active work list in 9b.6g**.
Do not start 9b.6h for the same remaining work.

## Read first

1. [Repository instructions](../../../AGENTS.md) and [NOW](../../NOW.md).
   NOW still records the E337 entry state. It does not include the current
   9b.6g findings. Do not restart from its old missing-role list.
2. [9b.6g plan and active work list](9b-grid-breadth-discovery-and-build-out.md#session-9b6g--descriptor-anchors-and-bootstrap-contracts).
   Also read the 9b.6 and 9b.6a sections for driver and resilience criteria.
3. [Performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
   especially the 9b.6g model and its later extensions.
4. [Checkpoint 16](../../evidence/data/phase9b-doctor/614-resolution/checkpoint-16/README.md),
   then checkpoints 15 through 9 as needed. Read the older checkpoints for
   the original symbolic resolution and command traces.
5. [E337](../../evidence/experiments/e337-grid-doctor-614-operation-bindings.md),
   E336 through E331, [E315](../../evidence/experiments/e315-grid-doctor-document-undo.md),
   [E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md), and
   the [symbol manifest](9b-grid-symbol-manifest.md).
6. [D15](../../decisions/d15-verification-discipline-settled-2026-07-25.md)
   and the code that controls each changed boundary.

Use ASD-STE100 prose for documentation and comments. Keep existing E and D
records unchanged. Do not weaken the strict comparator or original selectors.
Keep explicit variants separate, with a traced reason and narrow tests.

## Session boundary and authority

Continue offline work through resolution, bounded admission, complete
resilience tests, and driver/probe preparation. A new trace, unsupported
form, or diagnostic refusal is an intermediate result. The planned endpoints
are:

- A complete, tested, prepared, and deployed probe at the operator
  replacement gate.
- A concrete external dependency after all independent offline work is
  complete. Identify the missing input and why offline checks cannot supply it.
- A demonstrated incompatibility that needs a scope decision. Supply a
  reproducible result and feasible alternatives. Keep the path refused.
- An explicit user pause or stop.

Do not change tracking mode, drain a queue, or acquire a new vendor monitor
to make a guard pass. Keep selection, freshness, journal, replay, owned-head,
write-lock, and uncertain-state guards. Never retry an uncertain write.

Complete resolution **and bounded admission** are required before driver or
probe preparation. A need for runtime evidence does not authorize an early
partial probe. E330 grants no native write authority. V20 remains pinned to
6.0.6 and E313's exact retry record. Do not run the accepted 6.0.6 doctor or
the 9a audio flow again. Step 2 remains open. Product cache enforcement is
9b.7 work.

When the preparation gates eventually pass, build and deploy from
`extension/` with `./gradlew copyProbeExtension`. The normal and probe tasks
write the same archive. The operator must fully remove the controller and
select the final matching `ghostnote probe` product in the complete list.
Do not use computer control in Bitwig Settings. A power toggle can retain
cached classes. Wait for confirmation, then run `npm run probe:hello` from
`brain/` and verify profile, method count/hash, fresh initialization, and
deliberate build markers.

Fresh save-first scratch consent, project/target/selection verification,
and competing-client checks are required before the new-build live doctor.
Historical state and native IDs do not transfer to a resumed session.

## Workspace and preservation

The workspace has two tracked modifications: the session plan and the
performance ledger. Diagnostic Python modules and tests under
`brain/src/probes/grid_doctor/`, and `614-resolution/`, are untracked.
The source inventory in the handoff bundle contains all 86 Python files,
including unchanged files. It is a snapshot, not a list of files to stage.
Run `git status --short` before edits. Preserve existing work.

The immutable entry inventory is
`context/evidence/data/phase9b-doctor/614-resolution/entry-inventory.json`.
It records 224 preserved files and local doctor files. **Do not regenerate
it.** The final preservation comparison is still due at the session outcome.
Preserve `.local/grid-doctor/`, old attempts and caches, original selectors,
all prior evidence, saved fixtures, the normal deployment, backups, and donor
sources. No final E338 record, NOW update, or session staging has been done.
Check that E338 is still free before using that number.

### Durable artifacts and recovery

The evidence root is
`context/evidence/data/phase9b-doctor/614-resolution/`.
Each checkpoint has a README, selected reports, a `development.zip`, its
manifest, and a source snapshot. Keep checkpoints 1–16 unchanged.

The handoff adds
[`handoff-2026-10-22/`](../../evidence/data/phase9b-doctor/614-resolution/handoff-2026-10-22/README.md).
It preserves 24 files absent from, or changed since, the checkpoints:
5,257,047 raw bytes and 278,160 compressed bytes. It also preserves the
current diagnostic source and the latest HashMap and JDK comparison reports.
This is a preservation supplement, not a new test or admission checkpoint.

The supplement's `artifact-index.json` maps **1,326 artifact names** to the
archive containing their latest preserved version, byte count, and SHA-256.
It includes the older checkpoint archives. Use this index instead of a
large directory search. The archive member names are the original basenames,
such as `gn-9b6g-disposal-release-variants-2.json`.

Most scripts use `/tmp/gn-9b6g-*` paths. These files exist at handoff time but
are temporary. If one is missing, find it in the index, verify its archived
hash, and restore that member to `/tmp`. Do not overwrite a different
existing file. Source snapshots use repository-relative member paths. Do
not extract those over newer working code without comparison.

Large derived jars and extracted JDK directories are not in the development
archives. Their generating scripts, reports, and maps are preserved. Rebuild
them from the pinned inputs if needed. Do not initialize vendor classes.

### Pinned input paths

| Input | Path or SHA-256 |
| --- | --- |
| 6.0.6 jar | `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar` |
| 6.0.6 SHA-256 | `382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93` |
| 6.1.4 jar | `/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar` |
| 6.1.4 SHA-256 | `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f` |
| Renamed old fixture | `/tmp/gn-9b6g-old-renamed-extra.jar` |
| Renamed old SHA-256 | `23708ef4c362ed072410c5415857bddcbfdc71f26087760cf5158ef8bf4158d6` |
| Renamed new fixture | `/tmp/gn-9b6g-renamed-extra.jar` |
| Renamed new SHA-256 | `ae29e627246fa89eb35a1c11e2c2623026bd84185f161b3b19b813b9508dde7e` |

The maps are `/tmp/gn-9b6g-old-renamed-map.json` and
`/tmp/gn-9b6g-renamed-map.json`. They map original names to `Rnn` names.
Renamed member names use `r_`, except special names such as `<init>`.
Do not print the entire maps.

Other inputs under `context/evidence/data/phase9b-doctor/` include:

- `v20-preparation/selectors.json` and `candidate.json`.
- `614-fixtures/role-contracts.json` and `trace.json`.
- `614-bindings/bindings.json`.
- `live-v20/captures.zip`.

Recheck input hashes after this handoff or any possible external change.
Do not repeat the full census when its inputs and contracts are unchanged.

## What has passed, and what that means

All 55 types, 76 members, and 16 fields resolve on both actual jars and both
renamed/reordered fixtures with unrelated additions. Six structural mutants
and one null-receiver read-dependency mutant are refused. These results
establish symbolic relationships and tested resilience. They do not prove
the live receiver, complete command behavior, or bounded admission.

The captured and factory catalog has 49 descriptor types. Four default-child
types and two generated-port types extend the working catalog to 55. This
catalog count and the 55 role count refer to different sets.

Major completed local work includes:

- Managed-ID LambdaMetafactory and StringConcatFactory contracts, assertion
  suppliers, descriptor dispatch, and name/reporting dependencies.
- 1,137 old and 1,139 new descriptor registrations across the initial combined
  catalog. The extra property is `displayed_device_name_changed`, ID 17266.
- 369 direct invariant reads with 450 matching local contracts, plus 53
  descriptor getters with 106 matching contracts.
- Aggregate value-invariant costs for 780 properties and one lock, under
  explicit receiver, storage, and assertion conditions.
- Conditional constructor bounds for 30 factory roots on all four jars.
  Two added port constructors and 20 port property entries pass on real jars.
- All 63 local port setter and listener contracts, including four narrow
  fresh-HashMap capacity variants.
- All 207 relationship predicates from 87 constructor witnesses on all four
  jars. All 75 serialized factory edges have false history predicates.
- All 49 factory disposal wrappers match across builds. The unregister
  traversal and its two hooks have explicit guarded comparisons, including
  renamed checks.
- Inert listener, disposal-tree, identity-map, and HashMap models. These use
  class bytes as data and do not execute vendor code in a JVM.

### Verification status

`/tmp/gn-9b6g-unit-regression-24.log` records the last full offline suite:
**346 tests run, 316 passed, 30 integration tests skipped**. The session adds
248 unit tests. The suite passed before the latest `runtime_dependencies.py`
change that adds two HashMap nested classes and more selected method names.
Focused extraction and HashMap model checks passed after that change.
The full suite has not yet run against that last change. Skipped integration
tests are not passed gates.

Checkpoint 16 records a passing `git diff --check`. Documentation checks for
this handoff are separate from those implementation results. Run the next
full suite when appropriate for the changed boundary; do not repeatedly run
unchanged checks to accumulate evidence.

## Remaining work, in dependency order

This section expands the plan's active work list. Keep status there rather
than creating a second competing completion checklist here.

### 1. Finish HashMap removal bounds at the current stopping point

The newest work is after checkpoint 16. Use these `/tmp/gn-9b6g-` artifacts,
also preserved in the handoff supplement:

- `hashmap-remove-model-2.py`, `.json`, and `.log`.
- `hashmap-tree-control-1.txt`.
- `runtime-{old,new}-{arm64,x64}-9.sh`, `.json`, and `.log`.
- `runtime-comparison-10.py`, `.json`, and `.log`.

`runtime_dependencies.py` now extracts 35 classes. The four bundled runtime
comparisons show identical ARM64 and x64 class bytes within each build.
Only `java/lang/ref/ReferenceQueue` differs across the two builds. HashMap,
Node, and TreeNode bytes match. `runtime-comparison-9` accidentally reads
the older `-8` reports and covers only 33 classes. Preserve it as an attempt;
use comparison 10 for the 35-class result.

The current extraction directory used by the model is
`/tmp/gn-9b6g-runtime-new-arm64-9/java.base`. Extraction uses
`/Library/Java/JavaVirtualMachines/temurin-26.jdk/Contents/Home/bin/jimage`.
This tool reads bundled runtime files as data. It does not establish that
Temurin 26 is the live Bitwig runtime.

The HashMap model interprets the extracted bytecode for remove, hash,
removeNode, replacementNode, constructors, tree lookup, tree removal,
untreeify, rotations, balanceDeletion, and moveRootToFront. It uses an inert
identity-hash stub. It assumes exact HashMap, non-null Object-equality keys
that do not implement Comparable, a valid stable table/tree, and an already
initialized true TreeNode assertion-disable flag.

It passes **5,293 cases**. Cases cover linked buckets of size 0–64, perfect
trees of size 1–127, distinct and identical hashes, absent and present keys,
and repeated deletion in forward, reverse, and deterministic shuffled order.
Checks include size, linked contents, parent pointers, root color, red-child
rules, black height, and previous links. Observed maxima are 7,200 bytecode
instructions, 263 non-native JDK entries, one native hash, and five Node
allocations. These maxima are observations, not admitted bounds.

Injected failure at the first replacement-node allocation leaves size 3
while only two bucket nodes remain reachable. The exception propagates.
No retry is permitted. This supports the existing uncertain-state rule.

The loose model assertion `instructions <= 2000 + 2000*N` is a test limit.
It is not an analytical proof. Derive and mechanically check a conservative
bound from the actual branch structure before using a formula. Then define
enforceable entry size, key, initialization, and stability conditions.

Useful instruction counts from the extracted bodies are:

| Method | Instructions in complete body | Control-flow detail |
| --- | ---: | --- |
| HashMap.hash | 13 | One native Object hash on this fixed key path |
| HashMap.remove(Object) | 16 | Uses matchValue=false |
| HashMap.removeNode | 142 | Linked search back edge 168 to 115 |
| HashMap.replacementNode | 11 | Allocates one Node |
| HashMap.afterNodeRemoval | 1 | Exact HashMap receiver only |
| Node constructor | 15 | Calls Object constructor, one instruction |
| TreeNode.root | 12 | Back edge 15 to 2 |
| TreeNode.find | 84 | Back edge 167 to 3 and recursive find |
| TreeNode.getTreeNode | 12 | May walk to root |
| TreeNode.untreeify | 29 | Back edge 47 to 7 |
| TreeNode.removeTreeNode | 288 | Successor walk back edge 200 to 185 |
| TreeNode.balanceDeletion | 252 | Back edges 112, 278, 332, 489 to 0 |
| rotateLeft / rotateRight | 51 each | No loops |
| moveRootToFront | 66 | Assertion-only invariant check must be excluded |
| Object.equals | 7 | Identity comparison |
| comparableClassFor | 60 | Fixed non-Comparable path is five instructions |

Working reasoning, **not yet established evidence**: linked search visits at
most N nodes; tree find visits disjoint subtrees; root walks visit at most N
parents; untreeify makes at most N-1 replacements. In balanceDeletion,
back-edge assignments move to a parent or root. An initial red-sibling
rotation marks the parent red, so an ensuing parent advance should end at
the next red check. Final rotations assign root. Check these facts against
bytecode and adversarial tree cases. A very loose linear bound may suffice;
do not assert a tight rotation bound without proof.

TreeNode's assertion initializer queries **HashMap.class**, not its own
class. The generic assertion-field recognizer does not cover that form.
Add a specific checked contract if needed; do not weaken it globally.
`moveRootToFront` is read from the full extracted class although it is not
in the selected-name report set. Include it in final dependency accounting.

One map removal accesses one bucket. Capacity does not add a full-table scan
to that operation. Other map/history iterations still need capacity bounds.
Do not infer all storage costs from this result.

### 2. Finish disposal, owned collection, and listener conditions

Checkpoint 16 covers 33 factory receiver classes: 30 original roots, two
ports, and the outer module. It finds 49 distinct wrappers and 169 map fields.
The maximum wrapper chain has 176 own instructions, 26 HashMap removals,
and two listener removals per object. These exclude base disposal and all
map/listener callees. Exact factory classes have no vendor hashCode or
equals override; their superclass chains end at Object. Native hash latency
and the exact live class remain conditions.

Only module_contents is managed in this receiver set: old `device/Wxc`,
new `device/hpW`. Both release-hook slots have conditional bounds across all
33 classes. The K2G hook's project branch is false for exact hpW. Broader
captured types, including native_device, are outside this factory proof and
can have uncapped list or project effects.

The base disposal model uses a stable nonempty owned tree. Let N be nodes,
M managed nodes, D maximum edge depth, and R the sum of strict descendants
below each managed node. R <= N*D. Its conditional aggregate is:

- Old: `36N + 19M + 61R - 10` instructions and
  `3N + 3M + 5R - 1` vendor calls.
- New: `41N + 19M + 57R - 10` instructions and
  `4N + 3M + 5R - 1` vendor calls.
- Collectors and iterators: `N + M + R` each.
- Iterator hasNext: `2N + M + 2R - 1`; next: `N + R - 1`.

These formulas exclude wrapper chains, map/listener bodies, collector and
iterator bodies, class initialization, native execution, concurrent changes,
and failure latency. A proven M <= 1 would give R <= N-1. It has not been
admitted. Finish collector bodies, exact ownership/no-cycle conditions,
iteration costs, storage stability, initialized callbacks, and partial
failure. The tree model passes 910 cases per build and demonstrates partial
disposal on failure.

Old listener storage `rHF.mListeners` is a List. New `TT.mListeners` can be
null, a single object, or a List. Old removal uses query.equals; new single
removal uses identity. General equivalence is false. The fixed Hgx lambda
listeners need a proven identity-equality, non-List condition.

The local listener-removal contracts pass on all four jars. The sequence
model checks 5,461 sequences and 30,948 paired mutations with matching
ordered recipients under these conditions. The actual ArrayList-removal
model checks 2,148 cases. Its conditional JDK bound is `65 + 17N`
instructions, `N + 3` calls, and at most one native array copy of N-1 slots.
No listener-size, capacity, or stability limit is admitted.

New TT.remove consults `apd.Hnt()` before storage removal. The getter reads
a volatile boolean; the false path is two instructions. It must remain
false through the operation. One entry read is insufficient. The disposal
tail `thz.cfM` has a three-instruction false path, but its true path drains a
global queue under a monitor and remains refused.

Relevant artifacts include `factory-release-2`, `factory-disposal-*`,
`disposal-release-variants-2`, `disposal-tree-*`, `listener-storage-incoming-1`,
`listener-storage-contracts-1`, `listener-removal-bounds-1`,
`listener-sequence-model-1`, and `listener-remove-model-2`.

### 3. Finish factory initialization, caches, callbacks, and hidden children

Amplify UUID is `a6cd650b-c4de-46c6-8741-c07a0a9bfec2`. Both bundled files
are 10,635 bytes. Their serialized root is **module_contents 1904**, not
module 1902. The raw data has 61 objects, 75 relationship edges (60 strong,
12 weak, 3 shared), and strong depth four. These are serialized counts,
not a proven initialized runtime count. E316's expected 77 owned objects
cannot be used as a pre-call bound without the initialization proof.

Four defaults extend the original catalog:

- 757 engine_shared_memory_helper: new zk/HOU, old hZO/KzN.
- 1661 browsing_session_state: new MkG/EIm, old peL/qOW.
- 1961 auxiliary remote controls: new device/bev/OLR, old iIS/FZ1.
- 1958 remote-controls page group: new device/HmS/riz, old JsV/rww.

Generated ports are audio 242 (`FCo` extends `jBm`, descriptor class `oV`)
and value 1809 (`ZDH` extends `EKl`, descriptor Ykp). Amplify has three
audio entries and one value entry. With double_precision 10071 false,
audio creation uses FCo rather than vta. Two port constructors have local
bounds of 51/57 instructions and seven vendor calls. Their full renamed
constructor checks remain distinct from earlier 30-root renamed checks.

Warm cloning can exclude Nitro compilation only under explicit cache and
copied-state conditions. The copied Nitro lists are **15756/15757**, not
generated-port properties 228/229. They have clone flag 264, which includes
bit 8. Generated-port properties use 385, which omits that bit.

`QZn.cfM` copies `Mdi.nVd/ucQ`. `BgP.b_ -> K2G.b_ -> woZ -> BgP.bl_`,
then `BgP.Pgx`, checks nonempty counts. The nonempty path can skip compilation
and build ports. Cold `BgP.cfM(rsB)` always invokes compilation. Fresh-clone
`ERO:ESe` is null. Its other stores are compile completion, SQN clearing,
and Hnt clearing. Prove copied lists and guard flags stay valid.

The warm route is `vDL.GDf` and its UUID cache, `GDf.MRY`, clone `RKg.FzB`,
then `zjj.cfM(newObject)`. Cold cache misses load a file. `bbQ` uses a
ThreadLocal map/list/counter, reverse callbacks, and cleanup without a
general finally. Close failure and retention. `rSf.lYc(UUID)` wraps hpW
in a fresh outer module; `rSf.MRY(hpW)` adds UUID and default setup, then
`hgq.G_ -> Dgc/base G_ -> ap_ -> pYg`. Account for all children and callbacks.

Compiler FDA cache misses can parse, analyze, generate code, access files,
or wait on an existing Future without a timeout. Force compilation replaces
a Future. Failure removes by key and completes exceptionally. A changed
embedded TMF hash remains an unsupported compiler contract; do not erase it.
The compiler's global factory uses an existing monitor. Module-cache
invalidation and capacity remain open. GDf TTL zero excludes one timer only.

The async route `dpN -> cXR -> TL` reaches CuM/executor behavior. RKg tracks
a generation counter, but cancellation increments it without stopping an
already started task or removing all state. LQR Future cancellation also
does not prove command completion. Trace exclusion or bound these paths.

Browsing EIm has a private final holder with an initially null Object slot.
Its constructor uses the raw byte-store method. The default empty bytes do
not by themselves prove holder stability after initialization. Four external
getter calls are assertion-excluded. Two setters remain reachable through
`device/Ac` and `device/g2L`, including a deferred Runnable path. They can
store an ivQ, mark a device flag, invoke virtual E3/lYc, clear the flag, and
detach a command. Close those paths for the fixed sequence. The new soft
holder is not globally equivalent to the old strong holder.

Use `module-file-*`, `nitro-*`, `constructor-bounds-2`,
`constructor-renamed-bounds-1`, `clone-contracts-2`,
`compiler-cache-incoming-1`, `module-cache-incoming-1`, `port-*`,
`browsing-holder-incoming-1`, and `browsing-getter-exclusion-1`.

### 4. Complete every fixed command path and mode-stability proof

Cover normal execution, replay, close, disposal, and failure. Retain unknown
interface, dynamic, native, reflection, and external edges explicitly.
Broad backward reachability did not prove exclusion. The empty-array begin
from E336 excludes one wait only.

Concrete open traces are:

- **Ping:** `AJH.MRY(cQq)` has 128 incoming sites, no handles or unresolved
  sites in that scan, all through bLK. `cQq.Hnt` and `XKG.cfM(Set)` have
  narrow begin callers. `deV -> der.MRY`, descriptor command Ljp 951, EIS,
  UNj UI, cQq/dfn protocols, and cuN wrappers remain relevant. OMB default
  and Dgc interface paths are unresolved. Ping 951 has arity zero and
  not_engine=true. Prove exclusion or bound its reachability and wait.
- **Actual context:** `TL -> OcA -> dqr -> Rzi` has CXG=this and current
  vpw/lYc conditions. Manager changes can reach `Rzi -> MJ -> dqr.E3 ->
  WWV.Hnt`, which drains two uncapped lists. Same-manager is only a narrow
  condition; prove it throughout the fixed sequence.
- **Lock collection:** `XKG.MRY` uses WzZ=BKi and a shared kJI HashSet.
  Deletion `JXO.JJY -> Vzt -> hLr -> kJI.Hnt` invalidates state. Boolean
  `RuU.IwV`, cable `PSD.MRY`, and mapping `xMq.MRY` use explicit empty IOJ
  arrays in some paths. Restore uses the default collector. Account for each.
- **Validation:** the actual tj2 journal is app/eD or qq, not the base no-op.
  `g2L.KZB -> Kiy.UNj -> ODA` validates. Grid membership 6428 invalidates
  IwV and queues ODA at the end. An entry valid flag does not survive this
  automatically. Undo/Redo TT notifications remain part of the closure.
- **Failure and event pump:** tj2 failure reaches qxu/npm/jso/RGd.GlQ lambda,
  then dpN.MRY end-of-event/async queues. `runAsNextEvent` on dpN/eov/dnm
  inserts at index zero under an existing monitor and notifies. WWV drains
  later. Enqueue is not a drain or a completion guarantee. Trace possible
  reentry and tracking-mode writers through all fixed paths.
- **Replay:** `dfT.LaE/Grk -> private MRY(Z)` creates Semaphore(0), copies
  lYc to ArrayList, starts AUY, and calls untimed acquire. The worker release
  is not protected by a general finally; an IOException branch is narrower
  than all failures. This also exists on the old build, so it alone does
  not establish new incompatibility. A driver timeout does not interrupt
  uncertain native work.
- **Rollback:** tp2 reverses TMF and clears fJR without a handler. Retain the
  uncertain-state latch after partial failure. `dfI.SQN/Esj.uWE` also has a
  true ThreadLocal dfQ debug guard to account for.
- **Document thread:** `GridReadSymbols.queue` reflects into the control
  surface and exec/document-thread checks. Actual concurrency and no-reentry
  conditions remain unproved.

The goal is a small, complete graph for the fixed doctor, not a universal
proof of all Bitwig commands. Each excluded branch needs a fixed receiver
or state witness and a stability argument. Each retained path needs bounded
work, allocation, waits, and failure effects.

### 5. Derive enforceable history and fixed-sequence growth limits

Keep E334's **H + S*D** model. Entry counts alone are insufficient. Bound
ordinary recording, replay, cleanup, pending helpers, and partial failure.
Storage capacity can exceed logical size and can matter during iteration.

The new dfI retains objects in dnz, helper records in Z1C, and pending state
in dEI. Helper sets and parent walks also contribute. Concrete paths include:

- dgJ constructor creates cQy Set and adds one object; cfM(oDc) adds another.
- dgJ.cfM(oDc,dfT) runs a private IwV match, then Hnt(edit) when matched.
- dgJ.IwV iterates its Set and tests identity or LaE parent walks.
- dfI.cfM(oDc,edit) scans Z1C and removes matched entries with the iterator.
- dfI.UNj scans and calls dgJ.MRY.
- dfI.hUR scans, calls dgJ.Hnt, then FzB.removeIf with identity/LaE logic.

All 75 serialized factory relationship predicates and seven added-child
schema predicates are false. This does not prove zero runtime helper growth
or exclude external callbacks. Seven schema entries elsewhere are true:
devicecontentsdisplay 257, module_display 264, modulecontentsdisplay 257,
modulegriddragpreview 421, modulegriddisplay 265, nativedevicedisplay 264,
and paneldisplay 257. Exact parent chains still matter.

The checked ancestor aggregate is `12 + 74D` instructions,
`1 + 12D` vendor calls, D wrapper objects, and D external Object constructors.
It covers a local traversal under stable finite parents, not all history work.
The IdentityHashMap lookup model checks 10,920 cases and has bounds
`45 + 24K` for found and `43 + 24K` for absent, plus one native identity hash.
It requires a stable valid table with an empty key slot. Capacity and monitor
wait remain unbounded. Fresh detached port setters still enter an existing
global IdentityHashMap monitor; do not omit it.

The resource-helper scan finds that none of the 55 fixed new-build receiver
classes inherits either resource class at the five direct helper callers.
This excludes those exact receivers only. It does not exclude callbacks or
prove an equivalent old-build resource rule from absent labels.

No supported method to inspect every needed capacity, nor any required
Unsafe/module-opening approach, has been established. Investigate the
available offline contracts before declaring an external blocker.

### 6. Integrate admission and complete resilience tests

Build one complete result from symbolic roles, explicit variants, runtime
conditions, full command closure, and enforceable limits. Keep unsupported
forms refused. Test complete tables on both actual jars and inert models:

- Full renaming and enumeration changes.
- Unrelated fields and methods on receivers and referenced types.
- Required signature, receiver, operation-edge, and command-trace changes.
- Missing and duplicate candidates, with no ambiguous fallback.
- Guard failures, initialization conditions, mode changes, capacity/depth
  limits, growth limits, and partial failure at changed boundaries.

Earlier renamed checks do not automatically cover later expanded descriptor,
port, invariant, or command sets. Integrate those deliberately. The 30 skipped
tests need their prerequisites at the correct gate. Inspect their code and
run bounded groups separately when needed; do not label skips as acceptance.

### 7. Prepare the driver and probe only after the gates pass

Adapt the pinned driver, candidate resources, exact host/jar guard, deliberate
build marker, and new-fingerprint first-attempt policy. Preserve V20 and its
old attempt/cache bytes. Test wrong build, duplicate attempt, incomplete
roles, uncertain-write retention, and exact old-record preservation. Keep
paired independent readback and complete-pass cache admission.

Then build, deploy, and reach the operator replacement gate under AGENTS.md.
Do not stop at finished offline resolution and defer ready preparation to
another session. Live checks need new consent and current project verification.
Compare per-call costs with E316, including unresolved mapping and factory
timing increases. Never repeat an uncertain command for timing.

At the session outcome, write the E record and index entry, update the plan,
ledger, reproduction instructions, and NOW, and compare preservation against
the original entry inventory. Stage only session changes; do not commit.
Do not write a completion record while command admission is incomplete.

## Code and tool navigation

Use `python3 -B` and `PYTHONPATH=brain/src/probes`. `python` is unavailable.
Prefer `rg` for search. No agent delegation was used. Keep one foreground
driver and one live writer if live work is later authorized.

Useful scripts, recoverable through the artifact index:

```sh
PYTHONPATH=brain/src/probes python3 -B /tmp/gn-9b6g-resolved-methods.py new 'fullOwner#name#descriptor'
PYTHONPATH=brain/src/probes python3 -B /tmp/gn-9b6g-inspect.py new FullClassName
```

Use `old` for the old jar. Supply exact owner paths from bindings; short names
can be ambiguous. Inspect narrow members rather than printing huge reports.
The inspection helper can be reused by executing only its prefix before
`for name in sys.argv[2:]`, with argv[1] set to old/new.

The richest current binding seed is
`/tmp/gn-9b6g-disposal-release-variants-2.json`. Its top-level type and member
bindings include the newer release helpers. `memberBindings` is a **list**
of source/target reference rows, not a dictionary. Convert rows to tuple keys
when needed. JSON cannot serialize tuple dictionary keys; encode rows again.

The new trace seed is `/tmp/gn-9b6g-listener-mode-1.json`; the old seed is
`/tmp/gn-9b6g-old-invariant-seed-1.json`. Bounded trace plans carry exact jar
hashes and target lists. Keep fresh report names rather than replacing an
earlier attempt. A failed diagnostic can still contain useful evidence.

`ancestors` includes interfaces and excludes external classes. It is a
generator; materialize it before repeated use. Use `admission.lineage` for
paired parent binding, not a zip of unrelated ancestor enumerations.

| Module | Role and important limit |
| --- | --- |
| `read_dataflow.py` | Conditional acyclic reads, path costs, static and instance identities; rejects unknown receivers and unsupported control flow |
| `conditional_contracts.py` | Explicit local comparison copies; `project_assertions` removes only recognized blocks and rebases branches |
| `constructor_paths.py` | Finds first parent/this constructor; does not bound full constructor work |
| `constructor_bounds.py` | Bounds direct constructor closure; external, virtual, dynamic, and initialization work remain separate |
| `constructor_variants.py` | Narrow map-capacity and empty-holder constructor differences; no global storage equivalence |
| `constructor_flags.py` | Exact constructor flag provenance and fixed allocation witnesses |
| `descriptor_builders.py`, `owned_flow.py` | Registry/relationship paths; collectors and storage need separate bounds |
| `invariant_root.py` | Exact root array-loop template and local costs |
| `history_ancestor.py` | Exact ancestor-loop template and local costs |
| `disposal_wrappers.py` | Map delegates and initialized listener delegates; partial failure preserves prior effects |
| `listener_removal.py` | Exact old/new storage forms, false-mode dependency, and local instruction/call bounds |
| `listener_map_variant.py` | One fresh private HashMap capacity variant; preserves the rest of the method |
| `runtime_dependencies.py` | Reads bundled JDK class bytes and selected method traces; now 35 classes |
| `empty_storage.py` | Exact private-final empty-list construction and incoming uses; reflection/native exclusions remain conditions |
| `module_file.py`, `nitro_data.py` | Bounded parsing of bundled data; do not execute constructors or compiler |

`ReadFlow(class_tests=True)` is opt-in. It resolves class tests only for
known concrete vendor receivers and suitable class targets. Negative proofs
need a lineage ending at Object. Interface, abstract, external, and unknown
cases remain unknown. Null is false. Default behavior is unchanged.

`project_assertions` rejects handlers, branches into removed bodies,
subroutines, switches, invalid destinations, and empty copies. Its result
still records initialized true assertion fields and boundedAdmission=false.
Do not apply it as a general comparator normalization.

### Resource limits

Use the ledger as authoritative. Important current offline limits include:

- 120 seconds per scan, 768 MiB RSS, 8 MiB per report.
- At most 256 retained code/source contract classes, 512 trace methods,
  and 16,000 dependency edges per report.
- Focused comparisons: 100,000 method comparisons, 2,000,000 normalized
  instructions, 128 rounds, 16,384 declaration lookups, 4,000,000 hierarchy
  edges. Separate streamed anchors: 1,000,000 methods, 16,000,000 instructions.
- ReadFlow: 64 active frames, 1,024 contexts per property, 100,000 states per
  build, 64 locals/stack slots, 4,096 states per method. Back edges, recursion,
  handlers, unsupported operations, and unknown receivers cause refusal.
- Constructor bounds: 128 roots, 512 methods, 64 active frames, 4,096
  instructions per method, 2,000,000 work units, 16,384 call sites.

These are diagnostic refusal limits, not OS enforcement or host work bounds.
The release-variant comparison used about 657 MiB, close enough to the
768 MiB limit that larger batches need care. Use separate processes.

To run the existing full offline suite when justified:

```sh
PYTHONPATH=brain/src/probes python3 -B - <<'PY'
from pathlib import Path
import unittest
names = ['grid_doctor.' + p.stem
         for p in sorted(Path('brain/src/probes/grid_doctor').glob('test_*.py'))]
result = unittest.TextTestRunner(verbosity=2).run(
    unittest.defaultTestLoader.loadTestsFromNames(names))
raise SystemExit(not result.wasSuccessful())
PY
```

Capture the next result under a new log name, such as regression 25. Do not
overwrite regression 24. Do not substitute this unit suite for the required
complete two-build integration and resilience gates.

## Checkpoint map

| Checkpoint | Main contents |
| --- | --- |
| 1–8 | Initial role, bootstrap, command, descriptor, factory, and JDK investigation; read their READMEs for the exact report set |
| 9 | Default catalog, constructor bounds, runtime classes, cache traces |
| 10 | Instance-read guards, invariant root loop, aggregate costs, clone contracts, holder-null reads |
| 11 | Port catalog, constructors, flows, invariant costs |
| 12 | Constructor/relationship flags, history predicates, ancestor loop, port setters |
| 13 | Listener-map variants, IdentityHashMap model, ancestor aggregate, JDK comparison |
| 14 | Resource receiver exclusions, initialized Hgx disposal delegate |
| 15 | Browsing getter exclusion, listener storage/removal, sequence model, release hooks |
| 16 | All factory disposal wrappers, assertion projection, tree costs and partial failure |
| Handoff supplement | 35-class runtime extraction/comparison and HashMap removal models after checkpoint 16 |

## Historical live state — recheck before any live action

E330 is the last verified live state. Bitwig is 6.1.4, API 25. The deployed
normal profile is `normal-v1`, 92 methods, hash `8be1975eaa99d78f`, with
initialization `2026-10-21T13:31:16.452Z`. Archive SHA-256 is
`25a5be4398f8825a7eabd2a541e49559ed60002f2d8d6b9db795f45664e4d9d2`.
The old bridge PID 69259 is historical, not a current process assertion.

The last project was clean, stopped `gn-upgrade-audit`, with Inst 1, Audio 2,
FX 1, and Master. Mixer/Launcher selection was Inst 1, row 0. The operator
saved the clean working file: 34,259 bytes, SHA-256
`573084e28ef7e241e3d52fd24265b1302d6f8cc22695270e3d11386e80d4398f`.
It was not reopened a second time. Preserve the separate 72,901-byte project
copy with hash `b01ba21f2f2a6d790fddbc9663a278721d23d14935a4dc067f76e4bdf809970b`.

Backups are under
`/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`.
Working projects are under
`/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/`.
Do not modify backups or donor sources. The doctor expects `gn-grid-spike`,
not the last audit project. Do not infer that the operator switched projects.

The historical E316 Grid control had only grid-probe, FX 1, and Master;
grid-probe was selected, muted, and at -10 dB. Both control pairs matched
normalized E276: four modules and two cables. Preserve that control.
E316 proves in-memory preservation, not saved-file identity.

## Suggested first continuation

Verify the input hashes and current workspace. Read checkpoint 16 and the
handoff supplement. Finish the HashMap analytical bound and its narrow
contracts, then combine it with owned collection, listener, and tree work.
Keep factory/cache, command closure, and history growth active in the same
plan. Update that work list as each dependency closes. Proceed to preparation
only after the complete admission and resilience gates pass.

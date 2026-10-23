# 9b.6g checkpoint 17: conditional bounds and command cores

This is an intermediate checkpoint. No complete command is admitted. No
live request, vendor initialization, deployment, attempt, or cache change
was made. Continue the active 9b.6g work list in the plan.

Five parallel offline investigations completed the stopping points in
sections 1–5 of the [2026-10-22 handoff](../../../../../plan/phase-9/9b6g-agent-handoff-2026-10-22.md).
Each result is conditional. Every report sets `boundedAdmission: false`
and `runtimeClassesInitialized: 0`. The input jar hashes were verified
before the work started and match the handoff table.

## HashMap removal bound

`hashmap-bound-3.json` replaces the loose test limit with an analytical
bound derived from the extracted 6.1.4 runtime classes. For a bucket of N
nodes and tree height H, one `HashMap.remove(Object)` costs at most
160 + 29N instructions and 7 + N frames in a linked bucket, or
719 + 110N + 308H instructions, 14 + 6N + 4H frames, and N - 1 Node
allocations in a tree bucket, with one native identity hash. Each loop
has a checked progress argument. The red-sibling arm of `balanceDeletion`
recolors the parent, so the next iteration exits at the red test. The
bound holds on 51,725 inert cases, including red-black trees built by
insertion and 5,136 color-invalid stress trees. The new module
`hashmap_removal.py` pins the class hashes, checks the loop structure,
and uses a specific contract for the `HashMap.class` assertion
initializer in `TreeNode`. The generic recognizer is unchanged.
Conditions: exact `HashMap` receiver, stable valid table and tree,
non-null identity keys that do not implement `Comparable`, an initialized
true assertion flag, and no concurrent change.

## Owned collector, serialized tree, and listener mode

`collection-conditions-17.json` resolves the null-key collector that the
base disposal traversal and walk call on both builds. It allocates a
fresh exact `ArrayList` and iterates the strong-property array. On the
worst of the 33 receivers (`module_contents`, eight strong properties),
one call costs at most 550 vendor and 2,291 + 39K JDK instructions, with
K returned children. `collection-conditions-18.json` passes the same
comparisons on both renamed fixtures. The serialized Amplify tree has one
managed node, so M = 1 and R = N - 1 hold for the serialized data only.
A runtime guard needs one extra collection pass before disposal.

`collection-conditions-21.json` finds exactly two writers of the volatile
tracking flag. Both are reachable only through the `agent_debug` client,
which exists only when the `testing-features` configuration is true. The
writer stays retained. The Hgx lambda listeners are final identity
objects, but a generic descriptor slot can also register on the same
chain, so the single-object storage form is not established from site
counts. An owner-only field-scan prefilter is unsound because a reference
can name a subclass; earlier scans with that prefilter need a recheck.

## Factory closure

`factory-closure-3.json` classifies 36 branches of the warm module route:
six bounded, three excluded, and 27 open. The UUID cache hits only after
an earlier load in the same process, so the first call in a fresh process
is cold and compiles. A TTL of zero does not prevent a hit. The compile
skip is decidable from the copied Nitro lists 15756 and 15757. Both
browsing setters are excluded for the fixed command path. The clone can
wait on a `Future` without a timeout when the calling thread has no scoped
queue. A clone failure can leave a per-thread counter incremented. The
`b_:Hgx` group was refused at the 512-method limit; the report records
`result: refused`. Nothing here is a demonstrated incompatibility.

## Command closure

`command-closure-2.json` builds an exact-dispatch core for 13 fixed roots
on both jars. No ping, manager push or pop, or manager-switch label is in
any core. No fixed command reaches the lock wait: the default collector
returns the shared empty static set, the cable, boolean, and
remove-mapping commands pass empty arrays, and delete invalidates before
any wait. Replay handler tables match across builds; a replay worker
failure hangs the document thread on both builds and is a parity limit.
The 6.1.4 validation tail adds one observer notification. Frontier edges,
pending runnables at close, and listener counts remain open. The doctor
witness does not yet check the document manager or the project-document
class; the plan records that as a planned guard.

## History growth

`history-growth-4.json` pins 50 exact 6.1.4 bodies. One history hook
costs at most 8 + 64H + 59S + 13N + 12SD vendor instructions; the 13N term
is table capacity, which iterator removal never shrinks. Doctor objects
with a false relationship predicate add nothing to the helper list,
pending slot, or retained set. No true schema predicate lies on the
checked parent chain. The global property listener map has 22 monitor
entry sites with listener dispatch under the lock. An entry gate that
requires an empty helper list and a null pending helper makes each hook
constant; it needs two new edit-document field roles. The 6.0.6 build
has no helper set.

## Verification and continuation

The complete offline suite runs 417 tests: 387 pass and 30 integration
tests skip (`gn-9b6g-unit-regression-26.log`). Regression 25 confirmed
the earlier 346-test suite after the last `runtime_dependencies.py`
change. The session now has 319 new unit tests across 12 new modules and
tests. `git diff --check` passes. The entry inventory is unchanged.

Next, close the command frontier edges, the factory cold first-call and
clone queue-wait conditions, and the refused `b_:Hgx` group. Rerun
owner-only prefilter scans. Then model the planned runtime entry guards.
Complete bounded admission and two-build resilience before driver or
probe preparation. This checkpoint is not a blocker handoff or session
outcome.

The development archive preserves 96 files: 8,739,471 raw bytes and
772,408 compressed bytes. The source archive and inventory preserve the
98 diagnostic Python files. The final preservation check remains due at
the session outcome.

# 9b.6g checkpoint 16: factory disposal and tree costs

This is an intermediate checkpoint. No complete command is admitted. No
live request, vendor initialization, deployment, attempt, or cache change
was made. Continue the active 9b.6g work list.

## Factory wrappers

`factory-disposal-wrappers-1.json` follows the disposal chain for each of
the 33 factory receiver classes from checkpoint 15. All chains reach the
base disposal method on both builds. Each build has 49 distinct wrappers.
They use map-removal delegates or the initialized listener-removal form.
No initialized flag is assumed false.

`factory-disposal-contracts-1.json` matches all 49 local method contracts.
`factory-disposal-bounds-1.json` sums each receiver's wrapper chain. The
maximum is 176 own instructions, 26 HashMap removals, and two listener
removals per object. The two listener removals occur in Hgx. These counts
exclude the base disposal body and the map and listener callees.

The chains refer to 169 distinct map fields. Each exact receiver class has
no in-jar hashCode or equals override. Its superclass chain ends at
java/lang/Object. This excludes vendor key callbacks under the exact-class
condition. It does not bound the native hash method, HashMap bodies, map
size, or concurrent changes.

## Guarded release comparison

`project_assertions` creates a separate comparison copy for an explicit
local contract. It removes only recognized assertion blocks. It keeps
all other instructions and rebases branches. It refuses handlers, entered
blocks, unsupported control flow, and invalid destinations. The strict
comparator is unchanged.

`disposal-release-variants-2.json` checks the unregister traversal and its
two ordered hook slots. All three projected bodies match across builds.
All six renamed-body checks also pass. Both initialized true assertion
fields remain required. The first report attempt passed its comparisons
but failed JSON serialization on tuple keys. Version 2 encodes those keys
as reference rows. Both scripts and the first error log are preserved.

## Conditional tree model

`disposal-tree-model-1.json` interprets the three traversal method bodies.
Each build passes 910 cases. The cases include all selected small parent
trees and managed-flag combinations, plus chains, stars, and binary trees
with 32 and 77 nodes. A failure before the third disposal leaves one child
disposed and its parent undisposed. It propagates; it does not permit a retry.

The model assumes a stable, nonempty owned tree. N is its node count. M is
the number of managed nodes. R is the sum of strict descendants below each
managed node. C counts those nodes' immediate children. D is maximum edge
depth. Thus R is at most N times D.

Each node is disposed once. Each managed node starts one unregister walk.
Those walks enter R descendants. Their immediate-child and recursive-child
terms are C and R - C. The two 14-instruction terms sum to 14R. The own
traversal costs are:

- 6.0.6: 34N + 17M + 37R - 10 instructions.
- 6.1.4: 36N + 17M + 37R - 10 instructions.

`disposal-tree-bound-1.json` adds the two-instruction managed predicates,
the per-slot hook bounds from checkpoint 15, and the new three-instruction
false-tracking tail. The resulting conditional bounds are:

- 6.0.6: 36N + 19M + 61R - 10 instructions; 3N + 3M + 5R - 1 vendor calls.
- 6.1.4: 41N + 19M + 57R - 10 instructions; 4N + 3M + 5R - 1 vendor calls.

Both builds call the owned collector and create an iterator N + M + R
times. They call hasNext 2N + M + 2R - 1 times and next N + R - 1 times.
The collector and iterator bodies remain excluded from these bounds.
So do disposal wrappers, map and listener bodies, class initialization,
native execution, concurrent changes, and failure latency.

Only module_contents has a true managed predicate in the checked factory
class set. A separate entry guard could require at most one such object.
That would imply R at most N - 1. This checkpoint does not establish that
entry condition or admit a numeric node, depth, map, or listener limit.

## Verification and continuation

Five new assertion-projection tests pass. The complete offline suite runs
346 tests: 316 pass and 30 integration tests skip. The session now has 248
new unit tests. `git diff --check` passes.

Next, close the HashMap removal bodies, owned-collection work, and storage
and tree stability. Keep the browsing setters, tracker and queue closure,
history growth, and full command paths in the same work list. Complete
bounded admission and two-build resilience before driver or probe preparation.
This checkpoint is not a blocker handoff or session outcome.

The development archive preserves 23 files, 9,752,493 raw bytes and 481,291
compressed bytes. The source archive and inventory preserve the diagnostic
implementation. The entry inventory is unchanged. A final preservation
check remains due at the session outcome.

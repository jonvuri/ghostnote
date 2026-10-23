# 9b.6g checkpoint 15: listener storage and factory release hooks

This is an intermediate checkpoint. No complete command is admitted. No
live request, vendor initialization, deployment, attempt, or cache change
was made. Continue the active 9b.6g work list.

## Browsing holder

`browsing-getter-exclusion-1.json` checks the six external accessor calls
from the incoming scan. Four getter calls are in assertion branches.
They are unreachable when the checked assertion flags are initialized and
true. The control-flow check retains exception-handler edges. This includes
both getter sites in `device/ImZ.E3`, which has a handler.

Two setters remain reachable: `device/Ac.Nnn` and `device/g2L.wGc`.
`Ac.Ucl` supplies `Nnn` through a Runnable bootstrap. `g2L.ejd` calls `wGc`
directly. These paths still need command exclusion. The new holder starts
null, but its initial state does not establish stability.

## Listener storage and removal

The old `rHF` stores a private List. The new `TT` stores either one listener
or a List in a private Object field. The new remove path uses identity for
a single listener. The list path uses the query's `equals` method. General
listener equality and storage identity are not equivalent across builds.

The strict local comparison in `listener-storage-contracts-1.json` matches
the event-holder constructor. It refuses the three storage methods and
leaves the new mode getter unbound. These refusals are preserved. The
strict comparator is unchanged.

`listener_removal.removal_contract` checks the two removal bodies separately.
It validates all non-assertion instructions, branches, field aliases, and
List calls. It checks the new mode getter and records its false-field
condition. It does not normalize one storage form into the other.
`listener-removal-bounds-1.json` passes on both real jars and both renamed
fixtures. The conservative local bounds are 16 old instructions and 43 new
instructions. The new mode getter adds two instructions. Each removal calls
List.remove at most once. The new form also calls List.isEmpty at most once.
There is no explicit allocation in either checked removal body.

The reference scan finds 34 resolved sites, no method handles, and four
unresolved references. The unresolved references use the unrelated owners
`yrM` and `sk2` and reach external Cloneable interfaces. The two resolved
writes to the private xqx/btw event-holder fields store fresh eOU objects.
TT's four resolved storage writes occur in addListener and removeListener.
The scan is not a reflection or native-write exclusion. It does not impose
a capacity or registration-growth limit.

`listener-sequence-model-1.json` interprets the two vendor method bodies
with inert List operations and inert callbacks. All 5,461 sequences of up
to six add/remove operations match the reference ordered listener sequence.
The model checks 30,948 paired mutations and fires an event after each one.
It includes duplicate registration, absent removal, and re-addition. These
results require non-null listeners that do not implement List, identity
equality, disabled assertions, and false tracking mode. Callbacks do not
reenter or mutate storage in this model.

`listener-remove-model-2.json` also interprets the extracted JDK ArrayList
removal, fastRemove, isEmpty, and Object.equals bodies. It checks 2,148 cases
through 64 listeners. The conservative conditional JDK bound is 65 + 17N
instructions and N + 3 calls, where N is the entry list size. There is at
most one native array copy of at most max(0, N - 1) reference slots. The
model includes a failed array copy: modCount has changed, but size has not.
The failure propagates and does not permit a retry. Native execution time,
actual list limits, storage stability, and tracking stability remain open.
The report records the captured-size loop, increasing index, branch targets,
and class hashes. The bundled JDK equality check remains in checkpoint 13.

## Factory release hooks

The read interpreter has an opt-in concrete class test. It resolves a
positive superclass match. It resolves a negative result only when the
receiver's complete superclass chain reaches java/lang/Object. Interface
tests, external targets, unknown values, and incomplete negative chains
remain unresolved. The earlier read reports keep their original behavior.
Five inert tests check this boundary.

`disposal-release-contracts-1.json` matches four local methods. It leaves
the unregister traversal and two base hooks unmatched. Their assertion
branches differ between builds. This result does not admit those methods.

`factory-release-2.json` checks both hook slots independently on both builds.
Its receiver set has 33 classes: 30 constructor roots, two generated port
classes, and the module root. Only module_contents has a true managed
predicate. With an exact module_contents owner argument, the two hooks have
no external calls. The maximum hook costs are 17 old instructions and 15
new instructions. The class test excludes the project-specific callback.
These are hook-body bounds, not a bound for recursive unregister or disposal.

The first script collected interface owners as assertion-guard inputs and
hit the existing owner limit. Version 2 collects superclass declarations
only. Both attempts are preserved. No limit was increased.

## Verification and continuation

Seven new listener-removal tests and five new class-read tests pass. The
complete offline suite runs 341 tests: 311 pass and 30 integration tests
skip. The session now has 243 new unit tests. The skipped tests remain a
required integration gate. `git diff --check` passes.

Continue with recursive disposal and unregister costs, owned collections,
listener and tracker stability, actual parent chains, and command closure.
The browsing setters remain reachable. Complete history growth, mode and
queue closure, two-build resilience, and bounded admission before probe
preparation. This checkpoint is not a blocker handoff or session outcome.

The development archive preserves 56 files, 8,360,194 raw bytes and 469,360
compressed bytes. The source archive and inventory preserve the diagnostic
implementation. The entry inventory is unchanged. A final preservation
check remains due at the session outcome.

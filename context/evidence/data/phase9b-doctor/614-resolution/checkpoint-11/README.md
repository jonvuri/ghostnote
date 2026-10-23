# 9b.6g checkpoint 11

This checkpoint continues 9b.6g. No complete command admission, probe,
deployment, host request, or native write exists. The entry inventory and
all earlier checkpoints remain unchanged.

## Generated ports

The warm Nitro clone reconstructs generated ports from its copied Nitro
input and output lists. The bundled Amplify data has three audio entries
and one value entry. Its double-precision values are false. The traced
factory branches select `audio_port` (242) and `nitro_event_port` (1809).
Runtime cache contents and the complete callback sequence still need guards.

The two descriptor anchors extend the current catalog from 53 to 55 types.
This catalog count is separate from the resolver's 55 required type roles.
The new entries have 20 property registrations on each build. Every
registration has one allocation witness. All 20 properties bind, and all
20 read paths pass. There are no relationship collectors in these two
schemas. Their 43 local read contracts match across the real jars.

Nineteen factory, getter, constructor, and setter contracts also match.
The two constructor roots reach 12 methods. All 12 contracts match. The
conditional direct constructor costs are equal across builds:

| Type | Vendor instructions | Vendor calls |
| --- | ---: | ---: |
| Audio port | 51 | 7 |
| Nitro event port | 57 | 7 |

Root allocations, class initialization, external bodies, later setters,
attachment, and failures are outside these constructor counts. These two
new roots have not yet passed the renamed-model integration check.

## Port invariants

Thirteen direct invariant reads reach 28 methods. All 28 contracts match.
The largest normal getter has 43 vendor instructions and six vendor calls.
The value-invariant calculation covers all 20 property entries.

The two object invariants use the already traced base object invariant.
They add no panel list loop, domain invariant, or ancestor walk. Under the
existing descriptor-array, empty-expression, receiver, and assertion
conditions, their full vendor object-invariant counts are:

| Type | Instructions | Vendor calls | External calls | Explicit wrapper objects |
| --- | ---: | ---: | ---: | ---: |
| Audio port | 985 | 143 | 10 | 9 |
| Nitro event port | 1,197 | 174 | 12 | 11 |

External method bodies, class initialization, and failure paths remain
separate. These counts do not include construction, setters, or attachment.
Use `port-object-costs-2.json`; it checks complete property coverage and the
root declaration. Report 1 remains development evidence.

## Initialization and remaining work

Both port classes inherit a constant-false `I_()` and an empty `ap_()`.
Their `G_()` initialization can therefore exclude its child-initialization
branch. This does not exclude the other factory setters.

The port setters can reach recording hooks and static listener maps.
The maps and callback paths remain open. The polyphony argument is an enum;
its equality operation is inherited from `java.lang.Enum`. String equality,
string concatenation, channel-kind lookup, listener-map access, and their
initialization requirements still need cost closure.

The module cache constructor sets its clone flag to true. Its object-copy
predicate returns true. This supports the warm clone path but does not prove
cache identity, template stability, absence of eviction, or cold-path
exclusion at runtime. Cold deserialization still calls the compiler.

Continue with those setter and cache conditions, then complete the shared
command, history, mode, failure, and integration work. The larger descriptor
set must pass the remaining combined checks before probe preparation.

## Evidence and verification

The latest full suite remains checkpoint 10's 264 passing tests and 30
integration skips. No diagnostic source changed after that checkpoint.
The new reports use the existing checked functions. No unchanged full
reference census was repeated. `git diff --check` passed during this work.

The development archive contains 54 new or changed files, 12,250,953 raw
bytes. The manifest records their hashes. The source archive and inventory
preserve the current diagnostic revision. Development attempts include a
parent-chain check that used the broader ancestor iterator. The corrected
check uses the existing superclass-only `lineage` function. Use
`port-contracts-2.json`. Missing-method lookups and their partial outputs do
not establish a contract or an exclusion.

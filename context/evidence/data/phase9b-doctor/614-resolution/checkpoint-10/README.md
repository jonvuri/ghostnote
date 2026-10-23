# 9b.6g checkpoint 10

This is an active offline checkpoint. It does not complete 9b.6g or admit a
probe. No host request, vendor initialization, deployment, native write,
attempt, or acceptance-cache write occurred. Continue the same work list.

## Invariant reads and costs

- Direct invariant getters cover 369 paths and 450 methods on each real
  jar. All 450 local contracts match. The largest normal getter path has
  43 vendor instructions, six vendor calls, and no external call.
- All 53 descriptor getters have 106 matching local contracts. The largest
  path has five vendor instructions and one vendor call. Descriptor identity
  remains an explicit condition.
- The native-device lock getter has 37 vendor instructions and six vendor
  calls. Its result has an unresolved runtime identity. An exact initialized
  lock wrapper is required. The wrapper invariant adds four instructions
  and one vendor call. All nine local contracts match.
- The value-invariant calculation covers 780 properties and nine local
  methods. Its largest component bounds are 162 + 12N vendor instructions,
  22 vendor calls, and 8 + 2N external calls. N bounds a relationship output
  list. These are conditional partial costs, not admitted limits.
- The new root checker verifies both array loops and the empty-expression
  exit on both real jars and both renamed fixtures. Its own cost is
  33 + 12P + 15L instructions, P + 2L vendor calls, and one external list
  query. P and L are the value-array and lock-array lengths. Seven inert tests
  check execution counts and reject changed control flow, types, and access.
- The aggregate calculation covers 53 descriptors, 780 value properties,
  and one lock property. The largest constant term is the native-device
  descriptor: 6,646 + 216N vendor instructions, 910 vendor calls, and
  171 + 36N external calls. This excludes object-level invariant work,
  external bodies, class initialization, and failure paths. Array contents,
  identities, and lengths must remain stable. No finite N is admitted.
- The descriptor array getters expose `Arrays.asList` views. The arrays
  cannot be treated as immutable from their private fields alone.
- The 53 object-invariant roots reach 30 local methods with matching
  contracts. Panel-item list loops, decimal-domain invariants, and project
  ancestor walks remain separate work. These checks do not close them.

The first aggregate development report consumed an ancestor iterator before
it checked lock membership. It omitted the native-device lock. Report 2
corrects this; report 3 also reads the wrapper cost from its measured input.
Use `invariant-aggregate-3.json`. Preserve the earlier reports as development
evidence. Check each required ancestor against a materialized set when a
calculation performs more than one membership test.

## Browsing helper

Six new read-flow tests cover exact receiver-field conditions, inherited
field declarations, null type tests, and conflicting property inputs. The
checker also refuses malformed receiver and field keys.

Under explicit fresh-null conditions, the new browsing helper's private
getter returns null in 14 vendor instructions and one vendor call. It does
not call `SoftReference.get` on that path. Later non-null storage, callback
effects, and stability remain unproved. This is not a claim that the old
strong reference and the new holder have equal behavior in all states.

## Clone and compiler paths

The descriptor clone allocates new objects and copies selected properties.
It does not use a JVM field copy. Forty local clone, callback, and port-list
contracts match across the real jars. Two async factory targets lack source
type bindings in this report; they are not accepted from obfuscated names.

The Nitro callback counts `nitro_inputs` and `nitro_outputs`. These are
different from generated `in_ports` and `out_ports`. The bundled Amplify
file has three Nitro inputs and one output. Their property flags are 264,
which include copy bit 8. Their clone setters store the copied lists.
Generated port flags are 385 and omit that bit.

A warm clone with intact nonempty Nitro lists can exclude the compiler
branches in `bl_` and `Pgx`. The former then reconstructs generated ports.
The getter and callback trace supports this conditional path; it does not
yet prove cache identity, full clone state, port growth, or failure closure.
Cold deserialization calls the compiler directly after its parent callback.
The compiler cache, external dependencies, and queued task checks therefore
remain relevant unless the complete fixed command excludes the cold path.

The application constructor assigns an exact async handler. Its factory
creates the concrete task queue already traced through `CuM`. Cancellation
can change a generation counter after a callable starts. That operation
does not prove that the callable stops. Runtime queue and cache stability
remain unproved.

## Verification and continuation

The full suite runs 294 tests: 264 pass and 30 integration tests skip. There
are 196 new unit tests in 9b.6g. The unchanged full census checks remain in
earlier checkpoints. These totals do not establish complete resilience or
bounded command admission. `git diff --check` passed before this checkpoint.

`development.zip` contains 94 new or changed temporary files: 27,659,319
uncompressed bytes. Its manifest gives each hash. `diagnostic-source.zip`
and `source-inventory.json` preserve this source revision. Earlier
checkpoints and the entry inventory remain unchanged.

Continue with the warm clone's generated port construction and state guards,
the cold-path exclusion or compiler bounds, object-invariant aggregation,
and browsing-holder stability. Then finish command, history, mode, failure,
and integrated resilience checks. Driver and probe preparation remain gated.

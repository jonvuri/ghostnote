# 9b.6g checkpoint 12: relationship flags and history ancestors

This checkpoint is not session completion. No table or command is admitted.
No live request, attempt, cache write, deployment, or vendor initialization
was made. The existing one-session work list remains active.

## Results

- `constructor_flags.py` traces a final integer field through explicit
  constructor calls. It keeps the caller's literal and allocation witness.
  Thirteen inert tests cover argument slots, forwarding, field access,
  control flow, constructor entry, and refusal boundaries.
- `relationship-flags-1.json` resolves 87 allocation witnesses for 207
  relationship entries on each real jar. Every entry resolves. The field is
  `cYF.Uhv` on 6.0.6 and `deZ.FzB` on 6.1.4.
- `relationship-predicates-1.json` evaluates the actual virtual predicate.
  The base predicate tests bit 32. The `deX` override returns true directly.
  Seven entries have true predicates on each build. Raw bit 32 alone is not
  a valid substitute for dispatch. Both predicate method contracts match.
- `relationship-renamed-flags-2.json` repeats all 87 allocation checks and
  207 predicate checks on each renamed fixture with unrelated additions.
  Flags, origins, results, and local costs match the real jars.
- `factory-history-edges-1.json` joins the predicate results to the decoded
  Amplify template. All 75 serialized edges have false predicates on both
  builds. The traversal covers 61 objects, including reference edges.
  This result is not a runtime ownership or mutation trace.
- `added-history-relations-1.json` records seven false schema predicates for
  the traced remote controls, browsing state, page group, generated ports,
  and boolean and decimal shared-memory helpers. It does not prove which
  child instances exist or how their parent fields change.
- `history_ancestor.py` checks the complete 18-instruction ancestor loop.
  Its own bound is 7 + 11D instructions and 1 + 4D vendor calls for D
  wrappers. Seven inert tests execute empty chains, false chains, and every
  early-exit position through depth 64. Mutation tests reject changed
  branches, getters, signatures, locals, returns, handlers, and flags.
  `history-ancestor-bounds-1.json` verifies one unique root on each real jar
  and the same costs on both renamed jars. The local root contract matches.
- `port-setter-contracts-1.json` matches 59 of 63 setter and listener methods.
  Four listener-registration methods remain unmatched. Their fresh-map
  constructor forms need an explicit comparison. No projection was admitted.
- `port-listener-map-incoming-1.json` scans all 31,627 new-build classes,
  393,713 methods, and 6,574,509 instructions for five listener-map fields.
  It retains 95 resolved sites and 38 methods, with no method handles.
  Two unresolved references have a same-named field on unrelated symbolic
  owners and report an external `Cloneable` interface. They remain listed.

## Limits that affect the next work

The history loop calls `oDc.lkC`, which creates a relationship wrapper when
its parent is non-null. The local loop count excludes this allocation and
all getter and predicate bodies. Existing wrapper bounds are inputs to the
next aggregate check. Actual depth, cycle exclusion, parent identities,
constructor guards, and concurrent changes remain unproved.

A fresh port setter still looks up the global object-listener map. This map
is an `IdentityHashMap`, initialized in `oDc.<clinit>`. The existing vendor
method synchronizes on it. Registration and removal also use this monitor.
A detached parent excludes only parent recursion. It does not exclude the
map lookup. The property-specific listener maps are separate `HashMap`
instances. Their callbacks, capacities, registration, and stability remain
part of the command boundary. No new vendor monitor is proposed.

The 75 serialized edges and seven schema rows do not prove zero helper
history growth. Defaults, generated children, clone callbacks, attachment,
command mutations, runtime ancestors, pending helpers, and failure paths
still require closure. Warm-clone compiler exclusion remains conditional.

## Verification and reproduction

The full offline suite ran 314 tests: 284 passed and 30 integration tests
were skipped. This includes 216 new unit tests for 9b.6g. The full log is
`gn-9b6g-unit-regression-19.log` in `development.zip`. `git diff --check`
passed. These unit tests do not replace the complete resilience suite or
host verification.

`development.zip` contains the scripts, traces, reports, and logs added or
changed after checkpoint 11. `development-manifest.json` records their
hashes and byte counts. Use `PYTHONPATH=brain/src/probes python3 -B` for the
Python scripts. They read the fixed jar paths and prior checkpoint inputs.
The renamed checks use the unchanged renamed jars and maps from the prior
checkpoints. No script executes vendor bytecode. The source archive and
`source-inventory.json` identify the diagnostic implementation.

The first renamed-flag report attempt compared an in-memory cost tuple with
its JSON list and refused. Version 2 compares the same three numeric values
as lists. It makes no semantic or cost adjustment. Preserve both attempts.
One exploratory metadata print treated the member-binding list as a mapping
and failed. No report or binding was produced by that print.

Measured diagnostic work stayed below 120 seconds, 768 MiB RSS, and 8 MiB
per report. The largest new report is the setter comparison (4,136,313
bytes). The ancestor report used 19,469.757 ms and 512,458,752 peak RSS bytes.
The renamed flag report used 10,755.812 ms and 368,820,224 peak RSS bytes.
The listener scan used 10,571.925 ms and 179,290,112 peak RSS bytes.

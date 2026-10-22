---
title: E331 — Grid doctor 6.1.4 resolver refusal
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E331 — Grid doctor 6.1.4 resolver refusal

## Result

Session 9b.6 starts with offline discovery. The unchanged E315 selectors
refuse the installed 6.1.4 jar at `boolean-atom:expected-one-candidate:found-0`.
The [initial scan](../data/phase9b-doctor/614-preparation/initial-scan/candidate.json)
records that refusal. The complete
[diagnosis](../data/phase9b-doctor/614-preparation/diagnosis.json) finds 53
missing type roles out of 55. All 76 member roles depend on unresolved
types. A complete candidate table cannot be prepared with these selectors.

This is a traced offline limitation, not a failed live doctor or proof that
6.1.4 cannot support the Grid path. No new candidate resources, host guard,
first-attempt policy, archive, or accepted cache is installed. The V20 driver
and selectors remain unchanged. The next explicit session is
[9b.6a](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6a--resolve-changed-614-structure).
The 6.1.4 live doctor and step 2 remain incomplete.

## Inputs and method

The installed app metadata reports 6.1.4. Its jar fingerprint is:
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f:35778607:1790948299000000000`.
API 25 and the accepted normal-product audit come from E330; no new host
request checks them. The preserved 6.0.6 jar has the E315 SHA-256. Its copy
has a different modification time and path from the original installation.
The diagnostic uses its bytes as the old metadata oracle, not as a live
fingerprint or a transferable acceptance cache.

The new [diagnostic](../../../brain/src/probes/grid_doctor/diagnose.py) reads
both jars as data. It first resolves and validates the old table and checks
all 55 types and 76 members against E315. It then runs the unchanged strict
resolver on the new jar. After refusal, it compares all type roles at the
base shape and each of the two reference-refinement rounds. It does not
regenerate selectors or select a member with an unresolved receiver.

A shallow shape removes vendor names and retains class flags, inheritance
shape, field signatures, and method signatures with multiplicity. It does
not establish type identity, behavior, or write authority. The diagnostic
has no live candidate output. It records missing and ambiguous matches as
such; it never selects the first match.

## Symbols and structural changes

| Scope | Result |
| --- | --- |
| Strict type selection | 2 unique; 53 absent; no ambiguous final pool |
| Shallow type selection | 35 unique hypotheses; 14 absent; 6 ambiguous |
| Required members | All 76 blocked by unresolved types; no member validation on 6.1.4 |
| Strict layout type | `llL` → `axc`; no layout command or live result |
| Strict source interface | `a` → `led`; no live result |

The boolean atom has one shallow hypothesis: `QY` → `RuU`. Both classes
have two fields and 54 methods. Their shallow shapes agree. The match is
lost at the first reference-refinement round. The direct old dependencies
`agh` and `cXR` have no shallow match among the new atom's referenced types.
Other referenced types change at the next refinement round.

The report follows the declared superclass edges from this hypothesis.
Fourteen consecutive class pairs have equal shallow shapes. The next pair,
`com/bitwig/ramona/core/HEV` and `com/bitwig/ramona/core/oDc`, differs:
seven fields and 119 methods become eight fields and 124 methods. The added
field has a vendor reference type. Added method shapes are:

- Public `(): void`.
- Private `(Runnable, vendor): void`.
- Two public final `(): vendor` methods.
- Private synthetic `(vendor, Runnable): void`.

The next superclass pair, `ikl` and `AVL`, retains two fields but changes
from 48 to 49 methods. It adds a public abstract `(): vendor` method.
The report includes class hashes, parent edges, and exact shape differences.
These are metadata changes beyond a name change. They do not prove what the
new methods do. The ancestor pairing remains a diagnostic hypothesis.

The journal, edit document, project root, context, and object roles have no
shallow match. A weaker class hash would therefore not provide a complete
table. No 6.1.4 Undo caller or command-equivalence claim follows. The next
session must establish those identities and trace their code before it
changes a selector. E315's 6.0.6 Undo trace remains evidence for that build.

## Measurements

The complete diagnostic takes 12,933.436 ms and peaks at 354,861,056 bytes
RSS (338.422 MiB). It retains metadata for both jars and recomputes the
three shape levels for diagnosis. It retains 129 old code classes and zero
new code classes. Old-table call tracing uses 72 work units.
The report is 69,336 bytes. All declared limits hold.

The new jar has 31,655 entries, 31,627 classes, 24,702 default-package
classes, 466,601 members, and 71,461,507 uncompressed class bytes.
Its fingerprint, enumeration/metadata, and type-refinement stages take
12.973, 3,165.636, and 1,543.937 ms. It does not reach complete member
search or structural validation. These figures must not be compared with
E315's complete candidate scan as equal work.

The [ledger model](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6-offline-refusal-diagnosis--model-before-implementation)
keeps the existing per-jar bounds, a combined 120-second deadline, a 768 MiB
RSS refusal threshold, 256 retained code classes, and a 1 MiB report limit.
No host work, product call budget, or live timing changes. E316's unresolved
mapping and factory timing limits remain for the future live comparison.

## Verification and preserved state

The [focused suite](../data/phase9b-doctor/614-preparation/python-integration-tests.txt)
passes all 27 tests. It includes five diagnostic tests, the resolver failure
suite, full renamed-jar resolution on the preserved 6.0.6 jar, and V20's
Undo/Redo ambiguity check. The diagnostic tests check dependency drift,
ambiguous type pools, blocked signature/dispatch types, bounded candidate
lists, and shape multiplicity. The full new-jar diagnostic completes within
its bounds and reports no authority. Context links and diff checks pass.

The [preservation check](../data/phase9b-doctor/614-preparation/preservation.json)
compares both local 6.0.6 attempt files and the accepted cache with their
saved evidence. All bytes match. The deployed archive still matches E330.
The saved audit project copy and clean working file match E330's hashes.
No 6.1.4 attempt or accepted cache exists.

No bridge connection, vendor initialization, native write, controller
replacement, deployment, engine command, transport command, or save occurs.
The last verified live state remains E330. It is not re-observed here.
Java and TypeScript paths do not change, so their live checks are not run.
Public descriptions remain v52.

## Retrospective

A renamed-model test checks name independence only. It cannot establish
resilience to added members in a shared type. Keep a dependency-change test
and a complete type census before any new-build selector revision. The new
diagnostic test proves that a unique shallow match remains blocked when a
referenced base changes.

---
title: E311 — Offline Grid symbol resolution
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E311 — Offline Grid symbol resolution

## Result

Session 9b.4 passes its offline acceptance criteria on Bitwig 6.0.6.
All 69 member rows and 55 type roles match the pinned manifest. The type
roles include every lookup, declaration, signature dependency, extra type
guard, and `llL`. Default-package classes come from jar enumeration.
`MTu.NCM()` resolves to its inherited declaration on `TNT`.

The [report](../data/phase9b-resolvers/report.json) contains the complete
resolved table, type map, bounds, timings, and each required live invariant.
The [test log](../data/phase9b-resolvers/tests.txt) records the focused suite.
No bridge call, vendor-class initialization, controller deployment, native
command, or project change occurs. There is no accepted-build cache or live
adapter. Public descriptions remain v52.

This is structural acceptance on one jar. It does not establish semantic
or cross-build equivalence. The live doctor must still validate every role
before a write path can use it.

## Implementation and selection rules

The [CLI](../../../brain/src/probes/phase9b-grid-resolvers.py) reads the jar
as data. Its [implementation and run instructions](../../../brain/src/probes/grid_symbols/README.md)
separate discovery, structural validation, and the pinned test oracle.
No vendor bytecode is copied into the repository. The committed
[selectors](../../../brain/src/probes/grid_symbols/selectors.json) contain
structural digests, role relationships, signatures, and live requirements.

Type selection uses access flags, sorted member shapes, inheritance, and
two rounds of referenced-type refinement. Names of all jar types and members
are removed from the keys. External library ABI names remain. Three tied
type shapes also need normalized class code traces: destination atom, engine
state, and transfer function. String contents,
debug data, constant-pool indices, and class/member enumeration order are
not selectors.

Member selection uses signature and access flags, normalized instructions,
numeric literals, and local field-use contexts. Bytecode control-flow and
use order are retained. These are executable relationships, not candidate
positions. The following cases need more than a local signature:

- Native value and boolean wrappers follow their abstract calls on the fixed
  decimal and boolean fixture types. Call depth is limited to two edges.
- The Grid membership getter must be referenced by the resolved insertion
  body. This separates two generated getters with equivalent local traces.
- The current document-edit getter must be referenced by edit association.
- Counters, replay flags, engine-state fields, and helper fields use their
  distinct normalized use traces. Their values are not read offline.

The resolver requires one candidate. It refuses zero or multiple candidates
and has no pinned-name or position fallback. A separate validation pass
checks each declaration, signature, inheritance relationship, operation
edge, and receiver role. `Svr` remains the project root; `cZl` remains the
edit document. A wrong receiver cannot pass by sharing a method signature.

The pinned names are confined to the manifest oracle module and test
comparison. The CLI imports the oracle only after discovery and validation
when `--verify-pinned` is requested. Selector derivation is a development
step, not a runtime fallback. A changed shape needs inspection and evidence;
a new build must not silently regenerate its expected selectors.

## Verification

The focused suite has 21 tests. Twenty fake-host tests cover missing and
ambiguous types/members, inherited methods, wrong receivers and returns,
static/instance mismatch, fabricated declarations, equivalent getters linked
to different operations, abstract dispatch, all-zero counter ambiguity,
inheritance cycles/depth, truncated input, and scan limits.

The integration test compares every member and type with the pinned oracle.
It then renames all 30,940 jar classes and all vendor member names in an
inert model, updates the code references, and reverses class, member, and
interface enumeration order. The same selectors recover every renamed role.
No vendor method is invoked. This is a full name-independence check on the
observed structure; it does not simulate a changed implementation.

Document link and diff checks pass. No Java or TypeScript runtime path has
changed, so their harness and live checks are not repeated. No archive is
built or deployed.

## Cost

The model was recorded in the performance ledger before implementation.
The retained [report](../data/phase9b-resolvers/report.json) comes from a fresh
CLI process after development scans. Jar SHA-256 is
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.

| Quantity | Result |
|---|---:|
| Compressed jar bytes | 34,686,665 |
| Entries / classes | 30,968 / 30,940 |
| Default-package classes | 24,240 |
| Fields and methods | 454,111 |
| Uncompressed class bytes | 69,199,765 |
| Fingerprint | 12.278 ms |
| Enumeration and metadata | 2,757.065 ms |
| Two type-refinement passes | 1,355.356 ms |
| Candidate search | 379.612 ms |
| Structural validation | 3.879 ms |
| Complete scan, including CLI overhead | 4,509.769 ms |
| Peak process RSS | 190,709,760 bytes; 181.875 MiB |
| Retained code classes / call-trace work | 126 / 48 |
| Bridge calls / native commands | 0 / 0 |

Input limits are 64 MiB compressed, 50,000 entries, 40,000 classes, 128 MiB
of class bytes, 1 MiB per class, and 1,000,000 members. Inheritance depth is
128. Code is retained for at most 256 classes. Call tracing has 4,096 work
units and depth two. The scan checks a 120-second deadline and a 768 MiB
process RSS threshold between bounded units. These are refusal thresholds,
not OS hard caps. A class parse or trace can allocate before the next check.

One metadata pass retains type/member summaries. Only needed code classes
are read again. Work includes per-class member sorting, two type-refinement
passes, indexed type search, and bounded member/use-trace checks. No host
thread pays this cost in the current implementation. The sample has no
comparable prior resolver measurement. It is not a cold-disk benchmark,
repeated-run latency bound, or regression claim. Live call budgets are
unchanged.

## Live requirements and limits

Every manifest live invariant is carried in the report. In 9b.5, validate
schema names/IDs and independent stored values first. Then test cable,
factory, lifecycle, attachment, undo, and delete on the admitted scratch
fixture. Validate counters last with the owned throwaway edit. Check helpers
with their initialization and use roles, not just non-null values. Read
existing selection and journal entries; do not create them during a guard.

Keep E307's project-root/edit-document distinction and E308's detached
identity scope. Attached objects use document IDs. Detached reads use
ownership-scoped IDs. No offline trace proves live ownership, disposal,
selection preservation, engine connection identity, DSP adoption, or audio.
The resolver cannot authorize a write; `writeAuthority` is always false.

Selectors depend on the observed structural implementation. A new method,
field, inheritance edge, bytecode change, or library ABI change can cause a
refusal even when a role still exists. String contents are deliberately
excluded, so this is not a complete semantic-equivalence check. The parser
supports the class forms observed here. Truncated data and unknown constant
tags or opcodes cause refusal. It is not a JVM bytecode verifier. Session 9b.6 must inspect any changed
structure and record a trace before updating a selector. Neither unchanged
names nor a structural pass replaces the explicit live doctor.

E310's resource loading, outer-modulator ownership, Gates attachment,
Sampler/Audio File, FX/Note writes, integer/indexed writes, and scale limits
remain. `llL` is resolved as a type only; no layout command is proved.

## Exit and next

The last live state is E310's state. It was not read again in this offline
session. V18 remains the last verified probe build; no replacement runs.
No claims transfer to 9b.5. Continue with the explicit
[9b.5 live doctor brief](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b5--live-doctor-on-606).
The 6.1.x operator update remains after the general feature audit.

## Retrospective

A signature does not distinguish generated wrappers or equivalent getters.
Future symbol manifests should state the fixed dispatch receiver and the
operation edge that proves the role. E311 adds these references to the
manifest and 9b.5 inputs. This prevents a shape-only selector from silently
choosing one of several equivalent candidates.

---
title: Grid and internal host access inputs
kind: note
state: active
updated: 2026-10-24
---

# Grid and internal host access inputs

Grid editing is an adjacent committed plan. Internal host access is also an
enabling method for possible non-Grid work. Keep the two scopes separate.

## Established facts

[E276](../../../evidence/experiments/e276-grid-semantic-read-and-value-probe.md)
proves scoped descriptor and semantic reads of a Poly Grid fixture. The saved
[schema capture](../../../evidence/data/phase9a-grid-read/live-04-grid-schema/capture-0.json)
contains numeric IDs and names, including `6428 → auxiliary_devices`.
Module instance UUIDs change on reload. Descriptor access does not provide a
complete device serializer or a universal field dictionary.

[E299](../../../evidence/experiments/e299-grid-spike-close-out.md) closes native
module/cable CRUD, value edits, persistence, and listening on the fixed
fixture. [E310](../../../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md)
extends the research to catalog, families, selected mappings, and a detached
stateful factory. [E342](../../../evidence/experiments/e342-grid-doctor-614-acceptance.md)
accepts the guarded doctor on 6.1.4; E316 covers 6.0.6.

[E343](../../../evidence/experiments/e343-grid-admission-gate-and-upgrade-tool.md)
adds the normal `check_grid_support` tool and exact-build admission. No normal
Grid write tool exists yet. The upgrade tool can refuse or request more input;
two accepted builds do not establish automatic future-build compatibility.

## Work records

| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |
|---|---|---|---|---|---|---|
| GI-1 | Product Grid reads, catalog, decimal/boolean values, cables, module add/delete, internal mapping add/remove | Planned | Phase 11 wave one; research proof on 6.1.4 | `grid.poly-graph` read, `grid.poly-graph` write, `grid.poly-graph` create, `grid.poly-graph` delete, `grid.poly-graph` persist | Phase 11 wave one; GridGraphRead; doctor roles | Normal-profile integration and the named remaining live checks. Every native symbol must be one of the 76 admitted doctor roles. |
| GI-2 | Relocation, integer/indexed values, FX/Note writes, stateful attachment | Planned | Phase 11 wave two; relocation needs a new setter | `grid.extended-writes` write, `grid.extended-writes` move-or-copy | Phase 11 wave two | New setters or symbols where required, a batched doctor version, and per-family write proof. Relocation is the first wave-two item. |
| GI-3 | Offline Grid preset generation and import | Candidate | — | `grid.offline-preset` create | bwpreset Patch, codec, typed ports, fragments | Define a deterministic graph representation. Prove file load, dependencies, values, cables, remotes, and persistence. Live editing does not produce this artifact automatically. |
| GI-4 | Broader descriptor access for non-Grid objects | Candidate | — | `host.descriptors` read | Existing Ghostnote read bridge and doctor; openwig patterns | Choose one object and operation. Establish exact-build identity, bounded traversal, names and IDs, coverage, and independent interpretation. Do not assume Grid admission covers Arranger or outer modulators. |
| GI-5 | Grid resources, array data, outer modulators, patches over 64 modules, DSP or audio guarantees | Unresolved | beyond the current Phase 11 plan | `grid.resources` write | Phase 11 limits; selected research reads | Each needs a separate scope and proof. A resource identity read is not a resource writer. No general sound-quality claim follows from graph readback. |
| GI-6 | DSP decompilation and modified-image deployment | Unresolved | source lead only; loader acceptance unproved | `dsp.image` write | Nitro tooling | Parsing and decompilation exist. Modified-image loader acceptance is unproved in the pinned source. This is not an inexpensive route to normal control breadth. |

Status, qualifier, and cell values come from [`data/records.json`](data/records.json); `data/check_records.py` verifies that this table agrees with it. IDs are navigation keys, not priorities. External implementations on these rows, with pinned paths, predicates, and counterexamples, are in the [external register](external-register.md#grid-and-internal-access).

## Phase 11 limits to preserve

The [Phase 11 plan](../../phase-11/README.md) is authoritative for its scope:

- Wave-one writes support Poly Grid. Reads cover Poly, FX, and Note Grid.
- At most 64 modules and 16 operations per write call. Detached ownership is
  bounded to 256 objects and depth 12.
- New placement must not move an existing module under the simulated layout
  pass. Default placement uses a free column.
- Mapping sources must belong to Grid members. An amount change removes
  and re-adds a mapping, which changes its identity.
- Module deletion has no product inverse in wave one. Other operations retain
  their stated inverse and fidelity limits.
- Every native write keeps the admission gate, lock, uncertainty latch,
  pre-command capture, and independent readback. An uncertain write is not
  repeated for recovery or timing.

## Sources and implications outside Grid

Use [GridGraphRead source](../../../../extension/src/main/java/com/ghostnote/extension/GridGraphRead.java)
through the [Phase 11 source route](../../phase-11/README.md), the
[symbol manifest](../../phase-9/9b-grid-symbol-manifest.md), and
[admission code](../../../../brain/src/grid/admission.ts). The existing pattern
can reduce discovery effort for GI-4. Its invariants still need proof on the
new object type.

bwpreset [builder](../../../../reference/bwpreset/bwpreset/build.py) and
[verification ledger](../../../../reference/bwpreset/docs/verification.md)
support GI-3. openwig [bridge](../../../../reference/openwig/src/openwig/controller/openwig_bridge.control.js)
supports internal-access investigation. The Grid implementation used inspected
host signatures and bytecode, not a copied GPL bridge
([E273](../../../evidence/experiments/e273-grid-descriptor-read-probe.md)).

For ordering, decide whether the user needs live patch editing, reusable
offline patch artifacts, or new non-Grid internals. They share some research
methods but have different output and maintenance contracts.

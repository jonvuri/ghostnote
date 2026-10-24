---
title: Modulation and preset inputs
kind: note
state: active
updated: 2026-10-24
---

# Modulation and preset inputs

User outcomes include adding movement to an existing sound, building a new
modulation structure, using more modulator types, and authoring reusable presets.

## Current boundary

The normal surface lists admitted modulator types, inspects a saved preset,
edits a copy and inserts it, and wraps an existing device for modulation.
Composition can include container or preset-local modulators. The existing
device wrapper preserves the moved device instance within its proved route.
These operations are not arbitrary modulator edits in place on every device.

Sources: [v53 descriptions](../../../evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json),
[bwmod source](../../../../brain/src/bwmod/),
[manifest](../../../../brain/assets/modulators/manifest.json),
[E96](../../../evidence/experiments/e96-grid-generalization-and-catalog-boundary.md),
and [E254](../../../evidence/experiments/e254-device-control-identity-and-route-claims.md).

The admitted catalog has 12 types: ADSR, Beat LFO, Classic LFO, Curves, LFO,
Ramp, Random, Segments, Vector-4, Vector-8, Vibrato, and XY. The E96 host
inventory has 43 types. The assets contain 46 donors for 42 curated types.
These are different denominators. The old host inventory is not a new census
of every 6.1.4 type.

E96's other refusals include missing exact pages, duplicate page families,
and external state. A successful load is not proof of the exact instance or
its behavior. Sampled presets additionally require measured reference-index
adjustments. [E330](../../../evidence/experiments/e330-update-audit-614-acceptance.md)
accepts selected Sampler Attack operations on 6.1.4; it does not revalidate
every donor. Removed Sampler targets are outside that preservation claim.

The normal path checks the authored route and target identity. It does not
sample sounding modulation on every call. D46 assigns that proof to a live
conformance suite. Public route editing covers target and amount, not named
enabled state, transfer modes, or scale-source selection.

## Work records

| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |
|---|---|---|---|---|---|---|
| MP-1 | Recursive object codec and serializer integration | Candidate | offline corpus proof: 24 byte-exact round trips, 46 donor parses | `preset.codec` read, `preset.codec` write | bwpreset codec | Preserve references, unknown supported fields, strings, metadata, and attachments. Bound bytes, collections, recursion, and objects. Compare real edits with goldens and the independent oracle before changing the live path. |
| MP-2 | Computed footprints and sampled-donor expansion | Candidate | six detached counts agree; Expressions counts 8 | `preset.footprints` write | Complete object graph from MP-1; measured donor manifest | Counts must be correct at the insertion boundary, with shared and external references. Test add, delete, and replace in complete sampled files and after save and reload. |
| MP-3 | Route enabled state | Candidate | — | `route.enabled` write | bwpreset make_routing and constants | Edit only the identified route. Prove enabled and disabled behavior at top level and inside containers, with checkpoint and reversal. |
| MP-4 | Named route modes | Candidate | seven noncontiguous mode codes | `route.mode` write | bwpreset noncontiguous mode constants and tests | Validate explicit names, not an integer interval. Prove each admitted mode independently and preserve unrelated route state. |
| MP-5 | Route scale-source selection | Candidate | — | `route.scale-source` write | bwpreset ownership and path rewriting | Identify output and owner, reject foreign or deleted sources, remap after reindexing, and prove live scale behavior. Enabled state alone does not establish this. |
| MP-6 | Decode app definitions and create donor-free modulators | Candidate | blocked extractor route: sYG.class absent on 6.1.4 (checked offline) | `modulator.donor-free` create | bwpreset encoding, definitions, and schema | Resolve the exact host build. Compare type IDs and defaults with known donors. Build one type, then prove page and instance identity, behavior, persistence, and removal. |
| MP-7 | Expand the admitted modulator catalog | Candidate | by refusal family | `modulator.breadth` create | E96 refusal families; MP-2 and MP-6 where relevant | Select a refusal family and solve its actual cause. A new count or generated object does not remove page, trigger, or payload gates. |
| MP-8 | Curves and envelope state | Candidate | — | `modulator.curves` write | bwpreset curves and state | Prove geometry, sustain, release, and loop markers, trigger behavior, preservation, and save and reload for each payload family. |
| MP-9 | Wavetable, sample-player, and multisample state | Candidate | — | `preset.resources` write | bwpreset assets | Prove resource identity, dependency metadata, zones, path resolution, opaque-state preservation, signal behavior, and persistence. |
| MP-10 | Track, device, and hardware source bindings | Candidate | — | `preset.bindings` write | bwpreset bindings | Preserve selector meaning. An unavailable track or hardware port must not silently bind another source. Verify project and hardware changes. |

Status, qualifier, and cell values come from [`data/records.json`](data/records.json); `data/check_records.py` verifies that this table agrees with it. IDs are navigation keys, not priorities. External implementations on these rows, with pinned paths, predicates, and counterexamples, are in the [external register](external-register.md#modulation-and-presets).

## Measured parser facts and their limits

The retained [offline result](../../../evidence/data/overlap-audit/offline-results.json)
and [check script](../../../evidence/data/overlap-audit/offline_checks.py) provide
the corpus and hashes. The checks were repeated during the current review:
24 byte-exact no-op round trips, 46 complete donor parses, and agreement with
all six non-null measured footprints. Four body fields use `0x02`.
No real `0x06` or `0x1a` field was established in this corpus.

The old Expressions donor has eight objects.
[E69](../../../evidence/experiments/e69-donor-scope-and-footprints-are-complete.md)
searched deltas 10–57, so
its range missed this value. A focused live test is justified; success is
not established. Preserve the other refusal reasons even if this count works.

The codec result does not depend on decoding `0004` definitions. Keep MP-1
and MP-6 separate. On installed 6.1.4, bwpreset's hardcoded
`com/bitwig/base/serial/file/sYG.class` is absent. A different extractor may
work, but none is established by this check. Keep keys and vendor definitions
local if that work is selected.

## Direct source locations

- bwpreset [codec](../../../../reference/bwpreset/bwpreset/codec.py),
  [graph](../../../../reference/bwpreset/bwpreset/graph.py),
  [model](../../../../reference/bwpreset/bwpreset/model.py), and
  [builder](../../../../reference/bwpreset/bwpreset/build.py).
- bwpreset [encoding](../../../../reference/bwpreset/bwpreset/encoding.py),
  [definitions](../../../../reference/bwpreset/bwpreset/definitions.py),
  [schema](../../../../reference/bwpreset/bwpreset/schema.py),
  [curves](../../../../reference/bwpreset/bwpreset/curves.py),
  [state](../../../../reference/bwpreset/bwpreset/state.py),
  [assets](../../../../reference/bwpreset/bwpreset/assets.py), and
  [bindings](../../../../reference/bwpreset/bwpreset/bindings.py).
- Its [verification ledger](../../../../reference/bwpreset/docs/verification.md)
  records selected Poly Grid results on 6.1.3. It also names pending live
  checks for assets, source bindings, slot devices, and other behavior.
- Ghostnote [donors](../../../../brain/src/bwmod/donors.ts),
  [stubs](../../../../brain/src/bwmod/stubs.ts), and
  [oracle tests](../../../../brain/src/bwmod/oracle.test.ts) are the integration
  boundary. The existing editor stays until equivalence is proved.

## Planning inputs

MP-1 is enabling infrastructure. MP-3 is a narrower visible feature. MP-7
should be judged by which missing modulators the user needs. MP-8 through
MP-10 are separate payload programs, not one general serializer checkbox.
An independent Python oracle is a useful first step; a runtime Python
dependency and a TypeScript port have different delivery costs.

[10a](../../phase-10/10a-bwmod-publication-review.md) excludes new editors and
requires a standalone package without Python at runtime. If implementation
and publication are both selected, decide their sequence explicitly.

---
title: Phase 8h — Cache promotion and interface simplification
kind: plan
state: planned
status: Promote only proved cache states and apply the 8a product reductions over the replacement route.
updated: 2026-10-05
parent: README.md
prev: 8g-shadow-project-cache.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E119-E135, E209, E213; D18, D23, D25
---

# Phase 8h — Cache promotion and interface simplification

## Accepted 8f3 inputs

Use the [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md),
[identity and overlays](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md),
[cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md), and
[migration and risk policy](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).
`read_launcher_clip` has single Launcher-clip scope. Its field coverage can be
complete for identities while articulation/repeat remain unknown. Partial-base
resolution, signed timbre conversion, raw disabled properties, and pressure/repeat
preservation need guarded host integration. Decisions D8/D16/D19/D21 contain
the target amendments; their live implementation gates still apply.

## 8g result

[E224](../../evidence/experiments/e224-final-shadow-acceptance.md) passes the
8g gate under D26–D28 and lists the supported states. Live eligibility is still
closed. A clip reference is an address token inside one identity domain; it is not
proof of the same host clip object.
Define promoted eligibility in those terms before stage 1. E224 also measured the
legacy E131 reconstruct path on a stable transpose. It enabled disabled chance,
occurrence, recurrence, and repeat controls on notes that the patch did not
mention, and it reset disabled recurrence values. Fix or refuse that path before
a stable write or preflight uses cache state.

## Session split

The replay cold read (E227, D30) changed the 8h route. A cold read takes
46–698 ms, so the replay reader replaces E131 on every read and write path. The
resident note cache has no speed role. The identity, generation, and
snapshot-validity machinery stays. The earlier 8h1 (cache promotion) and 8h2b
(exact reader consolidation) plans are replaced by 8h3c and 8h3e.

Complete research:

1. [8h1a — Cache limit knee sweep](8h1a-cache-limit-knee-sweep.md)
   ([E225](../../evidence/experiments/e225-cache-limit-knee-sweep.md)): width up
   to 4,194,304 steps; the clip limit is a sounding-cell budget.
2. [8h1b — Sounding-cell cost reduction](8h1b-sounding-cell-cost-reduction.md)
   ([E226](../../evidence/experiments/e226-sounding-cell-cost-reduction.md)):
   unsubscribe release and a sounding-cell budget; no coarse sentinel.
3. [8h2a — Replay cold read](8h2a-replay-cold-read.md)
   ([E227](../../evidence/experiments/e227-replay-cold-read.md), D30): one
   batch and a `clipExists` start signal in 160 of 160 binds; exact decode
   from callbacks only.
4. [8h3a — Cold-read dealbreaker check](8h3a-cold-read-dealbreaker-check.md)
   ([E228](../../evidence/experiments/e228-cold-read-dealbreaker-check.md)):
   bind from park, select the row before pointing, finish staged writes before
   binding, and keep a callback tripwire. Temporary selection changes are
   accepted for modal use, with full restore at close under the E99 lease.

Remaining sessions, in order:

1. [8h3b — Replay fetch cost](8h3b-replay-fetch-cost.md). Break down the
   bridge fetch cost and select the product fetch format.
2. [8h3c — Cold-reader promotion](8h3c-cold-reader-promotion.md). Replace E131
   for reads and writes, queue writes behind an open read, remove the `1/768`
   view, and fix or refuse the disabled-control loss.
3. [8h3d — Change awareness](8h3d-change-awareness.md). Select how Ghostnote
   tells whether a snapshot is current with no resident grid: pull, or pull
   with watched clips.
4. [8h3e — Cache machinery trim and promotion](8h3e-cache-machinery-trim.md).
   Keep identity, generations, and snapshot validity; retire the resident note
   grid.
5. 8h4 — interface simplification, naming, and device structure migration.

## Purpose

Make proved cache reads part of the live engine, connect the consolidated
compact-bar document, and simplify the agent surface according to the 8a
posture. Keep explicit fallback for states that the cache cannot cover.

## Document integration prerequisites

Use the [8f1 specification](../../../spec/ghostnote-document-v1/SPEC.md),
[8f2 codec and model reference](8f2-reference-codec-and-model-format-reference.md),
and [8f3 host and migration contracts](8f3-ghostnote-bindings-and-cache-contracts.md).
Prefer FIELDS for exact model note/rhythm reads and proposals. Use the shared
JSON-equivalent model near I/O; other internal types suit their domains.

Integrate complete documents, sparse patches, and optional overlays through
the reference codec. Apply normalization only at declared boundaries. Test
field preservation, source guards, overlay invalidation, and independent
normalized readback. Include the versioned model reference through the prompt
or skill entry point selected for the surface. The agent must not need a
repository tutorial.

## Promotion stages

1. Use healthy cache snapshots for experimental read-only compact documents.
2. Use them for repeated reads while retaining sampled authority comparisons.
3. Permit a fresh immutable healthy snapshot to serve an eligible write
   preflight only when the 8f risk policy allows it.
4. Share state with write preparation only when scope, generation, channels,
   metadata, defaults, and freshness all match.
5. Retire or demote the old route only after every retained fallback and
   diagnostic owner is explicit.

Each stage has its own feature flag or profile, comparison result, rollback to
the prior stage, and live acceptance gate. Do not promote all uses at once.

## Interface simplification

Apply the 8a disposition after the replacement path exists:

- merge tools that differ only by historical implementation seams;
- remove workflow wrappers that agent reasoning and small primitives replace;
- make reads return compact useful state instead of repeated internal evidence;
- make successful writes return concise effects and follow-up handles;
- keep detailed diagnostics for partial, ambiguous, or failed work;
- unify address, coverage, health, error, and change-reference conventions;
- reduce profiles and schema translations;
- keep computer-use seams explicit without wrapping focus-dependent actions;
  and
- retire experimental formats according to the 8f migration decision.

## Public naming migration

Apply the E135 Bitwig-aligned names:

- `check_connection` → `check_bitwig_connection`;
- `read_clip` and `acquire_clip_note_source` → the Launcher-clip read selected
  in 8f;
- `add_clip` → `add_launcher_clip`;
- `copy_clip_down` → `copy_launcher_clips`;
- `move_clip_block` → `move_launcher_clips`;
- `delete_clip` → `delete_launcher_clip`;
- `set_clip_launch` → `set_launcher_clip_launch_settings`;
- `set_clip_metadata` → `set_launcher_clip_properties`;
- `show_changed_clip` → `show_launcher_clip_in_detail_editor`;
- `add_track` → `add_instrument_tracks` while the operation creates only that
  track kind;
- `copy_track` → `duplicate_instrument_track` under current evidence;
- `inspect_device_parameters` and `set_parameter` → `read_device_controls` and
  `set_device_controls`; and
- `inspect_preset_modulation` and `author_modulators` →
  `read_preset_modulation` and `edit_preset_modulation`.

Keep `launch_clip`, `add_scenes`, `delete_scene`, `add_devices`, and
`set_device_enabled`. Use `scene` in titles and descriptions. Use `row` only in
addresses.

E16 proved track duplication only on an instrument track. It did not test an
audio track. Run focused live audio-track creation and Audio/Hybrid duplication
arms. Check fresh identity, type, content, routing, mixer state,
audibility, cost, and bounded readback. Use the broader `add_tracks` or
`duplicate_track` name only for the kinds that pass. Do not interpret the
current proof gap as a host refusal.

## Device structure migration

Apply the D18 amendment and E135 target:

1. Merge `inspect_devices` and `inspect_device_alternates` into `read_devices`.
2. Expose one `compose_devices` operation. Keep the offline preset composer as
   a private fast path. Use guarded staged operations for unsupported sources
   and shapes.
3. Replace alternate creation, fill, switch, remove, and keep operations with
   `duplicate_layer_chain`, `rename_layer_chain`, `move_devices`,
   `copy_devices`, and `set_layer_chain_solo`.
4. Give `set_layer_chain_solo` idempotent `exclusive`, `on`, and `off` modes.
5. Keep `delete_device` as a separate destructive operation.
6. Refuse typed deletion of one layer chain before a write. Direct the agent to
   computer control, then require a fresh `read_devices` result.
7. Remove the device-alternate observation event with the public observation
   workflow.

Document A/B audition and winner collapse as recipes over these elemental
operations. Do not add a special collapse operation unless dogfood shows that
agents cannot execute the guarded recipe reliably. Benchmark equivalent
two-chain and four-chain requests through both composition backends before the
offline fast path is retained on latency alone.

## Verification and reversal reductions

Implement the risk tiers selected by 8a and specified in 8f. Measure each
reduction against the prior route. Possible reductions include shared fresh
state, targeted readback, agent-visible confirmation through another sensor,
and optional directed reversal for low-risk observable edits.

Do not remove a guard or recovery path only because it is verbose. Name the
failure it covered, the replacement evidence, and the measured saved work.

## Acceptance criteria

- Cache authority is limited to explicit healthy and complete states.
- Every unhealthy, partial, or over-limit state takes the documented fallback
  or refuses clearly.
- Exact model note/rhythm I/O uses the selected FIELDS/JSON contract and
  reference codec. Complete documents, patches, and overlays pass its corpus.
- Field preservation and overlay lifecycle match 8f3 under accepted live edits.
- The model reference version matches the codec and examples. Timing is rational
  at the document boundary; conversion does not add normalization loss.
- Every retired tool, format, method, and check has a migration or explicit
  incompatibility record.
- Device A/B audition and collapse use the documented generic layer-chain
  operations. No managed device-alternate lifecycle remains in normal discovery.
- Equivalent two-chain and four-chain composition benchmarks state the selected
  backend boundary.
- Public clip operations name Launcher scope. Instrument-only track operations
  name that scope unless wider live proof passes.
- Destructive and ambiguous operations retain the selected stronger policy.
- Result size, tool calls, and wall time improve on representative workflows.
- The surface has one coherent address, health, result, and error vocabulary.
- Stable and experimental profile names state their actual compatibility.
- Focused checks, the complete brain check, extension tests, wire checks,
  context check, live comparisons, and `git diff --check` pass.

## Out of scope

- External publication.
- Breadth features unrelated to the selected agent-native core.
- Hiding a cache miss or computer-use action from the agent.

## Retrospective target

Record which simplification removed the most agent work and which retained
safeguard still costs the most. Use those facts in the 8i dogfood charter.

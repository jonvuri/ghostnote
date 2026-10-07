---
title: Phase 8h — Cache promotion and interface simplification
kind: plan
state: active
status: Reader promotion (E230), change awareness (E231), row binding (E232), and pull snapshot references with the cache machinery trim (E233) are complete. 8h4 is planned in six sessions (8h4a–8h4f); 8h4a is complete (E234).
updated: 2026-10-07
parent: README.md
prev: 8g-shadow-project-cache.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E119-E135, E209, E213, E230-E233; D18, D23, D25, D31, D32
---

# Phase 8h — Cache promotion and interface simplification

## Accepted 8f3 inputs

Use the [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md),
[identity and overlays](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md),
[pull snapshot contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md), and
[migration and risk policy](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).
`read_launcher_clip` has single Launcher-clip scope. Its field coverage can be
complete for identities while articulation/repeat remain unknown. Partial-base
resolution, signed timbre conversion, raw disabled properties, and pressure/repeat
preservation need guarded host integration. Decisions D8/D16/D19/D21 contain
the target amendments; their live implementation gates still apply.

## 8g result

[E224](../../evidence/experiments/e224-final-shadow-acceptance.md) passes the
8g gate under D26–D28 and lists the supported states. A clip reference is an address token inside one identity domain; it is not
proof of the same host clip object. D32 keeps that meaning. E224 also measured
the legacy E131 reconstruct path on a stable transpose. It enabled disabled
chance, occurrence, recurrence, and repeat controls on notes that the patch did
not mention. The 8h3c reader fixed this: raw disabled controls survive
reconstruction (E230).

## Session split

The replay cold read (E227, D30) changed the 8h route. A cold read takes
46–698 ms, so the replay reader replaces E131 on every read and write path. The
resident note cache has no speed role. Snapshot validity moved to the product
revision mark (D32); the resident-grid machinery is removed (E233). The
earlier 8h1 (cache promotion) and 8h2b (exact reader consolidation) plans are
replaced by 8h3c and 8h3e.

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

Reader promotion and remaining sessions, in order:

1. [8h3b — Replay fetch cost](8h3b-replay-fetch-cost.md). Complete
   ([E229](../../evidence/experiments/e229-replay-fetch-cost.md)): one
   `packedDict` page, encoded on the controller thread.
2. [8h3c — Cold-reader promotion](8h3c-cold-reader-promotion.md). Complete
   ([E230](../../evidence/experiments/e230-cold-reader-promotion.md)): product
   reads and mutation guards use one `1/512` source. Writes queue behind an
   open read. Raw disabled controls survive reconstruction. E131 is diagnostic only.
3. [8h3d — Change awareness](8h3d-change-awareness.md). Complete
   ([E231](../../evidence/experiments/e231-change-awareness.md)): pull only.
   Clip-level values report no note edit; watched clips save only latency.
4. [8h3c2 — Reader row binding](8h3c2-reader-row-binding.md). Complete
   ([E232](../../evidence/experiments/e232-reader-row-binding.md)): the open
   task subscribes before it unpins.
5. [8h3e — Cache machinery trim and promotion](8h3e-cache-machinery-trim.md).
   Complete ([E233](../../evidence/experiments/e233-pull-snapshot-references.md),
   [D32](../../decisions/d32-pull-snapshot-references-use-the-revision-mark.md)):
   pull snapshot references on the product revision mark, exposed in the
   experimental profile; the resident-grid research code is removed.
6. 8h4 — interface simplification, naming, device structure migration, and
   document integration, in six sessions. New tools go into the
   `agent-native-v1` profile; 8h4f makes it the default, and `stable-v1`
   stays frozen as the rollback through 8i.
   1. [8h4a — Write boundary and reader hardening](8h4a-write-boundary-and-reader-hardening.md):
      the scene guard at `batch.run`, the selection after a project switch,
      metadata in the `clip.read` reply, and the `group-slot` refusal (E222,
      E233). Complete (E234).
      - [8h4a2 — Collapsed-child reader routes](8h4a2-collapsed-child-reader-routes.md):
        a reader route for any row of a track inside a collapsed group
        (E221, E234). Complete (E240): no route passed the full matrix.
      - [8h4a3 — Expand-parent acceptance](8h4a3-expand-parent-acceptance.md):
        the reader expands collapsed parent groups for each read. Complete
        (E241, D34).
      - [8h4a4 — Cursor track identity](8h4a4-cursor-track-identity.md):
        cursor targets confirm by the track `channelId` (E240 defect).
        Complete (E242).
      - [8h4a5 — Collapsed-child cursor route and parameter settle](8h4a5-collapsed-cursor-and-parameter-settle.md):
        clip metadata and launch reads through `clip.read`, a cursor point
        route for collapsed children, and the DirectParameter settle on a
        same-type device (E242 limits). Complete (E243).
   2. [8h4b — Document read and identity registry](8h4b-document-read-and-identity-registry.md):
      the profile, the shared result vocabulary, `read_launcher_clip` on the
      D32 reference, and the clip and event ID registry. Complete (E235),
      except the 40 percent byte target; E235 names three format findings.
      - [8h4b2 — Document read compactness and gain correctness](8h4b2-document-read-compactness-and-gain.md):
        the gain mapping, neutral enable flags, the release velocity default,
        and other distractions, before 8h4c (E245).
   3. [8h4c — Document edit limb](8h4c-document-edit-limb.md):
      `edit_launcher_clip` for desired documents and sparse patches, through
      the host binding and `Authority`.
   4. [8h4d — Musical and clip surface migration](8h4d-musical-and-clip-surface-migration.md):
      observation decoupling and retirement, the old musical tools and the 7b
      profile retired, and the Launcher clip names.
   5. [8h4e0 — DirectParameter display probe](8h4e0-direct-parameter-display-probe.md):
      whether the display observer reports text when it is given the
      target's IDs, and at what cost (E244). Before 8h4e.
   6. [8h4e — Device structure migration](8h4e-device-structure-migration.md):
      `read_devices`, `compose_devices` with the backend benchmark, and the
      layer-chain limbs. It depends only on 8h4b.
   7. [8h4f — Tracks, profile cut, and 8h closeout](8h4f-tracks-profile-cut-and-closeout.md):
      the track-kind arms and names, the vocabulary on the retained tools,
      the default profile, the measurements, and the decision amendments.

## Purpose

Make fresh reads and D32 snapshot references the live engine path, connect
the consolidated compact-bar document, and simplify the agent surface
according to the 8a posture. Refuse explicitly when a reference is not current.

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

## Promotion stages: disposition

The five promotion stages of 8f3 assumed a resident cache. Their disposition:

1. Experimental read-only documents from healthy snapshots, and
2. repeated reads with sampled authority comparisons: met by 8h3c. Every read
   is the cold reader, and the paired E131 comparison passed (E230).
3. Eligible write preflight from a snapshot, and
4. shared state with write preparation: void. Every preflight is a fresh read.
5. Retire the old route: this is the 8h3e trim (E233).

The new guard has its flag (the experimental profile
`phase-7b-agent-note-patch-v0`), its comparison (the E233 live matrix against
independent raw reads), and its rollback (the stable profile, which does not
use it). Document integration is assigned to 8h4.

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

- Every read and preflight is a fresh read. A D32 reference that is not
  `current` refuses before a write.
- Every partial or over-limit read refuses clearly.
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

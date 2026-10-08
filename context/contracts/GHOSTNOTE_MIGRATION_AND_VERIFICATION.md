---
title: Ghostnote Document 1.0 migration and verification
kind: reference
state: active
updated: 2026-10-08
scope: 8f3 target contract; implementation gates for 8g, 8h, 8i, and 9b
---

# Migration and verification

This reference binds the [document specification](../../spec/ghostnote-document-v1/SPEC.md)
to the [interface audit](../evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md).
It defines the target for 8h. It does not change the current runtime, D9 encoder,
checkpoint fidelity, stored records, or frozen benchmark files. Use the
[host field binding](../../spec/ghostnote-document-v1/HOST-BINDING.md) and
[identity and overlay lifecycle](../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md)
for each field and identity rule.

## Public read scope

Use `read_launcher_clip` for one addressed Launcher clip. The request identifies
one durable track and one zero-based scene row under the current project and
structure guards. It does not address an Arranger clip. Return the selected
FIELDS document by default. JSON has the same represented meaning.

The read envelope carries target, source, authority, coverage, health, warnings,
and any follow-up handle. These facts are not hidden in a document extension.
The document carries portable clip/event references and represented coverage.
Distinguish empty, absent, unresolved, partial, unhealthy, and outside-limit.
Return diagnostic exact-source details only when requested or needed to explain
a failure. Do not label normalized data source-lossless.

Multiple reads are caller orchestration. A caller must check each read's
generation and coverage before combining results. This session does not select
a public batch read or an atomic multi-clip snapshot. `inspect_clip_block`
retires only after 8h supplies equivalent boundary occupancy through bounded
Launcher inventory data or guarded copy/move preflight. Repeated single reads
alone do not prove that boundary. 8h4d (E237) supplies it through the guarded
preflight: `copy_launcher_clips` and `move_launcher_clips` return the
occupancy of each slot that they read, also on a dry run and on a refusal.

## Risk and evidence consumers

All live writes validate inputs before a host call. Recheck target and generation
at the mutation boundary. A source/content hash does not prove target identity,
writable fidelity, ownership, or freshness. D15 independent evidence uses a
different handle or a handle after a re-point. A writer echo is insufficient.

| Class | Required freshness and conflict evidence | Verification and consumer | Reversal and retained failure boundary |
|---|---|---|---|
| T0 local conversion or analysis | Checked bytes/schema, source domain, settings, permission when required, and coverage | Codec or provider validates the full accepted input/output; return loss and authority | No host change or reversal record |
| T1 normalized live read | Current project generation, structure/address guards, settled declared coverage; end guard after multi-turn acquisition | Read sensor returns useful state, health, unknown fields, and D23 loss boundary; agent uses it as context | No stash or change ID; a selection lease can restore only a still-owned selection |
| T2 bounded scalar or ephemeral effect | Exact current route and generation; prior value for a durable reversible scalar; occupancy/options for launch | Target-bound proved callback or narrow independent read; write service compares the scalar; agent can add visual confirmation | Durable scalar retains prior state and a change ID. Launch/navigation/transport have no reversal record |
| T3 sparse note patch | Fresh affected source, current event map, complete preservation scope, content guard, collisions, defaults, writable fields, and D8 floor | Write service compares affected semantics independently. Targeted cells suffice only for a proved E128 insertion/removal. Replacement requires complete all-channel readback | Protect affected prior state and owned additions only on a proved targeted route. Otherwise retain D16 complete all-channel protection |
| T3 complete desired notes or clip properties | Fresh full represented base and fresh host state for all fields needed to reconstruct; metadata/range authority; exact protected prior state or required fidelity protection | Compare all 16 channels after reconstruction and changed metadata independently. Keep expected, observed, and differences separate | Keep complete clip protection for clear/replay. Pressure, unrepresentable source timing, and missing properties can force refusal or the existing explicit fidelity protection |
| T4 clip/track/device structure | Current source/destination inventory, capacity, occupancy, full relevant parent order, and structure revision at each dependent stage | Structure service re-resolves after each stage and independently proves the final structure; preserve the last proved continuation | Own only minted structure and proved current positions. Report lossy content and partial effects |
| T5 destructive or ambiguous change | Explicit user direction through a separate destructive tool; exact target/cascade and fresh current boundary. Ambiguity is a no-write refusal | Complete independent result within the available observable boundary; report removed identities and every known partial effect | Do not promise opaque-state reconstruction. An inverse is offered only when ownership and exact current boundary are proved |
| T6 computer-use change | Confirm visible target/focus; serialize with semantic writes; classify underlying effect under T2-T5 | Inspect visible completion, then reacquire structured state before the next semantic write | Ghostnote does not own the UI change. A later owned change starts at its newly acquired base |

Use preview for ambiguity, named loss that requires a choice, or requested
review. A clear lossless T2/T3 request can compile and guard in its apply call.
Refuse an unresolved target or unsupported field before mutation. After an
uncertain or partial effect, reconcile state; do not automatically repeat a write.
A later reversal checks its current owned boundary and reports every loss.

The complete candidate is required when the chosen host route clears and
reconstructs a clip. It protects unnamed fields, foreign channels, defaults,
and neighbour durations. An E128 targeted route can omit a complete replacement
candidate only if it proves cell ownership and excludes same-pitch collateral
changes. Independent post-write evidence detects silent host defaults, wrong
rows, lost properties, and truncation. A take stores observed state under D8.

## Pull snapshot authority

8h3e replaced conditional cache authority with pull snapshots
([D32](../decisions/d32-pull-snapshot-references-use-the-revision-mark.md)).
There is no resident cache. Every preflight is a fresh read through the 8h3c
cold reader, and every verification is an independent fresh read. A D32
snapshot reference guards an agent base: the revision mark, the durable
address, and the `ghostnote-launcher-source/1` digest. The executor checks it
at its stash read. Only a `current` verdict lets the write continue; every
other verdict refuses before a host mutation, and only `stale` returns the new
snapshot. The [pull snapshot contract](GHOSTNOTE_CACHE_CONTRACT.md) has the
verdict table and limits.

Preparation and preflight share one fresh read only inside one executor call.
The one exception is the targeted route of `edit_launcher_clip`: its fresh read
is also the executor stash read, and the executor judges the reference on it
again ([D38](../decisions/d38-a-shared-preflight-read-is-the-stash-only-on-the-targeted-route.md)).
The whole-clip route and a clip property change read again.
Whole-clip replacement still requires exact protection of the captured source.
Normalized agreement does not prove exact replay of sub-cell source values.
On a failed read, refuse with a reason. Keep post-write independent evidence.
The [verification ledger](../evidence/format/WORKSTATION_VERIFICATION.md)
records the existing costs and failures.

## Format disposition and value migration

Each adapter is a planned 8h boundary. Do not accept an old schema by changing
its header. New output passes the reference codec and the host binding checks.
Keep old source and new content digests in their own named domains.

| Existing form | Disposition | Mapping, preserved values, and incompatibilities |
|---|---|---|
| `ghostnote-exact-note-source-v0`, `exact-note-json-v0`, `exact-note-source-v0` digest | Retain internally and for diagnostics through promotion | Preserve captured host fields, original timing, actual revision/address guards, coverage, aliases, and permission. Project a new normalized snapshot with onset floor, nearest duration/ties up/minimum cell, separate deltas, channel +1, and new IDs under the identity rules. Legacy completeness is insufficient for the new field contract: disabled recurrence values were discarded, and repeat semantics differ. The exact-source digest cannot become an R27 content digest |
| `ghostnote-agent-context-v0`, `compact-bar-v0` | Migrate normal model I/O; retain frozen corpus | Resolve track aliases and source-scoped event IDs through the checked exact source. Map `atBeats`/`durationBeats`, pitch, velocity, mute, and supported articulation. Recover omitted channel, release, expression, recurrence, and clip metadata from fresh authority. Without that authority, emit explicit partial coverage or refuse replacement. A role/harmony label becomes a qualified overlay, not a note property |
| `groove-two-layer-v0`, `ghostnote-groove-context-v0` | Migrate interpretation to nominal/groove overlays | Reuse mapped core IDs. Map nominal position/duration/division; phase/template/cross/local, anchor, swing, shape, confidence, and provenance to R12-R16. Preserve reference identity as a template label. Calculate new dependency bases. Old deviation milliseconds are display data, not serialized timing. Recover source timing when proved; otherwise use unresolved unknown-source residuals and zero intentional terms. Do not claim old component intent as current when its source cannot be recovered |
| `ghostnote-note-patch-v0` | Migrate to sparse patches through a checked source map | Expand transpose into per-event pitch updates; move into onset update; delete into remove; insert into complete add. Keep source-ID guards and unnamed host properties. Resolve `track-neutral-v0` clip/channel only when unique; never guess from an empty track or several channels. Preserve its explicit insertion defaults through supported fields. Apply R07 once to old requested timing, report both deltas, and require acceptance when the resulting timing changes the request |
| `ghostnote-note-invariants-v0` | Retain as host validation options where useful | Preserve allowed target/operation, note-count, pitch-range, beat-range, required-ID, and unnamed-field constraints outside the portable patch. The old overlap-refusal constraint remains enforceable. It is not serialized as authority in an extension |
| `ghostnote-note-candidate-v0`, `note-compiler-v0`, preview and application result | Retain comparison implementation through 8h, then retire normal envelopes | Preserve complete candidate validation, host default checks, conflicts, independent observed state, partial effects, and change IDs in the new internal planner/results. A preview hash cannot substitute for the new document guard or a host read |
| `ghostnote-groove-patch-v0` | Retire normal discovery; retain probe evidence | Fixed-object E116 checks do not establish a general lowering compiler. Refuse it as a live edit request. A new groove edit must explicitly produce realized event updates and authorized overlay changes through the new guarded limb |
| `ghostnote-musical-patch` version 1 and its reports | Retain compatibility until 8h migration passes, then retire normal discovery | Materialize deterministic operations with their seed/scopes in the old pure planner. Translate the resulting state to the new document and preserve the operation's reported timing/velocity/removal/shortening loss. This is not a patch-schema alias. Old channel replace, overlap-shortening, random, and variation semantics remain on the old route until an explicit migrated request passes its guards |
| Observation JSON v1-v3 and five auto-capture call sites | Retain stored-record readers; retire public workflow after decoupling | Keep migration readers for existing projects. First remove automatic capture from generation, transformation, clip copy, track copy, and alternate creation. Storage failure must not change a successful project-write result. This session authorizes no record deletion. Done in `agent-native-v1` (8h4d, E237); see "Tool migration" |
| Workstation module envelopes, run records, provider probe envelopes | Retain internal optional plumbing and explicit evidence; retire normal envelope exposure | Keep request/source/provider correlation, permissions, coverage, formula identity, failure isolation, and verdict boundaries beside retained sensors. A provider judgment cannot become observed note state or an operator verdict |
| Reference-context, audio-facts-v0, audio-capture-v0, document cache/index | Retain optional or defer as the audit states | Keep their own byte/source/provider domains and coverage. No automatic conversion into the core note document. Capture stays a state-changing operation |
| Benchmark FIELDS/JSON/native formats, local labels, ballots, model results | Retain frozen evidence only | No schema retrofit or rescoring under this session. Keep corrected matrix and adjudicated addendum denominators separate. New 1.0 coverage/overlay rules have no historical provider-score claim |

Portable additions require explicit clip/channel and the host insertion policy.
The old low-level absent channel means host channel 0; migration writes portable
channel 1 explicitly. Convert snake-case release/expression names through the
field table. Preserve host gain in read units; apply the measured inverse only
in the existing encoder. Normalize host timbre -1..1 to portable 0..1 and
use the exact inverse at the binding boundary. Do not infer pressure writability from representation.
Unknown values remain unknown. A desired document replaces represented values;
a patch preserves unnamed values. These behaviors are not interchangeable.

Map old event `role` and `layer` to role/motif claims only when their meaning is
declared. Map meter, tempo points, harmony labels, and named regions to separate
overlays with their affected event/clip fields and membership dependencies.
Use recovered clip references, not track aliases as clip identity. Preserve old
permission, generator version, seed, and policy in source/provenance metadata.
The migration adapter supplies a versioned method identity because v0 provenance
did not require one. It does not upgrade declared or inferred data to measured.

For old note additions, copy the explicit `track-neutral-v0` release value
`64/127`, host timbre `0` as portable timbre `0.5`, enabled chance/occurrence,
and enabled recurrence `[1,1]`
into their supported portable fields. Portable defaults differ: release is
`0.5`, while playback conditions default to disabled. Host timbre centre maps
to the same portable default. A migration
must report any chosen default change. The channel comes from the unique old
source channel plus one. Full expression updates include every member; partial
object copies cannot silently reset unmentioned expression.

The local API contract exposes signed host repeat controls. Portable repeat
count means total triggers and portable velocity end is a normalized final control. There is no
proved equivalence. Retain raw repeat state internally, report portable repeat
as unavailable, and refuse reconstruction that would lose it. Portable recurrence
permits length 64; the host length limit is 8. Refuse larger writes. Preserve raw
disabled recurrence values through the new seam; the legacy decoder omitted
them. `track-neutral-v0` enables repeat with raw count zero and therefore cannot
be converted to the portable repeat default by a cast. 8h must explicitly select
and verify a supported insertion policy or refuse that migration.

## Tool migration

8h4d (E237) removes these `stable-v1` tools from `agent-native-v1`. `stable-v1`
keeps each tool with its frozen wording as the rollback through 8i. A client
on `agent-native-v1` that calls a removed name gets `no such tool`.

| Removed tool | Replacement in `agent-native-v1` | Incompatibility |
|---|---|---|
| `read_clip` | `read_launcher_clip` | A Document 1.0 snapshot of all 16 channels with a base ref, not one channel of raw notes. Channels are 1-based. An empty slot is occupancy `empty` |
| `acquire_clip_note_source` (7b profile) | `read_launcher_clip` | The 7b profile is retired. The exact source stays internal; `diagnostic` returns it on request |
| `check_clip_snapshots` (7b profile) | `check_launcher_clips` | Opaque base refs from the identity registry, not encoded D32 references |
| `generate_clip_music`, `transform_clip_music` | `edit_launcher_clip` | The agent owns generation and transformation and sends the result as a patch or desired document. Musical patch version 1, its seeds, variations, and overlap shortening stay on `stable-v1` (D21) |
| `write_notes` | `edit_launcher_clip` (patch `ADD`) | A guarded patch on a base ref; 1/512-beat cells; channels 1–16 |
| `erase_notes` | `edit_launcher_clip` (desired document without events) | A note pressure that a person set is lost on the whole-clip route and named in a warning (D37) |
| `inspect_clip_block` | `read_launcher_clip` and the occupancy of `copy_launcher_clips` and `move_launcher_clips` (`dryRun`) | Occupancy is reported for the rows that a copy or move names, not for an arbitrary range |
| `start_clip_music_operation` | `background: true` on `edit_launcher_clip` or `add_launcher_clip` (D39) | No generic start; the tool name keeps the permission |
| `inspect_clip_music_operation` | `inspect_operation` | Result envelope `ghostnote-operation/1` |
| `cancel_clip_music_operation` | `cancel_operation` | Same cooperative cancellation |
| `record_observation`, `read_observation_record`, `report_observations` | None | The observation workflow is retired from `agent-native-v1`; see the policy below |
| `add_clip` | `add_launcher_clip` | One clip from a desired document without BASE; two change records (creation, then content). A content refusal after creation returns the creation as an effect |
| `copy_clip_down` | `copy_launcher_clips` | Explicit source and destination pairs; the host copies only to the row below on the same track. Launch settings are a separate call (`set_launcher_clip_launch_settings`) |
| `move_clip_block` | `move_launcher_clips` | Same range and guards; failure codes and an occupancy report |
| `set_clip_launch` | `set_launcher_clip_launch_settings` | Every clip must exist (`absent`) |
| `set_clip_metadata` | `set_launcher_clip_properties` | Partial properties; omitted properties keep their value. The writer of `edit_launcher_clip` |
| `delete_clip` | `delete_launcher_clip` | A separate destructive name; an empty slot refuses |
| `show_changed_clip` | `show_launcher_clip_in_detail_editor` | Addressed by track ID and row, not by change ID |

`launch_clip`, `add_scenes`, and `delete_scene` keep their names on the shared
result module. `launch_clip` creates no change record (D19).

8h4e (E238) removes these device tools from `agent-native-v1`. `stable-v1`
keeps them with their frozen wording.

| Removed tool | Replacement in `agent-native-v1` | Incompatibility |
|---|---|---|
| `inspect_devices`, `inspect_device_alternates` | `read_devices` | One read envelope (`ghostnote-devices/1`) with the top-level order and the layer chains of each container at positions 0–2; `layer_chain` replaces `alternate`; no `exclusiveActive` or routing text |
| `inspect_device_parameters` | `read_device_controls` | Display text is part of the read (`displayComplete`); an empty plug-in list is standing `unavailable`; the route step is `layer-chain`, not `named-container-entry` |
| `set_parameter` | `set_device_controls` | Same cohorts, domain checks, selectors, and compact result; the route step is `layer-chain` |
| `inspect_preset_modulation` | `read_preset_modulation` | Same result |
| `author_modulators` | `edit_preset_modulation` | Same input and result; schema text names the new tools |
| `add_native_devices`, `add_device` | `add_devices` | One track for each call; explicit `kind` sources (native name, Bitwig UUID, VST3, CLAP, preset); the write envelope with one effect for each insertion |
| `compose_device_structure`, `compose_drum_machine`, `compose_device_sources` | `compose_devices` | One request shape (`containerKind`, named `layerChains` or `pads`); Ghostnote selects the offline, staged, or drum-machine backend; the write envelope with `next.revert` |
| `reverse_device_source_composition` | `revert_change` with the `compose_devices` change ID | No public checkpoint document |
| `create_device_alternates` | `compose_devices` or `duplicate_layer_chain` | No managed alternate object and no observation event |
| `fill_device_alternate` | `move_devices` or `copy_devices` | Generic routes; sources from the top level or one layer chain |
| `switch_device_alternate` | `set_layer_chain_solo` (`exclusive`) | Also `on` and `off`; idempotent (`already-set`) |
| `remove_device_alternate` | None (computer control) | Bitwig has no typed deletion of one layer chain; `delete_device` with `layerChain` refuses before a write |
| `keep_device_alternate` | The winner-collapse recipe | `move_devices`, `delete_device`, `move_devices`; not atomic; each step reads fresh structure |

`set_device_enabled` and `wrap_existing_device_modulation` keep their behavior;
their schema text names the new tools. `delete_device` returns the write
envelope with `removedLayerChains`. `revert_change` and `check_revert` add the
composition reversal.

8h4f (E239, D40) makes `agent-native-v1` the default server profile.
`GHOSTNOTE_TOOL_PROFILE=stable-v1` selects the frozen rollback through 8i,
with its 53 tools and its server instructions. Three stable tools take a new
name in `agent-native-v1`:

| Removed tool | Replacement in `agent-native-v1` | Incompatibility |
|---|---|---|
| `check_connection` | `check_bitwig_connection` | The read envelope (`ghostnote-connection/1`); `data.health` is `healthy` or `outside-limit`; a stale build or no open project is a failure with code `unhealthy` |
| `add_track` | `add_tracks` | `tracks: [{ name, kind }]` with `kind` `instrument` (default) or `audio` (E239); the write envelope with two effects (creation, naming) |
| `copy_track` | `duplicate_track` | Instrument, Audio, and Hybrid tracks (E239); other kinds refuse before a write (`unsupported`, `detail.reason` `track-kind`); no observation capture |

The retained tools keep their names and change their result shape:

| Tool | Change in `agent-native-v1` |
|---|---|
| `list_tracks`, `list_changes`, `check_revert`, `list_modulator_types` | The read envelope. A place uses `track`, `scene`, `launcher_clip`, `device`, or `device_control`, with 1-based note channels |
| `revert_change`, `rename_track`, `set_device_enabled`, `delete_track` | The write envelope. A reversal is one effect with `target.undoOf`; nothing to put back is `applied: false` with `readback.status` `nothing-to-revert` |
| `read_device_controls`, `set_device_controls`, `read_preset_modulation`, `edit_preset_modulation`, `wrap_existing_device_modulation`, `reverse_existing_device_modulation_wrap` | The measured body stays; `schema` is added, and a refusal, a standing that is not stable, an incomplete or partial write, or a throw after a write adds the `failure` object with each recorded change in `failure.effects` (D40) |
| `delete_device`, `move_devices` | A project device address is `devicePosition`, not `position`. `read_devices` and `add_devices` report `devicePosition` |

A failure code changes on every tool: an unresolved trackId is `absent`, not
`authority-unavailable`.

Observation compatibility policy: `agent-native-v1` captures nothing, so a
storage failure cannot change its write results. The stored-record readers for
observation JSON v1–v3 and the `observation.read` and `observation.replace`
wire methods stay for `stable-v1` and for old projects. No stored record is
deleted or rewritten. `stable-v1` keeps automatic capture and its frozen
behaviour, including the partial-success result after a storage failure.

## Decision amendments and gates

The decision files now record the following target amendments. Apply their
implementation gates before the corresponding 8h behavior change.
The binding corpus can establish pure rules. Live permission, timing, target,
readback, and reversal reductions still require the specified live evidence.

| Decision | Required amendment or retained boundary | Gate and evidence |
|---|---|---|
| D21 | Select one guarded document edit limb for the target surface. Keep v1 generation/transformation as compatibility. Limit overlap shortening to the old operation grammar; the document preserves overlap, and the host refuses an unrepresentable write | D25 and R04/R09 select the contract. 8f3 binding corpus and 8h compatibility/live corpus must pass before the tools migrate |
| D16a | Qualify the rejection of synthetic clip identity: an internal session reference is permitted as a revocable handle; it is not durable host identity or independent write authority | D32 snapshot references and the E233 verdict cases: reload, project change, and ambiguity refuse |
| D8 and D16e | Add the normalized public boundary separately from exact checkpoint protection. Permit targeted protection only for the proved E128 insertion/removal class; complete clear/replay retains all-channel protection | D23, R07, binding loss cases, 8g shadow equality, then 8h exact targeted inverse and concurrent-change refusal. Do not reduce reversal fidelity to normalized equality |
| D9 | Retain current encoder units, chooser, measured binary/triplet family, duration quantization, waits, and create/property staging | Document normalization is explicit at acquisition/import. Codec conversion never quantizes. No encoder amendment is needed to serialize or write represented 1/512 values |
| D15 | Retain independent evidence and validation before host calls | Every preflight is a fresh read (D32); nothing replaces independent post-write evidence |
| D23 and D25 | Retain one normalized cell plane, explicit sub-cell collision boundary, exact rational overlays, and one semantic model | Do not add a second acquisition grid or promise publication/source losslessness |
| D19 | Clarify no Ghostnote reversal ownership for reads, navigation, ephemeral effects, or UI actions | 8h result/ownership migration tests and 8i hybrid trials |

Public edit naming remains an 8h surface implementation detail under D21's
amended grain. It must retain separate destructive tool names. A portable clip
inventory cannot authorize container creation or removal through a benign edit.

## Migration order and rollback

1. Complete: 8g implemented the cache in shadow mode (E224). 8h3c replaced
   E131 with the cold reader (E230), and 8h3e removed the shadow cache (E233).
2. 8h adds codec I/O and the checked binding behind a separate profile/flag.
   Pass complete, sparse, default, partial, overlay, ambiguity, and migration
   fixtures before exposing the replacement.
3. Void: there is no resident cache to promote. Every read and preflight is a
   fresh read, and a D32 reference guards an agent base. 8h4 exposes it on the
   stable surface with its own comparison and live gate.
4. Meet the recorded decision gates before behavior changes. Remove auto-capture
   coupling before retiring observation workflow tools. Retain stored readers.
5. Migrate public names only after the replacement owns the required behavior.
   Measure the actual schemas and profile identity; do not edit frozen goldens.
6. 8i runs fresh bounded trials using the versioned model reference. Cover a
   complete desired state, a sparse edit, nominal/groove use, stale overlay,
   a stale snapshot reference, structure change, UI reacquisition, and a refusal.

Rollback disables only the failed promotion stage and selects the prior proved
read/write route. Invalidate incompatible snapshot references and proposal
handles; reacquire source before reapplying a request. Retain change records and owned
inverse data. Rolling back a profile does not undo project writes. Reconcile
partial effects and use guarded directed reversal when requested. Keep model
reference/codec/profile versions paired. No silent reinterpretation of old
hashes, IDs, defaults, or overlays is permitted.

## Publication candidates

The [candidate inventory](GHOSTNOTE_PUBLICATION_CANDIDATES.json) records exact
paths, versions, byte hashes, dependencies, and redistribution status. It is a
review inventory for [9b](../plan/phase-9/9b-compact-bar-publication-review.md),
not a release manifest. 8i adds live acceptance and known limits. 9b chooses
packaging, dependency notices, and public claims.

| Candidate family | Version/hash authority | Dependencies and remaining gate |
|---|---|---|
| Specification, field table, EBNF, schema, conformance inventory | Document 1.0; exact file hashes in candidate inventory | Keep R01-R32 and field defaults paired. 9b reviews release wording |
| Reference codec and CLI | Document 1.0, repository TypeScript source and lockfile hashes | Node/TypeScript toolchain; generated schema copy. Standalone consumer and codec corpus must pass; package/dependency notices need 9b review |
| Canonical examples and versioned corpus | Eight document semantic hashes in `examples/expected.json`; byte hashes in inventory | Codec-owned generated artifacts; generated MIT music. Keep semantic and byte domains separate |
| Model format reference and prompts | Version 1.0/reference revision 1; `MODEL-REFERENCE.identity.json` | Codec-generated examples and corpus prompts; include through the actual 8h prompt/skill entry point |
| Host binding, identity, cache, migration, and binding corpus | 8f3 contract revision; candidate file hashes | Host/API-qualified evidence; 8g/8h must prove live behavior before claiming integration |
| Product review and reproduction evidence | Frozen matrix/addendum paths and inventory hashes | README starting point; preserve denominators, provider manifests, scoring scripts, and known limits. Third-party payload redistribution needs explicit 9b review |

The repository license covers original software and documentation subject to
its notice. Generated fixture music states MIT provenance. Do not infer a
redistribution grant for vendor documentation, presets, provider responses, or
reference works from the repository license. Mark these items for 9b review.
No paid provider run or new token measurement is required in this session.

## Retrospective

Old groove records do not separate acquisition displacement from intentional
timing. Resolve their exact source before migration; otherwise use unresolved
residuals. This rule uses existing evidence and avoids a new live experiment.

Check the publication inventory with
`python3 -B context/contracts/check-publication-candidates.py` from the repository
root. After a reviewed source change, use `--write` to update its byte identities.
The inventory does not approve publication or third-party redistribution.

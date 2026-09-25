---
title: Agent-native product and interface audit
kind: reference
state: active
updated: 2026-09-25
scope: Phase 8 target posture and migration authority
---

# Agent-native product and interface audit

## Decision

Ghostnote is a set of semantic sensors and precise limbs for an agent that can
already reason, see, click, and type. It is not a second planner, task memory, or
complete workstation abstraction.

Keep a typed route when it gives the agent at least one measured advantage:

- state that vision cannot read completely or reliably;
- durable or guarded target identity;
- faster repeated access to structured state;
- precise bounded writes or repeatable multi-object edits;
- independent semantic readback; or
- owned reversal for effects that are difficult to correct manually.

Use computer control for visible discovery, audition, focus-dependent commands,
and ordinary UI work when a typed route gives no material advantage. After a UI
change, acquire new structured state before a semantic write. Do not claim the UI
change as a Ghostnote-owned reversible change.

The largest mismatch is the durable observation workflow. The agent already owns
the instruction, reasoning, and response in its conversation. The public
`record_observation`, `read_observation_record`, and `report_observations` tools
make it repeat that state in a second store. Retire these tools from the target
product surface. Keep experiment records as explicit local evidence artifacts.

The store is not isolated today. Five public tools automatically append a
confirmed use record after they write. Removing the two observation wire methods
before that coupling is removed can turn a successful project edit into an
observation failure result. Keep the methods until the automatic capture and old
project policy have an explicit migration.

Treat Instrument Layer and FX Layer chains as ordinary device structure, not as
a managed alternate lifecycle. Preserve A/B audition through generic layer-chain
limbs and an exclusive-solo recipe. Expose one `compose_devices` operation. Keep
the offline preset builder as a private fast path and use staged live operations
for broader source and routing shapes. E135 records the independent comparison,
and D18 owns the amended decision.

This audit changes no production behavior. `stable-v1` and the complete E131
reader remain the comparison authority until the Phase 8 promotion gates pass.

## Surface classes

| Class | Product rule | Computer-use boundary |
|---|---|---|
| Sensor | Return structured state, coverage, authority, and health. Do not return a workflow decision. | Use vision for layout and visible UI state. Use the sensor for hidden, dense, exact, or repeated state. |
| Limb | Apply one bounded, addressable intent. Return the effect and a follow-up handle. | Use clicking or typing when the target and result are clear and the typed route adds no precision. |
| Workflow | Keep only when ordered guards, opaque file work, or ownership cannot be reproduced safely from smaller limbs. | Agent reasoning chooses the workflow and interprets its result. |
| Diagnostic | Keep outside normal discovery unless it is required for connection health or an active fallback. | Diagnostics do not become product concepts. |
| Probe | Put in an explicit probe build or profile with its own handshake identity. | A probe result is evidence, not a product promise. |
| Historical compatibility | Freeze for migration or evidence. Do not allocate normal-runtime host objects for it. | Historical reach does not justify current product exposure. |

## Public tool disposition

The stable profile has 53 tools. The experimental 7b profile replaces one tool
definition and adds one read tool. Every tool is listed below.

`Retain` means that the capability remains. `Revise` means that the capability
remains under the shared target conventions. `Merge` removes a duplicate public
entry. `Retire` removes normal discovery after its migration gate. `Defer` keeps
the current boundary until named evidence exists.

| Current tool or tools | Class | Disposition | Target and reason |
|---|---|---|---|
| `check_connection` | Diagnostic | Revise | Rename to `check_bitwig_connection`. Keep one compact handshake and project-health result. It detects stale deployments and unavailable project state before work. |
| `list_tracks` | Sensor | Revise | Keep durable track IDs and window coverage. Use the common project address and read result. |
| `read_clip` | Sensor | Merge in 8h | Merge with `acquire_clip_note_source` through the consolidated compact read route. Keep the current route as the E131 comparison control until cache promotion. The target name is `read_launcher_clip` or `read_launcher_clips`; 8f selects single or bounded-batch scope. |
| `acquire_clip_note_source` | Sensor and diagnostic | Merge in 8h | Preserve the guarded exact source only in diagnostic detail. The normal result uses the D23 normalized document. The final public name must include `launcher_clip`; 8f selects request cardinality. |
| `inspect_devices`, `inspect_device_alternates` | Sensor | Merge in 8h | Use one `read_devices` sensor for complete top-level devices and addressed nested layer chains. Include ordered devices, chain solo and mixer state, capacity, coverage, and completeness. |
| `inspect_device_parameters` | Sensor | Revise | Rename to `read_device_controls`. It reads direct device parameters and Remote Controls, so each selector states which Bitwig object it addresses. Keep exact domains, automation, and modulation warnings. |
| `list_modulator_types` | Sensor | Retain | Vision cannot supply exact supported type identity, tier, or footprint standing. |
| `inspect_preset_modulation` | Sensor | Revise | Rename to `read_preset_modulation`. File fingerprints and semantic modulation topology are not visible in Bitwig. |
| `inspect_clip_block` | Sensor | Merge in 8h | Use the bounded clip read selected in 8f. Include requested rows and boundary occupancy. Do not make it a planning or preference authority. |
| `list_changes`, `check_revert`, `revert_change` | Sensor and limb | Retain | Change IDs, ownership, fidelity, and boundary checks prevent unsafe reversal. Use compact summaries by default and detailed diagnostics on request or failure. |
| `inspect_clip_music_operation`, `start_clip_music_operation`, `cancel_clip_music_operation` | Workflow | Merge | Use one generic operation handle only while an edit exceeds one request budget. Do not expose music-specific status machinery after the fast route is proved. Keep cancellation separate from read-only status if permission hosts require it. |
| `read_observation_record`, `report_observations`, `record_observation` | Workflow | Retire in 8h | They duplicate agent memory and add a second authority for intent and verdict. First remove automatic capture from the five coupled tools. Preserve stored v1-v3 migration readers for old projects until a separate removal gate. |
| `show_changed_clip` | Limb | Revise | Rename to `show_launcher_clip_in_detail_editor`. Name the visible Bitwig destination instead of Ghostnote provenance. E45 and E48 used this navigation after verified writes. It is not verification. |
| `generate_clip_music`, `transform_clip_music` | Workflow | Merge in 8h | Replace deterministic generation and transformation entry points with one guarded compact-document edit limb. The agent owns musical reasoning. Keep the v1 path as compatibility until the new corpus passes. |
| `copy_clip_down` | Limb | Revise | Generalize to `copy_launcher_clips` with explicit sources and destinations. Keep occupancy guards because E20b measured silent overwrite risk. |
| `set_clip_launch`, `set_clip_metadata` | Limb | Revise | Rename to `set_launcher_clip_launch_settings` and `set_launcher_clip_properties`. Loop, start, end, name, and colour are properties, not only metadata. Keep bounded exact readback. |
| `launch_clip` | Limb | Retain | Exact addressing and launch options improve on a click. Treat launch and transport state as ephemeral effects, not reversible project changes. |
| `move_clip_block` | Limb | Revise | Rename to `move_launcher_clips`. Put the contiguous range in the request instead of naming a non-Bitwig `block` object. Structural address re-resolution remains required. |
| `write_notes`, `erase_notes` | Limb | Merge in 8h | Move into the compact-document edit limb. Keep targeted insertion/removal ownership from E128 and whole-clip protection for replacement edits. |
| `add_clip` | Limb | Revise | Rename to `add_launcher_clip`. Keep explicit creation in an empty Launcher slot and accept the shared compact document instead of a second note-write shape. |
| `add_track` | Limb | Revise | Rename to `add_instrument_tracks` while the route creates only instrument tracks. Do not imply Audio, FX, Group, or Hybrid creation. |
| `copy_track` | Limb | Revise | Rename to `duplicate_instrument_track` under current evidence. E16 tested only instrument tracks. Audio duplication was not disproved. Broaden to `duplicate_track` only after live proof for each supported track kind. |
| `rename_track`, `add_scenes` | Limb | Retain | These typed operations are precise and repeatable. Use Bitwig's `scene` noun in titles and descriptions; keep row only as address data. |
| `author_modulators` | Workflow | Revise | Rename to `edit_preset_modulation` and pair it with `read_preset_modulation`. Tested file surgery, donor validation, relocation, and live readback cannot be reproduced safely through ordinary UI actions. |
| `compose_device_structure`, `compose_drum_machine`, `compose_device_sources` | Workflow | Merge in 8h | Use one source-explicit `compose_devices` family. Keep the validated offline preset composer as a private fast path and use guarded live stages for requests outside that path. Keep distinct routing modes in the request. |
| `wrap_existing_device_modulation`, `reverse_existing_device_modulation_wrap` | Workflow | Defer | Keep while it is the only guarded route that moves opaque existing device state and proves the continuation. Reassess after smaller composition limbs can preserve the same guards. |
| `reverse_device_source_composition` | Workflow | Merge | Make reversal use the returned composition change ID. Do not expose a second checkpoint document as public input. |
| `add_native_devices`, `add_device` | Limb | Merge | Use one `add_devices` tool with explicit native-name, native-ID, VST3, CLAP, or preset sources. Preserve exact-name diagnostics and source validation. |
| `set_parameter` | Limb | Revise | Rename to `set_device_controls`. It writes direct device parameters and Remote Controls. Keep cohort writes, discrete-domain checks, exact selector kinds, and target-bound readback. The compact E126 success result is the target result shape. |
| `set_device_enabled` | Limb | Revise | Keep this Bitwig-aligned name, bounded scalar route, and cohort readback. Share selectors and result vocabulary with `set_device_controls`. |
| `create_device_alternates` | Workflow | Retire in 8h | Layer chains are ordinary device structure, not a managed alternate object. Use `compose_devices` for a new structure or `duplicate_layer_chain` for an existing container. |
| `fill_device_alternate` | Limb | Merge in 8h | Split its useful behavior into generic `move_devices` and `copy_devices` limbs. Keep complete source and destination guards. |
| `switch_device_alternate` | Limb | Revise in 8h | Rename and generalize to `set_layer_chain_solo`. Use idempotent `exclusive`, `on`, and `off` modes. The current implementation proves only exclusive solo; 8h must add and verify the other two modes. |
| `remove_device_alternate`, `keep_device_alternate` | Destructive workflow | Retire in 8h | Replace winner collapse with guarded `move_devices`, `delete_device`, and position restoration. A typed single-chain delete is unavailable. Refuse that case before a write and direct the agent to computer use. |
| `delete_clip` | Destructive limb | Revise | Rename to `delete_launcher_clip` so destructive scope is explicit. Correct its stale description: E43 restores properties and launch settings, but not automation or play stop. |
| `delete_track`, `delete_scene`, `delete_device` | Destructive limb | Retain separately | Keep zero initiative, explicit target and cascade checks, independent readback, and no false reversal promise. |

This target has at most 42 normal tools before optional modules. Phase 8h must
measure the final count from the actual schemas. It must not merge a destructive
verb into a benign tool name.

### Device and layer-chain target

Use `container` for the parent device. Its `containerKind` makes Instrument
Layer and FX Layer explicit. Use `layer_chain` for one named parallel child.
Bare `chain` is too broad because Bitwig also has track device chains, fixed
nested chains, selector chains, drum chains, and a device named Chain.

| Target tool | Role | Required behavior and boundary |
|---|---|---|
| `read_devices` | Sensor | Read top-level devices and addressed layer chains. Return names, ordered nested devices, solo and mixer state, capacities, coverage, and completeness. |
| `compose_devices` | Workflow | Create complete supported containers from explicit sources. Select the private offline or staged backend without exposing two public composers. |
| `duplicate_layer_chain` | Limb | Copy one complete layer chain to a new unique name. Bitwig has no create-from-empty operation. State that no typed single-chain delete can reverse the copy. |
| `rename_layer_chain` | Limb | Give one uniquely addressed layer chain a durable name. Refuse blank, duplicate, or ambiguous names. |
| `move_devices` | Limb | Move ordered devices between the track and layer chains, between layer chains, and through the proved top-level positioning route. Refuse an unsupported or unprovable route before a write. |
| `copy_devices` | Limb | Copy devices into a layer chain or between proved layer-chain routes. Report new instance identity and possible engine load. |
| `set_layer_chain_solo` | Limb | Set `exclusive`, `on`, or `off`. The audition recipe uses `exclusive`. This is immediate and not beat-aligned. |
| `delete_device` | Destructive limb | Delete an emptied layer container after extraction. Keep the existing separate permission boundary and report every chain that remains inside the target. |

The A/B recipe is: compose or duplicate named layer chains, edit them with
ordinary device limbs, and set one chain to exclusive solo for each audition.
The collapse recipe is: read complete structure, move the winning devices to
the track, verify extraction, delete the container, restore the top-level
position, and verify again. These steps are not atomic. Each later step must use
fresh structure. Do not add a specialized collapse workflow unless dogfood
shows that agents cannot execute the guarded recipe reliably.

Removing one chain while retaining the container is outside the typed contract.
Bitwig's typed chain deletion routes refuse. Return a no-write refusal and tell
the agent to use computer control. A tool description can prescribe this
remediation without turning the UI action into an owned Ghostnote change.

The offline composition backend remains for more than compatibility. E18a
measured a filled four-chain preset insertion at 463-465 ms and a plain device
insertion at 469-500 ms in the same probe. The preset load therefore costs no
more than the first online device insertion. A four-entry staged request normally
adds container insertion, two chain-name passes, four source insertions, and
four relocations. The offline path also bootstraps an Instrument Layer, which
ships with no chain to duplicate, and authors supported native device-local
modulators that have no typed live creation route. It validates before one
project write and reverses by removing one owned container.

This is not an end-to-end latency comparison. Live verification can dominate
both paths. Phase 8h must benchmark equivalent two-chain and four-chain requests.
Keep the offline backend for requests it can represent safely. Use staged live
operations for VST3, CLAP, arbitrary presets, existing devices, multiple devices
per chain, and other unsupported shapes.

## Runtime, module, profile, and format disposition

| Surface | Current role | Disposition |
|---|---|---|
| Java extension and private JSON-RPC wire | Host observer and operation adapter | Retain a lean normal build. Move probe-only handlers and allocations to a distinct probe build in 8b. |
| `BitwigAdapter`, address and operation unions | Typed engine boundary | Retain. Reduce adapter method proliferation only behind the existing contract tests. |
| Executor, stash, change IDs, `Take`, `ApplyReport`, and `StashedChangeset` | Guarded apply, effects, ownership, and reversal | Retain as private authority. Apply the risk tiers below so low-risk operations do not copy unrelated state. |
| Selection borrowing and leases | Protect user UI state | Retain only for operations that borrow selection. E75 and E99 measured stale restoration risk. |
| Deterministic musical planner and `ghostnote-musical-patch` v1 | Full generation and transformation workflow | Freeze as compatibility, then retire from normal discovery when the compact edit corpus and migration pass in 8h. |
| Async music operation registry | Non-blocking long edits | Revise to a generic operation service. Retire music-specific public names if the promoted path fits one request budget. |
| Observation store v1-v3 and status reporting | Durable instruction and response workflow | Retire from the target public surface. Keep migration reads until old-project policy is explicit. Evaluate the small Bitwig status output separately from the durable store. |
| Device, modulation, composition, and alternate engines | Guarded topology and opaque file workflows | Retain composition and elemental layer engines. Keep alternate engines only as compatibility until 8h moves their useful primitives and removes automatic observation capture. |
| `bwmod`, donor, seed, and native catalogs | Internal binary and identity adapters | Retain below the public boundary. They are not agent-facing music formats. |
| Workstation module registry and request/response envelopes | Experimental provider isolation | Retain as internal optional-module plumbing. Do not expose registry envelopes to the agent. |
| Symbolic context module and `ghostnote-agent-context-v0` | Compact note view | Merge into the consolidated compact-bar read contract in 8f. Retire the separate module request from normal agent work. |
| Note compiler, `ghostnote-note-patch-v0`, candidate, invariants, and preview result | Guarded agent edit | Merge into the consolidated compact-bar patch. Keep the current compiler as a comparison implementation through 8h. |
| Reference-context module and comparison records | Permissioned reference evidence | Defer as an optional module. It is not part of the lean live core. The agent owns interpretation and selection. |
| Documentation provider and verified document cache | Exact-version offline retrieval | Defer to Phase 9 or an optional provider. It does not belong in the normal Bitwig runtime. |
| Audio facts module and `audio-facts-v0` | Verified file sensor | Retain as an optional sensor. It owns measurements, not aesthetic decisions. |
| Audio capture module and `audio-capture-v0` | Guarded project-master artifact creation | Revise and keep experimental. It mutates transport and files, so it is not a read-only sensor. More dogfood is required by E127. |
| Sensory packet v1 | Select and compare task facts | Retire as a separate reasoning layer after its compatibility checks move beside audio facts. The agent can compare the small typed facts. |
| Hybrid run record v0 | Experimental cross-module ledger | Retire from runtime. Keep explicit evidence artifacts for benchmark and dogfood runs. |
| `stable-v1` profile | Current public comparison surface | Freeze until 8h. Do not add Phase 8 experiments to it. |
| `phase-7b-agent-note-patch-v0` profile | E131 reader and guarded patch comparison | Retain unchanged through cache shadow and promotion. Retire only after its comparison owner is discharged. |
| Exact source and `ghostnote-clip-acquisition` result | Complete diagnostic state and experimental read wrapper | Keep exact source internal. Merge the acquisition result into common read conventions. Do not expose both as normal formats. |
| MCP JSON and tool descriptions | Agent-facing protocol | Retain. A profile name must identify schema compatibility, not an experiment date. |
| Observation JSON, hybrid records, probe JSON, ballots, and benchmark envelopes | Evidence and compatibility formats | Keep as historical or test artifacts. Do not use them as live state or write authority. |

### Phase 7 format families

The [Phase 7 inventory](WORKSTATION_INTERFACES.md) remains the detailed source,
owner, identity, unit, and failure record. Every I01-I24 family has this Phase 8
disposition:

| ID | Main format family | Phase 8 disposition |
|---|---|---|
| I01 | MCP tool inputs, results, descriptions, and profile identity | Retain MCP. Apply the target tool, result, and error vocabulary in 8h. |
| I02 | `BitwigAdapter`, `Address`, `Op`, and `ghostnote/0` | Retain as the private typed host contract. |
| I03 | Extension JSON-RPC frames, hello, event frames, and method golden | Retain as private transport. Split normal and probe identities in 8b. |
| I04 | `NoteRecord`, snapshot state, revision marks, and exact source | Retain as internal observed authority. Project only the D23 public document. |
| I05 | Takes, batches, apply reports, stashed changes, and summaries | Retain as private effect, ownership, and reversal authority. |
| I06 | Observation record JSON v1-v3 | Retire public workflow use. Keep explicit compatibility readers until old-project policy is complete. |
| I07 | Musical patch, planner, report, and result v1 | Freeze for compatibility, then merge into the consolidated compact patch and result. |
| I08 | Async operation handles and status | Revise to generic operation state. Do not expose process handles as portable IDs. |
| I09 | Semantic-analysis and provider probe envelopes | Keep fixtures and measurements. Retire the probe envelopes from product runtime. |
| I10 | Agent context, compact-bar v0, and groove-context v0 | Merge into the consolidated compact document. Keep old corpora as comparison fixtures. |
| I11 | Note patch v0, invariants, candidate, compiler, and application result | Merge into the consolidated compact patch. Keep the compiler as a comparison implementation through 8h. |
| I12 | Groove patch v0 | Defer until a real edit task requires it. Do not expose the fixed probe object as a product contract. |
| I13 | Reference context, coverage, comparison, and probe profiles | Keep as an optional module. It is outside the lean live core. |
| I14 | Sensory request and packet formats | Retire the separate router. Move required compatibility gates beside the retained typed facts. |
| I15 | Saved-project, capture-source, capture-request, and audio-capture v0 | Keep experimental and optional. Revise after more capture dogfood. |
| I16 | Audio artifact, verified artifact, audio fact, and audio-facts v0 | Retain as an optional sensor with exact byte identity and coverage. |
| I17 | Documentation cache manifests and verified source wrappers | Defer to an optional provider or Phase 9. Keep exact-byte validation. |
| I18 | Documentation request, result, and disposable index v0 | Defer with I17. Do not start or allocate it in normal live runtime. |
| I19 | Native catalog and resolution schema | Retain internally for exact device-source identity. |
| I20 | Donor manifest, modulator objects, and footprint records | Retain internally for guarded authoring. Do not expose binary records to the agent. |
| I21 | Composition, seed, and legacy alternate asset manifests | Retain composition and seed assets internally. Keep legacy alternate assets only through the 8h compatibility migration. Asset identity is not observed live state. |
| I22 | `.bwpreset` bytes and `bwmod` structures | Retain internally under the existing host-qualified scope. |
| I23 | Eval responses, ballots, model records, and benchmark summaries | Keep as evidence only. They cannot authorize writes or supply operator verdicts. |
| I24 | Workstation module envelopes and hybrid run records | Keep module envelopes as internal optional plumbing. Keep run records as explicit evidence artifacts, not runtime workflow state. |

The 8f contract can replace the current agent-facing musical formats only after
it has a versioned grammar, loss model, and conformance corpus.

## Wire disposition

The deployed extension registers 157 methods at hash `905bc2531512025b`.
The product wire map can emit 90. The remaining 67 are not product-reachable.

### Product-reachable methods

| Family | Methods | Phase 8 disposition |
|---|---|---|
| Core | `contract.hello`, `host.info`, `ping`, `rig.info`, `rig.methods`, `rig.scanTracks`, `rig.stats`, `revision.get`, `batch.run`, `notify` | Retain. Split deployment health from historical scale fields when 8b can do so compatibly. |
| Tracks and scenes | `branch.duplicateTrack`, `track.create`, `track.delete`, `track.list`, `track.resolveByChannelId`, `track.setName`, `scene.count`, `scene.create`, `scene.delete` | Retain for typed project structure. |
| Clips and selection | `clip.create`, `slot.delete`, `slot.duplicateClip`, `slot.launchWithOptions`, `slot.moveTo`, `slot.playState`, `slot.select`, `slot.status`, `selection.status` | Retain while the current tools own them. Reconcile method owners after the 8h tool merge. |
| Clip cursor and notes | `cursor.clearNote`, `cursor.clearNotes`, `cursor.clipMetadata`, `cursor.getNotes`, `cursor.getNotesVerbose`, `cursor.getNotesVerboseAllChannels`, `cursor.launchSettings`, `cursor.pin`, `cursor.pinTrack`, `cursor.playState`, `cursor.pointTrack`, `cursor.scrollToStep`, `cursor.setClipMetadata`, `cursor.setLaunchSettings`, `cursor.setNoteProps`, `cursor.setNotes`, `cursor.setStepSize`, `cursor.status`, `note.observer.arm`, `note.observer.prepare`, `note.observer.read` | Retain the complete E131 path through promotion. Later remove only methods with no cache fallback, writer, settlement, or regression owner. |
| Devices and chains | `chain.activate`, `chain.duplicate`, `chain.inventory`, `chain.move`, `chain.select`, `chain.setName`, `devcursor.pin`, `devcursor.selectAt`, `devcursor.selectFirstInPad`, `devcursor.selectFirstInSlot`, `devcursor.selectInLayer`, `devcursor.selectInSlot`, `devcursor.selectParent`, `devcursor.status`, `device.delete`, `device.insertBitwig`, `device.insertClap`, `device.insertFile`, `device.insertVst3`, `device.list`, `device.moveTo`, `device.setEnabled`, `drumpad.insertDevice`, `drumpad.list`, `layer.list` | Retain while the guarded device engines use them. Public tool merges do not imply wire removal. |
| Controls | `directparam.completion`, `directparam.list`, `directparam.set`, `param.list`, `param.set`, `remote.list`, `remote.set` | Retain. These supply hidden selectors, domains, settlement, and exact scalar readback. |
| Human surface | `navigation.showChangedClip`, `status.push` | Retain navigation. Measure whether the small status field still has a human owner before 8h removes or revises it. |
| Observation storage | `observation.read`, `observation.replace` | Keep until automatic capture is removed from `generate_clip_music`, `transform_clip_music`, `copy_clip_down`, `copy_track`, and `create_device_alternates`, and the compatibility policy is complete. Do not add new product use. |
| Optional capture | `masterRecorder.start`, `masterRecorder.status`, `masterRecorder.stop`, `transport.status`, `transport.stop` | Move to an optional capture runtime if 8b can isolate its host objects. Keep exact handshake identity. |

### Non-product methods

| Owner | Methods | Disposition |
|---|---|---|
| D13 live regressions | `app.actions`, `app.invokeAction`, `app.redo`, `app.undo`, `app.undoState`, `branch.groupTrack` | Keep unreachable. Prefer a probe-only build, but amend D13 before removing them from the normal registry. |
| Phase 8 cache and API probes | `api.runtimeMethods`, `stepdata.observer.prepare`, `stepdata.observer.read`, `stepdata.observer.enrich` | Keep in the explicit probe build through 8g. E130, E131, and E134 own them. |
| Historical app and branch probes | `app.selectionNotifications`, `branch.contentFilter`, `branch.createParentTrack`, `branch.mixer`, `branch.moveTrack`, `branch.setMixer`, `branch.vu` | Retire from the normal build in 8b after object-allocation mapping. Preserve source evidence. |
| Historical selector and cursor probes | `chainselector.set`, `chainselector.status`, `cursor.duplicateContent`, `cursor.moveNote`, `cursor.pointToClipOf`, `cursor.setAndReadNote`, `devcursor.selectFirstInKeyPad`, `devcursor.selectFirstInLayer`, `devcursor.selectInChannel` | Retire from the normal build. Keep only a named active regression in the probe build. |
| Historical device and drum probes | `device.duplicate`, `device.insertFileAt`, `device.moveIntoSlot`, `device.nesting`, `device.selectInEditor`, `drumpad.duplicate` | Retire from the normal build. The product has guarded replacements or no product owner. |
| Historical harness methods | `echo`, `equals.status`, `equals.tryCreate`, `revision.bump` | Retire from the normal build. Core hello, ping, and guarded revision reads remain. |
| Historical layer probes | `layer.copyDeviceInto`, `layer.delete`, `layer.deleteViaAction`, `layer.deleteViaHost`, `layer.duplicate`, `layer.duplicateChannel`, `layer.duplicateViaAction`, `layer.duplicateViaHost`, `layer.insertAtStart`, `layer.insertDevice`, `layer.insertFile`, `layer.insertRelative`, `layer.insertViaCursor`, `layer.moveDeviceInto`, `layer.pasteInto`, `layer.pointCursor`, `layer.select`, `layer.selectLegacy`, `layer.selectionState`, `layer.setMixer`, `layer.setName`, `layer.soloToggle` | Retire from the normal build. Keep source probes as historical evidence unless a current regression names one. |
| Historical control probes | `param.modulated`, `param.touch`, `remote.selectPage`, `remote.setMapping` | Retire from the normal build. Current complete inventories and writes use other methods. |
| Historical clip, track, and transport probes | `slot.duplicateObject`, `slot.epoch`, `slot.launch`, `track.deleteViaAction`, `transport.play` | Retire from the normal build. Keep the addressed product routes. |

The normal build target is not a preset method count. It is the selected
product and optional-module methods with no unowned allocation. The probe build
must have a different handshake identity. Historical method lists remain in
evidence and must not be confused with an active golden.

## Risk-tiered verification and reversal

| Tier | Examples | Minimum target and conflict check | Result and readback | Ownership and reversal |
|---|---|---|---|---|
| T0 local read | Parse a supplied file, search verified docs, analyze verified audio | Verify schema, bytes, source digest, provider, settings, permission, and requested coverage. No live target check. | Return data, coverage, authority, warnings, and unavailable fields. | No change ID or reversal. |
| T1 live read | Tracks, clip music, device order, parameters | Resolve durable identity where available. Check bank coverage, generation, structural epochs, and project detector. Restore only a valid selection lease. | Return the smallest useful state plus coverage and health. Recheck the guard at the end of a multi-turn acquisition. | No ownership or reversal. |
| T2 observable scalar or ephemeral action | One parameter, bypass, launch, layer-chain solo | Check exact route, generation, chain name, and current value when the write is durable. A launch checks occupancy and options. | Use target-bound callback or narrow independent readback. A visible UI state can supplement, not replace, semantic state. | Record a durable scalar change when prior state is known. Ephemeral launch and transport actions have no reversal record. |
| T3 bounded content edit | Note insert/remove, metadata, compact patch | Check the complete affected source or a fresh immutable healthy cache snapshot, revision, address, writable fidelity, collisions, and bounds. | Read back the affected semantic scope. Use targeted cells for E128-safe insertion/removal. Use complete channels for replacement edits. | Record exact affected prior state and owned additions. Offer targeted reversal while the boundary matches. Preview is required only for ambiguity, named loss, or a user-requested review. |
| T4 structural edit | Clip move/copy, track copy, device insertion, guarded composition | Check source and destination inventories, capacity, occupancy, complete parent order, and structure revision at each dependent stage. Re-resolve positional addresses after each structure change. | Return ordered stage effects. Independently read the final structure and preserve a proved continuation after a partial stage. | Record mint ownership and current proved position. Reverse only owned structure under complete current guards. Name fidelity loss. |
| T5 destructive or opaque edit | Delete a track, scene, existing device, or populated layer container | Require explicit user direction through a separate destructive tool name. Enumerate the exact target and cascade. Check identity, current structure, and conflicts immediately before execution. | Return removed identities, complete readback, and all partial effects. A refusal writes nothing. | Never promise reconstruction of opaque state. Reversal exists only for an exact owned object and is then ordinary T3 or T4 reversal. |
| T6 external UI action | Consolidate, audition, focus-dependent editing | Classify the underlying effect as T2-T5. Confirm the visible target and focus before the action. Announce the computer-control seam. | Inspect visible completion, then reacquire structured state before later semantic work. | Ghostnote does not own or reverse the UI action. A later owned write starts from the new acquired state. |

### Measured reasons for retained safeguards

- Durable identity, pin confirmation, and bounded retries prevent wrong clip and
  track targets. E28-E38 and E45 measured delayed or misdirected cursor behavior.
- Independent complete readback caught a wrong launcher row in E45 and host note
  defaults in E121. Keep it for T3 replacement edits.
- Complete all-channel protection prevents a clear or same-pitch truncation from
  hiding collateral note loss under D16 and E8.
- Exact control domains prevent unrepresentable parameter values. E80 measured a
  binary control that accepted an invalid intermediate request and read back 0.
- Byte identity and before-and-after file checks prevent source substitution.
  E124 and E125 proved these checks on supplied and captured audio.
- Capacity checks prevent a full observer bank from being mistaken for complete
  structure. E73 found this equality blind spot at four layer entries.
- Structure inventories and address re-resolution prevent stale positions. E59
  measured device relocation, and E134 measured stale scene indices after
  compaction.
- Selection leases prevent an old restore from overwriting a later user choice.
  E75 and E99 measured this boundary.
- Separate destructive names are the permission boundary. E20c measured that the
  host grants permission by tool name and can ignore annotations.
- Owned reversal remains strong for bounded writes because Bitwig undo is not an
  agent transaction. D8, D16, and D19 record the measured fidelity limits.
- Current-state ownership checks prevent cleanup from deleting later work. E128
  proved targeted insertion ownership, and E129 withheld setup reversal after a
  newer UI consolidation.
- The E129 consolidation refusal stays. It prevented a write against incompatible
  coordinates and provided one actionable UI remediation.
- The complete E131 reader stays as the comparison path because E131 found that
  sparse settlement was slower and D23 accepts a different normalized identity.

### Approved reduction direction

- Do not require mutation-free preview for a clear T2 write or an explicit,
  lossless T3 insertion. Compile and guard inside the apply call.
- Do not scan unrelated project state for a scoped write.
- Share one immutable healthy snapshot between planning and preflight only after
  shadow comparison proves freshness and scope. Independent post-write evidence
  remains.
- Return detailed receipts from change lookup and on partial or failed work. A
  normal success returns target, effect, change ID, fidelity, and compact readback.
- Do not create reversal records for reads, navigation, launch, transport, or
  external UI actions.
- Do not retain provider routers whose only work is a comparison that the agent
  can perform over a small typed result.

## Target interface conventions

### Vocabulary

- Use `read` for one addressed semantic document and `list` for bounded
  inventories. Use `add`, `copy`, `move`, `set`, `delete`, and `revert` for limbs.
- Use one noun for the same object across tools. Use `launcher_clip`, `scene`,
  `track`, `device`, `container`, `layer_chain`, `device_control`, `change`, and
  `operation`. Within an already addressed container, a `chains` field can omit
  the `layer_` prefix. Do not call a Launcher clip only `clip` when an Arranger
  clip could also satisfy that noun.
- Do not expose implementation names such as cursor, observer, stash, take,
  compiler, or module in normal agent results.
- Keep destructive verbs in separate tool names. Do not widen a previously
  allowed benign name.

### Addresses and pagination

- A track address uses durable `trackId`. A launcher address adds zero-based
  `row` plus its structural epoch. A device address adds an ordered route with
  explicit layer-chain, pad, or slot steps and a current position guard.
- Results echo one canonical `target` object. Do not repeat track and device
  identity in every child receipt.
- A paged result uses an opaque continuation bound to one source revision and
  coverage scope. A changed revision invalidates the continuation. Do not use a
  mutable bank index as a page identity.

### Read, write, and error results

- A read returns `schema`, `source`, `target`, `coverage`, `authority`, `data`,
  `warnings`, and optional diagnostic `timing`.
- A successful write returns `schema`, `applied`, `effects`, compact `readback`,
  and `next`. Each durable effect has a `changeId`, target, summary, and fidelity.
- A partial or failed write returns all known effects plus `failure.code`,
  `failure.stage`, `failure.effects`, a concise message, and `retryWhen` when a
  safe retry condition exists.
- Use stable machine codes. Preserve the underlying adapter error in diagnostic
  detail. Do not make agents parse JavaScript or Java exception text.
- `empty`, `unavailable`, `partial`, `unhealthy`, and `outside-limit` are distinct.
  Never return an empty collection for an unresolved target.

## Baselines and targets

The table uses recorded workloads. `Not recorded` is an explicit measurement
gap. Nested spans are not added.

| Workflow and evidence | Wall time | Calls and host work | Bytes or tokens | Intervention and caught failure |
|---|---:|---|---|---|
| Current stable MCP discovery | Not recorded | One in-memory `tools/list`; no Bitwig calls | 53 tool objects; 159,464 serialized bytes; tokens not recorded | No intervention. This measures the tool array without a transport envelope. |
| Four-beat complete clip context, E120 | 2,321.882 ms acquisition; 18.285 ms cold and 0.775 ms warm module request | Three bulk pages and one reset; one live module request | Exact source 2,287 bytes; compact text 775 bytes | No operator action. Missing Music21 degraded only theory. |
| 16-note target and reference patch, E121 | 3,920.729 ms target read; 3,875.596 ms reference read; 16,044.461 ms apply | Five batches, 80 bulk reads, 100 scrolls, 46 clip pins, 46 track pins, 184 slot-status reads, 22 revision reads, and 21 selection reads across the retained run | Result bytes and agent tokens not recorded | Operator audition and acceptance. Readback caught wrong host defaults in the first fixture run. Off-grid duration refused before write. |
| Hybrid audio-guided parameter A/B, E127 | Captures 4,500.277 and 4,551.056 ms; total run wall time not recorded | Ten stable tool operations, two change IDs, two captures, and separate analysis calls | Run and evidence JSON retain full records; prompt tokens not recorded | One source choice and one A/B verdict. Compatibility checks found unequal recorder coverage and forced a common range. |
| Played-range consolidation, E129 | Per-call and total timing not recorded | Exact refusal, one computer-control consolidation, fresh acquisition, two previews, one apply, independent acquisition, reversal, and scoped cleanup are recorded; exact call count is not recorded | Result bytes and tokens not recorded | Computer control performed Consolidate. The range guard blocked an unsafe write; timing fidelity blocked the first transpose. |
| Second long-clip dogfood, E48 | 60,630 ms post-key subtotal | One track copy, one two-clip creation, one background edit, polling, and two independent reads | Not recorded | Operator audition. No mismatch or refusal. |
| Repeat drum dogfood, E80 | 5:39 to audition; 99.5 s recorded Ghostnote call time | 52 Ghostnote calls, seven local discovery calls, and two web searches | Not recorded | Five catalog refusals cost 19.9 s. A parameter-domain gap and redundant workflow discovery caused retries. |
| Parameter success result, E126 | Wall time not isolated | One 27-setting cohort | 5,924 bytes before; 3,181 after | No intervention. Detailed receipts remain available after success. |
| Symbolic prompt, E114 | Model times are not a format baseline | Model round trips belong to the experiment, not the live reader | Bar text 7,158 bytes versus 24,425 bytes exact JSON; model inputs 3,828 and 4,625 tokens | Two models completed guarded tasks. |
| Routed sensory prompt, E118 | Model times are not a provider baseline | Model round trips belong to the experiment | 38,195 routed bytes versus 84,373 raw bytes; 10,254 versus 13,002 input tokens | Routing kept silence and compatibility gates. |

Phase 8 uses these measurable goals:

1. A healthy warm cached clip read must reduce the E131 empty-clip acquisition
   wall time by at least 90 percent, with the same declared D23 coverage. The
   2,418.774 ms E131 result makes the initial median target at most 242 ms. The
   end-to-end p95 must not exceed 500 ms on the E134 workstation.
2. A common guarded note insertion must need at most one read and one edit tool
   call before optional audition or reversal. No mandatory preview call is
   allowed when the edit is lossless and unambiguous.
3. A guarded note apply over an already healthy fresh snapshot must reduce the
   E121 16,044.461 ms apply time by at least the eliminated fresh-preflight cost,
   while it keeps independent post-write readback. Target at most 8,000 ms on
   the same workload before 8i.
4. The consolidated compact document must stay at or below 40 percent of the
   equivalent exact JSON bytes on the fixed 8c corpus. Report tokens for each
   evaluated model separately.
5. The normal public tool count must fall from 53 to at most 42. Optional and
   diagnostic profiles report their own added count.
6. A 27-control success must not exceed the E126 3,181-byte result unless new
   required evidence explains the increase.
7. Phase 8i dogfood must record agent tool calls, computer-control actions,
   host calls, result bytes, input tokens, operator interventions, and failures
   caught by verification. Do not leave the E129 measurement gaps open.

## Ordered migration

### 8b

1. Create distinct normal and probe extension identities.
2. Remove the 57 historical non-product methods and their unowned host objects
   from the normal build after allocation mapping.
3. Keep the four cache/API probe methods in the probe build.
4. Keep D13's six regression methods registered and unreachable until D13 is
   amended. Do not silently reinterpret that decision.
5. Isolate optional capture allocations where the build boundary permits it.
6. Correct the stale `delete_clip` description without changing its behavior.
7. Keep observation storage in the normal build until automatic capture has a
   migration. Do not let telemetry failure change a successful write result.
8. Update stale method-count comments and active goldens.

### 8h

1. Promote only healthy cache reads under the 8d-8g gates.
2. Merge `read_clip` and `acquire_clip_note_source`. Use
   `read_launcher_clip` or `read_launcher_clips`, as selected in 8f.
3. Merge musical generation, transformation, and low-level note writes into one
   compact-document edit limb.
4. Apply the T0-T6 result and verification rules.
5. Merge duplicated device insertion and composition tools. Keep the offline
   preset composer as a private fast path behind `compose_devices`.
6. Replace the device-alternate lifecycle with `read_devices`, generic
   layer-chain limbs, generic device move and copy limbs, and the documented A/B
   and collapse recipes. Keep `delete_device` separate. Refuse typed single-chain
   deletion and direct the agent to computer use.
7. Remove observation workflow tools from normal discovery and publish the
   compatibility policy for stored records.
8. Apply the Bitwig-aligned public names recorded in E135. Keep
   `duplicate_instrument_track` unless live evidence proves more track kinds.
9. Retire the Phase 7b profile only after all comparison and fallback owners are
   discharged.

## Decisions and references to revise

| Authority | Required change | Evidence before change |
|---|---|---|
| D13 | Permit banned regression methods in a probe build instead of every normal build. Keep them unreachable in all product encoders. | 8b must prove separate handshake identity, runnable regressions, and no forbidden method in either build. |
| D8 and D16 | Add the D23 normalized public boundary and risk-tiered targeted protection. Keep exact replay rules for whole-clip replacement. | 8f grammar and loss corpus; 8g shadow comparison; E128-style targeted inverse tests; live reversal with concurrent-change refusal. |
| D18 | Implement the 2026-09-25 amendment. Retire the managed device-alternate lifecycle and observation event. Keep ordinary layer-chain structure, exact solo control, and guarded composition. | E17, E18a-h, E34, E63, E80, E127, and E135 establish the useful primitives, typed deletion boundary, dogfood use, and newer ordinary A/B route. |
| D19 | State that reads, ephemeral actions, and external UI actions have no Ghostnote reversal record. Keep owned reversal for durable bounded effects. | 8h result migration tests and 8i dogfood must show no lost durable effect or false ownership. |
| D21 | Replace separate deterministic generation and transformation grain with one compact-document edit limb. | 8c fixed benchmark, 8f conformance corpus, compatibility fixtures for v1 patches, and live 8h readback. |
| `PROJECT.md` | Describe Ghostnote as sensors and limbs, not a complete typed workstation. | Update after 8h implements the selected surface. |
| `WORKSTATION_CONTRACTS.md`, `WORKSTATION_INTERFACES.md`, and `WORKSTATION_VERIFICATION.md` | Mark Phase 7 module formats as retained, optional, merged, or historical under this audit. Remove stale method counts. | 8b owns runtime counts. 8f owns final format contracts. 8h owns public result migration. |
| `CONSOLIDATED_COMPACT_BAR.md` | Become the one public music document and patch contract. Keep cache records separate. | 8c benchmark and 8f grammar, loss, and conformance acceptance. |

D4 needs no amendment. The direct MCP-to-extension topology still fits the
selected posture. D20 remains unchanged: destructive names stay separate. D23
remains unchanged: the public normalized route uses one `1/512` identity plane,
while the complete E131 reader stays a diagnostic comparison until promotion.

## Retrospective

The current architecture stores the agent's instruction and verdict twice: once
in the conversation and once in the observation workflow. Remove that duplicate
authority. The independent 8a runs also both assumed that managed device
alternates would survive. The follow-up review showed that ordinary layer chains
plus generic limbs preserve the useful A/B behavior with less lifecycle state.
Keep structured state, bounded actions, measured guards, and owned reversal. Do
not treat `WIRE_METHODS_USED` as the normal-runtime owner list; it also includes
optional capture and coupled observation storage.

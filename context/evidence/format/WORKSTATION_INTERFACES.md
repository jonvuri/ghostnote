---
title: Workstation interface inventory
kind: reference
state: active
updated: 2026-09-23
scope: Formats that can cross a planned Phase 7 boundary
---

# Workstation interface inventory

This inventory applies the [shared contract fields](WORKSTATION_CONTRACTS.md).
The IDs below are audit references, not runtime schemas. Each row covers the
listed formats as one family only when they share an owner and boundary.
The [seam map](WORKSTATION_SEAMS.md) names the required translation or blocker.

`Retain` keeps a distinct boundary. `Revise` needs a named wrapper or version
before Phase 7 use. `Merge` removes duplicate authority through a named
projection. `Retire` excludes a format from the Phase 7 surface; it does not
delete historical code or evidence. Internal formats without a schema number
are checkout-bound and must not be advertised as a versioned external API.

I01 uses MCP JSON over stdio. I02, I04, I05 and planner records in I07 are typed
in-process values; their serializable artifacts keep contract tags. I03 alone
uses the extension TCP wire. I05's stash and I08's operation handles live in the
session. I06 stores its JSON string in Bitwig's project document setting through
the existing observation adapter. These storage lifetimes are not interchangeable.

I09–I14 use probe JSON, typed objects or rendered agent text as listed below.
I15–I18 use local artifacts/manifests and the disposable documentation index.
I19–I22 use repository/local JSON and binary assets. I23 uses temporary experiment
files plus retained evidence. Planned I24 discovery is in-process/MCP; worker
messages use the owning module's versioned JSON protocol, and the run record is
explicit local JSON. None of these files is a hidden shared source of live state.

## Ownership, form, and disposition

| ID | Formats, current version, and source | Owner; producer → consumer; authority | Decision and stability |
|---|---|---|---|
| I01 | MCP JSON inputs/results and tool descriptions; server `0.0.1`, description cohort `ghostnote-description-v22`; [tools](../../../brain/src/surface/tools.ts), [cohort](../../../brain/src/surface/description-cohort.ts), [server](../../../brain/src/mcp-server.ts) | Surface; host agent ↔ workspace; permissions and requested operations | Retain stable surface. Revise only the explicit experimental registration profile. Server package version alone does not identify the tool schema. |
| I02 | `BitwigAdapter`, `Address`, `Op`, `AdapterInfo`; `ghostnote/0`; [contract](../../../brain/src/contract/adapter.ts) | Contract/adapter; engine ↔ fake or live adapter; addressed operations and capability checks | Retain exact-equality contract. Add typed capture support in 7e with an explicit compatibility decision. |
| I03 | JSON-RPC 2.0 newline TCP frames, hello, revision/content events; method golden and `methodsHash`; [wire map](../../../brain/src/adapters/live/wiremap.ts), [bridge](../../../extension/src/main/java/com/ghostnote/extension/Bridge.java) | Live adapter/extension; encoder ↔ handlers; transport only | Retain private transport. Retire unused probe runtime only in 8b. Golden method names do not prove payload compatibility. |
| I04 | `NoteRecord`, `StateValue`, `Snapshot`, `RevisionMark`, `BatchReceipt`; `ghostnote/0`; [state](../../../brain/src/contract/state.ts), [snapshot](../../../brain/src/contract/snapshot.ts) | Adapter; host/fake reads → engine/stash/compiler; observed state and guards | Retain complete host state. The 7a `ghostnote-exact-note-source-v0` wrapper now serves symbolic consumers. Snapshot semantics are unchanged. |
| I05 | `Take` and nested snapshots tagged `ghostnote/0`; `ApplyReport`, `StashedChangeset`, `BoundaryCheck`, change summaries are checkout types; [take](../../../brain/src/engine/take.ts), [record](../../../brain/src/stash/record.ts) | Engine/stash; recorded apply/readback → reversal/report; owned effects and restoration boundary | Retain private change authority. New module results reference change IDs, not copied mutable changesets. |
| I06 | Observation JSON v3; reads v1/v2 through explicit migration; [record](../../../brain/src/observation/record.ts), [store](../../../brain/src/observation/store.ts) | Observation store; workspace/operator response → reports; durable use and explicit response history | Retain existing migrations. Add an experimental run record for cross-module evidence; do not overload aesthetic or legacy verdict meanings. |
| I07 | `ghostnote-musical-patch` v1, `ghostnote-musical-report` v1, materialized/compiled planner records, `ghostnote-musical-result` v1; [patch](../../../brain/src/musical/patch.ts), [surface](../../../brain/src/surface/musical.ts) | Musical planner; deterministic request → candidate/typed ops → agent report; requested transformations and declared loss | Retain D21 grammar and result. Share complete-candidate execution with I11, not request syntax. |
| I08 | Async operation handle/status/cancel records; checkout-bound; [operations](../../../brain/src/surface/operations.ts) | Workspace operation registry; tool → background operation → status consumer; progress and effects references | Retain. Completion is not aesthetic acceptance. Never serialize live process handles as portable source IDs. |
| I09 | E109 semantic JSON `ghostnote-semantic-analysis-v0`, E110 provider records, E114–E118 synthetic exact-note/cohort JSON and hashes; [semantic probe](../../../brain/src/probes/phase6e-semantic-analysis.py), [symbolic probe](../../../brain/src/probes/phase6f-symbolic-representation.py) | Probe harness; generated/live cohort → provider/comparison; measured experiment input/output | Merge source identity into I04's exact-source wrapper and measurements into the shared evidence fields. Retire probe envelopes from product boundaries; preserve fixtures. |
| I10 | `ghostnote-agent-context-v0`, `compact-bar-v0`, `groove-two-layer-v0`, `ghostnote-groove-context-v0`; strict TS objects and rendered text; [module](../../../brain/src/musical/agent-context.ts), [corpus](../../../brain/src/musical/agent-context-corpus.ts) | Symbolic context; exact source/qualified annotations → host agent; compact observation view | Retain frozen v0 grammar and corpus. The 7a `symbolic-context-v0` result adds external source, provider, coverage and authority metadata. E116 standalone probe groove JSON is translated, not accepted as this object. |
| I11 | `ghostnote-note-patch-v0` JSON; [probe validator/compiler](../../../brain/src/probes/phase6f-symbolic-representation.py) | Exact compiler; host proposal → complete candidate; edit intent only | Retain body for the initial four operations. Revise consumer validation and source wrapper before product use. No live consumer exists yet. |
| I12 | `ghostnote-groove-patch-v0`; E116 fixed expected JSON; [groove probe](../../../brain/src/probes/phase6f2-groove.py) | Groove planner candidate; host proposal → probe comparison; nominal/component intent | Merge into a future version of I11 when needed. Exclude from initial 7b. Fixed-object validation does not establish a general compiler. |
| I13 | E117 extracted reference dicts, raw/mixed context, `reference_coverage`, trait/copy reports; probe eval v0; [reference probe](../../../brain/src/probes/phase6g-reference-transfer.py) | Symbolic/reference module; permitted reference → agent view and independent comparisons; reference evidence | Revise to `reference-context-v0` profile. Reuse I10 raw views and shared measurement fields. Do not invent a second note language. |
| I14 | `ghostnote-sensory-packet-v0`, routed A/B fields and deltas; [packet probe](../../../brain/src/probes/phase6h-sensory-packets.py), [v1 router](../../../brain/src/audio/sensory-packet.ts) | Task router; typed MIDI/audio facts → host agent; decision evidence only | The 7d audio route implements the v1 projection. It retains paired facts, deltas, tolerance and limits. MIDI routing remains conditional on a selected task. |
| I15 | E103 `RecorderStatus`, `FileState`, `AudioFacts`, timing JSON; unversioned probe types; [capture probe](../../../brain/src/probes/phase6a-master-recorder.ts) | Capture module; recorder/directory snapshot → verified local artifact; exact file association | Revise to `audio-capture-v0` result and shared artifact fields. Remove embedded mean/peak analysis from capture authority. |
| I16 | E105 manifest schema 1, typed audio result dicts, E118 FFmpeg fact records, WAV/diagnostic files; [audio probe](../../../brain/src/probes/phase6c-audio-analysis.py), [7d module](../../../brain/src/audio/audio-facts.ts) | Audio providers; verified bytes → facts/estimates or diagnostic image; measured signal evidence | The 7d `audio-facts-v0` result merges source, provider, formula, coverage and tolerance. It retains only selected E118 fields. Images remain diagnostics and are not result facts. |
| I17 | Official document requests/cache manifest `schemaVersion: 1`; [cache library](../../../brain/src/probes/phase6b-document-cache-lib.ts), [source wrapper](../../../brain/src/documentation/documentation-provider.ts) | Documentation cache; installed/downloaded bytes → verified source family; source identity/compatibility | Retain v1 downloaded manifest semantics. The 7c installed-tree wrapper and source-set digest add common provenance. No automatic schema migration. |
| I18 | `ghostnote-documentation-request-v0`, `documentation-v0`, and disposable `ghostnote-documentation-index-v0`; [provider](../../../brain/src/documentation/documentation-provider.ts) | Documentation retrieval; verified sources → bounded cited matches; evidence selection | Retain the experimental 7c result. Tie each index to source, extractor, provider, SQLite and tokenizer identity. LSA is not in the product route. |
| I19 | Native catalog/resolution JSON schema 1; [catalog](../../../brain/src/native-catalog/catalog.ts) | Native catalog; installed presets and resolved IDs → supported insertion; installed native identity | Retain. Catalog identity is not workflow documentation or parameter-state evidence. |
| I20 | Donor manifest schema 1, raw modulator objects, witness/footprint records; [donors](../../../brain/src/bwmod/donors.ts), [manifest](../../../brain/assets/modulators/manifest.json) | bwmod donor catalog; human-saved sources → authoring compiler; supported donor bytes and measured footprint | Retain current asset contract. Cross-module export needs an explicit hash/provenance wrapper; do not claim the current manifest hashes each donor. |
| I21 | Composition manifests schema 1, owned layer/FX seeds, device-alternate assets; [assets](../../../brain/src/composition/assets.ts), [alternate assets](../../../brain/src/device-alternates/assets.ts) | Composition/alternate engine; owned preset assets → checked composition; seed identity and bounded topology | Retain separate seed roles. Do not merge a seed manifest with an observed live device state. |
| I22 | `.bwpreset` META/CONT bytes, bwmod parsed structures and source-composition requests; host-format qualified, parser checkout-bound; [spec](BWFORMAT_SPEC.md), [design](BWMOD_DESIGN.md) | bwmod/Bitwig adapter; file bytes → parser/composer → guarded load/readback; byte structure within supported scope | Retain existing supported route. No new vendor-preset loader; D22 remains. Saved bytes do not prove unsaved live state. |
| I23 | Eval/response/ballot-key/summary schemas from 6d–6h, including sensory/reference response v0; probe files | Experiment runner/operator; responses and blind artifacts → frozen evidence; benchmark and explicit verdict | Retire from product imports. Retain evidence/reproduction sources. Models cannot fill the operator-verdict record. |
| I24 | Module descriptor `ghostnote-workstation-module-v0`, correlated request/result, experimental run record | Module coordinator; configured modules ↔ host/run log; discovery, correlation, and run provenance | The 7a registry implements lazy discovery, deadlines and correlation. The 7c documentation module adds source-set correlation. The 7d audio module adds separate executable discovery and exact source correlation. The composed run record remains 7f work. |

## Identity, coverage, units, and failure semantics

This table completes the per-interface inventory. `Shared` refers to the named
fields and rules in the contract reference, not an assumption that existing
formats already contain them. The cited code remains authoritative for existing
field names. A missing field below is a Phase 7 adapter requirement.

| ID | Identity, provenance, and coverage | Units, defaults, and loss | Failure behavior |
|---|---|---|---|
| I01 | Tool name, frozen description/schema profile, explicit target; read wrappers add source/provider/coverage | Existing tool units/defaults remain; experimental fields explicit | Schema and permission-class refusal before dispatch; preserve reported partial effects |
| I02 | Durable track ID, structured address, revision/generation/epochs, host/API/extension version, bank limits | Beats-native; per-op grid; typed property scales; no guessed target | Exact handshake, address, coverage, or revision failure blocks affected live work |
| I03 | JSON-RPC request ID plus hello contract/method hash; event sequence and generation where supplied | Encoder alone translates beats to steps and gain scale; frames have no musical defaults | Transport/remote errors retain request correlation; timeout after a write is not proof of no effect |
| I04 | Complete addressed state and captured mark; source wrapper hashes canonical state and declares each channel | Host numbers and every observed optional field; missing read is never an empty channel | Refuse incomplete/coarse/unknown reads; fidelity labels limit replay; unknown project identity cannot be repaired by name |
| I05 | Change ID, sequence, source take, before/after snapshots, target scope, fidelity and boundary evidence | Exact observed state; no inverse-operation guesses; losses/unrestored fields explicit | Partial apply remains recorded; unknown ownership or changed boundary refuses reversal |
| I06 | Root/instruction/change references and schema; coverage is recorded use only | Explicit verdict values; legacy migration preserves meaning; no implicit acceptance | Unsupported/corrupt schema fails as observation failure without hiding a completed project write |
| I07 | Patch targets, preflight mark, seed/scopes, report/result version and corpus fingerprint | Beats; deterministic seed; channel-0 compatibility only on old low-level path; named loss and overlap policy | Schema/grid/range/collision/protection refusal; expose disagreements and partial writes |
| I08 | Operation ID, owning workspace, progress, change IDs and terminal state | Durations/timing fields keep stated units; cancellation may follow partial effects | Unknown handle refuses; cancelled/failed is not rolled back by definition |
| I09 | Each probe's own canonical hash, provider version and declared cohort coverage | Rational/float and hash rules differ by probe; inferred labels separated; defaults cannot cross silently | Probe validity is not product conformance; adapter rejects unrecognized domain or omitted state |
| I10 | Exact source hash, permission, track/event scope, omitted fields; wrapper adds provider/annotation provenance and alias map | Reduced beats; tempo-qualified ms; compact omits host fields; groove shares event IDs | Strict parser rejects inconsistent links/time/coverage; missing intent abstains; no reconstruct-from-text write |
| I11 | `base_sha256`, opaque IDs, complete source map, declared invariants | Rational beats; explicit insertion policy; preserve all unnamed host fields | Refuse stale IDs, unsupported operations/properties, ambiguous channels, sequential conflicts, or candidate loss |
| I12 | Source/context hashes, timing references, event IDs, generator/version/seed/policy | Nominal/realized rational beats and components; no inferred intent default | Initial Phase 7 refuses this schema; future lowering must prove component preservation |
| I13 | Separate seed/reference IDs, permission, source/used coverage, formula and provider | Extracted traits by default; raw excerpt bounded; copying and trait metrics separate | Missing permission or exact coverage blocks reference use; missing measurement stays unavailable |
| I14 | A/B source references and field IDs, provider/settings and scope on each side | Typed values, explicit `B_minus_A`, tolerance, limits; no loss of refusal rules | Unmapped property, incompatible pair, silence, or missing metric yields insufficient evidence, never a direction |
| I15 | Saved project directory, before/after directory snapshots, master source/range, one new stable byte hash | Recorder ms, sample count/rate, seconds, beats kept distinct; no assumed exact sample alignment | Zero/multiple/changed/unsettled files fail identification; stop failure reports effects unknown and known candidates |
| I16 | Byte hash before/after analysis, path/stream/channel/sample range, provider versions/settings | Exact stream fields; estimates retain tolerance; null on silence; no visual-to-numeric inference | Hash mismatch rejects result; one failed worker does not erase other valid fields; incomplete required comparison refuses |
| I17 | Product/document versions, compatibility, stable URL, safe final URL, byte hash/count; installed relative paths/tree hash | No musical units; exact vs general-workflow-only; no signed URL token retention | Missing/stale/corrupt/incompatible cache fails closed; no offline network fallback |
| I18 | Source manifest hash, record locator/page/key, excerpt coverage, extractor/index versions, family | BM25 rank is retrieval score, not truth/confidence; default limit must be explicit in profile | Reject stale index or source; no matches differs from unavailable source; older guide cannot establish new-version behavior |
| I19 | Host version, native GUIDs, source tree fingerprint, installed/resolved cohort | Normalized names are lookup aids, not identity; no guessed ambiguous insertion | Unknown/ambiguous name or mismatched catalog fails; native lookup failure need not disable file reads |
| I20 | Donor ID/GUID, source fixture/index, host inventory, provenance and measured footprint | Byte/object counts and route fields; unknown footprint remains null; no guessed relocation | Unsupported type/route/footprint fails authoring; does not disable notes/docs/audio |
| I21 | Asset ID, byte hash/count and source authoring where manifest supplies them; known entry capacity | Byte offsets and topology counts; immutable seeds; explicit unsupported shape | Hash/topology/capacity mismatch refuses composition; no implicit source replacement |
| I22 | Exact source bytes/hash, host qualification, ownership and dependency references | Byte offsets/IDs; parser preserves supported structure; relocation and losses explicit | Unknown/unsafe shape, external dependency, or unproved live capture refuses; later host readback verifies application |
| I23 | Cohort/prompt/model/output hashes, settings, blind key and artifact IDs, explicit operator response | Probe-specific timing/tokens/scores; missing response not zero or acceptance | Invalid output remains a failed arm; evidence-only formats cannot authorize product writes |
| I24 | Module/profile version, request/source IDs, provider versions, run root/mode/permissions and exit state | Shared units; no auto-install, model, cache, or Bitwig default | Lazy dependency failure removes only affected capability; mismatched/late worker reply is rejected |

## Probe disposition

Disposition names the future destination. No probe, extension method, dependency,
or fixture is removed in 6i. Extraction means a reviewed module with its own
tests; product code must not import a whole probe and its optional dependencies.

| Phase 6 sources | Extract into product | Retain as regression | Evidence only / 8b runtime action |
|---|---|---|---|
| `phase6a-master-recorder.ts` | Directory attribution, recorder lifecycle, artifact identity in 7e | Three-capture identity and cleanup control | Remove hard-coded fixture setup and Homebrew paths from product design. 8b retains required typed recorder methods and classifies remaining probe allocation. |
| `phase6b-document-cache-lib.ts`, `phase6b-document-cache.ts`, `phase6b-retrieval.py` | Extracted in 7c: verified bytes and source-routed FTS5 | Cache corruption, offline refusal and routed questions | LSA/NumPy comparison and inventory runner remain evidence only. |
| `phase6c-audio-analysis.py` | The 7d typed FFprobe/FFmpeg adapter | Known-signal/tolerance controls, including silence | Essentia/aubio comparison, librosa and broad unused metrics remain evidence only. |
| `phase6d-perceptual-audio.py` and 6d2 evidence | None | Negative/control specifications if a later provider is proposed | CLAP/GPT-Audio/Gemini/affect experiments remain evidence only; no model startup. |
| `phase6e-semantic-analysis.py`, `phase6e-provider-survey.py`, `phase6e-live-clip.ts` | Exact wrapper; selected metric formulas; optional Music21 adapter | Ambiguous key, chord/voicing controls, complete-state preservation | Rejected provider adapters and direct-agent benchmark remain evidence only. Musicpy stays a candidate. |
| `phase6f-symbolic-representation.py`, `phase6f1-symbolic-familiarity.py` | Four guarded proposal operations; retain pure agent-context module | Opaque IDs, strict defaults, omitted fields, hash and compiler controls | ABC, MIDI-Like, REMI+, Octuple, Tidal and pattern comparison serializers remain evidence only. |
| `phase6f2-timing-grid.ts`, `phase6f2-live-replay.ts`, `phase6f2-groove.py` | Existing grid support remains; linked groove context retained | Grid, independent witness, host normalization, groove corpus | Standalone groove proposal runner stays evidence only until its future merge. 8b classifies the raw cursor/witness methods. |
| `phase6g-reference-transfer.py`, `phase6g-reference-followup.py` | Extraction/coverage and independent copy/trait formulas in 7b | Seed/raw/extracted controls and literal patch examples | Notochord and remote model runners remain evidence only. |
| `phase6h-sensory-packets.py` | The 7d audio sensory v1 router; MIDI remains conditional | Same-source, silence, undefined-property, paired-delta and level controls | Raw-inventory arms, model responses and ballot machinery remain evidence only. |

The extension currently registers 153 methods; the product wire map uses 82.
This count is not a removal list. [8b](../../plan/phase-8/8b-probe-runtime-retirement.md)
must classify each method and its allocated host objects. Preserve D13's required
registered diagnostic boundary and keep forbidden routes unreachable. Do not
remove old probes merely because a module no longer imports them.

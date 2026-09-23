---
title: Workstation contracts — experimental Phase 7 baseline
kind: reference
state: active
updated: 2026-09-23
scope: Phase 7 experimental baseline through 7e capture and audio composition
---

# Workstation contracts

## Status and reading route

This is the selected Phase 7 design and experimental implementation record. It
is not a stable public API. Existing product contracts keep their current
versions. New module contracts use `v0`; the revised sensory packet uses `v1`.
All require explicit experimental enablement. A successful probe does not prove
that a product consumer accepts its output.

Read the [inventory](WORKSTATION_INTERFACES.md) for format owners and disposition.
Read the [seam map](WORKSTATION_SEAMS.md) for fixtures and implementation blockers.
The [6i outcome](../../archive/outcomes/PHASE-6I-CONTRACT-SYNTHESIS.md) records the
audit. The [6j verification reference](WORKSTATION_VERIFICATION.md) classifies
costs and defines operation rules. Phase 7 owns implementation and proof.

This design applies E103–E105 and E109–E125. It preserves
[D9](../../decisions/d9-grid-and-units-settled-2026-07-25.md),
[D12](../../decisions/d12-transport-and-the-contract-boundary-settled-2026-07-25.md),
[D15](../../decisions/d15-verification-discipline-settled-2026-07-25.md), and
[D21](../../decisions/d21-musical-patch-and-public-tool-grain.md).

## Shared fields

These field definitions are shared contract vocabulary. They are not a new
global store, transport, or replacement for existing records. A module result
uses its own schema and these fields. Existing records need an explicit wrapper
or projection at a new boundary. Do not add fields to a strict v0 parser in place.

| Field | Required meaning |
|---|---|
| `schema` | Exact payload schema name and version. Unknown versions refuse. No range negotiation. |
| `requestId` | Caller correlation token. It is not a source, target, or ownership ID. |
| `source` | Source kind, source ID, digest, digest domain, canonicalization version, permission basis, and declared coverage. Live sources also carry address and observation guards. |
| `artifact` | Absolute local path, media type, byte count, full byte SHA-256, and creator. A path locates bytes; it does not identify them. |
| `provider` | Adapter name and version, underlying library or executable version, and effective settings. Include model/checkpoint identity only if a selected provider needs one. |
| `provenance` | Input source references, operation or formula version, settings, and producer. Keep declared, observed, inferred, and generated origins distinct. |
| `coverage` | Requested and observed scope, completeness, omitted fields, unavailable fields, and limits. Complete means complete within this scope, not the complete project. |
| `capabilities` | Available operations and exact accepted/emitted schema versions. Missing capabilities name their dependency and reason. Availability is not permission. |
| `warnings` | Code, affected source/field, and message. A warning cannot waive a guard, missing coverage, or data loss. Empty means none. |
| `failure` | Code, module, stage, affected source, retry condition, and effects: `none`, `known`, or `unknown`. Keep any artifact or change ID that already exists. |
| `ownership` | Creator, scope, and evidence for allowed cleanup or reversal. File access, a hash, and an agent proposal do not prove ownership. |

Every read result carries source, provider, coverage, and authority, including a
read with no matches. A failure before a source can be identified says that the
source is unresolved. It must not invent a hash or return a complete empty read.
Metadata can be shared once per result. Each datum must still resolve to its
own source, provider, coverage, and authority without ambient process state.

A fact or measurement record has `fieldId`, `value`, `unit`, `kind`, source and
provider references, coverage, formula/settings, and a tolerance or uncertainty
rule. Derived values cite their input field IDs. An unavailable value has a
reason. Failure codes distinguish `missing-dependency`, `unsupported-schema`,
`source-mismatch`, `incomplete-coverage`, `invalid-proposal`,
`incompatible-comparison`, `capture-ambiguous`, `timeout`, and
`verification-failed`. Preserve the original adapter failure under that wrapper.

### Identity and hashes

Use full lowercase SHA-256 for byte and content identity. Record the digest
domain: `file-bytes`, `audio-capture-source-v0`, `exact-note-source-v0`,
`agent-context-v0`, `note-compiler-preview-v0`, or a named legacy probe domain. The extension's
16-character method hash is a deployment check, not a content hash. Do not
compare these domains.

The 7a `ghostnote-exact-note-source-v0` is a private wrapper around complete
host-normalized note reads. It contains guarded clip addresses, the captured
revision mark, clip metadata needed for the task, all 16 channel note lists,
and explicit coverage. Include every observed `NoteRecord` property. An absent
property stays absent; it is not zero. Reject non-finite values.

Its canonical payload excludes its own digest, agent aliases, interpretations,
and display text. Rebuild objects with keys inserted in JavaScript UTF-16
code-unit order, then use compact `JSON.stringify` with its standard integer-key
ordering. Use no Unicode normalization or trailing newline. Reject undefined
values; normalize negative zero to zero as `JSON.stringify` does.
Sort clips by their serialized address, channels numerically, and notes by
start then pitch. Refuse duplicate note keys. Preserve ordered arrays such as
recurrence tuples. This serializer is named `exact-note-json-v0`; pin numeric,
Unicode, optional-field, and ordering cases in 7a before use. Python probe JSON
serialization is not an implementation of this serializer.

Opaque event IDs identify entries only within one source digest. The wrapper
holds the map from each ID to clip, MIDI channel, pitch, and start. These are
snapshot IDs, not durable host note UUIDs. Map host track UUIDs to valid context
aliases such as `t-1`; the context grammar cannot accept every raw UUID. Preserve
the reverse map outside agent text. A proposal must name the same source digest.
Refresh state and rebuild IDs after a write. Never resolve stale IDs by index.

Keep the live revision, generation, scene/content epochs, project detector,
window coverage, and address guards. A project name is a lossy detector, not a
durable project ID. The source digest supplements these guards; it replaces none.
An imported file can supply read-only context without acquiring a live target.

### Coverage, units, defaults, and loss

- Musical positions and durations use quarter-note beats. Context and proposal
  values use reduced rational strings. Host numbers remain in exact state.
  Convert through a named adapter; never round a start to make it writable.
- Beat intervals use inclusive starts and exclusive ends for note onsets. State
  whether notes that extend beyond the interval are included. A write that can
  clear a clip needs the complete clip, including notes outside the context view.
- Audio sample ranges are `[start, end)` per channel. Record sample rate, channel
  indices, mix/downmix policy, frame size, hop, window, padding, and covered frames
  for each estimate. Seconds equal samples divided by sample rate.
- Recorder milliseconds, audio seconds, and musical beats are distinct. A beat
  range does not prove sample alignment. Record capture lead, tail, and observed
  alignment limits. Do not trim a capture silently.
- MIDI channel is 0–15; pitch and velocity use the host's MIDI scale. Do not
  substitute normalized velocity. Keep release velocity and expression scales
  from `NoteRecord`; the live encoder alone owns wire scaling, including gain.
- Use `Hz`, `s`, `ms`, `LUFS`, `dB`, `semitones`, `MIDI-note`, `ratio`, and `count`
  explicitly. A LUFS difference is a loudness-unit delta. Ratios are not percent.
- No new implicit defaults. Existing public channel-0 compatibility remains at
  its old boundary. Agent insertions use `track-neutral-v0`: one unique source
  channel, mute false, release velocity 64, and neutral expression. An empty or
  mixed-channel source cannot infer that channel. A future policy needs a version.
- `track-neutral-v0` uses the host's enabled chance, occurrence, recurrence and
  repeat controls. Chance is 1, occurrence is `ALWAYS`, recurrence is `[1,1]`,
  and repeat count is 0. Complete readback compares these normalized defaults.
- `null` means unavailable with a reason, never zero. Empty means observed empty.
  Reject unknown required fields or units. List all dropped fields at projections.
  Preserve omitted host fields from exact state; do not reconstruct them from text.
- D9 retains binary timing through `1/512` beat and triplet timing through
  `1/768` beat. Host duration normalization uses the proved `2^-20`-beat rule.
  This is not permission to accept arbitrary nearby values.

### Authority

| Kind | Owner and allowed claim |
|---|---|
| Exact observation | Adapter or byte reader; what it observed within its coverage |
| Derived measurement | Named deterministic formula; its result over the stated input |
| Estimate or inferred label | Named provider/rule; alternatives, tolerance, and limits |
| Agent interpretation | Host agent; explanation linked to evidence IDs |
| Edit proposal | Host agent; requested changes and invariants, never current state |
| Verified outcome | Independent readback plus comparisons; applied state and discrepancies |
| UI observation | Computer-use run; visible state only |
| Operator verdict | Explicit operator response to identified audition artifacts |

Do not classify a deterministic rule label as exact because repeated calls agree.
Confidence is not a calibrated probability unless the provider proves it. A
provider result cannot contain an aesthetic acceptance verdict. The observation
record can retain an explicit operator response; silence is not acceptance.

## Module contracts

Each row names a logical contract version. The seam map records implementation
status. Shared fields above apply to every new input/output boundary.

| Module and contract | Inputs → outputs | Dependencies and startup | Failure isolation |
|---|---|---|---|
| Bitwig adapter, existing `ghostnote/0` | Addressed reads/typed `Op` batches → snapshots, receipts, revision and readback | Existing bridge; lazy connection, exact handshake and deployment check | Disconnect disables live reads/writes and capture. It does not disable local files, context from supplied state, or docs. |
| Symbolic context, `symbolic-context-v0` | Exact source, task, selected mode, declared tempo/meter → v0 context plus evidence and alias map | Pure TypeScript first; Music21 adapter starts only for a selected theory task | Missing Python/Music21 removes theory capability only. Missing required tempo or coverage refuses that context, not the workstation. |
| Reference context, `reference-context-v0` | Separate exact seed/reference sources, permission, task and coverage → extracted evidence, optional bounded raw context and comparison profile | Pure TypeScript; no theory helper is required | Missing permission, identity collision, changed hash or invalid coverage refuses only the reference request. It cannot supply a write target or verdict. |
| Exact patch compiler, `note-compiler-v0` | Exact source, note proposal v0, invariants → complete candidate, typed operations, losses, guards | Pure code; Bitwig required only for fresh preflight/apply/readback | Compile failure writes nothing. Apply failure keeps the change record and effects state; no blind retry or assumed rollback. |
| Documentation, `documentation-v0` | Installed product version, source family, query, result bound → cited records | Local sources, verified cache, SQLite FTS5; lazy source validation/index open; automatic mode downloads only a missing approved guide within 90 seconds and 128 MiB | A missing or failed guide leaves other valid sources available. Invalid cache entries fail closed. Missing guide extraction does not disable installed API records. Offline mode never downloads. |
| Audio capture, `audio-capture-v0` | Guarded saved-project directory, project master plus launcher range, and lifecycle bounds → exact audio artifact | Bitwig typed recorder route, filesystem, built-in PCM WAVE header reader; validate before live startup and again before recorder start | Unknown path/active recorder refuses before effects. Stop/settle failure reports known files and recorder state; it does not disable file analysis. |
| Audio facts, `audio-facts-v0` | Verified artifact, sample/channel scope, declared task → typed facts and optional paired projection | Byte validation first; discover FFprobe/FFmpeg separately; optional isolated librosa worker | Missing executable/worker removes only its facts. A crash terminates that worker and fails its pending request. Captures remain available. |

Capture needs stream/header validation, not a librosa, FFmpeg, or loudness
process. The 7e module uses the shared built-in narrow PCM WAVE header reader.
Failure of audio analysis cannot turn a successful capture into a failed capture.

The 7e `audio-capture-v0` profile requires an exact real saved `.bwproject`
path, full project-file SHA-256, operator-established directory association,
live project detector, and current generation, revision, scene, and content
guards. Bitwig does not expose the loaded project path. The result carries this
limit as a warning. The project file limit is 512 MiB.

The source manifest uses `capture-source-json-v0` canonicalization and the
`audio-capture-source-v0` digest domain. It identifies the project master output
during one guarded launcher clip. The clip is a range trigger. Other project
output is not excluded. The initial range is one loop from beat 0, from 2 to 32
beats, observed at 0.25-beat steps.

The extension reserves a recorder owner token before asynchronous activation.
Status and stop are owner-bound. Launch validates project, revision, scene,
content, durable track identity, row, and occupancy in the same handler turn.
Capture accepts exactly one new stable regular lossless path. The initial
artifact profile is stereo 24-bit PCM WAVE at 44.1 kHz with a 16 MiB limit.
It reports requested range, observed range, path, format, channels, sample
rate, duration, byte count, full SHA-256, providers, coverage, ownership,
warnings, and phase timings. Musical coverage does not prove sample alignment.

Capture returns an artifact declaration, not verified analysis bytes.
`captureAndAnalyze` passes that declaration through `verifyAudioArtifact`, then
makes a separate `audio-facts-v0` registry request. The full file SHA-256 is the
cross-module identity. Recorder state is not analysis input.

The 7d `audio-facts-v0` profile accepts verified stereo 24-bit PCM WAVE at
44.1 kHz. A request selects one or both discrete channels and a `[start,end)`
range from 0.05 to 60 seconds. The file limit is 16 MiB. Cancellation starts
after 2 seconds for startup, 5 seconds for each child process, and 20 seconds
for the complete request. The registry permits at most 1 second for terminal
cleanup after its deadline. The caller verifies and retains the bytes before
module startup.
Each FFprobe or FFmpeg process reads a private temporary copy of those bytes.
The module hashes the original path again after analysis and rejects a change.
The declaration records the creator and the explicit permission basis. Each
fact preserves both values with the source identity.

The silence gate uses a -90 dBFS noise floor and a 0.05-second minimum
interval. It applies to dependent facts only when the complete selected range
has at most one uncovered sample in total. It does not require digital zero.
Interval timestamps round to the nearest sample before union. Loudness uses EBU
R128 integrated LUFS. Crest is the largest
per-channel peak dBFS minus the largest per-channel RMS dBFS. Rolloff uses the
FFmpeg 85% magnitude cutoff, 8,192-sample Hann frames, no overlap, no padding,
and discards an incomplete tail. Its result is the median across complete
frames and selected channels.

Comparison tolerances are 0.1 LU for loudness, 0.001 dB for crest, one sample
for silence duration, and two FFT bins for rolloff. The brightness compatibility
gate remains 0.2 LU. These are starting experimental values, not stable public
promises.

### Discovery and lifecycle

The descriptor `ghostnote-workstation-module-v0` contains module ID,
version, state (`disabled`, `uninitialized`, `available`, `degraded`, or
`unavailable`), accepted and emitted schemas, capabilities, dependency versions,
and unavailable reasons.
Discovery does not connect to Bitwig, import Python models, download files, or
install dependencies. A configured module starts on its first relevant request.
Report readiness after its bounded health check, not before it.
Record the effective startup and request deadlines in the descriptor. A module
can remain uninitialized while unrelated modules serve requests.
Request cancellation reaches in-progress startup. A cancelled startup remains
retryable. A child-process timeout remains distinct from verification failure.

Keep workers and caches module-local. A worker request has an ID, schema, source
digest, settings, and deadline; the response echoes the request ID and digest.
Pure TypeScript modules exchange typed values. Optional Python workers use
newline-framed JSON on private stdin/stdout with the owning module's exact
contract version. Diagnostics use stderr. Executable adapters pass argument
arrays and validate output before creating typed facts. They expose no shell
or arbitrary provider command to the agent.
Reject mismatches and late responses. Serialize access where a worker cannot
serve concurrent requests. Do not retry writes automatically. Retry a read only
with the same verified source and explicit bounded policy. A missing model has
no effect today: no model provider is selected.

Keep registration separate from `Session.ready()`. Local modules cannot depend
on the Bitwig workspace startup path. Publish capability state and gate only the
affected call. Enablement and permission are explicit for each dogfood run.

## Selected projections

### Context and theory

Retain `ghostnote-agent-context-v0`, `compact-bar-v0`, and the linked
`ghostnote-groove-context-v0` overlay. Add source/provider/authority metadata in
the `symbolic-context-v0` result, outside the strict context object. Each harmony,
role, articulation, or inferred timing annotation must resolve to a provenance
entry. Do not emit an unqualified harmony label merely because v0 permits one.

Compact mode is the default. Groove mode requires observed, declared, or inferred
timing provenance; realized starts alone do not prove intent. Sparse groove
coverage must name its covered IDs. No second event identity set is allowed.
The current parser requires events; empty-source handling is a 7a refusal fixture,
not permission to invent an event. Music21 remains the primary optional theory
candidate. The first context task needs no theory package unless it uses a theory
result. Musicpy, broad tension fields, and model providers are outside that task.

### Proposal and exact execution

Retain the E114 `ghostnote-note-patch-v0` body (`schema`, `base_sha256`, `ops`).
The compiler call also supplies the exact source reference and task invariants.
Support only `transpose`, `delete`, `move`, and `insert` initially. Validate the
whole operation sequence and final candidate, not just each operation against
the initial notes. Reject stale/missing/deleted IDs, collisions, ambiguous
channels, unsupported expression, timing loss, and impossible constraints.
Refuse a final candidate above the 4,096-note exact-source capacity before a
write. Required complete readback must be able to represent the result.

`track-neutral-v0` describes logical defaults. It cannot authorize a pressure
write: the host cannot write pressure. The complete candidate shows every
normalized default. Typed operations omit neutral pressure only. The compiler
must prove that this omission preserves the expected readback or refuse.
Non-neutral or unverified properties retain the existing fidelity/protection
gate.

The probe rejects same-pitch overlaps. D21's public deterministic compiler can
shorten them and reports loss. The proposal boundary will reject a candidate
that needs shortening unless the task explicitly permits that loss. Never apply
the public normalization as an unreported translation.

Keep `ghostnote-musical-patch` v1 for deterministic generation/transformation.
Do not pretend that an opaque-ID proposal is one of its selectors. Translate both
through complete candidates into the existing typed operations and
`Workspace.apply`. Reuse the current write-set, protection, stash, settlement,
and readback machinery. D15 requires a different read handle, or a handle after
re-pointing, to avoid the writer's cached state. A request echo or success receipt
is not readback.

Merge the separate `ghostnote-groove-patch-v0` proposal family into a future
revision of the note compiler only when a task needs it. Its probe validates
four fixed expected objects; it is not a general compiler. Phase 7b uses
realized-note proposals. Pattern expansion and relative groove requests
remain unavailable until a versioned translation and fixtures exist.

### Reference context

Use a `reference-context-v0` profile in the symbolic module: reference source,
permission, hash domain, complete/used coverage, extracted evidence, optional
bounded raw v0 context, and an explicit reason for that excerpt. Seed identity
and reference identity remain separate. A reference cannot supply write targets.

Use extracted structure by default. Compute trait transfer and copy measurements
from the complete permitted reference and candidate, independently of the short
agent view. Report exact-event, sequence, rhythm, and structural comparisons
separately with formula and coverage. They are neither permission checks nor
aesthetic verdicts. Use seed-only control, longer examples, fixed backing, and
one direct listening instruction when comparing creative results.

### Sensory evidence

The 7d audio route implements `ghostnote-sensory-packet-v1`.
The v0 evaluation stays frozen. V1 is a task projection of symbolic or audio
facts, not a provider and not a second exact-state format. It contains task ID,
operational property definition, A/B source references, selected field records,
`B_minus_A`, comparison tolerance, decision purpose, and explicit limits.

The router copies measured values and source metadata; it does not recompute
provider facts. Each pair requires equal units, formula/settings, and compatible
coverage. Otherwise return `incompatible-comparison`. Keep provider identity on
both sides. Compute numeric deltas only for finite available values. Equal
values within the declared tolerance support no change in that metric only.
Different hashes do not prove audible change; equal metrics do not prove equal
music. Patch target IDs stay in context and the exact-source map.

Retain only these E118 routes at first:

| Decision | Fields and limit |
|---|---|
| Adjacent movement | Mean absolute adjacent pitch motion in semitones; monophonic ordered notes only, at least two notes. Do not substitute E109 rank-paired chord motion. |
| Onset placement | Count starts whose reduced quarter-beat denominator is 2, divided by note count; the task must declare this proxy. Empty input is unavailable. |
| Register/count preservation | Median MIDI pitch and exact note count within the same scope |
| Candidate edit | Before/candidate values and delta from a validated candidate; this is a prediction, not a verified write |
| Declared brightness proxy | Rolloff plus integrated loudness and silence gate; require level difference at most 0.2 loudness units, as in E118 |
| Explicit loudness | Integrated LUFS plus silence gate; no level matching because loudness is the target |
| Crest/no change | Peak-to-RMS crest in dB plus silence gate; no general dynamic-quality claim |
| Silence | Threshold duration at -90 dBFS for at least 0.05 s; null dependent spectrum/loudness/crest when the silence gate applies |

E118 uses zero-overlap 8,192-sample Hann frames and a median pooled across both
channels. Its crest subtracts the largest per-channel RMS dBFS from the largest
per-channel peak dBFS. These are specific formulas, not generic stereo defaults.
The 7d `spectral-rolloff-85-v0` field pins the hidden 85% magnitude cutoff and
discards the incomplete tail without padding. FFprobe duration timestamps are
converted through the stream time base to an exact exclusive sample end.
Different settings need a new field version.
Unmapped `compelling` or `presence` refuses before broad analysis. Librosa stays
an optional E105 candidate; no field from it is needed by this first cohort.

## Smallest experimental surface

Keep stable-only registration unchanged. An explicitly selected experimental
profile adds capability discovery and these focused read operations as their
sessions implement them: symbolic context, proposal preview, routed document
lookup, and file audio facts/comparison. Capture is a separate operation that
changes recorder/transport state and creates a file; it is not read-only.

For proposal application, extend the existing `transform_clip_music` boundary
only in the experimental profile with a discriminated proposal input. Keep the
current deterministic v1 input. Do not add a same-purpose write tool or pass an
agent patch to the current validator. D21's tool grain and D20's destructive-tool
separation remain. A note deletion does not authorize clip-container deletion.
Freeze and identify each experimental profile so a run can reproduce its schema.

The minimum first run is exact source → compact context → host-agent explanation
and unapplied revision. The next run adds proposal preview, guarded application,
independent readback, and an operator audition. Add docs and file facts in their
own module-only runs. Add capture after file analysis works. Phase 7f composes
only the modules required by one selected task.

Do not add a generic provider runner, raw RPC escape hatch, broad theory tool,
perceptual labels, Notochord, a new preset loader, or automatic acceptance.

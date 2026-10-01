---
title: Ghostnote Document 1.0 host binding
kind: reference
state: active
updated: 2026-10-01
owner: phase-8f3
---

# Host binding

This is the target Ghostnote binding for [Document 1.0](SPEC.md). It is not
live integration. [Binding fixtures](bindings/v1/README.md) test pure mappings
and refusals. 8h must connect them to fresh host reads and guarded writes.
[D25](../../context/decisions/d25-fields-json-document-format-and-publication.md)
selects the language. D8, D9, D16, and the current tools keep their existing
behavior until their stated migration gates pass.

## Read boundary

The selected public name is `read_launcher_clip`. One request addresses one
Launcher clip. It does not read Arranger clips. Use a durable track ID and a
current scene address with its epoch. A document clip ID cannot resolve a host
by itself. Clip-block callers can repeat this read for explicit rows and keep
boundary occupancy in the result wrapper. There is no new public batch sensor.

Return canonical FIELDS by default, or equivalent JSON on request. The wrapper
contains the document content hash, opaque base ref, acquisition boundary,
coverage, health, loss facts, and actionable warnings. Internal source hashes,
observer handles, proxy indices, and queues stay private. A read is not a write
permission. The model receives the [Model format reference](MODEL-REFERENCE.md)
sections needed for its task.

One complete D23 scan discovers occupied `(cell,pitch)` coordinates. Enrich each
coordinate on host channels 0..15. Portable channels are host channel plus one.
A channel-free observer notification does not identify a MIDI channel. Read all
16 channels before declaring complete onset coverage. Compare project generation,
structure, and content guards before and after acquisition. Preserve the valid
selection lease when acquisition borrows selection.

Coverage `complete` means complete note identities under the D23 cell boundary,
for the declared span and channels. It does not imply `fields:"all"`. An atomic
compound field is covered only when all members are known and representable.
Omit an uncovered field. Do not expand its portable default. `partial` and
`unavailable` require reasons; neither means an empty clip. An empty slot is an
occupancy result, not an empty stored clip. Return no invented clip container.

If cache state is unhealthy, use a fresh authority read. If that read fails,
refuse with `authority-unavailable`. A requested excerpt can be explicit partial
context. It must not replace a failed complete read. Parser limits and cache
admission limits are separate. The [cache contract](../../context/contracts/GHOSTNOTE_CACHE_CONTRACT.md)
sets the latter.

## Field mapping and authority

These rules cover every [represented field](FIELDS.md). Observation authority
comes from the fresh host read. Declared annotations have document authority.
Model changes are proposals. A writable API method is not proof that every
value in a portable range has passed a live test.

| Portable value | Host mapping and observation | Write or preservation rule |
|---|---|---|
| `id`, event `clip` | Binding registry; no durable host note UUID | Mint and recover under [identity rules](IDENTITY-AND-OVERLAYS.md); never write IDs to notes |
| `at` | Exact acquired cell index divided by 512 | Use D9 for new realized timing; preserve original finer host onset for an untouched note |
| `duration` | R07 of the exact binary64 host duration | Write a validated cell duration through D9; preserve untouched raw duration |
| `pitch` | NoteStep `y`, integer MIDI 0..127 | Direct; never clamp or wrap |
| `velocity` | Round host normalized velocity times 127 | Integer MIDI setter; compare integer readback |
| `channel` | Host `channel()` plus one | Subtract one for typed operations; explicit on every musical write |
| `mute` | `isMuted` | Direct Boolean |
| `releaseVelocity` | Raw normalized `releaseVelocity`, not MIDI 0..127 | Direct normalized value; do not substitute the old 64/127 insertion policy |
| `articulation` | No measured host field | Uncovered on a host-only snapshot. `normal` on a new proposal has no setter. Other labels require separate declared storage or refusal |
| `expression.velocitySpread` | Raw `velocitySpread` | Direct normalized value |
| `expression.gain` | Raw `gain`, amplitude ratio | Host profile is 0..2; shared encoder applies `gain/2` exactly once. Refuse portable values above 2 |
| `expression.pan` | Raw `pan` | Direct signed value |
| `expression.pressure` | Independent raw `pressure` read | Unwritable. Preserve on untouched existing notes; refuse a changed or reconstructed nonzero value |
| `expression.timbre` | `(raw timbre + 1)/2` from host -1..1 | Inverse is `2*portable - 1`; portable default 0.5 maps to host centre 0 |
| `expression.transpose` | Raw `transpose` | Direct semitones; host range -96..96. Refuse the wider portable values |
| `chance` | `isChanceEnabled`, `chance` | Map both members; keep a disabled value |
| `occurrence` | `isOccurrenceEnabled`, `occurrence` enum | `ALWAYS` maps to `always`; other supported enums map to `bitwig:ENUM`. Map the exact inverse; refuse other labels |
| `recurrence` | `isRecurrenceEnabled`, `recurrenceLength`, `recurrenceMask` | Preserve all three even when disabled. Host length is 1..8 and mask is below `2^length`; refuse longer writable cycles |
| `repeat` | Host controls use different semantics | Uncovered as a portable atomic field. Keep raw controls private. Refuse conversion or reconstruction that needs an unproved semantic mapping |

Supported occurrence suffixes are `FIRST`, `NOT_FIRST`, `PREV`, `NOT_PREV`,
`PREV_CHANNEL`, `NOT_PREV_CHANNEL`, `PREV_KEY`, `NOT_PREV_KEY`, `FILL`, and
`NOT_FILL`. Do not map by general case conversion. An unrecognized host enum
makes the compound field unavailable and blocks its replay.

The host repeat count accepts -127..127. Positive values select divisions;
negative values select a rate. Host repeat velocity end is -1..1 and relative
to attack velocity. Portable count is a total trigger count; portable velocity
end is 0..1. Neither has a proved general inverse. Do not use `count+1`, take an
absolute value, or drop a disabled nondefault control. Read and preserve raw
controls when the host operation leaves the note intact. Refuse a full replay
until 8h has a deliberate converter with evidence, or use an exactly matching
protected clip copy under the existing fidelity policy.

Scalar expression/release readback uses the existing `2e-3` property tolerance
where measured; signed timbre tolerance 0.002 becomes portable tolerance 0.001.
Identity, pitch, MIDI velocity, Booleans, enums, recurrence,
and normalized cell timing compare exactly. Gain uses the measured E24 inverse;
a comparison tolerance does not authorize a changed source or base guard.
Portable values outside measured host support refuse before mutation. A future
wider profile needs named values and independent host evidence.

### Metadata and envelope

| Field | Observation and target rule |
|---|---|
| `format`, `version`, `kind` | Codec contract; never host properties |
| Root arrays | Represented inventory only; no permission to create/delete clip containers |
| `meta`, `extensions` | Declared inert annotations; preserve in the binding store. They grant no host authority |
| `base` | R27 content guard plus optional opaque registry ref; see base resolution below |
| Clip `id` | Session logical reference; separate from current Launcher address |
| Clip `name` | Launcher clip name; direct writable string, including empty string |
| Clip `length` | Host loop length in quarter-note beats; writable only when positive and the metadata geometry is supported |
| Clip `loop` | Enabled host loop from loop start through start plus length; null when disabled. Keep disabled raw markers private |
| Clip `playRange` | Requires both independently read play markers in valid local bounds. Play-stop setter is inert; preserve an unchanged range or refuse a changed one |
| `coverage` | Acquisition statement. A proposal cannot edit it as a host property |
| Overlay envelope and data | Binding annotation state under [overlay rules](IDENTITY-AND-OVERLAYS.md). Never a second note list |

Do not shift stored coordinates to the play start. A nonzero loop start, negative
stored onset, onset at/after length, or incompatible local range requires an
explicit range diagnostic. Portable durations can extend beyond clip length.
The current live compiler also refuses over-end notes; initial 8h must retain
that host restriction. Give the Consolidate remediation, then reacquire after
the computer-use action. Do not crop or hide notes to produce a valid document.
If out-of-range host data cannot fit the portable model, return unavailable
coverage plus the raw range diagnostic in the wrapper. It is not a complete
empty clip. A zero-length portable clip has no measured create/write path.

For a supported metadata update, retain colour, launch settings, disabled loop
markers, and writable play start from fresh authority. Set loop values first,
then restore play start as the existing E43 writer does. Full desired omission
sets portable name/range defaults. If those defaults require an unwritable
play-stop change, refuse. Metadata omission cannot delete automation or other
unrepresented host state.

## Defaults and proposed changes

New portable notes expand R04 defaults. The writer must set each mapped default
explicitly when host insertion defaults differ. It must not substitute
`track-neutral-v0`: that policy uses release 64/127, host-centred timbre 0, enabled conditions,
and host repeat controls. Pressure zero is omitted from setters only when
independent insertion readback proves zero. The initial binding refuses a new
note whose requested portable repeat semantics lack a host mapping. Pure
fixtures do not establish that insertion readback gate.

A sparse patch preserves every unnamed event and field. A changed expression
object replaces all members; the caller must supply members it wants to retain.
Null resets to the portable default. Build the candidate from fresh raw state,
not from default-expanded unknown fields. Preserve raw finer timing and raw
unrepresented controls on untouched notes. Reconstructing a note requires
proof that all its prior fields are replayable. Pressure and repeat refusals
can therefore block a pitch/timing edit that requires reconstruction.

A complete desired document replaces all portable events and overlays in its
mapped clips. Omitted optional values are portable defaults. It is not a sparse
preservation request. Match retained IDs, validate full inventory, and make
removed notes explicit in the plan. Preserve host fields outside the format
only where the measured operation proves preservation; otherwise refuse or
name the loss under its permission and fidelity policy. There is no implicit
clip deletion, automation deletion, or permission escalation.

## Base resolution and conflicts

The private base registry binds an opaque ref to project generation, structural
epoch, logical clip, current address, original document/coverage/content hash,
raw authority source, event map, and content generation. The new raw source
domain is `ghostnote-launcher-source/1`: SHA-256 over that name plus LF and R26
canonical JSON of project/structure guards, current address, complete raw metadata,
and every raw note property, with notes ordered by channel/cell/pitch. Include
disabled controls and raw binary64 timing. It is private acquisition evidence.
8h must implement this domain before raw state can guard the new route.

The retained diagnostic wrapper uses `exact-note-source-v0` and
`exact-note-json-v0`. Its decoded omissions cannot establish complete raw field
authority for the new route. Neither source digest is the R27 document hash.
R22 dependency basis and cache fingerprints are also separate.
Do not compare bare digest strings across domains.

For each desired replacement or sparse patch:

1. Validate the proposal with the reference codec. Resolve every clip and event
   through the recorded binding; reject an unknown or expired ref.
2. Resolve current identity and address. Require the same project generation
   and proved clip continuity. A proved move still needs a new guard and proposal
   if its structure/address guard changed.
3. Acquire fresh raw authority. Re-project it with the original IDs, coverage,
   annotations, and acquisition boundary. The original R27 guard must match.
   A normalized match alone cannot hide a raw change to the affected replay or
   reversal boundary; compare that boundary as well.
4. If the original base is complete, use the pure materializer. If it is partial,
   require a full resolved portable base with authority for every missing field.
   Recheck its projection against the original partial guard. Only then can the
   binding use its separate full-base digest internally. Preserve and report
   both digests. Never silently accept a proposal against a changed partial base.
5. Refuse when the missing state cannot be resolved. Host-unavailable articulation
   or repeat values need explicit valid declarations with a preservation proof;
   they cannot be completed by guessed defaults. A bare partial hash with no
   retained projection/ref cannot be expanded. Ask for a new read and proposal.
6. Validate capabilities, collisions, geometry, protection, and complete candidate
   before any write. Serialize host writes and external UI edits. Use the existing
   revision-guarded `Workspace.apply` boundary.

The pure binding tests refuse unresolved partial bases and check explicit
field-only full-base resolution against the retained guard. A live resolver
is an 8h seam and acceptance gate. The fixture preservation flag is not host
evidence.
An unguarded desired document is valid new work, but applying it to an occupied
clip still requires a fresh target guard and complete effect/protection evidence.
A stale, ambiguous, unsupported, or unresolved proposal writes nothing. Do not
choose the nearest event, default channel, matching name, or matching digest
as an alternative target. A changed host guard requires a new proposal.

## D9 writes, loss, and readback

Core cell onsets and durations are exact binary values. Put beats-native values
in typed operations; D9 alone chooses the coarsest exact supported grid and
encodes step indices. Keep its grid settlement and whole-note-set property
staging. Do not change the current low-level encoder, supported triplet family,
`2^-20` duration rule, or stash replay fidelity through this document.

R07 floors source onsets and rounds durations independently with ties up and a
one-cell minimum. Exact import collisions refuse with all source IDs. A host
D23 scan may already contain an unknown survivor; report that boundary and an
unknown collision count. Never claim recovery of lost source notes. Conversion
adds no loss. Do not put acquisition displacement into intentional groove.

Portable adjacency and overlap remain representable. The initial host profile
refuses same-channel, same-pitch overlaps when it cannot prove their write and
reversal behavior. It does not invoke D21's legacy shortening transform.
Different channels and pitches remain separate. Refuse duplicate acquired cells.
Normalization can change overlap intervals; retain its report when exact source
timing is available. Do not invent that report from cell-only observations.

After a write, reacquire through an independent authority read, then project
with the same rules and the confirmed candidate identity map. Expected state
must never supply observed values. Compare the affected semantic scope and
preserved host fields; whole-clip reconstruction needs all 16 channels. Targeted
E128 edits use the proved cell and channel boundary. Return normalized observed
state, change ID when durable effects exist, loss, discrepancies, and all partial
effects. Readback failure does not erase ownership or authorize a retry.
The [risk policy](../../context/contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
names each consumer and protection boundary.

## Source and handoff

Existing evidence: E15-E pressure, E24 gain, E43 metadata, E116 precision,
E121 explicit insertion defaults, E128 targeted reversal, E129 range refusal,
E131 acquisition, and E138-E139 cache budgets. See the
[interface audit](../../context/evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md)
and [workstation seams](../../context/evidence/format/WORKSTATION_SEAMS.md).

The installed Bitwig API documentation was inspected offline on 2026-10-01.
It supplies declared signatures and ranges, not new live behavior evidence:

- `NoteStep.html`: SHA-256
  `551eaadab61b2316ded1c5667b25cd300f6ca84b8c68861d6ae41736a11a34d6`.
- `NoteOccurrence.html`: SHA-256
  `cc28a8ca0f991e4a7a9266445bc766964acc581dbd7ad44bc48f1966c2954b95`.

Both are under the installed app's
`Contents/Resources/Documentation/control-surface/api/com/bitwig/extension/controller/api/`.
Do not redistribute the vendor pages. Their recurrence limits and incompatible
repeat semantics set conservative binding refusals. 8h owns raw field retention,
partial-base resolution, capability profiles, live independent readback,
result migration, and rollback. No new live check was needed in 8f3.

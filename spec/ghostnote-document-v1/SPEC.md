---
title: Ghostnote Document 1.0 specification
kind: specification
state: active
updated: 2026-10-01
source: ../../context/decisions/d25-fields-json-document-format-and-publication.md
---

# Ghostnote Document 1.0

This is the Phase 8f1 target contract. It is not an external release. The
reference codec is planned in [8f2](../../context/plan/phase-8/8f2-reference-codec-and-model-format-reference.md).
The [field reference](FIELDS.md), [grammar](fields.ebnf), and
[JSON schema](schema.json) are normative parts of this contract. The
[case inventory](CONFORMANCE.md) assigns cases to every rule below.
[Examples](EXAMPLES.md) supply paired inputs. [Host questions](HOST-HANDOFF.md)
belong to 8f3. These artifacts do not change `normal-v1` or a live tool.

`must`, `must not`, and `reject` state requirements. Each numbered rule governs
its complete section, including tables. Examples and rationale do not add rules.
Schema validation checks structure. A semantic validator must also check these
rules. A schema `default` annotation does not insert a value.

## R01 — Identity, version, and extensions

The format name is `ghostnote-document`. The version string is `1.0` in both
encodings. Reject other versions, including `1`, `1.0.0`, and later minor
versions. A later specification can define compatibility; a 1.0 reader cannot
guess it. IDs start with an ASCII letter. Other characters are ASCII letters,
digits, `_`, `.`, `:`, and `-`. IDs are case-sensitive and at most 128 bytes.
IDs are opaque document handles. They do not promise durable host identity.

Reject unknown keys and records. An optional root `extensions` object is the
only extension point. Keys use the ID syntax and must contain `:` to identify
a namespace. Values are bounded JSON data. Preserve unknown extensions through
conversion and hashing. Treat them as inert annotations. They cannot change
defaults, authority, timing, or patch meaning. Reject any request that requires
an unknown extension to affect behavior. Extensions cannot replace core fields.

## R02 — Envelope and coordinate system

The root has `format`, `version`, and `kind`. Kind is `snapshot`, `desired`, or
`patch`. A snapshot describes observed or imported represented state. A desired
document describes complete proposed state. A patch describes sparse changes.
Neither a desired document nor a patch gives permission to write a host.

Snapshot and desired documents have `clips`, `coverage`, `events`, and
`overlays` arrays, including empty arrays. Optional `meta` has `title`,
`description`, and `permission` strings. Omission means no supplied metadata;
an empty string is a supplied value. Root metadata has no musical effect.
Optional `base` names an earlier document with `sha256` and optional `ref`.
A patch requires `base`. Snapshot forbids it. Desired can omit it for new work.
`ref` is an opaque external locator. Its resolution belongs to the binding.

Every event has one `clip` reference. Clip IDs, event IDs, and overlay IDs each
have their own document-wide namespace. Equal IDs in different namespaces are
allowed. Beat zero is the start of each clip's stored coordinate plane. One
beat is one quarter note. Tempo does not change beat coordinates. Clip IDs can
describe multiple parts. A host track ID or launcher address is not a core field.

## R03 — Clips and coverage

A clip has `id`, rational `length`, and optional `name`, `loop`, and `playRange`.
Name defaults to `""`. Loop and play range default to `null`, which means no
portable range declaration. A range has rational `from` and `to`; require
`0 <= from < to <= length`. Clip length is nonnegative. Zero length requires
no events and null ranges. Events start in `[0,length)`. A duration can end
beyond length. Do not truncate it at the clip end. Clip metadata need not use
the realized note grid.

Each clip has exactly one coverage record: `clip`, `from`, `to`, `channels`,
`fields`, and `status`, with optional `reason`. Coverage uses onset membership,
not duration intersection. Require `0 <= from <= to <= length`. Equal bounds
are allowed only for a zero-length clip. Channels are a nonempty unique set of
integers 1 through 16. `fields` is `"all"` or a unique set of event field names
from FIELDS.md. The required set is `id,clip,at,duration,pitch,velocity,channel,mute`.

`complete` means all note identities in the stated span and channels are
represented under the selected acquisition boundary. `partial` means they
are not all represented; require a nonempty reason. `unavailable` means no
events were obtained; require a nonempty reason. Do not infer empty state from
either status. All represented events must be inside their coverage and use
only covered fields. A covered omitted optional field means its portable
default. An uncovered field is unknown, even if its default is usually zero.
`"all"` covers every field in the 1.0 field reference.

A desired document requires complete coverage of `[0,length)` on all 16
channels, with `fields:"all"`, for every clip. Thus its omitted properties are
defaults, not a request to preserve earlier values. Empty documents have all
four arrays empty. An empty clip still has a clip and coverage record.
A snapshot can be partial or have unknown properties. It remains convertible;
it is not a complete desired replacement.

## R04 — Event values and defaults

Use the types, units, defaults, authority, and operations in [FIELDS.md](FIELDS.md).
An event requires `id`, `clip`, `at`, `duration`, `pitch`, and `velocity`.
Channel defaults to 1 and mute defaults to false. Optional values have one
portable default. Defaults do not claim a Bitwig insertion policy. Realized
properties belong to the event. No overlay is another note list.

Do not collapse distinct event IDs because their pitches or times match.
Reject a duplicate `(clip,channel,pitch,at)` address after rational reduction.
Allow overlap at different onsets, including same-channel, same-pitch overlap.
Allow exact adjacency. Do not shorten notes or infer ties. A host can later
refuse a represented overlap. D21's shortening rule belongs to the existing
operation language, not this portable document.

## R05 — Exact timing text

Every beat quantity is a string in JSON and rational text in FIELDS. Accept
`-?(0|[1-9][0-9]*)(/[1-9][0-9]*)?`. Accept unreduced values, denominator one,
and `-0`; canonical output reduces them and writes zero as `0`. Whole values
have no denominator. Do not accept a plus sign, leading zero, signed
denominator, zero denominator, decimal, exponent, JSON numeric timing, or
whitespace inside a fraction. Apply sign constraints after reduction.
Onset is nonnegative. Duration is positive. Nominal positions are nonnegative;
nominal durations and divisions are positive. Timing components can be signed.

Use exact integer arithmetic for reduction, comparisons, grid checks, and
hashing. Parsing, rendering, and encoding conversion must not quantize.

## R06 — Realized plane and proposals

Realized event `at` and `duration` are integer multiples of `1/512` beat.
Duration is at least `1/512`. Reject off-grid realized values in either
encoding, including a model proposal at `1/3`. Do not silently repair an input
document. Nominal overlay values can use any bounded exact rational.
The conversion guarantee preserves represented values after acquisition.
It does not guarantee source precision or multiplicity below one cell.

## R07 — Acquisition and import normalization

Normalization is a separate operation, before document validation. Its input
is a nonnegative source onset `s` and positive source duration `d`. For exact
rational source values, calculate:

```text
at = floor(512*s)/512
duration = max(1, floor(512*d + 1/2))/512
atDelta = at - s
durationDelta = duration - d
```

Duration rounds to nearest, with ties up. A positive note shorter than half a
cell still becomes one cell. Reject zero or negative source durations. Do not
round the end independently. No adjacency or overlap repair follows rounding.
The result can introduce, remove, or change overlap; report that change.
Normalization is idempotent on normalized values.

For host binary64 numbers, require finite values and the same sign constraints.
Decode the exact IEEE 754 binary value to a rational before this calculation.
Do not first convert it with decimal text or apply an epsilon. Reject NaN,
infinities, and negative nonzero onsets. Treat negative zero as zero. An exact
host-reported cell index is already an acquired onset; do not floor it again.
Host duration quantization, such as D9's `2^-20`, precedes this operation.

An import report contains each supplied source ID, source timing, normalized
timing, both signed deltas, minimum-duration promotion, changed overlap pairs,
and collision groups. If explicit imported source notes share one normalized
address, reject materialization and report all source IDs. Do not pick a
winner. A D23 host cell observation can already contain an unknown survivor.
Label that acquisition boundary; do not claim that its scan recovered lost
source IDs or that its collision count is known. Rounding rules do not select
which source onset Bitwig exposes.

## R08 — Sparse patch structure

A patch has required `add`, `remove`, `update`, `clipUpdate`, `overlayPut`, and
`overlayRemove` arrays, which can all be empty. It has no full state arrays or
coverage. Add contains complete events with the R04 defaults. Remove contains
event IDs. Update entries have `id` and nonempty `set`. Set contains editable
event fields; it cannot change `id` or `clip`. ClipUpdate entries have `id` and
nonempty `set` for `length,name,loop,playRange`. Patch cannot add or remove a
clip container. Use a desired document for a different clip inventory.

`overlayPut` contains complete overlay envelopes. It adds a new ID or replaces
the full envelope at an existing ID. It does not merge data or dependencies.
OverlayRemove contains overlay IDs. Optional patch meta and extensions are
annotations of the patch itself. They do not change the base root annotations.

## R09 — Preservation, clearing, references, and order

Apply a patch atomically against a document with matching R27 content hash.
The pure reference materializer requires a full base: complete span coverage,
all channels, and all fields for each clip. Refuse a partial or unknown base.
A proposal can name a partial snapshot, but applying it needs a binding that
resolves the missing state and checks its guard. That policy belongs to 8f3.

Unmentioned values and events remain unchanged. A null in `set` resets an
optional event property to its portable default. It does not mean unknown.
Null is forbidden for required onset, duration, pitch, and velocity. Name null
resets to `""`; range null removes that declaration. Length cannot be null.
An update with a value equal to the existing value is a no-op. Empty patch is
a no-op. Removing a missing ID, updating a missing ID, adding an existing ID,
or removing a missing overlay is an error, not a no-op.

Reject repeated IDs within each array. Reject one event ID in more than one
of add/remove/update, and one overlay ID in both put/remove. ClipUpdate has one
entry per clip. Treat arrays as sets of changes. Input order cannot determine
the result. First form the final clips and events; then process explicit
overlay removals and replacements; then run R21-R24 lifecycle checks. Validate
the entire result before accepting it. Report changed fields, defaults cleared,
added/removed IDs, and overlay state changes. No-op reports have no changes.

A desired replacement keeps matching IDs and removes omitted events and
overlays. It does not preserve unnamed event properties. It is full state,
unlike a patch. Compare retained overlays with the base under R21-R24. Reject
an unknown base guard. A desired input must pass its own current-basis rules.
When dependencies change, its caller must mark inherited claims stale or supply
explicit replacements. A patch materializer performs that invalidation for
unnamed retained overlays. For new desired work, current overlays must also
have valid dependency bases. A pure result is a desired document without the
proposal's `base`. Preserve base root annotations during patch materialization.
Do not include patch annotations in that result.

## R10 — FIELDS records

The normative [EBNF](fields.ebnf) defines record syntax. The first nonblank line
is `DOC ghostnote-document 1.0 <kind>`. Exactly one `FIELDS` binding follows
the envelope records and precedes all event rows, even for empty inputs. A
binding contains unique event field names and includes the six required R04
fields. Each EVENT or ADD row has exactly one value per bound field. `_` omits
an optional field. It cannot omit a required field. An optional `WITH` JSON
object carries unbound event fields. Reject a field in both the binding and
WITH, even when the row has `_`. There is no implicit positional binding.

CLIP, COVERAGE, OVERLAY, META, BASE, EXTENSIONS, UPDATE, CLIP_UPDATE, and
OVERLAY_PUT use the same JSON objects as their corresponding JSON encoding.
An UPDATE record takes an ID and its set object. It maps to `{id,set}`.
REMOVE and OVERLAY_REMOVE take one ID. Records must match the document kind.
Snapshot/desired use EVENT; patch uses ADD. Multiple META, BASE, EXTENSIONS,
or FIELDS records are errors. JSON-valued records occupy one physical line.
Quoted strings can contain escaped line breaks. Objects and arrays can have
spaces inside them. A scanner must track nesting and strings, not split the
line only at spaces. Bare slot strings use ID or rational syntax; JSON strings
can represent any permitted string. Object timing values remain JSON strings.

## R11 — Accepted layout and JSON syntax

Accept UTF-8, LF or CRLF, blank lines, leading/trailing spaces or tabs, and
one final line without a newline. No BOM, comments, code fences, trailing
commas, duplicate JSON keys, extra prose, or repeated header is permitted.
FIELDS keyword and field-name case is exact. Envelope records precede FIELDS.
After FIELDS, body records can be interleaved in any order. Resolve references
after the full input, so forward references work. JSON object key order has no
meaning. Reject invalid UTF-8 and unpaired Unicode surrogates. Do not perform
Unicode normalization. Different Unicode scalar strings remain different.

## R12 — Initial overlay envelope

Every overlay has `id`, `type`, `state`, `provenance`, `depends`, `basis`, and
`data`. State is `current` or `stale`. IDs remain stable while the same claim
is revised. Mint a new ID for a different claim. Types are `nominal`, `groove`,
`harmony`, `role`, `motif`, `meter`, `tempo`, and `region`.

Provenance has `kind` (`declared`, `measured`, or `inferred`), nonempty `source`,
and nonempty `method`. Optional `confidence` is a binary64 number in `[0,1]`.
Omission means no confidence claim. Declared states an author's choice.
Measured states an observation or calculation from observations. Inferred
states an interpretation from a rule or provider. Provenance is required; do
not infer intent from a late onset. A current overlay is a current claim under
its recorded dependencies, not proof that its interpretation is musically true.

Depends has `events`, `clips`, `overlays`, and `membership` arrays. Each event
or clip dependency has `id` and a nonempty unique `fields` set. Overlay
dependencies are IDs of whole overlays. Membership contains clip IDs whose
entire event-ID set affects the claim. All arrays can be empty, but R13-R20
set minimum dependencies. Field paths are top-level fields; `expression`
depends on the whole expression object. `basis` is the R22 dependency digest.
An overlay refers only to this document, never to an unresolved external event.

## R13 — Nominal rhythm

Nominal data has `event`, rational `at`, `duration`, and `division`. Division
is the spacing of the nominal rhythmic lattice in beats. Require `at/division`
to be an integer; nominal duration need not be a multiple of division. Depend
on that event's `at,duration,clip` fields. There is at most one current nominal
overlay per event. Nominal values do not force a note edit. Triplet, quintuplet,
and septuplet divisions can be `1/3`, `1/5`, and `1/7`.

## R14 — Groove and timing intent

Groove data refers to `event` and its nominal overlay `nominal`. It has
`intent` (`resolved` or `unresolved`), rational `phase`, `template`, `cross`,
`local`, `unassigned`, `durationIntent`, and `durationUnassigned`; also
`atDelta` and `durationDelta`, each a rational or null. Optional `sourceAt`
and `sourceDuration` form a pair. Optional `templateRef` is a nonempty opaque
template name, `swing` is a pair of positive integer weights, `shape` is
`{kind:"point"}` or `{kind:"span",width:<positive rational>}`, and `anchor`
is another event ID. Swing and templateRef identify a declared interpretation;
they do not generate timing by themselves. A transferable template consists
of these components plus the referenced nominal divisions and positions.

Depend on the subject's `clip,at,duration`, its nominal overlay, and the
anchor's `clip,at` when present. Anchor must be in the same clip. There is at
most one current groove overlay per event. A current groove requires a current
nominal dependency. R15 defines known-source timing; R16 defines unknown-source
timing. Neither mode edits the core event.

## R15 — Known-source groove equations

If sourceAt and sourceDuration are present, both deltas must be rational.
R07 must map those source values to the core timing and supplied deltas.
With `n` as the nominal overlay and `g` as the groove overlay, require:

```text
deviation = g.phase + g.template + g.cross + g.local + g.unassigned
sourceAt = n.at + deviation
event.at = n.at + deviation + g.atDelta
sourceDuration = n.duration + g.durationIntent + g.durationUnassigned
event.duration = sourceDuration + g.durationDelta
```

Resolved intent requires unassigned and durationUnassigned to be zero.
Measured provenance requires unresolved intent and zero phase, template,
cross, local, and durationIntent. The unassigned terms then state differences,
not causes. Declared or inferred provenance can assign causes. Inferred source
timing is an estimate, not a recovered host observation. Never put acquisition
displacement in phase, template, cross, local, or durationIntent.

For source onset `1/3`, duration `1/6`, and no intentional deviations:
event onset is `85/256`; event duration is `85/512`. Nominal onset is `1/3`;
nominal duration and division are `1/6` and `1/3`. The onset delta is `-1/768`;
the duration delta is `-1/1536`.
The onset delta is quantization displacement. It is not negative swing.

## R16 — Unknown-source timing and time display

Without source timing, both deltas must be null, intent must be unresolved,
and all intentional terms must be zero. Require
`unassigned = event.at - nominal.at` and
`durationUnassigned = event.duration - nominal.duration`.
These residuals include an unknown acquisition component. Do not identify them
as a template, phase, or local cause. This mode permits useful nominal labels
on cell-only observations without inventing precise pre-acquisition timing.

Millisecond values are not serialized timing fields. A display can derive
`60000 * component / bpm` using the tempo active at nominal onset. This is a
local tempo-qualified display, not integration across tempo changes. If tempo
is unknown or has conflicting current interpretations, do not supply the display.
Any interpretation derived from tempo must list the relevant tempo overlay in
depends.overlays. Beat relationships do not otherwise depend on tempo.

## R17 — Harmony

Harmony data has `clip`, positive span `from,to`, `events` (a unique ID set),
and optional `chord` and `key` strings. At least one nonempty label is required.
The span is within the clip. Event members must start within the span and clip.
Depend on each member's `clip,pitch,at,duration` and the clip's `length`.
Depend on clip membership to detect added notes. Labels are uninterpreted
musical text; 1.0 does not require one chord spelling or theory engine. Empty
membership permits a declared chord region. Interpretation does not transpose
or add notes.

## R18 — Roles and motifs

Role and motif data have `clip`, nonempty `label`, and unique `events` sets,
which can be empty for a declared future group. Depend on the clip's `length`,
clip membership, and each member's `clip,pitch,at,duration`. Optional data
`articulation` is a nonempty interpretation label. Realized event articulation
is a separate property. Roles can name melody, bass, or another function.
Motifs name groups for continuation or transformation; no automatic pattern
expansion is part of this contract.

## R19 — Meter and tempo

Meter data has `clip`, rational `at`, integer numerator 1..64, and denominator
in `1,2,4,8,16,32,64`. Tempo data has `clip`, rational `at`, and binary64
`bpm` in `(0,1000]`. Depend on clip length. Positions are in `[0,length)`,
or exactly zero for a zero-length clip. Meter denominator describes the
notated beat unit; it does not redefine the quarter-note coordinate unit.
Changes take effect at their position and continue until the next current
overlay of the same type in that clip. Require at most one current meter
and one current tempo at each position. No default meter or tempo is inferred.
Missing an initial point means context before the first point is unknown.

## R20 — Regions

Region data has `clip`, nonempty `label`, rational `from,to`, and a unique
`events` set. Require `0 <= from < to <= length`. Members must start inside
the span and clip. Depend on clip length, clip membership, and each member's
`clip,at`. Groups are explicit. Adding a note does not silently add it to a
region, role, motif, or harmony. A later revision can change the group and basis.

## R21 — References and dependency graph

Reject every dangling reference, including one in a stale overlay. Reject
duplicate overlay IDs, repeated dependency IDs, duplicate field paths,
self-dependencies, and cycles between overlays. Dependencies can exceed a
type's minimum when the method uses more fields. They cannot omit its minimum.
Reject unknown dependency paths. Referenced event fields must be covered.
A current overlay cannot depend on a stale overlay.

Deleting an event or overlay requires explicit removal or replacement of each
overlay that refers to it. A stale flag cannot retain a dangling ID. An added
event invalidates each overlay that depends on that clip's membership. It does
not enter an explicit group. Removing a nonmember can still change a membership
dependency. Stable IDs alone never establish that a claim is current.

## R22 — Dependency basis

Compute basis as SHA-256 over UTF-8 of `ghostnote-dependencies/1.0\n` followed
by the R26 canonical JSON for this projection:

```text
{"events":[{"id":ID,"values":{FIELD:VALUE,...}},...],
 "clips":[{"id":ID,"values":{FIELD:VALUE,...}},...],
 "overlays":[OVERLAY,...],
 "membership":[{"clip":ID,"events":[EVENT_ID,...]},...]}
```

Only declared dependency fields enter values, with defaults expanded. Each
array is sorted by ID (membership by clip). Membership IDs are sorted.
Overlay dependencies use full normalized envelopes with only their `basis`
key omitted. Their dependency ID arrays are normalized under R25. This omits
recursive basis values while retaining data, provenance, state, and dependency
definitions. Hashing needs no host access. A current overlay's basis must match
the current projection. A stale overlay keeps the basis of the prior projection;
it can match current values after an undo and still remain stale.

## R23 — Edit lifecycle

Compare dependency values, not raw syntax. A change outside the dependencies
preserves the overlay and basis. A changed dependency marks a retained current
overlay stale and retains its data and prior basis. Propagate stale state in
dependency order to dependent overlays. Do not silently recompute an inferred
or measured value. Do not automatically revalidate a stale overlay after undo.

An explicit overlayPut can recompute or reaffirm a claim: supply the full
envelope, matching new basis, and provenance for the method. It can use the
same ID. This is an explicit declaration, not proof of truth. An explicit
stale replacement is also allowed. Removing an overlay changes no event.
In a desired replacement, an unchanged retained envelope gets this lifecycle
handling. A changed envelope is an explicit replacement. A caller cannot
update just the basis to conceal an old claim without an explicit replacement.

## R24 — Stale data use

Validate stale structure, field types, sign constraints, and live references.
Do not require old basis equality, old span membership, groove equations,
current nominal/groove uniqueness, or current dependency state for a stale
claim. Its values describe a previous context. Do not apply stale overlay
values as instructions or use them as current analysis. Current overlays must
pass all type-specific relationships and basis checks. A patch can keep stale
claims, remove them, or replace them explicitly.

## R25 — Semantic normalization and ordering

Normalize rational spellings and scalar numbers. Expand covered defaults for
validation and dependency calculations; canonical output omits optional values
equal to defaults. Keep unknown fields unknown. Default-valued and omitted
covered values have the same meaning. Preserve empty root metadata strings.
Omitted root meta/extensions normalize to `{}` and are omitted on output.
Empty meta/extensions normalize the same way. All required arrays remain.

Sort clips and coverage by clip ID, overlays by overlay ID, and patch change
arrays by addressed ID. Sort events by clip ID, exact at, channel, pitch, then
ID. Sort all ID/field/channel sets, using ASCII ordering for text and numeric
ordering for channels. A coverage field set with every 1.0 event field
normalizes to `"all"`. Dependency arrays sort by ID. Swing weight order has
meaning and is never sorted. No other 1.0 array has sequence meaning. Arrays
inside inert extensions retain order. Do not use locale ordering.
Snapshot, desired, and patch kinds remain distinct semantic values.

## R26 — Canonical output

Canonical JSON has recursively sorted object keys in Unicode scalar order,
no insignificant spaces, UTF-8, and no terminal newline in its hash input.
Encode quote and backslash with their JSON escapes. Use short escapes for
backspace, tab, LF, form feed, and CR; use lowercase `\u00xx` for other controls.
Emit other Unicode scalars literally, including slash. Numbers use ECMAScript
JSON.stringify binary64 spelling, with negative zero as `0`. Integer fields
must fit their declared integer range; other numeric fields mean finite
binary64 values. Non-timing numeric decimal/exponent input is allowed.
Reject numeric overflow. Conversion preserves the parsed binary64 value.

Canonical FIELDS has LF, no indentation or blank lines, one final LF, and
records in this order: DOC, META if nonempty, BASE if present, EXTENSIONS if
nonempty, CLIP records, COVERAGE records, FIELDS, then EVENT records, then
OVERLAY records. Patch body order is REMOVE, UPDATE, ADD, CLIP_UPDATE,
OVERLAY_REMOVE, OVERLAY_PUT. Within each record type use R25 ordering.
The canonical binding is always `id clip at duration pitch velocity channel mute`.
Always emit those eight slot values. Emit other nondefault properties in WITH.
IDs and rational slots use bare text; numeric and boolean slots use canonical
JSON scalars. Compound values use R26 JSON. Use one space between tokens.
Canonical ADD uses the same binding and WITH policy as EVENT.

## R27 — Content identity

Content SHA-256 is UTF-8 of `ghostnote-document/1.0\n` followed by R26 canonical
JSON of the R25 normalized semantic document. Include kind, IDs, metadata,
coverage, base guard, extensions, values, and overlay lifecycle/provenance.
Exclude FIELDS binding and all serialization layout. A reordered binding with
equivalent values has the same identity. A renamed event ID changes identity.
An empty patch's own hash differs from its base; its materialized result has
the base's hash if the base was an unguarded desired document. Snapshot kind
and guarded desired kind are different hash domains within this model.
Do not confuse this content hash with an exact host-source or dependency hash.
Do not put a document's own content hash inside that document.

## R28 — Bounds

Require these limits before expensive work: UTF-8 input at most 8 MiB; at most
256 clips, 131072 events, 32768 overlays, and 131072 total patch entries.
JSON nesting is at most 32 containers, with the root container at depth 1.
A string is at most 4096 Unicode
scalars, except IDs (R01) and rational text. Each unreduced rational numerator
and denominator is at most 96 decimal digits; each reduced value has the same
limit. Exact temporary arithmetic is at most 4096 bits per integer. Exceeding
a limit is a resource error, not rounding. Binary64 source conversion can use
its exact larger intermediate fraction within that bit limit, then enforce
the external digit limit on any emitted source timing.

At most 1024 dependencies per overlay and 262144 declared field references
across all overlays are allowed. Each explicit overlay group has at most
131072 members, subject to input and reference limits. Extension data shares
all input, string, and depth limits. Do not interpret these as host cache limits.
Reject the first detected limit breach without constructing a partial document.

## R29 — Errors and unsupported input

Errors identify the rule, JSON path or FIELDS line and column, offending field
or reference, and a short reason. No successful conformance parse uses recovery.
Reject malformed headers, missing arrays, missing bindings, surplus row values,
unknown enum values, invalid references, and invalid numbers. Pattern code,
expression automation curves, MIDI sysex, controller messages, audio events,
external overlay references, and implicit recurrence expansion are outside 1.0.
Do not silently discard them. A future recovery tool must be a separate API.

## R30 — Authority and host boundary

Portable event and metadata operations are representational edits. Snapshot
values have observation authority only within their declared coverage and
acquisition boundary. Desired and patch values are proposals. Overlay authority
is given by provenance. A host binding declares observability, writability,
freshness, identity recovery, conflicts, normalization loss, and readback.
Pressure can be represented even when a host cannot write it. Preserve it or
refuse its requested reconstruction; never convert it to zero because of an
API limit. Host defaults or capabilities cannot alter portable defaults.

## R31 — Conformance ownership

8f2 must implement every case family in [CONFORMANCE.md](CONFORMANCE.md), with
rule-to-test links, independent expected values, both encodings, canonical
stability, and hash equality. No codec conformance or live capability is claimed
by this session. Retained benchmark fixtures require explicit adaptation to
1.0; frozen artifacts remain unchanged. Separate acquisition loss, codec loss,
and musical task failure in every report.

## R32 — Specification dependencies

The [JSON schema](schema.json) uses the
[JSON Schema 2020-12 dialect](https://json-schema.org/draft/2020-12/json-schema-core).
It is local and has no network references other than its dialect identifier.
The normative grammar uses the EBNF conventions stated in its header. R01-R31
and FIELDS.md govern conditions that the schema cannot express. A later codec
must validate both structure and semantics; a schema-only pass is insufficient.

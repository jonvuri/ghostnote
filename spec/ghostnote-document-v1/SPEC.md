---
title: Ghostnote Document 1.0 specification
kind: specification
state: active
updated: 2026-11-08
source: ../../context/decisions/d25-fields-json-document-format-and-publication.md
---

# Ghostnote Document 1.0

This is the Phase 8f1 target contract. It is not an external release. The
[reference codec](CODEC.md) implements this contract in 8f2.
The [field reference](FIELDS.md), [grammar](fields.ebnf), and
[JSON schema](schema.json) are normative parts of this contract. The
[case inventory](CONFORMANCE.md) assigns cases to every rule below.
[Examples](EXAMPLES.md) supply paired inputs. The [host handoff](HOST-HANDOFF.md)
links the 8f3 binding rules. These artifacts do not change `normal-v1` or a live tool.

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

Snapshot and desired documents have `clips`, `coverage`, and `events`
arrays, including empty arrays. Optional `meta` has `title`,
`description`, and `permission` strings. Omission means no supplied metadata;
an empty string is a supplied value. Root metadata has no musical effect.
Optional `base` names an earlier document with `sha256` and optional `ref`.
A patch requires `base`. Snapshot forbids it. Desired can omit it for new work.
`ref` is an opaque external locator. Its resolution belongs to the binding.

Every event has one `clip` reference. Clip IDs and event IDs each have their
own document-wide namespace. Equal IDs in different namespaces are
allowed. Beat zero is the start of each clip's stored coordinate plane. One
beat is one quarter note. Tempo does not change beat coordinates. Clip IDs can
describe multiple parts. A host track ID or launcher address is not a core field.

## R03 — Clips and coverage

A clip has `id`, rational `length`, and optional `name`, `loop`, `playRange`,
`provenance` (R33), and `defaults` (R34).
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
only covered fields. A covered omitted optional field means its clip default
(R34), or its portable default when the clip states none. An uncovered field is unknown, even if its default is usually zero.
`"all"` covers every field in the 1.0 field reference.

A desired document requires complete coverage of `[0,length)` on all 16
channels, with `fields:"all"`, for every clip. Thus its omitted properties are
defaults, not a request to preserve earlier values. Empty documents have all
three arrays empty. An empty clip still has a clip and coverage record.
A snapshot can be partial or have unknown properties. It remains convertible;
it is not a complete desired replacement.

## R04 — Event values and defaults

Use the types, units, defaults, authority, and operations in [FIELDS.md](FIELDS.md).
An event requires `id`, `clip`, `at`, `duration`, `pitch`, and `velocity`.
Channel defaults to 1 and mute defaults to false. Optional values have one
portable default. A default can equal a measured host insertion value, as
release velocity `100/127` does, but it does not define a host insertion
policy. A clip default (R34) states one value for the events of one clip; it
does not change the portable default. Realized properties belong to the event.

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
document. The conversion guarantee preserves represented values after acquisition.
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
and collision groups. Compare overlap intervals within each clip, including
pairs on different channels or pitches. Report a changed interval even when
the pair overlaps before and after import. If imported source notes share a
normalized address, reject materialization and report all source IDs. Do not pick a
winner. A D23 host cell observation can already contain an unknown survivor.
Label that acquisition boundary; do not claim that its scan recovered lost
source IDs or that its collision count is known. Rounding rules do not select
which source onset Bitwig exposes.

## R08 — Sparse patch structure

A patch has required `add`, `remove`, `update`, and `clipUpdate` arrays, which
can all be empty. It has no full state arrays or coverage. Add contains events.
An added event that omits an optional field takes its base clip's canonical
default (R34), else the portable default; a patch keeps explicit values in its
adds, including a portable default value. Remove contains event IDs. Update
entries have `id` and nonempty `set`. Set contains editable event fields; it
cannot change `id` or `clip`. ClipUpdate entries have `id` and nonempty `set`
for `length,name,loop,playRange,provenance`. Patch cannot add or remove a clip
container. Use a desired document for a different clip inventory.

Optional patch meta and extensions are annotations of the patch itself. They do
not change the base root annotations.

## R09 — Preservation, clearing, references, and order

Apply a patch atomically against a document with matching R27 content hash.
The pure reference materializer requires a full base: complete span coverage,
all channels, and all fields for each clip. Refuse a partial or unknown base.
A proposal can name a partial snapshot, but applying it needs a binding that
resolves the missing state and checks its guard. That policy belongs to 8f3.

Unmentioned values and events remain unchanged. A null in `set` resets an
optional event property to its portable default, also in a clip that states a
default. It does not mean unknown. Null is forbidden for required onset,
duration, pitch, and velocity. Name null resets to `""`; range and provenance
null remove that declaration. Length cannot be null. An update with a value
equal to the existing value is a no-op. Empty patch is a no-op. Removing a
missing ID, updating a missing ID, or adding an existing ID is an error, not a
no-op.

Reject repeated IDs within each array and one event ID in more than one of
add/remove/update. ClipUpdate has one entry per clip. Treat arrays as sets of
changes. Input order cannot determine the result. Form the final clips and
events, then validate the entire result before accepting it. Report changed
event and clip fields, defaults cleared, and added/removed IDs. No-op reports
have no changes.

A desired replacement keeps matching IDs and removes omitted events. It does
not preserve unnamed event properties or clip provenance. It is full state,
unlike a patch. Reject an unknown base guard. A pure result is a desired
document without the proposal's `base`. Preserve base root annotations during
patch materialization. Do not include patch annotations in that result.

## R10 — FIELDS records

The normative [EBNF](fields.ebnf) defines record syntax. The first nonblank line
is `DOC ghostnote-document 1.0 <kind>`. Exactly one `FIELDS` binding follows
the envelope records and precedes all event rows, even for empty inputs. A
binding contains unique event field names: the six required R04 fields and any
optional fields that rows set. Each EVENT or ADD row has exactly one value per
bound field. `_` omits an optional field; the event then takes its clip default
(R34) or portable default. `_` cannot omit a required field. An optional `WITH` JSON
object carries unbound event fields. Reject a field in both the binding and
WITH, even when the row has `_`. There is no implicit positional binding.

CLIP, COVERAGE, META, BASE, EXTENSIONS, UPDATE, and CLIP_UPDATE use the same
JSON objects as their corresponding JSON encoding. An UPDATE or CLIP_UPDATE
record takes an ID and its set object. It maps to `{id,set}`. REMOVE takes one
ID. OVERLAY, OVERLAY_PUT, and OVERLAY_REMOVE are refused (R12). Records must
match the document kind. Snapshot/desired use EVENT; patch uses ADD. Multiple
META, BASE, EXTENSIONS, or FIELDS records are errors. JSON-valued records occupy one physical line.
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

Retired by
[D73](../../context/decisions/d73-overlays-removed-for-clip-provenance-and-column-defaults.md).
Document 1.0 has no overlays. Reject an `overlays` key in a state document,
`overlayPut` or `overlayRemove` in a patch, and OVERLAY, OVERLAY_PUT, and
OVERLAY_REMOVE records, with rule R12. A clip names its sources in provenance
(R33); analysis of the notes is not stored in the document.

## R13 — Nominal rhythm

Retired with R12.

## R14 — Groove and timing intent

Retired with R12.

## R15 — Known-source groove equations

Retired with R12.

## R16 — Unknown-source timing and time display

Retired with R12.

## R17 — Harmony

Retired with R12.

## R18 — Roles and motifs

Retired with R12.

## R19 — Meter and tempo

Retired with R12.

## R20 — Regions

Retired with R12.

## R21 — References and dependency graph

Retired with R12.

## R22 — Dependency basis

Retired with R12.

## R23 — Edit lifecycle

Retired with R12.

## R24 — Stale data use

Retired with R12.

## R25 — Semantic normalization and ordering

Normalize rational spellings and scalar numbers. Expand clip defaults (R34) into
the events of their clip, then expand covered portable defaults for validation;
canonical output omits optional values equal to portable defaults. Keep unknown
fields unknown. Default-valued and omitted covered values have the same meaning.
Preserve empty root metadata strings. Omitted root meta/extensions normalize to
`{}` and are omitted on output. Empty meta/extensions normalize the same way.
All required arrays remain. A patch keeps explicit values in its adds, because
an omitted value takes the base clip default (R08).

Sort clips and coverage by clip ID, and patch change arrays by addressed ID.
Sort events by clip ID, exact at, channel, pitch, then ID. Sort all
ID/field/channel sets, using ASCII ordering for text and numeric ordering for
channels. A coverage field set with every 1.0 event field normalizes to
`"all"`. Provenance sources keep their order. No other 1.0 array has sequence
meaning. Arrays inside inert extensions retain order. Do not use locale
ordering. Snapshot, desired, and patch kinds remain distinct semantic values.

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

Canonical JSON is the R25 normalized document. It states no clip defaults.

Canonical FIELDS has LF, no indentation or blank lines, one final LF, and
records in this order: DOC, META if nonempty, BASE if present, EXTENSIONS if
nonempty, CLIP records, COVERAGE records, FIELDS, then EVENT records. Patch
body order is REMOVE, UPDATE, ADD, CLIP_UPDATE. Within each record type use
R25 ordering. Each CLIP record states the canonical clip defaults of R34. The
binding is `id clip at duration pitch velocity`, followed, in field-reference
order, by each optional field that some row cannot omit. A row writes `_` where
its value equals its clip default, or the portable default when the clip
states none; otherwise it writes the value. Canonical output has no WITH. A
canonical ADD binds each optional field that some add states, and writes `_`
only where the add omits it. IDs and rational slots use bare text; other
scalar slots use canonical JSON scalars. Compound values use R26 JSON. Use one
space between tokens.

## R27 — Content identity

Content SHA-256 is UTF-8 of `ghostnote-document/1.0\n` followed by R26 canonical
JSON of the R25 normalized semantic document. Include kind, IDs, metadata,
coverage, base guard, extensions, values, and clip provenance. Exclude the
FIELDS binding, clip defaults, and all other serialization layout: a clip
default and the equal explicit values have one identity. A reordered binding with
equivalent values has the same identity. A renamed event ID changes identity.
An empty patch's own hash differs from its base; its materialized result has
the base's hash if the base was an unguarded desired document. Snapshot kind
and guarded desired kind are different hash domains within this model.
Do not confuse this content hash with an exact host-source hash.
Do not put a document's own content hash inside that document.

## R28 — Bounds

Require these limits before expensive work: UTF-8 input at most 8 MiB. Both
canonical encodings of an accepted semantic document must also fit within
8 MiB. This common bound permits cross-encoding round trips. Native I/O input
is bounded by its JSON size; decoded FIELDS records use the input and canonical
encoding bounds. Require at most 256 clips, 131072 events, 131072 total patch
entries, and 64 provenance sources in each clip provenance.
JSON nesting is at most 32 containers, with the root container at depth 1.
A string is at most 4096 Unicode
scalars, except IDs (R01) and rational text. Each unreduced rational numerator
and denominator is at most 96 decimal digits; each reduced value has the same
limit. Exact temporary arithmetic is at most 4096 bits per integer. Exceeding
a limit is a resource error, not rounding. Binary64 source conversion can use
its exact larger intermediate fraction within that bit limit, then enforce
the external digit limit on any emitted source timing.

Extension data and provenance `read` and `refs` values share all input,
string, and depth limits. Do not interpret these as host cache limits.
Reject the first detected limit breach without constructing a partial document.

Import analysis can retain at most 131072 overlap pairs in each source or
normalized plane. Reject a larger pair set with a resource error. Do not return
a partial import report. This report bound does not restrict codec overlap
representation.

## R29 — Errors and unsupported input

Errors identify the rule, JSON path or FIELDS line and column, offending field
or reference, and a short reason. No successful conformance parse uses recovery.
Reject malformed headers, missing arrays, missing bindings, surplus row values,
unknown enum values, invalid references, and invalid numbers. Pattern code,
expression automation curves, MIDI sysex, controller messages, audio events,
and implicit recurrence expansion are outside 1.0.
Do not silently discard them. A future recovery tool must be a separate API.

## R30 — Authority and host boundary

Portable event and metadata operations are representational edits. Snapshot
values have observation authority only within their declared coverage and
acquisition boundary. Desired and patch values are proposals. Clip provenance
is a pointer with the authority of its author; it is not an observation. A host
binding declares observability, writability,
freshness, identity recovery, conflicts, normalization loss, and readback.
Pressure can be represented even when a host cannot write it. Preserve it or
refuse its requested reconstruction; never convert it to zero because of an
API limit. Host defaults or capabilities cannot alter portable defaults.

## R31 — Conformance ownership

8f2 must implement every case family in [CONFORMANCE.md](CONFORMANCE.md), with
rule-to-test links, independent expected values, both encodings, canonical
stability, and hash equality. The [executed corpus](conformance/v1/README.md)
records codec conformance. Codec conformance does not establish live capability.
Retained benchmark fixtures require explicit adaptation to 1.0; frozen artifacts remain unchanged. Separate acquisition loss, codec loss,
and musical task failure in every report.

## R32 — Specification dependencies

The [JSON schema](schema.json) uses the
[JSON Schema 2020-12 dialect](https://json-schema.org/draft/2020-12/json-schema-core).
It is local and has no network references other than its dialect identifier.
The normative grammar uses the EBNF conventions stated in its header. R01-R31,
R33, R34, and FIELDS.md govern conditions that the schema cannot express. The codec
must validate both structure and semantics; a schema-only pass is insufficient.

## R33 — Clip provenance

A clip can state `provenance`: where its notes came from. It has `sources` (1
to 64 entries) and an optional `generator`; at least one is present. A source
has a nonempty `path` and optional `sha256` (lowercase hex), `range` (positive
`from`/`to` span in source beats), `read` (inert JSON describing the
conversion, such as `{"conversion":"midi-document-v3","track":1}`), and `refs`
(ID keys with nonempty string values, such as Ghostworks IDs). Require `from <
to`. A generator has a nonempty `path` and optional `sha256`. Sources keep
their order.

Provenance is clip metadata: it has no musical effect, content identity
includes it, `clipUpdate` can set it or clear it with null, and a desired
replacement without it removes it. It is a pointer, not an analysis: it holds
no tempo, groove, intent, or other claim about the notes ([D73](../../context/decisions/d73-overlays-removed-for-clip-provenance-and-column-defaults.md)). Paths are
opaque locators; the codec does not resolve them.

## R34 — Clip column defaults

A clip can state `defaults`: a nonempty object of optional event fields and
values, with the event field types. In that clip, an event that omits the
field takes the clip value; an explicit event value wins. A default must name a
field that the clip's coverage covers. Defaults are layout, like the FIELDS
binding: parsing expands them into the events, so the semantic document and its
R27 identity do not contain them.

The canonical defaults of a clip state, for each covered optional field, the
value that every event of the clip has, when the clip has events and the value
is not the portable default. Canonical FIELDS writes them (R26); canonical JSON
does not. In a patch, an added event that omits an optional field takes the
canonical default of its base clip (R08). A `null` in `set` still resets to the
portable default (R09).

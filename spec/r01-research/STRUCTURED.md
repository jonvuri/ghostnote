# R01 research candidates 3 and 4

These bounded JSON surfaces test compact musical context and explicit shared
timing. They are offline prototypes, not proposed product schemas or adopted
replacements for Ghostnote Document. Their implementation is
[structured.mjs](../../brain/benchmarks/r01-candidates/structured.mjs); run
`node --test brain/benchmarks/r01-candidates/structured.test.mjs` from the
repository root.

The forward model-facing C4 surface now uses
[group-local FIELDS](NESTED-FIELDS.md), with note definitions inside their
groups. The JSON C4 below remains its semantic reference and encoding control;
its separate collections do not test the proposed colocation benefit.
C3 now has [explicit-note FIELDS](COMPACT-FIELDS.md), with adjacent nominal
columns and retained shared group context. The JSON C3 below remains its
semantic reference and encoding control.

## Shared fixture contract

Both encoders take a JSON object containing `notes`, with optional `groups`,
`musical`, and other context. A note requires `id`, MIDI integer `pitch`, exact
rational-string `at` and positive `duration`, and finite numeric `velocity`.
Optional `channel` uses Ghostnote's 1–16 convention. Every other JSON note field
is retained, including expression and conditional playback data. The encoder
does not convert velocity units; the common comparison fixture and oracle own
that convention and full host-field admission. Unknown optional fields are
preserved data, not interpreted behavior.

The fixture's `at` and `duration` are the authoritative note performance values.
They can describe exact source timing before normalization. Neither codec
quantizes. Normalized readback comparisons apply the common oracle after
decoding. This permits an ideal triplet or fractional-cell edit to retain its
source value until the explicit realization boundary. A negative pickup is
representable here; that does not claim admission to Ghostnote's current
nonnegative realized plane or to a host.

`notes` order is presentation order, not onset order or identity. Notes have
unique opaque IDs. A group has a unique `id` and `members`, an array of existing
note IDs without duplicates. Groups may overlap, and each note is defined
once. Group/member array ordering is preserved. An optional `presentationOrder`
and an optional `performanceOrder` must each be a permutation of `members`;
their meanings are separate. No current operation derives timing from either
array. Explicit onset values determine performance timing.

Optional group properties include `label`, `prose`, `provenance`, and
`state: "current" | "stale"`. Labels may be conventional or arbitrary.
Prose supplies agent context and has no executable rules. An imported note
does not acquire an inferred chord, nominal onset, or groove merely by being
encoded. Omitted interpretation stays omitted. `provenance.kind: "declared"`
identifies authored intent; `"inferred"` identifies an interpretation. Other
provenance properties are retained without fabrication.

Optional nominal information is an ID map at `musical.nominal`, or a `nominal`
object directly on the note. A note cannot have both definitions. Every mapped
ID must exist. Each entry has exact `at`, optional positive `duration` and
`division`, optional provenance/state, and any additional JSON context. A map
entry uses its explicit provenance, or shared `musical.provenance` when omitted.
This prototype does not require onset to be a multiple of division, decompose
deviation into groove causes, or execute nominal values. Other root `musical`
properties are opaque shared context. Their retention does not establish
checked musical truth or automatic stale-dependency tracking.

## Candidate 3: compact realized notes

`encodeCompact(fixture)` returns:

```json
{
  "format": "r01-compact",
  "version": 1,
  "context": {"groups": [], "musical": {"nominal": {}, "provenance": {"kind": "declared", "source": "composer"}}},
  "rows": [["n1", 60, "3/512", "1", 90, {}, [], {"at": "0"}]]
}
```

A row is exactly
`[id, pitch, at, duration, velocity, optionalFields, groupIds, nominal]`.
`optionalFields` retains every other note property and cannot redefine the five
core fields. `groupIds` explicitly exposes membership adjacent to the note;
it must agree with the authoritative groups in `context`. This intentional
redundancy makes membership available in a note view but has a measurable
payload cost. It is not silently excluded from size measurements. The final
slot carries that note's `musical.nominal` entry or `null`; nominal data is
adjacent to its performance rather than repeated in the shared context.

`context` contains all original fixture fields except `notes`; if
`musical.nominal` was present, its entries move to rows and an empty map marks
their original location. Decode restores the map exactly, including an empty
map when originally present. Shared provenance stays in context. Note-local
nominal data stays in `optionalFields`.
Realized/source note performance remains primary. Optional nominal information
and group/provenance metadata are contextual structures beside that state.
This is a bounded compact syntax prototype, not an implementation of a new
claim engine. Expansion into current Ghostnote nominal/groove claim envelopes
is **not implemented**: their mandatory timing equations, provenance,
dependency bases, and stale rules are stronger and different. Comparisons
must not attribute current claim-engine cost reductions to this codec.

## Candidate 4: grouped timing with direct fallback

`encodeGrouped(fixture)` returns `format: "r01-grouped"`, `version: 1`, the
same `context`, and `rows`. Each row contains one `note` definition and `time`.
For a direct performance note, `time` is `null` and `note.at` remains explicit.
For a timing-owned note, `note.at` is omitted and `time` identifies a group:

```json
{
  "note": {"id": "b", "pitch": 64, "duration": "7/4", "velocity": 84},
  "time": {"group": "c7"}
}
```

The group supplies exact rational `anchor`, optional `delay` (default `0`),
and `spread`, a map from selected member IDs to exact rational offsets:

```json
{
  "id": "c7",
  "members": ["a", "b"],
  "label": "C major fragment",
  "provenance": {"kind": "declared", "source": "fixture"},
  "anchor": "8",
  "delay": "3/512",
  "spread": {"a": "0", "b": "6/512"},
  "presentationOrder": ["b", "a"],
  "performanceOrder": ["a", "b"]
}
```

The equation is `at(member) = anchor + delay + spread[member]`. It must exactly
match the fixture note before encoding. There is at most one timing owner per
note, even if two proposed owners happen to produce equal values. Other groups
can freely reference the same note. A group can label a phrase with no timing
fields; a member missing from `spread` keeps its direct note onset. An anchor
or label never implicitly assigns a missing residual.

`time.spelling` is emitted only when the input onset uses a different exact
rational spelling from the equation's reduced result (for example `2/4`
instead of `1/2`). It preserves lexical input and must numerically equal the
equation; it cannot override timing. Ordinary reduced inputs incur no such
field. The compact surface defines each onset once through its explicit
timing owner, with direct fallback for unknown or irregular structure.

Both decoders accept their object surface or a JSON string and return the
original fixture shape. Extra surface keys, core-field redefinitions,
contradictory equations, duplicate IDs, missing/ambiguous references,
nonfinite JSON values, invalid timing strings, and invalid order permutations
are rejected. Full event-schema validation, host address collisions, and
normalization are responsibilities of the shared oracle/backend. Round-trip
fidelity includes field values and input order; object key order is immaterial.

## Editing and interpretation lifecycle

`editNote(fixture, id, set)` performs a sparse field update and returns
`{fixture, changes}`. Missing fields are preserved. Renaming IDs through this
helper is refused; `null` is an ordinary JSON value, not a clearing operator.
An onset edit recomputes that note's explicit residual as
`at - anchor - delay`, retaining anchor and common delay. This maintains the
mechanical timing equation; it does not infer why the note moved. Pitch edits
change only pitch. Duration stays fixed when moving an onset.

`scaleGroupSpread(fixture, groupId, factor)` requires an existing, non-stale
group with explicit anchor/spread and a nonnegative exact rational factor.
It scales only the declared spread entries, then computes their note onsets.
Members without an explicit entry remain unchanged. It preserves common delay,
note duration, velocity, channel, expression, all other performance fields,
membership, and presentation/performance orders. Fractional-cell results stay
exact until the external realization boundary. Prose and labels cannot supply
the missing anchor/spread. There is no randomness.

Both helpers clone their input and report changes as
`{notes: [{id, fields}], groups: [{id, fields}], nominal: [{id, fields}]}`;
`nominal` reports changes in the shared ID map. Any inferred group whose
member pitch, onset, or duration changes becomes `state: "stale"` while
retaining its prior label and provenance. An inferred per-note nominal claim
becomes stale when its onset or duration changes, including mapped entries
using shared provenance. Pitch-only edits do not stale nominal timing.
Authored labels and nominal
values remain authored intent and are not silently relabeled. Velocity-only
changes do not stale these bounded pitch/timing interpretations. Stale groups
remain readable context and preserve numerical timing equations, but cannot
drive `scaleGroupSpread` until explicitly reasserted by a caller. Encoding or
decoding never revalidates interpretation state.

These deliberately narrow rules differ from current Ghostnote claim
dependencies. They do not implement generalized dependency tracking, repair
stale analyses, attach other opaque root `musical` metadata to changed notes, or
establish persistent identity across host sessions. The shared guarded
backend must handle stale base inputs and concurrent edits; these pure helpers
alone offer neither concurrency protection nor host mutation.

## Golden edits and limits

For the group above, `a.at = 4099/512` and `b.at = 4105/512`.
Halving spread produces `a.at = 4099/512`, `b.at = 2051/256`, and
`spread.b = 3/512`. Common lateness remains `3/512`. Note `b` retains its
`7/4` duration and velocity `84`. Editing `b.pitch` to `65` leaves both onsets
unchanged; an overlapping inferred phrase label becomes stale. Editing
`b.at` to `4109/512` recomputes `spread.b = 5/256` without altering common
delay. Halving a spread of `1/512` produces `1/1024`, not an implicit rounded
cell. Executable assertions cover these examples in
[structured.test.mjs](../../brain/benchmarks/r01-candidates/structured.test.mjs).

This arm does not implement pattern instances, generated musical explanation,
automated harmonization, dynamic reconstruction, generalized merging, or
claim-envelope equivalence. The complete extra note fields are stored directly
rather than compressed by musical intent. Shared timing must earn any payload
advantage on regular examples, and irregular examples must expose the cost of
direct fallback and optional context. Codec tests demonstrate offline
representation and edit behavior, not musical quality, agent benefit, or DAW
readback fidelity.

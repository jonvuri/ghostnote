# Compact JSON v1 schemas

The executable schemas use canonical JSON for rendering. Parsers can accept
JSON whitespace and object-key order changes. They reject collection order
changes and schema changes.

## Common document structure

Each JSON document has these top-level fields:

| Field | Meaning |
|---|---|
| `schema` | The exact arm and schema version. |
| `score` | Score identity, source hash, and tempo. |
| `bars` | Ordered bar metadata. |
| `tracks` | Ordered track metadata. |
| `regions` | Ordered region metadata and track links. |
| `notes` | Ordered note events and region links. |

The canonical collection order is bar start, track ID, region track and ID,
then note start, voice rank, pitch, and note ID. IDs must be unique in each
collection. Every region must refer to a track. Every note must refer to a
region.

Starts and durations are canonical rational strings. Starts can be zero or
positive. Durations must be positive. Tempo is from 20 through 400. MIDI
channel is from 0 through 15. Velocity is from 0 through 127.

## Object shape

The object arms use these fields:

| Entity | Fields |
|---|---|
| Score | `id`, `source_sha256`, `tempo_bpm` |
| Bar | `id`, `number`, `start`, `duration`, `meter`, `harmony` |
| Track | `id`, `name`, `role`, `midi_channel` |
| Region | `id`, `track_id`, `start`, `duration` |
| Note | `id`, `region_id`, `voice`, `start`, `duration`, `pitch`, `velocity` |

No extra field is permitted.

## Tuple shape

The tuple arms use named top-level collections. They do not mix entity types
in one array. Each tuple has this fixed position order:

| Entity | Positions |
|---|---|
| Score | `id`, `source_sha256`, `tempo_bpm` |
| Bar | `id`, `number`, `start`, `duration`, `meter`, `harmony` |
| Track | `id`, `name`, `role`, `midi_channel` |
| Region | `id`, `track_id`, `start`, `duration` |
| Note | `id`, `region_id`, `voice`, `start`, `duration`, `pitch`, `velocity` |

A tuple with a missing or extra position is invalid.

## Pitch values

The MIDI cells use one integer from 0 through 127. The pitch-class/register
cells use one `[pitch_class, octave]` pair. Pitch class is from 0 through 11.
The conversion is:

```text
midi = 12 * (octave + 1) + pitch_class
```

The converted MIDI value must be from 0 through 127. A document or patch never
contains both pitch encodings.

## Sparse patches

Each patch has `schema`, `base_sha256`, and `ops`. The object operation is:

```json
{"op":"set-note","id":"n1","changes":{"velocity":87}}
```

The tuple operation is:

```json
["set-note","n1",{"velocity":87}]
```

The `changes` object can contain `voice`, `start`, `duration`, `pitch`, or
`velocity`. It must contain at least one field. A pitch change uses the arm's
single pitch encoding.

Object and tuple patches have the same semantics. The compiler rejects a
stale base, an unknown target, an unsupported field, or more than one
operation for the same note ID. Unchanged fields and all other notes stay
exact.

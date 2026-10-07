---
title: Ghostnote Document 1.0 field reference
kind: reference
state: active
updated: 2026-10-07
---

# Field reference

This table defines [R04](SPEC.md#r04--event-values-and-defaults). The
[schema](schema.json) gives the same types. Defaults are portable choices.
They are not measured Bitwig defaults. `number` means finite binary64.
Compound defaults are atomic values, not partial objects. An explicit compound
value must supply all its keys. All field names in this document are exact.

## Event fields

| Field | Type and unit | Default | Authority | Portable operations |
|---|---|---|---|---|
| `id` | ID; opaque handle | Required | Document identity | Add, remove; cannot update |
| `clip` | Clip ID | Required | Document reference | Add; cannot update |
| `at` | Nonnegative rational beats on `1/512` | Required | Realized timing | Add, update |
| `duration` | Positive rational beats on `1/512`, minimum one cell | Required | Realized timing | Add, update |
| `pitch` | Integer 0..127; MIDI note number | Required | Realized pitch | Add, update |
| `velocity` | Integer 0..127; MIDI attack velocity | Required | Realized performance | Add, update |
| `channel` | Integer 1..16; MIDI channel | 1 | Realized address | Add, update, reset |
| `mute` | Boolean | false | Realized performance | Add, update, reset |
| `releaseVelocity` | Number 0..1; normalized release velocity | `100/127` in binary64 (`0.7874015748031497`) | Realized performance | Add, update, reset |
| `articulation` | Nonempty string; author label | `"normal"` | Declared event property | Add, update, reset |
| `expression` | Full object below; scalar note expression | Object below | Realized performance | Add, atomic update, reset |
| `chance` | `{enabled:boolean,value:number 0..1}`; probability | `{enabled:false,value:1}` | Realized playback condition | Add, atomic update, reset |
| `occurrence` | `{enabled:boolean,condition:nonempty string}` | `{enabled:false,condition:"always"}` | Realized playback condition | Add, atomic update, reset |
| `recurrence` | `{enabled:boolean,length:integer 1..64,mask:integer 0..9007199254740991}` | `{enabled:false,length:1,mask:1}` | Realized playback condition | Add, atomic update, reset |
| `repeat` | Full object below; finite note repeat controls | Object below | Realized playback condition | Add, atomic update, reset |

Disabled controls retain their value, condition, mask, and curves. Do not
discard them. A disabled nondefault value changes semantic identity. Recurrence
bit zero addresses the first cycle. Require `mask < 2^length`. A zero mask
selects no cycles. The exact-number mask supports bits 0..52; longer cycle
lengths can retain zero high bits. Do not round a larger integer mask. A future
version can add a string bitset. Occurrence labels are opaque portable strings;
a binding must map or refuse them. Chance, occurrence, recurrence, and repeat
describe event controls. The codec does not expand or simulate playback.

Null values are not allowed in event objects. Patch `set` permits null for
each defaulted field, as an explicit reset. Complete desired omission means
default. Snapshot omission means default only when coverage contains that
field. A covered explicit default is equivalent to omission. Uncovered fields
are unknown and must be absent. A sparse update omission always preserves.

## Expression object

| Key | Type and unit | Default |
|---|---|---|
| `velocitySpread` | Number 0..1; normalized velocity spread | 0 |
| `gain` | Number 0..8; linear amplitude ratio | 1 |
| `pan` | Number -1..1; left to right | 0 |
| `pressure` | Number 0..1; normalized pressure | 0 |
| `timbre` | Number 0..1; normalized timbre | 0.5 |
| `transpose` | Number -128..128; semitones, fractions allowed | 0 |

Expression is a scalar object. Automation curves are outside 1.0. Pressure is
fully supported as a document value. The measured Ghostnote write path cannot
write pressure. The [host binding](HOST-BINDING.md) defines preservation and refusal.
The gain value is a portable amplitude ratio. It is not a raw setter input.
Host scaling belongs to the binding. Expression updates replace the complete
object; callers must copy the unchanged members when updating one member.

## Repeat object

| Key | Type and unit | Default |
|---|---|---|
| `enabled` | Boolean | false |
| `count` | Integer 1..128; total triggered repeats | 1 |
| `curve` | Number -1..1; normalized timing curve control | 0 |
| `velocityCurve` | Number -1..1; normalized velocity curve control | 0 |
| `velocityEnd` | Number 0..1; normalized final velocity control | 1 |

The document retains controls without defining a host-specific playback curve.
Do not generate a second note list from repeat controls during conversion.

## Other fields and omission

| Value | Type / default or omission | Authority and operation |
|---|---|---|
| Root format/version/kind | Required exact strings | Contract; immutable within a patch |
| Root arrays | Required, including `[]` | Represented inventory; R02, R08 |
| `meta` | Optional title/description/permission strings; absent means no supplied values | Document annotations; complete input only |
| `base` | Required for patch; optional for desired; absent for snapshot | Content guard; external resolution is 8f3 |
| `extensions` | Optional namespaced inert JSON values; absent equals `{}` | Annotations; preserved, never executable |
| Clip ID/length | Required ID/nonnegative rational beats | Portable metadata; length update only |
| Clip name | String; default `""` | Portable metadata; update/reset |
| Clip loop/playRange | Rational `{from,to}` or null; default null | Portable range declarations; update/reset |
| Coverage | Required per clip; no implicit values | Observation completeness and known-field declaration; never a patch edit |
| Overlay identity/type/state | Required; no default | Claim lifecycle; full put/remove |
| Overlay provenance | Required kind/source/method; confidence optional | Claim authority; no inferred default |
| Overlay dependencies/basis/data | Required; no default | Dependency state and claim values; full put/remove |

No root metadata string gives permission to apply a live edit. Permission text
can record the source or fixture rights. Live permission remains a separate
host boundary. Clip names and articulation labels do not resolve host targets.

## Portable and host fields

Portable fields are all fields in this reference and the overlay definitions
in [R12-R24](SPEC.md#r12--initial-overlay-envelope). The portable contract
supports observation, proposal, and pure materialization within these limits.
It does not require a host to expose or write every supported value.

Host track IDs, launcher rows, project generations, exact-source hashes,
address recovery, property read tolerances, gain setter scaling, supported
occurrence labels, pressure writability, note-address movement, and reversal
fidelity are defined by the [host binding](HOST-BINDING.md). Do not put them into core positional
rows. An opaque base ref can identify a binding object without exposing its
mechanics. A coverage reason can describe a useful limitation.

## Normalization and extensions

Only [R07](SPEC.md#r07--acquisition-and-import-normalization) changes finer
source timing. Field defaults, rational reduction, and canonical ordering are
semantic normalization. They do not change represented timing. Extension
values use their JSON values exactly, with R26 number/string normalization.
They are not scanned for hidden timing fields or executable declarations.

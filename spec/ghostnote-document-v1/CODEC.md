---
title: Ghostnote Document 1.0 reference codec
kind: guide
state: active
updated: 2026-10-01
---

# Reference codec

The [TypeScript library](../../brain/src/document/index.ts) implements the
[version 1.0 contract](SPEC.md). It has no runtime package dependency. It needs
Node.js built-in modules and exact `bigint` arithmetic. It does not read a host,
cache, credential, or provider. The native types define this I/O boundary.
They do not replace the existing musical, host, or cache types.

## Library I/O

| API | Input and result |
|---|---|
| `parse(input, encoding)` | UTF-8 bytes or a scalar string; `fields` or `json`; returns a validated, normalized `Document` |
| `validate(value, options?)` | Native JSON data; returns a detached normalized document; optional `requiredExtensions` refuses requested unknown behavior |
| `serialize(document, encoding)` | Validates and returns canonical bytes as a string; JSON has no final LF, FIELDS has one |
| `convert(input, from, to)` | Strict parse and canonical serialization; timing is unchanged |
| `contentHash(document)` | R27 SHA-256 over normalized content and its domain prefix |
| `dependencyBasis(base, claim)` | R22 basis from a valid state base; the claim can be outside the base |
| `sealOverlays(state)` | Sets bases for explicitly supplied current claims in dependency order; then validates all relationships |
| `applyPatch(base, patch)` | Checks the guard and full coverage; returns desired state and a change report |
| `applyDesired(base, desired)` | Checks the guard and complete desired input; returns replacement state and a change report |
| `normalizeTiming(at, duration)` | Explicit R07 acquisition from exact strings or host binary64 values; reports both deltas and minimum promotion |
| `importNotes(sourceNotes)` | Validates event fields, normalizes timing, and reports source values, collisions, and changed overlap intervals |
| `observeCells(cells)` | Labels acquired `bigint` cell indices with the D23 boundary; does not floor cell indices or claim recovered source IDs |
| `timingDisplay(state, clip, nominalAt, component)` | Exact local milliseconds with BPM and the required tempo dependency; returns null when current tempo is unknown |

Native timing fields are rational strings. Numeric host timing enters only
`normalizeTiming`, `importNotes`, or the declared cell observation utility.
The codec never calls acquisition normalization to repair a document. Groove
validation uses R07 to check a declared source; it does not change the event.
Display values are outside the serialized document.

Canonical native results omit covered default properties. An omitted snapshot
field can be unknown. Read coverage before a caller expands defaults. Compound
properties stay atomic. Inert extension arrays retain order. The validator
rejects native values that JSON would discard, including accessors, array
holes, extra array properties, undefined values, and nonfinite numbers.

All calls return new document data. Application validates the complete result
before return. A failed call leaves its inputs unchanged. Change reports name
event additions/removals, changed event and clip fields, fields reset to
defaults, and overlay changes. An empty report is a no-op. Patch annotations
remain on the proposal; its result retains base annotations.

`sealOverlays` is for an explicit new or revised claim. It is not a stale-state
repair operation. It does not recalculate interpretation data or provenance.
Callers must supply these values. It leaves stale bases unchanged. Normal
patch application makes retained claims stale when their dependencies change.
An undo does not make a stale claim current.

`ImportCollisionError` contains the full collision report and returns no
events. All source IDs in each collision group remain in the report. Overlap
analysis compares intersecting intervals within a clip, including different
pitches and channels. Each plane permits at most 131072 overlap pairs. A
resource failure returns no partial import report. This utility does not
repair overlap or choose a collision survivor.

`DocumentError` has `rule`, `path`, `field`, and, for serialized input, `line`
and `column`. Parsing has no recovery mode. [R28](SPEC.md#r28--bounds) bounds
input, native JSON size, both canonical encodings, arithmetic, and references.
A document must fit both encodings to preserve strict cross-encoding round trips.
This can make a count limit unreachable before the byte limit.

## Offline commands

Run from `brain/`:

```sh
npm run document -- validate fields ../spec/ghostnote-document-v1/examples/complete.fields
npm run document -- convert fields json ../spec/ghostnote-document-v1/examples/complete.fields
npm run document:conformance
npm run document:standalone
```

The CLI also accepts stdin when the file argument is absent. Validation prints
JSON with `valid`, `kind`, and `sha256`. Conversion prints only the requested
encoding. Errors go to stderr as JSON and set exit status 1. The CLI bounds
file and stdin input. It does not write a file.

## Artifact ownership

8f1 owns the authored [paired inputs](EXAMPLES.md) and their independent hashes.
8f2 owns the [canonical corpus](conformance/v1/README.md), schema copy,
[Model format reference](MODEL-REFERENCE.md), identity, and prompt measurements.
The authored examples and independent expected hashes remain unchanged.

`npm run document:artifacts` regenerates the schema copy, canonical outputs,
reference identity, selected prompts, and measurement JSON. It must preserve
the independent hashes. `npm run document:conformance` checks the same outputs
without writing them. Ajv is a development dependency for independent schema
compilation; the library uses its local fixed-schema validator at runtime.

The Model format reference is the maintained source for prompts and skills.
The pure `modelReference` helper selects Core and named optional sections.
Generated prompt files are checked derivatives. The measurement report counts
all selected prose and examples. It records bytes separately from provider
tokens. Historical full-prompt usage is not a token count for the new reference.
No new provider run is needed for this session.

## Standalone extraction

Copy `brain/src/document/` without test files and `cli.ts`. Compile its TypeScript
with ES2022 or later and Node module support. Include `schema-data.ts`, the
native model, and all library modules. No repository-relative import is used.
For CLI use, also copy `cli.ts`. The `document:standalone` check builds a temporary
consumer, runs it with Node and no runtime packages, checks the independent
complete-example hash, and removes the temporary directory.

A future package must include SPEC.md, FIELDS.md, fields.ebnf, schema.json,
the corpus, the Model format reference, and the MIT license. Phase 9b owns
packaging and external publication. The [8f3 host binding](HOST-BINDING.md) defines capability mappings and
partial-base resolution. [Identity rules](IDENTITY-AND-OVERLAYS.md) and the
[pull snapshot contract](../../context/contracts/GHOSTNOTE_CACHE_CONTRACT.md) define
the remaining integration boundaries.

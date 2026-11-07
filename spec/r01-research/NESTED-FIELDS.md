# R01 candidate 4: group-local FIELDS

The operator accepted trying groups containing compact note rows. This surface
replaces the separated group/note presentation of the initial C4 JSON prototype
for the forward model-facing candidate. The JSON codec remains the semantic
reference and a diagnostic encoding control. This is research syntax, not a
change to Ghostnote Document v1 or a product-format adoption.

[nested-fields.mjs](../../brain/benchmarks/r01-candidates/nested-fields.mjs)
implements the encoder/parser. It retains the [structured fixture contract](STRUCTURED.md#shared-fixture-contract),
including exact source rational timing, one note definition, arbitrary overlapping
groups, unknown fields and interpretation lifecycle. Existing bounded edits
operate on the decoded fixture; both encodings use the same semantic validation.

## Minimal complete example

```text
R01-GROUPED-FIELDS 1
GROUP g1 anchor=0 delay=3/512 {
  FIELDS id pitch duration velocity spread
  NOTE n1 60 1 90 0
  NOTE n2 64 1 84 6/512
}
```

The group contains both the notes and their timing refinements. There is no
separate member list, spread map or repeated timing-group ID. Its notes sound
at `3/512` and `9/512`. Each performed onset is exactly
`group.anchor + (group.delay or 0) + note.spread`. Halving the second spread
moves that note to `3/256`; shared delay and both durations remain unchanged.
No quantization occurs in this codec.

## Records and scope

- `R01-GROUPED-FIELDS 1` is the required first nonblank line.
- Optional `CONTEXT <JSON object>` appears once before blocks. It retains shared
  root metadata, excluding notes and groups. It cannot carry a second note or
  group description. Mapped nominal entries move into note rows; an empty
  `musical.nominal` object marks the original map's presence.
- `GROUP <id> [attributes] [WITH <JSON object>] {` opens a group. Optional
  `anchor=`, `delay=`, `label=` and `prose=` attributes are adjacent to its rows.
  `WITH` retains other group properties, including provenance, interpretation
  state, and explicit presentation/performance order. It cannot redefine the
  ID, members or those attributes. A `spread: {}` property only preserves an
  explicitly empty source map; nonempty spread maps are refused here.
- `NOTES {` opens a block for notes without a containing group. `}` closes the
  current block. A block may contain multiple local FIELDS bindings; every
  new block starts without a binding. A binding cannot leak between blocks.
- `FIELDS <columns>` declares the meaning of subsequent NOTE rows in that block.
  `NOTE <values>` must have exactly that many cells. The NOTE keyword makes an
  ID such as `REF` or `FIELDS` unambiguous. Indentation is presentational.
- `REF <id>` inside a group adds an already defined or forward-referenced note
  to its membership without duplicating note state. Body NOTE/REF order defines
  the ordered `members` array. References alone do not change timing ownership.
- `EMPTY_GROUPS` before blocks preserves an explicitly empty source group array;
  it cannot coexist with GROUP blocks. An absent array stays absent.

This version nests note rows inside groups; it does **not** support recursive
GROUP-within-GROUP blocks or implicit composition of ancestor timing offsets.
Overlaps use references. A label-only group can contain notes with explicit
`at` values; containment alone does not invent a timing decomposition.

## Columns and values

| Column | Meaning |
|---|---|
| `id`, `pitch`, `duration`, `velocity` | Required note fields; same validation as the structured fixture |
| `at` | Direct exact rational onset; may appear in a group or a NOTES block |
| `spread` | Exact offset from the containing group's anchor plus delay; requires that group's anchor |
| `order` | Optional original note-array position, independent of group/member/performance order |
| `spelling` | Optional unreduced rational spelling of a derived onset; must equal its equation |
| `nominal` | Optional JSON object from this note's shared nominal-map entry |
| `extra` | Optional JSON object retaining other note fields; cannot redefine core note fields |

Every note has exactly one of `at` or `spread`. A group can mix direct and derived
notes by declaring both columns and using `-` for absent values. `spelling` is
allowed only with `spread`. Extra fields can include expression, channel,
note-local nominal data and unknown properties; they stay beside their note.

Whitespace separates cells outside quoted strings and JSON containers. IDs and
text may be quoted JSON strings; the encoder uses bare identifiers when safe.
Timing uses exact integer/fraction text. Pitch, velocity and order are JSON
numbers. Nominal/extra cells are JSON objects. A bare `-` means absent, not null;
the literal string ID `-` must be quoted. There are no comments or implicit
cross-block defaults. Malformed bindings, unmatched delimiters, duplicate IDs,
missing references, conflicting timing and structural redefinitions refuse.

## Canonical placement and preservation

The encoder places each note definition in its timing-owning group. A note with
no timing owner goes in its first member group; an ungrouped note goes in NOTES.
Other groups use REF. Group and member order are preserved exactly. Explicit
presentation/performance-order properties remain distinct and do not silently
reorder events or supply onset arithmetic.

Grouping can change traversal order relative to the fixture's original note
array. Only when needed, every note row includes `order`; values must form a
complete zero-based permutation. This preserves the existing contract without
a separate order table. The column's payload cost is counted. It is not an event
time or a note identity. New documents without it use definition traversal order.

`spelling`, empty-map markers and nominal location markers preserve the stronger
lexical/container round-trip contract already tested by the JSON prototypes.
They supply no independent musical explanation. Opaque metadata still uses JSON
locally; this is a compact row format within musical structure, not a claim that
arbitrary heterogeneous state has a JSON-free encoding.

## Verification and next experiment

[E356](../../context/evidence/experiments/e356-r01-nested-fields-prototype.md)
records the offline screen, grammar/refusal tests and two unscored subscription
development calls. The [complete harmony example](../../context/evidence/data/r01-nested-fields/harmony.fields)
includes overlap references and provenance rather than hiding them in size counts.
From `brain/`:

```sh
node --import tsx --test benchmarks/r01-candidates/nested-fields.test.mjs
node --import tsx benchmarks/r01-candidates/nested-screen.mjs /path/to/tokenizer-tooling
```

Keep JSON C4 as an equal-information encoding control. A selected paired check
can also isolate colocated versus separated FIELDS presentation; do not conflate
removing JSON punctuation with grouping benefits. C3's [FIELDS surface](COMPACT-FIELDS.md)
is now implemented; matched cards and paired tasks remain necessary before a
fair model-facing candidate comparison.
Use development sources to refine cards and then freeze them before opening
reserved works. Small development successes do not establish candidate superiority.

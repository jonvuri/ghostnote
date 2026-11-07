# R01 candidate 3: explicit notes with adjacent musical fields

This is C3's model-facing FIELDS surface. The performed note remains primary:
every row has an explicit onset and duration, with optional nominal timing and
group references beside it. The [compact JSON codec](STRUCTURED.md#candidate-3-compact-realized-notes)
remains its semantic reference. C4 instead places note definitions inside
groups and can derive their onsets from shared timing.

The [encoder/parser](../../brain/benchmarks/r01-candidates/compact-fields.mjs)
preserves the complete structured fixture, including exact rational spellings,
note and group order, optional state, and whether nominal data originally lived
on a note or in the shared map. This is research syntax, not a product change.

## Complete example

```text
R01-COMPACT-FIELDS 1
CONTEXT {"musical":{"nominal":{}}}
FIELDS id pitch at duration velocity nominal.location nominal.at
NOTE n1 60 3/512 1 90 map 0
```

The note performs at `3/512`, while its supplied intended onset is `0`.
`map` preserves the entry's original location at `musical.nominal.n1`; `note`
would put it on the note itself. Location matters because mapped entries can
inherit shared provenance in the existing interpretation rules. It is not a
second timing equation, and nominal values never override performed values.

## Records and columns

The first nonblank line is `R01-COMPACT-FIELDS 1`. One optional `CONTEXT` JSON
object precedes the first FIELDS binding. It carries the original shared root
properties except notes; mapped nominal entries move to rows, leaving only an
empty map marker in context. Nonempty nominal sidecars and context note arrays
are refused. Uninterpreted root properties retain their original values.

`FIELDS <columns>` names each cell in subsequent `NOTE <values>` rows. It must
include all five core fields, with no duplicates or unknown names. A later
FIELDS line can change column order or optional columns. Row width must match
the active binding. Note definition order is original presentation order; the
codec does not sort it or add an order table. An empty document still has FIELDS.

| Columns | Meaning |
|---|---|
| `id pitch at duration velocity` | Required note fields; explicit exact rational onset/duration |
| `groups` | Optional JSON array of group IDs, checked against shared group membership |
| `nominal.location` | `map` or `note`, required when any nominal entry is present |
| `nominal.at` | Required exact nominal onset for an entry |
| `nominal.duration`, `nominal.division` | Optional exact positive rational values |
| `nominal.extra` | Optional JSON object for provenance, state and other nominal metadata |
| `extra` | Optional JSON object retaining other note properties, including expression and channel |

An omitted optional column or bare `-` cell means absence, not null. Core cells
cannot be absent. A nominal entry needs both location and onset; a `map` entry
also needs the empty shared map marker. Neither extra object may redefine fields
already represented by dedicated columns. Note-local nominal data must use the
nominal columns rather than a second definition in `extra`.

Whitespace separates cells outside quoted strings and balanced JSON containers.
IDs can be bare safe identifiers or JSON-quoted strings; the literal ID `-`
must be quoted. Pitch and velocity use JSON numbers; timing uses exact rational
text. JSON cells retain nested strings, arrays, null and booleans as data.
Indentation and blank lines are presentational; comments and group blocks are
not part of this grammar. The input limit is 8 MiB, matching the C4 text surface.

The encoder emits only optional columns used by at least one row. Rows without
that optional value use `-`. Thus an ordinary note passage has no empty JSON
objects, unused group arrays or nominal placeholders. Optional heterogeneous
state still uses local JSON cells and is included in payload measurements.

## Group context and edits

C3 retains the original shared group objects and adjacent row group references.
This redundancy is part of the C3 reference contract and is validated, not
silently discarded. It is not the colocated group containment introduced for C4.
Group labels, prose and shared provenance remain shared context; note-specific
nominal values and metadata stay on their note row. Group references do not
derive onset or reorder notes.

When supplied group timing describes a note, its equation must still agree
with the explicit onset. A proposal that changes only one side refuses. Existing
`editNote` and `scaleGroupSpread` helpers update the decoded fixture consistently;
this text codec introduces no new edit or interpretation rules. Inferred labels
and nominal entries retain the prior stale-state rules, while authored intent
remains authored. No quantization or claim-envelope expansion is performed here.

## Verification and next step

[E357](../../context/evidence/experiments/e357-r01-compact-fields-prototype.md)
records 12 fixture checks, 23 new codec tests and the equal-information comparison
against C3 JSON. Complete [bass](../../context/evidence/data/r01-compact-fields/synthetic-bass.fields)
and [harmony](../../context/evidence/data/r01-compact-fields/synthetic-harmony.fields)
examples retain their metadata and group context. From `brain/`:

```sh
node --import tsx --test benchmarks/r01-candidates/compact-fields.test.mjs
node --import tsx benchmarks/r01-candidates/compact-screen.mjs /path/to/tokenizer-tooling
```

The next [tracked step](../../context/work/r01-format-comparison.md#immediate-next-steps)
is matched format cards and paired development tasks. C3 and C4 now both have
FIELDS surfaces, but only C4 has had the two unscored development calls recorded
in E356. Neither local payload counts nor these codec checks establish a model
task advantage. Reserved sources remain unopened.

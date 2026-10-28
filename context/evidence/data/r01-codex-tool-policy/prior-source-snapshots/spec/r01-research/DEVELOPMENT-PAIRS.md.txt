# R01 matched development cards and tasks, version 1

This offline Stage-A package prepares matched prompts and independent expected
outcomes. It has **14 development tasks, 11 format/cohort cards and 76 eligible
task/format pairs**. No model was called while building it. The reserved
Ghostworks works remain unopened. This package does not freeze the proposed
scored pilot or establish an agent advantage.

The [manifest](../../context/evidence/data/r01-development-pairs/manifest.json)
lists all 99 scheduled cells: 84 primary and 15 diagnostic. Of these, 62 primary
and 14 diagnostic cells are eligible; the other 23 retain explicit reasons.
Diagnostic arms are scheduled only on the five source-state tasks. Eligibility
is established before prompting, never by whether an answer succeeds.

## Comparison contracts

| Cohort | Input and scoring | Eligible primary arms |
|---|---|---|
| Performed notes: nine tasks | Same pitch, onset, duration, velocity and multiplicity. Fixed 4/4 display, channel 1, 64-quarter-note clip. Inputs already lie on the 1/512 grid. Every output uses the common onset-floor/duration-nearest realization once. | Ghostnote FIELDS/JSON, C3 FIELDS, C4 group-local FIELDS, adapted PP bar\|beat/MIDI JSON; two baseline collision exclusions |
| Exact source/context: five tasks | Same complete fixture, exact rational spellings, IDs, orders, musical context, opaque fields and lifecycle rules. No quantization. | C3 FIELDS and C4 group-local FIELDS |

Performed equality ignores native IDs and presentation order. Native parsers
still require valid IDs where supported. A separate diagnostic checks whether
each retained ID has its expected performed note; the scorer never reconstructs
Producer Pal identities from row order or nearest pitches/times. Source-state
tasks require exact identities and array orders. Object key order is immaterial.

The current Ghostnote adapter supplies a complete desired document with fixed
clip and coverage spans. Its required all-channel coverage envelope is counted
and protected; the common musical scope contains only channel-1 notes. Other
arms receive that same musical scope in shared instructions. Added nondefault
note state or invented root annotations fail performed-state scoring.

The source cohort excludes the current-document and PP arms because this round
does not supply them with a matched annotation adapter. These are limitations
of the supplied comparison condition, not evidence that current Ghostnote
claims cannot express groups or intent. A selective/timing-rich claims condition
remains later protocol work. The ambiguous same-pitch/onset task excludes both
current-document encodings because their native admission rejects that input.

## Tasks

All sources are retained development material. Four Ghostworks excerpts supply
the piano, bass, guitar and drums; synthetic fixtures provide known intent,
wider state and explicit failure conditions. Real excerpts are projected to
the declared core fields and normalized identically before encoding any arm.
No musical intent is inferred from a transcription.

| Task ID | Cohort | Required result |
|---|---|---|
| `read-count-piano` | Performed | Count all 94 notes and those strictly before quarter 4 |
| `read-earliest-bass` | Performed | Earliest onset and its sorted pitch multiset |
| `edit-velocity-guitar` | Performed | One uniquely selected velocity becomes 91 |
| `edit-onset-drums` | Performed | One uniquely selected onset moves later by 5/512; retain duration |
| `author-four-notes` | Performed | Four fully specified new notes from an empty input |
| `delete-one-note` | Performed | Delete one exact pitch/onset match; preserve the rest |
| `preserve-piano` | Performed | Rewrite the full irregular 94-note state unchanged |
| `read-group-timing` | Source | Report common delay, member residual and derived onset |
| `halve-group-spread` | Source | Halve known residuals; retain common delay and protected state |
| `preserve-exact-wider` | Source | Retain non-grid timing, wider fields and opaque annotation |
| `edit-inferred-nominal` | Source | Move b2 by 1/1024; stale its inferred nominal entry only |
| `refuse-missing-timing` | Source | Refuse a spread transform without numeric decomposition |
| `refuse-ambiguous-selector` | Performed | Refuse a two-match pitch/onset selector |
| `refuse-stale-snapshot` | Performed | Refuse the explicitly stale revision |

Group gold values are independently specified, without candidate edit helpers.
The half-spread fixture uses even grid-cell residuals so its result remains on
the same grid. The separate nominal edit deliberately tests exact non-grid
arithmetic. Read answers require exact JSON keys/types and reduced rational
strings when requested. Refusals require the specified code. Writes require
the entire native surface; there is no patch backend silently preserving
omitted fields for one arm.

These refusal cases exercise explicit instruction adherence and scorer paths;
they are not a concurrency or host freshness implementation. The 14 development
instances also do not fulfill every future pilot requirement: a small edit in
a large clip, actual repair loops and a selective claims comparison still need
their own frozen conditions.

## Cards and bounded controls

Each card has the same sections and one complete, codec-generated example.
Within a cohort, examples carry identical facts and use IDs disjoint from task
notes. Shared instructions, scope, task request and response contract are
byte-identical across a task's eligible arms. Only the format card and native
input differ. Cards explain the supplied syntax; their lengths are measured,
not artificially padded or claimed equal. All standalone card bytes and full
prompt bytes are retained and hashed.

Three source-cohort diagnostic arms remain separate from the six primary arms:

- **C3 JSON** retains the same C3 fixture and original reference encoding.
- **C4 JSON** retains the same fixture but separates groups and note rows.
  Comparing it with C4 group-local FIELDS changes both encoding and layout;
  it cannot isolate punctuation alone.
- **C4 detached FIELDS** moves each exact group body to a separately referenced
  `ROWS rN` block. Group headers, ordered FIELDS/NOTE/REF lines, facts and timing
  ownership remain identical. The added references and table wrappers are
  counted. This diagnoses colocation plus unavoidable linkage overhead; it is
  not the primary C4 proposal. The no-group preservation task is excluded.

The detached control accepts one unique row table per group, with forward
references allowed. Missing, shared, duplicate or unused tables refuse. Direct
`NOTES` blocks stay in place. Decoding reconstructs the local form and uses
the same C4 validator. The build audits unchanged group headers and row bodies.

## Artifacts, scoring and reproduction

- [Manifest](../../context/evidence/data/r01-development-pairs/manifest.json):
  eligibility, source/code pins, fact hashes, card/example hashes and local
  token/byte counts for every instruction, request, input and complete prompt.
- [Pairs](../../context/evidence/data/r01-development-pairs/pairs.json): exact
  delivered `prompt` strings and separately retained native `input` strings.
  Only `prompt` is to be delivered; the runner must not append the rest of the
  package or give model tools access to expected outcomes.
- [Private development oracles](../../context/evidence/data/r01-development-pairs/private-oracles.json):
  full fixtures, independent expected state/answers and native golden responses.
  These are evaluation records, excluded from delivered prompts.
- [Rehearsal](../../context/evidence/data/r01-development-pairs/rehearsal.json):
  76 accepted goldens, 76 rejected deliberately wrong results, and 61 rejected
  gratuitous refusals. This is harness verification, not model performance.
- [Builder](../../brain/benchmarks/r01-candidates/development-pairs.mjs),
  [surface/scoring adapter](../../brain/benchmarks/r01-candidates/development-surfaces.mjs)
  and [fault tests](../../brain/benchmarks/r01-candidates/development-pairs.test.mjs).

From `brain/`, with the pinned Producer Pal checkout and tokenizer tooling
described in [the adapter contract](PRODUCER-PAL.md):

```sh
R01_UPSTREAM=/path/to/pinned-producer-pal R01_TOOLING=/path/to/tokenizer-tooling node --import tsx --test benchmarks/r01-candidates/development-pairs.test.mjs
node --import tsx benchmarks/r01-candidates/development-pairs.mjs /path/to/pinned-producer-pal /path/to/tokenizer-tooling /path/to/new-output-directory
```

The builder refuses an existing output directory. It requires
`js-tiktoken@1.0.21/o200k_base` and the pinned upstream/precision patch. Identical
sources, Node version and tooling produce identical artifacts; no timestamp or
random order enters this package. Whole-prompt tokenization is recorded
directly because component counts are not additive across token boundaries.
These counts exclude CLI built-in context, provider tokenization, cache effects,
responses and repairs, which remain experimental-control work.

Malformed native output fails when its parser rejects it. PP's native parser
can ignore malformed material or clamp some values; semantic success therefore
does not certify strict syntax. Retain raw outputs and report syntax/behavior
separately when evaluating those cases. The scorer does not execute output,
recover missing intent or silently repair protected state.

Next, settle the operational controls in the [trial protocol](TRIAL-PROTOCOL.md):
model selection under the [cohort policy](CLI-CONTROLS.md#subscription-model-selection),
isolated contexts, complete usage accounting, repair
budgets and randomized paired order. This development build order is not a run
order. Freeze model/task/attempt/stop-rule choices before scored runs and before
opening reserved passages.

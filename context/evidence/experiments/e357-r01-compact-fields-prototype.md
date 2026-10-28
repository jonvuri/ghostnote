---
title: E357 — R01 compact FIELDS prototype
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E357 — R01 compact FIELDS prototype

## Scope

The operator asked that next steps be tracked in the R01 brief and directed
work on the top step. The brief already recorded the sequence in prose; it now
has an explicit [checklist](../../work/r01-format-comparison.md#immediate-next-steps).
This round completes C3's model-facing FIELDS surface. No model call, reserved
source read, host operation or product change occurred. Earlier E records and
the measured C4 implementation remain unchanged.

## Implementation

The [contract](../../../spec/r01-research/COMPACT-FIELDS.md) and
[codec](../../../brain/benchmarks/r01-candidates/compact-fields.mjs) retain explicit
performed onset/duration and place optional nominal timing in adjacent columns.
Nominal location (`map` or `note`) preserves the existing interpretation rules;
nominal provenance and opaque fields remain local JSON cells. Unused optional
columns are omitted. Shared group objects and checked row membership references
retain the original C3 structure. This does not claim C4's group containment.

The JSON compact codec remains the semantic reference. Decoding requires the
same field, reference, timing and interpretation constraints; there is no new
quantization, host admission or claim-engine behavior. The text parser rejects
malformed bindings, duplicate definitions, contradictory membership/nominal
context and extra fields that would override dedicated columns.

## Results

All **23 new tests** pass; the combined focused candidate/CLI-audit suite passes
**82 tests**. Independent code review found no material issue. Coverage includes
all 12 prior development/stress fixtures, 20-cycle exact spelling/metadata
preservation, mixed map/note nominal entries, special property names, field
reordering, stale interpretation behavior, guarded edits and malformed inputs.

The [offline screen](../data/r01-compact-fields/screen.json) checks 12 fixtures
and 1,175 notes. Every case preserves the complete original fixture, has stable
canonical serialization, and passes a velocity edit without unrelated changes.
The eight ordinary development cases (146 notes) also pass guarded patch
application and independently parsed readback through the existing offline
document backend. The four stress cases (1,029 notes) are codec checks only;
negative pickups, normalized collisions and duplicate addresses are not thereby
admitted to the host backend.

The spread-edit check retains common delay `3/512` and produces exact onsets
`4099/512`, `2051/256`, `8211/1024`, `8219/1024`. Dedicated tests ensure an
inconsistent explicit onset/group equation refuses instead of being repaired
silently. Source fixtures, expected outcomes and source hashes are retained.

With `js-tiktoken@1.0.21/o200k_base`, the eight development payloads use
**4,190 tokens** in C3 FIELDS versus **4,748** in equivalent minified C3 JSON:
**11.75% fewer**. The bass case is 211 versus 220; harmony is 253 versus 266.
The four stress cases total 16,084 versus 20,193 and are dominated by the
1,024-note fixture. All emitted context, group references and optional metadata
are counted. These figures exclude instruction cards, client context, repairs
and tool work; they do not establish better model performance or superiority
over current Ghostnote FIELDS or C4.

## Artifacts and reproduction

- [Screen and source hashes](../data/r01-compact-fields/screen.json).
- Complete [bass example](../data/r01-compact-fields/synthetic-bass.fields)
  and [harmony example](../data/r01-compact-fields/synthetic-harmony.fields).
- [Codec tests](../../../brain/benchmarks/r01-candidates/compact-fields.test.mjs)
  and [screen driver](../../../brain/benchmarks/r01-candidates/compact-screen.mjs).

From `brain/`, offline:

```sh
node --import tsx --test benchmarks/r01-candidates/compact-fields.test.mjs
node --import tsx benchmarks/r01-candidates/compact-screen.mjs /path/to/tokenizer-tooling
```

The complete focused suite additionally includes `common.test.mjs`,
`structured.test.mjs`, `corpus.test.mjs`, `nested-fields.test.mjs` and
`cli-smoke-audit.test.mjs` in the same directory. Product code is unchanged;
the earlier 286 product tests were not rerun for these new research-only files.

The next checklist item is matched format cards and paired development tasks,
followed by model/accounting controls and a frozen pilot. No additional operator
decision is required to prepare those artifacts; the scored comparison remains
unfrozen and the reserved corpus remains unopened.

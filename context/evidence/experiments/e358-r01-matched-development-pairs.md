---
title: E358 — R01 matched development cards and paired tasks
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E358 — R01 matched development cards and paired tasks

## Scope and result

The operator instructed: “Great. Proceed to matched format cards and paired
development tasks.” This completes that checklist item with an offline package:
**11 cards, 14 development tasks and 76 eligible task/format pairs**. No model,
API or host call occurred, and no reserved Ghostworks passage was opened.
Earlier E records and measured codecs remain unchanged. Nothing is selected
for product adoption, and the scored pilot remains unfrozen.

The [contract and reproduction guide](../../../spec/r01-research/DEVELOPMENT-PAIRS.md)
describes the exact comparison conditions. Nine tasks compare normalized core
performed notes across six primary arms. Five compare exact source state and
musical/opaque context across C3/C4, with JSON and detached FIELDS diagnostics.
Requests, common instructions, scope and example facts are matched within each
task. Write responses must supply the complete native surface; there is no
hidden preservation backend. Read answers and refusal codes have exact schemas.

The [manifest](../data/r01-development-pairs/manifest.json) retains 99 scheduled
cells: 84 primary and 15 diagnostic. **62 primary and 14 diagnostic cells are
eligible**. The **23 exclusions** are explicit:

- 20 source-cohort cells lack a matched source/context adapter for current
  Ghostnote or Producer Pal. This is not a general inability of Ghostnote claims
  to encode musical annotations; that comparison condition remains future work.
- Two baseline cells reject the ambiguous same-channel/pitch/onset input under
  current document admission.
- One detached-layout cell has no group to relocate.

## Offline verification

All 76 eligible inputs decode to the same cohort-specific facts and all 76
native golden responses pass. The retained [rehearsal](../data/r01-development-pairs/rehearsal.json)
rejects 76 deliberately wrong results and 61 gratuitous refusals. These are
deterministic harness checks, not successful agent trials.

The 31 new [tests](../../../brain/benchmarks/r01-candidates/development-pairs.test.mjs)
cover input equality, golden outcomes, grid closure, unique selectors, independent
group arithmetic, inferred-interpretation staleness, source spelling/order/opaque
state, missing/duplicate notes, protected-field errors, identity diagnostics,
document envelopes, refusals, detached references, paired hashes and deterministic
builds. The complete focused suite passes **113 tests, zero failures** on
Node **v24.11.1**. Product code is unchanged; the earlier 286 product tests were
not rerun for this research-only addition.

Independent review found a fixed-channel scope conflicting with the wider
source fixture; source prompts now explicitly preserve per-note channels.
Tests also protect fixed baseline clip/coverage spans and ensure PP timing
normalizer diagnostics do not leak into scored musical fields. Performed IDs
are reported separately, with swapped or renamed identities detected; exact
source identities are required. No PP identity is inferred.

The C4 detached diagnostic moves each group's exact ordered FIELDS/NOTE/REF
body into a one-to-one referenced row table. The builder verifies unchanged
headers and row bodies; tests reject duplicate, shared, missing and unused
references. C4 JSON changes both encoding and layout, so that comparison is
explicitly not an isolated punctuation test.

## Count complete prompts, not only payloads

The builder records every card, example, shared instruction, scope, request,
input and complete prompt using `js-tiktoken@1.0.21/o200k_base`. Whole-prompt
counts come from tokenizing the actual concatenated text, not summing components.
For the same `halve-group-spread` development task:

| Surface | Input tokens | Complete prompt tokens |
|---|---:|---:|
| C3 FIELDS | 229 | 1,119 |
| C4 group-local FIELDS | 172 | 1,131 |
| C3 JSON diagnostic | 242 | 1,059 |
| C4 JSON diagnostic | 258 | 1,122 |
| C4 detached FIELDS diagnostic | 194 | 1,210 |

Thus the smaller FIELDS payloads do not automatically yield smaller complete
prompts with these initial cards. Each card has the same sections and one
matched example, but syntax-specific instruction lengths differ. These counts
exclude CLI context, provider tokenization/cache effects, responses and repairs;
they establish neither agent success nor a format winner. Equal development
tuning opportunities and actual client accounting remain necessary.

## Artifacts and reproduction

- [Manifest, eligibility, code pins and prompt accounting](../data/r01-development-pairs/manifest.json).
- [Exact prompt/input pairs](../data/r01-development-pairs/pairs.json) and
  [private oracles](../data/r01-development-pairs/private-oracles.json).
- Complete example cards for [C3](../data/r01-development-pairs/cards/source--c3-fields.txt),
  [C4](../data/r01-development-pairs/cards/source--c4-fields.txt) and
  [detached C4 control](../data/r01-development-pairs/cards/source--c4-detached-fields.txt);
  the manifest lists all 11 cards.
- [Builder](../../../brain/benchmarks/r01-candidates/development-pairs.mjs),
  [tasks](../../../brain/benchmarks/r01-candidates/development-tasks.mjs),
  [cards](../../../brain/benchmarks/r01-candidates/development-cards.mjs),
  [surface/scoring adapter](../../../brain/benchmarks/r01-candidates/development-surfaces.mjs)
  and [detached codec](../../../brain/benchmarks/r01-candidates/detached-fields.mjs).

The manifest hashes 31 source/dependency files and 14 accompanying artifacts.
Only each pair's `prompt` is model input; private oracles and package files
must remain inaccessible to trial tools. PP uses upstream pin
`52a4c219eca338b95e94dbfddcffeeb303ff8dd3` plus the separately hashed precision
patch. Its tolerant native parser means semantic success alone does not prove
strict syntax; raw outputs must remain available for that distinction.

From `brain/`, offline:

```sh
node --import tsx --test benchmarks/r01-candidates/common.test.mjs benchmarks/r01-candidates/structured.test.mjs benchmarks/r01-candidates/corpus.test.mjs benchmarks/r01-candidates/cli-smoke-audit.test.mjs benchmarks/r01-candidates/nested-fields.test.mjs benchmarks/r01-candidates/compact-fields.test.mjs benchmarks/r01-candidates/development-pairs.test.mjs
node --import tsx benchmarks/r01-candidates/development-pairs.mjs /path/to/pinned-producer-pal /path/to/tokenizer-tooling /path/to/new-output-directory
```

Tests accept `R01_UPSTREAM` and `R01_TOOLING` for those external paths. The
build is deterministic under the recorded versions and refuses to overwrite
an existing output directory. Artifact hashes, documentation links and diff
whitespace were checked.

The next [brief checklist item](../../work/r01-format-comparison.md#immediate-next-steps)
is experimental controls: served model verification, isolated CLI contexts,
full usage accounting, repair limits and randomized paired order. The 14-task
development set is not the proposed 12-task pilot; freeze its eventual models,
tasks, attempts and stop rules before scoring or unblinding reserved passages.

---
title: E356 — R01 nested FIELDS prototype and development checks
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E356 — R01 nested FIELDS prototype and development checks

## Scope and accepted direction

The operator preferred FIELDS-like surfaces for candidates 3/4, then identified
the loss of colocation in separate group and note tables. After reviewing a
group containing local FIELDS rows, the operator approved: “Great - this looks
a lot better to me. Let's try this version out. What are the next steps now?”

This round implements that C4 surface and runs two bounded, unscored synthetic
development calls through the already-authorized subscription route. The
earlier C4 JSON is retained as a semantic reference. No reserved work was opened,
no scored comparative trial ran, and no product or DAW behavior changed.

## Offline result

The [contract](../../../spec/r01-research/NESTED-FIELDS.md) and
[codec](../../../brain/benchmarks/r01-candidates/nested-fields.mjs) place a note's
only definition inside its timing-owning group, otherwise its first member group,
with direct root notes for ungrouped material. Overlaps use references. Timing,
pitch, duration, velocity and optional note state remain colocated. Group body
order determines membership; no separate member list or spread map is emitted.

The [screen](../data/r01-nested-fields/screen.json) covers 12 fixtures and 1,175
notes: the eight earlier development fixtures (146 notes, including all four
Ghostworks excerpts) plus four synthetic stress fixtures (1,029 notes).
Every fixture preserves exact source state, source ordering and optional metadata
through encoding/decoding, has stable canonical serialization, and passes a
velocity edit with all unrelated state preserved. The eight ordinary fixtures
also pass guarded patch application and independently parsed readback through
the existing offline document backend. Stress coverage does not imply host
admission for negative onsets, normalized collisions or duplicate addresses.

For the eight development fixtures, nested FIELDS uses **4,304 local tokens**
against **6,328** for minified C4 JSON: **31.98% fewer** with identical fixture
information. The harmony case is 201 versus 284. The separate stress set is
17,137 versus 31,516 and is dominated by the 1,024-note case. These counts use
`js-tiktoken@1.0.21/o200k_base`, include all emitted metadata and omit model
instructions, repairs and client overhead. They do not measure agent benefit
or establish an advantage over current Ghostnote FIELDS.

All **59 focused tests** pass: the prior 35 candidate tests, three CLI audit
tests and 21 new nested-codec tests. New checks cover local header scope,
forward/overlapping references, direct and derived timing in the same group,
unreduced rationals, quoted IDs, opaque JSON, empty containers, special map keys,
original order, invalid structures and edit preservation. The group-spread
check yields exact onsets `4099/512`, `2051/256`, `8211/1024`, `8219/1024` while
retaining shared delay `3/512`. Independent code review found no material issue.

## Subscription development calls

Each fresh Claude Code 2.1.302 session requested and reported
`claude-haiku-5-5` at low effort, using subscription authentication, safe mode,
an empty temporary directory, no tools/MCP and no API credential overrides.
Both received the same synthetic harmony document and grammar card, with the
task wording changed. Each returned a complete parseable nested document whose
decoded state exactly matched the expected fixture on its first attempt.
Neither had a repair, observed tool call, fallback or reported overage use.

| Task | Total input tokens | Final output tokens | Reported thinking subset | Process wall time |
|---|---:|---:|---:|---:|
| Halve c7 spread, preserve shared delay and other state | 3,530 | 488 | 173 | 3,918.9 ms |
| Change only b velocity to 91 | 3,510 | 313 | 0 | 3,369.7 ms |

Input totals add ordinary input, cache creation and cache read. Thinking is
reported separately as a subset, not added again to output. These are different
tasks on one development fixture, not independent musical samples or a comparison
against another format. Claude's three built-in plugin entries remained in
startup metadata, as in E355. No Codex call ran in this round; its served-model
verification gap remains open before scoring.

Artifacts retain frozen tasks, input/expected fixtures, prompt hashes, CLI args,
authentication method, versions, source hashes, raw streams, errors and summaries:

- [Complete input](../data/r01-nested-fields/harmony.fields) and
  [offline screen](../data/r01-nested-fields/screen.json).
- [Spread task](../data/r01-nested-fields/half-spread.task.json),
  [manifest](../data/r01-nested-fields/half-spread-run/manifest.json),
  [raw stream](../data/r01-nested-fields/half-spread-run/stdout.jsonl),
  [summary](../data/r01-nested-fields/half-spread-run/summary.json).
- [Velocity task](../data/r01-nested-fields/one-velocity.task.json),
  [manifest](../data/r01-nested-fields/one-velocity-run/manifest.json),
  [raw stream](../data/r01-nested-fields/one-velocity-run/stdout.jsonl),
  [summary](../data/r01-nested-fields/one-velocity-run/summary.json).

## Reproduction and limits

From `brain/`, offline:

```sh
node --import tsx --test benchmarks/r01-candidates/common.test.mjs benchmarks/r01-candidates/structured.test.mjs benchmarks/r01-candidates/corpus.test.mjs benchmarks/r01-candidates/nested-fields.test.mjs benchmarks/r01-candidates/cli-smoke-audit.test.mjs
node --import tsx benchmarks/r01-candidates/nested-screen.mjs /path/to/tokenizer-tooling
```

The [CLI driver](../../../brain/benchmarks/r01-candidates/cli-smoke.mjs) additionally
accepts a frozen nested task as its third argument. Running it makes a new
external subscription call; it is not necessary to inspect or validate the
retained results. It refuses to overwrite an existing output directory.

This grammar supports rows inside groups, not recursive group hierarchies.
Opaque extras and shared context retain JSON cells. Optional order/spelling
columns preserve the existing strong round-trip contract and count toward cost.
The initial JSON codec and nested parser share semantic validation; tests add
independently specified edit outcomes and original-fixture equality, but do not
establish a completely independent second semantic implementation.

Next, implement the C3 FIELDS surface, prepare matched cards and small paired
development tasks, and freeze the comparison before unblinding reserved sources.
A bounded encoding/layout control should separate punctuation savings from
colocation effects. The proposed full pilot remains unfrozen. Product adoption,
claim-engine equivalence, persistence and host checks remain deferred.

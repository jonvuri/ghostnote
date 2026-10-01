---
title: Native versus composite diagnostic awaits approval
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-native-composite-frozen
---

# E210: Native versus composite diagnostic awaits approval

The [diagnostic plan](../../plan/phase-8/8c4f-native-versus-composite-diagnostic.md)
is frozen in the new
[benchmark package](../../../brain/benchmarks/native-composite-v1/README.md).
This preparation session made no provider or token-count request. Its API
cost was zero. Approval was not recorded at that checkpoint.
[E211](e211-native-composite-diagnostic-closes-with-two-providers.md) records the
later approved execution and audit.

## Frozen artifacts

- [Cohort](../../../brain/benchmarks/native-composite-v1/cohort-manifest.json):
  18 unique tasks across six families, with no internal musical duplicates.
- [Eligibility](../../../brain/benchmarks/native-composite-v1/eligibility-manifest.json):
  144 task/arm cells; four common fields; native assumptions and exclusions.
- [Prompts](../../../brain/benchmarks/native-composite-v1/prompts.json):
  complete paired prompts and reference outputs for every unique task and arm.
- [Baseline](../../../brain/benchmarks/native-composite-v1/baseline.json):
  all corrected matrix provider, format, and family cells. The source assessment
  hash remains `b2bcacdb567e0575f2983aea3e7d3ed914163a6115235f1c6e9c21761493ecad`.
- [Protocol](../../../brain/benchmarks/native-composite-v1/protocol.json):
  candidate definitions, dependencies, all schedules, settings, and cost basis.
- [Run plan](../../../brain/benchmarks/native-composite-v1/runs/diagnostic-r1-plan.json):
  576 calls; USD 7.332722 estimate; USD 10.75 total hard limit; approval pending.
- [Deterministic record](../../../brain/benchmarks/native-composite-v1/expected-deterministic.json):
  passing screen, protocol, plan, cohort, and candidate hashes.

The plan hash is
`7c51f49328c0392cabb36b41fe68b7f739427afdabe547f69cb64d63d8858dfe`.
The protocol hash is
`47d07dd571d1885a37c8d246dfa7ebb448709def33ec9b5acc6daf7f1402043f`.
The cohort hash is
`3f9b68822a4c1b919babc051f08df5d3ee83223e6dfd24f9ebbaf74a003019fe`.

## Measurement decisions

Native and composite tasks use the same voice, start, duration, and pitch
contract. Composite rows add arbitrary event IDs and fixed velocity 84. These
fields receive no primary credit. Exact note count is a primary check.

Analysis groups use voice and inclusive start intervals. The answer has case
labels, which receive no primary credit. Shared numeric motif-pair data remain
in both conditions. Only chord input changes with notation.

Native starts shift by 1/7, 2/7, or 3/7 beat. Affine output origins shift by
the same amount. The musical audit excludes IDs, velocity, and fixture
metadata. It finds no overlap with v19 and symbolic v3, v4, or v5. The task
shapes remain inherited; this is not a general holdout.

The new Strudel parser computes timing from normalized weights and `.slow()`.
The retained matrix parser ignored `.slow()`. This package does not change
the prior parser, scores, or responses. ABC writes explicit accidentals to
prevent carry within a measure. Parsers check pinned subsets. No external
notation engine or full public conformance check was run.

The report excludes sentinel repeats and incomplete pairs from primary paired
effects. It reports each provider, family, and format pair. Three unique
prompts give coarse uncertainty. The v5 five-field results remain baseline
context; they are not directly comparable with the new four-field ratios.

## Verification

Fourteen focused tests pass. They cover reference and input round trips,
one-field errors, extra and missing notes, ID/velocity exclusion, empty
constraints, native timing, explicit accidentals, analysis selection, affine
references, invalid durations, missing pairs, sentinel exclusion, approval
hashes, approval before environment/network access, cost reservations, model
identity, and invalid response envelopes. A test with 80 wrong output notes
checks the bounded note assignment. Provider tests use mock transport.

Run these checks from `brain/`:

```sh
npm run benchmark:native-composite-test
npm run benchmark:native-composite
npm run check
```

The complete brain check passes: typecheck and all 1,206 tests. The context
check found missing frontmatter in the existing external notation ranking.
This session adds the required header. The context check and
`git diff --check` then pass. The cache, `normal-v1`,
previous frozen artifacts, and live Bitwig projects remain unchanged.

## Retrospective

Add a timing test that changes `.slow()` and checks the resulting native event
times before each later Strudel freeze. Ledger round trips alone did not expose
the inherited timing error.

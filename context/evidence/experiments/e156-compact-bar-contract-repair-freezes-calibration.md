---
title: E156 — Compact-bar contract repair freezes calibration
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c4a-benchmark-contract-repair.md
---

# E156 — Compact-bar contract repair freezes calibration

## Result

Phase 8c4a passes its offline gate. The new
[compact-format v4 package](../../../brain/benchmarks/compact-format-v4/README.md)
repairs the analysis, motif, progression, framing, and result-state contracts.
It freezes a focused three-arm calibration. No provider call occurred.

The arms are positional compact-bar v1, compact-bar with one fixed `FIELDS`
line, and exact-object JSON. The compact document renderings differ only by
the `FIELDS id voice start duration pitch velocity` line. They have the same
headers, optional overlays, note rows, parsers, and patch capabilities.

The deterministic package SHA-256 is
`064e442ae18c6b68fab7e060fc690be85f9aa7abbeebe10483443ed4c2da2920`.
The protocol SHA-256 is
`468f734100ccccc2333d022cde2c509279c244d5eb9331c25ed696ba01604ae6`.
The run-plan SHA-256 is
`9d4506a390eb67b9c98884c31a432b73ffac0c5a7925eaa81b894fd301e2b4f3`.
The approval record is pending.

## Contract repair

The task-to-scorer table maps each instruction requirement to a named check and
a focused mutation.

- Analysis defines all input columns, pitch classes, qualities, inversion
  numbers, functions, motif relations, and the sustained rhythm rule. It
  reports eight independent facts.
- Motif tasks contain only the parameter for their named operation. They use
  `rhythmic-scale` and state exact formulas and preserved properties.
- Progression states the strict voice order, pitch-class coverage, inclusive
  ranges, cadence fields, and exact same-voice movement formula. It reports
  eight components beside the primary result.
- Every multiline document and patch grammar has an actual two-row example.
- Initial, repaired, unavailable, and failed results are distinct. Synthetic
  aggregation tests prove that a passing repair and an unavailable result stay
  outside the initial denominator.

The repair policy permits one turn after an available initial failure. The
feedback contains a structured parse or musical-contract diagnostic. It does
not replace the initial result.

The suite passes 214 checks. These checks include valid, invalid, and focused
mutation cases for all decision and guard families.

## Document and patch capability

All three arms pass parser, renderer, canonical-order, round-trip, stable-ID,
exact-preservation, sparse-patch, base-conflict, omission, invalid-value, size,
and token-estimate checks. Set, insert, and delete operations compile to the
same semantic result.

The optional bar, track, region, meter, tempo, harmony, and groove overlays
refer only to IDs in the note plane. A separate minimal-document test proves
that all overlays are optional. No overlay duplicates a note value.

On the fixed minimal capability document, positional compact-bar uses 183
bytes, the `FIELDS` arm uses 229 bytes, and exact-object JSON uses 543 bytes.
The `FIELDS` arm uses 1.251 times the positional bytes and 1.135 times its
estimated prompt tokens. Both compact arms pass the frozen size gates.

## Fresh cohorts

Calibration, development, and holdout have 20, 50, and 50 fixtures. Their
full and semantic hashes have no pairwise overlap. They have no semantic
overlap with 344 collected Phase 8c1 through 8c3 historical hashes.

| Cohort | Corpus SHA-256 | Fixtures |
|---|---|---:|
| Calibration | `cbe88d4e75f7fd53267cd7c0ab891e82ce1d75cae2a6810f9a3ca60961ea0d41` | 20 |
| Development | `4ab2b1b801bde5b556f4bc5e93584d5d2c4987d09918ebeed37a03968c5d530d` | 50 |
| Holdout | `07d64fb202ffafd7385b8de8a9be7491a3cb05a71b9ddacbd306261ce0de4b36` | 50 |

The cohort-manifest SHA-256 is
`75fda2a1205b5a6d2ac074fa47a7db054f73b911dbe1c1d6b438a4301ab887fe`.
Development and holdout each use ten unique fixtures per decision family. The
smallest three-family macro step is 3.33 percentage points.

## Frozen calibration

Each provider receives 60 unique initial jobs and 9 named repeated-prompt
sentinels. Each available initial failure can receive one repair call. The
maximum is 138 calls per provider and 414 calls in total.

| Provider | Model | Setting and output limit | Maximum estimated cost |
|---|---|---|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | Low reasoning, 5,000 tokens | USD 0.796787 |
| Gemini | `gemini-3.8-flash` | Low thinking, 5,000 tokens | USD 0.601556 |
| Claude | `claude-sonnet-5` | Low effort, 5,000 tokens | USD 2.818372 |
| Total | — | Provider default temperature | USD 4.216715 |

The estimate uses the larger recent mean provider cost and adds 25 percent. It
budgets the maximum repair count.

For each provider and decision family, the initial exact-object pass rate must
be from 0.20 through 0.80. Each family must meet this band on at least two
providers. Every unique initial result must be scored. Calibration returns
`proceed-development` only when all conditions pass. It returns
`repair-measurement` otherwise. It cannot select a format.

## Verification and boundary

The fixed manifest check and self-test pass. The complete brain check, context
check, and staged diff check are recorded in the session handoff. No provider,
cache, runtime, or live Bitwig state changed.

Phase 8c4b needs explicit operator approval for the exact pending run plan.
Approval does not carry to development.

## Retrospective

A task-to-scorer table would have prevented every analysis, motif, and
progression mismatch found after Phase 8c3. A denominator-state test would have
prevented the unavailable-result reporting defect. Keep both checks mandatory
before each provider-bearing package freeze.

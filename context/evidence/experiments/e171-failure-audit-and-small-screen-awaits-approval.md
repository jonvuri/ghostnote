---
title: E171 — Failure audit and small screen await approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E171 — Failure audit and small screen await approval

## Verdict

Do not treat development r1 as evidence that `FIELDS` is a dead end. The
frozen procedural result remains `revise`, but the format comparison is
inconclusive because prompt and framing defects caused material false
negatives.

The small prompt-repair screen is complete offline and awaits approval. No
provider or token-count request occurred.

## Direct failure audit

Three independent reviews traced selected OpenAI, Gemini, and recovered Haiku
trials from task and prompt through raw output, parsing, and scoring. Each
review covered exact-object passes with `FIELDS` failures and shared failures.
Gemini had only one exact-pass and `FIELDS`-fail trial.

The largest defect was this instruction:

`Include exactly one FIELDS id voice start duration pitch velocity line.`

OpenAI treated `line` as a seventh field in 13 of the 16 decision trials that
required document output. Removing only that invented header field and row
value made seven decision results pass every check. This diagnostic change
would move OpenAI `FIELDS` from 3/24 to 10/24 and reverse its comparison with
positional v1 from 3 versus 7 to 10 versus 7. It is not an official corrected
score.

Haiku also exposed ambiguous input delimiters, the literal `none` base value,
and analysis prompts that mixed the input-arm name with a separate output
grammar. Five of its eight exact-pass and `FIELDS`-fail trials had an obvious
mechanical prompt or framing component.

Gemini did not show the column ambiguity. Its inspected failures were mainly
real multi-constraint errors or one-shot variance. Its net `FIELDS` advantage
was three tasks, with one exact-only win and four `FIELDS`-only wins.

OpenAI changed pass/fail state on six of nine repeated prompts. Gemini and
Haiku each changed on two of nine. One independent sample per arm is not
sufficient for a small format effect.

## Small screen

[`compact-format-v11`](../../../brain/benchmarks/compact-format-v11/README.md)
uses four audited cases:

- analysis variants 27 and 29 test input comprehension with one shared
  `ANALYSIS` output grammar;
- progression variant 27 tests output serialization without an input
  document; and
- role-continuation variant 27 tests output serialization and the literal
  `none` header value.

Every provider runs the three arms twice. The screen makes at most 24 message
requests per provider and 72 in total. It makes no repair calls. Strict and
predeclared recoverable results remain separate. The screen cannot select a
format or enter holdout.

The repaired prompt:

- gives the exact `FIELDS` row as its own block;
- states that each note has exactly six values after `N`;
- separates input representation from output grammar;
- uses non-output-like input delimiters; and
- states exact header values, including the literal `none` token.

## Cost and approval

| Provider | Maximum messages | Hard limit |
|---|---:|---:|
| OpenAI | 24 | USD 0.300000 |
| Gemini | 24 | USD 0.200000 |
| Haiku | 24 | USD 0.750000 |
| Total | 72 | USD 1.250000 |

Haiku can make at most 24 token-count requests. The new guard records a
token-count attempt before the external request starts. A failed token-count
or message request is not retried without new approval.

The protocol SHA-256 is
`595e0bb6f150ba1c71df085b045df7ec92939853214824d2ce9e2bd9920981ae`.
The run-plan SHA-256 is
`93040710a2c7134bbeadeb29312056b28919da446c13b1c754867fee0be47403`.
The deterministic SHA-256 is
`bf09e4780603e94f1905a62fb694dc5f396aa2f0cf0e04adaf78624c7ad48e36`.

## Retrospective

Inspect raw discordant cases before scaling an early format experiment. A
small prompt defect can dominate a large strict-parser result.

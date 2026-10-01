---
title: Full grammar audit measures native and composite scoring asymmetries
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-full-grammar-audit
---

# E212: Full grammar audit measures scoring asymmetries

The operator requested independent manual judgments of complete retained
responses. Three auditors completed eight assignments. Each assignment
covered one format and one scoring asymmetry. They studied public language
rules before they decoded the notation. This work made no provider call.

## Scope and method

The [audit package](../../../brain/benchmarks/native-composite-v1/audits/README.md)
covers all 240 unique note outputs: two providers, four formats, two conditions,
and 15 tasks in each cell. It excludes analysis answers and sentinel repeats.
Each assignment read complete responses. Each also made at least 12 detailed
contract reviews, with defects and correct controls from both providers and
all five note-output families. These selections are targeted samples.

The totals below cover the full retained note-output cohort. They do not
estimate a rate on future tasks. Auditors independently decoded musical
values. The unchanged rubric then counted components. Complete documents
with actual syntax errors receive zero notation credit. No response was
repaired. Public grammar validity, prompt profile compliance, task correctness,
and notation/ledger agreement remain separate judgments.

Strudel used the official 1.2 runtime. MusicXML used the official 4.0 XSD and
independent event decoding. ABC and LilyPond used language documents and,
where needed, source code. No ABC or LilyPond compiler was used. Public
event decoding does not prove successful engraving or application import.

## Measured impact

Each format row has 666 planned components. These ratios weight components,
not prompts. The [synthesis](../../../brain/benchmarks/native-composite-v1/audits/synthesis.md)
also reports provider cells, equal-prompt means, strict task results, and limits.

| Format | Native through full grammar | Composite notation through full grammar | Composite ledger |
|---|---:|---:|---:|
| ABC | 467/666 (70.12%) | 432/666 (64.86%) | 613/666 (92.04%) |
| Strudel | 493/666 (74.02%) | 478/666 (71.77%) | 618/666 (92.79%) |
| LilyPond | 558/666 (83.78%) | 560/666 (84.08%) | 593/666 (89.04%) |
| MusicXML | 521/666 (78.23%) | 431/666 (64.71%) | 609/666 (91.44%) |
| All note tasks | 2039/2664 (76.54%) | 1901/2664 (71.36%) | 2433/2664 (91.33%) |

### Native profile penalty

Fourteen of 17 rejected native outputs have valid public syntax. They recover
136 components. Native accuracy rises from 1903/2664 (71.43%) to 2039/2664
(76.54%). None of these recovered responses becomes a complete task success.
Strict native success stays 31/120. The other three documents have real syntax
errors: one ABC response and two MusicXML responses.

The recovery varies by format and provider. OpenAI Strudel gains 15.02
percentage points; OpenAI LilyPond gains 8.71. Gemini MusicXML gains none.
The prompts requested restricted profiles. Valid public syntax can violate
those profiles. This audit measures recoverable music; it does not prove full
language capability under unrestricted prompts.

### Composite ledger credit

Composite notation receives 532 fewer components than its ledger. Only 38/120
notation bodies agree with their ledgers after full grammar decoding. Of the
other 82, 71 have decodable differences and 11 have actual syntax errors.
Twenty-five of 50 ledger-perfect responses fail when their notation is read.
Notation strict success is 25/120. Agreement and task success coincide in
24/120 responses. One different LilyPond voicing remains task-correct in both
channels, so disagreement alone is not a task failure.

The large ledger advantage does not establish the same notation advantage.
With both notation channels read through public grammar, native has the higher
component ratio in seven of eight provider/format cells. The pooled difference
is 5.18 percentage points in favor of native. LilyPond is near parity. These
are descriptive note-task comparisons, not revised six-family primary estimates
or proof of a general format preference.

The role rubric can grant harmony credit to empty required-onset groups when
all emitted notes have wrong onsets. Other timing requirements still prevent
full success. This affects partial-credit interpretation in both conditions.
Keep direct contract judgments alongside the component counts.

## Verification and unchanged observations

The signed [verification record](../../../brain/benchmarks/native-composite-v1/audits/verification.json)
checks all eight audit artifacts and 240 source cases. It verifies source,
task, prompt, and payload hashes. It reproduces component arithmetic and
notation/ledger agreement from the retained independent note values. It does
not certify the manual grammar judgments.

The frozen package check, artifact checks, context link check, and diff checks
pass. This session changes no frozen benchmark code, prompt, response, or score.
The [E211 assessment](e211-native-composite-diagnostic-closes-with-two-providers.md)
hash remains `e473b5a556cbfab22a48ae3c2abb806cfdf28ee112f40411beb06ecae0b608ba`.
Costs remain unchanged. The cache, `normal-v1`, and live projects remain unchanged.

[E213](e213-audit-adjudications-update-native-composite-scoring.md)
later integrates these adjudications into a separate assessment. It recomputes
all 48 paired cells, retains the 48 unique analysis scores, and excludes the
96 sentinel repeats. It preserves this audit and the original assessment.

## Next action and retrospective

Use separate notation accuracy, ledger accuracy, profile compliance, and
agreement fields for the product format decision. Define any revised scoring
policy before another provider run. Keep this audit separate from frozen
observations. Phase 8f remains pending operator review.

Before a future notation freeze, compare the subset parser with public grammar
on independent controls. Retain full decoded notation values beside ledger
values. This makes later interpretation audits cheaper and clearer.

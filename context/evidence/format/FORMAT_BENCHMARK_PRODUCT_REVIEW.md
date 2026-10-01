---
title: Format benchmark results and preliminary product judgments
kind: evidence
state: active
updated: 2026-10-01
phase: phase-8-agent-native-live-engine
session: phase8c4f-format-product-review
---

# Format benchmark results and preliminary product judgments

Compact `FIELDS` is the preferred preliminary direction for Ghostnote. Exact
JSON is the strongest alternative and the object-schema control. Native
LilyPond is the most balanced public notation candidate. Native MusicXML is
also worth review, especially with Gemini.

These judgments informed the operator selection in
[D25](../../decisions/d25-fields-json-document-format-and-publication.md).
FIELDS and JSON are selected encodings of one document model, and Phase 8f
is open. The comparative sections retain their preliminary evidence judgments.
No candidate has demonstrated reliable unchecked generation. High average
musical scores can hide failed harmony, cadence, or motif requirements.

## Part one Results matrices

### Reading guide and scope

The tables follow the requested priorities: recoverable structure, musical
accuracy with particular attention to creation, then token efficiency. They
keep these measures separate. There is no weighted product score.

| Measure | Meaning |
|---|---|
| Profile parse | The output passes the frozen subset parser. This is not canonical perfection or full public grammar validity. |
| Note extraction | The adapter returns note data. Compact recovery can read exact six-field rows despite missing metadata. For arms marked `+ ledger`, this measures the ledger. It does not prove that the body can be decoded. |
| Full note decode | The audit decodes the complete notation document without repair. This remains a retained-case judgment, not a production parser result. |
| Music mean | Mean fraction of musical checks passed, with equal weight per scored output. |
| Components | Correct musical components divided by all planned components. Larger exact-note tasks have more weight. |
| Creative mean | Music mean across progression, melody, motif continuation, and role continuation. This measures task requirements, not musical taste. |
| Tokens | Reported input plus output tokens per scored call. Output can include thinking. A lower relative percentage is better. |

The [corrected eight-arm matrix](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-30-corrected-assessment.json)
has 1,773 scored outputs: 592 OpenAI, 592 Gemini, and 589 Claude. Three Claude
output-limit outcomes are excluded from musical denominators. Its ten families
include edits, velocity, identity diagnostics, and serialization. It retains
sentinel repeats in its aggregates. All matrix tables below use that same
population unless a column specifies note outputs or applicable ID tasks.

The [adjudicated addendum](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-assessment.json)
has 288 unique outputs from OpenAI and Gemini. It contains 240 note outputs
and 48 analysis answers. It excludes 96 second sentinel outputs. Each
provider, family, format, and condition cell has only three unique outputs.
Its six families omit velocity and ID-dependent edits. Its task contracts and
component denominators differ from the matrix. Do not pool the runs or
interpret their score difference as a format effect.

The models were OpenAI `gpt-5.4-mini-2026-03-17`, Gemini `gemini-3.8-flash`,
and Claude `claude-haiku-4-5-20251001`, with the frozen reasoning settings.
These results describe those requests and fixtures. They are not a ranking of
all models or all musical tasks.

### Matrix 1 Overall eight-arm results

Rows are sorted by music mean. The score source is the emitted note data for
compact and JSON. For every `+ ledger` arm, including MIDI-like, it is the
side ledger. A high ledger score does not establish equally correct notation.

| Format | Profile parse | Note extraction | Music mean | Components | Creative mean | Tokens vs JSON |
|---|---:|---:|---:|---:|---:|---:|
| Exact JSON | 98.20% | 100.00% | 94.69% | 98.19% | 89.63% | 100.00% |
| Compact FIELDS | 99.10% | 100.00% | 94.56% | 97.81% | 90.16% | 81.76% |
| MIDI-like + ledger | 93.24% | 100.00% | 94.39% | 98.10% | 89.37% | 111.14% |
| Local labels | 95.50% | 98.99% | 92.68% | 97.23% | 85.86% | 88.09% |
| Strudel + ledger | 61.71% | 100.00% | 92.23% | 96.69% | 85.16% | 129.35% |
| LilyPond + ledger | 62.44% | 100.00% | 91.49% | 96.46% | 83.67% | 126.83% |
| MusicXML + ledger | 95.48% | 98.98% | 89.87% | 94.93% | 81.55% | 164.72% |
| ABC + ledger | 90.05% | 99.49% | 88.19% | 95.26% | 76.54% | 127.07% |

Profile parse uses all scored outputs. Note extraction uses only note-output
families. Thus these columns have different denominators. Extraction does not
prove the expected note count, correct metadata, or safe write authority.

`FIELDS` has two metadata failures, both with recoverable exact rows. JSON
returns notes in all note outputs despite four profile failures. Local labels
have seven recovered metadata failures and two outputs with no recovered
notes. These facts support a recoverable baseline for `FIELDS` and JSON.
The MIDI-like body still has 15 subset failures; its ledger supplies the notes.

The 0.13 percentage-point prompt-mean lead for JSON over `FIELDS` is small.
JSON also leads components by 0.38 points. These descriptive differences do
not establish a general musical advantage. The creation and provider tables
show where the candidates differ.

Source: [corrected assessment](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-30-corrected-assessment.json)
and [corrected decoder and scorer](../../../brain/benchmarks/symbolic-format-v5/corrected_assessment.py).

### Matrix 2 Task family accuracy

Cells show equal-output music means. `Read notes` is structure comprehension;
it measures musical content, not parser success. The other labels identify
the task operations. All `+ ledger` note scores still measure ledger content.

| Format | Read notes | Analysis | Local edit | Revoice | Rhythm edit | Serialize |
|---|---:|---:|---:|---:|---:|---:|
| Exact JSON | 100.00% | 93.23% | 100.00% | 99.11% | 100.00% | 100.00% |
| Compact FIELDS | 100.00% | 90.62% | 100.00% | 98.44% | 100.00% | 100.00% |
| MIDI-like + ledger | 100.00% | 91.67% | 100.00% | 98.96% | 100.00% | 100.00% |
| Local labels | 100.00% | 90.45% | 100.00% | 98.70% | 99.72% | 100.00% |
| Strudel + ledger | 100.00% | 92.19% | 99.86% | 95.47% | 100.00% | 100.00% |
| LilyPond + ledger | 100.00% | 92.71% | 99.00% | 97.14% | 97.50% | 100.00% |
| MusicXML + ledger | 98.40% | 95.14% | 95.83% | 96.67% | 93.75% | 100.00% |
| ABC + ledger | 97.29% | 93.58% | 99.93% | 97.50% | 98.33% | 90.00% |

| Format | Progression | Melody | Motif continuation | Role continuation |
|---|---:|---:|---:|---:|
| Exact JSON | 73.96% | 92.86% | 98.85% | 92.86% |
| Compact FIELDS | 81.77% | 89.29% | 97.92% | 91.67% |
| MIDI-like + ledger | 78.12% | 88.10% | 99.58% | 91.67% |
| Local labels | 78.65% | 80.36% | 95.73% | 88.69% |
| Strudel + ledger | 74.48% | 84.52% | 97.71% | 83.93% |
| LilyPond + ledger | 77.60% | 75.16% | 95.83% | 85.71% |
| MusicXML + ledger | 78.12% | 70.19% | 94.06% | 83.33% |
| ABC + ledger | 48.44% | 81.37% | 95.00% | 81.55% |

Most exact edits are near 100%. Creation separates the leading formats more
clearly. `FIELDS` leads progression generation. JSON leads melody and role
continuation. MIDI-like leads motif continuation. Local labels do not improve
the balance in this cohort.

Source: the format and family aggregates in the
[corrected assessment](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-30-corrected-assessment.json).

### Matrix 3 Provider performance

Each cell is **profile parse / music mean**. Providers have equal matrix
coverage apart from the three excluded Claude outputs. The two measures
refer to different output channels in the ledger arms.

| Format | OpenAI parse / music | Gemini parse / music | Claude parse / music |
|---|---:|---:|---:|
| Exact JSON | 97.30% / 96.11% | 97.30% / 95.64% | 100.00% / 92.32% |
| Compact FIELDS | 97.30% / 95.55% | 100.00% / 94.69% | 100.00% / 93.45% |
| MIDI-like + ledger | 98.65% / 95.34% | 81.08% / 94.65% | 100.00% / 93.17% |
| Local labels | 97.30% / 94.62% | 97.30% / 92.44% | 91.89% / 90.99% |
| Strudel + ledger | 59.46% / 92.34% | 64.86% / 91.89% | 60.81% / 92.47% |
| LilyPond + ledger | 64.86% / 91.04% | 59.46% / 92.92% | 63.01% / 90.51% |
| MusicXML + ledger | 98.65% / 85.98% | 100.00% / 92.77% | 87.67% / 90.88% |
| ABC + ledger | 97.30% / 90.26% | 91.89% / 92.29% | 80.82% / 81.94% |

The leading compact and JSON results hold across providers. MIDI-like is less
consistent on body syntax: Gemini passes 81.08%, while Claude passes 100%.
LilyPond and Strudel have low frozen subset rates. The later grammar audit
shows why those subset rates alone cannot rank public notation reliability.

Source: provider aggregates in the
[corrected assessment](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-30-corrected-assessment.json).

### Matrix 4 Token efficiency

Rows are sorted by mean total tokens. Provider columns compare each arm with
JSON on the same provider; JSON is 100%. These relative columns are preferable
to treating different tokenizers as one common unit. Pooled means summarize
this equal-provider workload. They are not a tokenizer-independent format size.

| Format | Mean input | Mean output | Mean total | OpenAI vs JSON | Gemini vs JSON | Claude vs JSON |
|---|---:|---:|---:|---:|---:|---:|
| Compact FIELDS | 659.7 | 1,098.0 | 1,757.7 | 80.13% | 73.08% | 86.34% |
| Local labels | 718.3 | 1,175.4 | 1,893.7 | 88.23% | 77.67% | 92.43% |
| Exact JSON | 836.7 | 1,313.1 | 2,149.8 | 100.00% | 100.00% | 100.00% |
| MIDI-like + ledger | 821.0 | 1,568.2 | 2,389.3 | 98.90% | 102.86% | 121.38% |
| LilyPond + ledger | 794.3 | 1,932.3 | 2,726.6 | 120.62% | 95.68% | 144.29% |
| ABC + ledger | 759.2 | 1,972.5 | 2,731.7 | 139.39% | 77.32% | 142.19% |
| Strudel + ledger | 834.5 | 1,946.1 | 2,780.7 | 123.57% | 87.81% | 150.15% |
| MusicXML + ledger | 1,234.7 | 2,306.5 | 3,541.2 | 172.54% | 162.78% | 161.98% |

`FIELDS` is the lowest in reported total tokens for every provider. Its pooled
saving against JSON is 18.24%. Local labels cost more than `FIELDS` while
scoring lower. MusicXML is the most expensive matrix arm by this measure.
Input includes the grammar, task, and representation. Output includes
reported reasoning where the provider includes it in usage.

Source: the retained calls in the
[OpenAI manifest](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-29-openai.json)
and the Gemini and Claude continuation chains selected by
[`CHAIN_NAMES`](../../../brain/benchmarks/symbolic-format-v5/corrected_assessment.py).
Means use each scored initial call once. No repair call is included.

### Matrix 5 Complete measured checks and creation weaknesses

This view focuses on the four custom-format candidates. `All musical checks`
requires every corrected musical case check to pass. Exact-note cases can
still omit checks on surplus notes. `All music and response checks` also
requires the frozen response checks, such as exact count, unique IDs, and
notation/ledger agreement, when applicable. Neither column requires canonical
text. Neither is a full product conformance certificate.

| Format | All musical checks | All music and response checks | Progression all checks | Melody all checks | Roles all checks | ID preservation |
|---|---:|---:|---:|---:|---:|---:|
| Compact FIELDS | 70.72% | 70.72% | 25.00% | 45.83% | 58.33% | 100.00% |
| Exact JSON | 73.42% | 73.42% | 8.33% | 62.50% | 62.50% | 99.02% |
| MIDI-like + ledger | 70.27% | 68.02% | 8.33% | 45.83% | 58.33% | 94.12% |
| Local labels | 65.32% | 64.41% | 12.50% | 20.83% | 45.83% | 96.08% |

ID preservation uses the exact-note tasks where that diagnostic applies.
Generation columns require all primary musical checks in that family. The
corrected melody rubric replaces the ambiguous whole-number-onset harmony
check with the required lead voice. Harmony remains a separate diagnostic.
An all-check pass does not establish compliance with that excluded check.

The requirement detail exposes errors that averages hide:

| Requirement | FIELDS | Exact JSON | MIDI-like + ledger |
|---|---:|---:|---:|
| Progression harmony | 33.33% | 12.50% | 25.00% |
| Progression authentic cadence | 75.00% | 58.33% | 66.67% |
| Melody mode | 66.67% | 66.67% | 66.67% |
| Melody motif | 79.17% | 100.00% | 75.00% |
| Melody cadence | 79.17% | 91.67% | 87.50% |

For example, all three candidates pass the progression requirement for four
chord starts in 100% of outputs. That helps their averages while harmony
remains weak. `FIELDS` progression averages 81.77%, but only 25% pass all
progression checks. JSON melody averages 92.86%, with 62.50% passing all
melody checks. A format choice alone will not remove these musical errors.

Source: corrected cases from the retained calls, through
[`corrected_row`](../../../brain/benchmarks/symbolic-format-v5/corrected_assessment.py).

### Matrix 6 Adjudicated native and composite notation

This is a separate comparison on the fresh addendum tasks. Both musical
channels below use notation decoded through the full grammar audit. Rows
are sorted by note music mean. Each row has 30 unique note outputs, plus six
analysis answers that are omitted from this table.

| Format | Full note decode | Note profile parse | Note music mean | Note components | Creative mean | Strict note success |
|---|---:|---:|---:|---:|---:|---:|
| LilyPond native | 100.00% | 90.00% | 80.03% | 83.78% | 75.04% | 23.33% |
| LilyPond composite | 96.67% | 90.00% | 79.83% | 84.08% | 75.04% | 23.33% |
| MusicXML native | 93.33% | 90.00% | 77.55% | 78.23% | 76.10% | 36.67% |
| Strudel native | 100.00% | 73.33% | 67.15% | 74.02% | 58.94% | 23.33% |
| Strudel composite | 100.00% | 90.00% | 63.50% | 71.77% | 54.37% | 23.33% |
| MusicXML composite | 80.00% | 80.00% | 62.59% | 64.71% | 61.57% | 20.00% |
| ABC native | 96.67% | 90.00% | 55.87% | 70.12% | 44.83% | 20.00% |
| ABC composite | 86.67% | 76.67% | 53.92% | 64.86% | 42.49% | 16.67% |

Native LilyPond has the strongest note music mean and complete decoding in
all retained note outputs. Native MusicXML leads strict note success and is
slightly higher on the four-family creative mean. Native Strudel decodes
fully but loses more musical requirements. ABC remains weak on creation.

Full decoding recovers 14 of 17 native subset rejections. Across all native
formats, complete note decode is 97.50%; composite notation is 90.83%.
The recovery creates no new strict native task success. Structure recovery
and musical recovery are therefore separate results.

Source: [adjudicated records](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-assessment.json)
and [audit synthesis](../../../brain/benchmarks/native-composite-v1/audits/synthesis.md).

### Matrix 7 Adjudicated task families

These cells show equal-prompt musical accuracy. Analysis keeps its original
deterministic answer scores. All other cells use audited notation values.

| Format | Read notes | Analysis | Progression | Melody | Motif | Roles |
|---|---:|---:|---:|---:|---:|---:|
| LilyPond native | 100.00% | 71.43% | 73.61% | 78.57% | 64.65% | 83.33% |
| LilyPond composite | 98.98% | 78.57% | 65.28% | 76.19% | 68.69% | 90.00% |
| MusicXML native | 83.33% | 76.19% | 76.39% | 66.67% | 69.70% | 91.67% |
| Strudel native | 100.00% | 70.63% | 55.56% | 61.90% | 44.95% | 73.33% |
| Strudel composite | 100.00% | 87.30% | 36.11% | 71.43% | 44.95% | 65.00% |
| MusicXML composite | 66.67% | 78.57% | 52.78% | 50.00% | 65.15% | 78.33% |
| ABC native | 100.00% | 54.76% | 8.33% | 64.29% | 55.05% | 51.67% |
| ABC composite | 99.66% | 84.92% | 6.94% | 73.81% | 35.86% | 53.33% |

Native LilyPond is more balanced between progression and melody than native
MusicXML. MusicXML is strongest on role continuation. ABC progression stays
below 10% in both conditions. Strudel's complete decoding does not prevent
large motif and progression errors.

Source: [adjudicated paired cells](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-report.md).

### Matrix 8 Notation ledger and analysis channels

The first three score columns are component ratios on note tasks. Agreement
requires exact decoded notation/ledger equality. The final two columns are
prompt means across all six families, including analysis.

| Format | Native notation | Composite notation | Composite ledger | Exact agreement | Native all-task mean | Composite all-task mean |
|---|---:|---:|---:|---:|---:|---:|
| LilyPond | 83.78% | 84.08% | 89.04% | 40.00% | 78.60% | 79.62% |
| MusicXML | 78.23% | 64.71% | 91.44% | 40.00% | 77.32% | 65.25% |
| Strudel | 74.02% | 71.77% | 92.79% | 30.00% | 67.73% | 67.47% |
| ABC | 70.12% | 64.86% | 92.04% | 16.67% | 55.68% | 59.09% |

Across note tasks, native notation earns 76.54% of components, composite
notation 71.36%, and composite ledgers 91.33%. Exact agreement is 31.67%.
Half of the ledger-perfect note outputs fail when notation is read.

Analysis changes the all-task comparison. Composite analysis averages 82.34%,
versus 68.25% native. Across all six families, component accuracy is 75.22%
native and 73.11% composite; prompt means are 69.83% and 67.86%. Strict
all-task success is 21.53% native and 22.92% composite. The latter composite
lead comes from analysis successes, while native leads strict note success:
25.83% versus 20.83%.

The ledger can help analysis. The evidence does not show that asking for a
ledger improves the correctness of emitted notation. Agreement alone is also
insufficient: one LilyPond response contains different valid bass voicings
in its two channels, and both satisfy the task.

Source: [adjudicated assessment](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-assessment.json)
and [full grammar synthesis](../../../brain/benchmarks/native-composite-v1/audits/synthesis.md).

### Matrix 9 Native provider and token tradeoffs

Music columns use note tasks only. Token columns pool OpenAI and Gemini.
They use all unique tasks in each arm, including analysis, and compare with
native LilyPond. The input comparison
is less affected by reasoning length than the total-token comparison.

| Format | OpenAI note mean | Gemini note mean | Pooled input vs LilyPond | Pooled total vs LilyPond |
|---|---:|---:|---:|---:|
| LilyPond native | 79.71% | 80.36% | 100.00% | 100.00% |
| LilyPond composite | 79.84% | 79.81% | 131.66% | 118.95% |
| MusicXML native | 69.08% | 86.03% | 176.55% | 143.77% |
| Strudel native | 76.49% | 57.81% | 106.86% | 111.78% |
| Strudel composite | 70.78% | 56.21% | 138.52% | 136.22% |
| MusicXML composite | 43.56% | 81.61% | 208.21% | 171.68% |
| ABC native | 52.52% | 59.21% | 96.37% | 128.19% |
| ABC composite | 52.30% | 55.54% | 128.03% | 148.72% |

LilyPond's native note means are close across providers. MusicXML varies much
more. Native MusicXML uses 76.55% more input tokens than native LilyPond in
this workload. Its total-token ratio to native LilyPond is 120.27% on OpenAI
and 216.85% on Gemini. LilyPond composite uses 31.66% more input and 18.95%
more total tokens, with little change in notation task accuracy.

Total-token differences also include reasoning behavior. One Gemini native
ABC melody response uses 8,284 thinking tokens. Native ABC has slightly less
input than native LilyPond, but more total tokens in this sample. Do not infer
a universal token cost from that outlier.

Source: [adjudicated records](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-assessment.json)
and unique initial calls in the diagnostic
[OpenAI](../../../brain/benchmarks/native-composite-v1/runs/openai.json) and
[Gemini](../../../brain/benchmarks/native-composite-v1/runs/gemini.json) manifests.

### Evidence limits that affect the decision

The matrix includes sentinel repeats; the addendum does not. As a sensitivity
check, removing matrix repeats gives music means of 94.49% for `FIELDS`,
94.58% for JSON, and 94.36% for MIDI-like. This retains their close ordering.
It does not make either run a new independent holdout.

Repeat observations show variability. In the original addendum, component
outcomes match in 25.00% of OpenAI sentinel comparisons and 47.92% of Gemini
comparisons. Payloads match in 10.42% and 33.33%. These are frozen subset/ledger
repeat results. There is no adjudicated repeat-stability result.

The audit used the official Strudel runtime and MusicXML XSD with event
decoding. ABC and LilyPond have agent grammar judgments without compiler
validation. Complete decoding does not prove successful import or engraving.
The role rubric can grant partial harmony credit to empty required-onset
groups. Other timing checks still prevent a full task pass. Three prompts per
addendum cell give coarse uncertainty; intervals exclude judgment error.

The full matrix had no comparable full public grammar adjudication. In
particular, its old Strudel body parser ignored `.slow()`. The separate
addendum repaired that parser boundary. Its results cannot retroactively
supply full grammar scores for matrix responses.

Retained matrix calls cost USD 15.72944325. Retained diagnostic calls cost
USD 2.52608325. The discarded Claude diagnostic attempt adds USD 0.35133900.
These are historical measured costs. The incomplete matrix r9 read can have
an unknown additional provider charge. This review made no provider call.

Sources: [matrix repair](../experiments/e209-offline-score-repair-updates-eight-arm-matrix.md),
[diagnostic closeout](../experiments/e211-native-composite-diagnostic-closes-with-two-providers.md),
[grammar audit](../experiments/e212-full-grammar-audit-measures-native-composite-asymmetries.md),
and [adjudication integration](../experiments/e213-audit-adjudications-update-native-composite-scoring.md).

## Part two Preliminary product judgments

### Compact FIELDS as the preferred working format direction

`FIELDS` offers the best observed balance for Ghostnote's finite note reads
and edits. All note outputs contain recoverable note data. Exact edits are
near perfect in Matrix 2, and expected IDs stay bound to their notes in 100%
of applicable tasks. It is close to JSON on music mean and components, leads
progression generation, and uses fewer total tokens on every provider.
These results support it as the first design candidate.

The creation detail is mixed. `FIELDS` progression has the highest mean among
the custom candidates and passes all requirements in 25% of outputs, compared
with JSON's 8.33%. JSON has stronger melody and role results. The preferred
choice therefore depends on the intended workload; the data do not establish
that `FIELDS` produces better music in every family.

A concrete paired case illustrates its progression strength. In OpenAI
progression variant 4003, `FIELDS` sequence 16 passes all eight requirements.
JSON sequence 10 fails harmony, and MIDI-like sequence 15 fails range. The
`FIELDS` output fails canonical form but passes structure and music. This is
useful evidence for the requested recoverable baseline.

A counterexample prevents an overly broad judgment. In OpenAI role variant
4002, `FIELDS` sequence 151 fails cadence, density, starts, harmony, and voice
leading. JSON sequence 145 and MIDI-like sequence 150 pass all seven
corrected checks.
These selected cases explain aggregate tradeoffs; they are not rate estimates.
Source: [complete OpenAI matrix responses](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-29-openai.json).

The current benchmark syntax is not a final public contract. The compact core
omits channel, mute, release velocity, articulation, and expression. Existing
patch rules preserve omitted fields; insertion rules use named defaults.
Phase 8f must define complete documents, sparse patches, field authority,
identity, conflicts, and normalization loss. Token efficiency must be checked
again after those decisions. Source:
[compact limitations](COMPACT_BAR_LIMITATIONS.md) and
[Phase 8f contracts](../../plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md).

### Exact JSON as the strongest alternative and object-schema control

JSON has the highest matrix music mean, components, and rate of all measured
musical checks passing. It also has recoverable note data in every note output.
It is the strongest alternative when an explicit object schema is preferred.
The fresh matrix JSON arm uses `ghostnote-compact-format-v6` and omits the same
five fields as compact. The older complete-state JSON description does not
apply to this scored arm. None of these fresh results certifies a complete
host-state representation.

Its melody advantage is clear within this cohort: 92.86% mean accuracy and
62.50% all-check success, versus `FIELDS` at 89.29% and 45.83%. The motif
requirement passes in every JSON melody, compared with 79.17% for `FIELDS`.
In OpenAI melody variant 4001, JSON sequence 401 passes all seven corrected
checks.
`FIELDS` sequence 407 breaks the required five-semitone motif transposition.
This gives a direct example of JSON's advantage in Matrix 5.

JSON costs more tokens and has weaker progression results. Its overall
prompt-mean lead is only 0.13 points. My preliminary judgment is to retain it
as the object-schema reference and a credible primary alternative. A decision
to prefer `FIELDS` should keep JSON's melody advantage visible.
Sources: [OpenAI matrix responses](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-29-openai.json)
and [fresh JSON adapter](../../../brain/benchmarks/symbolic-format-v3/formats.py)
and [compact core omissions](../../../brain/benchmarks/compact-format-v6/core.py).

### MIDI-like as a capable numeric profile with extra format risk

MIDI-like scores close to the top two on music and has the highest motif
continuation mean. It uses 11.14% more pooled total tokens than JSON, and its
ID preservation is lower. OpenAI is a small exception: its total token mean is
1.10% below JSON, while Gemini and Claude are above it.

Its event body and side ledger can diverge. The frozen body parser rejects
15 outputs, including 14 from Gemini. Failures include multiple events on one
line, incorrect event tokens, and reversed field order. Ledger extraction
keeps its musical score high. The high score therefore supports its numeric
ledger more directly than its MIDI-like event body.

My preliminary judgment is to keep it as a comparison profile, below `FIELDS`
and JSON for the main document. This is a Ghostnote text profile, not evidence
about binary MIDI or standard MIDI interchange. Sources:
[registered adapters](../../../brain/benchmarks/symbolic-format-v4/formats.py) and
[retained matrix calls](../../../brain/benchmarks/symbolic-format-v5/corrected_assessment.py).

### Native LilyPond as the best balanced public notation candidate

LilyPond stands out after the public grammar audit. Native note decoding is
100%, note music mean is 80.03%, and creative mean is 75.04%. Its OpenAI and
Gemini note means are close. Native and composite creative means are both
75.04%, while the composite adds tokens and agrees with its ledger in only
40% of note outputs.

A native OpenAI role response, sequence 83, uses valid `bes` and `ees` pitch
spellings. Full grammar decoding recovers 9/10 components from a subset
rejection. Its bass leap still exceeds the contract limit. The example shows
why a low subset score should not be treated as irrecoverable syntax, and why
valid syntax does not imply correct music.

My preliminary judgment is to consider native LilyPond for notation-focused
reads, generation, or export. It has a narrower tested task surface than the
custom formats. It has no compiler certificate in this audit, and only 23.33%
of note tasks are strict successes. The evidence does not establish it as a
replacement for the main edit document. Source:
[full grammar synthesis and examples](../../../brain/benchmarks/native-composite-v1/audits/synthesis.md).

### Native MusicXML as a strong interchange candidate with provider dependence

MusicXML has the highest native strict note success, at 36.67%, and the highest
native role mean, at 91.67%. Its creative mean is slightly above LilyPond's.
Gemini performs particularly well: native note mean is 86.03%, and progression
mean is 88.89% with one strict success in three tasks. OpenAI native note mean
is 69.08%. This provider difference matters more than the small pooled
creative lead over LilyPond.

Its disadvantages are body validity and size. Native complete decoding is
93.33%, compared with LilyPond's 100%. It uses 76.55% more input tokens.
Composite MusicXML is weaker still: OpenAI sequence 79 has a perfect 49/49
ledger with an invalid MusicXML tree. Its composite decode rate is 80%.

My preliminary judgment is to retain native MusicXML for an interchange path
and for a Gemini-specific option. It is less attractive as the common working
format across providers. XSD checking supports the retained syntax judgments,
but the audit did not test application import. Sources:
[adjudicated provider cells](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-report.md)
and [audit synthesis](../../../brain/benchmarks/native-composite-v1/audits/synthesis.md).

### Why the other formats do not lead this decision

Local labels add repeated field names without improving this matrix. They
cost 7.74% more pooled tokens than `FIELDS`, have lower music and creation
means, and have two outputs with no recovered notes. The evidence does not
justify their extra text for the main format.

Strudel has complete native decoding but weaker musical results. The pinned
runtime accepts `~@0` as weight one. It reads `@21/2` as weight 21 with a slow
operator, rather than the intended rational weight. These examples explain
how valid pattern syntax can still carry wrong timing. Its current evidence
is stronger for a separate pattern workflow than for exact finite editing.

ABC is small on input text, but its native progression mean is only 8.33%.
OpenAI composite sequence 45 has a perfect ledger but wrong onset and duration
in notation. Under `L:1/48`, `^D24` lasts two beats, against a half-beat
requirement. Musical reliability outweighs that possible size benefit.
Source: [audit synthesis](../../../brain/benchmarks/native-composite-v1/audits/synthesis.md).

Older REMI+, OctupleMIDI, Alda, and cycle results explain earlier exclusions.
Their cohorts and scoring policies differ. They cannot join this fresh common
ranking. Source: [benchmark design backlog](SYMBOLIC_BENCHMARK_DESIGN_BACKLOG.md).

### Selected direction and next work

The measured recovery and music results support FIELDS as the preferred
model-facing encoding. JSON is the required alternate encoding of the same
document model. Native notation remains comparison evidence; it is outside
the selected exact note/rhythm I/O contract.

The operator accepted FIELDS and JSON through D25. FIELDS is preferred for
model I/O; JSON or equivalent objects serve the nearby internal boundary.
Both encodings must preserve the same supported semantic values. The decision
retains the need to handle the weak generation requirements in Matrix 5.

Any later notation export could derive from that selected document. This is
an optional downstream idea. It does not establish a musical benefit for
models that reason in notation, and it is outside the required format work.

[Phase 8f](../../plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md)
will define version 1.0, implement the reference codec and model reference,
and settle host bindings. The current benchmark grammar is evidence, not the
final specification.

### Verification and retrospective

All corrected provider, format, and family aggregates were reproduced from
retained rows before the extra views were calculated. The addendum tables use
unique adjudicated records and matching initial calls. Percentages are rounded
to two decimals. Relative token values use unrounded means. The signed
adjudicated artifacts and context links were checked separately. Review
checks corrected the historical complete-state JSON claim and made the melody
score policy explicit. No provider
request, cache change, fixture edit, or live-project action was needed.

Retrospective: label the musical score source in every future summary table.
Keep body recovery, ledger recovery, and profile conformance separate. This
prevents a compact aggregate from hiding a representation mismatch.

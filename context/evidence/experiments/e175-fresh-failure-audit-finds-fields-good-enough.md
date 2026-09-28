---
title: E175 — Fresh failure audit finds FIELDS can be good enough
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E175 — Fresh failure audit finds FIELDS can be good enough

## Verdict

The manual audit found no remaining simple defect in the `FIELDS` header. The
v12 prompt repairs worked. `FIELDS` is a defensible practical choice if the
goal is a compact canonical note plane with reliable serialization.

One new format hypothesis remains plausible: repeat short field labels on
each note row. This can test whether JSON's local labels explain its Gemini
advantage. It is a new format variant, not a repair to `FIELDS`.

Do not run another broad comparison. Either accept `FIELDS` as good enough or
test the local-label hypothesis with one small Gemini-first diagnostic.

## Audit scope

Three independent inspections traced 25 unique provider fixtures and all 75
paired arm outputs. The sample covered every provider, format, and decision
family. It included exact-only wins, `FIELDS`-only wins, shared failures,
positional-v1 failures, and both Haiku output-limit results.

For each selected result, the audit regenerated the prompt, matched its hash,
read the raw payload, checked the expected values, and reproduced the frozen
parser and scorer result.

No prompt-hash mismatch, scorer error, transport error, or denominator error
appeared. The old invented `line` column, blank `BASE`, leaked end marker, and
analysis-label failure did not recur.

## Provider findings

### OpenAI

The audit traced six fixtures and 18 arm outputs. `FIELDS` motif wins were
substantive. The declaration plausibly helped keep start and duration values
in their correct columns. Analysis losses were isolated one-field reasoning
errors. Progression losses were ordinary range and pitch-class mistakes.

One exact-JSON motif response used equivalent mixed fractions such as
`32 5/8`. The parser requires an integer or one `a/b` value, but the prompt
does not state this rule. This is an experiment-design false negative for the
exact control, not a `FIELDS` failure.

### Gemini

The audit traced ten fixtures and 30 arm outputs. `FIELDS` and positional v1
both passed syntax on 24/24 unique results. The remaining errors were musical
classification, rational arithmetic, or multi-constraint planning errors.

Exact JSON's repeated local labels may help on dense analysis and progression
tasks. On one progression, positional v1 and `FIELDS` produced the same bad
notes while exact JSON found a valid voicing. This is the strongest new
format-level hypothesis.

The repeated progression-91 prompt reversed the exact-versus-`FIELDS` result:
the unique exact result passed and `FIELDS` failed, while the repeat exact
result failed and `FIELDS` passed. The arm ranking is not stable on this
family.

### Haiku

The audit traced nine fixtures and 27 arm outputs. No unique case had an exact
JSON pass and a `FIELDS` failure. `FIELDS` had no candidate-only loss against
either control in any family.

The strongest serialization evidence came from progression. `FIELDS` passed
syntax on 8/8 results. Positional v1 passed syntax on 1/8. V1 shifted values
between columns, inserted a pitch-class column, and reused note IDs. The fixed
declaration prevented these failures.

The remaining `FIELDS` progression failures were coverage, cadence, range, or
movement errors. They are planning failures, not format failures.

## Experiment-design findings

The durable
[symbolic benchmark design backlog](../format/SYMBOLIC_BENCHMARK_DESIGN_BACKLOG.md)
retains these findings and their required treatment across benchmark versions.

1. Progression is not a stable format discriminator. It has no input
   document, all formats perform poorly, and an identical-prompt sentinel
   reversed the Gemini and Haiku `FIELDS` result.
2. Provider-default sampling gives one primary sample per arm. The arms also
   run in blocks instead of an interleaved order. Small differences cannot be
   assigned confidently to the format.
3. Strict binary scoring hides near misses. One wrong value can fail a complete
   multi-case analysis batch or a complete progression.
4. Analysis batches contain different case counts, but each batch has equal
   headline weight. Per-case accuracy is a better development diagnostic.
5. The numeric grammar does not explicitly forbid mixed fractions. State that
   time values must be integers or reduced improper `a/b` fractions.
6. The parser can report a canonical syntax failure when a wrong calculated
   time changes note order. Keep strict conformance, but also report the
   structural parse and musical cause.
7. Only the `FIELDS` prompt states the six-value row arity in explicit prose.
   This is part of the candidate contract, but it prevents a clean attribution
   of gains to the declaration alone.
8. The task prompt should state that note IDs are globally unique. The motif
   formula can use `2*axis-source_pitch+semitones` to avoid precedence errors.

## Remaining hypotheses

### Accept current `FIELDS`

This is the recommended default. `FIELDS` beat positional v1 on every
provider, passed syntax on 71/72 unique results, and led motif continuation.
Its average prompt was about 12 percent smaller than exact JSON. Its completed
response payload was about 57 percent smaller.

No inspected failure suggests another small header change. Most remaining
losses are one-shot reasoning errors or progression planning failures.

### Test local row labels

If exact-JSON parity on Gemini remains necessary, test a row such as:

```text
N id=n1 voice=bass start=24 duration=3/2 pitch=47 velocity=78
```

This retains a line format but repeats semantic binding at the point of use.
It costs more tokens than `FIELDS`. Use a small Gemini-first diagnostic on
dense analysis and progression cases. Do not repeat motif or run all providers
until this hypothesis passes.

### Improve shared tasks

Use per-case diagnostics for analysis and a visible constraint checklist for
progression. These changes can improve measurement and model planning, but
they do not justify another `FIELDS` revision.

## Consequence

The simple-repair path is exhausted. Retain `FIELDS` and retire positional v1.
The next operator decision is product-level:

- accept `FIELDS` as good enough and freeze a targeted holdout; or
- buy one small Gemini-first local-label diagnostic before selection.

Do not run another full-family comparison.

## Retrospective

Use direct paired-output inspection before interpreting a strict aggregate.
Keep conformance scores, diagnostic component scores, and sampling stability
separate.

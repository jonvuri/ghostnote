# V15 validity-ladder protocol

## Purpose

Measure format behavior across positive, light, moderate, and stress work. The
run checks whether the benchmark is valid and whether every format shows
useful, non-perfect musical performance. It does not select a format.

## Frozen changes from v14

- Use `pitch=(2*axis)-source_pitch+semitones` for affine continuation.
- Include a neutral numeric affine example.
- Use JSON key and string terminology in the exact JSON serialization prompt.
- Use three one-case, three two-case, and two four-case analysis fixtures.
- Score and report every independent case and component.
- Keep planned component denominators after parse failures.
- Remove whole-response musical scores, noninferiority gates, informativeness
  bands, and the exact JSON capability-control gate.
- Set OpenAI and Gemini reasoning to medium.
- Set Claude Haiku thinking to 4,096 tokens and `max_tokens` to 24,000.

## Measurement

For analysis, one chord-and-motif item is one case with eight components. For
document work, one expected note is one case with six components. Document
context checks are response components. They contribute to global component
accuracy, but not to average per-case accuracy or the perfect-case rate.

For each provider, family, difficulty, and format, report:

1. global component correct, planned, and accuracy;
2. average per-case component accuracy;
3. perfect case count, total case count, and perfect case rate;
4. structural parse and canonical form conformance;
5. planned, attempted, completed, available, and scored responses;
6. prompt bytes, response bytes, input tokens, and output tokens.

Do not pool providers. Do not replace case-level measurements with a
whole-response musical pass.

## Interpretation

Exact-object JSON must be valid JSON that matches its frozen document schema.
It has no musical minimum and is not a capability control.

The automatic result is `operator-review` when every provider completes at
least 95 percent of planned work and every provider-format-family-difficulty
cell scores at least 75 percent of planned responses. Otherwise, the result is
`invalid`. These are operational validity checks, not musical performance
gates.

The operator decides whether performance is decent but not flawless and
whether Phase 8c4e can start.

## Calls and cost

Run 108 messages per provider and 324 messages in total. Do not retry or
repair. Stop a provider on its first transport or budget failure, or after
three unavailable responses.

The planning estimate is USD 4.750000. The provider hard limits are USD
1.200000 for OpenAI, USD 0.550000 for Gemini, and USD 4.600000 for Claude
Haiku. The total hard limit is USD 6.350000.

No live request is approved by this package. A separate approval file must
match every frozen identity and cost field.

## Settings basis

The frozen settings use the current provider controls documented by
[OpenAI](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
[Google](https://ai.google.dev/gemini-api/docs/generate-content/thinking), and
[Anthropic](https://platform.claude.com/docs/en/build-with-claude/extended-thinking).

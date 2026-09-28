---
title: E169 — Paired development cost budget correction
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E169 — Paired development cost budget correction

## Verdict

The USD 53.298000 draft ceiling was arithmetically correct but operationally
wrong. It multiplied the full 12,000-input-token and 12,000-output-token
reservation by all 846 possible calls. It assumed that every initial request
would fail, every failure would receive a repair, and every message would use
its complete token allowance.

Replace that ceiling before approval. Keep the 12,000-token output limit that
prevented the Haiku calibration truncation. Use cumulative provider budgets
and a bounded repair sample.

## Price audit

The frozen standard prices remain correct:

- [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini):
  USD 0.75 input, USD 0.075 cached input, and USD 4.50 output per million
  tokens;
- [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/pricing): USD 0.75
  input, USD 0.075 cached input, and USD 3.75 output per million tokens through
  2026-12-31; and
- [Claude Haiku 4.5](https://platform.claude.com/docs/en/models/overview): USD
  1 input and USD 5 output per million tokens.

Calibration r2 gives a useful scale check. Its 268 calls cost USD 2.071718 in
total, including the higher-cost Sonnet tier. The first development ceiling
was more than 25 times that measured spend because it treated every possible
call as a maximum-token call.

## Corrected guard

Keep 141 initial calls per provider. Cap repairs at 48 per provider in the
preregistered shuffled job order. Repairs do not affect candidate selection.
Report eligible failures that the cap excludes.

| Provider | Maximum calls | Hard budget |
|---|---:|---:|
| OpenAI | 189 | USD 1.500000 |
| Gemini | 189 | USD 0.750000 |
| Haiku | 189 | USD 2.750000 |
| Total | 567 | USD 5.000000 |

Before each request, reserve its full token-bound cost against the provider
budget. Refuse the request when the reservation does not fit. Settle a
successful request to exact measured cost. Keep a failed request's full
reservation.

This guard reduces the approved ceiling by 90.6 percent. It does not lower the
output limit or weaken the fresh paired initial estimate.

No provider or token-count request occurred during this correction.

## Retrospective

Separate per-call safety from total-run budgeting. A maximum-token reservation
is useful for the next call. It is not a realistic estimate for every call in
the run.

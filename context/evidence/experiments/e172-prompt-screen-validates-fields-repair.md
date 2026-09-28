---
title: E172 — Prompt screen validates the FIELDS repair
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E172 — Prompt screen validates the FIELDS repair

## Verdict

The small screen validates the prompt repair. `FIELDS` had strict syntax on
all 24 of its results. None of the four predeclared mechanical recoveries
applied to a `FIELDS` result. The prior `line`, delimiter, and `BASE none`
failures did not recur.

The screen does not select a format. It gives positive evidence for `FIELDS`
as an output grammar, but it shows no input-comprehension benefit. Do not
start holdout from this result.

## Result

Each cell is the strict full-pass count from four results.

| Provider | Mode | Exact JSON | Positional v1 | `FIELDS` |
|---|---|---:|---:|---:|
| OpenAI | input comprehension | 1 | 0 | 0 |
| Gemini | input comprehension | 2 | 2 | 2 |
| Haiku | input comprehension | 0 | 2 | 1 |
| OpenAI | output serialization | 2 | 3 | 3 |
| Gemini | output serialization | 2 | 2 | 4 |
| Haiku | output serialization | 2 | 0 | 2 |
| **Total** | **input comprehension** | **3** | **4** | **3** |
| **Total** | **output serialization** | **6** | **5** | **9** |

Haiku omitted the required `ANALYSIS` prefix in all four exact-JSON input
results. The predeclared recovery raised exact JSON from 0/4 to 3/4 for that
provider. This behavior did not affect `FIELDS`.

For output serialization, `FIELDS` passed strict syntax on 12/12 results.
Positional v1 passed 9/12, and exact JSON passed 10/12. These reused cases are
diagnostic. They are not a fresh effect estimate.

## Repeat behavior

Strict pass state repeated on 9/12 OpenAI pairs, 12/12 Gemini pairs, and 7/12
Haiku pairs. Payloads matched on 0/12, 5/12, and 2/12 pairs, respectively.
The small one-shot format differences remain noisy.

## Calls and cost

| Provider | Message requests | Token-count requests | Cost |
|---|---:|---:|---:|
| OpenAI | 24 | 0 | USD 0.164220 |
| Gemini | 24 | 0 | USD 0.037590 |
| Haiku | 24 | 24 | USD 0.390789 |
| **Total** | **72** | **24** | **USD 0.592599** |

All 72 message requests completed. No transport failure, retry, repair call,
or budget stop occurred. The total stayed below the USD 1.250000 hard limit.

The provider manifest SHA-256 values are:

- OpenAI:
  `222cc0706d9cfc7af68902fe896b71dd802c9286484191eef0492a036de970c4`;
- Gemini:
  `46d2c8a418bd340b0915eff4fb4d22aec24ad5f3537fb3059589d07cd868bbba`;
  and
- Haiku:
  `df89e7606538fce860c22db4c118c964df47335f93a5c8cda50403853e95b6d7`.

The summary SHA-256 is
`095fdaa7fa448502c6066c1f4022e6ed8220c9761a306bfa397bc0f3d223ea56`.

## Consequence

Do not rerun the 503-call development suite. Pause provider work. If format
development continues, use one small fresh comparison that tests whether the
output-serialization benefit repeats. Keep input comprehension as a separate
question. Freeze and approve that work before any provider call.

Phase 8c4c remains active. Phase 8c4d and Phase 8f remain blocked.

## Retrospective

The four-case screen answered the prompt question for less than USD 0.60.
Use a narrow diagnostic before another full development run.

# Phase 8c4c paired development protocol

Use the same fresh semantic fixture for all three arms on OpenAI, Gemini, and
Haiku. Report each provider and family before a pooled result. Keep initial
and repaired results separate.

## Scope and resolution

Run eight unique fixtures for analysis, motif, and progression. Run four
unique fixtures for each guard family. Repeat the first decision-family
prompt once for each arm as a named sentinel.

The decision macro contains 24 unique paired rows. Its smallest step is
`1/24`, or 4.17 percentage points. This is below the five-point limit.

Calibration fixtures and sentinels do not enter the development effect
estimate. An unavailable pair stays outside the paired denominator.

## Candidate gates

Freeze these gates before provider work:

- The initial musical decision macro must be at least 0.50 on each provider.
- The candidate must stay within 0.05 of exact-object JSON on each provider.
- `FIELDS` must stay within 0.05 of positional v1 on each provider.
- A provider and family can have at most one candidate-only loss against each
  required comparator. A candidate-only loss means that the candidate fails
  and the comparator passes on the paired fixture.
- Every candidate family must score at least 0.875 for initial syntax and
  0.875 for initial completion.
- Each guard-family effect must stay within 0.25 of each required comparator.
- All deterministic capability and size gates must pass.

Select `FIELDS` only when it passes all gates and one benefit repeats on at
least two providers. The predeclared benefits are:

- a decision-macro improvement of at least 0.05;
- an analysis-family improvement of at least 0.125;
- fewer initial framing failures; or
- fewer musical losses against exact-object JSON.

The `FIELDS` decision macro cannot regress by more than 0.05 on another
provider. If `FIELDS` does not qualify, select positional v1 only when it
passes all absolute and exact-object gates.

Return one result:

- `freeze-fields-holdout`;
- `freeze-v1-holdout`;
- `revise`; or
- `stop`.

Return `revise` when an exact-object control is incomplete or below the
absolute decision floor. Return `stop` when valid controls reject both
compact arms.

## Repair and reporting

Run all initial requests before repairs. The repair sample contains at most
the first 48 available failures in the preregistered shuffled job order. Give
one feedback turn to each sampled parse or musical-contract failure. Report
eligible failures that the cap excludes. The feedback contains only the
structured diagnostic. Repairs do not replace initial results.

Report paired denominators, discordant rows, candidate-only losses, syntax,
completion, repair recovery, tokens, bytes, latency, and uncertainty. Report
the sentinel result separately.

## Cost guard

Each request has a 12,000-input-token cost ceiling and a 12,000-output-token
ceiling. The serialized request must stay at or below 10,000 bytes. Haiku also
uses the free token-count endpoint with a 128-token margin.

Reserve the maximum token cost before each message request. Refuse the request
when its reservation does not fit inside the cumulative provider budget.
Settle a successful request to its exact measured cost. Keep the full
reservation after a failed request. Do not retry a message request.

| Provider | Maximum per request | Maximum requests | Provider budget |
|---|---:|---:|---:|
| OpenAI | USD 0.063000 | 189 | USD 1.500000 |
| Gemini | USD 0.054000 | 189 | USD 0.750000 |
| Haiku | USD 0.072000 | 189 | USD 2.750000 |
| Total | — | 567 | USD 5.000000 |

Each provider has 141 initial requests and at most 48 repair requests. The
provider budget, not maximum-token multiplication across all calls, is the
hard cost limit. A budget can stop a run before its call limit.

Sum exact cost line items. Round only the final provider and all-provider
totals. Assert that each reported provider total equals its settled cost-guard
total.

## Approval

The run plan freezes the models, settings, cohorts, hashes, call limits,
provider budgets, gates, repair policy, and stopping rule. Approval does not
carry to a changed value or hash. No token-count or provider request can occur
while the approval record is pending.

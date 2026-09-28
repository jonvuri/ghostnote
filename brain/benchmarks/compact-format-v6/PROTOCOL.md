# Phase 8c4b targeted analysis-repair protocol

This calibration repairs the analysis ceiling from calibration r2. It keeps
the frozen r2 motif and progression eligibility. It is diagnostic and cannot
select a representation.

## Scope

Each provider run receives five unique exact-object analysis tasks and one
named repeated-prompt sentinel. Each task contains an ordered batch of chord
groups and motif pairs. Easy, medium, and hard use larger pre-registered batch
sizes.

Each available initial parse or musical-contract failure receives one repair
turn. The repair prompt includes only a structured diagnostic. Unavailable and
failed results do not receive a repair. One provider run has at most 12 calls.

The three tiers are disjoint at the task and individual analysis-case levels.
No tier task appears in a retained provider-bearing cohort.

## Models and settings

| Provider | Model | Setting | Output limit |
|---|---|---|---:|
| Gemini | `gemini-3.8-flash` | Low thinking | 5,000 |
| Claude | `claude-sonnet-5` | Low effort | 5,000 |

Requests use each provider's default temperature. A valid low-scoring response
does not retry. Transport retries only a rate limit, network failure, or
provider-server failure.

## Sequential gate

Run Gemini easy first.

- If all five unique initial results are scored and the pass rate is above
  0.80, run Gemini medium.
- Run Gemini hard only when easy and medium are both complete ceilings.
- Stop after a Gemini floor below 0.20, an incomplete result, or the first rate
  from 0.20 through 0.80.
- Run Claude only once, on the first tier where Gemini is complete and inside
  the inclusive band.

The harness validates every prior Gemini manifest and its hash before a later
tier. It validates the eligible same-tier Gemini manifest before Claude.

Return `analysis-repair-pass` only when Gemini and Claude are both complete and
inside the inclusive band on the same tier. Return `repair-measurement`
otherwise.

## Call and cost limits

Gemini can run at most three tiers and 36 calls. Claude can run at most one
tier and 12 calls. The total maximum is 48 calls.

The cost ceiling uses the maximum observed call cost from calibration r2 plus
25 percent. The Gemini maximum is USD 0.269561. The conditional Claude maximum
is USD 0.867870. The total maximum is USD 1.137431.

## Approval

The run-plan JSON fixes the models, settings, output limits, tier corpus
hashes, tier order, sequential gate, repair policy, stopping rule, call limits,
and maximum estimated cost. Approval does not carry to a changed value or
hash. No provider call can occur while the approval record is pending.

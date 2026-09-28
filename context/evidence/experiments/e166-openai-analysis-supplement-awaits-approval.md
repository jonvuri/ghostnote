---
title: E166 — OpenAI analysis supplement awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E166 — OpenAI analysis supplement awaits approval

## Verdict

Freeze the OpenAI-only r6 supplement and stop at its approval boundary. No
provider request is approved.

R6 checks whether OpenAI also enters the repaired analysis eligibility band.
It cannot change the completed r5 `proceed-development` decision or select a
format.

## Reuse boundary

OpenAI has not seen the r5 cohort. R6 reuses the exact five unique tasks,
named sentinel, prompt builder, scorer, repair policy, and 0.20 through 0.80
gate from r5.

OpenAI and Haiku use identical fixtures. Gemini retains its eligible 3/5 gate
from the matched-difficulty r3 cohort. R6 is supplemental evidence, not a fresh
three-provider cohort.

The reused r5 corpus SHA-256 is
`1b056340b189b8a5fbef255bed783c1fe4dd706a266593abb12d9fbfdf7b599b`.
The source r5 cohort-manifest SHA-256 is
`3ffcd022545ace31e6c47a766788ceb6e23b442354925eca111cd7d4461ccbd0`.

## Frozen run

- Run ID: `phase8c4b-analysis-openai-supplement-r6`
- Model: `gpt-5.4-mini-2026-03-17`
- Settings: low reasoning, provider-default temperature, 12,000 maximum
  completion tokens
- Protocol SHA-256:
  `f00d4f61275d3832887fc0e9574d4eff2f18092412602780a103fbc0a57e9903`
- Run-plan SHA-256:
  `ca7a9510f6e4172137f039a4031b6f07e7dff460c5a07a9a8127ab52635c4ca1`
- Maximum: 12 OpenAI requests and USD 0.738000

The package authorizes six initial requests and at most six repair requests.
It authorizes no Gemini, Haiku, or Sonnet request.

## Cost guard

The request builder rejects a serialized request above 9,000 bytes. The
largest deterministic initial or repair request is 6,010 bytes. Each request
reserves 10,000 input tokens and 12,000 output tokens.

At the documented USD 0.75 input and USD 4.50 output rates per million tokens,
the maximum reservation is USD 0.061500 per request and USD 0.738000 for the
run. Successful requests settle to measured use. Failed requests retain their
reservation. No request retries automatically.

## Decision rule

Record OpenAI as a third eligible provider only when all five unique initial
results are scored and one through four pass. Otherwise, retain the completed
Gemini and Haiku calibration result without adding OpenAI.

## Approval boundary

The approval record is pending. A valid approval must name the run ID, exact
protocol hash, exact run-plan hash, 12-request limit, and USD 0.738000 limit.

## Retrospective

Reusing the unseen r5 cohort gives an exact OpenAI-to-Haiku comparison and
avoids another fixture repair. Keep the different Gemini cohort explicit.

## Follow-up

The operator approved the exact package. [E167](e167-openai-r6-adds-the-third-analysis-provider.md)
records the completed eligible OpenAI result.

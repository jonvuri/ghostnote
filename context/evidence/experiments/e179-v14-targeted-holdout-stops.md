---
title: E179 — V14 targeted holdout stops
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4d-compact-bar-targeted-holdout.md
---

# E179 — V14 targeted holdout stops

## Verdict

The frozen v14 targeted holdout returns `stop`. The exact-object control fails
its minimum gate on OpenAI and Gemini. No provider has an effect-eligible
decision family. Claude Haiku stops after three unavailable responses and
fails the completion gate.

This result does not remove `FIELDS` or local labels from D24. The holdout had
no authority to remove one candidate or select a public format. Do not start
Phase 8c4e or another compact provider cycle from this result.

## Execution

The operator approved protocol
`749f890e5093ebfafdcedd435f8d9c87039b6ee28815bef7b72f73b723937123`,
run plan
`33062e821d4d1679c680e340e8637d57c3fa12f686ab4bfe3fc90064851646df`,
and the USD 3.050000 hard limit.

OpenAI and Gemini completed all planned work. Haiku stopped at its frozen
three-unavailable threshold. No request failed, retried, or reached a budget
stop. No repair call occurred.

The retained artifacts are the [approval](../../../brain/benchmarks/compact-format-v14/runs/targeted-holdout-r2-approval.json),
[OpenAI manifest](../../../brain/benchmarks/compact-format-v14/runs/2026-09-28-targeted-holdout-openai.json),
[Gemini manifest](../../../brain/benchmarks/compact-format-v14/runs/2026-09-28-targeted-holdout-gemini.json),
[Haiku manifest](../../../brain/benchmarks/compact-format-v14/runs/2026-09-28-targeted-holdout-haiku.json),
and [summary](../../../brain/benchmarks/compact-format-v14/runs/2026-09-28-targeted-holdout-summary.json).

| Provider | Planned | Attempted | Provider-completed | Available and scored | Unavailable |
|---|---:|---:|---:|---:|---:|
| OpenAI | 108 | 108 | 108 | 108 | 0 |
| Gemini | 108 | 108 | 108 | 108 | 0 |
| Claude Haiku | 108 | 35 | 35 | 32 | 3 |
| **Total** | **324** | **251** | **251** | **248** | **3** |

All three unavailable Haiku rows were comprehension-analysis calls. Each
reached the 12,000-token output limit with no answer payload. They occurred at
planned sequences 11, 19, and 35. The harness retained their response hashes,
usage, and cost. It excluded them from scored denominators and made no retry.

## Frozen gates

The exact-object control needed at least 75 percent in each decision family.
It did not meet that gate.

| Provider | Analysis exact control | Affine exact control | Completion | Effect-eligible family |
|---|---:|---:|---:|---:|
| OpenAI | 0/16 | 3/16 | 108/108 | 0 |
| Gemini | 6/16 | 16/16 | 108/108 | 0 |
| Claude Haiku | 3/5 scored | 1/4 scored | 35/108 | 0 |

OpenAI also failed both compact syntax gates. Its scored syntax rates were
30/36 for `FIELDS` and 25/36 for local labels. Gemini local labels passed the
candidate gates. Gemini `FIELDS` failed the repeated-loss gate on affine
continuation. The partial Haiku candidate results cannot overcome its
completion and control failures.

All frozen offline size gates passed. The failures came from control validity,
candidate conformance, informativeness, and provider completion. They did not
come from identity, freshness, schedule, parser, scorer, or cost-accounting
drift.

## Audit

A separate read-only audit validated all 216 completed OpenAI and Gemini rows.
Every row matched the frozen provider schedule, task, candidate, prompt hash,
prompt byte count, returned model, and effective settings. Planned, start, and
completion ordinals were contiguous. Payload hashes and scores reproduced.
Exact cost line items and run aggregates reconciled.

The audit also checked 18 rows end to end. The sample covered each provider,
family, and arm, with both repeat numbers in each decision family. The sampled
failures were real semantic or canonical failures. No scoring corruption was
found.

The manifests retain raw provider-envelope hashes, not the full envelopes.
The audit could not reconstruct those envelope hashes after the run. This is
the frozen protocol limit.

## Cost and identity

| Provider | Settled cost, USD | Raw-run SHA-256 | Manifest SHA-256 |
|---|---:|---|---|
| OpenAI | 0.5476791 | `f3fca987fafbedb28ffe53ac281202d283bd4c7d6c1e0e244b16e1b8ebf3b068` | `ff3b314cd42b1241661ec680f67adc5363608671abb6a0262d7721e9a3b4fdb7` |
| Gemini | 0.221682 | `87aac577d6c367225c843fa8fb0ffa38bcd0d42c642bf21e2e3c84c454a4bddc` | `19bed182df2b4ab649fe74f5ee4f4fac652df69041286ecf32f1635ff3dfef22` |
| Claude Haiku | 0.841610 | `358e7ab824fd207594f5a5b0c8a7c625a9320c541bf231be46e3fb3ce7706c08` | `87f74f590991a0ff35375982fb67af0b86860f3a0c22bd38b8f3afde599a8182` |

The rounded total is USD 1.610971. It is below the USD 3.050000 approved hard
limit. The summary SHA-256 is
`6f72d1fc873b762448407a2873b23e42cd061391553c81a1817fd473e10ded93`.

## Consequence

Phase 8c4d is complete with `stop`. Phase 8c4e cannot meet its `retain-both`
entry condition. Phase 8f remains blocked.

Do not tune a candidate, task, scorer, or threshold against these holdout
responses. A later provider run needs a new design that can change a product
decision, a new cohort, and new operator approval.

## Retrospective

Future protocols must define an early stop when completed providers make the
final decision irreversible. A separate calibration must also prove the exact
control and Haiku output behavior before a new holdout is frozen.

# R01-D1 — Rigorous-stage freeze: versions

Date: 2026-10-28. Status: accepted by the operator (freeze-review item 1);
the operator confirmed the freeze on the same day.

Development ended with package `pilot-development-v5`
([D63](d63-r01-package-v5-group-timing-tasks.md),
[E375](../../../context/evidence/experiments/e375-r01-package-v5-three-repeat-development-pass.md)) and the
Luna effort probes ([E376](../../../context/evidence/experiments/e376-r01-luna-medium-effort-floor-tasks.md),
[E377](../../../context/evidence/experiments/e377-r01-luna-medium-effort-remaining-tasks.md)). E374 and E375
found no task, prompt or scorer defect.

## Decision

The rigorous stage freezes these versions:

| Item | Frozen value |
|---|---|
| Task set | Package v5's 16 task templates (`p01`–`p16`), task revision 5, rules schema `r01-pilot-task-rules-v4`, regenerated on fresh inputs ([R01-D2](r01-d2-rigorous-fresh-inputs-and-seeds.md)) |
| Prompts and cards | Prompt revision 2; instruction and card revision 2 (bar\|beat card with d/t suffixes) |
| Scoring | `r01-scoring-v2-functional-rationals` |
| Feedback | `r01-feedback-v2-locating`, at most two corrections |
| Claude context | `r01-claude-context-policy-v2`, Claude Code 2.1.302 (binary `5262ce9d…`) |
| Codex context | `r01-codex-context-policy-v3`, Codex 0.163.0 |
| Retries | Reporting only (`r01-retries-reported-v1`) |
| Cohorts and effort | `claude-haiku-5-5` at `low`; `gpt-6-luna` at `medium` ([D64](d64-r01-luna-cohort-effort-medium.md)); no per-format effort |
| Tooling | Producer Pal pin `52a4c219…` with the precision patch, `js-tiktoken@1.0.21`, Node v24.11.1 |

## Consequences

- A CLI or binary change before or during the rigorous run requires a new
  context-policy check before any further call, as in development.
- Any change to a frozen item after this point needs a new operator decision
  and invalidates the affected rigorous cells.
- The `codex-current` profile changes to `medium` together with the
  rigorous execution path. Development-stage plans keep Luna at `low`, so
  package v5 and its manifest remain unchanged for development use.

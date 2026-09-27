---
title: E154 — Provider run stops at usage-accounting regression
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c3-full-symbolic-format-matrix.md
---

# E154 — Provider run stops at usage-accounting regression

## Verdict

The first approved Phase 8c3 OpenAI attempt stopped after 435 provider calls.
The harness did not retain a run artifact. Do not run another provider until
the operator approves the corrected run-plan hash.

## Failure

The operator approved run-plan SHA-256
`50f205651c0847aef3e1f80435f86a465e8527d0187c8305bd43e0eb8c345b61`.
OpenAI completed 390 initial calls and 45 sentinel calls. The local
usage-accounting wrapper then recursed when the inherited harness processed
usage. Core calls caught this exception as a transport error. The first
secondary call exposed the same exception and stopped the process.

The process stopped before it wrote the output file. The response bodies and
API-reported token counts are not recoverable from the harness. The provider
dashboard is the authority for the cost of these 435 calls.

## Correction

The corrected wrapper keeps a reference to the inherited usage parser before
it binds the Phase 8c3 helpers. A self-test now binds the helpers and verifies
OpenAI usage parsing. The self-test has 35 checks.

The cohort, screen, models, settings, prompts, sample rule, call counts, and
new-run cost estimate did not change.

| Identity | SHA-256 |
|---|---|
| Protocol | `8a84f8f007585d6f5c748f9625b4192c821a85b19515d916099a9cc1659b6e8f` |
| Run plan | `ce64fa24bf58912d02dada257a0576418b7ec0a22adb031641d4991898ae23eb` |
| Deterministic package | `6c678c0687be0e3800790cdb13fee0b2512d3515bef426656cd0f7bcdad53383` |

The corrected approval record is pending. The prior operator statement does
not authorize the new hash.

## Cost boundary

The corrected run still expects USD 22.227855 and has an estimated maximum of
USD 33.005736. The failed calls have an unmeasured cost. A proportional use of
the prior OpenAI maximum estimate gives USD 2.500499 as a planning allowance,
not an actual cost or a hard bound. With that allowance, the combined expected
planning amount is USD 24.728354 and the combined maximum planning amount is
USD 35.506235. Confirm the failed-attempt cost in the provider dashboard.

## Verification

- The 35-check self-test passes.
- The corrected deterministic package check passes.
- `git diff --check` passes.

## Retrospective

Bind inherited helpers in a self-test before a provider run. This check would
have found the recursion without an API call.

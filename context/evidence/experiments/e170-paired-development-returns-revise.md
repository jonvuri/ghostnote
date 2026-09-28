---
title: E170 — Paired development returns revise
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E170 — Paired development returns revise

## Verdict

Phase 8c4c paired development r1 returns `revise`. Do not select a compact arm
or start holdout.

OpenAI and Gemini had valid exact-object controls. Haiku did not. `FIELDS`
passed on Gemini but failed on OpenAI and Haiku. Its benefit did not repeat
across providers. Positional v1 did not pass all gates on any provider.

## Initial decision results

| Provider | Exact control valid | Positional v1 | `FIELDS` | Provider result |
|---|---|---:|---:|---|
| OpenAI | yes | 7/24 | 3/24 | neither arm passes |
| Gemini | yes | 11/24 | 16/24 | `FIELDS` passes |
| Haiku | no | 11/22 | 8/21 | exact control is incomplete |

OpenAI measured `FIELDS` at -0.416667 against exact-object JSON and -0.166667
against positional v1. Positional v1 measured -0.250000 against exact-object
JSON. Both compact arms failed the absolute floor, syntax, exact-object,
guard, and repeated-loss gates.

Gemini measured `FIELDS` at +0.125000 against exact-object JSON and +0.208333
against positional v1. It passed every frozen gate and all four benefit
signals. Positional v1 failed its absolute, syntax, exact-object, and
repeated-loss gates.

Haiku measured `FIELDS` at -0.142857 against exact-object JSON and -0.105263
against positional v1 on available pairs. Positional v1 measured 0.000000
against exact-object JSON. One exact-analysis response reached the output
limit, so the exact control was incomplete and the frozen rule returned
`revise`.

## Repairs and connection recovery

OpenAI had 69 eligible failures. It attempted the frozen maximum of 48 repairs
and reported 21 excluded failures. Gemini attempted all 35 eligible repairs.

Haiku identified 48 eligible repairs in the original manifest. Every repair
stopped at the token-count preflight with HTTP 403, so no repair message
request occurred. The recovered manifest has 51 eligible failures, 48
attempted repairs, and three failures excluded by the cap.

Four Haiku initial rows failed before message submission during the operator's
connection loss: two DNS failures and two timeouts. The operator approved one
retry for each row. All four retry messages completed for USD 0.045779. Three
failed the musical checks. The exact-motif row passed.

The recovery did not retry three output-limit rows or three initial HTTP 403
rows. [Claude API error documentation](https://platform.claude.com/docs/en/api/errors)
defines HTTP 403 as a permission error, not a connection error.

The original guard counted only successful token-count responses. The Haiku
run attempted 189 token-count requests before recovery, although its original
snapshot reported 134. The approved recovery added four attempts. Fix this
accounting before another provider plan.

## Calls and cost

| Provider | Message requests | Cost |
|---|---:|---:|
| OpenAI | 189 | USD 0.854677 |
| Gemini | 176 | USD 0.463185 |
| Haiku, including recovery | 138 | USD 1.610608 |
| Total | 503 | USD 2.928470 |

The total stayed below the USD 5.000000 hard limit. No failed message
reservation occurred. Haiku used 193 token-count attempts after the approved
four-attempt recovery amendment.

## Frozen identities

- OpenAI manifest:
  `2897ce77751b4737b44a67ef16616e8c1d6ae1639ef36cb674a2c1f55aa77932`;
- Gemini manifest:
  `c94d18a86eba28243f897e173d630477c3f71f2fcd3c1198fa3ac3ec1b719dad`;
- original Haiku manifest:
  `9f6c34ea6f46b7fce9e6f004271820b98891b6a4cd558f679b1ad3a40d44bca9`;
- Haiku network-retry supplement:
  `b78e93a1cc52086ee535aa1ed3970003591887132953d85e3dd06316cfbbef90`;
- recovered Haiku manifest:
  `3b80ee5071038260390322dde72f5f07dce1a56f7da1684787edfe972624b4b6`;
  and
- development summary:
  `c70b2bb4c35cfd57de54ba5ddf0d23d6f8d881e9cb5076db5d15d5f1025a447f`.

## Consequence

Do not start Phase 8c4d. Prepare a new offline revision plan if work continues.
The plan must address the OpenAI compact failures, the non-repeating Gemini
benefit, Haiku output-limit completeness, and token-count endpoint permission
and accounting. New provider work needs a new exact plan and approval.

Phase 8f remains blocked.

## Retrospective

The cumulative cost guard worked and kept total spend at USD 2.928470. Record
external preflight attempts before the request starts so that failed
token-count requests remain inside the approved count.

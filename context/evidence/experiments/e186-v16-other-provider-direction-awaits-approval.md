---
title: E186 — V16 other-provider direction awaits approval
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v16-medium-difficulty-tuning.md
---

# E186 — V16 other-provider direction awaits approval

## Verdict

The v16 OpenAI and Haiku directional supplement passes offline. It awaits
explicit approval of its exact identities and cost limits. No OpenAI or Haiku
request occurred.

Gemini is excluded while the operator resolves its regional availability.

## Scope

The supplement reuses the exact v16 cohort, candidates, task instructions,
scorers, and directional rule. It changes only the provider set.

| Provider | Messages | Setting | Measured-cost estimate | Hard limit |
|---|---:|---|---:|---:|
| OpenAI | 66 | Medium reasoning; 12k output | USD 0.450000 | USD 0.650000 |
| Haiku | 66 | 4,096 thinking; 24k output | USD 1.250000 | USD 1.750000 |
| **Total** | **132** | — | **USD 1.700000** | **USD 2.400000** |

Haiku can make at most 66 token-count requests before its 66 messages. The
runner makes no retry or repair call. It stops on the first transport or budget
failure or after three unavailable responses.

## Offline checks

The deterministic screen passes for both providers. It verifies the 66-row
schedule, balanced format blocks, prompt visibility, reference scoring,
component aggregation, request sizes, settings, cost reservations, malformed
provider-response accounting, and Haiku token-count accounting.

HTTP failures retain a redacted provider status, reason, message, body size,
and body hash.

## Approval identity

| Identity | SHA-256 |
|---|---|
| Protocol | `814481bb9d27c9d31ba35f410c1f2620c22a0973bb510a4758bac6b25fa45cd9` |
| Run plan | `c2941e548249758161f26940be6714decce76d357ae78f4415a953d8562e6092` |
| Runner | `1986fb384409619fc894dab2e6f928e8836fb821bc362f03c6d1826414aaa033` |
| Cohort | `d5514ddb07d705b00c66c7d58c6310f58e40724e269d867728d3e5a16154dfc4` |
| Deterministic package | `987dca8ef45b56023e61578ce0c9f60307cfad5ef8e6c597eebacdf9cc8dcd68` |

The candidate hashes remain unchanged:

- `FIELDS`: `5125c847ad08dc795a82c235b3fcdf42dede5392805db36a3df2a0941c11a30a`;
- local labels: `3fcb182bfa6cfa4935a8e4b5c6ef876407fcd27e5bb2e6ac7df3177b2789c349`;
- exact JSON: `facd901ef30d98dec39f6023a779ce8ee3b3d3cab35e156ba0d6dffc05a99833`.

## Retrospective

Keep provider substitution separate from task and scoring changes. Bind a
supplement runner directly into its protocol and approval identities.

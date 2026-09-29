---
title: E184 — V16 medium-difficulty direction stops
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v16-medium-difficulty-tuning.md
---

# E184 — V16 medium-difficulty direction stops

## Verdict

The approved v16 Gemini directional run stopped safely on its first request.
Gemini returned HTTP 400 before a provider completion. No benchmark result is
available.

The stopped manifest records one attempted message, zero provider completions,
zero scored rows, and USD 0.000000 recorded cost. The guard keeps the USD
0.054000 maximum-call reservation. The remaining 65 planned messages were not
attempted.

## Diagnosis

The v16 request used the same endpoint, model, medium thinking level, 12,000
output-token limit, and outer JSON schema as the successful v15 Gemini run. The
first v16 request was 2,649 bytes. The first successful v15 request was 2,817
bytes. Current Google documentation still lists `gemini-3.8-flash`, medium
thinking, structured output, and the v1beta `generateContent` endpoint as
supported.

The `.env` file was last changed before the successful v15 Gemini completion.
No shell environment value replaced its Gemini key. These checks exclude a
planned model, setting, request-size, or local credential-file change.

The historical transport discarded the HTTP response body. HTTP 400 can cover
multiple client or account conditions. The exact provider reason is therefore
unknown. Do not infer a prompt or experiment-design failure from this stop.

## Stopped artifact

| Item | Value |
|---|---:|
| Planned messages | 66 |
| Attempted messages | 1 |
| Provider completions | 0 |
| Scored rows | 0 |
| Recorded cost | USD 0.000000 |
| Carried reservation | USD 0.054000 |
| Manifest SHA-256 | `524c824a0660ccf56b8db52c5c64487d92259744ee419497291224fc42ee00a5` |
| File SHA-256 | `6edcec79ac8a365bb6829fddd55602a491a66e23a96d193d084a83144cec5fdd` |

## Frozen recovery

The recovery keeps the original protocol, cohort, schedule, candidates,
settings, and USD 0.650000 cumulative limit. It carries the failed reservation.
It permits one added attempt for planned sequence 1. If that attempt succeeds,
the runner can execute the 65 original unattempted messages. It makes no other
retry.

The recovery retains a redacted HTTP status, provider status, provider reason,
message, response-body size, and response-body hash if another HTTP failure
occurs. The offline recovery screen passes all ten checks.

| Recovery identity | SHA-256 |
|---|---|
| Code | `7831224a938172e02260d5374edfff1199e877c5a82bf1409765d51dc9ca098c` |
| Supplement | `bbdb93978980882102f9d13870f99cddcd99103744469945576c1e7df71675ec` |
| Offline screen | `e620a081140d3b7a5bf13cae19b077deb7e857f5a530d8107664b6a22f0e3af9` |

The supplement status is pending. No recovery request is approved.

## Retrospective

Provider HTTP errors need structured, redacted evidence. A status code without
the response reason creates an avoidable recovery round trip.

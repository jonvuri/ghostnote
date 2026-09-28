---
title: E176 — Gemini local-label diagnostic awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E176 — Gemini local-label diagnostic awaits approval

## Verdict

The small Gemini-first local-label diagnostic passes offline and awaits exact
operator approval. No provider request occurred.

The diagnostic defaults to current `FIELDS`. It can select the local-label
variant only after a large repeated analysis benefit that justifies the added
size. It cannot select a public format or start holdout.

## Frozen cases and arms

[`compact-format-v13`](../../../brain/benchmarks/compact-format-v13/README.md)
uses four audited v12 Gemini stress cases:

- comprehension-analysis variants 95 and 97; and
- generation-progression variants 92 and 96.

The unique v12 exact-JSON result passed and the `FIELDS` result failed on each
case. This is post-hoc case selection. The run is a focused diagnostic, not a
fresh family estimate.

The two arms are current `FIELDS` and one compact local-label variant:

```text
N id=n1 voice=bass start=24 duration=3/2 pitch=47 velocity=78
```

The local variant removes the global `FIELDS` row and repeats the six short
labels on every note row. All other compact headers remain unchanged.

Each arm runs four times per case. Adjacent pairs are counterbalanced so each
arm runs first eight times. The run makes at most 32 Gemini message requests.
It makes no repair call, token-count request, or automatic retry.

## Frozen decision

Select local labels only when all these gates pass:

- all 32 requests complete and both arms pass syntax on all 16 responses;
- local labels pass at least three of four repeats on each analysis case and
  beat `FIELDS` by at least two repeats on each case;
- local labels gain at least four more full analysis passes across eight
  responses and at least eight more correct field checks across 64 checks;
- the mean analysis prompt is at most 1.5 times the `FIELDS` size;
- the mean perfect progression payload is at most 2.0 times the `FIELDS`
  size; and
- local labels have no progression syntax loss.

Progression musical full pass is diagnostic only. It cannot promote local
labels because the current progression task is at a reasoning floor. If any
gate fails, select current `FIELDS`.

The frozen deterministic size ratios are 1.078625 for analysis prompts and
1.836469 for perfect progression payloads.

## Settings, cost, and approval

The run uses Gemini `gemini-3.8-flash`, `thinking_level=low`, a 12,000-token
output limit, and provider-default temperature. The request limit is 10,000
bytes and the input-token ceiling is 12,000.

The recent-cost estimate is USD 0.065000. It extrapolates the selected v12
Gemini call costs and includes added local-label size. The cumulative hard
limit is USD 0.150000. The guard reserves the USD 0.054000 token-bound maximum
before every call and retains a failed reservation.

The protocol SHA-256 is
`9760442c9080f6fb55258cbb3a8aec1fb2b9df3ace83082404e95c168a3162f5`.
The run-plan SHA-256 is
`cb55063d11d532223e4be1dc5d4a445f9985324b8d0a81b92cf733c869dcf17b`.
The deterministic SHA-256 is
`5abf2bb0712011db844fdaf734c674eb1cd4112372d15e3bb2bbe592a4b9e27e`.

Approval must name the run, the protocol and run-plan hashes, at most 32
Gemini message requests, no repairs or automatic retries, and the USD 0.150000
hard cost limit.

## Consequence

Do not make a provider request until exact approval exists. If the operator
declines the diagnostic, select current `FIELDS` and start the offline
benchmark-hardening follow-up.

## Retrospective

State when a focused case set is post-hoc. Give it a high promotion threshold
and do not report it as a fresh family estimate.

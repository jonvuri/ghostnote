---
title: E157 — Focused compact calibration requires measurement repair
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E157 — Focused compact calibration requires measurement repair

## Verdict

Return `repair-measurement` and stop provider work. Do not select a compact
arm and do not start Phase 8c4c.

Analysis is informative on two providers. Motif is at an exact-object ceiling
on all three providers. Progression is at a floor on every scored exact-object
result. Two OpenAI progression results are unavailable, and the summary keeps
them outside the scored denominator.

The retained
[calibration report](../../../brain/benchmarks/compact-format-v4/runs/2026-09-28-calibration-report.md)
has the initial, repaired, component, cost, latency, token, size, and
nondeterminism tables. The summary SHA-256 is
`d865a214dacd681018d8819bbd964bfddcf4e915bab27831484a1e2a50adefb1`.
It records no format selection.

## Eligibility result

The frozen rule uses the five unique exact-object results for each provider
and decision family. The inclusive band is 0.20 through 0.80. Each family
needs two eligible providers.

| Family | OpenAI | Gemini | Claude | Eligible providers | Result |
|---|---:|---:|---:|---:|---|
| Analysis | 0/5 | 4/5 | 3/5 | 2 | eligible |
| Motif | 5/5 | 5/5 | 5/5 | 0 | ceiling |
| Progression | 0/3; 2 unavailable | 0/5 | 0/5 | 0 | floor and incomplete |

Calibration cannot use the compact-arm rates to select a format.

## Progression contract defect

The source-free generation scorer expects `BASE none` and a fixture-specific
`SOURCE` value. The prompt states neither value. It gives only a generic
example. All 33 parsed unique progression responses fail this hidden
`document_context` check.

The parsed responses pass chord starts, named voices, duration, velocity, and
strict voice order 33/33. They pass same-voice movement only 2/33 and
pitch-class coverage 19/33. The task therefore combines a prompt/scorer defect
with a tight movement floor and a four-class chord. The source-free
role-continuation guard shares the hidden header defect and scores 0/9.

Motif has the opposite problem. Every parsed exact-object result passes every
component, so its repaired contract is too easy for calibration.

## Completed run

The run ID is `phase8c4b-focused-compact-calibration-r1`. The protocol
SHA-256 is
`468f734100ccccc2333d022cde2c509279c244d5eb9331c25ed696ba01604ae6`.
The run-plan SHA-256 is
`9d4506a390eb67b9c98884c31a432b73ffac0c5a7925eaa81b894fd301e2b4f3`.

| Provider | Calls | API-recorded cost | Raw-run SHA-256 | Manifest SHA-256 |
|---|---:|---:|---|---|
| OpenAI | 112 | USD 0.819922 | `6b120937884aea7d9c786d6d75cbfe07e197b2a914fedc258b7078e215daa2fe` | `ada9d65c0ffd3e13a5b63e3e3e3f916c3ed0914ccd7b2f42de4e4e840cfccc50` |
| Gemini | 93 | USD 0.180168 | `edc2b631c027d75dcf131606572994e09b64b9d732535a638f69a36dc0f47d3f` | `bdc4a69a022ce88d13effcec2a71107bba1965d8756a19f708bc661edfdfc542` |
| Claude | 93 | USD 1.742067 | `859535fc7703b3c2dd446d9d783c91951561435102310b208c90094b8cc4232d` | `7e0b3e69e5e58e2be70d801ea5973fb45f6a1ccf275fbc86be2deb99960a68d1` |
| Total | 298 | USD 2.742157 | — | — |

The total is USD 1.474558 below the approved estimate. No transport retry
occurred. The manifests retain provider-reported token use and cost. The
operator owns the separate provider-dashboard comparison.

## Repair boundary

Keep the v4 package, cohort, protocol, run plan, approval, and responses
frozen. The next session must make source-free output context explicit and
test prompt visibility. It must change motif and progression difficulty and
use a fresh calibration cohort. A new provider run needs a new protocol, plan,
cost estimate, and explicit approval.

Phase 8f remains blocked. Phase 8c4c does not meet its entry condition.

## Retrospective

The contract-to-scorer table separated progression components, and the
output-state tests protected the denominator. They did not prove that every
scored value was visible in the prompt. Add a prompt-to-scorer visibility test
for task-specific document headers. Check every provider credential before
the first paid call.

---
title: E159 — Compact calibration r2 requires analysis repair
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E159 — Compact calibration r2 requires analysis repair

## Verdict

Return `repair-measurement` and stop provider work. Do not select a compact arm
and do not start Phase 8c4c.

Calibration r2 repaired the hidden output-context failure. It also made motif
and progression informative. Analysis is at an exact-object ceiling on Gemini
and Claude, so it has only one eligible provider. The frozen rule requires two.

The retained
[calibration report](../../../brain/benchmarks/compact-format-v5/runs/2026-09-28-calibration-report.md)
has the initial, repaired, component, cost, latency, token, size, and
nondeterminism tables. The summary SHA-256 is
`e2b293e9e05c62d58e9c22748d5cdad0d38bfcd5ec456347c7a0f01a3a030017`.
It records no format selection.

## Eligibility result

The frozen rule uses the five unique exact-object results for each provider
and decision family. The inclusive band is 0.20 through 0.80. Each family
needs two eligible providers.

| Family | OpenAI | Gemini | Claude | Eligible providers | Result |
|---|---:|---:|---:|---:|---|
| Analysis | 1/5, 0.20 | 5/5, 1.00 | 5/5, 1.00 | 1 | ceiling on two providers |
| Motif | 4/5, 0.80 | 5/5, 1.00 | 4/5, 0.80 | 2 | eligible |
| Progression | 1/5, 0.20 | 1/5, 0.20 | 4/5, 0.80 | 3 | eligible |

All unique initial results are scored. No result is unavailable or failed.
Calibration cannot use the compact-arm rates to select a format.

## Measurement-repair result

Every parsed progression output passes `document_context`. The progression
control is informative on all three providers. The source-free role guard is
also no longer at a universal floor.

The six-note compound motif control is informative on OpenAI and Claude.
Gemini remains at a motif ceiling, but the family meets the two-provider rule.

Gemini and Claude pass all five exact-object analysis tasks. OpenAI passes one.
Four OpenAI failures include `motif_relation`. The analysis task now needs a
harder case mix that can move at least one ceiling provider into the band
without pushing OpenAI below 0.20.

## Completed run

The run ID is `phase8c4b-focused-compact-calibration-r2`. The protocol
SHA-256 is
`7e0d81e85b2b1caafda9fe7921ab7aefa0e3cd8e679775a136e912caa2dfe143`.
The run-plan SHA-256 is
`3d1abc5800507163f34ec64fc9039ddec95ef55adc7429fb8f2940e0f430b89f`.

| Provider | Calls | API-recorded cost | Raw-run SHA-256 | Manifest SHA-256 |
|---|---:|---:|---|---|
| OpenAI | 106 | USD 0.500027 | `8065998a5383b8f16b509c4255d406f14e17f0face5f6f6b38fafb402f76db12` | `39313703a388e43dd8e7412746696351545ce38dd710b4426ce53d5db4e49449` |
| Gemini | 81 | USD 0.175443 | `f80ae183e7a89dfd623469bf790755d710ba2acba47987b5f7a3bbbf6b9f4e60` | `e3150ccbc952aec79580f98837c9f219e34be0d8d92f63e4dd58a1e499a447b7` |
| Claude | 81 | USD 1.396248 | `2d1cb2b27269b02dd5445effdc12005cb22b19eeeb69d02c9f1d1c7150cd9437` | `24e8e68285b723221a304c4f24b60d08ea71139d921de84449ebd58d10bbbee1` |
| Total | 268 | USD 2.071718 | — | — |

The total is USD 3.023917 below the approved estimate. No transport retry
occurred. The manifests retain provider-reported token use and cost. The
operator owns the separate provider-dashboard comparison.

## Repair boundary

Keep the v5 package, cohort, protocol, run plan, approval, and responses
frozen. The next session must repair analysis measurement offline and preserve
the informative motif and progression contracts. It must use a new versioned
package and a fresh calibration cohort. A new provider run needs a new
protocol, plan, cost estimate, and explicit approval.

Phase 8f remains blocked. Phase 8c4c does not meet its entry condition.

## Retrospective

The output-context visibility test prevented the r1 hidden requirement. The
motif and progression repairs reached their target bands. Add harder analysis
cases without weakening independent component scores or pushing OpenAI below
the current lower boundary.

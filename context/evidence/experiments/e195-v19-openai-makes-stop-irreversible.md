---
title: E195 — V19 OpenAI makes the stop irreversible
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4e-compact-only-full-benchmark.md
---

# E195 — V19 OpenAI makes the stop irreversible

## Verdict

The operator later replaced the strict canonical decision gates with
component-focused product gates. E196 records the superseding product
interpretation and completed provider continuation. This document preserves
the earlier strict-policy result.

The approved OpenAI stage completed all 148 messages. It had no failed,
unavailable, or budget-stopped row. It cost USD 0.713277 against the approved
USD 0.950000 provider limit.

The Phase 8c4e result is `stop`. Five cells outside the defective revoice
family fail frozen gates. The `revise` outcome permits at most three failed
cells. Perfect Gemini and Claude Haiku results cannot change this bound.

The frozen between-provider rule therefore stops the run after OpenAI. Gemini
and Claude Haiku made no call. This avoids 296 messages and an estimated USD
3.520000.

## Valid decision basis

These cells fail a frozen canonical gate. Their component, case, and
structural results remain measured outcomes.

| Family | Candidate | Components | Cases | Structural | Canonical |
|---|---|---:|---:|---:|---:|
| Generation progression | `FIELDS` | 90.1786% | 82.8125% | 100% | 37.5% |
| Generation progression | Local labels | 89.2857% | 81.2500% | 100% | 62.5% |
| Continuation motif | `FIELDS` | 97.0455% | 97.9167% | 100% | 25.0% |
| Continuation motif | Local labels | 79.7727% | 77.3437% | 100% | 37.5% |
| Serialization control | Local labels | 100% | 100% | 100% | 50.0% |

Five failed cells exceed the frozen maximum of three for `revise`. This
reason does not use the revoice scores or their sentinel flags.

## Revoice measurement defect

The revoice prompt says to preserve pitch classes, starts, durations, and
range. It supplies source IDs such as `rv90-0-1`. The exact reference instead
uses 16 synthetic IDs from `rv-out-1-1` through `rv-out-4-4`. None of those
IDs appears in the prompt.

The scorer aligns cases by exact ID. All 16 retained revoice responses used
the visible source IDs. The scorer therefore assigned zero to every note case,
including its pitch, time, voice, and velocity fields. Both candidate cells
received 6/103 components, or 5.8252 percent. Both sentinel pairs became
recurring defects.

A read-only ID-free audit found that 10 of the 16 responses match every
expected musical field. This does not replace the frozen scores. It confirms
that the official revoice scores cannot measure revoice quality.

The same audit checked every exact-scored family. All expected IDs were
visible for structure, motif, local transformation, rhythm transformation,
and serialization. Revoice was the only family with hidden expected IDs.

Keep the frozen v19 package and provider manifest unchanged. Do not use the
revoice cells as candidate evidence. A future package must disclose every
required output ID or use an ID-neutral semantic scorer. Its prompt-visibility
screen must enumerate every exact-scored ID.

## Other OpenAI results

The official aggregate includes the defective revoice cells and is not a
candidate-quality summary. Excluding that family for diagnosis only gives:

| Candidate | Components | Average case | Structural | Canonical |
|---|---:|---:|---:|---:|
| `FIELDS` | 96.9080% | 97.1836% | 98.4848% | 80.3030% |
| Local labels | 93.6275% | 93.3121% | 100% | 83.3333% |

This one-provider diagnostic does not select a format. It does not authorize
a matrix or a repaired provider run.

## Artifacts

| Item | SHA-256 |
|---|---|
| Manifest identity | `b0619cede356d5818a33062a0d631643fe99344ef40910a52f77c3b43e5582e3` |
| Manifest file | `7b0aae88037b26e7f6c1cb7b7b7e6b2f8b5a38e0ee97a6707682c2f81bc672c3` |
| Approval file | `c59735de67cf6e359c0651e7c264556595f5aae5824af58919f91390115d3104` |
| Assessment file | `5fca72b71f5790a64d3a818612e229d122ed7d62306411bb3176ad8fec6506ab` |

The assessment records the conservative decision basis and the avoided calls.

## Retrospective

The backlog already marked revoice prompt and scorer alignment as a historical
regression. Before a package restores a retired family, inspect its historical
regression entry and enumerate all exact-scored values in the visibility test.

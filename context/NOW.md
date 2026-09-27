---
title: Current state
kind: status
state: active
updated: 2026-09-27
phase: phase-8-agent-native-live-engine
session: phase8c4b-focused-compact-calibration
---

# Now

Await operator approval for
[Phase 8c4b](plan/phase-8/8c4b-focused-compact-calibration.md). Do not call a
provider before approval.

## Starting point

[E156](evidence/experiments/e156-compact-bar-contract-repair-freezes-calibration.md)
records the passing Phase 8c4a offline gate. The new
[`compact-format-v4`](../brain/benchmarks/compact-format-v4/README.md) package
freezes positional compact-bar v1, the one-header `FIELDS` candidate, and the
exact-object control.

The named run is `phase8c4b-focused-compact-calibration-r1`. The protocol
SHA-256 is
`468f734100ccccc2333d022cde2c509279c244d5eb9331c25ed696ba01604ae6`.
The run-plan SHA-256 is
`9d4506a390eb67b9c98884c31a432b73ffac0c5a7925eaa81b894fd301e2b4f3`.
The maximum is 414 calls and USD 4.216715. The approval record is pending.

## Immediate work

1. Get explicit operator approval for the exact frozen plan.
2. Update only `runs/calibration-r1-approval.json`.
3. Run OpenAI, Gemini, and Claude one at a time.
4. Reconcile actual cost and produce the calibration report.
5. Stop on `repair-measurement`. Freeze a separate development plan only on
   `proceed-development`.

Phase 8f remains blocked. Do not change the package, cohort, protocol, run
plan, cache, stable `normal-v1` runtime, or a live Bitwig project.

## Retrospective

Keep the contract-to-scorer table and output-state denominator tests mandatory.
They directly prevent the defects found after Phase 8c3.

---
title: E325 — Mixer write after operator selection passes
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E325 — Mixer write after operator selection passes

## Result

The operator selected `gn-ua-0b6c3297-sentinel`. The driver independently
confirmed that mixer selection changed while Launcher selection remained
`Inst 1`, row 0. Complete content matched the saved checkpoint before writes.
The guarded mixer write and supported reversal passed. The final complete
fixture matches the selected entry state, including sentinel mixer selection.

The [result summary](../data/bitwig-upgrade-audit/continuation-3-614/selection-result-summary.json)
retains the original, selected, and final snapshots, plus write verdicts and
costs. Command `f37cd217-82ae-4513-ae5b-4833703f2689` used fresh version,
initialization, project, ownership, stopped-transport, selection, and client
checks. The write changed the owned notes track to -12 dB, pan -0.4, unmuted,
and solo. Separate reads proved the requested values. In-session reversal
restored all four original fields, followed by complete independent readback.
No content outside that bounded operation changed.

The four-field write takes 264.815 ms, 15 logical calls, and 10 wire turns.
Reversal takes 363.644 ms, 22 logical calls, and 14 wire turns. E320's same
four-field write took 267.748 ms and 15 calls. The current sample is about
1.1% faster. This is a local comparison with a deliberate selection change,
not a capacity result. No timing-only repeat was made. Existing ledger
models apply; implementation and public descriptions remain unchanged.
E321's 2,450-test gate remains applicable. Inherited source hashes match;
context links and staged diffs were checked.

## Current state and next step

The [command output](../data/bitwig-upgrade-audit/continuation-3-614/selection-after.txt)
requests restoration of mixer `Inst 1`, Launcher track `Inst 1`, row 0.
The operator request is pending. Run `checkpoint selection-restored` only
after confirmation. It must prove complete baseline equality before the
group checkpoint. The current state is `selection-restore`, with no active
driver, lock, failure, or uncertain write. Six audit tracks remain with
their original fixture content and restored mixer values. Transport is
stopped. No project save, launch, engine, or Grid command was sent.

Continue group navigation, project switching, save/reopen, listening, and
cleanup through the [driver guide](../../plan/phase-9/9b-update-audit-driver.md).
General update acceptance and the separate 9b.6 doctor remain pending.

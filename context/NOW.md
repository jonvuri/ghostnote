---
title: Current state
kind: status
state: active
updated: 2026-10-02
phase: phase-8-agent-native-live-engine
session: e216-measured-d26-accepted
---

# Now

Next session: [8g2b — Step-delta read window](plan/phase-8/8g2b-step-delta-read-window.md).

[E216](evidence/experiments/e216-delivery-coalescing-and-callback-coherence.md)
measured project detours. The user then accepted
[D26](decisions/d26-step-data-delivery-is-a-named-assumption.md): complete
step-data delivery for covered cells is a named assumption.

- Same-callback P→Q→P commands: identity values miss 21/35 detours. 12 of those
  have a tick with P identity and Q notes. Identity equality is not a guard.
- Each foreign tick runs in the middle of one batch. A check inside that
  callback sees no change. A later callback saw the full batch in 12/12 cases.
- Separate-callback detours, 0–500 ms dwell: 50/50 seen.
- Step-data deltas arrive in 35/35 same-callback detours, for one witness clip.
- Native UI input is not measured.

8g2b first measures the later-callback ordering rule. If that rule fails, keep
the [8g2 refusal](evidence/format/PHASE8G_PROJECT_CONTINUITY.md) and prepare a
vendor question. Vendor questions are unsent. If it passes, 8g2b adds a
confirmed step-delta read window and runs live detour acceptance.
[8g3](plan/phase-8/8g3-snapshot-and-global-budgets.md) can start offline. Its
live work waits for 8g2b. Do not enter 8h. All live cache results remain
`complete:false` and `eligible:false`.

The staged diff contains the earlier 8g2 work, E216, D26, and the 8g2b plan.
Entry HEAD is `1a0f9c6`. No commit is made. E216 code is research only: the
`deliveryResearch` flag, `DeliveryCoherenceProbe`, `cache.shadow` delivery
operations, the brain driver, the analyzer, tests, and retained reports.
The project-tab action IDs are in the action capability notes.

The live state is at baseline. Hello passes with 85 methods, hash
`bba7383dce25c0f0`, and init `2026-10-02T14:13:17.743Z`. Config SHA-256 is
`256bbf07…43b0`. Tracks, scenes, empty slots, selection, cursors, and pins match
the retained final baseline. Original `New 1` remains open and unsaved. Never
save or close it. The research archive is removed.

## Retrospective

A toggle step must not read delivered state that its own previous step has not
received. Check guard timing against batch interleaving, not only callback
boundaries. No repository instruction change is needed.

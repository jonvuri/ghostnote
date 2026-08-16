---
id: E31
kind: evidence
state: active
source: phase-1-session-5d-repair-owned-cleanup-fingerprint
---

# E31 — Owned cleanup promotes host-normalized readback [K] (2026-08-16)

**Verdict: owned cleanup now stays safe before and after exact fingerprint
promotion. The focused live sweep removed both owned clips and restored the
complete fixture baseline without directed cleanup.**

## Repair

An owned clip now keeps an immutable sparse creation fingerprint separately
from its optional exact cleanup fingerprint. Before promotion, cleanup requires
the same note count and every authored field. It permits only fields supplied
by the independent read. Promotion verifies the creation fingerprint and stores
the complete readback. Later cleanup requires that exact record.

The standing 5d probe promotes both independent witness reads before the larger
grid capture or human prompt. A failed promotion leaves the early creation gate
available for automatic cleanup.

## Live result

`probe:5d-cleanup` confirmed all 10 durable track identities and the documented
project, row, observation, transport, and selection baseline. It claimed the
three empty row-10 cells on `gn-B`, `gn-lay`, and `gn-lay4`.

The sweep created the target and drag clips. Independent readback found each
authored note plus release velocity, four enabled state flags, and recurrence
`[1, 1]`. Both promotions passed. The sweep moved the drag clip to its empty
destination. Exact cleanup moved it home, verified it, and removed both clips.

Final readback found no grid differences across all visible cells. It restored
selection to track 0, row 1. The observation record was the exact empty
schema-v1 value, and transport was stopped. The final mark was revision 523,
scene epoch 2, and content epoch 310. No directed cleanup was needed.

## Verification

- Focused cleanup tests: 6/6.
- Full offline check: 540/540, with typecheck green.
- Focused live cleanup sweep: 9/9.
- Context check: all active documents and links pass.
- `git diff --check`: pass.

## Decision impact

D6 and D15 are unchanged. The human 5d concurrent-editing proof can run again.
This repair does not prove Phase 1 exit criterion 2.

## Retrospective

Keep creation evidence separate from normalized readback. No repository
instruction change is needed.

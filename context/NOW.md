---
title: Current state
kind: status
state: active
updated: 2026-09-22
phase: phase-7
session: 7c-documentation-provider
---

# Now

Phase 7b is complete. [E121](evidence/experiments/e121-guarded-agent-note-patches-pass-live-reference-dogfood.md)
connects guarded agent proposals and reference context to the recorded live
write seam. Phase 6 is complete. Phase 3 remains deferred. Phase 5 still has
generalized closeout work after its accepted public result.

## Next session

Run [7c: documentation provider](plan/phase-7/7c-documentation-provider.md).
Read the [contracts](evidence/format/WORKSTATION_CONTRACTS.md),
[seam ledger](evidence/format/WORKSTATION_SEAMS.md),
[verification rules](evidence/format/WORKSTATION_VERIFICATION.md), E104 and
E121. Implement `documentation-v0`. Close S14 and the documentation part of
S17. Keep cache sources outside the repository and keep the stable surface
unchanged.

## 7b handoff

- `note-compiler-v0` validates `ghostnote-note-patch-v0`, complete candidates,
  typed operations, explicit defaults, invariants and a preview digest. Accepted
  work gets a fresh exact preflight, recorded apply and independent complete
  readback. Partial effects keep their change record. Candidates above the
  4,096-note exact-source capacity refuse before write.
- `reference-context-v0` keeps seed and reference identity, permission and
  coverage separate. Extracted structure is the default. The comparator uses
  the complete permitted reference, not a raw excerpt. Its projected permission
  must equal the exact reference permission.
- The experimental profile extends only `transform_clip_music`. The stable
  deterministic v1 input and tool list are unchanged.
- The live agent added four upper notes to a 16-note line. Exact readback passed,
  and the operator replied `Accepted.` Preview took 4.322 ms. Apply took
  16,044.461 ms, including fresh preflight and complete readback.
- The accepted result was a declared disposable fixture. Its exact change
  reversed, both temporary slots read back empty, and the prior launcher
  selection was restored.

## Boundaries

S03, S04, S06, S07, S09 and in-process S17 are implemented. S05 remains
conditional on a theory task. S08 remains outside the compiler. S10 remains
conditional on a paired MIDI task. R1 is still blocked: do not remove the fresh
preflight or final readback.

The first live source refused before write because its duration was not on the
writable grid. The next fixture exposed host-normalized enable flags for new
notes. The compiler now treats chance, occurrence, recurrence and repeat flags
as enabled and has a regression fixture.

## Retrospective

The four-operation proposal avoided full-score generation and repair. Bind
repeated authority fields at the consumer boundary, and derive output limits
from readback capacity. For 7c, keep the strong TypeScript cache gate in front
of extraction so weaker probe loaders cannot become product authority.

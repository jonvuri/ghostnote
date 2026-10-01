---
title: Phase 8f3 bindings and cache contracts outcome
kind: outcome
state: complete
updated: 2026-10-01
next: ../../plan/phase-8/8g-shadow-project-cache.md
---

# Phase 8f3 outcome

## Result

[8f3](../../plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md) closes the
three-session 8f contract work. The accepted target now has:

- [Host field and capability bindings](../../../spec/ghostnote-document-v1/HOST-BINDING.md).
- [Clip/event identity and overlay lifecycle](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md).
- [Internal cache types, state machine, limits, and shadow cases](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md).
- [Risk, migration, decision gates, and rollback](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).
- [Versioned pure binding cases](../../../spec/ghostnote-document-v1/bindings/v1/README.md).
- [Publication candidate inventory](../../contracts/GHOSTNOTE_PUBLICATION_CANDIDATES.json).

The selected public read name is `read_launcher_clip`, with one Launcher clip
per request. The wrapper exposes useful coverage, health, loss, and conflicts.
It does not expose observer handles or require serialized cache storage.

Sparse changes preserve unnamed state. Complete desired state supplies portable
defaults and removes omitted represented inventory. A partial base needs its
retained guard, fresh equivalent projection, complete resolved state, explicit
unknown-field declarations, and host preservation proof. Pure fixtures check
field-only resolution. Partial time/channel resolution and live acquisition
remain 8h gates. Identity recovery needs continuity or controlled ownership;
restart and ambiguity cannot recover refs from equal content.

Overlays share core event IDs. Dependency changes make retained claims stale.
Deleted references remove dependent claims from unsolicited read results with
visible diagnostics. Model patches must explicitly remove or replace them.
A groove claim alone cannot edit notes. Source displacement stays separate
from intended components.

## Capability limits and decision amendments

Raw acquisition must retain disabled control values. The legacy verbose decoder
drops disabled recurrence values; its exact-source completeness claim cannot
supply the new field contract. Host-only snapshots leave articulation and
portable repeat uncovered. Signed repeat count/rate and relative velocity-end
controls have no proved portable inverse. Refuse unproved conversion or replay.

Timbre maps host -1..1 to portable 0..1. Gain keeps the E24 inverse once and the
host profile stops at gain 2. Transpose writes stop at -96..96. Recurrence writes
stop at eight cycles. Pressure stays observable and unwritable; preserve it on
proved untouched routes or refuse reconstruction. These range rules use the
installed API declarations and existing evidence. Their live integration needs
8h independent readback.

D21 now states the target document edit grain and keeps overlap shortening on
the old operation route. D16 permits revocable session clip refs and qualifies
all-channel protection with E128's targeted inverse. D8 separates normalized
model reads from exact checkpoint protection. D19 states effect ownership.
D9 and D15 remain unchanged. No amendment promotes cache authority or changes
current stable behavior.

The cache contract separates budget admission from complete-state eligibility.
Nonzero dirty work can pass the existing budget evaluator; it cannot publish a
healthy snapshot. The contract also distinguishes sparse recorder estimates
from enriched payload and retained snapshot memory. 8g must measure those costs.

## Verification

- Brain typecheck and all 1,473 tests pass, including 15 binding tests.
- `npm run document:conformance` passes all 252 document tests and artifact checks.
- `npm run document:standalone` passes and removes its temporary consumer.
- Binding fixture identity and case inventory checks pass. Unknown fields,
  pressure/repeat reconstruction, larger host ranges, changed guards, partial
  coverage, collisions, overlap, and ambiguous identity have explicit refusals.
- Context/specification links, publication inventory identities, and diff checks
  pass. Independent example hashes and the Model format reference remain unchanged.

The first standard brain check could not open the tsx IPC socket in the sandbox.
The direct Node runner passed 1,468 tests; five existing loopback TCP tests were
blocked by the same restriction. The standard check then passed with local
socket access. No test failure required a runtime change.

No live host check or controller reload was needed. Existing measurements and
local API declarations support the conservative rules. `normal-v1`, cache code,
low-level encoder, live projects, and frozen benchmark artifacts are unchanged.
Session changes are staged for review and are not committed.

## Handoff and retrospective

Start [8g](../../plan/phase-8/8g-shadow-project-cache.md). Implement the cache in
shadow mode with E131 as authority. Use the accepted cache state machine,
zero-dirty eligibility, limits, late-callback rejection, and shadow case matrix.
Do not promote stable reads or writes in 8g.

8h owns raw field acquisition and hashing, guarded partial-base resolution,
capability lowering, identity/overlay attachment, public tool migration, live
readback, reversal, and rollback. 8i owns fresh bounded agent trials. 9b owns
packaging, license/dependency closure, and publication review. The inventory
records candidates, not a release approval.

Check raw host units and disabled values before mapping a decoded type. A legacy
omission policy can hide a field needed by the new contract. Keep one field
mapping table and link the migration/identity/cache contracts from the reading
route. Existing evidence settled the host rules; no new live measurement was
needed. No additional repository instruction change is needed.

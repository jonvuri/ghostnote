---
title: Phase 8g — Shadow project cache
kind: plan
state: active
status: Active. 8g5a is complete. Run 8g5b and 8g5c, then 8g5.
updated: 2026-10-03
parent: README.md
prev: 8f3-ghostnote-bindings-and-cache-contracts.md
next: 8h-cache-promotion-and-interface-simplification.md
evidence: E130-E134; E138-E139; E214-E221; D23; D26; D27
---

# Phase 8g — Shadow project cache

## Next session

[8g1 — Review fixes](8g1-review-fixes.md) is complete. Both P2 findings from
the [intermediate review ledger](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md)
are closed with offline regression tests. No P0 or P1 finding was found.
The bounded pure model, pool, coordinator, replay, and packaging rules pass
within their stated assumptions. Live continuity, selected global budgets,
broader ordering and final consumer acceptance remain open. E221 below closes
bounded group topology.

[8g2](8g2-project-continuity.md) is complete with
[conservative refusal](../../evidence/format/PHASE8G_PROJECT_CONTINUITY.md).
The live adapter has no independent input window. It refuses all shadow
acquisition routes. Equal endpoints cannot preserve a logical reference.
Retained snapshots and inventory recheck the window before exposure.
Model boundary tests pass. No new live continuity result is claimed.

[E216](../../evidence/experiments/e216-delivery-coalescing-and-callback-coherence.md)
measures project detours. Identity values coalesce, and a callback can read
foreign notes in the middle of a delivery batch. Step-data deltas arrive in every
measured detour. [D26](../../decisions/d26-step-data-delivery-is-a-named-assumption.md)
accepts complete step-data delivery as a named assumption.

[8g2b](8g2b-step-delta-read-window.md) is complete.
[E217](../../evidence/experiments/e217-later-callback-ordering-rule.md) passes
the later-callback ordering rule. The adapter admits covered reads only through
confirmed step-delta windows.
[E218](../../evidence/experiments/e218-step-delta-read-window-live-acceptance.md)
passes 147 live detour trials with zero foreign outputs. Live slot inventory
still refuses. Nothing is eligible.

[8g3](8g3-snapshot-and-global-budgets.md) is complete.
[E219](../../evidence/experiments/e219-snapshot-budgets-and-combined-storage.md)
passes live 16 MiB snapshot equality and excess, combined-storage overlap
refusal with recovery, and interrupted enrichment. Other boundaries stay
model-only. Nothing is eligible.

[8g4](8g4-native-topology-and-ordering.md) is complete. See
[E220](../../evidence/experiments/e220-native-topology-and-ordering.md).
Native ordering passes; group membership refuses.

The 8g5 planning pass selects project-wide occupancy as the gate scope.
[D27](../../decisions/d27-later-callback-ordering-is-a-named-assumption.md)
accepts the E217 ordering rule. [8g5a](8g5a-group-topology-support.md) now
passes bounded group topology. [E221](../../evidence/experiments/e221-group-topology-candidates.md)
records seven native retirements and a collapsed-child clip binding limit.
Two required predicates remain open. Run [8g5b](8g5b-slot-inventory-delivery.md)
(slot inventory delivery) and
[8g5c](8g5c-combined-storage-limit.md) (combined storage limit). Then run
[8g5](8g5-final-shadow-acceptance.md). Do not enter 8h.

The operator requires at least 256 instrument/audio tracks plus capacity for
groups, FX, and Master. 8g5c measures allocation and topology change cost and
raises the selected limit. It tests 512 total channels as a candidate.
The current 16-track research bound cannot satisfy final acceptance.

## Current result

[E214](../../evidence/experiments/e214-shadow-cache-content-and-lifecycle-gates.md)
records a partial implementation. The domain model covers identity, replay,
limits, repair, and rebuild. The experimental host adapter has fifteen retained
content matches against independent settled `1/512` authority. Zero results
are eligible for cache use. Automatic project lifecycle detection remains
unverified. E215 adds two separate 18-case bounded reuse runs. The corrected
v3 build also passes two between-poll cancellation controls with recovery.
Current-target reads reconcile physical callback hints. Automatic witness
fences, the LRU pool, atomic inventory, and independent exact fallback are
implemented in the marked v5 build. Its seven pool comparisons, three independent
exact reads, 38 mutation cases, two delivered identity fences, and four density
controls pass. The corrected followup build passes 14 structural fences and
recovery comparisons, three private inventory interruption controls, and one
native Group/Ungroup control. One compound Add Scene then Move control passes
combined fencing, recovery, and cleanup. One separate isolated Add Scene control
passes automatic fencing, cancellation, row-10 recovery, and cleanup. The target
moves from row 9 to row 10. The isolated action is user-declared; no intermediate
state independently proves the action count. Keep both scene controls and their
action counts separate. Neither proves host input ordering or scene identity.
The first note preparation is abandoned after a native Velocity double-click
resets `80/127` to 100%. It has no `finish` result and claims no single-edit
acceptance. Guarded cleanup passes with three original restoration comparisons.
A fresh isolated note fixture under suffix `29c091b2`, track UUID
`067de797-5c73-4a9c-ad0a-615964b09310`, passes one user-declared native Velocity
edit to 50%. One separate warm reacquisition observation without an explicit
barrier matches the edited oracle; explicit recovery also matches. The current
pre-barrier cache read refuses `authority-scan-busy` with no output, despite its
historical `match` label. The exact scan refuses `authority-scan-budget` after
elapsed time. This does not prove a window-change or callback cancellation.
Guarded note cleanup and verification pass. All temporary note fixtures are
removed, and three original restoration comparisons match. The followup
manifest retains this ninth report separately from the abandoned eighth
preparation diagnostic.

The enriched memory trial matches 4,096 notes against independent authority.
At 8,192 notes, independent authority matches the written projection, but cache
enrichment refuses `enrichment-budget` before the selected 16 MiB snapshot
boundary. No snapshot remains retained, and physical hint overflow is false.
Three full-field original restoration comparisons pass. This tenth retained
report is a failed boundary diagnostic. It proves neither the snapshot memory
boundary nor combined selected budgets. Estimates and serialized output bytes
do not measure heap memory. The first ordering trial fails its timing
precondition: the active scan reaches `match` before either native project
switch, so it claims no acceptance. Three original restoration comparisons
pass. It remains a separate eleventh diagnostic artifact. Actual comparison
polls read 65,536 coordinates, with only three polls left after preparation.

A fresh trial uses a ten-second poll cadence and same-process `prepare-sample`
mode to remove the tool gap. One native B command overlaps active acquisition;
the return-to-A command follows retirement. The trial passes with 193 samples,
66 B brackets, one changed bracket, zero current outputs, zero errors, zero
concrete violations, one retired poll, and zero trace drops. Three comparisons
before and three restored comparisons pass. The pretrial census and root inputs
are restored. Count one accepted interleaving trial, retained as the twelfth
followup artifact. No universal host ordering, missing-event, or callback-origin
proof follows.

Final restoration passes. The owned research track is deleted, and the original
ordered four tracks, eight scenes, 32 empty slots, selection, cursors, and pins
pass API baseline verification. Original and restored config bytes are equal,
with SHA-256 `256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.
The experimental controller and its exact archive are removed. Extension `check`
and `copyExtension` pass. Fresh normal hello passes with 85 methods, hash
`bba7383dce25c0f0`, and init time `2026-10-02T01:42:37.234Z`. The owned B tab is
closed with changes discarded. Original `New 1` stays open, unsaved, with its
engine active and transport stopped. The followup manifest retains 18 reports,
including final cleanup, verification, baseline, and three config records.
The seven verified files in the owned project packages are removed. All 1,688
brain tests and all five artifact bundles pass. Context and diff checks pass.
Model checks and these live controls do not close the promotion gates.

Continue with the remaining focused plans linked above.
Use the E214 acceptance gap table as an input. Keep 8h unentered.
Use the completed root identity and observer reuse experiments in
[E215](../../evidence/experiments/e215-root-identity-and-observer-reuse.md).
Copied roots do not distinguish loaded instances. The NoteStep probe supports
proxy reuse under continuous subscription and resume before point. Verify the
selected StepData observer separately. The current live adapter refuses these unproved paths. Define safe
initialization, binding, and loaded-instance detection before cache promotion.
Earlier cold-start and canary-to-target replay evidence remains valid. Verify
replay preservation or a forced canary transition after recorder resets on reused
bindings. Stale domain tokens must be rejected. Physical callbacks remain
coordinate hints and supply no note payload. The guarded project-target update
window and loaded-instance continuity remain gates. E214 records the accepted bounded
ordering control. Extend its transition coverage and resolve the guarded update
window. Do not repeat accepted cold replay tests.
The workflow and final dense cases pass. E214 records resources, restored live
baseline, artifacts, and checks. The acceptance criteria below remain in force.

## Next implementation paths

1. **Project identity:** Existing chain UUIDs differ across loaded copies and
   close/reopen in eleven captures. They survive a matched full controller reload. Test
   these UUIDs as optional loaded-instance
   witnesses. Compare the same fixture across controller reload, loaded copies,
   and close/reopen. Keep no-chain and changed-structure cases explicit. Do not
   add content to a user project solely to obtain a witness.
2. **Replay:** The selected `addStepDataObserver` probe passes 26/26 sparse and
   independent comparisons. Preserve confirmed
   same-target recorder state. After reset, force a populated-canary-to-target
   transition before publication. Verify sparse membership before full scans.
   E130/E134/E139 cold replay remains the accepted starting evidence.
3. **Bounded reuse:** E215 adds 18/18 content matches with a fixed three-handle
   pool. The v3 adapter passes 18/18 reuse cases and two between-poll scan
   cancellation controls with recovery. Register each physical observer once. Keep physical hints
   bounded and separate from domain state. Re-read all channels on the current
   confirmed target. Verify retire/rebind, late hints, reconciliation races,
   cancellation, overflow, and recovery without allocating more handles.
4. **Acceptance:** After these paths pass, run the remaining E214 implementation
   cases for structure, capacity, repair, rebuild, recovery, and consumers.

E215's first three reuse runs used `addNoteStepObserver`. Their proxy content
comparisons do not replace the selected step-data replay proof. Future probes
must record the callback API name and assert it before applying prior evidence.

## Purpose

Implement the project-wide persistent occupancy cache without changing stable
read or write authority. Compare every eligible cache result with the existing
reader and exercise the lifecycle, limits, and fallback rules selected in
8d through 8f.

## Entry

Start after [8f3](8f3-ghostnote-bindings-and-cache-contracts.md) accepts the
host binding, normalized timing rules, cache contract, and shadow corpus.
The [8f2 codec](8f2-reference-codec-and-model-format-reference.md) supplies
I/O projection when needed. Internal cache storage uses domain types.
Overlay content dependencies must not survive a changed source as current facts.

## Accepted 8f3 inputs

Use the [cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md) for types,
health, limits, zero-dirty eligibility, repair, rebuild, and shadow cases.
The [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md) and
[identity rules](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md)
define projection and references. The [binding corpus](../../../spec/ghostnote-document-v1/bindings/v1/README.md)
is pure evidence; it does not establish a live resolver. Retain raw disabled
properties. Do not cast host repeat controls into portable repeat.

## Implementation boundary

- Use one fixed `1/512` observer for each active cached clip.
- Keep sparse occupied and dirty coordinates.
- Treat callbacks as channel-free invalidations.
- Re-read all 16 channels at each dirty coordinate.
- Enrich full note fields only for occupied coordinates that a caller needs.
- Track project generation, structural epochs, current address, content
  generation, coverage, and cache health.
- Rebuild or fall back according to the selected lifecycle and limit policies.
- Publish diagnostics through an experimental profile or probe boundary.

Do not use a cache result for a product write, exact guard, or stable response
in this session. E131 remains authoritative.

## Shadow comparisons

Compare normalized cache snapshots with settled `1/512` authority for:

- initialization and ordinary warm reads;
- every supported note mutation;
- field-only changes and all MIDI channels;
- clip, scene, and track structural changes;
- project switch, controller reload, save, close, and reopen;
- working-set admission, eviction, overflow, and rebuild;
- callback bursts, late callbacks, and interrupted rebuilds; and
- real read-only and note-patch workflows.

Keep D23 sub-cell loss separate from implementation mismatches. Use E131 as an
additional diagnostic where an exact source difference needs explanation.

## Measurements

- Cold and warm cache latency by phase.
- Authority-scan latency and avoided host work.
- Initialization, replay, rebuild, and recovery time.
- Cache hit, miss, fallback, eviction, and invalidation counts.
- Dirty queue size and drain latency.
- Extension-owned memory and object counts.
- Mismatch counts by cause and lifecycle event.
- Tool calls, response bytes, and agent-visible delay in shadow dogfood.

## Acceptance criteria

- Every in-contract shadow result matches normalized authority.
- Every cache state declares complete, warming, rebuilding, overflow, invalid,
  or another selected health state.
- A caller cannot receive an unhealthy or partial snapshot as complete.
- Late callbacks from an old binding or project generation cannot mutate the
  current cache.
- Structural repair and rebuild follow the 8d state machine.
- Limits and fallback match 8e.
- Memory remains proportional to the selected sparse and handle model.
- No stable public tool or write path changes authority.
- All temporary fixtures are removed and the stable comparison path remains.
- Focused checks, the brain check, extension checks, context check, wire checks,
  live hello, and `git diff --check` pass.

## Promotion gate

Do not enter 8h with an unexplained in-contract mismatch, silent overflow,
unbounded rebuild, or unresolved project-generation race. Record unsupported
states as explicit fallback cases instead of weakening completeness.

## Retrospective target

Record the most common reason for fallback and the largest cost that shadow
comparison adds. This identifies what promotion can simplify safely.

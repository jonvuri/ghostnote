---
title: Phase 8g intermediate review and session split
kind: plan
state: complete
status: Review complete. Two P2 findings and five follow-up plans; no checkpoint commit.
updated: 2026-10-02
parent: 8g-shadow-project-cache.md
prev: 8g-shadow-project-cache.md
evidence: E130-E134; E138-E139; E214-E215; D23
---

# Phase 8g intermediate review and session split

## Purpose and authorization

Start this intermediate session before more 8g implementation. The staged
work has exceeded one session. Review the full staged change set, confirm which
components meet their own acceptance criteria, and divide the remaining work
into focused implementation sessions. 8g remains active. Do not enter 8h.

The user explicitly authorizes a checkpoint commit in this intermediate
session. This overrides the usual instruction to leave implementation changes
staged without a commit. Try to commit a coherent reviewed checkpoint. A partial
checkpoint or no commit is acceptable when a split would be difficult or would
displace the review. Do not force all staged work into a commit.

The review is complete in the
[ledger](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md) and
[inventory](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW_INVENTORY.json).
All 133 entry files are assigned to six areas. No P0 or P1 finding was found.
Two P2 findings remain. The bounded model, pool, coordinators, measured replay,
and packaging pass within their stated scope and assumptions.

Start [8g1](8g1-review-fixes.md), then follow its linked sequence through 8g5.
Live continuity, global budgets, native topology/ordering, and final acceptance
remain open. No checkpoint commit is made: fixes affect shared adapter and
verifier code, and a partial index would need separate dependency validation.
All work remains staged. Required offline checks pass. No live changes occurred.
The procedure below remains the record of the review criteria.

## Entry and primary artifacts

1. Read [NOW](../../NOW.md), the repository instructions, and this plan.
2. Record the current HEAD and repository status. Review `git diff --cached`
   as the primary artifact. Check unstaged and untracked files for dependencies.
   Preserve all existing work.
3. Read the [8g acceptance criteria](8g-shadow-project-cache.md), the
   [cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md),
   [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md), and
   [identity rules](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md).
4. Use [E214](../../evidence/experiments/e214-shadow-cache-content-and-lifecycle-gates.md)
   and [E215](../../evidence/experiments/e215-root-identity-and-observer-reuse.md)
   as the evidence index. Preserve E130/E134/E139 cold replay conclusions.
   Later sections of E214 supersede its earlier checkpoint status; reconcile
   the current gap list without changing historical results.

Before this handoff, the index held 132 files and 17,724 added text lines:
9,112 in brain, 6,253 in extension, and 2,359 in context. Binary reports were
excluded from those line counts. Recompute the inventory after the handoff
changes. Account for every staged file in the review ledger, including shared
helpers, tests, manifests, context, and build wiring.

## Review method and deliverables

Create a review ledger under `context/evidence/format/`. For each area, record:

- source and test files, evidence reports, and dependencies;
- explicit acceptance criteria derived from the existing contracts;
- each criterion's result: pass, fail, or unverified, with supporting references;
- assumptions the caller or host must satisfy;
- findings in priority order, with file and line references;
- a disposition: complete within its stated scope, implementation remains,
  evidence remains, or diagnostic only; and
- the follow-up session that owns each open item.

Review behavior, failure paths, and evidence oracles. Do not infer correctness
from test counts or matching two acquisitions that share the same faulty source.
Check false completeness, stale output, data loss, permission boundaries,
regressions, silent overflow, and unbounded work first. Record implementation
findings for focused fixes. This session owns review and planning; it does not
add cache features or weaken the promotion gate.

Independent areas can use subagents. Each review must include its declared
dependencies. One reviewer must integrate the results and inspect the shared
host adapter, core model, and runtime boundary.

## Areas and individual acceptance criteria

### 1. Normalized comparison, consumer rules, and core model

Review `phase8g-shadow-cache-lib.ts`, its tests, `ShadowProjectCache.java`, and
`ShadowProjectCacheTest.java`. Include their contract and document dependencies.

- Typed comparison detects wrong membership, fields, metadata, coverage,
  address, and generation. Fingerprint equality does not prove identity.
- Normalization preserves raw disabled values, signed host conversion, MIDI
  channels, and declared unknown fields. D23 loss stays separate from mismatches.
- Invalid measurements and stale dependencies refuse. Budget admission cannot
  bypass zero dirty work, complete coverage, replay, or current identity.
- Initialization, project, structure, binding, rebuild, content, and invalidation
  tokens have distinct duties. Old tokens cannot change the current domain.
- Callbacks dirty coordinates. Reconciliation reads all channels and preserves
  invalidations received during acquisition. Snapshots contain immutable values.
- Repair, replacement, deletion, rebuild, and health transitions match the
  contract. Unknown identity cannot inherit a logical clip from equal content.
- Separate finished model rules from snapshot acquisition, resource accounting,
  and other model sections that remaining live work can still change.

### 2. Handle pool

Review `ShadowHandlePool.java`, its tests, and its use in `ShadowCacheProbe`.

- Capacity and aggregate observer admission are bounded. Warm use and LRU
  eviction have a deterministic order.
- A reservation exposes neither victim nor pending target as a usable binding.
  Acceptance requires retirement and confirmed settlement.
- Cancellation cannot restore a retired target. Clear, invalidation, and a new
  pool instance reject stale reservations. Failed bookkeeping cannot partly
  publish a new address.
- Distinguish the pool algorithm from the host adapter's obligation to prove
  physical binding and project continuity. Review both sides of that interface.

### 3. Inventory and fallback coordinators

Review `ShadowInventoryRebuild.java`, `ShadowAuthorityFallback.java`, their
tests, and the providers in `ShadowCacheProbe`.

- Inventory stages privately, enumerates the declared full index space, and
  publishes only after final token and guard checks.
- Changes, provider failures, cancellation, expiry, and budget excess discard
  staging. Explicit retry is bounded; there is no automatic endless retry.
- Independent fallback uses its explicit requested scope. It does not derive
  completeness from sparse cache membership or admit a cache residence.
- Fallback exposes values only after a full guarded acquisition. A changed
  window discards all output, including retained terminal output.
- Registry bookkeeping, sparse recorder storage, authority staging, and enriched
  snapshots use separate measurements and limits.
- State the guard/provider assumptions. A coordinator that is correct under
  those assumptions does not prove the live provider satisfies them.

### 4. Replay and observer reuse experiments

Review `ObserverReuseProbe`, `RootIdentityProbe`, lifecycle and reuse drivers,
chain witness drivers, their tests, and the selected replay/reuse artifacts.

- Record the actual callback API. NoteStep proxy experiments cannot replace
  selected StepData replay evidence.
- Preserve accepted cold replay. A reset on a reused binding needs a populated
  canary transition or another proved initialization path.
- Validate independent fixture oracles, all acquired fields, all channels, and
  cancellation/recovery claims. Keep the two 18-case runs and 26 replay cases
  separate from restoration comparisons.
- Chain UUID conclusions cover only the measured loaded-copy, reopen, and
  reload protocols. Copied root UUIDs and equal endpoints cannot prove continuity.
- Physical callbacks supply coordinate hints, not historical note payload.
  Separate API operating assumptions from measured defects.
- Identify the exact remaining target update window and unseen A–B–A case.
  Do not turn an unproved universal callback claim into a new acceptance rule.

### 5. Completed live controls and retained evidence

Review all remaining `phase8g-*` drivers and tests. Include content, mutation,
structure, capacity, identity, no-chain, inventory, native Group, scene, note,
ordering, memory, cleanup, reload, and artifact verification.

- Trace each accepted case to its action, independent oracle, loaded build,
  guard outcome, terminal output, and restoration result.
- Keep abandoned preparations, failed preconditions, terminal refusals, and
  diagnostic trials separate from accepted cases. Preserve historical labels.
- Keep compound Add Scene then Move separate from the isolated Add Scene.
  Keep the declared native note edit separate from reacquisition observations.
- The accepted ordering trial has one B command during acquisition. A follows
  retirement. It proves one bounded case, not universal ordering or continuity.
- The 8,192-note trial hits enrichment time before the 16 MiB snapshot boundary.
  Do not count it as a memory-boundary pass. Estimates and output bytes are not
  total heap or host memory.
- Verify compressed and raw sizes/hashes plus report meaning. Check malformed
  reports, missing evidence, test-fixture independence, and denominator accuracy.
- Confirm restoration within its actual scope. Group membership and an identical
  UI viewport have not been proved by the current cleanup reports.

### 6. Packaging and runtime isolation

Review `build.gradle`, extension definitions, `RuntimeProfile`, `Rig`,
`RigConfig`, handlers, extension lifecycle hooks, hello, and wire changes.

- Every archive's service registration, manifest definition, class, and bundled
  profile agree. The distinct experimental archive deploys atomically.
- Experimental handles and methods stay behind their selected profile and config.
  Aggregate observer counts include every experimental StepData observer.
- The normal surface stays at 85 methods with hash `bba7383dce25c0f0`.
  Probe changes cannot alter stable read, write, or guard authority.
- E131, D9, D15, document contracts, live fixtures, frozen benchmarks, and
  publication candidates retain their existing boundaries.
- Tests and build tasks compile with their dependency closure. A proposed partial
  checkpoint must not refer to uncommitted classes, drivers, reports, or plans.

## Focused follow-up planning

After all areas are reviewed, create implementation plans for the remaining
work. Determine the final grouping from the ledger. Starting candidates are:

1. Project continuity and the guarded target update window, including no-chain,
   copied roots, reopen/reload, and an unseen A–B–A transition.
2. Snapshot acquisition and selected global budgets, including enrichment time,
   the 16 MiB boundary, aggregate storage, recovery, and latency.
3. Remaining native structure and ordering coverage, including group membership.
4. Final shadow acceptance and consumer workflows after the required predicates
   are proved; then decide whether the 8h entry gate passes.

Each plan needs entry conditions, owned files/interfaces, independent oracles,
acceptance criteria, required checks, live cleanup, and a stopping rule for a
failed experiment. Distinguish a small isolated implementation task from a host
knowledge question. Reuse accepted evidence; rerun it only for a concrete
regression risk. Vendor questions remain unsent unless the user authorizes them.

The earlier estimate of 5,034 active lines in 11 files is provisional. It covers
identity, host adapter, core snapshot code, ordering, memory, and no-chain work.
Confirm the active file set from the completed ledger. Do not declare the other
12,690 lines stable merely because they fall outside that estimate.

## Verification and live state

The prior checkpoint passes 1,688 brain tests. Extension checks pass 30 core,
37 adapter, ten fallback, nine pool, 15 inventory, seven scene, and one observer
budget groups. All four archive registrations and all five artifact bundles pass.
These are prior results. Run focused read-only checks that resolve review risks.
Run the required final checks for any checkpoint that will be committed.

From `brain/`, the artifact checks are:

```sh
node --import tsx src/probes/phase8g-shadow-cache.ts verify-artifacts
node --import tsx src/probes/phase8g-lifecycle-reuse.ts verify-artifacts
node --import tsx src/probes/phase8g-path-artifacts.ts
node --import tsx src/probes/phase8g-v5-artifacts.ts
node --import tsx src/probes/phase8g-followup-artifacts.ts verify
```

Final checks include `npm run check` in `brain/`, `./gradlew check` in
`extension/`, active wire checks, `ruby context/check.rb`, and staged/unstaged
diff checks. Use read-only normal hello if current runtime verification is
needed. Do not deploy or recreate live fixtures merely to repeat accepted checks.

The last verified API baseline has the original ordered four tracks, eight
scenes, 32 empty Launcher slots, selection, cursors, and pins. Rig config matches
its original bytes. The normal controller was fresh at
`2026-10-02T01:42:37.234Z`. Research fixtures and the disposable identity tab are
removed. Original `New 1` was left open, unsaved, with its engine active and
transport stopped. Never save or close that project during review.
The arrangement viewport is 7–15; the original was 14–22. Raw `/tmp` records are
optional lookup aids. The committed-format artifact bundles are the durable
evidence source; do not depend on scratch files or stale research state.

## Checkpoint and exit criteria

- Every staged file is assigned to a reviewed area. Cross-area dependencies and
  findings are integrated. Each completion claim has individual acceptance proof.
- The ledger separates completed components, diagnostics, and open work.
  Focused follow-up plans own every remaining 8g criterion.
- Decide whether to commit all reviewed experimental work, a dependency-complete
  subset, or nothing. Unfinished experimental code can be checkpointed only when
  its reviewed boundaries and remaining gates are explicit. Do not call 8g done.
- Before a commit, inspect the exact selected index and verify that its code and
  documentation are coherent. Preserve excluded work. If validating a partial
  index would dominate the session, leave it staged and record the reason.
- Update the 8g parent plan, Phase 8 index, and NOW with the review result, next
  session, exact checkpoint commit or no-commit reason, and verification scope.
- End with findings, component dispositions, follow-up order, and commit status.
  Record one brief context-management retrospective.

Successful completion of this intermediate session does not require a commit.
It requires a full review and a smaller, explicit plan for the remaining work.

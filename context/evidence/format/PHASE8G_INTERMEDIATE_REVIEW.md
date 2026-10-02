---
title: Phase 8g intermediate review
kind: evidence
state: active
updated: 2026-10-02
owner: phase-8g-intermediate-review
---

# Phase 8g intermediate review

## Scope and decision

The review used the index at HEAD
`c5e1a3c53f1fbe3dd76282a709c42e94187f91fc`. At entry, all changes were staged.
There were no unstaged or untracked dependencies. The index had 133 files,
17,990 added text lines, 60 deleted text lines, and 46 compressed reports.
Brain had 48 files and 9,112 added lines. Extension had 25 files and 6,253
added lines. Context had 60 files and 2,625 added lines.

The [inventory](PHASE8G_INTERMEDIATE_REVIEW_INVENTORY.json) assigns every entry
file to an area below. It records dependencies, roles, index blob IDs, SHA-256,
sizes, and text counts. Each compressed report also has raw size and SHA-256.
These are the reviewed index bytes, not a claim about a later checkout.

No P0 or P1 finding was found. The review recorded two P2 findings. Both are
closed by 8g1 below. No implementation was changed during the review. The review adds this ledger, the inventory, five plans, and the context
handoff. At review completion, all 140 changed files were staged, including the review
documents. No checkpoint commit was made. The shared adapter and evidence
verifiers required the 8g1 fixes below.
A partial checkpoint would need separate index validation across the core,
adapter, build wiring, tests, and reports. That work would displace this review.
The intermediate plan permits this no-commit result.

8g remains active. Do not enter 8h. Every live cache result remains
`complete:false` and `eligible:false`. A pure model pass does not prove a live
host predicate. E131, D9, D15, stable tools, document bindings, frozen benchmarks,
and publication candidates retain their current boundaries.

## Findings

### R1 — P2: typed mismatches are absent from the counter (closed in 8g1)

[ShadowCacheProbe.java](../../../extension/src/main/java/com/ghostnote/extension/ShadowCacheProbe.java)
line 965 increments `mismatches` only for `mismatch` and `coverage-mismatch`.
[ShadowProjectCache.java](../../../extension/src/main/java/com/ghostnote/extension/ShadowProjectCache.java)
lines 335–342 also return `metadata-mismatch`, `membership-mismatch`, and
`field-mismatch`. These real failures retire the view but do not increment the
counter. The parent plan requires mismatch measurements by cause. An operator
can therefore see zero mismatches after a content failure.

Static inspection confirms the missing branches. Existing adapter tests do not
check the counter for each typed failure. Fix the classification and add adapter
tests that check retirement, absent current output, and exactly one increment.
Window changes and resource refusals must remain separate. Owner: [8g1](../../plan/phase-8/8g1-review-fixes.md).

### R2 — P2: the retained note verifier accepts a warm mismatch (closed in 8g1)

[phase8g-ui-note-controls.ts](../../../brain/src/probes/phase8g-ui-note-controls.ts)
line 99 validates a warm result only when it says `match`. It accepts every
other comparison label, then accepts a later recovery match. The live finish
path calls `uiWarmOracleFailure`; the retained verifier omits that check.
The followup bundle uses this verifier, so valid hashes cannot close this gap.

A read-only reproduction cloned the retained native note report in memory.
It replaced `finish.reacquisition.comparison` with each of `metadata-mismatch`,
`membership-mismatch`, and `field-mismatch`, with both gates false. All three
clones passed `verifyUiNoteReport` and returned one accepted edit. No retained
file was changed. The actual retained warm result is `match` and passes its
edited-field oracle. This finding does not establish a live mismatch.

Make retained verification reject a current warm mismatch before recovery.
Check closed gates and output shape for allowed refusals. Add rehashed bundle
mutants as well as direct verifier tests. Preserve historical labels on refused
reads. Owner: [8g1](../../plan/phase-8/8g1-review-fixes.md).

## Finding closure in 8g1

Both findings are closed by offline regression checks on 2026-10-02.
The review inventory still records the original index bytes. No retained report
or historical manifest was changed.

R1: `ShadowCacheProbe` counts each core comparison cause once in `mismatches`
and `mismatchesByCause`. Metadata, membership, field, and coverage cases run
through the adapter. The host model supplies different authority metadata,
note membership, or velocity. The coverage case changes the request after
snapshot capture. Each case checks retirement, closed gates, absent current
cached output, terminal polls, and a later recovery that retains the failure
count. Retirement also releases the pool entry and clears the retained adapter
snapshot. The legacy generic `mismatch` label remains classified as a mismatch.

Matching scans count only as matches. Changed windows count in `windowChanges`.
Other comparison refusals count in `comparisonRefusalsByCause`, including a
host-work budget refusal. Terminal polls do not increment any counter.
Historical reports retain their original counter meaning; their old
`windowChanges` values also included scan refusals.

R2: the live finish path and retained verifier use `uiWarmOracleFailure`.
A current mismatch fails before explicit recovery. A match must pass the
independent edited-field oracle. Ten supported terminal refusal labels require
closed gates, a matching reason, and absent note, snapshot, metadata, and
coverage output. Unknown, pending, and malformed outcomes fail. A missing
comparison requires an explicit request error with no output. Historical
labels on refused reads remain separate from the current warm observation.

Direct report clones and bundle mutants reject `metadata-mismatch`,
`membership-mismatch`, `field-mismatch`, `coverage-mismatch`, and the legacy
`mismatch` label. The mutants change only the actual retained warm label.
The bundle tests recompute compressed and raw SHA-256 values and byte counts.
The successful recovery remains in every mutant. The unchanged retained match
still passes its edited-field oracle and yields one edit plus one separate
warm observation. Refusals remain observations, not matches.

Verification: all 41 affected TS tests pass. Brain `check` passes typecheck and
all 1,692 tests. Extension `check` passes 41 adapter groups, all other model
checks, and all four archive checks. All five artifact verifiers pass their
3, 3, 9, 13, and 18 retained reports. Active wire checks pass at 85 normal,
90 capture, and 97 probe methods. Context links and staged/unstaged diff checks
pass. The coverage test uses the existing reflective test mechanism; the JDK
warns that final-field mutation can be blocked in a future release.

No live host state changed. All live gates remain closed. Start
[8g2](../../plan/phase-8/8g2-project-continuity.md). No commit was made.

## Conservative continuity decision in 8g2

[8g2](../../plan/phase-8/8g2-project-continuity.md) is complete with
[explicit refusal](PHASE8G_PROJECT_CONTINUITY.md). The public live adapter
has no independent input window. It refuses residence, warm reuse, forced
canary, comparison, exact shadow acquisition, and inventory publication.
Equal roots and endpoints cannot preserve a reference. No unseen A–B–A live
pass is claimed. The live continuity and project-target window gates remain
unverified. 8g3 starts offline; its intended live acquisitions remain unsupported.
The ledger's earlier live measurements retain their stated scope.

Model tests cover silent revision changes during guard construction, target
settlement, reconciliation, enrichment, final metadata, and retained output.
Nonce checks reject equal counters from a new initialization. Retained inventory
now checks its external window. Published cancellation reads no provider.
Explicit recovery mints a new reference and acquires fresh values.

Verification: 52 adapter, 30 core, 16 inventory, ten fallback, and nine pool
groups pass. Full brain `check` passes typecheck and 1,692 tests. Full extension
`check`, all four archives, five artifact verifiers, active wire checks,
context links, and diff checks pass. No live state or historical artifact changed.
Entry HEAD already contains prior work. Only 8g2 is staged. No commit is made.

## Acceptance ledger

`Pass` means the stated bounded criterion passes. `Unverified` means required
live proof is absent. `Fail` identifies an implementation finding. The numbered
areas match the [review plan](../../plan/phase-8/8g-intermediate-review-and-session-split.md).

### 1. Normalization, consumers, and core model

Sources: `phase8g-shadow-cache-lib.ts`, its test, `ShadowProjectCache.java`, and
its test. Dependencies: the cache contract, cache policy, D23, host binding,
identity rules, and the live adapter. Inventory area 1 lists all five files.

| Criterion | Result | Proof and limit | Owner |
|---|---|---|---|
| Typed membership, field, metadata, coverage, address, and generation comparison | Pass | TS comparator and tests; Java `compare` and current-token checks. Digests do not substitute for values or identity. | 8g1 owns counter R1 |
| Raw disabled values, signed conversion, channels, unknown fields, and D23 loss | Pass | Wire conversion and fixture oracles retain raw controls. All-channel reconciliation is explicit. Portable pressure/repeat capability limits remain in host binding. | 8g5 |
| Invalid measurements and stale consumer dependencies refuse | Pass | TS invalid-number, missing-predicate, base-conflict, partial-field, and wider-span cases pass. | 8g5 |
| Budget admission cannot bypass zero dirty work, replay, coverage, or identity | Pass | Pure admission checks each predicate separately. Live gates remain hard closed. | 8g3, 8g5 |
| Init, project, structure, binding, rebuild, content, and invalidation tokens remain distinct | Pass | Core tests repeat numeric counters across reload domains and reject old callbacks, snapshots, and rebuilds. | 8g2 |
| Callbacks dirty coordinates; reads supply values; acquisition races survive | Pass | Core drain/enrichment race tests and adapter current-target tests pass. Snapshot maps and lists are frozen. | 8g2 |
| Repair, replacement, deletion, rebuild, and health rules | Pass | Pure scene repair, move/refusal, duplicate, replacement, gap, private staging, and explicit recovery tests pass. | 8g4 |
| Live snapshot acquisition and combined resource accounting | Unverified | Sparse and snapshot estimates are separate. Selected combined limits and the live 16 MiB boundary remain open. | 8g3 |

Disposition: the pure rules are complete within the tested model scope.
`ShadowProjectCache` is not a closed file: snapshot acquisition and storage
accounting remain active interfaces. Callers must provide valid current identity,
complete coordinate membership, field values, and continuity evidence. Equal
content cannot supply those inputs. Consumers are pure research decisions;
they grant no live write authority.

### 2. Fixed handle pool

Sources: `ShadowHandlePool.java` and its test. Dependencies: `ShadowCacheProbe`,
core addresses, aggregate observer admission in `RigConfig`, and host settlement.

| Criterion | Result | Proof and limit | Owner |
|---|---|---|---|
| Fixed capacity, warm recency, and deterministic LRU | Pass | Nine pool groups cover A–B–C–A, warm touches, free-index order, capacity, and equal-age index order. Production ages increase monotonically. | 8g3 |
| Reservation serves neither victim nor pending target | Pass | `find` hides reserved entries; `accept` requires retirement and confirmed settlement. | 8g2 |
| Cancel, clear, invalidate, reload, and failed bookkeeping cannot partly publish | Pass | Stale-domain reservations refuse. Post-retirement cancellation stays free. A failed clock update leaves the reservation uncommitted. | 8g2 |
| Aggregate physical observer admission | Pass | Rig checks all configured StepData observers before allocation; observer-budget tests pass. | 8g3 |
| Physical target and project continuity at pool acceptance | Unverified | Guarded canary/target controls pass in bounded runs. The host target update window remains open. | 8g2 |

Disposition: the pool algorithm is complete within its caller contract.
`markRetired` assumes the caller retired the physical binding. The Boolean
settlement input is not host evidence. Seven v5 pool comparisons confirm one
bounded integration protocol; they do not prove all project transitions.

### 3. Inventory and exact fallback

Sources: both Java coordinators, their tests, and `ShadowCacheProbe` with its
adapter test. The shared adapter depends on all six areas. Host providers use
the current rig census, current-target getters, root witness, and all channels.

| Criterion | Result | Proof and limit | Owner |
|---|---|---|---|
| Private full-space inventory and final guarded publication | Pass | Fifteen inventory groups cover full dimensions, private progress, duplicate addresses, final guards, and atomic replacement. | 8g2 |
| Failure, cancellation, expiry, excess, and explicit bounded retry | Pass | Provider/guard exceptions abort. 45 ms batches and 40 s attempts are bounded. Terminal polls cannot retry. Three live interruption controls pass. | 8g3 |
| Exact fallback uses explicit scope and no sparse membership | Pass | Ten fallback groups and adapter miss/unhealthy cases scan the requested coordinates and all channels. They admit no residence. | 8g5 |
| Changed acquisition or retained terminal window exposes no values | Pass | During-read, metadata, between-poll, retained-output, and explicit-cancel tests pass. | 8g2 |
| Registry, sparse recorder, authority, and snapshot measurements are separate | Pass | Coordinator status and adapter diagnostics label each estimate separately. JSON bytes are output bytes. | 8g3 |
| Combined selected budgets and live guard/provider guarantee | Unverified | Correct guard comparison assumes the host exposes the relevant transition. Live inventory guards declare identity unverified. | 8g2, 8g3 |
| Complete mismatch diagnostics | Pass | 8g1 closes R1 with all four core causes, retirement, and once-only counters. | 8g1 complete |

Disposition: coordinator control flow is complete under explicit provider and
guard assumptions. Live project fencing and total accounting remain open.
The provider must enumerate the declared full index space and supply valid note
fields. The guard must identify all transitions relevant to the requested
window. A sampled equal endpoint cannot prove that obligation. Registry
publication is diagnostic inventory, not complete note coverage or eligibility.

### 4. Replay, reuse, and root experiments

Sources: `ObserverReuseProbe`, `RootIdentityProbe`, lifecycle, reuse, chain,
mutation-witness, and path-artifact drivers and tests. Dependencies: the shared
adapter, raw fixture oracles, root signals, and the selected replay reports.
Inventory area 4 also includes both durable evidence documents and manifests.

| Criterion | Result | Proof and limit | Owner |
|---|---|---|---|
| Actual callback API and historical results stay explicit | Pass | Historical NoteStep research remains separate from selected StepData. E130/E134/E139 cold replay is preserved. | 8g2 |
| Recorder reuse preserves state or forces populated canary after reset | Pass | Selected replay passes 26 cases. Forced bindings confirm canary/target settlement. Same-target calls preserve the recorder. | 8g2 |
| Independent fixture values, channels, cancellation, and recovery | Pass | Separate v2 and v3 runs each pass 18 comparisons. V3 also has two active-scan cancellation controls and independent recovery. | 8g2 |
| Chain UUID claims stay within copy, reopen, and paired reload protocols | Pass | Eleven endpoint captures; exact copied package; both reload endpoints and changed extension nonce. No-chain witness is unknown. | 8g2 |
| Physical notifications remain hints; no unsupported defect claim | Pass | Reconciliation reads current target values on all channels. Trace gaps and source uncertainty remain qualified. | 8g2 |
| Guarded project-target update window and unseen A–B–A continuity | Unverified | Delivered detours retire correctly. Equal copied roots and equal endpoints cannot exclude an unseen detour. | 8g2 |

Disposition: measured replay and reuse protocols are complete within their
recorded scopes. Loaded-instance continuity remains evidence and implementation
work. API signatures and observer operating assumptions are not measurements
of universal ordering or silent loss. Universal callback source attribution is
not a new acceptance criterion.

### 5. Live controls, artifact meaning, and restoration

Sources: all other `phase8g-*` drivers and tests, native group/scene Java
controls, E214, E138, and the remaining artifact bundles. Their shared oracles
depend on areas 1, 3, 4, and 6. The inventory assigns each report and manifest.

| Criterion | Result | Proof and limit | Owner |
|---|---|---|---|
| Accepted content and mutation cases use independent field oracles | Pass | Retained reports contain action, build identity, acquired fields, terminal status, and restoration. Equal wrong cache/authority values fail fixture tests. | 8g5 |
| Diagnostics, refusals, preparations, and restoration have separate counts | Pass | Artifact roles retain failed engine, setup, historical-label, authority-refusal, note preparation, and timing controls. | 8g1, 8g5 |
| Compound scene and isolated scene remain distinct | Pass | Two declared actions versus one declared action; endpoint observations do not independently prove the action count. | 8g4 |
| One native velocity edit and separate warm observation | Pass | Actual report matches edited velocity and unchanged fields; explicit recovery and cleanup pass. | 8g5 |
| Malformed warm note comparison must fail retained verification | Pass | 8g1 closes R2 with direct and rehashed retained mutants despite recovery. | 8g1 complete |
| Accepted native command overlaps active acquisition | Pass | One B command overlaps; A follows retirement. 193 samples, 66 B brackets, no current output, errors, violations, or trace drops. | 8g4 |
| Broader ordering, group membership, and ambiguous move proof | Unverified | Flat census and Group/Ungroup fences do not prove descendants. One command overlap does not prove all ordering. | 8g2, 8g4 |
| Selected 16 MiB snapshot and combined resource boundaries | Unverified | 4,096-note match; 8,192-note enrichment-time refusal occurs first. Heap memory is unmeasured. | 8g3 |
| Compressed/raw integrity and semantic verification | Pass | All 46 reports decode. Every existing manifest size/hash passes. V5/followup check both forms; older manifests pin raw bytes only. Inventory now records both forms without rewriting history. | 8g1, 8g5 |
| Exact final API baseline and config restoration | Pass | Four ordered tracks, eight scenes, 32 empty slots, selection, cursors, pins, config bytes, and fresh normal runtime are retained. | Every live follow-up |
| Identical viewport or full group membership restoration proof | Unverified | Viewport is 7–15 versus entry 14–22. API cleanup does not assert identical viewport or descendant membership. | 8g4 |

Disposition: accepted bounded controls remain reusable evidence. 8g1 closes
R2 in the retained note verifier. The memory and late-command trials are
diagnostics. Group membership, broader native transitions, global budgets, and
final consumers remain open. User-declared action counts remain declarations.
Historical manifests' pending lists retain their checkpoint meaning; later E214
results and this ledger supply the current status.

### 6. Packaging and runtime isolation

Sources: build tasks, extension definitions, lifecycle hooks, runtime profile,
rig/config, handlers, hello, wire tooling, and goldens. Dependencies: the existing
handler registry and normal/capture/probe profile tests. Context changes in this
area carry review and implementation scope.

| Criterion | Result | Proof and limit | Owner |
|---|---|---|---|
| Archive registration, manifest, class, and profile agree | Pass | All four archive checks pass. Experimental definition and bundled probe profile agree. | 8g5 |
| Distinct experimental archive deploys atomically | Pass | Build copies the completed artifact through the selected destination transaction. No deployment occurred in this review. | Every live follow-up |
| Experimental handles/methods require profile and config | Pass | Rig allocation gates and handler profile filtering preserve the normal surface. Aggregate StepData admission occurs before allocation. | 8g3 |
| Normal surface remains 85 methods, hash `bba7383dce25c0f0` | Pass | Active wire check, wiremap tests, profile tests, and retained fresh normal hello agree. | 8g5 |
| Stable authority, document, benchmark, and publication boundaries | Pass | Staged paths and runtime registrations change research surfaces. Stable reads/writes and D9/D15 contracts retain authority. | All follow-ups |
| Dependency-complete build and selected checkpoint | Pass / no commit | Full brain and extension checks pass. No partial index was proposed or validated. Existing work remains staged. | 8g1 |

Disposition: packaging and isolation are complete for the current experimental
archives. Future resource or handler changes must repeat the affected boundary
checks. A fresh init time alone cannot prove the correct cached Java build;
live follow-ups must also check the deliberate build marker.

## Retained counts

Do not add these denominators into one acceptance total.

| Corpus | Count and scope |
|---|---|
| First shadow bundle | 15 content comparisons, including workflow and final dense cases; cleanup separate |
| Historical lifecycle/reuse bundle | 15 root captures; 83 matching and 15 failed reuse cases, 98 total; historical callback protocol |
| Selected replay | 26 independent selected StepData comparisons |
| Bounded reuse | V2: 18; V3: 18; V3 cancellation: two controls plus recovery |
| Existing chain witness | 11 captures; four chains in paired reload; no universal identity proof |
| V5 acceptance | Seven pool comparisons, three independent exact reads, six pure consumer controls |
| V5 mutations | 38 cases: 37 comparisons and one overflow; three restoration comparisons |
| V5 identity | Two delivered-event detours; failed engine attempt separate |
| V5 capacity/no-chain | Four capacity controls; no-chain exact empty scan and manual save remain separate scopes |
| Followup bundle | 18 reports; 14 structural fences/recoveries; three inventory interruptions |
| Native group/scene/note | One Group/Ungroup control; compound scene control has two declared actions; isolated scene has one; one velocity edit and one separate warm observation |
| Ordering | One accepted B overlap; return to A after retirement; late-command report has zero accepted trials |
| Memory | 4,096-note match; 8,192-note time refusal; zero selected snapshot-boundary passes |

## Follow-up order and active interfaces

1. [8g1 — Review fixes](../../plan/phase-8/8g1-review-fixes.md): complete; R1 and R2 are closed offline.
2. [8g2 — Project continuity](../../plan/phase-8/8g2-project-continuity.md): complete with conservative refusal. Live continuity remains unverified.
3. [8g3 — Snapshot and global budgets](../../plan/phase-8/8g3-snapshot-and-global-budgets.md): verify acquisition and each selected limit, combined storage, recovery, and latency.
4. [8g4 — Native topology and ordering](../../plan/phase-8/8g4-native-topology-and-ordering.md): extend native transitions and prove group membership or keep the unsupported state explicit.
5. [8g5 — Final shadow acceptance](../../plan/phase-8/8g5-final-shadow-acceptance.md): verify consumers and the whole 8g gate; decide 8h entry separately.

8g3 can start offline. The 8g2 decision refuses its intended live acquisitions.
8g4 can prepare offline in that interval. All live sessions use one owned fixture
at a time and restore the baseline before handoff.

The former 5,034-line estimate is not a closure boundary. Active interfaces
include `RootIdentityProbe`, `ShadowCacheProbe`, core snapshot code, both
coordinators, observer admission, the handlers, identity/no-chain, memory,
native structure/ordering, consumer drivers, and their tests/artifact verifiers.
The five plans specify ownership. Pool rules and measured replay are bounded
completed components, but shared source files can still change. Review the
affected dependency closure after each change; do not call all other lines stable.

## Verification in this review

- `npm run check`: 1,688 tests pass; typecheck passes.
- `./gradlew check`: 30 core, 37 adapter, ten fallback, nine pool, 15 inventory,
  seven scene, and one observer-budget groups pass. All four archive checks pass.
- All five read-only artifact commands pass: 3, 3, 9, 13, and 18 reports.
- Independent raw/compressed size/hash checks pass for every existing manifest
  field. The inventory pins the 46 reviewed compressed and raw byte sequences.
- Active wire check passes: normal 85, capture 90, probe 97 methods.
- Context links and staged/unstaged diff checks pass after the handoff edits.
- Read-only mismatch mutants reproduce R2. R1 is confirmed by source paths.

The sandbox initially blocked tsx IPC and the Gradle cache lock. Authorized
reruns passed. Gradle reports a future-JDK warning for reflective final-field
mutation in the existing adapter test clock. Current checks pass; this review
does not claim compatibility with a future JDK that blocks that mechanism.

No live host commands, deployments, project saves, or fixture writes occurred.
Live state evidence is retained from the final restoration. Original `New 1`
must remain open and unsaved. Vendor questions remain unsent.

## Retrospective

8g1 adds one warm-result rule for live and retained checks, plus rehashed
mutants. Keep terminal refusal labels tied to adapter output shapes when they
change. No repository instruction change is needed.

Use one shared classification for typed comparison outcomes in diagnostics and
artifact verification. Add a retained-report mutant when a live assertion is
introduced. This would prevent R1 and R2. Keep historical manifests immutable
and link current status from one ledger. No repository instruction change is needed.

---
title: Ghostnote internal cache contract
kind: reference
state: active
updated: 2026-10-02
parent: ../plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md
evidence: E131, E134, E138-E139; D23
---

# Ghostnote internal cache contract

## Scope and authority

This is the implementation contract for [8g](../plan/phase-8/8g-shadow-project-cache.md).
It combines the measured [identity rules](../evidence/format/CACHE_IDENTITY_AND_LIFECYCLE.md)
and [scale rules](../evidence/format/CACHE_SCALE_AND_DEGRADATION.md).
It does not implement a cache. The stable E131 reader remains authoritative.
8g must not use cache state for stable responses, write guards, or writes.

[E214](../evidence/experiments/e214-shadow-cache-content-and-lifecycle-gates.md)
records the partial 8g implementation. Content comparisons pass.
[E215](../evidence/experiments/e215-root-identity-and-observer-reuse.md) shows
physical observer reuse under tested protocols. Selected StepData replay passes
26 cases. Bounded adapter reuse passes two separate 18-case runs; the corrected
run also passes two scan cancellation controls with recovery. Existing chain
UUIDs distinguish loaded copies and reopen, and survive a matched controller
reload. Automatic loaded-instance detection remains unproved. Earlier cold-start
and canary-transition replay evidence remains valid. No live snapshot is eligible.
V5 also passes fixed pool, independent exact fallback, mutation, delivered
identity fence, and occupied-coordinate limit controls. E214 keeps their counts
separate. The 2,048-coordinate result measures enriched storage separately from
the sparse recorder estimate. Missing-event continuity and host input ordering
remain gates. The corrected followup passes 14 structural fences and recovery
comparisons, three private inventory interruption controls, and one native
Group/Ungroup control. Group membership remains unproved. Separate native scene and note controls
pass. One native project command during acquisition passes retirement with no
current output. This is a bounded ordering control. At 4,096 notes, enriched
snapshot payload is 8,431,780 estimated bytes. At 8,192 notes, enrichment time
refuses before the selected 16 MiB snapshot boundary. That boundary and combined
selected budgets remain unmeasured. Estimates do not measure heap memory.
Final API baseline, exact config restoration, and fresh normal hello pass.
The implementation does not change this target contract.

Each resident clip uses one fixed `1/512`-beat observer. The internal cache
stores domain values, not serialized FIELDS or JSON. Host handles, proxy
indices, callback tokens, queues, and recorder estimates stay internal.
Public reads expose useful scope, field coverage, freshness, and fallback facts.

## Domain types and invariants

| Type | Value and invariant |
|---|---|
| InitializationDomain | Unique extension-owned nonce for one cache initialization. Include it in references, callback tokens, rebuild tokens, and snapshots. Equal numeric counters from another initialization cannot prove freshness. |
| ProjectGeneration | Monotonic local generation. Change on foreground project change, switch back, reopen, or extension reload. A project name is not an identity witness. |
| StructuralEpoch | Monotonic revision of the current address domain. Change before structural repair or rebuild. |
| LogicalClipRef | Opaque clip ID plus project generation. Mint independently of content equality. Retire on deletion, replacement, or identity loss. |
| CurrentAddress | Durable track `channelId` plus current zero-based scene row. Resolve track indices when needed. Never use a held proxy's index as structural authority. |
| SlotIdentity | Project generation, structural epoch, track `channelId`, and row. It describes the slot, not the clip. |
| ContentGeneration | Monotonic revision of one logical clip's normalized content. Advance after reconciliation proves a change. Duplicate callbacks alone do not advance it. |
| Fingerprint | Versioned digest of normalized clip values and declared coverage. Equality is a content witness, never an identity proof. |
| BindingGeneration | Monotonic token for an observer binding. Change before every rebind, eviction, or callback shedding operation. |
| RebuildGeneration | Monotonic token for private rebuild staging. Change before every rebuild attempt and on abort. |
| CallbackToken | Initialization domain, project generation, structural epoch, binding generation, and rebuild generation captured when the binding was created. |
| Coordinate | Absolute `1/512` cell plus MIDI pitch, without a channel. A coordinate is one recorder membership, even if several channels have notes there. |
| NoteAddress | Logical clip, host MIDI channel `0..15`, pitch `0..127`, and cell. Public projection converts channel to `1..16`. |
| Coverage | Onset span, all-channel membership coverage, acquired field set, and normalized timing basis. A complete span does not imply that every portable property is observable. |
| Snapshot | Immutable normalized values, coverage, identity tokens, content generation, fingerprint, and acquisition witness. It contains no mutable host references. |

All counters must be valid nonnegative integers. Limits and elapsed times must
be finite and nonnegative. Invalid measurements cannot admit a snapshot.
The fingerprint input has a named version and deterministic ordering by
channel, cell, and pitch. It includes clip metadata and field coverage used by
the caller. It excludes callback counts, internal handles, serialization,
portable event IDs, and derived overlays. Compare typed values as well as the
digest in diagnostic runs. Do not substitute this fingerprint for the portable
R27 content hash or an exact host-source hash.

The cache fingerprint can use only the acquired normalized domain. Incomplete
fields remain unknown. A coverage change changes the fingerprint domain.
Source collisions and sub-cell loss remain the [D23 boundary](../decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md).
Cache agreement does not prove exact source multiplicity or exact onset timing.

## Sparse storage and reconciliation

Store occupied coordinates and deduplicated dirty coordinates per binding.
Track sustain callbacks as invalidations; do not emit a sustain cell as a new
note. Every accepted callback dirties its coordinate, including a field-only
change. The callback state is not note authority.

At each dirty coordinate, read all 16 MIDI channels. Replace the normalized
membership and values for that coordinate from settled authority. Remove an
occupied coordinate only when no channel has a NoteOn there. Enrich note
properties only for occupied coordinates and the field set needed by a caller.
An enrichment with missing properties cannot claim those properties as known.

Capture tokens and the invalidation sequence before enrichment. Compare them
after enrichment and before publication. A change keeps the affected work
dirty and discards the candidate. A callback received during reconciliation
must not be erased by the reconciliation's queue removal.

Occupancy counts are coordinate counts, not note counts. Pending work is the
sum of distinct dirty coordinates across bindings. Repeated callbacks for one
coordinate coalesce. Occupied and dirty set memberships both consume recorder
storage when the same coordinate is in both sets.

## Health and state machine

`healthy` means `complete` plus all eligibility predicates below. It is not a
second state. Health applies to a declared scope. An unaffected resident clip
can be complete while the project working set is partial.

| State | Meaning | Publication and next action |
|---|---|---|
| invalid | Identity, binding, authority, or selected resource budget failed | Reject current state. Exact fallback; start a new valid identity domain or shed load. |
| rebuilding | Private inventory, identity resolution, and replay are in progress | Keep staging private. Exact fallback. Publish only an atomic complete candidate. |
| warming | Target binding or replay has not settled | Keep replay private. Exact fallback. Complete after settlement and reconciliation. |
| complete | Declared membership and requested fields are current | Publish an immutable snapshot only if all eligibility predicates pass. |
| dirty | At least one affected coordinate needs authority reconciliation | Exact fallback for affected coverage. Return to complete after stable reconciliation. |
| repairing | A known structural event needs address repair and observer rebind | Reject affected coverage. Rebind, warm, then complete. |
| partial | Some requested coverage or fields are missing | Do not label the request complete. Obtain missing authority or return an explicit partial observation. |
| overflow | A selected limit was exceeded | Record the limit reason. Exact fallback; shed load or rebuild as the limit table requires. |
| ambiguous | Several identity outcomes fit the evidence | Reject identity reuse. Rebuild with new IDs or refuse an identity-dependent operation. |

Partial observations can serve model context. They cannot serve a full cache
snapshot, replacement base, or exact guard. A bounded working set can serve a
complete single-clip request while it cannot serve a complete project request.
An empty registry is complete only after full requested inventory enumeration.
A slot with no clip is not an existing empty clip.

Eligibility requires all of these predicates:

1. Project, structure, clip identity, and binding tokens are current.
2. Requested onset membership and channels are fully covered.
3. Requested fields are acquired; unsupported fields have explicit coverage.
4. Populated-canary replay and target settlement passed.
5. No affected dirty work, pending structural event, or event gap remains.
6. Pre-read and post-read tokens and invalidation sequence agree.
7. Admission passes all selected budgets.

The existing [budget evaluator](../../brain/src/contract/cache-policy.ts) is a
necessary admission check. It is not a completeness check. For example, it
accepts pending counts from 1 through 2,048. 8g must apply the separate zero-dirty
and coverage predicates before publication. `partial`, `overflow`, `repairing`,
and `ambiguous` are orchestration states; map them to exact fallback or refusal
before the evaluator can select `cache`.

## Binding, replay, and late callbacks

Resolve the track by `channelId`, confirm it, then pin the track. Select and
confirm the slot, then pin the clip. Phase-based binding can group this work by
track and scene after each dependency is confirmed. Do not point all unpinned
cursors at once: E139 observed convergence on the final target.

Use a known populated canary to prove callback replay. Do not add test notes to
user clips. If no safe canary is available, use exact fallback. A fully
enumerated inventory with no clips needs no note replay.
Keep target replay private until expected clearing and membership reconcile.
Use the retained E139 settlement rule: bound targets, at least 1,500 ms elapsed,
and unchanged callback counts for ten successive polls at intervals of at least
50 ms. Quiet time alone does not prove replay. The canary and fresh authority
checks are also required. 8g must verify this rule for its implementation.

### Preserve cold replay evidence

[E130](../evidence/experiments/e130-constant-time-launcher-clip-read-search.md),
[E134](../evidence/experiments/e134-project-observer-scale-sweep.md), and E139
establish initial occupancy replay under their measured protocols. E134
repeatedly verified initial replay after controller load. This evidence remains
valid. Do not reopen this result because a local recorder was cleared after
replay without a new target transition.

Use `addStepDataObserver` for the selected occupancy index. `addNoteStepObserver`
is a different callback family. E130 found no initial replay and missed
four enable-field changes with that family. E215's first three reuse runs used
that family. Their independent full scans establish proxy content matches;
they do not establish selected step-data replay.

Preserve a recorder on an unchanged, confirmed current binding. If the recorder
must reset, reset before a populated-canary-to-target transition. The canary
must differ from the target. If it is already selected, force a different
selection first. Check sparse membership before a full scan can replace it.
An empty hint queue and quiet time alone cannot prove that a reset completed.
A complete scan remains independent comparison or exact fallback evidence.
Do not require a full scan to seed every startup solely because a recorder
reset discarded replay.

Reject a callback if any token differs, its binding is retired, or its coordinate
is outside declared coverage. Count and diagnose rejection. A structural epoch
change invalidates old bindings, including bindings whose clip did not move.
Rebind them with current tokens before accepting new callbacks.

Apply this token rule to domain events with known tokens. A physical StepData
callback supplies no source token. Treat it only as a bounded coordinate hint.
It cannot supply note values or prove current membership. Read those values
from the confirmed current target under the guarded read protocol. An old hint
can cause extra reconciliation or refusal. Do not require universal callback
source attribution when this rule prevents old payload from entering the cache.
The subscribed-change delivery rule is an API operating assumption. The open
question is whether project updates, target values, and observer delivery make
the guarded current-target window valid. No measured result proves that the
host silently loses callbacks.

An immutable snapshot remains a historical observation after invalidation.
Do not mutate it or present it as current. Consumers must recheck its tokens
before reuse. Rebuild publication compares project, structural, and rebuild
tokens, then swaps one complete candidate atomically. Interrupted or expired
work cannot publish. A retry gets a new rebuild token.

## Identity repair and rebuild

Retain logical clip identity for note edits, clip clear/refill, save, and a
proved exact move. An exact move needs one ordered empty-to-fill pair, a
known-empty destination, a complete event window, and a fresh authority
fingerprint match. Duplicate and replacement always mint a new identity.
Same-address rebuild continuity also needs a complete event window.

Repair incrementally for exact note invalidations, complete empty/fill events,
a scene insert/delete at one known row, or a track index change resolved by the
same `channelId`. Repair rows from the structural event before rebinding.
Delete retires all pending work for the removed identity.

Rebuild after project changes, reload, an event gap, unknown structural order,
group or flat-track topology change, equal-candidate ambiguity, observer or
canary failure, interrupted rebuild, or authority mismatch after repair.
Do not infer project continuity from a matching name or track list.
E138's track-reorder rule is model evidence; it is not a working host move route.

## Admission, eviction, and limits

Empty slots do not consume observers. Existing clips with zero notes still
need proved coverage. Select a deterministic least-recently-used resident set;
break ties by logical clip reference. Eviction first retires the binding token
and its dirty work. The evicted clip becomes non-resident, not empty. New
residence starts in warming and enters complete only after replay.

All limits apply together. A caller cannot use a passing observer count to
ignore the storage limit. Do not silently truncate clips, queues, fields, or
requested coverage.

| Resource | Selected limit | Required over-limit result |
|---|---:|---|
| View width | 131,072 steps | Overflow for cached coverage; exact fallback. |
| Active observers | 512 | Keep excess clips non-resident; exact fallback. |
| Occupied coordinates per clip | 2,048 | Overflow for that clip; exact fallback. |
| Pending dirty coordinates, total | 2,048 | Stop callbacks, retire tokens, rebuild; exact fallback. |
| Sparse recorder estimate | 16 MiB | Drop affected cache state and reduce residence; exact fallback. |
| Incremental cache-bank construction | 50 ms | Invalidate and shed cache load; exact fallback. |
| One binding replay | 5 seconds | Keep warming, abort the attempt, then bounded retry or rebuild; exact fallback. |
| Working-set rebuild | 40 seconds | Abort staging, invalidate its token, then bounded retry; exact fallback. |
| Bridge ping p95 | 50 ms | Invalidate until rechecked; shed load and use exact fallback. |

Threshold equality is allowed. E139's recorder estimate is 256 bytes per
recorder plus 56 bytes per occupied or dirty set membership. This estimate
excludes Bitwig memory and enriched note payloads. Report all extension-owned
storage separately and keep enrichment and snapshot retention bounded. 8g must
measure those costs; it must not call the sparse estimate total cache memory.
Use cooperative reconciliation batches within the measured 50 ms host-work
budget. Persistent overload cannot trigger unbounded retries or staging growth.

Exact fallback obtains fresh settled authority for the requested normalized
view. Retain E131 for the existing product path and exact diagnostics. If its
dual-grid source projection has a normalized collision, do not choose a survivor.
Acquire the settled single `1/512` cell view with all-channel enrichment or
refuse. D23 complete coverage follows that acquisition boundary. Fallback does
not enlarge cached coverage or admit new residence.
An unavailable exact authority causes explicit `authority-unavailable` refusal.
For a deleted slot, fresh Launcher inventory proves absence; do not call an
unavailable existing-clip reader an empty-note result.

## Diagnostics and shadow comparison

Expose health, read mode, reason, measured value, limit, generations, coverage,
active/resident/warming/dirty counts, rejected callbacks, occupied/pending
coordinates, estimated bytes, construction/replay/rebuild times, ping p95,
authority availability, and comparison outcome through the experimental
boundary. Keep host handles and queue contents out of public documents.

Compare every eligible shadow snapshot with an independent settled `1/512`
authority scan in the same verified identity and content window. If a mutation
occurs between scans, record `window-changed` and retry within budget. It is not
a passing comparison. Compare metadata, membership, all 16 channels, requested
fields, and declared coverage. Compare values before relying on digests.
Record address/identity, membership, field, stale-generation, and coverage
mismatches separately. Use E131 as the exact-source diagnostic control. Report
D23 collision and displacement separately from implementation mismatches.

| Shadow family | Required cases |
|---|---|
| Acquisition | Initialization, warm read, empty existing clip, absent slot, boundary cell, and unknown field coverage. |
| Notes | Add/remove/move, field-only change, same coordinate on several channels, all 16 channels, repeated callbacks, and sustain invalidation. |
| Structure | Create/duplicate/replace/clear/refill/delete/move clips; scene insert/delete before/at/after clips; track create/duplicate/delete/index change; group topology. |
| Identity domain | Save, switch away/back, close/reopen, reload, equal fingerprints, event gap, and ambiguous move. |
| Capacity | Every limit at equality and above; residence miss; deterministic eviction; combined density/storage limits; authority unavailable. |
| Recovery | Callback burst, callback during reconciliation, old binding/project callback, shed callbacks, interrupted/expired rebuild, and atomic publication. |
| Consumer | Read-only and sparse-patch shadow workflows; stale overlay dependencies; partial fields; base conflict; computer-use change followed by reacquisition. |

## Conditional promotion

8g supplies comparison results, bounded recovery and resource measurements,
fixture cleanup, and the required checks. 8h promotion requires no unexplained
in-contract mismatch, silent overflow, unbounded rebuild, or unresolved
project-generation race. Unsupported states retain explicit exact fallback.

Only after this gate can an immutable healthy snapshot serve preparation or a
write preflight. It must cover the operation's fields and extent; match current
project, structure, clip identity, and content; and have no intervening event
gap or dirty work. Recheck these predicates at the guarded write boundary.
Cached normalization cannot replace exact source evidence needed for preserved
unobservable values or reversal. Independent post-write authority readback
remains required by the operation's risk policy. Reuse a preflight observation
with preparation only within the same validated window.

## Retrospective

The existing budget evaluator does not prove completeness. Name its separate
eligibility predicates at every publication boundary. Existing E138/E139
evidence is sufficient for this contract; no new live check is needed in 8f3.

---
title: E214 — Shadow cache content matches; lifecycle and binding gates remain
kind: evidence
state: active
updated: 2026-10-02
parent: ../../plan/phase-8/8g-shadow-project-cache.md
---

# E214 — Shadow cache content matches; lifecycle and binding gates remain

## Result

8g has a partial implementation. Fifteen retained cases match independent
settled `1/512` authority. The first epoch has ten main and three workflow
cases. The second epoch has two dense-clip cases. None is eligible for cache
publication. The result is
`hold-lifecycle-unverified`. 8g remains active, and 8h has not started.

The domain model implements the selected state machine. The first retained host build
lacks a proved project-generation signal and consumes a physical observer handle
on each binding. These gaps prevent that build from supplying a complete
persistent project cache. A
content match does not prove project or clip identity.

The [cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md),
[E138](e138-cache-identity-and-lifecycle.md),
[E139](e139-cache-scale-limits-and-degradation.md), and
[D23](../../decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md)
remain the acceptance sources. No criterion was removed. E131 remains stable
read and write-guard authority.

## Implementation and method

The [domain cache](../../../extension/src/main/java/com/ghostnote/extension/ShadowProjectCache.java)
holds sparse occupied and dirty coordinates, immutable snapshots, identity
tokens, content generations, health, admission, eviction, repair, and private
rebuild staging. Its
[Java checks](../../../extension/src/shadowCacheTest/java/com/ghostnote/extension/ShadowProjectCacheTest.java)
run without Bitwig. They establish model behavior, including late callbacks,
interrupted work, limits, and atomic publication.

The [host adapter](../../../extension/src/main/java/com/ghostnote/extension/ShadowCacheProbe.java)
and [handler](../../../extension/src/main/java/com/ghostnote/extension/handlers/ShadowCacheHandlers.java)
are available only at the experimental boundary. The live configuration uses
eight resident handles and one independent authority handle. All views use
131,072 cells at `1/512` beat and 128 pitches. One authority observer is reserved
within the 512 physical-observer limit.

Each dirty coordinate gets a membership read on all 16 MIDI channels. Fields
are acquired only for occupied coordinates needed by a snapshot or authority
comparison. Disabled raw controls remain present. Duration uses R07 rounding,
with raw duration retained. Signed host timbre converts with `(raw + 1)/2`.
Gain remains an amplitude ratio. Portable repeat and articulation are unknown.
The [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md)
defines these units and coverage limits.

Binding confirms and pins the track before selecting and pinning the clip.
Replay uses a populated read-only target as a canary. Settlement requires at
least 1,500 ms and ten unchanged polls at intervals of at least 50 ms. The
independent authority view uses the same settlement rule. It scans every cell,
pitch, and channel without using cache membership. Pre-read and post-read
identity, metadata, and callback checks reject a changed window.

The [live probe](../../../brain/src/probes/phase8g-shadow-cache.ts) compares
values through the independent
[TypeScript comparator](../../../brain/src/probes/phase8g-shadow-cache-lib.ts).
Its [tests](../../../brain/src/probes/phase8g-shadow-cache-lib.test.ts) cover
normalized values, field coverage, consumer freshness, and resource reporting.
The retained main run used Bitwig 6.0.6, host API 25, profile
`phase-8-probe-v1`, 97 methods, and method hash `f03f19414f40e3d3`.

## Retained main content cases

| Case | Content comparison | Eligible cache result |
|---|---|---|
| Initialization, all 16 channels at one coordinate | Match | No |
| Warm read | Match | No |
| Field-only edit with disabled chance on channel 15 | Match | No |
| Note add and sustain invalidation | Match | No |
| Sparse note move | Match | No |
| Note removal | Match | No |
| Existing empty clip | Match | No |
| Final cell at 131,071, channel 15, pitch 127 | Match | No |
| 256 occupied coordinates | Match | No |
| Reacquisition on an unused handle | Match | No |

The main record contains no comparison mismatch. Fresh inventory proves the
separate absent-slot case. The adapter refuses an existing-clip read there; it
does not return an empty note list as proof of a clip.

Retiring a handle prevents its reuse. Reacquisition succeeds on an unused
handle. The `save` lifecycle operation preserves model identity; it does not
prove actual project save, switch, close, reopen, or reload behavior.

## Main measurements

| Measurement | Retained value | Scope |
|---|---:|---|
| Cache-bank construction | 0.749 ms | Eight resident handles plus authority |
| Ping p95 | 25.089 ms | 25 bridge ping samples |
| Comparison wall time | 12.039–12.294 s | Each retained main case |
| Authority host work | 4.602–4.721 s | Full scan in each main case |
| Bridge requests | 127–129 | Each main comparison |
| Response bytes | 257,878–545,182 | Each main comparison |
| Total main comparison wall time | 121.511 s | Ten retained cases |
| Total main bridge requests | 1,279 | Ten retained cases |
| Total main response bytes | 3,017,246 | Ten retained cases |
| Sparse recorder estimate | 15,472 bytes | Four resident clips, 258 coordinates |
| Retained snapshot estimate | 571,100 bytes | Four snapshots, 273 note records |
| Dense snapshot serialization | 147,184 bytes | One 256-note snapshot, UTF-8 JSON |

The retained main record calls bridge requests `toolCalls`. This is a bridge
counter, not a count of public tool calls. The workflow record must keep these
counts separate.

Sparse storage excludes host memory and enriched payloads. The retained main
build names its snapshot estimate `retainedSnapshotBytes`; that value is an
estimate. The current code names it `retainedSnapshotEstimatedBytes`. Serialized
bytes measure JSON output, not heap memory. Current diagnostics also separate
domain object counts from cumulative direct adapter allocations. A full scan
performs 268,435,456 `getStep` calls. It is the largest measured comparison cost.
These measurements do not prove scale or recovery for the implemented adapter.

## Acceptance gaps after the first build

| Criterion | Evidence now | Remaining work |
|---|---|---|
| All eligible snapshots match authority | Fifteen content matches; zero eligible snapshots | Establish eligibility, then run the full shadow corpus |
| Partial or unhealthy state cannot be complete | Public result has `complete:false` and `eligible:false` | Prove live eligibility predicates before promotion |
| Old project callbacks cannot affect current state | Model token tests pass; physical handles are never reused | Prove a host project-generation signal across switch, reopen, and reload |
| Structural repair follows 8d | Model repair and rebuild exist; unknown host structure resets identity | Complete live clip, scene, track, and group cases |
| Bounded admission, eviction, and recovery | Model limits and private rebuild checks pass; unused-handle reacquisition matches | Prove reusable host bindings or another bounded recovery route |
| Callback bursts and interrupted work | Model checks cover rejection and staging | Run live burst, late callback, and interrupted rebuild cases |
| Every limit and combined resource budget | Model equality and over-limit checks exist | Run implementation-specific live capacity and tail-latency cases |
| Memory follows the sparse and handle model | Sparse and snapshot estimates are separate; direct allocation counters exist | Measure the completed working set and recovery; qualify host memory separately |
| Real read-only and sparse-patch workflows | Stable E131 read and note-patch workflow pass; partial cache consumer falls back | Complete remaining consumer and computer-use cases |
| Stable authority is unchanged | Normal runtime and wire checks pass; experimental resources are separate | Keep this boundary through later integration |
| Fixtures and baseline are clean | Owned fixture removed; configuration and project baseline restored | No remaining cleanup |
| Required checks pass | Brain, extension, artifacts, context, wire, hello, and diff checks pass | Live promotion cases above remain pending |

## Workflow and structural follow-up

The first epoch adds three retained comparisons:

| Case | Content result | Wall time | Bridge requests | Response bytes |
|---|---|---:|---:|---:|
| Real agent note-patch insertion, two notes | Match | 12.235 s | 130 | 275,807 |
| Restore the existing clip to empty | Match | 13.251 s | 132 | 277,739 |
| Duplicate clip, new identity, and rebuild | Match | 13.672 s | 135 | 563,902 |

The note-patch workflow used three public tool calls and took 8.532 seconds
before the separate shadow comparison. Its first request refused an insertion
into an empty clip because no source channel could be inferred. A fixture seed
on channel 0 permitted the retry. Product write authority remained E131.
A cleanup attempt used a cell outside the cursor's local window. Scrolling
corrected that attempt. The restored empty clip then matched authority.

The duplicate case entered structural fallback and received a new logical ID
on rebuild. A fresh unused handle acquired 256 notes, which matched authority.
This proves one bounded rebuild case. It does not prove repeated recovery or
all structural cases. All three comparisons remain ineligible.

## Final build, cleanup, and verification

After controller removal and reload, the second epoch checked the shared R07
helper, separate domain census, and allocation reduction. Both 256-note
comparisons matched authority. Fresh comparison took 12.612 s, 132 bridge
requests, and 592,416 response bytes. Warm comparison took 12.438 s, 131
requests, and 597,126 bytes. These times include authority scanning.

The second epoch retained one resident clip. Its recorder estimate was 14,592
bytes. Its snapshot estimate was 529,548 bytes. Domain counts were five clip
entries, one binding token, 256 occupied coordinates, zero dirty coordinates,
256 membership notes and lists, one snapshot, and 256 snapshot notes. Snapshot
maps held 6,656 field entries and ten metadata entries. Identity and witness
storage had a separate 2,340-byte estimate. These are domain counts and
estimates; they do not measure total heap or host memory.

Two full scans performed 536,870,912 authority `getStep` calls and 8.535 s of
host work. The adapter allocated 1,280 note lists across membership,
enrichment, and authority work. It allocates no new list at empty coordinates.
The earlier main build had 201,327,390 cumulative list allocations across
twelve scans. That counter includes two unretained initial comparisons.
Do not compare these totals as equal workloads.

The second epoch's ping value of zero was unmeasured. Its `budgetAdmitted`
diagnostic does not prove all resource predicates. The probe now samples ping
before each comparison and rejects nonnumeric measurements. A final review
also corrected late-window results: they discard authority and return refusal.
These corrections pass focused checks and compilation. Deliberate live race
and full budget trials remain pending.

The [artifact manifest](../data/phase8g-shadow-cache/manifest.json) identifies
the compressed raw records and their SHA256 checksums. Run from `brain/`:

```sh
node --import tsx src/probes/phase8g-shadow-cache.ts verify-artifacts
```

This check verifies all fifteen typed content comparisons and zero eligible
results. To repeat live work, run `configure`, deploy and reload the probe
archive, then run `setup`, `run`, `workflow`, and `final-live`. Reload the probe
before `final-live`. Afterward run `cleanup` and `restore-config`. Deploy and
reload the normal archive. Restore the selected track and run `verify-cleanup`.
Use the repository's full remove-and-add controller procedure for each reload.

Cleanup restored the four track IDs, eight scenes, zero Launcher clips, selected
track 0, unbound cursors, and both pin states. The rig configuration was restored
from its exact byte backup. Normal live hello passed with 85 methods and hash
`bba7383dce25c0f0`. No live fixture or probe configuration remains.

Verification passes: 1,515 brain tests, typecheck, 28 Java cache groups, extension
build, artifact replay, wire goldens, context links, live hello, and diff checks.
The normal and capture method inventories are unchanged. Stable readers,
writes, frozen benchmarks, and publication candidates are unchanged. Keep 8g
active until the remaining acceptance cases have live evidence.

## Retrospective

`lifecycle-unverified` is the reason that all otherwise matching content results
remain ineligible. Full authority scanning adds the largest measured cost.
Read official API sources and controller examples before declaring a host
limit. Separate a supplied lifecycle event from automatic detection. Keep raw
units beside normalized timing tests. No repository instruction change is needed.

## Research follow-up: lifecycle and observer reuse

[E215](e215-root-identity-and-observer-reuse.md) records the live research
results. Copied projects can share the root UUID and all six observed root
signals without a new callback. Continuous subscription permits repeated
observer reuse. In the marked build, resume before point passes 10/10 cycling
cases. Point before resume passes 3/5, with binding refusals on B and the empty
target. The before-point control also adds status checks and a delay. It does
not isolate a single host cause.

Same-target resets can leave zero sparse notes and no pending hints while
full scans find 16 notes. Earlier cold-start replay evidence remains valid.
These reset cases clear the recorder without forcing a new target transition,
the experiment error already identified in E134. Verify replay preservation or
a canary-to-target transition after reset for reused bindings. Loaded-instance
identity remains unproved. Keep the unresolved eligibility gates closed.
The 56, 26, and 16 research case counts remain separate from this cache corpus.

The references below supplied the research protocol. The one-use handle rule
is an adapter choice, not a measured Bitwig restriction. Automatic lifecycle
detection remains an open implementation question. The inspected API does
not prove that a safe implementation is impossible.

### Sources and documented behavior

The official [API 25 source archive](https://maven.bitwig.com/com/bitwig/extension-api/25/extension-api-25-sources.jar)
was read from the Gradle cache. Its SHA256 is
`9ccc0485ed9de371baa78304ca4c578e82893c461fa0656a489d150097688d0f`.
The project-source review covered all 278 Java files.

| API source | Documented behavior | Remaining question |
|---|---|---|
| `Clip`, `ObjectProxy`, `Subscribable` | Clip proxies support counter-based `subscribe()` and `unsubscribe()`. Unsubscribed observers receive no notifications. | Queue drain and replay completion are not specified. |
| `Clip.addStepDataObserver` | Registration returns `void`; callback has x, y, and state. | No source clip or generation is supplied. |
| `Clip.addNoteStepObserver` | Registration returns `void`; callback has note data, including channel. | No source clip or generation is supplied. |
| `Value` | Adding an observer marks interest automatically. `markInterested()` permits value reads. | Neither operation supplies a binding fence. |
| `ControllerExtension`, `ControllerHost` | Init and exit occur at extension start and stop. Flush concerns output to the controller; scheduled tasks supply a delay. | No project-load or input-completion fence is documented. |
| `Project`, `Application` | Current-project proxy, root track group, project name, and engine state are available. | No explicit loaded-instance ID or project-switch event was found. |

Official extensions demonstrate cursor reuse. The Launchpad Pro
[StepSequencerMode](https://github.com/bitwig/bitwig-extensions/blob/a27f2f4b3d9a0e9a71b1d1da10ded02d071275c0/src/main/java/com/bitwig/extensions/controllers/novation/launchpad_pro/StepSequencerMode.java#L102)
subscribes and unsubscribes one cursor on mode changes. The SL Mk3
[ClipState](https://github.com/bitwig/bitwig-extensions/blob/a27f2f4b3d9a0e9a71b1d1da10ded02d071275c0/src/main/java/com/bitwig/extensions/controllers/novation/slmk3/sequencer/ClipState.java#L75)
registers observers once; its
[StepViewPosition](https://github.com/bitwig/bitwig-extensions/blob/a27f2f4b3d9a0e9a71b1d1da10ded02d071275c0/src/main/java/com/bitwig/extensions/controllers/novation/slmk3/seqcommons/StepViewPosition.java#L107)
scrolls the same handles. These examples show intended reuse. They do not prove
our callback-generation or completeness requirements.

The official [1.1 release history](https://downloads.bitwig.com/stable/1.1.4/Release-Notes-1.1.4.html)
mentions a current-project observer. This historical note does not specify a
loaded-instance generation or callback ordering. API 25 `Application` exposes
`projectName()` and its deprecated name observer. The source review remains the
authority for the measured API version. Do not read the historical wording as
a proved lifecycle fence.

The local DrivenByMoss reference at commit
`836117be7c17318a0f93cb414e333516a91a5436` also registers one observer per cursor.
Its project wrapper uses name and modified state, without a stronger identity
signal. The local `reference/bitwig-extensions` is the gregrossdev repository.
It is not the official Bitwig repository used above.

### Existing measurements and their limits

[E134](e134-project-observer-scale-sweep.md) already rebound observers from a
populated canary to separate target clips. It supports reuse under its tested
conditions. [E132](e132-flush-boundary-clip-settlement.md) and
[E133](e133-hybrid-observer-acquisition.md) reject flush and quiet-time rules as
completion proof. Their grid/page failures do not prove that a fixed-grid,
fixed-page cache cannot reuse handles.

E138 supplied lifecycle events to its probe, which advanced a local generation.
It proves recovery after those events. It does not prove automatic detection.
[E2f](e2f-stable-track-identity-does-exist-channelid-uuid-2026-07-19.md) proves
that a saved track retains its UUID across reopen. No unrelated-track UUID
collision or copied-project UUID result was measured here.

### Next experiments after E215

E215 completed the six-signal root experiment and three clip-proxy reuse runs.
Its root tuples cannot distinguish two loaded copies. Its reuse callback was
`addNoteStepObserver`; independent full scans matched, but this callback is not
the selected step-data occupancy index.

1. Test optional existing chain UUIDs across loaded copies, reopen, and a paired
   controller reload. Keep absent chains and changed structure explicit.
2. Repeat sparse replay and reuse with `addStepDataObserver`. Preserve current
   same-target recorder state; reset before forced canary transitions. Verify
   sparse notes before an independent scan can replace the recorder.
3. Integrate a bounded physical hint queue. Discard callback payload and re-read
   current-target membership on all channels with pre-read and post-read guards.
   Test retirement, late hints, races, overflow, and recovery. This protocol must
   not claim source identity from a callback that supplies none.

[E18b](e18b-3-2-closed-a-chain-s-is-minted-by-the-project-loader-a-matched-p.md)
provides another candidate. Existing chain UUIDs survived extension reload and
changed on project reload in its fixture. Test them as optional loaded-instance
witnesses where a chain already exists. Projects without chains and chain
replacement require separate handling. Do not add a chain solely to identify
a user project.

Keep the selected acceptance criteria until these experiments establish a safe
protocol. API silence alone does not close the question.

## Reusable adapter implementation follow-up

The next experimental build replaces the one-use physical-handle rule with
current-target physical hints. `addStepDataObserver` is registered once per
handle. The callback queues bounded coordinates without setting domain note
content. Reconciliation confirms current binding tokens and reads all channels
from the current target. Callback payload and source identity remain unused.

A confirmed same-target request preserves its recorder. Reset or reused
bindings require a different populated canary before the target. If that
canary is already selected, the adapter first selects the target to force a
later canary transition. Each binding stage has a five-second limit. The full
sequence has a forty-second limit. No fixture is created by the adapter.

Physical and domain pending work share a conservative 2,048-item admission
bound. Overflow latches a rebuild requirement and retires logical tokens.
Diagnostics report physical hint counts and storage estimates separately.
These are estimates, not total host or JVM memory.

Eleven adapter model groups and 28 domain groups pass. The adapter checks cover
the callback API, same-target preservation, current-target reads for old hints,
forced canaries, reconciliation and enrichment races, global pending limits,
empty-canary refusal, changed-target refusal, interrupted scans, and structural
reset. They do not establish live host replay or callback origin.

E215 now adds 26/26 selected StepData sparse replay matches and 18/18 bounded
adapter content matches. These are separate research denominators. Eleven chain
captures distinguish loaded copies and close/reopen with four optional existing
chain UUIDs. A matched full controller reload preserves all four chain UUIDs
and changes the extension nonce. No cache eligibility is claimed. The v3 adapter also fixes cancellation between comparison polls.
Twelve adapter groups and 28 domain groups pass. Live v3 passes 18/18 reuse
cases and two separate between-poll cancellation controls with recovery.
Automatic witness integration and the remaining 8g corpus stay pending.

## V5 integration checkpoint

The source now attaches optional identity witnesses to the adapter. Delivered
changes invalidate bindings and pending work without host reads from the
listener. Per-initialization nonces separate equal numeric counters after
reload. A fixed LRU pool retires a reservation before rebind and accepts it
only after settlement. Exact fallback shares the fixed authority handle and
reads every requested coordinate independently of cache membership.

Inventory rebuild uses private staging and atomic publication. It remains a
diagnostic registry with unproved identity and membership. Review found that
an old published coordinator could restore stale inventory flags after a
domain change. V5 detaches it and exposes a terminal retired attempt. Polling
cannot start a hidden retry. Exact refusals are terminal and cannot expose
earlier acquired output. Comparison refuses authority batches above 45 ms.
Current replay measurements exclude retired and warming bindings.

The full build passes 30 domain, 34 adapter, 12 inventory, nine pool, ten
fallback, and one aggregate-budget groups. Brain checks pass 1,558 tests.
The follow-up artifact checker passes nine files, including the unchanged
owned fixture census around preset insertion. Context links and diff checks
pass. No v4 or v5 live acceptance run had occurred at this checkpoint.

The user added a controller. Hello passed the contract and initialization-time
checks. The acceptance driver then refused its marker: the running code was
v4, although the deployed archive was v5. No acceptance case ran. A cached
class can start after deployment; its new initialization time is insufficient.
Hello now accepts an optional `--shadow-marker` check.

The v4 controller was fully removed. V5 was deployed again. The deployed
archive SHA-256 is
`8021d665f7f14395e2e974eda1ccf721fbfcd0e8d81431b2bda4c86d1fe0367a`.
Its `ShadowCacheProbe.class` contains the v5 marker and no v4 marker.
Bitwig's vendor menu still ignores UI automation. The user was asked to add
the final ghostnote product from the full list. This UI step blocks live
checks; it is not a failed cache comparison.
The original project, owned test track, research configuration, and disposable
identity packages remain for the next live run. Final cleanup is pending.
8g remains active, all cache eligibility stays closed, and 8h remains unentered.

### Remaining live acceptance sequence

1. Marker-checked hello, cache acceptance, mutation cases, and two delivered
   identity fence controls pass. No-chain fallback and the native save control
   also pass in the retained v5 corpus. Do not repeat those controls.
2. The corrected followup passes 14 structural cases, one native Group/Ungroup
   control, one compound scene control, and one isolated scene control. Keep
   their denominators and action provenance separate. Group membership remains
   unproved.
3. Three private inventory interruption controls and paired reload nonce
   separation pass. Resolve missing-event continuity, host input ordering,
   and ambiguous-move proof without treating delivered events as universal proof.
4. One native note edit and one separate warm reacquisition observation pass.
   The memory trial stops at enrichment budget before the snapshot memory
   boundary. Test remaining resource boundaries and tail latency. The live
   fixture and normal runtime baseline are restored. Finish owned package
   cleanup and the required checks.

The six new consumer controls use live snapshots with pure decision checks.
Keep the earlier actual read and patch workflow evidence separate. Delivered
identity changes can prove invalidation in a measured case. They cannot prove
detection of an undelivered or coalesced detour. Cold StepData replay remains
accepted evidence. Do not restart that research as a missing prerequisite.

## V5 live acceptance follow-up

The running marker is `8g-shadow-physical-hints-v5`. Retained verifiers pass
the following independent corpora:

| Corpus | Result | Scope |
|---|---|---|
| Fixed LRU pool | 7/7 normalized comparisons | Four reservations, three warm uses, two LRU evictions |
| Independent exact fallback | 3/3 full reads | A, B, and existing empty clip; no residence admission or cache membership |
| Consumer controls | 6 decisions pass | Read-only context, patch preparation, missing field fallback, unavailable authority, stale content, and conflicting base |
| Note mutation corpus | 38/38 cases | 37 normalized comparisons and one physical hint overflow control |
| Mutation restoration | 3/3 full comparisons | Original raw notes, disabled fields, and metadata restored |
| Delivered identity fences | 2 controls pass | Active scan cancellation, two terminal refusals, unavailable old read, and fresh recovery |
| Occupied coordinate limits | 4 controls pass | Full matches at 256, 1,024, and 2,048 coordinates; one extra coordinate causes overflow |
| Capacity restoration | 3/3 full comparisons | Original raw fields and metadata restored |

Registry publication and explicit rebuild enumerate three existing clips
atomically. Exact busy, cancellation, and three unsupported scope controls
return terminal refusal with no old payload. Ping is measured before pool
admission and after the run. The fixed pool remains two resident observers and
one authority observer; aggregate experimental count is six.

Pool warm median is 2.164 s across three uses. Reservation median is 5.751 s
across four uses. Independent exact reads take 2.048–2.255 s. These wall times
include polling and full comparison work. The acceptance run makes 644 bridge
requests and receives 3,289,124 serialized response bytes. Its measured ping
p95 is 25.148 ms before admission and 24.814 ms afterward.

The mutation run makes 2,123 requests and receives 13,070,619 response bytes.
Each full authority comparison makes 4,194,304 `getStep` calls. Sparse recorder
estimate reaches 624 bytes; retained enriched snapshot estimate reaches
41,436 bytes. These are extension-owned estimates, not host or JVM heap
measurements. Serialized bytes are a separate transport measurement.

The 2,049-coordinate burst latches physical hint overflow, records a dropped
hint, sheds pending work and binding tokens, and refuses old output. Explicit
rebuild and fresh acquisition recover. Observations after shedding do not
retain the 2,048-pending equality state.

The separate capacity run matches all acquired fields at 256, 1,024, and 2,048
occupied coordinates. Each snapshot retains one channel-15 note per coordinate.
Adding coordinate 2,049 causes domain overflow without physical hint overflow.
Residence, occupied entries, dirty work, and binding tokens are shed. Two reads
refuse authority and contain no old output. Their historical comparison labels
remain `match`. The public reason is `lifecycle-unverified`; the selected clip
reason is not exposed. Keep the source-based density-limit inference separate
from that literal public reason.

At 2,048 coordinates, the sparse estimate is 114,944 bytes and the enriched
snapshot estimate is 4,216,996 bytes. Logical object counts include 2,048 note
records and 53,248 field entries. These counts and estimates are not heap
measurements. The run makes 781 requests and receives 12,864,218 response bytes.
Ping p95 is 25.143 ms. The three density comparisons take 3.029–3.570 s,
including writes, polling, and authority. All three restoration comparisons
pass. Other selected resource boundaries remain separate.

Each identity control records 56 callbacks, including 48 identity callbacks,
and an identity epoch increase of 48. Original root and chain endpoints are
equal after return. One control has no bridge reads between project switches.
The inactive-engine UI attempt is a separate failure record. It does not enter
the passing denominator or prove a cache mismatch.

The first structural run stops during seed setup: chance remains `1` after a
requested `.375` write. No structural case starts. Its cleanup removes all
temporary tracks and scenes. Three full original-fixture comparisons match,
and root inputs, baseline UUID order, scene count, and slots are restored.
Confirm note creation before property writes, then retry under a new report
path. Keep this setup failure separate from comparison outcomes.

The second structural run passes seed setup, then stops at an incorrect test
assertion after clip duplication. The structural epoch advances from 13 to 14.
The current read is retired, refuses authority, and contains no snapshot or
authority notes. Its `comparison:match` label describes the last completed
comparison. It does not grant current authority. Correct the test to inspect
current read mode, authority, phase, and output. The second cleanup also removes
all temporary tracks and scenes and passes three full original comparisons.
Retain this test failure separately. It is not a content mismatch.

The third structural run passes clip duplication, its automatic fence, and
fresh normalized recovery. Clip movement also causes an automatic fence. Its
independent authority comparison then reaches the five-second binding budget.
The driver did not save that terminal wire reply before its assertion. Retain
the observed error without reconstructing the omitted reply. Cleanup removes
all temporary tracks and scenes and passes three full original comparisons.
Investigate the independent handle transition before the next retry. Keep the
selected deadline unchanged.

Native group preparation stops because `branch.mixer` is absent from the probe
profile. No Group action occurs. The sole new empty instrument track is removed
after its UUID, name, type, eight empty slots, and exact prior census are checked.
The exact baseline census is restored. Add method and probe preflight before
fixture creation. This setup failure is outside the passing group denominator.

The [v5 artifact manifest](../data/phase8g-v5-acceptance/manifest.json) retains
exact raw bytes, lengths, hashes, and semantic checks. All live cache results
remain `complete:false` and `eligible:false`. Missing-event continuity and
host input ordering remain unproved. 8g stays active; 8h stays unentered.

### Follow-up build before the next live run

The follow-up probe archive is deployed. Its SHA-256 is
`23ca28c42a3bbe94edabab4dd7493354a53898e44d152ad07f9b8e0fd9c33cd0`.
The physical hint marker remains v5. New independent markers are:

- Authority binding: `8g-authority-transition-v1`.
- Private inventory controls: `8g-inventory-preparation-v1`.
- Guarded scene names: `8g-scene-controls-v1`.
- Flat group flags: `8g-group-controls-v1`.

The authority handle confirms a distinct existing clip before the final source.
Comparison uses the validated control address. Exact fallback selects a control
from at most 64 fresh host inventory cells within the 45 ms work limit. It does
not use cache residence or membership. No distinct control leaves the direct
source strategy explicit. The five-second binding limit still includes the
control transition. Diagnostics cannot mask terminal refusal or add host reads
to cancelled or acquired exact results.

`rebuildBegin` starts private staging without a slot read. A controlled poll can
read one through 64 cells. Default rebuild behavior and deadlines stay unchanged.
The live driver is ready for cancellation, 40-second expiry, and a Launcher
content event after positive private progress. Guarded mutable scene names and
bounded group flags support native UI tests. They do not prove object identity,
descendants, or host input ordering. The scene helper counts one insertion; the
before and at labels describe the same native boundary.

Extension checks pass 30 core, 37 adapter, 15 inventory, nine pool, ten fallback,
seven scene, and one observer-budget groups. These are model checks. The first
follow-up Add loads the old v5 classes. The authority and inventory revision
fields are absent, and `sceneSnapshot` is unknown. No follow-up live case runs.
The running init time is `2026-10-01T15:12:51.941Z`.

A separate archive now uses the controller name `ghostnote 8g controls`, UUID
`bfa28180-fdac-4c43-9b0c-e4d33065012c`, and version `0.0.1-8g-controls-1`.
Its deployed file is `ghostnote-shadow-8g-controls.bwextension`. Its SHA-256 is
`3894c1144ede6867fad122879d6db146941aa351908fd781c5d0ac031742e664`.
The archive manifest selects the new definition and the probe profile. The
canonical archive on disk is normal. `check`, `copyExtension`, and
`copyShadowProbeExtension` pass. The old controller is fully removed.
Select the named experimental product before further live work. Verify every
new marker. The vendor menu still ignores UI automation.
The before-reload root, nonce, census, and source marker are retained
at `/tmp/ghostnote-8g-followup-before-reload.json`.

The offline paired verifier `phase8g-reload-captures.ts` has six focused tests.
It requires new extension, probe, and core instance IDs and later init times.
It also requires equal ordered track census, eight scenes, and four-chain
endpoint inputs, plus the new authority and inventory markers. A fresh after
capture is pending. Equal endpoint inputs do not prove project continuity.

The guarded native note driver is ready, with ten focused tests. It prepares a
unique track and clip with one note. The native action sets velocity to 50.0%.
The driver retains current cache reads and historical comparison labels
separately. It then records one reacquisition observation and an explicit
recovery comparison. The sole authority handle prevents simultaneous cache
comparison and exact scan. Busy refusal is checked before the UI action.
Terminal reasons do not prove callback cancellation. A warm mismatch remains
fatal after recovery. Cleanup accepts a failed preparation or edit only with
the named owned UUID, three original oracles, exact census, non-group flag,
unchanged scenes, and sole owned clip. No live note case had run at this
checkpoint.

The full brain check passes 1,637 tests. Context and diff checks pass. The new
controller Add and all follow-up live reports remain pending.

### Service registration correction on 2026-10-02

The next Add loads a fresh `normal-v1` instance with 85 methods. Its init time is
`2026-10-01T16:02:31.001Z`. `cache.shadow` is absent. This result is outside the
8g live corpus.

The experimental archive's manifest selects the new definition, but its
`META-INF/services/com.bitwig.extension.ExtensionDefinition` file still names
the normal definition. This packaging error explains the missing catalog name.
Bitwig's [official controller repository](https://github.com/bitwig/bitwig-extensions/blob/main/src/main/resources/META-INF/services/com.bitwig.extension.ExtensionDefinition)
lists definitions in this service file. The build now makes the service entry
agree with the selected manifest definition for each archive. The normal entry
stays unchanged. A new `verifyExtensionArchives` check verifies all four service
entries, definition class entries, and bundled runtime profiles.

`check`, `copyExtension`, and `copyShadowProbeExtension` pass. The corrected
experimental archive SHA-256 is
`6207ad3becb00c519fbb2ebe05305e75e64b5f40650aba2741d4cb3523979671`.
Its service entry now names `GhostnoteShadowCacheExtensionDefinition`. The normal
controller is fully removed. The vendor menu still ignores UI automation.
User Add of `ghostnote 8g controls` and all follow-up live reports remain pending.

### Corrected build and followup controls

The corrected Add passes all five markers and hello with 97 probe methods.
Its init time is `2026-10-01T16:09:35.081Z`. The matched before and after reload
captures pass the offline verifier. Extension, probe, and core instance IDs
change. The ordered five-track census, eight scenes, and fixed four-chain
endpoint inputs stay equal. This check does not prove project continuity or
host input ordering.

The [followup manifest](../data/phase8g-followup-acceptance/manifest.json)
retains these reports separately from the earlier v5 corpus. Each report has
exact raw bytes, lengths, hashes, and semantic checks.

The corrected structural run passes all 14 cases: clip duplication, movement,
replacement, deletion and recreation; scene append and deletion around the
observed row; and track insertion, duplication and deletion. Every case has an
automatic fence and a fresh normalized recovery comparison. The distinct
authority control transition resolves the earlier movement binding refusal.
Three original comparisons before and after the corpus match. All temporary
tracks and scenes are removed. The run makes 3,163 bridge requests and receives
21,360,066 serialized response bytes. Case wall times are about 7.5–8.9 seconds.
Keep the three earlier failed attempts outside this denominator.

Private inventory passes three separate controls: explicit cancellation,
40-second expiry, and a delivered Launcher content event. Each starts with zero
slot reads, then reads three private cells. Two terminal polls remain stable.
No control publishes staging or retries implicitly. Explicit fresh inventory
and comparison recover. Three original comparisons before and after match;
the sole temporary clip is removed. The expiry arm records 40 heartbeats over
41,890.486 ms. Maximum ping is 29.940 ms. The corpus makes 906 requests and
receives 5,533,951 response bytes. This does not prove missing-event or ambiguous
movement continuity.

One native Group and Ungroup control passes. Cmd+G wraps only the named empty
owned child. An automatic fence and comparison cancellation are observed.
Cmd+Shift+G removes the wrapper. Guarded cleanup confirms the exact prepared
census and eight empty child slots, then removes only the child. All three
original restoration comparisons pass. Group membership and descendants remain
unproved. The earlier group preflight failure is a separate record.

Native scene insertion was prepared at this point. Native note editing,
enriched memory measurement, and final cleanup were pending. Popup
menus are absent from the app screenshot. Escape dismisses them before a
keyboard shortcut; otherwise the popup can consume the shortcut.

The user reports that Add Scene adds an empty scene after the selected target.
The user then moves that new scene before the target. The resulting tail has
the new empty row at 9 and the owned target at 10. Record this as one compound
control with two native actions. No intermediate host snapshot was captured.
The final layout alone does not prove a single direct insertion, or which
action caused an observed fence. The prepared raw report is retained separately
before recording this provenance. Recovery and guarded cleanup remain pending.

The compound control then passes a fresh normalized row-10 recovery comparison.
Its combined mutation fence and scan cancellation are observed. Neither is
attributed to one action. Direct insertion acceptance stays false. Guarded
cleanup removes the four owned tail scenes and sole test track. Three original
restoration comparisons match. Keep this one compound control and its two
user-reported actions separate from direct insertion. A fresh isolated control
selects the preceding empty first marker. One Add Scene after that marker puts
the empty scene before the target without a move. The completed isolated result
is recorded below.

### Isolated scene result and abandoned note preparation

The isolated scene control passes. The user declares one Add Scene action after
the preceding owned marker. The new empty row is 9, and the target moves from
row 9 to row 10. An automatic mutation fence, scan cancellation, fresh normalized
row-10 recovery comparison, and guarded cleanup pass. The report is
`/tmp/ghostnote-8g-ui-scene-isolated-results.json`. The
[followup manifest](../data/phase8g-followup-acceptance/manifest.json) retains it
as the seventh artifact.

This is one user-declared action. No intermediate state independently proves
the action count. `singleInsertionProved` remains false. Keep this one isolated
control separate from the earlier compound control and its two user-reported
actions. Neither result proves host input ordering or scene identity. Cache
results remain incomplete and ineligible.

The first native note preparation is a separate abandoned diagnostic at
`/tmp/ghostnote-8g-ui-note-followup-results.json`. A native double-click on
Velocity resets the seeded value from `80/127` to 100%. The intended single-edit
control has not run `finish`. No note-edit acceptance is claimed. Guarded
cleanup passes, with `controlOutcome:failed-or-unfinished`, restored fixtures,
removed temporary fixtures, and three original restoration comparisons. The
followup manifest retains this eighth artifact as
`native-note-preparation-diagnostic`. Keep this preparation outside any
completed note-edit count.

The fresh isolated note fixture used suffix `29c091b2`, track UUID
`067de797-5c73-4a9c-ad0a-615964b09310`. The requested native action is one
Cmd-click to set Velocity to 50%. The isolated `finish` passes at
`/tmp/ghostnote-8g-ui-note-isolated-results.json`. The user declares one native
Velocity edit. One separate warm reacquisition observation, without an explicit
barrier, matches the edited oracle. Explicit recovery also matches.

Before recovery, the current cache read refuses with `authority-scan-busy`. It
retains a historical `match` label but returns no note output. The exact scan
terminates with literal reason `authority-scan-budget` after elapsed time. This
is not `window-changed` and does not prove callback cancellation. Keep the one
native edit, one reacquisition observation, and exact refusal distinct. Guarded
cleanup and verification pass. All temporary note fixtures are removed, and three
original restoration comparisons match. The followup manifest retains the ninth
report as `native-note-controls`. Final restoration is recorded below.

### Enriched snapshot memory trial

The separate trial is
`/tmp/ghostnote-8g-snapshot-memory-followup-results.json`. At 4,096 notes, the
normalized cache and independent authority match. The source estimates are
14,592 bytes for the sparse recorder, 8,431,780 bytes for the enriched payload,
and 7,471,104 bytes for authority staging. The logical snapshot has 26 fields
per note and 106,496 field entries.

At 8,192 notes, independent authority returns 8,192 notes and matches the written
projection. Cache enrichment refuses with literal reason `enrichment-budget`
after 6,752 enrichment `getStep` calls. It does not reach the selected 16 MiB
snapshot memory boundary. The sparse recorder estimate is 28,928 bytes. No
snapshot remains retained. The first mutation clears the prior 4,096-note
snapshot. Physical hint overflow is false.

This is a failed boundary diagnostic, retained as the tenth followup report with
role `snapshot-memory`. `snapshotMemoryBoundaryObserved` and
`selectedGlobalBudgetsCovered` remain false. Source estimates do not measure
heap memory. Serialized byte counts measure output, not memory. All three
original clips pass full-field restoration comparisons; `fixtureRestored` is
true. Keep this trial separate from the earlier occupied-coordinate density
controls. The ordering timing diagnostic and final restoration are recorded
below.

### Narrow the remaining ordering question

The official [API 25 source archive](https://maven.bitwig.com/com/bitwig/extension-api/25/extension-api-25-sources.jar)
states that subscribed objects notify observers when changes occur. Interested
getters supply current values. The active project proxy follows the current
project. StepData callbacks supply coordinates and state, but no source token.
Delayed tasks and requested flushes do not document a host input barrier.

Universal callback source attribution is not needed for the current hint-only
adapter. A physical callback queues a coordinate, not note content. Guarded
`getStep` reads supply current-target values. An old hint can cause extra work
or refusal; it cannot insert old note payload. Existing race and retirement
checks cover this distinction. Do not describe an unknown ordering protocol as
a proved host defect or require proof against arbitrary API malfunction.

The narrower open question is whether project-target updates, interested values,
note getters, and observer delivery share a valid guarded current-target window.
Equal endpoint inputs cannot reveal an unseen completed A-to-B-to-A transition.
The present contract still requires a generation change on each switch and back,
and an event window without gaps. No newly proved eligible subset follows from
the callback distinction alone.

Next use disjoint immutable A/B note and chain witnesses. Log native project
commands separately and attempt guarded reads across rapid transitions. Record
getter and callback order in one sequence. Check for a mixed-target candidate,
stale output after a delivered invalidation, or a visible completed transition
that the API misses while reads cross into B. Another settled detour and full
content match would not answer this ordering question. If the measured protocol
cannot resolve it, prepare a Bitwig question about coherent getter state,
project-change delivery order, transition coalescing, and an input revision or
completion callback. Sending that question requires user authorization.

Before the scene provenance and ordering sampler changes, the full brain check
passes 1,656 tests. Extension checks and all four
archive registrations pass. The followup bundle verifies five retained files;
scene, note, and memory report roles remain pending. Active wire goldens,
478 active context documents and links, and diff checks pass. No commit is made.
Final fixture and normal-runtime verification still require live work.

The `phase8g-ordering-controls.ts` driver uses existing v5 diagnostics. It
prepares an active comparison with positive progress, then samples root and
status brackets during native project switches. It never calls `read` in the
loop because that operation starts another comparison. The native command log
is separate and must overlap active acquisition. Getter work counts and final
notes are available; raw per-batch `getStep` payloads are not. Changed RPC
brackets remain transition observations. Current output, delivered retirement,
historical labels, and unsampled native transitions stay separate.

The first trial at `/tmp/ghostnote-8g-ordering-v5-results.json` fails the timing
precondition. A 27-second tool gap separates preparation from sampling. The
active scan reaches `match` before the native B switch. Neither native project
command overlaps active acquisition. No ordering acceptance is claimed. Three
original restoration comparisons pass, and the pretrial census and root inputs
are restored. The eleventh followup artifact retains this report with role
`ordering-timing-diagnostic`. Keep it separate from the fresh trial below.

Each actual `comparePoll` reads 65,536 coordinates in this build. Only three
polls remain after preparation. The previous 250 ms poll cadence does not supply
the assumed eight-second action window. The fresh trial uses a ten-second
comparison poll cadence and a `prepare-sample` CLI mode. Preparation and sampling
run in one process to remove the tool gap.

The fresh trial at `/tmp/ghostnote-8g-ordering-interleaved-results.json` passes.
Its active acquisition window is 01:30:56.493–01:31:16.676 UTC. The native B
command runs at 01:31:08.238–01:31:09.158, inside that window. The native A
command runs at 01:31:19.734–01:31:20.218, after retirement. Sampling ends at
01:31:26.723. Two completed engine commands are observed.

The trial retains 193 samples, 66 B brackets, one changed bracket, zero current
outputs, zero errors, zero concrete violations, and one retired poll. The trace
drops zero events. The terminal result is retired with `window-changed`, and
current output is absent. Three original comparisons before and three restored
comparisons pass. The pretrial fixture census and root inputs are restored.
The twelfth followup artifact retains this report with role `ordering-controls`;
its verifier passes. Count one accepted interleaving trial. The later A command
does not add another acquisition overlap case.

| Current scope | Result | Remaining gate |
|---|---|---|
| Native project command during active acquisition | One B overlap passes with retirement and no output | No universal host ordering proof |
| Delivered transition trace | Zero drops in this trial | No missing-event or callback-origin proof |
| Snapshot memory boundary | Enrichment budget refuses first | Selected 16 MiB snapshot boundary remains unmeasured |
| Session restoration | Owned fixtures removed; exact API baseline, config, fresh normal runtime, and final checks pass | UI viewport differs as stated below |

The guarded current-target protocol remains experimental. This trial cannot
prove all host ordering or derive an unseen generation from equal endpoints.
Final restoration passes as recorded below.

After those source changes, the full brain check passes 1,679 tests. Six retained
followup files verified at that checkpoint. Context and staged diff checks
pass. The isolated scene, completed note cleanup, and memory diagnostic are
recorded above. The first ordering timing diagnostic claims no acceptance. The
separate fresh trial passes one acquisition overlap. Final restoration passes
as recorded below.

### Final restoration on 2026-10-02

The exact owned research track is deleted. The API baseline has the original
ordered four tracks, eight scenes, and 32 empty Launcher slots. Selection,
cursors, and pin states pass normal baseline verification. The original
`New 1` remains open and unsaved, with its engine active and transport stopped.
The owned B identity tab is closed with its changes discarded.

The original and restored rig configuration bytes are equal. Both have SHA-256
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.
Extension `check` and `copyExtension` pass. The experimental controller is fully
removed, and its exact archive is deleted. The final normal product is added as
a fresh instance with init time `2026-10-02T01:42:37.234Z`. Normal hello passes
all checks with `normal-v1`, 85 methods, and method hash `bba7383dce25c0f0`.

The followup manifest now retains 18 reports, including final cleanup,
cleanup verification, baseline verification, and three config records. Its
restoration claims pass. API baseline verification does not assert an identical
UI viewport: the arrangement now shows 7–15 instead of the original 14–22.
The seven owned project-package files are checked by exact paths and hashes,
then removed after the disposable tab closes. The source fixture preset remains
unchanged. All five artifact bundles verify. The final full brain check passes
1,688 tests. Context and diff checks pass.
8g remains active, with zero eligible cache results. Do not enter 8h.

A later full brain check runs 1,684 tests with one failed artifact test. The test
still expects seven files after the followup manifest grows to ten. Its expected
count now uses the manifest file keys. A subsequent 1,688-test run finds one
diagnostic test that assumes the accepted ordering report is absent. The test
now removes that role from its cloned fixture before checking diagnostic scope.
All 27 focused artifact tests and the final 1,688-test run pass. No commit is made.

Retrospective: specify the native action and its position effect. Select the
preceding scene for Add Scene before a target.
Do not attribute a compound action's combined fence to one operation.

Retrospective: check the active method table before fixture creation. Preserve a
terminal reply before its oracle assertion. Check current authority separately
from historical comparison labels. Use a distinct experimental catalog entry
when duplicate products load old classes. Check service registration as well as
the manifest. No repository instruction change is needed.

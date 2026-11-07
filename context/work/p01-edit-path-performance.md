# P01 — Edit-path performance and recovery cost

## Checkpoint — 2026-10-29

The normal-controller scope optimization passed live in
[E401](../evidence/experiments/e401-p01-scope-read-policy-live.md), following
the operator's actual reply “Controller replaced”. Six-device warm reads fell
from 1,056 to 621 ms; three far containers retain their scopes with zero warm
scrolls. Four far containers at 3/5/7/17 still need four scrolls per repeat.
Independent capability checks, empty/named-slot fixtures, retargeting,
cross-container transfer, scratch cleanup and preservation checks passed.
See E401 for the full measurements and their same-build comparison limits.

[E402](../evidence/experiments/e402-direct-chain-insertion-ordering.md)
records direct insertion of native, VST3, CLAP and preset sources at layer 5
and container 17, including six devices in that layer. Immediate same-task
multi-source calls did not consistently preserve submission order. Reversing
calls is not a general fix: the two early mismatches were inspected before
new cases, and the final bounded ordering study completed with scratch
removed and original inventories/selection preserved. The old unnamed seed
layer also adopted a device name; explicitly name chains before insertion.
This evidence does not yet authorize an ordered composition implementation.

[E403](../evidence/experiments/e403-ordered-direct-chain-insertion.md) now
proves ordered v2 insertion: native triples on empty chains, native appends,
a mixed native/VST3/CLAP/preset request on the sixth chain and a further append
all passed. Explicit names, unrelated structure, selection and page restoration
were preserved. The 235–404 ms receipts exclude final readback and are not
composition latency. Scratch was removed. The probe is research-only and
single-target; no product composition or multi-target batch claim follows yet.

[E404](../evidence/experiments/e404-structural-device-deletion.md) closes the
planned deletion snapshot reduction. A nonempty executor batch made entirely
of `device.delete` uses structural stash/final snapshots, including its partial
rejection path. Mixed batches retain scalar captures. Input/identity guards,
public removal summaries, final order readback and the non-recreation result
remain. The same-fixture comparison used 8 → 0 parameter-inventory calls and
84 → 61 wire calls; diagnostic times under concurrent offline-test load are
not stable bounds. Both scratch tracks were removed and preserved state passed.

## Reconciliation and parallel queues — 2026-11-07

The operator approved renumbering P01 evidence and continuing P01 in this
`mossy-larch` worktree while main proceeds with [B18](b18-content-event-window.md),
then [B19](b19-real-use-tooling-and-annotations.md). Main's queue is unchanged.
The operator committed this first reconciliation before completing B18 on
main. The B18 integration checkpoint below supersedes its queue status.

P01 evidence IDs changed only to avoid collisions with R01:

| Earlier P01 ID | Merged ID | Record |
|---|---|---|
| E358 | E400 | Offline composition cost attribution |
| E371 | E401 | Scope-read policy |
| E372 | E402 | Immediate insertion ordering failure |
| E373 | E403 | Ordered insertion with arrival waits |
| E374 | E404 | Structural deletion snapshots |

Citations also follow main's B08/B17 renumbering to E394–E398 and its
one-readback decision renumbering from D55 to D65. Record measurements and
raw evidence are unchanged; retained raw artifacts may use the earlier IDs.

Both research handlers are retained. The merged probe profile has 123 methods,
hash `f8f2b5ec8531c93d`; normal remains 93 / `d6decf985f6b1f36`, capture
98 / `50dcd3ceb7b6dd45`. Historical deployment receipts retain their original
counts and hashes. No merged archive has been deployed or checked in Bitwig.
R02's corrected pressure-verification explanation and descriptions v58 remain.
Typecheck, all 2,610 brain tests and the full offline extension check pass.
All 750 local link targets in the reconciliation documents resolve, and the
working-tree diff has no whitespace errors or remaining conflict markers.
The full context checker reports 80 inherited broken links in 12 documents
unchanged from a merge parent; none is in the reconciliation documents.

Parallel work has three coordination points:

- B18 changes revision marks/deltas and their consumers; P01 composition uses
  marks, executor reads and the live adapter. Preserve B18's identity/truncation
  semantics when reducing P01 reads, and rerun shared contract and call-budget
  tests after integration. Clip-metadata work has more overlap than direct
  chain insertion, so reconcile B18 before that later P01 step.
- Both worktrees deploy to the same extension archive and use the same Bitwig
  instance. Coordinate deployment and live-test windows; establish the intended
  extension/brain build and use one live writer at a time.
- Method inventories, public description versions, NOW/backlog summaries and
  E/D identifiers are shared. Coordinate new identifiers and regenerate combined
  inventories on integration rather than choosing either branch's totals.

## B18 integration — 2026-11-07

The operator completed the first merge, completed B18 on main, and initiated
this second merge. Its three conflicts are documentation-only: retain E405
alongside P01's E400–E404, keep both ledger contributions, and advance the main
queue to B19 while P01 continues here. Source changes merged without conflicts.
The operator retains staging and merge-commit control.

[B18](b18-content-event-window.md#result) is implemented and verified live in
[E405](../evidence/experiments/e405-b18-content-event-window-live.md). It removes
the earlier prerequisite for P01 read consolidation. The combined source uses
descriptions v59, normal wire 93 / `d6decf985f6b1f36` and probe wire
123 / `f8f2b5ec8531c93d`. E405 verifies main's B18 build; this worktree has not
deployed or live-verified the combined P01/B18 build.

The implemented contract to preserve during P01 is:

- `mark()` requests no event history. `contentSince(base)` sends
  `base.contentEpoch` and receives every event in `(since, now]`, or none if
  the 8,192-event ring cannot cover that interval.
- An empty event array alone does not mean no changes. The brain compares its
  length with the epoch difference, so missing history yields `truncated` and
  the existing `delta-incomplete` identity retirement/warning. Retain project and
  extension discontinuity handling as well.
- A successfully verified current read or check advances the ref's mark,
  restarting its window. Preserve this update when sharing snapshots; never
  refresh a ref just because a write was attempted or a plain mark was read.
- Redundant composition content proofs can still be removed under D65. Keep
  the needed base-to-final delta and final independent content receipt rather
  than treating a plain mark as a delta.

The combined tree passes typecheck, all 2,615 brain tests and the full offline
extension check. All 717 local link targets in the five reconciliation
documents resolve, and the working-tree diff has no whitespace errors or
remaining conflict markers. The full context checker still reports 80 inherited
broken links in 12 documents unchanged from a merge parent. No new live check
was run; E405 remains the evidence for B18 host behavior.

## Resume — product composition

Session cleanup is closed by the operator's 2026-11-07 report: “I replaced with
the normal ghostnote controller, but it might not be the one you deployed
earlier. No need to verify anything, if this was just final cleanup.” Other
worktrees have been used in the meantime. No handshake was run, and no claim
is made that the loaded controller contains this worktree's changes. The
[restoration record](../evidence/data/p01-chain-insert-live/normal-restoration/deployment.json)
remains historical deployment evidence. No replacement is pending for this
session; P01 itself remains in progress.

1. Have the operator finish staging and committing the B18 reconciliation.
   Offline composition work can then proceed without Bitwig. Before new live work,
   establish the intended extension and brain builds, run a fresh handshake,
   and refresh project, selection, target and client observations.
2. Continue the D65 composition implementation. Use the proved count-dependent
   direct insertion route; name seed chains explicitly before insertion.
   Validate every source and caller expectation before writes. Preserve
   target identity, selection and partial effects. A later source in the same
   chain depends on the preceding device's arrival; its count wait is not a
   content proof. Batch independent targets where the host permits.
3. Replace the composition engine's executor-per-stage pattern with a path
   that produces one final independent content receipt. Keep the current
   checkpoint/reversal promise until its implementation and descriptions are
   deliberately changed together. Existing move/copy sources and modulation
   witnesses still need their own correct receipts; do not silently route only
   native examples through a faster path while claiming the whole task done.
4. Extend fake/live conformance and call-budget tests, then deploy the normal
   product integration for focused composition/reversal measurements at D44's
   boundary. Do not reweight the six-unit limit from raw research receipts.
   Scalar-cohort and clip-metadata capture reductions remain later P01 work.

V2's implementation validates complete source syntax and scratch identities,
holds the scope/write lease through paging and restoration, and waits for
`initialDeviceCount + attempted` before each next setter. It returns an
unverified attempt receipt; independent inspection precedes acknowledgement.
A thrown partial write or missing intermediate landing latches uncertainty;
failed restoration blocks host writes. These research acknowledgements and
scratch-only admission are not a product contract. Native Grid research locks
and D52 admission remain unchanged.

At the pre-merge P01 checkpoint, all 81 focused executor/call-budget tests,
typecheck and extension checks passed. The full brain suite passed 2,608 of 2,609;
the 16,384-note planner took 4,162 ms against 4,000 ms under concurrent load,
then its entire three-test file passed alone. No timing threshold was changed.
New deletion regressions cover unsettled parameter observers, unchanged
non-reversal reporting, mixed scalar batches and all three public deletion
snapshots remaining structural. That checkpoint used descriptions v57 / 46 tools;
D44 limits are unchanged. A running brain server must load this worktree's
updated code to use the executor change.

## Scope and evidence

The [P01 assignment](../plan/overlap/wave-4/work-sessions.md#p01--edit-path-performance-and-recovery-cost)
covers T1 parameter inventories, T2 clip captures, useful T6 recovery
simplification, the container-scope policy, and staged composition under D65.
T5 history-retention research remains deferred. This pass changes scope acquisition and pure-deletion snapshot payloads,
and proves direct layer insertion. It retains writer guards and the advertised
`revert_change` result; composition, scalar and clip paths remain open.

[E400](../evidence/experiments/e400-p01-offline-cost-attribution.md) reproduces
the attribution of the retained E398 exchanges, including reply bytes and
overlapping request intervals. E247/E252/E254/E257 remain historical host
measurements; none is a timing claim for this worktree. The current adapter
budgets below come from the offline call-budget suite and source inspection.
An adapter read is not a wire request: it can capture a full clip or traverse
several paged banks.

## Call and obligation audit

| Route / step | Current work and purpose | Verdict |
|---|---|---|
| Scalar device edit: resolve and preflight | `device-controls.ts` groups by route, reads the complete top-level identity and one complete parameter/remote inventory per cohort, validates IDs/names/domains, and passes `parameterPreflight` into the executor. This read also supplies prior scalar values for reversal. | **Retain/share.** Already shared with the executor; removing it loses target and input validation, not just recovery. |
| Scalar device edit: adapter stages | `LiveAdapter.apply` reads two equal live-generation polls after intermediate direct-parameter stages, and a full settled inventory after the last. It compares unrelated parameters against the initial cohort. Remote writes have their own stage readback. | **Remove in the D65 follow-up.** Final executor verification can serve integrity and requested-value comparison. Preserve coupling verdicts and partial effects; do not simply delete checks while callers still stop based on their receipts. |
| Scalar device edit: executor/result | `Executor.runInside` reads target scalars plus the integrity device after applying a supplied cohort. The surface consumes that take. One-route fake budget: `devices=1, read=2, apply=1, delta=1`; the adapter's internal inventories are additional. Inventory payload scales with all P parameters, not just the K written controls. E252's one Diva control cost 3,447 ms on its historical build. | **Retain one final independent read**, shared with the result and scalar reversal. Cheap scalar inverse remains useful; no history-retention redesign. |
| Clip property edit: surface preflight | `setProperties` calls `readSlots` with occupancy and metadata, plans coupled range fields, and detects no-ops. In `LiveAdapter.read`, metadata comes from `readClipNotes`, which captures all channels even for a rename. | **Retain identity and metadata; narrow the payload after live proof.** Name/colour need no note-based planning; loop/range writes require their separate coupled-field tests. |
| Clip property edit: stash and verify | The executor separately reads metadata before and after `clip.update`. The write set contains metadata fields, not notes. Each metadata read currently captures the full clip. `readbackOf` normally reuses `take.verify`; it adds a read only when required entries are missing. Budget: `mark=1, tracks=1, read=3, resolve=1, apply=1, delta=1`. | **Share the first metadata snapshot; retain one independent final metadata read.** Normal changed-target path is three full captures by current source, not two. Captured note data is discarded from these metadata entries; this is payload overreach, not a useful complete recovery stash. The ledger's two-capture summary needs fresh host measurement before replacing its old timings. |
| Targeted note edit | The surface takes a fresh sourced snapshot, validates the agent's base and plans exact addressed notes. For targeted edits without `clip.update`, `snapshotPreflight` shares this with the executor; `verifySources` supplies the final receipt and collateral comparison. Budget: `mark=1, tracks=1, clipRead=2, delta=3, apply=1`. | **Retain/share.** Already two full captures, each serving a different requirement. Do not drop the final content comparison or broaden the note write. |
| Whole-clip/document property edit | `agent-native-edit.ts` withholds `snapshotPreflight` on whole-clip and `clip.update` paths, so fresh planning, stash and verify are separate captures. Budget: `mark=2, tracks=1, clipRead=3, delta=3, resolve=1, apply=1`. | **Share the planning capture in a later D65 change**, with stale-agent validation, project/scene identity and truthful readback intact. No need to preserve the old concurrent-human-edit scenario as a runtime design requirement. |
| Device/container deletion: public summary | The native wrapper reads structure to report removed layer chains; the stable removal path reads identity and enabled order. One-container budget: `read=3, devices=3, resolve=1, apply=1, delta=1`. | **Retain/share structure and identity.** The removal summary is a requested-result receipt, not a restoration promise. |
| Device/container deletion: executor snapshot | `write-set.ts` classifies `device.delete` as `restore: none`. Before this P01 change, in-window deletion snapshots acquired parameters; B17 fell back to structure only when parameter access was unreachable. E247 measured 116 wire calls / 3.1–3.3 s for its container fixture. | **Implemented and verified in E404.** Pure deletion batches use structure for stash and final snapshot; mixed batches retain full captures. Complete order guards and independent public readback remain, as does the truthful unrestored result. |
| Staged composition: initial read and source validation | `composeDevices` and `stableTop` inspect the top-level order. `stableTop` brackets `host.devices` with two empty snapshot marks; the live bank itself requires two equal full lists. Existing sources also need initial identity/state. | **Retain one initial validated input view; share it.** Later stage freshness marks and repeated full top-level proofs are D65 removal candidates. Keep caller `expectedDeviceOrder` validation. |
| Staged composition: stages and proofs | Insert seed, grow chains, rename, then insert each new source at top level and move it. Each executor run has its own preflight/readback, followed by `stableTop`, `exactEntries`, scalar fingerprints where reachable, and page/route checks where requested. E398 six chains: 103 `device.list`, 45 `chain.observe`, no `directparam.*`; 703 wire calls / 44.4 s. | **Replace after direct insertion proof.** Bypassing scalar inventories alone cannot fix this overflow fixture. Batch direct chain insertions, wait only for required objects, and read the final container once. Preserve correct partial effects and uncertainty when a write throws. |
| Staged composition: reversal | Checkpoints represent inserted sources, existing moves/copies, owned container and stage outcomes. `revert_change` uses them and guarded fingerprints. | **Retain the advertised promise until explicitly revised.** The new path needs a compatible receipt/checkpoint or a named public contract change; D54 does not silently retire it. Measure reversal as well as composition before lifting D44. |
| Container scope acquisition | Before this change, `read_devices` aims at every top-level device; `ContainerScopes.choose` repeatedly evicts the highest displaced scope. | **Skip/share, implemented below.** Keep track identity, settlement, lease exclusion, independent endpoints and read completeness. |

Source entry points: [composition engine](../../brain/src/engine/general-device-composition.ts),
[executor](../../brain/src/engine/executor.ts), [write set](../../brain/src/engine/write-set.ts),
[live adapter](../../brain/src/adapters/live/adapter.ts),
[device controls](../../brain/src/surface/device-controls.ts),
[clip properties](../../brain/src/surface/agent-native-clips.ts),
[document edits](../../brain/src/surface/agent-native-edit.ts), and
[call budgets](../../brain/src/surface/call-budget.test.ts).

## Scope-read implementation

- Top-level `device.list` subscribes to and returns `hasLayers`. The value
  participates in both the extension's repeated page snapshot and the brain's
  equal-bank settlement. Nested window readers do not access an unsubscribed
  capability.
- `read_devices` skips structure acquisition only for explicit `hasLayers:
  false` in a complete, identity-confirmed bank. True and missing values, or
  an incomplete bank, still use the scope. Older archives therefore
  retain the previous behavior. Coverage includes the observed absence of
  layers; a failed container read still makes coverage partial. Named-slot
  traversal and parameter acquisition are unchanged.
- Far misses choose the least recently used available scope, with highest-slot
  tie-breaking. Exact settled/requested targets and resting positions retain
  preference. Three far positions can remain settled across repeated reads;
  held endpoints cannot be evicted. The clamp retry and write lease stay.
- `rig.info.containerScopeStatus.policy` reports `container-scope-lru-v1`.
  Scope count/width remain three/one. No new handles; one additional subscribed
  boolean per top-level device-bank slot per cursor.
- Corrected the D44 source comments: normal-profile modulation sampling was
  already removed by D46. Limits and weights remain unchanged. Tool count,
  public descriptions and schemas stayed at 46 / v57 for the scope-only change;
  R02 advanced descriptions to v58 and B18 to v59. The normal method inventory remains
  93 / `d6decf985f6b1f36`.

Offline budgets: a modern all-plain track now needs `devices=1, read=0`;
a mixed track still needs `devices=1, read=1`, with only true/unknown positions
in that read. The 18-device regression scopes only position 17, versus all 18
with a legacy reply. The three-far-container harness makes three cold scrolls
and zero on the repeat pass. These are deterministic call/scroll counts,
not measured host latency savings.

Initial scope-only verification: TypeScript typecheck passed. Of 2,606 brain
tests in that full run, 2,601 passed in the sandbox and the five local TCP client tests passed
when rerun with loopback access (the sandbox denied their listeners). All 48
focused device/call-budget tests pass after adding the final incomplete-bank
regression. The extension's offline
`check` passes, including all archive/profile checks, the LRU/clamp/lease
regressions and actual device-window capability settlement. The subsequent focused host check passed in E401.
The 505 local links in changed Markdown files pass, as does `git diff --check`.
The full context checker reports 60 pre-existing missing-reference links in
unchanged documents; none was introduced here. The E400 summary reproduces
byte-for-byte from its retained inputs.

## Remaining P01 work

The scope-read policy is verified; scope count/width remain unchanged because
three handles retain the common three-container working set. Four-container
cycling is measured in E401 and remains a possible later tradeoff, not an
unmeasured allocation change. Ordered direct insertion and deletion snapshot narrowing are verified in
E403/E404. The D65 composition rewrite, scalar cohort consolidation,
metadata-only clip reads and D44 reweighting remain open in this same P01 item.

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

## D65 composition design — 2026-11-07

The operator committed the B18 reconciliation (`76120985`), so step 1 above is
done. This session implements steps 2–4 offline.

**Product route.** A new normal-profile write `chain.insert` replaces the
research `probe.chainInsert` for product use. It addresses one top-level
container by absolute position, finds one layer chain by its exact unique
name, checks the chain's current device count, and inserts 1–8 ordered
native/VST3/CLAP/preset sources at the chain end. Before each later source it
waits for the preceding device count (E403); after the last source it waits
for the final count, so the next stage can address the chain. Waiting is not
a content proof. It validates the whole request, track, container name and an
optional complete top-level order guard before the first setter. A failure
after a setter reports possible effects; the brain does not repeat it. The
probe's scratch gate and acknowledge latch do not carry over; restore failure
still blocks writes. The contract op is `chain.insert` with the same fields;
both adapters implement it, and the conformance suite covers it.

**Composition stages.** Validate the request (pure), insert the container,
position it if needed, read the seed structure once (its names come from the
preset and must be known before renaming), grow and rename chains, then
process each entry's devices in order. Consecutive new sources become one
`chain.insert`; existing move/copy sources keep `chain.relocate` with a
projected top-level guard. No stage re-reads the top level, inventories,
fingerprints or container structure. One final container structure read
supplies observed names, the checkpoint and the result; modulation page and
route witnesses run once after it. The engine no longer repeats the
surface's initial bank read: the container insertion's own adapter guard
validates `expectedDeviceOrder`.

**Reversal.** The advertised promise is unchanged: `revert_change` restores
moved existing devices and removes only the owned container and owned
sources. The implementation reads the top level and container once, checks
them against the checkpoint, extracts moved existing devices and restores
their positions, then deletes the owned container with its new and copied
sources in one owned removal. Checkpoints are session-local, but the frozen
`stable-v1` reversal tool validates the schema 5 shape, so schema 5 is kept:
`completedEntries` now lists every device the final read observed, and with
`preparedEntryNames` it is the structure that reversal checks.

## D65 composition result — offline, 2026-11-07

Implemented offline; the live result below verifies it (E406).

- **Wire.** Normal-profile write `chain.insert` (`ChainInsertHandlers`,
  marker `chain-insert-v1`, hello field `chainInsertRoute`). Each count wait,
  including the final one, has a 10 s budget at 5 ms polls; a count above
  the expected one refuses at once, a lower one waits out the budget. Each
  poll also re-checks the held chain row's identity, which the probe did
  not. Inventories: normal 94 / `526cd7e3760580cc`, capture
  99 / `4e3c20f1c3db8cba`, probe 124 / `a8dfbfce3d47f16f`, historical 183.
- **Contract and adapters.** Op `chain.insert` (1–8 sources, validated
  before any host call; top-level container only; paged like
  `chain.relocate`). It is unrevertable as a lone take; composition reversal
  owns its removal. The live adapter points cursor 0 at the track, adds no
  settle wait or track rescan, and drops only a held device target. The fake
  names native devices from the bundled catalog, as the host does.
  Conformance `C-chain-insert` covers order, append, stale count, absent
  chain and whole-request refusal.
- **Engine.** As designed above. Consecutive new sources share one batch
  (one `chain.insert` per chain); a thrown write is never repeated, and the
  final read reports what landed with `effectsPossible`. A device the final
  read cannot attribute to the request is not claimed, so reversal refuses
  instead of removing it. An untouched seed is adopted if the composition
  stopped before reading its names. The agent-native surface passes
  `orderValidated` because it has just read the bank; `stable-v1` callers keep
  one engine read, so a stale order still refuses before any write.
- **Budgets** (offline, `D65 call budget`): compose 1×1 and 3×2 both make
  devices 1, read 6, apply 3, delta 3 and two container structure reads.
  Reversal of new sources: devices 2, structure read 3, resolve 1, apply 1,
  delta 1. The per-stage top-level reads, inventories and fingerprints are
  gone; the result no longer has `scalarFingerprint`.
- **Public text.** Descriptions v60 describe the route and drop the retired
  per-device timings. D44 weights and limits are unchanged until live
  measurement.

Verification: typecheck; all brain tests (2,618 after the budget test) and
`./gradlew check` pass. Tests that pinned retired mechanisms (pending
checkpoints, per-stage fingerprints, copy extraction, ≥4 container proofs)
were rewritten to the new behavior.

## D65 composition result — live, 2026-11-07

[E406](../evidence/experiments/e406-d65-direct-composition-live.md) verifies
the normal build (94 / `526cd7e3760580cc`) after the operator's second
“Controller replaced”; the first replacement loaded the older build because
deployment had not yet run, and its handshake stopped before any write. All
six cases composed, read back independently and reverted exactly: 1×1
2.6 s, 3×2 4.3 s, mixed six-unit plug-in/preset 2.8 s, modulated 3.9 s,
existing move + copy 5.6 s, six chains at position 18 13.7 s (E398:
44.4 s). Reverts took 1.5–2.8 s. Cleanup and preservation passed. Two
driver-input stops are recorded in E406; the second left one verified
composition, which was inspected and removed with its owned scratch track.

**D44.** Every admitted shape is far under 30 s, but no larger shape was
measured, so the six-unit limit and weights stay. Raising them needs a
measurement at the proposed limit (for example 12–16 native devices, and
plug-ins) and its revert.

**Next.** Done in the adapter check result above.

## Adapter check result — live, 2026-11-07

[E407](../evidence/experiments/e407-p01-adapter-checks-and-d44-live.md)
verifies items 1–4 of the design below; item 5 stays deferred, as planned.

- **Renames (item 1).** `planStages` puts consecutive `chain.rename` ops in
  one stage, starting a new stage only when an op renames a name an earlier
  rename in the stage produced (the clash pattern). The live adapter resolves
  each chain ID from one container reading (the preflight reading on the
  first stage), sends all renames in one `batch.run`, and then waits once
  for every new name (`finishChainRenames`; a dependency wait, because the
  next stage addresses chains by name). Reply entries map to ops by
  position, so the engine attributes partial rename proofs per op.
- **Growth (item 2).** The engine sends every growth `chain.create` in one
  apply, each copied from the previous copy. The adapter reuses the
  preflight reading for the first copy, the settle poll's reading for the
  mint diff, and each copy's post-rename reading as the next copy's
  "before". The post-rename reading stays: the next stage addresses the copy
  by name. A live multi-copy ordering proof was not needed; E407's 16-chain
  case read every chain back in order.
- **Insertions (item 3).** A `chain.insert` stage no longer advances the
  structural revision, and a successful one records cursor 0's track hold.
  The extension's one-scope-aim-per-chain change was not made.
- **Results.** Six chains at position 18: 8.8 s / 105 turns (13.7 s / 133);
  renames 1.9 s (4.8 s); insertions 2.1 s without re-points. Growth copies
  still cost about 1.6–1.85 s each.
- **D44 → D67.** Candidate shapes and their reverts are in E407. Units no
  longer drive the cost; chain growth and existing sources do. [D67](../decisions/d67-composition-limits-follow-chains-and-existing-sources.md)
  sets 8 layer chains and 16 units (existing sources 2); worst measured
  case 25.6 s (8 existing sources at position 18), revert 13.7 s. The
  benchmark-only `measurementLimits` option of `composeDevices` admits the
  candidate shapes for [`p01-d44-live.ts`](../../brain/src/probes/p01-d44-live.ts).
  Descriptions v61.
- **Container insertion (item 4).** A guarded `device.insert` (both top-level
  guards present, as every product caller sends) reads nothing before its
  write: the extension pages the complete live chain and refuses a
  mismatch, so the stated chain is the mint diff's "before". The mint check
  reuses the settle poll's second equal reading; a refused guarded insertion
  skips the settle poll. `add_devices` projects the chain after each native
  device instead of reading the bank. 16 native devices: 9.1 s (18.7–19.0 s);
  six chains at 18: 7.8 s. The writer-clip releases stay (about 70 ms per
  structural stage): physical pin state is not tracked across calls, and a
  pinned clip ignores later selection changes (E2, E3).
- **Layer tools.** `rename_layer_chain` 970 ms with 4 container readings
  (was 5); `duplicate_layer_chain` 1,443 ms; both verified. Their offline
  budgets are unchanged.

**Next.**

1. **Relocation readings.** Done; see the relocation result below.
2. **Larger seed.** Done; see the named-seed result below (E409, D68).
3. Scalar-cohort and clip-metadata capture reductions.

## Relocation result — live, 2026-11-07

[E408](../evidence/experiments/e408-p01-shared-relocation-readings-live.md)
verifies item 1 above.

- **Adapter.** `assertRelocationsPreflight` returns its readings, which
  serve the first relocation stage; `finishRelocation` returns its proving
  readings, which serve the next stage's "before" reading. Readings are kept
  by track identity and container address (`RelocationReadings`); only an
  endpoint they lack is read. A refused or unproved relocation ends the
  batch, because later relocations were projected from it; this also
  affects multi-device `move_devices` and `copy_devices`.
- **Engine.** Consecutive existing sources share one apply, projected from
  the stages before each; the first unproved stage ends the proved run.
- **Results.** 8 existing sources at 18: 17.0 s / 219 turns (25.6 s / 331),
  24 container readings (36); revert 12.0 s (13.7 s). The E406 cases are
  unchanged within 0.15 s. D67's limits are unchanged; an existing-source
  weight of 1 would need a 16-existing measurement.
- **Not changed.** Reversal still extracts and restores each moved device in
  its own apply (about 1.4 s each in the eight-existing revert). A thrown
  error mid-batch loses attribution of the batch's earlier transfers, as for
  new-source batches; reversal then refuses rather than removing them.

Next: item 2 (larger seed), then item 3. Batching reversal's
extract/restore pairs is a possible later reduction.

## Named-seed result — live, 2026-11-07

[E409](../evidence/experiments/e409-p01-named-sixteen-chain-seed-live.md)
completes item 2 above, with the operator's addition: the preset also carries
the requested chain names.

- **Seed.** The operator saved 16-chain empty Instrument Layer and FX Layer
  presets and a three-chain named control in Bitwig 6.1.4. The 16-chain
  seeds replace the five-chain seeds (constants and manifest); the control
  locates the displayed-name field (`0x08df`) and is a byte-comparison
  fixture.
- **Composition.** The seed is trimmed to the request's width and carries
  the requested names. No chain is grown or renamed live; the rename stages
  run only for a name with a lone surrogate. The growth stage is removed.
- **Results.** 16×1 at position 18: 10.9 s / 74 turns (E407: 38.1 s); 8×2 at
  18: 5.8 s (13.2 s); reverts 1.6–3.5 s. Bitwig shows preset-written names
  exactly. [E410](../evidence/experiments/e410-p01-unicode-chain-names-in-the-seed.md):
  Bitwig stores non-ASCII names as UTF-16, which bwmod now reads and writes;
  four Unicode names, a surrogate pair included, composed in 2.1 s without a
  rename and read back exactly.
- **D68.** The layer-chain limit is 16, the seed width; descriptions v62.
  All 2,654 brain tests pass; wire unchanged.

**Next.**

1. Scalar-cohort reductions: done; see the scalar-cohort result below.
   Clip-metadata capture reductions remain (item 3 above).
2. Possible later reductions: one extension call for the insertions of
   several chains (each chain is now one 0.4–0.5 s `chain.insert` turn at
   position 18), and batching reversal's extract/restore pairs.

## Scalar-cohort result — live, 2026-11-07

[E411](../evidence/experiments/e411-p01-one-turn-scalar-cohorts-live.md)
applies D65 to `set_device_controls` and `set_track_mixer`.

- **One turn per route.** A same-route cohort with a supplied preflight is
  one `batch.run` (`applySuppliedParameterCohort`), with one receipt per op
  from the extension's own result. The per-write completion read, the
  cohort integrity polls and the adapter's settled inventory after the last
  write are removed; the executor readback already compares the requested
  values and every unrequested DirectParameter with the preflight. The
  adapter no longer reads the chain before the write: every frame states it
  and the extension checks it. One selection scope covers the tool call, so
  the write and the readback reuse the preflight's cursor target.
- **Behavior change.** A setting that Bitwig refuses no longer stops the
  later settings of its route (each frame carries its own guard); an
  unrequested change still stops later routes. Descriptions v63.
- **Results.** A native route of 1, 8 or 44 Polysynth controls takes
  1.33–1.35 s / 34 calls (same-session HEAD: 2.2 / 3.4 / 9.4 s); 64 remote
  controls 1.24 s (4.66 s); 8 nested EQ-5 controls 1.44 s (3.57 s).
- **Mixer.** Already one read (the stash), one stage and one readback; a
  mixer-only batch now skips the selection capture: 216 ms (238 ms).
- **Not changed.** The scalar path without a supplied preflight
  (`revert_change`, managed FX chains) keeps its per-stage proofs; a
  one-control revert takes 2.7 s.
- **Limits (D69).** [E412](../evidence/experiments/e412-p01-device-control-limits-live.md)
  remeasured with Diva: a route costs 2.3 s for 64 or 281 settings; 12
  routes took 26.8 s and 16 took 36.4 s. D69 replaces D44's row: 256
  settings on 12 routes (was 64 on 4).

**Next.**

1. Metadata-only clip reads (clip property edits).
2. Possibly: skip the empty-slot descent in a top-level control route's
   inventories (about 0.4 s of each Diva inventory, E412).
3. Possibly: the scalar revert path under D65 (one turn and the executor's
   collateral comparison), and sharing the surface's bank read with the
   preflight read (about 0.24 s per route).

## Next session — adapter per-operation checks and the D44 measurement

Design note, written before the commit of the D65 composition work. Items
1–4 and the D44 measurement are done (result above); item 5 stays deferred.

### Where the six-chain composition spends 13.7 s

From the E406 attempt 3 call sequence (`six-at-18-compose`), approximately:

| Part | Time | Calls |
|---|---:|---|
| Container insertion | 1.6 s | 5 `device.list` before the write (surface bank read, adapter preflight, stage bracket) and 4 after it (`settleStructure` polls); 8 writer-clip `cursor.pin` releases and track rescans, because `device.insert` is in `STRUCTURAL` |
| Seed read | 0.2 s | 1 `chain.observe` (engine; needed for the seed names) |
| Sixth-chain growth | 1.8 s | 2 `chain.observe` preflight, `chain.select`, `chain.duplicate`, 3 `chain.observe` polls for the new chain, the copy's `chain.setName`, 1 proof `chain.observe` |
| Six renames | 4.8 s | per rename: 2 `chain.observe` (≈ 0.57 s) and one `batch.run` of one `chain.setName` (≈ 0.17 s); one final proof read |
| Six chain insertions | 2.5 s | one `batch.run` per chain (≈ 0.36 s, mostly the extension's scope aim at 18) plus a cursor re-point each |
| Final read | 0.3 s | 1 `chain.observe` (engine; the result and checkpoint) |
| Executor and brain overhead | ≈ 2.9 s | stash/verify marks and deltas for 5 applies (`revision.get` + `track.list` pairs, ≈ 1.2 s) and brain-side gaps (1.7 s) |

### Classification under D65

Keep (input validation and target identity, D65 rule 6): the top-level order
guards, the extension's container/chain identity checks at the write, the
rename's free-name and unique-source preconditions, D52, selection
protection, and one independent readback at the end of each tool.

Remove or share (mid-operation proofs and repeated reads, D65 rules 1–2):

1. **Renames.** The live rename stage reads the container before each
   `chain.setName` and again afterwards as proof (`chain.rename` handling in
   `LiveAdapter.applyInside` and its post-stage `named` check). Plan: read the
   container once in the batch preflight (`readContainers` already does),
   resolve every chain ID from that read, and send all renames of one
   container in one `batch.run`. Channel IDs survive renames, so one read also
   serves the clash case's two passes. `chain.rename` is a `trackStruct`
   stage today; sending several `chain.setName` frames in one turn needs a
   short live proof (each name lands, no ID drift) before it ships.
   Expected: about 4 s of the six-chain case.
2. **Chain growth.** Keep a wait for the new chain, because the rename after
   it addresses that chain (D65 rule 2 permits a dependency wait). Drop the
   separate proof read after the copy's rename. Consider growing several
   chains in one stage only with a live ordering proof.
3. **Chain insertions.** Stop bumping `structuralRevision` after a
   `chain.insert` stage: it invalidates cursor 0's held track, so every
   insertion re-points the cursor (about 50 ms each); dropping
   `heldDeviceTarget` is enough. Optionally let one `chain.insert` address
   several chains of one container in a single scope aim (about 0.3 s per
   chain), which needs an extension change and a multi-target live proof;
   E403 proved one chain per request only.
4. **Container insertion.** The pre-write `device.list` reads repeat the
   surface's bank read; the post-write polls wait for the container (a
   permitted dependency wait, but the engine's seed read already waits for
   it). The writer-clip release applies to every `STRUCTURAL` op; a device
   insertion holds no writer clip, so releasing only held clips is a
   candidate. This is shared by `add_devices` and other device writes, so
   measure those tools before and after.
5. **Executor overhead.** Each apply pays its stash mark, verify mark and
   delta. Merging the rename and insertion applies would save about 0.5 s
   but couples their failure reporting; defer unless the above leaves it
   significant.

### Shared-code impact

The rename and growth paths are also `rename_layer_chain` and
`duplicate_layer_chain` (offline budgets: read 4, apply 1, delta 1). Those
tools must keep one final independent readback (D65 rule 2) after the
adapter proof goes; check that their executor verify read or surface
readback already provides it, and update their call budgets, the ledger and,
if public behavior or timing text changes, the descriptions together.
Conformance cases `C-chain-create` and `C-chain-rename` keep their
semantics.

### Verification

Offline: call-budget updates for `compose_devices`, `rename_layer_chain`,
`duplicate_layer_chain` and `add_devices`; all brain tests and
`./gradlew check`. Live, after deployment and controller replacement: rerun
`p01-compose-live.ts` against E406 and the affected layer-chain tools, with
the usual cleanup and preservation checks.

### D44 measurement

After the adapter changes, measure each candidate shape and its revert with
the same driver: 12 and 16 native devices (for example 4×3 and 4×4, and 16
chains of one at a far position), a plug-in-heavy request at the candidate
unit count, and the modulator limit (4 modulators). Set the unit limit and
weights from the slowest admitted case and its revert against the 30 s plan
budget, record the measurements in an E record, and change the limit, its
schema text, the ledger and the descriptions together.

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
| Scalar device edit: adapter stages | `LiveAdapter.apply` reads two equal live-generation polls after intermediate direct-parameter stages, and a full settled inventory after the last. It compares unrelated parameters against the initial cohort. Remote writes have their own stage readback. | **Removed for supplied cohorts (E411).** One write turn per route; the executor readback reports requested values and unrequested changes, and an unrequested change still stops later routes. The path without a supplied preflight keeps its stage proofs. |
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
E403/E404. The D65 composition rewrite (E406), the adapter check
reductions, guarded insertions and the D67 reweighting (E407) are done.
Shared relocation readings are verified in E408, and the named 16-chain
seed with the D68 chain limit in E409, and one-turn scalar cohorts in E411.
Metadata-only clip reads remain open in this same P01 item.

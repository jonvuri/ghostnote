---
title: E222 — Slot delivery and the occupancy window
kind: evidence
state: active
updated: 2026-10-03
owner: phase-8g5b
---

# E222 — Slot delivery and the occupancy window

## Status

[8g5b](../../plan/phase-8/8g5b-slot-inventory-delivery.md) is complete.
Live occupancy publication passes through a confirmed slot-delta window. The
user accepted [D28](../../decisions/d28-slot-occupancy-delivery-is-a-named-assumption.md)
after the measurements. Clip identity is never inferred from equal occupancy.
All cache results keep `complete:false` and `eligible:false`. Do not enter 8h.
Entry HEAD is `8e907e0`. The entry index and worktree were clean.

## Result

| Question | Result |
|---|---|
| Missed occupancy delivery | 0 in 153 E222 runs, 14 cache controls, and 50 cache detours. |
| Same-callback P→Q→P detours | 93 of 100 delivered no slot callback and ended on P occupancy. 7 delivered 8 callbacks each. |
| Foreign occupancy | 0 foreign ticks in all detours. 0 foreign slots in 45 admitted cache detours. |
| Same-callback delete and recreate | 20 of 20 delivered no callback. 10 of 10 witness runs replaced a named clip with one note by an empty unnamed clip. |
| Equal occupancy across projects | Row 0 is occupied in P and Q. It received no callback in 123 project switches. |
| Native and API controls | 14 of 14 published lists equal the settled scan and the declaration. |
| Group tracks | A group track's own slots mirror its child occupancy. They are excluded from clip inventory. |

Occupancy coalesces like a value observer. A change that returns to the same
value inside one host update delivers nothing, and the delivered state is still
correct for occupancy. Identity does not have this property. A delete and
recreate at one slot, or a project switch with equal occupancy, changes the
clip with no callback. Thus occupancy claims and identity claims stay separate.

## Implementation

`SlotDeltaWindow`
holds the init nonce, the delivered identity epoch, a structure-callback count,
and a slot-callback count. The live source reads the existing `Rig` counter of
`addHasContentObserver` callbacks on the flat `ALL_CHANNELS` bank. Structure
callbacks are the 8g5a topology sequence plus scene count changes. The counters
make no host reads.

`ShadowCacheProbe`
opens the window before the first slot read. After the final slot read, the read
callback schedules a zero-delay confirmation. Under D27 it runs after the rest
of the batch. A later poll admits occupancy only if the read is confirmed and
the value is unchanged. Any slot or structure callback before or after
confirmation refuses with `slot-window-changed` and discards the publication.
Recovery needs an explicit new rebuild. The new `inventoryList` operation
returns confirmed rows with `clipIdentityClaimed:false`. Each rebuild mints new
references. A reference is never reused because occupancy is equal.

Coverage refuses unless the flat filter is `ALL_CHANNELS`, the bank is not
scrolled, the track count is at most the 16-track topology limit, and the scene
count is inside the configured 128 scenes. Without a slot source, the 8g2
refusal `inventory-outside-step-coverage` remains. The deliberate build marker
is `8g5b-slot-window-v1`.

### Resource cost

The source adds no host handles. The rig already allocates 256 indexed
`hasContent` observers over 32,768 slot handles in every profile. The research
probe adds one 4×8 recorder bank with four observers. Admission covers
16 tracks × 128 scenes. It adds zero StepData observers. Heap is unmeasured.
8g5c must add this domain to the resource ledger and raise the track limit.

## Method

The `ghostnote 8g controls` build was deployed with archive SHA-256
`444d3a2e…1bd45` and research config `9d8350a9…0cc5`. The operator confirmed
replacement. Research hello passed with 97 methods, hash `f03f19414f40e3d3`,
fresh init `2026-10-03T08:58:07.362Z`, and both markers.

The operator created two unsaved fixture tabs while New 3 stayed dirty.
P is `New 6`; its Inst 1 has clips in rows 0–2. Q is `New 7`; its Inst 1 has
clips in rows 0, 4, and 5. Row 0 is equal by occupancy and different by clip.
`DeliveryCoherenceProbe` records `hasContent` callbacks in the same sequence as
ticks, confirmations, and commands. Each tick records a 4×8 occupancy signature
and schedules a confirmation. The driver uses the E216 project actions.

A tick is foreign when its occupancy differs from every declared state of the
project that its delivered name names. Each foreign tick must have a changed
slot count at its confirmation. A recorded occupancy change without a slot
callback is a missed delivery and stops the run.

The cache trials compare each published list with an independent settled scan.
The scan reads `slot.status` for every flat track and scene twice until equal.
Native trials also have a declaration that is written before the state read.
It is applied to the prior scan by track UUID.

## Trials

[Trial 1](../data/phase8g5b-slot/e222-trial-1-analyzer-diagnostic.json) stopped
at the first separate create/delete run. The row-6 clip was real current state
for 150 ms. The analyzer counted it as foreign. This was an analyzer defect,
not a host result. With the declared intermediate state, the retained run has
zero violations. Its other 143 runs also have zero missed or admitted foreign
ticks. In that trial, 17 of 20 recreates were silent and 3 delivered one
false/true pair.

[Trial 2](../data/phase8g5b-slot/e222-trial-2.json) passed every arm:

| Arm | Runs | Slot callbacks | Result |
|---|---|---|---|
| Single switch and return | 3 | 8 each | All seen |
| Same-callback detour | 100 | 0 in 93; 8 in 7 | All end on P |
| Separate-callback detour | 20 | 8 each | All seen |
| Same-callback recreate, row 1 | 20 | 0 in 20 | Occupancy unchanged |
| Separate create then delete, row 6 | 10 | 2 each | Both changes delivered |

The [recreate witness](../data/phase8g5b-slot/e222-recreate-witness.json) named
the row-1 clip and wrote one note before each run. After the same-callback
recreate, all ten clips were empty and unnamed. No run had a row-1 callback.

[Cache detours](../data/phase8g5b-slot/cache-detours.json) ran 25 detours during
publication and 25 after it. 45 lists were admitted and equal P. Five were
refused by root callbacks (`callback:masterChannelId`): four during publication
and one after it.

The [controls](../data/phase8g5b-slot/artifacts.json) start with an armed P list.
Each control checks that the retained list is refused, then compares a new
confirmed list with the scan and the declaration:

| Control | Retirement |
|---|---|
| Native create, delete, duplicate, and drag move | `slot-window-changed` |
| Native scene insert and scene delete | `slot-window-changed` |
| Native switch to Q and back to P | Root identity callback |
| Native group and ungroup | `group-topology-changed` |
| Native collapse and expand | `callback:chainWitness.trackCount` |
| API delete in a collapsed child, API move | `slot-window-changed` |

Insert Scene with scene 2 selected inserted the new scene after it, at scene 3.
The operator reported this before the state read. The first declaration is
retained as superseded. With Group 1 collapsed, the hidden child's clips were
published, and its deletion delivered a slot callback.

## Limits

- Unseen detours deliver nothing. E216 showed that the commands apply in order,
  but this experiment does not prove that Q became current inside them.
- Commands and observers share one controller process. No host fence is proved.
- Native input covers one human gesture per trial. One host version is measured.
- The admitted scope is 16 flat tracks and 128 scenes. 8g5c must raise it.
- Collapsed-child clip rebinding still refuses (E221). Occupancy does not depend on it.

## Cleanup and verification

New 6 and New 7 were closed without saving. Only New 3 remains open, dirty,
and unsaved. The exact config bytes were restored (`256bbf07…43b0`). The operator
loaded normal ghostnote. Normal hello passed with 85 methods, hash
`bba7383dce25c0f0`, and fresh init `2026-10-03T09:22:01.778Z`. The
[final baseline](../data/phase8g5b-slot/new3-final-baseline.json) matches the
adopted New 3 state, reader, metadata, and empty-note reads. The research archive
was removed after its hash matched. The deployed normal archive was built before
the D28 label change in the research diagnostic. That change does not affect the
normal profile.

Run `node --import tsx src/probes/phase8g5b-slot-artifacts.ts` from `brain/`.
It checks 40 pinned hashes and recomputes every summary from raw traces and
scans. Brain tests also refuse foreign, surviving, misdeclared, and identity-claiming
check mutants.

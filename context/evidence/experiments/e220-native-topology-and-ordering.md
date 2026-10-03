---
title: E220 — Native topology and acquisition ordering
kind: evidence
state: active
updated: 2026-10-03
owner: phase-8g4
---

# E220 — Native topology and acquisition ordering

## Status

[8g4](../../plan/phase-8/8g4-native-topology-and-ordering.md) is complete with
six accepted native ordering trials and one explicit unsupported group case.
Exact fixture cleanup, final normal reload, and the original API baseline
check pass. Hand off to 8g5. All cache results keep `complete:false` and
`eligible:false`. Group paths remain unsupported. Do not enter 8h.

Entry HEAD is `716ffea`. The entry index and worktree were clean. The prior NOW
note about staged 8g3 work was stale. No commit is made.

## Transition map

The [manifest](../data/phase8g4-native/manifest.json) pins the unchanged followup
manifest by SHA-256. Its verifier runs the existing semantic checks for all
18 reports. These controls need no repeat. Each denominator stays separate.

| Transition | Retained result or current limit |
| --- | --- |
| Clip duplicate, move, replace, delete, recreate | Five earlier structural fences with fresh recovery |
| Scene append and delete after, before, or at the target | Four earlier structural fences with fresh recovery |
| Track insert/delete before, duplicate, delete copy, delete observed | Five earlier structural fences with fresh recovery |
| Structure during private inventory | Three earlier interrupted attempts |
| Native Group then Ungroup | One earlier case; descendant membership was unproved |
| Native isolated Add Scene | One earlier case and one declared action |
| Native Add Scene then Move | One earlier compound case and two declared actions |
| Native velocity edit | One earlier edit and a separate warm observation; retained R2 still rejects mismatches |
| Earlier native B overlap | One bounded trial; A after retirement adds no trial |
| Ambiguous equal-content move or incomplete event window | New model checks retire old identity and mint on rebuild |
| Expanded/collapsed/nested groups and child order | Model oracle passes. Native child banks refuse at the first group; later arms stop |
| Membership, authority, settlement, enrichment, result boundaries | Five new accepted native commands, each inside active acquisition |
| Return transition during a new acquisition | One separate accepted command and acquisition ID |

An exact move requires ordered empty-fill proof, known empty destination,
complete event window, fresh authority fingerprint, and a current clean
snapshot. Occupied destinations and equal content alone cannot admit repair.
Unknown structure retires the old reference before rebuild.

## Topology control and native unsupported result

`ShadowTopologyControl` uses API 25 direct child banks and a separate root bank.
The local official API source says `hasFlatTrackList:false` exposes direct
children. Each bank uses `TOP_LEVEL_CHANNELS`. A bounded `ALL_CHANNELS` census
checks completeness; it cannot supply the parent-child oracle.

The scope has at most 16 flat tracks. Each UUID must occur once as a root or a
child. Each group needs a bank. Unknown children, duplicate parents, cycles,
overflow, scroll offsets, source errors, and changed reads refuse. Two reads
must agree within one callback sequence. Membership callbacks retire cache
state without a host read or command. Unknown membership blocks acquisition.
Recovery requires fresh topology and a new binding.

The control allocates at most 17 banks and 272 track handles. It adds no
StepData observer. Host memory and Java heap are unmeasured. The 8g3 resource
ledger makes no new measured memory claim for these handles. Wrapper deletion
stays unavailable, including after a complete membership read.

The native fixture is unsaved `New 11`. Cmd+G wraps only `Inst 1` and `Audio 2`.
The new wrapper UUID is `c70ce0b3-1998-48c7-aff0-39239e5af485`. Its child bank
returns both selected children and the wrapper itself. The independent graph
check refuses with `topology-child-address`. Membership and coherence are
false. Cache status is retired with `group-topology-unproved` and no payload.
Expanded/collapsed/nested membership and child order are not proved live.
The stopping rule ends those arms. The verifier does not remove the wrapper
from the graph to produce a passing claim.

Native Cmd+Shift+G restores the exact four ordered UUIDs, names, positions,
and types. Fresh snapshot and authority values match all 64 notes, all 16
channels, all acquired fields, and clip metadata. FX and Master stay unchanged
through the group arm. Eight scene rows stay equal. No API deletes the wrapper.
This is one unsupported membership case with two successful native actions.
One earlier Ungroup shortcut had no observed effect while a popup was open.
That command attempt stays diagnostic and adds no successful action.

The first note-reader preparation expected the flat track position of 1.
The native cursor reported the child position of 0. Its poll expired. A separate
reader diagnostic retains this failure. The current cursor still names the
known clip and all-channel reads match its seed. The helper now saves topology
before reader preparation and refuses to retarget through unsupported topology.

## Native ordering

`compareStatus` reads progress without advancing acquisition or publishing
notes. It checks guard, step window, binding, metadata, and deadlines. Each
acquisition has a distinct ID. The driver prepares and samples in one process.
A 35 s sampler holds one named publication boundary. The scan deadline stays
40 s. Enrichment and result candidates retain the 5 s deadline.

Two owned unsaved projects have distinct seed values: `New 11` uses pitches
60–63; `New 12` uses 72–75. Each target and canary has four notes per channel
on all 16 channels. Cells are 0, 8, 16, and 24. Duration is eight 1/512 cells.
Velocity is `(80 + channel) / 127`. Reports retain raw independent note reads.

| Boundary and direction | Acquisition | Command UTC interval | Samples |
| --- | --- | --- | --- |
| Membership, New 11 → New 12 | 5 | 03:19:09.720–09.783 | 267 |
| Partial authority, New 11 → New 12 | 8 | 03:21:28.030–28.094 | 266 |
| Settlement, New 11 → New 12 | 11 | 03:23:46.972–47.046 | 261 |
| Partial enrichment, New 11 → New 12 | 14 | 03:26:37.398–37.473 | 262 |
| Result, New 11 → New 12 | 17 | 03:29:17.086–17.155 | 262 |
| Separate return, New 12 → New 11 | 20 | 03:31:10.870–10.897 | 261 |

Each command starts after a recent completed active sample and ends before the
first terminal sample starts. All six terminate with `window-changed`. Each
has zero sample errors, gaps over 750 ms, and trace drops. Current track reads
independently observe the target. No current or historical note payload occurs
in the sampled replies. Recovery acquires fresh authority and checks all fields,
metadata, ordered tracks, and eight scenes against the source fixture.

The first membership command ran 0.421 s after its 25 s sampler ended. Its
206 samples show no target and no terminal outcome. It remains a separate late
command diagnostic, acquisition 2. It adds no accepted overlap. The repeat
extends only the sampler duration. Partial enrichment uses the deterministic
one-coordinate cap; the result arm uses 64 coordinates. These controls grant
no claim about callback origin, host input order, or missing-event continuity.
Zero trace drops do not prove zero host loss. The earlier B trial stays one
separate prior case. Return selection outside acquisition adds no trial.

## Retention and verification

Reports have immutable compressed and raw sizes and SHA-256 values. The new
verifier checks integrity before meaning. Rehashed mutants reject omitted
census rows, wrong addresses, stale payload after retirement, late commands,
and changed operations, boundaries, or field declarations. Model reports check
expanded/collapsed/nested groups and independent child order. The native report
keeps unsupported flags and exact restoration separate from those model cases.

- Brain `check`: typecheck and all 1,735 tests pass; 12 native helper groups pass.
- Extension `check`: 67 adapter, 38 cache, 10 topology, 15 authority, 9 pool,
  16 inventory, 7 scene, and 1 observer groups pass. All four archive checks pass.
- All five prior artifact verifiers pass: 3 shadow, 3 lifecycle, 9 path, 13 v5,
  and 18 followup reports. The retained R2 rejection remains effective.
- The new verifier passes all 13 reports: six ordering trials, one late
  diagnostic, unsupported topology, reader diagnostic, research reload, two
  fixture cleanups, and final normal restoration. No session role remains pending.
- Active wire goldens, context links, and staged/unstaged diff checks pass.
  The existing JDK final-field test warning remains.

## Live restoration

The [entry API capture](../data/phase8g4-native/entry-baseline.json.gz) has four
ordered tracks, eight scenes, 32 empty slots, and the original selection/cursors.
Entry normal hello has 85 methods and hash `bba7383dce25c0f0`.

Research hello passes with 97 methods, hash `f03f19414f40e3d3`, and init
`2026-10-03T03:12:40.486Z`. Marker is `8g4-shadow-topology-v1`; definition is
`8g4-1`. The reload report retains the private init domain and plain topology.

Both owned fixtures have 32 empty slots, their exact four-track census, and no
pinned cursors. Both are closed without saving. Original `New 1` stays open and
unsaved. Its engine is active and transport is stopped at `1.1.1.00`/`0:00.000`.
The observed viewport remains at bars 17–25. No identical viewport is claimed.

Exact config bytes are restored. SHA-256 is
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.
The research archive is removed after its exact hash check. `copyExtension`
deploys normal. The research controller is fully removed. The user adds the
final normal product. Final hello passes with 85 methods, hash
`bba7383dce25c0f0`, and init `2026-10-03T03:59:29.016Z`.

The [final report](../data/phase8g4-native/final-live-baseline.json.gz) verifies
exact API equality with the pinned entry bytes: ordered tracks, eight scenes,
32 empty slots, selection, cursors, and pins. It also checks exact config bytes,
normal runtime identity, and absence of the research archive. The final UI read
shows only unsaved `New 1`, its active engine, and stopped transport at zero.
Viewport equality remains unproved and is not part of the API claim.
The manifest marks this session complete. This does not close the 8g cache gate.

## Retrospective

Budget native UI round trips inside the sample interval. Keep late commands as
diagnostics. Save topology before note-reader preparation; flat and child cursor
positions can differ.

The post-session selector check found that arrows changed Hardware Vendor while
it had focus. After focus moved to Product, field clicks, arrows, reverse Tab,
and window Raise did not restore that response. The operator also could not
restore Settings keyboard control with Tab or reverse Tab. The Space test was
blocked by automatic approval review and was not run. The controller remained
installed and transport stayed stopped. These checks do not prove a reliable
focus method. At the operator's request, `AGENTS.md` now requires an operator
handoff for every controller replacement. The agent prepares the archive and
verifies the runtime after the operator confirms replacement.

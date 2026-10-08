---
title: E252 — Long device write profile
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8i3
---

# E252 — Long device write profile

## Status

[8i3](../../plan/phase-8/8i3-long-device-write-profile.md) is complete. The
largest admitted input of every `agent-native-v1` write was measured live.
Before 8i3, admitted calls took up to 102 s; some refused only after a long
read, and some could not be reverted. Nine brain changes remove the waste
that grew with the input, with each guard kept.
[D44](../../decisions/d44-long-writes-are-optimized-then-bounded.md) then
bounds each write whose cost still grows. The largest admitted call is now
about 33 s, and no admitted call reaches 45 s. No extension change; the
deployed archive is unchanged (89 methods, `0ef817f4bac8a8a7`). Tool
descriptions are `ghostnote-description-v37` after the limit follow-up
(v36 at 8i3).

## Fixture and driver

Owned unsaved project "New 3" (Inst 1, Audio 2, FX 1; 8 scenes), with the
audio engine on for the plug-in and modulation arms (E244). The driver is
`brain/src/probes/phase8i3-long-writes.ts`. Each command makes scratch tracks
with product tools, calls one tool at its largest admitted input through the
MCP dispatch path, and deletes the tracks. Each row records the wall time,
every wire call with its start and duration, the host turns, the wire time
for each method, the gaps between turns, and the brain CPU time. The data is
in [phase8i3-long-writes](../data/phase8i3-long-writes/): `before/` (the 8i2
build), `after/` and `final/` (intermediate builds), and `final2/` (the
staged build). The live heap stayed between 638 and 2,198 MiB (peak in the
16,384-note clip arm). "New 3" ends at its baseline.

The probe `WireTransport` now throws `BridgeError` with the reply code, as
the product transport does. With the plain `Error`, `captureSelection` did
not recognize "no track at index" after a deleted track held the slot
selection, and every later write in that driver failed `internal`.

## Baseline: what grew with the input

| Case | Before | What grew |
|---|---:|---|
| `set_device_controls`, 44 Polysynth controls | 21.4 s (1: 2.2 s; 27: 13.8 s) | A complete settled inventory after each control: 195 ms `paramsLive` settle and about 6 turns (about 0.36 s of 0.45 s) |
| Staged `compose_devices` 5×1 / 5×2 / 5×4 | 31.5 / 50.3 / 102.1 s; revert 21.5 / 39.4 / 89.4 s | Two rename stages for each chain (0.9 s each), and for each device an insertion (1.2 s) and a move (2.3 s), with a settled parameter inventory of the container in each container proof |
| Drum Machine, 16 pads | 71.8 s | The fixed 4,000 ms `deviceInsert` budget after each pad |
| `edit_preset_modulation`, 8 behavior checks | 44.8 s (1 check: 7.0 s) | One sampling session for each check (about 5.4 s) |
| `delete_device`, 16 devices | 30.7 s | One executor run for each device, about 1.7 s |
| `copy_launcher_clips`, 64 copies | 38.5 s; the revert returned `nothing-to-revert` | One stage and one source capture for each copy; 64 copies overflow the 24 launcher content events (`Rig.CONTENT_LOG`), so the revert cannot compare across the change ([revert-copy-64.json](../data/phase8i3-long-writes/before/revert-copy-64.json)) |
| `set_launcher_clip_properties`, 64 clips | Refused `invalid-input` after 32.1 s of reads | One write stage confirms at most 8 clips (8 writer cursors) |
| `delete_launcher_clip`, 16 clips; 8 of 16,384 notes | 9.7 s, revert refused (more than 8 clips in one stage); 11.5 s, revert 46.3 s | The revert writes each clip again |
| `wrap_existing_device_modulation`, 16 modulators | Failed after 9.2 s: the remote pages never settled | The container page and 16 modulator pages exceed the 16-page window (`remotePages`) |
| Diva (CLAP, 281 IDs): one control write; read | 8.2 s; 3.85 s | Three complete inventories; each read of the plug-in descended into its empty slot (below) |

## Changes, guards, and saved work

1. **Cohort integrity poll** (`adapter.ts`, `parameterCohortPoll`). After a
   scalar stage that is not the last one, the complete inventory is two equal
   polls of the live observer generation, with no `begin` and no `paramsLive`
   settle. The guard stays: each stage compares the complete inventory with
   the preflight, and an unrequested change still stops the cohort. The last
   stage, and any poll whose generation or target differs, read the complete
   settled inventory. Evidence: a raw A/B with a control arm
   ([poll-ab.json](../data/phase8i3-long-writes/before/poll-ab.json)): an
   unawaited `directparam.set` was visible in the first poll in 10 of 10
   trials (42–49 ms), the next poll was equal, and the settled inventory
   agreed on every ID, name, and value. Saved: 44 controls 21.4 → 9.4 s; Diva
   64 controls 13.9 s (a settled inventory for each would cost about 4 s
   each).
2. **One entry-name stage** (`engine/general-device-composition.ts`). The
   staged path names every layer chain in one guarded stage, as the offline
   path does; temporary names only when a requested name is another seed
   name. The executor still proves each rename. After a failed batch, the
   checkpoint changes only the names with proved stage receipts. An
   unexpected name or an unproved rename prevents reversal. Saved: about
   7 s at 5 chains.
3. **No duplicate stable read before a move** of an inserted source: the read
   just before has no stage after it. An existing source keeps its second
   read. Saved: about 0.25 s for each device.
4. **Structure reads for container proofs.** The composition compares only
   the layer chains and their devices; the read no longer takes the settled
   inventory of the container's parameters (8h4e `structure` option). Saved:
   about 0.3 s for each proof.
5. **Drum pad poll** (`settleStructure`). A pad insertion polls the pad bank
   until the pad shows exactly the requested device in two equal readings,
   within the same 4,000 ms deadline. The composition readback is still the
   proof. Saved: 71.8 → 12.5 s.
6. **Shared modulation sampling** (`modulator-authoring.ts`, staged
   composition). The behavior witnesses of one device share each sample
   round; each keeps its own samples and verdict (the wrap path already did
   this). Saved: 8 checks 44.8 → 7.0 s; 15 wrap modulators take the time of 1.
7. **Relocation preflight without slot descent** for layer-chain routes. Only
   a device-slot endpoint needs the named-slot descent. Saved: about 3 s for
   each move of a device with an empty slot (Delay+): 2×4 35.4 → 29.8 s.
8. **Two empty-slot descents, not eight** (`containerScope`). A descent into
   an empty slot never settles; every miss ends as the fixed scope with the
   slots incomplete. Two misses give the same answer. Saved: about 2.5 s on
   each read of such a device; the Diva read 3.85 → 1.3 s, its one-control
   write 8.2 → 3.4 s.
9. **D44 limits** refuse a larger request before any read or write.

## Results at the D44 limits (`final2/`)

| Case | Time | Revert | Note |
|---|---:|---:|---|
| `set_device_controls`, 1 / 27 / 44 Polysynth controls | 2.2 / 6.6 / 9.4 s | — | About 0.17 s for each further control |
| `set_device_controls`, 64 remote controls | 4.6 s | — | |
| `set_device_controls`, Diva 1 / 27 / 64 | 3.4 / 7.7 / 13.9 s | — | Two Diva routes and 64 settings: about 17 s (estimate) |
| Staged 5×1 / 3×2 / 2×3 (6 units) | 21.0 / 23.5 / 23.2 s | 22.5 / 26.3 / 26.9 s | 8 native devices: 30.3 s, revert 33.6–34.9 s (above the target, so the limit is 6) |
| Staged, 3 Diva chains (6 units) | 13.6 s | 15.9 s | |
| Staged, 2 devices with 2 modulators each (6 units) | 25.3 s | 10.6 s | 6 devices with modulators on 3: 45.6 s (now refused: 12 units) |
| Staged, 4 devices, 1 with 4 modulators (6 units) | 24.2 s | 18.7 s | |
| Offline, 2 chains with 1 modulator edit each | 12.7 s | 1.3 s | About 4.3 s for each edit; 4 edits about 21 s (estimate) |
| Drum Machine, 16 pads | 12.5 s | 1.6 s | |
| `add_devices`, 16 native; 6 Divas | 16.8 s; 6.4 s | — | Not bounded (schema maximum 16) |
| `delete_device`, 6 native; 6 Divas | 14.7 s; 13.6 s | — | |
| `edit_preset_modulation`, 1 and 8 checks | 7.1 s; 7.0 s | — | Not bounded: one session |
| `wrap_existing_device_modulation`, 1 / 8 / 15 | 13.6 / 13.6 / 13.6 s | 5.3–5.5 s | At 15, one quiet control failed its own proof (below) |
| `set_device_enabled`, 32 | 21.7 s | — | |
| `rename_track` 64; `delete_track` 64 | 10.7 s; 15.5 s | — | `add_tracks` 16: 7.2 s |
| Clip batch, typical clip: copy 8; properties 8; launch settings 8; delete 4; move 8 | 5.2; 8.1; 5.6; 2.6; 7.4 s | 7.0; 7.9; —; 18.4 s; none | Move has `next.reverse`, no revert |
| Clip batch, 16,384-note clips: copy 8; properties 8; launch settings 8; delete 4; move 8 | 13.2; 33.5; 23.1; 7.3; 23.7 s | 24.6; 32.8; —; 23.0 s; none | Properties: the longest admitted call (two captures of each clip at the reader limit) |
| `delete_scene`, 56 rows | 3.2–4.5 s | — | The 128-scene window bounds it (about 10 s) |

## Other findings

- The behavior proof needs the audio engine: with the engine off, an LFO on
  a native device never moved its modulated value.
- Some controls move less than the 0.001 proof divergence for an LFO (Polysynth
  filter frequency at amount 0.3, filter envelope depth, noise, and filter
  attack and release). Such a proof fails safe; it does not depend on the
  modulator count.
- Some Diva controls are switches with no reported discrete domain: 0.75
  reads back as 1, and the write fails after the 22 s plug-in callback window.
  The driver writes endpoints on Diva.
- The cost of a plug-in route and of a plug-in removal grows with its
  DirectParameter count (Diva: 281). Ghostnote cannot know the count before
  it reads; a much larger plug-in is the remaining unbounded dimension.

## Call budgets

The adapter-call budgets in `call-budget.test.ts` and the live frame budgets
in `adapter.test.ts` are unchanged. New offline tests: the cohort poll and
its fallback, the pad poll, the relocation preflight slot rule, the bounded
descent, the batched behavior rounds, the one entry-name stage and its clash
case, the structure-read proofs, and every D44 refusal
(`write-limits.test.ts`).

## Review fixes

The failed rename path used to copy the latest observed names into the
reversal checkpoint. That could adopt an operator edit and permit deletion
of the changed container. The checkpoint now uses the requested name only
for a rename with a proved receipt. It keeps the prior name for other
entries. The reversal checks that expected structure before any write.
Tests cover partial success, an operator rename, an unproved rename, and
an unchanged entry that has no rename op.

The fast parameter poll now checks `observedDeviceIndex` with the same rule
as the settled inventory. A mismatched index starts a settled read. If the
index stays wrong, the cohort stops before the next scalar write. Tests
cover recovery and a persistent mismatch with the same device name.

The successful paths add no host turn, cold read, write stage, or heap
allocation. A failed name batch removes one structure read. Call budgets
and descriptions stay unchanged (`ghostnote-description-v36`).

The live rerun used the unchanged driver arms `controls`, `compose`
(`5x1,3x2,2x3`), and `plugins`. The operator left the probe-only review
item unchanged. The [review measurements](../data/phase8i3-long-writes/review-fixes/summary.json)
include the before and after baseline. The same directory holds compressed
JSON files with every wire call and gap.

| Case | Review rerun | E252 `final2` |
|---|---:|---:|
| Polysynth, 1 / 27 / 44 controls | 2,283 / 6,642 / 9,481 ms | 2,247 / 6,612 / 9,442 ms |
| 64 remote controls | 4,593 ms | 4,616 ms |
| Diva, 1 / 27 / 64 controls | 3,429 / 7,776 / 13,912 ms | 3,447 / 7,740 / 13,905 ms |
| Staged 5×1 / 3×2 / 2×3 | 20,975 / 23,642 / 23,278 ms | 20,993 / 23,540 / 23,247 ms |
| Their reversals | 21,922 / 26,028 / 26,764 ms | 22,499 / 26,301 / 26,912 ms |
| Three Diva chains; reversal | 13,643; 15,828 ms | 13,616; 15,941 ms |

No time regressed by more than 2 percent. Control and native composition
wire counts are unchanged. The Diva composition used one more relocation
proof round (three calls) and one fewer insertion poll (one call): two
extra host turns in total. The 5×1 and 3×2 reversals used three and two
fewer relocation proof rounds. These are host settlement variations; the
fixes add no call on a successful path.

Verification: `npm run check` passed all 2,125 tests; `./gradlew check`,
`context/check.rb`, and the diff whitespace checks passed. The normal
extension passed `probe:hello`: 89 methods, hash `0ef817f4bac8a8a7`,
initialization at `2026-10-08T09:16:24.981Z`, and the required build markers.
The archive did not change. After the live runs, "New 3" has the same track
IDs and order, eight scenes, slot and mixer selections, and no unpinned
cursors. All temporary tracks were removed. Heap use was 1,040 MiB before
the chain and 840 MiB after it.

## Limit follow-up (`final3/`)

Three D44 limits came from Diva numbers taken before the two slot fixes.
The follow-up measured the new limits live in "New 3" with the audio engine
on (`phase8i3-long-writes.ts plugins` and `add`, written to
[`final3/`](../data/phase8i3-long-writes/final3/)).

| Case | Time | Revert | Note |
|---|---:|---:|---|
| `set_device_controls`, 16 settings on each of 4 Divas (64 in one call) | 22,465 ms | — | New limit: 4 routes (was 2). Each change has its own `revert_change` |
| `set_device_controls`, Diva 1 / 27 / 64 | 3,439 / 7,756 / 13,907 ms | — | Same as `final2` |
| `delete_device`, 10 Divas | 20,739 ms | — | New limit: 10 (was 6). Not reversible |
| `delete_device`, 10 native devices | 25,191 ms | — | About 2.5 s for each removal |
| Staged, 3 Diva chains (6 units) | 13,787 ms | 15,804 ms | Same as `final2` |

The plug-in weight in `compose_devices` stays 2 units. There was no
weight-1 trial: a container holds at most 5 layer chains, and the linear
estimate from 3 Diva chains (6 Divas: about 28 s, revert about 32 s) is
above the 30 s target for the revert. Plug-ins with more parameters than
Diva cost more.

Each bounded input now states its limit in its schema text ("At most N
… in one call"), with no `maxItems`, so a larger request still refuses as
`outside-limit`. `move_launcher_clips` now states its 8-row limit in its
description. Descriptions are `ghostnote-description-v37`; v36 is frozen.
After the runs, "New 3" was at its baseline (Inst 1, Audio 2, FX 1; 8
scenes).

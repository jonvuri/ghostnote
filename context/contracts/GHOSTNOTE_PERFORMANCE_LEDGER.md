---
title: Ghostnote performance ledger
kind: reference
state: active
updated: 2026-10-21
parent: ../plan/phase-8/8h-cache-promotion-and-interface-simplification.md
evidence: E227, E229, E234, E236, E237, E238, E239, E244, E246, E247, E248, E252, E253, E254, E256, E257, E258, E263, E264, E265, E267, E269, E271
---

# Ghostnote performance ledger

## Scope

This ledger holds the current measured cost of each product path, the probe
or primitive cost that the path is built on, and the offline call budgets that
guard it. Read it before you plan or change a live path. Update it in the same
session as a change that moves a number.

## Rules

1. **Cost model in the plan.** For a new product path, or a change to host
   calls, traversal, waits, allocation, or admitted limits, state the expected
   host turns, cold reads, write stages, and heap before the work. Cover the
   typical and largest admitted cases. Compare with the relevant measured
   path or primitive. An unchanged path can cite its existing model. A research
   probe needs a short cost note with bounded host work and memory; use existing
   measurements where applicable. A full product study is needed only when
   the session makes a product performance claim.
2. **Call budgets.** The offline call-budget tests fail when a tool, the
   executor, or the live adapter adds a host call:
   `brain/src/surface/call-budget.test.ts` (adapter calls for each tool and
   route) and the call-budget tests in
   `brain/src/adapters/live/adapter.test.ts` (the wire frames of a mark, a
   snapshot read, a bank scan after a mark, the writer page check, the
   writer park, the mixer read and write, and the mixer-selection restore
   after a track create, delete, or duplicate). When a
   budget changes on purpose, update the test and this ledger, and state the
   cost in the E record. `phase8h4g-inventory.test.ts` holds the offline time
   budget of the edit planner.
3. **Remeasure the changed cost.** When host calls, traversal, waits,
   allocation, or admitted limits change, run the matching live measurement
   and record it here. An unchanged host path needs no performance rerun.
   Use the same workload and comparable per-call results; separate cold work,
   queue delay, and operator time. A regression over 20 percent, or a new host
   turn, needs a cause and an accepted reason in the E record. If the cause
   remains unknown, record that limit and do not claim a stable performance
   bound. Repeat only when safe and needed to distinguish timing noise. Never
   repeat an uncertain write to obtain a timing sample.

## Unit costs

| Unit | Cost | Source |
|---|---|---|
| One sequential wire call | About 24 ms (one control-surface turn) | E246 trace |
| Calls sent together | One turn: a mark (`revision.get` and `track.list`); the 8 clip-release frames after a structural stage (16 before D43) | E246, E247, E250 |
| Cursor track pins (D43) | No frame: the extension keeps every owned cursor track pinned. A clip point sends no track unpin or pin (2 sequential calls fewer for each attempt); a device route sends up to 2 fewer | E250 |
| A bank scan (`tracks()`) within 50 ms of a mark, with no request after it | No call: the mark's scan | E247 |
| One `clip.read` capture, typical clip | About 190 ms | E246 trace |
| One `clip.read` capture, 16,384 notes | About 970 ms | E247 worst trace |
| An occupancy read (`ReadOptions.occupancy`) of a `clip` address | One `slot.status` (one turn) | E237 |
| Bare replay read (the primitive) | 46–698 ms, by size | E227 |
| `gridChange` settle | 144 ms | E15-D, `SETTLE_MS` |
| Writer page check before a note stage | About 210 ms for each distinct view (step size, page): set, scroll, settle, status. Not repeated for each channel. The writer window is the reader width, so an admitted clip has one page at each grid (at 512 steps, a 2,048-beat clip at 1/512 had 512 pages: 111 s) | E46, E247, E248 |
| Writer park after an apply that writes notes | One turn (about 24 ms) for all used writers: a 1-beat grid and step 8,192 for each, no settle | E248 |
| `noteWrite` settle | 25 ms | `SETTLE_MS` |
| DirectParameter display set (any count, 8–281 IDs) to text for each ID | One turn (22.6–25.4 ms); a switch sends no text | E244 |
| DirectParameter same-type switch settle (driver: point and poll) | 165–174 ms, independent of the observed count | E244 |
| DirectParameter inventory with the parameter settle | About 290 ms of settle and poll (the idle time of `read_device_controls`) | E247 inventory |
| Cohort integrity read after a scalar stage that is not the last (D44) | Two equal polls of the live generation, about 50 ms; the last stage and a changed generation read the settled inventory (about 0.36 s) | E252 poll A/B |
| Container proof of a composition (`structure` read) | The container scope only, no parameter inventory of the container (about 0.3 s less) | E252 |
| Named-slot descent into an empty slot | Two misses, about 0.4 s, then the slots are incomplete (8 misses: about 3 s); a layer-chain move does not descend | E252 |
| Device insertion, layer-chain copy (`deviceInsert`) | A poll of the structural proof, deadline 4,000 ms; a native device lands in about 1 s. A drum pad insertion polls its pad (was the fixed 4,000 ms) | E247, E252 |
| Device or chain relocation | No fixed wait; its proof poll (deadline 8,000 ms) | E247 |
| One container read (`containerScope`, layer container, track not held) | About 8 turns (190 ms) | E238 trace |
| One structural track stage (`track.create`, `track.duplicate`, `track.delete`): cursor release, rescan, mint poll | About 420 ms, 23 wire calls | E247 |
| Bound heap for each sounding cell | About 300 bytes live (ZGC "used" is higher); 336 bytes in a held writer | E227, E246, E248 |
| `track.mixer`, 1 or 8 tracks | One turn (18–25 ms) after the mark; every field of every named track | E257 |
| Mixer write stage (`track.setMixer` frames, any count, in one `batch.run`) | One turn (19–28 ms); `setRaw` is visible to the next read (gate: 0 polls) | E257 |
| Mixer observers (normal profile) | 7 values for each track, 1,792 at the 256-track window: init 110 ms, Rig construction 79 ms. The probe profile (the 7, the pan display, sends, input kinds, VU) on the same project: 102 ms, 86 ms | E257 |

## Product paths

Live, normal profile, owned project "New 6", 2026-10-08 (E247) unless the
source says otherwise. E248 rows are on the build with the reader-width
writer and the park. Typical clip: 256 notes on 16 channels over 64 beats
(E231). "Before" is the first E247 inventory, before the 8h4g reductions.
Budgets are adapter calls in `call-budget.test.ts`; "wire" budgets are the
live wire-call count of the E247 inventory.

### Launcher clips

| Path | Current | Reference or earlier | Call budget | Source |
|---|---:|---|---|---|
| `read_launcher_clip`, typical | 415–477 ms; 14 calls, 10 turns, 1 capture; 11.8 KB | Replay 48 ms + fetch 40 ms (E227); E246: 419–459 ms | mark 1, tracks 1, clipRead 1, delta 1 (repeated read: delta 2) | E247 |
| `read_launcher_clip`, 16,384 notes | 1,542 ms | E246: 4,102 ms | as typical | E247 worst |
| `check_launcher_clips`, one ref | 409 ms | E234: 16 clips 4.6 s | mark 2, clipRead 1, delta 1 (refs with one mark share one delta) | E247 |
| `edit_launcher_clip`, 16-note insert (targeted) | 1,367–1,428 ms | E247: 1,406–1,502 ms; E246: 1,449–1,470 ms; E236: 6,610 ms | mark 1, tracks 1, clipRead 2, delta 3, apply 1 | E248 cost |
| One read and one 16-note insert | 1,790–1,832 ms | E247: 1,857–1,951 ms, 54–56 wire calls; E236: 7,176 ms | as above | E248 cost |
| `edit_launcher_clip`, whole-clip velocity, typical | 1,666–1,740 ms (E253 inventory 1,666; one E253 run 2.3 s from a slow host capture, not reproduced) | E246: 1,772 ms | mark 2, tracks 1, clipRead 3, delta 3, resolve 1, apply 1 | E247 |
| Whole-clip edit, notes with nondefault expression | 1,929–1,934 ms | E247: 5,683–6,913 ms (a page for each property stage) | as whole-clip | E248 accept |
| Whole-clip edit, 16,384 notes (reader limit) | 6,588 ms (plan 1,195, write 3,710, readback 637) | E247: 8,337 ms, 75 wire calls; E246: 47,977 ms (plan 12,003, write 31,609) | as whole-clip | E248 worst |
| Whole-clip edit, 512 notes on 2,048 beats at the 1/512 grid (the review case) | 1,781 ms; 53 wire calls | 512 steps: 110,838 ms, 512 page checks | as whole-clip | E248 reviewer |
| Edit planner, 16,384 notes, offline | 1.2 s (4,096 notes: 0.5 s); budget 4,000 ms | E246: 12.0 s live | `phase8h4g-inventory.test.ts` | E247 |
| Edit planner with claims, offline (`seal-bench`: every velocity and one claim without basis on each note) | 4,096 claims 1.55 s; 16,384 claims 6.3 s; budget 4,000 ms at 4,096 | HEAD, helper bases: 1.39 s; 5.8 s (the codec structure check of each overlay) | `phase8h4g-inventory.test.ts` | E253 |
| `edit_launcher_clip`, claims only (put or remove, no note change) | 806 ms (read 357, readback 409); no write | Edit refusal about 400 ms (E246) | mark 2, tracks 1, clipRead 2, delta 2 (the seal adds no call; new test) | E253 |
| Edit refusal before a write | About 400 ms | E236: 560 ms | — | E246 |
| Document input refused by the codec (add or edit), with `detail.repair` | 1 ms; 0 wire calls | Before 8i6: the same refusal without repair | none (new test) | E255 |
| `get_document_reference`, Core and the desired template; Timing overlays; all sections and all templates | 4,469 bytes; 14,997 bytes; 17,383 bytes (FIELDS) | E256: 4,469; 13,347; 15,733 bytes (E255: 4,469; 6,806; 9,192). Reference source 7,980 → 10,736 bytes (the timing example) → 12,359 bytes (the timing-feel method, E259) | none | E255, E256, E259 |
| `add_launcher_clip` with the desired template (1 note); a template-form patch (1 ADD, 1 UPDATE) after a read with Patch help | 2,460 ms, 87 wire calls; 1,546 ms, 45 wire calls (read 389 ms) | E250 add typical 2,158 ms; targeted insert 1,367–1,428 ms | unchanged | E255 |
| `add_launcher_clip`, typical (256 notes) | 2,323 ms; 85 wire calls | 16 notes, E237: 2,611 ms; `add_clip` 1,827 ms | mark 3, tracks 2, read 3, resolve 2, apply 2, delta 4, clipRead 3 | E247 |
| `add_launcher_clip`, 16,384 notes | 6,418 ms (plan 778, write 3,352) | E247: 8,172 ms | as typical | E248 add-worst |
| `add_launcher_clip` with claims, typical (28 notes, 56 nominal and groove claims, no read before) | 2,279 ms (plan 47, readback 40); 79 wire calls, 54 turns | Same notes without claims: 2,157 ms (plan 10), 77 calls, 53 turns; E250 256 notes: 2,158 ms, 77 | as typical (claims add no call; new test) | E256 |
| `add_launcher_clip`, largest admitted with claims (16,384 notes, 13,498 claims, 4,188,652 expansion units: the D44 limit) | 22,156 ms (plan 8,383, write 3,518, readback 4,969); 77 calls, 53 turns; reverts 3,816 and 1,143 ms; offline 20.3 s | E248 add-worst without claims 6,418 ms; E253 planning 16,384 claims 6.3 s | as typical | E256 |
| Claim structure or timing refusal of an add (with `detail.repair`), or above the expansion limit | 0 wire calls | — | none (new tests) | E256 |
| `add_launcher_clip`, the review case; 2,097,152 cells (4,096 one-beat 1/512 notes) | 2,293 ms; 3,341 ms, ZGC used peak 2,450 MiB | 512 steps: 111,419 ms; about 54 s (257 pages) | as typical | E248 |
| `copy_launcher_clips`, one clip | 924 ms | Before: 1,228 ms; `copy_clip_down`: 2,897 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
| `copy_launcher_clips`, one clip to any empty slot (`slot.copyTo`, `gn-scale-test`): the next row, another row, another track, Hybrid; its revert | 853–888 ms; 37 wire calls, 22 turns; revert 1,115–1,179 ms, 42 calls, 27 turns | E247: 924 ms (`slot.duplicateClip`, next row only) | unchanged; also for a row that is not the next row | E263 |
| `copy_launcher_clips` refusals: track type; occupied destination; missing row | 25 ms, 2 calls; 94 ms, 6 calls; 23 ms, 2 calls; no write | — | — | E263 |
| `copy_launcher_clips`, 8 clips of 16,384 notes to another track (the D44 limit); its revert | 8,368 ms, 170 wire calls, 106 turns; 14,574 ms, 182 calls, 118 turns | E252: 13,192 ms; 24,623 ms (project "New 6", next rows) | as one call | E263 |
| `move_launcher_clips`, one clip | 1,190 ms | Before: 1,472 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
| `set_launcher_clip_launch_settings` | 1,056 ms | — | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
| `set_launcher_clip_properties`, one clip | Name, length, or colour: 1,423–1,436 ms; 3 captures, 1 stage, only the owned setters; no change: no write | E247: 1,447 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E249 |
| Copy, extend 64 → 128 beats, and insert 153 notes (the dogfood path) | Copy 888 ms; read 422 ms; edit 1,760 ms, no colour setter; revert 2,082 ms | Dogfood edit: 2,190 ms for 153 inserts | as targeted edit | E249 |
| `delete_launcher_clip` | 878 ms | Before: 1,233 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
| Clip batches at the D44 limits, typical clip: copy 8 (revert); properties 8 (revert); launch settings 8; delete 4 (revert); move 8 | 5,221 (7,023); 8,146 (7,945); 5,627; 2,614 (18,413); 7,363 ms | Before 8i3: copy 64 38.5 s, not revertible (24 launcher content events); properties of 64 refused after 32.1 s; delete 16 not revertible (8 clips in one stage) | as one call | E252 |
| Clip batches at the D44 limits, 16,384-note clips: copy 8 (revert); properties 8 (revert); launch settings 8; delete 4 (revert); move 8 | 13,192 (24,623); 33,471 (32,788); 23,124; 7,347 (23,044); 23,685 ms | Delete 8: revert 46,296 ms | as one call | E252 |
| `launch_clip` | Median 752 ms (742–763) | `stable-v1`: median 703 ms; E237: 764 ms | mark 1, tracks 1, read 4, apply 1, delta 1 | E247 workflow |
| `show_launcher_clip_in_detail_editor` | 238 ms | `show_changed_clip`: 578 ms | mark 2, tracks 1, read 1, resolve 1 | E247 |
| `add_scenes`, one; `delete_scene`, one | 368 ms; 393 ms | Before: 676 ms; 726 ms | add: mark 2, read 2, apply 1, delta 1; delete: mark 2, resolve 1, read 2, apply 1, delta 1 | E247 |
| E45/E48-style workflow (read, copy, read and edit, launch, show, two reverts) | 8 calls, 6,745 ms, 28,362 bytes | E247: 6,895 ms; E239: 7,411 ms; `stable-v1`: 7 calls, 12,773 ms, 15,122 bytes | — | E248 workflow |

### Follow-mode project rerun (E250)

Live in "ice jungle", a project saved with the cursor records, on the D43
build, after a project switch. The ledger rows above stay the reference;
these rows show no regression and fewer wire calls.

| Path | Current | Reference or earlier | Call budget | Source |
|---|---:|---|---|---|
| `read_launcher_clip`, existing clips | 365–403 ms; 12 wire calls | E247: 415–477 ms, 14 | unchanged | E250 |
| Raw `clip.read`, existing clips | 163–211 ms; park in 0–1 polls | Dogfood: 2,436 ms `deadline` | — | E250 |
| `add_launcher_clip`, typical | 2,158 ms; 77 wire calls | E247: 2,323 ms, 85 | unchanged | E250 |
| `set_device_controls`, one write | 2,398 ms; 66 wire calls | E247: 2,555–2,650 ms, 74 | unchanged | E250 |
| `add_devices`, one native device | 1,363 ms; 51 wire calls | E247: 1,447–1,544 ms, 67 | unchanged | E250 |
| One read and one 16-note insert ("New 2") | 1,723–1,793 ms; 54–56 wire calls | E248: 1,790–1,832 ms | unchanged | E250 cost |
| One read and one 16-note insert, 8i7 build with the mixer observers ("New 3") | 1,789–1,812 ms; 54–56 wire calls | E250: 1,723–1,793 ms | unchanged | E257 rerun |

### Selection restore (E258)

Live in `gn-scale-test` on the 8i8 build. The restore after a track create,
delete, or duplicate is one `selection.status` turn; when Bitwig moved the
mixer selection, it adds `selection.restoreMixer` and one confirming poll
(three turns). The outer selection scope of a two-change tool saves one
entry capture (two calls). Item 1 (unavailable readback) adds no call.

| Path | Current | Reference or earlier | Call budget | Source |
|---|---:|---|---|---|
| `add_tracks`, one track | 889–935 ms; 41 wire calls, 23 turns | E247: 835–841 ms, 46 | unchanged (fake); adapter frame test | E258 |
| `add_launcher_clip`, typical | 2,037–2,039 ms; 73 wire calls, 49 turns | E250: 2,158 ms, 77 | unchanged | E258 |
| `delete_track`, one track, the host moved the mixer | 594 ms; 29 wire calls, 16 turns | E250: 476 ms, 25 | unchanged (fake); +3 turns live | E258 |
| `delete_track`, one track, the mixer did not move | 492–508 ms; 26 wire calls, 13 turns | E250: 476 ms, 25 | unchanged (fake); +1 turn live | E258 |
| `duplicate_track` | 948 ms; 42 wire calls, 24 turns | E247: 817–844 ms, 46 | unchanged (fake); +3 turns live | E258 |
| `rename_track` | 378–384 ms; 15 wire calls | E247: 381 ms | unchanged | E258 |

### Collapsed-group rerun (E251)

Live in `gn-scale-test` on the D43 build, every group collapsed. The rows
above stay the reference for top-level tracks.

| Path | Current | Reference or earlier | Call budget | Source |
|---|---:|---|---|---|
| Raw `clip.read`, child of one collapsed group | 281–287 ms | E241: median 262 ms | — | E251 |
| Raw `clip.read`, three collapsed levels | 374–378 ms | E241: median 378 ms | — | E251 |
| `read_launcher_clip`, one group; three levels | 466–474 ms; 565–567 ms; 12 wire calls | E250 top level: 365–403 ms | unchanged | E251 |
| `edit_launcher_clip`, 16 inserts, collapsed child | 1,576 ms (one group); 1,862 ms (three); 36 wire calls | Expanded: 1,524; 1,698 ms, 43 | unchanged | E251 |
| `read_devices`; `set_device_enabled`, collapsed child | 520 ms; 731 ms | E250: 524–697 ms; E247: 905 ms | unchanged | E251 |

### Tracks, changes, and connection

| Path | Current | Reference or earlier | Call budget | Source |
|---|---:|---|---|---|
| `check_bitwig_connection` | 25 ms; 2 wire calls | One mark | mark 1 | E247 |
| `list_tracks` | 25 ms; 2 wire calls | E239: 43 ms, 3 calls | mark 1, tracks 1 (the mark's scan) | E247 |
| `add_tracks`, one track; two tracks | 835–841 ms, 46 wire calls; 1,277 ms, 66 | Before: 1,163 ms; E239 two tracks: 1,935 ms | read 4, apply 2, delta 2, resolve 1, tracks 1 | E247 |
| `duplicate_track` | 817–844 ms; 46 wire calls | Before: 1,176 ms; E239: 1,178–1,197 ms; E16: visible in 117–190 ms | tracks 2, read 4, apply 2, delta 2, resolve 1 | E247 |
| `rename_track` | 381 ms | E239: 386 ms | tracks 1, resolve 1, read 2, apply 1, delta 1 | E247 |
| `add_tracks` 16 (schema maximum); `rename_track` 64; `delete_track` 64 (D44 limit 64) | 7,207–7,246 ms; 10,691 ms; 15,452 ms | E252 baseline: rename 16 2,723 ms; delete 16 3,819 ms | as one call | E252 |
| `set_device_enabled`, 32 settings (D44 limit 32) | 21,695 ms | 16 settings: 9,752 ms | as one setting, for each | E252 |
| `delete_track`, 3 and 4 tracks | 937 ms, 69 wire calls; 1,140 ms, 86 | Before (3): 2,009 ms; E239 (4): 2,517 ms | tracks 1, resolve 1, read 2, apply 1, delta 1 | E247 |
| `list_changes` | 7 ms | No host call | none | E247 |
| `read_track_mixer`, 1 track; 8 tracks | 46 ms; 51 ms; 2 turns (mark, `track.mixer`) | Plan: 4 turns (96 ms); 28 turns for 8 tracks | read 1 | E257 |
| `set_track_mixer`, 1 field on 1 track; 4 fields on 8 tracks | 268 ms; 272 ms; 10 turns, 1 stage (the tool read is the stash) | Plan: 6–10 turns (144–240 ms); 54 turns for 8 tracks | read 2, apply 1, delta 1 | E257 |
| `set_track_mixer`, every field already holds its value | 47 ms; 2 turns, no write | — | read 1 | E257 |
| `set_track_mixer`, automation refusal | About 50 ms; 2 turns, no write | — | read 1 | E257 |
| `revert_change` of a mixer change, 1 field; 32 fields on 8 tracks | 369 ms; 364 ms; 14 turns | E247 device enable revert: 775 ms | read 3, delta 2, resolve 1, apply 1 | E257 |
| `check_revert`, a clip edit | 442 ms | E239: a rename, 42 ms | read 1, delta 1 | E247 |
| `revert_change`, a targeted clip edit; a device enable | 1,581 ms; 775 ms | — | revert: read 3, delta 2, resolve 1, apply 1 | E247 |

### Devices and modulation

| Path | Current | Reference or earlier | Call budget | Source |
|---|---:|---|---|---|
| `read_devices`, by structure | 542–562 ms (one container); 652 ms (one device); 695–950 ms (a container and 1–3 devices) | E238: 460–495 ms (one container); before: 634 ms (one device) | devices 1, read 1 | E247 |
| `read_device_controls`, new or same target (Polysynth) | 764–823 ms | E238: 701–731 ms | read 1 | E247 |
| `read_device_controls`, Diva (CLAP, 281 IDs) | 1,284–1,305 ms | E252 before the descent bound: 3,833–3,873 ms; E238: 3,919–4,011 ms | read 1 | E252 |
| `set_device_controls`, one write | 2,555–2,650 ms; 74 wire calls | E238: 2,324–2,398 ms (CLAP: 8,302 ms) | devices 1, read 2, apply 1, delta 1 | E247 |
| `set_device_controls`, 27 controls (Polysynth) | 6,612 ms; 190 wire calls | E247: 14,372–14,391 ms, 276 wire calls (a settled inventory after each control) | as one write | E252 |
| `set_device_controls`, 44 controls (every continuous Polysynth control); 64 remote controls | 9,442 ms, 275 wire calls; 4,616 ms | Before 8i3: 21,415 ms, 401 wire calls | as one write | E252 |
| `set_device_controls`, Diva (CLAP, 281 IDs): 1, 27, 64 settings; 16 settings on each of 4 Divas (D44 limit 64 on 4 routes) | 3,447; 7,740; 13,905 ms; 22,465 ms | E238: 8,302 ms (one write) | as one write | E252 |
| `set_device_controls`, one remote control at a sparse host position (Blur `Common/7/Mix`); its revert. Direct-ID arm | 1,561–1,623 ms, 42–45 wire calls; 2,503 ms. Direct: 2,196–2,271 ms, 57–60 | Before 8i5: refused `internal` | as one write; the selector lookup adds no call | E254 |
| `set_device_enabled`, one device; its revert | 905 ms; 775 ms | E239: 770 ms; 665 ms | devices 1, resolve 1, read 2, apply 1, delta 1 | E247 |
| `add_devices`, one native device | 1,447–1,544 ms; 67 wire calls | Before: 5,541 ms | devices 2, read 2, apply 1, delta 1 | E247 |
| `add_devices`, 16 native devices (schema maximum); 6 Divas | 16,811 ms; 6,426 ms | E252 baseline: 15,497 ms | as one device, for each | E252 |
| `revert_change` of an `add_devices` change, one native device (`gn-scale-test`); its refusal in the wrong order; `check_revert` | 1,527–1,875 ms, 53 wire calls, 38 turns, 1 write; refusal 810 ms, 26 calls, no write; check 45–52 ms, 4 calls | S2 (E262): 1.4–2.3 s for each call with client time | — | E264 |
| `compose_devices`, offline, 2 and 4 layer chains | 3,382–3,403 ms; 3,978–4,023 ms | E238: 7,199–7,330; 7,770–7,779 ms. E18a insertion: 463–465 ms | wire: 128 (2 layer chains) | E247 benchmark |
| `compose_devices`, staged, 2 and 4 layer chains | 17,500–17,551 ms; 30,430–30,556 ms | E238: 36,525–37,145; 64,878–64,937 ms | — | E247 benchmark |
| `compose_devices`, staged at the D44 limit (6 units): 5×1, 3×2, 2×3; their reverts | 20,993; 23,540; 23,247 ms; revert 22,499; 26,301; 26,912 ms | Before 8i3: 5×1 31,475 (revert 21,456); 5×2 50,292 (39,392); 5×4 102,095 (89,355) | — | E252 |
| `compose_devices`, staged: 3 Diva chains; 2 devices with modulators; 4 devices, 1 with 4 modulators | 13,616 (revert 15,941); 25,282 (10,623); 24,188 (18,679) ms | 6 devices with modulators on 3: 45,609 ms (now refused) | — | E252 |
| `compose_devices`, staged, 2 devices with 2 container modulators each (6 units, D46: identity check, no samples); its revert | 12,449 ms, 446 wire calls; 10,102 ms | E252: 25,282 ms; 10,623 ms. E254 without the identity check: 10,921 ms, 386 | — | E254 |
| `compose_devices`, Drum Machine, 16 pads; its revert | 12,504 ms; 1,550 ms | Before 8i3: 71,843 ms (a fixed 4,000 ms for each pad) | — | E252 |
| `revert_change` of a composition, offline; staged 2 and 4 | 1,428–1,454 ms; 12.6 s; 20.9–21.0 s | E238: 1.7 s; 21.3 s; 38.4 s | — | E247 benchmark |
| `set_layer_chain_solo`; no-op | 957–973 ms; 216 ms | E238: 828–868 ms; 182 ms | read 4, apply 1, delta 1; no-op: read 1 | E247 recipes |
| `rename_layer_chain` | 1,075 ms | E238: 953 ms | read 4, apply 1, delta 1 | E247 recipes |
| `duplicate_layer_chain` | 1,421–1,756 ms | E238: 5,199 ms | read 4, apply 1, delta 1 | E247 |
| `copy_devices`, one device | 2,472 ms; 107 wire calls | Before: 6,704 ms | devices 2, read 5, apply 1, delta 1 | E247 |
| `move_devices`, one device | 1,254–2,311 ms | E238: 5,366–5,957 ms | devices 2, read 4, apply 1, delta 1 | E247 |
| `delete_device`, one container | 3,055–3,296 ms; 116 wire calls | E238: 3,132 ms | read 3, devices 3, resolve 1, apply 1, delta 1 | E247 |
| `delete_device`, 10 native devices; 10 Divas (D44 limit 10) | 25,191 ms; 20,739 ms | 6 native 14,709 ms; 6 Divas 13,619 ms (before the slot fixes); before 8i3: 16 native devices 30,710 ms | as one removal, for each | E252 |
| `wrap_existing_device_modulation`, one LFO; its reversal | 14,390 ms; 5,801 ms | Before: 26,073 ms; 6,515 ms | wire: 420; 197 | E247 |
| `wrap_existing_device_modulation`, 1, 8, and 15 LFOs (D44 limit 15: the 16-page window) | 13,557; 13,600; 13,586 ms; reversal 5,260–5,511 ms | 16 LFOs: the pages never settle (9.2 s, fails) | — | E252 |
| `wrap_existing_device_modulation` (D46: no behavior witness), 1 and 15 LFOs; Sampler ADSR; reversals | 9,306–9,455 ms; reversal 5,078–5,102 ms | E252: 13,557–13,586 ms | wire: 297; 163 | E254 |
| `read_preset_modulation`; `list_modulator_types` | 1–3 ms; 1 ms | File and catalog reads only | none | E247 |
| `edit_preset_modulation`, one LFO; with 8 behavior checks | 7,092 ms; 7,044 ms (one shared sampling session) | E247: 8,233 ms; before 8i3, 8 checks: 44,786 ms | wire: 179 | E252 |
| `edit_preset_modulation` (D46: identity check, no samples), one LFO; its revert | 2,055 ms; 1,287 ms | E252: 7,092 ms. E254 without the identity check: 1,510 ms, 50 | wire: 67 | E254 |
| Modulation route suite (`probe:modulation-routes`, `stable-v1` witnesses; not a product call) | 160 s for 18 checks | — | — | E254 |
| A/B audition and winner collapse, 2 layer chains (8 calls) | 11,877–12,084 ms; 447–450 wire calls | E239: 21,877–21,903 ms, 497 wire calls; `stable-v1` managed alternates: 20,191–20,247 ms (E239: 50.7 s) | — | E247 ab |

### Offline MIDI files (E265, E267)

`read_midi_file` and `write_midi_file` use zero host calls, turns, cold reads,
and host write stages. The call-budget test asserts this. Import reads one
local file; export stages, publishes, and verifies one new file. Six operator
files (33–1,682 notes): read 2.8–66.4 ms, write and verify 6.3–59.1 ms.
A generated 16,384-note sequential case: read 522.7 ms, write 455.6 ms,
674,732 FIELDS bytes. Heap after import: 135.2 MiB; RSS: 423.5 MiB. These are
process snapshots, not peaks. Dense overlaps and metadata have separate bounds;
this case does not measure their worst cost. No live-path budget changes.
See [E265](../evidence/experiments/e265-inline-midi-file-conversion.md).

E267 snapshot export keeps the zero host budget. Three original trial snapshots
(72–100 notes) exported unchanged in 10.3–15.6 ms and matched the trial file
hashes. A 16,384-note snapshot took 375.7 ms, with 35.8 MiB heap and 315.0 MiB
RSS after export. One full document validation was removed; one coverage check
per clip was added. The run is not a controlled speed comparison with E265.
See [E267](../evidence/experiments/e267-midi-snapshot-export.md).

### Document files (E269)

`documentPath` and `documentOutputPath` add no host call, turn, cold read, or
host write stage. The 8i19 call-budget test asserts equal counts with and
without a file. A refused destination or a missing input file makes no host
call. The added cost is local: one file read of at most 8 MiB, or one staged
publication and one readback. Measured medians: read 0.26 ms (240,353 bytes)
and 0.50 ms (674,732 bytes); publish and verify 5.7–6.5 ms. Live
`read_launcher_clip` of a 653-note clip: 14 wire calls in each repeated read,
inline 386–412 ms and to a file 401–406 ms. The difference is in the noise of
these three pairs. The client gain is in result size: 251,600 to 1,723 bytes for
the 3,243-note E268 file, and 28.7 to 1.05 KB for the live clip. See
[E269](../evidence/experiments/e269-document-file-paths.md).

### Tempo report and overlap pre-check (E271)

`read_midi_file` reports `sourceTempo`, a fixed summary, not the source
tempo map. File-mode results of the E270 files with 512, 247, and 489 tempo
events: 21,573, 11,194, and 20,655 bytes before; 1,834, 1,773, and 1,774 bytes
after. Read times are unchanged (147–328 ms). No host call.

`add_launcher_clip` and an `edit_launcher_clip` with `intent: replace` check
same-key overlaps of the desired document before any host call. A refused
add made 12 adapter calls (mark 2, tracks 2, read 3, resolve 1, apply 1,
delta 2, clipRead 1) and left an empty clip; it now makes none. A refused
replace made 4 calls (mark, tracks, clipRead, delta); it now makes none. The
call-budget test asserts zero counts. The success budget is unchanged. The
pre-check is one sort and one sweep, in addition to the same check in the
planner: offline median 2.9 ms for 835 notes and 51.2 ms for 16,384 notes
(60 ms at 114,660 overlap pairs), against the 22.2 s largest admitted add
(E256).


## Limits

[E304](../evidence/experiments/e304-focused-grid-reader-live.md) measures V15
focused reads on the baseline and stock presets. Six scratch batches use
7,321 wire calls and 298,116.948 ms of summed call time. The 5,154 graph calls
include discovery refusals. They take 37.614–58.648 ms wire (median 47.380)
and 0.102–3.522 ms document (median 0.421). Graph process-heap deltas are
0–4 MiB; schema deltas are 0–2 MiB. Schema document time reaches 1.954 ms.
The first cold bind takes 67.160 ms wire.

The first 50-module pass reaches the 1,024-call capture ceiling. An 83-module
catalog reaches the host work limit. The revised driver reads paired catalog
entries one module at a time, with header counts before and after, and permits
selected detailed module reads while retaining all atom membership checks.
It keeps 64 modules, 256 schemas, 1,024 captures, and all host caps. Stutter's
83 modules remain outside scope. Complete captures after partitioning use
at most 1,089 work units. The prior whole 50-module catalog used 3,874.

Grid Multi FX has 31 modules, 179 configured atom reads, 750 captures,
29 schemas, and bind/status/release: 782 read-session calls, with an
18.768-second floor at 24 ms per turn. The increase from E302's seven-call
catalog buys parameter/connection coverage and paired membership checks.
This is not a comparable whole-graph performance result.

Final unchanged semantic control reads take 47.837/49.935 ms wire and
3.518/4.751 ms document. Wire times remain inside the E276 range; no comparable
regression over 20 percent is observed. Keep the 48 MiB planning allowance:
process samples do not bound native getter allocation or peaks. Product
budgets and public descriptions v52 stay unchanged.

[E307](../evidence/experiments/e307-grid-write-guard-refusal.md) measures V16
refusals before command entry. Six inspection reads take 45.338–48.318 ms
wire and 3.704–6.261 ms document. Their 19/50-module fixtures use 791/1,567
descriptor work units. Heap deltas are 0–2 MiB; these are process samples.
The complete scratch workflow uses 526 calls and 13,476.156 ms of summed
wire time. No native Grid command ran.

The unchanged control uses the same work counts as E304. Its first captures
take 77.758/78.174 ms wire, over 20 percent above E304; second captures take
47.881/47.982 ms. Document times are 8.520–50.889 ms, also above E304.
The cause is not proved. Do not claim stable control performance from this
run. The V17 continuation remeasures the planned control pairs. V17 adds
one edit-wrapper lookup per snapshot and no bridge call. All other bounds
and the 48 MiB planning allowance remain. Write-path timings are unmeasured.

[E308](../evidence/experiments/e308-grid-write-live-and-factory-lock.md) measures
V17 boolean/mapping write and restore, plus one factory command before a
readback lock. The driver uses 422 calls and 11,176.606 ms summed wire time.
Completed breadth reads take 44.967–49.743 ms wire. Boolean commands take
1.253/0.775 ms native; mapping commands take 4.577/8.196 ms. Factory creation
takes 4.238 ms; disposal is unmeasured. Per-task heap deltas are 0–8 MiB.
The entry control takes 47.402/47.892 ms wire and 3.768/2.969 ms document,
inside 20 percent of E304. The E307 slowdown does not recur in this pair;
its cause remains unknown. The retained lock prevents the exit control pair.

V18 adds at most 256 ownership-scoped identity entries per detached snapshot.
Construction charges against the same 4,096-work/one-second budget and replaces
detached field-14 reads. No bridge call, document task, or command is added.
The 48 MiB planning allowance stays fixed. Factory live cost needs process
recovery. Hello adds two read-only marker calls; the driver reuses its existing
status calls. Product call budgets and descriptions v52 remain unchanged.

[E310](../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md)
measures the completed V18 factory-only case: 13 protocol/guard calls, nine
document tasks, two native commands, and eight snapshots. Fixture setup,
cleanup, and both control pairs total 235 logged calls and 6,818.363 ms summed
wire time. The detached read pair takes 46.719/47.298 ms wire and 1.612/1.277 ms
document, with 1,218 work units each. Initial/disposed fixture reads use 791
work units. Native creation takes 3.058 ms; disposal takes 0.298 ms. Replies
are 5,163–7,487 bytes; document-task heap deltas are 0–2 MiB. The 236-object
owned tree stays inside the 256-object cap. These samples do not bound peaks.

E310 control wire times are 47.586–49.313 ms, inside 20 percent of E304 at the
same 1,606 query/278 graph work. Document times are 5.224/3.591 ms at entry
and 7.441/4.189 ms at exit. First captures exceed the 20 percent document-time
threshold; the cause is unproved. The initial factory-baseline read is also
slower than E308's prewarmed sample. No stable document-time bound follows.
No write is repeated for timing. Product budgets and descriptions v52 stay
unchanged; the 48 MiB allowance remains a planning figure.

[E306](../evidence/experiments/e306-bounded-grid-writer-preparation.md) prepares
the V16 research writer. Its
[cost model](../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#v16-cost-model-and-live-continuation)
counts 13 calls and nine document tasks per case. Three cases use six
commands and 24 descriptor snapshots, including pre-command checks.
Each snapshot keeps 4,096 work units, a one-second traversal deadline,
64 modules, 256 children, and a result below 1 MiB. The factory retains
at most 256 owned objects at depth 12. Two bounded inspections are permitted
after uncertainty; a command is never repeated for timing. Fixture work and
control reads retain the E302 model. The 48 MiB host allowance remains a
planning figure. E308/E310 supply the bounded live measurements above.
The product adapter and wire-call budget tests pass without a budget change.

[E303](../evidence/experiments/e303-focused-grid-reader-preparation.md) prepares
V15 selective schemas and focused atom reads. A schema request selects at
most 64 relationships and returns at most 256 child headers total. Full
counts remain visible. Graph, path, work, and result caps stay unchanged.
The focused driver permits 256 schemas and 1,024 captures per preset,
plus bind/status/release: 1,283 read-session calls and a 30.792-second
wire floor at 24 ms per call. Typical count depends on the observed atoms.
Full captures go to disk; retained summaries have a 4 MiB cap.
Fixture operations keep the E302 model. Product call budgets stay fixed.

The temporary host-heap allowance is revised to 48 MiB for planning only.
It is neither an enforced bound nor a measured peak. E302's process samples
do not isolate native getter allocation. V15 is deployed, but controller
replacement and matching live measurements are pending. No performance
claim follows from the offline checks.

[E302](../evidence/experiments/e302-stock-grid-survey.md) measures V14 on the
control and stock presets. Control captures take 46.647–49.446 ms, within
E276's 43.599–50.752 ms range. Broad captures take 41.587–52.908 ms wire and
1.454–14.018 ms document; stock graphs are incomplete or refused. Catalog
captures take 45.672–50.491 ms wire and 0.360–3.080 ms document, with
424–2,449 work units and 4,414–30,860 bytes. A complete 31-module inventory
fits. Seven read-session calls suffice per successful catalog preset.
The 13-preset catalog batch uses 1,719 logged calls, totaling 40,694.520 ms
of call time; concurrent public frames make this distinct from wall time.

The driver now parks both survey cursors before scratch deletion. This adds
two bounded points, a track read, and a repeated ownership/selection check;
it prevents the stranded cursor observed after the first batch. Existing
40-poll bounds apply. Catalog heap deltas are 0–2 MiB; broad deltas are
2–38 MiB. These process samples do not isolate allocation or peak memory.
The earlier 8 MiB allowance is not supported as a bound. Session 9b.2a must
revise the model from focused traversal. No graph cap was raised, and no
full-stock-graph performance claim is made. Product call budgets stay fixed.

[E301](../evidence/experiments/e301-reusable-grid-survey-reader.md) prepares
reusable V14 reads under the unchanged `probe.gridRead` method. Descriptor
traversal and graph limits remain unchanged. The driver adds schema
discovery and scratch setup: at most 64 schemas and 34 captures per preset,
plus bind/status/release (101 read-session calls). The
[session model](../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b2--scratch-reader-and-survey-continuation)
sets fixture/poll bounds and cites existing public setup costs. The earlier
8 MiB temporary-host-heap allowance per capture is a planning figure.
This was an offline model at E301. E302 below supplies live measurements;
product call budgets do not change.

[E300](../evidence/experiments/e300-grid-survey-preflight.md) measures the
survey preflight only: 15 sequential wire calls total 347.033 ms, including
one refused bind at 28.451 ms. Four identity reads precede five state reads,
the refusal, and the same five state reads. V13 refuses on the used audio
session before document work. No graph, query-work, document-time, or heap
result was produced. Host work uses existing status paths and two bounded
256-slot track scans. There is no fixture write or added product call.
The E276 read model below is unchanged. A refusal is not a comparable
graph-read timing sample. The continued survey must measure its new reader,
schema discovery, and fixture workflow in 9b.2.

9a research ([E274](../evidence/experiments/e274-grid-root-read-and-contents-bridge.md)):
V1 reads only two outer-device nodes, not the Grid contents. Bind took
81.573 ms; two captures took 47.393 and 48.148 ms, with 82 work units and about
5.26 KiB per graph. Document tasks took 3.857 and 1.050 ms. Heap samples show
zero change, not a peak or retained-heap bound. These numbers do not measure
a complete four-module read. The trace has 16 wire calls, including entry,
route settlement, bind, two captures, selection check, and release.

[E275](../evidence/experiments/e275-grid-dsp-walk-and-scoped-discovery.md): V2
reached 56 internal DSP nodes in 48.016 ms wire time, with 507 work units,
43,086 graph bytes, and a 7.532 ms document task. Heap samples increased by
2 MiB. The capture is incomplete. The larger document time reflects the larger
scope; the failed walk was not repeated as a performance benchmark.

V3 adds one-object schema reads and explicit property projections. It uses the
same wire turns, with bounded local path scans and a final identity-route check.
Navigation, schema/field scans, and projected visits share 4,096 work units;
the final route check has a separate bounded path budget. No wire call or write
stage is added to a successful capture. A returned incomplete graph adds one
public selection read at exit for failure evidence. [E276](../evidence/experiments/e276-grid-semantic-read-and-value-probe.md)
measures V3 on four modules and two cables: 53 nodes, 278 graph steps, 1,606
shared query steps, and about 35.8 KiB per graph. Twelve semantic captures take
43.599–50.752 ms on the wire; document tasks take 4.806–14.228 ms. The first
projection is cold; later tasks take 4.806–8.983 ms. Heap samples change by
0 or 2 MiB. These are not peak or retained-heap measurements. The full paired
workflow uses 15 sequential wire calls. V2's incomplete read took 48.016 ms;
wire cost is comparable despite the new semantic scope. Document-time variation
is not a product regression; all per-call samples remain in the E276 data.

[E277](../evidence/experiments/e277-grid-value-write-readback-and-persistence.md)
measures V4: four guarded parameter writes take 44.019–47.623 ms each on the
wire, with 2.306–11.910 ms document tasks. The first task is cold; the repeated
50% to 60% task takes 2.306 ms. Twenty-eight semantic reads take
39.680–52.089 ms wire time and 1.079–10.313 ms document time. Each graph has
53 nodes and 35,827–35,828 bytes. Heap samples rise by 0 or 2 MiB; peak and
retained heap remain unmeasured. The engine was inactive during this run.

One write workflow has 18 wire calls: two before reads, one request with a
fresh guard capture and mutation, two independent after reads, and entry,
route, selection, and release calls. Summed wire time is 522.946–583.424 ms,
plus 150 ms explicit driver settlement and client overhead. The primitive
budget excludes that setup. No measured wire regression exceeds 20 percent
against E276. All per-call samples remain in E277. The 16-module/24-cable
fixture is unmeasured and can hit the 4,096-work cap. Product budgets do not
change.

[E278](../evidence/experiments/e278-grid-cable-probe-preparation.md) prepares
V5 cable connect/disconnect on the same four-module fixture. The planned
workflow keeps 18 wire calls and five core calls: two before reads, one fresh
guard capture with one mutation, and two after reads. At the E277 rate, allow
about 240 ms for the core calls and 550 ms summed wire time, plus 150 ms driver
settlement. Cable validation adds local scalar and edge checks and two bounded
atom paths. It adds no wire call. Plan up to 8 MiB temporary heap per capture;
this is not a measurement. The largest admitted cable writer is also four
modules, with only the spare input's Sine edge allowed. E279 measures this
plan below. Product call budgets remain unchanged.

[E279](../evidence/experiments/e279-grid-cable-connect-disconnect-and-persistence.md)
measures four V5 cable writes at 45.601–46.406 ms wire and 4.388–11.801 ms
document time. Repeated connect is 45.601/9.240 ms. Each 18-call workflow sums
to 521.060–558.560 ms wire time, plus 150 ms explicit driver settlement. The
first cold semantic read is 71.931 ms wire and 26.122 ms document time, 38%
above E277's maximum wire read. All 35 later reads are 42.904–50.187 ms.
The explicit timing repeat is 45.274/46.325 ms wire and 2.518/3.787 ms document.
Extra cold work is consistent with a later host completion turn; its exact
JVM cause is unprofiled. Keep this cold outlier as a limit. Graphs have 53 nodes,
35,827–35,829 bytes, 278/279 graph steps, and 1,606/1,607 query steps. Heap
samples rise 0 or 2 MiB. The engine is inactive; no peak-heap or sounding claim.

[E280](../evidence/experiments/e280-grid-retarget-and-module-delete-probe.md)
measures three V6 retargets at 44.320–47.627 ms wire and 2.511–8.173 ms
on the document thread. The matched forward repeat is 44.320/7.601 ms.
The five-write sequence uses 18 calls per workflow, with 512.966–575.496 ms
summed wire time plus 150 ms explicit settlement. Forty reads take
43.048–50.489 ms wire and 1.030–7.521 ms document time. No wire regression
exceeds 20% against V5. The first cold write takes 15.415 ms document time,
31% above V5's maximum. V6 adds one bounded source path; the share of cold
class/JVM work is unprofiled. The repeated retarget stays below V5's maximum.
Retain the cold cost as a limit, without assigning an unproved cause.
Graphs remain 53 nodes, 35,827–35,830 bytes, 278/279 graph work, and
1,606/1,607 query work. Heap samples rise 0–2 MiB for reads and 2–4 MiB for
commands; V5 commands sampled 2 MiB. Peak and retained heap remain unmeasured.
The engine was inactive. Product budgets do not change.

[E281](../evidence/experiments/e281-grid-module-delete-and-persistence.md)
measures four V7 module deletions. The first isolated call takes 70.793 ms
wire / 28.300 ms document; its repeat takes 48.489 / 14.844 ms. Connected
deletion takes 43.753 / 9.274 ms and repeats at 47.189 / 10.309 ms. Each
write workflow retains 18 calls and five captures. The five workflows,
including cable setup, sum to 541.234–604.460 ms wire plus 150 ms settlement,
against a 550 ms plan. The first delete exceeds V6's write maxima by 49%
wire and 84% document. Native removal and reference cleanup differ from a
cable setter; the share of cold JVM work is unprofiled. Both matched repeats
are below V6's document maximum and within 2% of its wire maximum.

The 38 reads take 45.806–89.029 ms wire and 0.951–6.109 ms document time.
The first delete's first after read has 50.456 ms queue wait and accounts for
the 76% wire increase over V6's read maximum. The isolated delete repeat and
final reads do not reproduce it. Final reads take 48.081/48.405 ms with about
0.12 ms queue wait. Retain the first-delete and queue outliers as limits.
The 53-to-45-node delta has 30,217–35,829 graph bytes, 235–279 graph steps,
and 1,379–1,607 query steps. Delete heap samples rise 4 MiB against the 8 MiB
plan; reads sample 0–2 MiB. Peak/retained heap and DSP adoption are unproved.
Product budgets do not change. The exact saved baseline is restored.

The next factory probe's pre-implementation model is in
[9a](../plan/phase-9/9a-live-grid-editing-spike.md): 18 wire calls, five fixture
captures, two detached-module captures, and one construction/disposal stage.
Plan about 600 ms warm wire plus 150 ms settlement and 16 MiB temporary heap
for one fixed Amplify type. Native template copying, initialization, and
disposal explain the increase over V7's plan. Cold file I/O/cache waits are
unmeasured and cannot be cancelled by the reader deadline.
[E282](../evidence/experiments/e282-detached-grid-factory-probe-preparation.md)
completes the failure-path design and prepares V8. The ownership walk permits
256 objects, depth 12, and a 1-second check deadline. It adds local reads only.
The native child-list allocation and disposal cannot be cancelled either.
Offline checks pass. E283 supplies the two live measurements below. Product
call budgets do not change.

[E283](../evidence/experiments/e283-detached-grid-factory-lifecycle.md) passes
V8's detached factory gate. First/repeat requests take 65.623/45.402 ms wire
and 25.595/12.924 ms document time. Native construction takes 4.381/0.863 ms;
disposal takes 0.818/0.073 ms. Each workflow retains 18 calls and sums to
590.554/508.250 ms wire plus 150 ms settlement, within the 600 ms plan.
Both calls prove and dispose 77 owned objects. Detached captures have eight
nodes and 5,826 bytes. Heap samples rise 4/2 MiB against the 16 MiB plan.
Peak and retained heap remain unmeasured. First/repeat costs are below the
respective V7 isolated-delete costs. No cold-cache claim is made.

Eight independent fixture reads take 44.271–48.277 ms wire and
2.789–12.922 ms document. The first document read is 112% above V7's maximum;
the immediate repeat is 6.872 ms and all later reads are below V7's 6.109 ms.
The read code and graph scope are unchanged. The first-use cost is not
reproduced; JVM warm-up is plausible but unprofiled. Retain this limit.
All fixture graphs have 53 nodes and 35,828 bytes. The exact baseline is
preserved. Product call budgets do not change.

The plan's next attachment stage budgets 18 calls, five fixture captures,
two detached captures, one construction stage, and one native insertion edit.
Allow 650 ms warm wire plus 150 ms settlement and 16 MiB temporary heap for
four-to-five modules and two cables. Edit bookkeeping, ownership transfer,
notifications, and a bounded layout pass replace detached disposal. The
61-node after read and native attachment are not measured yet.
[E284](../evidence/experiments/e284-native-grid-attachment-design.md) completes
the [attachment design](../plan/phase-9/9a-native-attachment-design.md).
Checked edit admission/close, selection, membership, and rectangle witnesses
add local reads within the same 18 calls. There is no added success-path wire
turn or write stage. At about 24 ms per turn, 18 turns give a rough 432 ms
transport floor; document queue/completion adds cost. The fixed typical and
maximum cases are equal. Allow one first-use read and unbounded native cold
file I/O; no cache-cold timing is claimed. The layout model has five rectangles
and at most 16 row slots. The proposed failure-only diagnostic path adds at
most four wire calls, two captures, and zero writes after native completion
(about 96 ms transport floor). A task that never finishes has no finite
recovery-time estimate. No runtime path changed in E284; live measurements
and product call budgets remain unchanged.

[E285](../evidence/experiments/e285-native-grid-attachment-probe.md) implements
and checks V9. The tested driver keeps 18 success calls and four failure-only
recovery calls. A cached status request can add one failure-path call, with no
document task. The paired native-witness read workflow for undo/redo/reload uses
15 calls when the cursor settles on its first poll. One probe-only cursor-mute
Boolean subscription is added at initialization. Native edit, selection,
rectangle, and relationship-limit checks add bounded local work. No product
call budget or normal-profile observer changes. The 650 ms warm-wire and 16 MiB
heap figures remain plans. No V9 live measurement ran: operator replacement,
fresh hello, and the first/repeat comparison with E283 are the next gate.

[E286](../evidence/experiments/e286-grid-attachment-witness-wire-fix.md) measures
V9's pre-factory refusal and single recovery. The refused workflow has 15 calls
and 626.410 ms summed wire; recovery has four calls and 140.707 ms. Factory and
insertion counts are zero. Entry native-witness reads take 96.183/66.165 ms wire
and 52.368/33.517 ms document time, above E283 by more than 20 percent. The
recovery pair falls to 46.912/45.806 ms wire and 15.002/12.189 ms document time.
New reflection and native witness checks add local work; first-use class cost
is plausible but not isolated. This is no successful attachment budget claim.
Heap samples rise 4/2 MiB at entry and 2/2 MiB in recovery. V10 corrects absent
focus encoding with no added call, observer, or native stage. Its live timing
is pending replacement and a fresh hello. Product call budgets are unchanged.


[E287](../evidence/experiments/e287-grid-attachment-managed-identity.md) measures
V10's insertion and successful edit close, followed by a managed-ID readback
stop. The 16-call stopped workflow sums to 528.919 ms wire plus 150 ms settle;
four recovery calls sum to 153.445 ms. The command takes 71.902 ms wire and
27.789 ms document time, 9.6%/8.6% above E283's first detached request.
Native factory/start/insertion/close take 2.824/0.511/5.592/2.421 ms. Insertion,
layout, and edit bookkeeping replace disposal. The command heap sample rises
8 MiB versus E283's 4 MiB first sample; the added witness/edit/notification
allocation share is not isolated. It remains below the 16 MiB plan, with no
peak or retained-heap claim. The lock forbids a timing retry; measure V11's
successful repeat after operator recovery.

Entry reads take 46.264/47.705 ms wire and 6.450/8.795 ms document time, within
E283 maxima. Recovery document reads take 8.452/11.159 ms. Every read heap
sample rises 2 MiB. The new 61-node graph encodes 41,407 bytes, below 42 KiB.
No complete success-budget claim follows from this stopped workflow. V11 adds
two fixed descriptor steps and native ID/context/registry reads inside the
existing task, with no added wire call, capture, observer, or write stage.
The fixed typical/maximum case retains 18 success calls, 650 ms warm wire plus
150 ms settlement, and 16 MiB temporary heap. V11 live measurements remain
pending operator inspection, baseline reopening, replacement, and fresh hello.
Product call budgets and descriptions v52 remain unchanged.

[E289](../evidence/experiments/e289-native-grid-attachment-and-persistence.md)
passes the V11 attachment sequence and exact baseline restoration. The first
and repeat workflows keep 18 calls and sum to 567.499/558.234 ms wire, plus
150 ms settlement. Both are below the 650 ms warm-wire plan. Command wire time
is 89.021/94.790 ms; document time is 45.332/48.108 ms. Factory/start/insertion/
close times are 2.106/0.239/7.485/3.781 ms first and
4.359/0.379/15.475/3.426 ms repeat. Command heap samples rise 6/4 MiB, below
16 MiB. Typical and maximum scope remain one fixed four-to-five-module edit.

Against E283's corresponding detached calls, command wire time rises 36%/109%
and document time rises 77%/272%; total workflow time changes by -4%/+10%.
Attachment adds edit, registration, layout, ownership, and selection work and
replaces detached disposal. The matched repeat retains the higher command
cost. Queue time is 0.126/0.109 ms. Insertion itself varies by 7.990 ms between
samples. The remaining JVM, witness, and notification shares are not isolated.
Both factory attempts are used; there is no third request or cold-cache claim.

Seven paired witness-read workflows each use 15 calls plus 150 ms settlement.
Across their reads and insertion before/after reads, 22 captures take
4.127–21.860 ms document time. The maximum is 69% above E283's 12.922 ms.
The matched final four-module pair takes 18.432/5.813 ms, so the first-read
increase persists without graph growth. Native witnesses add bounded local
work; no isolated cause is proved. Keep the measured limit. Graphs have 53/61
nodes, 35,828/41,407 encoded bytes, 278/321 graph steps, and 1,606/1,833 query
steps. Read heap samples rise 0–2 MiB. No peak or retained-heap claim follows.
The engine remains inactive. No runtime, product call budget, or public
description changes in this continuation; descriptions remain v52.

[E292](../evidence/experiments/e292-grid-engine-quiet-gate-refusal.md) measures
V12 preparation at 16 calls, 559.277 ms summed requests plus 150 ms settlement,
and 83,739 response bytes. The two document reads take 29.060/19.389 ms and
sample 4/2 MiB heap rises. The first exceeds E289's 21.860 ms maximum by 33%;
it is the first V12 read, and engine guards and cold work are not isolated.
The second is within that maximum. No timing retry is permitted.

The active run refuses Q0 before any note, graph edit, or factory. Five calls
sum to 126.663 ms plus 1,250 ms dwell; successful responses total 2,189 bytes.
Begin/window-begin document times are 13.264/5.864 ms with no sampled heap
rise. The client-shape refusal before probe bind adds eight calls and
184.959 ms separately. Restoration uses 16 calls, 464.713 ms plus 150 ms
settlement, and 82,607 response bytes. Its document reads take 43.544/19.600 ms
with 2 MiB sampled heap rises. The first is 99% above E289's 21.860 ms maximum;
the second is within it. Reopened-target work, JVM activity, and new guards
are not isolated causes. No retry is allowed. Retain the 43.544 ms limit and
investigate it in the next design session. The completed prepare/refusal/restore
path uses 37 calls and 1,150.653 ms summed requests, plus 300 ms settlement and
1,250 ms dwell. The full 252-call
path and attachment estimate remain unmeasured. Callback allocation, native
engine memory, and process-memory delta are not measured. Product budgets and
descriptions v52 do not change.

[E290](../evidence/experiments/e290-grid-engine-adoption-design.md) completes the
[engine adoption design](../plan/phase-9/9a-engine-adoption-design.md), without a
runtime change or live measurement. Its fixed five-module, three-cable maximum
uses 252 wire calls, 59 fixture captures, two detached captures, 20 fixed meter
witness tasks, 11 graph edits, one factory, and 16 note writes. Ten signal
windows add at most 20 scheduled host turns: a rough 272-turn / 6,528 ms floor.
Plan 9 seconds warm request latency, 1.95 seconds cursor settlement, and
12.5–20 seconds window dwell, about 24–32 seconds plus operator work. Timer
turns overlap dwell. Typical and maximum graph scopes are the same.

[E291](../evidence/experiments/e291-grid-engine-probe-implementation.md) implements
this budget. Offline tests assert 252 calls, 59 captures, one factory,
11 graph edits, ten windows, and 16 note stages. Prepare/run/restore use
16/220/16 calls. One abort and one cached status call can be added on failure;
they have no document task. Recovery remains four additional calls. The probe
adds one master handle with zero scenes, two VU subscriptions, and one note
subscription at initialization. Sixteen note boundary document tasks have no
wire call. Their host and native cost remains unmeasured. The sample arrays
use 32 KiB before object overhead, within the 64 KiB buffer limit. Normal and
capture allocations and product call budgets do not change. V12 is built but
not deployed; live cost measurement belongs to the next 9a session.

The attachment stage keeps the 18-call shape. Its 60 ms active-engine document
estimate is about 25–32% above E289's 45–48 ms. Protocol serialization and
active connection work are hypotheses for this allowance, not measured causes.
The extra graph stages and signal windows account for the full-test cost.
Future live evidence must compare the matching command/read costs and explain
increases above 20%. No new regression is claimed here.

Budget 16 MiB temporary Java heap per graph stage, plus a 64 KiB fixed sample
buffer and a 128 KiB encoded window response. Stream results. Native engine
heap, first activation, symbol work, cache misses, and blocked native work have
no measured bound. Failure-only recovery adds four calls (about 96 ms floor)
and two captures after native completion, with zero graph writes and at most
one outstanding owned note-off. Product call budgets and descriptions stay
unchanged. V11 remains loaded with both attempts used and the engine inactive.

[E293](../evidence/experiments/e293-continuous-grid-signal-design.md) defines the
[continuous-signal replacement](../plan/phase-9/9a-continuous-signal-design.md).
It makes no runtime change or live measurement. Its planned 248 calls are
16 prepare, 216 run, and 16 restore, with 59 fixture captures, two detached
captures, 11 graph edits, one factory, eight signal windows, and zero note
writes. Sixty-four timed paired-meter tasks replace note boundary work.
Window begin/collect add 16 more document tasks. There are 72 timer entries
and at most 64 controller completion deliveries. The 248 wire turns have a
5,952 ms unit-cost floor; counting 136 scheduled entries separately gives a
rough 384-unit / 9,216 ms model, not distinct host turns. Scheduled work
occurs inside dwell and must not be added twice.

Typical and largest scope remain five modules and three cables. Plan 750 ms
warm wire per graph stage, 1.20 seconds prepare/restore, and 0.432 seconds for
window/control calls: 9.882 seconds, rounded to 10. Add 1.95 seconds cursor
settlement and 18–20 seconds dwell: about 30–32 seconds plus operator work.
The 100 ms increase from the earlier 650 ms stage plan reserves room for
observed read variance and measurement work. It does not identify their cause.
Temporary Java heap stays 16 MiB per graph stage, with 64 KiB sample storage,
128 KiB signal/failure response, and 1 MiB graph response. Failure adds at most
two cached calls and four recovery calls, with two captures and zero writes.
Cold/native work and checkpoint CPU remain unmeasured. Product budgets and
public descriptions v52 stay unchanged.

E293 derives E292's first restoration read as 43.544 ms document time:
21.241 ms graph traversal and 22.303 ms other document work. The second is
19.600 ms: 7.453 ms traversal and 12.147 ms other work. Queue waits are
0.381/0.369 ms; graph scope is equal at 53 nodes and 278 work steps.
Preparation's 29.060/19.389 ms reads have 6.812/8.513 ms traversal. The residual
includes byte accounting, guards, witnesses, validation, and copies; it does
not isolate any one component. Keep the 43.544 ms observed maximum, 99% above
E289, without assigning a cause. Instrument these components in existing calls
and compare the next admitted pairs. Do not add reads or repeat restoration.

The replacement is conditional on a read-only valid-packet witness: `DxI.EbT`
also advances during invalid-packet decay. Its trace is the next planned
session, before implementation. V12 remains loaded, used, and locked. No new
freshness or DSP claim follows from this cost model.

[E294](../evidence/experiments/e294-grid-valid-packet-witness-trace.md) completes
the offline receive-path trace with `fresh-meter-evidence-unavailable` in that
path. Validity is not retained by the meter cache. Document update and polling
counters do not prove per-meter validity or age; raw shared-memory publication
and coherent reads remain unproved. E293's 248-call model is still conditional.
No accessor was proved to fit its fixed snapshot task. A separate observable
design must supply the mechanism and costs before implementation.

E294 adds zero live host turns, cold reads, write stages, subscriptions, and
probe heap allocation, for both typical and maximum cases. Offline work is
34 exact bytecode inspections and a jar metadata scan. No runtime path,
product call budget, or description changes. The 43.544 ms read maximum and
its unisolated cause remain unchanged. Keep the 16-call final restoration
budget and planned component timing inside existing calls. V12 remains loaded,
used, and locked; no new live timing or DSP claim follows.

[E295](../evidence/experiments/e295-grid-observable-design.md) completes the
[observable comparison](../plan/phase-9/9a-observable-design.md) with no admitted
candidate. The native meter producer is unresolved. A separate visualization
reader writes shared state and copies dimension-dependent data; it has no
proved fixture/master binding, age, or finite admitted heap cap. Public VU
callbacks can forward old cached values at binding. No accessor is selected.

E295 uses zero live calls, host tasks, cold live reads, writes, subscriptions,
and probe heap in both typical and maximum cases. It adds no runtime path or
product call-budget change. The offline reproduction has eight bytecode
inspections, nine native metadata outputs, five bounded disassembly ranges,
one thin-slice extraction, and a jar name scan. E293's conditional model is
recalculated as 248 calls (16/216/16), 80 window tasks, 136 scheduled entries,
59 fixture/two detached captures, 11 edits, one factory, and zero notes.
Planned elapsed time is 29.832–31.832 seconds plus operator work. The 5,952 ms
wire and 9,216 ms scheduling-unit floors overlap dwell. These are not live
measurements or an approved budget for a new accessor.

A future mechanism must budget its actual extra tasks/calls and witness fields.
The existing 16 MiB graph heap, 64 KiB sample store, 128 KiB signal response,
and 1 MiB graph response are conditional. Keep the final 16-call restoration
and component timings inside existing calls. The unexplained 43.544 ms read
maximum is unchanged. The next session is bounded offline native producer
reconstruction. V12 remains used and locked; descriptions remain v52.

[E296](../evidence/experiments/e296-grid-operator-audio-acceptance.md) replaces
the automated signal gate with [operator audio acceptance](../plan/phase-9/9a-operator-audio-test.md).
This documentation session uses zero live calls, tasks, cold reads, writes,
subscriptions, and probe heap in both typical and maximum cases. No runtime
path or public description changes; descriptions remain v52.

The proposed step-controlled runner uses 240 calls (16 prepare, 208 run,
16 restore), eight cache-only operator acknowledgements, 59 fixture/two
detached captures, 11 edits, one factory, and zero notes. Eight acknowledgements
replace 16 meter boundary calls; all 80 window document tasks and 136 sampler
timer/delivery entries are removed. Structural scope stays five modules and
three cables. At 24 ms per call, the wire floor is 5,760 ms. The warm request
allowance is 11 × 750 + 1,200 + 240 = 9,690 ms, plus 1,950 ms cursor settlement
and operator time. Human pauses create no polling calls. The session allowance
is 15 minutes, with 60 seconds per automated segment; neither bounds a blocked
native task. Engine activation and temporary unmute are operator actions,
recorded separately from bridge calls.

Keep 16 MiB graph heap and 1 MiB graph response. Eight bounded answer records
and the first failure have a 16 KiB encoded cap; status/ack responses have a
32 KiB cap. These replace the signal sample/response caps. Cold symbol work,
initial reads, activation, factory file I/O, and reopen work remain unmeasured.
Failure adds at most two cached calls and four recovery calls, with zero graph
writes. Final restoration stays 16 calls. Preserve the unexplained 43.544 ms
read maximum and component timings inside existing calls. This is a design
budget, not a live measurement. The next session implements and checks it;
native meter reconstruction is deferred and no longer gates 9a.

[E297](../evidence/experiments/e297-grid-operator-audio-probe.md) implements
that fixed 240-call model. Offline tests confirm 16/208/16 calls, 59 fixture
captures, one factory, eleven edits, eight acknowledgements, and zero notes.
There are 73 document tasks: 59 fixture captures, 13 binds, and session begin.
The two detached captures share the factory command task. Existing per-task
watchdogs and completion delivery remain. One new cache-only expiry timer
locks the session after 15 minutes. Client loss adds one controller notification;
there is no polling during a pause. Neither event queues an edit or native read.
The maximum response reserves 1 KiB for timing metadata inside the 1 MiB cap.
Bounded answer/failure evidence remains 16 KiB, with a 32 KiB status cap.

Read timings now separate controller symbol lookup, queue delay, guard/target
reads, engine symbols, navigation/projection, graph traversal, nested property
byte accounting, final graph byte accounting, witness symbols/read, validation
copies, mutation/prediction, response size check, and completion delivery.
Nested timings must not be added to their parent totals. No extra capture or
wire call is added. The 16 MiB temporary graph-heap figure remains an allowance,
not an enforced allocation cap. Native and retained heap remain unmeasured.

V13 is deployed; no live measurement has run. The next admitted listening run
must report actual costs and explain any regression over 20 percent. E292's
43.544 ms maximum remains unexplained. Product budgets and descriptions v52
are unchanged; their offline call-budget and adapter-frame checks pass.

[E298](../evidence/experiments/e298-grid-operator-audio-live-test.md) passes
V13 inactive preparation in 16 calls: 464.600 ms of requests and a 150 ms
cursor wait, below the 1.20-second allowance. Cold controller symbol lookup
costs 38.452 ms. Paired traversal times are 3.059/2.943 ms; document task times
are 16.865/8.224 ms. The first read adds 3.032 ms navigation/projection,
3.015 ms witness symbols, and 4.368 ms witness reads. No read exceeds the older
43.544 ms maximum. Its cause remains unproved; no timing retry was made.
The active listening run then passes in 208 calls and 6,488.068 ms of requests.
Its eleven 18-call stages take 555.026–615.633 ms each, below the 750 ms
allowance. Maximum traversal is 8.855 ms. The largest document task is
34.120 ms at stage 3, including 28.086 ms for mutation and prediction. E292
has no comparable active-stage measurement. No measured traversal exceeds its
43.544 ms maximum; that older cause remains unexplained. Final saved-baseline
restoration passes in 16 calls and 434.641 ms. Its traversals take 4.225/1.589 ms;
document tasks take 12.539/8.200 ms. The full 240-call workflow takes 7,387.309 ms
of requests, below the 9,690 ms allowance, plus 1,950 ms cursor wait and operator
time. It uses 59 fixture/two detached captures, one factory, eleven edits, eight
answers, and zero notes/recovery calls. No timing retry was made.

8i3 review rerun (E252): Polysynth 44 controls 9,481 ms; Diva 64 controls
13,912 ms; staged 5×1 / 3×2 / 2×3 compositions 20,975 / 23,642 / 23,278 ms,
with reversals 21,922 / 26,028 / 26,764 ms. No time regressed by more than
2 percent. Call budgets stay unchanged. The observer-index guard adds no
call on success; a failed rename batch now uses proved receipts and removes
one structure read. E252 records the wire-count differences from host proof
polls and links the full traces.

| Limit | Value | Source |
|---|---:|---|
| Reader sounding cells | 2,097,152 | E246 (the guard counts after the replay) |
| Heap at 4.2 million cells | 3,072 MiB maximum reached | E246 |
| Heap failure | 8.4 million cells | E236 |
| MCP client request timeout | 60 s | E45 |
| Writer window (pool cursors, `fineSteps`) | 4,194,304 steps (the reader width; was 512); fixed at extension start. A writer parks after each write. The adapter refuses note writes on a narrower writer (`WriterWidthError`, `unhealthy`). The 2,048-step window is the separate `fine` read cursor (`noteReadSteps`, E52) | E44, E52, E248, D41 |
| Add at the reader limit, ZGC used peak | 2,450–2,786 MiB of 3,072 (the read alone: 2,168–2,196) | E248 |
| Dense `cursor.getNotes*` scan without `maxX` | 8,192 steps | E248 |
| Longest admitted direct call | `set_launcher_clip_properties` of 8 clips of 16,384 notes, 33.5 s (its revert 32.8 s); E247 stated the staged composition of 4 layer chains (30.6 s), but 5×4 took 102 s | E252, D44 |
| Track mixer tracks in one call (`read_track_mixer`, `set_track_mixer`) | 8 (a plan bound: 8 tracks cost the same turns as 1) | E257, D48 |
| D44 write limits | `compose_devices` 6 device units (plug-in 2, a device with modulators 2 more) and 4 modulators; `set_device_controls` 64 settings on 4 routes; `delete_device` 10; `set_device_enabled` 32; `rename_track` and `delete_track` 64; clip properties and launch settings 8 (host); copy 8; delete 4; move 8 rows; wrap 15 modulators (host). Refusal: `outside-limit` before any read or write; each bounded input states its limit in its schema text | D44 |
| Launcher content events (`Rig.CONTENT_LOG`) | 24; a revert compares across them | E252 |
| Remote-page window (`remotePages`) | 16 pages | E252 |

## Known costs for later sessions

Each item is a measured cost with a named cause. None needs a fix before 8i.

- `read_launcher_clip` spends about 240 ms in 9 control turns around its
  190 ms capture: the mark, the selection borrow (D6), three slot checks,
  the post-read slot check, and the end mark and delta (D32). A repeated read
  takes one more delta for the prior ref.
- `check_launcher_clips` takes a mark for the registry sweep before its read
  mark (one turn).
- Whole-clip rewrites of notes with nondefault expression need one property
  stage for each channel, each after a grid settle (1.9 s for the typical
  clip, E248). This is now the part of a clip write that grows with the
  content. E15-F forbids a shared
  property stage across clips; a shared stage for the channels of one clip is
  a candidate that needs its own live proof.
- A device control route reads three complete settled parameter inventories:
  the change record, the integrity check after the last stage, and the
  executor readback (D15). The stages before the last read the live
  generation (two polls, E252). The fixed cost is about 2 s for each native
  route and 3.4 s for a 281-ID plug-in.
- `add_launcher_clip` resolves twice (creation, then the edit limb) and is two
  change records; reverting it takes two calls.
- `launch_clip` on `agent-native-v1` checks the track and the occupancy
  first: about 3 turns over `stable-v1`.
- `compose_devices` offline proves each layer chain and its device after the
  insertion (about 100 turns); the staged backend pays one insertion and one
  relocation for each device, about 3.5 s each way, and its revert as much
  (D44 bounds it at 6 units).
- `delete_device` of one container is about 100 wire calls (bank reads and
  two parameter inventories for the change record).
- `read_device_controls` on a 281-ID plug-in takes about 1.3 s for each read,
  also for the same target. The cost of a plug-in route or removal grows with
  its DirectParameter count, which Ghostnote cannot know before it reads.
- `set_launcher_clip_properties` captures each clip twice; at the reader limit
  8 clips take 33.5 s.
- `read_launcher_clip` returns all 16 channels (about 12 KB for the typical
  clip); an edit needs a read for its base.
- `wrap_existing_device_modulation` takes about 10 s: five structural stages,
  the fingerprint, and the page checks. D46 removed the behavior witness
  (E254); `stable-v1` keeps it (14 s).
- `set_layer_chain_solo` and `rename_layer_chain` are 12–14 percent above
  E238. The first E247 inventory, before the 8h4g changes, had the same
  values; no 8h4g change touches their stage.
- `rename_track` reads the bank once to refuse a missing track (+1 call): the
  executor records the rename of a missing track as a failed op.

## 9b.4 offline Grid symbol scan — model before implementation

The scan reads the jar as data. It does not load vendor classes or use the
bridge. Host calls, document tasks, native commands, and waits are zero.
The output is a candidate table. It cannot authorize a live operation.

Bound the input to 64 MiB compressed, 50,000 entries, 40,000 classes,
128 MiB of class bytes, and 1 MiB per class. Read one class at a time.
Retain metadata and normalized structural digests, not the complete jar or
vendor method bodies. Bound members to 1,000,000 in total, inheritance to
128 levels, and structural refinement to two passes. Use a 768 MiB process
RSS refusal threshold and a 120-second scan deadline. Check both between
classes and phases. These checks are refusal thresholds, not OS hard caps.
A single bounded class parse can allocate before the next check.

Cost includes one sequential jar read, one class parse per entry, and
per-class member sorting. Type refinement uses two passes. Candidate search
is indexed by type shape; each member search scans one bounded declaration.
Call traces follow two edges at most, with 4,096 work units. Retain code for
at most 256 classes. Operation-edge checks use the same bounded code cache. Index candidates
by shape. Validation checks the resolved signatures, inheritance, use
traces, and receiver roles. It does not run the required live invariants.
Report fingerprint/hash time, enumeration/metadata time, candidate search,
and validation separately. Report entry/class/member counts, default-package
counts, input bytes, and peak process RSS. Measure one complete 6.0.6 scan;
repeat only if a failure or implementation change requires another check.

[E311](../evidence/experiments/e311-grid-offline-resolvers.md) measures the
completed scan on the 34,686,665-byte 6.0.6 jar: 30,968 entries, 30,940 classes,
454,111 members, and 69,199,765 uncompressed class bytes. The complete scan
uses 4,509.769 ms: fingerprint 12.278 ms; enumeration and metadata 2,757.065 ms;
type refinement 1,355.356 ms; candidate search 379.612 ms; validation 3.879 ms.
These stage times exclude minor CLI overhead. Peak process RSS is 190,709,760
bytes (181.875 MiB). Code is retained for 126 classes; call-trace work is 48.
All 69 member rows and 55 type roles match the pinned oracle. This is one
process sample after development scans, not a cold-disk benchmark or a stable
latency bound. There is no comparable prior resolver measurement. Host-call
budgets and live paths are unchanged.

## 9b.5 Grid doctor — model before implementation

The doctor uses a separate, consent-gated research path. The offline scan
keeps the 9b.4 limits. Transfer at most 128 KiB of candidate metadata and
128 KiB of selectors in the extension resource. Validate 55 types and 72
members without initialization. E312 adds three traced undo roles. Hash at most 64 MiB from the host jar once.
Check its canonical path, size, and nanosecond modification time as well.
An offline pass gives no product write authority.

Use one foreground driver and one native writer. Admit one pass per exact
fingerprint. Keep a durable attempt record before the first scratch write.
Use at most three scratch tracks in sequence, never together. Each is muted.
Record the engine state and connection identity; do not change either.
The fixed scalar/cable/factory/delete/attachment fixture has four modules
(five during attachment), 61 projected nodes at most, and at most 256 owned
objects per detached tree. The two breadth cases keep E310's 64-module,
4,096-work, one-second snapshot, and 48 MiB planning allowance.

Each command needs two prior equal snapshots, a fresh pre-command capture,
and two independent post-command snapshots. Admit at most 16 native command
requests, 64 read requests, and 96 doctor document tasks. Bound one native
task to the existing five-second timeout and four-second pre-call deadline.
A timeout latches uncertainty; do not repeat a command. The timeout cannot
interrupt an entered native command. Limit the complete driver to 1,500
wire calls, 15 minutes, and 64 MiB of retained evidence. Cursor and insertion
polls retain the survey's 40/80 poll bounds and 50 ms interval. Preserve at
most 32 tracks. Scan time, transfer bytes, wire time, queue time, document
time, traversal work, and heap samples must be reported separately. The
heap allowance is a planning bound, not an OS cap. No product latency claim
or product call-budget change is planned.

Acceptance requires every role, scratch teardown, and independent baseline
comparison. An incomplete or failed pass cannot create an accepted cache.

[E312](../evidence/experiments/e312-grid-doctor-preparation.md) records the
preparation scan: 4,607.087 ms, 189,759,488 bytes peak RSS, 126 retained code
classes, and 48 call-trace work units. Candidate and selector resources are
26,143 and 47,585 bytes. The scan is 2.2 percent slower than E311's sample;
this is not a stable latency claim. The successful native plan has 16 command
requests, 38 independent read requests, and three binds: 57 document tasks.
Commands also take fresh before captures. The sentinel checks at most five
512-property schemas per task, with a 64-module relationship bound. Detached
captures repeat the bounded ownership walk and reject foreign references.
These costs remain within the planning allowance. Public call budgets remain
unchanged.

[E313](../evidence/experiments/e313-grid-doctor-undo-failure.md) records the
failed live pass: 445 wire calls, 12,051.603 ms summed wire time, and
1,205,337 successful-response bytes. Runtime metadata validation takes
39.034 ms. The pass attempts 47 doctor tasks: three binds, 30 reads,
13 commands, and one failure inspection. Forty-six tasks return timing
receipts; the failed Undo task does not. Those receipts sum to 240.571 ms
of document work, with a 21.828 ms maximum. Maximum queue time is 1.156 ms.
Core graph/query work is 235–279/1,379–1,607. Core snapshot time is
1.183–8.437 ms. Whole-JVM heap samples peak at 978 MiB; the largest positive
task delta is 8 MiB. A later read reports 404 MiB. These are heap samples,
not retained allocation or peak RSS measurements.

The comparable E308 native samples increase by 66.5 percent for boolean
enable, 130.8 percent for mapping removal, and 116.1 percent for mapping
restoration. Boolean restoration decreases by 27.9 percent. Each is one
sample. Added sentinel work explains a changed task budget, but does not
establish the cause of the native-command increase. No command is repeated
for timing after the Undo failure. Session 9b.5a must account for these
research latency increases when it models a corrected caller. No product
budget or product latency claim changes. The failed pass does not establish
complete teardown cost or live acceptance.

## 9b.5a Undo correction — model before implementation

The V20 candidate keeps 55 types and expands to 76 members. The journal
Undo role is replaced by the traced document Undo method. Four read roles
check the document gate, document manager, journal replay head, and recording
edit. The exact jar, metadata, resource, and offline scan bounds stay the
same. Existing E312 and E313 tables remain evidence for V19.

Keep the same 16 command requests, 38 independent reads, three binds, and
57 successful doctor tasks. Each Undo adds two bounded state captures
around one document Undo call; no begin/end edit is added. Each capture
uses at most 24 reflective getter/field accesses and one lookup in the
existing journal map. Each core witness adds two journal-state getters.
No extra wire call, document task, wait, or projected object is added. The
existing five-module, 256-owned-object, reply, lifetime, and timeout limits
still apply. Exceptions retain the uncertain claim; no replay field is
reset by Ghostnote. No automatic second pass is admitted.

E313's native timing increases remain unexplained by one-sample results.
The correction changes only core Undo and its read guards. It does not
claim to fix boolean or mapping latency. Record the new per-call costs in
the separately authorized live pass. Do not repeat an uncertain command for
timing. Product descriptions and host-call budgets remain unchanged.


[E315](../evidence/experiments/e315-grid-doctor-document-undo.md) measures
V20's offline scan at 4,420.617 ms and 186,974,208 bytes peak RSS. It retains
129 code classes and uses 72 call-trace work units. Candidate and selector
resources are 27,485 and 49,606 bytes. All original scan and resource limits
hold. These are preparation samples; no new live timing is available.
The 9b.5b live session owns the corrected Undo measurements and comparison
with E313. No native command is run for this preparation.


[E316](../evidence/experiments/e316-grid-doctor-606-acceptance.md) measures the
complete V20 pass: 542 driver calls, 15,080.174 ms summed wire time, and
1,671,828 response bytes. Attempt-to-cache time is 16,248 ms; it excludes
preflight. Metadata validation takes 37.818 ms. All 57 planned doctor tasks
return timing receipts: 16 command requests, 38 reads, and three binds.
Document time totals 229.244 ms, with a 28.944 ms maximum; maximum queue time
is 2.294 ms. Core graph/query work is 235–321/1,379–1,833. Core snapshot time
is 1.035–5.362 ms. Whole-JVM heap samples peak at 1,148 MiB, with an 8 MiB
maximum positive task delta. These are not retained allocation or RSS
measurements. A separate seven-call read-only check confirms final state.

Delete Undo takes 3.984 ms, attachment 21.660 ms, and attachment Undo
1.039 ms. Against E313's per-command samples, mapping removal increases
88.3 percent, detached creation 79.4 percent, and disposal 23.3 percent.
Mapping restoration decreases 27.2 percent but remains above E308's sample.
These native bodies are unchanged; the added core witness getters are
outside their command timer. One sample per pass cannot establish the cause.
Keep these research latency limits for the planned 9b.6 comparison. No timing
repeat runs. All admitted bounds hold; public budgets and latency claims
remain unchanged. The complete pass and teardown permit the research cache.

## 9b update audit driver: model before implementation

The offline preparation uses no host call. The live driver uses the normal
product paths below without a new product operation. E247, E250, E252,
E254, E257, E258, E263, and E264 supply the path models. Each write guard adds five serial reads: selection, host version, initialization,
transport state, tracks, and the post-write track/selection pair adds two more.
Each tool call
records elapsed time, wire calls, cold clip reads, and write stages. Operator
pauses have no poll. Lifecycle pauses end the command. A Sampler host export
uses an input pause in the same server session; it adds no host call and its
time is outside the active deadline.

Admit at most eight owned instrument tracks, eight scene rows, 256 notes
per clip, four device units per composition, and 16 controls per call.
The initial fixture uses six tracks and four notes per clip. A duplicate
track uses a seventh track. A manual group can add one group track. Refuse
an entry project with more than eight tracks or eight scenes. Do not add
scenes. A complete snapshot reads at most 16 tracks, 128 slots, 128 small
clips, 16 device banks, and two mixer batches. Device controls are read
only on the bounded owned fixture. Empty entry device banks are required.

Each case has a 15-minute deadline, 6,000 wire-call limit, and 60-second
request deadline. The product keeps its finite settle polls and insertion
deadlines. The driver adds no retry or poll loop. A typical snapshot costs
about 100 wire calls with empty slots; the maximum small fixture costs
less than 1,000. Allow 2,000 calls for a typical case and up to 6,000 for
the structure or Sampler case, including independent reads. This is an
abort bound, not a latency claim. At the E246 24 ms turn cost, 2,000 serial
calls cost 48 seconds before product waits. Independent snapshot calls
are serial. The driver retains at most 64 MiB of evidence per audit,
reserves 2 MiB for failure records, and caps each wire response at 2 MiB.
It writes call records to disk as they complete. A failure ends the write
chain. Inspection is read-only; cleanup requires a separate command.

These bounds do not establish product capacity. Section 2B measures the
actual fixture. Compare only equal per-call workloads. Never repeat an
uncertain write for timing.

[E318](../evidence/experiments/e318-update-audit-614-deployment.md) adds one
local socket inventory command before connection. It distinguishes idle
MCP servers from established bridge clients. It adds no host call or poll
and changes no product call budget. No host timing was measured at deployment.

[E319](../evidence/experiments/e319-update-audit-614-first-entry.md) records
59 preflight, 435 setup, and 188 inspection calls before the driver stops on
the documented absent-entry-slot warning. Six one-track adds take
902.128–924.069 ms and 40 calls each; E258 measured 889–935 ms and 41 calls.
The four-note clip add takes 2,391.151 ms and 74 calls. Its content and entry
selection differ from E258, so this is not a matched clip timing comparison.
The prepared recovery uses two bounded snapshots, at most six existing
delete operations, the current write guards, and a tool log capped at 2 MiB.
It adds no product path or poll. E320 records successful recovery. The entry
precondition adds no host call. The remaining matrix and section 3 comparison
must complete before an upgrade performance verdict.

The control-reply recovery uses two bounded snapshots, one independent
device-bank read, and one existing delete call for three inserted devices.
The same write guards and 2 MiB tool-log limit apply. A separate continuation
records source-file hashes and checks them locally before each live
command. The first continuation has seven hashes. Later continuations also
check transitive proofs and their new passed cases. These checks add no host call. Boolean verification parsing changes
no product path, call budget, wait, or admitted fixture limit. E320 records the recovery costs.

Before the 6.1.4 enabled-state correction: retain the first independent
post-write device-chain read. If only the target enabled value is still old,
admit at most seven more reads, with one 25 ms cursor-point wait before each.
The complete track-bound chain must keep its names, order, and all unrelated
enabled values. A changed or incomplete chain refuses. The fast path retains
one read; the delayed path adds at most seven host reads and 175 ms of waits.
Never repeat the setter. Tests must cover delayed delivery, a silent no-op,
and unrelated changes. Remeasure the affected live path before acceptance.

A non-layer scope with no visible layers can retain the previous container's
layer count on 6.1.4. Use the already returned `hasLayers: false` and empty
layer list as the absence proof. A nonempty list remains incomplete. This
changes no host call, allocation bound, or named-slot coverage claim.

Structure recovery uses the existing snapshot bounds, one guarded enabled
restore, one owned-container deletion, and independent complete device-bank
reads before and after deletion. It validates at most 2 MiB of tool evidence.
The failed disable is not repeated. Measure the restore and the subsequent
new structure case to validate the corrected enabled-read path.

[E320](../evidence/experiments/e320-update-audit-614-device-compatibility.md)
measures the corrected live enabled-state fast path: disable takes
762.918 ms and reversal takes 679.388 ms, with 34 calls each. Both first
reads see the requested state. Delayed-read bounds are tested offline;
this live pass does not measure all eight reads. Recovery enable takes
706.288 ms and 31 calls. The three-device control recovery delete takes
7,124.989 ms and 241 calls; structure recovery delete takes 2,408.968 ms
and 85 calls. Full per-command costs remain in E320's data. Representative
control, mixer, and clip costs remain near the earlier measurements, with
workload limits stated in E320. Sampler and the remaining matrix still
prevent a complete upgrade performance verdict. No timing-only write
repeat was made. Product descriptions remain v52.

The Sampler label correction uses one internal alias on the named Sampler
attack recipe. It adds no host call or wait. One lookup in the already
bounded preset entry list binds the alias to Sampler. Explicit parameter
targets remain exact. Subsequent behavior reads must keep the first observed
name. The audit compares route identity, position, range, and amount while
admitting only the observed complete numbered LFO label sequence. This is
bounded by the existing preset inspection limits and adds no host call.

Sampler-name recovery reads a host export of at most 2 MiB and the bounded
fixture copy. It uses two complete snapshots, one guarded deletion at the
proved inserted position, and one independent device-bank read. It adds no
new product operation or poll. The original failure and resolved intent
remain. A fresh continuation must repeat only the failed Sampler case.

[E322](../evidence/experiments/e322-update-audit-sampler-recovery.md) measures
Sampler recovery deletion at 2,489.033 ms, 85 logical calls, and 71 wire turns.
The corrected single edit takes 2,266.752 ms, 71 logical calls, and 57 wire
turns. The failed E320 edit used the same calls and turns at 2,150.036 ms.
The corrected sample is about 5.4% slower with a passing identity verdict.
This is one local comparison; it does not establish cross-version capacity.
The export pause is excluded. No timing-only write repeat was made.

[E323](../evidence/experiments/e323-update-audit-single-sampler-pass.md) records
the single reversal at 1,396.586 ms, 50 logical calls, and 35 wire turns.
The multi edit takes 2,245.071 ms, 71 logical calls, and 57 wire turns.
These retain the existing model. Single and multi resource workloads differ;
this is not an equal-workload capacity comparison. Export pause time is
excluded. No timing-only repeat or implementation change was made.

[E324](../evidence/experiments/e324-update-audit-sampler-case-pass.md) measures
the multi reversal at 1,402.881 ms, 50 logical calls, 35 wire turns, and
823 ms summed wire time. The whole Sampler case passes its final independent
fixture comparison. The existing model applies; no product path changed.
Operator pauses are excluded. No timing-only repeat was made.

[E325](../evidence/experiments/e325-update-audit-selection-write-pass.md)
measures the same four-field mixer write after operator selection at
264.815 ms and 15 logical calls; reversal takes 363.644 ms and 22 calls.
The write is about 1.1% faster than E320's 267.748 ms sample with the same
call count. No model changed and no timing-only repeat was made.

Group snapshot correction: retain the existing maximum of eight slot-status
reads per group. Store aggregate occupancy with a group-slot marker; do not
request note documents for those slots. Read child clips through their own
track IDs as before. This removes the refused group-clip request and adds no
host call or poll. Local group validation is bounded by 16 tracks and eight
slots. Read-only recovery uses one complete snapshot and at most 2 MiB of
tool-log evidence to prove the exact pre-write failure. A separate continuation
keeps the original checkpoint and transitive proof hashes. No product write
or new product capability is added by recovery.

[E326](../evidence/experiments/e326-update-audit-collapsed-group-pass.md)
passes the corrected grouped case. Note edits take 2,429.237–2,457.785 ms
with 50 logical calls and 38 wire turns. Reversals take 2,492.378–2,496.825 ms
with 42 calls and 33 turns. These are 21–22% slower than the earlier ungrouped
case, despite six fewer calls and turns. The collapsed cursor path differs;
these single samples do not isolate a version regression. The stale refusal
takes 482.638 ms, 12 calls, and nine turns, 34.7% above the ungrouped sample.
No timing-only repeat was made. Retain this limit in section 3. The driver
fix removes the invalid group document request; it adds no call or poll.

[E327](../evidence/experiments/e327-update-audit-project-switch-pass.md)
passes a fresh mixer write and reversal after project return. The write takes
266.076 ms, 15 logical calls, and 10 wire turns. Reversal takes 361.299 ms,
22 calls, and 14 turns. Against E325's same operations, time changes by
+0.5% and -0.6%; call counts stay equal. No implementation or model changed.
No timing-only repeat was made. This check does not measure audio playback.

[E328](../evidence/experiments/e328-update-audit-reopen-pass.md) passes a fresh
mixer write and reversal after saved-project reopen. The write takes
261.630 ms, 15 logical calls, and 10 wire turns. Reversal takes 359.557 ms,
22 calls, and 14 turns. Against E327's same operations, time changes by
-1.7% and -0.5%; call counts stay equal. No implementation or model changed.
No timing-only repeat was made. Audio playback remains untested.

[E329](../evidence/experiments/e329-update-audit-listening-and-cleanup.md)
removes six owned tracks with independent absence and complete baseline
checks. Individual deletions take 544.042–602.821 ms, 28–29 logical calls,
and 15–16 wire turns. The 29-call, 16-turn samples take 584.303–602.821 ms,
against E258's 594 ms same-count result (-1.6% to +1.5%). Track contents
and sessions differ. No timing-only repeat or model change was made.
The operator hears both Samplers; no audio latency or loudness is measured.

[E330](../evidence/experiments/e330-update-audit-614-acceptance.md) consolidates
the accepted 6.1.4 normal-product audit. It retains the E326 grouped timing
comparison limit and separates it from the same-workload mixer comparisons.
All live checks and clean save pass. The final close-out adds no host write,
product call, or performance model change. Native Grid timing remains a
separate 9b.6 result.

## 9b.6a contract trace migration — model before implementation

Read both jars as data under the 9b.4 per-jar input limits. Keep a combined
120-second deadline and a 768 MiB process RSS refusal threshold. Scan method
bodies only for required signatures. Retain at most 256 code classes across
both jars; stream other classes and discard their code after comparison.
Bound comparison work to 1,000,000 methods and 16,000,000 instructions.
Retain at most 128 matches per role and a 2 MiB report. These limits are
refusal thresholds, not OS caps.

Compare local command contracts with vendor names removed. Keep signatures,
flags, literals, control flow, exception handlers, and reference identity
relationships. Do not include unrelated class members in a command key.
Use exact matches only as trace inputs until receiver and operation edges
validate. A missing or ambiguous contract must not produce a live table.
The scan makes no host call, initializes no vendor class, and writes no
attempt or acceptance cache. Live paths retain the E315/E316 model.

[E332](../evidence/experiments/e332-grid-doctor-614-command-contracts.md)
measures 14,508.833 ms and 326,320,128 bytes peak RSS. The diagnostic performs
4,073 method comparisons over 13,724 normalized instructions. It streams
20,332 class-code reads and retains 140 code classes across both jars. Its
report is 161,815 bytes. All declared limits hold. This workload differs
from the earlier shape census and complete resolver scans; no comparable
latency regression is established.

The changed 6.1.4 disposal body adds conditional global tracking. When
enabled, the added helper takes a monitor, drains a reference queue, and
allocates a reference per disposed object. The traced drain loop has no
static iteration cap. Its runtime mode and queue size are not measured.
Session 9b.6b must establish admission and a cost model before probe
preparation. The unchanged product budgets do not cover this research path.

## 9b.6b ownership and disposal trace — model before implementation

Read the installed jar as data. Check its hash and the trace seeds against
E332 before use. Keep the existing per-jar input limits, a 120-second
deadline, and the 768 MiB RSS refusal threshold. Stream each class once
for direct references and method handles to the required ownership and
tracking types. Bound the scan to 1,000,000 methods, 16,000,000 instructions,
and 16,000 retained reference sites. Retain at most 256 code classes and
512 method traces. Limit the report to 8 MiB. These are refusal thresholds,
not OS caps. Record dynamic-call and external-code limits explicitly.

Trace the document set, edit ownership, cleanup, tracking flag writers,
and queue users before changing any admission rule. Do not initialize
vendor classes or infer a runtime mode from an initializer. No host call,
native command, deployment, attempt, or cache write is part of this scan.
The E315/E316 live model stays unchanged. A required path with an unbounded
global queue or unresolved mode must refuse probe preparation.

[E333](../evidence/experiments/e333-grid-doctor-614-ownership-admission.md)
measures 11,538.089 ms and 188,383,232 bytes peak RSS. The scan reads 31,627
classes, 393,713 methods, and 6,574,509 instructions. It retains 6,073
reference sites, 475 method traces, and 14 code classes. Its report is
6,138,076 bytes. All declared limits hold. This workload differs from E332;
the samples do not establish a comparable latency regression.

The new document helpers scan retained helper lists and identity sets.
The set's constructor capacity of ten is not an admission limit. Enabled
disposal tracking adds one volatile read, monitor entry, and possible weak
reference allocation per object, plus global queue removal and set growth.
Queue length, global set size, monitor wait, and mode stability are not
bounded by the 256-owned-object limit. No finite new live admission is
established. No live timing, product budget, or public description changes.

## 9b.6 offline refusal diagnosis — model before implementation

Keep the E315 resolver and all live paths unchanged. The diagnostic reads
one preserved 6.0.6 jar and the installed 6.1.4 jar as data. Each input keeps
the 9b.4 size, entry, class, member, and inheritance limits. Retain metadata
for at most two jars. Use one 120-second diagnostic deadline and the existing
768 MiB process RSS threshold. These are refusal thresholds, not OS caps.

Compare the 55 type selectors at the base shape and both refinement rounds.
Use indexed lookups and retain at most 128 candidate names per diagnostic
row. Report all 76 member dependencies without selecting an unresolved
receiver. Trace the boolean atom's candidate superclass chain to at most
128 levels. Class hashes and shape differences are evidence, not selectors.
Retain at most 256 code classes across both jars. Bound the report to 1 MiB.
No bridge call, vendor initialization, document task, wait, native command,
cache write, or deployment is part of this diagnosis. The diagnostic cannot
emit a live candidate table. Weaker matches grant no write authority.

[E331](../evidence/experiments/e331-grid-doctor-614-resolver-refusal.md)
measures the complete two-jar diagnosis at 12,933.436 ms and 354,861,056 bytes
peak RSS. It retains 129 old code classes and no new code classes. The report
is 69,336 bytes. All bounds hold. The 6.1.4 metadata scan reads 31,627
classes and 466,601 members. Enumeration takes 3,165.636 ms; refinement takes
1,543.937 ms. It cannot reach complete member validation: 53 strict type
roles are missing. These costs are not comparable with E315's complete
candidate scan. No live timing, call budget, or host path changes.


## 9b.6c admission boundary trace — model before implementation

Read the installed jar as data. Verify E333's jar identity and imported
method traces. Keep the existing per-jar limits, 120-second deadline,
768 MiB RSS threshold, and 256 retained code classes. Trace superclass
method lookup and all in-jar declarations for the required virtual slots.
Bound hierarchy work to 4,000,000 edges. Stream one complete code scan for
incoming references and method handles to the selected debug types. Bound
that scan to 1,000,000 methods and 16,000,000 instructions. Retain at most
16,000 sites and 512 method traces. Limit each report to 8 MiB.

These are refusal thresholds, not OS caps. Names from E333 are investigation
inputs, not reusable selectors. No vendor class is initialized. No bridge
call, native command, deployment, attempt, or cache write is part of this
trace. A missing mode-stability or history bound must refuse admission.
The E315/E316 live model and product call budgets remain unchanged.


[E334](../evidence/experiments/e334-grid-doctor-614-admission-boundaries.md)
measures 11,300.429 ms and 211,877,888 bytes peak RSS. It scans 31,627 classes,
393,713 methods, and 6,574,509 instructions, with 507,978 hierarchy edges.
It retains 398 sites, 204 method traces, and 16 code classes. The report is
1,660,925 bytes. All limits hold. The workload differs from E333; no live or
cross-version latency claim follows.

For one ownership hook, helper matching can require work proportional to
H + S × D, where H is retained helper count, S is total retained helper-set
entries, and D is ancestor depth. Document-set capacity and the pending
helper also need limits. None follows from 256 scratch objects. The debug
mode writer uses the application event queue, but command non-reentrancy
is unproved. No finite live admission is established. No live timing,
product budget, or public description changes.

## 9b.6d receiver and event contracts — model before implementation

Read the installed jar as data. Verify E334's jar identity and seed traces.
Keep the existing per-jar input limits, 120-second deadline, 768 MiB RSS
threshold, and 256 retained code classes. Enumerate at most eight receiver
slots with 4,000,000 superclass edges. Scan at most 1,000,000 methods and
16,000,000 instructions. Resolve incoming symbolic references through
superclasses, with at most 16,384 cached lookups. Do not infer interface
dispatch or runtime receiver identity from symbolic resolution.

Retain at most 16,000 reference sites, 512 method traces, and 128 explicit
method inputs. Limit each report to 8 MiB and its plan to 64 KiB. These are
refusal thresholds, not OS caps. Keep dynamic bootstrap entries as evidence;
do not change the strict comparator. Include queue entry, dispatch, callback,
descriptor, and storage paths in the investigation. No host call, vendor
initialization, native command, deployment, attempt, or cache write is part
of this scan. E315/E316 remain the unchanged live model. A missing history
growth bound or command re-entry proof must refuse probe preparation.

[E335](../evidence/experiments/e335-grid-doctor-614-receiver-dispatch.md)
measures 13,347.272 ms and 196,411,392 bytes peak RSS. The scan reads 31,627
classes, 393,713 methods, and 6,574,509 instructions. It uses 1,241,300
hierarchy edges and 2,409 cached symbolic lookups. It retains 238 method
traces and 52 code classes; the report is 1,797,252 bytes. All limits hold.
The workload differs from E334; no comparable regression claim follows.

The relationship ancestor step can allocate a wrapper through `deU.E3`.
The live depth bound must cover this allocation as well as traversal.
`deX.nVd()` returns true regardless of the base `0x20` flag. A base-field
guard alone cannot exclude retained-history work. The round-trip callback
can dispatch another app event. Empty-set callback completion excludes
one wait, not every command path. No finite new live admission or timing
claim is established. Product budgets and descriptions remain unchanged.

## 9b.6e fixture contracts — model before implementation

Read both jars as data. Validate the source against the complete E315 table.
Use the unchanged local comparator to census all method roles in one streamed
pass per jar. Keep field and abstract roles separate from executable bodies.
Retain at most 128 exact matches per role, with a complete match count.
Trace the membership call through the exact insertion-body contract and
at most eight simple superclass delegates. Keep symbolic lookup separate
from runtime dispatch. No local match selects a receiver or grants write
authority. Bound combined
work to 1,000,000 methods and 16,000,000 instructions, 256 retained code
classes, 120 seconds, 768 MiB RSS, and a 4 MiB report.

For the focused lock, request, and context trace, retain E335's scan bounds:
128 explicit methods, eight slots, 32 targets, 512 method traces, 16,000
sites, 4,000,000 hierarchy edges, 16,384 lookups, and an 8 MiB report.
Verify E335's seed methods before use. Plans are investigation inputs.
These are refusal thresholds, not OS caps. No vendor class initialization,
host call, native command, deployment, attempt, or cache write is permitted
by these diagnostics. Live costs remain E315/E316; product budgets do not
change. Missing receiver contracts or growth bounds still refuse admission.

[E336](../evidence/experiments/e336-grid-doctor-614-fixture-contracts.md)
measures the two-jar role census and membership trace at 24,227.186 ms and
332,120,064 bytes peak RSS. It scans 777,386 methods and 12,935,844
instructions, retains 133 code classes, and writes a 1,107,556-byte report.
The focused trace takes 11,964.105 ms and peaks at 201,424,896 bytes RSS.
It scans 31,627 classes, 393,713 methods, and 6,574,509 instructions, with
615,692 hierarchy edges and 12 cached lookups. It retains 345 method traces
and 129 code classes; the report is 1,686,636 bytes. Final scans meet all
limits. An earlier broad slot scan refused at the existing 512-trace bound;
E336 retains that attempt. No limit was raised.

The empty-array begin route allocates sets and a collector but skips the
lock wait. Other collectors can walk ancestor chains. The terminal
membership getter adds an external method call in place of a static field
read. Neither observation admits a live path. Context, descriptor, command
closure, and history growth remain unproved. No live timing or product call
budget changes. Different offline workloads do not establish a regression.

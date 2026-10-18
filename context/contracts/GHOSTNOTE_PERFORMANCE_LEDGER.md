---
title: Ghostnote performance ledger
kind: reference
state: active
updated: 2026-10-19
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

1. **Cost model in the plan.** A plan that adds or changes a live path states
   its expected cost before the work starts: the host turns, the cold reads,
   the write stages, and the heap. State it for the typical case and for the
   largest admitted case. Compare it with the probe or primitive number in this
   ledger and explain the difference.
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
3. **Remeasure.** A session that changes a live path reruns the matching
   measurement (for example `phase8h4c-edit.ts cost` or
   `phase8h4g-inventory.ts inventory`) and records it here. A regression of
   more than 20 percent, or a new host turn, needs a named cause and an
   accepted reason in the E record.

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
unmeasured and cannot be cancelled by the reader deadline. Complete the
failure-path design before code. No factory timing or V8 build exists yet.

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

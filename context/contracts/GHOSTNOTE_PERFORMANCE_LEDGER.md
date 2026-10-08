---
title: Ghostnote performance ledger
kind: reference
state: active
updated: 2026-10-08
parent: ../plan/phase-8/8h-cache-promotion-and-interface-simplification.md
evidence: E227, E229, E234, E236, E237, E238, E239, E244, E246, E247, E248
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
   snapshot read, a bank scan after a mark, the writer page check, and the
   writer park). When a
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
| Device insertion, layer-chain copy (`deviceInsert`) | A poll of the structural proof, deadline 4,000 ms; a native device lands in about 1 s | E247 |
| Device or chain relocation | No fixed wait; its proof poll (deadline 8,000 ms) | E247 |
| One container read (`containerScope`, layer container, track not held) | About 8 turns (190 ms) | E238 trace |
| One structural track stage (`track.create`, `track.duplicate`, `track.delete`): cursor release, rescan, mint poll | About 420 ms, 23 wire calls | E247 |
| Bound heap for each sounding cell | About 300 bytes live (ZGC "used" is higher); 336 bytes in a held writer | E227, E246, E248 |

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
| `edit_launcher_clip`, whole-clip velocity, typical | 1,725–1,740 ms | E246: 1,772 ms | mark 2, tracks 1, clipRead 3, delta 3, resolve 1, apply 1 | E247 |
| Whole-clip edit, notes with nondefault expression | 1,929–1,934 ms | E247: 5,683–6,913 ms (a page for each property stage) | as whole-clip | E248 accept |
| Whole-clip edit, 16,384 notes (reader limit) | 6,588 ms (plan 1,195, write 3,710, readback 637) | E247: 8,337 ms, 75 wire calls; E246: 47,977 ms (plan 12,003, write 31,609) | as whole-clip | E248 worst |
| Whole-clip edit, 512 notes on 2,048 beats at the 1/512 grid (the review case) | 1,781 ms; 53 wire calls | 512 steps: 110,838 ms, 512 page checks | as whole-clip | E248 reviewer |
| Edit planner, 16,384 notes, offline | 1.2 s (4,096 notes: 0.5 s); budget 4,000 ms | E246: 12.0 s live | `phase8h4g-inventory.test.ts` | E247 |
| Edit refusal before a write | About 400 ms | E236: 560 ms | — | E246 |
| `add_launcher_clip`, typical (256 notes) | 2,323 ms; 85 wire calls | 16 notes, E237: 2,611 ms; `add_clip` 1,827 ms | mark 3, tracks 2, read 3, resolve 2, apply 2, delta 4, clipRead 3 | E247 |
| `add_launcher_clip`, 16,384 notes | 6,418 ms (plan 778, write 3,352) | E247: 8,172 ms | as typical | E248 add-worst |
| `add_launcher_clip`, the review case; 2,097,152 cells (4,096 one-beat 1/512 notes) | 2,293 ms; 3,341 ms, ZGC used peak 2,450 MiB | 512 steps: 111,419 ms; about 54 s (257 pages) | as typical | E248 |
| `copy_launcher_clips`, one clip | 924 ms | Before: 1,228 ms; `copy_clip_down`: 2,897 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
| `move_launcher_clips`, one clip | 1,190 ms | Before: 1,472 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
| `set_launcher_clip_launch_settings` | 1,056 ms | — | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
| `set_launcher_clip_properties`, one clip | Name, length, or colour: 1,423–1,436 ms; 3 captures, 1 stage, only the owned setters; no change: no write | E247: 1,447 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E249 |
| Copy, extend 64 → 128 beats, and insert 153 notes (the dogfood path) | Copy 888 ms; read 422 ms; edit 1,760 ms, no colour setter; revert 2,082 ms | Dogfood edit: 2,190 ms for 153 inserts | as targeted edit | E249 |
| `delete_launcher_clip` | 878 ms | Before: 1,233 ms | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E247 |
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
| `delete_track`, 3 and 4 tracks | 937 ms, 69 wire calls; 1,140 ms, 86 | Before (3): 2,009 ms; E239 (4): 2,517 ms | tracks 1, resolve 1, read 2, apply 1, delta 1 | E247 |
| `list_changes` | 7 ms | No host call | none | E247 |
| `check_revert`, a clip edit | 442 ms | E239: a rename, 42 ms | read 1, delta 1 | E247 |
| `revert_change`, a targeted clip edit; a device enable | 1,581 ms; 775 ms | — | revert: read 3, delta 2, resolve 1, apply 1 | E247 |

### Devices and modulation

| Path | Current | Reference or earlier | Call budget | Source |
|---|---:|---|---|---|
| `read_devices`, by structure | 542–562 ms (one container); 652 ms (one device); 695–950 ms (a container and 1–3 devices) | E238: 460–495 ms (one container); before: 634 ms (one device) | devices 1, read 1 | E247 |
| `read_device_controls`, new or same target (Polysynth) | 764–823 ms | E238: 701–731 ms | read 1 | E247 |
| `read_device_controls`, Diva (CLAP, 281 IDs) | 3,919–4,011 ms (not remeasured) | — | read 1 | E238 |
| `set_device_controls`, one write | 2,555–2,650 ms; 74 wire calls | E238: 2,324–2,398 ms (CLAP: 8,302 ms) | devices 1, read 2, apply 1, delta 1 | E247 |
| `set_device_controls`, 27 controls (Polysynth) | 14,372–14,391 ms; 276 wire calls; 4,321 bytes | E239: 14,463–14,521 ms, 282 wire calls; `set_parameter` now 14,255–14,376 ms | as one write | E247 controls |
| `set_device_enabled`, one device; its revert | 905 ms; 775 ms | E239: 770 ms; 665 ms | devices 1, resolve 1, read 2, apply 1, delta 1 | E247 |
| `add_devices`, one native device | 1,447–1,544 ms; 67 wire calls | Before: 5,541 ms | devices 2, read 2, apply 1, delta 1 | E247 |
| `compose_devices`, offline, 2 and 4 layer chains | 3,382–3,403 ms; 3,978–4,023 ms | E238: 7,199–7,330; 7,770–7,779 ms. E18a insertion: 463–465 ms | wire: 128 (2 layer chains) | E247 benchmark |
| `compose_devices`, staged, 2 and 4 layer chains | 17,500–17,551 ms; 30,430–30,556 ms | E238: 36,525–37,145; 64,878–64,937 ms | — | E247 benchmark |
| `revert_change` of a composition, offline; staged 2 and 4 | 1,428–1,454 ms; 12.6 s; 20.9–21.0 s | E238: 1.7 s; 21.3 s; 38.4 s | — | E247 benchmark |
| `set_layer_chain_solo`; no-op | 957–973 ms; 216 ms | E238: 828–868 ms; 182 ms | read 4, apply 1, delta 1; no-op: read 1 | E247 recipes |
| `rename_layer_chain` | 1,075 ms | E238: 953 ms | read 4, apply 1, delta 1 | E247 recipes |
| `duplicate_layer_chain` | 1,421–1,756 ms | E238: 5,199 ms | read 4, apply 1, delta 1 | E247 |
| `copy_devices`, one device | 2,472 ms; 107 wire calls | Before: 6,704 ms | devices 2, read 5, apply 1, delta 1 | E247 |
| `move_devices`, one device | 1,254–2,311 ms | E238: 5,366–5,957 ms | devices 2, read 4, apply 1, delta 1 | E247 |
| `delete_device`, one container | 3,055–3,296 ms; 116 wire calls | E238: 3,132 ms | read 3, devices 3, resolve 1, apply 1, delta 1 | E247 |
| `wrap_existing_device_modulation`, one LFO; its reversal | 14,390 ms; 5,801 ms | Before: 26,073 ms; 6,515 ms | wire: 420; 197 | E247 |
| `read_preset_modulation`; `list_modulator_types` | 1–3 ms; 1 ms | File and catalog reads only | none | E247 |
| `edit_preset_modulation`, one LFO | 8,233 ms | Before: 11,937 ms | wire: 233 | E247 |
| A/B audition and winner collapse, 2 layer chains (8 calls) | 11,877–12,084 ms; 447–450 wire calls | E239: 21,877–21,903 ms, 497 wire calls; `stable-v1` managed alternates: 20,191–20,247 ms (E239: 50.7 s) | — | E247 ab |

## Limits

| Limit | Value | Source |
|---|---:|---|
| Reader sounding cells | 2,097,152 | E246 (the guard counts after the replay) |
| Heap at 4.2 million cells | 3,072 MiB maximum reached | E246 |
| Heap failure | 8.4 million cells | E236 |
| MCP client request timeout | 60 s | E45 |
| Writer window (pool cursors, `fineSteps`) | 4,194,304 steps (the reader width; was 512); fixed at extension start. A writer parks after each write. The adapter refuses note writes on a narrower writer (`WriterWidthError`, `unhealthy`). The 2,048-step window is the separate `fine` read cursor (`noteReadSteps`, E52) | E44, E52, E248, D41 |
| Add at the reader limit, ZGC used peak | 2,450–2,786 MiB of 3,072 (the read alone: 2,168–2,196) | E248 |
| Dense `cursor.getNotes*` scan without `maxX` | 8,192 steps | E248 |
| Longest direct call measured | Staged composition of 4 layer chains, 30.6 s | E247 |

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
- A device control write reads three complete parameter inventories: the
  change record, the cohort integrity check, and the executor readback
  (D15). This is the retained safeguard that costs the most (8h retrospective).
- `add_launcher_clip` resolves twice (creation, then the edit limb) and is two
  change records; reverting it takes two calls.
- `launch_clip` on `agent-native-v1` checks the track and the occupancy
  first: about 3 turns over `stable-v1`.
- `compose_devices` offline proves each layer chain and its device after the
  insertion (about 100 turns); the staged backend pays one structural stage for
  each device and relocation.
- `delete_device` of one container is about 100 wire calls (bank reads and
  two parameter inventories for the change record).
- `read_device_controls` on a 281-ID plug-in takes about 4 s for each read,
  also for the same target.
- `read_launcher_clip` returns all 16 channels (about 12 KB for the typical
  clip); an edit needs a read for its base.
- `wrap_existing_device_modulation` takes 14 s: five structural stages and the
  bounded modulation verification (E97).
- `set_layer_chain_solo` and `rename_layer_chain` are 12–14 percent above
  E238. The first E247 inventory, before the 8h4g changes, had the same
  values; no 8h4g change touches their stage.
- `rename_track` reads the bank once to refuse a missing track (+1 call): the
  executor records the rename of a missing track as a failed op.

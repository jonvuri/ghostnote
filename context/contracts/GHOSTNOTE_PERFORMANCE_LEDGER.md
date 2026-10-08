---
title: Ghostnote performance ledger
kind: reference
state: active
updated: 2026-10-08
parent: ../plan/phase-8/8h-cache-promotion-and-interface-simplification.md
evidence: E227, E229, E234, E236, E237, E238, E239, E244, E246
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
   route) and the 8h4c2 call-budget test in
   `brain/src/adapters/live/adapter.test.ts` (the wire frames of a mark and a
   snapshot read). When a budget changes on purpose, update the test and this
   ledger, and state the cost in the E record.
3. **Remeasure.** A session that changes a live path reruns the matching
   measurement (for example `phase8h4c-edit.ts cost`) and records it here. A
   regression of more than 20 percent, or a new host turn, needs a named cause
   and an accepted reason in the E record.

## Unit costs

| Unit | Cost | Source |
|---|---:|---|
| One sequential wire call | About 24 ms (one control-surface turn) | E246 trace |
| One mark (`revision.get` and `track.list`, sent together) | One turn | E246 |
| One `clip.read` capture, typical clip | About 190 ms | E246 trace |
| A plain read of an occupied `clip` address | One `clip.read` capture and a selection borrow (about 380 ms): the adapter reads the clip length | E237 trace |
| An occupancy read (`ReadOptions.occupancy`) of a `clip` address | One `slot.status` (one turn) | E237 |
| Bare replay read (the primitive) | 46–698 ms, by size | E227 |
| `gridChange` settle | 144 ms | E15-D, `SETTLE_MS` |
| `noteWrite` settle | 25 ms | `SETTLE_MS` |
| DirectParameter display set (any count, 8–281 IDs) to text for each ID | One turn (22.6–25.4 ms); a switch sends no text | E244 |
| DirectParameter same-type switch settle (driver: point and poll) | 165–174 ms, independent of the observed count | E244 |
| DirectParameter read of a new target, with display text (product) | No extra wire call: the set rides the poll that the settle needed | E238 |
| `deviceInsert` settle after each `device.insert`, `device.relocate`, `chain.create`, `chain.relocate` stage | 4,000 ms fixed wait | `SETTLE_MS` |
| One container read (`containerScope`, layer container, track not held) | About 8 turns (190 ms) | E238 trace |
| One structural track stage (`track.create`, `track.duplicate`, `track.delete`): cursor release, rescan, mint poll | About 800 ms, 31 wire calls; the same for every track kind | E239 |
| Bound heap for each sounding cell | About 300 bytes live (ZGC "used" is higher) | E227, E246 |

## Product paths

Typical clip: 256 notes on 16 channels over 64 beats (E231). Dates are those
of the measurement.

| Path | Current | Primitive or earlier | Adapter calls (call-budget test) | Source |
|---|---:|---:|---|---|
| `read_launcher_clip`, typical | 419–459 ms | Replay 48 ms + 40 ms fetch (E227) | mark 1, tracks 1, clipRead 1, delta 1 (repeated read: delta 2) | E246 |
| `edit_launcher_clip`, 16-note insert (targeted) | 1,449–1,470 ms | E236: 6,610 ms | mark 1, tracks 1, clipRead 2, delta 3, apply 1 | E246 |
| One read and one 16-note insert | 1,892 ms | E236: 7,176 ms; E121 apply 16,044 ms | — | E246 |
| Whole-clip velocity edit, typical | 1,772 ms | E236: 6,574 ms | mark 2, tracks 1, clipRead 3, delta 3, resolve 1, apply 1 | E246 |
| Whole-clip edit, notes with nondefault expression | 5,675–6,898 ms | E236: 16,213–16,293 ms | as whole-clip | E246 |
| Edit refusal before a write | About 400 ms | E236: 560 ms | — | E246 |
| `check_launcher_clips`, 16 typical clips | 4.6 s (before the E246 trims) | E231: 3.5 s, notes only | 2 refs: mark 2, clipRead 1, delta 1 | E234 |
| Whole-clip edit, 16,384 notes (at the reader limit) | 48.0 s (plan 12.0 s, write 31.6 s) | E236: 73.0 s | as whole-clip | E246 |
| One read and one 16-note insert, 8h4d remeasure | 2,030–2,058 ms (edit 1,538–1,550 ms; 56–58 wire calls) | E246: 1,877–1,936 ms, same call count | as above | E237 |
| E45/E48-style workflow (read, copy, read and edit, launch, show, two reverts) | 8 calls, 7,864 ms, 31,080 bytes | `stable-v1`: 7 calls, 13,344 ms, 15,091 bytes | — | E237 |
| `add_launcher_clip`, 16 notes | 2,611 ms (targeted) | `add_clip`: 1,827 ms | mark 3, tracks 2, read 3, resolve 2, apply 2, delta 4, clipRead 3 | E237 |
| `copy_launcher_clips`, one typical clip | 1,249 ms | `copy_clip_down`: 2,897 ms (also two launch-settings writes) | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E237 |
| `launch_clip` (`agent-native-v1`) | Median 764 ms | `stable-v1`: 696 ms | mark 1, tracks 1, read 4, apply 1, delta 1 | E237 |
| `show_launcher_clip_in_detail_editor` | 264 ms | `show_changed_clip`: 578 ms | mark 2, tracks 1, read 1, resolve 1 | E237 |
| `set_launcher_clip_properties`, one clip | — | — | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 | E237 (offline) |
| Background edit handle (`background: true`) | Handle 1 ms; 64-note whole-clip edit completed at 2,057 ms | Direct call: same edit cost | as the tool | E237 |
| `read_devices`, one container | 460–495 ms (two devices after it: 613–750 ms) | `inspect_devices` + `inspect_device_alternates`: before the E238 slot fix, 3.8 s | devices 1, read 1 | E238 |
| `read_device_controls`, new or same target (55–103 IDs) | 701–731 ms | — | read 1 | E238 |
| `read_device_controls`, Diva (CLAP, 281 IDs) | 3,919–4,011 ms | — | read 1 | E238 |
| `set_device_controls`, one write in a layer chain | 2,324–2,398 ms (CLAP: 8,302 ms) | — | as `set_parameter` | E238 |
| `set_layer_chain_solo` | 828–868 ms; no-op 182 ms | before the E238 slot fix: 16 s | read 4, apply 1, delta 1; no-op: read 1 | E238 |
| `rename_layer_chain` | 953 ms | — | read 4, apply 1, delta 1 | E238 |
| `duplicate_layer_chain` | 5,199 ms | — | — | E238 |
| `move_devices`, one device | 5,366–5,957 ms | 4,000 ms settle | devices 2, read 4, apply 1, delta 1 | E238 |
| `delete_device`, one container | 3,132 ms (about 100 wire calls) | — | — | E238 |
| `compose_devices`, offline, 2 and 4 layer chains | 7,199–7,330 ms; 7,770–7,779 ms | E18a insertion 463–465 ms | — | E238 |
| `compose_devices`, staged, 2 and 4 layer chains | 36,525–37,145 ms; 64,878–64,937 ms | 9 and 17 stages | — | E238 |
| `revert_change` of a composition, offline; staged 2 and 4 | 1,691–1,754 ms; 21.3 s; 38.4–38.5 s | — | — | E238 |
| `add_tracks`, 2 tracks (audio and instrument) | 1,935 ms, 67 wire calls | One structural stage: about 800 ms (E239 arms) | add: read 4, apply 2, delta 2, resolve 1, tracks 1 (`add_track`: read 5) | E239 |
| `duplicate_track`, Audio or Hybrid | 1,178–1,197 ms, 48 wire calls | E16: 117–190 ms until visible | duplicate: tracks 2, read 4, apply 2, delta 2, resolve 1 (`copy_track`: mark 1, tracks 1, read 5) | E239 |
| `check_bitwig_connection`; `list_tracks` | 21 ms (2 wire calls); 43 ms (3) | One mark | connection: mark 1; tracks: mark 1, tracks 1 | E239 |
| `rename_track`; `check_revert`; `revert_change` of a rename | 386 ms; 42 ms; 413 ms | — | rename: tracks 1, resolve 1, read 2, apply 1, delta 1 (+1 tracks against `stable-v1`); check: read 1, delta 1; revert: read 3, delta 2, resolve 1, apply 1 | E239 |
| `set_device_enabled`, one device; its revert | 770 ms; 665 ms | — | devices 1, resolve 1, read 2, apply 1, delta 1 | E239 |
| `delete_track`, 4 tracks | 2,517 ms, 87 wire calls | — | tracks 1, resolve 1, read 2, apply 1, delta 1 | E239 |
| 27-control write, Polysynth (`set_device_controls`) | 14,463–14,521 ms, 282 wire calls; 4,321 bytes | `set_parameter`: 14,452–14,490 ms, same calls; 4,278 bytes | as `set_parameter` | E239 |
| A/B audition and winner collapse, 2 chains (8 calls) | 21,877–21,903 ms, 497 wire calls | `stable-v1` managed alternates (9 calls): 50,693–50,706 ms, 763 wire calls | — | E239 |
| E45/E48-style workflow, 8h4f remeasure | 8 calls, 7,411 ms, 28,364 bytes | `stable-v1`: 7 calls, 12,860 ms, 15,123 bytes | — | E239 |

## Limits

| Limit | Value | Source |
|---|---:|---|
| Reader sounding cells | 2,097,152 | E246 (the guard counts after the replay) |
| Heap at 4.2 million cells | 3,072 MiB maximum reached | E246 |
| Heap failure | 8.4 million cells | E236 |
| MCP client request timeout | 60 s | E45 |
| Writer window | 2,048 steps | E236 |

## Known costs for the 8h4g review

- Planner time: 12.0 s for 16,384 notes. Each changed note is mapped twice
  (default groups), and the planner validates and clones whole documents.
- Each apply points a writer cursor (about 8 calls) and waits one
  `gridChange` settle.
- Each read borrows and restores the selection (2–4 calls).
- `check_launcher_clips` takes two marks; the read tool's repeated read takes
  one more delta for the prior ref; `tracks()` follows a mark that already
  scanned the bank.
- Whole-clip rewrites of notes with nondefault expression need one property
  stage for each channel.
- `add_launcher_clip` resolves twice (creation, then the edit limb) and is two
  change records; reverting it takes two calls (4,707 and 1,518 ms).
- A whole-clip reversal of the typical clip takes about 4.7–4.9 s (E237).
- `launch_clip` on `agent-native-v1` checks the track and the occupancy
  first: about 3 turns (+10 percent) over `stable-v1`.
- A staged `compose_devices` of four layer chains takes about 65 s, more than
  the 60 s MCP client timeout, and the tool has no background route (E238).
- Each structural stage waits the fixed 4,000 ms `deviceInsert` budget; a
  structural readback could replace the wait.
- `read_devices`: the top-level bank read re-points the track cursor and reads
  `device.list` twice; each limb reads the container before and after the
  write, beside the executor's own preflight and readback.
- `delete_device` of one container is about 100 wire calls (bank reads and two
  parameter inventories for the change record).
- `read_device_controls` on a 281-ID plug-in takes about 4 s for each read,
  also for the same target.
- `read_launcher_clip` returns all 16 channels (about 11 KB for the typical
  clip); an edit needs a read for its base.
- A 27-control write takes 14.5 s and 282 wire calls (about 10 calls and
  535 ms for each control), on both profiles. Its live result (4,321 bytes)
  is above the 3,181-byte E126 figure because live parameter IDs are longer.
- A structural track stage takes about 800 ms and 31 wire calls; the host
  makes the track visible in 117–190 ms (E16).
- `rename_track` reads the bank once to refuse a missing track (+1 call): the
  executor records the rename of a missing track as a failed op.

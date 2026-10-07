---
title: Ghostnote performance ledger
kind: reference
state: active
updated: 2026-10-08
parent: ../plan/phase-8/8h-cache-promotion-and-interface-simplification.md
evidence: E227, E229, E234, E236, E237, E246
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
- `read_launcher_clip` returns all 16 channels (about 11 KB for the typical
  clip); an edit needs a read for its base.

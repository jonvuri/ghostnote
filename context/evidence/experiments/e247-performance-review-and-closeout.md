---
title: E247 — Performance review and 8h closeout
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8h4g
---

# E247 — Performance review and 8h closeout

## Status

[8h4g](../../plan/phase-8/8h4g-performance-review-and-closeout.md) is complete,
and 8h is closed. A live inventory measured each `agent-native-v1` tool with
its wire trace. The [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
has one row for each tool: its cost, its reference, and its call budget.

- The 16,384-note whole-clip edit at the reader limit takes 8.3 s with
  verification (E246: 48.0 s). Planning takes 1.2 s (E246: 12.0 s); the
  write takes 5.4 s (E246: 31.6 s). After E248 it takes 6.6 s.
- `add_launcher_clip` of 16,384 notes takes 8.2 s (E248: 6.4 s).
- The background route left `agent-native-v1` (D39 amendment). The profile
  lists 39 tools. Tool descriptions are at v33.
- A review found that the 16,384-note case was not the worst case: the write
  cost scales with distinct writer pages, not notes. One valid edit needed
  512 page checks (111 s). The continuation set the writer window to the
  reader width ([E248](e248-writer-cursor-width.md), D41); then every
  admitted clip is one page, and the removal holds.
- Device structure writes no longer wait a fixed 4,000 ms: `add_devices`
  5.5 → 1.5 s, `move_devices` 6.3 → 2.3 s, the staged composition of four
  layer chains 64.9 → 30.6 s (it was above the 60 s client timeout).
- The first session did not change the extension. The continuation changed
  the writer width default and the scan guard (E248); the wire is unchanged
  (normal: 89 methods, `0ef817f4bac8a8a7`).

## Method

`phase8h4g-inventory.ts inventory` calls each tool once through the MCP
dispatch path on fresh tracks in the owned project "New 6" and deletes them
at the end. For each call it records the wall time, every wire call with its
time, the host turns (calls in flight together are one turn), the `clip.read`
captures, the `batch.run` write stages, the brain CPU time, the idle time
(wall time outside wire calls and brain CPU: settles and polls), and the
result bytes ([inventory.json](../data/phase8h4g-review/inventory.json)).
The largest admitted cases come from `phase8h4c-edit.ts worst`,
`phase8h4g-inventory.ts add-worst`, and `phase8h4e-devices.ts benchmark`.
The first inventory ran before any reduction; it is the "before" column below.

## Reductions

Each change names the failure that the removed work covered and the evidence
that still covers it.

| Change | Before → after | Failure covered | Evidence that still covers it |
|---|---|---|---|
| The page check before a note stage confirms each writer view (cursor, clip, step size, page) once, not once for each channel | 16,384-note write: 128 confirmations, 26.9 s → 8 confirmations, 2.1 s | A cursor that does not name the target at a later page (E46) | Each distinct view is still confirmed before the first write. The view does not depend on the channel |
| A device insertion polls the device chain until the minted device has its expected name in two equal readings; a layer-chain copy polls its container until the new chain is identifiable. 4,000 ms is now the deadline | `add_devices` 5,541 → 1,544 ms | A mint diff taken before the device or chain is in the bank (E3, E89) | The poll waits for the same structural fact. The post-stage mint check reads again and fails the op as before |
| A device or chain relocation does not wait the fixed 4,000 ms | `move_devices` 6,339 → 2,311 ms | A relocation proof read before the move lands | `finishDeviceReorder` and `finishRelocation` already polled a complete structural proof for up to 8,000 ms |
| The cursor release after a structural stage sends its 16 frames together | `add_scenes` 676 → 368 ms; 3-track `delete_track` 2,009 → 937 ms | A pinned cursor that ignores later selection changes (2h) | The same frames, in the same order, in one turn (E246 mark rule) |
| `tracks()` within 50 ms of a mark, with no request after it, uses the mark's bank scan | `list_tracks` 3 → 2 calls; one turn less on each clip tool | A bank read that misses a structural change (standing rule 2) | No Ghostnote write can be between the two scans; a later call scans again |
| Planner and codec (below) | 16,384 notes: 11.8 → 1.2 s offline | None: the same validations, without repeats | Codec conformance, the binding corpus, and an equivalence test for the shared mapping |

No guard was removed. D15 (independent post-write evidence) and D38 do not
change. The call-budget counts at the adapter level do not change; the
8h4g row adds budgets for 11 tools that had none.

## Planner

`phase8h4g-inventory.ts plan-bench` profiles the whole-clip velocity edit
of N notes on the fake adapter (`--cpu-prof`). At 16,384 notes the plan took
11.8 s (the live E246 figure was 12.0 s). The causes, in order of size:

1. Whole-document validation: about 13 complete validations of the same
   documents in one edit, each about 230 ms (clone, schema walk, canonical
   JSON, both encodings for the byte limit).
2. `scalarCompare` built code-point arrays for each key comparison (4.1 s of
   sorts in canonical JSON).
3. One validation of a one-event document for each of three mappings of each
   changed note (`mappedNote` twice and its default variant once).
4. A quadratic scan in `resolvePartialProposal` (each event searched the
   declared-field list) and in the overlap check (each note end computed
   again for each active note).

The changes keep each result: a direct `scalarCompare`, a cache of parsed
rationals and a comparison for the bit limit, a scalar-text fast path, cached
key costs and schema patterns, the hashes of already normalized documents,
`applyDesiredTo` and `applyPatchTo` for a normalized base, one mapping for
each changed note (`d9MappedFields` with `validated`), and a one-slot,
frozen projection memo keyed by the D32 source digest, the IDs, the
overlays, and the envelope (the edit re-projects its fresh read, which has
the same digest as the base read when the verdict is `current`).

| Step | 16,384 notes, offline plan |
|---|---:|
| Before | 11,811 ms |
| Codec compare, rational cache | 7,009 ms |
| One mapping for each note | 5,644 ms |
| Hash reuse, quadratic scans | 3,558 ms |
| Schema walk, clone, overlap ends | 2,544 ms |
| Validated documents passed forward | 2,037 ms |
| Mapping without revalidation, projection memo | 1,226 ms |

4,096 notes plan in 0.52 s. The offline budget test
(`phase8h4g-inventory.test.ts`) fails above 4,000 ms at 16,384 notes or when
4x the notes cost more than 6x the time. Live, the plan takes 1.2 s of the
8.3 s edit; the host write (stash, apply, and verify reads) takes 5.4 s.

## Worst case and the background route

| Case (live, "New 6") | Read | Edit | Plan | Write | Readback | Status |
|---|---:|---:|---:|---:|---:|---|
| Whole-clip edit, 16,384 notes (E246) | 4,102 ms | 47,977 ms | 12,003 | 31,609 | 2,412 | verified |
| Whole-clip edit, 16,384 notes (E247) | 1,542 ms | 8,337 ms | 1,196 | 5,390 | 640 | verified |
| `add_launcher_clip`, 16,384 notes | — | 8,172 ms | 799 | 5,056 | 631 | verified |

The E247 edit makes 75 wire calls (E246: 436): three `clip.read` captures
(2.9 s), 8 page confirmations, and one `batch.run` of 22 ms that writes all
16 channels. The margin to the 60 s client timeout (E45) is more than 50 s.
This case has 8 writer pages. The page count, not the note count, sets the
write cost; E248 measured a 512-page case (111 s) and removed the page
count as a dimension (D41).

Decision (D39 amendment): `edit_launcher_clip` and `add_launcher_clip` lose
`background`, and `inspect_operation` and `cancel_operation` leave the
profile. The route made an agent choose a flag, poll, and read a second
envelope; no admitted case needs it now, with the E248 writer width.
`stable-v1` is unchanged.

## Inventory and gaps above 2x

The ledger has every row. These gaps against the reference stay, with their
cause:

- `read_launcher_clip`, 415–477 ms against the 88 ms replay and fetch
  (E227): one capture (about 190 ms, including the turn) and 9 control turns:
  the mark, the selection borrow (D6), three slot checks, the post-read slot
  check, and the end mark and delta for the D32 verdict.
- `compose_devices` offline, 3.4–4.0 s against the 463 ms E18a insertion:
  the structural proof of each layer chain and its device (D15), about 100
  turns.
- `set_device_controls`, one write, 2.65 s; a 27-control write 14.4 s
  (below): three complete parameter inventories (the change record, the
  cohort integrity check, and the executor readback, D15), each with the
  194 ms parameter settle.
- Whole-clip edits of notes with nondefault expression, 5.7–6.9 s: one
  property stage for each channel, each after a grid settle. E15-F forbids
  one shared property stage across clips. A shared stage for the channels
  of one clip is a candidate; it needs its own live proof. E248: 1.9 s, because
  each property stage is now one page.
- `wrap_existing_device_modulation`, 14.4 s (26.1 s before): five structural
  stages and the bounded modulation verification (E97). Its reversal: 5.8 s.
- `edit_preset_modulation`, 8.2 s (11.9 s before): the preset insertion and
  the modulation verification (E97).
- `delete_device`, 3.3 s: about 100 wire calls (bank reads and two parameter
  inventories for the change record, E238).

## Live correctness

- The E236 matrix A to D (`phase8h4c-edit.ts accept`, unattended): every edit
  reads back `verified`, every refusal writes nothing, and both reversal
  routes restore the raw state. `verify-offline` reports no issue
  ([accept.json.gz](../data/phase8h4g-review/accept.json.gz)).
- The 8h4e device recipes pass: A/B audition, solo modes, branch, rename,
  the refused layer-chain delete, and the winner collapse and restore.
- The composition benchmark: each run is `verified`, and each reversal
  restores an empty track.

| Composition | E238 | E247 | Reversal E238 → E247 |
|---|---:|---:|---:|
| Offline, 2 / 4 layer chains | 7.2 / 7.8 s | 3.4 / 4.0 s | 1.7 → 1.4 s |
| Staged, 2 / 4 layer chains | 36.8 / 64.9 s | 17.5 / 30.4–30.6 s | 21.3 → 12.6 s; 38.4 → 20.9–21.0 s |

## Comparisons (8h4f drivers)

The 8h4d and 8h4f drivers rerun on the current build (2 runs each, totals
without setup and cleanup):

| Workflow | `stable-v1` | `agent-native-v1` | E239 `agent-native-v1` |
|---|---|---|---|
| E45/E48-style workflow | 7 calls, 12,958 ms, 15,122 bytes | 8 calls, 6,895 ms, 28,361 bytes | 7,411 ms |
| 27-control write (the write call) | 14,255–14,376 ms, 276 wire calls | 14,372–14,391 ms, 276 wire calls | 14,463–14,521 ms, 282 |
| A/B audition and winner collapse | 9 calls, 20,191–20,247 ms, 725 wire calls | 8 calls, 11,877–12,084 ms, 447–450 wire calls | 21,877–21,903 ms |
| `launch_clip`, 4 paired launches | median 703 ms | median 752 ms | E237: 764 ms |

`stable-v1` shares the adapter, so its device writes also lost the fixed
waits (its A/B route took 50.7 s in E239). The workflow baselines end at the
raw source (`verify-offline`: no issue). The retained tools: `add_tracks` of
two tracks 1,277 ms (E239: 1,935), `duplicate_track` 817–825 ms (1,178–1,197),
`delete_track` of four tracks 1,140 ms (2,517), `set_device_enabled` 814 ms
(770, +6 percent).

## Records

- D39 amendment; 8h closeout sections in D8, D16, D19, and D21; D18 records
  the remeasured costs.
- `PROJECT.md`, the migration contract (three operation rows), and the
  workstation contract, interface, and verification references.
- The 8h parent is complete, with the disposition of each acceptance
  criterion and the retrospective target; the 8i charter carries it.

## Artifacts

[phase8h4g-review](../data/phase8h4g-review/): `inventory.json`,
`cost.json`, `worst-16384.json.gz`, `add-worst-16384.json`,
`benchmark.json`, `recipes.json`, `accept.json.gz`, and the 8h4f driver
outputs. `phase8h4g-inventory.ts verify-offline` checks the inventory.

## Verification

- Brain check: typecheck and 2,081 tests pass (new: the planner budget, the
  inventory turn count, the writer page check, the bank scan after a mark,
  the `d9MappedFields` equivalence, the 8h4g call-budget row, and the
  removed background flag).
- Codec conformance, document artifacts, and the standalone consumer pass.
- Extension tests and the wire goldens pass (normal 89 methods, unchanged).
- The publication inventory is rewritten for the changed codec and binding
  hashes (`check-publication-candidates.py --write`).
- Context check and `git diff --check` pass.
- Live: the E236 acceptance matrix, the 8h4e recipes and benchmark, the 8h4d
  workflow, the 8h4f controls, A/B, and retained drivers, and both worst
  cases. No residue: each driver deleted its tracks; "New 6" holds the
  operator fixture and 8 scenes.

## Retrospective

The E246 trace method found the biggest cost at once again: the 16,384-note
write spent 27 s in 128 page checks around a 22 ms batch. A per-method sum
hid it; the call sequence with gaps showed it. Print the sequence, not only
the totals.

Two runs overlapped on the same Bitwig: a shell `&` inside a background
command left the first run alive. Its writes made the second run fail. It
also exposed a defect in the first version of the bank-scan reuse (a scan
from an earlier call could be reused); the reuse is now bounded to one turn.
Run live drivers in one foreground chain under the background runner, and
check for stray driver processes before a live run.

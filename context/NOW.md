---
title: Current state
kind: status
state: active
updated: 2026-08-22
phase: phase-4
session: 4j-dogfood-and-closeout
---

# Now

Phase 2, bounded clip performance, the complete parameter-routing core, the
native device catalog, plugin parameter proof, deep routing, and the managed
FX-chain workflow, performance gate, and observer-efficiency repair are
complete. The public device surface is frozen and live. Phase 4 dogfood and
closeout are next.

## Accepted live result

Project `26.05-2 moon` has the original 32-beat Lead and Harmony clips in row 1.
Rows 2 through 4 hold three accepted full-phrase variations on each track. The
new `Harmony – Open Minor` track copies Harmony and adds two accepted 32-beat
clips. Zero-based row 5 contains Fm9–Gm11–Ebmaj9–Cm11. Row 6 contains
Fm11–Abmaj9–Bb13–Ebmaj9. The first new clip is open in Bitwig.

The accepted changes were not saved after the original Phase 2 session. On
2026-08-21, the exact E45 and E48 results were reconstructed from their probes,
verified, and saved. The post-save 2k baseline passes.

## Session 4a result

- The maximum scratch fixture contained 48 created tracks and 384 alternating
  Polysynth and Polymer devices.
- All 28 controlled measurements used a full track window. Stable sweeps found
  zero blind or unstable rows.
- Project density raised the 48-row cursor sweep from about 3.5 to 4.6 seconds.
  Warm-up and ping latency stayed flat. No cold-start sample stalled above
  100 ms.
- Direct parameter observers did not produce a consistent cost.
- D7 holds. `RigConfig`, the fake, probes, decision, and capability page now
  agree on `256/128/8/16/64`.
- Cleanup removed all recorded tracks. The original 42-byte `rig.json` was
  restored byte for byte.

## Session 4b result

- One bounded page reply returns all 16 verbose MIDI channels. A dedicated
  2,048-step reader covers a 32-beat clip in one binary and one triplet page.
- Writer cursors stay at 512 steps. The larger read cursor did not increase
  measured extension init cost.
- The controlled 21-note median fell from 5,323 to 1,744 ms. A second run
  measured 1,666 ms. Both pass the required 2,661.5 ms maximum.
- Grid and page zero share one complete 144 ms settlement. Multi-page reads
  still restore and settle page zero.
- The two-empty-clip workflow fell from 13,436 to 6,265 ms. Reversal restored
  both slots. Cleanup removed the owned track and restored the entry selection.
- Current live probes passed long-clip paging, triplet and expression readback,
  selection interference, background cancellation, reversal, and cleanup.

## Note-completion result

- Basic note count did not increase requests, stages, page turns, settles, or
  verification from one through 64 notes. Distinct clips, writer pages, and
  property dependency turns increased cost.
- Note-step callbacks covered add, clear, move, full clear, all channels,
  binary and triplet grids, four writer pages, and the 32-beat edge.
- Numeric fields, enum fields, recurrence, and mute produced callbacks. The
  four chance, occurrence, recurrence, and repeat enable fields were silent.
- A target generation rejects initial, stale, and unrelated events. A
  same-target foreign edit can still wake the observer. Exact readback exposed
  that conflict.
- E53 classifies the observer as a partial wake hint, not a completion fence.
  Exact bulk readback remains the proof. Silent fields and timeout require
  bounded polling or the fixed fallback.
- The accepted D7 scaffold with one observer had 27.70 ms maximum ping latency.
  Cleanup removed the owned track and restored the exact entry selection.

## Mutation-settlement result

- Compatible adjacent note writes share one transport frame only within the
  same clip, channel, and exact grid. E15-F ordering remains unchanged.
- One batch caches confirmed writer target, grid, and page boundaries. It
  restores and verifies page zero once.
- A scoped note event can wake verification for one existing clip. Silence,
  mismatch, or failure uses the fixed fallback. Exact readback proves success.
- Complete reconciliation covers all 16 MIDI channels. It retries one delayed
  exact read, never replays the mutation, and reports same-target or partial-
  stage conflicts.
- A later-stage rejection keeps the landed targets reversible. The stash uses
  exact before-and-after state and does not claim an untouched later clip.
- The two-clip expression workflow measured 7,524 and 7,749 ms. Its 7,749 ms
  median passes the fixed 9,000 ms gate and is 32 percent below E53.
- E54 records that fewer controller and page turns saved the time. The sample
  kept four stages and all eight exact bulk page reads.

## Session 4c result

- One serialized device cursor now enumerates, reads, writes, verifies, and
  replays top-level DirectParameter values.
- Each acquisition resets its observer generation, confirms a detour and the
  returned device-bank target, pins both cursors, and requires two equal current-
  generation inventories.
- The accepted Sampler exposed 32 named parameters. Pitch Transpose moved from
  0.5 to 0.55, independent readback agreed, and exact replay restored 0.5.
- Missing, unreachable, and unstable parameter targets remain separate. A
  stable device or container remains readable when only parameters are unstable.
- Silent non-taking writes become failed receipts and executor disagreements.
  Typed modulation and automation state remain optional warnings.
- DirectParameter IDs use an escaped canonical-key namespace. Numeric IDs cannot
  collide with legacy typed parameter indices in a stash or write set.

## Session 4d result

- The deterministic Bitwig 6.0.6 catalog contains all 151 native preset
  directories, 2,047 parameter candidates, and 636 separate object tokens.
- Structured META fields supply each device name and UUID. All seven known
  12-character device names are correct.
- Repeated generation is byte-identical. VST, module, and modulator settings are
  excluded.
- DirectParameter IDs use `CONTENTS/<candidate>`. Live resolution strips only
  this exact prefix before it compares a structural candidate.
- Polysynth resolved 55 of 56 candidates through both DirectParameter and the
  generated typed view. Sampler resolved 32 of 33 through DirectParameter.
  `GLIDE_TIME` was the only unresolved candidate for both devices. Neither
  device returned a live-only ID.
- The generated Polysynth input replaces the hand-maintained Java ID list. All
  55 typed handles exist and report complete base, display, modulated,
  automation, origin, and discrete metadata.
- The probe removed its owned scratch track and restored the entry selection.
  E56 records the generation and live proof.

## Session 4e result

- Device sources now keep VST3 class UIDs and CLAP IDs explicit. The old generic
  plugin source is removed. Invalid identifiers fail before a wire frame.
- Installed Zebra3 VST3 and CLAP devices inserted by explicit ID at observed
  positions 0 and 1 on one owned empty track.
- VST3 exposed 2,185 named DirectParameters. CLAP exposed 2,193. `Attack Rate`
  changed from 0.5 to 0.55 and restored to 0.5 on each format.
- VST3 insertion and inventory settlement took 1,388 and 1,238 ms. CLAP took
  1,346 and 1,470 ms. The single paired sample was comparable on this machine.
- A missing CLAP ID changed no chain state. It returned a failed receipt and no
  minted device.
- Cleanup restored the exact empty scratch chain and seven-track project. E57
  records the machine-specific proof.

## Session 4f result

- Recursive addresses now reach named chains and drum-pad channels. Each
  descent confirms the complete visible bank, selected device identity, nested
  state, and current-chain position.
- Polysynth exposed 55 named DirectParameters at depth 1, depth 2, and Drum
  Machine channel 3. `OSC1 Pulse Width` moved from `0.5` to `0.55` and restored
  to `0.5` on each route.
- The depth-2 device exposed nine named remote pages. `Osc1Pitch` moved from
  `0.5` to `0.55` and restored to `0.5`. Readback includes `modulatedValue`.
- Remote pages require a target-bound observer generation, all eight bank rows,
  and an exact existing-control count. Stale and malformed inventories remain
  unstable.
- A selection change at the batch boundary did not retarget a held depth-2
  write. The borrowed selection was restored.
- Duplicate, empty, stale, and outside-window routes fail distinctly. E58
  records the live proof and nested sibling-identity finding.

## Session 4g result

- Device enabled state is readable, writable, independently verified, and
  exactly replayed.
- A small orchestration layer appends each requested device, accepts complete
  readback, and resolves dependent parameter and relocation work from that
  observation. The static executor still owns each guarded apply and take.
- The managed fixture composes a native Polysynth, Zebra3 VST3, Zebra3 CLAP,
  and a Sampler preset around the entry `Tool` and `Delay+` devices.
- Append readback mints positions `2, 3, 4, 5`. The accepted final current
  positions are `1, 2, 3, 5` in the order `Tool`, `Polysynth`, `Zebra3`,
  `Zebra3`, `Delay+`, `Sampler`.
- Every mutation uses the prior accepted complete device-name and enabled-state
  sequences. Incomplete or full banks refuse before mutation.
- A concurrent `EQ+` move shifts an owned Polysynth away from its stale scalar
  address. Guarded acquisition refuses the wrong write, and recovery excludes
  the unrelated device.
- Reversal restores the entry enabled state and deletes owned devices by
  highest current position. A failed attempt returns the last proved retryable
  continuation. Existing-device deletion remains `none`.
- The complete fingerprint is not device identity. A same-name and same-enabled
  replacement remains indistinguishable. E59 records this limit.

## Session 4h result

- Complete native, VST3, CLAP, deep, remote, managed, reversal, and clip-
  regression workloads now emit wall, server, bridge, host-settle, phase, and
  request-count measurements.
- Native enumeration took 2,797 ms. Native replay took 6,059 ms. VST3 and CLAP
  insert, inventory, and replay took 11,872 and 12,499 ms.
- Depth-1 and depth-2 replay took 8,169 and 9,403 ms. Remote inventory took
  2,337 ms. Remote replay took 14,243 ms and used 335 requests.
- Managed cold and warm builds took 50,203 and 50,426 ms. They used 1,163 and
  1,170 requests. Cold plugin load is not the dominant cost.
- One remote replay used 124 remote-list reads and 56 page selections. Large
  plugin post-write generations can be unstable even when later exact readback
  proves restoration.
- A same-generation plugin readback trial returned stale values and was
  removed. No settle budget was reduced. No concurrency was added.
- E60 sets provisional budgets and a 2,000 ms background-progress threshold.
  Session 4i remains blocked by the focused 4h1 observer repair.
- The 4b exact-read median was 1,936 ms. The two-empty-clip workflow was 6,352
  ms. Both accepted gates still pass.

## Session 4h1 result

- One bounded reply returns up to 16 complete remote pages. The accepted
  nine-page Polysynth route uses three `remote.list` calls and no page-selection
  calls for one inventory.
- Remote inventory took 1,395 ms and 31 requests. Change, readback, and replay
  took 8,263 ms and 182 requests. E60 measured 14,243 ms and 335 requests.
- Direct parameter writes use one exact target-bound completion generation.
  Post-write proof does not request a full inventory or replay a mutation.
- Read and preflight inventories can re-arm at most three stale observer
  generations. Recovery is read-only and stays in one serialized cursor hold.
- Three cold and three warm managed trials passed native, preset, VST3, and CLAP
  scalar readback and exact reversal. Builds ranged from 46,968 to 49,458 ms.
- E61 replaces the provisional budgets, accepts the serialized cursor, and
  unblocks session 4i.

## Session 4i result

- Description version `ghostnote-description-v5` freezes six public tools for
  device inspection, parameter inventory, explicit insertion, scalar control,
  bypass, and directed deletion. Its fingerprint is
  `0bda24861be2f57ddd1f39188d4f3c7d70cd3da67ea6ffd81d9ae4fe6d98cb68`.
- The public inventory returned all 55 named Polysynth DirectParameters. Typed
  display, modulation, automation, origin, and discrete metadata appear only
  when observed. Optional remote controls use exact returned selectors or report
  explicit instability without partial results.
- Registered MCP calls inserted native, VST3, CLAP, and preset devices. VST3 and
  CLAP insertion took 1,728 and 1,729 ms. Native inventory took 1,199 ms. One
  returned parameter id changed and read back exactly in 5,938 ms.
- Bypass, scalar replay, destructive highest-first deletion, exact track-id
  cleanup, and exact entry-selection restoration passed. E62 records the proof.
- The old generic plugin wording caused no caller migration. No alias remains.

## Next action

Begin [dogfood and closeout](plan/phase-4/4j-dogfood-and-closeout.md). Use the
registered public surface for one natural sound-design task, record the operator
verdict, run the complete Phase 4 matrix, and prepare the Phase 5 handoff.

## Verification

- The Session 4i registered MCP proof passes the six-tool privilege cohort,
  native, VST3, CLAP, and preset insertion, 55-parameter discovery, scalar and
  bypass readback, reversal, directed deletion, and exact cleanup.
- VST3 insert, CLAP insert, native inventory, and top-level scalar readback pass
  the E61 budgets at 1,728, 1,729, 1,199, and 5,938 ms.
- The full brain check passes 758/758, including typecheck. Extension tests pass.
  Full live conformance passes 54/54 with six expected skips. Cleanup removed
  both conformance fixture tracks.
- The final read-only 2k baseline passes with seven tracks, 14 clips, and no
  launcher residue. Context and diff checks pass.
- The final device performance regression passes native, plugin, deep, remote,
  managed, interference, reversal, cleanup, and clip workloads.
- The full brain check passes 755/755, including typecheck. Extension tests
  pass. The fresh extension handshake passes all 148 methods with hash
  `eb3391803ef4eea4`.
- Full live conformance passes 54/54 with six expected skips. Cleanup removed
  its two fixture tracks. The final read-only 2k baseline passes with seven
  tracks and no launcher residue.
- Session 4h native, plugin, deep-route, remote, managed cold and warm,
  reversal, and clip-regression measurements completed. Exact live cleanup
  restored every owned fixture and the entry selection.
- The full brain check passes 752/752, including typecheck. Extension tests
  pass. Context check passes for 201 active documents.
- The final read-only 2k baseline passes with seven tracks, 14 clips, and no
  launcher residue.
- Session 4g focused adapter and managed-workflow tests pass 108/108. Shared
  fake conformance passes 60/60. The full brain check passes 750/750, including
  typecheck. Extension tests pass.
- The fresh Bitwig 6.0.6/API 25 handshake passes all 147 methods with hash
  `f58c5ded93d5f743` and the selected `256/128/8/16/64` rig.
- The managed live proof passes all ten rows. Full live conformance passes 54/54
  with six expected skips.
- Conformance cleanup removed its two generated fixture tracks. The final
  read-only 2k baseline passes with seven tracks and no launcher residue.
- Context check passes for 199 active documents. Both working-tree and staged
  `git diff --check` pass.
- The accepted Session 4f focused parameter, settlement, reconciliation,
  catalog, plugin, and deep-route tests pass. Its full brain check passed
  703/703, including typecheck. Extension tests passed.
- The fresh extension handshake and DirectParameter live proof pass. Sampler
  exposes 32 named parameters and exact base-value replay passes.
- The controlled read-window probe, complete latency workflow, 128-beat
  long-clip workflow, background cancellation, and final read-only 2k baseline
  pass.
- The controlled mutation workflow passes its 9,000 ms gate at 7,749 ms median.
  Full live conformance passes 54/54 with six expected skips. The fresh
  extension handshake passes all 146 methods after restart.
- The archived Phase 2h aggregate refused before mutation because it requires
  the retired `gn-scale-test` fixture. Current focused probes cover its affected
  read boundaries.
- Live entry and maximum stable sweeps: pass. The maximum accounts for all 384
  devices.
- Saved-project open and one cold start: pass with zero control-thread stalls.
- Scratch cleanup and exact rig configuration restoration: pass.
- Context check and `git diff --check` pass.
- The Session 4f closing live handshake passed for Bitwig 6.0.6/API 25, the
  146-method golden,
  deployment age, the selected `256/128/8/16/64` rig, 512-step writers, and the
  2,048-step reader.
- The `26.05-2 moon` project passes the complete read-only 2k baseline after 4b
  cleanup. It contains 7 tracks, 14 clips, both accepted instructions, and the
  exact 43-note progression result.

## Retrospective

The generic plugin wording had no current caller, so an alias would add only
ambiguity. Direct and remote observers need separate public views. Preserve
explicit unstable standing instead of returning partial remote selectors.

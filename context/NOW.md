---
title: Current state
kind: status
state: active
updated: 2026-08-21
phase: phase-4
session: 4b-clip-mutation-settlement
---

# Now

Phase 2, Phase 4 session 4a, exact read, and note-completion evidence are
complete. Clip mutation settlement is next.

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

## Next action

Run [clip mutation settlement](plan/phase-4/4b-clip-mutation-settlement.md).
Use eligible note events only to wake exact verification early. Keep bounded
polling or the fixed fallback for silent fields and timeout. This is the last
bounded follow-up before session 4c. Device-specific performance remains in
session 4h.

## Verification

- Focused 4b cursor, note-event, and live regression tests pass. Full brain check: 660/660
  pass, including typecheck. Extension build passes.
- The controlled read-window probe, complete latency workflow, 128-beat
  long-clip workflow, background cancellation, and final read-only 2k baseline
  pass.
- The archived Phase 2h aggregate refused before mutation because it requires
  the retired `gn-scale-test` fixture. Current focused probes cover its affected
  read boundaries.
- Live entry and maximum stable sweeps: pass. The maximum accounts for all 384
  devices.
- Saved-project open and one cold start: pass with zero control-thread stalls.
- Scratch cleanup and exact rig configuration restoration: pass.
- Context check: 193 active documents and links pass. `git diff --check` passes.
- Final live handshake: pass for Bitwig 6.0.6/API 25, the 145-method golden,
  deployment age, the selected `256/128/8/16/64` rig, 512-step writers, and the
  2,048-step reader.
- The `26.05-2 moon` project passes the complete read-only 2k baseline after 4b
  cleanup. It contains 7 tracks, 14 clips, both accepted instructions, and the
  exact 43-note progression result.

## Retrospective

Callback support differs by property. Test each control field. Do not infer its
signal from the related value field.

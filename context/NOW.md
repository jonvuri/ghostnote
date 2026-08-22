---
title: Current state
kind: status
state: active
updated: 2026-08-21
phase: phase-4
session: 4b-dedicated-read-window
---

# Now

Phase 2 and Phase 4 session 4a are complete. Session 4b is active. Its first
implementation removed the repeated per-channel bridge loop but did not pass the
required half-time gate.

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

- One bounded page reply returns all 16 verbose MIDI channels. A 32-beat read
  uses seven bulk requests instead of 112 channel requests.
- The accepted 21-note read stayed exact. The median fell from 5,323 to 3,446
  ms, a 35-percent reduction. The required maximum is 2,661.5 ms.
- Grid and page settlement now dominates at about 1.35 seconds. Median host
  scan time was 757 ms. Reconciliation used less than 1 ms.
- The two-empty-clip workflow fell from 13,436 to 10,072 ms. Reversal restored
  both slots. Cleanup removed the owned track and restored the entry selection.

## Next action

The next session continues
[4b exact-read latency](plan/phase-4/4b-clip-operation-latency.md). Measure a
2,048-step dedicated note-read cursor while the 512-step writer cursors stay
unchanged. Measure init cost and 32-beat latency before selecting a default. Test
one settled page-zero and grid transition without reducing the 144 ms budget.

After the read gate closes, run
[note-completion evidence](plan/phase-4/4b-note-completion-signals.md), then
[clip mutation settlement](plan/phase-4/4b-clip-mutation-settlement.md). These
two bounded follow-ups precede session 4c. Device-specific performance remains
in session 4h.

## Verification

- Focused 4b adapter, wire, and executor tests pass. Full brain check: 657/657
  pass, including typecheck. Extension build passes.
- Live entry and maximum stable sweeps: pass. The maximum accounts for all 384
  devices.
- Saved-project open and one cold start: pass with zero control-thread stalls.
- Scratch cleanup and exact rig configuration restoration: pass.
- Context check: 191 active documents and links pass. `git diff --check` passes.
- Final live handshake: pass for Bitwig 6.0.6/API 25, the 140-method golden,
  deployment age, and the selected `256/128/8/16/64` rig.
- The `26.05-2 moon` project passes the complete read-only 2k baseline after 4b
  cleanup. It contains 7 tracks, 14 clips, both accepted instructions, and the
  exact 43-note progression result.

## Retrospective

Bridge call count was not the only dominant cost. Measure host work and settle
time separately before predicting a latency result from request count.

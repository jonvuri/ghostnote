---
title: Current state
kind: status
state: active
updated: 2026-08-21
phase: phase-4
session: 4b-clip-operation-latency
---

# Now

Phase 2 is complete. Phase 4 session 4a is complete. The remaining Phase 4 work
is planned as sessions 4b through 4j. Session 4b is next.

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

## Next action

Run [session 4b](plan/phase-4/4b-clip-operation-latency.md). Measure the exact
32-beat read path, replace repeated per-channel page requests with one bounded
bulk read, and preserve every dual-grid, expression, pin, page, selection, and
checkpoint guarantee.

After 4b, build the DirectParameter core. Keep DirectParameter as the general
enumeration path. Keep Polysynth as the first typed deep view. The
[Phase 4 overview](plan/phase-4/README.md) owns the complete order.

## Verification

- Focused scale tests: 7/7 pass. Full brain check: 653/653 pass, including
  typecheck. Extension build passes.
- Live entry and maximum stable sweeps: pass. The maximum accounts for all 384
  devices.
- Saved-project open and one cold start: pass with zero control-thread stalls.
- Scratch cleanup and exact rig configuration restoration: pass.
- Context check: 179 active documents and links pass. `git diff --check` passes.
- Phase 4 planning check: 188 active documents and links pass. The planning diff
  check passes.
- Final live handshake: pass for Bitwig 6.0.6/API 25, the 139-method golden,
  deployment age, and the selected `256/128/8/16/64` rig.
- The reconstructed `26.05-2 moon` project passes the complete read-only 2k
  baseline before and after Save. The saved file contains 7 tracks, 14 clips,
  both accepted instructions, and the exact 43-note progression result.

## Retrospective

Checkpoint native-device population by durable row because an insert can outlive
the probe process. Save accepted live results and confirm the saved file before
closeout.

The Phase 4 planning pass found that exact clip reads still pay one bridge
request per MIDI channel and page. Optimize a measured shared bottleneck before
adding a new live path. Measure device performance again before public freeze.

---
title: Current state
kind: status
state: active
updated: 2026-10-20
phase: phase-9-overlap-investigation
session: 9b.5-live-doctor-606
---

## Next session

**9b.5 — Live doctor on 6.0.6.** Read the
[session brief](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b5--live-doctor-on-606),
[E311](evidence/experiments/e311-grid-offline-resolvers.md),
[symbol manifest](plan/phase-9/9b-grid-symbol-manifest.md), and
[resolved table](evidence/data/phase9b-resolvers/report.json).
Integrate the offline role table with the bounded, consent-gated scratch
doctor. Test every live invariant; validate edit counters last. Cache only
a complete pass after teardown. The offline result grants no write authority.

9b.4 is complete: all 69 member rows and 55 type roles match the pinned
6.0.6 table. Twenty-one tests pass, including a complete renamed jar model.
The scan takes 4.510 seconds and peaks at 181.875 MiB RSS. No live command,
class initialization, build, deployment, or controller replacement runs.

9b.3 and the bounded breadth investigation are complete in E310. Keep its
resource, outer-modulator, Gates-attachment, flavour, scale, and non-boolean
write limits for build-out planning. The conditional 9b.3a listening session
is not needed. Do not repeat passed breadth writes or the completed 9a audio
flow. The 9b.5 doctor has its own new scratch fixture and explicit consent.

## Deployment and live state

Last live check, E310; not rechecked in 9b.4. V18 was loaded and verified: `phase-8-probe-v1`, 118 methods,
`2e939035ea90b8b0`, marker `9b-grid-writes-v18` on both direct handlers and
`rig.info`, initialization `2026-10-20T20:38:10.868Z`. Bitwig bridge PID 24537.
Archive SHA-256: `4bf0b922a2193bb91a690facb93976de85e1a3d4c822a2b4205516fee39fed19`.
Run `npm run probe:hello` from `brain/` before any later live work. The normal
profile is not restored. Controller replacement stays an operator action.

Project: `gn-grid-spike`. Only `grid-probe`, `FX 1`, and `Master` remain.
All scratch tracks are deleted. Reader and writer are unbound and unlocked;
no uncertain claim or unfinished task remains. `grid-probe` is selected,
muted, and at -10 dB. E310 entry/exit tracks, mixer, device banks, and selection
match E308's original snapshot. Both control pairs match normalized E276:
four modules and two cables. Keep `grid-probe` unchanged.

E309 restarted Bitwig without saving, with explicit authorization for this
disposable research project. E310 sent no engine, transport, or save command.
Native witnesses report engine active; transport was stopped. Saved-file
identity and the UI save marker are untested. Old claims and managed native
IDs do not transfer to a new session.

## Material to preserve

- [E311 resolver report](evidence/data/phase9b-resolvers/report.json),
  [tests](evidence/data/phase9b-resolvers/tests.txt), and the committed
  [selectors](../brain/src/probes/grid_symbols/selectors.json).
- [E310 report](evidence/data/phase9b-writes/live-v18-factory/report.json),
  [final status](evidence/data/phase9b-writes/live-v18-factory/final-status.json),
  all six independent snapshots, `control-captures.zip`, and `calls.json.gz`.
- [E308 report](evidence/data/phase9b-writes/live-v17/report.json),
  [E309 recovery](evidence/data/phase9b-writes/v18-recovery/process-recovery.json),
  [V18 verification](evidence/data/phase9b-writes/v18-preparation/verification.json),
  and [command trace](evidence/data/phase9b-writes/command-trace.md).
- [E304 report](evidence/data/phase9b-focused/focused-report.json),
  [projection](evidence/data/phase9b-focused/focused-query-v6.json),
  [schemas](evidence/data/phase9b-focused/observed-schemas.json), and
  [catalog](evidence/data/phase9b-focused/catalog-updated.json): 65 UUIDs,
  89 observed aliases, 56 lexical filename matches. Names are editable.
- Saved `gn-grid-spike-baseline.bwpreset` remains the control. The E289 edited
  project is not a baseline. Public descriptions remain v52.

The operator's Bitwig 6.1.x update follows the general feature audit, with
6.0.6 copied aside. It is not needed for the 6.0.6 doctor. See the
[roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.

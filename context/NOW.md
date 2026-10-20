---
title: Current state
kind: status
state: active
updated: 2026-10-20
phase: phase-9-overlap-investigation
session: 9b.4-offline-resolvers
---

## Next session

**9b.4 — Offline resolvers.** Read the
[session brief](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b4--offline-resolvers),
[symbol manifest](plan/phase-9/9b-grid-symbol-manifest.md), and
[E310](evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md).
Resolve every manifest row from shape and invariants on the local 6.0.6 jar.
Reproduce the pinned table, test missing/ambiguous candidates, and measure
bounded scan cost. No live command or controller replacement is needed for
this offline session. The explicit 9b.5/9b.6 sessions own live discovery.

9b.3 and the bounded breadth investigation are complete. E308 passes Gates
boolean and Grid mapping write/restore. E310 passes fresh Gates factory,
paired detached defaults, disposal, and paired disposal reads. Gates
attachment remains outside the fixed Amplify guards. Resource loading,
outer-modulator ownership, Sampler/Audio File, FX/Note writes, integer/indexed
writes, and patches over the driver bound remain limits for build-out planning.
The conditional 9b.3a listening session is not needed for these stored-state
verdicts. Do not repeat passed writes or the completed 9a audio flow.

## Deployment and live state

V18 is loaded and verified: `phase-8-probe-v1`, 118 methods,
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
6.0.6 copied aside. It is not needed for 9b.4. See the
[roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.

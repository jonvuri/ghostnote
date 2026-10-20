---
title: E309 — Grid factory process recovery
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E309 — Grid factory process recovery

## Result

The operator confirms that `gn-grid-spike` has no unsaved work to preserve
and authorizes recovery. Bitwig quits through its normal UI. The Save Project
prompt names `gn-grid-spike`; the session selects No. PID 14292 and the port
8686 listener are absent before relaunch. This ends the old process and its
in-memory detached tree. It does not prove the native disposal command that
E308 could not run.

Bitwig restarts, and the saved `gn-grid-spike` project opens from Recent
Projects. The new bridge process is PID 24537; launcher PID 24535.
Initialization is `2026-10-20T20:03:41.731Z`. Read-only status checks show
V18 on the writer, survey reader, and `rig.info`. The profile is
`phase-8-probe-v1`, with 118 methods and hash `2e939035ea90b8b0`.
No controller Settings interaction is performed by the agent.

The [process record](../data/phase9b-writes/v18-recovery/process-recovery.json)
and [restarted status](../data/phase9b-writes/v18-recovery/restarted-status.json)
retain the observations. The reader and writer are unbound and have no lock,
foreign owner, or unfinished task. The old scratch channel is absent.
The original three track identities and order are present. `grid-probe` is
selected. Mixer, device-bank, and normalized control comparisons remain for
the next foreground chain. Do not infer the live graph from the saved project
name or the unchanged track UUIDs.

## Remaining acceptance

No new native Grid command runs. Boolean and mapping acceptance remains E308.
The factory-only probe, disposal readback, scratch cleanup, and full preserved
state checks remain pending. The operator has been asked to replace the
controller as required by AGENTS.md. After confirmation, run the full
`npm run probe:hello` check and the
[V18 recovery continuation](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#v18-recovery-after-e308).
Use fresh claims and a new output directory. Do not reuse E308's native IDs.

The V18 archive and E308 offline checks are unchanged. This recovery adds
no host path and makes no timing claim. It sends no save, engine, transport,
or native factory command. Quit and project-open UI actions are explicit
parts of the authorized recovery. Session 9b.3 remains incomplete.

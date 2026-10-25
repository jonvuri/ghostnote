---
title: Wave 4 — Vision and scope
kind: index
state: active
updated: 2026-10-24
---

# Wave 4 — Vision and scope

Start with the [decision report](report.html). Wave 4 turns the user's
direction into scope choices, workflow requirements, and an implementation
order. [Wave 3](../wave-3/report.html) remains the evidence baseline.

| Artifact | Purpose |
|---|---|
| [Decision log](decisions.md) | Append accepted transport, workflow, priority, and investigation choices |
| [Workflow sequence](workflow-sequence.md) | 13 working variations, acceptance results, and five bounded investigations |
| [Case data](sequence.json) | Reproducible tasks, dependencies, work IDs, and evidence limits |
| [Coverage assessment](coverage.md) | Main gaps after the three workflows; all 76 baseline rows mapped |
| [Direction](direction.md) | User inputs, draft vision, and questions that change scope |
| [Simplification](simplification.md) | Concrete cost/maintenance candidates and D15/D49/D19 policy boundaries |
| [Work sessions](work-sessions.md) | P01 performance/recovery, expanded R01, C01 profile removal, and I01 dependency mapping |
| [Host access](host-access.md) | Internal dependency classes and whole-tool refusal policy |
| [Remaining decisions](remaining-decisions.md) | Material scope choices and a lightweight early release outline |
| [Architecture](architecture.md) | Current code boundary, proposed ownership, and costs |
| [Decision sessions](sessions.md) | Guided questions, examples, and acceptance criteria |
| [Scope overlay](scope.json) | Proposed disposition of every wave-3 work record |
| [Report](report.html) | Ownership map, workflow comparison, and scope matrix |
| [Build and checks](verification.md) | Sources, reproducible build, and check results |

The user selected the outcome order: song construction, performable sounds,
then mixing and capture. Practical variations should exercise most of the
matrix. TCP/JSON-RPC stays now; HTTP for the bridge extension is accepted
future intent, with a possible independent Python suite. The user asked to
record that intent without creating the backlog item yet.

The latest choices prioritize MIDI, arrangement, automation, audio CRUD and
focused track readback, Grid, and live modulation. Recording and final export
are generally operator tasks. Live launches, broad structure/reuse, rare
device state, and platform expansion have lower priority.

The user accepts the [working sequence](workflow-sequence.md). V01–13 are
templates with real material supplied at execution. Broad recovery, sample
CRUD, readback, notation, internal refusal, and release boundaries are settled.
[D54](../../../decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md)
replaces mandatory agent reversal. The [selected sessions](work-sessions.md)
are ready to guide research and cleanup; T5 retention work stays deferred.
[Concrete examples](remaining-decisions.md) support decisions when an actual
capability needs them. This turn changes planning and policy, not runtime code.

The review of 2026-10-24 confirmed the set is coherent and closed its gaps:
Grid writes record no inverse and host undo stays operator-only (W4-024);
V12 adds Effect-track creation and track state, V03 adds optional cue markers,
and V01 adds name resolution with the R05 browser re-probe (W4-025). Stale
pointers and the coverage accounting were corrected. W4-D is next.

At entry, the worktree was clean at `cbe99349`. The wave-3 report and earlier
overlap work were already committed. NOW's earlier staged-state note was
stale. Wave 3 is unchanged by this kickoff.

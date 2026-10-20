---
title: E300 — Grid survey preflight and offline inventory
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E300 — Grid survey preflight and offline inventory

## Result

**The stock preset survey stopped before fixture setup.** The retained V13
reader cannot run the planned scratch survey. Its live bind request returned
`engine-session-owns-grid; use probe.gridEngine`. The source also admits only
`gn-grid-spike` / `grid-probe` / `Poly Grid`. A controller replacement alone
would not admit another track or Grid flavour.

The [9b.1 brief](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b1--stock-grid-preset-survey-read-only)
required a stop and a 9b.2 build plan if the read path was insufficient.
No archive was built or deployed. No scratch track, preset insertion, native
write, cursor move, project save, or restoration ran. Breadth acceptance
remains incomplete.

## What ran

`npm run probe:hello` passed. The
[deployment capture](../data/phase9b-survey/preflight-v13-live/deployment.json)
confirms `phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, marker
`9a-grid-audio-v13`, and fresh initialization at `2026-10-18T21:39:53.989Z`.
Process inspection found no competing phase9 driver or Ghostnote client.

The [preflight driver](../../../brain/src/probes/phase9b-grid-survey-preflight.ts)
read the identity and public state, checked that the old audio session was
used, inactive, restored, and unlocked, then made one bind request. The
[refusal](../data/phase9b-survey/preflight-v13-live/refusal.json) occurs in
[GridProbeHandlers](../../../extension/src/main/java/com/ghostnote/extension/handlers/GridProbeHandlers.java)
before target resolution or native document work. No retry followed it.
`probe.gridEngine` was used for status only.

The [before](../data/phase9b-survey/preflight-v13-live/before.json) and
[after](../data/phase9b-survey/preflight-v13-live/after.json) records are equal:
project revision, track list, public selection, device cursor, and audio
protocol status. `gn-grid-spike` has `grid-probe`, `FX 1`, and `Master`.
The cursor remains on its Poly Grid. The old session has no open epoch or
unfinished native task. The
[result](../data/phase9b-survey/preflight-v13-live/result.json) records zero
scratch tracks and zero graph captures. No project choice was received
before the survey stopped.

An earlier [connection attempt](../data/phase9b-survey/preflight-v13/failure.json)
failed at the sandbox TCP boundary with `EPERM`. It sent no host request.
The subsequent permitted connection produced the live evidence above.

## Offline inventory

The [catalog script](../../../brain/src/probes/phase9b-grid-catalog.py) records
232 `.bwmodule` filenames and
[254 preset paths](../data/phase9b-survey/stock-preset-paths.json) matching
`grid`; the planning estimate was 255. This path filter does not classify
preset contents. The [sample plan](../data/phase9b-survey/sample-plan.json)
selects five Poly Grid, four FX Grid, and three Note Grid candidates plus
the saved 9a control. All paths exist. No candidate was loaded, and the
named sampler, sequencer, modulation, and scale properties remain hypotheses.

The [catalog seed](../data/phase9b-survey/catalog-seed.json) carries three
historical UUID/name pairs from E276: Sine, Amplify, and Audio Out.
All three names match installed module filenames (3/232). No module file
was decoded. Filename agreement does not prove a file's UUID. There is no
new sample union or survey coverage result.

The [symbol manifest](../../plan/phase-9/9b-grid-symbol-manifest.md) covers
all five current 9a symbol classes: 64 method/field lookup rows, plus class
pins and stable proxy entry points. Local `javap -p` checks
[all 64 signatures in 27 lookup classes](../data/phase9b-survey/symbol-signatures.json),
including argument/return types and static modifiers. The jar hash matches
the pin. No symbol was added, invoked, or resolved on another build.
Weak invariants and the counters that need behavioral resolution are marked.

## Dimension verdicts

| Dimension | Verdict | Reason |
|---|---|---|
| a — Knob inputs and outer modulation | Unknown | No stock graph capture; no new class or field evidence |
| b — Stateful modules | Unknown | Candidate names cannot establish content representation |
| c — Module catalog | Unknown beyond the 9a seed | Three historical UUIDs and 232 filenames; survey union absent |
| d — FX Grid and Note Grid | Unknown | Current handler rejects both by target name |
| e — 20–40 module scale | Unknown | No large capture, cap refusal, document time, or heap measurement |

The **reader needs an extension change** before these dimensions can be
tested. This is an admission result, not evidence that the underlying Grid
model differs.

## Cost and verification

The preflight has 15 sequential wire calls: four identity reads, five state
reads before and after, and one refused bind. It totals 347.033 ms; the
refused bind takes 28.451 ms. See the
[call trace](../data/phase9b-survey/preflight-v13-live/calls.json).
The separate hello workflow is outside this count. The failed TCP attempt
adds zero host calls.

Host work uses existing bounded status paths and two 256-slot track scans.
The bind stops on the control-surface thread. It creates no native graph,
document task, or survey allocation. Driver output retains fixed status
records and a 15-entry call list. No peak-heap measurement is claimed.
The E276 graph-read cost model remains unchanged; its timings cannot be
compared with this refusal as a graph-read benchmark.

Verification: live refusal and equal before/after state pass. TypeScript
typecheck, catalog/path checks, exact symbol signature checks, context links,
changed section links, and diff checks pass. No product code, call budget,
or tool description changed; descriptions remain v52.

## Next and retrospective

[9b.2](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b2--scratch-reader-and-survey-continuation)
now prepares a separate scratch-target read session, batches the probe build,
waits for operator controller replacement, and completes the survey. The
full survey driver belongs there. Write probes move to 9b.3 and must be
selected from the read results.

Retrospective: a method in the deployed inventory does not establish its
admitted targets or session state. Check both guards before planning fixture
setup. The revised brief names both blockers and the required reader contract.

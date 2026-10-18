---
title: E277 — Grid value write, readback, and persistence
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E277 — Grid value write, readback, and persistence

## Result

The first internal Grid write passes on the four-module Poly Grid fixture.
The guarded V4 probe changed the disconnected Amplify from 50% to 60% and
back. Four setter calls passed, including a repeat and restoration after
project reload. Each call had two fresh independent reads. Only the target's
stored value and GUI value changed in the 53-node projection. Bitwig showed
the requested values. Host undo and redo passed. The edited value survived
save/reload. The final saved and reloaded fixture matches the baseline preset.

This closes the bounded [9a spike](../../plan/phase-9/9a-live-grid-editing-spike.md)
with a partial result. It proves a live parameter edit on this fixture, not
general module or cable CRUD. The command contracts for those operations
remain incomplete. No speculative topology command was invoked.

## Build and entry

The operator confirmed V4 controller replacement. `npm run probe:hello`
passed: `phase-8-probe-v1`, 113 methods, hash `0bf393706e47e7ed`, marker
`9a-grid-value-v4`, initialization `2026-10-18T14:40:01.023Z`. Initialization
is later than the [V4 deployment](../data/phase9a-grid-read/deployment-v4.json).
The archive SHA-256 is
`7a39313e70203494a06575adeeee0a415bb1a1a091223ea1f010a6fe229ae2ce`.
No competing phase8 or phase9 driver ran. One foreground driver ran at a time.

The host and exact jar pin are unchanged from
[E276](e276-grid-semantic-read-and-value-probe.md): Bitwig 6.0.6, API 25,
macOS 15.8 arm64, Azul Java 25, jar SHA-256
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.
The receiver, setter, native values, transaction path, and guards are those
recorded in E276. No extension code changed in this continuation.

The first UI check showed `gn-grid-spike`, muted `grid-probe` at -10 dB,
stopped transport at 1.1.1.00, and an unsaved project marker. Bitwig showed
`Audio Output Lost`, `Switched audio configuration to System In + Out`, and
`Activate Audio Engine`. This differs from E276's active meters. The agent
did not change audio settings or activate the engine. The complete baseline
projection still matched the saved preset before the first write.

## Live sequence

All links below are raw current-host captures, not request echoes.
Each driver invocation has a new bound epoch and releases it at exit.

| Stage | Evidence and result |
|---|---|
| Baseline | [live-30](../data/phase9a-grid-read/live-30-v4-baseline/capture-0.json): equal paired reads; equal preset semantics; UI 50% |
| First write | [live-31](../data/phase9a-grid-read/live-31-v4-value60/value-readback-0.json): 50% to 60%; two fresh reads agree; UI 60% |
| Reverse write | [live-32](../data/phase9a-grid-read/live-32-v4-value50/value-readback-0.json): 60% to 50%; exact baseline nodes restored; UI 50% |
| Host undo | [live-33](../data/phase9a-grid-read/live-33-v4-undo/capture-0.json): Cmd-Z reverses the last setter; exact prior 60% nodes and UI restored |
| Redo and repeat | [live-34](../data/phase9a-grid-read/live-34-v4-repeat60/capture-0.json): Cmd-Shift-Z restores 50%, verified by the two before reads; a second internal 60% write then passes |
| Edited save | [live-35](../data/phase9a-grid-read/live-35-v4-saved60/capture-0.json): UI 60%; fixture saved; saved marker cleared |
| Edited reload | [live-36](../data/phase9a-grid-read/live-36-v4-reloaded60/capture-0.json): project closed and reopened by exact path; all semantic values and topology persist; module UUIDs change |
| Restore after reload | [live-37](../data/phase9a-grid-read/live-37-v4-restore50/value-readback-0.json): fresh module UUID; internal 50% write passes; UI 50% |
| Baseline save | [live-38](../data/phase9a-grid-read/live-38-v4-saved50/capture-0.json): restored fixture saved |
| Final reload | [live-39](../data/phase9a-grid-read/live-39-v4-final-baseline/capture-0.json): fresh reads match the independent baseline preset; saved file hash unchanged across reload |
| Outer identity | [live-40](../data/phase9a-grid-read/live-40-v4-host-identity/capture-0.json): outer UUID and name equal E276 live-29 |

`verify_value_evidence.py` checks all stages offline. It compares full raw
nodes within a loaded document and semantic content across reloads. It also
checks paired reads, the four exact deltas, unchanged selection, method
identity, call counts, preset hashes, device inventories, undo/redo, and the
outer identity. The result and all timings are in
[V4 measurements](../data/phase9a-grid-read/v4-measurements.json).

The native pair is 0.7937005259840998 for 50% and 0.8434326653017492 for 60%.
Only fields 712 and 949 of the disconnected Amplify's VALUE atom change.
The other Amplify stays at 25%. The four module UUIDs stay equal during each
write. Both cables and all other projected fields stay equal. The outer
Poly Grid UUID remains `e3aebd87-3e23-4de1-8d96-da410b00d77d` across the
sequence. Full device-state preservation is not proved by this projection.
There are no sentinel devices on this fixture track. The outer modulators
remain visible in the UI; their complete state was not captured.

No write timed out or failed. Undo proves recovery of a completed edit only.
Recovery after an uncertain setter outcome remains untested. The engine was
inactive, and the edited module was disconnected. Neither document readback
nor its UI display establishes DSP adoption.

## Operation verdict

| Operation or gate | Verdict on this fixture |
|---|---|
| Module create | Not attempted. The insertion string, factory ownership, and asynchronous completion contract remain unclassified. |
| Module read | Proved for all four modules and their projected values, identities, positions, and ports. E276 supplies the independent preset and manual-delta checks. |
| Module update | Partial. One guarded parameter passes internal write, fresh readback, UI, undo/redo, and save/reload. Layout and DSP adoption are unproved. |
| Module delete | Not attempted. The correct caller, transaction boundary, and incident-cable cleanup remain unclassified. |
| Cable create | Not attempted. A candidate setter exists; compatibility and notification contracts remain unproved. |
| Cable read | Proved for both directed edges in the fixture. |
| Cable update | Not attempted. No native retarget or composite disconnect/connect contract was tested. |
| Cable delete | Not attempted. The candidate null-source path was not invoked. |
| Independent write readback | Proved for four parameter setter calls, with two fresh reads after each. |
| Engine adoption | Unproved. Audio engine inactive; no controlled audible or metered witness. |
| Edited-state persistence | Proved for the parameter value and unchanged semantic topology in one edited-state reload. |
| Recovery and cleanup | Completed-edit undo/redo and reverse write proved. Final saved/reloaded baseline equals the preset. Uncertain-outcome recovery untested. |

The command table in E276 is a discovery record, not a callable API contract.
In particular, the inspected `DbL.bm_()` calls the parent Grid and then
`cnN(true)`; this alone does not establish the edit-close claim in E276's
candidate summary. No deletion verdict depends on that interpretation.

Duplicate module types are covered by identity and exact-graph guards.
Wrong UUIDs, changed graphs, connected input/output, moved modules, invalid
values, and bipolar mode have offline refusal checks. Duplicate edges,
incompatible ports, deletion with incident cables, and live target races were
not exercised. Larger patches, FX Grid, Note Grid, feedback, sample state,
automation bindings, and broad parameter ranges remain outside this result.

## Cost and checks

The four writes take 44.019–47.623 ms each on the wire. Their document tasks,
including the fresh guard capture and setter, take 2.306–11.910 ms. The first
setter task is the cold maximum. The repeated 50% to 60% task takes 2.306 ms.
Twenty-eight semantic reads take 39.680–52.089 ms on the wire and
1.079–10.313 ms in the document task. These repeats show no wire regression
above 20 percent against E276's 43.599–50.752 ms range. The engine state
differs, so these are probe observations, not an active-DSP benchmark.

Each capture has 53 nodes, 278 graph work units, 1,606 shared query work
units, and 35,827–35,828 encoded graph bytes. Read queue time is
0.050–1.843 ms; write queue time is 0.044–0.111 ms. `completionNanos` measures
queue-to-controller-completion, not a separate completion stage: reads take
22.170–26.030 ms and writes take 17.165–23.041 ms on that clock. Do not add
that duration to the queue and document durations.

The full write workflow uses 18 sequential wire calls and sums to
522.946–583.424 ms of wire time, plus the driver's explicit 150 ms settle and
client overhead. It includes two before reads, one guarded mutation request,
and two after reads. The five core requests use about 240 ms of wire time. The other 13 calls
cover entry, route, bind, selection, and release. The full workflow is
therefore larger than a primitive-only budget. Host scheduler turns were
not counted directly. Product call
budgets do not change. Heap samples rise by 0 or 2 MiB per capture; these are
not peak or retained-heap bounds. The 16-module/24-cable case remains unmeasured.

V4 extension checks, archive profile checks, TypeScript typecheck, and 236
wire-map, adapter, and call-budget tests passed before deployment (E276).
This continuation adds only an offline evidence verifier and documentation.
The evidence verifier and nine semantic tests pass. Context links and diff
whitespace checks pass. [Verification](../data/phase9a-grid-read/verification-v4-live.json)
records the checks and the hello log hash. Descriptions remain v52, with
44 public tools. No public description changed.

## Handoff

The project is open, saved, muted at -10 dB, and stopped. The engine remains
inactive with the Audio Output Lost notice. Its final hash is
`8073707c552a7cdde4e184429f638bb830e8acf0daa8381a333340fd1df90ba1`
(34,128 bytes). The independent preset remains
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`
(10,451 bytes). Exact paths are in the
[final file record](../data/phase9a-grid-read/live-39-v4-final-baseline/files.json).
All epochs are released. `gn-scale-test` retains its original unsaved marker;
this continuation did not save or change that project.

The V4 research profile remains deployed. The normal profile was not restored.
The next step is review of the staged 9a result and Phase 9 scope selection.
No further implementation session is selected by this evidence. The limits
above are not a product backlog or an assertion that live CRUD is impossible.

## Retrospective

Keep the three witnesses separate: current document read, visible UI, and
running-engine behavior. Record the engine state at each live entry. For a
project reload, observe the file chooser before typing its path; the first
batched open/path attempt did not open the chooser. Separate actions worked.

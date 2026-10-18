---
title: E280 — Grid retarget and module delete probe
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E280 — Grid retarget and module delete probe

## Result

V6 replaces the source of the spare Amplify input from Sine OUT to the first
Amplify OUT, and back. Three retarget writes pass exact paired readback. Each
direction is one host undo/redo step. The UI shows the changed source. The
retargeted state survives save/reload. The original four-module, two-cable
baseline is restored, saved, and reloaded. Its semantics match the unchanged
preset. The outer device identity is unchanged.

This advances [9a](../../plan/phase-9/9a-live-grid-editing-spike.md); it does not
close the spike. The engine remained inactive. The result proves the bounded
document operation, UI, undo, and persistence. It does not prove failure
atomicity or DSP adoption. V7 prepares native deletion of the spare Amplify
and awaits operator replacement. No V7 live call has run.

## Entry and preservation

The operator confirmed V6 replacement. `npm run probe:hello` passed with
`phase-8-probe-v1`, 114 methods, `9dc11c1f9958f4d8`, and deliberate marker
`9a-grid-retarget-v6`. Initialization was `2026-10-18T15:40:26.010Z`, after
[E279's deployment](../data/phase9a-grid-cables/deployment-v6.json). The
[hello summary](../data/phase9a-grid-retarget/hello-v6-summary.json) retains
these checks. No competing phase8 or phase9 driver was found. Drivers ran
in one foreground sequence.

`gn-grid-spike` was active. The saved file and two complete baseline reads
matched E279. The fixture tab was already starred after controller replacement.
Track `grid-probe` was muted at -10 dB and armed. Transport remained stopped
at 1.1.1.00. The engine was inactive. No audio setting changed. The open
`gn-scale-test` tab retained its prior unsaved marker and was not edited or
saved. All successful fixture drivers require unchanged selection and saved
file hashes during the call. All epochs were released.

## Live sequence

Data: [phase9a-grid-retarget](../data/phase9a-grid-retarget/).
The [UI witness](../data/phase9a-grid-retarget/ui-witness-v6.json) distinguishes
visual observations from keyboard actions checked by graph reads. Screenshots
remain in the conversation. The independent verifier is
`python3 -B tools/grid-spike/verify_retarget_evidence.py`. It reproduces the
[measurement report](../data/phase9a-grid-retarget/v6-measurements.json).

| Capture | Operation and result |
|---|---|
| `live-56-baseline` | Two equal reads match the saved preset. |
| `live-57-connect` | Establish Sine OUT -> spare Amplify IN. Paired reads and UI agree. |
| `live-58-retarget-amplify` | Replace Sine with first Amplify OUT in one setter call. Exact paired delta and UI agree. |
| `live-59-undo-retarget` | One undo restores the exact Sine-connected graph. |
| `live-60-redo-retarget` | One redo restores the exact Amplify-connected graph. |
| `live-61-retarget-sine` | Replace the source in the reverse direction. Exact paired delta passes. |
| `live-62-undo-reverse` | One undo restores Amplify as source. |
| `live-63-redo-reverse` | One redo restores Sine as source. |
| `live-64-retarget-repeat` | Repeat Sine -> Amplify for timing. Exact paired delta passes. |
| `live-65-saved-retarget` | Save the three-edge state; tab is unstarred. |
| `live-66-reloaded-retarget` | Close and reopen the saved project. All projected semantics persist; module UUIDs change. |
| `live-67-restore` | Remove the test cable with fresh identities. Paired reads restore baseline semantics. |
| `live-68-saved-baseline` | Save the restored baseline. |
| `live-69-final-reload` | Reopen; graph and UI show four modules, two cables, and 25%/50% Amplify values. |
| `live-70-outer-identity` | Outer identity equals E277's final capture. |
| `live-71-read-repeat` | Two additional reads agree with the restored preset. |

All five writes have independent after reads. The three retargets change only
the spare input's source reference; its count stays one. No explicit null
stage is issued. The two original edges and all other projected fields stay
equal. The native setter and one-step undo result establish a native source
replacement on this fixture. No failed setter was forced, and no rollback
or intermediate engine-state guarantee follows.

Final project: 34,128 bytes, SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
Preset: 10,451 bytes, unchanged SHA-256
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
Outer Poly Grid UUID: `e3aebd87-3e23-4de1-8d96-da410b00d77d`.
A [verified temporary backup](../data/phase9a-grid-retarget/baseline-backup.json)
is `/tmp/gn-grid-spike-e280-baseline.bwproject`. Recheck it before V7 writes.
The saved project bytes changed across saves; the complete projected semantics
agree with the baseline. This is not a complete serialized-device comparison.

## Cost

The three retarget calls take 44.320–47.627 ms wire time and 2.511–8.173 ms
document time. The matched repeated forward retarget takes 44.320/7.601 ms.
All five writes, including setup and restoration, take 42.727–47.627 ms wire.
Each write workflow uses 18 calls and sums to 512.966–575.496 ms wire time,
plus 150 ms explicit settlement. No wire regression exceeds 20% against V5.
Forty semantic reads take 43.048–50.489 ms wire and 1.030–7.521 ms document.

The first cold write takes 15.415 ms on the document thread, 31% above V5's
11.801 ms maximum. V6 resolves one more bounded source path. Cold class and
JVM work can also contribute, but this run does not isolate their share.
The matched retarget repeat stays below the V5 maximum. Keep the cold cost
as a limit; do not claim a proved cause or a steady-state regression.

All captures have 53 nodes, 35,827–35,830 encoded bytes, 278/279 graph work,
and 1,606/1,607 query work. Heap samples rise by 0–2 MiB for reads and 2–4 MiB
for commands. V5 commands sampled 2 MiB. These coarse samples do not measure
peak or retained heap. No product call budget or description changes.

## Module command discovery

The [environment record](../data/phase9a-grid-retarget/environment-v7.json)
records the pinned Bitwig 6.0.6 jar, reference clone states, and class bytecode
hashes. `tools/grid-spike/inspect_host.py` reproduces the narrow inspection.
Vendor bytecode stays under `/tmp/gn9a-v7-bytecode`, outside the repository.
No external implementation was copied into the new probe.

| Path | Trace and current verdict |
|---|---|
| Early delete candidate `DbL.bm_()` | Calls `gOr.ffA(DbL)`, whose operation label is `Resize module`, then closes the resize edit. This corrects E276's deletion candidate. It is not used. |
| Native module delete `had.qON()` | Gets the parent with `Fuu()`, builds a singleton list, and calls `cbl.ffA(List)`. This is the selected V7 entry. |
| Delete transaction | `cbl.ffA(List)` checks common parent, creates `l2U`, opens a named delete edit through `ytV`, calls the owned removal for each module, and ends the edit. A refused transaction can return without deleting; a return alone is not success. |
| Removal and notification | `cbl.ffA(had,true)` runs ancestor hooks through `sIm.ffA(eIG)` and module cleanup through `uqo()`, then delegates to `NHx`. The latter calls the relationship/notification hook, removes the list entry, and clears the parent. `DbL.uqo()` also visits its internal `NDn` objects. Incident-cable behavior still needs live proof. |
| Failure | The selected command has no general rollback/finally wrapper around the removal loop. An exception can leave a partial edit. Keep the existing uncertain-write poison and no-retry rule. |
| File-based insertion lead | `gOr.ffA(String,int,int,ITE)` reaches `Svr`'s path loader, then the `mhb` insertion callback and native collection insertion. The string is a file reference, not a type UUID. Async loading needs a separate completion and target guard. |
| Native type factory lead | `DbL.pvN(UUID)` reaches `Lqu.asI()` and `xQx.ffA(UUID)`, then constructs a module with a random instance UUID. `xQx` can load a definition file on a cache miss. Ownership, default state, cold I/O, and full creation failure behavior need a bounded probe before attachment. |

The next insertion work remains in 9a: trace the factory's copy/initialization
contract, prove a detached Amplify with native defaults, then inspect the
native collection insertion's attach and edit boundary. Do not treat the
factory's UUID signature as a complete live create command. No factory ran
in this turn.

## V7 preparation and next live gate

V7 adds probe-only `probe.gridModuleDelete`. It admits only the fourth module
of the exact fixture, with four distinct current UUIDs, the complete expected
53-node graph, the fixed types, values, positions, and original edges. Its
input may be disconnected or connected from Sine or the first Amplify. The
spare output must have no consumer. The guard reuses the cable fixture checks.
It then resolves that module, checks exact `DbL`/`gOr` classes and parent
object identity, repeats the document/track/device proof, and invokes
`had.qON()` once on the document thread. It makes no direct field write.

The driver `delete` mode requires two after reads to equal the expected graph:
remove only the spare module, its contents and six atoms, and its Grid list
membership. The remaining 45 nodes must agree exactly. The pre-write graph
is explicitly not readback. Existing deadlines, poisoning, selection checks,
and epoch release rules remain in force.

The plan recorded the V7 cost before implementation: 18 calls, five captures,
one mutation, about 550 ms summed wire plus 150 ms settlement, and 8 MiB
planned temporary heap. Typical and maximum scope are the same four-module
fixture. No V7 live cost exists yet.

[V7 deployment](../data/phase9a-grid-retarget/deployment-v7.json): 654,936 bytes,
SHA-256 `ae519c2c72bbc9af3695ab178f88b37606f92bbfda68e4b9985988959297eacb`,
115 methods, hash `252339a249e3a8ae`, marker `9a-grid-delete-v7`.
The normal profile stays 92 methods. Historical inventory is 174 methods,
`422fbda10474cac5`. The research archive remains deployed.

Next: operator fully removes the old controller and adds the final matching
`ghostnote probe` in the complete list. Run hello and check fresh initialization
and the V7 marker. Before deletion, copy the saved baseline file to a temporary
backup and verify its hash. Test deletion without and with the admitted input
cable, undo/redo, repeated timing, and edited reload. After edited reload,
close the fixture, restore the exact backup bytes, reopen, and compare the
baseline preset. Do not save an uncertain edit over the only baseline copy.

## Verification and retrospective

`./gradlew check --offline` passes, including graph bounds, identity, async
failures, fixture guards, and archive/profile checks. Deletion parser tests
cover all three admitted before states and reject an extra after source or an
unsupported source. The shared guard tests cover stale UUIDs, changed values,
positions, types, ports, edges, and incomplete graphs. The new method is WRITE
and absent from normal and capture profiles.

The [verification record](../data/phase9a-grid-retarget/verification-v7.json)
records the checks. Type checking, all 55 wire tests, the nine semantic parser tests, V5 and V6
saved-evidence verifiers, context validation, and whitespace checks pass.
The first wire test run found a missing aggregate historical bucket entry;
it was corrected and all 55 tests reran successfully. V7 was built and deployed
with `copyProbeExtension --offline`. Descriptions remain v52, 44 public tools.
All session changes are staged; no commit was made.

Retrospective: classify a command from its full call chain and operation label
before naming it in a plan. The resize/delete correction shows why a short
obfuscated method body is insufficient. The active plan now names the native
delete wrapper and requires a saved-file backup for destructive persistence
tests.

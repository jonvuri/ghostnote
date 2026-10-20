---
title: E308 — Grid writes pass; detached factory read locks
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E308 — Grid writes pass; detached factory read locks

## Result

V17 passes the Gates boolean and SEMtex mapping cases. Each case has paired
independent reads before the first command and after both commands. Boolean
false → true → false passes. Mapping removal and restoration pass, including
amount 129, flags, both endpoint lists, and preserved input routing. Only the
selected mapping/reference identities and selected list position can change.
Both completed cases release their claims and delete their scratch tracks.

The Gates factory command returns. Its first independent read fails at
`breadth-managed-id-alias`. The writer locks and retains the fixture. Two
read-only inspections agree: the fixture has not changed, the detached root
is not disposed, and all 236 owned objects remain undisposed. Ownership and
initialization checks pass, but the detached descriptor projection does not
complete. Factory acceptance is **unknown**. No disposal or attachment runs.
No command is retried. Session 9b.3 is incomplete.

The [report](../data/phase9b-writes/live-v17/report.json),
[final status](../data/phase9b-writes/live-v17/final-status.json), and
[exit record](../data/phase9b-writes/live-v17/exit.json) record these limits.
Full control captures and schemas are in
[control-captures.zip](../data/phase9b-writes/live-v17/control-captures.zip).
The full [call log](../data/phase9b-writes/live-v17/calls.json.gz) is compressed.
Archive bytes were checked before the raw copies were removed.

## Loaded build and marker correction

The operator confirms replacement. V17 initializes at
`2026-10-20T19:26:24.092Z`, after deployment. The first hello rejects the
`rig.info` Grid label, which says V16. Inspection of the deployed archive
shows that `CoreHandlers.class` contains that old inlined constant. The
writer and both Grid handler classes contain V17. The archive hash still
matches E307. Both direct live status routes return V17.

The smoke check now reads the survey and writer markers directly. Both must
match; the `rig.info` label is advisory. The
[revised hello](../data/phase9b-writes/v17-live-checks/hello.txt) passes the
profile, 118 methods, hash `2e939035ea90b8b0`, fresh initialization, and both
V17 handler markers. The [archive inventory](../data/phase9b-writes/v17-live-checks/archive-markers.json)
records the stale label. The survey driver checks its direct status marker;
the writer already checks its own marker. No native guard is removed.

The process check finds no competing driver or established bridge client.
Only Bitwig PID 14292 listens on port 8686. The foreground driver runs once.
An earlier smoke-check shell launch fails at the sandbox IPC pipe before
host contact; the admitted smoke check then passes.

V18 replaces the constant chain with runtime marker methods. Archive checks
reject copied Grid labels in Core, survey, and probe consumers. This prevents
an incremental compile from leaving an old consumer label. Public tool
descriptions remain v52. No public method or product call budget changes.

## Live state and preservation limits

The project remains `gn-grid-spike`. `grid-probe` remains selected, muted,
and at -10 dB. Original track identities, names, types, and mixer fields
match entry, excluding index/position shifts caused by the retained scratch
track. The first two scratch tracks are deleted. The retained fixture is:

- Track: `gn-9b-write-37b75148-bc68-4447-9a5c-adc09a1c93d7`
- Channel UUID: `b8077f74-8e28-4394-a3b3-ffb654b7ba22`
- Device: Poly Grid at index 0; WT Parkour; muted at -10 dB.
- Writer claim: `61929794-ead9-454a-a79f-472d3e0bd478`; one command, zero
  accepted post-command reads, two inspections, locked, no unfinished task.

The entry control pair matches normalized E276: four modules and two cables.
The final control pair and full device-bank comparison do not run because
the uncertain writer retains exclusion. Do not claim full restoration.
No engine, transport, or save command runs. Native witnesses report the engine
active; bind guards require stopped transport. This does not prove audible
behavior. Saved-file identity and the UI save marker are not tested.

## Detached identity correction and checks

The reader used document field 14 as a unique ID for detached objects.
That assumption fails after factory creation. V18 uses the already proved
ownership order for detached IDs (`detached:0`, etc.). The ownership walk
must still return the same objects in the same order. The native UUID remains
the fresh-instance check. References outside the owned tree are refused.
Document ID alias checks remain unchanged. This does not admit attachment.

The new map holds at most 256 entries. Its construction charges one work unit
per object against the same 4,096-work/one-second snapshot budget. It replaces
detached field-14 reads; it adds no bridge call, document task, or command.
The fixed fixture projection and all byte, class, child, and ownership limits
remain. The 48 MiB planning allowance remains; it is not a measured peak.
Live factory projection cost must be measured after process recovery.

[V18 verification](../data/phase9b-writes/v18-preparation/verification.json)
passes type checking, 18 focused TypeScript tests, the Java Grid harness,
command metadata checks, and all archive checks. New tests retain document
alias refusal and cover detached identity stability, foreign references,
duplicate/empty/oversize scopes, and document/detached overlap.

V18 is [deployed](../data/phase9b-writes/v18-preparation/deployment.json) at
`2026-10-20T19:33:50.742457Z`, SHA-256
`4bf0b922a2193bb91a690facb93976de85e1a3d4c822a2b4205516fee39fed19`.
Its only packaged Grid version literal is in the writer's marker method.
V18 has not been loaded or checked live. V17 remains loaded and locked.

## Measurements

The driver logs 422 calls and 11,176.606 ms of summed wire time. This is not
wall time. Hello and the final six status/mixer calls are outside this log.
Five native commands run. Completed reads take 44.967–49.743 ms wire;
command calls take 47.146–49.268 ms. Returned read bodies are 5,238–11,727 bytes.

| Case | Descriptor work | Read document time | Native command time |
|---|---:|---:|---:|
| Boolean, 19 modules | 791 | 0.747–3.572 ms | Enable 1.253 ms; restore 0.775 ms |
| Mapping, 50 modules | 1,567; 1,517 while removed | 1.069–7.552 ms | Remove 4.577 ms; restore 8.196 ms |
| Factory baseline, 19 modules | 791 | 0.772–1.021 ms | Create 4.238 ms; disposal absent |
| Factory inspections | 825 before alias refusal | 3.820–4.091 ms | None |

The complete per-task report includes queue, snapshot, heap, and command
samples. Heap deltas are 0–8 MiB; these process samples do not bound peaks.
The factory read failure has no completed snapshot timing.

The unchanged entry control takes 47.402/47.892 ms wire and 3.768/2.969 ms
document, with 1,606 query and 278 graph work units. These times are within
20 percent of E304. E307's slower first captures do not recur in this pair;
the cause of those earlier samples remains unknown. There is no exit pair
and no new stable worst-case claim. No write is repeated for timing.

## Recovery and lesson

Follow the explicit [9b.3 recovery continuation](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#v18-recovery-after-e308).
The protocol cannot release or dispose after this failed read. Both inspection
slots are used. Do not reset the latch, delete the uncertain fixture, invoke
an old writer, or retry the factory. A controller replacement alone does not
prove that the detached native tree is gone. Require full Bitwig process exit.
First establish whether the operator needs to preserve unsaved project work.
No save, close, restart, or fixture deletion is authorized by this record alone.

After operator recovery, verify the new process and V18 hello. Re-establish
project and scratch ownership from fresh observations. Remove retained scratch
only after process recovery and identity checks. Run a fresh factory-only case;
do not repeat the passed boolean or mapping cases. Finish the preserved-state
and control comparisons before closing 9b.3. No listening session is required
for these stored-state verdicts; audible behavior remains outside this result.

Lesson: a detached object needs an identity scope that does not depend on
registration in a document. Test duplicate raw IDs before the first factory
write. Build markers must use runtime calls; archive checks now reject copied
consumer labels.

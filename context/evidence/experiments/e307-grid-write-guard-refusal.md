---
title: E307 — Grid write guard refusal and correction
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E307 — Grid write guard refusal and correction

## Result

V16 loads and passes hello after operator replacement. All three 9b.3 cases
refuse at `breadth-edit-context` before native command entry. No boolean,
mapping, factory, or disposal command runs. The driver inspects each refusal,
proves zero commands, releases the claim, and deletes its owned scratch track.
All three scratch tracks are gone. Preserved tracks, device banks, mixer,
selection, and the normalized E276 control pass their exit comparisons.

The refusal exposes a writer guard bug. V16 compares the `Svr` project root
with its `cZl` edit wrapper. These are different native types. V17 corrects
the receiver roles and adds regression checks. V17 is checked and deployed;
operator replacement and native write acceptance remain pending.

## Live evidence

The [report](../data/phase9b-writes/live-v16-a/report.json),
[results](../data/phase9b-writes/live-v16-a/results.json), and
[final status](../data/phase9b-writes/live-v16-a/final-status.json) retain the
measured result. V16 initialization is `2026-10-20T19:16:37.495Z`. Hello
confirms `phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, and marker
`9b-grid-writes-v16`. The project is `gn-grid-spike`.

Full control captures and schemas are in
[control-captures.zip](../data/phase9b-writes/live-v16-a/control-captures.zip).
The complete [call log](../data/phase9b-writes/live-v16-a/calls.json.gz) is
gzip-compressed. Archive bytes were checked before removing the raw copies.

Process inspection finds no competing probe driver. Only Bitwig listens on
port 8686; no other client holds a bridge connection before the driver starts.
Unrelated MCP daemons remain running. The first launch receives a sandbox
connection refusal before reaching the host; its
[call log](../data/phase9b-writes/live-v16/calls.json) records both refused
connection attempts. The admitted foreground run uses a new output directory.

| Case | Fixture modules | Descriptor work per inspection | Native commands | Verdict |
|---|---:|---:|---:|---|
| Gates boolean | 19 | 791 | 0 | Refused before command: edit context |
| SEMtex mapping | 50 | 1,567 | 0 | Refused before command: edit context |
| Gates factory | 19 | 791 | 0 | Refused before command: edit context |

Each refusal has two read-only inspections. Their fixture projections agree
within each pair. These inspections prove descriptor readability, not the
native witness or a write. Offline validation of the captured typed fixtures
also passes with the witness explicitly excluded. The
[typed-fixture check](../data/phase9b-writes/v17-preparation/typed-fixtures.json)
records this limit.

The [exit record](../data/phase9b-writes/live-v16-a/exit.json) has no scratch
track and no uncertain state. Final status has no bound reader or writer,
no lock, no timeout latch, and no unfinished native task. `grid-probe` stays
muted at -10 dB and remains selected. The paired control reads before and
after the run match E276: four modules and two cables. No engine, transport,
or save command runs. Engine activity, saved-file identity, and the UI save
marker are not independently tested. Bind guards require stopped transport.

## Correction and checks

The [local bytecode trace](../data/phase9b-writes/v17-preparation/edit-document-trace.md)
shows that `cZl.ffA(ikl)` finds an existing edit wrapper through the owner's
registered root. It does not return the `Svr` root. V16 also supplied this
wrapper to engine getters after the impossible identity check.

V17 resolves the edit wrapper from both the Grid and the current project
root and requires the same non-null object. It uses that wrapper for journal
and replay reads. It uses the project root for engine state and connection
reads. The witness retains both identities, in addition to the target epoch.
No guard is removed and no new obfuscated member is used.

The [verification record](../data/phase9b-writes/v17-preparation/verification.json)
records 26 focused TypeScript tests, type checking, the Java Grid harness,
command/receiver metadata checks, and all archive registrations. All pass.
Tests reject different or null edit wrappers. Pinned metadata checks prove
that the lookup accepts the project root and that journal and engine getters
have different receiver types. E306's unchanged product call-budget results
remain applicable.

The [deployed archive](../data/phase9b-writes/v17-preparation/deployment.json)
has marker `9b-grid-writes-v17`. It was copied at
`2026-10-20T19:21:33.032971Z`, SHA-256
`ea1f694afa43b105d64284e1804852a68f48e1243c1c1818fade91a9318701d7`.
The copied archive matches the checked probe build. Loaded classes are not
verified. Public descriptions remain v52; the method count/hash stay fixed.

## Cost and limits

The live run makes 526 logged calls with 13,476.156 ms of summed wire time.
This includes fixture operations and both control read sessions. It excludes
hello and the final six-call status check. Summed call time is not wall time.
Six inspection calls take 45.338–48.318 ms wire and 3.704–6.261 ms document.
Their snapshot times are 2.749–5.248 ms. Returned inspection bodies are
5,253–11,740 bytes. Heap deltas are 0–2 MiB, which do not bound peak memory.
The first breadth bind takes 146.609 ms; later binds take 46.629/46.819 ms.

The unchanged control has the same 1,606 query and 278 graph work units as
E304. First captures take 77.758/78.174 ms wire; second captures take
47.881/47.982 ms. Document times range from 8.520 to 50.889 ms, above E304's
3.518/4.751 ms. The first wire captures exceed the 20 percent comparison
threshold. The cause is not proved. No stable control-performance claim
follows. The explicit V17 continuation remeasures the planned control pairs.
No write is repeated for timing.

V17 adds one existing edit-wrapper lookup per snapshot, including inspection.
The normal three-case model adds 24 native lookups and zero bridge calls.
All command stages, bounds, and the 48 MiB planning allowance stay unchanged.
Native command timing and full witness cost remain unmeasured.

## Next and lesson

Continue [9b.3 with V17](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#v17-guard-correction-after-e307).
The operator must fully remove the controller and choose the final matching
`ghostnote probe` product in the complete list. Then verify fresh hello and
run the fixed cases on new muted scratch tracks. Old claims do not transfer.
Gates attachment remains outside the fixed Amplify guards.

Lesson: when two native subsystems use the word document, verify their
receiver and return types together. Signature resolution alone did not catch
the invalid identity comparison. The new metadata regression check covers it.

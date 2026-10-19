---
title: 9a — Signal observable selection after E294
kind: plan
state: deferred
status: Historical E295 findings. Automated producer research is deferred; E299 closes 9a with operator audio evidence.
updated: 2026-10-19
parent: 9a-live-grid-editing-spike.md
---

# 9a — Signal observable selection after E294

> Historical design. [E299](../../evidence/experiments/e299-grid-spike-close-out.md)
> closes 9a. [E298](../../evidence/experiments/e298-grid-operator-audio-live-test.md)
> passes the accepted operator audio test. Deployment states and procedures
> below describe their original sessions. They are not current instructions.
> See [NOW](../../NOW.md) for the retained V13 deployment and last verified state.

## Superseded acceptance after E296

The operator selected the [manual audio test](9a-operator-audio-test.md).
Its acceptance replaces the automated signal requirement below. This document
preserves E295's findings and the deferred producer-reconstruction option.
Do not run that research as the next 9a session. Resume it only for a selected
need for automated signal evidence. The negative source result remains valid.

## Result and fixed requirements

[E295](../../evidence/experiments/e295-grid-observable-design.md) completes the
observable comparison after [E294](../../evidence/experiments/e294-grid-valid-packet-witness-trace.md).
No examined candidate proves a complete observable. The result remains
`fresh-meter-evidence-unavailable`. Do not implement or deploy the runner.
Keep 9a active. This result does not exclude all possible host observables.

Keep the [continuous-signal contract](9a-continuous-signal-design.md): unchanged
Sine → Amplify A → Audio Out, disconnected spare Amplify, muted -10 dB track,
stopped transport, no test notes, eight gain windows, one session, first-failure
freeze, and exact restoration. Both fixture and master need independent fresh
measurements, including zero. Positive controls do not replace valid-zero proof.

The source manifest and reproduction script are in
[phase9a-observable-design](../../evidence/data/phase9a-observable-design/source-inspection.json).
Only installed files were read. No host call, process attach, native-memory
read, subscription, decoder invocation, fixture operation, or deployment ran.
V12 stays loaded, used, and locked. Do not repeat its final restoration read.

## Candidate comparison

An unknown field below is a failed admission requirement. It is not permission
to infer a value or run a live discovery call.

| Candidate | Exact binding and valid-zero proof | Freshness, age, and coherent value | Thread, lifetime, limits, and refusal |
|---|---|---|---|
| Existing Java peak/RMS and public VU callback | The channel proxy resolves `cyR.pvN(): Cic`, `Cic.Uhv()[2]`, then `Bsp.NaF()` for peak or `Bsp.ffA()` for RMS. E294 binds this cache to DxI. Validity is discarded; reset and invalid decay can leave zero. | `EbT` advances on valid and invalid updates. Callback receipt time dates delivery, not the packet. Binding sends a cached value; equal values can suppress events. Java thread serialization does not restore discarded validity. | Read the cache on the document thread; callbacks are queued to the controller. Keep document, channel, meter, and connection identities for one session. Existing two VU subscriptions fit E293 but cannot pass freshness. Refuse as a measurement; retain diagnostic/master-leak use. |
| Existing meter shared-memory record | E294 traces DxI → `AcO.RR()` → KzN → Yuj/uqc registration. The payload has five floats and two bytes; byte 21 selects valid/decay. This binds a Java registration, not a proved native producer lifetime. | No per-target age or update sequence is proved. JNI returns a mapped address only. Native meter producer functions, all writers, and publication ordering remain unresolved. Global document progress cannot date this record. A raw validity byte can be old or read with another update's value. | The Java document thread cannot exclude a native writer. Registration reuse, native publication, safe mapping lifetime, and read bounds require proof. Do not call `uqc.Uhv()` or the decoder; they are not passive accessors. Refuse before measurement. |
| Existing native visualization: array readout and lightweight oscilloscope | JNI readers exist, but no read-only route binds one to both existing fixture and master meters. No inspected source maps their samples to the unchanged fixture. All-zero pixels or arrays do not prove valid zero. | Array readout compares a word before copying values; the word's producer meaning and clock are unproved. The scope reader claims shared state 2→3, copies data, then writes 0. This is a different protocol from DxI's 22-byte payload. No target age is proved. | Graphics `beginFrame()` dispatches a virtual reader. The exact thread, producer synchronization, resource ownership, and mapping lifetime are not proved for probe access. The scope can resize storage from shared dimensions. Do not call it, change its flags, open a new scope, or borrow a render resource. Refuse without target, age, lifetime, and cap proof. |
| Graph/command result or rendered output file | Existing graph reads bind the intended Grid and prove document edits. A rendered file would need a new, proved association with this active engine interval. | Native edit completion is not a signal packet. No inspected source supplies a render receipt tied to the current continuous engine. File creation time would not prove current DSP adoption. | Graph reads retain their existing role. Recording, export, routing changes, or a new analyzer are outside this unchanged-fixture design. No live route or bounded cost is admitted. Do not substitute these for signal measurements. |

The first three rows have direct source evidence in E294/E295. The last row is
a scope exclusion, not an audit of every export or recording API. Screenshots
of a meter have no additional packet metadata. A screenshot time cannot make
a stale displayed zero fresh. An external output capture after mute also
cannot measure the fixture's positive gain response without a different route.

## Native trace boundary

The pinned ARM64 engine contains these exact type-name strings:
`flt::core::VuMeterAtom`, `VuMeterAtomNode`, `EngineSharedMemoryManager`,
`EngineSharedMemoryHelper`, `EngineSharedMemoryHelperNode`, and
`SharedMemoryAnalysisAtom`. The manifest records the mangled names and file
offsets. The four selected symbol predicates have no matches in `nm` output.
These strings are leads, not resolved classes or writer functions. Do not use
the offsets as live addresses. The X64 engine was not inspected.

The JNI ARM64 slice has named functions. Its
`SharedMemory_getSharedMemoryAddress` at `0x500350` loads one pointer from the
wrapper and returns it. `createServerNative` calls a shared-memory allocator.
Neither function is the meter producer or a coherent packet accessor.

`bitwig::document::EngineSharedMemory::beginFrame()` at `0x533ff4` builds a
local input stream from stored pointer/length fields and dispatches a virtual
reader. Its `ldadd` addresses a stack field. It is not proof of a meter
publication sequence. `init` at `0x534cbc` takes pointer/length data from
graphics command parameters; no document/track UUID guard is visible there.
The surrounding call chain is not proved to supply one.

`ArrayReadoutVisualizationData::updateFromSharedMemory` at `0x533dd4` compares
one read word with the stored word at object offset `0x24`. On a difference,
it copies the configured float count and stores the word. No second word check
or packet-age check is visible in this function. Its producer and the virtual
stream readers remain outside the trace. Do not classify that word as a packet
counter from this code alone.

`LightweightOscilloscopeVisualizationData::updateFromSharedMemory` at
`0x534adc` reads the pointer at object offset `0x10`. It requires byte 0 to be
2, writes 3, reads dimensions at payload offsets 8 and 12, resizes a vector,
copies `8 × dimensionA × dimensionB` bytes from payload offset 20, and writes
0 to byte 0. These are observed instructions, not assigned flag meanings.
It also copies byte 1 and the word at offset 16. Neither is a proved validity
or age field. The reader changes the publication state and can allocate.
Even a proved writer for this protocol would not establish passive probe access.

## Negative cases and refusal

The [offline check](../../evidence/data/phase9a-observable-design/check_design.py)
checks source pins, selected instruction facts, cost arithmetic, and scalar
counterexamples. It does not execute host code or emulate the native engine.

| Case | Required result and reason |
|---|---|
| Valid all-zero packet and invalid decay from zero leave equal cache values/time | Reject the cache as a validity witness; E294 supplies this ambiguity. |
| A fresh callback is sent when an old zero is bound | Reject callback receipt time as packet age. |
| Valid bit remains set on an old zero while another target advances the document token | Reject global progress as per-target freshness. |
| A reader combines zero from one update with validity from another | Reject unless a proved publication protocol excludes this interleaving. Equal repeated reads alone do not prove it. |
| A sample is fresh but older than 250 ms, or not after window start | Mark measurement unavailable, including zero. |
| An array word or scope flag changes without a proved time mapping | Reject age; do not infer a clock from a changed integer. |
| Scope data require a shared-state write or an unbounded allocation | Refuse this accessor before entry. |
| Target, connection, mapping generation, or ownership changes | Lock the session; no retry, replacement binding, or reset inside a window. |

An eventual accessor must supply the target and connection generation, packet
validity, per-target update identity, packet time with a proved clock mapping,
and value from the same update. Packet time must be after t0 and at most
250 ms old. Each plateau witness must be newer than the previous checkpoint.
Any before/after consistency mismatch fails without a retry. The native writer
trace must justify these fields; the acceptance model does not create them.

## Cost disposition

There is no selected runtime mechanism. No finite execution budget is approved
for the rejected candidates. This session and the next offline session have
zero live wire calls, host tasks, cold live reads, write stages, subscriptions,
and probe heap allocation in both typical and maximum cases. E295's retained
reproduction uses eight bytecode inspections, nine native metadata commands,
one thin-slice extraction, five bounded disassembly ranges, and one jar name
scan. Raw vendor outputs stay under `/tmp`; only hashes and findings enter Git.

The following recalculation preserves E293's conditional baseline. It must not
be reported as an implemented or measured runner:

| Component | Typical | Largest admitted case |
|---|---:|---:|
| Prepare / run / exact restoration wire calls | 16 / 216 / 16 | Same |
| Fixture / detached captures | 59 / 2 | Same |
| Window document tasks: boundaries + checkpoints | 16 + 64 = 80 | Same |
| Scheduled launches/expiry + completion deliveries | 72 + at most 64 | Same |
| Graph edits / factory / note writes | 11 / 1 / 0 | Same |
| Graph scope | Five modules, three cables | Same |
| Warm requests + cursor settlement + dwell | 9.882 + 1.95 + 18 s | 9.882 + 1.95 + 20 s |
| Temporary graph heap / sample storage / signal response | 16 MiB / 64 KiB / 128 KiB | Same |
| Graph response / first-failure extra calls | 1 MiB / at most 6 | Same |

There are 248 wire turns, about 5,952 ms at 24 ms per turn. Counting the 136
scheduled entries separately gives 384 units, about 9,216 ms. These are not
proved distinct host turns. Timers overlap dwell. Total planned elapsed time
is 29.832–31.832 seconds plus operator work, with the 60-second cooperative
limit. A blocked native task still has no finite completion bound.

For a future passive meter accessor, the 248-call model remains possible only
if both coherent snapshots fit each existing fixed document task, with no
extra registration or subscription. If each of the 64 checkpoints needs k
extra wire calls and d extra tasks, budget `248 + 64k` calls and
`80 + 64d` window tasks, plus any extra boundary/setup work. The corresponding
wire floor is `5,952 + 1,536k` ms. These formulas do not admit such a path.
Recalculate timing, frozen-report storage, and worst-case encoding from the
actual witness fields before implementation.

The scope reader needs at least `8 × dimensionA × dimensionB` data bytes per
resource before vector capacity and copy overhead. Neither dimension is capped
by this design, and two correctly bound resources are not proved. Therefore
no maximum heap, task, or wire budget can be assigned to that candidate. A new
bridge, observer, analyzer, or audio route requires a separate explicit design;
it cannot inherit E293's cost or fixture admission.

Preserve E293's cold-work list: symbol resolution, initial paired reads, meter
binding, activation, factory lookup/file parsing, and reacquisition after reopen.
The native/retained heap and callback costs remain unmeasured. E292's 43.544 ms
read maximum remains unexplained. Add component timings inside existing calls
only when implementation is admitted. Keep the final 16-call restoration, one
paired read, and no timing retry. Product budgets and descriptions v52 do not
change. No new live-path regression can be measured in this offline session.

## Next session — native meter producer reconstruction

Sources: E295's pinned engine, seven type-name offsets, native load commands,
and JNI boundaries; E294's 22-byte decoder and eight-byte allocation prefix.
This is a specific offline research session before observable admission.

1. Recheck the source hashes. Use the ARM64 file only. Resolve the recorded
   meter/helper/manager type-name references through Mach-O relocations or
   chained fixups to type information and vtables. Verify each pointer format;
   do not treat an encoded on-disk pointer as a runtime address.
2. Map relevant vtable entries and direct callers to function boundaries from
   the binary. Trace the meter producer's write of the five floats and two
   bytes. Trace registration, reset, invalid/suspended output, reuse, and
   destruction, including the eight-byte prefix and document token writers.
3. Prove or reject publication ordering for that exact record. Locate any
   per-target sequence/time and its clock; classify all writers and reader
   ordering. Show how fresh zero differs from an old valid zero and invalid
   decay. Test torn-read and reuse counterexamples against the recovered rules.
4. Stop after the three source groups (meter, helper, manager), at most 24
   recovered functions or two hours of trace work. Record the last proved
   edge and unresolved indirect calls. No process attachment, live-memory
   read, instrumentation hook, decoder call, library load into Bitwig, new
   observer, deployment, or fixture change is allowed.
5. If a passive coherent accessor is proved, specify its exact document-thread
   binding, native lifetime guard, age mapping, failure behavior, and revised
   calls/tasks/heap/caps. Run offline negative cases before implementation.
   Otherwise record a bounded negative result. Any next research route must
   name new source evidence and a distinct unresolved edge; do not repeat a
   generic observable survey or implement a weaker runner.

Acceptance is a reproducible producer/writer/publication map with a justified
accessor and costs, or a precise negative result at that boundary. Keep 9a
active and DSP adoption unproved until the separate live acceptance passes.
The later [implementation and live gates](9a-continuous-signal-design.md#then--replacement-probe-implementation-and-offline-checks)
remain conditional. This plan authorizes no new live run.

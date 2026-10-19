---
title: E295 — Grid signal observable design
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E295 — Grid signal observable design

## Result

The [observable design](../../plan/phase-9/9a-observable-design.md) admits no
candidate after the bounded offline comparison. The result remains
`fresh-meter-evidence-unavailable`. This satisfies the negative-result branch
of the [session acceptance](../../plan/phase-9/9a-continuous-signal-design.md#next-session--observable-design-after-the-packet-trace).
Keep 9a active. DSP adoption remains unproved. Do not implement the signal
runner or weaken the fresh-zero requirement.

The comparison covers the existing Java/public meter, its native shared-memory
record, and separate native array/scope visualization readers. It also excludes
graph completion and a new render/recording route as substitutes for this
unchanged-fixture signal test. No examined path proves both fixture and master
target binding, valid zero, per-target freshness and age, coherent value,
safe lifetime, and bounded access.

This is a bounded negative result. The native meter producer was not recovered.
The trace identifies exact native type-name leads and a separate visualization
protocol; it does not prove that every host observable fails. The next session
is [native meter producer reconstruction](../../plan/phase-9/9a-observable-design.md#next-session--native-meter-producer-reconstruction),
with named source groups, source offsets, a function/time limit, and explicit
acceptance. This replaces another generic observable survey.

## Source evidence

The [manifest](../data/phase9a-observable-design/source-inspection.json) pins
the installed jar, ARM64 audio engine, JNI library, and launcher. The jar still
matches E294. Native hashes are:

| File | SHA-256 |
|---|---|
| ARM64 audio engine | `c83b0615dbe914ac04e5b4f9de4ff91b1cc6db2720297a4954377f9ef83ea616` |
| JNI library, universal file | `ece77643d8cc95a4915231a26b0305a3f964e7a156776996a794dbcde9d354ea` |
| Launcher, universal file | `ae5044db7786cd29cad544410b7eec5b2a08659be9c341d5f040cfaeb15c36c1` |

[inspect_sources.py](../data/phase9a-observable-design/inspect_sources.py)
reproduces eight `javap` outputs, nine native metadata outputs, five bounded
ARM64 disassembly ranges, and two tool-version outputs. It also extracts the
JNI ARM64 slice and scans 30,940 jar class files for five exact native names.
That name scan has no matches; obfuscated classes remain possible. No reference
clone or web source was used. Vendor bytes and full output stay outside Git
in `/tmp/gn9a-observable-design`. The repository stores hashes, commands,
selected names/offsets, and findings only.

The engine has exact strings for `VuMeterAtom`, `VuMeterAtomNode`, the
shared-memory manager/helper, and related analysis types. For example, the
meter and meter-node strings start at file offsets `0x2bf37d8` and `0x2bf37f1`.
The selected `nm` predicates find no corresponding function symbols. A string
is a lead, not a recovered producer, registration binding, or writer audit.
The next session must resolve its references and classify the functions.

The JNI trace adds these concrete boundaries. Addresses are in the offline
ARM64 slice; they are not live addresses or callable probe entry points.

| Function | Observation | Consequence |
|---|---|---|
| `SharedMemory_getSharedMemoryAddress`, `0x500350` | Loads a pointer from wrapper offset `0x20` and returns. | Supplies an address, not a sequence, clock, or coherent packet. |
| `EngineSharedMemory::beginFrame`, `0x533ff4` | Forms an input stream from stored fields, then invokes a virtual reader. Its `ldadd` targets a stack field. | Frame activity and an atomic instruction do not prove engine publication. |
| `ArrayReadoutVisualizationData::updateFromSharedMemory`, `0x533dd4` | Compares a read word with object offset `0x24`; on change, copies floats and stores the word. | The word's writer, semantics, age, and coherent publication remain unproved. |
| `LightweightOscilloscopeVisualizationData::updateFromSharedMemory`, `0x534adc` | Requires shared byte 0 equal to 2, writes 3, copies dimension-dependent data, then writes 0. | A consuming reader, not a passive getter. It can allocate; no admitted fixture/master binding or age source exists. |
| `EngineSharedMemory::init`, `0x534cbc` | Reads pointer/length data from graphics command parameters. | Does not establish the probe's document, target, thread, or mapping-lifetime guards. |

The scope's other byte/word fields and the array's changed word are deliberately
unclassified. The producer, synchronization, resource lifecycle, and upstream
graphics binding were not traced. No memory-order guarantee follows from the
reader alone. Its 2→3→0 protocol must not be assigned to the separate DxI
22-byte record.

The public proxy trace confirms that binding sends an existing peak/RMS value
before registering its change callback. `VuMeterObserver.sendValue(double)`
queues the value and converts it to an integer; it supplies no packet validity
or capture time. E294's decoder/reset/decay ambiguity still applies. A fresh
callback receipt can therefore contain an old zero. A separate display or a
later screenshot adds no missing packet provenance.

## Design, costs, and limits

The design records each candidate's binding, validity, freshness/age,
synchronization, thread, lifetime, bounds, and refusal. Unknown requirements
fail admission. The fixture, mute, stopped transport, no-note rule, eight
windows, one-session limit, first-failure freeze, and exact restoration stay
unchanged. No new observer mechanism is selected.

Typical and maximum live cost for E295 are both zero: no wire call, host task,
cold live read, write stage, subscription, or probe heap allocation. Offline
inspection costs are listed above. The conditional runner still has 248 calls
(16/216/16), 59 fixture and two detached captures, 80 window document tasks,
136 scheduled entries/deliveries, 11 graph edits, one factory, and zero notes.
The recalculated planned elapsed time is 29.832–31.832 seconds plus operator
work. The 24 ms unit gives a 5,952 ms wire floor or 9,216 ms with scheduled
units counted separately; dwell overlaps that work.

The 16 MiB graph heap, 64 KiB sample buffer, 128 KiB signal/failure response,
and 1 MiB graph response remain conditional caps. No candidate is asserted to
fit them. The scope's dimensions have no admitted cap; copying its data would
cost at least `8 × dimensionA × dimensionB` bytes before capacity overhead.
It cannot inherit a finite heap allowance. The design provides cost formulas
for extra checkpoint calls/tasks and requires a new complete budget if the
mechanism changes. There is no measured speedup or regression.

Retain E292's unexplained 43.544 ms read maximum and the planned component
timings inside existing calls. Do not add a timing read or repeat restoration.
The final exact-restoration workflow stays 16 calls. Product call budgets,
runtime code, and public tool descriptions do not change; descriptions remain
v52 with 44 tools. No build or live measurement is applicable to this session.

## Verification and handoff

[check_design.py](../data/phase9a-observable-design/check_design.py) passes:
four source pins, 24 output hashes, the thin-slice hash, seven type-name
offsets, selected instruction facts, four ambiguity models, eleven negative
requirement cases, and the conditional cost arithmetic. The
[verification record](../data/phase9a-observable-design/verification.json)
states the limits. These checks do not execute the engine, prove native
ordering, audit all writers, or validate an accessor. E294's existing source
and ambiguity check also passes. Context and staged whitespace checks pass.

No live request, native-memory read, hook, decoder call, note, graph edit,
factory, fixture operation, build, deployment, or controller replacement ran.
V12 remains loaded, used, and locked. Current engine activity is unverified;
E292's exact restoration is historical evidence. Do not rerun V12 prepare,
run, or its final restoration read. The existing project and preset were not
touched. The index was empty at entry; no earlier staged changes needed to be
merged. Session changes are staged without a commit.

Retrospective: extract a thin Mach-O slice before bounded disassembly, then
assert every output address is inside the requested range. The initial
universal-file command ignored the range; the retained script prevents that
error. Keep candidate findings at the last proved source edge and distinguish
consumer writes from passive access. No repository-wide instruction change
is needed.

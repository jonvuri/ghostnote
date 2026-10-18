---
title: E294 — Grid valid-packet witness trace
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E294 — Grid valid-packet witness trace

## Result

The offline trace returns `fresh-meter-evidence-unavailable` for the inspected
Java meter and receive path. It finds no existing witness that proves all four
[E293 requirements](../../plan/phase-9/9a-continuous-signal-design.md#freshness-prerequisite-before-implementation):
validity, per-target freshness, packet age, and a coherent value from that
update. The replacement signal runner must not be implemented or deployed
under this witness. Keep 9a active and DSP adoption unproved.

This is a bounded negative result. It does not prove that every host observable
is unsuitable. The trace reaches native shared memory, but it does not inspect
the native producer or establish its publication protocol. The next planned
session is [observable design after the packet trace](../../plan/phase-9/9a-continuous-signal-design.md#next-session--observable-design-after-the-packet-trace).
It must select and justify a complete observable before runner implementation.

No live request, native-memory read, note, graph write, factory, build,
deployment, controller replacement, or fixture operation ran. V12 remains
loaded with its session used and locked. Do not rerun its prepare, run, or
final restoration read. E292's exact baseline restoration remains historical
evidence. The operator later briefly activated the engine; verify current
state before future live work. Public descriptions remain v52, 44 tools;
no description changed. The prior E293 files remain staged.

## Sources and scope

The [manifest](../data/phase9a-valid-packet-trace/source-inspection.json) records
34 exact `javap -p -c` outputs and the unchanged Bitwig jar hash
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.
Vendor output stays in `/tmp/gn9a-valid-packet-trace`, outside Git. No reference
clone or web source was used. Class names below are exact; package prefixes
matter because obfuscated short names repeat.

The offline [reference scan](../data/phase9a-valid-packet-trace/scan_refs.py)
reads constant-pool metadata from the jar's 30,940 class files. Its predicates
select only the meter timestamp, decoder dispatch, polling fields, and manager
calls. The [result](../data/phase9a-valid-packet-trace/member-references.json)
is a set of member references, not proof that each call runs. Bytecode checks
confirm the relevant use sites. This scan does not cover native or reflective
writes. It loads no vendor class into Bitwig.

## Receive path and exact boundaries

In this table, `platform` means `com.bitwig.base.platform`; `master` means
`com.bitwig.flt.document.core.master`. Other short names are root-package
classes. The manifest gives complete class names for reproduction.

| Path or signature | Observed behavior | Evidence limit |
|---|---|---|
| `com.bitwig.flt.app.KGh.iwz(): void` | Requires the event-dispatch thread and calls `master.Svr.cnN()` for each open document. | An application refresh is not a per-meter packet. |
| `master.Svr.cnN(): void` | Reads a long from its `zTs` shared-memory channel. When it differs from `jCQ`, stores it and calls `gJd.wi2()`. | Document-wide update token; no per-target validity or age. The method tests inequality, not monotonic increase. |
| `master.gJd.wi2(): void` → `platform.FZ1.kyi(): void` | Runs each `platform.iIS` polling group if its manager exists. | Manager existence and refresh do not prove engine rendering. |
| `platform.iIS.ffA(): void` / private `eOi(): void` | Uses wall-clock scheduling. Each admitted entry calls `uqc.Uhv()` and then `uqc.ffA(hwy)`. It does not store a per-target successful-decode sequence. | Poll times are shared by a group and precede decoding. |
| `Yuj.ffA(platform.hwy): void` | Calls the bound `Lck.ffA(hwy)` synchronously. For this target, Lck is the existing DxI. | No validity receipt is returned or cached by Yuj. |
| `DxI.ffA(platform.hwy): void` | Reads five floats and two bytes. The last byte selects valid update versus `mIz()` decay. The valid branch stores `EbT`, peak/RMS values, the first byte, and an extra scalar. | The last byte stays in a local variable; the cached meter loses validity. |
| `DxI.mIz(): void` | Decays peak/RMS and writes current time to `EbT`. | An invalid update can advance `EbT` with a zero value. |
| `DxI.aD_(): void` | Sets peak/RMS and other meter values to zero without writing `EbT`. Inactive routing can reach it before packet parsing. | Zero can also be a reset. |
| `DxI` → inherited `AcO.RR(): KzN` → `KzN.eWy(): platform.uqc` | Reaches the current shared-memory registration. `Yuj.kG` binds its Lck target. | Identity is available in this path, but freshness is not. |
| `KzN.kyi(): platform.hwy` → `uqc.Uhv(): platform.hwy` | Returns a shared reader and changes its span/cursors to record offset + 8, length 22. | This is not a pure snapshot getter; do not call it from the probe. |
| `uqc.NaF(): long` | Returns payload address: shared base + record offset + 8. | Address, not timestamp or sequence. No live address was read. |
| `platform.GCp.kG(): float` / `cG3(): byte` | Advance the reader cursor and use plain `Unsafe.getFloat/getByte` on native memory. | No multi-field snapshot, producer fence, retry, or version check is established here. |

The payload is 22 bytes: five floats at offsets 0, 4, 8, 12, and 16;
then bytes at offsets 20 and 21. Byte 21 is the valid/invalid branch input.
The combined peak is derived from the first two floats. There is no sequence
or timestamp in the payload consumed by this decoder. This says nothing about
an untraced native-side record format outside those bytes.

The eight-byte record prefix is not a proved packet sequence. In
`platform.NHx.ffA(uqc,int)`, allocation writes a flag/size word and then zero
to the second word. `platform.FZ1.ffA(boolean,int)` encodes a high-byte flag
and 24-bit payload length. The allocation and reuse path reads that flag.
The trace does not establish native writers, a packet meaning, or publication
ordering for the second word. Do not infer a sequence or lock from its position.

## Writer and candidate audit

| Candidate | Java writers or update sites inspected | Verdict |
|---|---|---|
| `DxI.EbT: Instant` | Constructor; valid decoder branch at bytecode offset 142; invalid decay at offset 84. Constant-pool scan finds direct references only in DxI. | Reject: valid and invalid updates share the field. |
| `DxI` combined peak via `Cic.Uhv()[2]` and `Bsp.NaF(): double` | Valid decode, invalid decay, reset; `UoA.wi2(double)` suppresses a repeated equal value. | Reject as freshness: zero and constant values can lack callbacks. |
| Local validity byte in `DxI.ffA(hwy)` | Read from payload byte 21; used by the branch and not retained. | Validity exists at decode time, but no existing Java cache records it with a time/sequence. |
| `LbJ.MkF: boolean` / `GBx(): boolean` | Valid branch writes the first byte through `pvN(boolean)`; reset clears it. Invalid decay retains it. | Not the last-byte validity flag. It cannot establish a valid zero update. |
| `master.Svr.jCQ: long` | Constructor sets -1; `aD_()` sets 0; `cnN()` copies the document-wide shared long. | Reject: a changed document token still dispatches invalid meter records. |
| `platform.iIS.cG3/Uhv: long` | `ffA()` initializes the wall-clock base and updates the polling bucket before dispatch. Period-zero groups dispatch directly after initialization. | Reject: scheduling state, not an engine packet receipt. |
| `uqc.wi2/pvN`, `cbl.MkF/SRu` | Lease counts and deferred disposal state in their acquire/release paths. | Reject: lifetime bookkeeping, not update counters. |
| Raw payload validity plus global token | Native producer writes are outside the inspected jar path. The reader has no proved before/after publication check. | Unproved: per-target age and coherent publication remain missing. |

A concrete ambiguity remains even with correct identities and a connected
engine. Begin with zero peak/RMS, false first-byte state, and zero extra scalar.
A valid all-zero payload at time t and an invalid update at time t produce
the same retained Java values and `EbT = t`. Neither produces a changed-value
callback. Both can occur during a refresh after the document token changes.
Thus those cached observations cannot classify valid zero. The
[offline check](../data/phase9a-valid-packet-trace/check_trace.py) records this
scalar counterexample; it is not a live or native execution test.

## Thread and synchronization result

`ControlSurfaceObject.exec(Runnable)` posts an event that runs the task.
`isDocumentThread()` delegates to `KKl.hhJ()`, which checks the application's
event-dispatch thread. `KGh.iwz()` and `Svr.cnN()` assert that same host-side
access boundary. A task on that thread can avoid interleaving with another
Java event in the traced path. This does not exclude the native engine writer.

`Yuj` brackets decode with `cZl.nQn/oNk`, which conditionally invoke thread-local
helpers. They do not establish a native publication fence. `wkF.cG3/Uhv`
measure elapsed work; their names are not evidence of a lock. The manager's
monitor in activation protects its Java list. It is not a lock taken around
the meter payload reads. No synchronization with the native producer was
proved. The raw reader mutates shared cursor state and uses plain native loads.
Reading it twice would neither establish age nor prove that both reads belong
to one update. Do not invoke a decoder, refresh, resubscription, or reset to
turn this negative trace into a live experiment.

## Cost, verification, and handoff

This session uses zero host turns, zero cold live reads, zero write stages,
and zero live heap allocation by the probe. Typical and maximum live cost are
both zero. Offline cost is 34 bytecode inspections plus one jar metadata scan.
No product call budget, observer, or public description changed.

E293's 248-call, 64-checkpoint, 64 KiB sample-storage model remains a conditional
plan, not an implementable or measured path. The required accessor was not
proved within its one-task snapshot assumption. No lower call or memory cost
can be claimed from this result. E292's 43.544 ms read maximum remains unchanged
and unexplained. The eventual implementation must retain component timings
inside existing calls and the 16-call exact-restoration workflow.

[Verification](../data/phase9a-valid-packet-trace/verification.json) records
`python3 context/evidence/data/phase9a-valid-packet-trace/check_trace.py`. It passes:
pinned jar, all 34 source hashes, selected dispatch/writer checks, payload size,
and the zero-state ambiguity model. Context validation and staged diff checks
pass. No runtime test is applicable because runtime code did not change.
Session changes are staged, not committed.

Next, design a complete observable after this bounded negative result. Compare
the cost and proof burden of tracing native shared-memory publication with
other existing host signal evidence. Require a target, valid zero, freshness,
age, coherent value, and a bounded read. Keep the fixture, mute, transport,
no-note rule, frozen failures, and exact restoration requirements. Any changed
constraint or observer mechanism needs an explicit revised design and cost
model before implementation. Do not treat a raw address or a global counter
as a completed solution. No new live run is authorized by this trace result.

Retrospective: distinguish field names, scheduler counters, reader cursors,
and lifetime counters from signal evidence. Document the point where validity
is discarded and the native producer boundary. The revised plan includes both;
no repository-wide instruction change is needed.

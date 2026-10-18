---
title: E283 — Detached Grid factory lifecycle
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E283 — Detached Grid factory lifecycle

## Result

The detached Amplify factory gate passes on V8. Two independent calls return
new module UUIDs with equal projected native defaults. Each result has a null
direct owner and Grid parent. Its contents and all 77 native owned objects
pass ownership checks. Both initialization helpers are present. Each call
captures the detached module twice, disposes it through the native lifecycle,
and verifies disposal on all 77 objects. No detached handle enters the epoch.

All five live-fixture captures in each workflow are exactly equal. They match
the saved preset. Selection and saved project/preset hashes remain equal.
The UI remains at the four-module baseline. This proves the bounded factory
lifecycle, not live attachment or DSP adoption. Keep
[9a](../../plan/phase-9/9a-live-grid-editing-spike.md) active. Its next selected
stage is native collection attachment, with the trace and design requirements
below. No attachment call or V9 build ran. V8 remains loaded.

## Entry and preservation

The operator confirmed controller replacement. The
[hello summary](../data/phase9a-grid-factory/hello-v8-summary.json) proves
`phase-8-probe-v1`, 116 methods, hash `14aacf5657eac6c2`, and marker
`9a-grid-factory-v8`. Initialization at `2026-10-18T16:36:48.534Z` follows the
[E282 deployment](../data/phase9a-grid-factory/deployment-v8.json).

The first `npm run probe:hello` failed only because its client marker still
expected V7. The controller reported the correct V8 marker. The client check
is corrected, and the second hello passes. A new offline check compares the
Java marker with both hello and the live driver. No factory call preceded the
passing hello. An entry request for `transport.status` was refused because
that method is absent from the active probe profile. The UI supplies the
transport and inactive-engine witness. No unsupported write was requested.

No competing phase8 or phase9 driver was found. Drivers ran sequentially.
The [entry record](../data/phase9a-grid-factory/entry-v8-live.json) checks the
project, selection, mixer, and files. Track `grid-probe` is muted at -10 dB.
The [UI witness](../data/phase9a-grid-factory/ui-witness-v8.json) shows the
inactive engine, position 1.1.1.00, and unchanged patch before and after both
calls. The fixture already had an unsaved marker at entry. The other open
`gn-scale-test` tab also retained its prior unsaved marker. No UI action,
project save, reload, or baseline-file replacement was needed.

Project and backup SHA-256 remain
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
Preset SHA-256 remains
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
Both epochs were released. The two-attempt V8 allowance is now used.

## Live evidence

Data: [phase9a-grid-factory](../data/phase9a-grid-factory/).
`live-87-factory-first` and `live-88-factory-repeat` each contain two before
reads, the fresh command guard, two detached captures, two after reads,
selection, file fingerprints, and call timings. The
[verifier](../../../tools/grid-spike/verify_factory_evidence.py) reproduces
[v8-measurements.json](../data/phase9a-grid-factory/v8-measurements.json):

```sh
python3 -B tools/grid-spike/verify_factory_evidence.py \
  context/evidence/data/phase9a-grid-factory/live-87-factory-first \
  context/evidence/data/phase9a-grid-factory/live-88-factory-repeat
```

The first UUID is `a4b6de5d-e880-4e79-b564-3640057dfbb6`; the repeat UUID is
`d01db07f-9e43-479d-b423-70f07ce57335`. Both differ from all live module UUIDs.
The type is Amplify, `a6cd650b-c4de-46c6-8741-c07a0a9bfec2`.

Each detached projection has eight nodes and six atoms. Native `VALUE` and
its stored default are both 1. `BIPOLAR` and `STEREOIZE` are false. The
module is active at (0, 0), with one OUT and one disconnected IN. The input
scalar is 0. Every projected field agrees across both captures and both
calls, except the new instance UUID. The 77-object disposal check also covers
owned objects outside this eight-node projection. It does not make that
projection a complete serialization.

## Cost

| Measurement | First | Repeat |
|---|---:|---:|
| Factory request, wire | 65.623 ms | 45.402 ms |
| Whole document task | 25.595 ms | 12.924 ms |
| Native factory | 4.381 ms | 0.863 ms |
| Native disposal | 0.818 ms | 0.073 ms |
| Queue wait | 0.117 ms | 0.147 ms |
| Completion from request queue | 39.034 ms | 22.853 ms |
| Summed workflow wire time | 590.554 ms | 508.250 ms |
| Heap sample increase | 4 MiB | 2 MiB |

Each workflow uses the planned 18 wire calls, plus 150 ms cursor settlement.
Both fit the 600 ms summed-wire and 16 MiB temporary-heap planning figures.
Heap samples are not peak or retained-heap measurements. Each detached
capture encodes 5,826 bytes. Both native owned trees have 77 objects, below
the 256-object cap.

The first factory request is 45% slower than its repeat. Construction and
disposal account for measured differences, and the first use of the new
lifecycle code can include class/JVM work. Its share is not isolated. The
first request is below V7's first-delete maxima of 70.793 ms wire and
28.300 ms document. The repeat is below V7's repeated isolated-delete costs
of 48.489/14.844 ms. Do not call the first factory cold: no cache was reset
or inspected. Repeated defaults after disposal provide the bounded cache
integrity witness.

The eight independent fixture reads take 44.271–48.277 ms wire and
2.789–12.922 ms document time. The first document read exceeds V7's 6.109 ms
maximum by 112%; the immediate repeat is 6.872 ms, and all later reads are
below 6.109 ms. The read code and graph scope are unchanged. This first-use
cost is not reproduced; class warm-up is plausible but unprofiled. Retain it
as a limit. All fixture graphs have 53 nodes and 35,828 encoded bytes. The
[read measurements](../data/phase9a-grid-factory/v8-read-measurements.json)
retain graph/query work and all queue, completion, and heap samples. Product
call budgets do not change.

## Native attachment trace and next gate

The [extended host inspection](../data/phase9a-grid-factory/environment-attachment-trace.json)
adds `llL`, `oaA`, and `AsyncUtilities` to the fixed inspection set. Vendor
bytecode stays in temporary files. The jar and clone pins are unchanged.

- `gOr.ffA(Collection,int,int,boolean,ITE)` adds an `oaA` callback, then calls
  `eOi` with the same arguments. The callback calls `Gn.ffA(Collection)` and `Gn.nrP(HEV)`. These appear
  to change module selection/focus; this needs a complete trace before use.
- `gOr.eOi(Collection,int,int,boolean,ITE)` requires detached modules, starts
  a named insert edit, inserts each module, invokes the optional callback,
  and ends the edit. The inspected wrapper has no exception handler that
  guarantees the end step. Its start helper discards a boolean result.
- With the boolean false, the inner path uses the supplied module directly.
  True copies it again. It sets x/y, then appends through `NHx.Uhv(had)` and
  the native membership/ownership hooks. The Grid override also updates its
  `UZp` helper and notifications.
- After insertion, `llL.ffA(List,Collection)` sorts a copy of the complete
  module list and can move modules horizontally to remove overlap. It
  allocates an array from the vertical span. This can affect existing modules
  even though only one new module was requested. It is a layout pass, not a
  cable operation.

The plan now has an explicit attachment stage. Before implementation, finish
the transaction admission, refusal, and exception-recovery design. Bound the
full layout rectangle and predict the layout pass on the fixed fixture.
Use the native path that preserves selection, with its callback behavior
stated. A returned or thrown insertion must not trigger detached disposal
without fresh proof that no document or undo state owns the object. The
factory's `finally` cleanup cannot be reused unchanged after attachment.
No attachment method has been invoked or exposed by V8.

## Verification and retrospective

The [verification record](../data/phase9a-grid-factory/verification-v8-live.json)
records the live gate, corrected hello, focused marker/inventory tests,
TypeScript check, Python tests, and context/diff checks. E282 retains the
extension and product call-budget checks. No extension code changed during
this live continuation. No public description changed: v52, 44 tools.

Retrospective: the first hello exposed a missed marker consumer. The new
cross-file check prevents that mismatch before deployment. Use the active
wire inventory before an ad hoc read; source registration alone does not mean
that a method is exposed in the loaded profile.

---
title: E305 — Grid write command preparation
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E305 — Grid write command preparation

## Result

9b.3 has started. Command tracing and offline metadata checks are complete.
The bounded writer, driver, deployment, and live acceptance are not complete.
No native Grid command or scratch fixture write ran. Do not treat this record
as a passed write probe.

The [command trace](../data/phase9b-writes/command-trace.md) and
[manifest](../data/phase9b-writes/trace-manifest.json) cover 13 class
inspections on the pinned Bitwig 6.0.6 jar.

| Case | Preparation result | Live verdict |
|---|---|---|
| Gates boolean | `Xuo.eOi(boolean)` dispatches to the edit wrapper in `QY.NaF(boolean)`. The argument is a boolean. Field 210 remains the independent stored-value read. | Unknown. No command ran. |
| Grid mapping | Removal is `Net.cG3(Hjt)`. Restoration is `Net.eOi(Hjt,double,boolean,jas,NDn)`. Its edit callback runs inline. The amount is clamped to the target domain. Creation gives a new mapping and destination reference and appends the mapping. | Unknown. Exact restoration and unrelated-state checks are not implemented. |
| Gates factory | The existing static UUID factory resolves. Existing attachment checks require a four-module fixture, a 77-object Amplify tree, an eight-node capture, and fixed placement. Those checks do not admit this Gates case. | Unknown for detached defaults. Attachment is not admitted by the existing guard. No factory ran. |

[GridBreadthCommands](../../../extension/src/main/java/com/ghostnote/extension/GridBreadthCommands.java)
resolves the command metadata without invoking it. It has no handler or
driver consumer. Existing write routes and admission rules are unchanged.
The metadata test loads classes without initialization and includes the
bundled `libs.jar` for signature dependencies.

## Entry and preservation

`npm run probe:hello` passed. The running extension is V15:
`phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`,
marker `9b-grid-focused-v15`, initialization `2026-10-20T17:03:31.091Z`.
The process check found no competing Ghostnote client or phase-9 driver.

The eight-call [entry record](../data/phase9b-writes/entry.json) confirms
`gn-grid-spike`, tracks `grid-probe`, `FX 1`, and `Master`, and an unbound,
unlocked reader with no unfinished task or foreign owner. `grid-probe` is
muted at -10 dB. It remains the mixer selection; clip selection is absent.
All mixer identities match.

No cursor point, project edit, transport command, engine command, or save
command ran. No fixture was created. Device banks and the normalized Grid
baseline were not recaptured; E304 remains their last full check. Engine
activity, saved-file identity, and the UI save marker were not checked.
The running Audio Engine process does not prove project engine activity.

## Verification and cost

- `./gradlew gridBreadthCommandsTest gridReadTest` passes. The
  [output](../data/phase9b-writes/offline-checks.txt) records the resolved
  declarations and existing Grid safety harness results.
- The [trace checker](../../../brain/src/probes/phase9b-grid-write-trace.py)
  reproduces all 13 bytecode hashes: 2,410.311 ms in the recorded run.
- Context link and diff checks pass.

The entry record has eight read calls and 188.527 ms of summed wire time.
This excludes the earlier hello checks. The new metadata resolver runs only
in the offline test. It adds zero live calls, document tasks, subscriptions,
write stages, or live heap allocation. There is no changed live path to
remeasure. Product call budgets and public descriptions remain v52.

The trace has a provisional six-command, 18-read minimum for boolean,
mapping, and detached factory/disposal. This is not the full workflow
budget. The implementation must count partitions, fixture operations,
ownership checks, and failure inspection before deployment.

Two offline checks exposed test assumptions: signature resolution needs
`libs.jar`, and a method found through `MTu` can have an inherited declaring
type. Both are corrected. No host class was initialized or command invoked
by these checks.

## Next

Continue the explicit
[9b.3 writer implementation](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#writer-implementation-after-e305).
Implement all admitted commands and their independent readback in one
extension build. Keep attachment conditional; do not weaken the fixed 9a
guards. Deploy only after the protocol and driver tests pass, then request
operator controller replacement.

Lesson: trace the callback wrapper before classifying a command as deferred.
For restoration, check identity and list-position effects as well as values.

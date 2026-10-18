---
title: E282 — Detached Grid factory probe preparation
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E282 — Detached Grid factory probe preparation

## Result

Continuation: [E283](e283-detached-grid-factory-lifecycle.md) passes the live
factory gate. The preparation state below records the prior deployment handoff.

V8 implements the bounded detached Amplify factory probe. Offline checks pass.
The live gate is pending operator replacement and the first two factory calls.
No factory or attachment call has run in this continuation. Keep
[9a](../../plan/phase-9/9a-live-grid-editing-spike.md) active. Native collection
attachment follows only after the detached factory gate passes.

The probe marker is `9a-grid-factory-v8`, with `phase-8-probe-v1`, 116 methods,
and hash `14aacf5657eac6c2`. The new `probe.gridModuleFactory` method is a
research-only write. Normal remains 92 methods, hash `8be1975eaa99d78f`.
No public tool or description changed: descriptions remain v52, with 44 tools.

`./gradlew copyProbeExtension` deployed the archive. The
[deployment record](../data/phase9a-grid-factory/deployment-v8.json) records
the file hash and time. Replacement is pending. The
[file check](../data/phase9a-grid-factory/preserved-files.json) confirms the
unchanged project, preset, and baseline backup hashes. E281 remains the last
live fixture observation; this preparation made no bridge or UI call.

## Design and implementation

[E281](e281-grid-module-delete-and-persistence.md) supplies the native factory,
copy, initialization, and disposal trace. The
[environment record](../data/phase9a-grid-factory/environment.json) repeats the
host jar check, fixed symbol fingerprints, and clean clone pins. No vendor
bytecode is stored in the repository.

The plan now specifies the failure paths before implementation. The handler
admits only the exact four-module baseline, with two cables and current UUIDs.
It checks the route and deadline after a fresh guard capture. One epoch permits
one factory attempt. One controller initialization permits at most two.
The type UUID is fixed to Amplify. The handler exposes no attachment operation.

`GridFactorySymbols` resolves the exact-build methods before construction.
`GridDetachedFactory` calls the native factory once. It checks exact runtime
type, fresh UUID, null direct owner and Grid parent, and non-disposed state.
It walks the native owned tree with object identity, a 256-object cap, depth
12, and a 1-second check deadline. Every child must name the expected owner.
It checks the two fields assigned by `OEf.ao_()` and the contents owner. These
are initialization witnesses, not proof of DSP adoption.

Two independent projected captures must each have eight nodes and six atoms.
The native defaults are observations; repeated defaults must agree. Once
ownership is proved, a `finally` block rechecks the owned tree, calls native
`dC_()`, and checks `J_()` on every recorded object. Only JSON and UUID strings
leave the task. The epoch does not store a detached host handle.

The driver takes two independent live reads after disposal. Both must exactly
match the before graph. It also checks selection and both saved file hashes.
The offline verifier requires two distinct epochs, operation IDs, and module
UUIDs; equal defaults; all lifecycle witnesses; exact fixture preservation;
fresh deployment; and the exact 18-call sequence. Its tests use synthetic
records in a temporary directory. They do not count as live factory evidence.

## Failure limits

A factory throw before return supplies no cleanup handle. A failed ownership
proof must not trigger disposal. A disposal throw or a partial disposal leaves
an uncertain result. Any failure after an attempt closes the handler until
replacement. Reports contain the attempted/returned state, failed stage,
ownership state, and disposal state. No retry occurs inside the handler.

The 4-second pre-operation deadline prevents a late start. The 5-second
response watchdog cannot cancel native file I/O, monitor waits, or disposal.
After timeout, a late return still attempts guarded cleanup. The timeout
response cannot attest its result. Stop and inspect or restart the host before
a new probe session. Do not infer rollback from unchanged fixture reads.
The native child-list method also creates its list before the caller can check
its size. The fixed type and pinned host limit this experiment; the caps do
not provide a native allocation or wall-time guarantee.

The repeat tests the projected defaults after disposal. It does not inspect
cache internals or prove the absence of all native retained allocations. No
cache is cleared, and the first call must not be called cold without evidence.

## Cost and live continuation

The plan retains 18 sequential wire calls, five live-fixture captures, two
local detached captures, and one construction/disposal stage per workflow.
Typical and maximum admitted scope are the same: one fixed Amplify type.
Allow about 600 ms warm summed wire time, 150 ms cursor settlement, and
16 MiB temporary heap. This exceeds V7's 550 ms / 8 MiB plan because the native
path copies, initializes, and disposes contents. The ownership checks add local
reads only. Native I/O and disposal are not cancellable. No V8 live timing is
claimed. Product call budgets do not change.

After operator replacement, run `npm run probe:hello` from `brain/`. Require
fresh initialization after the deployment time, the method count/hash above,
and the deliberate V8 marker. Check the project, selection, mute, transport,
and inactive engine. Recheck the saved project, preset, and backup hashes.
Run one foreground driver at a time; first check `pgrep -f 'phase8|phase9'`.

From the repository root, the first factory workflow is:

```sh
node --import ./brain/node_modules/tsx/dist/loader.mjs brain/src/probes/phase9a-grid-read.ts factory \
  '/Users/jonvuri/Documents/Bitwig Studio/Projects/gn-grid-spike/gn-grid-spike.bwproject' \
  '/Users/jonvuri/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset' \
  "$PWD/context/evidence/data/phase9a-grid-factory/live-87-factory-first" \
  "$PWD/context/evidence/data/phase9a-grid-read/semantic-query.json"
```

Inspect the first workflow before a repeat. Only after it passes, run the same command
with a new output directory, `live-88-factory-repeat`. Then run:

```sh
python3 -B tools/grid-spike/verify_factory_evidence.py \
  context/evidence/data/phase9a-grid-factory/live-87-factory-first \
  context/evidence/data/phase9a-grid-factory/live-88-factory-repeat
```

Record first and repeat factory/disposal times, document/queue/completion
costs, wire times, payloads, and heap samples. Explain a regression above
20 percent. A live failure stops the factory session. A pass permits the
plan's separate attachment design and cost model. It does not prove live
module creation.

## Verification and retrospective

The [verification record](../data/phase9a-grid-factory/verification-v8.json) lists the extension checks, wire inventory checks,
TypeScript check, adapter and call-budget tests, Python tests, historical
evidence checks, context validation, and diff check. The live measurement is
pending operator replacement. No project or preset file was changed.

Retrospective: the E281 lifecycle trace made the failure design concrete.
Keep cleanup eligibility separate from capture success. Test both a failed
read with safe cleanup and an unproved owner with no disposal.

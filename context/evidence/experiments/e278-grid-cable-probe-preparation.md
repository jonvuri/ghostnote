---
title: E278 — Grid cable probe preparation
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E278 — Grid cable probe preparation

## Result

The operator selected continuation of [9a](../../plan/phase-9/9a-live-grid-editing-spike.md).
The plan and NOW now treat [E277](e277-grid-value-write-readback-and-persistence.md)
as a verified checkpoint. This supersedes its session-close handoff. Its
measurements, captures, and per-operation verdicts remain unchanged.

V5 adds `probe.gridCable`, a research-only writer for one fixed edge: Sine OUT
to the spare Amplify IN. It admits connect and disconnect as separate calls.
Offline checks pass and the archive is deployed. Operator replacement, hello,
and live cable tests have not run. This record makes no cable CRUD, undo,
persistence, engine-adoption, or performance claim.

## Host operation trace

The [environment record](../data/phase9a-grid-cables/environment-v5.json)
pins the installed Bitwig 6.0.6 jar and the reference clones. The jar SHA-256 is
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.
No clone was updated. The record includes bytecode hashes; vendor bytecode
remains outside the repository. The source is the installed host, with the
existing descriptor reader as the object-discovery path. No external
implementation was copied for this cable writer.

The captured destination is `com.bitwig.flt.document.core.master.device.mvZ`.
Its base chain includes `ziZ`, `xts`, and `UL`. The captured source is
`com.bitwig.flt.document.core.master.device.WAr`; its base chain includes
`yWH`, which implements the host interface `a`.

| Step | Observed bytecode behavior |
|---|---|
| `UL.D1G()` | Returns the current source object. Used only to confirm exact source identity before the setter. |
| Public `UL.ffA(a)` | Checks mutable context through the host assertion and dispatches to `eOi(a)`. |
| `xts.eOi(a)` | Builds the host connect/disconnect label, calls the inherited edit-begin path, invokes the lower relationship setter, then calls `hoE()` to end the edit. |
| `UL.eOi(a)` / `UL.eOi(yWH)` | Requires a `yWH` source or null; skips an identical source; enters the instrumented mutation path when enabled. |
| `UL.cG3(yWH)` | Calls `HEV.ffA(cYz, old, new, false)` for the source relationship, stores the new source, calls the source-change hook, and emits a value-change event to registered listeners. |
| `HEV.ffA(...)` | Handles relationship reference bookkeeping by relationship kind, forwards to registered observers, and propagates to the parent. |
| `ikl` edit helpers | Resolve the document's edit manager and delegate begin/end when it is active. |

The preset-application path in `xts.eOi(uNh, MUT)` also calls `ffA(a)` for a
resolved source or null. The probe uses this public destination setter. It
does not call the lower `yWH` setter or write a field directly.

The wrapper has no `finally` around the lower setter and edit-end call. An
exception can leave a partial change or an unfinished edit. A return does not
prove undo behavior or DSP adoption. If any writer starts and then fails, V5
refuses further probe operations until reload. A timeout has the same rule.
Inspect the UI and fixture before recovery; do not retry the write.

The setter does not establish general port compatibility. The admitted source
already feeds the same port on the first Amplify. The spare has the same type
and port, and its output stays disconnected. Feedback, other sources, and
retargeting are not admitted by V5.

## Guards and independent readback

The existing document-thread queue, exact jar pin, project/track/device route,
epoch, object identity, work limits, and write deadline still apply. The new
writer requires four distinct current module UUIDs and the exact complete
53-node before capture. It checks all four names, types, positions, enabled
states, atom counts, and captured parameter values against the saved fixture.
It checks the original two edges, all other destination sources, port names,
and zero destination defaults. Only the spare input can change between no
source and Sine OUT. Duplicate requests, unexpected edges, and a connected
spare output are refused before mutation.

Reflection resolves only the observed destination/source classes and the
inspected setter signature. A direct current-source read must agree by object
identity. The document, track, and device are checked again before invocation.
The reply contains the guard capture and `command-returned; fresh read required`;
it does not claim that this capture is an after read.

`brain/src/probes/phase9a-grid-read.ts` adds `cable` mode with target `sine` or
`none`. It takes two equal before reads, invokes the writer once, and takes two
fresh reads. The expected delta changes only the spare input's source refs and
count. Every other captured node field must match. It also checks saved file
hashes and mixer selection. It never retries a failed or uncertain write.

## Cost and verification

The cost model was added to the plan before implementation and is recorded in
the [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).
The successful workflow keeps the E277 structure: 18 sequential wire calls,
including five core calls and five graph captures. One capture is the guard
inside the mutation request. Expected summed wire time is about 550 ms, plus
150 ms explicit driver settlement. The core estimate is about 240 ms. Local
fixture validation and two bounded atom paths add work without a new wire call.
The fixed four-module writer is also its largest admitted case. The larger
reader bounds do not admit larger writes. Heap planning remains 8 MiB per
capture; peak and retained heap are unmeasured. V5 measurements are pending.

The [verification record](../data/phase9a-grid-cables/verification-v5.json)
records these checks:

- Gradle `gridReadTest` and `check` pass, including archive/profile checks.
- The new cable harness accepts baseline connect and a synthesized connected
  graph for disconnect. It refuses stale/duplicate IDs, no-op requests,
  unsupported sources, incomplete captures, changed values/types/positions,
  changed ports, unexpected edges, and inconsistent relationship counts.
- TypeScript typecheck passes. The 236-test wire/adapter/call-budget cohort
  initially had two inventory failures. The missing legacy aggregate entry
  was added. All 55 wire tests pass on rerun; the other 181 tests had passed.
- Nine semantic-reader tests pass. Public descriptions remain v52, 44 tools.
  Normal and capture profiles and product call budgets are unchanged.
- Context validation and diff whitespace checks pass.

## Deployment and next live sequence

The [V5 deployment](../data/phase9a-grid-cables/deployment-v5.json) has 114
methods, hash `9dc11c1f9958f4d8`, marker `9a-grid-cable-v5`, and archive SHA-256
`eef67a1ee7f39ee17e00720c0e613ef4c9ffb4bfa1a098966eacf220b28d5132`.
The last confirmed loaded controller is still V4. The normal archive has not
been restored. Operator replacement is required by repository instructions.
The operator must fully remove the old controller and add the final matching
`ghostnote probe` in the complete list. A power toggle is insufficient.

No live host call ran during this preparation. The
[saved project and preset hashes](../data/phase9a-grid-cables/saved-files-before-live.json)
still match E277. The last observed fixture is the saved baseline, muted, with
transport stopped and the engine inactive. Recheck current state after reload.

After operator confirmation, run `npm run probe:hello`, verify the V5 markers
and fresh initialization, and check for competing phase8/phase9 drivers. Use
one foreground chain. Run `project` mode for baseline reads, then `cable`
mode with `sine`, inspect the UI, and run `cable` mode with `none`. Use absolute
project, preset, new output directory, and semantic-query paths, as in E277.
Each write has two after reads. Inspect per-call durations and repeat the
cycle before any regression claim. Then check host undo/redo, edited-state
save/reload, and final baseline restoration. Keep engine adoption separate:
an unused spare module cannot provide an audible witness. Continue from this
result to the plan's retarget and module-operation steps.

## Retrospective

The prior close handoff made a useful checkpoint look like an exhausted path.
The plan and NOW now distinguish the measured checkpoint from the selected
continuation. Keep historical evidence fixed and put each next bounded test
in the active plan. No reader reset or evidence deletion was needed.

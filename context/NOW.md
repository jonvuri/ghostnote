---
title: Current state
kind: status
state: active
updated: 2026-09-12
phase: phase-5
session: dogfood-menu
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 and the
dogfood loop remain active. Phase 6a stays blocked until both close.

## Next session

Resume the dogfood menu below. Use one fresh projectless public-tools-only
session for the selected item. Non-native plug-in preset loading is not a
pending dependency.

## Preset detour closeout

[E101](evidence/experiments/e101-plugin-preset-files-have-two-direct-routes.md)
records the matrix. H2P is `indexed-direct`, VSTPRESET is `direct`, the tested
FXP is `unsupported`, and FXB is `unproved`. The API 25 popup route could not
establish a safe preset transaction. Each live probe restored its exact entry
baseline.

[E102](evidence/experiments/e102-clap-discovered-h2p-is-an-indexed-direct-route.md)
proves that indexed H2P is a CLAP preset route on this machine. Repro-5 and Diva
are installed only as CLAP devices. Both loaded indexed H2P files with stable
readback, and both ignored unindexed copies.

[D22](decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md) closes
the product direction. H2P, VSTPRESET, FXP, FXB, and CLAP-discovered preset
loading are out of scope. D03b and D04 are canceled. The D03-only extension
handlers and popup-browser banks are removed.

## Probe surface audit

The extension now registers 150 methods. The product wire can emit 82; 68
registered methods remain outside the product path. Six are explicitly banned
by D13. Most of the remainder support historical capability probes. The brain
also retains 249 files under `src/probes`; the product server does not import
that directory. Outside it, one client helper supports malformed-frame tests,
and the wire-golden tools preserve probe method history.

The reduced extension is deployed. The next controller reload must report 150
methods and wire hash `73677cd82e4c7cd2`.

No general cleanup round existed. [Phase 6b](plan/phase-6/6b-probe-runtime-retirement.md)
now owns the full classification and retirement pass. Do not remove older
probe methods ad hoc because some still enforce live regression decisions.

## Dogfood menu after the preset detour

Use one new projectless public-tools-only session for each item. Supply the
musical content and acceptance criteria at run time.

1. **Clip composition and revision.** Create a clip from a musical brief. Read
   it back, transform it, change metadata and launch behavior, and audition it.
2. **Long asynchronous composition.** Generate a long or dense clip, inspect
   progress, revise it after completion, and exercise cancellation only if the
   musical task calls for it.
3. **Drum Machine production.** Build a multi-pad kit and beat, change nested
   device parameters, copy a variation to another row, and audition both clips.
4. **Device-alternate audition.** Create several alternatives for one device,
   fill and switch them, compare them by ear, and keep one explicit choice.
5. **General parameter sound design.** Use a native, VST3, or CLAP device.
   Inspect direct and remote controls, set continuous and discrete values, and
   test enabled-state changes without guessing semantic values.
6. **Preset modulation editing.** Inspect a saved preset, then add, retarget,
   resize, replace, and delete supported modulators. Require exact live page and
   behavior readback.
7. **Layered source composition.** Build an Instrument Layer or FX Layer from a
   mix of native, plug-in, preset, and existing-device sources. Include nested
   modulation and an explicit keep-or-reverse verdict.
8. **Launcher and project structure.** Add and rename an owned track, add
   scenes, create a small clip block, move or copy it, and remove only rejected
   owned content with exact change checks.

Across these sessions, ask for an explicit audition verdict. Record an
observation only after that verdict. Use `list_changes`, `check_revert`, and
`show_changed_clip` when the task creates or rejects material.

## Retrospective

Separate the product extension from optional probe instrumentation. This keeps
closed investigations from adding permanent observer and wire cost.

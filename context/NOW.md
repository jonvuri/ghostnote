---
title: Current state
kind: status
state: active
updated: 2026-09-12
phase: phase-5
session: d03b-clap-discovered-preset-boundary-spike
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 and the
dogfood loop remain active. Phase 6a stays blocked until both close.

## Next session

Run [D03b](plan/dogfooding/d03b-clap-discovered-preset-boundary-spike.md).
Define the safe boundary for filesystem-backed CLAP-discovered presets before
D04 implements a public source. Test Repro-5, Diva, one u-he effect when
available, and one non-discovery CLAP negative control.

Keep [D04](plan/dogfooding/d04-plugin-preset-file-source.md) blocked until the
spike chooses `clap-discovered-file`, `u-he-h2p`, or `unavailable`.

## D03 result

[E101](evidence/experiments/e101-plugin-preset-files-have-two-direct-routes.md)
records the matrix. H2P is `indexed-direct`, VSTPRESET is `direct`, the tested
FXP is `unsupported`, and FXB is `unproved`. The API 25 popup route could not
establish a safe preset transaction. Each live probe restored its exact entry
baseline.

## CLAP feasibility result

[E102](evidence/experiments/e102-clap-discovered-h2p-is-an-indexed-direct-route.md)
proves that indexed H2P is a CLAP preset route on this machine. Repro-5 and Diva
are installed only as CLAP devices. Both loaded indexed H2P files with stable
readback, and both ignored unindexed copies.

The mechanism is feasible for known filesystem paths. It is not a complete
catalog route. API 25 cannot enumerate CLAP discovery entries, select the
plug-in preset popup view, or address plug-in-contained presets.

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

Inventory installed plug-in formats before classifying a preset route. This
distinguishes a CLAP load from a same-name VST load without another mutation.

---
title: Current state
kind: status
state: active
updated: 2026-09-12
phase: phase-5
session: d03-generic-plugin-preset-loading-spike
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. The final ColourCopy
dogfood passed with an explicit operator acceptance. The operator selected one
new dogfood spike before the Phase 5 closeout: compare direct plug-in preset
file insertion with the popup browser. Phase 5 and the dogfood loop remain
active. Phase 6a stays blocked until both close.

## Next spike

[D03](plan/dogfooding/d03-generic-plugin-preset-loading-spike.md) responds to
dogfood session `01a0965e-2ec6-7482-9719-73c51b8a1ea8`. That run needed Repro-5
and Diva H2P presets. The current public tool accepts only `.bwpreset` files,
and the agent stopped without a Bitwig write.

Bitwig documents H2P, FXP, FXB, VSTPRESET, and CLAP-discovered vendor formats.
This machine has trustworthy H2P, FXP, and VSTPRESET fixtures. It has no proved
user-loadable FXB fixture. The spike must classify all locally found preset
suffixes, test direct insertion and popup commit for every available documented
format, measure cold and warm time, and restore one fresh disposable project
exactly. It must not use either retained music project.

## Accepted ColourCopy result

Dogfood session `01a07268-8b4e-73f1-b307-3f5fb565d1eb` passed on 2026-09-05.
It used only the 53 public Ghostnote tools. The agent preserved ColourCopy,
wrapped it at position 1, and produced five verified free-running routes. It
then set slower movement for Mix, Brightness, Regeneration, Colour, and Stereo
Phase. The operator replied, `Great, looks good.`

The follow-up used an exact owned reversal and rebuild because API 25 cannot
update live wrapper topology safely. This is the known deferred update boundary,
not a new defect. Transcript review session
`01a07274-28f6-7280-80ea-69d5a179b81c` found no hidden high-priority issue.

The last transcript-observed project had seven tracks and eight launcher rows.
The third track started with `Serato Sample | ColourCopy`. The accepted result
left `Serato Sample | FX Layer`, with ColourCopy and five modulators in its first
layer. This is the last recorded state, not a new live handshake.

## Dogfood menu

Use one new projectless public-tools-only session for each item. Supply the
musical content and acceptance criteria at run time.

1. **Clip composition and revision.** Create a clip from a musical brief. Read
   it back, transform it, change metadata and launch behavior, and audition it.
2. **Long asynchronous composition.** Generate a long or dense clip, inspect
   progress, revise it after completion, and exercise cancellation only if the
   musical task naturally calls for it.
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

## Next action

Run D03 in a fresh disposable Bitwig project. Record one format verdict for
direct insertion and popup loading, including the explicit FXB fixture gap and
one non-u-he CLAP discovery case. Use the result to select a product follow-up.
Then resume the complete Phase 5 closeout matrix. Keep the dogfood loop open
until the operator explicitly closes it. Phase 6a remains next after both
close.

## Retrospective

Scope negative evidence to the exact file class tested. E4h proved that renamed
`.bwpreset` bytes do not load; it did not prove that valid plug-in preset formats
fail through `insertFile`.

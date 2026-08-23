---
title: Phase 5 — Structure & modulation authoring (the differentiator)
kind: plan
state: active
status: Next. Start executor and take integration. The `bwmod` library it uses
        is already built and tested.
updated: 2026-08-22
parent: ../ROADMAP.md
prev: ../phase-4/README.md
next: ../phase-6/README.md
evidence: DECISIONS D1/D2/D3, FINDINGS E10–E13, BWMOD_DESIGN.md, BWFORMAT_SPEC.md
---

# Phase 5 — Structure & modulation authoring

> **Purpose.** The capability nothing else has: the agent **constructs modulator
> topology** — add, replace, retarget, delete, any type, any category, arbitrary
> targets including across devices — by byte-editing a `.bwpreset` template and
> loading it live. INITIAL_PROMPT rated this ◐ *unknown*. It is now settled, and the
> library that does it is already written and tested.

## Where this actually stands

Unusually for a phase plan, the hard part is done. `brain/src/bwmod/` ships all five
editors, `validate()`, the readers and a curated donor library; **42 offline tests
pass** including four byte-identical golden reconstructions and a byte-for-byte
cross-check against the Python reference, and **12 live cases pass against Bitwig
6.0.6**, each confirmed by remote-page readback, with a negative control proving the
reject guard fires (D3/E13).

So Phase 5 is not "figure out modulator authoring." It is **"wire a proven library
into the executor and build the asset library it consumes."** No further format work
is required — E13 noted every recipe worked as documented on the first live run.

## Phase 4 handoff

Phase 4 is complete. [E64](../../evidence/experiments/e64-phase-4-closes-with-saved-device-baseline.md)
records the final matrix and saved baseline.

Use remote-control readback as the live modulation verification instrument.
Resolve the exact page and control selector, then compare its base value and
`modulatedValue`. `bwmod.validate()` proves only that a preset can load. It does
not prove that the authored route produces modulation.

Start with one focused executor operation that applies a proved `bwmod` edit,
loads the result, verifies it through remote readback, records an honest
structural-fidelity take, and reverses it. Keep template-library growth outside
that first integration unless the proof needs one new owned asset.

## What the spike established (do not re-derive)

- **Topology is authored at template time, driven at runtime (D1).** There is no
  runtime modulator create/route API (E7 ○, exhaustively). The agent edits the file
  and loads it with `insertFile`; runtime then drives what exists.
- **It is durable and first-class**, not a load-time illusion: a surgically-authored
  modulator survives project save → Bitwig restart → reopen, and Bitwig re-serialises
  it cleanly on save (E11g).
- **One load gate:** a unique `0x1a1b` instance id per modulator. Ids need not be
  contiguous; the `0x02b9` name is cosmetic; same-type duplicates are fine.
- **The sentinel rule is the one that bites.** The `0x1a46` list ends with an empty
  `cls 0x0003` sentinel; a diff-derived bound can land 2 bytes inside it and corrupt
  the whole preset, with an *alignment-dependent* error that manufactured a false
  "Zebra wall" for an entire session (E11h). Snap object bounds to the sentinel.
- **Two host tiers, and only two (D2).** Tier 1 is everything, including VST3/CLAP
  plugins with opaque state — plugin opacity does **not** mirror modulator topology.
  Tier 2 is presets embedding a sample, which additionally need **every class-1
  reference stub in every count list relocated** by the donor's footprint. There is
  **no tier 3**; do not reintroduce one.
- **Cross-device routing works from container modulators** and the target set is
  **arbitrary within the container**, reached by the ordinary retarget primitive
  (E11e). This retires E7's curated slot-bank as the default model.
- **Layer chains can be trimmed** (E10d), collapsing "a template per shape" to one
  wide template plus a trim step. Growing a container is still impossible (E4d/E4e).
- **Verification is by live load + readback, never by inspection.** `validate()`
  predicts a *load*; it cannot predict *modulation*. A wrong Ramona route path passes
  every offline check and silently does nothing (E10b).

## Scope

### In

1. **`bwmod` wired into the executor.** File surgery becomes an op class in the
   patch/write-set/take pipeline: checkpointed, verified, revertible. Its fidelity
   label is honest — a preset load is a structural op, not an exact one.
2. **The template & donor asset library.** The real work of this phase. Templates
   must originate from a human saving a preset in Bitwig (there is **no save/export
   API** — E4f, unchanged by the format decode), so this is a curated,
   human-in-the-loop asset pipeline: capture, catalogue, measure footprints, record
   provenance.
3. **Footprint discipline.** Only 3 of the 7 current donors have measured footprints;
   the rest ship `null` and are **refused on a sampled preset rather than guessed** —
   a wrong delta is a silent whole-preset reject. Measuring the remainder is
   straightforward and belongs here.
4. **The composition layer.** Trim a wide template to N chains; substitute device
   GUIDs per chain (E4g — verified independently per chain); add/replace modulators;
   route, including cross-device from a container. This is the "boring setup is
   solved" pipeline, end to end.
5. **Structure construction.** `insertFile` materialises arbitrary structure in one
   call (~268ms); drum pads create chains on insert; containers duplicate wholesale.
   Prefer Drum Machine when the agent must build N chains (E4d).

### Out

- Growing new layers in a layer container. Reasoned ○ (E4d/E4e).
- Grid patch synthesis (§9).
- Runtime modulator creation or routing (E7 ○, exhaustive — including foregrounded).
- Any Python at runtime. `tools/bwformat/*.py` remains the CI oracle only (D3).

## Decisions this phase must make

- **Template library scope and provenance.** How many devices, how many shapes, and
  how the assets are documented so a future session knows what each donor is and
  where it came from. `brain/assets/modulators/index.json` is the existing pattern.
- **Redistribution.** Templates derived from Bitwig's bundled content are a licensing
  question if the repo is ever published — worth deciding before the library grows,
  not after. Generating assets from the user's own install sidesteps it.
- **How much of the library ships vs. is generated on first run.** Related to the
  Phase-4 catalog decision; they should be answered together.
- **Whether `bwmod` is published separately.** It is a self-contained, tested library
  solving a problem the Bitwig community has documented as unsolved. Low cost to
  extract, real value to others.
- **How a modulator edit is expressed in the tool surface.** "Add an LFO to the
  filter" must not require the agent to know about sentinels or footprints — the
  library's job is to be boring at the call site.

## Exit criteria

1. The agent constructs modulator topology on a real patch — add, retarget, replace,
   delete — **verified live by remote-page readback**, not by `validate()` alone.
2. It works on a **sampled** preset (Tier 2), with stub relocation correct, proving
   the general path rather than the easy one.
3. Cross-device routing from a container modulator produces **live** modulation on a
   nested device's parameter.
4. Every edit is checkpointed as a take with an honest fidelity label and is
   revertible.
5. The donor library has measured footprints for every donor intended for sampled
   presets, and refuses — loudly — for those that do not.

## Risks

- **Silent rejects are the signature failure**, and they are alignment-dependent:
  a corrupt edit can load in one position and reject in another, which is exactly how
  the phantom "Zebra wall" survived five wrong readings across a session. Mitigation:
  `validate()` before paying an `insertFile`, sentinel integrity checked first, and
  live readback as the only acceptance test.
- **A guessed footprint is worse than a refusal.** The library already refuses;
  the risk is a future change relaxing that to be helpful. It must not.
- **Template curation is unglamorous and open-ended**, and it is the actual bulk of
  the phase. Mitigation: curate against real use from Phases 2 and 4 rather than
  speculatively — the library should grow to fit patches you actually want.
- **The format is undocumented and could change across Bitwig versions.** Mitigation:
  the goldens are byte-identical reconstructions, so a format change fails loudly in
  CI rather than corrupting a project. `BWFORMAT_SPEC.md` records what is known and
  which readings were wrong.
- **Container presets carry one `0x1a46` list per nested device** — the editors
  refuse to act without an explicit `listIndex` rather than silently rewriting the
  wrong device (E13). Keep that refusal.

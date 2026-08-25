---
title: Phase 5 — Structure & modulation authoring (the differentiator)
kind: plan
state: active
status: Reopened 2026-08-25. Sessions 5j through 5s generalize the public modulation surface; 5j is next.
updated: 2026-08-25
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

Sessions 5a through 5i form the first complete baseline. `brain/src/bwmod/`
ships all five editors, `validate()`, readers, measured donors, and a
Python-oracle boundary. The executor records and reverses authored insertions.
E73 proves the four-entry native composition baseline and exact cleanup. The
[first outcome](../../archive/outcomes/PHASE-5.md) records that result and its
qualifications.

Dogfood session `01a03744-e6c4-7be0-b210-e999c8f17081` showed that the public
surface did not share the core's generality. Public targets were limited to
three Polysynth and Sampler recipes. Composition was limited to one native
Instrument Layer template and could not preserve and modulate an existing
plug-in. Sessions 5j through 5s reopen the phase to remove those public limits.

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
- **One list-local load gate:** each `0x1a1b` instance id is unique within one
  modulator list. Ids can repeat in separate container lists. They need not be
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
  wide template plus a trim step. The preset file cannot grow beyond that width.
  A seeded live layer can grow through typed duplication (E17), which is a
  separate product path.
- **Verification is by live load + readback, never by inspection.** `validate()`
  predicts a *load*; it cannot predict *modulation*. A wrong Ramona route path passes
  every offline check and silently does nothing (E10b).

## Execution order

1. [5a — checkpointed modulator add](5a-modulator-add-integration.md) — done.
   Add one curated modulator, load it through the executor, verify live
   divergence through the exact returned remote selector, and reverse it.
2. [5b — Tier-1 topology editors](5b-tier-1-topology-editors.md) — done.
   Replace, retarget, and delete use the same checkpoint and pass exact live
   page and behavior readback.
3. [5c — sampled-preset integration](5c-sampled-preset-integration.md) — done.
   Checkpointed add and delete relocate all four multisample stubs by measured
   footprints and pass exact live behavior readback.
4. [5d — container cross-device routing](5d-container-cross-device-routing.md) — done.
   An explicit outer-container list retarget reaches one exact nested control,
   passes live behavior readback, and reverses exactly.
5. [5e — donor scope and footprint completion](5e-donor-footprints.md) — done.
   Five donors support sampled presets with measured provenance. Two Tier-1-only
   donors keep loud refusals.
6. [5f — public modulator authoring surface](5f-public-modulator-surface.md) — done.
   Express all four topology edits with named modulator types, named targets,
   exact live witnesses, and recorded reversal bounds.
7. [5g — owned-template composition core](5g-owned-template-composition-core.md) — done.
   Trim one owned four-entry template, substitute native devices, author nested
   modulation, verify the complete live structure, and reverse it.
8. [5h — public structure composition](5h-public-structure-composition.md) — done.
   Expose one format-hidden composition tool with named devices, modulators,
   targets, exact witnesses, and a recorded insertion.
9. [5i — composition dogfood and closeout](5i-composition-dogfood-and-closeout.md) — done.
   E73 proves the four-entry public patch, nested parameter work, two active
   routes, reversal, exact cleanup, and every local and live gate. GitHub
   Actions run 32660690914 passes the exact candidate.
10. [5j — general modulation targets](5j-general-modulation-targets.md) — next.
    Use stable DirectParameter ids and names instead of built-in target recipes.
11. [5k — semantic preset modulation inspection](5k-semantic-preset-modulation-inspection.md)
    — planned. Discover hosts, semantic modulator locations, types, and targets
    without exposing binary selectors.
12. [5l — complete list-scoped topology](5l-complete-list-scoped-topology.md) —
    planned. Run add, replace, retarget, amount, and delete on any selected list.
13. [5m — general donor catalog](5m-general-donor-catalog.md) — planned. Make
    public modulator types manifest-driven and complete for the current host.
14. [5n — general public preset authoring](5n-general-public-preset-authoring.md)
    — planned. Combine general targets, semantic lists, all editors, and the
    donor catalog across every proved host tier.
15. [5o — late-bound container modulation](5o-late-bound-container-modulation.md)
    — planned. Prove that an owned container route can bind to a device moved
    into it after load.
16. [5p — existing-device modulation wrapper](5p-existing-device-modulation-wrapper.md)
    — planned. Preserve one existing device while an owned container supplies
    its modulators and routes.
17. [5q — general device-source composition](5q-general-device-source-composition.md)
    — planned. Compose native, VST3, CLAP, preset, and existing device sources.
18. [5r — container shape and capacity](5r-container-shape-and-capacity.md) —
    planned. Support Chain, Instrument Layer, and FX Layer at measured complete
    observer limits.
19. [5s — public generalization dogfood and closeout](5s-public-generalization-dogfood-and-closeout.md)
    — planned. Retry ColourCopy and close only after the full public breadth
    matrix passes.

The dependency split is `5j → 5k → 5l`, with `5m` independent after 5j. Both
branches join at 5n. Sessions 5o through 5s then run in order because each one
depends on the prior host or lifecycle proof.

## Public-gap coverage

| First-closeout limit | Owning sessions |
|---|---|
| Three fixed Polysynth and Sampler targets | 5j, 5n |
| No semantic preset or modulator-list discovery | 5k, 5n |
| Selected container lists support only internal retarget | 5l, 5n |
| Fixed public modulator-type enums and incomplete donor cohort | 5m, 5n |
| No general native FX, VST3, CLAP, or sampled-preset public matrix | 5n |
| Cannot preserve and modulate an existing project device | 5o, 5p |
| Composer accepts only distinct native devices | 5q |
| One Instrument Layer shape, four entries, and two observable positions | 5r |
| No real public retry of the exposed ColourCopy gap | 5s |

Direct parameter-base writes are already general through `set_parameter` and
stay separate. Runtime modulator creation and routing remain host-API
impossibilities. External publication and redistribution remain Phase 6 work.

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
3. **Footprint discipline.** Five of the seven current donors form the sampled
   cohort and have measured footprints. The two Tier-1-only donors ship `null`
   and are **refused on a sampled preset rather than guessed**. A wrong delta is
   a silent whole-preset reject.
4. **The composition layer.** Trim a wide template to N chains; substitute device
   GUIDs per chain (E4g — verified independently per chain); add/replace modulators;
   route, including cross-device from a container. This is the "boring setup is
   solved" pipeline, end to end.
5. **Structure construction.** `insertFile` materialises arbitrary structure in one
   call (~268ms); drum pads create chains on insert; containers duplicate wholesale.
   Prefer Drum Machine when the agent must build N chains (E4d).
6. **General public target identity.** Use the DirectParameter ids and names
   returned by stable inspection. Keep Ramona routes internal.
7. **Semantic preset and container identity.** Expose device and entry paths,
   not modulator-list indexes.
8. **General public hosts and sources.** Support native instruments and FX,
   VST3, CLAP, sampled presets, and preserved existing devices.
9. **Bounded general containers.** Support Chain, Instrument Layer, and FX
   Layer through complete observed limits. Report those limits explicitly.

### Out

- Unbounded device and container structure. Controller API observer banks have
  fixed sizes. Session 5r selects and reports complete safe limits.
- Grid patch synthesis (§9).
- Runtime modulator creation or routing (E7 ○, exhaustive — including foregrounded).
- Any Python at runtime. `tools/bwformat/*.py` remains the CI oracle only (D3).

## Decisions this phase must make

- **Template library scope and provenance — settled by 5g.** Ship one
  user-authored four-entry Instrument Layer template with an exact manifest.
  Do not expand the library before the external review.
- **Redistribution — current scope settled by 5g.** The one asset is
  user-authored. No bundled Bitwig content is copied. Keep external
  redistribution review in Phase 6.
- **Shipped vs. first-run generation — settled by 5g.** Ship the one required
  asset. Do not require runtime operator setup.
- **Standalone `bwmod` publication — deferred to Phase 6.** It does not gate
  composition or Phase 5 closeout.
- **Public target identity — reopened for 5j.** General DirectParameter
  identities replace the fixed recipe requirement. Raw routes stay hidden.
- **Public modulator locations — planned for 5k/5l.** Semantic device and entry
  paths replace list indexes and support all five topology operations.
- **Public donor breadth — planned for 5m.** One manifest drives the complete
  supported type catalog for the current host.
- **Existing-device preservation — planned for 5o/5p.** A proved owned
  container supplies topology while the existing device instance moves intact.
- **General composition — planned for 5q/5r.** Explicit device sources and
  bounded container shapes replace native-only four-entry composition.

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
6. One request composes an exact retained-entry count from the owned wide
   template, substitutes every requested device, authors nested modulation,
   verifies the complete live structure and behavior, and reverses it.
7. The public composition surface hides every binary and asset control and
   passes one useful dogfood request before Phase 5 closes.
8. A public caller can target any stable DirectParameter on a proved native,
   VST3, or CLAP host without a built-in recipe.
9. Public preset authoring exposes all five topology operations at semantic
   plain or container locations and supports every catalogued donor type.
10. One guarded public workflow preserves an existing device instance while an
    owned container supplies active modulation to its observed parameters.
11. Public composition accepts native, VST3, CLAP, preset, and existing-device
    sources, including repeated device names.
12. Chain, Instrument Layer, and FX Layer work at explicit, completely observed
    capacity limits.
13. A fresh projectless musical run completes the ColourCopy request through
    only public tools and receives an explicit operator verdict.

E73 audits criteria 1 through 7 as the first closeout baseline. Session 5s owns
criteria 8 through 13 and the final generalized closeout. The
[first Phase 5 outcome](../../archive/outcomes/PHASE-5.md) remains the baseline,
not the final claim for this continuation.

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

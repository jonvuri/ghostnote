---
title: Phase 2 — The clip surface
kind: plan
state: planned
status: not started. ⚠ Premises revised 2026-08-07 (D16–D20 re-plan) — see the
        banner below: the CLIP BLOCK is Phase 1's deliverable, there is no take
        store, and "staged vs direct" is answered by the model.
updated: 2026-08-07
parent: ../ROADMAP.md
prev: ../phase-1/README.md
next: ../phase-3/README.md
---

# Phase 2 — The clip surface

> ⚠ **2026-08-07 (D18, re-plan).** Three premise changes, none touching the
> phase's core (the musical vocabulary):
>
> - **The CLIP BLOCK is PHASE 1's deliverable** (operator call: the block is a
>   branch mechanism, and Phase 1 owns branching — takes as contiguous launcher
>   clips bounded by empty slots, `duplicateClip` minting, `launchWithOptions`
>   A/B). Phase 2 **consumes** it: the vocabulary writes into takes the block
>   mints. §Scope 6's clip lifecycle remains this phase's — the block's *geometry
>   maintenance* does not.
> - **"Checkpointed as a take" (exit criterion 2) no longer means a store row**
>   (D17 rev): it means the stash for unbranched writes, and a D18 mechanism when
>   branch-protected. "Revertible from inside Bitwig" is the human's Bitwig-native
>   verbs plus directed agent reversal (D19).
> - **"Whether generated material is written directly or staged" (§Decisions) is
>   ANSWERED by the model**: written directly — branch-protected when the floor's
>   precondition requires it or when the human directs it. *"Generate four
>   variations"* maps onto a clip block of four takes, which is D5's insight
>   landing exactly where it pointed.
>
> ⚠ Tool-surface work here inherits D18c's rules: fresh jargon-free language,
> versioned descriptions, no choice-mapping, and the read/write/destructive seam
> (D20).

> **Purpose.** The first phase that is about music rather than machinery. Phase 1 can
> write any note it is told to; Phase 2 is what makes an agent able to decide *which*
> notes, and gives it an interface worth talking to. **This is the first genuinely
> usable build** — the point at which ghostnote earns its keep on an ordinary evening.

## Why this is third

INITIAL_PROMPT §2 locks "Phase 1 = MIDI clips", and this session upheld it against
the alternative of leading with the differentiator. The reasoning: the safety
machinery (Phase 1) had to be born on exact-fidelity objects, and the musical surface
should be the first thing built on top of it — both because it is the highest daily
usefulness and because Phase 3 needs real musical material to know what a musical
diff should show.

## Scope

### In

1. **The musical vocabulary.** `tonal.js` for theory (notes, intervals, chords,
   scales, modes, keys, detection, progressions, pitch-class sets — strong for
   generation and manipulation, per §7). On top of it, the manipulation verbs that
   have no clean inverse but a perfectly clean prior state — quantize, humanize,
   transpose, harmonize, arpeggiate, thin, densify, re-voice. §8b's whole argument
   for snapshot-over-inverse-op-log exists to make exactly these safe.
2. **Full expression coverage.** All 21 properties E2 verified round-trip exact:
   velocity, release velocity, velocity spread, duration, pan, timbre, transpose
   (fractional), chance, occurrence, recurrence (length+mask), repeat
   (count/curve/velocity curve/velocity end), mute — plus the ordering rule
   (**pressure last**) and the gain `read/2` mapping.
3. **Grid and units.** Beats-native contract; per-operation step size rather than
   global init-time grid (E2 — grid is a *view*, and daw-mcp's global design was
   unnecessarily rigid). Triplet grids work; snapshots scan at the finest grid
   because coarse scans snap off-grid notes down and misreport position.
4. **MIDI channel carried explicitly** in every note op from day one (SPIKE_PLAN
   §2.5 — free now, painful to retrofit; MPE later).
5. **The MCP tool surface v1.** Patch-first: the patch is the interface, the tools
   are the implementation. Beat Twin abandoned a 57-tool surface learning this.
6. **Clip lifecycle** — create, delete, duplicate (`duplicateObject`,
   `Clip.duplicateContent`, `duplicateClip`, all found in the API sweep), length and
   loop, name and colour. Launcher clips only; arrangement stays out (E2/§11 — the
   launcher is materially more reliable).

### Out

- Devices, parameters, modulators — Phases 4 and 5.
- The arrangement timeline. Deliberate: launcher-first, per §11 and E2's arranger
  cursor result.
- Audio clips of any kind.
- The web UI (Phase 3).

## Decisions this phase must make

- **Tool surface granularity.** The single most consequential design decision in the
  phase, and the one with the clearest prior-art lesson. Too many tools and the agent
  drowns; too few and every operation becomes a bespoke patch dialect.
- **How much theory belongs agent-side vs. brain-side.** The agent can reason about
  harmony directly; `tonal.js` can also do it deterministically. The split decides
  whether ghostnote is a *tool* the model drives or a *library* it calls.
- **Where quantization loss is allowed to happen**, and whether it is ever silent
  (recommendation: never — report it, per §8c's reporting discipline).
- **Whether generated material is written directly or staged.** Optimistic apply says
  directly. Worth revisiting once takes are real, because "generate four variations"
  is a natural request that maps well onto branchable takes (D5).

## Exit criteria

1. You can hold a conversation with an agent through an ordinary MCP client and get
   musically useful clip content into Bitwig, without touching the DAW.
2. Every operation is checkpointed as a take, verified by readback, and revertible
   from inside Bitwig (Phase 1's control layer).
3. A round-trip regression suite covers all 21 expression properties offline against
   the Phase-0 fake, and live against Bitwig via the archived probe path.
4. **Dogfood gate: you actually use it to write music, more than once, unprompted.**
   This is the real exit criterion. The rest is necessary, not sufficient.

## Risks

- **The tool surface calcifies around what is easy to expose** rather than what is
  musically useful. Mitigation: the dogfood gate is deliberately the last criterion,
  and it is the one that will move the surface.
- **`tonal.js` shapes the vocabulary toward what it happens to model well.** Watch
  for the tail wagging the dog; the library serves the musical verbs, not vice versa.
- **Notes are exact, so this phase feels safe** — and the habit of verifying by
  readback erodes right before Phase 4 introduces object classes where it is the only
  protection. Mitigation: keep readback structural in the executor, never per-op
  discipline.
- **Scope creep into arrangement.** It will be tempting. The launcher/arranger
  reliability gap is a real API fact, not a preference (§11, E2).

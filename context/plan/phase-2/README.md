---
title: Phase 2 — The clip surface
kind: plan
state: active
status: Session 2c is active. Seven build sessions lead to live proof, two
        separate dogfood sessions, and closeout. Async completion stays
        conditional on a measured workload.
updated: 2026-08-16
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
> ⚠ Tool-surface work here inherits revised D18e: fresh jargon-free language,
> versioned descriptions, a light factual starting point, and the read/write/
> destructive seam (D20). Device-vs-clip scope is settled; elaborate heuristics
> wait for repeated session evidence.

> ⚠ **2026-08-14 amendment.** Clip blocks remain the managed representation for
> clip-content alternates. Layer chains independently represent device alternates;
> track copying is ordinary CRUD, not the escape hatch of the earlier form-C
> classifier. Mixed instructions may create independent clip and device events.

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

## Execution order

The first seven sessions separate pure musical work, Bitwig lifecycle work,
application safety, and the public surface. The last three sessions prove actual
use and close the phase.

1. [2a — musical contract and surface decision](../../archive/outcomes/PHASE-2-SESSION-2A-MUSICAL-CONTRACT.md) — complete;
   the versioned patch, corpus, semantics, and public tool shape are fixed by D21.
2. [2b — theory and generation core](2b-theory-generation.md) — complete; pinned
   `tonal.js` packages sit behind a pure boundary that generates canonical notes.
3. [2c — harmonic transformations](2c-harmonic-transforms.md) — active; transpose,
   harmonize, arpeggiate, and re-voice without changing unrelated note state.
4. [2d — rhythm and performance transformations](2d-rhythm-performance.md) —
   quantize, humanize, thin, and densify with seeded randomness and explicit loss
   reports; prove triplet grids.
5. [2e — clip lifecycle](2e-clip-lifecycle.md) — measure, then build the verified
   launcher-clip contract for length, loop, name, colour, and duplication.
6. [2f — musical application planner](2f-application-planner.md) — turn musical
   patches into preflighted, stash-backed operations; use clip blocks only for
   requested or required alternates.
7. [2g — MCP clip surface v1](2g-mcp-surface.md) — expose the planner through a
   small, versioned, observed public surface.
8. [2h — conformance and workload proof](2h-conformance.md) — prove the complete
   path offline and live, restore the baseline, and measure whether async work is
   justified.
9. [2i — dogfood round one](2i-dogfood-1.md) — write real music through an
   ordinary MCP conversation and record friction without overfitting one use.
10. [2j — dogfood round two and revision](2j-dogfood-2.md) — use a different
    musical task, compare both records, and revise repeated problems only.
11. [2k — closeout](2k-closeout.md) — audit evidence, record qualifications, and
    hand off the next phase.

[2x — async batch completion](../phase-1/6-async.md) is a conditional branch
after 2h, not part of the default sequence. If 2h activates it, rerun the affected
2h workload and conformance cases before dogfooding.

### Dependency rule

- Sessions 2b through 2d depend only on the 2a musical contract.
- Session 2e is independent of the pure musical core after 2a.
- Session 2f joins the musical and lifecycle paths.
- Session 2g freezes public wording only after the planner reports real results.
- Sessions 2i and 2j are separate uses. A scripted repeat does not satisfy the
  dogfood gate.

### Carry-in corrections

Session 2a owns two contract corrections before the new schema freezes: musical
note writes must carry MIDI channel explicitly, and public gain wording must
match E24's measured inverse. Clear is clip-wide because the host has no
channel-scoped clear. Session 2d owns the gap between the current binary grid
list and this phase's triplet requirement. These are part of the named sessions,
not separate repair work.

## Scope

### In

1. **The musical vocabulary.** `tonal.js` for theory (notes, intervals, chords,
   scales, modes, keys, detection, progressions, pitch-class sets — strong for
   generation and manipulation, per §7). On top of it, the manipulation verbs that
   have no clean inverse but a perfectly clean prior state — quantize, humanize,
   transpose, harmonize, arpeggiate, thin, densify, re-voice. §8b's whole argument
   for snapshot-over-inverse-op-log exists to make exactly these safe.
2. **Full expression coverage.** Phase 1 session 5b settles the complete
   21-property contract before this phase starts. E24 proves 20 exact properties,
   including gain through its measured inverse. `pressure` is unwritable and
   refused. This phase does not assume that all 21 properties are exact.
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
- **When generated material needs managed protection.** Writes are direct and
  stash-backed. Use a clip block when the D18 fidelity floor requires protection
  or when the human asks for alternates. For example, "generate four variations"
  maps to a four-clip block. This phase does not reopen direct versus staged
  writing.

## Deferred optimization

[Async batch completion](../phase-1/6-async.md) moved out of Phase 1. It is not a
prerequisite for this phase. Schedule it only if a measured musical workload
shows that staged completion or the 2N expression-stage cost blocks useful work.

## Exit criteria

1. You can hold a conversation with an agent through an ordinary MCP client and get
   musically useful clip content into Bitwig, without touching the DAW.
2. Every write has a stash-backed changeset, is verified by readback, and is
   reversible through Phase 1's directed `revert_change` path within its stated
   fidelity. Branch-protected clip work uses a clip block. Recorded clip changes
   can open in Bitwig's editor.
3. A regression suite covers the complete 21-property contract offline against
   the Phase-0 fake and live against Bitwig: all 20 exact members round-trip,
   gain uses the E24 inverse, and pressure refusal is explicit.
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

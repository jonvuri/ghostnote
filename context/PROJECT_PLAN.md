---
title: ghostnote — Project Plan (phased)
status: sketched 2026-07-24 — phase docs are deliberately high-level; low-level design
        is decided inside each phase as it is entered
updated: 2026-07-24
evidence: context/spike/FINDINGS.md (E0–E13), context/DECISIONS.md (D1–D5)
supersedes: the "Phase 2+ ordering" open question in INITIAL_PROMPT §12
---

# ghostnote — Project Plan

> The spike's deliverable was **this document plus `DECISIONS.md`**, not code
> (SPIKE_PLAN §5). Every §12 open question now has a ●/○ verdict backed by a live
> experiment. What follows is the shape of the build, not its details: each phase
> doc states purpose, scope boundary, exit criteria, and the decisions that phase
> must make — and explicitly leaves implementation design to be settled on entry,
> because the spike's own history says we will learn things that move it.

---

## 1. What the spike changed

Read `DECISIONS.md` for the settled decisions and `spike/FINDINGS.md` for evidence.
The three shifts that reshape the plan, versus `INITIAL_PROMPT.md`:

1. **The differentiator moved.** INITIAL_PROMPT §6a bet on direct parameter access.
   That holds (E4/E4b — named, valued, repointable handles far past the 8-per-page
   ceiling, on native, VST **and** CLAP). But the bigger capability is **`bwmod`**:
   arbitrary modulator topology authored by `.bwpreset` byte surgery, durable across
   save + restart, general across natives/CLAP/VST3/sampled presets, with arbitrary
   cross-device routing targets (D1/D2, E10–E12). It is **already built and tested**
   (D3/E13). INITIAL_PROMPT rated modulators ◐ *unknown*; E7's curated "slot-bank"
   compromise is retired. This is now Phase 5, and it is the crown jewel.
2. **The escape hatch is gone.** Named actions are unusable *and* hazardous (E6 —
   foreground+focus gated, zero readback, and they fire against the UI selection our
   own addressing sets). The typed API plus file surgery is the entire toolbox.
3. **Safety got proven, not assumed.** E3 killed native undo decisively (no grouping
   for note/param writes, and the stack is project-global). E8 demonstrated the batch
   executor (232× over per-op RPC), staged pacing, the stale-revision guard, and
   writes landing correctly through 21 concurrent user selection changes. Owning
   revert is no longer a premise — it is a measured requirement with working parts.

## 2. What this session locked (recorded as D4/D5)

- **Topology: daemon + clients (D4).** `ghostnoted` owns the bridge connection, the
  take store, and the change log. The MCP server is a client. **No custom chat
  harness** — explicitly ruled out as a rabbit hole.
- **The human surface lives in Bitwig first (D4).** The Studio I/O panel
  (`host.getDocumentState()`) gives real buttons, a button-group chooser, text and
  toggles, saved *in the project document* and unreachable from the bridge — so
  §8g's "revert is a human verb" becomes structural rather than policy. Pending the
  Phase-0 probe.
- **Checkpoints are branchable takes (D5)**, not a linear undo stack — because in
  music the previous version is not disposable and A/B comparison is the core verb.
- **Phase 1 stays clips** (INITIAL_PROMPT §2 upheld): exact fidelity (E2) is the
  right place to prove the safety machinery, and it is the highest daily usefulness.
- **Personal but releasable**: configurable paths, clean licensing, real README. No
  support commitment; publishing `bwmod` or the param catalog stays a cheap later
  decision.

## 3. The reframe the plan is built on

Cursor's loop is *preview → accept → apply*. Music inverts both halves:

- **You evaluate by listening, so application must precede judgment.** Given
  "Bitwig is the only sound surface" (§2), optimistic apply is not a compromise —
  it is the only preview mechanism that exists. The UI's job is not to help you
  decide before; it is to make comparing and undoing trivial *after*.
- **The old version is not disposable.** "That take had a better hi-hat" is the
  normal case, which is why D5 chose takes over a stack, and why *partial* revert
  sliced by musical address is a first-class verb (the write-set is already
  addressed per §8b, so this is nearly free).

One corollary shrinks the UI job considerably: `ClipLauncherSlot.showInEditor()` +
`Application.zoomToFit()` put the user in front of **Bitwig's own piano roll** — a
better piano roll than we would ever render, already open, already familiar, and
already where they would go to fix it by hand. Our visual surface therefore only
owes *before/after* comparison and cross-object summaries.

## 4. Standing rules (apply in every phase)

These are the spike's hard-won invariants. Violating one is a defect, not a style
choice. Evidence in parentheses.

1. **Readback is the only truth.** Every write is verified by reading it back.
   Offline validation and inspection are necessary, never sufficient — a wrong
   modulator route passes `validate()` and silently does nothing (E10b).
2. **Address by identity, never by index.** `channelId` (UUID) is the durable key
   (E2f); pinned non-following cursor tracks are the live handle (E1); verify the
   cursor's target before every write (E2); **re-point after any structural op** —
   a held pin's `sceneIndex` goes permanently stale after scene compaction (E3).
3. **Known silent-no-op write traps:** `setImmediately` never `set` (E4);
   DirectParameter writes need `resolution=1` (E4b); `gain` reads back 2× written
   (E2); **`pressure` cannot be written at all** and is refused (E15-E, retracting
   E2/e02e's "write pressure last"); **`cursor.setNoteProps` reads before it
   writes**, so it needs its own request AND a settled step grid — 120ms measured,
   and every property is discarded in silence below that (E15-B/D).
3a. **Verify a write through a DIFFERENT handle than the one that made it.**
   Bitwig's cursors cache what you wrote to them and report it back whether or not
   it landed; two findings were wrong for exactly this reason (E15-C retracted,
   E15-D misdiagnosed). An independent cursor, or the same one after a re-point,
   is what makes standing rule 1 actually bite.
4. **The batch is the unit.** One request carrying N ops, never N round-trips. Fast
   ops in one turn; structural ops staged at their settle budget (~600ms device
   insert, ~144ms track, ~268ms `insertFile`). The two-turn write→verify rule applies
   once per batch, not per op (E8/E3).
5. **Bank-window overflow is a checkpoint blind spot, not a tuning knob.** Tracks
   outside the window are invisible and their state unsnapshottable. Detect and
   **fail loud**; never operate on a partially-visible project (E5).
6. **No named actions. Ever.** (E6)
7. **All writes go through the daemon.** The extension-side revision counter (E8)
   guards *ordering* across processes but cannot detect *omission* — a write that
   bypasses the daemon leaves a silent gap in the take log.
8. **Revert is a human verb.** The agent may read the take log and explain it; it
   may never mutate it (§8g).
9. **Check `@Deprecated` before wiring any handle at `init()`** — some deprecations
   throw and crash the whole extension on load (E7).
10. **Never record a capability ○ from a single mechanism or a doc pass.** Grep
    `member-search-index.js` across *all* API versions, walk supertypes, then probe
    live. Five-plus false negatives in the spike came from skipping this.
11. **Templates and donors are build-time assets.** `insertFile` needs an **absolute
    path** and a **`.bwpreset` extension** — both fail silently otherwise (E4h).
12. **Units are beats-native**; the step grid is a per-operation view, not global
    state (E2, correcting daw-mcp's design).

## 5. Phase index

| # | Phase | Delivers | Doc |
|---|---|---|---|
| 0 | **Foundation, contract & UI probe** | project skeleton, contract v0 + fake adapter, offline CI, E14 verdicts on the in-Bitwig surface | [PHASE-0-FOUNDATION.md](plan/PHASE-0-FOUNDATION.md) · [session 2](plan/PHASE-0-SESSION-2.md) |
| 1 | **The write engine & takes** | `ghostnoted`, patch→snapshot→apply→verify, branchable take store, in-Bitwig control layer | [PHASE-1-ENGINE.md](plan/PHASE-1-ENGINE.md) |
| 2 | **The clip surface** | musical vocabulary over notes, MCP tool surface v1 — first genuinely usable build | [PHASE-2-CLIPS.md](plan/PHASE-2-CLIPS.md) |
| 3 | **The session view** | daemon local API + web UI: change log, before/after diff, take timeline, partial revert | [PHASE-3-SESSION-VIEW.md](plan/PHASE-3-SESSION-VIEW.md) |
| 4 | **Sound design** | direct-param layer, device/param catalog, device chain ops, remote controls | [PHASE-4-SOUND-DESIGN.md](plan/PHASE-4-SOUND-DESIGN.md) |
| 5 | **Structure & modulation authoring** | `bwmod` in the executor, curated template/donor library — the differentiator | [PHASE-5-AUTHORING.md](plan/PHASE-5-AUTHORING.md) |
| 6 | **Breadth & release** | mixer/transport/scenes/browser, arrangement, publishable artifacts | [PHASE-6-BREADTH.md](plan/PHASE-6-BREADTH.md) |

### Dependency shape

```
P0 ──► P1 ──► P2 ──► P3
        │      │
        ├──────┴────► P4 ──► P5
                              │
                              └──► P6
```

P1 is the only hard universal prerequisite: everything else writes through its
executor and checkpoints into its take store.

### Reorderable seams

Named so a later reorder is a decision rather than a surprise:

- **P2 ↔ P3.** The visual surface could precede the musical vocabulary. Chosen
  order is P2 first because you need real musical material to know what a musical
  diff should show. P1 must therefore ship a *sufficient* control layer (§in
  PHASE-1), not a placeholder — optimistic apply is unsafe without one.
- **P4 ↔ P5.** P5 depends on P4 only for *readback* (remote pages and
  `modulatedValue` are how a modulator edit is verified). If sound design stalls,
  P5 can proceed on a thin readback slice.
- **P6 is a bag, not a phase.** Its contents are independently schedulable and
  several may be pulled forward opportunistically.

## 6. Explicitly not in this plan

Carried forward from INITIAL_PROMPT §9 and §8h, plus what this session added:

- **A custom chat harness.** Ruled out — you would be building a chat client, and
  none of that work is musical.
- Offline generation / DAWproject; Grid patch synthesis; a library cataloguing
  engine; building on DrivenByMoss or OSC.
- A preview/mirror DAW, local audition, or a song model. §8f still holds: what we
  need is a **scoped diff buffer over the write-set**, not a model of the song.
- Approval gates, confirmation tokens, immutable pending plans (§8h).
- Python at runtime. `tools/bwformat/*.py` stays a CI oracle only (D3).

**Note on the §9 boundary.** D1's file surgery is not a violation of "live only":
nothing is generated to be opened as a project. Templates are build-time assets
loaded through the live `insertFile` API, exactly like a preset a human drags in.
The line is *"no offline route that bypasses the running DAW"*, and it holds.

## 7. Open questions carried into the build

Not blockers; each is owned by a phase.

- **Stable identity for clips, scenes and devices.** `channelId` solves tracks
  (E2f). Slots are addressed within a track and scene indices shift under
  compaction (E3) — is there an equivalent durable id? → P1.
- **Async batch completion.** The Bridge writes a response when a handler returns,
  so a paced batch acknowledges acceptance, not completion. A completion callback
  needs a deferred-response protocol (E8). → P1.
- **Pointing borrows the UI selection** (E1). `NotificationSettings` may suppress
  the resulting notification spray; whether the selection movement itself can be
  restored after a batch is unresolved. → P0 probe, P1 decision.
- **Device-side scale is unmeasured.** E5's populated project was synthetic —
  empty tracks, no device chains, while `DEVICE_BANK` observers stream per chain.
  → P4.
- **`addDirectParameterValueDisplayObserver` never populated** display strings;
  hypothesis is that it is parameter-page-scoped (E4b). → P4.
- **Other embedded-bulk devices** (convolution IR, wavetable, nested containers)
  are expected to follow the same Tier-2 stub-relocation pattern but are untested
  (D2 §5). → P5.
- **DECISIONS D6+ consolidation is owed.** Per SPIKE_PLAN §5, the addressing model,
  scaffold sizes, checkpoint-fidelity table, grid/units, batch mechanics, toolchain
  and transport decisions are settled in FINDINGS but not yet transcribed into
  `DECISIONS.md`. §4 above is the working summary until they are. → P0.

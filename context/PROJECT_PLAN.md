---
title: ghostnote — Project Plan (phased)
status: sketched 2026-07-24 — phase docs are deliberately high-level; low-level design
        is decided inside each phase as it is entered. §4 demoted to a pointer at
        DECISIONS D6–D15 (2026-07-25); §7 updated with what Phase 0 closed.
        ⚠ REVISED 2026-08-07 under D16–D20 (the stateless hybrid): rules 5–8
        restated in §4, §5's phase index reshaped (no daemon, no take store, the
        PROJECT is the take log; the three branch mechanisms and the clip block
        land in Phase 1; Phase 3 is OPTIONAL, textual default), §7 gains the
        branching arc's open items. §2's D4/D5 text is HISTORICAL — the revision
        banners in DECISIONS.md are the live record.
updated: 2026-08-07
evidence: context/spike/FINDINGS.md (E0–E18), context/DECISIONS.md (D1–D20)
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

> **This section is now a POINTER.** It was the working summary while the
> spike-wide decisions were still owed; they landed as **`DECISIONS.md` D6–D15**
> (2026-07-25) and **D16–D20** (2026-07-26 → 2026-08-07), which are the canonical
> record with full evidence. What remains here
> is the short form — the rules as one-liners, because "violating one is a defect"
> is worth being able to read in thirty seconds. **Where the two disagree, DECISIONS
> wins.** Each rule below names its D-entry.

These are the spike's hard-won invariants. Violating one is a defect, not a style
choice. Evidence in parentheses.

1. **Readback is the only truth.** Every write is verified by reading it back.
   Offline validation and inspection are necessary, never sufficient — a wrong
   modulator route passes `validate()` and silently does nothing (E10b). → **D15**
2. **Address by identity, never by index.** `channelId` (UUID) is the durable key
   (E2f); pinned non-following cursor tracks are the live handle (E1); verify the
   cursor's target before every write (E2); **re-point after any structural op** —
   a held pin's `sceneIndex` goes permanently stale after scene compaction (E3).
   → **D6**
3. **Known silent-no-op write traps:** `setImmediately` never `set` (E4);
   DirectParameter writes need `resolution=1` (E4b); `gain` reads back 2× written
   (E2); **`pressure` cannot be written at all** and is refused (E15-E, retracting
   E2/e02e's "write pressure last"); **`cursor.setNoteProps` reads before it
   writes**, so it needs its own request AND a settled step grid — 120ms measured,
   and every property is discarded in silence below that (E15-B/D). → **D8/D9**
3a. **Verify a write through a DIFFERENT handle than the one that made it.**
   Bitwig's cursors cache what you wrote to them and report it back whether or not
   it landed; two findings were wrong for exactly this reason (E15-C retracted,
   E15-D misdiagnosed). An independent cursor, or the same one after a re-point,
   is what makes standing rule 1 actually bite. → **D15**
3b. **A `note.props` op must not RE-POINT.** It resolves its note against the clip
   the cursor held at TURN START, so a props op that moves the cursor inside its own
   turn loses every property, silently — in any shape, batched or not (E15-F). This
   is why property writes stay interleaved with their creates and are never hoisted
   or coalesced across clips. → **D10**
3c. **Validate inputs BEFORE calling; a handler's `try/catch` is not a safety net.**
   An exception Bitwig defers to its own thread escapes every extension frame and
   takes the DAW down — `Signal.fire()` returned normally and killed Bitwig from
   `BitwigStudioMain` (E14-A1). → **D15**
4. **The batch is the unit.** One request carrying N ops, never N round-trips. Fast
   ops in one turn; structural ops staged at their settle budget (~600ms device
   insert, ~144ms track, ~268ms `insertFile`). The two-turn write→verify rule applies
   once per batch, not per op (E8/E3). → **D10**
5. **Bank-window overflow is a PRECONDITION on every structural create** — never a
   post-hoc check *(restated 2026-08-07)*. A create past the window mints a track
   `track.list` never shows — unaddressable, un-cleanable, audible (E16r) — and a
   fork IS a `track.create`, so "detect and fail" runs after the damage. Check the
   budget `bankSize − (project tracks + FX returns + master + lineage groups)`
   BEFORE the call and refuse loudly (`itemCount()` reports the project total:
   E15-A, re-confirmed E16r). ⚠ Never a licence to reap (D20); never justified on
   disk grounds — E16u measured disk immaterial. → **D6 (rev)/D7**
6. **Named actions are not addressable surface** *(restated 2026-08-07; "no named
   actions, ever" was factually wrong — E16j)*. They act on the UI selection, which
   our own addressing sets and a human can move under us (E6 blocker 3, E16j —
   seven orphan duplicates). Usable only where the selection is established and
   verified in the same batch, and never where an addressed API call exists. The
   ONE sanctioned use is lineage-group creation — no API creates a group — and its
   construction order is forced: **group the original first, then duplicate**
   (E16k K2). → **D13 (rev)**
7. ~~All writes go through the daemon.~~ **STRUCK 2026-08-07** — there is no
   daemon and no take log to leave a gap in (D4 rev). The replacement is about
   coherence, not topology: ⚠ **ordered is not coherent.** The revision guard is
   atomic across connections (E16p) and guards *ordering* only; a rejected batch
   must be re-planned against the new world by whoever sent it — two chat sessions
   are two MCP servers are two writers. *(Mitigation available, unadopted: the
   extension refuses a second writing client.)* → **D4 (rev)**
8. **Destruction is never the agent's DECISION** *(restated 2026-08-07; was
   "revert is a human verb", which stands but is now half the rule)*. The revert
   and reap decisions are the human's; the agent may execute what was explicitly
   directed. Reversal of its own changesets rides the ordinary surface (D19);
   destruction of anything else rides the annotated destructive tool surface and
   the host's permission flow (D20). Bitwig still REFUSES `Signal.fire()` on a
   document-state button, so only a real human click can press one (E14-A1).
   → **D14 (rev)/D19/D20**
9. **Check `@Deprecated` before wiring any handle at `init()`** — some deprecations
   throw and crash the whole extension on load (E7). → **D11**
10. **Never record a capability ○ from a single mechanism or a doc pass.** Grep
    `member-search-index.js` across *all* API versions, walk supertypes, then probe
    live. Five-plus false negatives in the spike came from skipping this. ⚠ And the
    inverse: a doc pass can be wrong about where a feature APPEARS, not just
    whether it exists — D4 named a panel Bitwig had renamed two majors earlier, and
    the bundled user guide on disk is for 4.3.9 (E14). → **D14**
11. **Templates and donors are build-time assets.** `insertFile` needs an **absolute
    path** and a **`.bwpreset` extension** — both fail silently otherwise (E4h).
12. **Units are beats-native**; the step grid is a per-operation view, not global
    state (E2, correcting daw-mcp's design). Pick the COARSEST exact grid — off-grid
    notes are reported snapped DOWN, which corrupts a snapshot silently. → **D9**
13. **Allocate every Bitwig resource at `init()`.** Not a convention — it is
    enforced, across unrelated subsystems, with the same sentence: *"This can only
    be called during driver initialization"*. Measured on `getDocumentState()`
    settings (E14-C2) and on `host.createBitmap` (E14-I5), on top of cursor pools
    (E1) and device/param handles (E5). Four independent occurrences, so treat it
    as the DEFAULT for anything the API hands out and reveal it later with
    `show()` rather than creating it later. → **D7**

## 5. Phase index

| # | Phase | Delivers | Doc |
|---|---|---|---|
| 0 | **Foundation, contract & UI probe** | project skeleton, contract v0 + fake adapter, offline CI, E14 verdicts on the in-Bitwig surface | [PHASE-0-FOUNDATION.md](plan/PHASE-0-FOUNDATION.md) · [session 2](plan/PHASE-0-SESSION-2.md) |
| 1 | **The write engine & branching** | executor (patch→stash→apply→verify), the three branch mechanisms (fork / chain / clip block) + beat-aligned A/B, extension observers, MCP bridge, control layer | [PHASE-1-ENGINE.md](plan/PHASE-1-ENGINE.md) · [sessions 1–6](plan/PHASE-1-ENGINE.md#session-index) |
| 2 | **The clip surface** | musical vocabulary over notes, MCP tool surface v1 — first genuinely usable build | [PHASE-2-CLIPS.md](plan/PHASE-2-CLIPS.md) |
| 3 | **The session view** *(⚠ OPTIONAL — D4 rev)* | before/after diff, change summaries, partial-revert UX — **textual, agent-rendered first**; a web view only if re-justified after the core | [PHASE-3-SESSION-VIEW.md](plan/PHASE-3-SESSION-VIEW.md) |
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
executor and branches through its mechanisms. (There is no take store — D17 rev;
the project is the take log.)

### Reorderable seams

Named so a later reorder is a decision rather than a surprise:

- **P2 ↔ P3.** The visual surface could precede the musical vocabulary. Chosen
  order is P2 first because you need real musical material to know what a musical
  diff should show. P1 must therefore ship a *sufficient* control layer (§in
  PHASE-1), not a placeholder — optimistic apply is unsafe without one.
  > ⚠ 2026-08-07: this seam is mostly DISSOLVED — P3 is optional (D4 rev), coarse
  > A/B is Bitwig's own surface (D14 rev), and P3's textual forms can grow
  > incrementally inside any phase.
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

- ~~**Stable identity for clips, scenes and devices.** `channelId` solves tracks
  (E2f). Slots are addressed within a track and scene indices shift under
  compaction (E3) — is there an equivalent durable id? → P1.~~
  → **CLOSED 2026-07-26 (D16a), Phase 1 session 1.** **No, and we are not going to
  invent one.** Tracks stay durable by `channelId`; everything else stays
  `positional` in `ADDRESS_IDENTITY` and is re-resolved as *(durable track, scene
  index, scene epoch)* at replay time, with any scene op forcing a re-point and
  refusing every address minted before it. ⚠ A synthetic clip id was rejected
  rather than deferred: it would mean maintaining a side table across a DAW we do
  not control, through user deletes we cannot see without the daemon's observers
  — a second source of truth that goes wrong silently. The cost is stated instead
  of hidden: a positional address in a batch that can also move rows is labelled
  `lossy`, derived from `ADDRESS_IDENTITY` rather than remembered.
- **Async batch completion.** The Bridge writes a response when a handler returns,
  so a paced batch acknowledges acceptance, not completion. A completion callback
  needs a deferred-response protocol (E8). → P1.
- ~~**Pointing borrows the UI selection** (E1). `NotificationSettings` may suppress
  the resulting notification spray; whether the selection movement itself can be
  restored after a batch is unresolved.~~ → **CLOSED (E14-F).** ⚠ The first half was
  a conflation: E1's wart is that the SELECTION MOVES, and it says nothing about
  notifications — `NotificationSettings` governs notifications the CONTROLLER
  requests, they default off, ghostnote enables none, and pointing produces no
  spray to suppress. The second half is answered ●: the prior selection can be
  saved and restored, restoring it does not disturb the pool cursor, and a whole
  batch costs exactly **one** observable selection change, so a single restore at
  the end suffices. **Phase 1 owes that restore** (D6).
- **Device-side scale is unmeasured.** E5's populated project was synthetic —
  empty tracks, no device chains, while `DEVICE_BANK` observers stream per chain.
  → P4.
- **`addDirectParameterValueDisplayObserver` never populated** display strings;
  hypothesis is that it is parameter-page-scoped (E4b). → P4.
- **Other embedded-bulk devices** (convolution IR, wavetable, nested containers)
  are expected to follow the same Tier-2 stub-relocation pattern but are untested
  (D2 §5). → P5.
- ~~**DECISIONS D6+ consolidation is owed.**~~ → **DONE 2026-07-25.** Landed as
  `DECISIONS.md` **D6–D15**, which also carries the Phase-1 control-layer decision
  (D14) and the verification discipline the E15 arc produced (D15). §4 above is now
  a pointer at them.

### Added by Phase 0, session 2

- **The human surface splits by verb frequency.** Bitwig's controller pane cannot be
  pinned and closes on click-away (E14), so revert and other deliberate one-shots
  live there while **A/B take navigation moves to the Phase-3 web view, pulled
  forward**. That is the P2↔P3 reorderable seam being exercised for a measured
  reason rather than a preference. → P1 scope, P3 timing.
  > ● **CONFIRMED 2026-07-25 when Phase 1 was split into sessions.** "P1 scope, P3
  > timing" resolved to: **Phase 1 builds no take switcher at all** and
  > `PHASE-1-ENGINE.md` exit criterion 4 is relaxed rather than met. The pane keeps
  > revert, status and `showInEditor` navigation. ⚠ The consequence worth carrying:
  > the branchable take store ships with **no human ever exercising A/B inside
  > Phase 1**, so Phase 3 is no longer a nice-to-have — it is where takes become
  > usable — and PHASE-1 session 2's exit criteria carry the whole weight of
  > proving the store design is right.
  > ⚠ **SUPERSEDED AGAIN 2026-08-07 (D14 rev, D18):** the take switcher is
  > dissolved, not relocated — coarse A/B is Bitwig's own surface (chain solo,
  > clip launch, group mute), the store is retired, and Phase 3 is OPTIONAL.
  > Takes become usable in Phase 1 after all, through the project itself.
- **A caller-written `note.props` op for two clips loses BOTH.** Every props op gets
  its own stage, so each re-points, and E15-F makes that fatal to the properties.
  Not reachable through `note.write` (the generated path pairs each props op with
  its own create) and not refused either. → P1.
- **Async batch completion** remains open exactly as recorded above; E15-F adds that
  a deferred-response protocol would also be what makes a re-point inside a batch
  settleable, and so is the only route to reclaiming the 2N-stage cost of expression
  writes (D10). → P1.

### Added by the branching arc (E16–E18, re-plan 2026-08-07)

Each owed item is owned; none blocks starting. The first two are **early** P1
items because whole design claims run through them and both are currently
readings, not measurements.

- ⚠ **`launchWithOptions(quantization, launchMode)` and
  `ClipLauncherSlot.duplicateClip()` are UNPROBED and not on the wire** — and the
  clip block's entire ergonomic claim runs through them: `"1"`/`"8"` per-call
  quantisation, and `"continue_or_synced"` (take B resumes at A's playback
  position — the same bar rendered differently, which no mute, solo or chain
  switch can imitate; the only answer to E16m's beat-alignment complaint). Wire
  and probe **before** the clip half is designed. → P1, early.
- ⚠ **MCP tool-annotation handling (`destructiveHint`, `readOnlyHint`) is a spec
  reading, not a measurement.** D20's stop-and-ask rests on target hosts actually
  prompting; verify early, same epistemic class as the item above. → P1, early.
- **`getDocumentState()` capacity for a JSON payload** — never measured, and
  D18d's branch-event metadata lands there. → P1.
- **The block-delimiting premise** — that contiguous clips bounded by empty slots
  are what a Next Action's round-robin scopes to. Operator experience, never
  measured; cheap to confirm by ear the first time a block is built. ⚠ Related
  design consequence, absorbed not measured: Next Actions are NOT in the
  controller API (E18-VERDICT §4a″), so the human arms a block and **we cannot
  tell an armed block from an unarmed one** — decide what the agent says when it
  builds a block it cannot arm. → P1.
- **The MOVE trade-off's other half** — `e18h` measured the engine with audio on
  a different track; whether a MOVE leaves an audible hole in the migrated take's
  OWN output is unmeasured. Record both, decide neither. → P1.
- **The cross-device modulator case** — E11e's form, whose path encodes a device
  INDEX, exactly what a rebuild renumbers; `e18e`'s ●● 3/3 says nothing about it.
  A session of its own. → P5.
- ⚠ **Judgement dispositions with retirement conditions** (E18-VERDICT §7a):
  dormant-chain CPU, container PDC/transparency, launch quantisation. If
  exploration ever degrades the engine, or a take structure ever sounds different
  from its top-level equivalent, these are the first assumptions to re-test.
  → standing, all phases.

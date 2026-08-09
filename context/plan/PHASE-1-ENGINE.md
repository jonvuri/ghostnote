---
title: Phase 1 — The write engine & takes
status: in progress — split into six sessions 2026-07-25 (see §Session index).
        Sessions 1 and 2 DONE 2026-07-26 (D16, D17); session 3 DONE 2026-08-08
        as **bridge + observers**, no daemon built.
        ⚠⚠ RE-PLANNED 2026-08-07 UNDER D16–D20 — READ §Re-plan BELOW FIRST. The
        original text is kept as the record and is STALE where it disagrees.
        The model: STATELESS — the project is the take log; branching is the
        HYBRID at L3-open (D18: track fork / layer chain / clip block, agent
        chooses freely, the record silently captures the control rule's verdict).
        No daemon (D4 rev): observers live in the EXTENSION, the MCP server holds
        a bridge connection. Session 2's store is retired to the STASH, which is
        load-bearing three ways (D17 rev, D19). ⚠ The CLIP BLOCK lands in THIS
        phase (operator, 2026-08-06), and its design is gated on unprobed
        primitives — `launchWithOptions` + `duplicateClip` — which run EARLY,
        beside D20's annotation-behaviour check.
        ⚠ (The 2026-07-30 HALT banner this replaces said "branches are duplicated
        tracks"; E18 and the operator's hybrid decision superseded that — see
        ../spike/HYBRID-AUTONOMY-LEVELS.md §7.)
updated: 2026-08-08
parent: ../PROJECT_PLAN.md
prev: PHASE-0-FOUNDATION.md
next: PHASE-2-CLIPS.md
sessions: PHASE-1-SESSION-1-EXECUTOR.md … PHASE-1-SESSION-6-ASYNC.md
---

# Phase 1 — The write engine & takes

## ⚠⚠ RE-PLAN, 2026-08-07 — this phase under the hybrid (D16–D20)

> The original document below is KEPT as the record. Where it disagrees with this
> section or with `DECISIONS.md` D16–D20, **this section wins**. Disposition
> trail: `../spike/E16-REPLAN.md` (§1 rules, §2 sessions) and
> `../spike/HYBRID-AUTONOMY-LEVELS.md` §7 (what the re-plan inherits).

### Revised session structure

| # | Session | Disposition |
|---|---|---|
| 1 | The executor | ● DONE (D16) — ⚠ re-open briefly for the 2026-08-07 amendments: `clip.delete` → `lossy` via live `lengthBeats` (fixes the fake/live disagreement); `device.insert` gets its exact inverse (`device.delete`); the floor becomes **refuse-unless-branch-protected**, never an automatic fork (D18c) |
| 2 | ~~The take store~~ → **the stash** | ● DONE (D17), then RETIRED to the stash (D17 rev). Delete `graph.ts`/`project.ts`; reduce `store.ts`/`format.ts`; ⚠ **KEEP `slice.ts`** (partial revert by address) and the read/write type split. ⚠ **The stash is load-bearing THREE ways** — unbranched writes, the clip content fingerprint, agent-edit reversal (D19). Do not delete it with the store |
| 3 | ~~`ghostnoted`~~ → **bridge + observers** | ● **DONE 2026-08-08** — see [SESSION-3](PHASE-1-SESSION-3-DAEMON.md) §Re-scope. Daemon DELETED (D4 rev); the MCP server holds the connection (`brain/src/session.ts`). The **extension** carries both epochs and the content epoch is the one clip addressing consults (E16s). Three things the build added past E16s: the event log holds `channelId` not a bank index (rule 2), a **generation nonce** per `init()` so a restart makes a mark INCOMPARABLE rather than falsely equal, and the mark is one round trip. Consumed as `ApplyReport.concurrent` and as the stash's ⚠ **`moved`** verdict — the one a content fingerprint structurally cannot produce. ⚠ The mark also carries the **PROJECT**, closing the original doc's *"sharpest question in the session"*: a project load does not re-`init()` the extension, so the counters keep climbing and the window looks ordinary while every `channelId` names a track that is no longer open — worse than a restart, not milder. ● **Proven live** (`FINDINGS.md` E19, 17/17). ⚠⚠ Its probe also found **standing rule 5 is not implemented for SCENES** — a create past the scene-bank window strands an unaddressable row, and clip rows past it are missing from `Snapshot.unreachable` entirely. Owed, not built; see [SESSION-3](PHASE-1-SESSION-3-DAEMON.md) §Owed |
| 3′ | ⚠ **NEW — early probes** | The design-gating unknowns, run before anything leans on them: **`launchWithOptions(quantization, launchMode)`** (per-call `"1"`/`"8"` quantisation; `"continue_or_synced"` — take B resumes at A's position, the only answer to E16m) and **`ClipLauncherSlot.duplicateClip()`** (mints the next take); **D20's annotation check** (do target hosts actually prompt on `destructiveHint`?); **`getDocumentState()` JSON capacity** (D18d's record lands there) |
| 3‴ | ⚠ **PROPOSED 2026-08-08 — *the window*** | Session 3's carry-forward, and **not new design**: standing rule 5 is implemented for TRACKS only and its own words cover scenes verbatim. Three items that share one fix — a scene budget as a **precondition** on `scene.create` (a create past the window strands an unaddressable row: measured, `FINDINGS.md` E19), a window guard on `scene.delete` (`encoder.ts` sends a project index as a bank index), and ⚠⚠ **scenes counted into `Snapshot.unreachable`**, which today reports blind tracks and stays silent about blind clip rows. ⚠ The observers inherit the same hole in BOTH dimensions, so `ContentDelta` calls a window `complete` when the world moved outside the bank — a fourth way to lie that, unlike the three that are modelled, the delta cannot show. Plus `config.scenes` scale, unmeasured (E5 measured tracks). ⚠ Unblocks the Phase-3 change log. See [SESSION-3](PHASE-1-SESSION-3-DAEMON.md) §The full carry-forward |
| 3″ | ⚠ **NEW — the branch mechanisms & the record** | Track fork (built: E16k/C5/E16u) · layer chain (wire mostly exists: `e18a`/`e18c`; solo A/B per E17 row 6) · **clip block** (this phase, operator 2026-08-06): `duplicateClip` → append-only geometry (`hasContent()` contiguity, `slot.moveTo` restore, `createScene()` for room) → `launchWithOptions` A/B. Plus the **branch-event record** (D18d) and **versioned tool descriptions in fresh, jargon-free language** (D18c). ⚠ The dispatch classifier lives in the executor and must be *provably* unreachable from the tool surface — the `WIRE_METHODS_BANNED` test idiom, aimed at the leak |
| 4 | The control layer | Mostly survives, and SHRINKS: coarse A/B is Bitwig's own surface (D14 rev). The pane keeps revert, status, `showInEditor` navigation |
| 5 | Proving it live | ⚠ Exit criterion 4 is **BACK IN PHASE 1**: two takes A/B'd from inside Bitwig — chain solo (one exclusive flag) or clip launch (beat-aligned, E16m answered). The relaxation below is superseded |
| 6 | Async batch completion | Unchanged |

### ⚠ Decisions PROPOSED by session 3, awaiting the operator (rule 10)

Built and tested, recorded here rather than in `DECISIONS.md`. Each names what it
rejected, because in every case the rejected option was the tempting one.

1. **The content epoch lives on the MARK, not on the address.** A clip address
   keeps the scene epoch it already carries; the launcher window is compared
   between two `RevisionMark`s. ⚠ *Rejected: a second epoch on the address.* It
   would change the key grammar, every slice prefix and every stashed key, and it
   buys nothing — an address is minted from a live read inside one batch, and an
   address that outlives a batch lives in the stash, which carries the mark.
2. ⚠ **A per-`init()` GENERATION nonce, and refusal rather than staleness.** Both
   epochs restart at zero on every load, so a mark from before a Bitwig restart
   compares **equal** to one after it. ⚠ *Rejected: monotonic epochs persisted in
   `getDocumentState()`.* They would survive a restart but not a project change,
   and the failure would be a wrong comparison rather than a refused one — the
   silent direction.
3. **Events naming our OWN slots are not concurrent edits.** The callback carries
   no author, so our `clip.create` is byte-identical to a human's. ⚠ *Rejected:
   reporting every event.* The field would be noise within a day and would stop
   being read, which is worse than not having it. Our own addresses are
   arbitrated by the verify readback and the stash fingerprint; the detector's
   unique reach is the slots we never touched.
4. ⚠ **Three named ways a window is unusable, never collapsed into "no events"** —
   `truncated`, `discontinuous`, `unattributable`. Each reads as an empty window
   if you only count, and each means the opposite of quiet.
5. **`moved` and `undecidable` join the boundary verdicts.** `moved` fires even
   when contents compare EQUAL (a clip dragged out, an identical one dragged in);
   `undecidable` downgrades `ours` and only `ours`, and only for launcher cells,
   so pessimism cannot spread past its evidence. ⚠ *Rejected: making the launcher
   window a required argument.* It would have been honest and would also have
   made every existing caller wrong at once; the omission is REPORTED in the
   plan's caveats instead.
6. **The detector never refuses.** PHASE-1: *"detection matters more than
   resolution here — surface it, don't guess."* A concurrent edit outside the
   write-set does not invalidate a batch that already ran, and a detector that
   cannot answer must not take down a batch that landed.
7. **A reconnect onto a different generation throws the adapter away; the STASH
   survives.** ⚠ *Rejected: clearing the stash too.* It records what this session
   did, which is still true after a restart — and the boundary already reports
   its addresses as `undecidable` on its own, so clearing it would lose the
   record to protect against a stale index.

### New decisions this phase owns (not in the old list)

- **What the agent says when it builds a clip block it cannot arm** — Next
  Actions are not in the controller API, and an armed block is indistinguishable
  from an unarmed one (E18-VERDICT §4a″). An explicit affordance, not silence.
- **The destructive tool seam in practice** (D20): the read / write / destructive
  partition of the MCP surface, and reversal-bounded-to-own-changesets riding the
  ordinary write surface (D19).
- **Tool-description v1 content and its freeze/version mechanics** (D18c/d):
  mechanics + trade-offs + correctness recipes, lean, no heuristics; versioned
  per cohort; every domain concept renamed from scratch — no spike jargon on the
  surface.

Split 2026-07-25. Sessions 1–5 are a dependency chain; session 6 is optional and
may slip to Phase 2. The offline/live boundary is the load-bearing part of the
ordering: the three hardest sessions are provable against the Phase-0 fake, and
the two that need a human at the keyboard come after the things they verify are
already written.

| # | Session | Scope items | Needs | Doc |
|---|---|---|---|---|
| 1 | ● **The executor** — write-set, stash, verify, revert, resolver discipline | 2, 3, 5 | offline | [SESSION-1](PHASE-1-SESSION-1-EXECUTOR.md) — **DONE 2026-07-26**, decisions as D16 |
| 2 | ● **The take store** — persistence, branching, partial revert | 4 | offline | [SESSION-2](PHASE-1-SESSION-2-TAKES.md) — **DONE 2026-07-26**, decisions as D17 |
| 3 | **`ghostnoted`** — process, lifecycle, observers, local API | 1 | live daemon | [SESSION-3](PHASE-1-SESSION-3-DAEMON.md) — ⚠ **RE-SCOPED to bridge + observers, DONE 2026-08-08**; no daemon was built |
| 4 | **The control layer** — the in-Bitwig pane | 6 | ⚠ human | [SESSION-4](PHASE-1-SESSION-4-CONTROL-LAYER.md) |
| 5 | **Proving it live** — the exit-criteria sweep | §Exit | ⚠ human | [SESSION-5](PHASE-1-SESSION-5-PROVING.md) |
| 6 | **Async batch completion** *(optional)* | 7 | — | [SESSION-6](PHASE-1-SESSION-6-ASYNC.md) |

⚠ **Two of this doc's own premises were superseded by Phase 0's second session**,
which closed the day after this doc was written. Both are reconciled in the
session docs rather than rewritten here, per `DECISIONS.md`'s house rule that the
retraction is usually the more useful record:

- **⚠ Exit criterion 4 is RELAXED — take A/B leaves Phase 1.** D14 moved take
  navigation to the Phase-3 web view because the controller pane cannot be pinned
  and closes on click-away. **Resolved 2026-07-25: D14 wins.** Shipping the enum
  button group would satisfy criterion 4 on paper — it works, ● at 2–12 options —
  but A/B happens *while listening*, and a chooser that closes on click-away means
  re-opening a pop-over between every comparison. That is the core verb not
  working, not a wart on it. **Phase 1's in-Bitwig surface is revert, status and
  navigation**; criterion 4 moves to Phase 3 with the rest of take navigation. See
  [SESSION-4](PHASE-1-SESSION-4-CONTROL-LAYER.md) §Exit criterion 4 is RELAXED.
  > ⚠ **The consequence, stated so it is not discovered later.** Phase 1 ships a
  > branchable take store whose motivating verb no human ever exercises inside the
  > phase. Two things follow: [SESSION-2](PHASE-1-SESSION-2-TAKES.md)'s exit
  > criteria carry the *whole* weight of proving the store is right, and **Phase 3
  > stops being optional-feeling** — it is now where takes become usable at all.
  > The P2↔P3 seam (`PROJECT_PLAN.md` §5) is worth re-reading before Phase 2
  > starts.
- **"The Studio I/O panel" (§Scope 6) has not existed since Bitwig 5.0.** The API
  is untouched; only where Bitwig draws it moved (D14, E14).
- **"All 21 expression properties" (exit criterion 1) vs. D8's "16 of 18."**
  Reconciled against the code in [SESSION-5](PHASE-1-SESSION-5-PROVING.md):
  `NOTE_PROP_FIDELITY` has 21 keys — **19 exact, `gain` unverified, `pressure`
  unwritable**.

> **Purpose.** Build the machine that makes optimistic application safe, and prove it
> on the one object class where fidelity is exact. Everything after this phase writes
> through this engine and checkpoints into this store. It is the only hard universal
> prerequisite in the plan.

## Why this is second, and why on clips

INITIAL_PROMPT §8a: removing the approval gate removes the mutation-free preview that
would have been the safety net, so *"undo becomes load-bearing infrastructure, not an
ergonomic nicety."* E3 turned that from a premise into a measurement — a 4-note write
takes exactly 4 undos, there is no grouping hook for writes, and the stack is
project-global, so "undo the agent's last batch" maps onto Bitwig's history at no
depth. Owning revert is mandatory.

Clip notes are where that machinery should be born: `setStep → getStep` round-trips
**exact** across all 21 expression properties (E2), so the snapshot is lossless and a
revert bug is unambiguous rather than a fidelity argument. Structural and device ops
have low checkpoint fidelity by comparison — the wrong place to debug a checkpoint
engine.

## Scope

### In

1. **`ghostnoted` — the daemon (D4).** Owns the single bridge connection, the
   adapter, the take store and the change log. Spawn-on-demand from its first client
   is the expected lifecycle. It is also the only process that can usefully hold
   Bitwig observers, which is what makes the change log trustworthy while the user is
   editing concurrently (§8d).
   > ⚠ **2026-08-07: DELETED (D4 rev).** The extension holds the observers — a
   > strictly better home — and the MCP server holds a bridge connection. See
   > §Re-plan session 3.
2. **The execution pipeline** — §8b, made real:
   ```
   materialize patch → explicit IDs → known write-set
   → read prior state of exactly those addresses → stash
   → apply optimistically (one batch, staged pacing)
   → read back and verify
   → report: what applied, what didn't take
   ```
3. **The address resolver.** `channelId` UUID as the durable key, resolved to a live
   index on demand, then a pinned non-following pool cursor as the fast handle
   (E1/E2f). Verify the cursor's target before every write; re-point after any
   structural op. **Bank-window overflow detection that refuses to operate** rather
   than working half-blind (E5, standing rule 5).
4. **The take store (D5).** Branchable, project-keyed, on disk. A batch creates a
   take; takes can be compared, jumped between, and **partially reverted by musical
   address** — the write-set is already addressed, so slicing it is natural.
5. **The revision guard.** Lift E8's monotonic counter: it lives on the executor,
   thread-confined to the control-surface thread (no locking — that confinement is
   what makes check-then-apply-then-bump atomic for free). `ifRevision` mismatch
   rejects the **whole batch, applying nothing**.
6. **The in-Bitwig control layer**, per the Phase-0 E14 verdicts. Target shape:
   revert buttons and a take switcher in the Studio I/O panel, `showInEditor()`
   navigation to what changed, and popup notifications as progress signal (E8
   proved they interleave into a paced batch without stalling it).
   > ⚠ **TWO CORRECTIONS, both from E14/D14 the day after this was written.**
   > (a) There is no **"Studio I/O panel"** — Bitwig 5.0 moved the per-controller
   > surface to a pane opened from the controller icons in the **top right**. The
   > API is untouched; only the drawing moved. (b) **The take switcher is CUT.**
   > The pane cannot be pinned and closes on click-away, so A/B-while-listening
   > does not work there. Phase 1 ships **revert, status and navigation**; take
   > switching goes to Phase 3. See §Session index and
   > [SESSION-4](PHASE-1-SESSION-4-CONTROL-LAYER.md).
7. **Async batch completion** — the deferred-response protocol E8 flagged as an open
   Phase-1 build item, so a paced batch can report *completion* rather than only
   acceptance.

### Out

- Musical vocabulary of any kind — Phase 1 writes the notes it is told to write.
- The web UI (Phase 3). Phase 1's visual surface is Bitwig's own.
- Devices, params, modulators. The engine must be *general* over object classes, but
  Phase 1 only exercises the note class.

## The takes model (D5)

The reframe in `PROJECT_PLAN.md` §3 drives this. Concretely, a take is:

- **Addressed, not positional.** Its content is the prior state of exactly the
  addresses the batch wrote — the §8b stash. This is also the "before" side of
  Phase 3's diff: **one mechanism, two features** (§8f).
- **Branchable.** Reverting to an earlier take and proceeding does not destroy the
  branch you left. "Go back to the sparse hats, keep the new bass" must be
  expressible.
- **Fidelity-labelled.** Exact for notes and scalar params; low for structural
  create/delete and anything without readback. A take must carry *what it can and
  cannot restore*, so a revert never silently under-delivers.
- **Snapshot of what was read, never what was requested.** E8's note-adjacency
  finding: consecutive same-pitch notes truncate each other, so a written duration
  is not guaranteed to survive. Readback is the source of truth, everywhere.
- **Human-owned.** The agent may read and explain the log; it may never mutate it
  (§8g, standing rule 8).

## Decisions this phase must make

> ⚠ 2026-08-07: mostly DECIDED since this was written — schema/retention retired
> with the store (D17 rev), identity closed (D16a), daemon lifecycle mooted (D4
> rev), partial-revert granularity closed (D17d, survives over the stash). Still
> live: **what happens when the user edits inside the write-set** (detection over
> resolution — the launcher-content epoch is the detector now), plus §Re-plan's
> new-decisions list.
>
> ⚠⚠ 2026-08-08, session 3: **the last one is ANSWERED and built.** "Surface it,
> don't guess" resolves concretely to `ApplyReport.concurrent` /
> `ApplyReport.undecidable` on the executor and to the `moved` / `undecidable`
> boundary verdicts on the stash — a detector that reports and never refuses.
> ⚠ The sharpest part is what it reaches that nothing else could: an edit in a
> slot the batch never addressed, and a clip REPLACED by an identical one, which
> every content comparison in the system reads as unchanged. See
> [SESSION-3](PHASE-1-SESSION-3-DAEMON.md) §Re-scope and §Decisions proposed by
> session 3 above (rule 10: proposed, not recorded).

- **Take store schema and retention.** Depth, pruning, and whether takes survive
  project close. `getDocumentState()` settings persist in the project document —
  which makes the *active take pointer* a natural project-scoped value even though
  take *contents* live in the daemon's store.
- **Stable identity for clips, scenes and devices.** Open question from E2f. Tracks
  are solved; slots are addressed within a track and scene indices compact under
  deletion (E3). Decide the addressing scheme for the rest, or decide that
  track+slot re-resolution is sufficient and scene ops always force a re-point.
- **Daemon lifecycle.** Spawn-on-demand vs. login agent; what happens to in-flight
  state when Bitwig restarts or the project changes.
- **Partial-revert granularity.** By track, clip, time range, pitch range, or
  arbitrary write-set subset. Cheapest useful answer first.
- **What happens when the user edits inside the write-set after the agent wrote.**
  The revision guard catches the *ordering* case; a stale take is a different
  problem. Detection matters more than resolution here — surface it, don't guess.

## Exit criteria

1. A patch of N note ops **applies, verifies by readback, and reverts losslessly**,
   with the revert proven by a full property round-trip across all 21 expression
   properties.
2. It does so **while the user is actively editing** — the E8b test, re-run as a
   standing regression: writes land on the pinned target through concurrent
   selection changes.
3. A stale-revision batch is **rejected whole**, applying zero ops.
4. **Two takes can be A/B compared and switched between from inside Bitwig**, with
   no terminal and no web UI.
   > ⚠ **RELAXED 2026-07-25 — this criterion MOVED TO PHASE 3, it did not pass.**
   > D14 measured the pane closing on click-away, which makes A/B-while-listening
   > unworkable there. Phase 1 proves the **store-side** half headlessly (two takes
   > exist, are distinguishable, switchable through the daemon API); the human
   > workflow is unproven until Phase 3. Full reasoning in §Session index.
   > ⚠⚠ **UN-RELAXED 2026-08-07 (D14 rev, D18) — the criterion is BACK, in
   > Bitwig-native form**: two takes A/B'd from inside Bitwig via chain solo (one
   > exclusive flag) or clip launch (beat-aligned, answering E16m), no ghostnote
   > UI involved. See §Re-plan session 5.
5. A project larger than the bank window causes a **loud, explicit refusal**, never
   a partial operation.
6. The whole pipeline is exercised offline against the Phase-0 fake in CI.

## Risks

- **Take branching is more design than expected.** It is a graph, not a stack, and
  the temptation is to over-model. Mitigation: the concrete requirement is A/B
  comparison and partial revert — build exactly that, resist a general VCS.
- **Daemon lifecycle bugs are the classic time sink** (stale sockets, orphaned
  processes, two daemons racing). Mitigation: the extension's revision counter is
  already the cross-process arbiter of ordering (E8); lean on it rather than
  inventing daemon-side locking.
- **The control layer depends on E14.** If the Studio I/O panel disappoints, exit
  criterion 4 needs another home — pulling Phase 3 forward is the fallback, which is
  why the seam is named in `PROJECT_PLAN.md` §5.
- **Fidelity labelling gets skipped** under time pressure, and a later phase reverts
  a device insert believing it was exact. Mitigation: the label is part of the take
  schema from the first write, not an addition.

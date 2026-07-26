---
title: ghostnote — Decisions (evidence-backed)
status: COMPLETE for Phase 0 — modulator authoring settled (D1–D3, E10–E13); project
        topology settled (D4/D5); the spike-wide consolidation SPIKE_PLAN §5 owed is
        now D6–D15 (2026-07-25), which also carries the Phase-1 control-layer decision
        (D14) and the verification discipline the E15 arc produced (D15).
        E14 rows H/I closed D14 on three independent surfaces and amended D7's
        pre-allocation rule to cover graphics.
        D16 (2026-07-26) carries Phase 1 session 1: the executor, the write-set, and
        what a revert does about gain, pressure and structural ops.
        D17 (2026-07-26) carries Phase 1 session 2: the take store — what a take is on
        disk, how branching works, and who wins when the store and the project disagree.
        ⚠ D17 §b and §c are PROVISIONAL: the branches-as-duplicated-tracks proposal
        (context/spike/SPIKE-E16-BRANCHES-AS-TRACKS.md) would change the branching
        topology they describe. Unmeasured; nothing recorded until E16 rows A–C return.
updated: 2026-07-26
evidence: context/spike/FINDINGS.md (E-numbers), BWFORMAT_SPEC.md, BWMOD_DESIGN.md
plan: context/PROJECT_PLAN.md + context/plan/PHASE-*.md
---

# ghostnote — DECISIONS

> Each decision cites the FINDINGS experiment(s) that settled it. D1–D3 are the
> **modulator-authoring** arc (E10–E13, the differentiator); D4/D5 are topology and
> checkpoints; **D6–D15** are the spike-wide consolidation; **D16 and D17** are the
> build decisions, from Phase 1 sessions 1 and 2.
>
> ⚠ Where a later entry corrects an earlier one, the earlier text is KEPT with the
> correction quoted inline rather than rewritten. The retraction is usually the
> more useful record — see D2's dead "tier 3", D4's Studio I/O panel, and the E15-C
> retraction behind D15.

---

## D1 — Modulator topology is authored by template-time `.bwpreset` file surgery **[SETTLED]**

The agent constructs modulator topology (add / replace / retarget / delete, any
type, any category) by **byte-editing a `.bwpreset` template** and loading it via
`device.insertFile`; runtime then *drives* what exists (remote-control pages,
amount→0 to disable). There is **no runtime modulator create/route API** (E7 ○).

- **Files are the unit; templates ship as build-time assets** — `insertFile` takes any
  absolute path, the Library is not involved, and the file can be deleted after load
  with no effect (E4h). ⚠ absolute paths only; `.bwpreset` extension required.
- **Format is readable** — `.bwpreset` is encoding `0002` (plain TLV); modulator
  *instances* live in the plain object stream, not the opaque `0004` DSP blobs
  (E10-FindingA). The `.bwdevice`/`.bwmodulator` `0004` files are a dead end.
- **Durable + first-class** — a surgically-authored modulator survives project **save
  → Bitwig restart → reopen**; Bitwig re-serialises it on save and re-parses it cleanly
  (E11g). Not a load-time illusion.
- **Verified end-to-end**: shape from a template → identity by GUID substitution (E4f/
  E4g) → params via the API. "Boring setup" is solved by a curated template library.

**Retires** the E7 Finding-H *slot-bank* as the **default** authoring model (it remains
the right shape only for the Tier-2 case, D2). Recorded per handoff exit criteria.

### The recipe & load invariants (the correctness spec for `bwmod`)
1. **Object bounds MUST snap to the list SENTINEL** — the `0x1a46` modulator list ends
   with an empty `cls 0x0003` sentinel `00 00 00 03 00 00 00 00` (NOT a bare classId 0).
   A diff/insert-derived bound can land 2 bytes into the sentinel and corrupt it →
   whole-preset reject; the error is **alignment-dependent** (it manufactured the false
   "Zebra wall"). End objects at, and insert before, the sentinel. **[E11h — the key
   discovery of this session]**
2. **`0x1a1b` instance id unique** across modulators — the one proven load gate (E10f).
   Need not be contiguous/zero-based (E11a); the `0x02b9` name is cosmetic (E11b);
   same-type duplicates (shared `0x18c6` type-guid, duplicate meta ref) are fine (E11f).
   No embedded-id "freshening" beyond the unique `0x1a1b`.
3. **Meta `referenced_modulator_ids`** = the ordered set of modulator `0x18c6` GUIDs;
   count correct (E10c/E10f). Patch header **`f4`** by the meta byte-delta.
4. **`f6`** (when present) = absolute offset of an embedded DEFLATE-ZIP plugin-state
   blob; re-point it (locate `PK\x03\x04`) after any stream-size change (E11i).
5. **Every edit MUST be verified by live load + remote-page readback** — a bad Ramona
   route path is a *silent* no-op (loads, no modulation, E10b); `validate()` is
   necessary but not sufficient.

### Routing
- Retarget = rewrite the `0x0e3d` Ramona path (any length; stream-only, no meta/f4)
  (E10/E10b). Proven load-safe on every host including plugins.
- **Cross-device routing** works from a **container** modulator (Chain / Instrument-
  or FX-Layer) into a nested device, and is synthesizable + live (E11e). Path form:
  `CONTENTS/DEVICE_CHAIN/<Container>/DEVICE_CHAIN/<idx>:CONTENTS/<PARAM>`. Simple
  (non-container) devices cannot cross-route. Target set is **arbitrary within the
  container**, via the ordinary retarget primitive (no new op).

---

## D2 — Host capability tiers **[Tier 1 SETTLED; Tier 2 = "Tier 1 + stub relocation", SETTLED by E12]**

Gate on **whether the preset embeds a sample / bulk blob**, NOT on device class, and
**never** on plugin opaqueness. The gate decides only *whether the relocation step
runs* — NOT *whether an op is possible*. Every op is possible on every tier. Always
confirm a new host/preset with a live load test.

- **Tier 1 — fully general** (plain recipe, all ops incl. NEW-type introduction):
  native instruments/FX (Polysynth, Delay+), CLAP plugins (Repro-5), **VST3 + CLAP
  plugins (Zebra 3)**, and a **sample-less Sampler**. A plugin's own opaque state
  (Zebra's DEFLATE-ZIP `plugin-states/…`) does **not** mirror modulator topology —
  swapping a 0-mod blob under a 1-mod stream still loads (E11i-corrected).
  > ⚠ The original E11i "opaque-topology mirror / tier-3" claim was a test bug (the
  > E11h sentinel corruption). There is **no tier-3**; do not reintroduce it.
- **Tier 2 — count-stub relocation** *(SETTLED, E12)*: a preset that **embeds a sample**
  carries sample state with **count-field lists** (field ids `0x129c`, `0x1422`; type
  `0x12`). Each list holds one or more **class-1 reference stubs** — `classId(BE u32)=1`
  then a **BIG-ENDIAN u32 object-index payload** — and ends with the empty class-3
  sentinel `00 00 00 03 00 00 00 00`. Each stub points at an object AFTER the modulator
  list, so an add/delete/replace shifts it by the modulator subtree's **object
  footprint**. **Rule: relocate EVERY class-1 stub in EVERY count list by
  `(inserted − removed) footprint`** (walk items to the sentinel; do not stop after the
  first — multisample has more stubs). Footprint is **donor-specific** (LFO=`0x10`,
  native Sampler Random=`0x0d`, Polysynth Random donor=`0x0b`) — store it per curated
  donor asset. Base is constant across samples (need only deltas).
  > ⚠ **CORRECTS E11d / the earlier Tier-2 text.** There is **no per-type mirrored
  > state** and **no new-type block** — both were test artifacts: E11d only ever swept
  > `±0x10` (but each type has its own footprint; Random is `+0x0b`), and the "count is
  > two LE u32s" read was a single-byte coincidence (payload is BE, and there can be >2
  > stubs). With correct footprint + complete relocation, add (any/NEW type),
  > replace/type-swap, delete, and slot-bank-at-scale all LOAD and are LIVE — on
  > single-sample AND multisample (E12a–E12e). The E7 Finding-H slot-bank is fully
  > surgery-reachable on a sampled preset (no human authoring needed).

---

## D3 — `bwmod` library shape **[SETTLED and BUILT 2026-07-24 — `brain/src/bwmod/`]**

TypeScript, brain-side, buffer-in/buffer-out immutable; Python `tools/bwformat/*.py`
stays as the reference oracle. Editors: `retarget`, `setAmount`, `replaceModulator`,
`addModulator`, `deleteModulator`; a `validate()` that checks D1's invariants (sentinel
integrity first — the top cause of silent reject) before paying an `insertFile`. Golden
test: reconstructing `mp_one_lfo` from `mp_bare` is byte-identical to the real file
(E10f); the sampled analogue reconstructs `gn_sampler_one_lfo`/`one_random` from
`gn_sampler_bare` byte-identical modulo name + per-save GUIDs and loads live (E12c).
Full details + test matrix in BWMOD_DESIGN.md (updated with the sentinel rule and the
Tier-2 **stub-relocation** handling — every class-1 stub in every count list, BE payloads,
`(inserted−removed) footprint`; port source `tools/bwformat/build_e12d2_cases.py`).
2026-07-24 sync: the TS-port-with-Python-oracle choice is now CALLED in the design doc;
the `f6` re-point rule (D1 invariant 4) is folded into its editor invariants, `validate()`,
and test matrix (U-f6); `DonorObject` carries per-donor `footprint` as curated metadata.

**BUILT 2026-07-24 (E13).** `brain/src/bwmod/` ships all five editors, `validate()`, the
readers, and a curated donor library (`brain/assets/modulators/`, footprint + provenance
per donor). `cd brain && npm test` runs 42 offline tests — including four byte-identical
golden reconstructions and a byte-for-byte cross-check against `tools/bwformat` — and
`npx tsx src/probes/e13-bwmod.ts` runs 12 live cases against Bitwig 6.0.6, each verified by
remote-page readback, with I-dup-neg confirming the reject guard. The Python stays as the
reference + oracle; the product has no Python dependency. Fixtures are vendored under
`brain/fixtures/` so the offline half runs in CI. Three build-time refinements are worth
carrying (details in BWMOD_DESIGN §8, evidence in FINDINGS E13):
- a **container preset holds one `0x1a46` list per nested device**, so the editors refuse
  to act without an explicit `listIndex` rather than silently rewriting the wrong device;
- the **removed** side of the Tier-2 footprint delta needs an explicit `removedFootprint`
  unless the resident object matches a curated donor byte-for-byte — GUID equality is not
  enough, since footprint belongs to the object, not the type;
- **unmeasured footprints ship as `null`** and are refused on a sampled preset, never
  guessed (a wrong delta is a silent whole-preset reject).

### Carry-forward

**Modulator authoring is a template-time file-surgery capability with a single load
invariant — a unique `0x1a1b` per modulator — and it is verified by readback, not by
inspection.** `validate()` is the cheap offline gate that predicts a LOAD; only a live
load plus a remote-page readback proves the modulation is actually live (a wrong Ramona
path passes every offline check and does nothing, E10b). Workstream B builds on
`bwmod` + a curated template/donor library; it does not need any further format work.

---

## Sampler (Tier-2) scrutiny — RESOLVED by E12 (2026-07-24)

The Tier-2 residual is closed: **the "new-type wall" was never real** (see D2 and
FINDINGS E12). The five open questions are now answered:

1. **Count-field completeness / multisample — ANSWERED.** The count fields are `0x12`
   **lists** of class-1 object-reference stubs, sentinel-terminated; a multisample has
   MORE stubs (measured 4 vs 2). Rule: relocate EVERY stub in EVERY list. Verified live
   on `gn_sampler_multi_*` (E12d).
2. **Base constant — ANSWERED (yes).** `gn_sampler2_*` (different sample) has the same
   base and behaves identically; `bwmod` needs only deltas (E12d).
3. **New-type block — ANSWERED: it does not exist.** It was a wrong-delta artifact
   (E11d swept only `±0x10`; each donor has its own footprint, Random=`+0x0b`). New-type
   add, type-swap, and ≥2-type slot-bank surgery at scale all LOAD live (E12a/E12c/E12e).
4. **Sample-load recombination — ANSWERED (E12f).** Authored LFO+Random on a
   sample-LESS Sampler, dragged a sample in the UI, saved → Bitwig kept both modulators
   AND materialised the count stubs at **exactly** our predicted values (base + LFO 0x10
   + Random 0x0d = 0x36/0x37); the result reloads live. ⇒ the "author sample-less, then
   add the sample in the UI" workflow yields a consistent preset carrying BOTH — and
   Bitwig computes the stubs with the same footprints we reverse-engineered (independent
   validation of the model).
5. **Other embedded-bulk devices** (convolution IR, wavetable/Grid, nested containers)
   — same stub-relocation pattern expected; lower priority, still untested. The heuristic
   is now "find & relocate the reference stubs", not "give up".

- **Do NOT re-suspect plugin opaque state** (VST3/CLAP) — settled Tier-1 (E11i-corrected).

---

## D4 — Process topology and the human surface **[SETTLED 2026-07-24]**

**`ghostnoted` (a long-lived daemon) owns session state; the MCP server is one of its
clients; the human's controls live in Bitwig first and a local web view later. There
is no custom chat harness.**

INITIAL_PROMPT §2 assumed "the TypeScript process is both the MCP server and the
brain." That does not survive contact with §8g: an MCP stdio server is a subprocess of
the chat client, so in-memory checkpoints die with the session, and *every channel into
that process is a channel the agent can also use* — leaving revert-as-a-human-verb
nowhere to live.

- **The daemon owns** the single bridge connection, the take store, the change log,
  and (uniquely) any Bitwig **observers** — which is what lets the change log
  distinguish agent edits from the user's own concurrent edits (§8d assumes the user
  is editing while the agent writes).
- **All writes go through the daemon.** The extension-side revision counter (E8)
  arbitrates *ordering* across processes, but cannot detect *omission* — a bypassing
  write leaves a silent gap in the take log.
- **The human surface is Bitwig's Studio I/O panel** (`host.getDocumentState()`,
  API v1): Signal buttons, an Enum that renders as a button group at small option
  counts, String/Number/Boolean widgets, `show()/hide()/enable()/disable()` at
  runtime, and values that are both writable (push state) and observable (pull
  intent) — **persisted inside the project document**. Nothing there is reachable over
  the bridge, so §8g's privilege separation becomes structural rather than policy.
  > ⚠ **PROBED 2026-07-25 — D14 SUPERSEDES THIS BULLET.** E14 confirmed every
  > capability listed, and found the button group works at **12** options rather
  > than only "small counts". It corrected three things this text gets wrong:
  > **(1) the panel MOVED.** Bitwig 5.0 relocated the per-controller surface to a
  > pane opened from controller icons in the **top right of the window**, and
  > renamed the old panel ("Studio Monitoring Panel" in 6.0.6) — which no longer
  > lists controllers at all. The API is untouched; only the drawing moved.
  > **(2) "nothing there is reachable over the bridge" understates it.** Bitwig
  > REFUSES `Signal.fire()` outright, so the separation is API-enforced rather
  > than a consequence of which wire methods we choose to register.
  > **(3) the pane cannot be pinned** and closes on click-away, making it a poor
  > home for A/B take switching during listening; that moves to the Phase-3 web
  > view. Revert and other deliberate one-shots stay here and work well.
- **A local web view (Phase 3) adds only what Bitwig cannot do:** before/after
  comparison, cross-object change summaries, take navigation, partial revert.
  `ClipLauncherSlot.showInEditor()` + `Application.zoomToFit()` already handle "show
  me what changed" using Bitwig's own piano roll, which is better than anything we
  would render.
- **A custom chat harness is ruled out**, not deferred. Embedding the agent loop in a
  bespoke app means building streaming, tool-call rendering, session persistence and
  model configuration — none of it musical, all of it ongoing maintenance.

*Adjacent correction to E3:* `deleteObjects(String undoName, …)` (API 10) and
`duplicateObjects(String undoName, …)` (API 19) are documented as acting "within one
undo step" with a caller-supplied name — so E3's "no grouping hook in the API" is too
strong. It does **not** rescue native undo (note and param writes remain ungrouped and
the stack is still project-global, so snapshot-replay revert stands unchanged), but it
means our bulk deletes can appear as one named entry in the user's history.
> ● **CONFIRMED (E14-G).** Three clips deleted by one call; **one** undo restored
> all three; the history entry read `"ghostnote E14 batch delete"`. Same for
> `duplicateObjects`. Both are on `ControllerHost`, not `Application`, and take
> `DeleteableObject…` / `DuplicableObject…` rather than `ObjectProxy`.

## D5 — Checkpoints are branchable takes, not a linear undo stack **[SETTLED 2026-07-24]**

**A batch creates a named, addressable *take* that can be compared, jumped between and
partially reverted. Reverting to an earlier take and proceeding does not destroy the
branch left behind.**

The reasoning is musical, not technical. Cursor's loop is *preview → accept → apply*,
and once you accept, the old version is worthless. Music inverts both halves:

1. **You evaluate by listening, so application must precede judgment.** Given "Bitwig
   is the only sound surface" (§2), optimistic apply is not a compromise tolerated for
   ergonomics — it is the only preview mechanism that exists. The UI's job is not to
   help you decide *before*; it is to make comparing and undoing trivial *after*.
2. **The previous version is not disposable.** "That take had a better hi-hat" is the
   normal case. A/B comparison is the core verb; accept/reject is the wrong primitive.

Consequences for the store (built in Phase 1):
- Take content is the §8b stash — the prior state of exactly the addresses written —
  which is also the "before" side of the Phase-3 diff. **One mechanism, two features**
  (§8f).
- **Partial revert is sliced by musical address** ("keep the hats, revert the snare").
  The write-set is already addressed, so this is nearly free.
- **Every take carries a fidelity label** — exact for notes and scalar params, low for
  structural create/delete and anything without readback — so a revert never silently
  under-delivers.
- **A take stores what readback reported, never what was requested** (E8: consecutive
  same-pitch notes truncate each other, so a written duration may not survive).
- **Human-owned.** The agent may read and explain the log; it may never mutate it.

---

## D6 — Addressing: pinned non-following cursors, identity never index **[SETTLED 2026-07-25]**

**Address by durable identity through a pool of pre-allocated, non-following cursor
tracks, each owning a `PinnableCursorClip`. Never store or send a bank index that
outlives the request that resolved it.**

- **`channelId` (UUID) is the durable track key** (E2f). It is minted fresh on
  create, so a delete-and-recreate is a DIFFERENT track — which is correct, and is
  why a stash cannot be replayed onto a recreated track by name.
- **Pointing mechanism is `trackThenSlot`** — `cursorTrack.selectChannel(track)`
  then `track.selectSlot(s)` — the only one of three candidates that works (E1).
  Settle is ~25ms and **verifiable by polling** `position()` + `sceneIndex()`,
  which replaces daw-mcp's blind 400ms sleep.
- **Cursor pools are non-following BY CONSTRUCTION** (`shouldFollowSelection=false`
  at creation); pinning is belt-and-suspenders on top (E1). 3 cursors held 3
  different clips concurrently, and 20/20 write+readback cycles stayed correct
  through continuous user clicking (27 selection changes observed).
- **Re-point after ANY structural op.** A held pin's `sceneIndex` goes permanently
  stale after scene compaction (E3), and bank indices drift under create/delete.
- ⚠ **Pointing STEALS the user's clip selection** (E1, measured E14-F1). It can be
  saved and restored around a batch, restoring does not disturb the pool cursor,
  and a whole batch costs exactly ONE observable selection change — so one restore
  at the end suffices (E14-F2/F3/F4). **Phase 1 owes that restore.**
- ⚠ **Pointing at an EMPTY slot silently lands on the WRONG clip** and
  `cursor.status` looks healthy (E2). Create the clip first, always.
- **Bank-window overflow is a refusal, not a knob** (E5, standing rule 5).
  `TrackBank.itemCount()` reports the PROJECT total, not the window (E15-A) —
  which is what makes the rule implementable at all; before it, "16 tracks exist"
  and "16 of 54 are visible" were indistinguishable from the extension side.

## D7 — Pre-allocation scaffold sizes **[SETTLED 2026-07-25]**

**Ship `TRACKS=256, SCENES=128, CURSOR_POOL=8, DEVICE_BANK=16, paramHandles=64`,
all config-tunable via `~/.ghostnote/rig.json`.** E5 found **no knee below 65 536
slots** (512×128 = 81ms init) and latency flat at the ~24ms control-surface tick
floor in every configuration, loaded or empty. Cold init was 108ms inside a 13.4s
Bitwig launch; project-open cost was below measurement resolution.

**The binding constraint is not performance — it is the bank window** (D6). Scale
therefore bounds maximum project size, which is a correctness limit rather than a
tuning preference.

⚠ **Init-time allocation is not merely a convention, it is enforced.** E14-C2:
`getDocumentState()` settings cannot be created after `init()` — *"This can only be
called during driver initialization"*. INITIAL_PROMPT §3a's first structural
constraint is confirmed for the settings surface too, so **anything the human
surface will ever show must exist at init and be revealed with `show()`**
(`RigConfig.uiSlots`, default 16; the panel is "fine" at that size, E14-C4).

⚠ **AMENDED 2026-07-25 (E14-I5): graphics allocation is init-only too, and it
refuses with the SAME SENTENCE.** `host.createBitmap` after `init()` returns
*"This can only be called during driver initialization"* — verbatim E14-C2's
refusal, from an unrelated subsystem. That makes §3a's pre-allocation idiom its
**fourth** independent occurrence (cursor pools E1, device/param handles E5,
settings E14-C2, graphics E14-I5), and it is now the DEFAULT ASSUMPTION for any
Bitwig resource rather than a per-subsystem discovery. **Anything Phase 3 will
ever draw into must be allocated at init.** The refusal is clean, synchronous and
catchable — the good failure mode, and the opposite of E14-A1.

## D8 — Checkpoint fidelity, measured **[SETTLED 2026-07-25]**

Replaces the ◐/guess columns of INITIAL_PROMPT §4/§5/§6. **A take stores what
readback REPORTED, never what was requested** (D5).

| object | fidelity | evidence |
|---|---|---|
| clip notes — identity (start, pitch, velocity, duration) | **exact** | E2, and `setStep`→`getStep` round-trips |
| note expression, 16 of 18 properties | **exact** | E15-E swept them one at a time |
| note `gain` | **lossy** — reads back 2× written | E2; the inverse is unverified, so it is labelled, never corrected |
| note `pressure` | **UNWRITABLE — refused** | E15-E |
| scalar device params | exact | E4/E4b |
| clip / track / scene / device create-delete | **low / none** | E3 — no readback that could recreate them |
| anything via a named action | **none** | E6 — and banned outright (D13) |

⚠ **Two traps make readback ≠ request even for notes.** Consecutive same-pitch
notes truncate each other, so a written duration may not survive (E8-E). And a
note's properties cannot ride the request that creates it — they are silently
discarded (E15-B).

## D9 — Grid and units **[SETTLED 2026-07-25]**

**Beats-native everywhere; the step grid is a per-operation view, not global
state** (standing rule 12, correcting daw-mcp's design). The beats↔step conversion
happens in the live encoder and nowhere else.

- **Choose the COARSEST grid on which every start and duration is exact.** Not an
  optimization: E2 found off-grid notes are reported snapped DOWN (beat 0.09375
  scans as x=0 on a 0.25 grid), so a lossy grid choice corrupts a snapshot
  silently. Finer than the 1/64-beat floor is REFUSED.
- ⚠ **A grid change invalidates the cursor's step data for ~120ms**, and any
  `getStep` in that window returns something unusable — 0 of 3 properties landed
  at gaps of 0/24/48/72/96ms, 3 of 3 at 120/144/192/288ms (E15-D). Hence the
  `gridChange` budget of 144ms and `OP_SETTLE_BEFORE`.
- ⚠ **Two ops that must agree about the grid MUST hold the same note set.** A
  generated `note.props` carries its create's WHOLE note set for exactly this
  reason; filtering it made the props stage coarser and lost every property
  (E15-F). `stepSizeFor` therefore lives in the contract, not the encoder, so both
  adapters and the stage planner can ask the same question.

## D10 — Batch execution mechanics **[SETTLED 2026-07-25]**

**One request carries N ops; the brain partitions them into stages by declared
settle class and awaits a settle between stages. There is no `delayMs` knob,
because a caller cannot get pacing wrong if pacing is not expressible.**

- **The batch is the unit** (standing rule 4). E8 measured 240 note writes at 25ms
  as one batch versus 5804ms as separate RPCs — **232×**. Every `instant` op shares
  stage 0.
- **Settle budgets are NAMES with measured values**: `tick` 24ms, `noteWrite` 25,
  `gridChange` 144, `trackStruct` 144, `insertFile` 268, `paramsLive` 194,
  `deviceInsert` 600. Where a readback exists, poll instead of waiting.
- **`OP_SETTLE_BEFORE` is the mirror of `OP_SETTLE`** and is not interchangeable
  with it: it guards an op that READS state an earlier stage invalidated, which no
  amount of waiting afterwards can repair (E15-D).
- **The revision counter lives extension-side** (E8). A stale `ifRevision` rejects
  the batch WHOLE, applying zero ops. It guards ORDERING across processes but
  cannot detect OMISSION — hence standing rule 7, all writes through the daemon.
- ⚠ **All-or-nothing holds WITHIN a stage, not across stages.** A later stage can
  fail after an earlier one landed, and the receipt says which. Phase 1 replaces
  the implementation with one paced call plus a completion frame once deferred
  responses exist; the `Stage` shape and `stages[]` receipt survive that change.
- ⚠ **`note.props` must NOT be hoisted or coalesced across clips.** It resolves
  its note against the clip the cursor held at TURN START, so a props op that
  re-points loses everything, silently (E15-F). Interleaving write-then-props
  per clip is what makes the shipped plan correct. Cost: N clips with expression
  pay 2N stages and N × `gridChange`. **That is the price of correctness**, and
  the optimization was rejected with evidence rather than deferred.
- **Progress UX is free**: interleave `notify` ops into a batch (E8-C).

## D11 — Toolchain **[SETTLED 2026-07-25]**

**`extension-api:25` compiled to Java 21 bytecode, Gradle with `options.release`
(NOT a toolchain block), Node 24 + TypeScript, no runtime Python.**

- Bitwig 6.0.6 bundles a Java 25 JVM; targeting **21 (LTS)** gives headroom and
  builds on any JDK ≥ 21 (developed on Temurin 26). A `java { toolchain }` block
  would pin an exact JDK and force a provisioning download or fail — `release`
  guarantees the property that matters, which is 21-compatible bytecode.
- **Reproducible archives** (`preserveFileTimestamps = false`,
  `reproducibleFileOrder = true`): without them two builds of identical source
  differ byte-for-byte.
- **Java, not Kotlin** — every reference codebase is Java, and copy-paste parity
  was worth more than ergonomics during verification (SPIKE_PLAN §2.2). Revisit
  freely; nothing depends on it.
- **Python (`tools/bwformat/*.py`) is a CI ORACLE only** (D3). The product has no
  Python dependency; `GHOSTNOTE_REQUIRE_ORACLE=1` makes it mandatory in CI and the
  pre-commit hook.
- **`init()` is a hazard surface.** Check `@Deprecated` before wiring any handle
  there — `getModulationSource(int)` throws and takes the whole extension down
  (E7-Finding-0, standing rule 9). `npm run probe:hello` is the first thing run
  after any deploy.

## D12 — Transport and the contract boundary **[SETTLED 2026-07-25]**

**The brain speaks the versioned adapter contract; a thin encoder translates to
JSON-RPC 2.0 `category.action` over newline-framed TCP on 127.0.0.1:8686. The wire
frame is an implementation detail, not the interface.**

- Confirmed working end to end (E0), and the MCP SDK sits cleanly on `client.ts`
  with no surprises (E9).
- **The contract is the seam, not the wire** (SPIKE_PLAN §2.4, PHASE-0 §Scope 2).
  The proof is structural: the fake adapter implements the same contract and never
  speaks the wire at all. `WIRE` constants live in exactly one module.
- **Capabilities are DATA VARIANTS, not methods.** One write method (`apply`)
  taking an `Op` union; adding a capability adds a variant and the adapter
  interface never grows. Beat Twin abandoned a 57-tool surface learning this.
- **Versioned by exact equality** (`ghostnote/0`), plus a `methodsHash` over the
  sorted wire-method list so a drifted deployment is caught at connect rather than
  at the first failing write. No range negotiation — nobody ships two adapters at
  once and range logic is the over-engineering trap here.
- ⚠ **The socket is unauthenticated.** The gate is the daemon; the socket is the
  soft underbelly (INITIAL_PROMPT §8j, inherited from Beat Twin). Firewall it; do
  not mistake policy for a boundary.

## D13 — There is no escape hatch **[SETTLED 2026-07-19, E6]**

**ghostnote uses NO named actions. Ever.** (Standing rule 6.) 781 actions
enumerate and `invoke()` is unusable *and* hazardous: global actions fire only
with Bitwig foregrounded (backgrounded = silent no-op while the typed API keeps
working), editing actions need panel keyboard focus the API cannot set, the return
is `void` with zero readback, and they operate on the UI selection **our own
addressing sets** — foreground `Duplicate` duplicated the gn-A fixture **7×**
before the mechanism was understood.

The typed API plus D1's file surgery is the entire toolbox. The residual gap
(track Group/Ungroup, wrap/unwrap) is an accepted minor omission.

**`app.invokeAction`, `app.actions`, `app.undo`, `app.redo` and `app.undoState`
stay REGISTERED but banned** — `WIRE_METHODS_BANNED`, asserted unreachable from
the contract — because the probes that established the bans are the live
regression suite.

⚠ **A second, harsher class exists: `WIRE_METHODS_FORBIDDEN`, which must not be
registered at all.** `ui.signalFire` is its only member: it crashes Bitwig
(E14-A1), so a registration is a loaded gun regardless of reachability.

## D14 — The human control layer **[SETTLED 2026-07-25, E14 rows A–I]**

**Bitwig's per-controller pane hosts the deliberate verbs (revert, status, slot
reveal). Take switching moves to the Phase-3 web view. §8g's privilege separation
is API-ENFORCED, not policy.**

This is the Phase-1 control-layer decision PHASE-0 exit criterion 3 requires.
D4's substance survived; three of its specifics did not.

- ⚠ **The panel MOVED.** D4 says "Studio I/O panel"; that has been wrong since
  Bitwig **5.0**, which relocated the per-controller surface to a pane opened from
  **controller icons in the top right of the window** and renamed the old panel
  (now "Studio Monitoring Panel" in 6.0.6), which no longer lists controllers at
  all. The API is untouched and still v1 — only where Bitwig draws it moved.
- **What works** (E14): Signal buttons fire on human click; Enum renders as a
  **button group at every count probed, 2–12**; the extension can both push and
  observe; String settings work as a status readout with user edits both detectable
  and repairable; `show`/`hide`/`enable`/`disable` reflow **live**; and document
  state survives save + **full Bitwig restart**, scoped **per project**.
- ⚠ **The pane CANNOT be pinned or docked** — it closes on click-away. Fine for
  revert, a rare deliberate act. Poor for A/B comparison during listening, which
  D5 calls the core verb, since it would mean re-opening a pop-over between every
  comparison. **⇒ take navigation belongs in the Phase-3 web view**, pulled
  forward. PHASE-0 §Risks already names this fallback and calls it a reordering
  rather than a redesign.
- ⚠ **§8g is stronger than D4 claimed.** `Signal.fire()` on a document-state
  setting is REFUSED by Bitwig — only a real human click fires it (E14-A1). So
  "revert is a human verb" is enforced by the API rather than by our restraint,
  and it does not depend on the pane being the take UI. A daemon-served web view
  can own take switching without weakening it, provided the daemon keeps the agent
  off those endpoints.
- **Notification hygiene is a non-issue.** `NotificationSettings`' switches govern
  notifications the CONTROLLER requests, they default off, and ghostnote enables
  none — so pointing produces no spray to suppress. The real E1 wart is selection
  movement, handled in D6.

### ⚠ Confirmed by rows H and I: **Bitwig has no persistent extension-owned window**

D14 was decided on one measurement — the controller pane closes on click-away.
E14's two speculative rows were probed precisely because a persistent surface
would have reopened it. **Both returned ○ on exactly that question**, so the
decision now rests on three independent surfaces agreeing:

| surface | verdict |
|---|---|
| the per-controller pane (rows A–G) | closes on click-away, cannot be pinned or docked |
| `HardwareSurface` simulated GUI (row H) | **closes on click-away** — everything else about it works |
| `Bitmap.showDisplayWindow()` (row I) | **never opens at all** on macOS / Bitwig 6.0.6 |

⚠ **Row H's ○ is narrow and the rest of it is ●**, which is why it is recorded
rather than dismissed: the surface builds, `setBounds` lays it out, lights and
text reach it, an embedded pixel display renders, and **a `HardwareButton` with
no `HardwareActionMatcher` fires on a click** (press and release) even though
`isSupported()` correctly reports `false` — the simulator synthesises actions
directly rather than routing them through a matcher. It is a complete, working,
clickable panel that will not stay on screen. It would also have needed
`extension-dev : true`, a restart and two right-click menus to reach a user, so
it was never shippable regardless.

⚠ **Row I's renderer is ●, and worth keeping in mind for Phase 3.**
`GraphicsOutput` is a competent 2D surface: the default font face needs no
`loadFontFace`, text is cleanly antialiased and readable down to ~10px, béziers
and dashes are smooth, and **alpha compositing works** — which is the before/after
overlay a diff view wants. A warm 640×320 re-render costs ~300µs; `showText` is
the expensive primitive at roughly 1ms a string. **If an in-Bitwig raster panel is
ever wanted, the drawing is solved and only the window is missing.**

⇒ **take navigation stays in the Phase-3 web view**, and the reasoning is no
longer contingent on one pane's behaviour.

## D15 — Verification discipline **[SETTLED 2026-07-25]**

Three rules that each cost a wrong finding or a crash to learn. They are cheap to
follow and expensive to skip.

1. **Readback is the only truth** (standing rule 1). Offline validation is
   necessary, never sufficient — a wrong modulator route passes `validate()` and
   silently does nothing (E10b).
2. **⚠ Verify a write through a DIFFERENT handle than the one that made it**
   (standing rule 3a). Bitwig's cursors cache what you wrote and report it back
   whether or not it landed. **Two findings were wrong for exactly this reason** —
   E15-C was retracted outright and E15-D was misdiagnosed — and E15-E found a
   property that only ever existed in the writing cursor's cache. An independent
   cursor, or the same one after a re-point, is what makes rule 1 actually bite.
3. **⚠ VALIDATE INPUTS BEFORE CALLING; a handler's `try/catch` is not a safety
   net.** An exception Bitwig DEFERS to its own thread escapes every extension
   frame and takes the application down. `Signal.fire()` returned normally and
   threw later on `BitwigStudioMain`'s thread, killing Bitwig with an unsaved
   project open (E14-A1). Compare E7-Finding-0, which crashed the extension at
   init; this is the same hazard class at runtime, one level worse.

**Corollary, and the reason the fake exists:** every trap the fake models cites
the FINDINGS experiment that established it, and each is covered three ways — a
direct model test, a conformance case, and a runnable live probe. A trap that is
always mitigated is a trap whose model can rot undetected, which is why the direct
tests assert the MISBEHAVIOUR rather than the fix.

---

## D16 — The executor: write-set, stash, revert **[SETTLED 2026-07-26, PHASE-1 session 1]**

**The write-set is derived from the ops before execution; the stash is a readback
of exactly those addresses; a revert materialises ops from the stash and reports
everything it could not put back.** Built offline against the Phase-0 fake as
`brain/src/engine/`. Five sub-decisions the session doc owed, each recorded with
what it *rejected*, because in every case the rejected option was the tempting one.

### a. Stable identity for clips, scenes and devices — **track + slot re-resolution**

`PROJECT_PLAN.md` §7's oldest open question, and the answer is that there is no
second durable key and we are not going to invent one. `channelId` solves tracks
(E2f); everything else is `positional` in `ADDRESS_IDENTITY` and stays that way.
A take therefore addresses a clip as *(durable track, scene index, scene epoch)*
and re-resolves at replay time; a scene op forces a re-point and refuses every
address minted before it (E3).

⚠ **Rejected: a synthetic clip id kept in a side table.** It would mean
maintaining a mapping across a DAW we do not control, through user deletes we
cannot observe without the daemon's observers — i.e. a second source of truth
that goes wrong silently, which is the failure class this project exists to
prevent. The cost of the cheap answer is stated rather than hidden: a positional
address in a batch that also moves rows is labelled `lossy`, derived from
`ADDRESS_IDENTITY`, not remembered (`engine/fidelity.ts`).

### b. ⚠ What revert does about `gain` — **WITHHELD and reported, not replayed**

The sharpest trap in the phase. `gain` reads back **2× written** (E2), so a stash
of a note written at 0.7 holds 1.4, and D8 is explicit that *"the inverse is
unverified, so it is labelled, never corrected."*

That settles what the SNAPSHOT stores. It does not settle what a revert *emits*,
and the two obvious readings are both wrong:

| option | failure |
|---|---|
| replay the stashed 1.4 | writes 1.4, reads back 2.8 — and **doubles again on every subsequent revert**. Unbounded, compounding, silent. |
| divide by `GAIN_READ_SCALE` | the guess D8 forbids. A wrong correction makes **every** take restore wrong gain. |
| **withhold and report** ✅ | the property is not restored, and the take says so by name. Bounded, visible, and the user is already in Bitwig's own piano roll where fixing it is one drag. |

**Chosen: withhold.** A bounded visible failure beats an unbounded silent one,
and it is the same treatment `pressure` already gets — which is not a coincidence,
since both mean "we cannot write a value that reads back as the one we captured".

⚠ **This is one edit away from being retired.** `revertOps` withholds every
property whose `NOTE_PROP_FIDELITY` is not `exact`, derived, never named — so a
Phase-1 session-5 probe that measures the inverse flips `gain` to `'exact'` in
`state.ts` and the withholding stops everywhere at once. **Do not hand-code a
correction anywhere else.**

### c. ⚠ What revert does about `pressure` — **stripped, and the take says so**

A human may have authored pressure in a clip we are about to overwrite. Readback
captures it (correctly — it is the record), and `assertOpsWritable` then REFUSES
to replay it (E15-E). So a naive "apply the stash" **throws**, and a revert that
fails because of a property the *user* authored is a worse failure than one that
reports "restored all but pressure". The stash→ops path strips it and names it.

### d. `fidelity: 'none'` entries — **apply what can be applied, report the rest loudly**

D5's "a revert never silently under-delivers" is a constraint on REPORTING, not a
reason to refuse the whole operation. So a batch mixing note writes with a track
delete reverts the notes and reports the track.

Two asymmetries fell out of this and are worth carrying:

- **A clip that did NOT exist has an exact inverse — delete it.** `readOne`
  labels clip existence `none` because a clip's *content* has no readback that
  could recreate it; absence has no content to fail to recreate. So a revert of
  `[clip.create, note.write]` is `[clip.delete]` and is genuinely lossless, where
  a blanket "structural ops are unrevertable" would have made the flagship case
  do nothing.
- **`track.delete` is `none`, `track.create` is `unrevertable`, and they are
  different things.** The first has an address whose stash is meaningless (a
  recreated track mints a new `channelId`, E2f); the second has no prior address
  at all. Both reach the take, by different routes, so neither is silent.
  ⚠ **Un-creating a created track is deliberately NOT offered**, even though
  `receipt.minted` makes it expressible — a human may already have put work in
  it, and D5's rule cuts both ways.

### e. Stash granularity for an unranged `note.write` — **the whole clip channel**

Never a bounding range, even when the op carries one. A write truncates
same-pitch neighbours OUTSIDE its own extent (E8-E), so a bounding-box stash
misses exactly the state the write is about to damage. It is also what session
2's partial revert will SLICE, and slicing a superset is possible where widening
a subset is not.

### Two things the build discovered

- ⚠ **A batch that bumps the scene epoch invalidates its OWN verify read.** Both
  adapters refuse a stale scene epoch, so the post-apply readback of a
  scene-relative address throws — and re-minting the address at the new epoch
  would be precisely the guess E3's epoch exists to prevent. The executor now
  skips those addresses and reports them in `ApplyReport.unverified`, because
  *"no disagreement reported"* must never be mistaken for *"it landed"*. Found by
  a test, not by a live session.
- ⚠ **The fake reported an empty clip where Bitwig reports no clip.** A `notes`
  read on a slot with no content returned `{notes: []}` on the fake and
  `undefined` on live. The executor's E2 guard reads exactly that distinction to
  refuse a write into a never-created slot, so the fake would have passed the
  guard offline and mispointed live — PHASE-0 §Risks' named failure mode, caught
  because the executor was built against the fake first. Fixed, and `C-slot` now
  asserts it on both.

---

## D17 — The take store: persistence, branching, partial revert **[SETTLED 2026-07-26, PHASE-1 session 2 — ⚠ §b and §c PROVISIONAL, see below]**

**A take is a session-1 `Take` plus three facts it cannot know about itself —
project key, parent, label — kept one-file-per-take under `~/.ghostnote/`.
Navigation is a walk of the path between two nodes, materialised through
session 1's `revertOps`; the read half of the API is a separate object from the
mutate half.** Built offline as `brain/src/store/`, 26 tests.

> ⚠ **§b and §c are PROVISIONAL as of 2026-07-26, the day they were written.** A
> proposal to represent branches as **duplicated tracks** —
> [SPIKE-E16](../spike/SPIKE-E16-BRANCHES-AS-TRACKS.md) — would replace the single
> project-wide head these two sections are built on with a head per branch lineage,
> and would make revert-by-deleting-a-track exact for the whole `none`-fidelity
> class that §D16d has to report on instead. **It is entirely unmeasured**: it rests
> on whether a top-level `Track` can be duplicated at all, which nobody has probed
> (standing rule 10). Recorded here rather than in the sections themselves because
> the rest of D17 is unaffected either way — **§a, §d, §e, §f and §g stand
> regardless**, and §e's argument gets *stronger* under the proposal, since a
> project that literally contains its branches is more authoritative about the world,
> not less.

⚠ This session's exit criteria carry unusual weight, and it is worth restating
why: D14 moved take navigation to Phase 3, so **Phase 1 ships a branchable take
store whose motivating verb no human exercises inside the phase**. The tests are
the only thing between a wrong store design and a phase-late discovery, so they
drive real ops through the executor against the fake rather than asserting on the
store's own bookkeeping.

### a. The project key — **a UUID minted into `getDocumentState()`**

E14-A3/A4 already proved the storage: document state survives save + a **full
Bitwig restart** and is scoped **per project**. The key is minted on first write
and reused thereafter.

⚠ **Rejected: a path hash.** Humans rename and move project files constantly, and
each such move would silently orphan the entire take log — the failure would look
exactly like "ghostnote forgot everything", with no signal saying why.

Two consequences stated rather than discovered:
- **The setting is pre-allocated at `init()`**, because settings cannot be created
  later (E14-C2, and D7's amended rule now makes that the default assumption for
  anything Bitwig hands out).
- **An unsaved project still gets a key**, because document state exists in memory
  from the moment it is set — only *persistence* waits for a save. If the human
  then discards the project the log is orphaned and reaped by ordinary retention.
  It is deliberately not specially detected: the only available signal is "this
  key never came back", which is indistinguishable from a project that is merely
  closed.

The key SOURCE is a port (`ProjectKeySource`), because this session is offline by
construction and the real implementation is a bridge call the daemon owns
(session 3). That is also what lets every minting and reconciliation rule be
tested in milliseconds.

⚠ **An unsafe key is REFUSED, never sanitized** — it names a directory, and a
munged key could collide with another project and merge two humans' take logs.
Same class of silent aliasing D6 outlaws for tracks.

### b. ⚠ Branching — **a path walk, not "restore the target take's write-set"** *(PROVISIONAL — E16)*

The cheap version is wrong the moment two takes touch different things, which is
the normal case: with the head at T2 (wrote bass), jumping to T1 (wrote hats)
would leave T2's bass in place and call it "the state at T1". The walk costs about
thirty lines and is actually true:

- takes between the head and the common ancestor are **unwound**, and the value
  that wins for an address is the **oldest stash** on that arm;
- takes from the common ancestor to the target are **replayed**, and the value
  that wins is the **newest verify**;
- the replay arm overrides the unwind arm, because the target's own history is
  authoritative about the target's state.

Those three sentences are the entire branching model. The output is a
`RevertInput`, so session 1's `revertOps` materialises the ops and a jump, a
revert and a partial revert are **one code path** that cannot disagree about what
restoring an address means. **There is no merge, no conflict resolution and no
three-way anything** — the §Risks tripwire ("if a merge operation appears in the
design, something has gone wrong") is intact.

The same walk run with its arms swapped produces the **diff** Phase 3 renders.
§8f's "one mechanism, two features", a second time.

⚠ **What E16 would change, and what it would not.** The walk itself is likely to
survive: `stateAlong` operates over addresses, so partitioning takes per track
makes the graph a *forest* and the same walk runs over each disconnected
component. What changes is that "the project state at take N" stops existing —
there would be a head per lineage rather than one head. That is a change to the
abstraction, not obviously to the algorithm, and confirming it is cheap.

### c. ⚠ Navigation moves the HEAD; it does not append a take *(PROVISIONAL — E16)*

The single sharpest correctness trap in the session, and it is not obvious.
Session 1 established that "a revert IS a take" — true at the executor level,
which has no store to consult. But recording a navigation as a take would put a
step in the log whose only content is the undoing of another step, and **the next
jump would undo the undo**, re-applying the very change the human just walked away
from. Compounding, and silent.

So the store labels every plan:

| `plan.lands` | when | what the caller does |
|---|---|---|
| `take` | the world ends up exactly on an existing take | **move the head** |
| `new-state` | every partial revert, and any undo of a take that is not the head | **append it** |

A partial revert genuinely is authored change — the human chose to keep the hats
and drop the snare — and the state it produces is not any node in the graph, so it
has to become one. Deciding which case it is happens in the store, where the graph
is; the executor stays ignorant of both.

⚠ **This is the sub-decision most at risk from E16**, and the trap it names is
the reason to say so out loud rather than let it lapse quietly. If branches are
materialised as tracks, "navigation moves the head" becomes "navigation re-mutes"
— a different act, with different failure modes, and one that does not obviously
inherit this section's protection against undoing an undo. **Whatever replaces it
must answer the same question**: what stops a navigation from being recorded as a
step that the next navigation then reverses?

### d. Partial-revert granularity — **`addressKey`, and time/pitch ranges REFUSED**

Cheapest useful answer, per PHASE-1 §Risks naming over-modelling here as the
phase's top design risk. A `Slice` is `{keys?, prefixes?}` — plain data, because
Phase 3's UI has to send one over the daemon's API and a predicate cannot cross a
wire — and `selectClip`/`selectTrack` build one from a take's own write-set using
the existing `addressTrack`/`addressScene` accessors rather than by parsing the
key grammar.

⚠ **Time and pitch slicing are not deferred, they are refused, and for a reason
stronger than scope.** A `note.write` truncates same-pitch neighbours OUTSIDE its
own extent (E8-E), so "restore beats 4-8 of this clip" cannot be done by replaying
a sub-range of the stash — it would need a **merge** of stashed and live notes,
which is exactly the tripwire in (b). Whole-address slicing has no such problem
because the stash is already the whole clip channel (D16e).

### e. ⚠ The pointer disagreement — **the PROJECT wins**

Take contents live in the daemon's store; the active take pointer lives in the
project document. They can disagree, and the important half of the design is
knowing which is right.

**The project document is authoritative about the WORLD, because the pointer and
the music are written by the same save.** If the human works up to take 20 and
closes without saving, what comes back off disk is the project as of the last
save — clips *and* pointer, atomically. The store's head would claim 20 while the
music is at 5. So on open the store **adopts** the project's pointer, and takes
6-20 remain reachable as an abandoned branch — the branching model doing its job
rather than a special case.

The one thing never guessed: a pointer naming a take this store has never seen
(pruned, or another machine). Nothing moves and nothing is claimed. PHASE-1 is
explicit that *"detection matters more than resolution here"*, and this is what
that resolves to concretely.

### f. Retention — **depth 200, and only CHILDLESS takes may go**

Depth rather than age: a session that writes 40 takes in an hour and one that
writes 40 over a month want the same log. Pruning removes only a take with no
children, so a branch is trimmed **from its tip inward** and no survivor ever
finds its parent missing — which is what "what happens to old branches" resolves
to. Three protections, each a thing a human would be upset to lose: the head
(where they are), a **labelled** take (they named it, so it is theirs), and any
take with children.

⚠ **Overshooting the depth beats deleting something protected.** When everything
left is protected the store simply stays over depth rather than picking a victim.

**Takes are named** (D5's "that take had a better hi-hat" implies a human can
label one), and the label doubles as the retention exemption.

### g. ⚠ The privilege split is a TYPE split with a real object behind it

§8g / standing rule 8: the agent may read and explain the log; it may never mutate
it. D14 notes the daemon must keep the agent off those endpoints — and a rule the
daemon has to *remember* is a rule that dies in one refactor. So `store.log`
returns a **frozen plain object** whose own properties are the read methods and
nothing else, `STORE_MUTATORS` names the other half with the reason for each, and
a test asserts no mutator name is reachable — the `WIRE_METHODS_BANNED` idiom
aimed at a privilege boundary instead of a wire.

⚠ **Not `this` narrowed by a cast**, which another cast undoes in a line and which
would pass a `hasOwnProperty` check while failing the `in`-operator one that
actually matters.

### Three things the build found

1. ⚠ **"No slice given" and "a slice that selects nothing" are different, and
   conflating them is data loss.** The first version asked whether the key lists
   were empty, which made `selectClip(take, aClipTheTakeNeverTouched)` — an empty
   `keys` array — indistinguishable from "revert the whole take". A human asking
   to revert one clip would have had the **entire take** reverted, silently,
   *precisely because their request matched nothing*. Presence of the field is now
   the test and emptiness is a refusal. Found by a test.
2. ⚠ **An address a take could not VERIFY must not be replayed forward.** E3's
   case leaves no entry in `verify`, and an absent notes entry means "no clip
   here" everywhere else in the codebase — so a forward jump would emit a
   `note.clear` against music we simply never saw. The store blocks those
   addresses and reports them, which is the same distinction session 1 drew with
   `ApplyReport.unverified` and the same reason it exists.
3. **`gain` is withheld on the way FORWARD too, and nobody had to write that.**
   Replaying a take forward replays its *verify*, which holds the doubled readback
   (E2) — a direction session 1 never exercised. D16b's withholding is derived
   from `NOTE_PROP_FIDELITY` rather than from which snapshot the value came out
   of, so it protects both directions. Without that, every A/B comparison would
   double the gain again, compounding, in silence.

### A take's fidelity describes what it can RESTORE, not what it wrote

Worth stating because it reads as a bug the first time: a take that *writes* a
gain is `exact` (its stash is the clean prior state); a take that *overwrites* a
clip containing gain is `lossy`. That is the correct semantics — the label answers
"what can this take put back?" — and it is what `TakeSummary.unrestorable` reports
in a listing, before anyone commits to a revert.

---

## Consolidation status

**D6–D15 discharge the SPIKE_PLAN §5 debt** — addressing (D6), scaffold sizes
(D7), checkpoint fidelity (D8), grid/units (D9), batch mechanics (D10), toolchain
(D11), transport and frame (D12), escape hatch (D13) — plus the two the plan did
not anticipate: the human control layer (D14, PHASE-0 exit criterion 3) and the
verification discipline that the E15 arc produced (D15).

`PROJECT_PLAN.md` §4 "Standing rules" was the working summary until these existed
and is now a pointer at them.

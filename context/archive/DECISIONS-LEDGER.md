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
        → RESOLVED 2026-08-07: superseded — see D18 and the D17 revision banner.
        D18–D20 (2026-08-06/07) close the E16→E18 branching arc: the HYBRID at
        L3-open (D18), undo policy (D19), and the destruction seam (D20) — with
        revision banners on D4, D6, D12, D13, D14, D16 and D17 landing the
        stateless re-plan (no daemon, no take store; the PROJECT is the take log).
updated: 2026-08-07
evidence: context/spike/FINDINGS.md (E-numbers), BWFORMAT_SPEC.md, BWMOD_DESIGN.md
plan: context/PROJECT_PLAN.md + context/plan/PHASE-*.md
---

# ghostnote — DECISIONS

> Each decision cites the FINDINGS experiment(s) that settled it. D1–D3 are the
> **modulator-authoring** arc (E10–E13, the differentiator); D4/D5 are topology and
> checkpoints; **D6–D15** are the spike-wide consolidation; **D16 and D17** are the
> build decisions, from Phase 1 sessions 1 and 2; **D18–D20** close the branching
> arc (the hybrid at L3-open, undo, destruction) and revise D4/D13/D14/D17 under it.
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
2. **`0x1a1b` instance id unique within one modulator list** — the proven load
   gate (E10f/E71). Separate container lists can reuse ids. Ids need not be
   contiguous or zero-based (E11a); the `0x02b9` name is cosmetic (E11b);
   same-type duplicates are fine (E11f). No embedded-id freshening is required.
3. **Meta `referenced_modulator_ids`** contains the modulator `0x18c6` GUIDs.
   Plain presets keep one ordered ref per object. Containers keep the ordered
   unique GUID set across lists (E10c/E10f/E71). Patch header **`f4`** by the
   meta byte-delta.
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

**Modulator authoring is a template-time file-surgery capability with one
list-local load invariant: each `0x1a1b` is unique within its modulator list.
Separate container lists can reuse ids (E71). The result is verified by
readback, not by inspection.** `validate()` is the cheap offline gate that predicts a LOAD; only a live
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

> ⚠ **REVISED 2026-08-07 (E16p, E16s, E16-REPLAN §2, D18). The daemon is RETIRED.**
> Two of its three jobs no longer exist and the third was never a constraint. Where
> each landed:
>
> - **Observers move into the EXTENSION** — a strictly better home: alive whenever
>   Bitwig is, so it cannot miss an edit made while no client is attached, which a
>   daemon started later provably can. It carries **both** a scene-count epoch and a
>   launcher-content epoch, and the content epoch is the one clip addressing
>   consults (E16s: the count observer sat still, 3 → 3, through a human clip drag
>   the content observer reported as a pair, `t2s7=emptied`/`t2s3=filled`). Initial
>   values arrive through the same callbacks, so an epoch is meaningless in absolute
>   terms — only a difference across a known event means anything.
> - **The MCP server holds a bridge connection directly.** Ordering needs no
>   daemon: the extension-side revision guard is atomic **across connections**
>   (E16p — 6/6 rounds, exactly one winner). Omission-detection died with the take
>   log — there is no log to leave a gap in (D17 rev). Standing rule 7 is STRUCK
>   with this (PROJECT_PLAN §4), and D10's *"hence standing rule 7"* bullet with it.
> - **The change log's job is superseded: the PROJECT is the take log**
>   (E16-TRACK-NATIVE). Branch-event metadata lands in `getDocumentState()`
>   [⚠ capacity for a JSON payload unmeasured — owed, P1]; changesets live in the
>   chat log and are the input to agent-edit reversal (D19).
> - ⚠ **The web view is OPTIONAL, evaluated again after the core is built**
>   (operator, 2026-08-07). Default: forego what needs it, or build a TEXTUAL
>   version agents can naturally produce and render. If it is ever built, it is
>   MCP-server-hosted and lives and dies with the chat session. ⚠ Tripwire: if it
>   ever wants to be usable with no agent attached, the daemon decision REOPENS.
>
> *"No custom chat harness"* survives untouched.

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
  > ⚠ **RESTATED 2026-08-07 (E16r): a PRECONDITION on every structural create,
  > checked BEFORE the call — never a post-hoc detection.** A create past the
  > window mints a track `track.list` never shows: unaddressable, un-cleanable,
  > audible — and a fork IS a `track.create`. Budget: `bankSize − (project tracks
  > + FX returns + master + lineage groups)`. The Master and the FX returns leave
  > the window FIRST (E16r) and are E16's audibility oracles; the failure reads
  > `found:false`, byte-identical to a deleted track. ⚠ Never a licence to reap
  > (D20); ⚠ never justified on disk grounds — E16u measured disk immaterial
  > (~20 KB/fork, no save-time change). → PROJECT_PLAN §4 rule 5.

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
  > ⚠ 2026-08-07: "the gate is the daemon" → the gate is the **MCP server** (D4
  > rev — there is no daemon). The threat-model posture is unchanged.

> ⚠ **AMENDED 2026-08-07 (D20).** *"One write method"* holds at the ADAPTER
> CONTRACT — the `Op` union does not split. But the **MCP tool surface** above it
> partitions by privilege class — read / write / destructive — so that host
> permission systems can see the destruction boundary (`readOnlyHint`,
> `destructiveHint`). The seam is at tool granularity only; the adapter interface
> still never grows per capability. This is D17g's structural-seam idiom applied
> at the tool layer: a privilege boundary should be a seam, not a remembered rule.

## D13 — There is no escape hatch **[SETTLED 2026-07-19, E6]**

**ghostnote uses NO named actions. Ever.** (Standing rule 6.) 781 actions
enumerate and `invoke()` is unusable *and* hazardous: global actions fire only
with Bitwig foregrounded (backgrounded = silent no-op while the typed API keeps
working), editing actions need panel keyboard focus the API cannot set, the return
is `void` with zero readback, and they operate on the UI selection **our own
addressing sets** — foreground `Duplicate` duplicated the gn-A fixture **7×**
before the mechanism was understood.

> ⚠ **REVISED 2026-08-07 (E16j, E16k). The verdict NARROWS; the reasoning is
> REPLACED.** E16j disproved the stated premise — named actions **do** fire
> backgrounded, including minimised to the Dock — and the track-native lineage
> group can only be created by one (`Group` / `Create Group Track`), so the model
> now *depends* on the thing this rule forbade. What is actually wrong with named
> actions: they are **not addressable surface** — they act on the UI selection,
> which our own addressing sets and a human can move under us (E6 blocker 3;
> observed live again in E16j — seven orphan duplicates). New form:
>
> **Named actions may be used only where the selection is established and
> verified in the same batch, and never where an addressed API call exists. The
> ONE sanctioned use is lineage-group creation**, whose construction order is
> forced — group the original FIRST, then duplicate (E16k K2: `moveTracks` and
> `copyTracks` are silent no-ops; nothing can be gathered in afterwards).
>
> ⚠ Probe-level addendum (E17/E18 method guards): a named action fired at a
> *chain* additionally needs a human-clicked chain lane since project load —
> invisible priming, destroyed by a cross-track re-point or a project reload — so
> a typed route is preferred always. `WIRE_METHODS_BANNED` and
> `WIRE_METHODS_FORBIDDEN` stand unchanged.

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

> ⚠ **REVISED 2026-08-07 (E16m/E16w/E17 row 6, D18, D4 rev).** Two changes and a
> dissolution:
>
> - **Coarse A/B needs no ghostnote UI at all.** The take mechanisms are Bitwig's
>   own surfaces — exclusive chain solo (one flag, E17 row 6), clip launch
>   (quantised by construction, the only beat-aligned A/B — E16m's recorded
>   complaint, answered in D18a), group mute. The "take switcher" this entry moved
>   to Phase 3 is mostly **dissolved rather than relocated**; what Phase 3 still
>   owed — comparison and summary views — defaults to TEXTUAL, agent-rendered
>   forms, since the web view itself is now optional (D4 rev, operator 2026-08-07).
> - **The privilege concern MOVES.** "The daemon keeps the agent off those
>   endpoints" is moot: under D18, A/B switching is an ordinary non-destructive
>   write the agent may make anyway. What stays privileged is unchanged in
>   substance — the revert *decision* is human (and the document-state button is
>   API-enforced: `Signal.fire()` refused, E14-A1), and destruction is never the
>   agent's decision (D20).

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

> ⚠ **AMENDED 2026-08-07 (E16-OPEN-QUESTIONS §3.3.3/§3.3.4, operator-approved).**
> Three corrections to the write-set/fidelity machinery:
>
> 1. **`clip.delete`'s `none` was an ADAPTER ARTIFACT, not an API limit.**
>    `write-set.ts` claimed *"neither its length nor its content has a readback"* —
>    both halves false as the code stands: content is stashed (§e — the whole clip
>    channel) and length is readable (the live adapter already reads `loopLength`
>    to pick a scan grid; it simply never wrote it into the clip entry). Meanwhile
>    `StateValue` declares `lengthBeats?`, the fake populates it and the live
>    adapter did not — PHASE-0 §Risks' named failure mode, unexercised because
>    nothing read the field. **The live adapter captures `lengthBeats`; the label
>    becomes `lossy`** — a revert recreates the clip at its true length carrying
>    the stashed notes, and reports what it cannot restore (name, colour, loop
>    start/end as distinct from length, launch settings, and — the one that bites —
>    automation lanes, which have no readback in our surface at all). Recorded so a
>    later session does not mistake a stash gap for an API wall — the E4c mistake
>    in a different costume.
> 2. **`device.insert` gets `clip.create`'s treatment: revert emits
>    `device.delete`** at the chain index the insert produced — structural, no
>    readback needed, returns the chain to a state that provably existed.
>    `unrevertableOf` had filed it under `NO_DEVICE_READBACK`, a reason written
>    about the *delete* direction. §d's human-work objection is resolved the same
>    way it already is for clips: the revert *says* what it deletes, and D5's
>    reporting rule is the protection, not a refusal to invert. With the mislabel
>    fixed, `WriteSet.unrevertable` becomes exactly *"the set a branch cannot
>    rescue"* (`track.create` — nothing to fork; `scene.create` — not
>    track-scoped): the bucket doing its job.
> 3. ⚠ **The genuine exception is `device.insertFileAt` with `where:'replace'`**:
>    its damage PRECEDES the stash — the outgoing device's opaque state has no
>    readback and no template to rebuild from — so the label predicate's own input
>    is unreliable. If Phase 5 ever adds replace to the contract it is
>    **unconditionally gated** (refused unless branch-protected, before reading
>    anything) — the one hard-coded member §3.3.6 already reserves.
>
> ⚠ Related, decided in D18c: the floor over these labels (*"fidelity worse than
> `exact`"*, §3.3.5) keeps its predicate but changes its RESPONSE — a loud
> refusal-unless-branch-protected, never an automatic fork. And §d's *"un-creating
> a created track is deliberately NOT offered"* softens under D20: not offered
> **automatically**; expressible as a directed destructive op.

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

> ⚠ **REVISED 2026-08-07 (E16-TRACK-NATIVE, E16-REPLAN §2, D18). The take STORE is
> RETIRED — the system is stateless and the PROJECT is the take log.** Per
> sub-decision:
>
> - **§b, §c SUPERSEDED** (provisional the day they were written, and the warning
>   above resolved against them). There is no head, no path walk, no project-wide
>   "state at take N": takes are real structures in the project — track forks,
>   layer chains, clip blocks (D18a) — and navigation is *switching* between them
>   (mute / solo / launch), not materialised revert. ⚠ §c's trap keeps its force
>   in the new form: **a navigation is a SWITCH, never an edit** — nothing may
>   record it as a step the next navigation then reverses.
> - **§a, §f RETIRED with the store** — no project key, no on-disk log, no
>   retention. Reaping was already the human's decision regardless (D20).
> - **§d SURVIVES, repurposed**: `slice.ts` stays — partial revert by address over
>   the **stash** (D5's *"that take had a better hi-hat"* is within-track), with
>   time/pitch slicing still REFUSED for E8-E's merge reason, which no
>   authorization moves (D20).
> - **§e's principle outlives its object**: the project document is authoritative
>   about the world — now trivially, since the project *is* the log.
> - **§g REAFFIRMED and generalised** (D20): the privilege boundary is a
>   structural seam, not a remembered rule — now at the MCP tool surface (D12
>   amendment) rather than around a store object.
> - ⚠ **The STASH survives the store and is load-bearing THREE ways** — unbranched
>   writes (D16), the clip content fingerprint guarding positional addressing, and
>   agent-edit reversal (D19). **Do not delete it with the store.**

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

## D18 — Branching: the hybrid model at L3-open **[SETTLED 2026-08-06 by the operator; recorded 2026-08-07]**

**All three branch mechanisms exist — track fork, layer chain, clip block — and
the agent chooses between them freely. What the agent experiences is L4:
open-ended tool descriptions, no dispatch rule anywhere on its surface. What the
record captures is L3: every branch event stores a deterministic rule's verdict —
computed silently, used for nothing — beside the agent's actual choice and the
human's response. Only reporting is imposed.**

Closes the E16→E18 branching arc. The argument is
`spike/HYBRID-AUTONOMY-LEVELS.md` (the ladder, and why L3-open beats both the L1
recommendation it replaced and plain L4); the measured substance is
`spike/E18-VERDICT.md` §1. The operator's framing, verbatim:

> *"I don't want the inherent prescriptiveness of L0/L1 to bleed up; I
> specifically want to see how agents work with more autonomy and iterate on tool
> descriptions in that world, with the deterministic branching as a useful
> measurement control. This holds for all measurements in general; only reporting
> is imposed, no automatic mechanism-level branching or prescriptiveness."*

### a. The hybrid — all three mechanisms are built

Track fork: ● proven (E16k, C5, E16u, E16r). Layer chain: ◐ most of the wire
exists (`e18a`/`e18c`/`e18e`/`e18g`/`e18h`). Clip block: ⚠ **the gap** —
`launchWithOptions(quantization, launchMode)` and
`ClipLauncherSlot.duplicateClip()` are unprobed and not on the wire; **the one
early build item** (Phase 1). The track-vs-layer question closed by dissolving:
layers were committed regardless (`e18a` — the Master and FX returns are
reachable no other way), and the clip block is the only beat-aligned A/B in the
design (E16m's complaint; E18-VERDICT §4c). ⚠ Three owed measurements were
dispositioned by operator judgement with named retirement conditions
(E18-VERDICT §7a: dormant-chain CPU, container PDC/transparency, launch
quantisation) — that dependency stays visible, not buried.

### b. L3-open — what the agent sees, what the record keeps

The agent is never shown a default, a dispatch table, or anything to "depart
from"; it chooses on the merits as it understands them. Hiding the rule removes
the anchoring bias that made plain L3 a poor instrument (HYBRID §1c); the matched
pair — silent verdict beside live choice, neither informing the other — is what
makes autonomy *measurable* rather than merely granted. L4 alone has no tell;
L3-open takes L4's freedom and keeps one. Agent judgement is **perishable** (the
conversation and the human's stated intent are not in the changeset); the rule's
verdict is free, retroactive and permanent — so real sessions are spent on the
perishable signal (HYBRID §1a/§1b).

### c. ⚠ The firewall is scoped to CHOICE-MAPPING, not to prescription

> **Tool descriptions carry complete mechanical knowledge — capabilities, costs,
> traps, and correct procedures, as prescriptive as correctness requires — and
> ZERO choice-mapping: nothing that maps the shape of a change onto a mechanism.
> Facts and procedures, never pre-drawn conclusions.**

⚠ Replaces a first draft's blanket *"guidance, never prescription"* (operator,
2026-08-07): correctness recipes — group-then-duplicate, append-only scenes,
rename-on-fork — are *required* knowledge, and deficient knowledge is a
**confound** in the judgment measurement, not a purer form of it. We measure
judgment, not ignorance. Facts that let an agent *derive* the rule are fine — a
derived conclusion is a finding (§5c row 1 of HYBRID: high agreement means the
rule captures what good judgement does); a pre-drawn one is compliance.

- **Preconditions are DOCUMENTED** (the bank-window budget, the fidelity floor),
  so refusals are predictable. Refusal text is fully informative — even
  procedurally directive — *within* the attempted mechanism, and **never
  redirects across mechanisms** ("fork won't fit — use a layer" is the leak
  arriving through an error message). Unpredictable refusals also pollute the
  instrument: wall-bump mechanism switches are not judgment.
- ⚠ **The floor is RESTATED** (E16-OPEN-QUESTIONS §3.3.5): predicate unchanged
  (*fidelity worse than `exact`*), response changed — a **loud
  refusal-unless-branch-protected, never an automatic fork**. Same for the
  damage-precedes-the-stash member (§3.3.6): unconditional refusal unless
  branch-protected, before reading anything. An automatic fork is automatic
  mechanism-level branching, which the operator's framing forbids outright.
- **No prescriptive fallback in behaviour**: if the agent does not choose, the
  system reports and stops.
- **The deterministic dispatch rule** (E18-VERDICT §6, repurposed:
  split-by-object-type with the track fork as escape hatch) **lives in the
  executor and never reaches the agent surface in any form** — not a tool
  description, a parameter name, an error message, or a receipt. A leak
  contaminates every event logged after it, irrecoverably (HYBRID §4). This is
  the one one-way door: guidance can always be *added* on evidence — that is
  L3-open degrading gracefully toward L3/L1 — but choice-mapping can never be
  cleanly *removed*.
- ⚠ **Fresh surface language** (operator, 2026-08-07): tool names and
  descriptions are written from scratch for a general-purpose agent — **none of
  the spike's internal jargon** (fork/reap/lineage/stash/floor as terms of art)
  crosses the surface. Each domain concept gets self-explanatory naming; names
  should naturally suggest capabilities and seams while leaving room for
  judgment. Internal docs keep their vocabulary; the surface earns its own.

### d. The record, and versioned tool descriptions

One row per branch event:

| field | notes |
|---|---|
| the **raw write-set** | the INPUT, never a classification — any future rule, including ones not yet invented, replays against it (HYBRID §1a) |
| the rule's **silent verdict** | computed in the executor, used for nothing |
| the **agent's choice** | fork / chain / block |
| *agreed?* | derived, never stored |
| the agent's **own rationale** | not a justification of a deviation — it never saw a default |
| the **human's response** | accepted / vetoed / **silent** — silent must be distinguishable from accepted |
| the **resulting structure** | by identity |
| ⚠ the **tool-description version** | see below |

> ### ⚠⚠ REVISED 2026-08-09 (E20d) — the record lives in `getDocumentState()`, **HIDDEN AT `init()`**
>
> **Settled by the operator, 2026-08-09.** D18d put the record in
> `getDocumentState()` and the open question was *how much JSON fits*. ⚠⚠ **That
> was the wrong question.** Measured (`FINDINGS.md` E20d):
>
> - ● **Capacity is a non-issue.** 262144 chars round-trip the wire exactly (flat
>   at 16–34 ms), store in the setting exactly at ⅛/½/full declared size, and
>   **survive a save plus a full application restart byte for byte**. Init costs
>   16.7 ms at that size.
> - ⚠⚠ **The value is DRAWN, and drawing it is fatal.** With 262144 chars in the
>   field, interacting with it **hard-locked Bitwig** — the pane hung with a busy
>   cursor, drew over other windows, and the process had to be force-quit. The
>   operator reported the field lagging from **1024** chars up, so the degradation
>   is continuous and the lock is the top of the same curve. Same severity class as
>   E14-A1, reached by a different route; nothing extension-side contains either.
>
> ⇒ **The record stays in `getDocumentState()` and the setting is HIDDEN AT
> `init()`.** `Setting.hide()` is reachable through E14 row C1's undocumented
> downcast — ● measured again here (`E20d-H1/H2`: the cast works, `hide()` is
> accepted) — and ● **a hidden setting still holds its value byte for byte**
> (`E20d-H3` at the full 262144).
>
> ⚠⚠ **AT `init()`, not at runtime, and the distinction is the whole decision.**
> `hide()` is a runtime call and `init()` re-creates the setting **visible**, so a
> runtime hide re-arms the hazard on every restart. The hide therefore belongs in
> `UiPanel`'s constructor beside the creation, where rule 13 already puts
> everything else.
>
> **What this buys, and it is why the document setting survived the finding**: the
> record stays **per-project** and **survives a restart** (E14-A3/A4) — the two
> properties that made `getDocumentState()` the right home — while never being
> rendered.
>
> ⚠ **OWED, not done** (and it is small): the init-time hide is **not built**, and
> the two human observations the hidden arm asks for — *is the row gone from the
> pane, and is the pane responsive* — were **not reported back**, so "hidden means
> safe" is currently inferred from the value surviving rather than confirmed by
> looking. ⚠ Confirm both before anything writes a large record. `RigConfig`'s
> default stays `0`, which is a safety default and is documented as one.
>
> ⚠⚠ **DONE, same day.** `UiPanel`'s constructor now hides the setting where it
> creates it, so `init()` never re-arms the hazard on a restart. Both human
> observations owed above are now in: confirmed by eye, after a hand reload with
> `recordChars=262144`, that the "Branch record" row is absent from the panel and
> that the pane stays responsive; `probe:e20d-hidden`'s H1/H2/H3 all PASS against
> the init-time hide (full 262144 chars, 19 ms settle — `FINDINGS.md` E20d). ⚠ One
> addition beyond what this decision specified: if the `Setting` downcast itself
> is unavailable, the setting is now refused rather than created and left
> unhideable — checked against `statusText` (already created) before
> `getStringSetting` is ever called for the record, since a setting once created
> cannot be un-created through this API.
>
> ⚠ **Rejected: a pointer or rolling window** with the log living elsewhere, and
> **rejected: dropping the document setting as the record's home.** Both were live
> options while capacity looked like the constraint; neither is needed once the
> value can exist unrendered, and both would have cost the per-project persistence
> that is the actual reason the record is there.

⚠ **Tool descriptions are a first-class versioned artifact**: freeze a version,
gather events under it, then edit — an edit mid-cohort splits the cohort and
neither half is interpretable alone (HYBRID §5b). v1 ships the mechanics,
trade-offs and correctness recipes **lean** — no worked examples, no heuristics,
no "typically/recommended" language — and every addition is a deliberate,
versioned response to an observed failure (§5c: vetoed choices → tighten
descriptions first, the rule only if that fails).

Two confounds stated, not buried (HYBRID §5d): a falling veto rate is equally
consistent with the human having stopped reading — report veto rate and
choice-diversity together, and treat "departs more, vetoed less" as suspicious;
and the replayed rule is never *"what would have happened under L1"*, because the
agent's choices shape later write-sets.

### e. Axes B and C do not move

This decision governs **mechanism choice only**. **B (whether to branch) stays
low** — *"deliberate and coarse"* (E16-TRACK-NATIVE answer 2); most batches are
never branched and the stash is the common path. **C (destruction) is pinned at
zero INITIATIVE** — see **D20**, which is where the operator's 2026-08-07
refinement of "never reap" lives.

---

## D19 — Undo: Bitwig's stack is the human's; agent-edit reversal is ours **[SETTLED 2026-08-06; separated out 2026-08-07]**

**The agent's edits are not expected to be reversible through Bitwig's undo, and
nothing is designed as if they were. Agent-edit reversal is our job — best-effort,
from the changesets, and it must SAY best-effort through D8/D16's existing
fidelity labels.** Split out of D18 at the operator's request, because this is
expected to mutate as the model refines.

- **The cost accepted, with numbers**: one structural API call = one undo step
  (`e18f`), so Cmd-Z travels ≈1 (clip duplicate), 3 (fork + rename + group) or
  **7** (layer rebuild — with both containers live in 6 of 7 intermediate states)
  depending on a mechanism choice the human did not make. The operator's reframe,
  verbatim: *"undoing within Bitwig will mostly be a gesture for human edits; the
  operator is not likely to be very surprised that undo history is filled with
  several opaque entries for an agent edit. We will still be able to execute a
  best-effort agent-assisted undo of its own edits with the changesets in the
  chat log."*
- **Reversal is DIRECTED** — the human asks for it — and rides the ordinary
  (non-destructive) write surface, **structurally bounded to the session's own
  changesets**. Reversal that would destroy anything the agent did not itself
  mint-and-last-write is **withheld and reported** through the fidelity
  machinery, never silently escalated to destruction. Clean reverts are NOT
  reaping (the D20 boundary), and need no approval beyond the instruction that
  directed them.
- ⚠ **This makes the STASH load-bearing a third way** — after D16's unbranched
  writes and the clip content fingerprint. It survives the take store's
  retirement (D17 rev) and must not be deleted with it.
- What a reversal cannot restore is governed by the labels as they already exist:
  `gain` withheld (D16b), `pressure` stripped and named (D16c), `none`-fidelity
  reported loudly (D16d) — reused, never reinvented.

---

## D20 — Destruction: zero initiative, directed execution behind an annotated seam **[SETTLED 2026-08-07]**

**Privileges attach to DECISIONS, not to executions. The agent never *decides* to
destroy; it may *execute* destruction the operator explicitly directed. Axis C is
pinned at zero initiative, not zero capability.**

The letter of *"the agent may never reap"* (D17g, §4.16, rule 8) said never; the
spirit was always never *uninvited* — E18-VERDICT §3f: pruning is a user-visible
act, and the chain-delete ○ *"binds the agent, not the human."* This entry amends
the letter to match, at the operator's direction (2026-08-07). Unsolicited
destruction stays at absolute zero — and making zero-initiative *structural* is
precisely what lets directed destruction be allowed without re-litigating trust
every time.

- **The seam: destructive verbs live on a SEPARATE MCP tool surface, annotated**
  (`destructiveHint`; read tools carry `readOnlyHint`), so the **host's
  permission flow is the stop-and-ask**. Tool names and descriptions are chosen
  to suggest the capability class naturally (D18c's fresh-language rule applies).
  *"Always allow"* is the operator's prerogative and accepted — they may have
  good reasons (e.g. directed cleanup of a large cluttered project). Amends D12:
  the adapter contract keeps one `Op` union; only the MCP tool surface partitions.
- ⚠ **The boundary is host-mediated: nothing INSIDE our system gates a directed
  destructive call.** Threat model is the confused agent, not a malicious client —
  consistent with D12's socket posture. ~~⚠ **Annotation handling is currently a
  SPEC READING, not a measurement**~~ — ⚠⚠ **MEASURED 2026-08-09, and the reading
  was wrong. See the revision below.**

> ### ⚠⚠ REVISED 2026-08-09 (E20c) — the seam stands, the STATED REASON does not
>
> **Settled by the operator, 2026-08-09.** The mechanism is unchanged; the sentence
> justifying it is replaced, because the thing it named turned out to be
> decorative.
>
> **Measured** (`FINDINGS.md` E20c, `probe:e20c` ARM A 7/7 + ARM B in a live
> Claude Code session): we emit `destructiveHint` / `readOnlyHint` /
> `idempotentHint` correctly — asserted field by field at an MCP client — and
> ⚠⚠ **Claude Code prompts IDENTICALLY for all four tools**, annotated or not,
> including an unannotated baseline. There is no visible indication that the
> annotations are read at all.
>
> ⚠ **But the grain it DOES gate on is the tool NAME**, per project — the prompt
> offers *"Yes, and don't ask again for **this tool** in this project."* That is
> exactly what the seam is built out of, so nothing about the design changes:
>
> - **The gate is the tool NAME**, not the annotation. Destructive verbs live on
>   separately-named tools; that is what the host's allow-list keys on, and it is
>   why the partition is load-bearing rather than cosmetic.
> - ⚠⚠ **Consequence, stated so it is not discovered later: *"don't ask again for
>   this tool"* is a PER-NAME BLANKET GRANT.** D20 already accepts *"always
>   allow"* as the operator's prerogative — this is what that looks like in
>   practice. ⇒ **A destructive verb must never share a tool name with a benign
>   one, and must never be widened to cover a benign case later.** Tool-surface
>   granularity IS permission granularity.
> - **Annotations stay on, and nothing relies on them** (operator's direction):
>   they are correct, they cost nothing, and a host that starts honouring them
>   makes the seam sharper rather than different. ⚠ They are **future-proofing,
>   not a mechanism** — no design may assume a host reads them.
> - ⚠ Measured against **Claude Code only** (the operator's target host, chosen
>   while planning session 3b). Other hosts are **unmeasured**, not assumed
>   equivalent — and under the rule above it does not matter much, since the name
>   grain is what carries the weight.
- ⚠ **Rejected: a document-state arming toggle** (API-enforced human-only —
  Bitwig refuses `Signal.fire()`, E14-A1 — checked extension-side as a
  conditional `WIRE_METHODS_BANNED`). Proposed as the hard gate; dismissed by the
  operator as too awkward. Recorded so a future reopening inherits the design
  rather than rediscovering it.
- **The revert/reap boundary**: reversal of the session's own changesets is not
  destruction (D19). v1 line: **own changesets ungated; destruction of anything
  else rides the destructive surface.** A fingerprint refinement is available if
  the simple line chafes: ungated iff current content matches what our changeset
  last wrote.
- **Merges come apart three ways**, and only one moves:
  1. *Store-level merge* — dead with the store (D17 rev); the old tripwire's
     object is gone.
  2. *Project-level consolidation* — collapse-to-winner, reduce, mechanism
     conversion (chain→top then fork, `e18c`) — becomes **directed + annotated
     surface**, with a save-the-project-first suggestion in the warning (a
     collapse is 7 undo steps, `e18f`) and the conversion asymmetry stated:
     layer→track exists; **clip→layer is impossible outright** (a chain carries
     no clips).
  3. *State-level merge* — time/pitch-sliced revert — **stays REFUSED,
     mechanically** (E8-E: same-pitch truncation outside the write's extent).
     ⚠ **Authorization changes "may we", never "how" — mechanical walls do not
     move for permission.**
- **Execution discipline is authorization-independent**: enumerate the cascade by
  identity before any delete (§4.16 — a group delete takes the winner with it
  whether or not it was ordered); **name the survivor, never count it** (rule 13);
  bound the delta; verify by readback. A directed delete on a name-addressed
  chain (`e18b`: ids minted by the project loader) can still hit the wrong take —
  only discipline prevents that, and no instruction relaxes it.
- **Untouched**: the revert *decision* stays human, and the document-state button
  stays API-enforced (E14-A1) — Bitwig enforces that, not us.

---

## Consolidation status

**D6–D15 discharge the SPIKE_PLAN §5 debt** — addressing (D6), scaffold sizes
(D7), checkpoint fidelity (D8), grid/units (D9), batch mechanics (D10), toolchain
(D11), transport and frame (D12), escape hatch (D13) — plus the two the plan did
not anticipate: the human control layer (D14, PHASE-0 exit criterion 3) and the
verification discipline that the E15 arc produced (D15).

`PROJECT_PLAN.md` §4 "Standing rules" was the working summary until these existed
and is now a pointer at them.

**D18–D20 (2026-08-06/07) discharge the E16-REPLAN §5 debt**: the branching model
(D18), undo (D19), destruction (D20), and the revision banners on D4, D6, D12,
D13, D14, D16 and D17 that land the stateless re-plan. Standing rules 5, 6, 7 and
8 were restated in `PROJECT_PLAN.md` §4 the same day; rule 7 is struck with a
tombstone rather than renumbered, so the spike record's cross-references stay
valid.

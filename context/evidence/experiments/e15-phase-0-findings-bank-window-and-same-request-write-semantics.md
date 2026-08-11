---
id: E15
kind: evidence
state: active
source: FINDINGS.md
---

# E15 — Phase-0 findings (bank window, and same-request write semantics)

Found while building the Phase-0 adapter contract. B and C were surfaced by the
**conformance suite disagreeing with the fake adapter** — precisely the mechanism
PHASE-0 §Risks specifies for catching fake drift, working on its first outing.

⚠ **Read C, D and E as one story.** D disproves the mechanism it was filed under
and E retracts C outright. The through-line is a single methodological lesson,
worth more than any individual verdict here: **a write verified through the same
handle that performed it is not verified.** Bitwig's cursor objects cache what
you wrote to them. C measured a phantom and believed it; D's "pointing is
ordering-sensitive" was inferred from a symptom rather than measured. Both went
away the moment the readback came from an independent cursor and the controls
differed by exactly one variable.

### A. `TrackBank.itemCount()` reports the PROJECT total, not the window ●

Measured live: a project holding 17 tracks against a 16-track bank reported
`itemCount=17` while only 16 rows were visible (`Master` had fallen out of view).

This **closes the open question that made standing rule 5 unimplementable**. Before
it, "16 tracks exist" and "16 of 54 are visible" were indistinguishable from the
extension side, because `track.list` iterates to the configured bank size and
filters on `exists()`. `rig.stats`/`rig.scanTracks`/`track.list` now also report
`itemCount` and `bankSize`, and `LiveAdapter` refuses to operate when
`itemCount > bankSize` (`BankWindowOverflowError`).

⚠ `trackBank.itemCount().markInterested()` is called at `init()`. Verified safe
(the extension loads and answers `ping`), but it is the E7-Finding-0 hazard class,
so it stays the first thing checked after any deploy — `npm run probe:hello`.

### B. Note properties CANNOT be set in the request that creates the note ●

`setStep` is not visible to a `getStep` in the same request (E2). The consequence
was not drawn at the time: a `setNoteProps` in that same request operates on a
**stale NoteStep**, and every property written to it is **silently discarded**.

    setNotes + setNoteProps{gain:0.7} in ONE request   -> gain reads back 0
    setNotes, then setNoteProps{gain:0.7} next request -> gain reads back 1.4

No error, no signal. This is a superset of the E2 two-turn rule and applies to
every expression property, not just the fragile ones.

### C. ~~`pressure` needs a LATER REQUEST than `gain`/`timbre`~~ — RETRACTED ✗

**Superseded by E below; this section was wrong and the code it justified is
gone.** It read, correctly for what it measured:

    {gain:0.7, pressure:0.9} in ONE setNoteProps   -> pressure reads back 0
    gain, then pressure in the NEXT request        -> pressure reads back 0.9

...and concluded that a fully-specified note needs three turns, with pressure
alone in the last one. Both readings came from the SAME pool cursor that issued
the write, which is the one place a pressure value appears whether or not it
landed. Read through any other cursor — or through the same one after a
re-point — both cases report 0. `setPressure` never reaches the clip at all, so
no number of turns saves it.

Kept rather than deleted because the retraction is the useful record: the flaw
was measuring a write through the handle that performed it, and the same flaw
would have been invisible in E2/e02e for the same reason.

### D. Only the READING write op is same-request unsafe — and it is not pointing ●

Filed as "pointing and acting in the same request is ordering-sensitive", on the
reasoning that pointing settles in ~25ms so a write issued in the same turn might
land on the previous clip. **That mechanism is disproven.** Probes:
`probe:e15d`, `probe:e15d-props`, `probe:e15d-grid`, `probe:e15d-live`.

**What is actually true.** Pointing retargets the cursor for the API calls that
FOLLOW it *in the same turn*; what lags ~24ms is the OBSERVABLE state
(`cursor.status`'s `trackPosition`/`sceneIndex`), not the target. Measured, each
against a control differing only in the request boundary:

| in ONE `batch.run` | result |
|---|---|
| point at B, then `setNotes` (cursor was parked on A) | ● lands in B, A untouched |
| point at B, then `clearNotes` | ● clears B, A untouched |
| `setStepSize 0.5`, then `setNotes` x=2 (cursor was on 1/16) | ● lands at beat 1.0, not 0.125 |
| point A + write, then point B + write | ● both land correctly |
| `setStepSize`, then **`cursor.setNoteProps`** | ✗ **every property silently discarded** |

The last row is the finding. **`cursor.setNoteProps` is the only write op whose
handler READS before it writes** — it resolves `clip.getStep(channel, x, y)` and
mutates what comes back — and a read cannot see a grid change that has not landed
yet. Stepping the gap between the grid change and the props write:

    gap  0 / 24 / 48 / 72 / 96 ms  -> 0 of 3 properties landed
    gap  120 / 144 / 192 / 288 ms  -> 3 of 3 landed

No error, no failed op in the batch result, no signal of any kind.

**Why `C-pressure` failed only after `C-notes`.** Identical frames, different
inbound state — the traced batches are byte-for-byte the same in both runs. A
readback leaves the pool cursor on the 1/16 scan grid (`scanStepSize`), so the
next write CHANGES the grid and poisons its own property stage. A case arriving
already on the right grid changes nothing and its properties land. That is the
entire ordering sensitivity.

**The fix, and why not the three options that were sketched.** The point frames
stay exactly where they are: `pointFrames` is sound, so a `cursor.point` op
(which would leak the cursor into a deliberately cursor-free contract) and
point-hoisting in `planStages` (which would need wire knowledge in a wire-free
module) both solve a non-problem, and both would cost round-trips or the E8 batch
win. Poll-and-verify in `LiveAdapter` was the recommended starting point and is
also unnecessary for the same reason — there is nothing to wait for.

What the real fault needs is the *mirror image* of `OP_SETTLE`: a wait BEFORE a
stage, because waiting after it would be waiting for damage already done. So
`OP_SETTLE_BEFORE` maps `note.props -> gridChange` (144ms, measured floor 120),
`planStages` attaches it as `Stage.settleBefore`, and both adapters honour it.
The contract stays cursor-free, one batch stays one turn, and the fake models the
trap (`stepDataIsStale`) so removing the fix fails offline — verified by doing it.

Consequences recorded alongside:

- **Ops targeting different clips MAY share a stage** (row 4 above). The E8
  coalescing is safe as written; `C-twoclips` now asserts it on both adapters.
- **The read path was already correct.** It settles after its own `setStepSize`,
  and its budget was ≥120ms by luck of borrowing `trackStruct`. Now named
  `gridChange` and citing the measurement rather than borrowing a number.
- **`E15-B` is the same root cause** — a stale `NoteStep` — differing only in
  what invalidated it (a `setStep` there, a `setStepSize` here).
- **`gain`'s decoded default was wrong**: a freshly created note reports gain 0,
  not the 0.5 the decoder assumed. Every live snapshot was therefore labelled
  `lossy` while the fake said `exact` — a fake/live divergence invisible to the
  suite, because the only case asserting the label wrote gain explicitly.

Live: **18 pass / 0 fail / 3 skipped**, three consecutive full runs. Offline 124.

### E. `pressure` cannot be written at all — it is a phantom in the writing cursor ●

Found while confirming D, and it is the reason `C-pressure` could ever pass.
Probe: `probe:e15d-persist`.

`NoteStep.setPressure` does not reach the clip. The value lands in the writing
cursor's own `NoteStep` cache, where:

    read back through the cursor that wrote it   -> 0.9
    read back through any other pool cursor      -> 0
    re-point that cursor away and back, re-read  -> 0

Swept one property at a time — write alone, settle, read, re-point the writer
away and back, read again — **16 of the 17 others persist** (`pan`, `gain`,
`timbre`, `transpose`, `chance`, `occurrence`, the repeat family, …). None was
refused. Pressure is alone, so this is specific to the property and not to
`setNoteProps`, the cursor pool, or the settle discipline.

**This retires E2/e02e's "`setGain` and `setTimbre` RESET pressure to 0" and this
section's own finding C.** Nothing was ever reset: the pressure being "lost" was
never in the clip, and what gain and timbre actually did was force the writing
cursor to re-read its `NoteStep`, replacing the phantom with the clip's real 0.
The two-request result that C reported as proof ("gain then pressure in the next
request reads back 0.9") was reading the writer's own cache.

That makes it worse than a missing feature. `LiveAdapter.read` goes through the
same pool cursor it writes through, so a caller would see pressure "work" on
readback and lose it for real — and **a snapshot would record a value the clip
does not contain**, which is a checkpoint-corruption vector, not an inconvenience.

Mitigation: `pressure` is `unwritable` in `NOTE_PROP_FIDELITY`, `orderedNoteProps`
cannot emit it, and `assertOpsWritable` REFUSES a batch that asks for it — in the
contract, so both adapters refuse identically and the conformance suite can
assert it. Reading one back still works and degrades the entry to `lossy`, since
we cannot restore what we cannot write. `planStages`' third turn (pressure alone)
is gone; a fully-specified note is now two turns, not three.

⚠ **Open, for Phase 1.** Whether a HUMAN-authored pressure reads back non-zero is
untested (there is no way to author one from the bridge). If it does, a stash
would carry pressure and replaying it would hit the refusal — loud, but it would
mean revert cannot be faithful for such a note. Also untested: whether pressure
needs MPE/expression state on the track, or a different API surface, to land at
all. Adding a wire method to find out was out of scope here.

### F. `setNoteProps` reads through the clip the cursor held at TURN START ● (2026-07-25)

**Verdict: ● measured, 8 verdicts, all reproducing across three runs. The
consequence is that PHASE-0-SESSION-2 item 4's proposed optimization is UNSOUND
and has been rejected rather than implemented.** Probe: `probe:e15f`
(`e15f-hoist.ts`), which now asserts the trap and is the live regression for it.

Item 4 proposed hoisting the `note.props` ops that `splitNoteWrite` generates into
one trailing stage, so N property-bearing writes cost 2 stages and one
`gridChange` instead of 2N and N. Its justification was E15-D's "ops addressing
different clips MAY share a stage".

⚠ **That inference does not transfer, and the reason is the whole of E15-D.**
E15-D measured `setNotes` — a pure WRITE. `note.props` is explicitly the one op
whose handler READS before it writes, and E15-D's lesson is that writes are
steered by same-turn state while reads are not. Extending one to the other is the
same step E15-D's own retraction of finding C warns against, so it was probed
instead of assumed.

| # | measured | result |
|---|---|---|
| A | cursor parked on gn-A; ONE batch: props A then props B | ✗ A lands, **B lost** |
| A2 | the same two ops as two batches, 400ms apart | ✗ A lands, **B still lost** |
| A3 | point B in its OWN request, settle, THEN props B | ● lands |
| B | write A + write B coalesced, settle, then props A + props B | ✗ **A lost**, B lands |
| B-ctl | the shipped INTERLEAVED shape (wA, pA, wB, pB) | ● both land |
| C | a props op that changes the grid in its own turn, note at beat 0 | ● lands |
| D | same as A2, but both clips hold a note at the SAME cell | ● lands on the ADDRESSED clip |
| D2 | the addressed clip has NO note at that cell | ● inert — creates nothing |

**One rule accounts for all eight.** `cursor.setNoteProps` resolves
`clip.getStep(x, y)` against the step data the cursor held when the TURN BEGAN,
whatever it re-points to inside that turn — but mutating the returned `NoteStep`
writes through to whatever the cursor points at NOW. So:

- A2 rules out the batch boundary: its own request and 400ms of settle did not
  help, because the re-point is inside the turn either way. **A props op that
  re-points is unreliable in any shape**, not merely in a shared stage.
- B looks backwards until the rule is applied: that turn started on gn-B (the
  last write), so gn-B's cell resolved and gn-A's did not — the SECOND op landed
  and the first was lost.
- A3 is why the shipped plan is correct, and it was previously accidental: each
  props stage follows the create stage for the SAME clip, so its point frames are
  a no-op and the turn starts where the lookup needs it. **That invariant is now
  stated in `planStages`' header**, because nothing in the code would have stopped
  someone optimizing it away.

**D and D2 bound the damage, and both were measured rather than reasoned about.**
The first hypothesis was that the properties land on the turn-start clip, which
would have been silent CROSS-CLIP corruption of the same class as E15-E's phantom
pressure. It is not: the write reaches the clip actually addressed, and a property
write against a cell with no note is inert. **Loss, not corruption** — bad, but
bounded, and it needs no contract-level refusal.

**A caller-facing gap found on the way, reachable in v0 today.** `planStages`
gives every `note.props` op its own stage, so a caller who hand-writes property
ops for two clips gets two turns and each one re-points — losing **both**, which
is worse than the hoisted shape. Not reachable through `note.write` (the generated
path always pairs a props op with its own create), and not refused either.
→ **Phase 1.**

**C refines E15-D rather than repeating it.** E15-D changed the grid in an EARLIER
request and measured the ~120ms window before a read was usable. Changing it in
the SAME turn as the read does not by itself poison anything: the note sat at
beat 0, which is step 0 on every grid, so the lookup resolved the same cell
whether or not the new grid had taken effect. Read with A2, that reshapes the
mechanism — what breaks a `getStep` is the cursor's step data being INVALIDATED
and not yet re-fetched, and a grid change that has not taken effect yet has
invalidated nothing.

**A latent v0 DEFECT found and fixed alongside.** `splitNoteWrite` filtered the
generated props op down to the notes carrying properties. Both stages derive their
grid from the notes they hold, so filtering could make the props stage COARSER
than the create — one note at beat 0 with `pan` plus one plain note at beat 0.5
gives grid 0.5 for the create and grid 1 for a filtered props op. The props op
then moves the grid in the same turn as its own `getStep` and loses everything,
with no error. The fix is that the props op carries the write's WHOLE note set, so
the two grids are identical by construction; a note with no properties costs
nothing (the encoder emits no frame for it). Verified failing without the fix, and
green live as conformance case `C-props` (mixed).

**Guarded three ways**, so the hoist cannot be re-derived from the plan doc: the
fake models the trap (`propsReadsTurnStartClip`), `stages.test.ts` asserts the
interleaving and its cost, and `probe:e15f` is the live regression. Offline suite
138 green; live conformance 19 pass / 0 fail / 3 skipped.

### Decision impact
- **Item 4 is CLOSED as ○** — the optimization is rejected with evidence, not
  deferred. N clips with expression cost 2N stages and N x `gridChange` (144ms),
  and that is the price of correctness until a mechanism exists to settle a
  re-point inside a batch.
- The turn-start rule belongs in `DECISIONS` alongside the batch mechanics (D6+).
- Standing rule 3 gains a clause: **a props op must not re-point.**

---

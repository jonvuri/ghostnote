# ghostnote spike — findings log

One section per experiment, appended as run. Verdicts: ● confirmed working /
◐ partial / ○ failed or unavailable.

---

## E20e — ⚠⚠ THE BRIDGE CLIENT CORRUPTED ANY NON-ASCII DATA: one line, found by accident [K] (2026-08-09)

**Verdict: ⚠⚠ a real data-corruption bug, diagnosed and FIXED.** Found while
measuring `getDocumentState()` capacity (E20d) as *"1 MB echoes come back two
characters longer, intermittently"*. It was never about 1 MB.

```ts
socket.on('data', (data) => this.handleData(data.toString('utf8')));   // ⚠ the bug
socket.setEncoding('utf8');                                            // ● the fix
```

**`BridgeClient` decoded every TCP chunk INDEPENDENTLY.** TCP hands over arbitrary
byte boundaries, so a multi-byte UTF-8 character straddling one was decoded as two
U+FFFD replacement characters — one per fragment. ⇒ **One character silently became
two, corrupting content and length together.**

### ⚠⚠ Why the "1 MB" framing was wrong, and dangerous

| | |
|---|---|
| what it looked like | a capacity limit at ~1 MB, intermittent, absent below 256 KB |
| what it was | **any reply carrying a non-ASCII character**, whenever a chunk boundary lands inside it |
| why size correlated | small replies arrive in ONE chunk. Nothing splits, so nothing corrupts. The 1 MB payload crossed ~16 boundaries and carried a `→` roughly every 100 chars |
| why it was intermittent | the boundaries are the kernel's choice, not ours |

⚠ **A track named `Café`, an em dash in a clip name, any CJK text** — all corruptible
at any size. ⚠⚠ **And standing rule 1 offers NO protection**: a readback travels the
same broken path as the write, so it agrees with itself. This is the one failure
class the project's central discipline cannot catch, which is why it survived 294
green tests and four live probe sittings.

### The regression tests, and what writing them taught

`brain/src/client.test.ts` — 4 cases over a **real loopback `net.Server`**, because
the bug lives in the seam between socket and parser and a fake handing over whole
strings cannot express it.

⚠⚠ **The first version of two of those tests was decorative**, and only a
both-directions check found that out (E17 method guard 10). With the bug
deliberately reintroduced they still PASSED — loopback coalesces back-to-back small
writes into one segment, so the split never happened. ⇒ The harness now waits 5 ms
between chunks, and all three UTF-8 cases fail with the bug and pass with the fix,
verified by reverting and restoring.

⚠ A third instance of the same reflex, in the harness itself: it originally parsed
the FIRST CHUNK as a whole request and blew up on a 200 KB one. **"One chunk is one
message" was assumed three times in one file** — by the client, by the test, and by
the harness. It is a comfortable assumption.

### ⚠ Found on the way, NOT fixed: a connect race

Two concurrent first requests both see `connected === false` and both call
`connect()` — opening two sockets, leaking one, and assigning request ids in
whichever order the connects resolve. Observed directly: `request('one')` resolved
with the reply to id 2. ⚠ An in-flight `connect()` is not memoised. **Recorded, not
fixed** — unrelated to the corruption this diff was for, and folding it in is how
the fix that matters stops being reviewable.

### Decision impact

- ● **The recorded wire ceiling is now 1 MB exact, 3/3 live**, and `e20d` scores it
  again rather than reporting it as a known flake.
- ⚠ **Nothing else changes** — no contract, no adapter, no probe result. Every
  earlier measurement was ASCII-only and therefore unaffected, which is luck rather
  than design.
- ⚠ **Owed**: the connect race above.

---

## E20d — ⚠⚠ `getDocumentState()` STORES 256 KB PERFECTLY AND KILLS BITWIG WHEN YOU TOUCH IT [K] (2026-08-09)

**Verdict: ● on all three storage ceilings, ⚠⚠ ○ on the one that decides the
design.** D18d's branch-event record was going to live in `getDocumentState()`, and
the question was assumed to be *how much fits*. It is not. Everything fits — and
the value is **DRAWN**, and drawing it is fatal. Probe `e20d`
(`sweep` / `verify` / `hidden`).

### The three storage ceilings — all of them pass

| ceiling | result |
|---|---|
| **the wire** | ● **262144 chars exact**, byte for byte, flat at **16–34 ms** across 1 KB → 256 KB |
| **the setting's declared `numChars`** | ● exact at **1024**, **8192** and **262144**, at ⅛, ½ and the FULL declared size — nothing silently trimmed at any of them |
| **the project document** | ● **262144 chars survived a save + a full application restart, byte for byte** (sha `80c44744220f831f` both sides) |
| init cost | ● **16.7 ms** at `recordChars=262144` — the allocation is not the problem either |

⇒ Storage was never the constraint. E14-A3's persistence result scales to a
quarter-megabyte without complaint.

### ⚠⚠ THE FINDING: interacting with the field HARD-LOCKS BITWIG

With `recordChars=262144` and the value written, the operator opened the panel:

> *"when I tried interacting with the panel field a bit, it ended up hard locking
> Bitwig. The panel dropdown rendered on top of other windows after switching away
> from Bitwig, and had a busy cursor when hovered, and the Bitwig process stopped
> responding until I force quit it."*

⇒ ⚠⚠ **The binding constraint on `getDocumentState()` is not capacity — it is that
a document setting is a HUMAN INPUT WIDGET, and Bitwig draws it.** All four checks
had just passed. A capacity sweep that only ran assertions would have recorded
*"256 KB ✓, ship it"* and handed D18d a design that force-quits the DAW.

⚠ **This is why the arm asked for a human reading at every size.** No assertion in
the probe could have caught it: the value stored, reloaded and hashed correctly at
every step. The operator also reported the field **lagging at 1024 chars** — the
smallest size tested — so the degradation is continuous and starts almost
immediately, with the hard lock at the top of the same curve.

⚠ Same *severity* class as E14-A1 (`Signal.fire()` taking the DAW down with an
unsaved project), reached by a different route: not an uncatchable async throw, but
a UI widget asked to render a payload. **Nothing extension-side can contain either
one.** `RigConfig.recordChars` now carries the warning at the field, and its
default of `0` is a safety default rather than a tidiness one.

### ⚠ The operator's hypothesis, and why it is the right question

> *"I think it might be fine as long as the state isn't represented in a visible
> field (if that's possible at all)."*

It is possible: E14 row C1 established that the undocumented `Setting` downcast
**works** — `hide()`/`show()`/`enable()`/`disable()` are reachable, and the cast was
verified genuine by reading `getLabel()` back through it. ⇒ `probe:e20d-hidden`
tests exactly this: hide the setting, then check the value still round-trips and
still persists.

⚠ **One consequence is already known without running it**: `hide()` is a RUNTIME
call and `init()` re-creates the setting **visible**. So a hidden record is not a
call you make once — it has to be hidden *at init*, in `UiPanel`, or every restart
re-arms the hazard. That is a one-line change and a design decision (rule 10),
not a probe.

### ⚠⚠ RESOLVED 2026-08-09 — the hide moved to `init()`, and both human checks are in

`UiPanel`'s constructor now hides the record setting the moment it creates it,
never as a later runtime call — the change flagged as owed above. Live,
`recordChars=262144`, controller reloaded by hand:

- ● **`probe:e20d-hidden`, re-run against the init-time hide**: H1 (the downcast
  works) and H2 (`hide()` accepted) both PASS as before, and H3 — a HIDDEN setting
  holds its value byte for byte — PASSES at the full 262144 chars, settled in 19 ms.
- ● **The two human checks this arm always asked for, and that were missing
  before**: confirmed by eye, after the hand reload, that the "Branch record" row
  is ABSENT from the panel and that the pane stays RESPONSIVE (opened, closed,
  hovered the other rows). "Hidden means safe" is now confirmed by looking, not
  inferred from the value surviving.
- ⚠ **One case this finding did not anticipate, added during the fix**: what
  happens when the `Setting` downcast itself fails? `UiPanel` now checks the cast
  first — against `statusText`, already created above, before `getStringSetting`
  is ever called for the record — and REFUSES to create the setting at all if the
  cast does not hold. A setting already created cannot be hidden retroactively
  (Bitwig's API has no "delete this setting" call), so the only response that
  cannot ship a visible hazard is to never mint it.

Implemented in `UiPanel.java`.

### ⚠ Two method findings, both from the same reflex

1. ⚠⚠ **`ui.set` is ASYNCHRONOUS, and a one-shot readback faked a capacity
   ceiling.** A 4096-char write read back as exactly **1024** characters — the
   length of the value written immediately before it — while 8192 passed on either
   side of it. Recorded naively that is *"the setting truncates at 1024"*, which is
   false; the tell was the SHAPE, not the number, because a real 1024-char ceiling
   cannot then pass 8192. ⚠ **It is intermittent** — a re-run had every first read
   already correct — which makes it worse: a one-shot readback is usually right and
   occasionally wrong. ⇒ Writes are now polled until they land and the **settle
   time is reported** (20–25 ms, one round trip). Same family as E2's observer
   gotcha and E15-B/D's 120 ms grid settle: standing rule 1 says readback is the
   only truth, not that it is instantaneous.
2. ⚠⚠ **The bridge appeared intermittently wrong at 1 MB** — payloads coming back
   two characters longer. ⇒ **DIAGNOSED AND FIXED THE SAME DAY, and it was ours:**
   `BridgeClient` decoded each TCP chunk independently, so a multi-byte character
   split across a boundary became two replacement characters. It was never a
   capacity limit and never about 1 MB — **any non-ASCII data was corruptible at
   any size.** See **E20e**, which is the more important finding of the two.

### Decision impact

- ⚠⚠ **D18d cannot put a large record in a visible document setting.** ● **DONE
  2026-08-09**: **the setting is hidden at `init()`**, keeping the record in the
  project document — which is what made `getDocumentState()` attractive in the
  first place (per-project, survives restart, E14-A3/A4). The other two options
  considered (a pointer/rolling window living elsewhere, or dropping the document
  setting as the record's home entirely) are no longer live.
- **Storage capacity is closed as a question**: 256 KB stores, reloads and survives
  a restart exactly. It should never be quoted as the ceiling again without the
  interaction hazard attached to it.
- ⚠ **E16-TRACK-NATIVE §4e's fallback** rested on this capacity being adequate. It
  is — and it now inherits the visibility constraint with it.

---

## E20c — ⚠⚠ CLAUDE CODE IGNORES TOOL ANNOTATIONS: D20's seam survives, its stated reason does not [K] (2026-08-09)

**Verdict: ⚠⚠ ○ on the mechanism, ● on the seam.** D20 rests its stop-and-ask on
*"the host's permission flow"* and flags the claim as **a spec reading, not a
measurement**. Measured now, and the reading is wrong: Claude Code does not appear
to read `destructiveHint` at all. Probe `e20c` — ARM A autonomous (7/7), ARM B the
operator in a live Claude Code session.

### ARM A — we emit them correctly, which is what makes ARM B interpretable

| tool | annotations, as they arrived at an MCP client |
|---|---|
| `gn_probe_write` | ● **none** — the baseline |
| `gn_probe_read` | ● `readOnlyHint: true, destructiveHint: false` |
| `gn_probe_destroy` | ● `readOnlyHint: false, destructiveHint: true` |
| `gn_probe_destroy_idempotent` | ● `destructiveHint: true, idempotentHint: true` |

⚠ Asserted **field by field**, not as "annotations exist": a host reads the field,
and an object that arrived with the wrong one set would still be truthy. Without
this arm, a host that did nothing would be indistinguishable from a server that
sent nothing, and the ○ below would have been recorded against the wrong component.

### ⚠⚠ ARM B — all four prompts are IDENTICAL

The operator called all four tools, baseline first, in a default-permission session:

> *"Claude Code treated all of the tool calls identically. It listed the tool name,
> description, and then prompted with 'Do you want to proceed?' with options 'Yes',
> 'Yes, and don't ask again for &lt;this tool in this project&gt;', 'No'. It didn't seem
> to have any indication of the tool annotations."*

⇒ ⚠⚠ **The annotation changes nothing.** The unannotated baseline prompted exactly
as the `destructiveHint` one did; `readOnlyHint` did not buy a quieter path;
`idempotentHint` did not soften anything.

⇒ ⚠ **But look at what the host DOES gate on** — *"don't ask again for **this
tool**"*. The permission grain is the **tool NAME**, per project. That is precisely
the grain D20's seam is built out of.

### What this does and does not cost D20

- ● **The seam stands, unchanged.** Destructive verbs on their own separately-NAMED
  tools is exactly what the host's permission model keys on, so *"the host's
  permission flow is the stop-and-ask"* remains true.
- ⚠⚠ **The stated reason must change.** D20 says the host prompts *because of the
  annotation*. It does not. It prompts because the call is a tool call, and it
  remembers per name. ⇒ **PROPOSED amendment** (rule 10 — proposed, not recorded):
  *"…because destructive verbs carry their own tool NAMES, which is the grain the
  host's allow-list actually uses. Annotations are sent, are correct, and are
  currently decorative."*
- ⚠ **A consequence worth stating before it bites**: *"Yes, and don't ask again for
  this tool in this project"* is a **per-name blanket grant**. D20 already accepts
  *"always allow"* as the operator's prerogative — this is what it looks like in
  practice, and it is the reason a destructive verb must never share a tool name
  with a benign one. Tool-surface granularity IS the permission granularity.
- ⚠ **Nothing inside our system gates a directed destructive call** (D20's own
  threat model: the confused agent, not a malicious client). That is unchanged, and
  now rests on the name grain rather than on a hint the host ignores.

### ⚠ Method note: the independent-evidence path did not work

The scratch server appends every call to a log so that what actually RAN can be
read back independently of what the host reported. The log showed only ARM A's own
entry. ⚠ Cause: `os.tmpdir()` resolves differently per environment, so the server
spawned by the host wrote its log somewhere other than where it was read.

⚠ **Recorded rather than patched**, and the finding does not depend on it: the
question is what the host DREW, and a human report is the correct oracle for that —
it is the same oracle every E14 row used. The wart is that the corroboration was
designed in and then silently missed its target, which is worth knowing before
another probe leans on the same trick.

---

## E20b — ⚠⚠ `duplicateClip` OVERWRITES the next row when it is occupied, and the observers CANNOT SEE IT [K] (2026-08-09)

**Verdict: ●● 11/11, and two of the passes are warnings.** The primitive that
mints the next take, run for the first time. It works, it is self-reporting when
the row below is free — and when the row below is *not* free it destroys what is
there, silently, in a way session 3's detector is structurally blind to. Probe
`e20b` (autonomous, silent, never launches anything).

### Where the copy lands

| | |
|---|---|
| `ClipLauncherSlot.duplicateClip()` (route "slot") | ● copy landed in **the next row down** (source row 10 → row 11) |
| `ClipLauncherSlotBank.duplicateClip(int)` (route "bank") | ● **agrees exactly** — same destination row |
| the source | ● still there: a duplicate is not a move |
| the copy's contents | ● carries the source's notes (pitch 60 read back through a third cursor) |
| the observers | ● arrives as a **FILL naming the track by `channelId`** — the block's geometry is self-reporting, through session 3's durable-identity path |
| the UI selection | ● irrelevant: the duplicate landed with the selection parked on row 0. An addressed API call, unlike the named actions E6 banned |

⚠ **Two routes, per standing rule 10**, because sibling verbs on these interfaces
have disagreed before (`copyDevices` ○ beside `moveDevices` ●). Here they agree,
which is what makes "the next row down" a property of the operation rather than of
one method.

### ⚠⚠ THE FINDING: into an OCCUPIED row, it OVERWRITES

The design listed two possibilities and the probe's first draft tested for them:
**append** past the block, or **insert** — shifting every row below and staling
every address, E18-VERDICT §4b's named hazard. ⚠ **Neither happened.**

```
before:  row 10 = pitch 60 (source)   row 11 = pitch 72   row 12 = empty
after:   row 10 = pitch 60            row 11 = pitch 60   row 12 = empty
```

⇒ ⚠⚠ **The clip that was in row 11 is GONE.** Not pushed down — row 12 is still
empty. Not refused. Overwritten.

⇒ ⚠⚠ **Minting a take destroys whatever is in the next row**, which makes an
empty next row a **hard precondition** on `duplicateClip`, in the same class as
the bank-window budget (standing rule 5) rather than a nicety. Session 3″ must
verify before it mints; an agent that calls this without checking destroys a clip
nobody authorised, and D20's execution discipline — *enumerate the cascade by
identity before any delete* — applies to an operation whose name contains no verb
about deleting.

### ⚠⚠ And the launcher-content observer is BLIND to it

`E20b-B3c`: the overwrite fired **zero** occupancy events. Of course it did —
occupancy did not change, an occupied slot stayed occupied — but the consequence
is sharp:

> **A destructive structural op is invisible to the change window.**

This is the `moved` verdict's motivating case one step worse. Session 3 built
`moved` because a clip dragged out and an identical one dragged back compares
EQUAL byte for byte; here the contents are **different** and the window is still
empty. E19-A7 established that silence means "no occupancy change" and treated
that as the detector's whole value; this is the other edge of the same knife.

⇒ **For 3″**: the stash cannot learn about this after the fact. The protection has
to be the precondition, plus stashing the destination row's contents *before*
minting if the block ever mints into ground it did not verify.

### ⚠ Method note: the probe grew the grid rather than clearing anyone's rows

gn-A's column was full — rows 0–9 all occupied by the fixture, `e16s`, `e19` and
`e20a`. Two disciplines, both worth keeping:

- ⚠ **It refused to delete to make room.** A clip in a shared column is more
  likely the operator's than ours, `slot.delete` is not undoable by us, and D19/D20
  put destruction outside what a probe decides.
- ⚠ **It appended three scenes instead, checking the budget FIRST** (10 scenes, a
  16-wide window ⇒ budget 6), used rows 10–12, and gave them back **from the end**
  — because `Scene.deleteObject()` compacts upward (E3), so deleting a trailing row
  moves nothing while deleting a mid-grid one stales every address beneath it.
  That is E18-VERDICT §4b's append-only geometry, exercised by the probe that was
  measuring it.

### Decision impact

- ⚠⚠ **New precondition for the clip block (session 3″)**: `duplicateClip` may only
  be called when the destination row is verified empty. Belongs in the tool
  description as a mechanical fact under D18c ("*correctness recipes are required
  knowledge*"), beside the bank-window budget.
- **E18-VERDICT §4b's append-only discipline is CONFIRMED as necessary**, and for a
  sharper reason than it gave: the hazard is not that a mid-grid insert shifts
  addresses — Bitwig never inserts — it is that a duplicate into occupied ground
  eats a take.
- ⚠ **Session 3's `ContentDelta` gains a documented blind spot** to sit beside the
  bank-window one (session 3 carry-forward B2): content changes that preserve
  occupancy are invisible, and at least one of them is destructive.

---

## E20a — ⚠⚠ `continue_or_synced` CONTINUES FROM THE OUTGOING CLIP: E18-VERDICT §4a″-bis is confirmed by measurement, and per-call quantisation is real [K] (2026-08-09)

**Verdict: ⚠⚠ ●● 12/12.** The clip half's most valuable unclaimed primitive,
`launchWithOptions(quantization, launchMode)`, run for the first time. Both of
E18-VERDICT §4a″-bis's claims hold, and the second one — the one nothing else in
the design can imitate — is now a number rather than a javadoc reading. Probe
`e20a` (PART A autonomous, 12 checks; PART B ⚠ operator, owed).

### The launch-mode matrix — what each mode actually means

⚠ **Take A is launched deliberately OFF the grid** in T1–T5 (unquantised, mid-bar),
because that is the only condition under which the three candidate meanings of
"continue" are separable. On the grid they COINCIDE, which is why this hid.

| trial | mode | take A was at | B came in at | nearest prediction |
|---|---|---|---|---|
| T1 | `synced` | step 46 | **48** | ● the transport grid (predicted 48, exactly) |
| T2 | `from_start` | 46 | **0** | ● the top of the clip |
| T3 | ⚠⚠ `continue_or_synced` | 46 | **47** | ⚠⚠ **A's position** (1 away; the transport grid was 31 away) |
| T4 | `continue_or_from_start` | 46 | **47** | ⚠ **A's position** (1 away; both alternatives 17 away) |
| T5 | `continue_or_synced`, ⚠ B primed near the top | 46 | **47** | ⚠⚠ **A's position** (1 away; **B's own last position 17 away**) |
| T6 | `continue_or_synced`, ⚠ A ON the grid | 31 | **32** | ● A's position — and 32 steps from the top |

⇒ ⚠⚠ **"Continue" means the OUTGOING clip's position, not the incoming clip's own
last position and not the transport grid.** T5 is what separates the first two:
take B was run to the top of its clip and stopped there, and it still came in
where take A was. **This is exactly what E18-VERDICT §4a″-bis claimed**, and it was
a javadoc reading until now.

⇒ **T6 is the one the design rests on.** With take A launched normally — on the
grid, like everything else — take B comes in **where take A was**, 32 steps from
the top of the clip. That is E16m's request delivered: *the same bar, rendered
differently*, rather than a jump back to the top of the loop. ⚠ No mute, solo or
chain switch can imitate it.

### Quantisation is a genuine per-call override

| | |
|---|---|
| `"1"` fired at beat 1.04 | started at beat **4.02** — 0.02 off the bar line, after waiting **1567 ms** |
| `"none"` fired at beat 5.06 | started at **5.38** — 1.38 off the bar, after **121 ms** ⚠ the control |
| `"8"` | started at beat **32.01**, after **14266 ms** — the 8-bar grid, and materially longer than `"1"` |
| the pending state | ● `isPlaybackQueued` observed true before the switch, so a scheduled launch is distinguishable from a call that did nothing |

⚠ **Both quantisation arms fire deliberately mid-bar.** A launch fired near a bar
line lands near one whatever its quantisation, so the `"none"` control could
otherwise pass the `"1"` assertion by luck.

⚠ **The 8-bar phrase's PHASE is recorded, not asserted**: nothing in the javadoc
says whether a phrase counts from the timeline origin or the last transport start,
and asserting a guess would manufacture a finding.

### ⚠ Free, and it matters to session 3: a launch is not an edit

`E20a-A7` — launching clips fires **no occupancy events at all**. Session 3's
detector rests on silence meaning something; an A/B session that reported itself
as a stream of concurrent edits would have made it worthless within a day. It does
not.

### ⚠⚠ TWO PROBE BUGS, and the first one produced a consistent matrix of nothing

Both are worth more than the result they nearly spoiled, because both are shapes
that recur.

1. ⚠⚠ **A pre-existing ONE-BAR clip silently became take B.** `ensureTake` created
   a clip only when the slot was EMPTY and accepted whatever was already there
   otherwise — so row 5's leftover 4-beat clip was adopted, and *this probe's own
   header* says a clip shorter than the launch grid makes the arms undecidable:
   the switch always lands where the loop restarts, so `continue_or_synced` and
   `from_start` are identical **by construction**. The first run reported
   `continue_or_synced` entering at step 15 against take A at 32 and looked like a
   real negative refuting §4a″-bis.
   ⇒ **Standing rule 1 applies to the SETUP, not only the result.** The fix reads
   `loopLength` back through a cursor and replaces a clip of the wrong length, and
   an `E20a-S1` check now refuses the whole probe rather than measuring.
2. **The on-grid trial was DEGENERATE.** With take A synced and the switch on a bar
   line, take A sits at a multiple of 16 steps when the handover happens — so
   "A's position", "the transport grid" and "the top of the clip" all named the
   same step (measured: A at 63 handing to B at 0, all three predictions within 1).
   ⇒ The trial now fires inside a **window** whose next bar line falls mid-clip.
   A control that can accidentally agree with the experiment is not a control, and
   this is that failure one level up: a *trial* that cannot disagree with itself.

⚠ **The diagnostic that found bug 1 is worth keeping** (`probe:e20a-diag`). It
asks one question — does `Clip.playingStep()` track a launcher clip's playhead? —
and answered it with a per-cursor time series. It **vindicated the instrument**
(cursor 0 swept 0→62 while its clip played and read **−1** while the other clip
played, and vice versa: `playingStep` is a per-CLIP playhead, not a per-track one)
and caught the wrong clip length in passing. Three false ○s in E17 came from being
unable to tell a broken handle from a real negative; this is the cheap version of
not repeating that.

### What it closes, and what it does not

- ● **E16m is answered, and with a knob**: beat-aligned A/B, at bar or phrase
  granularity, chosen per call.
- ● **§4a″-bis's `"continue_or_synced"` claim is measured**, so the clip block's
  ergonomic case no longer rests on a reading.
- ○ **Unattendedness is still not ours.** `launchWithOptions` is a VERB — every
  switch needs a caller — and Next Actions are not in the API (§4a″). Nothing here
  changes that, and this probe deliberately measures none of it.
- ● **THE EAR AGREES WITH THE NUMBERS** (`probe:e20a-ear`, 2026-08-09, master peak
  **84** so the refusal-on-silence guard passed rather than being skipped):

  | | operator |
  |---|---|
  | did the switch land cleanly on a bar line? | ● **yes** |
  | did take B come in PART-WAY THROUGH rather than restarting? | ● **yes** |
  | is this the A/B you asked for in E16m? | ⚠ verbatim: **"Yes."** |

  ⚠ **The takes had to be rewritten for this arm to mean anything.** They were a
  note on every beat at a constant pitch — so every bar sounded like every other
  bar and *"did it come in part-way through?"* had **no audible answer**; the
  operator would have been asked to report something they could not hear. The takes
  are now RISING lines (A from pitch 60, B the same shape an octave up), which
  makes position audible: a take entering at bar 3 enters high. E16m was a
  complaint made by ear, and this is its answer in the same currency.

### Decision impact

- **D18's clip block keeps its justification**, now evidenced. `launchWithOptions`
  and its two working modes are the mechanism session 3″ should design the block's
  A/B around.
- ⚠ **New, for 3″**: the A/B is position-continuous **only when the outgoing take
  is itself on the grid** — which is the ordinary case, and worth stating in the
  tool description as a mechanical fact rather than discovered later as a bug.

---

## E19 — ⚠⚠ THE OBSERVERS ARE PRODUCT-GRADE: a human clip drag is a PAIR by DURABLE identity, and a note write is SILENT [K] (2026-08-08)

**Verdict: ⚠⚠ ●● 21/21 across three arms** (PART A ×15, PART B drag ×5, PART B
project-change ×1). Phase 1 session 3's mechanism, live. Probe:
`e19` (PART A autonomous, 12 checks) and `e19-arm`/`e19-read` (PART B, human drag,
5 checks). Everything was already green offline (`observers.test.ts`, 11 cases) and
portably (`C-mark`/`C-content`); what only Bitwig could answer is below.

### PART B — the drag, re-measured through the new path

The operator dragged a clip from scene row 6 to row 7 on `gn-A`:

```
{seq:307, channelId:"d61c23c2…", slotIndex:6, filled:false}   ← source emptied
{seq:308, channelId:"d61c23c2…", slotIndex:7, filled:true}    ← destination filled
```

| | |
|---|---|
| ⚠⚠ **the PAIR** | ● source-empty then destination-fill, in that order — E16s reproduced through the durable-identity log |
| ⚠⚠ **the SCENE epoch** | ● **sat still: 7 → 7** through the whole move |
| ⚠ attribution | ● both events named the track by `channelId`, not a bank row |

⇒ ⚠⚠ **The asymmetry that justifies carrying two epochs is confirmed, not
inherited.** A move changes no scene count. If clip addressing consulted the count
epoch it would resolve a positional address that no longer means what it meant, which
is the silent mis-write the epoch exists to prevent (E3, D16a).

### PART A — the three things the fake could not vouch for

| | |
|---|---|
| ⚠⚠ **a note write into an OCCUPIED clip fires NO occupancy event** | ●● `E19-A7`, empty window |
| ⚠ the log names the track by DURABLE `channelId` | ● `E19-A6`, captured at callback time |
| the generation nonce is per `init()`, not per request | ● `E19-A3` |

⇒ ⚠⚠ **The load-bearing negative is `E19-A7`.** The detector's entire value is that
silence means something: if Bitwig fired content callbacks on note writes, every batch
would report itself as a concurrent edit and the mechanism would be worthless within a
day. It does not.

### ⚠⚠ What PART A cost on the way: STANDING RULE 5 IS NOT IMPLEMENTED FOR SCENES

The first run crashed in its own cleanup against a **99-scene** project:

```
scene.delete { sceneIndex: 99 }
→ Internal error: Parameter index (=99) must be in the range 0 to 16
```

| | |
|---|---|
| `sceneBank.itemCount()` | ⚠ **99** — the PROJECT total, exactly as `trackBank.itemCount()` behaves (E15-A) |
| `sceneBank.getScene(i)` | ⚠ bounded to the **16-wide WINDOW** |

⇒ ⚠⚠ **`scene.create` appended at project index 99, outside the window, where nothing
can address or delete it.** There is no scene-bank scroll handler, so the scene was
STRANDED and had to be removed by hand. That is rule 5's named failure verbatim —
*"a create past the window mints a [row] nothing shows — unaddressable, un-cleanable…
'detect and fail' runs after the damage"* — one level down from the population the
rule was written about.

⚠ **It is a PRODUCT defect, not a probe one.** `encoder.ts` sends
`op.scene.index` straight through as a bank index, so a `SceneAddress` at index ≥ 16
throws identically from a real batch; `assertBankVisible` covers tracks only, and
there is no scene budget anywhere. ⚠ And the consequence that is worse than the
throw: on a project with more scenes than the window, **clip rows past the window are
unaddressable and `Snapshot.unreachable` does not say so**, because the blind spot is
computed for tracks alone. Session 3's own observers inherit it — one indexed observer
per bank row covers only slots inside the window, so a human drag below the last
visible row is undetectable.

⚠ The probe now checks the budget BEFORE creating and skips the arm with an
explanatory failure. **The product fix is OWED and not built** (see PHASE-1 §Re-plan
session 3, and rule 5 — it is an existing decision to implement, not a new one).

### ⚠⚠ PART B, second arm — A PROJECT CHANGE HAS NO NUMERIC TELL, and it fires on a TAB SWITCH

Armed in one project, read in another, extension untouched in between:

```
armed in  "gn-scale-test"              contentEpoch 296
read  in  "Channel UUID test project"  contentEpoch 329     generation UNCHANGED
```

⇒ ⚠⚠ **The epoch CLIMBED by 33.** The prediction was that a project load leaves the
counters running (the extension never re-`init()`s) and this measures it: a stale
mark's window is a perfectly ordinary busy one, same generation, nothing numeric out
of place. Contrast the extension reload measured in the same sitting, where the
counters came back **LOWER** (308 → 290, 7 → 2) — anomalous on its face, and what
`generation` catches. Two different discontinuities, two different tells, and only
one of them is visible in the numbers at all.

⇒ ⚠ **`RevisionMark.project` is therefore load-bearing and not belt-and-braces.**
Without it, 33 events of "the human was busy" is indistinguishable from "every
`channelId` you hold names a track in a project that is not open".

### ⚠⚠ It follows the FOREGROUND project, not the audio engine — so a TAB SWITCH fires it

The operator reported, unprompted, that `gn-scale-test` stayed open in the background
**and kept the audio engine** (the new project showed *Activate Audio Engine*). The
extension nonetheless reported the FOREGROUND project's name.

⇒ ⚠ **The detector fires on a tab switch, not merely on a project load** — a far more
common act, and one no design note anticipated. Good for safety: the dangerous state
is "our addresses belong to a project the user is no longer looking at", and that
begins at the switch. ⚠ Worth carrying as a COST too: `undecidable` will appear more
often than "project loads" would suggest, and a mechanism that cries wolf is one
nobody honours (the same argument that keeps our own slots out of `concurrent`).

⚠ **Narrow claim, deliberately.** What is measured is that `Application.projectName()`
tracks the foreground project. That the BANKS re-scope with it is strongly implied by
the 33 events (initial values re-delivered for the new project's clips) but is not
directly asserted — rule 10, and it is one probe away for whoever needs it.

### ⚠ The instrumentation lesson: `contract.hello` CANNOT detect a stale extension

The first PART A run after deploying failed `E19-A11a/b` against a jar Bitwig had not
picked up — and `probe:hello` had passed immediately before, all green, 135 methods,
`methodsHash` matching the golden.

⇒ ⚠⚠ **`methodsHash` is over method NAMES.** Every field added this session —
`generation`, both epochs, `contentEvents`, `project` — is invisible to the handshake,
so a change that adds fields to an existing method's reply passes a stale check. The
accidental tell was the **generation nonce reading byte-identical to the previous
run**; nothing was designed to catch it.

⇒ ⚠ **Owed: a build stamp in `contract.hello`** (jar mtime or a gradle-injected id) so
`Session.ready()` refuses a build the brain was not compiled against, the way it
already refuses a contract-version mismatch. ⚠ And a deploy is **not** a reload:
`copyExtension` lands the file, and the controller must be reloaded by hand in
Settings → Controllers. `build.gradle`'s comment overpromises hot-reload.

⚠ **A second, sharper lesson, found the same way.** `E19-A11c` was written as
`(await mark()).project === m0.project` and **PASSED** against the stale extension —
`undefined === undefined` — reporting green beside the two FAILs that were telling
the truth. A check that passes when the thing under test does not exist is worse than
no check. It now requires a real non-empty value AND stability. (Method guard 10's
converse: a control that cannot fail is not a control.)

### ⚠ Still not measured

- **A CROSS-TRACK drag.** Both PART B drag runs moved a clip within one track (6 → 7,
  then 6 → 2), so both events carried the same `channelId`. The two-track case should
  produce two different ones, and the mechanism is the same indexed observer per bank
  row — but that is an inference, and this file's rule is that an inference is not a
  measurement (rule 10).
- **A drag below the bank window**, which the finding above predicts is invisible.
- **Whether the BANKS follow the foreground project**, as distinct from
  `projectName()` doing so.

## E18h — ⚠⚠ THE VERB DECIDES: a MOVE-based rebuild is SILENT, a COPY-based one is not [K] (2026-08-03)

**Verdict: ⚠⚠ ●● perfect separation across all four arms, both gates passed.** A
layer rebuild CAN be performed silently during playback — which a track fork cannot.
Probe: `e18h`, run 3 (runs 1 and 2 are the method record below).

| arm | heard | |
|---|---|---|
| ⚠ **REBUILD-COPY** — instantiates a SECOND plugin instance | ⚠ **2/2** | audible |
| ⚠⚠ **REBUILD-MOVE** — relocates the EXISTING instance | ⚠⚠ **0/2** | **SILENT** |
| ⚠ **PLACEBO** | **0/2** | the listener is not pattern-matching |
| ⚠ **CONTROL** — fork `gn-E16`, E16 C5's fixture | ⚠ **2/2** | the rig resolves a glitch |

⇒ ⚠⚠ **THE OPERATOR'S MECHANISM IS CONFIRMED, by a clean discriminator:**

> **Instantiating a plugin is the audible event. Relocating an existing one is free.**

The two rebuild arms are byte-identical except for one parameter — `verb: 'copy'`
versus `verb: 'move'` — and they separate 2/2 against 0/2 with the control firing and
the placebo clean **in the same sitting**. That is the strongest shape this spike has
for an ear result.

### ⚠⚠ What it changes: layers WIN this row, and it is the first row they win outright

| | glitch on a structural branch change |
|---|---|
| track fork | ⚠ **5/5 audible (E16 C5)** — and there is no silent variant |
| ⚠ **layer rebuild via MOVE** | ⚠⚠ **●● SILENT** |
| layer rebuild via COPY | 2/2 audible — parity with the fork |

⇒ ⚠ **This partly offsets `e18f`'s 7-undo-step cost**, which is the row layers lose.
A take system that can restructure without a click during playback is doing something
the track model cannot do at all.

### ⚠ The TRADE-OFF is real, and one half of it is NOT measured

`MOVE` is silent but the device leaves its source chain; `COPY` never drops it but
instantiates. ⚠ **The "gap" has NOT been measured and must not be reported as if it
had.** The audio in every trial was playing on a track OTHER than the one carrying
the rebuild — deliberately, to isolate the ENGINE-wide event from the doubling that
forking `gn-E16` would otherwise produce. So:

- ⚠ **measured:** a MOVE-based rebuild causes no engine glitch anywhere in the project.
- ⚠ **NOT measured:** whether the migrated take's OWN output has an audible hole while
  it is between containers. That needs audio running through the container being
  rebuilt, and it is a different probe.

⇒ **Record both, decide neither** (rule 10). The choice between an audible click and a
possible momentary hole is the user's, and it cannot be made until the second half is
measured.

### ⚠⚠ The method record: two earlier runs, and both failures were the instrument

**Run 1 — VOID.** Control 0/1. The operator diagnosed it:

> *"The control likely didn't glitch because before we were using heavy tracks with
> Zebra instances… Glitching is most likely a function of heavy plugin
> initialization, and maybe unpredictable even then."*

The record confirmed it — **E16 C5's 5/5 forked `gn-E16`, "two Zebra3s and a
Polysynth"**, while run 1 forked four NATIVE devices. ⚠ And the consequence was
bigger than the control: run 1's REBUILD arms were light too, so a passing control
would still not have tested the realistic case.

**Run 2 — VALID but CONFLATED, and the fault was the probe's.** Gates passed (placebo
0/2, control 2/2) and both rebuild arms read 2/2 — but `buildOld()` ran INSIDE the
measured window:

    clear previous → insertFile 4-chain preset → insert Zebra3 → insertFile a 2nd
    preset → migrate → delete old
    └─────────────── FIXTURE, ~3.4 s ──────────────┘ └── the rebuild ──┘

⚠ Roughly half the window was setup, containing the heaviest instantiation in the
probe. So `MOVE` reading 2/2 measured the fixture build, not the verb — **the
discriminator never ran**, and reading those equal columns as "the verb makes no
difference" would have been exactly wrong. Run 3 moved setup outside the window
(judged window: migrate + delete-old, **1.73 s**) and the columns immediately
separated.

⚠ **Three runs, two thrown away, and neither for a wrong answer** — one fixture too
light to fire the control, one window too wide to attribute. Both were caught by
gates the probe carried from the start rather than by re-reading the numbers
afterwards, which is the only reason run 3's separation can be trusted.

⚠ A blindness leak was closed on the way: rebuild arms ran ~5 s against the control's
~0.9 s, so a question arriving early told the listener which arm they were on. All
arms are now padded to a fixed 7 s.

---

## E18e — ⚠⚠ MODULATION SURVIVES EVERY RELOCATION — and the fixture that proves it had to be BUILT [K] (2026-08-02)

**Verdict: ⚠⚠ ●● 3/3 legs.** The scariest item on §3.1's list, because the failure
mode was *silent*: a take whose filter quietly stops moving, with no error anywhere.
It does not happen. Probe: `e18e`; fixture built by
`src/tools/build-e18-modfixture.ts`.

| leg | move | rebuild step | max divergence | |
|---|---|---|---|---|
| baseline | (none) | — | **0.00357** | ● |
| 1 | top level → chain `A0` | the patch entering a take container | 0.00239 | ●● |
| 2 | ⚠ chain `A0` → chain `B0`, **different containers** | **reduce** | 0.00303 | ●● |
| 3 | ⚠ chain `B0` → top level | **collapse** | 0.00359 | ●● |

⇒ ⚠ **A modulator riding on the relocated device keeps working**, across containers
and back out to top level.

### ⚠⚠ The instrument was the whole problem, and two of them had to be fixed

**1. Every modulator fixture on disk was UNROUTED.** An offline read settled it —
`mp_one_lfo` `routes=0`, `modzoo` `routes=0` ×2, `mp_one_random` `routes=0`. They
modulate **nothing**. That is not a defect: they were built for `bwmod` FORMAT work
(E11/E13), where the question was whether a modulator *loads*. ⚠ **But a relocation
probe run on them would compare 0 against 0 before and after and report "modulation
survived"** — the emptiest false ● available. The fixture is now authored:
`addModulator` with a routed donor aimed at `CONTENTS/F1FREQ` at amount 1.0, the
route read back out of the written bytes before the file is accepted.

**2. The oracle only saw one remote page.** Liveness had only ever been readable via
`remote.list`, which exposes the 8 controls of the **selected** page — so asking
*"is this parameter modulated"* meant guessing which page it lives on and scanning.
`param.list` now carries `modulatedValue` beside `value` for the 16 named handles,
making it a direct comparison on `F1FREQ` — the same parameter `e18c` marks for its
state check. No new wire method; `modulatedValue` was already marked at init by E7.

### ⚠⚠ The FLOOR is measured, not asserted — and the first draft got it wrong

The probe originally hard-coded a floor of `0.01` as *"safely above noise"*. A live
check then showed the authored fixture swinging only **±0.0036** — real, repeatable
modulation that the gate would have discarded as *"no fixture modulates"*, **turning
a working instrument into a false blocker.**

⚠ **The right framing is not "big vs small", it is "non-zero vs EXACTLY zero":**

| arm | max divergence |
|---|---|
| ⚠ **NEGATIVE CONTROL** — an unrouted modulator | ⚠⚠ **0.000000** |
| `gn_mod_lfo-sampler` (authored, routed) | **0.00357** ● |
| `gn_mod_vibrato-poly` (authored, routed) | ⚠ **0.00000** ○ |

An unmodulated parameter reads `modulatedValue == value` **exactly**, so the
discrimination is ~3600:1 and the small absolute number costs nothing. The negative
control establishes that in the same sitting rather than trusting a constant.

⚠ **Building TWO candidate fixtures paid for itself.** Whether a modulator *runs at
rest* is not knowable offline — an LFO free-runs, a Vibrato apparently wants voices.
`vibrato-poly` loaded correctly, validated correctly, routed correctly, and produced
**exactly zero** movement. Had it been the only fixture, the row would have reported
a blocker instead of an answer.

### ⚠ Scope — stated so this is not over-read

This measures a modulator **on the device being moved**, routed to **its own**
parameter. It does **NOT** measure E11e's cross-device form — a modulator on the
**outer container** routed into a chain, whose Ramona path is
`…/DEVICE_CHAIN/<deviceIndex>:CONTENTS/<PARAM>` and therefore **encodes a device
INDEX**. ⚠ That is precisely the path a rebuild could renumber, and it remains owed.
The green result above says nothing about it.

---

## E18g — ⚠ CHAIN-LEVEL state: colour is re-appliable, and a chain has NO SENDS AT ALL [K] (2026-08-02)

**Verdict: ⚠ colour ●● / sends ○ — and the ○ CLOSES the row rather than failing it.**
Relocating devices carries the devices and nothing else, so every chain-level
property is something a rebuild must re-apply or silently lose. Probe: `e18g`.

| | result |
|---|---|
| colour readable + writable, **per-chain** | ⚠ **●●** — wrote `0.83,0.17,0.42`, read back `0.827,0.169,0.416`; the sibling chain unmoved |
| ⚠ **a chain's SENDS** | ⚠⚠ **○ THERE ARE NONE** |
| chain state carried by a device migration | ⚠ **○ NO** — `B0` kept its default `0.341,0.380,0.776` |
| …but re-appliable onto the destination | ● yes |

### ⚠⚠ A `DeviceLayer` has no send bank, and Bitwig says so out loud

    layerSendsStatus = FAILED@0: No send bank exists: Requested a send bank size of 0

⚠ **`Channel.sendBank()` does not return an EMPTY bank on a layer — it refuses to
create one.** That is a far stronger negative than a silent no-op: the API is
*stating* the capability is absent rather than quietly doing nothing, which is E6
blocker 4's entire problem. It is also one more instance of the rule E17 established
— **an inherited member is a claim, not a capability** (`deleteObject()` is inherited
and refuses; `duplicateObject()` is inherited and refuses).

⇒ ⚠ **This CLOSES the sends half of the row: a rebuild cannot lose what does not
exist.** It also fits the model — a layer chain is not a mixer channel routed to FX
buses. ⚠ **A TRACK fork, by contrast, does carry sends** (E16d), so this is a real
difference between the two branching models rather than a non-issue.

⚠ **The gate needed THREE readings, not two, and this is the transferable part.**
`marked:N` means the bank exists; *"No send bank exists"* means **Bitwig answering the
question**; anything else is OUR failure. Collapsing the last two would have let an
instrument fault be published as a capability ○ — the exact mistake standing rule 13
exists to prevent, and the one that produced three false ○s in E17. The raw status
string is recorded so the reading can be audited rather than taken on trust.

### ⚠ What it means for the rebuild

⇒ **The rebuild is not "move the devices".** It is *move the devices AND re-apply
every chain property that was set* — name, mute, solo, volume, pan and colour.
⚠ **`e18f` measured that every call is another undo step**, so each property restored
is one more step between the user and their single Cmd-Z. The costs compound, and
colour is the cheap end of that list.

---

## E18f — ⚠⚠ ONE REBUILD IS SEVEN UNDO STEPS: the first real cost of the layer model, and it is a UX one [K] (2026-08-02)

**Verdict: ⚠⚠ the rebuild WORKS and it is EXPENSIVE in the one currency the operator
named.** `e18c` proved the mechanism; this runs the `reduce` shape end to end and
measures the three properties that decide whether it ships. Probe: `e18f`.

| | measured | reading |
|---|---|---|
| **COST** | **4276 ms** for 4→2 carrying 2 devices, 6 steps | tolerable, and the delete dominates |
| ⚠⚠ **UNDO** | ⚠⚠ **7 steps for ONE rebuild** | ⚠ **the real regression** |
| **ATOMICITY** | ⚠ **6 of 7 intermediate states hold BOTH containers** | one Cmd-Z lands mid-migration |

### ⚠⚠ The rule, and it generalises well beyond this row

    ONE STRUCTURAL API CALL = ONE UNDO STEP.

The trail is exactly legible against the six rebuild steps, in reverse:

| undo | what came back |
|---|---|
| 1 | the OLD container (un-deletes it — both now present) |
| 2 | `NEW1`'s migrated device |
| 3 | `NEW0`'s migrated device |
| 4 | `NEW1`'s name → `Layer 2` |
| 5 | `NEW0`'s name → `Layer 1` |
| 6 | the second chain (2 → 1) |
| 7 | the FX Layer itself |

⇒ ⚠⚠ **The user's single Cmd-Z does not undo "the take change" — it lands INSIDE the
migration**, with the old and new containers both present and the takes duplicated
across them. Under the TRACK model a branch is one operation and one Cmd-Z, and
**that is the comparison that decides this**.

⚠ **Not fatal on the operator's own bar** — *"it doesn't need to be perfect — track
branching isn't either"* — but it is a per-use cost the track model does not have,
and it is **invisible until the user hits undo once**. That makes it the same shape
as E17's priming hazard: a precondition nobody can see.

⚠ **It also reaches past this row.** Any multi-call operation we ever perform costs
the user N undo steps. That is a general property of the wire, measured here for the
first time, and it applies to the track model too wherever a gesture is more than one
call (fork + rename + lineage group = 3).

### Cost, stated so it is not over-read

| step | ms |
|---|---|
| insert the NEW container (FX Layer) | 777 |
| grow to 2 chains (`layer.select` + `duplicateChannel`) | 805 |
| name the 2 takes | 398 |
| migrate `OLD0` → `NEW0` (copy, across containers) | 297 |
| migrate `OLD1` → `NEW1` (copy, across containers) | 306 |
| ⚠ **DELETE the old container** | ⚠ **1688 — the single most expensive step** |

⚠ **These are WALL-CLOCK and settle-inclusive, poll-quantised at 200–250 ms, not API
latencies.** E17 measured `Device.deleteObject()` at 577 ms, so the 1688 above is
inflated by our own settle policy. Two honest readings: as *"how long the user
waits"* the wall clock is the right number; as *"what Bitwig costs"* it is an upper
bound. ⚠ **The migrations themselves are the CHEAP part** (~300 ms each), so cost
scales gently in the number of devices and is dominated by the fixed container
insert/delete — which is the good news in this table.

### ⚠ Method: the undo arm walks a PROJECT-WIDE stack, and that is dangerous

`app.undo` knows nothing about our fixture. Firing it blindly can undo the
**operator's own work**, which would be an unrecoverable side effect of a
measurement — by far the worst thing this probe could do. Four rails, all held:

1. A full **cross-track fingerprint** before the first undo — track list by identity
   plus the device list of every other track, ⚠ including `gn-A`, the Master and
   `FX 1`, which earlier probes **this same session** wrote to and which a runaway
   undo would reach first.
2. After EVERY undo, everything outside `gn-B` must be byte-identical; the moment it
   is not, the probe **redoes immediately** and aborts with a bound rather than an
   exact count.
3. A hard ceiling of 40 undos.
4. ⚠ Every undo **redone** at the end — verified: `gn-B` returned to the rebuilt
   shape and the outside world was untouched. **Measuring must not mutate.**

⚠ The arm is worth the care because the answer cannot be reasoned out: Bitwig decides
its own undo granularity and nothing in the API documents it.

---

## E18c — ⚠⚠ THE REBUILD STRATEGY IS MECHANICALLY AVAILABLE: a device can leave a chain, cross containers, and keep its state [K] (2026-08-02)

**Verdict: ⚠⚠ ●● all four directions, 2/2 parameter marks survived, both controls
passed.** E18's main question. A chain cannot be deleted by any typed route — the
best-founded ○ in E17 — so the operator proposed working without one: *reduce*
(clone the container with fewer chains, migrate the devices across, delete the old)
and *collapse* (migrate the chosen chain's devices out, delete the container).
⚠ **E16n had only ever measured `moveDevices` in ONE direction, top level INTO a
chain.** Every direction the strategy needs was untested, and no wire method could
even name a device inside a chain as a SOURCE. Probe: `e18c`. New wire:
`chain.move` + `chain.inventory`, `methodsHash` **`f1c6401540eb9daa`** (133 → 135).

| row | direction | needed by | verdict |
|---|---|---|---|
| 1 | ⚠ **chain → TOP LEVEL** | **collapse** | ⚠⚠ **●● 926 ms** — `A1` lost its Polysynth, top level gained it |
| 2 | chain → chain, same container | either | ●● 716 ms — `A2` lost its Organ, `A0` gained it |
| 3 | ⚠ **chain → chain, DIFFERENT containers** | **reduce** | ⚠⚠ **●● 706 ms** — `A3` lost its Sampler, `B0` gained it |
| 4 | ⚠ the **COPY** verb, across containers | a rebuild with no gap in the signal path | ⚠⚠ **●● 705 ms** — source KEPT its Phase-4, `B1` gained one |
| — | ⚠ **STATE across a relocation OUT** | the whole point | ⚠ **●● 2/2** — `F1FREQ` 0.170, `F1RESO` 0.830, exact |

⇒ ⚠⚠ **The missing chain DELETE stops being a WALL and becomes a COST.** Both
primitives work, and `Device.deleteObject()` on the container was already ●.

### ⚠ Why COPY working matters more than the row count suggests

A `move`-based rebuild has a window where the device is **out of the signal path
entirely**. A `copy`-based one does not: copy across, then delete the old container,
and the audio never loses the device. ⚠ That speaks directly to the operator's bar —
*"low on (or free of) intermediate states that are undesirable or glitchy"* — and it
was not a given **on the prior standing at the time**: sibling verbs on this exact
interface had disagreed repeatedly — `copyDevices` ○ beside `moveDevices` ● (E4d
route 3 / E16n), `duplicateObject()` ○ beside `Channel.duplicate()` ●, `copyTracks`
○ beside three working duplication verbs. ⚠ **That particular prior turned out to be
wrong**, and row 4 is what exposed it: see **E18d**, which re-ran the `copyDevices`
question deliberately and found E4d route 3 to be a false negative. The reasoning
above is kept as the prior the row was designed against, not as a current claim.

### ⚠ State survives the direction that matters

`e16o` measured state across a relocation **INTO** a chain. Out of one was never
tested, and it is the direction *collapse* depends on — a take system that rescues
your chosen patch by resetting it is worthless for the one job it exists for.

Two parameters were marked, not one: a single value could coincide with a fresh
instance's default and read as "state survived" when the device was silently
replaced. Marked through `devcursor.selectFirstInLayer(1)` (descending into the
chain), read back through `devcursor.selectAt(topIndex)` after the move — ⚠ **a
different handle than the one that wrote them** (rule 3a / D15), because Bitwig's
cursors cache what you write and report it back whether or not it landed.

### The new wire, and why it is shaped this way

⚠ **`layerBank0` follows `cursorDevice0`, so exactly ONE container is addressable at
a time** — fatal for row 3, where scoping to the destination re-scopes the handle
pointing at the source. `Device.createLayerBank(int)` is declared on `Device`, not
on `CursorDevice` (checked against the 6.0.6 javadoc index before wiring), so layer
banks now hang off top-level device **SLOTS**: two containers, side by side on one
track, never contending.

⚠ **It also removes the e16o trap from the whole row.** Every `layer.*` call is a
silent no-op byte-identical to an API refusal when the cursor is not on the
container; a slot-scoped bank has no such hidden argument, because the container is
named by a parameter rather than by cursor state. Both scopes reported
`status: "held"` — ⚠ and the probe **aborts** unless they do, because standing rule
13 makes *"the handle was never built"* and *"the API declines"* identical in the
outcome, which produced three false ○s in E17.

### Method

- ⚠ **Guard #4 as a CONSERVATION LAW.** Total device population = top-level count +
  every device inside every chain. A `move` must conserve it and a `copy` must add
  exactly one; anything else ABORTS rather than scoring.
- ⚠ **Both halves of every relocation.** The source must lose it *and* the
  destination must gain it. *"The chain is now empty"* is what a successful move and
  a **destructive** one have in common, and only the second half separates them.
  For row 4 the polarity inverts — a copy must KEEP its source — and that is checked
  as its own condition rather than folded into a single boolean.
- ⚠ **Explicit chain names are load-bearing, not cosmetic.** E4c: a layer's DEFAULT
  name tracks its content, so a chain renames itself exactly when its device leaves
  — i.e. precisely when a move succeeds. Row 5's sticky explicit names (`A0`…`A3`,
  `B0`…`B2`) are what let every survivor be NAMED rather than counted (e16t / #13).
  Container B was built EMPTY so anything appearing in it can only have come from A.
- ⚠ **Two independent readers, cross-checked.** The same container was read through
  the cursor-scoped `layer.list` and the slot-scoped `chain.inventory`; they share no
  handle, so their agreement is evidence where one reader agreeing with itself is not.
- ⚠ **`where` is always `chainEnd` for a move to top level.** `chainStart` would
  insert BEFORE the containers and shift them out of slots 0/1, silently invalidating
  every scope. The probe asserts both containers are still at indices 0 and 1 after
  every arm, and that `chain.inventory.trackName` is still the subject.
- **The E16n direction is the CONTROL**, fired through a *different* handler
  (`layer.moveDeviceInto`) before and after the run — both ●, so a ○ on any row would
  have meant the direction and not a dead verb or a dead bridge.

⇒ ⚠ **STILL OWED before this is a recommendation rather than a mechanism:**
modulator routings across a relocation, chain-level state not carried by moving
devices (colour and sends are untested; name/mute/solo/volume/pan are ●), audible
glitch, undo granularity, atomicity if a migration fails halfway, and cost at
realistic N. **Feasibility is not sufficiency** — that was the operator's point.

---

## E18d — ⚠ E4d route 3 is a FALSE NEGATIVE: `copyDevices` into a layer chain works [K] (2026-08-02)

**Verdict: ⚠⚠ ●● all three arms.** `e18c` row 4 copied a device into a layer chain,
which directly contradicts E4d route 3's recorded ○ — and E16n had reasoned about
that ○ at length when it overturned the `moveDevices` half:

> *"`copyDevices`' no-op was verb-specific rather than destination-specific"*

Two readings survived and they are materially different: **(a)** E4d's ○ was an
artifact, or **(b)** the SOURCE decides — every previous attempt copied from the
TOP-LEVEL chain, while `e18c` copied one already NESTED. Probe: `e18d`.

| arm | verb | source | destination | result |
|---|---|---|---|---|
| A | `copy` | nested (`C0`) | `C1` | ●● reproduces `e18c` row 4 |
| ⚠ **B** | ⚠ **`copy`** | ⚠ **TOP LEVEL** | `C2` | ⚠⚠ **●● — E4d says this is impossible** |
| ⚠ **C** | `move` | ⚠ **TOP LEVEL** | `C2` | ●● the discriminator |

⇒ ⚠⚠ **(a). `copyDevices` into a layer chain works from either source.** E4d route
3's ○ is a false negative of exactly the shape its own `moveDevices` sibling turned
out to be, and E16n's *"verb-specific rather than destination-specific"* is wrong in
**both** halves — it was neither. The likeliest cause is the e16o trap, which is
what killed the sibling.

⚠ **Arm C is the design, not a formality.** It holds source and destination fixed
and changes only the VERB, in the same sitting. Had B come back ○, C's ● would have
proved the top-level source handle valid and the destination alive — so the ○ could
only have been the verb, and reading (b) would have been *established* rather than
assumed. Without it, a ○ on B is the E6 failure again: a negative whose control was
a different object read through a different oracle.

⚠ **The nested source was seeded through `layer.insertDevice`** — a route
independent of every verb under test — so the fixture never presupposes the answer.

⇒ **What it changes:** one more verb is available for the §3.1 rebuild, and the
count of relocation routes into a chain goes from two (`moveDevices`,
`layer.pasteInto`) to **three**. ⚠ **What it does not change:** nothing in E18c
depended on E4d being right, and no E18c row was routed through this call.

⇒ ⚠ **This is the FIFTH capability ○ in the spike overturned by re-aiming a verb
everyone had written off** (CLAP params, `channelId`, chain creation, group creation,
now this). Standing rule 10 keeps paying for itself.

---

## E18b — ⚠⚠ §3.2 CLOSED: a chain's `channelId` is minted by the PROJECT LOADER — a matched pair on one fixture [K] (2026-08-04)

**Verdict: ⚠⚠ both arms measured on the SAME four ids, and they separate cleanly.**
§3.2 rebuilt from scratch on a fresh fixture as the operator asked, and NOT a re-run
of `e17ad`. Probe: `e18b` (`snapshot` → `resnap` → `verify`).

| arm | chain ids | proof the reload happened |
|---|---|---|
| ⚠ **extension reload** (project stayed open) | ⚠⚠ **●● 4/4 SURVIVED** | `methodsHash` moved |
| ⚠ *…replicated over a SECOND extension reload* | ⚠ **●● 4/4 SURVIVED** | new jar, ids untouched |
| ⚠⚠ **PROJECT reload** (save + quit + reopen) | ⚠⚠ **○ 4/4 REGENERATED** | ⚠ **undo stack CLEARED** |

⇒ ⚠⚠ **A chain `channelId` lives in the RUNNING PROJECT and is minted by the project
LOADER.** It survives our jar re-initialising and being replaced — twice — and dies
with the document load.

The operator's objection was the reason to rebuild it, and it is now answered:

> *"it is weird that channel identity is stable for tracks but not for chains when
> they share the same underlying object that channelId's name implies."*

⇒ ⚠ **The asymmetry is about what the project FILE persists, not about what our
proxies hand out.** A track id is written to disk; a chain id is created at load.
Nothing odd remains, and nothing on our side can recover it.

⚠ **`e17ad` is CONFIRMED** — independently, on a fresh fixture, with a different
method. Its 8/8 was not an artifact.

### ⚠⚠ Why this is a matched pair and not two experiments

⚠ **`e17ad` could not have answered the question at all**, because a quit-and-reopen
restarts BOTH the project and the extension, and its 8/8 is consistent with either
being the cause. Splitting them needs the SAME ids put through both reload types —
which meant the project arm could not rebuild its fixture:

- ⚠ A `resnap` mode was added for exactly this. The `snapshot` mode clears the track
  and rebuilds, which **mints new ids** and would have turned the pair into two
  unrelated experiments. `resnap` captures what is already there and touches nothing.
- ⚠ The re-snapshot confirmed **4/4 ids unchanged since the original**, so the two
  arms genuinely share one fixture — and that check also delivered a free
  **replication** of the extension arm across a second reload.

### ⚠⚠ Proving WHICH reload happened — the gap that would have wrecked it

⚠ **`methodsHash` and `initEpochMs` prove our JAR re-ran `init()`. Neither says the
DOCUMENT reloaded** — and a controller reload satisfying the extension proof while
being filed as the project arm would have inverted the entire finding.

⚠ Bitwig's undo history belongs to the PROJECT, so a controller reload leaves it
alone while loading a project clears it. **Measured: `canUndo` true → false**, which
is positive evidence the document was re-parsed from disk. Both proofs fired on this
run, and they are independent.

⚠ **The extension proof came from `initEpochMs`, not the hash** (`newCode: false` —
the jar was unchanged between the two runs). That is precisely the case the
`initEpochMs` field was added for, after the first version of this probe proved
re-init by hash alone and would have been unable to gate this run at all.

⚠ The undo detector is **reported, not enforced**. Whether Bitwig clears undo history
on load is an assumption about DAW behaviour nobody here has measured, and refusing a
good run on an untested assumption would be its own error — so an unproven reload
kind is labelled rather than blocked.

### ⚠ Also re-confirmed, and the framing depends on it

`channelId` is **stable WITHIN a session** — identical across back-to-back reads,
after re-scoping the container, and after a track-cursor round trip. Had it been a
per-read handle, "does not survive a reload" would be true for a much stronger reason
and the whole framing would be wrong.

⇒ ⚠⚠ **CONSEQUENCE, and it is the durable one:** addressing a take layer across
sessions must rest on the **NAME**, which E17 row 5 measured sticky across a content
change AND a save + restart. ⚠ This is the one place D6 inverts — for tracks
`channelId` is the key and the name is the human tag; for chains there is no key and
the tag is all there is.

⇒ ⚠ **The operator's "weird" is resolved, and the resolution is the useful part:**
the asymmetry with tracks is about what the project **FILE** persists, not about
what our proxies hand out. A track id is written to disk; a chain id is minted at
load. So the ○ is a property of the document format, and no amount of care on our
side can recover it — which is a cleaner statement than *"chain ids are unstable"*.

⚠ Also re-confirmed on the fresh fixture: `channelId` is **stable WITHIN a session**
— identical across back-to-back reads, after re-scoping the container, and after a
track-cursor round trip. Had it been a per-read handle the framing would be wrong in
a much stronger way.

### Method — and one guard that fired on its first outing

- ⚠ **The re-init PRECONDITION must not be the `methodsHash`.** A hash change proves
  NEW CODE loaded, which is a different claim from *`init()` re-ran* — and the arm
  this probe exists for is a controller reload where the hash may not move at all.
  Without a precondition the probe would cheerfully report *"the ids survived"*
  against an extension that never restarted: the emptiest false ● available.
- ⚠ **It fired, and it caught a real defect — mine.** The snapshot half was written
  before `initEpochMs` was added, so `snap.initEpochMs` was `undefined` and
  `x > undefined` is silently `false`. The probe REFUSED rather than scoring. Fixed
  to take EITHER proof — a moved `rig.stats.initEpochMs`, or a changed `methodsHash`
  (different code cannot be the same session) — and to treat a missing field as
  **UNKNOWN** rather than as "did not re-init", so an absent field can never
  masquerade as a failed precondition.
- ⚠ **The STRUCTURAL FINGERPRINT gate**, carried over from `e17ad`: container count,
  chain count, chain names and devices-per-chain captured at both ends, and the
  verify **refuses to compare ids at all** unless they match. So *"we read a
  different container"* can never masquerade as *"the ids changed"* — the artifact
  that made `e17n` untrustworthy, since a duplicate container has identical chain
  NAMES and different IDS.
- ⚠ **Explicit chain names** (`gnid·0`…`gnid·3`) for the same reason as E18c: a
  default name tracks content and is not a stable fingerprint field.
- The probe also **refuses if the track carries more than one container**, closing
  the `e17n` artifact by construction rather than by argument.

⇒ ⚠ **CLOSED 2026-08-04** by the project-reload arm above, run on this same fixture
with the operator's consent to save. The two arms are a matched pair and §3.2 needs
nothing further.

---

## E18a — §6's load-bearing ASSUMPTION is now a MEASUREMENT: a multi-chain container reaches the Master and an FX return, autonomously [K] (2026-08-02)

**Verdict: ⚠⚠ ●● all nine cells landed.** `E17-VERDICT.md` §6.1 claims layers are
*"the only device-scoped A/B that reaches the Master and the FX returns"* — the
hole §4.8 had no answer for, since an FX return cannot be forked at all (other
tracks' sends still feed the original). ⚠ **That argument rested on a container
being placeable there by us, and nothing had ever tested it.** It is now tested,
and it holds by a wider margin than the argument needed. Probe: `e18a`. No wire
change; `methodsHash b3b9c71954d83b6a`, 133 methods.

| route | gn-B (control) | FX 1 (Effect) | Master |
|---|---|---|---|
| ⚠ **FX Layer by UUID, then `layer.select` + `duplicateChannel`** | ●● 1 → **2 chains** | ●● 1 → **2 chains** | ⚠⚠ ●● 1 → **2 chains** |
| Instrument Layer by UUID | ● lands, 0 chains | ● lands, 0 chains | ● lands, 0 chains |
| `insertFile` (4-chain Instrument Layer preset) | ● **4 chains, filled** | ● **4 chains, filled** | ⚠ ● **4 chains, filled** |

⇒ ⚠⚠ **A multi-chain container can be built on the Master and on an FX return
with no preset, no named action, no focus, no priming and no human.** The `e17ak`
recipe transfers to both destinations unchanged, and the chain selection flag read
`chain 0` at the instant of the call in all four growth arms (`observing:8`).

### ⚠ The discriminator fired the OTHER way, and that is the more useful half

The probe carried an INSTRUMENT-container arm specifically to separate *"the
destination refuses CONTAINERS"* from *"the destination refuses INSTRUMENTS"* —
because every container fixture on disk is instrument-shaped, and an `insertFile`
○ on a Master would otherwise have been scored as a property of the destination
when the honest reading was a property of the preset. That is the `e17v` mistake
(a fixture under which two mechanisms predict the same outcome), pre-empted.

⚠ **It was not needed, and the reason is a finding in its own right: there is no
type restriction to discriminate.** A Master and an FX return each accepted an
Instrument Layer by UUID *and* a 4-chain instrument preset carrying
`[Phase-4, Polysynth, Organ, Sampler]`, every chain arriving filled. Whatever
Bitwig's UI implies about what belongs on a master bus, **the API imposes no
device-type gate we can detect at these destinations.**

### ⚠ Two bootstrap facts re-confirmed at three destinations each

`e17ai` measured these once, on one track. They are destination-independent:

| | ships with |
|---|---|
| a fresh **FX Layer** | ⚠ **1 chain** — so it can be grown from nothing, typed |
| a fresh **Instrument Layer** | **0 chains** — no first chain to copy, so it still needs a preset or `Group` |

⇒ ⚠ **The FX Layer is the right container for these two destinations anyway**,
which is what makes the autonomous route available exactly where §6 wants it.

### ⚠ Cost, stated so it is not over-read

| | gn-B | FX 1 | Master |
|---|---|---|---|
| `insertBitwig` + settle | 469 ms | 469 ms | 500 ms |
| `insertFile` + settle | 463 ms | 464 ms | 465 ms |

⚠ **These are settle-INCLUSIVE and poll-quantised at 200 ms, not call latencies** —
they are not comparable to E16's ~143 ms insert or ~764 ms `insertFile`, which were
measured differently. What they *do* support, because both were measured the same
way here, is the **comparison**: at these destinations `insertFile` costs no more
than a plain device insert. The preset route is not the expensive one.

### Method

- ⚠ **The first run ABORTED on its own readback, and the reason generalises.**
  `cursor.status.trackPosition` reads `clip.getTrack()` — the cursor CLIP's track —
  and an FX return and the Master have **no launcher clip**, so it reports
  `trackPosition=-1, trackName="", trackExists=false` no matter how correctly the
  cursor landed. **A probe waiting on it aborts on precisely the two destinations
  it exists to measure.** The cursor was fine throughout; the instrument was not.
- ⚠⚠ **And the obvious replacement is also wrong, which is the transferable part.**
  `cursorTrack.position()` is **NOT the bank index**: swept across all 13 tracks it
  is the position within the PARENT GROUP. `gn-E16` reads `0` because it is a child
  of `Group 7`, and every track after the group is shifted by one (`gn-sel` bank 10
  → position 9, `Master` bank 12 → 11). ⇒ **Two different tracks share one position
  number**, which is D6's complaint one level down. The probe calibrates the mapping
  per destination and **refuses if two destinations collide** — an ambiguous
  readback is not a readback.
- **Landing was confirmed by CONTENT, not by the number** (rule 3a): pointing at
  `gn-sel` returns its `Instrument Selector`, at `gn-E16` its three devices, and at
  `FX 1`/`Master` genuinely empty chains. That is what rules out a mis-landing.
- **The control brackets the run** (the `e17v` ordering fix): `gn-B` ran the
  identical recipe **before, between and after** the two real destinations and grew
  every time, so a recipe dying mid-run would have produced an early refusal rather
  than false ○s on the destinations that matter.
- **Guards honoured:** destinations resolved by `channelId` with a refusal on
  duplicate names (#1); device list, chain list and devices-inside-chains read every
  arm (#2); track identity compared before and after every arm (#3); Δdevices bound
  to 0/+1 and Δchains to 0/+1 with an abort otherwise (#4); ⚠ **`device.selectInEditor`
  never called** — it is what poisoned `e17ac` (#6); chain 0 renamed `E18·a` before
  the duplicate so growth is verified by NAME (#13).
- ⚠ **Writing to the Master is the global signal path**, so the probe **refuses to
  run while the transport is rolling** (two parallel chains sum the signal), restores
  each destination to its exact device-name sequence after every arm, attempts the
  same restore on abort before exiting, and takes a **cross-track device fingerprint
  at both ends** — the off-subject check `e17ah` lacked. All three destinations back
  to baseline; fingerprint unchanged; track list identical by identity.
- ⚠ The first run's SUMMARY row printed `1 chains` under a body reading `GREW to 2`
  — it recorded the pre-growth count. The body is authoritative for this run; the
  derived line is fixed for future ones. **A derived line that can disagree with its
  own evidence is a defect even when the evidence is right.**

⇒ ⚠ **What this does NOT settle.** It says a container can be PLACED and GROWN
there. It says nothing about §3.1's rebuild strategy, about destroying a chain, or
about `channelId` durability. And it leaves `E17-VERDICT.md` §6.1 standing on
measurement rather than assumption — which strengthens the *layers* column without
touching the three rows that decide the call (destroy, identity, clips).

---

## E17 — device layers: a chain can be CREATED and SOLOED, and never grown, duplicated or deleted [K] (2026-08-01)

**Verdict: ⚠⚠ a layer chain is UNADDRESSABLE, not fixed-shape — and that
distinction is the whole finding.** Six rows asked whether DEVICE branching
should be layer chains rather than track forks. The first pass concluded chains
could not be created or deleted. **A user report overturned that**: selecting a
layer by hand and pressing copy/paste duplicates it, and `Delete` removes it. So
the capabilities EXIST. What does not exist is any way for a controller extension
to make a layer chain the UI selection — and every one of those gestures is
selection-scoped. Probes: `e17a`–`e17p`, `e17-setup`, `e17-diag`, `e17-cleanup`.
New wire: ten methods across two restarts, `methodsHash` **`d7afe1a9c253b7ba`**
(117 → 127).

| row | question | verdict |
|---|---|---|
| 1 | GROUP existing devices into a layer | ⚠ **◐ a container is created, with exactly ONE chain** |
| 2 | DUPLICATE a layer | ○ — 3 mechanisms, 2 fixture states, verb control ● |
| 3 | CREATE a chain | ⚠ **◐ a HUMAN can; we cannot reach the selection** |
| 4 | DELETE a layer | ⚠ **◐ a HUMAN can; the typed verbs refuse (4 routes, both controls ●)** |
| 5 | RENAME a layer | ⚠ **● survives a content change AND save+restart — E4c corrected** |
| 6 | SOLO a layer | ⚠ **● container-scoped AND locally exclusive** |
| — | ⚠ **a chain's `channelId` across save+restart** | ⚠ **○ NOT durable — 8/8 changed** |

⇒ **DEVICE takes are still TRACKS** — but for two reasons neither of which is
"layers cannot do it". Reasoning in `E17-VERDICT.md`; per standing rule 10
nothing here goes into `DECISIONS.md`.

### ⚠⚠ Rows 3 and 4 REOPENED, then re-closed on a different basis

**The user, 2026-08-01:** *"Selecting a layer, copying it, and pasting directly at
the same selection results in inserting a duplicate of that layer, for me."*

`e17l` put a human in the loop to split the one variable that mattered — **who
sets the selection** — and the answer is unambiguous:

| arm | who selects | who fires | result |
|---|---|---|---|
| A | human | human | ● **4 → 5 chains** |
| B | ⚠ **human** | ⚠ **us** (`Copy`+`Paste`) | ⚠ **● 4 → 5** |
| C | human | us (`Delete`) | ⚠ **● 4 → 3, the correct chain by channelId** |

⇒ ⚠ **The named actions reach a selected layer perfectly well. Our SELECTION is
the broken link** — which is exactly the shape row 1 had before
`device.selectInEditor` existed. Everything we can point at a chain fails:

### ⚠⚠ RETRACTED: `DeviceChain.selectInEditor()` works. Every test aimed at the chain that was already selected

⚠ **This is the largest correction in E17 and a user objection is what forced it:**

> **User, 2026-08-01:** *"I never saw that 'ambient selection' change the whole
> time. Change it to a different chain so I can see it actually does move separate
> from the track selection."*

`e17u` varied the **TARGET** instead of the setter, and asked the one question no
earlier probe asked — *before I touch anything, which chain is highlighted?* The
answer was **Polysynth, chain 1**. ⚠ **`e17k`, `e17o`, `e17q` and `e17r` every
single one used `layerIndex: 1`.** So every trial in this session set the chain
selection to where it already sat: the setter worked the whole time, its effect
was invisible in every trial, and each action fired afterwards ran against a state
indistinguishable from having done nothing.

| setter | moves the chain selection? | evidence |
|---|---|---|
| ⚠ **`DeviceChain.selectInEditor()`** | ⚠ **●** | `e17u` eyes + `e17v` ×2 machine-read, 3 distinct targets |
| `Channel.selectInMixer()` | ○ | `e17v` — aimed Phase-4, stayed Polysynth. It scopes the panel (#3) and nothing more |
| ⚠ `CursorChannel.selectChannel()` on `CursorDeviceLayer` | ⚠ **○ — INERT** | `e17u` 3 targets, `e17v` 1, zero movement |
| 6 navigation actions from a selected container | ○ (`e17p`) | |

⚠ **`e17o`'s MECHANISM B ● is RETRACTED, and it did damage.** `cursorLayer0.exists()`
flipping false → true was **not** `selectChannel` binding — the cursor was already
resolved to the container's ambient current chain. `e17o` then *chose* `pointCursor`
for rows 3 and 4 off that false positive (`const setter = (bSets || cursorLanded)
? 'pointCursor' : …`), so those rows ran on a setter that does nothing at all.

⚠ **The `e17r` "ambient highlight" is retired too** — the highlight is real, but
`selectInEditor` drives it, not the cursor. `cursorLayer0` is a **READBACK** of it,
not a pointer to it.

### ⚠ A machine-readable chain-selection readback exists after all

`cursorLayerName` tracked the human's eyes **5/5** in `e17u`, and `e17v` PART 0
showed the read is non-disturbing: set the selection to Phase-4, leave the track
entirely, come back, still Phase-4. So the precondition can finally be asserted
apart from the question (E16o) **with no human in the loop** — the instrument
`e17k` lacked and `e17q` went hunting for in the observers that died to a
deprecated sibling.

⚠ Valid **only while `cursorDevice0` sits on the container**: `e17u` arm E moved
the device cursor into a chain and `cursorLayerExists` went false while the
selection plainly stayed put. That is the cursor losing its domain, not the
selection moving.

⇒ ⚠ **Rows 3 and 4 keep their ○, but their REASON is replaced.** The old reason —
*"nothing we can call selects a chain"* — is false. The measured reason is that a
verified chain selection is **not what panel-focused actions consume**; see the
re-measurement below.

### ⚠⚠ THREE things were being conflated, and it took human eyes to separate them

⚠ **`e17q` claimed our layer setters "hit the CONTAINER". That reading is VOID**,
and the user is who caught it — *"does that not indicate the cursor might actually
be pointing to the container?"* `e17s` added the arm `e17q` never ran: fire
`Duplicate` with **no selection call at all**. It duplicated the container,
identically to every "our setter hit the container" arm. So those arms were
measuring **ambient panel state**, and the layer setters are simply **inert**.

⚠ **And `e17r` — human eyes, no actions fired — broke the framing underneath it.**
Asked what `Device.selectInEditor()` had selected, the user reported: *"The
gn-lay4 track. Nothing in the device is selected."* Every one of five arms
answered "the track". There are **four** distinct things here, not the two the
earlier write-ups assumed:

| # | thing | who can set it | visible? |
|---|---|---|---|
| 1 | the UI **selection** (the highlight) | our calls only ever set it to the **TRACK** | ● yes |
| 2 | the device panel's **current DEVICE** | ⚠ `Device.selectInEditor` ● — **this is what panel-focused actions consume** | ○ **invisible** |
| 3 | the device panel's **SCOPE** | `Channel.selectInMixer()` on a chain scopes the panel INTO it | ● yes |
| 4 | ⚠ the **chain selection** | ⚠ `DeviceChain.selectInEditor()` ● — and `cursorLayerName` READS IT BACK | ● yes (`e17u`, human-confirmed) |

⇒ **Row 1 needed `device.selectInEditor` + panel focus + foreground because all
three feed #2**, which is invisible and is not the UI selection at all. Naming it
"the UI selection" is what made two write-ups wrong.

⚠ **`Device.selectInEditor()` IS real, proven by a discriminating fixture**
(`e17t`) — the discriminator row 1 should have had. Two DISTINGUISHABLE devices,
`[Polysynth, Organ]`:

| arm | which device got wrapped |
|---|---|
| ambient, nothing selected | **Organ** — ⚠ the panel's default is the **LAST** device, not the first |
| `selectInEditor(0)` | **Polysynth** |
| `selectInEditor(1)` | **Organ** |

Selecting index 0 pulls the outcome away from ambient, so the call drives #2. ⚠ It
also retro-validates row 1: `e17d` ran `[Polysynth, Polysynth]` → `[Instrument
Layer, Polysynth]`, i.e. device 0, where ambient would have given `[Polysynth,
Instrument Layer]`. That output was discriminating and nobody noticed at the time.

**What reaches a CHAIN: nothing.** `selectInMixer` scopes the panel into the chain
(#3, and the user can see it — *"the Polysynth chain … has taken up the whole
device panel"*), but `Duplicate`/`Select All`/`Copy`+`Paste` then land on
**nothing at all** — Δ0 at tracks, devices, chains AND devices-inside-chains. So
scoping is not selecting: a scoped panel has no current item to act on.

⇒ ⚠ **CORRECTED AGAIN, 2026-08-01.** "Our layer setters are inert" was right about
`selectChannel` and `selectInMixer` and **wrong about `selectInEditor`**, for the
target-never-varied reason above. What the evidence supports now: *the chain
selection is settable and readable; whether the device panel consumes it is
**unmeasured**.*

### ⚠⚠ Rows 3 and 4, re-measured against a VERIFIED chain selection: still ○ — but now a POSITIVE result

`e17v` (second run, clean). Every arm asserted the chain selection **at the moment
of firing**, and every arm is bracketed by a container reference that proves
dispatch was live in the same conditions:

| arm | chain selection at firing | Δtracks | Δdevices | Δchains | |
|---|---|---|---|---|---|
| REF before | — | 0 | ⚠ **+1** | 0 | ◐ gate ALIVE |
| ⚠ **`selectInEditor` + `Duplicate`** | ⚠ **verified `Phase-4`** | 0 | ⚠ **+1** | **0** | ◐ **CONTAINER** |
| REF between | — | 0 | ⚠ **+1** | 0 | ◐ gate ALIVE |
| ⚠ **`selectInEditor` + `Copy`+`Paste`** | ⚠ **verified `Polysynth`** | 0 | ⚠ **+1** | **0** | ◐ **CONTAINER** |
| REF after | — | 0 | ⚠ **+1** | 0 | ◐ gate ALIVE |

⇒ ⚠ **The chain selection is set, readable, verified on target — and the action
duplicates the CONTAINER anyway.** Row 4 was correctly SKIPPED on the create gate,
and the fixture restored to baseline at all three levels.

⚠ **This is a much stronger ○ than the one it replaces.** The old ○ was an absence
("nothing happened, and we could not tell whether anything was even firing"). This
one is a *presence*: the action fires, lands somewhere specific, and that somewhere
is never the chain. §1a survives — with its wording changed from **"a chain is not
addressable"** to **"a chain IS addressable as a selection, and panel-focused
actions do not consume that address."**

### ⚠⚠ SETTLED by `e17x`: the panel's current DEVICE wins outright, and the chain selection contributes nothing

`e17v`'s fixture held exactly ONE device, so two mechanisms predicted its outcome
identically — **A.** the panel ignored our chain selection and used its current
device (necessarily the container); or **B.** the panel *consumed* the selection
and coarsened it to the chain's PARENT. Under B the gap would be a granularity bug
rather than a wall, so this had to be separated rather than assumed.

**The discriminator is a second, DISTINGUISHABLE device on the same track** — an
Organ after the container, so "the panel's choice" and "the chain's parent" name
different objects for the first time:

| arm | panel points at | chain selection | duplicated |
|---|---|---|---|
| gate A | container | — | **Instrument Layer** |
| control | ⚠ **Organ** | — | ⚠ **Organ** |
| ⚠ **THE DISCRIMINATOR** | ⚠ **Organ** | ⚠ **verified `Phase-4`** | ⚠⚠ **Organ** |
| gate B | container | — | **Instrument Layer** |

⇒ ⚠ **A, decisively.** The outcome tracks the **panel target** in all four cells and
is completely unmoved by the chain selection. The chain selection is settable,
readable, verified on target — and contributes **nothing** to what the action does.

⚠ **It also explains `e17v` retroactively**: on a one-device track the panel's
current device *is* the container, so "the container got duplicated" was never
about the chain at all. ⚠ Both readings of `e17v` were wrong in the same way — the
container was a coincidence of the fixture, not a finding.

⚠ **This narrows the reopening path rather than widening it.** Rows 3/4 are not a
granularity bug someone could round off; the device panel does not read the chain
selection *at all*. Reopening needs an action or API that reads it — not a
better-aimed version of what we have.

### ⚠⚠⚠ `e17y` — the selection was NEVER the blocker. Our own focus call is the prime suspect

With `addIsSelectedInEditorObserver` finally attached (`observing:8` — the split-`try`
fix worked, and its @Deprecated sibling still reads `FAILED@0` beside it):

| arm | who selected | observer flag | cursor | operator saw |
|---|---|---|---|---|
| baseline | — | none set | (none) | — |
| ⚠ **H: HUMAN click** | the operator | ⚠ **`Organ:EDITOR`** | Organ | "the Organ chain is what's selected" |
| ⚠ **C: our `selectInEditor()`** | us | ⚠ **`Phase-4:EDITOR`** | Phase-4 | "Phase-4 is selected" |
| L: `DeviceChain.select()` | us | `Polysynth:EDITOR` | Polysynth | "Polysynth is selected" |

⇒ ⚠⚠ **A human's click and our call set the IDENTICAL object.** Same reader, same
flag, no divergence. The "we cannot select a chain" framing — which three drafts of
`E17-VERDICT` §1a rested on in one form or another — is **dead**.

⚠ **And the operator settled it beyond argument, unprompted:**

> *"I deleted and then undid the operation, just to confirm it is indeed selected."*

**A chain that OUR call had selected was deleted by hand, successfully.** So the
selection we set is not a lookalike, not a highlight, not ambient — Bitwig honours
it. ⇒ **The blocker is not selection at all. It is our named-action dispatch.**

⚠ **Two predictions were wrong and are recorded as such:**
- `DeviceChain.select()` is @Deprecated and was expected to THROW like its sibling
  observer. It **returned**, and set the same flag. Deprecation is not uniform in
  this API — the legacy *observer* throws while the legacy *setter* works.
- The `NotificationSettings` device-layer oracle produced **nothing on any arm**,
  including the human click. It is uninformative here rather than contradicting;
  recorded so nobody re-runs it expecting a signal.

### ⚠⚠ The one variable separating the run that worked from every run that failed

`e17l` — where our `Copy`+`Paste` gave 4→5 and our `Delete` gave 4→3 on a chain —
**never called `focusDevicePanel()`.** `e17k`, `e17q`, `e17v` and `e17x` all did,
and none of them reached the chain.

    focus_or_toggle_clip_launcher  →  focus_or_toggle_device_panel

⚠ Both are **toggles, not setters**, and that round trip is *ours* — added to
"focus from a known state". The plain reading is that it resets the device panel's
target to its default DEVICE, which is exactly what `e17x` measured and recorded as
"the panel's current device wins outright".

⚠ **That does not make `e17x` wrong; it makes it SCOPED.** Its finding holds *with
the panel explicitly focused* — a condition we imposed on ourselves and never
varied.

### ⚠ `e17z` — the focus-toggle hypothesis is DEAD, and the arms are still informative

Three focus regimes, one variable, flag verified SET at firing in every arm, all
four container-reference gates alive:

| arm | focus | flag at firing | result |
|---|---|---|---|
| A | ⚠ **none** (the `e17l` condition) | ● set | ⚠ **○ nothing at all** |
| B | full toggle (the failing recipe) | ● set | ◐ container |
| C | panel only, no launcher | ● set | ⚠ **○ nothing at all** |

⇒ **The toggle was not the explanation.** ⚠ But it does decide whether the action
has *any* target: with it the action lands on the container, without it nothing
happens whatsoever. **Neither is ever the chain.**

⚠ **Two hypotheses died here in one session** — the foreground gate (`e17m`
rescued it) and now the focus toggle. Both were mine, both were plausible, both
were single explanations for an outcome with more than one cause.

### ⚠⚠ What is left, stated exactly: the same flag, the same action, opposite outcomes

| | who set the selection | who fired | result |
|---|---|---|---|
| `e17l` arms B/C | ⚠ **human click** | us, `invokeAction` | ⚠ **● 4→5, and Delete 4→3 by channelId** |
| `e17z` arms A/B/C | ⚠ **our `selectInEditor()`** | us, `invokeAction` | ⚠ **○ never the chain** |
| `e17y` | either | — | ⚠ **the observer flag is IDENTICAL** |

⚠ **`e17l` was re-read before building on it and it holds**: it asks the human to
confirm our own read had not stolen the selection first, so its ● is not an
instrument artifact.

⇒ ⚠ **The click carries something the selection model does not**, and
`invokeAction` dispatches against *that*, not against the flag. The leading
candidate is input/keyboard FOCUS on the chain lane widget — but that is a
hypothesis, and the last two died.

### ⚠⚠⚠ `e17aa` — ROWS 3 AND 4 FLIP. Our selection IS honoured

| | |
|---|---|
| arm 1, baseline | human clicks Organ → we fire `Duplicate` → ⚠ **Organ duplicated, 4→5.** `e17l` reproduced with the reader attached |
| ⚠ **arm 2, the discriminator** | human clicks **Organ** → we call `selectInEditor(`**`Phase-4`**`)` → observer confirms `Phase-4`, operator's eyes confirm `Phase-4` → we fire → ⚠⚠ **`Phase-4` duplicated** |

⇒ ⚠⚠ **OUR SELECTION WON.** The chain that duplicated is the one *we* chose, not
the one the human clicked. **A layer chain can be created programmatically.** Every
○ from `e17k` through `e17z` was a missing precondition, not a missing capability,
and `E17-VERDICT` §1a — in all three of its drafts — is **void**.

### ⚠ Why it worked, and the one question left: is a HUMAN needed?

Two explanations survive `e17aa`, and they differ on the only thing a product cares
about. The mechanical difference between the runs is exact:

| | calls between the selection and the fire |
|---|---|
| ⚠ `e17aa` (worked) | `layer.selectionState` only — ⚠ **moves no cursor** |
| `e17z` (failed) | `levels()` and `scope()` first — ⚠ **both call `cursor.pointTrack`** |

  **(a)** the human's CLICK is required (input focus on a chain lane, which no API
  call we have reaches) ⇒ rows 3/4 are ◐ human-assisted, forever.
  **(b)** ⚠ **our own `cursor.pointTrack` destroys it.** That call is
  `CursorTrack.selectChannel()`, which **E16j proved sets the UI track selection** —
  so our own instrumentation would have been clearing the actionable state before
  every measurement ⇒ **no human needed, rows 3/4 ● outright.**

### ⚠⚠⚠ RETRACTED and re-measured COLD: a HUMAN CLICK IS REQUIRED

⚠ **`e17ab`'s first run was scored as cold and was not.** "COLD" meant *no click
inside the probe* — but the operator had been clicking chains throughout `e17y` and
`e17aa` in the same session. The claim *"no human is needed"* was never established.

⚠ **The operator then quit and reopened Bitwig to get a genuinely unprimed session**
and re-ran the identical probe. It is self-bracketing — the COLD ○ is only
meaningful because the PRIMED arms succeeded in the same sitting:

| arm | gesture | result |
|---|---|---|
| ⚠ **COLD** — genuinely unprimed | none | ⚠⚠ **4→4, ○ nothing** |
| PRIMED 1 | one click, then unaided | 4→5 +Phase-4 ● |
| PRIMED 2 | still unaided | 5→6 +Polysynth ● |
| PRIMED 3 | still unaided | 6→7 +Organ ● |
| DESTROYER | + `cursor.pointTrack` | 7→7 ○ — replicated cold |
| ROW 4 | re-primed, `Delete` | 7→6 −Phase-4 ●, no track lost |

⇒ ⚠⚠ **ROWS 3 AND 4 ARE ◐ HUMAN-ASSISTED, not ●.** A chain branch cannot be minted
autonomously. For a take system that is a material limitation, not a footnote: the
user must click a chain before the extension can create or destroy one.

### ⚠⚠⚠ THE MECHANISM: named actions target the most recently FOCUSED UI element

⚠ The operator pushed on "priming" — *"a plausible but odd mechanism, especially
that moving the track cursor to a different track affects it in the same way"* —
and asked for it to be tested with a **different** chain action. `e17ag` used
`Delete` (independently ● in `e17ab`/`e17ae`) across six arms:

| arm | condition | result |
|---|---|---|
| 1 | COLD, no click since project open | ○ nothing |
| ⚠ 2 | human clicks the **TRACK HEADER** | ⚠⚠ **deleted the TRACK** (see below) |
| 3 | human clicks a **chain lane** | ● 4→3, named survivor |
| 4 | our `pointTrack` to the **SAME** track | ● 4→3 — harmless |
| 5 | our `pointTrack` **away and back** | ○ nothing |
| 6 | human clicks a chain again | ● 4→3 — recoverable |

⇒ ⚠⚠ **One rule explains every observation in E17:**

> **A named action acts on whatever UI element the human last gave FOCUS to.**
> Our API calls set selection *models*; they never deliver focus.

- chain lane focused → `Delete` removes the chain
- ⚠ **track header focused → `Delete` removes the TRACK**
- nothing focused since load → the action does nothing at all
- switching tracks re-renders the device panel and discards the focused widget;
  re-pointing at the **same** track does not re-render, so focus survives (arm 4 vs
  arm 5 — same call, opposite outcome, and that pair is the proof)

⚠ **The operator's objection is answered: the reload case and the track-switch case
are not two coincidences.** Both leave no focused chain widget. Nothing odd remains.

⚠ **It also retro-explains two older results with the same rule** — E6 blocker 3's
seven orphan duplicate tracks (focus was a track, `Duplicate` duplicated tracks) and
E16j's `Group` wrapping exactly the selected track.

⇒ ⚠⚠ **PRODUCT HAZARD, now with a precise trigger.** Our chain `Delete` is only
safe while a chain lane holds focus. **If the user's focus is on a track, the same
call destroys a track.** Any shipped code path that fires a chain action must
establish and verify chain focus, and there is no API to do so — which is E6
blocker 3 restated at chain granularity.

### ⚠⚠ `e17ag` arm 2 DELETED A TRACK AND REPORTED `●● REMOVED Sampler`

⚠ The operator caught it: *"Arm 2 actually deleted the whole track, not just the
chain — was that intended?"* It was not, and the probe could not see it.

`Delete` destroyed `gn-lay4`. `scopeContainer()` then read index 9, which after the
deletion was **`gn-sel`** — and `gn-sel` holds exactly 2 chains. Hence the
impossible `4 -> 2`, scored as a success. ⚠ `app.undo` restored the track **with its
`channelId` intact** (`9a88b37d`, still matching `e17ad`'s snapshot), so nothing was
lost — but that was luck, not design.

**Four faults, and the last one is the general lesson:**
1. the integrity check looked for tracks **added**, never **removed**;
2. no sanity bound on the delta — one `Delete` cannot change a chain count by −2;
3. `scopeContainer()` ignored its own poll result and read whatever was there;
4. ⚠ the subject was trusted **by index** after an action that can shift indices.

⇒ ⚠⚠ **This is the first instrument failure in E17 that was DESTRUCTIVE rather than
merely wrong.** Every guard now added is the same guard: **after any action, verify
the SUBJECT still exists by `channelId` before believing a single reading taken
below it**, and refuse on an impossible delta rather than recording it.

### ⚠ The PRIMING model, as measured

Taking both `e17ab` runs together — the first is now readable as the WARM arm — the
picture is complete and consistent:

| session state | click in probe | result |
|---|---|---|
| warm (clicked earlier in `e17y`/`e17aa`) | none | ● worked |
| ⚠ **cold** (fresh project load) | none | ⚠ **○ nothing** |
| cold | ⚠ **one click** | ● and it holds for ≥3 further cycles |

**Priming SURVIVES:** our `layer.select` calls, our `Duplicate`/`Delete` actions,
repeated cycles, and `cursor.pointTrack` **to the same track**.
⚠ **Priming is DESTROYED by:** moving the track cursor to a **different** track and
back (`DESTROYER`, replicated in both runs), and by a **project reload**.

⇒ ⚠ **This retro-explains the whole spike.** Most E17 named-action probes ran
unprimed, or primed-then-destroyed by their own `cursor.pointTrack`. The ○s were
real observations of a precondition we did not know existed.

### ⚠⚠ `e17ah` — THE PRIMER SWEEP: 10 candidates, all ○, both human controls ●

The question, stated precisely: **can anything WE call put focus into a container's
chain list?** Selection was never the problem — it is ours and verified. Focus is
the only missing ingredient.

| primer | result |
|---|---|
| ⚠ **POS-A: human chain-lane click** | ⚠ **●● CHAIN+1** |
| A `device.selectInEditor(container)` then select a chain | ○ |
| B `Channel.selectInMixer()` — `e17s`'s *"scopes the panel into the chain"* | ○ |
| C `devcursor.selectFirstInLayer(2)` | ○ |
| D `layer.selectLegacy` — `DeviceChain.select()`, returns rather than throwing | ○ |
| E `Enter Group` | ○ |
| E `Expand Item` | ○ |
| E `Focus widget below` | ○ |
| E `Focus widget to the right` | ○ |
| E `Select Next` | ○ |
| E `toggle_children_expanded_state` | ○ |
| ⚠ **POS-B: human chain-lane click** | ⚠ **●● CHAIN+1** |

⚠ **Why this ○ is worth more than the session's earlier ones.** Both human controls
passed, bracketing the run, so the ○s are not drift or a dead gate. **Each arm
carried its own negative control** — reset, fire with no primer, confirm ○ — so a
reset that stopped working could not manufacture a false ●. Every arm was
`pointTrack`-reset, and every outcome was constrained to exactly two legal states
(UNCHANGED or CHAIN+1 of the named target) with anything else aborting.

⚠ **And the off-subject check the operator asked for.** `snapshot()` verified the
track list by identity but **never looked inside any track but the subject** — so a
`Duplicate` landing elsewhere would have read as ○ everywhere. The operator spotted
the risk by eye: *"the track that was briefly switched to each time seemed to have
several duplicated layers."* ⚠ A full read-only inventory (`e17-fullinv`) cleared it:
every track matches its documented state. What they saw was **track 0, the track
literally named `Instrument Layer`, carrying its documented EIGHT stacked containers**
— pre-existing, untouched, and an unfortunate choice of reset track on our part
(now changed to an empty one, and a cross-track content fingerprint added).

⇒ ⚠ **There is no chain equivalent of `Device.selectInEditor()`.** That call both
focuses the device row and selects a device (`e17t`); `DeviceChain.selectInEditor()`
only selects. Ten candidates, swept, none supplies focus.
⚠ **This is a swept ○, not proof of impossibility** — but it is the strongest
negative in E17 and the search space it covers is the whole of what we can reach.

⚠ **One observation from the operator that matters for the product:** *"the primed
state is NOT visibly different from the unprimed state."* So a user cannot tell by
looking whether the extension will work, and neither can we ask them. A precondition
that is invisible to everyone is worse than one that fails loudly.

### ⚠ Which measurements depend on session state, and which do not

| kind | primed session needed? |
|---|---|
| ⚠ named actions fired at a CHAIN (rows 1, 3, 4, `Ungroup`, named paste) | ⚠⚠ **YES — must be primed** |
| typed API verbs (row 2 duplicate, row 4's `deleteObject`/`host.deleteObjects`) | no — they never touch the UI selection |
| row 5 naming, row 6 solo | no |
| §1b `channelId` durability (`e17ad`) | no — typed reads; a reload is inherent to it |
| VU/audibility measurements | no |

### ⚠ Superseded: the earlier "(b), no human needed" reading

| arm | what it did | result |
|---|---|---|
| ⚠ **COLD** | no click, no priming, hands off Bitwig entirely | ⚠⚠ **4→5, +Organ ●** |
| PRIMED 1 | one click, then unaided: select Phase-4, fire | 5→6, +Phase-4 ● |
| PRIMED 2 | unaided: select Polysynth, fire | 6→7, +Polysynth ● |
| PRIMED 3 | unaided: select Organ, fire | 7→8, +Organ ● |
| ⚠ **DESTROYER** | same recipe **+ `cursor.pointTrack`** | ⚠⚠ **8→8, nothing ○** |
| ⚠ **ROW 4** | select Phase-4, fire `Delete` | ⚠⚠ **8→7, −Phase-4 ●**, no track lost |

⇒ ⚠⚠⚠ **ROWS 3 AND 4 ARE ● OUTRIGHT.** A layer chain can be created and destroyed
programmatically, with no human gesture, naming the survivor every time. The layer
model has a **complete branch lifecycle**.

⚠ **The DESTROYER arm is a positive control for the CAUSE, not just the effect** —
identical recipe, one extra call, and it stops working. `cursor.pointTrack` is
`CursorTrack.selectChannel()`, which **E16j proved sets the UI track selection**;
selecting the track clears the chain as the actionable target. Our own
instrumentation called it before nearly every measurement in this spike.

⇒ **`E17-VERDICT` §1a is void in full**, in all three of its drafts. `e17aa`'s
human click was a red herring: it merely re-established what our own read had
cleared.

### ⚠⚠ Which earlier E17 results are CONTAMINATED by this, and which are not

The wound only reaches measurements where a **named action** was fired at a chain
after one of our cursor moves. Typed API verbs are unaffected.

| result | named action? | status |
|---|---|---|
| ⚠ **row 1** — `Group` makes a one-chain container that *"cannot grow to two"* | ⚠ yes | ⚠⚠ **SUSPECT — re-measure.** `Duplicate` on a selected chain now demonstrably adds one, so a one-chain container almost certainly CAN grow |
| ⚠ `e17i` — group depth, `Ungroup` ○ | ⚠ yes | ⚠ SUSPECT |
| ⚠ `e17j` — clipboard `paste()` | ⚠ yes | ⚠ SUSPECT |
| `e17k`/`e17p`/`e17q`/`e17v`/`e17x`/`e17z` ○s | yes | ⚠ **superseded — all measured the cleared state** |
| row 2 — duplicate a layer, 3 typed mechanisms | no | ● unaffected |
| row 4 typed verbs (`deleteObject`, `host.deleteObjects`) | no | ● unaffected — they genuinely refuse; the NAMED action is what works |
| rows 5, 6 — naming, solo | no | ●● unaffected |
| §1b — chain `channelId` not durable | no | ● unaffected |

⚠ **The §5 consequence is the big one and it is STILL NOT measured.** The verdict
argues *"containers ship with zero chains, `Group` gives exactly one, and nothing
we can call seeds a second — so a multi-chain container is a human-authored
`.bwpreset` via `insertFile`"*, making rule 11 / E4h / `bwmod`'s offline chain trim
load-bearing dependencies of the whole A/B story. **If row 1 re-measures ●, that
entire dependency chain dissolves.** Do not rely on §5.

### ⚠⚠ `e17ac` IS VOID — two faults, both mine, and the second is the instructive one

The first attempt to re-measure row 1 produced three ○s. **None of them count.**

**1. The blind spot, for the THIRD time.** `growAttempt` measured only
`chainsNow()`, so when `Duplicate` copied the CONTAINER the reading printed
*"chains 1 -> 1"* — nothing happened. The next section's device list gave it away:
`[Instrument Layer, Instrument Layer]`. This is the `e17p` failure, which was
diagnosed in `e17v`, written up as a method trap, and then written again.

**2. ⚠ The CONFOUND, which is worse than the blind spot.** To make `Group` build a
container, the recipe calls `device.selectInEditor(0)` — and **`e17x` proved that
call sets the device panel's current device, which beats the chain selection.** So
the build step poisoned the measurement that followed it. `e17ab` succeeded
precisely because it never called `device.selectInEditor` at all.

⇒ ⚠ **A probe's SETUP is part of its experiment.** The confound was not in the arm
under test; it was in the scaffolding built to reach the arm. Nothing in the
"one variable" discipline catches that, because the variable really was held
fixed — it was the constant that was wrong.

⚠ **`e17ae` re-does it without needing `Group` at all**: `gn-lay4` already has a
container and `Delete` now works, so the chain COUNT is varied on an existing
container using only the recipe proven clean, and `device.selectInEditor` is never
called. It carries a positive control that grows a 4-chain container **in the same
sitting** — the thing `e17ac` lacked, and the reason its ○ was uninterpretable.

### ⚠ Method: the first `e17v` run was void, and how it was caught

The first attempt read Δ0 on every arm — and **the container reference arm read Δ0
too**, so dispatch had stopped between the control passing (round 8, 47 s) and the
arms running. The probe refused to score rather than banking three false negatives.

⚠ **The confound is procedural**: the operator brought Bitwig forward to satisfy
the gate, then alt-tabbed to their terminal to send a message, and the gate closed
behind them. **A foreground-gated probe and a live conversation cannot share one
screen** — see the standing instruction recorded below.

⚠ **The fix is ordering, not effort.** The reference arm originally ran LAST, so a
dead gate was only discovered after the whole run was spent. It now runs **before,
between and after** every chain arm, and aborts on the first failure — which turns
a void run into an early refusal, and is what makes the table above trustworthy.

⚠ One blind spot was checked rather than assumed: `e17v`'s reading took
`devices[0]` per chain, so a `Duplicate` landing *inside* a chain would have been
invisible — the `e17p` failure one level down. `e17w` inventoried every device in
every chain: `gn-lay4` is byte-for-byte its baseline. (`gn-lay` chain 0 `A·take`
holds `[Polysynth ×3]`, on a track `e17v` never touched — consistent with the
earlier chain-FILL routes, and recorded as unexplained rather than assigned.)

### ⚠ The contamination that produced that table, and what it did NOT touch

⚠ **`e17p` stacked duplicate containers onto `gn-lay4` and could not see it doing
so** (method trap 5 below). The user then reported having noticed the duplicates
*"quite a while ago"*, which dates them EARLIER than `e17p` — its own control
printed FOUR containers after a single `Group`, so ~3 pre-existed. The window is
`e17k` → `e17p`, and every ○ in it was a container duplication misread as
"nothing happened".

⚠ **Two separate piles, and only one was ours.** The track literally named
`Instrument Layer` (track 0, Hybrid) carries **8 stacked containers of the E4g
shape** and always has — they are visible in the first truthful `e17-diag`, before
any of this, and no E17 probe ever addressed track 0. They are a leftover fixture
from an earlier session, and they are also what the stale-read bug kept bleeding
into other tracks' listings.

**What was re-measured rather than argued** (`e17q`, on a fixture proved clean at
`devices=1/itemCount=1` first):

- ⚠ **Row 4's typed deletes** — the single most load-bearing ○ in the session.
  Re-run clean: both still refuse, chain `channelId`s byte-identical before and
  after.
- **Every selection mechanism** — the table above.
- **The fixture restored exactly** at all three levels afterwards.

**What was never at risk, and why** — the contamination lived entirely in
`gn-lay4`'s DEVICE list, one level above the chains every reading used:

| measurement | fixture | status |
|---|---|---|
| rows 1, 2, 3 (typed), 5, 6 | `gn-lay`, `gn-A`, `gn-sel` — one container each | outside the window entirely |
| row 4 typed delete | `gn-lay4` | ⚠ **re-run clean, same result** |
| the persistence rows | `gn-lay` + `gn-sel` (1 device each) **and** `gn-lay4` | replicates on two uncontaminated containers |
| rows 3/4 reachability | `gn-lay4` | ⚠ **re-run clean, result strengthened** |

⇒ **No conclusion changes.** One interpretation gets stronger.

**Free rider: `app.undo` removes a chain** — the only mechanism that does, since
every typed delete refuses. Used as this session's only chain-cleanup route.

### ⚠⚠ A layer's `channelId` does NOT survive save + restart

The E2f question, never asked of layers until now, and it is an independent nail.
Captured before saving, compared after (`e17n`):

| | before → after |
|---|---|
| **track** `channelId` ×3 | ● unchanged (E2f re-confirmed) |
| chain count ×3 containers | ● unchanged |
| ⚠ **chain `channelId` ×8** | ⚠ **ALL EIGHT CHANGED** |
| chain names ×8, incl. `A·take` | ● all survived |

### ⚠⚠ §1b RE-CONFIRMED under a fingerprint gate — and the artifact `e17n` could not exclude

⚠ **The user asked the right question: could the changed ids have been our own
mess?** `e17n` reads chains via `devcursor.selectAt(deviceIndex: 0)` and **never
asserts how many containers are on the track.** During the `e17k`→`e17p` window
`gn-lay4` carried stacked duplicates, so if index 0 held a different container at
snapshot than at verify, we compared **two different objects** — and a duplicate
container has identical chain NAMES with different IDS. ⚠ **The artifact predicts
the exact table `e17n` recorded.**

`e17ad` re-ran it with the two controls `e17n` lacked:

**PHASE 1 — the question never asked: is `channelId` stable WITHIN a session?**
Five reads of `gn-lay4` — back-to-back, after re-selecting the container, after a
track-cursor round trip, after a wait — **identical every time**
(`867ee297 4a0d0d5d 28f5be64 102d0b4e`). ⇒ It IS a real in-session identity, not a
per-read handle. That matters: had it been unstable, §1b would have been true for a
much stronger reason and the "does not survive a restart" framing would be wrong.

**PHASE 2 — a STRUCTURAL FINGERPRINT gate.** Container count, chain count, chain
names and device contents captured at both ends; ⚠ the verify **refuses to compare
ids at all** unless the fingerprint matches, so "we read a different container" can
never masquerade as "the ids changed". All three tracks passed the gate at
`containers=1/1`:

| track | track `channelId` (E2f control) | chain ids | chain names |
|---|---|---|---|
| `gn-lay4` ×4 chains | ● `9a88b37d` unchanged | ⚠ **all 4 changed** | ● all kept |
| `gn-lay` ×2 chains | ● `d367ac16` unchanged | ⚠ **both changed** | ● both kept |
| `gn-sel` ×2 chains | ● `6fb96670` unchanged | ⚠ **both changed** | ● both kept |

⇒ ⚠ **8/8 ids changed, 8/8 names survived, with the track ids unchanged in the same
read.** The track control is what rules out a broken reader. **§1b stands, and this
time the artifact is excluded by construction rather than by argument.**

⚠ Incidentally a FOURTH disjoint id set for `gn-lay4`, distinct from the three
below — consistent with regeneration on every load.

⚠ **Previously** (kept for the record, and NOT independently trustworthy):
replicated across a second save + restart on a fixture believed clean at the time.
`gn-lay4`'s four chains carried three disjoint sets of ids across two reload
cycles:

| generation | `gn-lay4` chain ids |
|---|---|
| before the 1st save | `28b7a8b7 7eb5bf9d 2decef2a 407011d4` |
| after the 1st restart | `7f7c729c 001823fa 226030bf 4893bf75` |
| after the 2nd restart | `05259794 f7fe3663 82c606e0 b3bd0010` |

…while `A·take` survived **both** cycles. Two independent replications, and the
name outlives the id every time.

⇒ ⚠ **E16w's "free rider: layer chains have their own `channelId`" is retired as
an identity story.** A chain's `channelId` is a **session handle, not a key**. Even
if a chain could be created and deleted, no take could be durably identified
across sessions — and addressing by index is precisely what D6 forbids.

⇒ ⚠ **And the inverse, which is the useful half: for a layer chain the NAME is the
only durable identifier.** That inverts D6 one level down — for tracks
`channelId` is the key and the name is the human tag; for chains there is no key
and the tag is all there is.

### ⚠⚠⚠ Row 1's SECOND half is OVERTURNED — a one-chain container grows freely

The claim *"`Group` gives exactly one chain and nothing we can call seeds a
second"* is **false**. `e17ae`, in a primed session, on the corrected harness
(no `device.selectInEditor`, no mid-sequence `cursor.pointTrack`, all levels read):

| step | result |
|---|---|
| CONTROL: grow at 4 chains | 4→5 ● — the recipe is live in this sitting |
| SHRINK: `Delete` ×3, named survivor each time | 4→3→2→1 ● |
| ⚠⚠ **QUESTION: grow at ONE chain** | ⚠⚠ **1→2 ●, `Δdevices=0`** |

⇒ **Chain count does not gate growth.** `Group` still yields one chain — that half
stands — but `Duplicate` then grows it without limit.

⚠ **`e17ac`'s ○ on this question was our own scaffolding**: to build a container it
called `device.selectInEditor`, which `e17x` had already proven overrides the chain
selection. The setup poisoned the arm.

⇒ ⚠ **§5's dependency is WEAKENED, not dissolved** — an earlier draft of this entry
overstated it and the operator's question is what caught it. A multi-chain container
*can* be built at runtime from `Group` + `Duplicate`, **but both are named actions
and therefore need the human click** (`e17ab` cold). So:

| route to a multi-chain container | autonomous? |
|---|---|
| runtime: `Group` + `Duplicate` | ⚠ **no — needs priming** |
| preset: `insertFile` a `.bwpreset` | ⚠ **● yes — fully typed** |

⇒ **Rule 11 / E4h stop being the ONLY way to get a multi-chain container, but they
remain the only way to get one WITHOUT a human click.** The preset route is the
autonomous route.

### ⚠⚠⚠ RETRACTED: a chain CAN be created by a TYPED call. It needed a SELECTION all along

⚠ **The operator predicted this**: *"those are the ones that really seem like they
should have worked from the start."* They should have, and they do.

`e17ak`, on a **fresh FX Layer that had never been selected or clicked**, four arms,
each on a rebuilt container:

| arm | selection flag at the call | result |
|---|---|---|
| A no primer | none | ○ |
| ⚠⚠ **B `layer.select(editor, 0)`** | ⚠ **chain 0** | ⚠⚠ **●● CHAIN CREATED** |
| C `layer.pointCursor(0)` | none | ○ |
| D `insertViaCursor` | none | ○ |

⇒ ⚠⚠ **`Channel.duplicate()` requires the chain to be SELECTED — and `layer.select`
is OURS.** Typed, no focus, no priming, no foreground, no human. `e17y` had already
proved it sets the identical flag a human click does.

## ⇒ **CHAIN CREATION IS FULLY AUTONOMOUS: `layer.select` + `layer.duplicateChannel`.**

⚠ **Why the whole spike missed it.** Every earlier probe scoped the **device cursor**
to the container — the e16o discipline — and never selected a **chain**. `e17b`,
`e17f`, `e17q`, `e17aj` CELL 1: all the same omission. `e17aj` CELL 3 succeeded only
because `gn-lay4` still carried a selection from the operator's clicking, which is
also why it looked like container type mattered.

⚠ **Two verbs that were always reported together turn out to differ:**

| verb | with a selection |
|---|---|
| ⚠ `Channel.duplicate()` (`layer.duplicateChannel`) | ⚠ **● creates a full chain copy** |
| `DeviceLayer.duplicateObject()` (`layer.duplicate`) | ○ genuinely dead |

⚠ **And a bootstrap consequence for §5.** A fresh **FX Layer ships with ONE chain**
while a fresh **Instrument Layer ships with ZERO** (`e17ai`). So an FX Layer can be
grown from nothing — insert it, select chain 0, duplicate, repeat — **entirely
typed, no preset and no human**. An Instrument Layer has no first chain to copy, so
it still needs a preset or `Group`. ⚠ §6's use case is the **Master and the FX
returns**, where an FX Layer is exactly the container you would use.

### ⚠ CORRECTION: `Ungroup` is NOT a route around the missing delete

An earlier suggestion in session 6 was *"delete all but the chosen chain, then
`Ungroup`"* — the device-level analogue of E16 K3. ⚠ **The operator caught that it
is circular:** K3 works at TRACK level *because track delete works*, and at device
level delete is the blocked thing, so it cannot be step one.

⇒ `Ungroup` is worth re-measuring as a loose end (its ○ came from the broken
harness) but it is **not** a simplifier for collapse. The operator's shape is
genuinely new and needs no `Ungroup`:

    reduce    clone the container with fewer chains, migrate devices, delete the old
    collapse  migrate the chosen chain's devices out to top level, delete the container

⚠ Deleting the CONTAINER is already ● (`Device.deleteObject()`). What gates the whole
strategy is a direction never tested: **moving a device OUT of a chain**, and across
chains/containers. E16n only ever measured top-level → chain. See
`HANDOFF-E18-BRANCH-UNLOCK.md` §3.1.

### ⚠⚠ DESTROY: exhausted, with a MECHANISM that predicts the ○

The operator pushed after CREATE was overturned: *"odd that duplicate works after
all but delete does not."* A type sweep makes the two receivers **siblings**:

    Channel extends DeviceChain, DeleteableObject, DuplicableObject
       ↑                              ↑
    Track                        DeviceLayer   ← `interface DeviceLayer
    + isGroup, position, …                        extends Channel {}` — EMPTY BODY

`track.delete` calls `Track.deleteObject()` and works every time; **the same
inherited method refuses on a `DeviceLayer`.** So `e17am` tried the one remaining
form, with the `Track` sibling as the control:

| declared on | method | on a `DeviceLayer` | on a `Track` |
|---|---|---|---|
| `DuplicableObject` | `duplicateObject()` | ○ | — |
| `DuplicableObject` | ⚠ `duplicateObjectAction()` | ⚠ **○** | — |
| ⚠ **`Channel`** | ⚠ **`duplicate()`** | ⚠⚠ **● creates a chain** | — |
| `DeleteableObject` | `deleteObject()` | ○ | ⚠ **● deletes** |
| `DeleteableObject` | ⚠ `deleteObjectAction().invoke()` | ⚠ **○** | ⚠⚠ **● deletes** |
| `Channel` | — | ⚠ **declares no delete at all** | |

⇒ ⚠⚠ **THE MECHANISM: a `DeviceLayer` honours the verb `Channel` declares ITSELF,
and declines every verb it merely INHERITS.** `Track` honours all of them because a
track is a first-class deletable object. That **predicts** the ○ rather than merely
recording it — there is no Channel-level delete for a layer to honour, so there is
nothing left to try.

⚠ **Both `DeleteableObject` forms are now exhausted**, each tested with and without
the selection precondition that unlocked CREATE, and each bracketed by the sibling
control passing in the same run. This is the best-founded ○ in E17.

⚠ **A rule-13 violation produced three false ○s first, and it is worth recording.**
The initial attempt called `deleteObjectAction()` lazily inside the handler and every
arm threw *"This can only be called during driver initialization"*. A
`HardwareActionBindable` is a Bitwig RESOURCE and resources are init-only — standing
rule 13, written down long before, walked straight past. The handles are now held at
init in separate try blocks, each reporting its own status, and the probe **aborts**
unless `handleStatus` reads `held:N`. ⇒ ⚠ *"The handle does not exist"* and *"the
layer declines"* are indistinguishable in the outcome; any probe invoking a
`*Action()` must prove the handle first.

### ⚠ DESTROY is NOT autonomous — the asymmetry, measured

`e17al`, same recipe, two distinguishable chains so a survivor is NAMED:

| arm | flag at the call | result |
|---|---|---|
| A no selection on the target | chain 0 | ○ |
| ⚠ B `layer.select(1)` + `DeviceLayer.deleteObject()` | ⚠ **chain 1** | ○ |
| ⚠ C `layer.select(1)` + `host.deleteObjects()` | ⚠ **chain 1** | ○ |

⇒ **The typed deletes really do refuse**, and now for a properly founded reason: the
precondition that unlocked CREATE does nothing for DESTROY. Removal remains
named-action-only (human focus) or `app.undo`.

⇒ ⚠ **The branch lifecycle is ASYMMETRIC: mint autonomously, remove only with help.**

### ⚠ The typed/named split, and why it decides the whole use case

None of the `layer.*` handlers call `invokeAction` — verified by reading them. Every
chain operation is typed API **except create and destroy**, whose typed verbs
(`deleteObject`, `deleteObjects`, `duplicateObject`, `duplicateChannel`) all refuse:

| operation | route | autonomous? |
|---|---|---|
| solo a chain (the A/B gesture) | `DeviceLayer.solo()` | ● typed |
| rename a chain | `DeviceChain.name()` | ● typed |
| fill a chain | `moveDevices` / `insertBitwigDevice` / `pasteInto` | ● typed |
| insert a whole container | `insertFile` | ● typed |
| ⚠ **create a chain** | typed verbs refuse → `Duplicate` only | ⚠ **named ⇒ needs a click** |
| ⚠ **destroy a chain** | typed verbs refuse → `Delete` only | ⚠ **named ⇒ needs a click** |

⚠ **And the focus requirement is CHAIN-SPECIFIC, not a property of named actions.**
Track-targeted ones fire autonomously (E16j: `Group` backgrounded and minimised, 5/5,
against a `cursor.pointTrack` selection); device-targeted ones fire autonomously
(`Device.selectInEditor` supplies focus AND selection, `e17t`). Chains are the one
level where we can set selection but not focus.

⇒ ⚠⚠ **CONSEQUENCE FOR §6, and it is the useful half:** a **fixed-shape** A/B
fixture never creates or destroys a chain at runtime, so it **never touches a named
action and is fully autonomous**. The human-click limitation bites only if the shape
must change at runtime. §6 already froze the shape at authoring time; that is
precisely what dodges the problem.

⚠ **UNTESTED and load-bearing for §6:** `insertFile` has never been run against the
**Master or an FX return**. The entire "layers are the only device-scoped A/B that
reaches them" argument assumes a container can be placed there autonomously. That is
an assumption, not a measurement — and it is a cheap typed probe with no focus
dependency.

### ⚠ Row 1 — `Group` DOES create a chain, and E4d route 7's ○ is wrong

With the device panel focused and a device selected, the named action `Group`
turned `[Polysynth, Polysynth]` into `[Instrument Layer, Polysynth]` with the new
container reporting **1 chain holding the Polysynth**. A device chain came into
existence programmatically. That is the second time a *"no named action does
this"* ○ has fallen to E16j's shape.

⚠ **Two things had to be fixed before the row was probeable at all, and both are
findings in their own right.**

1. **`devcursor.selectAt` does NOT set Bitwig's UI selection.** It calls
   `CursorDevice.selectDevice()` on a cursor track created with
   `shouldFollowSelection=false`, so it moves *our* handle and leaves Bitwig's
   selection alone. `Device.selectInEditor()` is the actual setter and was not on
   the wire. **So row 1 was never ○ — it was unreachable**, and every previous
   argument about device-scoped actions concerned a selection nobody had set.
2. ⚠ **The device-panel gesture needs Bitwig in the FOREGROUND** — measured
   properly in `e17m` after a first, wrong diagnosis (below). **0/8 backgrounded**
   across both focus regimes, against ● every time frontmost. In the same runs
   `Create Group Track` (a **Project** action) fired backgrounded in 282–286 ms.
   ⚠ **The mechanism is UNEXPLAINED and the obvious generalisation is false:**
   E16j ran `Group` — an *Editing* action — backgrounded AND minimised across 5
   runs and it fired every time, on a TRACK selection. So the rule is not "Editing
   actions need foreground"; it is narrower and stranger — *this device-panel-routed
   gesture* does, and track-selection actions do not. Recorded as an empirical
   rule, unexplained, exactly as E16j recorded its own discrepancy.

**But one chain is not a branch, and it never becomes two:**

| follow-up (`e17i`) | result |
|---|---|
| group the neighbouring device — does it join as chain 2? | ○ **1 → 1**, the Organ stayed outside |
| ⚠ `Select All` + one `Group` — Bitwig's own multi-device gesture | ○ **1 chain holding `[Polysynth+Organ+Phase-4]` in SERIES** |
| group the container itself | nests, does not grow |
| ⚠ **`Ungroup`** — the missing counterpart | ○ **the container survives** |

⇒ ⚠ **`Group` is a device WRAPPER, not a take container.** It always produces
exactly one chain, whatever is selected, and nothing dissolves it again. E4e's
architectural negative survives where it matters: **no route reaches a second
chain**, and the preset (E4d route 4) remains the only way to obtain one.

### Rows 2 and 3 — duplicate ○ and create ○, both now bracketed

E4d recorded routes 1 and 2 as silent no-ops **through a cursor-following bank
with no precondition assertion**, eleven days before E16o discovered that shape
produces a no-op byte-identical to an API refusal. Re-run with the container
proved selected before every call:

| | populated (2 filled chains) | empty (fresh FX Layer, 1 chain) |
|---|---|---|
| `DeviceLayer.duplicateObject()` | 2 → 2 ○ | 1 → 1 ○ |
| `Channel.duplicate()` | 2 → 2 ○ | 1 → 1 ○ |
| `host.duplicateObjects()` (3rd mechanism, `e17e`) | 2 → 2 ○ | — |
| ⚠ **VERB CONTROL** — the same verb on a `Device` | ● **1 → 2 in 280 ms** | |

Row 3 added the last two untried readings, against three fixture states:

| | 0 chains | 1 chain | 2 chains |
|---|---|---|---|
| insert via the CONTAINER-SCOPED cursor | 0 → 0 ○ | 1 → 1 ○ | 2 → 2 ○ |
| ⚠ **CONTROL** — `startOfDeviceChainInsertionPoint` | | | ● **a device landed in chain 0** |

⚠ **Row 3, route 3 — the CLIPBOARD, and it closes `InsertionPoint` completely.**
`paste()` was the **14th of 14** members and had never been called: `layer.pasteInto`
went on the wire in session 4 and sat unused, because filling the clipboard needs
`Application.copy()` on a UI selection and **nothing could set a device selection
until `device.selectInEditor` landed this session**. Row 1's ● also changed the
prior — the named-action surface demonstrably reaches into device-chain structure,
so `Paste` was worth aiming at a container.

| route | result |
|---|---|
| ⚠ **CONTROL** — `Copy` then `Paste` at top level | ● **2 → 3 devices**, so the clipboard is live and reachable |
| the named action `Paste` with the CONTAINER selected | ○ **chains 1 → 1** — the device landed BESIDE the container, not inside it |
| ⚠ **`layer.pasteInto`** (member 14/14) | ⚠ **● FILLS a chain: `0:[Polysynth]` → `0:[Polysynth+Organ]`**, chains 1 → 1 |

⇒ ⚠ **A new capability, small but real: a chain can be populated from the
CLIPBOARD.** That is a third route into an existing chain beside
`insertBitwigDevice` (E4c) and `moveDevices` (E16n) — and it is the only one that
**copies** rather than moves, so the human's own device can be auditioned inside a
container *without being taken off the track*. Useful for the residual role
(`E17-VERDICT.md` §5); useless for creating a chain.

⇒ **All 14 `InsertionPoint` members are now exercised.** Row 3's ○ rests on the
complete interface rather than on a sample of it.

⚠ **And row 3 produced the mechanism, not just the verdict: `cursorLayer0.exists()`
is FALSE on every container, including ones that HAVE chains.**
`createCursorLayer()` never acquires a referent unless something selects a layer,
so the insertion point had nothing to bind to — which is E4e's *"an
`InsertionPoint` must bind to a referent"* demonstrated rather than argued. A
javadoc sweep confirms the shape of the gap: **exactly 11 methods in the whole
API return an `InsertionPoint`, and not one hangs off a container `Device`.**

Complete-recall pass over the hole the previous sweeps left (standing rule 10):
**`Application` has 94 members** and contains no creation verb of any kind —
`navigateIntoTrackGroup` / `navigateToParentTrackGroup` are navigation.
**`DeviceLayerBank` declares exactly ONE member** (`getChannel`, and it is
`@Deprecated`).

### ⚠ Row 4 — DELETE is ○, and this is the row that decides the session

`DeviceLayer` extends `DeleteableObject`. **It does not honour it.** Four routes
on a 4-chain container (`[Phase-4, Polysynth, Organ, Sampler]`, four distinct
devices so every survivor is *named* rather than counted):

| route | result |
|---|---|
| `DeviceLayer.deleteObject()` | 4 → 4 ○ |
| `host.deleteObjects(layer)` | 4 → 4 ○ |
| `deleteObject()` after `layer.selectInEditor()` | 4 → 4 ○ |
| `host.deleteObjects` after `layer.selectInMixer()` | 4 → 4 ○ |
| ⚠ **VERB CONTROL 1** — `Device.deleteObject()` | ● **1 → 0 in 577 ms** |
| ⚠ **VERB CONTROL 2** — `host.deleteObjects()` on a clip slot | ● **emptied in 256 ms** |

Both controls fired **in the same run**, so the verb is alive and the refusal is
specific to layers.

⚠ **The direction is the OPPOSITE of the file format, which is worth more than
the row itself.** E10c/E10d found chains **removable** offline but not
insertable, and the handoff predicted the live API might show the same
asymmetry — *"two independent layers of the product showing the same asymmetry
would be a finding in its own right"*. They do not agree. Live, chains are
**neither** insertable nor removable; offline they are removable. So `bwmod`'s
chain trim is not a preview of an API capability — it is a **strictly
offline-only** one, and the only route to a chosen chain count.

### ⚠ Row 5 — rename ●, and it CORRECTS E4c

E4c recorded that a layer *"renames itself after its content"* and the handoff
inherited that as *"layer names are volatile, so the lineage tag needs a
different home"*. **An explicitly set name is sticky.**

| | |
|---|---|
| `layer.setName(0, "A·take")` | ● read back exactly — the middle dot round-trips, as E16q found for tracks |
| ⚠ then INSERT A DEVICE into that chain and re-read | ● **still `A·take`** |

⇒ E4c's observation is about the **default** name tracking content, not about the
API overwriting a name someone chose. **§1b's naming scheme would survive a move
to layers** — a human-readable, human-editable lineage tag can live in a layer
name. (Recorded even though rows 1–4 make the move moot: it is a standing
correction to E4c, and it applies to the preset-supplied containers §3 keeps.)

### ⚠ Row 6 — solo is CONTAINER-SCOPED and LOCALLY EXCLUSIVE ●●

The one row that came back better than hoped, and the only one still load-bearing
after the model call.

**Scope, measured silently.** `isMutedBySolo()` is marked at init and reported
per track by `branch.vu`, so the scope question needed no ears:

| | tracks flipped to `mutedBySolo` |
|---|---|
| ⚠ **CONTROL** — solo the TRACK `gn-lay` | **10** — the oracle can see a global solo |
| solo one CHAIN of its Instrument Layer | ⚠ **0** |
| `SoloValue.toggle(exclusive=true)` on a chain | ⚠ **0**, flag sets |

**Local exclusivity, measured by meter against a mute calibration.** "Not global"
is not "usefully exclusive" — a layer chain exposes no `isMutedBySolo`, so a
solo that does nothing locally reads identically to one that is politely scoped.
⚠ The mute-based A/B (E16w ●) supplies today's ground truth for each arm, which
makes this quantitative rather than an ear trial:

| state | subject's own tap |
|---|---|
| both chains open | 66 |
| chain 0 alone (by MUTE — calibration) | 63 |
| chain 1 alone, dark, F1FREQ 15.3 Hz (by MUTE — calibration) | **25** |
| ⚠ **SOLO chain 1** | ⚠ **23** — distance 2 from "chain 1 alone", **43** from "both open" |
| ⚠ **SOLO chain 0** (the mirror) | **60** — against "chain 0 alone" 63 |
| every solo cleared (CONTROL) | 67 |

⇒ ⚠ **This is the mutually-exclusive selection gesture the user asked for in
session 5's closing exchange** — *"internal exclusive solo among a group"* —
and it needs no selector and no routing. It also answers §4.4's real complaint:
the live state is **one flag per chain that is exclusive by construction**, not
E16m's N independent mute flags where a child's own flag says nothing.

⚠ **Deliberately stronger than an ear trial, and that is method rather than
convenience.** §3.4e had to state that a null ear result *"cannot distinguish
'no glitch' from 'this listener and rig could not have heard one anyway'"*.
Calibrating against the mute arms removes that whole class of caveat: the reading
lands on one of two numbers measured minutes earlier on the same fixture, and the
probe refuses to read the solo arms at all unless those two differ by ≥ 10.

### ⚠ Three method traps this session paid for

1. **A positive result does not need its control to pass; a NEGATIVE does.**
   `e17d` printed "INCONCLUSIVE" over a genuine ● because its verdict logic
   checked a failed control before the row's own result. The clip-launcher
   control had failed for an unrelated reason while the row itself succeeded —
   and the row succeeding *is* proof the dispatch path worked. Controls exist to
   make ○ meaningful, and ordering them ahead of a ● inverts that.
2. ⚠ **`device.list` right after `cursor.pointTrack` returns the PREVIOUS track's
   chain** — up to 6 of 13 tracks, reproducibly (`e17-diag`). A probe that
   baselines with that read is comparing two different tracks; the first `e17b`
   run did exactly that and its precondition caught it. ⚠ **And the obvious fix
   is not enough:** polling for *"two consecutive equal reads"* is satisfied
   immediately by a stale-but-*stable* value. **Wait on the cursor's own
   `trackPosition`** — the bank cannot have re-scoped before the cursor arrived.
   ⚠ This bit twice, and the second time is the instructive one: `e17-diag`, the
   diagnostic written specifically to expose this trap, used the two-equal-reads
   heuristic itself and reported `gn-lay` as holding `gn-E16`'s devices. An
   instrument built to detect a fault is not automatically immune to it.
3. **A predicate any wrong answer satisfies is not a check.** `e17-setup`'s first
   descend polled for *"a device whose name does not contain 'Layer'"* and went
   green in 43 ms against `Instrument Selector` — the previous fixture, which the
   cursor had never left. Name the expected object (the e16t rule) rather than
   excluding one wrong one.
4. ⚠⚠ **A RETRACTED DIAGNOSIS, recorded because the retraction is the lesson.**
   `focus_or_toggle_*` IS a toggle and therefore not idempotent — that much is
   true from the javadoc. On that basis a mid-session note claimed the toggle
   explained every dispatch failure and that the foreground gate did not exist.
   ⚠ **`e17m` then measured 0/8 backgrounded with focus handled deterministically,
   so the toggle explains nothing and the gate is real.** The `e17j` pair that
   looked decisive — fail, fix the toggle, succeed — had an unnoticed confound:
   the operator had said they were foregrounding Bitwig just before the failing
   run, and the succeeding run came a minute later. A timing effect was attributed
   to the fix. ⇒ **The toggle remains a real hazard in principle and has never been
   shown to cause a single failure.** Two rules fall out: *"the user brought Bitwig
   forward"* is never one variable, it is also *"the user clicked, changing panel
   focus"*; and a new explanation that contradicts an existing measurement (E16j's
   5 backgrounded runs) has to beat it, not walk past it.
5. ⚠ **A probe that fires a selection-scoped action must diff EVERY level the
   action could land on.** `e17p` swept 6 navigation candidates, firing `Duplicate`
   after each, and measured *chains inside device 0* and *devices inside those
   chains*. The navigation never moved the selection, so all six fires duplicated
   the CONTAINER — which changes neither quantity. The instrument was blind to its
   own side effect, the `app.undo` cleanup was gated on a signal that could not
   appear, and the fixture ended with **8 stacked Instrument Layers**. The row's ○
   is unaffected (chains were read through device 0 throughout), but the whole
   point of a selection-scoped action is not knowing where it landed.
6. ⚠ **The device cursor ORPHANS after a burst of deletes, and only a track-cursor
   MOVE recovers it.** After deleting 7 devices, `devcursor.status` read
   `exists:false, name:""`, and neither `devcursor.selectAt` nor
   `devcursor.selectInChannel` re-bound it — so `layer.list` reported the surviving
   container as having **zero chains**, which reads exactly like "the cleanup
   deleted the wrong ones". Pointing the TRACK cursor at another track and back
   restored all 4. E1/E3's "re-point after any structural op" needs the sharper
   detail: **the re-point must be a real move; re-pointing at the same track is not
   enough.**
7. ⚠ **Marking two handles in one `try` block means one bad call costs both.** The
   selection observers were added at init inside a single guard;
   `addIsSelectedObserver` is `@Deprecated` and threw *"This has been deprecated
   since API version 2"*, so `addIsSelectedInEditorObserver` — documented
   **current** — never attached either. The guard did its job (rules 9/13: the
   extension stayed up), but the readback that would have made `e17k`
   interpretable was lost to the same single-mechanism error the spike keeps
   finding elsewhere. ⚠ Chain selection therefore remains **unobservable** in this
   rig, which is why `e17l` needed a human at all.

### ⚠ The complete-recall pass, stated so the ○s can be audited

Prompted by a challenge that the sweeps might have been searching `chain`/`channel`
naming rather than `layer`. Re-run three ways, and the answer is the same each time:

- **By NAME:** exactly **8 members** in the whole 1968-member API contain "layer" —
  `Device.createCursorLayer` / `createLayerBank` / `hasLayers`,
  `CursorDevice.selectFirstInLayer`×2 / `selectLastInLayer`×2, and
  `NotificationSettings.setShouldShowDeviceLayerSelectionNotifications`. Views,
  navigation and a preference; none creates. Of **291 types**, only `DeviceLayer`,
  `CursorDeviceLayer` and `DeviceLayerBank` carry the name.
- **By SUPERTYPE, transitively:** a `DeviceLayer` reaches **46 members** across 6
  supertypes (`Channel` 24, `DeviceChain` 12, `Subscribable` 4, `DeleteableObject`
  2, `DuplicableObject` 2, `ObjectProxy` 2); `CursorDeviceLayer` 59 across 11;
  `DeviceLayerBank` 53 across 7. ⚠ `Subscribable` was the one supertype no previous
  pass had enumerated — its four members are subscription lifecycle and cannot
  create or delete anything.
- **By CONCEPT, ignoring naming entirely:** 110 create-shaped members survive
  stripping observers and view factories. The ones that touch DOCUMENT CONTENT are
  `Application.create*Track` ×3, `Project.createScene*` ×2,
  `Track.createNewLauncherClip`/`createParentTrack`, the clip-slot creators,
  `DrumPad.insertionPoint()`, the three duplication verbs, and `InsertionPoint`'s
  14 — every one probed. ⚠ `ControllerHost` (112 members) had never been
  enumerated either; every `create*` on it is a proxy factory or infrastructure.

---

## E16s — a clip move is DETECTABLE, pushed, and `slot.moveTo` is ours to perform [K] (2026-07-31)

**Verdict: ● both halves, and the capability was a bonus.** A clip move fires
launcher-content observers as a **PAIR** — one slot emptied, one filled — for a
human drag and for an API move alike; and the move itself turns out to be
performable from the wire, which E16l had assumed only a human could do. Probes:
`e16s-clipmove.ts`, `e16s-human.ts`. New wire: `slot.moveTo`, `slot.epoch`.
Silent; nothing launched.

⚠ **The handoff's question could not be asked as written.** It asks whether a
clip `moveTo` bumps the scene epoch. It cannot: `sceneEpoch` lives in the brain
and is bumped by our own scene ops, so asking it whether a *human* moved a clip
is asking ourselves — the adapter's own comment says so. The answerable question
is **what observable, if any, changes**, and it has three possible answers with
very different consequences: POLLED (only `hasContent`, visible only if you
already suspected), PUSHED (an observer fires), or FOLLOWED (a pinned cursor
tracks the clip).

| row | result |
|---|---|
| CONTROL: a clip create / delete bumps the content epoch | ● +1 each, `t2s5=filled` / `t2s5=emptied` |
| `slot.moveTo` relocates a clip | ● **163 ms**, via `replaceInsertionPoint().moveSlotsOrScenes()` |
| an API move is PUSHED | ● **+2**: `t2s0=emptied`, `t2s5=filled` |
| a cross-track move | ● `t2s1=emptied`, `t3s5=filled` — names both tracks |
| ⚠ **a HUMAN drag is PUSHED** | ● **+2**: `t2s7=emptied`, `t2s3=filled` |
| the human's own report of where they dropped it | ● **agrees exactly** — row 7 → row 3, gn-A |
| §3.2.3's scene-count observer sees a move | ○ **no**, 3 → 3 — the blind spot it predicted, measured |
| a PINNED cursor follows the clip | ○ **no** — stays at the old position |

⇒ **Moved clips are cheap to detect**, and §3.2.3's extension-side observer
should watch launcher CONTENT rather than only scene count. A move is
distinguishable from a bare create or delete because it arrives as a pair, and
the log names the slots rather than counting them.

### ⚠ `ClipLauncherSlotOrScene.moveTo` is @Deprecated — and the doc pass changed the row

Since API 4: *"Use `replaceInsertionPoint()` instead"*. Standing rule 9 exists
because E7's `getModulationSource(int)` threw and took the whole extension down,
so the wire method defaults to the **modern** route and reaches the deprecated
call only when asked for by name. The modern route lands on
`InsertionPoint.moveSlotsOrScenes(…)` — the same 14-member interface whose
sibling `moveDevices` overturned E4d last session, and whose verbs are known to
disagree with each other.

### The method note — the human half nearly did not happen, and it was the row

`e16s` runs its API moves and then SKIPS the human drag when stdin is not a TTY,
which is the case when an agent drives it. That skip prints a warning that the
run is **incomplete and must not be written up as a verdict**, because the threat
model is a human moving clips and the API moves are only the control. `e16s-human`
exists to split the measurement into `arm` and `read` so the human half can be
driven from a conversation — the epoch lives in the extension, so it survives
between invocations.

⚠ **The agreement between the two independent accounts is what carries the row.**
The observer said `t2s7=emptied, t2s3=filled`; the human, asked separately and
before seeing that, said "row 7 to row 3 on gn-A". An observer that fired on the
wrong slot would be worse than one that stayed silent, because it would be
trusted.

---

## E16t — `createEqualsValue` is a TRACK-drift guard, is meaningless between two cursors, and fails GREEN [K] (2026-07-31)

**Verdict: ◐ narrowly useful and dangerously shaped.** It detects positional
drift — which D6 has nothing equivalent to — and it is **meaningless between two
proxies of the same cursor kind**, where it reads `true` unconditionally. Probes:
`e16t-equals.ts`, `e16t-diag.ts`, `e16t-diag2.ts`. New wire: `equals.status`,
`equals.tryCreate`. Silent.

| row | result |
|---|---|
| ⚠ **standing rule 13** — `createEqualsValue` outside `init()` | ● **REFUSED**: *"This can only be called during driver initialization"* |
| 65 pairs pre-allocated at init | ● `built:65`, no init failure |
| settle time after a repoint | ● **96 ms** |
| cursor ↔ bank item, same object | ● true, and **exactly one** bank row matches |
| survives a RENAME | ● true — D6's name check would have failed |
| ⚠ **detects a POSITION SHIFT** | ● **false at the old index, true at the new** |
| cursor ↔ cursor (tracks) | ○ **true on DIFFERENT tracks** — meaningless |
| clip cursor ↔ clip cursor | ○ **true across different slots AND different tracks** |
| pool clip ↔ host follower clip | ● false — so it is not literally constant |

⇒ **The rule is not "createEqualsValue works".** It is: **it works between a
CURSOR and a BANK ITEM, and is meaningless between two cursors of the same
kind.** For clips there is no cursor-vs-bank-item pair available at all — a
`Clip` and a `ClipLauncherSlot` are different objects and the bank holds only the
latter — so it offers clips nothing and **E16l stands**.

### ⚠ Rule 13's fifth independent occurrence

`getDocumentState()` settings (E14-C2), `host.createBitmap` (E14-I5), cursor
pools (E1), device/param handles (E5), and now this. The rule's status changes:
it has been treated as a **default to assume** for anything the API hands out,
and it is now a measured property of five unrelated subsystems.

### ⚠ The claim this row made and then withdrew, and the direction it failed in

`e16t` asserted cursor↔cursor as an **aliasing detector** — E2c's fixture
contamination, caught directly rather than from symptoms — and never exercised
it; it only ever exercised cursor↔bank-item. `e16t-diag2` §G exercised it: `ct0=ct1`
reads **true on different tracks**. The claim is withdrawn.

⚠ **The failure direction is the point.** An aliasing detector that is always
true reports "no aliasing" by reporting "always aliased" — it fails **GREEN**. It
was caught only because §F's cross-track clip result impeached a guard the row
had already published, and the impeachment was chased instead of written up.

⚠ **Two probe defects produced things that read like findings**, both from a
discarded return value, and both caught by their own transcripts: `e16t` ignored
`point()`'s result while cursor 1 was still track-pinned; `e16t-diag` §1b asked
for scenes 11 and 12 in a project whose slot bank has 16 rows but whose **rows
past the scene count are not pointable**, so both cursors stayed at scene 1 and
"two cursors on different empty slots compare equal" was two cursors on the SAME
slot. That is the E16o trap twice in one row.

### ⚠ The sharpest limitation: it detects DRIFT, not DEATH

A pinned cursor whose target is **deleted** silently slides onto the track that
inherits its position — `cursor.status` then reports `trackName="gn-B"` — and the
equals value reads **true against the wrong track**. Named rather than counted,
per E16r's method note: `e16t` printed "matches 1 row", and only naming the row
turned that into the finding.

⇒ The guard answers *"is this cursor the same object as that bank row"*. It never
answers *"is this cursor still on the object I aimed it at"*, because the cursor
itself is not durable. **Pairing with `channelId` stays mandatory**, and pinning
does not protect against deletion.

---

## E16u — a branch costs ~20 KB on disk and nothing in save time [K] (2026-07-31)

**Verdict: ● measured, and disk is NOT the binding constraint.** Owed since row
C4, which recorded a baseline and stopped. Probe: `e16u-filesize.ts`, four forks
of the heavy fixture, two human ⌘S.

| | |
|---|---|
| baseline | **404,130 bytes**, 10 tracks, ~1 s save (user report) |
| after 4 forks of `gn-E16` | **485,694 bytes**, 14 tracks, **~1 s** — *"exactly the same, perceptually"* |
| delta | **+81,564 bytes over 4 forks ⇒ 20,391 bytes per fork** |
| the fixture's own cost | ~45 KB (C4), so a fork is **0.45×** the original |

⚠ **The old baseline was STALE and was not used.** C4's 385,619 was the
2026-07-26 13:12 backup; the file was already 403,236 by 16:01 that day and had
been churned through two further sessions. Differencing against it would have
measured two sessions of unrelated work.

⚠ **The compression confound was ruled out rather than assumed.** Four *identical*
forks are the best possible case for a compressor, which would have made 20 KB a
floor rather than a cost. `gzip -9` takes the project from 485,694 to 46,021
bytes — **ratio 0.095** — so the file is stored **largely raw** and the delta is a
genuine per-copy cost.

⇒ **Extrapolated, a full 26-fork `A·`–`Z·` lineage adds ~530 KB to a 404 KB
project**, and save time did not move at all across 10 → 14 tracks. **The bank
window (§3.4a) remains the binding constraint on the branch budget; disk is not.**

⚠ **What is NOT measured:** these forks are identical to their original. A real
branch diverges, and divergent device state may not share whatever these shared.
20 KB is the cost of a *fresh* fork, not of a heavily-edited one.

---

## E16w — ⚠ a DeviceLayer chain's `mute()` WORKS: a device-scoped A/B exists [K] (2026-07-31)

**Verdict: ● the lead holds.** `DeviceLayer` declares zero members of its own and
inherits `Channel`, and the `Channel` mixer works on a layer chain: muting the
chains takes the track out of the mix **as completely as muting the whole track**.
Probes: `e16v-devab.ts` (setup + selector), `e16v-diag.ts`, `e16w-lead.ts`. New
wire: `layer.setMixer`, plus mixer fields on `layer.list`.

| state | subject's own tap | **master** |
|---|---|---|
| open, both chains live | 57 | **57** |
| FLOOR — subject muted at its own mixer | 57 *(pre-mute, trap 1)* | **12** |
| ⚠ **both chains muted** | 11 | **11** |
| unmuted again | 57 | — |
| chain 0 alone (default patch) | **58** | — |
| chain 1 alone (F1FREQ at 19.4 Hz) | **16** | — |

⇒ **A device-scoped A/B is real and costs no bank slot and no C5 duplication
glitch.** It reaches the master and the FX returns — the two places a fork cannot
reach (§4.8) and the first to leave the addressable set as a lineage grows
(E16r). The mute flag reads back as set, so the API accepts the write.

⚠ **The prior said this might not work and was right to.** `DeviceLayer` was a
silent no-op for `duplicateObject` and `duplicate` (E4d routes 1–2) — a supertype
method is a claim, not a capability. What distinguishes this case is that those
are **structural** verbs, which E4e explains architecturally (an insertion point
must bind to a referent, and a layer that does not exist has none), whereas
`mute()` is **state on a chain that already exists**.

⚠ **What it does NOT buy, so the row is not oversold.** Layer chains run in
PARALLEL, so muting is not switching, and the live state lives in **N mute
flags** — which is exactly what §4.4 exists to replace, and is E16m's finding one
level down. A `ChainSelector`'s `activeChainIndex()` is the single readable
integer §4.4 wants. **This is the cheap A/B that works with an asset we have; the
selector remains the answer to §4.4.**

**Free rider: layer chains have their own `channelId`** — `26440486-…` and
`397aff43-…`. E16l enumerated `Channel` for tracks only and never asked whether
this population existed. Unprobed for durability across save/restart.

### ⚠ THREE failed attempts before this one, each caught by a control rather than luck

This row is the strongest argument in the spike for asserting preconditions
separately from the question.

1. **`e16v meter` read only the MASTER** and saw 62 → 56, which looks like "the
   mute does nothing". `e16v-diag` §0 then found **Group 7, gn-E16, gn-sel and
   gn-lay all sounding at 54–58 with nothing of ours launched** — the master was
   measuring the project, not the subject. A count where a name was needed, which
   is `e16r-diag`'s mistake again.
2. **`e16v-diag` read the right meter but its subject had stopped playing** —
   open 5, restored 0. Its "mute silences it" line **PASSED**, comparing silence
   to silence. Only the PRECONDITION and the CONTROL failing beside it revealed
   that a probe asserting just its headline would have published a ●.
3. **`e16w`'s first run destroyed its own subject.** It called `transport.play`
   after each `slot.launch` and `transport.stop` between retries — but launching a
   launcher clip **starts the transport itself** (which is how E16m held a sound
   through eight toggles without touching the transport). The retry loop was
   tearing down the playback it was retrying: attempt 1 caught a decay tail of 5,
   attempts 2 and 3 read 0.

⚠ **And the FLOOR CONTROL is what finally made the numbers mean anything.** The
room's master floor is **12, not 0**, so every reading sits on a pedestal. Muting
both chains gives **11 — at or below that floor**, against 57 open. Without the
floor, 11 would have been an unexplained "not quite silent" and the row would
have been written up as ◐. Recorded rather than rounded away, exactly as E16m
recorded its group-muted 2 against a child-muted floor of 1.

⚠ **A trap for every future audible row:** the per-track VU tap is PRE-MUTE
(trap 1), so **muted tracks still read 56–58 on their own meters**. A "is the room
clean" check written over per-track meters reports contamination that does not
exist. The master is the arbiter for *"does it reach the mix"*; the track's own
tap is the arbiter for *"did the device stop producing"*, and a device-layer mute
is upstream of it.

---

## E16 §3.4e — chain-selector switching: ● latency and sends, ⚠ glitch owed [K] (2026-07-31)

Measured on `gn-sel`, an **Instrument Selector the user built by hand with two
chains** — Selectors ship with zero and E16o proved no verb seeds one, so the
shell has to come from a human. The chains were then filled by
`layer.insertDevice` at **135 ms and 146 ms**, matching E4c's ~143 ms.

| row | result |
|---|---|
| a Selector's chains appear in the `DeviceLayerBank` | ● **2**, `hasLayers=true` |
| `layer.insertDevice` populates a Selector chain | ● 135 / 146 ms |
| `chainselector.status` | ● `exists=true chainCount=2 activeChainIndex=0` |
| ⚠ **switch latency** | ● **25 ms** to `activeChainIndex==1` (50 ms round trip) |
| the other chain is audible — switching does not silence the track | ● 57 → 58 own tap |
| ⚠ **does switching cut the track's SENDS?** | ● **NO** — FX 1 reads **51 before, 52 after** |
| ⚠ **does switching GLITCH?** | ○ **NO** — **0/4 real vs 0/4 placebo**, forced balance |

⇒ **A chain switch does not touch routing.** A track mute cuts sends (E2); a
chain switch happens *inside* the instrument, upstream of the send tap, so the
send keeps flowing and carries whichever chain is active. **That is the property
that makes a selector usable on an FX RETURN and on the MASTER.**

⚠ **`devcursor.selectFirstInLayer` descends into an Instrument LAYER's chain
(141 ms) but TIMES OUT on an Instrument SELECTOR's** (6 s, cursor stays on the
container). The two container types expose the same 2 chains to `layer.list` and
diverge on cursor descent. Consequence for this row: the Selector's two chains
could not be differentiated by parameter, so both hold the same default
Polysynth.

⚠ **That is not a degraded experiment — it is the right one for the glitch
question.** With both chains identical the switch should be inaudible, so
**anything heard at a switch point IS the glitch**, uncontaminated by a timbre
change. C5 measured duplication's glitch the same way.

### ⚠ The glitch row: ○ no glitch — and the verdict check had to be inverted

8 trials, **forced 4 real / 4 placebo** (not a coin — E16m's coin gave 5/1 and
left that row's ear half resting on a single placebo trial). The user, run in
their own terminal with live trial markers: *"I did not hear glitches or dropouts
at any point."* **0/4 real, 0/4 placebo.** Meter: real avg 58.5 vs placebo 56.5 —
no dropout on the real arm.

⇒ ⚠ **A chain switch is clean where a fork is not.** C5 measured track
duplication glitching **5/5 against 0/3 placebo**. So the device-scoped A/B is
free of the one cost that makes a branch point *"never free and never automatic"*
(§6.4) — and it is 25 ms.

⚠ **The check scored this clean result as a FAILURE**, because it asserted "the
ear separates the real arm from the placebo arm" — correct for the layer-mute
row, and exactly backwards here, where both chains hold the same patch and a
correct switch is **inaudible by construction**. E16m's method note records
catching this same shape *before* its run (*"an earlier draft asserted
`silences || separated`, which would have printed a red X against a perfectly
clean ○"*); this one was caught after. The assertion is now mode-dependent.

⚠ **The weakness, stated rather than buried: a null ear result cannot distinguish
"no glitch" from "this listener and rig could not have heard one anyway."** The
missing arm is a POSITIVE control — a trial where an artifact certainly occurs.
The layer-mute A/B (E16w) is precisely that control and was **not** run in the
same sitting. Until it is, this row rests on the null result plus the meter, and
should not be quoted as strongly as C5, which had an audible artifact in its own
real arm.

### ⚠ The send check that PASSED without asking anything

`e16v meter`'s send row compared `fxOnChain0: 0` against `fxOnChain1: 0` and
passed — because `gn-sel` had **no send configured at all**. The check carried an
`|| open.fx <= 0` escape hatch that let an unasked question look answered: **two
silences making a green**, which is rows D–G trap 6, in a fixture built after
that trap was documented. `e16v-diag` configures the send, **proves it live at 51
before the switch**, and would report the question UNANSWERED rather than answer
it if it could not.

---

## E16p / E16q — the bridge serves two clients atomically, and the middle dot round-trips [K] (2026-07-30)

Two small rows, each closing a premise something larger was about to be built on.

### E16p — ⚠ the revision guard is atomic ACROSS CONNECTIONS ●

**Run because the §3.2 proposal to retire `ghostnoted` rested on a CODE
READING** — `Bridge.java` accepts each client on its own thread and `ExecState`
claims thread confinement makes check-apply-bump atomic for free. Standing rule
10 applies to reading source exactly as to reading javadoc, and this spike has
been wrong five times from that move. Probe: `e16p-multiclient.ts`; every batch
op is `ping`, so nothing in the project is touched.

| row | result |
|---|---|
| P1 two clients connected and served | ● identical `methodsHash` from both |
| P2 12 interleaved round trips each | ● **0** replies delivered to the wrong client |
| P3 both read the same revision | ● one counter, not one per connection |
| P3 B's batch tagged with the revision A consumed | ● rejected whole, `reason: stale-revision` |
| ⚠ **P4 both submitted concurrently against one revision** | ● **exactly one winner, 6/6 rounds** |
| P5 one client disconnecting | ● the other is unaffected |

⇒ **Retiring the daemon gives up no ordering guarantee.** E8-D had tested the
guard with one client simulating interference via `revision.bump`, which proves
the guard works and says nothing about processes; this says it holds across them.

⚠ **What it does NOT show:** that two agents writing concurrently is a good idea.
The guard makes writes **ordered, not coherent** — a rejected batch still has to
be re-planned against the new world by whoever sent it. That is an MCP-server
design question, not a bridge property, and it is the residual cost of retiring
`ghostnoted`.

### E16q — `track.setName` round-trips non-ASCII exactly ●

The whole lineage-naming scheme (§1b) rests on `·` (U+00B7) surviving a write and
a read. It does. Probe: `e16q-naming.ts`, one throwaway track, deleted after.

- ⚠ **`B· Bass different-line` round-trips EXACTLY, compared by CODEPOINT** —
  U+00B7 in, U+00B7 out. Compared by codepoint deliberately: `·` U+00B7,
  `∙` U+2219 and `•` U+2022 are indistinguishable at UI sizes and a silent
  substitution would pass any human check.
- **10 of 10 non-ASCII cases exact**, including CJK (U+97F3) and an astral-plane
  emoji (U+1F3B9, a surrogate pair). So non-ASCII is not special-cased anywhere.
- A **96-character** name is not truncated by `name().get()` — a long original
  name plus a tag plus a gist survives.
- Leading and trailing spaces are preserved.

⚠ **One incidental, and it has a consequence.** An **empty** name reads back as
`"Inst 8"` — Bitwig substitutes a display default, so **a track is never
nameless**, and the default appears to derive from creation order rather than
being stored data. The scheme tags every lineage member so this does not bite
it, but **the reaping guard's "refuse to delete an untagged track" must test for
the ABSENCE OF A TAG, never for an empty name.**

---

## E16r — ⚠ the bank window pushes the MASTER and the FX RETURNS out FIRST, and a fork at the ceiling is an orphan [K] (2026-07-30)

**Verdict: ● the budget is measurable and `itemCount` still reports the project
total under `ALL_CHANNELS` — so standing rule 5 remains implementable. ⚠ But two
things fall out that are worse than a ceiling**, and neither was anticipated:
the tracks that leave the addressable set *first* are the **Master and the FX
returns**, and a `track.create` past the window **mints a track whose identity we
never learn**. Probes: `e16r-budget.ts`, `e16r-diag.ts`. Silent; both refuse
while the transport rolls; the project was returned to its exact starting state.

| row | result |
|---|---|
| §3.4a `itemCount` past the window under `ALL_CHANNELS` | ● reports the PROJECT total (21) while visible saturates at `bankSize` (16) |
| §3.4a which tracks fall out | ⚠ **Master at 17, then FX 1 at 18**, stable at 14 thereafter. Position 0 never moved |
| §3.4c fork burst cost | ● **0.61×** a spaced duplication (73 ms vs 119 ms median) — a burst is *cheaper* per fork, not worse |
| §3.4i cursor-pool pressure | ● 3/3 concurrent pins; asking for a cursor past the pool **throws** (`Index 3 out of bounds for length 3`) rather than aliasing |

### ⚠ The window is anchored, and that is exactly why the Master goes first

Two hypotheses were on the table: a window **fixed** at positions 0..15, or one
that **scrolls**. The measurement fits neither as stated. Position 0 kept
resolving throughout, so it does not scroll — but known tracks *did* fall out,
which a naive "fixed" model says cannot happen.

**Both are true because creating tracks REORDERS positions.** A flat bank orders
regular tracks, then FX returns, then Master, and every new track is inserted
*before* that tail. So the tail's positions rise and it crosses the ceiling,
while position 0 never moves.

⇒ ⚠ **The first things to become unaddressable are the master bus and the FX
returns.** That is a sharp consequence for this model specifically:

- **Every audibility verdict in E16 reads the master or an FX return** — E2, E1,
  E5, and E16m's group-mute row all do, because trap 1 makes a track's own meter
  useless (it is pre-mute). **Approaching the ceiling costs the measuring
  instrument before it costs any ordinary track.**
- §4.8 already says FX returns cannot be forked and an FX change affects every
  sibling identically. Now they are also **the first thing to disappear** as a
  lineage grows — and lineages are what fill the window.
- The failure is silent in the worst way: `resolveByChannelId` on the Master
  returns `found:false`, which is byte-identical to the answer a **deleted**
  track gives (E2f/D1, trap 12).

### ⚠ The finding `e16r` produced by accident, which is worth more than the row it broke

`e16r` learned each new track's `channelId` by diffing `track.list`. **Past the
ceiling a created track never appears there**, so the diff yielded nothing and
three tracks were minted whose identity the probe never learned — and could
therefore never delete. They had to be swept by name against a KEEP set, by hand.

⇒ **A `track.create` past the bank window mints a track we cannot name.** This is
sharper than E5's "state outside the window is unsnapshottable": the track is
**unaddressable and un-cleanable**, and `receipt.minted` — which D16/E2c specify
as reporting the `channelId` a new track was *found* at — silently has nothing to
report.

⚠ **Under the track-native model a fork IS a `track.create`**, so **a fork
attempted at the ceiling produces an orphan**: audible, consuming ~0.6 pp of
engine CPU (C3), and invisible to us. ⇒ **Standing rule 5's refusal must be
checked BEFORE the create, not detected after it.** As currently framed —
"detect and fail loud" — it is a post-hoc check, and post-hoc is too late for
this one.

### §3.4c — a burst is *cheaper* per fork, which was not the expected direction

Three spaced duplications (1.2 s apart) measured 143/96/119 ms; three back-to-back
measured 99/73/71 ms. **0.61×**, i.e. bursting is faster per fork — plausibly
warm caches and no re-settling between. ⇒ **An N-track turn need not pace its
forks for cost reasons.** ⚠ This measures *wall-clock to visible only*. C5's
audible glitch was not re-tested here (the transport is stopped, by refusal), so
**nothing here says an N-fork burst glitches once rather than N times** — that
remains owed and is the question a musician would actually ask.

### §3.4i — the pool, not the window, bounds concurrent addressing

`cursorPool` is 3 on this rig (D7 ships 8). All three pinned different tracks
concurrently, reconfirming E1 under a lineage-shaped project. Asking for cursor
`3` **throws** — `Index 3 out of bounds for length 3` — rather than silently
aliasing onto cursor 0, which is the right failure: a silent alias would land a
write intended for fork D onto fork A.

⇒ **A lineage wider than the pool must address its forks in sequence**, re-pointing
between them — which D6 already requires after any structural op, so this costs
no new discipline.

### Method note — the classifier that mis-read a true result, and the counting that nearly hid it

Two mistakes, both caught, both worth recording:

1. `e16r` checked whether the **newest** track resolved after each create, which
   assumes a window anchored at 0 *and* that positions do not move. Its FAIL was
   the probe correctly reporting that the model was wrong, not a defect.
2. ⚠ `e16r-diag` first **counted** how many known tracks dropped out and
   classified the result as "PARTIAL/OTHER" — an honest refusal to model, but it
   threw the finding away. **Naming the dropped tracks instead of counting them
   turned an unexplained pattern into the headline**: *"two known tracks fell
   out"* is an observation; *"Master, then FX 1"* is the result.

---

## E16n / E16o — ⚠ E4d route 3 is WRONG: `moveDevices` relocates a device into a layer, and it carries its state [K] (2026-07-30)

**Verdict: ● devices CAN be moved into a layer chain, and the moved device keeps
its parameter state. ○ it still cannot CREATE a chain.** E4d recorded
`InsertionPoint.copyDevices()` into a layer as a silent no-op and concluded
devices cannot be relocated into layer chains. ⚠ **That was a single-mechanism
check, and it is the FIFTH false negative of this spike from exactly that
shape** — after CLAP params, `channelId`, chain creation (E4c→E4d) and group
creation (E3→E16j). The sibling verb, never called until now, works.
Probes: `e16n-devmove.ts`, `e16o-movestate.ts`. New wire: `layer.moveDeviceInto`,
`device.moveTo`, `layer.pasteInto`. All silent; nothing launched.

| row | question | result |
|---|---|---|
| **target** | `moveDevices` into a layer chain | ● top level `[FX Layer, Polysynth]` → `[FX Layer]`; layer 0 `[]` → `[Polysynth]` |
| VERB control | `moveDevices` reorders a flat chain | ● `[FX Layer, Polysynth]` → `[Polysynth, FX Layer]`, count stable |
| DEST control | `layer.insertDevice` into the same chain | ● 1 → 2 devices (E4c ●, re-run in situ) |
| **O1** | does the moved device keep its STATE? | ● **`F1FREQ`=0.17 and `F1RESO`=0.83 both survived**, read through the nested cursor |
| **O2** | can `moveDevices` CREATE a chain? | ○ **no** — 0→0 on Instrument Selector, Instrument Layer and Note FX Layer; 1→1 growing an FX Layer |

### The complete-recall pass that found it

Grepped all **1968** members for every relocation-shaped token (`move`,
`relocate`, `reparent`, `transfer`, `reorder`, `copy`, `cut`, `paste`, `drag`,
`drop`, `insert`), then enumerated `InsertionPoint`, `Device`, `DeviceChain`,
`DeviceLayer` and `ChainSelector` in full. **`InsertionPoint` has exactly 14
members**, three of which relocate devices: `copyDevices` (○, E4d),
**`moveDevices`** and **`paste()`**. `relocate`/`reparent`/`reorder`/`drag`/`drop`
return **zero** hits, so no fourth route exists under another name.

⚠ **The javadoc argued AGAINST the reopen.** `moveDevices` and `copyDevices`
carry identical wording — *"If it's not possible to do so then this does
nothing"* — and the class doc specifies the silent no-op as intended. A doc pass
would have closed this ○ a second time. What justified the probe was empirical:
**E4c had measured a new device landing in that same layer chain in ~143 ms**, so
`copyDevices`' no-op was verb-specific rather than destination-specific — and row
A had already seen `copyTracks` ○ alongside three working duplication verbs on
the same object.

### Why the controls are the finding as much as the result

The run takes two independent controls so that **every outcome is
interpretable**, which is what E6 lacked:

| VERB | DEST | target | reading |
|---|---|---|---|
| ● | ● | ● | **what happened** — relocation works, E4d's ○ was verb-specific |
| ● | ● | ○ | layers specifically refuse relocation — E4d stands, on two verbs |
| ○ | ● | ○ | ⚠ inconclusive about layers; the verb is dead everywhere |

⚠ **The moved device is a Polysynth on purpose**: E4c proved a Polysynth can be
*inserted* into an FX Layer chain, so a refusal could not have been explained
away as "that type does not belong there". The only difference between the DEST
control and the target is the verb.

### ⚠ The method trap this sitting produced, and it nearly wrote a false finding

**`rig.layerBank0` follows `cursorDevice0`, and that binds the WRITE as well as
the read.** `layer.moveDeviceInto` reaches its destination through that bank, so
the container must be the selected device when it is called.

`e16o`'s first run marked the Polysynth's parameters — which selects the
Polysynth — and then moved. The destination resolved
`layerBank0.getItemAt(0)` against a Polysynth, which has no layers, so the
insertion point had no referent and did nothing. The transcript read
`layer 0 now holds [—]`: **byte-identical to a genuine API refusal.** The run
reported `O1: a relocated device DOES NOT KEEP its state`, which is not merely
wrong but wrong in the specific way that would have killed the capability — the
device had never moved at all.

⚠ It was caught only because the probe asserts a *precondition* ("the device did
relocate") separately from the *question* ("did its state survive"). **A probe
that tested only its headline question would have published the false negative.**
The fix is a `moveInto` helper that re-selects the container and asserts
`hasLayers` before every move. Generalisable: **any handler reaching a
cursor-following bank has the cursor as a hidden argument**, and aiming it wrongly
produces a silent no-op rather than an error.

### What this changes, and what it deliberately does not

⚠ **E4d's residual gap STANDS** — now against a fourth verb, and E4e's
architectural reasoning (*"an InsertionPoint must bind to a referent, and 'layer
3' has no referent until it exists"*) survives its sharpest test. Layer-type
containers still cannot grow chains: 0-chain containers cannot be seeded, and an
FX Layer will not go to two.

⇒ **So multi-chain structure still comes from a `.bwpreset`** (E4d route 4,
268 ms), and the preset-library posture is unchanged.

**What IS new is the half a preset could never supply.** Before today, a chain
could only be filled with a *freshly inserted* device. Now the human's **own
device, carrying its own state**, can be moved into one (O1). That was the actual
blocker for auditioning an existing patch: you could always build a two-chain
selector from an asset, and you could never get the user's Zebra into it.

⚠ **E4d's decision-impact line needs amending.** It says *"the contract should
express 'work inside the structure you find' for layers"*. That is now too
narrow: you may **also relocate existing devices into the structure you find**,
losslessly. Creation remains preset-only.

**Still owed before the chain-selector A/B is real** (E16 §3.4e): whether
switching chains glitches, its latency, and whether it cuts sends. This row makes
that measurement worth taking; it does not pre-answer it.

---

## E16m — muting a GROUP silences its children AND cuts their sends: lineage-level A/B is real [K] (2026-07-30)

**Verdict: ● both halves, and the second one did not have to go this way.**
Muting a group takes its children's dry path *and* their sends with it, pre- and
post-fader alike — so auditioning a whole lineage against the arrangement is
correct in the wet path, not just the dry one. The ergonomic claim the
track-native model leans on hardest (E16k left it explicitly unmeasured) now
rests on a measurement. ⚠ **One new negative falls out and it is a design
input: the mute is NOT quantised to the beat, and the user wants it to be.**
Probe: `e16m-groupmute.ts`. Fixture `gn-E16` inside the human-made `Group 7`.

| row | question | result |
|---|---|---|
| M1 | does muting a GROUP silence its children? | ● **yes** — master **56 open → 2 muted**, floor 1 |
| M2 POST | does it cut the child's post-fader send? | ● **yes** — FX return **39 → 1** |
| M2 PRE | does it cut the child's pre-fader send? | ● **yes** — FX return **51 → 1** |
| ear | discriminated from placebo? | ● 5/5 real vs 0/1 placebo, **no clicks on any transition** |

### Why M2 is the half that mattered

M1 was widely expected. **M2 does not inherit E2's answer and could easily have
gone the other way.** E2 measured that a track's own mute cuts its own sends;
this is a different topology question, because a child's main output flows *into*
the group while its send is tapped on the child and routed straight to the
return. A parent's mute could sit entirely downstream of that tap.

Had it, the failure would have been the worst available shape: **the lineage
silent in the mix, the mixer showing it muted, and its reverb still feeding the
bus** — with the obvious oracle agreeing with you. It does not. Both fader modes
cut, and the pre-fader case is the load-bearing one since a pre-fader send
bypasses the fader by definition.

### The controls, and why each reading means something

Every muted reading is paired with two controls, per rows D–G trap 6 (two
silences must never make a green):

1. **The floor is a floor.** Master read 1 with the child muted by its *own*
   mute while the child's PRE-MUTE meter read **58** — so the silence is a mute,
   not a gap between notes.
2. **The clip kept playing.** Through every group-muted window the child's own
   meter read **56–58**, and through both send windows **57–58**.
3. **The send was live before it was cut.** FX read 39 (POST) and 51 (PRE) with
   the group open, so a muted reading of 1 means something was cut rather than
   that nothing was ever routed.
4. **Parentage was proved, not assumed**, by the collapse oracle — `gn-E16` left
   the bank 258 ms after `Group 7` folded and came back on expand. A flat bank
   makes a child and a sibling look identical, so adjacency would not have done.

### ⚠ Three things worth carrying beyond this row

1. ⚠ **A child's own mute flag is NOT changed by muting its parent** (measured,
   0/3 windows). Combined with trap 1 — the VU tap is pre-mute, and here the mute
   under test is on a *different track* entirely — this means **neither a child's
   meter nor its mute flag can tell you whether its lineage is audible**. Nothing
   may infer lineage state from the children. That is §4.1's mute-overloading
   problem one level up, and it is worse there, because at least a leaf's own
   flag is honest about the leaf.
2. ⚠ **The mute is not quantised.** The user, asked openly after 8 toggles:
   *"Yes, mostly. It muted and unmuted at regular intervals without any clicks or
   glitches, which is fine. It would be better if it were aligned to beat or
   measure boundaries."* This closes a question E1 left open — it recorded
   *"instant - unsure about quantized to the beat as I didn't think to listen to
   that"* — and answers it in the unwanted direction. **The gesture is usable but
   not musical**, and nothing in the current design proposes to fix it.
   ⚠ Unmeasured whether Bitwig offers quantised mute at all; the mixer's mute is
   what `branch.setMixer` drives and it lands immediately.
3. **Group-muted master read 2, against a child-muted floor of 1** — consistently,
   3/3. That is one step, at exactly the `CUT_EPSILON` boundary E2 earned by
   sweep, and it is 2 against 56 open, so it carries no musical weight. Recorded
   rather than rounded away: if a later row wants to claim group mute is
   *identical* to child mute, this is the datum that says it was one step off.

### ⚠ The weak point in this row, stated rather than buried

**The placebo arm is one trial.** The coin flip came up 5 real / 1 placebo, so
the ear half is 5/5 vs **0/1** — consistent, and far thinner than C5's 5/5 vs
0/3. On its own that is under-powered evidence. The row does not rest on it: the
master-bus separation (56 → 2, three alternated repetitions, non-overlapping
spreads) is an independent instrument and it is what carries M1. The ear's job
here was only to confirm the meter was not lying, and it did. **A future
audible row should force the arm balance rather than trusting a coin.**

### Method note — the check that would have failed on a true result

The verdict block reports M1 three ways (silences / does not reach / partially
attenuates) and asserts only that the reading is not stranded in the noise
between floor and open. An earlier draft asserted `silences || separated`, which
would have printed a red X against a perfectly clean ○ — `e16j`'s
self-validating-control mistake in a new costume, caught before the run rather
than after. Same for the ear half: it checks that **the ear agrees with the
meter**, not that the listener heard a mute, because if M1 had come back ○ the
correct thing to hear was nothing.

---

## E16l — object identity, settled properly: `channelId` is the ONLY one, and there is nowhere left for another to hide [K] (2026-07-29)

**Verdict: ○ CONFIRMED, at last with the method standing rule 10 demands.**
Across **all 1968 members** of the Controller API there is exactly one runtime
object identity — **`Channel.channelId()`**. Clips, scenes, launcher slots and
devices have none, on themselves or on any supertype. `PROJECT_PLAN.md` §7 calls
this "the oldest open question"; D16a answered it from a partial pass. This is
the complete-recall pass, and it agrees.

⚠ **One thing was missed, and it is worth having:
`ObjectProxy.createEqualsValue(ObjectProxy)`** — see below. It is not an
identifier and does not change the design, but it is a real capability nobody had
recorded.

### The method (the one E2f's miss produced)

Three passes, because the `channelId` miss came from grepping class pages for
methods already suspected to exist — high precision, low recall.

1. **Complete-recall grep of `member-search-index.js`** (1968 members, every
   class) for every identity-shaped token: `uuid`, `guid`, `id`, `identity`,
   `identifier`, `key`, `hash`, `token`, `serial`, `slug`. **13 hits.**
2. **Full member enumeration** of every class we would want identity on.
3. **Supertype walk**, because that is exactly where `channelId` hid — on
   `Channel`, not `Track`.

### Pass 1 — all 13 hits, and what each actually is

| hit | what it really is |
|---|---|
| **`Channel.channelId()`** | ⚠ **the only runtime object identity in the API** |
| `Action.getId()`, `ActionCategory.getId()` | named actions, not objects |
| `createBitwigDeviceMatcher(UUID)`, `Device.createSpecificBitwigDevice(UUID)`, `InsertionPoint.insertBitwigDevice(UUID)` | device **TYPE** UUIDs — *which model of device*, never *which instance* |
| `EnumValueDefinition.getId()`, `ExtensionDefinition.getId()` | our own extension's metadata |
| `HardwareElement.getId()`, `HardwareSurface.hardwareElementWithId(String)` | our own hardware objects, whose ids **we** assign |
| `ControllerHost.defineSysexIdentityReply(String)` | MIDI device handshake |
| `HardwareLightVisualState.hashCode()` | a value object |
| `Application.recordQuantizationGrid()` | false positive on "grid" |

### Pass 2 — there is nowhere for an id to hide

⚠ **`Scene` has EIGHT members in total**: `clipCount`, `name`, `getName`,
`selectInEditor`, `showInEditor`, and three observers. `ClipLauncherSlot` has 16,
`Clip` 61, `Device` 84. Every member of all four was read. Nothing
identity-shaped in any of them.

### Pass 3 — the supertype walk, and the base interfaces in full

| class | all superinterfaces |
|---|---|
| `Clip` | `ObjectProxy`, `Subscribable` |
| `Scene`, `ClipLauncherSlot` | `ClipLauncherSlotOrScene`, `DeleteableObject`, `DuplicableObject`, `ObjectProxy`, `Subscribable` |
| `Device` | `DeleteableObject`, `DuplicableObject`, `ObjectProxy`, `Subscribable` |
| `Channel` | as `Device`, plus `DeviceChain` |

Every base enumerated completely: `ObjectProxy` = `exists()`,
`createEqualsValue(ObjectProxy)`. `Subscribable` = 4 subscription methods.
`DeleteableObject` = 2. `DuplicableObject` = 2. `ClipLauncherSlotOrScene` = 21
(`color`, `copyFrom`, `launch*`, `moveTo`, `name`, `sceneIndex`, insertion
points, `setIndication`). **No identifier on any of them.**

⇒ **D16a's "everything else is positional and stays that way" is correct, and now
rests on a complete pass rather than a partial one.** No future API-sweep should
reopen this without new evidence.

### ⚠ The find: `ObjectProxy.createEqualsValue(ObjectProxy)` (API v3)

> *"Creates a BooleanValue that determines this proxy is considered equal to
> another proxy. For this to be the case both proxies need to be proxying the
> same target object."*

On the base of **every** proxy — `Clip`, `Scene`, `ClipLauncherSlot`, `Device`,
`Track`, all of them. Nobody had recorded it.

**What it is NOT.** Not an identifier. It cannot be serialized, stored, sent over
the wire, or compared across sessions, so it **cannot give an agent a durable
reference to hold in context**. It compares two *live proxies* only.

**What it IS.** A genuine identity *comparison*, which is a stronger guard than
what D6 uses today (verify a cursor's target by name and position). Using it means
holding a pinned cursor per object, so it is bounded by the cursor pool (D7), and
⚠ it is a `create*` — the exact shape that has thrown *"can only be called during
driver initialization"* four times (rule 13) — so it would need pre-allocating at
`init()`. **Unprobed.**

### What follows for addressing clips

The question that prompted this: *snapshot a project, the human then swaps three
clips between scenes — can we detect it and still target the intended clip?*

**No, and no API change is coming that would let us.** A scene *delete* bumps the
epoch and refuses stale addresses (E3), but `ClipLauncherSlotOrScene.moveTo(...)`
exists and a clip *move* almost certainly does not bump it, so it would pass
undetected. ⚠ Unmeasured, and worth one cheap probe.

Two mitigations, and the second is the one that matters:

1. **Content fingerprinting is an available substitute, and it is free** — the
   snapshot already holds the clip's notes, because that *is* the stash (D16e
   stores the whole clip channel). Re-read the target before writing and compare:
   if the notes disagree, something moved. Then either refuse, or search sibling
   scenes for the matching fingerprint and re-target, or recreate. ⚠ A heuristic,
   not identity — two identical clips are indistinguishable, and it only works
   *before* our own write changes the content.
2. ⚠ **Fork-first makes the residual risk survivable, and this is the real
   answer.** Under an external store a mistargeted clip write damaged the user's
   actual track. Under fork-first it damages a fresh duplicate that gets deleted.
   **The absence of clip identity stops being a correctness problem and becomes a
   "you may have to ask again" problem.** It is the strongest argument the
   track-native model has, and it fell out of a question about identifiers.

---

## E16k — a GROUP is a usable branch container: the collapse primitive works and identity survives it [K] (2026-07-27)

**Verdict: ● all four rows.** `Group` wraps a track **without minting a new
`channelId`**; a duplicate of a group child lands **inside**; **delete-all-but-one
followed by `Ungroup`** returns the survivor to top level with its identity
intact, in ~243 ms; and groups **nest**, so a branch tree can have real depth.
Together these make "the project document *is* the take log" mechanically
available. Probe: `e16k-grouptopo.ts`, all silent (structural ops, transport
stopped — the probe refuses to run while it is rolling).

Run because the user's restatement of the E16 proposal rests on one sentence —
*"collapsing to a certain take would often be as simple as delete all but one in a
group and ungroup"* — and **`Ungroup` had never been invoked**. Writing that into
a design document without probing it is exactly the doc-pass failure standing
rule 10 forbids.

| row | question | result |
|---|---|---|
| K1 | does `Group` mint a new identity for the child? | ● **no** — `channelId` survives |
| K2 | does a duplicate of a group child land INSIDE? | ● yes |
| K3 | delete-all-but-one, then `Ungroup` | ● group dissolves ~243 ms; survivor back at top level, `type` back to `Instrument`, `channelId` **intact** |
| K4 | `Group` a track already in a group | ● **nests** |

### Why K1 and K3 are the load-bearing ones

`channelId` is the only durable key we have (E2f/D6) and everything addresses
through it. An operation that silently re-minted it would orphan every reference
held across a grouping or a collapse — and the failure would look like "the branch
vanished", indistinguishable from a deletion. **Both directions preserve it**, so
a group can hold a lineage and a collapse can resolve one without any re-keying.

### ⚠ K2 constrains the construction more than it enables it

`copyTracks` **and** `moveTracks` are both silent no-ops (E16 rows A / D–G), so a
track cannot be moved into a group after the fact. With K2, the **only** known
route to a populated lineage is **group the original FIRST, then duplicate** —
copies then land inside on their own. Consequences: construction order is forced,
there is no gathering of existing tracks, no re-parenting, and no ordering within
a group (sibling order is whatever creation order produced).

### ⚠ What this does NOT measure

**Group mute.** "Mute the group to A/B a whole lineage" is the ergonomic claim the
track-native model leans on hardest, and it is unanswerable here: trap 7 says
`addVuMeterObserver` is **pre-mute**, so the only honest oracle is the master bus
with the transport **rolling** — which is noise, and the posture is to ask before
making any. Left as an owed audible row.

### ⚠ A hazard that falls out of E3, sharpened by this construction

**Deleting a group CASCADES to its children.** Under a design where the group *is*
the lineage container, the most natural tidying gesture — select the container,
delete — destroys the entire lineage including the winner, in one act. This
inverts D17f's retention protection, which refuses to prune a take that still has
children. Under a store that shape of mistake is impossible; under groups it is
one keystroke.

Analysis of what this means for the branch/take design:
`spike/E16-TRACK-NATIVE-BRANCHING.md`.

---

## E16j — ⚠ E6 IS WRONG: named actions fire BACKGROUNDED, and one of them creates a group track [K] (2026-07-26)

**Verdict: ⚠ ● the foreground gate does not exist.** Every named action tested
fires with Bitwig **behind another window** *and* **minimised to the Dock** —
including `Create Group Track`, which creates a real group track, and the
*Editing* action `Group`, which wraps the current selection into one. **Row E3's
"only a human can bring a group into existence" was true of the TYPED api only.**
E6's blocker 1 (foreground required) and blocker 2 (Editing actions additionally
need panel keyboard focus) do not reproduce. Blocker 3 (the selection hazard) and
blocker 4 (zero readback) both **stand, and blocker 3 was observed live**.
Probe: `e16j-actions.ts`. 5 runs — 4× `bg`, 1× `min` — identical every time.

⚠ **This is evidence, not a decision.** Standing rule 6 / D13 forbids named
actions and this does not repeal it; §8.5's group-topology call remains the
user's (standing rule 10). What changed is that the rule now costs something it
did not appear to cost before.

### What was run, and why it is not `e06*` re-run

A **new** probe on an independent path, per the handoff: different target action,
different oracle, and a control E6 never had. Verified **only** by `track.list`
diff and `scene.count` — never by `invoke()`'s return.

| action | category | `bg` (visible, behind) | `min` (minimised) |
|---|---|---|---|
| `Create Instrument Track` (control, **open**) | Project | ● track in ~235–243 ms | ● |
| **`Create Group Track`** | Project | ● **an empty Group track** | ● |
| `Group` | Editing | ● **wraps the selection** | ● |
| `Create Scene` — ⚠ **E6's own instrument** | Project | ● `scene.count` 99→100 | ● |
| `Create Instrument Track` (control, **close**) | Project | ● | ● |

Three design features carry the weight:

1. ⚠ **`Create Scene` is the exact action `e06-diag2` scored as a backgrounded
   silent no-op and `e06-diag3` scored as a foregrounded 9→10 bump.** Same
   action, same `scene.count` oracle, opposite result. This is not "E6 tested
   something else" — it is E6's own instrument contradicting E6's own write-up.
2. **Bracketed controls.** A Project action ran first *and* last in every run;
   both fired, so the window state held for the whole window and no trial sits in
   an unobserved gap.
3. **A same-category, same-observable positive control.** `Create Instrument
   Track` makes a *track*, read through the *same* `track.list` diff as the
   target, and has an exact typed twin (`track.create` →
   `application.createInstrumentTrack`). E6's control was a different object read
   through a different oracle, so it could not separate "the channel is dead" from
   "this action does nothing". This one can.

### ⚠ Why the discrepancy is UNEXPLAINED — and what it is not

**The version is not the explanation.** E0 (2026-07-18) recorded Bitwig **6.0.6,
`hostApiVersion` 25**; `probe:hello` reports 6.0.6 / 25 today. E6 ran 2026-07-19
on that same build. Nothing about the host moved.

**It is not per-action either.** The probe checks explicitly that E6's instrument
and the new control agree; they do, in every run. So whatever gates actions — if
anything does — is a property of *state*, not of the individual action, and E6
did not generalise from a sample of one.

Candidate explanations, **none of them established**: a Bitwig preference the
user has since changed; some session-scoped state in E6's sitting (a modal, an
un-clicked window, a wedged bridge — E16's rig notes record a jar-corruption mode
that leaves the port bound and requests unanswered); or a defect in E6's
foreground/background labelling. ⚠ **`e06-diag2` was deliberately NOT re-run
verbatim**: its first statement is a bare `invoke('Undo')` followed by two further
undos, which — now that actions fire — would push real undos into the project and
could resurrect deleted litter. Its one unique instrument is reproduced inside
`e16j` instead.

⚠ **`fg` was not run.** Foreground is the state E6 already measured as *working*,
so re-measuring it adds nothing; the open question was only ever whether the
background states differ, and two of them do not.

### What still stands from E6 — including the hazard, observed live

- **Blocker 4 ● zero readback confirmed.** `invoke()` returned
  `{"success":true,"resolved":true,"resolvedName":…}` for *every* action, whether
  or not anything happened. A resolved action that did nothing is
  indistinguishable from one that worked, from the return value alone. Only the
  `track.list` diff separates them. **For group creation this is soft** — the
  effect is observable even though the call is mute — but it is soft *only* where
  the effect happens to be visible in a diff.
- ⚠ **Blocker 3 ● the selection hazard is real and was watched happening.** The
  `Group` action wrapped **exactly `gn-J`** — the throwaway track
  `cursor.pointTrack` → `selectChannel` had selected moments earlier. That is E6's
  seven-orphan mechanism working precisely as documented; the only difference is
  that this probe aimed it at something disposable on purpose.
- **Blocker 2 ○ does not reproduce.** `Group` is an *Editing* action and it fired
  with **no** focus action invoked first. E6's diag4 needed
  `focus_or_toggle_clip_launcher` before `Duplicate` would touch a *clip* — but
  diag7 already showed `Duplicate` firing against the *track* selection without
  it. Read together, E6's own data says Editing actions dispatch against whatever
  panel holds focus rather than failing to fire, and `Group` acting on the track
  selection is consistent with that. The panel-focus retry path in `e16j` never
  triggered, because the target never missed.

### What `Create Group Track` actually gives you (and what it does not)

- It creates an **empty** group, and does **not** wrap the selection — measured
  by the collapse oracle: `wraps 0 track(s)`. `Group` is the one that wraps.
- ⚠ **An empty group may be worth very little.** `moveTracks` is a silent no-op
  (E16 row A / D–G), so there is no way to move an existing track *into* it. The
  only known route to "a track inside a group" remains duplicating a track that is
  already in one (row E3). **`Group`-the-Editing-action is therefore the
  interesting one**, because wrapping the selection is the only measured way to
  put a *chosen* track inside a *new* group — and it is also the one that fires
  against the selection our addressing sets.
- Not measured: whether a group made this way survives save/restart, what it does
  to the bank window under `ALL_CHANNELS` (**D4**, still unmeasured), or whether
  `Ungroup` reverses it cleanly.

### ⚠ Incidental: two coordinate systems for `position`, and one bad guard

Found while fixing a false alarm in the probe's own selection guard; both are
traps for anyone reading cursor state back.

1. ⚠ **`CursorTrack.position()` and the flat bank's `Track.position()` are
   different coordinate systems.** Measured: a freshly created track reported
   `position: 8` in `track.list` and `cursorTrackPosition: 7`, because the flat
   bank counts `gn-E16` — nested inside `Group 7` — as its own row and the
   cursor's ordinal does not. **They agree only for tracks that sit ahead of every
   group with children**, which is exactly how such a comparison passes testing
   and then breaks in the field. Standing rule 2 again: these are ordinals, do not
   compare them across handles.
2. **`cursor.status.trackName` is the CLIP cursor's track** (`clip.getTrack()`).
   On a track with no clips it reads `""` with `trackExists:false` **forever**, so
   it cannot confirm a selection on a freshly created track. `e16i` only worked
   because it pointed at `gn-A`, which has clips. `e16j` gives its subject a clip
   for this reason alone (never launched, so it never makes a sound).

### ⚠ Method note: an assertion that encodes the hypothesis

The first version of this probe **failed the run** when the control fired in
`bg` mode — it asserted "the control did NOT fire, therefore this really was
backgrounded", which is E6's model written as a self-validation. It fired, and
the probe reported a red X against a true result. The verdict block was rewritten
to assert only what is true whichever way the world is (bracket agreement, the two
instruments agreeing with each other, cleanup) and to **report** the direction.
Worth remembering: a self-validating control is only self-validating if the
hypothesis it encodes is the *rig's* correctness, not the *finding*.

### ⚠⚠⚠ METHOD, the costliest lesson in E17: our own READ destroyed the state under test

**`cursor.pointTrack` is not a read.** It is `CursorTrack.selectChannel()`, and
**E16j proved it sets the UI track selection** — a fact this project already knew
and had written down. Every helper that "just looked at the fixture" (`levels()`,
`chains()`, `devicesOn()`, `scope()`) called it, so nearly every named-action
measurement in E17 ran against a UI selection our own instrument had just reset to
the track. `e17ab`'s DESTROYER arm shows it directly: identical recipe, inject that
one call, ● becomes ○.

⚠ **This produced roughly a dozen false negatives and three wrong hypotheses**
(the foreground gate, the focus toggle, "the panel's current device wins"), each of
which was a plausible single story for an outcome that had a different cause.

**The rules it earns:**

1. ⚠ **Classify every helper as READ or WRITE, and write it in the name.** A
   function called `levels()` that silently re-selects a track is a trap. If a
   "read" invokes any `select*`, it is a write.
2. ⚠ **Between establishing a precondition and firing the action, call NOTHING.**
   `e17aa` worked and `e17z` did not for exactly this reason, and no amount of
   argument about focus or foreground would ever have found it — only diffing the
   two call sequences did.
3. ⚠ **A cheap dedicated readback beats a rich general one.** `layer.selectionState`
   exists because `layer.list` walks device banks and moves cursors. The narrow
   read is the safe one.
4. ⚠ **When a negative persists across many mechanisms, suspect the HARNESS before
   concluding about the API.** Twelve ○s across six probes said "chains are
   unreachable". One ● from a run that happened to skip a helper said otherwise.
   ⚠ The tell was there the whole time: `e17l` — the single positive — was also the
   single probe with no cursor call between selection and action.
5. ⚠ **A control that reproduces the FAILURE is worth as much as one that
   reproduces the success.** The DESTROYER arm is what turned "we think our reads
   were the problem" into a measurement.
6. ⚠⚠ **A probe's SETUP is part of its experiment.** `e17ac` held its variable
   fixed correctly and was still void, because the scaffolding that built its
   fixture called `device.selectInEditor` — a call already PROVEN to override the
   thing being measured. Audit the constants, not just the variable.
7. ⚠ **Measure every level, every time, forever.** Three separate probes in this
   spike read "nothing happened" while a container was being duplicated one level
   above where they were looking. The cost of an all-levels reading is a few
   hundred milliseconds; the cost of omitting it has now been three void runs.
8. ⚠⚠ **A probe can poison the NEXT probe.** `focus_or_toggle_device_panel` is a
   toggle; `e17ac` fired it repeatedly and left the device panel **CLOSED**, so
   `e17ae` — which fires no focus actions at all — inherited a shut panel and its
   control read Δ0. State leaks across runs, and "I did not call it" is no defence
   when a previous run did. ⚠ The operator caught this, not the instrument:
   *"after this and the last test, the device panel closed."*

### ⚠⚠ THREE of our own calls silently disable chain actions

Every one of them was in our tooling, not in Bitwig, and each produced ○s that were
written up as properties of the API:

| our call | what it really does | how it was caught |
|---|---|---|
| ⚠ `cursor.pointTrack` | `CursorTrack.selectChannel()` — sets the UI track selection (E16j) | `e17ab` DESTROYER arm |
| ⚠ `device.selectInEditor` | sets the device panel's current DEVICE, which beats the chain selection (`e17x`) | `e17ac`'s confound |
| ⚠ `focus_or_toggle_device_panel` | a **TOGGLE** — an odd number of fires CLOSES the panel, after which chain actions do nothing at all | ⚠ the operator's eyes |

⚠ **A FOURTH, and it is the worst because it is invisible to every probe: the
project acquired TWO tracks named `gn-lay4`.**

    [9]  gn-lay4   Instrument   9a88b37d    ← the real fixture
    [10] gn-lay4   Instrument   4fbe7653    ← an orphan fork

A named `Duplicate` fired against the **UI TRACK selection** and forked the whole
track — E6 blocker 3 / E16j's documented hazard, the same mechanism that once
created seven orphan duplicates. ⚠ **Every E17 probe resolves its subject with
`tracks.find(t => t.name === SUBJECT)`, which silently returns the FIRST match.** So
we were selecting a chain on track 9 while the UI selection sat on track 10, and
firing the action at neither usefully. That is what killed both `e17ae` runs, and
the closed-panel theory offered for the first one was wrong.

⇒ ⚠⚠ **A NAME IS NOT AN IDENTITY.** D6 says this for addressing and it was never
applied to the probes' own fixture lookup. Rules now enforced in `e17ae`:
**refuse when a name matches more than one track**, and **assert no orphan track
appeared after every action, by channelId** — because an action that forks a track
reads as "○ nothing at all" to any probe measuring only devices and chains.

⇒ ⚠ **The precondition for acting on a chain, stated positively:** exactly one track
carries the subject name; the device panel is OPEN and showing the container; the UI
track selection has not been moved since; the panel's current device has not been
set; the chain's `selectedInEditor` flag is verified at the instant of firing. Every
earlier ○ in E17 violated at least one.

⚠ **`e17ab`'s "COLD" arm was not cold, and this needs saying plainly.** It meant *no
click inside this probe* — but that session had had the operator clicking chains
repeatedly through `e17y` and `e17aa`. The project has since been saved, quit and
reopened. So **"no human is needed" is NOT established**; it was measured in a warm
session and named cold. It may still be true — the orphan track is a sufficient
explanation for the later failures on its own — but it must be re-run in a
genuinely unprimed session before it can be recorded.

⚠ **`e17z` arm A is now also suspect**: its dispatch control fired the focus toggle
before arm A ran, so arm A's *"○ nothing at all"* may have been a closed panel
rather than a result. It does not change `e17ab`'s ●, which stands on its own COLD
arm, but arm A should not be cited.

### ⚠ The constraint this sitting worked under, and what it rules out

The user's standing instruction for this session: **Bitwig being the focused app
must not be load-bearing, and no OS-level focus work — no `osascript`, no focus
detection, no bringing Bitwig up programmatically.** If foreground had turned out
to be required, the answer was to **abandon named actions, not to build a
precondition check around them.**

So the predecessor handoff's central new idea — "foreground is DETECTABLE from
the brain via `osascript`, which converts a silent no-op into a refusal" — **was
declined and never built.** Focus state was established from inside the
experiment instead, by the bracketing positive control, and the window-state
label is the human's report, recorded verbatim and ⚠ **unverifiable by the probe
on purpose**.

⚠ **Added 2026-08-01 — a second standing instruction, and `e17v` is why:**

> **User:** *"I need you to stop and confirm with me before automatically running
> anything that needs the foreground gate. Do not assume I'll see your message."*

**Never start a foreground-gated probe on your own initiative.** Arrange it with
the operator first. `e17v` is the cost of not doing so: it passed its dispatch
control at 47 s once the operator brought Bitwig forward, then lost the gate the
moment they alt-tabbed to their terminal to type a message, and **every arm after
that was void** — including the reference arm that exposed it. ⚠ **A
foreground-gated probe and a live conversation cannot share one screen**, so the
in-probe "CLICK INTO BITWIG, retrying for 90s" prompt is not a substitute for
agreeing the run in advance: the operator has to be *watching the probe*, not the
chat, for the whole run and not just its first minute.

That constraint is what makes the `min` run the decisive one. "Backgrounded" is
not one state, and `behind` is not evidence for `minimised`. Actions firing with
the window **not rendered at all** is what removes window state from the
question — had it only worked while Bitwig was on screen, the capability would
have been unusable regardless, because we had already refused to build the
detector that would make it safe.

### What this does and does not settle

- ● **Group creation is mechanically available to a background agent.** E3's ○ is
  now specifically "no *typed* api"; `createParentTrack` remains init-only
  (`e16i`), unchanged.
- ○ **It does not repeal standing rule 6 / D13.** The rule's other three legs —
  zero readback, the selection hazard, and "an inapplicable action is a silent
  no-op" — are all intact, and blocker 3 was demonstrated live in this very probe.
- ⚠ **It does raise the price of the rule**, which is the whole point of
  re-testing it: §8.5's provisional "be group-SAFE, do not build ON groups" rested
  on *"a topology gated on a human action at an arbitrary moment is a dead end"*,
  and that premise is now false.
- ⚠ **Unexplained contradictions of a prior finding are themselves a finding.**
  E6 is 4 blockers; 2 reproduce, 2 do not, on an unchanged host. Until the cause
  is known, **neither E6 nor E16j should be treated as the settled account of why
  actions fire** — only of *whether* they did, on the days they were run.

---

## E16 rows D–G — A/B by mute is audibly CORRECT, but duplication glitches and a collapsed group hides our own branches [K] (2026-07-26)

**Verdict: ● the row that mattered most goes the design's way — muting a branch
cuts its sends, pre- and post-fader alike, so A/B by mute is correct in the wet
path and not just the dry one.** Mute toggling is click-free and reads as
musically instant to the user. Two costs are now measured rather than assumed:
**every duplication audibly glitches the transport** (5/5 against 0/3 placebo),
and **collapsing a group makes its children unaddressable in a way that is
indistinguishable from deletion** — which reaches past E16 into D1's tombstone
semantics and standing rule 5. Groups are duplicable with their children and
delete as one act. Placement is confirmed *not* ours by a second route.
Probes: `e16d-sends.ts`, `e16e-mute.ts`, `e16f-groups.ts`, `e16g-glitch.ts`;
wire surface gained `Send.sendMode()`, `isGroupExpanded`, `branch.moveTrack`.

### E2 — does mute cut SENDS? ● yes, in BOTH fader modes

The highest-value open row, and it does not fire. With the sender **muted** and
its send swept across the full range:

| mode | send 0.00 | 0.50 | 1.00 | sender's own (pre-mute) meter |
|---|---|---|---|---|
| POST | FX 0 / master 0 | 0 / 0 | 0 / 0 | 56 — still playing |
| PRE | 0 / 0 | 0 / 0 | 0 / 0 | 55–57 — still playing |

Positive control, **unmuted**: PRE @0.25 → FX 19, PRE @1.00 → FX 74. The axis is
live, so the flat muted line is not a dead knob. Single-sender and
isolated-branch phases agree (FX 38→1 POST, 51→2 PRE, against a rolling floor
of 1). **A branch's reverb contribution goes away when you mute it.**

⚠ **`Send.sendMode()` had to be added to measure this at all** — `isPreFader()`
is read-only, so PRE could not otherwise be driven. `AUTO` resolves to POST for
an ordinary FX track; the probe asserts both the setting and Bitwig's resolution
of it.

⚠ **NOT measured: whether the return DOUBLES with two branches.** The same
condition read 52 and 40 in different phases — ±12 on a 0-127 peak-hold over a
3-note loop whose copies are not phase-aligned. The effect is smaller than the
variance, so the branch was isolated and the binary question asked instead.
Any "it doubled" from those numbers would be reading noise. A level claim needs
a better instrument than a peak-hold.

### E1 — A/B by mute ● usable; the latency NUMBER is below the instrument

The human's ear is the finding; the meter contributed nothing.

- **click-free ●** — *"N"* to clicks or pops across 16 toggles
- **musically instant ●** — *"instant - unsure about quantized to the beat as I
  didn't think to listen to that (and a quicker rhythm would help)"*
- **usable as the A/B gesture ●** — *"Yes, usable. Clicks, pops, glitches, and
  lag would make it distracting, but none of those happened"*
- ⚠ **latency: ◐ unresolvable.** Unmute → first signal on master, median 105ms
  (min 57), which is bounded by the VU observer's own reporting period, not by
  mute. The mute direction measured 3371ms — that is the meter's **peak-decay
  ballistic**, and the control proves it: all five control samples came back at
  exactly 3000ms, the `pollUntil` TIMEOUT, i.e. an unmuted track never touches
  the floor by itself at all. The guard fired and said "quote unmute only".

### E5 — the window, and a route with no doubling in it

| route | measured |
|---|---|
| A "mute after" | copy visible **260–314ms**, muted **47–50ms** later ⇒ **~307–386ms** of doubled mix |
| B "born muted" | source silent **321ms**; ● the copy **inherits `mute=true`** and is born silent |

⚠ **A branch is audible the instant it exists, with no clip ever launched on
it** — confirmed with a hold armed *after* the duplicate (56 on its own meter).
Row A–C's E5 stands.

**Coexistence is plainly audible; the 307ms transient is not.** The user heard
*"alternating states of single mix and doubled mix roughly equal in length
cycling about 3-4 times"* — that is the steady-state phase (master 56→68,
delta 12; independently 61→75, delta 14, non-overlapping spreads). But asked
what they heard at the branch point itself, the honest answer was *"I don't know
when the branch was created exactly."* So the hazard is **coexistence, not the
window**, and route B removes coexistence entirely at the cost of a gap.

§8 preference, recorded verbatim and **not** treated as a decision: *"probably a
gap, but that's not what I heard this time around."*

### C5 — ⚠ duplication GLITCHES the audio ● (5/5 vs 0/3 placebo)

The first attempt at this row was unanswerable and the user said so: *"Needs a
more focused test with a clear signal of when that happens."* Rebuilt as
countdown-marked trials, one question each, asked immediately — **and with
placebo trials that count down to NOW and do nothing.**

| | glitch reported | "louder/thicker" |
|---|---|---|
| duplicated (5) | **5/5** | 5/5 |
| placebo (3) | **0/3** | 0/3 |

Perfect discrimination. ⚠ The load-bearing datum is **trial 5: a clean "no"
immediately after four consecutive glitchy trials** — that is what rules out
expectation bias, and no raw count could have. One trial drew *"this one dropped
out slightly instead of just glitching"*.

⚠ **The "louder" column does NOT re-measure E5's 307ms window.** The copy stays
unmuted for the full 2.5s judgement window here, so that column re-confirms
2.5s of coexistence, which was already known. Only the glitch column is about
the duplication instant.

**C5 is therefore a real cost of a mid-session branch point**, and it lands on
top of route A's doubled window or route B's gap — the glitch happens either way.

### E3 / E4 — groups ●, with one hazard that outgrows this row

| | result |
|---|---|
| create a group, TYPED api | ○ **confirmed by live probe** — the one candidate, `createParentTrack`, THROWS "This can only be called during driver initialization" |
| create a group, NAMED ACTION | ● exists: `Create Group Track` ("Add Group Track", Project) and `Group`/`Ungroup` (Editing) — forbidden by standing rule 6 / D13, and `Group` acts on the SELECTION our own addressing sets, which is the mechanism that made 7 orphan duplicates in E6 |
| duplicate a group | ● adds `[Group 8, gn-E16]` — **children come with it** |
| is the copy's child really nested | ● proved by the collapse oracle, not by position |
| duplicate a track *inside* a group | ● the copy lands **inside** — the only route to "branch into a group" |
| delete a group | ● **cascades to its children**; revert-by-delete works on a whole group in one act |
| `isGroupExpanded` | ● drivable and reversible |
| `InsertionPoint.moveTracks` | ○ **silent no-op** |

⚠ **Row E3's group-creation ○ was first recorded from a DOC PASS, withdrawn,
and has now been re-established by live probe.** The original basis was a
member-index sweep plus a reading of `Track.createParentTrack(int,int)`'s
javadoc — "Creates an object that represent[s] the parent track" — which reads
like an accessor. Standing rule 10 forbids exactly that inference, and the same
sweep also failed to note that named actions for grouping exist.

`gregrossdev/bitwig-extensions` (`gig-maestro`) disputed it in effect: its
`track/createGroup` RPC is that call on a CursorTrack, with the design note *"the
only way to create a group is Track.createParentTrack(...), which creates a
parent group above the current track."*

**Probed live (`e16i`): the call THROWS `This can only be called during driver
initialization`, and no group appears.** Three independent legs now agree on the
accessor reading, where before there was only the javadoc:

1. the javadoc's own wording ("creates an OBJECT that represents")
2. ⚠ the runtime guard is the standard **allocation** guard — the same sentence
   rule 13 was derived from (`getDocumentState`, `host.createBitmap`, cursor
   pools, device handles)
3. document-mutating calls in this API are **not** init-guarded —
   `duplicateObject`, `deleteObject` and `insert*` all work fine at runtime

⚠ **So `gig-maestro`'s `track/createGroup` cannot work as shipped** — it calls an
init-only method from a runtime RPC handler. Its test suite passes because the
only test is `verify(mockCursorTrack).createParentTrack(4, 5)`: an assertion that
the call was ISSUED. **This is the clearest external evidence the spike has for
its own standing rules** — mock-verified capability claims survive CI and fail on
contact, which is why standing rule 1 says readback is the only truth and why
E4c's "a supertype method is a claim, not a capability" keeps being worth
re-applying. Their repository remains useful as a LEAD GENERATOR (it is what
reopened this row, correctly) and unusable as evidence.

⚠ **NOT probed: what `createParentTrack` does when called AT init.** It could
only ever be an accessor for a parent that already exists, and even if it did
create, an init-only call cannot serve on-demand branch management — so it
cannot change E16's answer and was not worth a fourth Bitwig restart.

**Consequence for §8's decision 5:** a group topology is available, but **only a
human can bring a group into existence.** We can duplicate one (with children),
duplicate into one, collapse one and delete one — we cannot create one.

⚠ **`moveTracks` is a no-op, so row A's "placement is not ours to choose" now
rests on TWO independent `InsertionPoint` routes** rather than the single
`copyTracks` mechanism it was recorded from. Duplicate-then-move does not exist.
Placement is only ever "adjacent to the source".

### ⚠ A collapsed group hides our branches — but that is OUR BANK, not Bitwig

⚠ **This was first written up as an inherent property of the flat bank and a
cross-cutting hazard. That framing was wrong and is retracted.** The behaviour
is real and reproduces; the cause is a bank we constructed with the wrong
content filter, and it is fixable at runtime.

Under the filter the legacy `createTrackBank(tracks, sends, scenes, flat)` gives
us, collapsing a group removes its children from the bank entirely:

| while collapsed | |
|---|---|
| `track.list` count / **`itemCount`** | 10 → **9** (both) |
| `track.resolveByChannelId` | **`found:false`** — identical to a deleted track |
| `branch.vu` | row absent entirely |
| master meter | **58 — still sounding** |
| on expand | fully restored, `channelId` intact |

**The fix: `TrackBank.setContentFilter(ALL_CHANNELS)`, and it works AT RUNTIME.**
With the group still collapsed, the count went 9 → 10 and the hidden child
resolved again. The enum is explicit: `ALL_CHANNELS` = "include all tracks, even
the ones that are not visible in the mixer"; `ALL_VISIBLE_CHANNELS` (what the
legacy constructor gives) skips whatever the human has folded.

⚠ **`setContentFilter` is a genuine RUNTIME setter** — a real exception to
standing rule 13, which is otherwise near-universal. Worth remembering as a
counter-example when reasoning about what must be allocated at `init()`.

What survives from the original write-up, as a caution rather than a hazard:

1. **The default is the dangerous one.** A bank built the obvious way silently
   loses folded tracks, and `found:false` then does not distinguish "deleted"
   from "folded". Anything reading a tombstone as a deletion (D1/E2f, F3) is
   wrong unless the bank is on `ALL_CHANNELS`.
2. **`itemCount()` inherits the filter.** Standing rule 5 leans on it reporting
   "the PROJECT total" (E15-A); under `ALL_VISIBLE_CHANNELS` it reports the
   visible total. The rule is implementable, but only on the right filter.
3. ⚠ **`ALL_CHANNELS` is not free and is UNMEASURED.** Folded children now
   occupy bank slots, so a grouped project consumes the 16-slot window faster —
   which is D4's question and it has not been asked with this filter on.
   Independently corroborated by the Bitwig scripting community: *"folded groups
   are hidden from trackbanks when you try to get a flat list of the channel
   list"*.

### C4 — project size ◐ (baseline only)

Saved with the fixture and **0 branches: 385,619 bytes, ~1.5s save** (user
reported, "about average"). The pre-fixture project was 340,354 bytes, so
`gn-E16` — two Zebra3s and a Polysynth — costs ~45KB. **Per-branch delta is NOT
measured**; it needs a second human `⌘S` with branches live.

### ⚠ Six method traps, every one of which produced a false result first

1. **`addVuMeterObserver` is PRE-MUTE.** A muted track reports 55–58 while
   master reads 2. The oracle the E16 plan nominated for rows E1/E2/E5 **cannot
   see mute at all**. `isActivated(false)` DOES read 0, so mute and deactivate
   sit on opposite sides of the meter tap. Every audibility verdict must read
   the FX return or the MASTER, never the sender's own strip.
2. ⚠ **`vuHold` is BANK-INDEXED and goes stale across a structural change** —
   `Rig.java` says so, and row E5's first run did it anyway. Proved
   unambiguously: FX 1 had accumulated **38**, a copy landed on FX 1's slot, and
   the copy's "peak" came back as exactly **38**. A hold is only attributable if
   it is armed AFTER the structural change. ~~*Recommended extension-side fix,
   not yet made: zero a slot's hold when the `channelId` at that index changes,
   so the value self-invalidates. Deferred because it is Java and costs a
   restart.*~~
   > ● **THE FIX IS IN, noted 2026-07-30.** `Rig.vuIdentity[]` exists and
   > `BranchHandlers.vu()` zeroes `vuHold`/`vuNow` and reports
   > `identityChanged: true` when the `channelId` at a slot changes. Recorded
   > because the "not yet made" above is now stale and would otherwise send
   > someone to re-do it. ⚠ The *trap* still stands — a hold armed before a
   > structural change is still unattributable — the value now merely
   > self-invalidates loudly instead of handing back a plausible lie.
3. **A short settle after a mute measures note TAILS.** The window straight
   after a mute read FX 16 / master 26; the next window, identical state, read
   1 / 2. Settle ~3s before arming any peak-hold.
4. **`track.delete` needs POLL-verification, not a fixed wait.** A 400ms wait
   between deletes mis-targeted the next one and removed an unrelated track as
   collateral — G2's re-indexing, live.
5. **`ask()` on a non-TTY returned `''`, and `askYesNo` read that as a confident
   NO** — a human verdict fabricated from an empty pipe. Now refuses. Ear-row
   probes must be run by the human in their own terminal.
6. ⚠ **`TrackBank.setContentFilter` is a RUNTIME setter** — a genuine exception
   to standing rule 13, which is otherwise near-universal. The default filter
   from the legacy `createTrackBank` silently drops folded tracks; use
   `ALL_CHANNELS` or `found:false` will not distinguish "deleted" from "folded".
7. ⚠ **`Track.createParentTrack` is init-only and creates NOTHING** — it throws
   "This can only be called during driver initialization" at runtime. The
   allocation guard is itself the tell: **document-mutating calls in this API are
   not init-guarded, so an init-guarded `create*` is an ACCESSOR.** That is a
   reusable heuristic for reading this API, not just a fact about one method.
8. ⚠ **A Java `.bwextension` needs a FULL BITWIG RESTART.** Toggling the
   controller off/on re-runs `init()` on classes the JVM has already loaded, so
   the new jar is deployed and ignored — `probe:hello` still passes because the
   method table is unchanged. The methodsHash drift check is what caught it.
   The handoff's deploy loop implies a toggle suffices; it does not.

### ⚠ And one trap about the QUESTIONS, not the instruments

Row C5's first attempt asked "did the audio glitch when the branch was created?"
forty seconds and two structural changes after the fact. The answer — *"I don't
know when the branch was created exactly"* — is a defect in the experiment, not
a missing observation. **A perceptual question separated from its event is a
question about a memory of the wrong thing.** Two rules came out of it and are
now built into the probes: ask immediately, and ask OPEN ("what did you hear?")
rather than leading ("did you hear it double?") — the first sitting reported
hearing no doubling while a broken check claimed otherwise, and a leading
question would have collected agreement with the bug.

### What this settles and what it does not

Rows D–G are measured. **E2's ● is the strongest single result of the sitting**:
the objection that A/B-by-mute would be audibly wrong in the wet path is
answered, and it was the objection most likely to kill the ergonomics.

⚠ It settles **nothing** in `SPIKE-E16 §8`. All nine decisions remain open and
the user's, now with three more inputs: duplication *always* glitches (C5), the
group topology carries an addressing hazard (above), and "born muted" is an
available route that trades the doubled window for a gap. Per standing rule 10,
**nothing here goes into `DECISIONS.md`.**

**Still unmeasured:** C4's per-branch delta, D3 (cursor-pool pressure), D4
(bank-window headroom), F2 beyond naming and the collapse hazard, F3 (detecting
a human's edit — now known to be harder than assumed), G3 (promoting a branch to
trunk), nested-group compounding, and row B3's owed modulator-liveness fixture.

---

## E16 rows A–C — branches as duplicated tracks: the gate is OPEN, and the mix is wrong while they coexist [K] (2026-07-26)

**Verdict: ● none of the four kill criteria fires.** A top-level track duplicates
by three independent routes; the copy carries its device chain including **opaque
CLAP *and* VST3 plugin state**, its authored-modulator pages, its clips and its
mixer strip; it costs **330–520 ms** and **≈0.6 % engine CPU** per branch on a
two-Zebra3 fixture, and deleting it is one undo step that returns the CPU.
⚠ **The one thing measured that the design must now answer: a branch is audible
the instant it exists, and three branches sounded simultaneously** — §6.2's
hazard is not hypothetical. Probes: `e16a-dup.ts`, `e16b-heavy.ts`,
`e16c-cost.ts`; wire surface `branch.*` + `device.insertVst3` + `transport.play`.

### Row A — duplication exists, by three routes of four ●

| route | API | result |
|---|---|---|
| `channelDuplicate` | `Channel.duplicate()` (v1) | ● 117–190 ms |
| `duplicateObject` | `DuplicableObject.duplicateObject()` (v19) | ● 117–123 ms |
| `hostDuplicate` | `ControllerHost.duplicateObjects(undoName, …)` (v19) | ● 122–123 ms |
| `copyTracksAfter` | `Track.afterTrackInsertionPoint().copyTracks(…)` | ○ **silent no-op** |

`Track ⊂ Channel ⊂ DuplicableObject`, so all four compile — and the fourth does
nothing, which is exactly why E4c's lesson (a supertype method is a claim, not a
capability) was worth applying here. **`copyTracks` is the only route that could
have said WHERE a copy lands**, found by walking `InsertionPoint` rather than the
duplicate-shaped names, and it is unavailable: placement is not ours to choose.

### Row A4 — identity and landing ●

- Every copy mints a **fresh UUID `channelId`**, as E2f semantics predicted.
- The copy lands **adjacent (source position + 1)**, by all three routes. ⚠ This
  is *not* E2c's finding about `createInstrumentTrack(position)` ignoring
  positions — duplication does honour adjacency; creation does not.
- Same track type; **⚠ the same NAME** — a duplicate of `gn-A` is called `gn-A`,
  not `gn-A 2`. Row F2 therefore starts from "branches are indistinguishable in
  the mixer unless we rename them", which is a naming *policy* the design owes.

### Row B — what comes across ● (with one ◐)

Fixture `gn-E16`: Zebra3 as **CLAP** (carrying a surgically-authored LFO) +
Zebra3 as **VST3** + a Polysynth carrying an authored LFO, clips in 3 scenes,
non-default mixer state. Every reading was taken through a cursor that did not
make the copy (standing rule 3a).

| row | result |
|---|---|
| B1 devices | ● identical chain, in order: `[Zebra3, Zebra3, Polysynth]` |
| B2 **opaque plugin state** | ● **2193 DirectParameters, identical count AND values** on the copy — kill criterion 2 does not fire, for CLAP and VST3 alike |
| B3 modulators | ◐ **structure yes, liveness UNPROVEN** — see below |
| B4 clips | ● all three scenes' notes byte-identical |
| B5 mixer | ● volume, pan, colour, send value and **send pre/post-fader mode** all carried |

⚠ **B3 is the honest ◐ and it is the row that matters most for Phase 5.** The
copy shows the same remote pages as the original — including the `LFO` page that
only exists because a modulator was added by file surgery — which is *exactly the
oracle E11g used* to prove modulators survive save→restart. What is NOT shown is
that the modulation is still **live**: the E7 divergence oracle (base value still
while `modulatedValue` sweeps) reported nothing **on the original either**, on
two different fixtures, with a clip launched. So the comparison has nothing to
compare and the row is inconclusive, not green. ⚠ The probe deliberately FAILS
this check rather than passing it — an early version had an `||
original-showed-none-either` escape clause that turned two silences into a green,
which is the precise failure standing rule 1 exists to prevent. **Owed: a fixture
whose modulator is known-routed to a remote-visible target.**

### Row C — cost ●, both criteria clear

| | measurement |
|---|---|
| C1 ordinary instrument track | **117–190 ms** to visible |
| C2 the heavy fixture, transport rolling | **330–472 ms** to visible, **376–520 ms** to *readable* (device chain enumerates) — kill criterion 3 wanted < 5 s |
| C3 engine CPU | baseline 2.5 % → 3.0 / 4.0 / 4.4 % at 1 / 2 / 3 branches ⇒ **≈ 0.6 pp per branch**, roughly linear |
| C3 recovery | deleting every branch returned the engine to **2.4 %** — the CPU is genuinely freed |

Method note: **there is no CPU anywhere in the controller API** (complete-recall
grep: zero hits), so this is `top -l 2` against the *separate* `BitwigAudioEngine`
process, second sample only (the first is a since-boot average), median of three,
with clips confirmed sounding via the VU oracle before each reading.

⚠ **Read C3 as a lower bound, not as the ceiling.** 2.5 % for two Zebra3
instances is low because the fixture plays three short notes on what is probably a
default patch — a real arrangement's per-branch cost will be a larger absolute
number. What the curve establishes is the *shape*: linear per branch, ~+20–25 %
of the single-track cost each, fully reclaimed on delete. **Kill criterion 4 does
not fire, and the branch ceiling is a budget question rather than a wall.**

### Rows D, E, F, G — what fell out for free

| row | result |
|---|---|
| D1 | ● the copy resolves by `channelId`, and tombstones cleanly when deleted |
| D2 | ● duplication staled nothing: every pre-existing track still resolved, and the **scene count did not move** — no scene-epoch bump. `write-set.ts`'s assertion that track create/delete "degrades nothing" holds for duplication too |
| **E5** | ● **⚠ measured, and it is the design's problem: the copy arrives UNMUTED and audible.** With three branches launched, **3 of 3 sounded simultaneously** — the mix is wrong for as long as branches coexist, and nothing pre-mutes them for us |
| F1 | ● **one undo removes a whole duplicated track**, and removed exactly the one we made |
| F2 | ◐ partial — copies share the source's name (above); the mixer-clutter question is unmeasured |
| G1 | ● delete removes the track, tombstones its identity (~145 ms) and frees its CPU |

**Not measured this sitting:** C4 (project file size / save time — there is no
save API, so it needs a human `⌘S`), C5 (control-surface stall / audio glitch
during duplication), D3 (cursor-pool pressure), D4 (bank-window headroom), E1–E4
(mute latency and click-freeness by ear, whether mute cuts SENDS, groups), F3
(detecting a human deleting a branch), G2/G3 (re-indexing; promoting a branch to
trunk).

### ⚠ Four incidental findings, all of them traps

1. **`Channel.sendBank()` THROWS if the track bank was created with 0 sends** —
   `No send bank exists: Requested a send bank size of 0`, from inside the `Rig`
   constructor, which took the whole extension down before the bridge bound. The
   rig had always passed `0` to `createTrackBank(tracks, sends, scenes, flat)`.
   **Sends are a bank-creation-time decision: you cannot look at a send you did
   not ask for at `init()`.** Now `RigConfig.sends = 4`, guarded. (Standing rules
   9 and 13; same shape as E7-Finding-0.)
2. **E4's `setImmediately`-never-`set` trap is `Parameter`-WIDE, not
   device-specific.** A plain `volume().value().set()` / `pan()` / `Send.value()`
   acknowledges and never lands — measured, all three. `color()` and `mute()`
   are not `Parameter`s and take a plain `set` fine. Standing rule 3 should read
   *any* `Parameter`, including the mixer strip.
3. **The deploy loop can wedge Bitwig.** Gradle's `copyExtension` rewrites the
   `.bwextension` **in place**; if Bitwig starts reloading mid-write it reads a
   half-written zip (`ZipException: invalid LOC header` →
   `ClassNotFoundException`), and the dead instance keeps port 8686, so the next
   one logs `failed to start bridge: Address already in use` and every later
   request connects-but-never-answers. Only a Bitwig restart cleared it. **Fixed:
   `copyExtension` now writes a temp file and atomically renames.**
4. **VST3s can be inserted by class UID** (`InsertionPoint.insertVST3Device`),
   and there is **no plugin-enumeration API** — the UID came out of Bitwig's own
   `~/Library/Caches/Bitwig/vst3-metadata-*` cache. New wire method
   `device.insertVst3`, validated to 32 hex chars before the call (rule 3c).

⚠ One unexplained observation, recorded rather than resolved: **`transport.play()`
followed by `isPlaying()` read `false` while the VU meters showed signal.** Clip
launch drove audio regardless, so no row depended on it, but anything that gates
on transport state should verify by VU rather than by `isPlaying`.

### What this does and does not settle

It clears the gate: **rows A–C were the go/no-go and none of the four kill
criteria fires.** ⚠ It settles **nothing** in `SPIKE-E16 §8` — layer-or-
replacement, per-track heads, whether "the project state at take N" survives,
the branch budget, group topology, branch lifetime, naming, D14, and where this
lands in the plan are all still open and all still the user's, exactly as §8
says. Per standing rule 10 and §9, **nothing here goes into `DECISIONS.md`
yet.**

The one new input those decisions now have: **§6.2 is real and measured.** A
branch makes sound the moment it exists, every branch sounds at once, and there
is no API-side window in which the mix is correct — so "mute the new branch
immediately" is not an implementation detail, it is a precondition, and E5's
question shifts from *is there a bad window* to *how short can we make it*.

---

## E13 — `bwmod` is BUILT: the byte recipes are a tested TS library, green offline and live [K] (2026-07-24)

**Verdict: ● the whole E10–E12 capability surface now exists as `brain/src/bwmod/`
— buffer-in/buffer-out, immutable, with `validate()` and a curated donor library.
42 unit tests pass offline (including four BYTE-IDENTICAL golden reconstructions
and a byte-for-byte cross-check against the Python reference), and all 12
integration cases pass against live Bitwig 6.0.6, each confirmed by remote-page
readback. The negative control fires: a forced duplicate `0x1a1b` is rejected
(0 devices).** This is the last spike deliverable; no new format probes were
needed — every recipe worked as documented on the first live run. Code:
`brain/src/bwmod/`, tests `brain/src/bwmod/*.test.ts`, probe
`brain/src/probes/e13-bwmod.ts`, donors `brain/assets/modulators/`, fixtures
vendored under `brain/fixtures/`.

### What was verified

| layer | result |
|---|---|
| goldens (offline) | `mp_one_lfo` from `mp_bare`, `gn_sampler_one_lfo`/`one_random` from `gn_sampler_bare`, **and `gn_sampler_multi_one_lfo` from `gn_sampler_multi_bare`** all reconstruct byte-identically modulo the embedded name + per-save `0x2ab8` GUIDs |
| oracle (offline) | add/replace/delete/retarget byte-identical to `tools/bwformat` on Polysynth, single-sample, multisample and Zebra3-CLAP — the ONLY divergence is `f6`, which the port re-points and the reference never did (E11i post-dates those scripts) |
| live (E13 probe) | add, replace, retarget, delete, cross-category replace, compose, sampled add / NEW-type add / delete, multisample add — all LOAD with the expected modulator pages; retarget and compose show live modulation on `Reso` with `Filt Freq` confirmed clean (the divergence control); `I-dup-neg` REJECTS |

### New facts, learned by building (small, all [K])

1. **A CONTAINER preset carries one `0x1a46` list PER NESTED DEVICE.** The
   4-chain Instrument Layer fixture has several. `bwmod` therefore REFUSES a
   modulator edit on such a file unless the caller names a `listIndex` —
   "edit the first list" would silently rewrite whichever nested device happened
   to serialize first. `validate()` reports this as a WARNING, not a problem:
   the file loads fine, it is just outside single-device editing.
2. **META ends with a `u32(0)` terminator, then the space padding** out to
   `f4-1`. Spec §2 described the records but not the terminator.
3. **Modulator remote pages are APPENDED AFTER the device's own pages, and a
   Note-driven modulator contributes NO page.** Polysynth owns 8 pages, Sampler
   3; `modtest`'s three modulators yield only `[Vibrato, LFO]` because
   Expressions has no page. Duplicates are disambiguated by Bitwig as
   `LFO 1`/`LFO 2` (E11f). Any readback assertion must calibrate against a
   modulator-free `bare` preset rather than assume a page count.
4. **Footprint identification must be by exact OBJECT bytes, not by GUID.** Two
   LFOs of the same type from different presets differ in params and may differ
   in footprint, so `bwmod` matches a resident modulator against the curated set
   byte-for-byte (normalizing only the id, name, and route target/amount — the
   fields its own editors rewrite, which E12e proved add no objects) and DEMANDS
   an explicit `removedFootprint` when there is no match. A guessed footprint is
   a silent whole-preset reject.
5. **The footprints are corroborated offline.** The `bare -> one_X` stub deltas
   in the fixtures are exactly the measured footprints — LFO `0x10`, Sampler
   Random `0x0d`, and `gn_sampler_lfo_random` at `0x10 + 0x0d` — so the E12a
   load-triangulation is now also a CI assertion, not just a live measurement.
   Only 3 of the 7 curated donors have measured footprints; the rest ship as
   `null` (Tier-1 usable, refused on a sampled preset) rather than guessed.

### Decision impact
- D3 is DONE — see DECISIONS D3 and BWMOD_DESIGN §8 (as-built).
- The Python `tools/bwformat/*.py` stays as the reference + CI oracle exactly as
  decision 1 intended; the product has no Python dependency.
- Carry-forward: modulator authoring is a template-time file-surgery capability
  with a single load invariant (unique `0x1a1b`), verified by readback.

---

## E12 — the sampled-Sampler "new-type wall" is DEMOLISHED; Sampler is fully general (Tier 1 + stub relocation) [K] (2026-07-24)

**Verdict: ● the E11d "sampled Sampler blocks new modulator types" wall was NEVER
REAL — it was a wrong-delta artifact (E11d only ever swept `±0x10`, but each
modulator has its OWN object footprint) compounded, on multisample, by an
incomplete stub relocation. With the correct model, EVERY op — add (same type),
add (NEW type), replace/type-swap, delete, duplicate-at-scale — LOADS and is LIVE
on a sampled Sampler, single-sample AND multisample. There is NO per-type mirrored
state in the sample; the Sampler collapses into Tier 1 given one mechanical
relocation step.** This is the fourth "wall" in the spike to fall to a clean
control (after E10e category, E11d Sampler-as-device, E11i Zebra) — the user's
distrust of the wall was correct. Tools: `tools/bwformat/build_e12{a,a2,c_golden,
d,d2,e}*.py` + `walk2.py`, probe `brain/src/probes/e11-load.ts`, on fixtures
`gn_sampler_{bare,one_lfo,one_random,lfo_random,no_sample}`, `gn_sampler2_{bare,
one_lfo}`, `gn_sampler_multi_{bare,one_lfo}` (Priority-1/2 pairs authored this session).

### The corrected model — object-index reference stubs, relocated by footprint [K]

A **sampled** preset embeds sample state containing **count-field lists** (field
ids `0x129c`, `0x1422`; value type `0x12` list). Each list holds one or more
**class-1 reference stubs** and ends with the empty class-3 sentinel:

```
field 0x129c | type 0x12 | [ 00 00 00 01  <BE-u32 payload> ]+  | 00 00 00 03 00 00 00 00
             (list)         └ class-1 stub: classId=1, then an OBJECT-INDEX u32 ┘   (sentinel)
```

- Each stub's payload is an **object index** (a linker-style pointer) to an object
  that sits AFTER the modulator list in stream order. Inserting/removing a
  modulator shifts those indices by the modulator subtree's **object footprint**,
  so every stub must be deltaed by `(inserted footprint − removed footprint)`.
- **Payload is BIG-ENDIAN** (E11d's "little-endian u32 count" read the same small
  number by single-byte coincidence; it breaks past 0xff — use BE).
- **Footprint is donor-specific** (the exact object's count, not the type):
  LFO donor = **0x10**, native Sampler Random = **0x0d**, Polysynth Random donor
  = **0x0b**. So `bwmod` must know each curated donor's footprint (measure/store
  per asset — the full recursive object walk hits the documented deep-list schema
  limit, §11 KNOWN LIMITATION, so a stored constant is the robust source).
- **Stub COUNT scales with sample complexity:** single sample = 2 stubs (one per
  count list); a multisample (≥2 zones) = more (measured: 2 in the `0x129c` region
  + 2 in the `0x1422` list = 4). The rule is **relocate EVERY class-1 stub in EVERY
  count list** — a signature-based "first stub only" relocation silently rejects
  multisample.
- **A sample-less Sampler has NO count lists** (`gn_sampler_no_sample`), so it needs
  no relocation — it is plain Tier 1 (E11d-2, unchanged).

### E12a — the wall is a wrong-delta artifact; delta = object footprint, EXACT [K]

Sweeping the stub delta for add-Random-to-one_lfo: LOADS at **+0x0b** (the Poly
Random donor's footprint) and rejects at every neighbour incl. E11d's **+0x10**.
Triangulated (each op loads at exactly ONE delta, rejects at both neighbours):

| op | rejects | **LOADS** | rejects | meaning |
|---|---|---|---|---|
| add 2nd LFO | 0x0f | **+0x10** | 0x11 | LFO footprint 0x10 |
| **add Random (NEW type)** | 0x0a | **+0x0b** | 0x0c | Random-donor footprint 0x0b |
| replace LFO→Random | −0x04 | **−0x05** | −0x06 | = −0x10 + 0x0b (net) |

All loads are LIVE (Amp EG/Attack diverges). ⇒ E11d's "new-type genuinely blocked
even with the count fix" was purely because it never tried the Random-sized delta.

### E12b — mechanism: the count fields are lists of class-1 object-reference stubs [K]

Byte-level: `0x129c`/`0x1422` are `0x12` lists; each item is `00 00 00 01`
(classId 1) + a BE-u32 payload; the list ends at the class-3 sentinel. A class-1
stub holding a u32, in a format with no other classId-1 usage, is an object
reference. Independent corroboration: a field-walk of the LFO donor reaches exactly
**16 objects** (=0x10, the LFO footprint) before the modulator's trailing scalar
fields (`0x1a1a`, then `0x1a1b` instanceId) begin. The full recursive walk still
stalls inside deeply-nested modulator param lists (the documented schema limit) —
not needed; the count-list grammar is now fully cracked. `walk2.py` is the scratch
walker; the count-list handling is the port-source for `bwmod`'s relocation step.

### E12c — no per-type mirrored state; golden reconstruction loads [K]

Device-body diff of real `one_lfo` vs `one_random` (modulator objects excised):
the **ONLY** structural difference is the two stub values (`0x29→0x26`,
`0x2a→0x27`); everything else is the meta type-GUID, the embedded name, and
per-save GUID/hash volatiles. **There is no per-type state** — refuting E11d's "the
sample keeps per-type internal state surgery cannot reconstruct." Golden test
(E10f standard): reconstructing `one_lfo` from sample-only `bare` (insert native
donor → meta ref → f4 → relocate +0x10) is **byte-identical except the embedded
name**; reconstructing `one_random` (+0x0d, a NEW type from a sample-only template)
differs only in name + per-save GUIDs. Both reconstructions **LOAD** (`[LFO]` live,
`[Random]`).

### E12d — base constant across samples; multisample general [K]

- **Base is constant:** `gn_sampler2` (a different single sample) has the same
  base `0x19/0x1a` and behaves identically (add/new-type/delete all load). ⇒
  `bwmod` needs only deltas, never an absolute base.
- **Multisample:** `gn_sampler_multi` (≥2 zones) has **4** stubs. Relocating only
  the signature-matched 3 → REJECT; relocating **all 4** (BE, every class-1 item in
  every count list) by the footprint → add-LFO, **add-Random (new type)**, delete
  all LOAD and are live. Settles DECISIONS Q1 (multisample = more stubs, same rule)
  + Q2 (base constant).

### E12e — full slot-bank surgery within a sampled ≥2-type template, at scale [K]

On `gn_sampler_lfo_random` (LFO id 0 + Random id 1), with complete relocation:
duplicate (+2 LFO +2 Random → 6 modulators), scale (+6 LFO → 8), delete the
Random, and retune (retarget the LFO route CONTENTS/AMP_ATTACK_TIME →
…/AMP_DECAY_TIME — stream-only, **NO** relocation, since no object is added/removed).
**All LOAD and are LIVE.** ⇒ the E7 Finding-H slot-bank is fully surgery-reachable
on a sampled preset — no human authoring required.

### E12f — sample-load recombination works, and Bitwig CONFIRMS our footprints [K]

Authored LFO + Random on a **sample-less** Sampler (`gn_sampler_no_sample` — count
lists empty/absent, Tier 1, no relocation) → loaded onto gn-A → **user dragged a
sample in the UI and saved** as `gn_sampler_recomb`. Parsing the saved file: both
modulators kept (meta refs `[LFO, Random]`, ids `[0,1]`, pages `LFO`+`Random`), the
sample is embedded, AND Bitwig **materialised the count stubs at exactly the predicted
values — `0x129c=0x36`, `0x1422=0x37` = base `0x19/0x1a` + LFO `0x10` + Random `0x0d`**.
Reload round-trips (loads `[LFO, Random]`, live Attack 0.379). ⇒ (a) the "author
sample-less, then add the sample in the UI" workflow yields a **consistent preset
carrying BOTH** a sample and surgical modulators; and (b) **Bitwig computes the stubs
with the same footprints we reverse-engineered** — an independent, from-Bitwig's-side
validation of the whole relocation model. Resolves DECISIONS Q4 (the last open Tier-2
question). Probe `e11g-load.ts` (interactive load-and-leave) + reload via `e11-load.ts`.

### Decision impact

- **Tier 2 is not a capability limit — it is "Tier 1 + stub relocation".** Retire
  the "new-type block" and the "sampled slot-bank must be human-authored" claims.
  Gate on "embeds a sample/bulk blob" only to decide *whether to run the relocation
  step*, not *whether an op is possible*.
- **`bwmod` Tier-2 handler:** on add/delete/replace, delta EVERY class-1 stub in
  EVERY count list (`0x129c`/`0x1422`, BE payloads, walk items to the class-3
  sentinel) by `(inserted − removed) footprint`. Footprint is per-donor — store it
  with each curated donor asset. Retarget/setAmount need no relocation.
- **E12f RESOLVED (below):** sample-load recombination works and Bitwig materialises
  the stubs at our exact predicted footprints. The only residual is footprints for
  other embedded-bulk devices (convolution IR, wavetable/Grid) — untested but now
  lower-risk (the heuristic is "relocate reference stubs", not "give up").

---

## E11g — surgically-authored modulators SURVIVE project save + Bitwig restart [K] (2026-07-24)

**Verdict: ● a modulator added by pure file surgery persists through a full project
save → Bitwig quit → relaunch → reopen. It is not a load-time-only illusion: Bitwig
accepts the surgical device as first-class, RE-SERIALISES it into the project on save
(in its own canonical form), and re-parses it cleanly on a cold restart. This retires
E4h's standing "everything is verified in-session only" caveat for modulator
authoring.** Probes `e11g-load.ts` / `e11g-verify.ts`, driven interactively.

- **Method:** built `mp_one_lfo` + a surgically-added **Random** (sentinel-correct
  recipe) → `insertFile` onto gn-A → confirmed modulator pages `[…, LFO, Random]` →
  user saved the project, fully quit Bitwig, relaunched, reopened → reconnected the
  bridge and read gn-A back.
- **Result:** gn-A returned exactly one `Polysynth` whose remote pages still include
  **both `LFO` and `Random`**. A fresh Polysynth has zero modulator pages, so the
  surviving `[LFO, Random]` set can only be the persisted surgical topology — no
  ambiguity. The round-trip through Bitwig's *own* serializer (save re-writes the
  device) is a stronger guarantee than a mere in-session load.
- **Decision impact:** durability is settled — `bwmod`-authored presets are real,
  saveable, portable project content, not transient. Combined with E4h (templates
  ship as build-time assets, deletable after load), modulator authoring is fully
  first-class end-to-end. No caveat outstanding.

---

## E11e — cross-device routing works from CONTAINER modulators, and is SYNTHESISABLE + live [K] (2026-07-24)

**Verdict: ● a modulator on a CONTAINER device (Chain/layer) can target a param in a
DIFFERENT device nested inside it, via a structured `0x0e3d` path — and that route is
SYNTHESISABLE by the ordinary retarget (rewrite `0x0e3d`), producing LIVE modulation on
the chosen nested device+param. Simple (non-container) devices cannot cross-route at
all (user-confirmed — a modulator only reaches its own device).** Probe `e11e-live.ts`
+ retarget builder, on user-authored `gn_crossdev_outer` (Chain ⊃ Polysynth→Delay+, an
outer LFO routed to the inner Delay+ Mix).

### The cross-device path form [K]
```
CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/1:CONTENTS/MIX
└container contents┘└─ nested device chain ─┘└idx┘└ nested device param ┘
```
`CONTENTS/DEVICE_CHAIN/<ContainerName>/DEVICE_CHAIN/<deviceIndex>:CONTENTS/<PARAM>` —
`<deviceIndex>` selects the device within the container's chain (`0`=Polysynth,
`1`=Delay+), then `CONTENTS/<PARAM>` is the same per-device path form as a top-level
route (native `CONTENTS/<NAME>`; a nested CLAP/VST would use its `ROOT_GENERIC_MODULE/
PID<hex>` tail). Compare single-device forms: native `CONTENTS/F1FREQ`, CLAP
`CONTENTS/ROOT_GENERIC_MODULE/PID<hex>` (E4b/E11d).

### Synthesis is live, not just loadable [K]
Retargeting the outer LFO to three targets — all LOAD; liveness read by descending the
device cursor into the container's `CHAIN` slot (`devcursor.selectFirstInSlot{slot:"CHAIN"}`)
and scanning the nested device's remote pages for `modulatedValue ≠ value`:

| synthesized route | loads | live on nested device |
|---|---|---|
| `…/1:CONTENTS/MIX` (control, Delay+) | ● | (target is 2nd device; not scanned) |
| `…/1:CONTENTS/BLUR` (Delay+, other param) | ● | — |
| **`…/0:CONTENTS/F1FREQ`** (the OTHER nested device, Polysynth) | ● | ● **`FILTER/Filt Freq` diverges 0.002** |

Rewriting the path to point at a *different nested device and param* (Polysynth
`F1FREQ`) yields real modulation there — a wrong path would read exactly `0.000`
(silent no-op, E10b). So the container-modulator target set is **arbitrary within the
container** (any nested device by index, any of its params), reachable by the standard
`0x0e3d` retarget — not a curated set.

### Decision impact
- **Cross-device modulation is authored the same way as any route** — `bwmod.retarget`
  handles it with no new primitive; only the path *form* is richer
  (`DEVICE_CHAIN/<name>/DEVICE_CHAIN/<idx>:CONTENTS/<param>`). Same readback caveat
  (a bad path is a silent no-op — verify live).
- **The modulator must live on a container** (Chain/Instrument-Layer/FX-Layer); a
  simple device's modulator is confined to that device. So a patch that wants
  cross-device modulation must wrap the targets in a container (the E4d/E10d container
  work already gives us those).
- Confirms the E7-era "target set is arbitrary vs curated" question → **arbitrary**
  (for container modulators, within the container).
- Gotcha: nested-device modulation is invisible to a container-scoped `remote.list`;
  readback must descend into the nested device (`selectFirstInSlot`) — the container's
  own pages only show its modulator, not the target.

---

## E11h — the modulator list is SENTINEL-terminated; this was the real gap (and killed the "Zebra wall") [K] (2026-07-24)

**Verdict: ● the `0x1a46` modulator list ends with an empty `cls 0x0003` SENTINEL
object — the 8 bytes `00 00 00 03 00 00 00 00` — NOT a bare `classId 0`. This one
fact (a) explains the phantom "unmapped stream types `0x02/0x06/0x1a`" (they were
parser DESYNC artifacts, not real types), (b) completes the parser's top-level list
handling, and (c) exposed a 2-byte object-bounds bug that had manufactured the
entire E11i "Zebra wall" (see the corrected E11i below).** Tools: `bwparse.py`
(now sentinel-aware), `walk.py` (scratch field-walker), on `mp_bare`/`mp_one_lfo`/
`modtest` (0/1/3 modulators) + the Zebra fixtures.

### The list grammar, corrected

```
list (type 0x12) := object*  +  00 00 00 03 00 00 00 00    (empty cls-0x0003 sentinel)
  0 modulators:  <sentinel only>
  1 modulator :  [0x06c9 object] <sentinel>
  3 modulators:  [obj][obj][obj] <sentinel>
```

Measured directly: `mp_bare`'s `0x1a46` content is exactly the 8 sentinel bytes;
`mp_one_lfo` is `[06c9 modulator]` + sentinel; `modtest` is three `06c9` objects +
sentinel. The old grammar in the spec (`list := object* u32(0)`) was WRONG — there
is no bare `classId 0` terminator; the parser read the sentinel's `0x0003` classId
as a real list item and ran off the rails, which surfaced as the bogus
"unknown type 0x1a/0x02/0x06" stalls. `bwparse.py` now stops a list on the sentinel
(fallback to `classId 0`) and walks the whole top-level modulator list.

### The bug it exposed — object bounds must END at the sentinel

`build_e11i/e11d`'s extractor took the object's end from difflib's `insert`
boundary. That boundary can land **2 bytes INTO the sentinel** (the object's
trailing `00`s alias the sentinel's leading `00`s), leaving a corrupted
`00 03 00 00 00 00 00 00` → Bitwig rejects the whole preset. Fix: snap the object
end to the `00 00 00 03 00 00 00 00` sentinel (`build_e11i_cases.py`,
`build_e11d_recheck.py`). ⚠ The bug is **alignment-dependent** — it only triggered
for Zebra's boundary bytes; Delay+/Repro/sample-less-Sampler aligned exactly (0
offset) and loaded even with the buggy extractor. That is exactly what made it a
dangerous latent trap: works on most hosts, silently corrupts a few.

### Decision impact
- **`bwmod` MUST snap modulator-object bounds to the sentinel** and insert new
  objects BEFORE it — never trust a diff/insert boundary. This is a hard correctness
  rule (a golden test should assert the sentinel is intact after every edit).
- BWFORMAT_SPEC §3 list grammar updated: sentinel terminator, not `classId 0`.
- Full RECURSIVE parsing (nested lists inside a modulator's CONTENTS) still stalls
  deeper (a `type 0x00` desync) — genuinely schema-limited (the documented KNOWN
  LIMITATION) and NOT needed: `bwmod` uses targeted/diff bounds, now sentinel-aware.
- Gotcha for §11: the "unmapped types 0x02/0x06/0x1a" are retired — they never
  existed as value types; they were sentinel-desync noise.
- **Sheds light on E10d (layer chains):** `CHAIN_LIST` is a `0x12` list (field
  `0x08e0`) and a cls-0x0003 sentinel sits after the last chain — so E10d's "the last
  chain has no exact end" limitation is very likely LIFTABLE via a sentinel-aware
  parse (would make last-chain deletion precise, not just "drop earlier chains").
  Not fully confirmed (chains nest — 14× `0x018f` for a 4-chain template), but a solid
  lead when chain-surgery is needed. Scope-checked the rest: E10f's byte-identical
  golden proves Polysynth extraction was 0-offset, so E10f/E11a/b/c/f are unaffected;
  the only bug-exposed rejects were Sampler (real) + Zebra (phantom), both re-checked.

---

## E11i — CORRECTED: the "Zebra wall" was a phantom; Zebra 3 is FULLY surgery-general (CLAP + VST3) [K] (2026-07-24)

> **⚠ This OVERTURNS the original E11i (2026-07-23), which claimed Zebra rejects all
> modulator-set surgery via an "opaque topology mirror" and invented a "tier-3".
> That was entirely a 2-byte list-SENTINEL corruption bug in the test extractor
> (E11h). There is NO tier-3, NO opaque-topology hazard, and CLAP-vs-VST3 is not an
> axis. The wrong entry is deleted; this is the record.**

**Verdict: ● with sentinel-correct object bounds, EVERY modulator-set op — add
(same type), add (NEW type), replace/type-swap, delete — LOADS on Zebra 3 in BOTH
CLAP and VST3, exactly like native/Repro-5. A plugin's opaque embedded state
(Zebra ships a DEFLATE ZIP `plugin-states/<GUID>.clap-preset`) is NOT a modulator-
surgery hazard.** Probe `e11-load` + `tools/bwformat/build_e11i_cases.py` (sentinel
fix), on `gn_zebra3{clap,vst}_{bare,one_lfo}`.

| op | Zebra3 CLAP | Zebra3 VST3 |
|---|---|---|
| add 2nd LFO (same type) | ● `[LFO 1, LFO 2]` | ● `[LFO 1, LFO 2]` |
| **add Random (NEW type)** | ● `[LFO, Random]` | ● `[LFO, Random]` |
| replace LFO→Random | ● `[Random]` | ● `[Random]` |
| delete | ● empty | ● empty |

### What was really going on (post-mortem of five wrong readings)
The original entry chased the reject through five confident-wrong theories, each
killed by a control — the spike's recurring lesson, this time on the tester:
1. "opaque ZIP mirrors the modulator" → **refuted**: swapping bare's 0-mod plugin
   state under a 1-mod object stream (GUID-relinked) LOADS. The ZIP payload delta
   bare↔one_lfo is just a per-save GUID + timestamp nonce; it does not gate anything.
   (`f6` merely points at the ZIP; it slides when the object is inserted ahead of it.)
2. "`0x07b1` companion object is the gate" → **refuted**: every host has one
   (`"Filter"`/`"Tone"`/`"LFO"`); removing it from a loading preset still loads.
3. "`0x131a` registration record is the gate" → **refuted**: removing it changed
   nothing.
4. "the `0/1` flag / a counter byte" → **refuted**: reverting both, still rejected.
5. The real cause: the object-bounds extractor was 2 bytes long, corrupting the
   list sentinel (E11h). Fixing the bound → everything loads.

### Decision impact
- **Zebra 3 (CLAP + VST3) is Tier 1 (fully general).** VST/CLAP opaque state does
  not mirror modulator topology. The "embedded-bulk-content hazard" is NOT a plugin
  property.
- **Retarget** (rewrite `0x0e3d`, any length) is confirmed load-safe here too — a
  universal floor, but no longer the *ceiling* on Zebra.
- The tier map collapses to TWO tiers (see the E11d re-check). Delete the invented
  tier-3 everywhere it was written.

---

## E11d RE-CHECK — the sampled-Sampler wall is REAL (not the sentinel bug); two-tier map confirmed [K] (2026-07-24)

**Verdict: ● re-running the sampled-Sampler matrix with sentinel-correct bounds
CONFIRMS E11d-2: same-type add/delete work with the ±0x10 count-u32 fix, and
NEW-TYPE introduction is genuinely BLOCKED — it still rejects even with correct
bounds AND the count fix. Unlike Zebra, this wall is not a test artifact; the
embedded sample really mirrors PER-TYPE modulator state that surgery cannot
synthesise.** Probe `e11-load` + `tools/bwformat/build_e11d_recheck.py`, on the
sampled `gn_sampler_{bare,one_lfo}`.

| op | no count-fix | + count-u32 fix (±0x10) |
|---|---|---|
| add 2nd LFO (same type) | ○ REJECT | ● **LOAD** `[…, LFO 1, LFO 2]` |
| add Random (NEW type) | ○ REJECT | ○ **REJECT** |
| replace LFO→Random | ○ REJECT | ○ REJECT (count unchanged) |
| delete | ○ REJECT | ● **LOAD** |

- The two count-mirror u32s are **little-endian**, value `= base + 0x10·count`
  (`0x129c` base `0x19`, `0x1422` base `0x1a`), located by sigs
  `00 00 12 9c 12 00 00 00 01 00 00 00` / `00 00 14 22 12 …`. add/delete delta both
  by ±`0x10` per modulator (confirms E11c's u32 read; carries past one byte at count 15).
- `0x129c` is **absent on a sample-less Sampler** (`gn_sampler_no_sample`) — the
  count fields are the sample's, so gate on "embeds a sample/bulk blob", not device.

### Decision impact — the FINAL two-tier map
- **Tier 1 — fully general** (plain recipe, all ops incl. NEW type): native
  (Polysynth, Delay+), CLAP (Repro-5), **Zebra 3 (CLAP + VST3)**, sample-less Sampler.
- **Tier 2 — count-mirrored** (same-type add/delete need ±0x10 on both count-u32s;
  NEW-type / type-swap ○): a preset that **embeds a sample/bulk blob** — verified on
  Sampler. Gate on embedded bulk content, NOT device class.
- ~~Tier 3~~ — deleted (Zebra phantom). Plugin opaque state is Tier 1.
- For a Tier-2 slot-bank the modulator *type set* is fixed at author time (the E7
  Finding-H slot-bank shape) — but same-type duplication + retune + delete are
  surgery-reachable within it.

---

## E11d-2 — the Sampler "wall" was the loaded SAMPLE, not the device [K] (2026-07-23)

**Verdict: ● a SAMPLE-LESS Sampler is fully modulator-surgery-general — the plain
3-step recipe adds/replaces/deletes AND introduces NEW types AND holds multiple
types, exactly like Delay+/Repro/Polysynth. The entire E11d Sampler exception was
caused by the embedded sample, whose state mirrors the modulator count and blocks
type introduction. This CORRECTS E11d.** The user caught the confound: the E11d
Sampler fixtures had `7 Reso Chime.aiff` loaded; they authored `gn_sampler_no_sample`
(truly bare) which settled it.

### The evidence

The two count-u32 fields (`0x129c`/`0x1422`) are **absent from a sample-less Sampler**
and are **introduced by loading a sample** — a `no_sample→bare` diff shows the sample
adds its ~731 B data structure *plus* the 8-byte block `01 00 00 00 1a 00 00 00 03 00
00 00 00` (the `0x1422` count field). And `bare` (sample, **0** modulators) already
carries `0x19`/`0x1a` there — so those fields belong to the sample's state and merely
*track* modulator count (`base + 0x10·count`).

On `gn_sampler_no_sample` (no count fields exist), the plain recipe loads everything:

| build (plain 3-step recipe) | result |
|---|---|
| + LFO | ● LOAD |
| + **Random (a NEW type)** | ● **LOAD** — the exact op E11d found impossible on the sampled Sampler |
| + LFO + Random (two distinct types) | ● LOAD |

### Corrected model of the Sampler

- **Sample-less Sampler:** general. Plain recipe, any op, any type, multi-type. No
  count field to maintain. Same as every other host tested.
- **Sampled Sampler:** the embedded sample carries modulator-mirroring state, so
  (a) same-type add/delete needs the two count-u32s deltaed by `±0x10` (E11d/E11c),
  and (b) introducing a NEW type is rejected even with the count fix (the sample's
  state has no entry for the new type; surgery can't synthesise it).

### Decision impact (supersedes E11d's)

- **The Sampler is NOT a host-class exception.** `bwmod`'s plain recipe covers
  Polysynth, native FX, CLAP, **and sample-less Sampler**. The host-gating in
  BWMOD_DESIGN should key on **"does this device embed a sample"**, not on device name.
- **Slot-bank on Sampler is fully achievable by surgery — author it sample-less.** The
  agent can add one modulator of every type to a bare Sampler (ns_add_random_newtype +
  ns_two_types prove new-type + multi-type; E11c's 32-scale extends it). The earlier
  "must be human-authored" conclusion for Sampler is **retracted** for the sample-less
  path.
- **Only when a preset must carry BOTH a sample and surgically-authored modulators**
  do the sampled-Sampler constraints apply: maintain the count-u32s for same-type
  add/delete; new-type introduction on an already-sampled preset is ○. Open question
  [U]: whether authoring modulators sample-less and loading the sample afterward
  recombines cleanly (the sample-load would need to regenerate its mirrored count) —
  untested; likely a runtime/UI path, not file surgery.
- **Residual it opened [RESOLVED by E11i-corrected, 2026-07-24]:** the worry that a
  plugin's opaque state chunk (VST3/CLAP) might mirror modulator state *like the sample*
  is **disproven** — Zebra 3 (VST3 **and** CLAP) is fully surgery-general; its DEFLATE-ZIP
  plugin state does not gate the modulator set. The hazard is specifically an **embedded
  sample/bulk blob**, not plugin opaqueness. Convolution IR / wavetable / nested
  containers remain untested but are lower-suspicion now (the "opaque = hazard" heuristic
  was wrong). The original E11i "opaque topology mirror" reading was a test bug (E11h).
- Credit: the user's `gn_sampler_no_sample` minimal pair is what isolated sample-vs-device.

---

## E11c — surgery scales to 32 modulators on both hosts; Sampler count is a real u32 [K] (2026-07-22)

**Verdict: ● 32 modulators load — on Polysynth (32, five mixed types) and on Sampler
(32 LFO duplicates). No count/limit surprise. The Sampler count field is a genuine
u32 (`base + 0x10·count`) that carries cleanly past the single-byte boundary. A
Sampler's CAPACITY is therefore not the slot-bank blocker — the type-introduction wall
(E11d) is, and scale does not move it.** Probe `e11-load` +
`tools/bwformat/build_e11bc_cases.py`.

| host | build | result |
|---|---|---|
| Polysynth | 8 / 16 / 32 modulators cycling 5 distinct types (LFO, Random, Classic LFO, Vibrato, Expressions) | ● all LOAD |
| Sampler | 8 / 16 / 32 LFO duplicates, count-u32 = `0x99` / `0x119` / `0x219` | ● all LOAD (`LFO 1…LFO 32`) |

- **The Sampler count is a u32, not a byte.** `base + 0x10·count` overflows one byte at
  count 15, but N=16 (`0x00000119`) and N=32 (`0x00000219`) both load — so it carries
  correctly and scales to any realistic slot-bank size. `bwmod`'s Sampler handler
  should read/write it as a u32 (both fields), delta `±0x10` per add/remove. (This
  Sampler scale used the *sampled* fixture — the count u32s exist only because a sample
  is loaded; a sample-less Sampler has no such field and needs no fix. See E11d-2.)
- **This confirms capacity + count-scaling, NOT type introduction.** The Sampler test
  duplicates ONE type (LFO); surgery still cannot add a NEW type to a Sampler (E11d).
  ⇒ on permissive hosts (Polysynth/Delay+/Repro) the agent can build a full multi-type
  slot-bank by surgery outright; on Sampler-class hosts the slot-bank must be
  human-authored once, but this proves such a template is valid at scale and the agent
  can duplicate/delete/retune within it.
- ⚠ **Note-driven types (Expressions) expose no remote page** (seen in E11a too), so
  page-count readback UNDERCOUNTS modulators — the meta-ref / `0x06c9`-object count is
  the true count. Assert on that, not on page names.

---

## E11b — the `0x02b9` name is cosmetic, not validated against the `0x1a1b` id [K] (2026-07-22)

**Verdict: ● a modulator's `0x02b9` display-index name need not match its `0x1a1b`
instance id — both `name="5"/id=1` and `id=5/name="1"` load (ids kept unique). Only
`0x1a1b` uniqueness gates load; the name string is not cross-checked against it.**
Probe `e11-load` + `build_e11bc_cases.py`, one-field edits on modtest.

Resolves the BWMOD_DESIGN §5-U2 open question: `bwmod` may treat `0x02b9` as cosmetic.
Keeping `name == id` remains the tidy default (matches what Bitwig writes), but it is
not a correctness requirement — freeing add/delete from any name-renumbering duty.

---

## E11d — modulator surgery is GENERAL across FX + CLAP, but Sampler REJECTS it [K] (2026-07-22)

> **⚠ PARTIALLY CORRECTED BY E11d-2 (2026-07-23).** The "Sampler is a special case"
> reading below is right about the *sampled* Sampler but wrong to attribute it to the
> device: the E11d Sampler fixtures had a sample loaded, and the sample — not the
> Sampler — is what mirrors modulator count and blocks type introduction. A
> **sample-less** Sampler is fully surgery-general. Read E11d-2 for the corrected
> model. The Delay+/Repro/CLAP results and the count-u32 mechanics below stand.

**Verdict: ● the add/replace/delete recipe generalizes beyond Polysynth to a native
FX (Delay+) and a CLAP plugin (Repro-5) — loads AND lives. Sampler is a special case,
now fully diagnosed: it mirrors modulator state in its own device body, so (a)
add/delete of an ALREADY-PRESENT type works once two count-bytes are maintained, but
(b) introducing a NEW modulator type or type-swapping is rejected — the Sampler keeps
per-type internal state surgery cannot reconstruct.** Probes `e11-load` +
`tools/bwformat/build_e11d_cases.py` (+ follow-up isolation builds), on user-authored
bare/one_lfo minimal pairs for Sampler, Delay+, Repro-5.

### What generalizes (all three hosts, structural — [K])

All three are encoding `0002` (plain/parseable), including the CLAP. The modulator
sub-structure is identical in kind: `0x075f` MODULATORS wrapper, `0x1a46` list,
`0x06c9` object, `0x1a1b` unique id, `0x18c6` type guid (`ad947004` — the LFO type
guid is **host-agnostic**, same bytes everywhere), meta `referenced_modulator_ids`,
`f4`. The routing-target **path form differs exactly where E4b predicted**:

| host | kind | route path form |
|---|---|---|
| Sampler | native instrument | `CONTENTS/AMP_ATTACK_TIME` |
| Delay+ | native FX | `CONTENTS/BLUR` |
| Repro-5 | CLAP plugin | `CONTENTS/ROOT_GENERIC_MODULE/PID3c` (plugin-param id) |

### The load matrix

| case | Sampler | Delay+ | Repro-5 |
|---|---|---|---|
| base (one_lfo) | ● LOAD (live: AmpEG/Attack div 0.38) | ● LOAD (Blur 0.35) | ● LOAD (Cutoff 0.34) |
| add 2nd LFO | ○ **REJECT** | ● LOAD, `[LFO 1, LFO 2]`, Blur div→**0.75** | ● LOAD, `[LFO 1, LFO 2]`, Cutoff→**0.50** |
| replace w/ Random | ○ **REJECT** | ● LOAD, `[Random]` | ● LOAD, `[Random]` |
| delete the modulator | ○ **REJECT** | ● LOAD, LFO page gone | — |

Delay+/Repro: full generality — add stacks a live second route (divergence rises),
replace type-swaps, delete removes. **A CLAP plugin modulator route is authorable by
file surgery**, deeper path form and all.

### Ruling out a construction artifact (the isolation that reopened it)

The standing rule (a FAIL is often a wrong expectation) got a full workout:
- **Object bounds are correct.** The extracted LFO object is 826/837/847 B for
  delay/sampler/repro — differing *exactly* by the routing-string length delta
  (`BLUR` 13, `AMP_ATTACK_TIME` 24 = +11, `…/PID3c` 34 = +21).
- **Meta + f4 machinery is identical** to what loads on Delay+/Repro.
- **Not add-specific: DELETE also rejects on Sampler** while the identical delete
  LOADS on Delay+ — so it is not insertion placement; *any* modulator-list edit
  rejected. This is what pointed at Sampler-internal mirrored state.

### The mechanism, fully diagnosed [K]

A byte-diff of Sampler bare↔one_lfo is otherwise **clean** (3335/3341 stream bytes
equal) — the misleadingly-tiny 8-byte common *suffix* was just two late 1-byte diffs.
Beyond the modulator object + preset-name meta, **exactly two single bytes** in the
Sampler device body change when a modulator is added — and **Delay+ has none**. Both
sit immediately after an identical `[field][0x12 list][classId 1]` structure (fields
`0x129c` and `0x1422`), and both move by **exactly +0x10** per modulator:
`0x19→0x29→0x39` and `0x1a→0x2a→0x3a` for count `0→1→2`. **They encode the modulator
count** (byte = base + 0x10·count).

Confirmed by controlled patch pairs (each differs ONLY in those two bytes):

| built case | flags | result |
|---|---|---|
| delete, flags left at 1-count | 0x29/0x2a | ○ REJECT |
| **delete + flags→0-count** | 0x19/0x1a | ● LOAD (0 modulators) |
| add 2nd LFO, flags left at 1-count | 0x29/0x2a | ○ REJECT |
| **add 2nd LFO + flags→2-count** | 0x39/0x3a | ● LOAD `[LFO 1, LFO 2]` |

So add/delete on Sampler need one extra step: **±0x10 on both count bytes.** The
robust form is a *delta* (no need to know the base), located by the two signatures
`00 00 12 9c 12 00 00 00 01 00 00 00 <byte>` and `00 00 14 22 12 …`.

**But type introduction is a harder wall [K].** Further isolation:
- replace LFO→LFO identical → LOAD; replace with the route **shortened** (object
  shrinks 14 B, size change) → LOAD ⇒ size is not mirrored.
- replace LFO→**Random** (type/guid swap) → REJECT at **every** flag value (0/1/2).
- ADD a **Random** (a type NOT already present) with flags→2 → **REJECT**.

⇒ Adding/removing instances of a type **already present** works; **introducing a new
modulator type, or type-swapping, does not** — the Sampler holds per-type internal
state (registration/routing keyed by modulator type) that file surgery cannot
synthesise. The count bytes are necessary but not sufficient for a new type.

### Decision impact

- **`bwmod` add/replace/delete is verified general on Polysynth + native FX (Delay+)
  + CLAP (Repro-5)** — instrument, effect, and external-plugin axes. NOT
  Polysynth-specific. CLAP/VST routing uses the deeper `CONTENTS/ROOT_GENERIC_MODULE/
  PID<hex>` form, editable like any route — lifting most of E4b's worry.
- **Sampler needs a device-specific handler** in `bwmod`: on add/delete, delta the
  two count bytes by ±0x10 (find them by signature). Load+readback stays mandatory.
- **On Sampler, type set is fixed at template time.** The agent can duplicate,
  delete, and retune modulators of types the template already contains, but cannot
  introduce a new type by surgery. This is exactly the shape of the retired E7
  Finding H **slot-bank** — so for Sampler-class devices the slot-bank (a template
  pre-seeded with one dormant modulator per desired type) is the *right* pattern,
  even though it is retired for Polysynth/FX/CLAP. Other sample/state-heavy natives
  may share this; untested.
- Only two count bytes were seen on this (sample-less) Sampler; a Sampler with loaded
  samples/zones may mirror more state — untested, flag it if pursued.

---

## E11a — `0x1a1b` uniqueness is sufficient; ids need NOT be contiguous [K] (2026-07-22)

**Verdict: ● a unique `0x1a1b` set loads even when sparse or permuted — contiguity
is NOT a load requirement.** So `bwmod` may reuse a freed instance id and `delete`
need not renumber siblings; `next-free = max+1` stays a safe default but is
over-strict, not mandatory. Probe `e11-load` + `tools/bwformat/build_e11a_cases.py`,
one-byte edits on `modtest` (loads at `[0,1,2]`).

Each case edits all three modulators' `0x1a1b` u8 **and** their `0x02b9` name digit
together (kept equal, so this does NOT also test the E11b name/id question):

| case | id/name set | property | result |
|---|---|---|---|
| C0 | `[0,1,2]` | contiguous (control) | ● LOAD |
| A_sparse | `[0,1,5]` | unique, gap at 2..4 | ● LOAD |
| A_high | `[9,4,7]` | unique, none zero, sparse | ● LOAD |
| A_perm | `[2,0,1]` | `{0,1,2}` permuted across slots | ● LOAD |

All four load identically (pages `[…, Vibrato, LFO]` unchanged). The gate proven in
E10f is exactly and only **uniqueness** — not range, not zero-basing, not order.

### Decision impact
- **`bwmod.deleteModulator` need not renumber** the surviving modulators; removing an
  object + its meta ref is enough (ids stay unique, just sparse).
- **`nextFreeInstanceId` = max+1** remains the simple, safe assignment (guaranteed
  unused), now known to be a *convenience*, not a correctness requirement — any
  value absent from the current set is equally valid.
- Removes E10f's "must ids be contiguous?" caveat.

---

## E11f — same-TYPE repeated ADD loads; `addModulator` needs no id-freshening [K] (2026-07-22)

**Verdict: ● two modulators of the SAME type (same donor object) coexist in one
preset and load. A duplicate `0x18c6` device GUID and the duplicate
`referenced_modulator_ids` entry it forces are BOTH accepted by Bitwig.** So the
library's `addModulator` needs **no "freshen embedded ids" step** beyond the
already-proven unique-`0x1a1b` assignment. Probe `e11f-dupdonor` +
`tools/bwformat/build_e11f_cases.py`, on `mp_one_lfo` + repeated Random/LFO donors.

### The handoff's premise was wrong — measurement corrected it first

E11 §1f hypothesised that adding two modulators from the same donor would collide
their per-instance `0x2ab8` "Chain" GUID. **A modulator object embeds no `0x2ab8`
at all** — measured directly: the LFO donor (646B) and Random donor (551B) each
contain exactly one `0x009a`, one `0x18c6`, one `0x1a1b`, and **zero** `0x2ab8`.
The `0x2ab8` count is a fixed **2 per file** regardless of modulator count (modtest
has 3 modulators but 2 `0x2ab8`; `mp_one_lfo` has 1 modulator but 2 `0x2ab8`) — it
is **device/chain-level, not per-modulator**. So same-donor adds never touch it, and
there is nothing to freshen there.

The real per-object ids are only two: `0x1a1b` (unique instance id, the proven gate)
and `0x18c6` (the **type** GUID). `referenced_modulator_ids` == the ordered set of
`0x18c6` values, verbatim. Critically, `0x18c6` is **shared across all instances of
a type** — LFO is `ad947004…` and Random is `bf29a7b0…` in *every* preset examined.
Therefore a same-type add necessarily produces a **duplicate `0x18c6`** in the
stream and a **duplicate entry** in `referenced_modulator_ids`. That is the real
question, and it is now settled: **both duplicates load.** (Freshening `0x18c6` is
not even an option — a random value would no longer name a real modulator type.)

### The matrix (ids kept unique throughout; the single variable is same-type duplication)

| case | edit | `0x1a1b` | `referenced_modulator_ids` | result | pages |
|---|---|---|---|---|---|
| F0 | `mp_one_lfo` unmodified | `[0]` | `[LFO]` | ● LOAD | `[LFO]` |
| F1 | add Random once (control == E10f-B1) | `[0,1]` | `[LFO, Rand]` | ● LOAD | `[LFO, Random]` |
| **F2** | add SAME Random donor **twice** | `[0,1,2]` | `[LFO, Rand, Rand]` | ● LOAD | `[LFO, Random 1, Random 2]` |
| **F3** | add a 2nd **LFO** (dup of existing type) | `[0,1]` | `[LFO, LFO]` | ● LOAD | `[LFO 1, LFO 2]` |

F1 is the add-once control; F2/F3 add a duplicate type. No confound — `0x1a1b`
stayed unique in every case, so the only thing that changed F1→F2/F3 is the
type-duplication (and its forced GUID/meta duplication).

### Side finding — display names are auto-disambiguated by Bitwig, not by us

The `0x02b9` name string we set is the slot index (`"0"/"1"/"2"`). The remote-page
**display** names came back as `"Random 1"/"Random 2"` and `"LFO 1"/"LFO 2"` — and
note the FIRST one is renumbered too (F1 shows bare `"Random"`, F2 shows `"Random
1"`). So the visible page name is derived at runtime from `device_name` + a
duplicate-disambiguation suffix; it is **cosmetic and independent of `0x02b9`**. The
library need not (and should not) try to author these suffixes.

### Decision impact

- **`bwmod.addModulator`/`replaceModulator`: assign a unique `0x1a1b`, append/replace
  the `0x18c6` GUID in `referenced_modulator_ids`, patch `f4` — and nothing else.**
  No embedded-id freshening. Two instances of one type are a supported, first-class
  case (`referenced_modulator_ids` may legitimately contain duplicate GUIDs).
- **BWFORMAT_SPEC §3.2 `0x2ab8` note to sharpen:** it is device/chain-level (fixed
  count per file), NOT a per-modulator field — so it is irrelevant to modulator add.
- Removes E10f's "same donor twice?" caveat. Untested edges remaining: id
  contiguity (E11a), name/id independence (E11b), scale (E11c), non-Polysynth
  hosts (E11d), cross-device routing (E11e), save+reload durability (E11g).

---

## E10 — The `.bwpreset` format is readable, and routing targets are editable (2026-07-20)

**Verdict: ● modulation ROUTING TARGETS are fully parameterisable — E7 Finding F's
○ is overturned.** The `.bwpreset` container was decoded well enough to read
modulator topology, and a modulator's routing target turns out to be a plain
length-prefixed UTF-8 string holding a parameter path. Rewriting it **moves the
modulation**, in both directions of length change, loading cleanly via
`insertFile`. Probes `e10-retarget` (length-preserving) + `e10b-varlen`
(variable-length, both directions), all green. Reader + editing helper live at
`tools/bwformat/bwparse.py`. This **collapses the target axis of E7 Finding H's
slot-bank** (below). Credit: the user brought the zezic/bitwig-device-hacks and
bwEdit-Python leads that prompted re-opening a closed ○.

### Finding A — `.bwmodulator` is a dead end, and the header says why (○, but informative)

The header's third field is an **encoding discriminator**, and it alone predicts
readability. Verified across **all 361** BtWg files shipped with or written by
Bitwig 6.0.6 — the correlation is exact, with no exceptions:

| extension | encoding | payload | count |
|---|---|---|---|
| `.bwpreset` / `.bwclip` / `.bwproject` | `0002` | **plain, parseable** | 167 |
| `.bwdevice` / `.bwmodulator` | `0004` | opaque | 194 |

`0004` is **not** any standard compression: a brute-force zlib/raw-deflate/gzip
scan at every offset yields zero decompressible regions, and there is no
lzma/xz/zstd/lz4 magic anywhere. Entropy ~6.7–7.5 (the low end explained by ~5KB
of space padding, not by structure).

**Why the community tooling looked promising and isn't.** `zezic/bitwig-device-hacks`
`repack.py` performs **no decompression at all** — it splices raw bytes at
hardcoded offsets, which works because *its* `Math.bwmodulator` is plain. That
file is `BtWg` **0001**/`0002` with readable TLV and Nitro DSP source in the
clear; Bitwig 6.0.6 ships the same device as **0003**/`0004`. The format moved
on and the repo is archived. ⇒ **This CONFIRMS and sharpens E7 Finding D rather
than overturning it.** `openwig` has no `BtWg` knowledge whatsoever (it is a
controller-script bridge) — not a format lead at all.

⇒ **Do not spend further time on `.bwmodulator`/`.bwdevice`.** They hold Bitwig's
proprietary DSP implementations. **Modulator instances and their routing do not
live there — they live inside `.bwpreset`, which is plain.** E7 Finding D's
"`.bwmodulator` files are binary-compressed" was right about the file and wrong
about where the interesting content is.

### Finding B — the container grammar (●)

```
header  [0:4]'BtWg' [4:8]container [8:12]ENCODING [12:16]writer
        [16:24]f4 -> object-stream root offset (+1) [24:32]f5 [32:40]f6 [40:42]'00'
meta    self-describing name/value TLV, space-padded (creator, device_id,
        referenced_modulator_ids, revision_id, …)
stream  u8(0x0a) u32 rootClassId field* u32(0)
object  := u32 classId, field*, u32(0)
field   := u32 fieldId, u8 type, value
types   := 0x01 u8 | 0x03 u32 | 0x05 bool | 0x07 f64 | 0x08 str
           0x09 object | 0x12 list | 0x15 guid16 | 0x19 str[]
```

A modulator instance decodes to:

```
<cls 0x06c9> {
  0x009a device_name    = 'LFO'
  0x18c6 device_guid    = ad947004-…          <- the identity E7e/g patched
  0x18c7 obj 'CONTENTS' [ … 'LFO' [
      0x0e3d ROUTING_TARGET = 'CONTENTS/F1FREQ'   <- a plain string
      0x0124 range_lo = -36   0x0125 range_hi = 36
      0x0e32 amount   = 0.5
  ] ]
}
```

⚠ **Field ids are numeric keys into a schema that is NOT recoverable by
inspection** — `bitwig.jar` is obfuscated across ~17k classes with no plaintext
field names, and the native audio engine has none either. Ids are therefore
reported raw; only the handful that matter are named.

⚠ **Known reader limitation:** a full tree dump stops partway. After an object's
terminator the next `u32` is ambiguous — next list item's classId, or parent's
next field id, both non-zero — and the real decoder disambiguates from the
schema. **This does not limit targeted editing**, which never needs a complete
parse: locate a length-prefixed string, rewrite it.

### Finding C — retargeting works, and is variable-length (●)

Two-sided by design: the modulation must **leave** the old target *and*
**arrive** at the new one. "Left the old target" alone is equally consistent
with a corrupted file that silently dropped the route.

| probe | edit | Δ size | old target | new target |
|---|---|---|---|---|
| e10 | `CONTENTS/F1FREQ` → `CONTENTS/F1RESO` | 0 | 0.4665 → **0.0000** | 0.0000 → **0.3948** |
| e10b | → `CONTENTS/OSC1_PITCH` | **+4** | **0.0000** | **0.5000** |
| e10b | → `CONTENTS/NOISE` | **−1** | **0.0000** | **1.0000** |

(divergence = `|modulatedValue − value|`)

**The variable-length result also confirms the format inference.** Inserting or
removing bytes shifts everything after the edit, and Bitwig still honours it ⇒
the `u32` after a `0x09`/`0x12` type byte really is a **classId, not a byte
length**. Nothing in the container encodes an absolute offset or a span an edit
could invalidate, and the meta `revision_id` hash is **not validated** (e10
changed content without touching it). ⇒ **a length-changing edit needs NO
enclosing fixups — only the edited string's own u32 prefix.**

⚠ **`CONTENTS/<param_id>` is NOT a universal path rule.** `CONTENTS/GAIN` loaded
cleanly and silently carried **no** modulation despite `GAIN` being enumerable
(it sits among the nested `EFFECT_CHAIN` strings, so its real path is deeper). A
wrong path is a **silent no-op**, like every other insert trap in this spike ⇒
**every retarget must be confirmed by readback.**

### Method note — a false negative caught twice in one experiment

Both of this experiment's initial FAILs were **wrong test expectations, not
results** (the standing rule, again):

1. `e10`'s first run failed its **own baseline**. It measured modulation as
   *movement over time*, but modtest's LFO is **transport-synced**, so with the
   transport stopped it holds a fixed phase — diverging strongly while never
   moving. Had only the patched phase been run, `F1FREQ: 0.0000` would have read
   as "the edit destroyed the route" and been recorded ○. **Measure divergence
   (E7 Finding B), never movement.**
2. `e10b`'s first SHORTER case used `CONTENTS/PAN` and failed — but its separate
   *target-is-enumerable* sanity check showed `PAN` is not enumerable at all. A
   bad fixture, not a negative. It only stayed distinguishable because the probe
   asserts "target exists" separately from "route landed".

⇒ **keep asserting fixture validity separately from the hypothesis**; it is what
stops a broken fixture from being written down as a capability ○.

### Decision impact → DECISIONS / PROJECT_PLAN

- **E7 Finding F is overturned for the template-authoring path.** Routing-target
  change remains ○ at **runtime** (the map idiom is inert, even foregrounded —
  that stands), but it is ● at **template-build time**, via a string edit. E7's
  error was generalising "no runtime path" to "needs hazardous binary topology
  surgery". Retargeting is the same edit class as E4g's device-GUID swap —
  substitution into a structurally valid file — not the structural atom splicing
  that crashes Bitwig.
- **E7 Finding H's slot-bank collapses on the target axis.** It sized templates
  as `N targets × M types` of dormant pre-wired modulators *because targets were
  believed fixed at authoring time*. They are not. **One template per modulator
  TYPE now covers every target.** The remaining explosion is `type` alone.
- **The target set is no longer "curated, not arbitrary"** — the residual noted
  in Finding H is lifted, subject to the readback rule above.
- **Carry-forward:** `tools/bwformat/bwparse.py` (container reader +
  `patch_string` length-aware editor) joins the templating helper on the Phase-1
  list. The GUID-substitution helper (E4f/E4g) and this share one home.

### Limits of this evidence (do not over-read)

Verified on **one** fixture: modtest.bwpreset, one Polysynth, one LFO modulator,
three targets on the same device. **Not** tested: adding a route where none
exists (that means synthesising new objects, not editing a string — genuinely
the crash-prone end); targets reaching **across** devices in a chain; other
modulator types or host devices. E7g's modulator-GUID-swap ○ still stands and is
now *explained* — a modulator carries a type-specific `CONTENTS` payload
alongside its GUID, so a bare 16-byte swap leaves LFO-shaped payload under
another type's identity.

---

## E10f — Modulator construction is UNLOCKED; the gate is a unique instance ID (2026-07-21)

**Verdict: ● modulators can be ADDED, REPLACED (any type/category), retargeted,
and deleted by `.bwpreset` surgery. The only load-time invariant is that field
`0x1a1b` — a unique per-modulator instance ID — stay unique. E10e's "category"
gate and E10c's "insertion blocked" are BOTH overturned; they were this one field
all along.** Probe `e10f-addcat` + `tools/bwformat/build_e10f_cases.py`, on
user-authored minimal-pair presets. This collapses E7 Finding H's slot-bank
almost entirely — modulator topology is now agent-constructible from templates.
Credit: the user's minimal-pair presets (and the `_same` methodology control)
are what made the differential analysis possible.

### The controlled matrix (each pair isolates ONE variable)

| test | edit | `0x1a1b` set | result |
|---|---|---|---|
| **M1** | modtest, flip slot-1's `0x1a1b` 1→0 — **one byte, nothing else** | `[0,0,2]` | ○ REJECT |
| C0 | modtest unmodified | `[0,1,2]` | ● load |
| **C1** vs **C1n** | replace modtest slot-1 with Classic LFO | `[0,1,2]` / `[0,0,2]` | ● load / ○ REJECT |
| **B1** vs **B1n** | ADD Random as a 2nd modulator to one_lfo | `[0,1]` / `[0,0]` | ● load / ○ REJECT |
| A1 | replace Expressions(Note-driven) at slot 0 with Classic LFO(LFO) | unique | ● load |

**M1 is the clincher:** a single byte that duplicates an ID turns a loading preset
into a rejected one, with nothing else changed. **C1/C1n and B1/B1n** each differ
*only* in whether `0x1a1b` stays unique. **A1** loads a cross-category swap
(Note-driven → LFO) — category is not a gate.

### What `0x1a1b` is

A **unique per-modulator instance id**, u8, one occurrence per modulator object.
Across every preset examined it is distinct within a file (modtest `[0,1,2]`,
modzoo `[0,1]`, singles `[0]`). It is NOT the display slot (the `0x02b9` name
string is the visible index; they coincide only because none of these presets had
a modulator deleted/reordered). Bitwig validates its uniqueness on load and
**rejects the whole preset on a collision** — the same graceful whole-file refusal
as every other invalid edit, never a crash.

### The full modulator-construction capability (all ● now)

| operation | how | evidence |
|---|---|---|
| retarget a route | rewrite the `0x0e3d` target-path string (any length) | E10/E10b |
| change TYPE / replace | swap the whole object (GUID+payload), **assign a unique `0x1a1b`**, fix meta ref | E10f C1 |
| ADD a modulator | insert object into MODULATORS list, unique `0x1a1b`, append meta ref, patch `f4` | E10f B1 |
| DELETE a modulator | remove the object (+ its meta ref) | E10c/E10d |
| vary settings live | remote-control page writes at runtime | E7d |

The add/replace recipe in full (from `build_e10f_cases.py`, now the reference):
1. object goes into the `MODULATORS` list (field `0x1a46`), objects adjacent, no
   separators, no count field (E10d);
2. its `0x1a1b` **and** `0x02b9` name set to an id unused by any sibling
   (max-existing + 1 is safe);
3. its GUID appended to (or replaced in) meta `referenced_modulator_ids` (a `0x19`
   str[] with a u32 count — bump the count);
4. if meta size changed, patch header `f4` (the only offset pointer; `f5`/`f6` are
   always 0) by the byte delta.

Verified end to end: a `mp_bare → mp_one_lfo` reconstruction was **byte-identical**
to the real Bitwig-saved file except the name and a volatile per-instance "Chain"
GUID (field `0x2ab8`) — so the machinery reproduces exactly what Bitwig writes.

### Method — three wrong turns, each caught by isolation (the spike's whole thesis, again)

This experiment reached the right answer only after **three** confident-but-wrong
readings, every one killed by a cleaner control:
1. **"Category is the gate" (E10e).** Spurious: slot-0 replaces happened to
   preserve id-uniqueness; the slot-1 one didn't. A1 (cross-category, unique ids →
   load) killed it.
2. **"Slot position is the gate."** A1 loads at slot 0, C1 loads at slot 1 — both
   fine once ids are unique. Position never mattered.
3. **"`0x1a1b` = slot position, must equal the index."** Wrong: it is an
   *instance id*, only required unique. A broken B1n control (a stale
   pre-rename gave it a unique id by accident, so it loaded and muddied the
   picture) hid this for one run; fixing the control gave the clean
   unique-vs-duplicate split. **The one-byte M1 test is what made it
   incontrovertible** — change exactly one thing, observe exactly one flip.

⚠ Untested edges (do not overclaim): whether ids must also be *contiguous* or may
be sparse (all evidence is contiguous-from-0); whether the `0x02b9` name string is
independently validated (it was kept equal to `0x1a1b` in every passing case);
scale beyond 3 modulators; and non-Polysynth hosts. The per-instance "Chain" GUID
(`0x2ab8`) regenerates per save but was NOT required unique for a load here.

### Decision impact → DECISIONS / PROJECT_PLAN (significant)

- **E7 Finding H's slot-bank is largely retired.** The agent does not need a fat
  template of dormant pre-wired modulators. It can **add, remove, type-swap, and
  retarget modulators directly** on a `.bwpreset` from a plain template, then
  `insertFile`. One small template per device (or even a bare device) suffices;
  the modulation graph is constructed by file surgery + verified by remote-page
  readback (E7d), all length-free.
- **Modulator authoring joins device/param authoring as a template-time
  capability.** The remaining hard ○ is unchanged: no *runtime* API for any of
  this (E7 Finding 0/F), and no save/export API (E4f) — templates still originate
  from a human, but now a *minimal* one, not a curated matrix.
- **Carry-forward:** promote `build_e10f_cases.py`'s primitives into a
  `tools/bwformat` modulator library (`list_modulators`, `next_free_id`,
  `add/replace/delete/retarget`, meta+`f4` maintenance). It is Phase-1/2 quality;
  the byte offsets and the `0x1a1b`/meta/`f4` invariants are the spec.
- **The invariant to enforce in code:** every modulator's `0x1a1b` unique; meta
  `referenced_modulator_ids` in sync with the object set; `f4` = meta end. Always
  verify by load + remote-page readback (a duplicate id fails the whole file
  silently — the standing readback rule).

---

## E10e — TYPE substitution: the "category" reading was WRONG (see E10f) (2026-07-21)
> **⚠ CORRECTED BY E10f (2026-07-21).** This entry concluded type substitution is
> gated by modulator **category** (`0x009c`). That was a **spurious correlation**.
> E10f isolated the real invariant: a unique per-modulator instance id (`0x1a1b`).
> E10e-R1/R2 replaced a slot-0 modulator whose id (0) matched the donor's, keeping
> ids unique → load; E10e-R3 replaced a slot-1 modulator, so the donor's id (0)
> **collided** with the slot-0 modulator's id (0) → duplicate → reject. Category
> tracked the outcome only because the donor's native id happened to be 0. Type
> substitution works **across categories** (E10f-A1), at any slot, given a unique
> id. Read the mechanics below, but take the verdict from E10f. The length-vs-gate
> reasoning (R1/R2/R3) and the "length is not the gate" result remain correct.

### E10e original writeup (mechanics still valid; the "category" verdict is not)

**Verdict: ◐→● type substitution works by whole-object replacement WITHIN a
modulator category; the earlier ○ was a cross-category confound, not a real
wall.** E10c concluded "the container rejects object INSERTION outright" from a
`Expressions → Classic LFO` replace that failed. That was three confounds in a
trench coat — length, donor-foreignness, and content. Isolating them shows the
real gate is **category compatibility**, and same-category replacement loads
cleanly at any length. Probe `e10e-replace`, all green. This **reopens the type
axis of E7 Finding H** (partly). Credit: the user pushed for the length-isolated
replace test and the minimal-pair strategy that will finish the job.

### The isolation

`insertFile` of modtest (Polysynth + Vibrato[LFO] + Expressions[Note-driven] +
LFO), each variant a whole-object replace with meta `referenced_modulator_ids`
repaired. Donor length tuned by padding an empty string field (E10b's trick):

| variant | replace | Δlen | result |
|---|---|---|---|
| S1 | pad modtest's own LFO object in place (no replace) | +80 | ● loads (padding is neutral) |
| R1 | Vibrato[LFO,slot0] ← **Classic LFO[LFO]**, padded to EXACT 773B | **0** | ● loads, live Classic LFO |
| R2 | Vibrato[LFO,slot0] ← **Classic LFO[LFO]**, native 579B | **−194** | ● loads, live Classic LFO |
| R3 | Expressions[**Note-driven**,slot1] ← Classic LFO[LFO] (E10c repro) | **+120** | ○ whole preset rejected |

**Length is decisively OUT:** R2 loads *shorter*, R3 rejects *longer*. And in
R1/R2 the Classic LFO **instantiated live** — its own remote page appeared and
the untouched slot-2 LFO→F1FREQ route survived. This is the exact swap E7g got
"Missing" from (GUID-only), now working because the whole object (GUID + payload)
moves together.

### Why E10c was wrong — the category field

All five modulators (Vibrato, Expressions, LFO, Classic LFO, Random) share
**classId `0x06c9`**, so class does not gate it. The field that splits the result
is **category (`0x009c`)**:

| modulator | category | as donor into an LFO slot |
|---|---|---|
| Vibrato, LFO, Classic LFO, Random | `LFO` | ● works |
| Expressions | `Note-driven` | ○ rejected |

E10c's `Expressions → Classic LFO` and E7g's cross-family GUID swaps were all
**`Note-driven`/other ↔ `LFO`** — category mismatches. The container appears to
reject a modulator whose category is incompatible with its slot/context. A
Note-driven modulator taps the note stream; an LFO is free-running — plausibly a
different connection shape the graph won't accept in that position.

### ⚠ Open confound — category vs slot POSITION (hands off to minimal-pair presets)

R1/R2 replace **slot 0**; R3 replaces **slot 1**. Both donor presets carry ONLY
`LFO`-category modulators, so "same category" and "slot 0" cannot be separated
with current fixtures, and neither can "cross category" from "slot 1". The
competing hypothesis — *replace works only at slot 0* — is not yet excluded.
**This is the single open question.** It needs minimal-pair presets specifically:
a `Note-driven` modulator at **slot 0**, and an `LFO` at **slot 1**. Then:
`Note[slot0] ← LFO` failing would confirm category; `LFO[slot1] ← LFO` loading
would kill the position hypothesis.

### Decision impact (provisional, pending the confound)

- **The type axis of E7 Finding H shrinks from "impossible" to "within-category".**
  If category is the gate (likely), one template per **category** covers every
  type in it — LFO, Classic LFO, Beat LFO, Steps, Random, etc. are one template,
  not five. That is a large reduction, short of fully free but far from E10c's ○.
- **E10c's headline claim is corrected**, not deleted: object *insertion* (adding
  a modulator, growing the count) is still untested-as-blocked; only *replacement*
  is now shown to work. Deletion (E10c) and replacement (here) both work; adding
  remains the open ✗.
- **`patch`-level type swap** joins the templating helper: replace the whole
  modulator object from a same-category donor, repair `referenced_modulator_ids`,
  verify by remote-page readback. Length-free.

### Method note — the contradiction WAS the finding (again)

The first e10e run (R1/R2 only) concluded "replace works at ANY length" and would
have been recorded as flatly contradicting E10c. Adding R3 — the exact E10c
scenario — reproduced the rejection and revealed the category boundary hiding
under the length variable. **Reproducing the prior result inside the new harness
is what converted a contradiction into the actual mechanism.** Do not record a
"we overturned X" without re-running X's exact case in the new setup.

---

## E10c — Modulator TYPE substitution: GUID+payload does NOT solve it (2026-07-20)
> **⚠ SUPERSEDED IN PART by E10e (2026-07-21).** E10c's "the container rejects
> object INSERTION outright" over-generalised from a single **cross-category**
> replace (`Expressions[Note-driven] → Classic LFO[LFO]`). E10e shows
> **same-category REPLACE works** at any length; the rejection E10c saw is a
> category-compatibility gate, not a blanket insertion block. E10c's DELETE
> result and the still-open *add-a-modulator* (grow the count) question stand.
> Read E10c's mechanics below, but take its verdict from E10e.

**Verdict: ○ type substitution stays closed — but for a completely different
reason than E7g assumed, and modulator DELETION is ● as a side effect.** E10
explained E7g's GUID-only failure as "the payload is type-specific, so swap
both". That explanation was right about the mechanism and **wrong about the
remedy**: splicing the whole modulator object (GUID *and* payload together) does
not work either, because **the container rejects object INSERTION outright**.
Probe `e10c-typeswap`, all green (it asserts the negative). E7 Finding H keeps
one template per modulator type.

### The isolation (the part that matters)

Object bounds come from the MODULATORS list: every item begins
`<u32 classId> 0x02b9 str '<index>'`, so consecutive item starts delimit each
object exactly. Four variants on modtest, replacing/removing the `Expressions`
modulator:

| variant | edit | result |
|---|---|---|
| **DELETE** | drop the `Expressions` object | **● loads** — `Vibrato` + `LFO` pages intact |
| **DUP** | replace it with a same-file `Vibrato` **copy** | ○ whole preset fails to load |
| **FOREIGN** | replace it with modzoo's `Classic LFO` object | ○ whole preset fails to load |
| **FOREIGN + meta** | same, plus `referenced_modulator_ids` repaired | ○ whole preset fails to load |

**DUP is the decisive row.** A well-formed object copied from the *same file*
cannot be malformed, and it is still rejected — so the problem is **insertion
itself**, not the donor, not foreignness, not the GUID/payload pairing. The
`referenced_modulator_ids` repair (a length-preserving ASCII fix, motivated by
E7g's "Missing" GUID being the one absent from that list) changed nothing, so
that hypothesis is dead too.

Failure mode is **whole-preset rejection** (chain EMPTY), which is more severe
than E7g's unwired/page-less/"Missing" — but still **graceful, never a host
crash**, consistent with every substitution-class edit in this spike.

### DELETE is a real capability (●)

Removing exactly `[start, end)` yields a valid preset that loads with the
remaining modulators live. This is worth two things:
1. **It proves the object bounds are byte-exact** — otherwise the file would be
   corrupt. The delimiting rule above is sound.
2. **Modulators can be REMOVED from a template.** A fat donor template can be
   trimmed down, which is the opposite direction from the slot-bank's
   `Amount = 0` dormancy trick and costs nothing at runtime.

### Why the E10 optimism did not carry over

E10/E10b edits were **value-level**: rewrite a string inside an existing object,
including at changed length. Those are fine. E10c is **structure-level**: change
how many objects exist. The container tolerates the first and rejects the second
(except deletion). This is the line E4f drew from the outside — "value/GUID
substitution ≈ safe; new topology ≈ hazardous" — now measured from the inside,
and *sharper*: new topology does not crash, it simply will not load.

⚠ **The mechanism is NOT identified.** Something makes an added object invalid
and it is not size (E10b changed sizes freely), not GUID uniqueness (FOREIGN's
GUID is unique to the file and still failed), and not the meta reference list.
Candidates not yet tested: a per-file object/instance id that must be unique, or
a count//checksum the reader validates. **Do not build on insertion** until this
is understood; it is the one place a wrong assumption could silently produce
files that load but misbehave.

### Decision impact

- **The `type` axis of E7 Finding H stands as the residual explosion.** One
  human-authored template per modulator type; the `target` axis is collapsed by
  E10, the `settings` axis by E7d, and `count` can now only shrink (DELETE), not
  grow.
- **Answers the open question directly:** knowing a modulator's GUID *and* its
  default payload is **not** sufficient. The substitution issue was never an
  information problem, so no amount of harvesting default payloads fixes it.
- **Adds `patch`-level deletion** to the templating helper alongside the string
  editor and GUID substitution.

---

## E10d — Sweep: what else the readable format changes (2026-07-20)

A pass over the earlier findings asking which ones the `.bwpreset` decode
(E10–E10c) actually moves. Two do, one materially. Probe `e10d-chaintrim`, all
green, plus offline analysis.

### Finding A — layer chains can be TRIMMED, collapsing E4f's "template per shape" (●)

E10c's remove-yes/insert-no asymmetry generalises one level up. Chains are
`CHAIN_LIST` items delimited exactly like modulators
(`<u32 classId> 0x02b9 str 'CHAIN<n>'`), and deleting them works. Against the
E4g 4-chain Instrument Layer (Phase-4, Polysynth, Organ, Sampler):

| trim | result |
|---|---|
| drop CHAIN2 (middle) | ● `[Phase-4, Polysynth, Sampler]` |
| drop CHAIN0 (first) | ● `[Polysynth, Organ, Sampler]` |
| drop CHAIN1+CHAIN2 | ● `[Phase-4, Sampler]` |
| drop CHAIN0+CHAIN1+CHAIN2 | ● `[Sampler]` — a 1-chain stack |

⇒ **E4f's "a finite template library, one per SHAPE (2-layer, 3-layer, 4-layer…)"
collapses to ONE wide template plus a trim step.** This does **not** contradict
E4d/E4e — growing a layer container is still impossible, and that reasoned
negative stands untouched. It removes the *need* to grow: author wide once, trim
down per use.

⚠ **The LAST chain cannot be deleted** — it has no exact end, because everything
after it (the list terminator, the enclosing object's remaining fields) belongs
to the parent. Drop the chains *before* it instead; that still reaches N=1.

⚠ **Another probe-bug-as-false-negative, caught only by the position sweep.** The
first run fell back to `b.length` for the last chain's end, cut off the whole
enclosing tail, and Bitwig rejected the file. That reads exactly like "deleting
the last chain is unsupported" — a capability ○ — but was a bug in the probe.
E10c had already guarded this case (`end = -1`); this probe did not. **Testing
the same operation in several POSITIONS is what exposed it**, the same way
multi-mechanism sweeps expose the others.

### Finding B — E4h's sample caveat is closed: presets EMBED audio (●)

E4h left open whether sample-bearing presets embed or merely reference audio,
flagging it as a possible external dependency. Reading the containers settles it:

| preset | size | embedded audio chunks | `referenced_packaged_file_ids` |
|---|---|---|---|
| Sampler "Ringwave" | 530 KB | 2 AIFF | **count = 0** |
| Drum Machine "PS2 corruption" | 5.0 MB | **24 AIFF** | **count = 0** |

The audio is **inside the file**. Original absolute source paths appear as
provenance metadata only (alongside internal `samples/<name>.wav` names), and
nothing external is referenced. ⇒ **E4h's "templates are a build-time asset, not
a runtime dependency" holds even for sample-bearing presets** — they are just
large. The residual dependency risk is retired.

### Finding C — the param catalog can be read structurally, not scraped (◐ minor)

E4 already harvests device param IDs from the bundle's
`device-settings/<uuid>/Default.bwpreset` via `strings | grep`, and noted the
output needs a resolve-check because it includes non-param tokens (`CONTENTS`,
`MODULATORS`, `FAKE1`). The decode explains *why*: those tokens are **object
names** (field `0x02b9`) at a different tree depth from parameter entries, not
noise. A structural read can distinguish them, which would remove the
per-ID live resolve-check. **Not pursued** — E4's scrape already works and the
catalog is a Phase-1 item; recorded so it is not re-derived.

### Checked and NOT changed

- **E4d/E4e (layers cannot be created)** — unchanged. E10c shows object
  insertion is rejected outright, which independently corroborates the ○ from
  the file side rather than the API side.
- **E4f "no save/export API"** — unchanged. The format is readable but nothing
  lets the agent *capture* a live structure; templates still originate from a
  human saving one.
- **E7 Findings A–E (remote controls, `modulatedValue`, drive-at-runtime)** —
  unchanged; all runtime, untouched by file-format work.
- **E6 (named actions)** — unchanged and still do-not-use.
- **E1/E2/E3/E5/E8 (addressing, fidelity, structural ops, scale, batching)** —
  no contact with the file format.

---

## E9 — MCP smoke test: the SDK sits cleanly on client.ts (2026-07-20)

**Verdict: ● no surprises — it just works.** A minimal MCP server exposing two
tools (`ping`, `read_notes`) backed by `client.ts` speaks MCP over stdio and is
driven end-to-end by an MCP client, with **zero bridge-side changes**. Probe
`e09-mcp` (all green). Pure Phase-1 wiring de-risk; nothing architectural. This
is the last spike experiment — every SPIKE_PLAN §4 row is now done.

### What was wired

- **`brain/src/mcp-server.ts`** — `@modelcontextprotocol/sdk` v1.29 `McpServer`
  over `StdioServerTransport`, two tools registered via `registerTool`
  (zod-typed input schemas). Both tool handlers call straight into the existing
  `BridgeClient` / `lib.ts` helpers (`client.request('ping')`, `point` +
  `getNotes`) — the MCP layer is a thin shell over `client.ts`, no new bridge
  protocol.
- **Probe `e09-mcp`** — an MCP *client* (`Client` + `StdioClientTransport`, the
  same transport Claude Code uses) spawns the server as a subprocess, lists
  tools, and calls both. Results:
  - `tools/list` → `[ping, read_notes]` (discovery works).
  - `ping` → `{pong:true, thread:"Control Surface Session"}` (round-trips the
    bridge through the MCP layer).
  - `read_notes(trackA, 0)` → `[[0,60,100,1]]` (the gn-A slot-0 fingerprint,
    read via `point`+`getNotes` through `client.ts`).

### Notes for the build

- **stdout is the MCP transport** — the server must never `console.log`
  (diagnostics to stderr only). The one operational gotcha; trivially avoided.
- The MCP server runs as its **own process with its own bridge connection**;
  the `Bridge`'s multi-client accept (E0) handles it alongside probe clients
  with no contention. Two TCP clients on `:8686` coexist fine.
- **Carry-forward:** `mcp-server.ts` is a Phase-1 skeleton — the tool set grows,
  but the shape (MCP tool → `client.ts` call → JSON-in-text result) is settled.
  `client.ts` needs nothing added to sit under MCP.

### Decision impact → DECISIONS / PROJECT_PLAN

- **The MCP layer sits cleanly on `client.ts`** — Phase 1's transport stack
  (MCP SDK ↔ `client.ts` ↔ TCP bridge ↔ extension) is de-risked end to end. No
  architectural work; the remaining effort is defining the real tool surface
  (the contract), not plumbing.
- **`@modelcontextprotocol/sdk` + `zod`** are the confirmed Phase-1 deps for the
  brain's MCP front end.

---

## E8 — Concurrency & safety mechanics: the batch/revision machinery holds (2026-07-20)

**Verdict: ● the §8 batch-execution and safety mechanisms all behave under
load and interference.** A server-side batch handler collapses N round-trips to
one control-surface turn (**232× faster** for the fast note-write class); staged
`delayMs` pacing respects the ~600ms device-insert settle (E3); mid-batch
`showPopupNotification` is a usable progress signal that does not stall the
batch; a monotonic revision counter rejects stale writes whole; and writes land
on a pinned cursor's target through concurrent user editing (E1b extended from
reads to writes). Probes `e08-batch` (A–D, automated) + `e08b-interference`
(the user-at-keyboard write test). This is **infrastructure de-risking**, not an
open architectural question — and the batch executor + revision counter are
real Phase-1 carry-forward code (`ProbeHandlers.batchRun`, `revision`).

### The batch executor — one request, one turn (Finding A, ●)

The Bridge already marshals every RPC onto the single control-surface thread via
`host.scheduleTask(…, 0)`, so **N separate requests pay N scheduling turns** (the
~24ms tick floor each, E5). A `batch.run` handler carries N ops in one request →
one task → **one turn**, dispatching each op through the existing handler table
(`dispatch(method, params)` reused verbatim per op). Measured on 240 single-note
writes to one clip:

| path | client wall | server work |
|---|---|---|
| `batch.run` (240 ops, 1 request) | **25 ms** | 1 367 µs for all 240 `setStep`s |
| 240 separate RPCs | **5 804 ms** | — |

**232× faster wall-clock.** The E2 two-turn write rule applies **once to the
whole batch**, not per op: all 240 writes land in one turn and become verifiable
one turn later, regardless of N. ⇒ the batch is the right primitive for the fast
op classes (note/param writes); a per-op-RPC design would pay the tick tax N
times for nothing.

### Staged pacing for ops that settle across turns (Finding B, ●)

A single synchronous turn is wrong for ops that materialise across turns — a
device insert (~600ms, E3), a track create (~144ms) — because a later op that
depends on the settle (a write into a just-inserted device) would run before the
device exists. `batch.run` takes an optional `delayMs`: ops are then handed to
`host.scheduleTask` one settle-budget apart, and the response **returns
immediately** (`{paced:true, scheduled:N}`) rather than blocking. A mixed batch
of 3 note writes + 2 Polysynth inserts paced at 650ms returned in 26ms and
drained fully in **3.3s** with all 5 ops landed (3 notes + 2 devices), confirmed
by readback. ⇒ **batches mixing note and structural/device ops stage naturally:
a fast phase in one turn, structural ops paced at their settle budget.**
Completion is confirmed by the standing verify-by-readback rule, not by the
batch response (which only acknowledges acceptance for a paced batch).

⚠ **Async-completion is a Phase-1 design point, not yet built.** The Bridge
writes a handler's response when it *returns*, so a paced batch cannot deliver a
single "all done" response at the end within the current contract — the probe
polls readback instead. A production executor that wants a completion callback
needs an async-response protocol (a handler returning a "deferred" sentinel and
the executor writing the final frame later). Recorded for `DECISIONS`.

### Mid-batch notification is a clean progress signal (Finding C, ●)

`showPopupNotification` invoked as ops interleaved into a paced batch
(`notify 0% → write → notify 50% → write → notify 100%`) fired all three popups
spaced across the batch without stalling it (notes still landed on schedule).
Because `notify` is just another dispatched method, progress UX is free — no
special batch machinery. ⇒ **the progress-UX baseline is "interleave notify ops
in a paced batch."**

### The stale-revision guard — optimistic concurrency (Finding D, ●)

A monotonic `long revision` counter on the executor implements the §8 stale-write
rejection:
- `batch.run({ops, ifRevision})`: if `ifRevision` is present and ≠ the current
  revision, the batch is **rejected whole** — nothing applied — returning
  `{applied:false, rejected:true, reason:"stale-revision", expected, actual}`.
  Verified: after an interfering `revision.bump`, a batch tagged with the old
  revision applied **zero** of its ops (note count unchanged), and resubmitting
  against the fresh revision applied cleanly.
- Acceptance claims the next revision immediately (`++revision`), so a second
  batch against the old revision is rejected even while a paced batch is still
  draining — correct in-flight semantics.

**Where revision state lives (the settled question):** on the **executor**
(`ProbeHandlers`), NOT on the `Rig` (which holds pre-allocated Bitwig handles) —
revision is executor policy, not a DAW object. And because **every request is
dispatched on the one control-surface thread**, the counter is touched
single-threaded and is **naturally serialized with the writes it guards** — no
lock, no atomic needed. That thread-confinement is the load-bearing property: it
is what makes "check revision, then apply, then bump" atomic for free.

### Write-under-interference — E1b extended to writes (Finding E, ●)

`e08b` pinned a pool cursor to gn-A (track + clip pin, the robust E1/E4 hold) and
streamed **40 paced note writes** over a ~16s window while the user clicked,
dragged, and switched clips/tracks elsewhere. Result across **21 observed
selection changes**: all **40/40 writes landed on gn-A's exact target cells** and
the cursor stayed pinned to (gn-A, slot 0). ⇒ the pinned-cursor addressing model
survives concurrent user editing **during a live batch**, not just for reads
(E1b) — the write path has the same immunity.

⚠ **Note-adjacency truncation (a real fidelity gotcha, found via a test
"FAIL").** The first `e08b` run failed an exact content match despite 40/40 cells
written: consecutive **same-pitch** notes each with `dur=1` (4 steps at
stepSize 0.25) truncate each other to `0.25` — Bitwig ends a note where the next
same-pitch note begins. This is correct DAW behavior, not a batch defect; the
test expectation was wrong (encoded a duration Bitwig won't keep). Fixed by
writing one distinct pitch per note. ⇒ **for snapshots/checkpoints: a written
note duration is not guaranteed to survive if another note follows on the same
pitch — readback is the source of truth (as everywhere in this spike), and a
checkpoint stores what `getStep` reports, never what was requested.**

### Decision impact → DECISIONS ("batch execution mechanics")

- **Batch execution model:** the executor sends **one `batch.run` request
  carrying N ops**, never N round-trips. Fast ops (note/param writes) run
  synchronously in one control-surface turn (232× the throughput); structural/
  device ops are **staged with `delayMs`** at their settle budget (~600ms device,
  ~144ms track, E3). The E2 two-turn write→verify rule applies once per batch.
- **Revision / optimistic concurrency:** a monotonic revision counter lives **on
  the executor**, thread-confined to the control-surface thread (no locking).
  Writes carry `ifRevision`; a mismatch **rejects the whole batch, applies
  nothing**. Acceptance bumps the revision so in-flight batches invalidate later
  stale submissions. This is the §8 stale-write guard, now demonstrated.
- **Progress UX:** interleave `showPopupNotification` ops into a paced batch —
  fires without stalling, no special machinery.
- **Async batch completion is an open Phase-1 build item** (not a blocker): the
  current Bridge writes a response on handler return, so a paced batch reports
  acceptance, not completion. A completion callback needs a deferred-response
  protocol. Verification today is by readback, which is the standing rule anyway.
- **Write-under-interference holds** — the pinned-cursor model is safe for
  optimistic apply while the user keeps editing. Combined with revision guarding,
  the two interference vectors (the user moves the selection; the user changes
  state we assumed) are both covered: pinning defeats the first, revision the
  second.
- **Note-duration is a readback-only fidelity fact** — same-pitch adjacency
  truncates; snapshot what `getStep` reports.

### Carry-forward

`ProbeHandlers.batchRun` (synchronous fast path + `delayMs` staged pacing, per-op
dispatch through the existing table + per-op error capture) and the `revision`
counter with `revision.get`/`revision.bump` + the `ifRevision` guard are
**Phase-1-quality infrastructure** — the batch executor is real Phase-1 code, not
a throwaway probe. Lift them; the only addition Phase 1 needs is (a) snapshot/
replay for revert composed on top (E3's primitive) and (b) the async-completion
protocol for paced batches.

---

## E7 — Modulators: author-by-template, drive-at-runtime (2026-07-19)

**Verdict: ◐→ author-by-template, drive-at-runtime, via a slot-bank.** Runtime
authoring of modulation is ○ (no create API; map idiom inert even foregrounded;
classic modulation-source API **uncallable**, throws at init). BUT modulation
baked into a template `.bwpreset` **materialises via `insertFile`, routing intact
and live — verified ● (E7b)**, the E4g pattern one level deeper, and the agent
then fully **reads/writes the modulator's own controls** at runtime via its
auto-created remote page (E7d ●) — including gating a route on/off by driving
`Amount` (0.839↔0.000). The two levers that would have given *arbitrary*
flexibility are both closed: **routing-target change** is unreachable in every
runtime state incl. foregrounded (E7f ○), and **modulator-type GUID substitution
fails** (unwired / page-less / "Missing" — E7e/g ○, unlike clean device
substitution E4g). ⇒ the shippable design is a **slot-bank template** (Finding H):
one fat per-device template with dormant pre-wired modulator slots the agent
switches on and tunes. Arbitrary-target routing is a sequenced-later binary
escape hatch. Probes `e07-modulators` / `e07b-modtemplate` / `e07c-modparams` /
`e07d-modtweak` / `e07e-modswap` / `e07f-routing` / `e07g-samefamily`. Resolves
§12 #6, the last ◐. Credit: the template + slot-bank path was opened by the user
pushing back on the initial "never author" ○ — the E4c→E4d single-mechanism
over-generalisation, caught again.

### Finding 0 — the classic ModulationSource API is UNCALLABLE (○, the headline)

The API sweep found `Device.getModulationSource(int)`, `Macro
.getModulationSource()`, `ModulationSource.{isMapped,isMapping,toggleIsMapping}`
and recorded §12 #6 as "partial surface exists." **That surface cannot be
touched from a modern controller extension.** A build that carried
`getModulationSource(i)` handles (created at init, like every other rig view)
**crashed the whole extension on load** with Bitwig's hard-deprecation guard:

> `ghostnote did something wrong — This has been deprecated since API version 2:
> Use remote controls instead`
> `DeviceProxy.getModulationSource → deprecatedFail` (BitwigStudio.log)

This is not a soft `@Deprecated` you can ignore: `deprecatedFail` **throws**,
`init()` aborts, and the bridge never binds. The interface docs corroborate the
redirect — `Macro` is `@Deprecated` ("Macros no longer exist as built in
features… the user can customize pages of controls"), and `ModulationSource`
itself is `@Deprecated`. ⇒ **the rig carries NO getModulationSource/Macro
handles**; doing so is a load-time crash, not a runtime no-op. Everything below
uses the surface Bitwig redirects to: **remote controls**.

⚠ **New gotcha class (worse than a silent no-op):** some API methods are
*fatally* deprecated — calling one at init takes the extension down with a user
popup. `getModulationSource`, `getMacro`, and the whole `ModulationSource`/
`Macro`/`RemoteControl(old)` mapping family are the known members. **Check for
`@Deprecated` on the javadoc interface/method before wiring any handle at
init** — a deprecated method here is a crash, not a warning. (Countermeasure
added to Method notes.)

### Finding A — remote controls are fully readable (●)

`Device.createCursorRemoteControlsPage(n)` + `RemoteControlsPage.getParameter(i)`
→ `RemoteControl` (which **extends `Parameter`**). On a freshly-inserted
Polysynth: **9 pages** (`OSC1, OSC2, MIX, FILTER, FILTER/EG, AMP, Envelope,
Common, Vibrato`), 8 remotes on page 0, each self-describing
(`[0]"Osc1Pitch"=0.500, [1]"Sync1"=0.000, …`). `pageCount`, `pageNames`,
`selectedPageIndex` all read. This is the modern macro/mod surface and it
enumerates cleanly, re-scoping as the cursor repoints (same pool model as E4).

### Finding A2 — the agent can DRIVE a remote control end to end (●)

`RemoteControl.value().setImmediately(v)` (it's a `Parameter`, so E4's
take-over rule applies). Writing remote[0] "Osc1Pitch" → 0.8 moved **both** the
remote (0.800) **and its pre-mapped device parameter `OSC1_PITCH` → 0.800**,
verified by reading the Polysynth param handle. ⇒ **remotes are a live control
surface**: any macro a user or a template has already wired, the agent can
turn. This is the **indirect route to modulation sound-design** — you don't
build the modulation graph, you drive the knobs it exposes.

### Finding B — `Parameter.modulatedValue()` works; the checkpoint lever (●)

`Parameter.modulatedValue()` returns a `RangedValue` (not deprecated) and reads
for every param handle. With no modulation, `value == modulatedValue` exactly
(0 divergence), and `modulatedValue` tracks a base-value write (F1FREQ→0.200,
mv=0.200). ⇒ **this is the checkpoint-fidelity lever for modulation:** a
modulated param reports `value` (the static base we can set/snapshot) separately
from `modulatedValue` (what is actually heard). Revert correctness reads the
base; "what's happening now" reads the modulated value. Pairs with E4's
`hasAutomation()` flag as the two "this param isn't holding a static write"
signals.

### Finding C — the map idiom is inert headless (○)

`RemoteControl.isBeingMapped()` is the modern "enter mapping mode, then touch a
target" idiom. `set(true)` is **accepted without error but does not take**:
`isBeingMappedBefore=false → isBeingMappedAfter=false`. Mapping mode won't even
*latch* from a background controller, let alone complete (completion needs a
real UI parameter touch). **Same focus dependency that made E6 named actions
inert** — creating a route programmatically is out of reach. Recorded, not
fought (per the timebox rule).

### Finding D — modulators cannot be CREATED (○)

No `insertModulator` API and no modulator-specific `InsertionPoint`. Swept
`insertFile(<abs .bwmodulator>)` at **every** device-chain insertion point —
track end-of-chain, `afterDeviceInsertionPoint`, `beforeDeviceInsertionPoint` —
with `LFO.bwmodulator` / `ADSR.bwmodulator`: **inert at all three** (chain
1→1, no change, no error). A `.bwmodulator` is not chain content, and there is
no insertion point that binds to a device's modulator slot. (Multi-mechanism
sweep per the no-false-negatives rule — this ○ is not a single-mechanism miss.)
⚠ **`.bwmodulator` files are binary-compressed** (`BtWg0003…` header, not the
readable TLV that `.bwpreset` uses), so the E3/E4 structured UUID harvest does
not apply to the standalone files.

### Finding D2 — template-borne modulation MATERIALISES (● E7b, verified)

Finding D's ○ is correct but **narrow**: it disproves *runtime* modulator
creation and *bare `.bwmodulator`* insertion. It does **not** disprove
modulation shipped inside a `.bwpreset` — and community tooling said that is
exactly where modulators live:

- **`jaxter184/bwEdit-Python`** — a Python editor for the binary preset/device
  format; its changelog reads *"Added support for modulators,"* and the UI
  shows an **atom graph** where you click a node to start a connection and wire
  it to another atom. ⇒ **modulators + their routing are atoms *inside* the
  `.bwpreset` payload**, not separate insertables. This is the same binary
  substrate E4f–E4g patch by GUID. (Its later *"Fixed FX chain atom (no longer
  crashes Bitwig)"* is the same host-crash warning E4f already flagged —
  malformed structural atoms crash the host, so editing modulator topology at
  the binary level is hazardous.)
- **`zezic/bitwig-device-hacks`** — hand-writes `.bwmodulator` files (Nitro DSP)
  and drops them into the **modulator *library folder***. Confirms modulators
  load as discrete file artifacts **via the library/browser, not a chain
  insertion point** — which is *why* Finding D's `insertFile(.bwmodulator)` was
  inert (wrong destination), not evidence modulators are unreachable.
- **`zezic/bitwig-whitelister`** — patches `bitwig.jar`; adjacent confirmation
  that device/modulator identity is **UUID-keyed** (as E4f/E4g found for
  devices). Not insertion evidence.

⇒ **Confirmed, mirroring E4d overturning E4c.** A user built a minimal template
(a Polysynth with an **LFO wired to Filter Frequency**) and saved it as a
preset — necessarily by hand, since there is **no save API** (E4f). Probe
`e07b-modtemplate` loaded it via `insertFile` and sampled the F1FREQ handle over
~1s:

| sample | base `value` | `modulatedValue` |
|---|---|---|
| 0 | 0.490 | 0.317 |
| 1 | 0.490 | 0.738 |
| 2 | 0.490 | 0.934 |
| 3 | 0.490 | 0.935 |
| 4 | 0.490 | 0.703 |
| 5 | 0.490 | 0.320 |

The base value sat **rock-still at 0.490** while `modulatedValue` swept a full
LFO cycle. ⇒ the modulator **materialised from the preset, its routing survived,
and it is live** — with zero modulation authored by us. The E4f–E4h "shape from
a template" pipeline extends to modulation; it does not stop at it.

**Bonus — this is the checkpoint model working on a real modulated param.** The
static base (0.490) is what a snapshot captures and a revert restores;
`modulatedValue` is what is heard. Finding B's claim is no longer hypothetical:
snapshot `value`, and treat a divergent `modulatedValue` as "this param is under
modulation, its static write is not the whole story."

⚠ **Authoring the routing at the BINARY level is still out of scope.** E7b used
a *whole* user-built preset, unedited. Editing modulator topology inside the
`.bwpreset` (adding/rewiring atoms à la bwEdit-Python) is the same undocumented,
host-crashing binary work E4f ruled out — templates come from a human saving
one, not from atom surgery. Whether per-modulator GUID substitution works like
per-device substitution (E4g) is untested — see the cardinality note in
Finding E.

### Finding E — a loaded modulator is READ+WRITE at runtime (● E7c/E7d)

The follow-up question: once a modulator materialises from a template, can the
agent reach the **modulator's own controls** (the LFO's rate/depth), or only the
modulated target? **Yes — via remote-control pages.** Probes `e07c-modparams`
(discovery) + `e07d-modtweak` (read+write).

- **Discovery (E7c):** the modulator's params do NOT appear in the device's
  DirectParameter tree (bare Polysynth 55 ids → modtest 55, delta 0). Instead,
  **adding a modulator adds a remote-controls PAGE named after it**: the bare
  Polysynth has 9 pages (`OSC1…Vibrato`); modtest has 10 — a new **`LFO`** page.
- **Read (E7d):** selecting the `LFO` page (by `selectedPageIndex`) re-scopes
  the rig's RemoteControl handles to the modulator's own controls:
  **`Rate=0.440, Timebase, Tilt, Curve, Delay, Fade-in, Mode, Amount=1.000`** —
  the LFO's full control set, self-describing.
- **Write (E7d):** `Rate` → 0.85 round-trips (it's a `Parameter`, so
  `setImmediately` applies). And driving **`Amount` → 0 collapsed the F1FREQ
  modulation sweep from 0.839 spread to 0.000** — writing the modulator's own
  control had the exact expected effect on the heard value.

⚠ **`selectNextPageMatching(expr, …)` did NOT land the page** from a string like
`"LFO"` (stayed on page 0, silently — another silent no-op). Selecting by
explicit `selectedPageIndex` after finding the name in `pageNames()` is the
reliable idiom.

⇒ **The SETTINGS axis of any modulator is fully runtime-addressable** through
its auto-created remote page. Load one template, then tweak rate/shape/depth/
amount live — no template-per-setting.

### Cardinality (the "N+1" question) — sized precisely

Given E7b (materialise) + E7d (tweak), the template-explosion concern shrinks to
three axes, only some of which need per-template variants:

| axis | covered at runtime? | cost |
|---|---|---|
| modulator **settings** (rate/shape/depth/amount…) | ● yes (E7d, remote page) | free — one template |
| modulator **type** (LFO↔Random↔ADSR) | ○ no | GUID substitution FAILS (E7e/g); **template variant per type** |
| routing **target** (filter↔pitch↔…) | ○ no (E7f: closed even foregrounded) | template variant, or hazardous atom edit |
| modulator **count** (add another) | ○ no (creation ○) | template variant, or hazardous atom edit |

So runtime driving removes the largest contributor (settings). The remaining
explosion is `type × target × count`, and the two levers that might have collapsed
it were **both probed and both closed** — see Findings F and G. What is left is
the **slot-bank template design** (Finding H).

### Finding F — a runtime routing-target angle does NOT exist (○, exhaustive)

Before accepting that changing a modulator's *target* needs binary work, swept
every remaining live angle (probe `e07f-routing`, + full-recall offline grep):

- **Offline recall** (`member-search-index`, all 25 API versions + `new-list`):
  no route-creating member anywhere — only the dead `ModulationSource` mapping
  family and hardware-binding (`addBinding*`, which maps *hardware controls*, not
  modulation sources). Notably `bitwig.jar` *does* carry internal
  `ModulatorInsertionPoint` / `clipboard/modulator` classes — **Bitwig has the
  concept and does not export it.**
- **Named actions**: `map`→1 (`toggle_mappings_browser_panel`, a panel toggle),
  `learn`→1 (`show_online_learning`, docs), `modulat`/`assign`→0. Nothing that
  creates a route, and E6 already disqualified actions anyway.
- **The mapping gesture headless**: `RemoteControl.isBeingMapped().set(true)` →
  stays `false` (won't latch); `Parameter.touch(true)` + write + release forms
  no route; driving the remote after does not move the target.
- **The mapping gesture FOREGROUNDED** (user brought Bitwig frontmost — the E6
  escape that revived global actions): **still inert.** `isBeingMapped` still
  won't latch; no route forms. This is *stronger* than E6 — foreground did not
  help at all. ⇒ modulation-routing creation is closed in every runtime state.

### Finding G — modulator GUID substitution does NOT work (○, overturns the E4g-analog hope)

The device-identity swap that worked cleanly for *devices* (E4g) **fails for
modulators.** Probes `e07e-modswap` + `e07g-samefamily`, with UUIDs harvested by
diffing two user templates (modtest = Polysynth+LFO; modzoo = Polysynth+Classic
LFO+Random; the exclusive UUIDs are the modulators, confirmed by loading modzoo
and reading its `Classic LFO`/`Random` remote pages). Patched modtest's LFO GUID
(`ad947004`, single binary occurrence, length-preserving) to three targets:

| swapped-in GUID | is | result |
|---|---|---|
| `ca8cc421` (Polysynth built-in Vibrato) | internal | materialises ("Vibrato 2" page) but **route DROPS** — dead even with a note held + Rate/Amount driven |
| `dcacb71b` (Polysynth built-in) | internal | **page-less**, no modulation |
| `39f4b136` (Classic LFO) | external modulator | **"Missing"** — unloadable, though it loads fine in its own preset |

Three targets, three distinct failure modes — never a clean wired type-swap.
**Why it differs from E4g:** a device's identity *is* its GUID, so a swap is
total; a modulator instance additionally carries **type-specific payload +
routing atoms**, and a bare 16-byte GUID swap leaves that payload describing the
old type — so Bitwig loads it unwired (internal type it can reconcile), page-less,
or "Missing" (external type whose payload it can't find). ⇒ **the type axis
cannot be collapsed by substitution; each modulator type needs its own template
(or slot).** (Failures were graceful — unwired / page-less / "Missing", never a
crash — which still supports the substitution-class risk read; it just doesn't
*work* for modulators.)

### Finding H — the slot-bank template design (the practical answer to N+1)

Given F (no runtime routing) + G (no type substitution) + E7d (Amount gates a
route: 0.839↔0.000) + E7b (templates carry live routing), the flexible-but-safe
construction is a **fat template per device with a bank of dormant modulator
slots**:

- Ship one template per device carrying **N×M pre-wired modulators**: for each
  of N curated targets (filter, pitch, amp…) × M types (LFO, Random, ADSR…), a
  real modulator wired to that target with **`Amount = 0`** (dormant, inaudible).
- **Runtime "add an LFO to the filter"** = find the (LFO→filter) slot, set its
  `Amount > 0`, then drive rate/shape live (all proven in E7d). "Remove" = Amount
  back to 0. "Swap LFO for Random on the filter" = Amount-down the LFO slot,
  Amount-up the Random slot.
- This moves the explosion **from template-count to slot-count inside one
  template** — and a device holds many modulators cheaply, so it is tractable.
  One human-authored template per device covers its whole curated modulation
  matrix; no per-combination presets, no binary editing.
- **Residual:** the target set is **curated, not arbitrary** — only the N targets
  pre-wired in the template can be modulated. Reaching an *arbitrary* device
  param as a target still requires binary topology surgery (add a connection
  atom), which stays the **sequenced-later escape hatch** — genuinely hazardous
  (novel structure, the crash-prone end of E4f/bwEdit-Python) and only worth it
  if the curated-target set proves too limiting in practice.

⚠ **On the host-crash risk (re-evaluated):** the danger is not uniform. E4g
proved *length-preserving, structurally-valid substitution* (device GUID swap)
loads cleanly, and G confirms modulator GUID swaps also **fail gracefully, never
crash**. The crashes bwEdit-Python fixed were *structural* atom edits (FX-chain
atoms) — the topology end, which is exactly what arbitrary-target routing would
require. Also note Bitwig's "isolation" improvements are about **plugin**
sandboxing (VST/CLAP in a separate process); a malformed native `.bwpreset` is
parsed by Bitwig's **own** deserialiser, which those improvements do not protect
— so "Bitwig got better at isolation" does not de-risk native-format surgery.
Risk tracks *how far the edit deviates from a valid structure*: value/GUID
substitution ≈ safe (but ineffective for modulators); new topology ≈ crash-prone.

### The modulation capability map (settles §6 device matrix, was ◐/unknown)

| capability | verdict | mechanism |
|---|---|---|
| read a param's post-modulation value | ● | `Parameter.modulatedValue()` |
| read remote-control pages (name/value) | ● | `createCursorRemoteControlsPage` |
| **drive** a wired remote/macro | ● | `RemoteControl.value().setImmediately` |
| read/write a loaded modulator's OWN controls | ● | its auto-created remote page (E7d) |
| read a device's modulators via typed API | ○ | `getModulationSource` deprecated-uncallable |
| create a modulator at RUNTIME | ○ | no API; `insertFile(.bwmodulator)` inert |
| author a modulation routing at RUNTIME | ○ | map idiom inert headless |
| ship modulation in a template `.bwpreset` | ● | materialises live via `insertFile`, routing intact (E7b) |
| vary a templated modulator's settings | ● | remote-page writes (E7d) — no per-setting template |
| gate a templated route on/off at runtime | ● | drive its `Amount` to 0 / up (E7d/H) — the slot-bank lever |
| swap a templated modulator's TYPE by GUID | ○ | fails: unwired / page-less / "Missing" (E7e/g) |
| change a routing TARGET at runtime | ○ | closed even foregrounded (E7f) |
| edit modulation topology (target/count) in binary | ○ | undocumented, host-crashing (E4f); sequenced-later escape hatch |

### Decision impact → DECISIONS

- **Modulation is author-by-template, drive-at-runtime** — the same posture as
  structure (E4d–E4h). The agent cannot add modulators or draw routes at
  runtime, but a template `.bwpreset` a human built once carries the modulators
  AND their routing, materialises live via `insertFile` (E7b ●), and the agent
  then drives it (remotes, `modulatedValue` readback, param writes). Rank
  *runtime authoring* out of scope; rank *modulated templates + driving them* IN
  as a Phase-2 capability. Ship a template library that includes
  modulator-bearing patches, not just device/param shapes.
- **Adopt the slot-bank template design for modulation flexibility (Finding H).**
  Neither runtime routing (F) nor GUID type-substitution (G) works, so the way to
  avoid a template-per-combination explosion is **one fat template per device
  with a bank of dormant (`Amount=0`) modulator slots**, each pre-wired to a
  curated target×type. Runtime selects/deselects by driving `Amount`, then tunes
  rate/shape live. Target set is **curated, not arbitrary**; arbitrary-target
  routing stays a **sequenced-later binary-topology escape hatch** (hazardous,
  the crash-prone end — only if curation proves too limiting).
- **`modulatedValue` is a required checkpoint field, not optional.** E7b proved a
  modulated param's base `value` and heard `modulatedValue` genuinely diverge
  (base pinned at 0.490 while the heard value swept a full LFO cycle). Snapshot
  the base; flag divergence (with `hasAutomation()`, E4) as "static write ≠ what
  is heard."
- **Reinforces the templating posture (E4f–E4h).** As with layer construction,
  the modulation graph is **user/template-authored, agent-driven**: ship
  templates whose modulators are pre-wired to remote controls, and the agent
  drives the remotes. A "make an LFO wobble the filter" tool would be
  undeliverable from the API; "turn the wobble macro this patch exposes" is a
  parameter write.
- **Checkpoint model gains `modulatedValue`.** Snapshot/restore the *base*
  `value`; a divergent `modulatedValue` (or `hasAutomation()`, E4) flags a param
  whose static write won't be what's heard — surface it, don't silently trust
  the base.
- **Escape-hatch tally, with E6:** first named actions (○, hazardous), now
  modulator authoring (○). The typed API is the whole toolbox; where it has no
  primitive, the answer is templates + driving, not a back door.
- **Carry-forward:** the remote-controls apparatus (`createCursorRemoteControlsPage`
  + `RemoteControl` handles, `remote.list`/`remote.set`) and the
  `param.modulatedValue` readback are Phase-1-quality; lift them. The
  `getModulationSource`/`Macro` path is a **do-not-touch** landmine.

---

## E6 — Named actions: unusable AND hazardous (2026-07-19)

**Verdict: ○ the named-action escape hatch is unavailable to a background
agent, and actively dangerous.** `Application.getActions()` exposes 781
actions, but invoking them from a controller extension is GUI-state
dependent, unverifiable, and — for the useful ones — operates on the exact
selection our own addressing manipulates. Probe `e06` + diagnostics
`e06-diag2/3/4/6/7`. Reduced-urgency experiment; the answer is a clean "don't."

### The surface

781 actions in 20 categories; ~264 are pure view/panel/zoom/focus ops
irrelevant to a headless agent. Typed APIs already cover the compositional
verbs (duplicateObject/deleteObject/insertFile/param writes). The genuine
**no-typed-API residual** is small: **`Group`/`Ungroup`** (track grouping —
confirmed no typed `createGroup`; only `isGroup()`/`navigateIntoTrackGroup`
exist) and **`wrap`/`unwrap`** (automation-clip conversion).

### Why they don't work for us — the behavioural model

`invoke()` resolves the action and returns cleanly (the bridge path is fine —
`resolvedName` confirms the right action), but EFFECT depends on GUI state:

- **Global actions need Bitwig to be the FOREGROUND OS app.** `Create Scene`
  bumped the scene count 9→10 when the user held Bitwig frontmost (diag3);
  backgrounded, it was a silent no-op while typed `scene.create` worked on
  identical state (diag2). Same for the `Undo` action vs typed `app.undo`.
- **Editing actions additionally dispatch against PANEL keyboard focus**,
  which the controller API cannot set. `ClipLauncherSlot.select()` sets object
  selection (Bitwig's own `isSelected` observer fires) but NOT panel focus, so
  `Duplicate` on a selected clip does nothing — even foregrounded (diag3). It
  duplicated the clip only after a `focus_or_toggle_clip_launcher` action was
  invoked first (diag4). A background agent can satisfy neither precondition.

### The hazard — actions clobber the selection our addressing sets

The decisive finding. With a **track** selected and no clip-panel focus,
foregrounded `Duplicate` duplicates the **whole track** (diag7: gn-A → a
second "gn-A" at the next index). And **our addressing selects the track it
points at** — `cursorTrack.selectChannel(track)` (E1) sets the UI selection
as a side effect. So invoking `Duplicate` while a pool cursor is active
**duplicated the gn-A fixture**, silently, and unpinned the cursor.

Over this experiment's foreground diagnostic runs it created **7 orphan gn-A
duplicates** before the mechanism was understood (cleaned up by channelId,
E2f). A pure view action (a zoom) is harmless to a pinned cursor (probe phase
D), so the danger is specifically **state-changing actions firing against a
selection we did not intend them to see** — and our infrastructure is
constantly setting that selection.

### Checkpoint implication

`invoke()` returns `void` and an inapplicable action is a silent no-op (no
throw). Actions therefore carry **zero readback** — an executor could never
confirm what one did, on top of not controlling whether it fires. That is
disqualifying for the optimistic-apply + verify model (§8c).

### Decision impact → DECISIONS

- **Policy: ghostnote does not use named actions.** They need foreground +
  panel focus a background agent cannot assume, return nothing to verify, and
  operate on the UI selection our own pointing mechanism sets — a corruption
  risk against our infrastructure tracks. Rely exclusively on typed APIs.
- **The no-typed-API residual (track Group/Ungroup, automation wrap/unwrap)
  is an accepted capability gap.** It is organisational/automation-plumbing,
  not compositional; forgoing it is cheap. Revisit only if a concrete need
  appears, and even then not via `getActions()`.
- **New rule reinforced:** because pointing a cursor selects its track,
  *nothing* in the executor should ever invoke a selection-consuming action.
  This also flags that our pointing borrows UI selection (the E1 wart) has a
  sharper consequence than cosmetic — it is why an action would hit the wrong
  target.
- Escape-hatch verdict for §12: **there is effectively no action-based escape
  hatch.** The typed API surface (E1–E4h) is the whole toolbox; where it has
  no primitive (multi-layer authoring, grouping), the answer is templates
  (E4f–E4h) or "out of scope", not actions.

---

## E4h — Templates as repo assets, not Library entries (2026-07-19)

**Verdict: ● presets can ship with the project.** The Bitwig Library is not
involved: `insertFile` takes any filesystem path, and after loading, the file
is no longer referenced. Probe `e04h`, all green.

| test | result |
|---|---|
| absolute path to a repo asset | ● loads all 4 chains |
| **relative path** | ○ **does not load** |
| spaces, em dash, parentheses in path | ● fine |
| **non-`.bwpreset` extension** | ○ **does not load** |
| missing file | ○ silent no-op, no error |
| **file deleted after loading** | ● structure + devices unaffected |

### The two operational rules

- **Paths must be ABSOLUTE.** The extension runs inside Bitwig, so a relative
  path resolves against *Bitwig's* working directory, not the brain's. The
  brain must resolve repo-relative asset paths before they cross the bridge.
- **The `.bwpreset` extension is REQUIRED.** Bitwig dispatches on the
  filename, not the content — byte-identical data named `.template` is
  ignored. Repo assets must keep the extension.

Both failure modes are **silent**, as is a missing file: `insertFile` gives
no negative acknowledgement, matching the documented *"some things may not
make sense to insert… nothing happens"* semantics. ⇒ every insert must be
confirmed by reading back the resulting chain contents.

### Presets are a build-time asset, not a runtime dependency

After `insertFile`, the preset file was **deleted** and the loaded structure
was unaffected — all four chains intact, devices still live (55 params
enumerated, writable). `insertFile` copies content into the project; nothing
retains a reference.

⇒ **templates belong in the repo** (e.g. `assets/presets/*.bwpreset`),
version-controlled alongside the code, with no dependency on the user's
Bitwig Library and no install step. They are inputs to a build, not
installed content.

⚠ **Caveat:** verified in-session only. A project save + reload would confirm
it fully, and **sample-bearing** presets are the case to watch — a Sampler
chain may *reference* audio files rather than embed them, which would
reintroduce an external dependency the structural devices do not have.

### Decision impact

- **Ship templates in-repo**; no Library installation, no user setup beyond
  the one-time authoring of each shape.
- **Contract/executor:** absolute paths only; assert the `.bwpreset`
  extension at the tool boundary (a wrong name fails silently otherwise);
  verify every insert by chain readback.
- Revisit embedding vs. referencing if a template ever contains samples.

---

## E4g — Per-layer substitution VERIFIED on a 4-chain template (2026-07-19)

**Verdict: ● parameterised multi-layer construction works.** E4f's one
outstanding inference is now a measured result. Probe `e04g`, all green,
against a template the user built by hand (an Instrument Layer with
Phase-4 / Polysynth / Organ / Sampler) — the only way to obtain one, since
there is no save API.

### Template anatomy

Each device's identity appears **exactly once** as a raw 16-byte GUID, at a
distinct offset, with the container first:

| offset | device | role |
|---|---|---|
| 6 346 | Instrument Layer | container |
| 8 023 | Phase-4 | chain 1 |
| 14 312 | Polysynth | chain 2 |
| 19 014 | Organ | chain 3 |
| 22 174 | Sampler | chain 4 |

25 011 bytes for a 4-chain instrument stack — templates are small.

### Results

- **The untouched template instantiates all four chains in one
  `insertFile` call**, each holding the device the user placed there.
- **Single swap (Organ → Polymer): only that chain changed.**
  `[Phase-4, Polysynth, Organ, Sampler]` → `[Phase-4, Polysynth, Polymer,
  Sampler]`. The other three chains were untouched. **This is the result the
  whole templating story rested on.**
- **Double swap (Phase-4 → Polymer, Sampler → Polysynth) in one file:** both
  changed independently, the untouched Organ chain survived →
  `[Polymer, Polysynth, Organ, Polysynth]`.
- **The substituted device is live at depth:** descended into the patched
  chain, `isNested=true`, 7 direct params enumerated, and a write landed
  (`CONTENTS/OUTPUT` → 0.25).
- **Stale ASCII metadata is ignored.** Only the binary GUID was patched;
  `referenced_device_ids` still named Organ and instantiation was unaffected.
  ⇒ that metadata is not consulted when loading — patching the binary GUID
  alone is sufficient and correct. (E4f gate 3's trap stands: patching *only*
  the ASCII does nothing.)

### The construction pipeline, now fully evidenced

1. **Shape** — instantiate a template preset via `insertFile` (any path, no
   Library registration needed; E4f gates 1–2).
2. **Devices** — patch per-chain binary GUIDs, one occurrence each,
   length-preserving so no offsets shift (E4g).
3. **State** — set every parameter through the param API (E4/E4b), at depth
   via `selectFirstInLayer` (E4c). The preset's stored state is irrelevant.

A template is needed **per shape** (a 4-chain stack, a 3-chain stack…), not
per sound. Shapes are few and small; devices and parameters are the varying
part and both are now parameterisable.

### Decision impact

- **"Boring setup" is a solved problem** for layer containers, via templates
  rather than the absent create-layer API. Promote it to a Phase-2
  deliverable with a known implementation path.
- **Ship a template library** — a handful of hand-built shapes, plus a GUID
  substitution helper and a device-UUID catalog (already harvestable, E4/E4d).
- **Always verify the loaded structure by readback** (chain contents by
  name), as everywhere else in this spike — substitution failures are silent.
- Bootstrapping templates requires a human once per shape; that is a
  one-time setup cost, not a per-use one.

---

## E4f — Can presets be SYNTHESISED at runtime? (2026-07-19)

**Verdict: ◐ parameterised construction from templates is viable; synthesis
of novel shapes is not.** Asked whether `insertFile` can build arbitrary
layer structures on the fly with no presets prepared in advance. Five gates,
probe `e04f`. The answer is meaningfully better than "ship a preset library"
but short of "generate anything".

### The format

`.bwpreset` is `BtWg` magic + a tag/length/value record stream with readable
field names (`device_id`, `device_name`, `referenced_device_ids`,
`preset_category`). Structural presets are small (FX Layer default 6.6KB);
sample-bearing ones reach megabytes (a user Drum Machine preset: 5MB).

### The gates

| gate | question | result |
|---|---|---|
| 1 | does `insertFile` accept an arbitrary path? | ● loads from the app bundle |
| 2 | does an unregistered copy in `/tmp` load? | ● **files are the unit, not Library entries** |
| 3 | does patching the ASCII UUID swap the device? | ○ **silently loads the ORIGINAL** |
| 4 | does patching the binary GUID swap it? | ● **loads the substituted device** |
| 5 | is the substituted device functional? | ● enumerates + accepts param writes |

- **Gates 1–2 are the enabling result:** the agent can **write a file at
  runtime, anywhere on disk, and load it**. Presets need not pre-exist in
  the Library.
- **Gate 3 is a new trap.** A preset carries the device UUID **twice in
  ASCII** (`device_id`, `referenced_device_ids`) — both metadata — and
  **once as a raw 16-byte big-endian GUID**, which is the real identity.
  Patching only the ASCII copies loads the **original** device with no error:
  a silent wrong-result, not a failure.
- **Gate 4:** patching the binary GUID (length-preserving, no offsets shift)
  makes Bitwig load the substituted device. Identity is parameterisable.
- **Gate 5 is what makes it useful:** the substituted device is **live** —
  it enumerates its own params via DirectParameter and accepts writes
  (`CONTENTS/OUTPUT` → 0.25). It reported only 7 params, i.e. it loaded in a
  near-default state rather than faithfully inheriting the donor's payload —
  **which does not matter**, because state can be set through the API.

⇒ **The pipeline: take the SHAPE from a template preset, substitute device
identities by GUID, then set every parameter via E4/E4b.** The preset only
has to be structurally valid; its stored state is irrelevant.

### What is still out of reach

- **No save/export API.** Only `Device.loadPreset(int)` and the browser
  exist. The agent can never **capture** a structure it or the user built, so
  every template must originate from a human saving one in the UI (or from
  synthesis).
- **Novel shapes require real format work.** Changing a template's *topology*
  — going from a 2-layer to a 5-layer container — means splicing TLV chain
  blocks in an undocumented binary format. Prior art exists but is partial
  and explicitly hazardous: bwEdit-Python's changelog records fixing an
  "FX chain atom (**no longer crashes Bitwig**)". Treat host crashes as the
  expected failure mode of malformed structures.
- ⇒ a **finite template library, one per shape** (2/3/4-layer, etc.), covers
  the realistic space cheaply. Shapes are few; device choices and parameters
  are the varying part, and both are parameterisable.

### ⚠ Limit of this evidence — NOW CLOSED by E4g

E4f could only prove substitution on a **single-device** preset and inferred
the multi-layer case. **E4g verified it directly** against a user-built
4-chain template: per-layer devices are independently swappable. The
inference was correct; see E4g below.

### Decision impact

- **Phase 1/2:** ship a small template library + a GUID-substitution helper;
  never attempt from-scratch preset synthesis.
- **Contract:** structure creation for layer containers is "instantiate a
  known shape, then configure", not "compose arbitrary topology".
- **New trap for the gotcha list:** ASCII-only UUID patching silently loads
  the wrong device — patch the binary GUID, and always verify the loaded
  device's name (readback, as everywhere else in this spike).

---

## E4d — Chain CREATION: E4c's ○ was WRONG (2026-07-19)

**Verdict: ● complex device structures CAN be built programmatically — via
drum pads and via preset files.** E4c concluded "layers can be filled and
navigated but never created" from a single mechanism. Challenged, swept
properly, and **overturned**. Probe `e04d` (all green) + `e04d-diag`.
**Third false negative of this spike from a single-mechanism check** (after
CLAP params and channelId) — the pattern is now undeniable, see Method.

### Seven routes tested; three work

| # | route | result |
|---|---|---|
| 1 | `DeviceLayer.duplicateObject()` | ✗ silent no-op — ⚠ **still ○** (e17am, exhausted) |
| 2 | `DeviceLayer.duplicate()` (as Channel) | ⚠⚠ **OVERTURNED — see E17 `e17ak`.** `Channel.duplicate()` creates a chain; it needed the chain SELECTED, which `layer.select` does |
| 3 | `InsertionPoint.copyDevices()` into a layer | ⚠⚠ **OVERTURNED — see E18d.** It works, from a top-level source AND a nested one. The move sibling was overturned first (E16n); this is the same false negative |
| 4 | **`InsertionPoint.insertFile(preset)`** | **● 12-pad structure in 268ms** |
| 5 | **`DrumPad.insertionPoint().insertBitwigDevice()`** | **● creates chains** |
| 6 | **`Device.duplicateObject()` on a container** | **● clones WITH contents** |
| 7 | named actions (`getActions()`, 781 of them) | ✗ none create chains |

### ROUTE 5 — drum pads are fully buildable AND addressable

**`DrumPad` has its own `insertionPoint()` that `DeviceLayer` lacks** — that
asymmetry is the whole story. Inserting into an *empty* pad **creates the
chain**: a fresh Drum Machine reports 0 pads, and pads appear as they are
filled (0→1→2, built entirely programmatically, no UI).

Addressing into them works too, with a gotcha:
- **`selectFirstInChannel(drumPadBank.getItemAt(i))` is the right idiom** —
  `DrumPad` is a `Channel`, so the same call used for tracks works. Verified
  on pads 0 and 3: cursor lands on the nested device, **14/16 params resolve**.
- ⚠ **`selectFirstInKeyPad(n)` takes a MIDI KEY, not a pad index.** Key 36
  (C1) = pad 0; passing `0` silently leaves the cursor on the Drum Machine
  (another silent no-op). Verified across keys 0/36/60 in `e04d-diag`.

⇒ **"Build me a drum kit with N chains, each with its own devices and
routing" is fully in reach.**

### ROUTE 4 — insertFile materialises arbitrary structure in one call

`insertFile()` with a `.bwpreset` loaded a 12-pad Drum Machine — a complete
multi-chain structure with all its devices and routing — **in 268ms, one
call**. This is the general escape hatch for *any* complex structure,
including the ones with no creation API: build it once in the UI, save it,
and the agent can materialise it thereafter. Presets are ordinary files, so a
library of them is a shippable asset.

### ROUTE 6 — containers duplicate wholesale

`Device.duplicateObject()` on a populated FX Layer produced a second FX Layer
**carrying its nested contents** (1 layer, 1 device inside). So an existing
structure can be replicated even where it cannot be authored from scratch.

### The residual gap (genuine, but much narrower than E4c claimed)

What remains impossible: **adding a layer to a layer-type container.**
FX Layer ships with exactly one chain and will not grow; Instrument Layer,
Note FX Layer and the Selectors ship with **zero** and cannot be seeded — no
duplicate, copy, or insert route reaches them, and no named action exists.
So a *multi-layer instrument stack* still cannot be authored from nothing.

### Why — the architectural reason (E4e; positive, not just empirical)

Challenged to prove this is a real API gap rather than another missed
surface, five independent lines of evidence converge, and they explain
*why* rather than merely restating the observation:

1. **Primary source — the Bitwig user guide** states the design difference
   outright. Drum Machine: *"Corresponding with the 128 possible MIDI notes,
   Drum Machine offers up to 128 device chains, each called a drum chain."*
   Instrument Layer: *"there is only one Add Device button in the main
   interface of Instrument Layer, with each added device being placed on a
   **newly created** instrument chain."*
   ⇒ **Drum chains are a fixed, pre-addressable grid indexed by MIDI note;
   layer chains have no predetermined slots and come into existence only as
   a side effect of adding a device.**
2. **That is exactly why the API can offer one and not the other.** An
   `InsertionPoint` must bind to a referent. Pad 36 is well-defined while
   empty, so `DrumPad.insertionPoint()` — javadoc: *"InsertionPoint that can
   be used to insert content in this drum pad"* — is meaningful. "Layer 3"
   has no referent until it exists, so there is nothing to hand back.
3. **Version history shows deliberateness, not oversight.**
   `DrumPad.insertionPoint()` was added at **API v7** to a v1 class — a
   targeted addition. Through **v25**, `DeviceLayer` (v1) still has no
   equivalent. Bitwig also added creating-insertion-points where a referent
   exists (`nextSceneInsertionPoint`), so the pattern is consistent.
4. **The javadoc documents our silent no-op as intended behaviour:**
   InsertionPoint inserts *"as if the user had dragged and dropped them to
   this insertion point… **Some things may not make sense to insert in which
   case nothing happens**."* The no-op is specified, not a bug.
5. **Ecosystem corroboration.** DrivenByMoss — the most comprehensive Bitwig
   extension in existence — exposes only read/navigate/select in its
   `LayerImpl`/`LayerBankImpl`; no creation path, no workaround comment.

**Coverage is now exhaustive (E4e).** Every `InsertionPoint` source in the
API has been exercised. The last two, `before`/`afterDeviceInsertionPoint`
anchored on a device *inside* a layer, add to that layer's **own chain**
(1→2→3 devices) and never spawn a sibling layer.

**Honest limit of this evidence:** no Bitwig document or forum post says
"the API cannot create device layers" in so many words. What exists is a
documented architectural reason plus converging structural evidence. This is
a **reasoned negative**, the strongest available — not merely an empirical
one, and no longer a bare "we tried and it didn't work".

**But the use case is not blocked**, because: drum machines cover multi-chain
construction natively (route 5), and any layer structure can be materialised
from a saved preset (route 4) and then duplicated (route 6) and driven at
depth (E4c). The practical Phase-1 posture is **a preset library + drum-pad
construction**, not "structure creation is unavailable".

### Decision impact (supersedes E4c's ○)

- **Chain construction is IN scope.** Rank it as a viable Phase-2 capability,
  not a blocked one. The boring-setup use case is served.
- **Ship a preset library.** `insertFile` turns "complex routing" into a data
  problem; presets are the unit of reusable structure.
- **Drum pads are the native multi-chain primitive** — prefer a Drum Machine
  over an Instrument Layer whenever the agent must *build* N chains. This is
  not a workaround but a consequence of the design: pads are addressable
  slots, layers are not.
- **Layer-type containers are user-authored, agent-driven.** The contract
  should express "work inside the structure you find" for layers, and
  "build the structure" only for drum machines and preset instantiation.
  A tool that promises to construct instrument layers would be undeliverable.
- **Pad addressing = `selectFirstInChannel(pad)`**, never `selectFirstInKeyPad`
  with an index.
- Named actions (781) contain **nothing** for chain creation — one less reason
  to reach for the escape hatch (feeds E6).

---

## E4c — Device nesting: layers, pads, slots, selectors (2026-07-19)

> **⚠ AMENDED BY E4d:** this section's "nesting structure cannot be CREATED"
> conclusion is **WRONG** — it tested one mechanism. Drum pads, `insertFile`
> and container duplication all create structure. The claim that survives is
> narrower: *layer-type containers* cannot grow new layers. Read with E4d.
> The Drum Machine claim below is also wrong — see the correction there.

**Verdict: ◐ nested devices can be NAVIGATED and DRIVEN perfectly; creation
is possible by routes this experiment did not test (see E4d).**
Probes `e04c` (all green) + `e04c-diag` / `e04c-diag2` (the controlled trials
that corrected the first run's expectations).

### Four mechanisms, not one

The plan said "device layers". The API actually has four distinct nesting
surfaces, and a device advertises which it offers:

| device | hasLayers | layers shipped | hasDrumPads | slotNames |
|---|---|---|---|---|
| Polysynth (flat) | false | 0 | false | FX, Note FX |
| **FX Layer** | true | **1** | false | — |
| Note FX Layer | true | **0** | false | — |
| Instrument Layer | true | **0** | false | FX |
| Instrument Selector | true | 0 (+ChainSelector, chainCount=1) | false | FX |

### The headline: E4's param apparatus works at depth, unchanged

`CursorDevice.selectFirstInLayer(0)` moves **the same device cursor** into the
nested chain, and every E4 handle follows it down:

- cursor `"FX Layer"` → `selectFirstInLayer(0)` → cursor `"Polysynth"`,
  **14/16 param handles resolve**, self-describing exactly as at top level
  (`F1FREQ="Filter Frequency"=2.59 kHz`).
- **Writes land at depth**: `F1FREQ` → 0.200, displayed "50.6 Hz".
- `isNested()` correctly flips true for the nested device.
- **Nesting is real**: the top-level chain still reports only the container.
- **The model is RECURSIVE** — FX Layer inside FX Layer, descend twice, and
  params still resolve 14/16 at depth 2. The layer bank **re-scopes to
  whatever the cursor points at**, so one pre-allocated bank serves every
  depth. ⇒ **deep device addressing needs no new machinery** — E4's pool +
  repoint model extends downward for free.
- Insert into a layer via `DeviceLayer.endOfDeviceChainInsertionPoint()`
  (DeviceLayer *is* a DeviceChain), ~143ms — same budget as a top-level
  insert. A layer **renames itself after its content** ("Layer 1" →
  "Polysynth"), so layer names are not stable identifiers.

### The gap: layers cannot be created (○)

There is **no create-layer API**. `Device` offers `createLayerBank` /
`createCursorLayer` — *views*, not constructors. Consequences, all confirmed
by controlled trial (`e04c-diag2`):

- **FX Layer ships with exactly one chain.** Inserting at layerIndex 1 or 2
  **silently no-ops** — no error, no new layer, count stays 1.
- **Note FX Layer / Instrument Layer / Instrument Selector ship with ZERO
  chains**, so they cannot be populated programmatically *at all*. The
  container inserts fine and reports `hasLayers=true`, and every insert into
  it vanishes silently.
- ⇒ **`hasLayers=true` does NOT imply a layer exists.** Check the layer
  bank's count, never the capability flag.
- ⇒ Programmatic multi-layer construction (build an Instrument Layer with 3
  layered synths) is **out of reach**; only single-chain FX Layer is
  drivable. Deep work is limited to structures the *user* built.

### Silent no-op traps (the E2 family, now three members)

Both new traps are invisible without readback — same shape as E2's empty-slot
clip trap and E4's swallowed `set()`:

- **Inserting into a non-existent layer index** — no error, nothing happens.
- **`selectFirstInSlot("FX")` on an EMPTY slot** leaves the cursor exactly
  where it was (`exists=true`, same name, `isNested=false`), looking healthy.
- ⇒ reinforces the standing rule: **verify the cursor's target before every
  write**; a mis-descend is undetectable from the cursor's own state.

### Not verified: drum pads — ⚠ AND THE STATED REASON WAS FALSE

E4c recorded that **"Drum Machine has no `Default.bwpreset` in the app
bundle"** and concluded the offline catalog harvest was incomplete. **Both
claims are wrong.** Drum Machine is present:
`8ea97e45-0255-40fd-bc7e-94419741e9d1`, and it loads.

**Root cause of the miss — a genuinely nasty search trap.** Preset files
store names as `<length-byte><name>`. macOS `strings` strips the length byte
only when it is non-printable; `0x0C` (form feed) survives. So a device whose
name is **exactly 12 characters** emits `\fDrum Machine`, and an anchored
grep for `^Drum Machine$` silently fails. Exactly **7 of 151** devices are
affected — every one with a 12-character name:

> Drum Machine · Freq Shifter · HW Clock Out · Note Repeats · Oscilloscope ·
> Peak Limiter · Stereo Split

(The tell was visible and ignored: "Stereo Split" sorted out of alphabetical
order in the container dump, because of its invisible prefix.)

**Correct harvest method:** extract the structured field —
`strings f | grep -A1 '^device_name$' | sed -n 2p | tr -d '\f'` — never grep
for an anchored name. The catalog **is** complete (151 devices with presets);
E3/E4's claim stands and the "hole" recorded here did not exist.

Drum pad *behaviour* is now verified in **E4d** (pads are creatable and
addressable).

### Decision impact

- **Phase 2 ranking:** deep device work (drum pads, layered synths) is
  **read/drive-capable but not build-capable**. Sound-design *into* existing
  user-built layers is viable and cheap; "construct me a layered patch" is
  not. Rank direct-param sound design above structural device building.
- **Param model:** unchanged and validated at depth — one cursor-device pool
  covers arbitrary nesting. No per-depth allocation.
- **Addressing:** layer *names* are content-derived and unstable; address
  layers by index within the cursor's current scope, and re-verify after any
  descend. (No layer equivalent of `channelId` was found — worth the same
  stable-id question in Phase 1 that E2f settled for tracks.)
- **Catalog (§6a):** the bundle harvest is incomplete; the catalog builder
  needs a fallback for devices with no preset (browser enumeration, E6).

---

## E5 — Scale limits (§12 #5, the last open question) (2026-07-19)

**Verdict: ● no knee exists in any plausible range — pre-allocation is far
cheaper than §3a feared, and the binding constraint is not performance but
the bank WINDOW.** Probes `e05` (12-config sweep) + `e05b` (re-measured
against a populated 54-track / 387-clip project). All checks green.

### Method: config-driven sizes + hot-reload

`Rig`'s sizes moved from `static final` constants to `RigConfig`, loaded at
init from `~/.ghostnote/rig.json`. The sweep writes a config, forces a
re-init, and re-measures — no rebuild per data point. Each config carries a
`stamp` echoed by `rig.stats`, so the probe can prove it is talking to the
**new** init rather than a bridge that never went down.

- **⚠ `touch` does NOT trigger the hot-reload.** Bitwig watches for a
  *content* change, not an mtime bump. The reload primitive is rewriting the
  deployed file (`cp build/libs/…bwextension "$EXT/…"`). Reload → bridge
  answering again is **~3.0–3.3s**, flat across every size tested.
- Instrumentation added: `rig.stats` (construct/init nanos, sizes, stamp,
  heap) and `rig.scanTracks` (full bank scan cost + warm-up readiness).

### The numbers — empty project (e05, 6 tracks)

| config | slots | construct | init | warm-up | scan | ping p50/p95 |
|---|---|---|---|---|---|---|
| 16×16 (E0–E4 baseline) | 256 | 6.4ms | 11.4ms | ~265ms | 869µs | 24.1 / 25.8 |
| 64×64 | 4 096 | 9.0ms | 12.0ms | ~272ms | 631µs | 24.2 / 25.4 |
| 128×128 | 16 384 | 29.0ms | 32.4ms | ~270ms | 525µs | 23.9 / 25.0 |
| 256×128 | 32 768 | 42.9ms | 47.0ms | ~261ms | 611µs | 23.8 / 25.4 |
| **512×128** | **65 536** | **75.7ms** | **81.0ms** | ~267ms | 853µs | 23.9 / 25.3 |
| cursorPool=16 | 4 096 | 9.0ms | 16.1ms | ~258ms | 439µs | 23.9 / 25.2 |
| paramHandles=256 | 4 096 | 23.4ms | 26.7ms | ~260ms | 412µs | 23.9 / 25.3 |
| gridSteps=512 | 4 096 | 38.9ms | 42.7ms | ~277ms | 548µs | 23.8 / **34.5** |

Init cost is **linear and tiny**: ~1.2µs per slot object. Even 65 536 slots
costs 81ms of init, once, on a hot-reload nobody watches.

### The numbers that matter — populated project (e05b, 54 tracks / 387 clips)

Built in a scratch project (+48 instrument tracks × 8 clips), measured, then
torn down by channelId set-difference.

| config | construct | warm-up | **full scan** | ping p50/p95 | visible |
|---|---|---|---|---|---|
| 32×32 (undersized) | 5.7ms | 127ms | 748µs | 23.9 / 25.8 | **32 tracks / 227 clips** |
| 64×64 | 7.8ms | 116ms | 3 261µs | 23.8 / 25.3 | 54 / 387 |
| 128×128 | 17.2ms | 112ms | **6 235µs** | 24.1 / 25.3 | 54 / 387 |
| 256×128 | 33.1ms | 115ms | 5 019µs | 23.7 / 25.3 | 54 / 387 |

- **Init/warm-up/latency stayed flat under load.** Loading the bank with real
  tracks and clips did not change init cost or thread latency at all.
- **The one cost that DOES scale with content is a full bank scan** — it
  loops scenes × *existing* tracks: 3.3ms at 64 scenes, 6.2ms at 128. This is
  a per-*operation* tax, not an init tax, and it is our own handler's shape.
  Routine addressing (`resolveByChannelId`) only touches track rows, never
  slots, so it does not pay this.
- **Ping p50 is pinned at ~24ms in every single configuration.** That is the
  control-surface tick floor (matching E1's ~25ms settle), not a load signal —
  it never moved, so we never found load. The only p95 excursion in the whole
  matrix was gridSteps=512 (34.5ms), the largest single allocation.

### The real constraint: the bank window is a HARD CAP

With a 54-track project and TRACKS=32, **22 tracks and 160 clips were simply
invisible** — not slow, absent. `channelId` (E2f) resolves only inside the
window, so:

- **Scaffold size bounds the maximum addressable project size**, exactly as
  the plan suspected. Tracks past the window cannot be addressed, and their
  clips cannot be snapshotted — a **checkpoint blind spot**, which is worse
  than a perf problem: a revert could silently miss state it never saw.
- ⇒ Phase 1 must **detect** window overflow (compare bank-visible count
  against the project's true track count) and refuse/flag rather than operate
  half-blind. Do not treat bank size as a tuning knob.

### Recommended shipped sizes (evidence-backed)

Since cost is linear-and-negligible and undersizing is a correctness failure,
**size generously**: `TRACKS=256`, `SCENES=128`, `CURSOR_POOL=8`,
`DEVICE_BANK=16`, `paramHandles=64`, `GRID_STEPS=128` (+ the fine cursor).
That is ~50ms of init — imperceptible — and covers projects far larger than
this one will realistically drive. Keep them **config-tunable**; `RigConfig`
already is exactly that mechanism and is worth carrying into Phase 1.

### Cold start + project-open — measured (E5c), caveat closed

The above was hot-reload init only. Probe `e05c` records a live timeline
(ping RTT for control-surface stalls + `rig.scanTracks` for bank population),
detecting project transitions and bridge outages on its own. The same
48-track project was saved to disk and opened at **256×128** and at **16×16**;
Bitwig's own load time cancels between the two rounds.

| event | rig | bank settle | max RTT | stalls |
|---|---|---|---|---|
| New Project (54→4 tracks) | 256×128 | 28ms | 24ms | 0 |
| Open saved project (0→54, 387 clips) | 256×128 | <1 sample | 23ms | 0 |
| **Cold start** (quit + relaunch) | 256×128 | 25ms | 28ms | 0 |
| Open saved project after relaunch | 256×128 | <1 sample | 23ms | 0 |
| New Project (16→4) | 16×16 | 15ms | 25ms | 0 |
| Open saved project (0→16, 99 clips) | 16×16 | <1 sample | 24ms | 0 |

- **Cold-start init = 108.3ms** at 256×128, vs 33–43ms for the same rig on a
  hot reload — a cold JVM with Bitwig launching around it costs ~3×. It is
  still 108ms inside a **13.4-second** application launch (~0.8% of it).
- **Project-open cost is not measurable.** Bank repopulation finished inside
  one sample period at both rig sizes, and **no ping exceeded 28ms in the
  entire session — zero stalls** (threshold 100ms). The scaffold never
  blocked the control-surface thread.
- ⚠ **Do not read the "0ms/1ms settle" figures as literal.** The recorder's
  sampling period is ~50–75ms (each iteration pays the ~24ms tick twice), so
  the honest claim is *below measurement resolution*, not *instant*.
- ⚠ The 16×16 round is a **floor, not a like-for-like control**: at that size
  the rig only sees 16 of the 54 tracks, so it has less to populate partly
  because it is blind to the rest. It confirms nothing pathological happens
  at small sizes; round 1 is the load-bearing evidence.

**Bonus — E2f re-confirmed at scale.** Teardown resolved and deleted **all 48
tracks by channelId** using UUIDs captured *before* the project was saved,
before a full Bitwig quit + relaunch, and before the project was reopened.
48/48 resolved, 0 absent, 0 pre-existing tracks harmed. channelId persistence
across save/restart now holds at 48 tracks, not just the 6 of E2f.

### Caveats — what these numbers do NOT cover

- **The populated project was synthetic**: empty instrument tracks with empty
  clips, no devices/plugins. A real 54-track project has a device chain per
  track, and `DEVICE_BANK` observers stream per chain. Device-side scale is
  unmeasured.
- **Heap figures in the probe output are noise** — whole-JVM, shared with
  Bitwig, GC-dependent (they swing 282M→1186M between adjacent rows). They
  are logged for trend only and should not be read as extension cost.
- The `paramHandles=256` config cycles the 16 curated Polysynth IDs, so it
  measures *handle allocation* cost, not 256 distinct params.

### Decision impact

- **§12 #5 answered ●.** No knee below 65k slots; pre-allocation is not the
  scaling risk §3a treated it as. Ship generous sizes (above), config-tunable.
- **New correctness rule → DECISIONS:** bank-window overflow is a checkpoint
  hazard. Detect it and fail loudly; never operate on a partially-visible
  project.
- **Batch executor:** a full bank scan is ~3–6ms, cheap enough to do freely
  but not per-op in a tight loop; prefer channelId resolution, which skips
  slot iteration entirely.
- **Carry forward:** `RigConfig` + the `rig.stats`/`rig.scanTracks` handlers
  are Phase-1-quality and worth lifting; the config+hot-reload loop is a
  reusable measurement rig. `e05c`'s recorder (transition + stall detection
  tolerant of bridge outages) is the tool for any future latency question.
- **Cold start costs ~108ms of a ~13s launch** — no reason to lazy-init or
  tier the scaffold. Allocate everything up front, as §3a intended.

---

## API surface sweep (2026-07-19)

Systematic pass after the two misses, using both tools. **member-search-index
(complete recall) is primary** — the DirectParameter core methods we missed
are API version **1**, invisible to any recent-versions scan; only the full
member index surfaces old-but-unnoticed capabilities. new-list.html is
secondary (recent additions only).

### Recent additions (API 19→25, from new-list.html) — design-relevant

- **`DuplicableObject.duplicateObject()` (v19)** + `ControllerHost
  .duplicateObjects` — clean structural duplication primitive for
  clips/tracks/scenes; better than copy/paste actions. Feeds the Create
  column and a cheap "duplicate this clip" op.
- **`RangedValue.discreteValueCount()` (v20) + `discreteValueNames()`
  (v23)** — stepped/enum **param introspection**: tells continuous from
  discrete params and gives enum option names (filter type "LP/HP/BP").
  Real refinement for the §6a param layer/catalog — a 3-position switch
  must not take an arbitrary 0..1. Adopt in the param model.
- **`RangedValue.getOrigin()` (v20)** — a param's default/center (e.g. pan
  center); useful for reset and relative edits.
- **`Parameter.hasAutomation()` / `deleteAllAutomation()` (v19)** —
  **checkpoint-fidelity flag**: an automated param won't hold a static
  write (automation overrides it). Revert-correctness must check this.
- **`Track.createTrackBank/createMainTrackBank/createEffectTrackBank`
  (v25)** — per-track scoped banks for **group-track navigation** (children
  of a group). Our host-level flat bank covers top level; these reach
  nested tracks if projects use groups.
- **`TrackBank.setSupportsDeviceChainChannels` (v24)** — affects whether
  device-chain channels appear in a bank; awareness flag.
- Swept, NOT applicable: MasterRecorder (v20), createLastClickedParameter
  (v20, selection-following — against our model), ScrollbarModel/Timeline
  zoom (v21), MidiIn.hardwareAddress (v21), audio-hardware I/O matchers
  (v22), channelIndex (v22, the mutable index).

### Complete-recall concept grep (member-search-index, ALL versions)

- **Modulators — §12 #6 answered ◐ (was "entirely unknown," not ○):**
  `Device.getModulationSource(int)`, `Macro.getModulationSource()`,
  `ModulationSource.{isMapped,isMapping,toggleIsMapping,name}`,
  `Parameter.modulatedValue()` (read post-modulation value). So existing
  modulation sources are accessible and mapping is togglable (the
  enter-mapping-mode-then-touch-a-param idiom). **Creation** of a modulator
  is likely via device insertion (modulators are devices w/ UUIDs) — to
  verify. Promote §12 #6 from unknown to "partial, probe in E7".
- **Device layers (nested chains):** `Device.hasLayers()`,
  `createLayerBank(int)`, `createCursorLayer()`, `DeviceLayerBank
  .getChannel(int)`, `CursorDevice.selectFirst/LastInLayer(int)`. This is
  how to address INTO layered instruments / drum machines / FX layers —
  our device model is top-level-chain only so far. Needed for deep device
  work (drum pads, instrument layers).
- **Full browser session API (richer than §6 assumed):** typed sessions —
  `Browser.get{Preset,Device,Sample,Music,Clip,MultiSample}Session()`,
  `createSessionBank`, `startBrowsing/commitSelectedResult/cancelBrowsing`,
  `shouldAudition`; `BrowserColumn.createItemBank/entryCount`. Still modal/
  stateful, but a real typed content-search surface, not just a popup.
  Keeps `insertBitwigDevice(UUID)`/`insertFile(path)` as the simple path,
  browser as the search fallback (as §6 concluded) — but the fallback is
  more capable than recorded.
- **Rich duplication primitives:** `Clip.duplicate()`,
  `Clip.duplicateContent()` (double a pattern in place — nice compositional
  op), `ClipLauncherSlot.duplicateClip()`, `ClipLauncherSlotBank
  .duplicateClip(int)`, `Channel.duplicate()`. Multiple clean "copy"
  routes for structural ops.
- **Groove engine:** `ControllerHost.createGroove()`, `Groove
  .{getShuffleAmount,getShuffleRate,getAccentAmount,getAccentPhase,
  getAccentRate,getEnabled}` — global shuffle/accent; a lever for
  feel/humanization beyond per-note timing.
- **Quantize:** `Clip.quantize(double)` (a §8b "clean prior-state, no
  inverse" op), `Application.recordQuantizationGrid/recordQuantizeNoteLength`.
- **Remote controls (the 8/page path we superseded):** confirmed present
  (`Device.createCursorRemoteControlsPage`, `RemoteControlsPage
  .getParameter(int)`, `pageCount/pageNames`) — deprioritized given
  createParameter + DirectParameter give unrestricted access.

### Decision impact

- Param model adopts discrete/enum introspection (`discreteValueCount` +
  `discreteValueNames`) and an `hasAutomation` fidelity check.
- Structural ops gain `duplicateObject`/`duplicateContent` as first-class
  primitives (create-with-content, pattern doubling).
- New scoped experiments to slot into the plan: **device layers** (deep
  device addressing) and a real **modulators** probe (E7 upgraded from
  "expect ○" to "partial surface exists").
- Group-track navigation (`Track.createTrackBank`) noted for projects with
  groups; our flat host bank remains the default.

---

## Method: how we verify the API surface

Two misses (CLAP DirectParameter API, `channelId`) traced to the SAME
recall failure: grepping individual javadoc class pages for methods already
suspected to exist. High precision, low recall. Corrected method:

- **Authoritative sources are bundled and prose-complete** at
  `/Applications/Bitwig Studio.app/Contents/Resources/Documentation/control-surface/api/`
  — full Javadoc with method-level prose ("Reports the channel UUID"; the
  take-over-strategy caveat on `set()`; observer semantics), "Since" version
  tags, superinterface/inherited-method links. There is **no separate
  conceptual scripting guide bundled** (only this javadoc + hardware PDFs).
- **For complete recall, grep the search index, not class pages:**
  `member-search-index.js` lists **all 1968 members** across every class;
  one grep for a concept ("channelId", "DirectParameter") surfaces every
  match regardless of which class it's on. This catches things a
  Track-scoped grep misses (e.g. identity lives on supertype `Channel`).
- **Mine `new-list.html` by API version — but know its limit:** it catches
  capabilities *recently added* (channelId=20, createParameter=12) that
  prior art predates. It does NOT catch old-but-missed capabilities — the
  DirectParameter core is API **1** and invisible here. So new-list is a
  supplement; member-search-index is the recall backstop.
- **Read whole class pages incl. "All Superinterfaces" + inherited
  methods** before concluding a capability is absent.
- **Empirical testing remains essential — the prose does NOT document
  behavior.** Every behavioral gotcha we hit was undocumented: gain reads
  2×, `setGain`/`setTimbre` clobber pressure, scene deletion compacts rows,
  empty-slot pointing silently no-ops, `set()` swallowed by take-over,
  direct-write needs `resolution=1`. Docs describe the surface; only
  driving the live API reveals the behavior.
- **Rule: never record a capability ○ from a partial pass.** Confirm
  against member-search-index + new-list + a live probe first.
- **⚠ Some deprecations are FATAL, not soft (E7).** Before wiring any handle at
  init, check the javadoc interface/method for `@Deprecated`: methods like
  `Device.getModulationSource`, `Device.getMacro`, and the whole `Macro`/
  `ModulationSource` family call Bitwig's `deprecatedFail`, which **throws** —
  calling one in the `Rig` constructor aborts `init()` and crashes the
  extension with a user popup (bridge never binds). A deprecated method here is
  a load-time crash, not a runtime no-op. Grep the app-bundle javadoc for
  `Deprecated` on the interface line and every method you intend to call.
- **THE RECURRING FAILURE MODE — four instances now.** Every false negative
  in this spike came from testing *one* mechanism and generalising to "the
  API cannot do this":
  1. CLAP params ○ — checked only the typed path, missed DirectParameter.
  2. Track identity ○ — checked `Track`, missed `channelId` on `Channel`.
  3. Chain creation ○ (E4c) — checked only layer-index insertion, missed
     drum pads, `insertFile`, and container duplication (E4d).
  4. Drum Machine "absent from the bundle" (E4c) — a brittle anchored grep
     against a binary format, defeated by an invisible length byte.
  **Countermeasure, now mandatory before any ○:** enumerate *every* type that
  could carry the capability (walk supertypes: `DrumPad` has an
  `insertionPoint()` that `DeviceLayer` does not); enumerate *every* verb
  (`insert*`, `duplicate*`, `copy*`, `move*`, `paste`, `insertFile`, named
  actions); and prefer structured extraction over text matching when reading
  Bitwig's binary formats. Three of the four misses were found only because
  someone pushed back on a confident negative.

---

## E4b — CLAP params via the DirectParameter API (2026-07-19)

**Verdict: ● CLAP direct params ARE accessible — my E4 negative was wrong.**
Prompted by a challenge to the E4 CLAP claim. The typed specific-device
path has no CLAP variant, but `Device` carries a second, **format-agnostic
`DirectParameter` API** (the older one `createParameter` "replaced") that
works on CLAP, VST, and Bitwig devices alike. Probe `e04b`.

### What works (proven on a real CLAP: Stochas, `org.surge-synth-team.stochas`)

- **Self-enumeration**: `addDirectParameterIdObserver` emits an array of
  **all** param IDs — no IDs known upfront (unlike `createParameter`).
  Stochas: 55 params; Polysynth via the same API: 55 params.
- **Names**: `addDirectParameterNameObserver(maxChars, cb)` → per-id names
  ("L1 speed", "L1 steps/measure", "OSC1 Pulse Width", "AEG Attack"). All
  55 named on both devices.
- **Values**: `addDirectParameterNormalizedValueObserver(cb)` → per-id 0..1
  (Polysynth reported real defaults: Attack 0.07, Sustain 0.95).
- **Writes**: `setDirectParameterValueNormalized(id, value, resolution)`
  works on Bitwig F1FREQ (0.693→0.200). **⚠ resolution matters:**
  `resolution=1` took; `resolution=128` did NOT within 1.5s. Use
  `resolution=1` (or investigate the intended semantics). Stochas's own
  params didn't move on write — plugin-specific (some plugins reject host
  writes / gate on host-automation state), not an API limit.

### Mechanism comparison — two parameter APIs, pick per case

| | `createParameter` (E4) | `DirectParameter` (E4b) |
|---|---|---|
| Devices | VST2/VST3/Bitwig (typed) | **any incl. CLAP** |
| Discovery | IDs/indices known upfront | **self-enumerates all IDs** |
| Access | pull (`get()`) | **push (observers, init-time)** |
| Handles | pre-allocated at init | one observer set per cursor device |
| Displays | ✅ `displayedValue()` ("2.59 kHz") | ◐ observer didn't populate (below) |
| Writes | `setImmediately` | `setDirectParameterValueNormalized(…,1)` |

**Implication for the param layer:** DirectParameter is the better
*discovery/enumeration* primitive (self-listing, format-agnostic, one
observer set covers any pointed device) and reaches CLAP. `createParameter`
remains better where displayed values and stable pull-reads matter (Bitwig
internal, known VST indices). A pool cursor-device can carry BOTH: direct
observers for enumeration + typed handles for the devices we deeply support.

### Open detail (not blocking)

- **`addDirectParameterValueDisplayObserver` didn't populate** display
  strings for either device (names/values did). Hypothesis: the display
  channel is **page-scoped** (the DirectParameter API has
  `setParameterPage`/`nextParameterPage`/`isParameterPageSectionVisible`),
  so displays may only stream for the active parameter page, needing page
  navigation to cover all params. Deferred; displayed values are available
  anyway via `createParameter` for typed devices, and normalized values
  suffice for CLAP readback. Revisit in Phase 1 if CLAP display strings are
  wanted.

### Decision impact (updates E4)

- **CLAP is IN scope for direct params** (enumerate + name + value + write),
  via DirectParameter. §6a "VST/CLAP" claim restored for CLAP; the
  differentiator is broader than E4 concluded.
- Param layer carries two APIs by role: DirectParameter for enumeration/CLAP,
  createParameter for typed pull-reads + displays.
- Write via DirectParameter: pass `resolution=1`.
- **Lesson:** a negative capability claim from a single missing-method grep
  is unsafe in this API — verify against the whole `Device` surface + a live
  test before recording an ○. (Good catch by the user.)

---

## E4 — Direct parameter layer (§6a differentiator) (2026-07-19)

**Verdict: ● the differentiating capability WORKS and exceeds the plan.**
`createParameter` gives named, valued, settable, repointable handles far
past the 8-per-remote-page ceiling, and the Bitwig-internal param IDs —
INITIAL_PROMPT's "harder case" needing semi-manual harvesting — turn out
to be **sitting in the app bundle as plain text**. Probe `e04`, all green.

### Enumeration proof (§6a "effective enumeration")

Pre-allocated 16 `SpecificBitwigDevice.createParameter(String id)` handles
on a repointable cursor device. Pointed at a freshly-inserted Polysynth,
14/16 resolved (2 harvested IDs were section markers, not params), each
**self-describing**: name + normalized value + human displayed value, e.g.
`F1FREQ="Filter Frequency"=2.59 kHz`, `F1RESO="Filter Resonance"=39.5 %`,
`OSCMIX="OSC 1/2 Mix"=0.00 %`. This is the WigAI issue-#15 gap closed:
arbitrary count of named params, not capped at 8. Params became live
**~194ms after device insert** (device insert itself ~144ms).

### Param ID harvesting — much easier than assumed (§6a upgrade)

Bitwig-internal device param IDs are readable straight from
`…/Bitwig Studio.app/Contents/Resources/Library/device-settings/<uuid>/
Default.bwpreset` (`strings | grep -E '^[A-Z][A-Z0-9_]{2,}$'`). Polysynth
yielded 63 tokens, ~14/16 sampled were valid createParameter IDs (rest are
section markers: CONTENTS, MODULATORS, FAKE1…). **No `can-copy-device-and-
param-ids` context-menu workflow needed** — the whole internal-device
catalog is harvestable offline from the bundle. Promotes §6a's "one-time
semi-manual harvest, plausibly a community artifact" to "a script over the
app bundle." (Validity still needs a resolve-check per ID against a live
device, since presets include non-param tokens.)

### Read/write + the take-over trap

- **`param.value().setImmediately(v)` works** (0..1 normalized); round-trips
  exactly and the displayed string tracks it (`0.25`→"75.4 Hz",
  `0.8`→"6.08 kHz").
- **⚠ `param.value().set(v)` is SILENTLY SWALLOWED** by the controller's
  take-over strategy (a plain `set` "may not be set immediately if the user
  configured a take over strategy" — value stayed exactly at the preset
  default). ⇒ **all agent param writes must use `setImmediately`, never
  `set`.** This is the param-layer analogue of E2's gain/pressure traps:
  another silent-no-op write path that only readback verification would
  catch. → DECISIONS.

### Repointing — the pre-allocation architecture question, ANSWERED

`createParameter` handles bind to the **cursor device**, not a fixed slot,
and follow it as it repoints:
- **Within a chain:** `selectDevice(bank.getDevice(i))` moved the cursor
  across two Polysynths; the same 16 handles read/wrote each independently
  (device[1] F1FREQ=0.1 vs device[0]=0.8, no cross-talk).
- **Across tracks:** pointing the parent cursor-track at gn-B moved the
  device cursor (FIRST_INSTRUMENT follow) to gn-B's device; handles read it.
- ⇒ **the §3a "pre-allocate a pool, repoint" strategy applies to params
  exactly as it did to clips (E1).** A modest pool of cursor-devices ×
  N param handles covers the session; no per-slot allocation explosion.

### Type specificity + pinning subtleties

- **`SpecificBitwigDevice(uuid)` view is device-type-specific:** pointed at
  a Polymer, all Polysynth param handles report `exists=false`. So a param
  pool must carry a view **per device type** we want deep access to (the
  cursor device itself still enumerates any device's name/position). Per-type
  ID catalogs are the unit of the eventual catalog.
- **Device-cursor `isPinned` is subordinate to its track cursor:** pinning
  the device cursor does NOT hold the device when its parent cursor-track is
  repointed (params jumped to gn-A's device after a track move). **The
  robust hold is: pin the TRACK cursor (E1) + address the device by
  `selectDevice(index)`.** With the track pinned, params stayed on gn-B's
  device (GAIN=0.33) under a selection change. → DECISIONS: device pool
  addressing = pinned track cursor + explicit device index, not device-pin.

### Scope note (superseded by E4b)

- The **typed** specific-device path is VST2/VST3/Bitwig only — no
  `createSpecificClapDevice`. My first reading ("CLAP direct params NOT
  accessible") was **WRONG**: it ruled out one path and missed the
  format-agnostic `DirectParameter` API. See E4b — CLAP params ARE
  accessible. VST index-path (`SpecificPluginDevice.createParameter(int)`)
  still unexercised (needs a known VST id-at-init); deferred.

### Decision impact

- **§6a differentiator confirmed buildable** — named/valued param access at
  arbitrary count, repointable via the pool model, with an offline-harvestable
  internal-device catalog. This is the genuinely novel capability and it holds.
- **Writes: `setImmediately` only** (take-over swallows `set`).
- **Device addressing model:** pinned track cursor + `selectDevice(index)`;
  per-device-type `SpecificBitwigDevice` views; pool of cursor-devices ×
  param handles sized in E5.
- **Param catalog:** promote to a straightforward Phase-1/2 deliverable
  (harvest bundle → resolve-check per device). CLAP excluded; VST via index.

---

## E3 — Structural ops & revert correctness (2026-07-19)

**Verdict: ● the optimistic-application posture is sound — native undo is
unusable for batch revert (as §8a predicted), and snapshot-based revert
works even for the hardest structural case.** Probes `e03` + `e03b`.

### The headline: undo granularity (§8a confirmed, decisively)

**Bitwig does NOT coalesce operations into undo transactions.** A 4-note
write took **exactly 4 undos** to unwind whether sent as one request
(4 `setStep` in a single handler call) or four separate requests. There is
no `beginUndoStep`/grouping hook in the API. Combined with the stack being
**project-global** (`canUndo` stayed true after we cleared our own notes —
our earlier structural ops were still on it), this kills native undo as a
revert mechanism outright: "undo the agent's last batch" maps to N global
history entries interleaved with the user's own edits. **Owning revert is
mandatory, exactly as INITIAL_PROMPT §8a assumed — now proven, not
assumed.**

### Revert-fidelity roundtrip (§8b confirmed)

Full cycle works: snapshot a clip's notes (verbose scan) → `deleteObject`
the whole clip → recreate via `createNewLauncherClip` → re-point cursor →
replay snapshot → readback matches exactly. **Structural delete is losslessly
reversible via snapshot replay**, no inverse-op algebra needed. This is the
§8b primitive demonstrated end-to-end on the launcher.

### Deletion surface — all four levels work

`deleteObject()` confirmed working with settle times:
Track ~140ms (E1) · ClipLauncherSlot ~24–145ms (E2/E3) · **Device ~140ms**
· **Scene ~instant**. Every structural create has a working delete ⇒ every
structural create is revertible.

### Devices (bonus E4 head start)

- **Insert Bitwig device by UUID works**: `cursorTrack
  .endOfDeviceChainInsertionPoint().insertBitwigDevice(UUID)`. Settle
  ~600–640ms (real plugin load, much slower than note/track ops — batches
  touching devices must budget for this).
- **Device chain re-indexes on delete** (like tracks): deleting device[0]
  shifted the survivor from index 1→0.
- **DeviceBank on a pool cursor track enumerates the chain** (name+exists);
  `itemCount()` gives true length.
- **Device UUID catalog harvested** from
  `…/Bitwig Studio.app/Contents/Resources/Library/device-settings/<uuid>/
  Default.bwpreset`: Polysynth `a9ffacb5-33e9-4fc7-8621-b1af31e410ef`,
  Polymer `8f58138b-…`, Sampler `468bc14b-…`, Test Tone, Organ, Sine, FM-4,
  Phase-4. The §6a "harvest a device catalog" idea is mechanically trivial
  for Bitwig internal devices — the whole map is sitting in the app bundle.

### Scenes — compaction + a real staleness trap

- `Project.createScene()` appends at the end (instant); `Scene.deleteObject()`
  via `sceneBank.getScene(i)` works.
- **Deleting a scene COMPACTS rows below it upward** (confirmed by pitch:
  markers at rows 9/10 moved to 8/9, row 10 emptied). So scene deletion
  shifts clip addresses — the launcher grid is not sparse/absolute.
- **⚠ A pinned cursor's `sceneIndex()` goes PERMANENTLY STALE after scene
  compaction** (still read 10 after 3.1s while the clip was really at row 9).
  Its content tracking and clip-object binding stayed perfect (pitch 64),
  and `trackPosition` tracks track-structural changes correctly (E1) — but
  `sceneIndex` does **not** track scene-structural changes on a held pin.
  ⇒ **after any scene create/delete, the executor must re-point/re-resolve
  cursors; never trust a pre-existing pin's sceneIndex across a scene
  structural op.** Note this interacts with our `point()` verification,
  which checks `sceneIndex === expected` — re-point fresh (re-run
  `selectSlot`) rather than trusting the stale pin.

### Two "FAILs" in the probe output — both are the findings, not defects

`e03` and `e03b` each show one FAIL: they are the *stale-sceneIndex*
behavior above, asserted as expectations that Bitwig violates. The
extension is behaving correctly; the assertions document real API
behavior. No open defect.

### Decision impact

- **Revert design (DECISIONS): own it via snapshot-replay; do not touch
  native undo.** Confirmed feasible and lossless for notes + structural
  delete.
- **Batch executor:** budget ~600ms per device insert; re-resolve cursors
  after scene ops; the existing "verify target before write" rule (E2)
  extends to "re-point after any structural change, don't trust held
  positional metadata."
- **Param catalog (§6a):** Bitwig-internal device UUID→name map is free
  from the app bundle; promotes the catalog idea from "semi-manual harvest"
  to "trivial for internal devices" (VST/CLAP still need the index-scan
  approach — E4).
- Full CRUD deletion surface confirmed ⇒ no structural op is a revert
  dead-end.

---

## E2 — Note round-trip fidelity, grid, observer gotcha (2026-07-18)

**Verdict: ● §5's "Exact" checkpoint-fidelity claim holds for the note
surface, with one asterisk (gain).** Probes: `e02` (full sweep, partially
contaminated by external project-state changes mid-run) + `e02b`
(clean re-characterization on known clips).

### Write/read mechanics

- **`setStep` is NOT visible in the same request** — immediate `getStep`
  after `setStep` in one handler returns `Empty`. It IS visible on the
  next request (~25ms incl. round-trip). ⇒ readback verification (§8c)
  must be a separate tick after the write batch, never inline.
- **`getStep` scan cost is trivial:** 512×128 grid = 65k steps scans in
  2–10ms; 64×128 in ~0.4–1ms. Full-clip snapshots are effectively free.
- **Observer gotcha, precisely characterized:** `getStep`/`NoteStep` needs
  NO subscription at all (works on a cursor with zero `markInterested`).
  Every `Value.get()` (exists, name, position…) throws
  `"Either call markInterested() or add at least one observer in init"`
  without a mark. ⇒ mark everything scalar; note data is implicit.
- **Muted notes remain visible** to the NoteOn scan with `isMuted=true` —
  snapshots see them.

### Expression property fidelity (21-property sweep; re-verified on clean fixture)

All setters accepted; round-trip exact (±2e-3) for: velocity,
releaseVelocity, velocitySpread, duration, pan, timbre (float noise only),
transpose (fractional ok), chance+enable, occurrence (enum)+enable,
recurrence (length+mask)+enable, repeat count/curve/velocityCurve/
velocityEnd+enable, isMuted. Two API quirks, both now precisely modeled:

- **`gain` reads back 2× the written value** (reproducible on clean
  state: set 0.7 → immediate read 0.7 [cached] → settled read 1.4; javadoc
  claims 0..1 both ways). Checkpoint restore mapping: write `read/2`.
  Verify the inverse mapping holds in Phase 1; likely a Bitwig doc/API bug.
- **`setGain` and `setTimbre` each RESET `pressure` to 0** (isolated in
  e02e; every other property is innocent; pressure re-set afterwards
  sticks). ⇒ property-write ordering rule: **pressure last** (or at least
  after gain/timbre) in any note-property batch — and §8c readback
  verification catches violations structurally.

### Grid

- **`setStepSize` works at runtime** (note at beat 1.0 re-indexed 4→8
  after 0.25→0.125 switch; needs a settle wait — not instant).
- **Triplet grids work** (stepSize 1/6 round-trips).
- **Off-grid notes are visible on coarser grids, snapped DOWN** (a note
  at beat 0.09375 scans as x=0 on the 0.25 grid) — coarse scans don't
  lose notes but misreport positions; snapshots should scan at the
  finest grid.
- ⇒ grid is a *view*; resolution is per-cursor and changeable. The
  contract can stay beats-native and quantize per operation to a chosen
  grid; no global init-time grid needed (daw-mcp's design was
  unnecessarily rigid).

### Addressing corollaries (feed the batch executor design)

- **Pointing at an EMPTY slot silently lands the cursor on the WRONG
  clip** — observed staying on the previous clip in one trial and
  attaching to a different clip on the target track (slot 0) in another;
  in both cases status looks healthy. ⇒ create-clip must precede
  pointing; the executor MUST verify the cursor's target (track position
  + scene index) before every write — a mis-point is undetectable
  afterwards from the cursor's own state.
- **No stale reads after clip deletion:** `ClipLauncherSlot.deleteObject()`
  (works, ~24ms) leaves the cursor with `exists=false`, scan returns 0
  notes. Cursor reads are trustworthy when `exists=true` + target
  verified.
- **The e02 cross-session anomalies are fully resolved by E2c** (track
  identity bug — see that section): the "fixture" was actually the FX and
  Master rows. Bonus discovery: `createNewLauncherClip` + full note
  editing WORKS on FX/Master launcher slots. After cleanup (E2d) the
  whole E1a + E2 suite re-ran green on a genuine instrument-track
  fixture.
- **Arranger cursor clip:** created fine; `exists=false` with no
  arrangement clip selected. Deeper arrangement probing stays out of
  scope (§9 lean).

### Decision impact

- Checkpoint design (§8b): full-fidelity note snapshots are cheap and
  exact (gain excepted) — snapshot = verbose scan of the write-set clips.
- Readback loop: write → next-tick verify → report; ~25ms per turn.
- Units (§7): contract in beats; extension quantizes via per-op stepSize.
- E3 signals banked: both Track and ClipLauncherSlot `deleteObject()`
  confirmed working.

---

## E2f — Stable track identity DOES exist: channelId (UUID) (2026-07-19)

**Verdict: ● E2c's "no stable track addressing" was too strong — I missed
`Channel.channelId()`, a per-track UUID (API 20+).** Prompted by the same
"did we miss part of the API?" challenge that surfaced CLAP. Probe `e02f`,
all green. bank index and name remain brittle (E2c stands on those), but
they are **not the only identifiers** — there is a stable one.

### What channelId is

`track.channelId()` → `StringValue`, javadoc "Reports the channel UUID."
Every track (incl. FX and Master) reports a distinct, UUID-shaped id, e.g.
gn-A = `b07f6b06-8f4f-4f4f-802d-ddf1a5190515`. (`channelIndex()`, API 22,
also exists but is just the mutable index as a value.)

### Proven stable (in-session)

- **Survives index shifts:** inserting a track ahead of gn-A/gn-B shifted
  their positions but their channelIds (and the tracks they name) were
  unchanged.
- **Survives rename:** renaming gn-A→"renamed-A" left channelId identical.
- **Clean tombstone:** a deleted track's UUID resolves to found=false — no
  aliasing onto whatever slid into its index.
- **Re-resolvable:** scanning the bank for a matching channelId returns the
  track's *current* index/name/type — the addressing primitive
  (`track.resolveByChannelId`). gn-A's UUID was byte-identical across
  separate probe runs and all structural churn this session; a
  delete+recreate of gn-B correctly minted a NEW UUID (recreated = new
  object).

### The addressing model this unlocks

**Address tracks by channelId, resolve to a live index/object on demand.**
This is the serializable identity E2c said was missing:
- Store channelId in patches/checkpoints, not bank index or name.
- On each operation, `resolveByChannelId` → current index → point a pool
  cursor (E1). Combines with E1's pinned-cursor *in-session* handle: UUID
  is the durable key, the pinned cursor is the fast live handle.
- The E2c fixture bug (identifying a created track by "last Instrument"
  positional heuristic → renamed/deleted the wrong track) is exactly what
  UUID-diff prevents. **The corrected probe identifies a newly-created
  track as "the channelId not present before"** — robust regardless of
  where `createInstrumentTrack` actually drops it (which E2f re-confirmed
  is inconsistent: the newcomer landed at index 0 here vs index 1 in E2c).

### Cross-SESSION persistence — ● CONFIRMED

User saved the project, fully quit Bitwig, and reopened. All six tracks'
channelIds matched the captured UUIDs **byte-for-byte** (gn-A
`b07f6b06-…`, gn-B `9096b9f6-…`, plus Inst 1/Audio 2/FX 1/Master).
channelId is a **persistent, serializable** identity that survives a full
application restart + project reload — exactly the durable key checkpoints
need. (Recreated tracks get a fresh UUID; a given track keeps its UUID for
the life of the project.)

### Decision impact (amends E2c)

- **Track addressing = channelId (UUID) as the stable key + resolve-to-index
  + pool cursor.** Supersedes "no stable addressing"; E2c's brittleness
  finding now applies specifically to *index and name*, not identity.
- Checkpoints/patches serialize channelIds, never indices/names.
- Same question worth checking for clips/scenes/devices: is there an
  equivalent stable id? (Slots are addressed within a track; scenes have
  `sceneIndex` which E3 showed shifts. Worth a pass in Phase 1.)
- **Lesson reinforced (twice now): don't record a capability ○ from a
  partial API pass.** channelId (API 20) and the DirectParameter API were
  both present and both initially missed.

---

## E2c — Track identity: the fixture-contamination root cause (2026-07-18)

> **Amended by E2f:** the "no stable track addressing" conclusion is too
> strong — `channelId()` (UUID) IS stable. This section's brittleness
> findings apply to **bank index and name specifically**, which remain the
> wrong things to address by. Read with E2f.

**Verdict: ● the cross-session anomalies were OUR bug — addressing tracks
by (bank index | name) is unsound. Three API facts, all confirmed by
controlled trials (`e02c`):**

1. **The flat TrackBank includes the FX section and the MASTER track**
   after the regular tracks. `trackType()` distinguishes them
   (Instrument/Audio/Effect/Master/Hybrid/Group). daw-mcp-derived code
   treated bank size as "number of regular tracks" — wrong.
2. **`Application.createInstrumentTrack(position)` does not honor bank
   positions:** requesting the end (9) landed at index 7 (end of the
   *regular* section, before FX/Master); requesting 0 landed at index 1.
   The position argument cannot be trusted; the only safe procedure is
   create → diff the bank → locate the new row empirically.
3. **Default track names auto-renumber** ("Inst 2", "Audio 3" are
   positional auto-names, not stable identities). Name-based identity is
   meaningless for unnamed tracks, and `setName(bankIndex)` renames
   whatever currently sits at that index.

**Combined effect on E1/E2 sessions:** every `ensureFixtureTracks` run
created a track that landed *not* at the assumed index, then renamed the
wrong row — accumulating orphaned "Inst N" tracks and, at least once,
sticking the fixture name onto the tail of the bank (the row typed
Master now carries the name "gn-A"). Cross-session name lookups then
found the wrong tracks, explaining the E2 phase D/E anomalies and the
user's "gn-A wasn't there" observation. In-session fingerprint-verified
results (all of E1's core verdicts, E2's mechanics) are self-consistent
and stand.

**Resolution (same day):** user visually confirmed (screenshots): the
Master row was named "gn-A", fixture clips lived on the FX/Master rows,
and the default template was Inst+Audio+FX+Master — every extra
Instrument row was a ghostnote orphan. Cleanup probe (`e02d`) removed
our clips from FX/Master, restored the Master name, and deleted the five
verified-empty orphans; fixture code (`lib.ensureFixtureTracks`) now
matches by name+type, locates created tracks as last-Instrument-row, and
poll-verifies renames. E1a and E2 both re-ran green on the clean fixture.

**Decision impact (batch executor / contract):**
- Track creation in the contract must return the *located* new track
  (create → diff → verify), never assume the requested position.
- All track addressing must be type-aware; Effect/Master rows are never
  fixture/rename/delete targets by index.
- Rename operations must poll-verify the rename landed where intended.
- This is the strongest argument yet for §8e verification semantics:
  every structural op needs its own readback, not just note writes.

---

## E1 — Addressing: pointing, pinning, cursor pool (2026-07-18)

**Verdict: ● address-don't-select is achievable.** The pool-of-cursors
architecture works: writes land on programmatically chosen clips and are
immune to concurrent user interaction. E1a: 26/28 (the 2 "failures" were
mechanism discovery, see below). E1b (interactive): all real checks passed;
the one FAIL was a mis-designed control test (see 4).

### The working architecture

Per pool slot: a dedicated `CursorTrack` created with
`shouldFollowSelection=false` + its `PinnableCursorClip`
(`cursorTrack.createLauncherCursorClip(w, h)`). Pointing mechanism —
the only one of three candidates that works (**"trackThenSlot"**):

```java
cursorTrack.selectChannel(trackBank.getItemAt(t));  // point the track
track.selectSlot(s);                                 // point the slot
// then pin: cursorClip.isPinned().set(true)
```

Settle is **~25ms, verifiable by polling** `clip.getTrack().position()` +
`clip.clipLauncherSlot().sceneIndex()` — vs. daw-mcp's blind 400ms sleep.

Rejected mechanisms: `slot.select()` alone (pool clips do not follow
global clip selection — their cursor tracks don't follow, and the clip
cursor is scoped to its track) and `CursorClip.selectClip(followerClip)`
(does not repoint cross-track; timed out).

### Evidence highlights

1. **Pool independence ●** — 3 cursors pinned to 3 different clips
   concurrently, each reads back its own fingerprint.
2. **User-interference immunity ●** — 20/20 write+readback cycles correct
   while the user clicked continuously around the session view
   (27 selection changes observed during the test window).
3. **Structural shift: pins follow the object ●** — creating a track at
   position 0 shifted the pinned cursor's reported position +1 with
   content intact; deleting restored it. Bank *indices* drift (fixture
   moved between sessions in testing) ⇒ the brain must resolve addresses
   to objects (via pointed cursors), never store raw bank indices.
4. **Selection-following is opt-in by construction ●** — pool cursors
   never follow user selection even unpinned (`followSelection=false` at
   creation). The E1b "control test" FAIL was this architecture working:
   the test wrongly expected an unpinned pool cursor to follow a click
   (compounded by clicking an already-selected clip = no change event).
   Pinning is belt-and-suspenders on top of a non-following cursor.
5. **`Track.deleteObject()` works ●** (~144ms settle) — early E3 positive:
   structural revert has a delete primitive at least for tracks.

### Wrinkles / carried questions

- **Pointing borrows the UI selection.** `selectSlot` visibly moves the
  user's selection (2 changes during 3-cursor setup; user confirmed
  visually). Not a correctness problem, but a UX wart under optimistic
  application. Phase-1 candidates: restore prior selection after a batch,
  and/or investigate selection-free pointing further. → DECISIONS.
- **Pin behavior when the user drags/moves the pinned clip is ambiguous ◐.**
  After drag-away, the cursor still reported sceneIndex=0 *and* 2 notes —
  consistent with either stale cached reads on a dead cursor or the drag
  not doing what we assumed. Needs a controlled retest in E2 including
  `clip.exists()` in every read (readback verification catches this class
  of problem regardless, per §8c).
- Reads on a non-existent/stale cursor may serve cached step data —
  E2 must characterize `getStep` behavior when `exists()` is false.

### Decision impact

- Addressing model (DECISIONS-to-be): **pool of pinned, non-following
  cursor tracks + clips; point via trackThenSlot; verify settle by poll;
  address objects, not indices.** Pool size TBD in E5.
- daw-mcp's `selectionDelayMs` approach is confirmed obsolete.
- §12 open question #1: answered **yes** (pinning survives user
  interaction), with the drag-a-pinned-clip caveat above.

---

## E0 — Toolchain bring-up (2026-07-18)

**Verdict: ● complete.** Extension builds, loads in Bitwig 6.0.6, and the
full TCP round-trip works. All 8 probe checks pass (`brain: npm run probe:e00`).

### Settled facts

| Item | Value |
|---|---|
| Bitwig | 6.0.6, reports `hostApiVersion` **25** at runtime |
| extension-api artifact | **25** (only version served on maven.bitwig.com; older versions are unpublished) |
| Extension runtime JVM | **Java 25** (Azul), bundled with Bitwig |
| Bytecode target | `--release 21` works; Bitwig's own bundled extensions are also major-65 (Java 21) |
| Build | Gradle 9.6 + local JDK 26 cross-compiling to 21; `gradle copyExtension` deploys |
| Transport | TCP loopback :8686, newline-delimited JSON-RPC 2.0 — confirmed incl. 20KB payloads, unicode, out-of-band error frames |
| Threading | requests marshaled via `host.scheduleTask` run on thread `"Control Surface Session"` |

### Gotchas discovered (the E0 blocker)

1. **Extension discovery is via ServiceLoader, not the manifest.** Bitwig 6
   requires `META-INF/services/com.bitwig.extension.ExtensionDefinition`
   listing the definition class. The `Extension-Class` manifest attribute
   (which daw-mcp's build.gradle sets) is ignored — daw-mcp's *released*
   jar contains the services file even though its Gradle build doesn't
   create it. Without it: `extension-registry error … No extensions found
   in <jar>`, and the extension silently never appears in the vendor list.
2. **The bundled javadoc's API-version annotations lag.** Newest "API
   version N" mentions in 6.0.6's bundled docs stop at 22, but the host
   actually serves 25. Trust `host.getHostApiVersion()` (or the maven
   artifact), not doc-annotation archaeology.
3. **Bitwig watches the Extensions folder and hot-reloads on file change.**
   Redeploying a running extension restarts it in place (bridge socket
   comes back up) — no Bitwig restart needed after the initial add. Errors
   from a failed scan appear in `~/Library/Logs/Bitwig/BitwigStudio.log`
   under `extension-registry`.
4. First-time activation is manual: Settings → Controllers → Add
   Controller → vendor "ghostnote" (no auto-detect with 0 MIDI ports).

### Decision impact

- Toolchain decision (DECISIONS-to-be): Java 21 target, extension-api 25,
  Gradle 9, Gson bundled. No obstacles found.
- Transport decision: TCP + newline JSON-RPC confirmed viable; strict
  per-line framing with -32700-and-continue verified (a malformed line
  does not poison the connection).
- Hot-reload (gotcha 3) makes the spike iteration loop fast:
  `gradle copyExtension` + rerun probe, no UI interaction.

---

## E15 — Phase-0 findings (bank window, and same-request write semantics)

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

## E14 — the in-Bitwig UI probe: the human surface is REAL, and D4 named the wrong panel [K] (2026-07-25)

**Verdict: ● rows A–G all settled. D4's Studio I/O panel bet holds on substance —
real buttons, a working button-group chooser, a live-reflowing panel, per-project
persistence across a full restart — and is wrong on three specifics, one of which
cost a Bitwig crash to find.**
> **Rows H and I are ○ and are written up in their own section below.** Both die
> on the same question this section's "one real negative" raises: no
> extension-owned surface in Bitwig stays on screen.

Probes: `probe:e14` (rows A–G, interactive),
`probe:e14-verify` (persistence across restart), `probe:e14-selection` (row F
re-specified, automated), `probe:e14-status` (read-only). Apparatus:
`extension/…/UiPanel.java` + `handlers/UiHandlers.java`, 9 wire methods, golden
`5343039c7fe670cc` at 93 methods.

### The three corrections to D4, before the verdicts

1. **⚠ THE PANEL MOVED. D4 says "Bitwig's Studio I/O panel"; that has been wrong
   since Bitwig 5.0.** `getDocumentState()` settings appeared there up to 4.x,
   under the controller with a disclosure triangle. The 5.0 release notes: *"Each
   controller connected is now shown with icons in the top right of the
   application window; clicking any icon opens a pane with access to: the
   controller's help and system-level settings … the Track / Device navigation and
   pinning options (previously in the Studio I/O Panel, which is now called the
   Output Monitoring Panel)"*. 6.0.6 labels the renamed panel **"Studio Monitoring
   Panel"**, and it no longer lists controllers at all — confirmed by looking: it
   is empty of anything ghostnote. The API is unchanged and still v1; only where
   Bitwig DRAWS it moved. This cost one sitting, because the bundled user guide on
   disk is for 4.3.9 and still documents the old layout.
2. **`Setting` is an ORPHAN interface in the published API.** It declares
   `show()`/`hide()`/`enable()`/`disable()` — row C's entire question — and nothing
   returns it, extends it, or links to it. `getEnumSetting` returns
   `SettableEnumValue`, whose supertypes do not include it. Reaching it needs an
   undocumented downcast. **It works** (row C1), verified genuine by reading
   `getLabel()`/`getCategory()` back through the cast, but it is undocumented and
   guarded with `instanceof` throughout.
3. **Row F's premise is a misreading of E1** — see row F below.

### Row A — the revert button ●

| | verdict |
|---|---|
| A1 | ○ **and FATAL** — see the crash finding below |
| A2 | ● a Signal setting renders as a button and fires its observer on a human click (2 clicks → 2 fires) |
| A3 | ● String AND Enum document settings survive save + **full Bitwig restart** |
| A4 | ● document state is scoped **per project**, as D5 needs for takes |

A3 was taken in the strong form — a full application restart, not a project
reopen — so what came back came off disk rather than out of a still-running
extension. The `revertFires` counter RESET across it, which is the control: what
persists is the document, not our own state.

**⇒ the revert button is real, it is per-project, and it survives a restart.**

### ⚠ A1 — `Signal.fire()` CRASHED BITWIG, and the way it crashed is the finding

A `ui.signalFire` wire method existed for exactly one run, to test whether the
extension could press the human's own revert button. It killed the application,
with an unsaved project open:

```
java.lang.IllegalStateException: This signal cannot be invoked
  at com.bitwig.flt.control_surface.values.SignalProxy.doFire
  at com.bitwig.flt.control_surface.proxy.ControlSurfaceObject$1.run
  at com.bitwig.flt.app.BitwigStudioMain.main
```

**Two findings, and the second has far more reach than the row it came from.**

1. **`Signal.fire()` on a `getDocumentState()` setting is REFUSED.** Bitwig will
   not let anything but a real click fire it. **This STRENGTHENS D4**: §8g's
   "revert is a human verb" is enforced by the API, not merely by our choosing not
   to expose a method. The agent cannot press the button even in principle.
2. **⚠ THE REFUSAL IS ASYNCHRONOUS AND UNCATCHABLE.** Read the trace: the throw
   happens on `BitwigStudioMain`'s thread, inside a runnable Bitwig DEFERRED from
   our call. `fire()` returned normally and the handler's `try/catch` saw nothing.
   No extension-side construct can contain it.

**The general rule, which is the real prize: a handler's `try/catch` protects only
against a SYNCHRONOUS throw. Anything Bitwig defers to its own thread escapes it
and takes the application down.** So the discipline is to VALIDATE INPUTS BEFORE
CALLING, never to wrap-and-hope. `UiHandlers` was reworked on that basis — enum
values checked against their own option lists, slot indices against the
pre-allocated bank, panel layouts against the three real constants.

Compare **E7-Finding-0**, where `getModulationSource(int)` threw at `init()` and
took down the extension. This is the same hazard class one level worse: at
runtime, and it takes down the DAW.

The method was **deleted, not banned**. The existing ban list keeps
`app.invokeAction` and friends registered because the probes that banned them are
the live regression suite and re-running one is merely unwise; this one cannot be
re-run at all, so a registration is a loaded gun. A second, harsher class exists
now — `WIRE_METHODS_FORBIDDEN` — with two tests asserting the name appears
neither in the golden nor in any handler source.

### Row B — the A/B take switcher ●

| | verdict |
|---|---|
| B1 | ● the extension can SET an enum setting (push) and observes its own write |
| B2 | ● it renders as a **button group at every count probed — 2, 3, 4, 6, 8 and 12 options** |
| B3 | ● the extension OBSERVES a human changing it (pull) |

B2 is better than the javadoc implies. "Shown either as a chooser or as a button
group … depending on the number of provided options" suggests a cutoff; there is
none at any count the take switcher would use. Probed with one setting per option
count precisely because no javadoc states the threshold.

⚠ B1 initially read as a failure for a probe-side reason worth recording: the
setting still held `C` from a previous session, so pushing `C` was a no-op and no
observer fired. The probe now computes a target different from the current value.
The false failure was itself evidence for A3.

### Row C — pre-allocated take slots ● (with one ○ that makes them mandatory)

| | verdict |
|---|---|
| C1 | ● the undocumented `Setting` downcast works on Signal, Enum AND String |
| C2 | ○ **settings CANNOT be created after init** — `"This can only be called during driver initialization"` |
| C3 | ● `hide()`, `disable()`, `show()` and `enable()` all reflow the panel LIVE — no reopen, no project reload |
| C4 | ● 16 slot rows plus the rest reads as "fine" |

**C2 is the consequential one, and it is a ○ that settles a design question rather
than closing a door.** Pre-allocation is now **mandatory**, not tidy: take slots
must exist at `init()` and be revealed with `show()`. That is the §3a
pre-allocation idiom on its third occurrence, and C3 confirms the reveal works.
The refusal is clean, synchronous and catchable — the good failure mode, and the
opposite of A1.

C4 is config-tunable (`RigConfig.uiSlots`) so the ceiling can be swept with the E5
loop — edit `rig.json`, `touch` the deployed extension, look — without a rebuild.

### Row D — the status readout ●

| | verdict |
|---|---|
| D1 | ● the extension can push text into a String setting |
| D2 | ● a user edit is DETECTABLE (compare against the last value we pushed) and REPAIRABLE (we can overwrite it) |

There is no read-only String setting, so the risk was never that we cannot write
it — it is that the user can, and we would not know. Both halves work, so a status
display is viable.

### Row E — "show me what changed" ●

| | verdict |
|---|---|
| E1 | ● **all three** routes navigate: `ClipLauncherSlot.showInEditor()` (API 10), `ClipLauncherSlotBank.showInEditor(int)` (API 1), `Clip.showInEditor()` (API 18) |
| E2 | ● `setPanelLayout("EDIT")` moves the UI and `panelLayout()` reports it back |
| E3 | ● `zoomToFit()` visibly changes the focused editor's zoom |

⚠ Only three panel layouts exist (`ARRANGE`, `MIX`, `EDIT`) and the javadoc
DESCRIPTIONS of MIX and EDIT are transposed (the literal constant values are
right). The available set also depends on the active display profile, so the
layout is read back rather than assumed. **PROJECT_PLAN §3's corollary holds: we
can put the user in front of Bitwig's own piano roll, so the visual surface owes
only before/after comparison.**

### Row F — RE-SPECIFIED: the wart is the SELECTION, not notifications ●

⚠ **Row F as written cannot be answered, because its premise misreads E1.** It
asks whether `setShouldShow*Notifications(false)` suppresses "the spray our cursor
pointing causes (E1's wart)". E1's wart, verbatim:

> **Pointing borrows the UI selection.** `selectSlot` visibly moves the user's
> selection (2 changes during 3-cursor setup; user confirmed visually). Not a
> correctness problem, but a UX wart under optimistic application.

**The selection MOVES. E1 says nothing about notifications**, and no notification
setting can suppress a change to real selection state. `NotificationSettings`
governs notifications the CONTROLLER requests; they are off by default ("By
default all notifications are disabled", its own javadoc) and ghostnote enables
none. Run the long way first — six prompts, three conditions, watching for popups
— it produced **no spray in any condition**, which is the correct answer to a
question about something that does not happen. ⚠ `PROJECT_PLAN` §7 carries the
same conflation and needs the same correction.

The real question — §7's "whether the selection movement itself can be restored
after a batch is unresolved" — needs no human at all, because E1 wired an
`addIsSelectedObserver` across the slot bank. `probe:e14-selection`, automated:

| | verdict |
|---|---|
| F1 | ● pointing DOES steal the user's clip selection — E1's visual note, now a number |
| F2 | ● the prior selection CAN be saved and restored around a batch |
| F3 | ● restoring it does NOT re-point the pool cursor (non-following by construction, E1) |
| F4 | ● **three points in ONE batch produce exactly ONE observable selection change** |
| F5 | ● the notification master switch (`getUserNotificationsEnabled()`) is writable and restorable |

**F4 is what makes the fix cheap.** The batch collapses to a single visible
change, so one save-and-restore at the end of a batch fully addresses E1's wart —
there is no mid-batch strobing to engineer around. **§7's open question is
CLOSED**, with a concrete Phase-1 mechanism.

### Row G — named undo, correcting E3 ●

| | verdict |
|---|---|
| G1 | ● **ONE `deleteObjects(undoName, …)` call = ONE undo step** — three clips deleted, one undo restored all three |
| G2 | ● the undo entry carries our name: the history read `"ghostnote E14 batch delete"` |
| G3 | ● `duplicateObjects(undoName, …)` names its step too |

**E3's "there is no grouping hook in the API" was too strong, exactly as D4
suspected.** `ControllerHost.deleteObjects(String, DeleteableObject…)` (API 10)
and `duplicateObjects(String, DuplicableObject…)` (API 19) do what their
one-sentence javadoc claims. ⚠ **This does NOT rescue native undo as a revert
mechanism** — note and param writes remain ungrouped and the stack is still
project-global (E3), so snapshot-replay revert stands unchanged. What it buys is
that our bulk deletes need not shred the user's own undo history.

### ⚠ The one real negative: the pane CLOSES on click-away

The controller pane is not a dockable panel. It opens from a top-right icon and
closes as soon as the user clicks into the project. D4 wants it to host an A/B
take switcher reached for constantly, and a surface that vanishes on every click
is a materially weaker home for that than the docked panel D4 assumed.

It remains fine for **revert** — a rare, deliberate act, where opening a pane and
clicking a button is entirely reasonable. It is poor for **A/B comparison during
listening**, which is D5's core verb.

○ **CONFIRMED, not open: the pane cannot be pinned or docked.** It always closes
on click-away; there is no pin affordance. (The 📌 beside `Mode` in the pane is
Bitwig's own track/device follow pin, not a window pin.)

**⇒ the human surface SPLITS along the grain of how often each verb is used.**
Revert, and any other deliberate one-shot, belong in the pane and work well there.
Take switching during listening does not, because it would mean re-opening a
pop-over between every A/B — which is precisely the comparison D5 calls the core
verb. That is the strongest argument yet for pulling the Phase-3 web view forward
for take navigation specifically, and PHASE-0 §Risks already names that fallback
and calls it a reordering rather than a redesign.

⚠ Note what does NOT follow: §8g's privilege separation is unaffected. A1 makes it
API-enforced, so it does not depend on the pane being the take UI. A web view
served by the daemon can own take switching without weakening it, provided the
daemon keeps the agent off those endpoints — which is D4's rule anyway.

### Decision impact
- **D4 holds on substance and needs three corrections**: the panel location
  (Studio I/O → top-right controller pane since 5.0), the A1 strengthening
  (privilege separation is API-enforced, not policy), and the row F
  re-specification (selection, not notifications).
- **D4's UI story needs one addition**: the surface is a pop-over, not a dock.
- Exit criterion 3 is met for rows A–G. **H and I remain.**
  > ● **Now met in full** — rows H and I below, 2026-07-25.
- New standing-rule material: *an exception Bitwig defers to its own thread cannot
  be caught by the extension, so validate before calling.*
- Row C2 makes pre-allocation of take slots a requirement for Phase 1's control
  layer, not an option.

---

## E14 rows H and I — both speculative rows die on the SAME question, and one non-speculative finding falls out [K] (2026-07-25)

**Verdict: ○ on both, for the same reason rows A–G's pane failed — nothing in
Bitwig will stay on screen. D14 is unchanged and now rests on two independent
measurements instead of one.** Everything *else* about both rows works, some of
it better than expected, which is what makes the ○ worth writing down at length:
the obstacle is not the drawing, the layout, the click handling or the API. It is
that there is no persistent window to put any of it in.

Probes: `probe:e14-hw` (row H), `probe:e14-gfx` (row I). Apparatus:
`extension/…/HardwarePanel.java`, `DisplayWindow.java`, `PanelRenderer.java`,
7 wire methods, golden `37665189db86547b` at 100 methods. Render artifacts (PPM
via `Bitmap.saveToDiskAsPPM`, converted to PNG by `brain/src/probes/ppm.ts`) in
`brain/.tmp/e14/`.

### ⚠ The one finding here that is NOT speculative, and it is load-bearing

**`host.createBitmap` is INIT-ONLY, and it refuses with the same words as
settings**:

```
refused: ydq: This can only be called during driver initialization
```

That is verbatim E14-C2's refusal on `getDocumentState()` settings, from a
completely different subsystem. So the §3a pre-allocation idiom is now on its
**fourth** occurrence — cursor pools (E1), device/param handles (E5), settings
(E14-C2) and now graphics — and it is beginning to look like a property of the
extension API as a whole rather than a series of coincidences. **Anything Phase 3
will ever draw into must be allocated at `init()`.** → **D7 amended.**

The refusal is clean, synchronous and catchable — the good failure mode, and the
exact opposite of E14-A1. It was measured last and opt-in for that reason; it
turned out not to need the caution, which is only knowable afterwards.

### Row H — a fully working clickable panel that cannot stay on screen ○

| | verdict |
|---|---|
| H0 | ● `createHardwareSurface()` + 4 buttons, 4 lights, a 2-line text display and a 256×64 pixel display all build at init — 17.6ms, 4 controls, 6 output elements |
| H1 | ● `setBounds` round-trips through Bitwig's physical model (`getX/getY/getWidth/getHeight` return what we set, in mm) |
| H2 | ● the output pipeline is live: `currentValue === lastSentValue` on both lights and text lines after a flush |
| H3 | ● `pressedAction().isSupported()` is **false** on every button, exactly as the javadoc predicts with no matcher set |
| H4 | ● the simulated GUI opens and draws the whole laid-out panel — labels, light colours, both text lines, the embedded graphic |
| H5 | ● **a `HardwareButton` with NO `HardwareActionMatcher` fires on a click**, press *and* release |
| H6 | ● the embedded `HardwarePixelDisplay` renders at 256×64 (418µs for the take strip) |
| **H4e** | ○ **the simulated GUI CLOSES on click-away** — the only question the row existed to answer |

**H5 is the mechanism finding and it is worth keeping.** `HardwareAction`'s
javadoc defines `isSupported()` as "has a `HardwareActionMatcher` that can detect
it", and ghostnote declares zero MIDI ports so no matcher is even constructible.
`isSupported()` duly reported `false` on all four buttons — **and the presses
arrived anyway.** ⇒ **the hardware simulator synthesises actions directly, rather
than routing them through the matcher.** A matcher-less `HardwareButton` is a
real clickable widget, and `isSupported()` is a statement about MIDI wiring, not
about whether the control works. Transferable to any future real-hardware work.

⚠ **H4f, from the operator, is the sharpest version of the negative:** *"It does
not stay open (because changing projects requires clicking out of it), but the
state is maintained — Take D is still highlighted."* The surface state is durable
in the extension; what is lost is purely visibility. That is the same shape as
the controller pane's failure and it fails D5's core verb the same way — an A/B
comparison you reopen a window for between every comparison is not a comparison.

⚠ **`flush()` idles at roughly 1 Hz.** `updateHardware()` calls moved 4 → 5 over a
second at rest, so output state does not reach the surface promptly on its own;
`host.requestFlush()` after a push is what makes it timely, and every `ui.hw*`
handler calls it. Relevant to any future output-pushing surface, not just this one.

### Row I — the renderer is genuinely good; the window does not exist ○

| | verdict |
|---|---|
| I0 | ● `host.createBitmap(640×320, ARGB32)` succeeds at init (5.5–5.7ms) |
| I3a | ● the DEFAULT font face measures text with no `loadFontFace` — `"Take B · 12 notes"` @12px is 91×9, ascent 12, line-height 14 |
| I3b | ● the 8–24px text ladder drew at every size |
| **I1** | ○ **`showDisplayWindow()` produces NOTHING.** No window, no flash, no error — under BOTH `extension-dev` conditions |
| I2/I4 | — unreachable: persistence and redraw-on-demand cannot be asked of a window that never opens |
| I5 | ○ `createBitmap` after init is refused (see above) |

**The rendering itself is the surprise, and it is a ●.** All six artifacts were
inspected as PNGs, not merely counted:

- **text** — clean antialiasing, correct kerning, and both `—` and `·` render, so
  the default face has real Latin-1 coverage. At the 256×64 controller-screen
  size, 12px is crisp, 10px readable, 8px marginal-but-present.
- **paths** — smooth béziers, correct dash phase, and **alpha compositing works**
  (overlapping translucent circles blend properly). That is precisely the
  before/after overlay a Phase-3 diff view would want.
- **cost** — 292–334µs for a warm 640×320 re-render. The `text` scene is
  consistently the slowest at ~5.4ms for six strings, so **text is the expensive
  primitive at roughly 1ms per `showText`**; geometry is nearly free.

⇒ **If an in-Bitwig raster panel is ever wanted, the renderer is not the
obstacle.** `GraphicsOutput` is a competent 2D surface and the take strip it drew
would be perfectly serviceable UI. The obstacle is entirely that
`showDisplayWindow()` does nothing on macOS/Bitwig 6.0.6 and that the only other
route to a window — row H's simulator — will not stay open.

### ⚠ Method note: row I was measured twice, because the first run was confounded

The first `probe:e14-gfx` run happened when `config.json` **did not exist at
all** — so `extension-dev` was unset. The probe's own header asserted row I was
independent of that flag, which was a *javadoc inference* (the flag is documented
only against `HardwareSurface` simulation) and not a measurement. Given that
`showDisplayWindow` is a debug utility by Bitwig's own words, "gated behind the
debug flag" was a live hypothesis, and E14 had already been wrong twice about
premises of exactly this kind (row F's, and D4's panel location).

So it was re-run with `extension-dev : true` set and the simulated device
connected. **Identical result: nothing.** The ○ is now measured under both
conditions rather than assumed under one. Standing rule 10's clause about doc
passes applies to *our own* inferences too, and the re-run cost one minute.

### What this closes, and what it changes

- **D14 stands, and is now doubly-sourced.** Take navigation belongs in the
  Phase-3 web view. Rows A–G found the controller pane closes on click-away; rows
  H and I find that the only two alternatives inside Bitwig either close the same
  way or never open. **Three independent surfaces, one shared verdict: Bitwig has
  no persistent extension-owned window.** That is a much stronger foundation for
  the Phase-3 decision than the single pane measurement was.
- **D7 is amended**: graphics allocation joins settings as init-only, on the same
  refusal string. The §3a idiom is now the default assumption for any Bitwig
  resource, not a per-subsystem discovery.
- **Neither row becomes load-bearing, as specified in advance.** Row H would have
  needed `extension-dev : true`, a restart and two right-click menus even had
  H4e passed — a setup cost no product can put on a musician. Row I's own javadoc
  calls it a debug utility. Both were probed because a ● would have *reopened* a
  question; both returned ○ on the question that mattered, so nothing reopens.
- **Kept for later, cheaply**: the renderer, the artifact pipeline
  (`saveToDiskAsPPM` → PNG), and the H5 matcher finding. If Phase 3 ever grows a
  Bitwig-side raster panel — or ghostnote ever meets real hardware — the drawing
  half is measured and working.

### Decision impact
- **PHASE-0 exit criterion 3 is now MET IN FULL**: every E14 row A–I carries a
  verdict with evidence, and the control-layer decision is D14.
- **D7** gains the init-only graphics constraint (§3a, fourth occurrence).
- **D14** is unchanged in substance and strengthened in evidence.
- New: *`isSupported()` describes MIDI wiring, not usability — the simulator
  fires matcher-less actions directly.*

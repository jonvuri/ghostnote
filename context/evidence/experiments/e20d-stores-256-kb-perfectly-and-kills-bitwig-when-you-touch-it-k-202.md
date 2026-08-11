---
id: E20d
kind: evidence
state: active
source: FINDINGS.md
---

# E20d — ⚠⚠ `getDocumentState()` STORES 256 KB PERFECTLY AND KILLS BITWIG WHEN YOU TOUCH IT [K] (2026-08-09)

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

---
id: E20b
kind: evidence
state: active
source: FINDINGS.md
---

# E20b — ⚠⚠ `duplicateClip` OVERWRITES the next row when it is occupied, and the observers CANNOT SEE IT [K] (2026-08-09)

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
the bank-window budget (standing rule 5) rather than a nicety. Session 3e must
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

⇒ **For 3e**: the stash cannot learn about this after the fact. The protection has
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

- ⚠⚠ **New precondition for the clip block (session 3e)**: `duplicateClip` may only
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

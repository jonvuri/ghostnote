---
id: E1
kind: evidence
state: active
source: FINDINGS.md
---

# E1 — Addressing: pointing, pinning, cursor pool (2026-07-18)

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

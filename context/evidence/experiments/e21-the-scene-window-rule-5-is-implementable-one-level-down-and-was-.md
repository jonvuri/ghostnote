---
id: E21
kind: evidence
state: active
source: FINDINGS.md
---

# E21 — ⚠⚠ THE SCENE WINDOW: rule 5 is implementable one level down, and `clip.create` was growing the project [K] (2026-08-09)

**Verdict: ●● the premise MEASURED and the fix PROVEN — plus ⚠⚠ a defect found by
accident that is bigger than the one the session came to fix.** Session 3c.
`probe:e21` PART A **11/11**, PART B **9/9**, PART C (the B6 sweep) **5/5**, offline
**320/320**.

### ARM 1 — `sceneBank.itemCount()` reports the PROJECT total (●, with a control)

The number every part of this session rests on, and `Rig.java` recorded it as
◐ UNPROVEN for banks in general: E15-A and E16r measured it for TRACKS, and
`probe:e19` saw 99 for scenes once, in passing, while doing something else.

| window | project | `sceneBank.itemCount()` |
|---|---|---|
| 16 (control — both hypotheses agree) | 10 | 10 |
| ⚠ **5 (they disagree)** | 10 | ⚠⚠ **10 — the project total** |

⚠ **Measured by SHRINKING the window, not by growing the project.** Growing is a
one-way door: a create past the window mints a row `sceneBank.getScene(i)` cannot
address, so nothing can delete it (E19). Shrinking produces the same inequality and
is undone by putting `rig.json` back. E5 swept the track bank the same way.

⇒ Rule 5's budget is implementable for scenes, on the same instrument as for tracks.

### ARM 5 — the observers really are bounded by the window (●)

Corroborates by measurement what `Rig.java` establishes by construction, and it is
B2's whole premise:

```
window 16 -> content ring holds slotIndex 0..9,  trackIndex max 9
window  5 -> content ring holds slotIndex 0..4,  trackIndex max 15
```

⇒ An edit outside either bank fires **nothing**, and a delta that only counts events
calls that quiet. Hence the fourth verdict.

### The fix, proven live

| | |
|---|---|
| a `scene.create` past the budget | ● refused BEFORE the call — `sceneCount` and `sceneEpoch` both unmoved |
| a create INSIDE the budget (the control) | ● permitted, lands, and is given back from the END |
| a `scene.delete` / `clip.create` naming a row past the window | ● refused, never sent as a bank index |
| a clip row past the window | ● `Snapshot.unreachable`, with `missing` empty |
| `deltaComplete()` on an uncoverable window | ● **false**, `uncoveredIn: 'scenes'`, other three verdicts quiet |

### ⚠⚠ FOUND BY ACCIDENT: `clip.create` into an OCCUPIED slot APPENDS A SCENE

The session's live conformance run kept growing the project — 10 → 82 → 154 → 170
scenes — while `scene.create` was being correctly refused throughout. Bisecting by
test name put **+1 on each `C-props` case and +0 on `C-notes`**; replaying the same
frames by hand added nothing; replaying `withClip` step by step put all of it on one
line.

```
apply clip.create @ row 0        168 -> 169      (the slot already held a clip)
```

The difference between the two bisect halves was never the properties. It was that
the hand replay **deleted the clip first**.

| `Track.createNewLauncherClip(slotIndex, len)` | |
|---|---|
| EMPTY slot | ● creates the clip there. No growth. |
| ⚠⚠ **OCCUPIED slot** | neither fails nor overwrites — **appends a scene at the END of the project** and puts the new clip out there. The existing clip is untouched, length and all. Measured 169 → 170 with every row inside the window unchanged. |

⇒ ⚠⚠ **The one op nobody classed as structural is a silent, unbudgeted
`scene.create`** — and the row it mints is past the bank window on any project
bigger than it: unaddressable, un-deletable, and **unobserved**, because no observer
exists out there. A budget that counts only `scene.create` has a door beside it.

⚠ **It is how a project reaches 99 scenes with nobody creating one.** `probe:e19`
tripped over exactly such a project and attributed the stranding to its own
`scene.create`; the growth had already happened, one conformance case at a time,
through `withClip`'s unconditional `clip.create`. E19's account of the SYMPTOM
stands; its implied cause was incomplete.

⚠ Refusing is right on its own terms, before any of that: a caller naming a slot
means THAT slot, and *"create me a clip somewhere you choose"* is not expressible in
the op union. It is the same precondition E20b puts on `duplicateClip`, where an
occupied destination is worse still — there the existing clip is DESTROYED and no
occupancy event fires. ⇒ **`SlotOccupiedError`, and it is the shared precondition
3e needs.**

### B6 — what `config.scenes` costs (a NUMBER, not a verdict)

16 tracks, one reload per row, `initMicros` measured inside the extension:

| scenes | slots | markedValues | constructUs | initUs | scanMs |
|---|---|---|---|---|---|
| 8 | 128 | 848 | 4691 | 31762 | 24 |
| 16 | 256 | 1616 | 6091 | 33392 | 24 |
| 32 | 512 | 3152 | 6251 | 34530 | 25 |
| 64 | 1024 | 6224 | 8645 | 37809 | 25 |
| 128 | 2048 | 12368 | 9638 | 36148 | 25 |

⇒ **A 16× rise in marked values costs ~14% of init time and nothing measurable per
request.** Rig construction roughly doubles (4.7 → 9.6 ms) and the full bank scan is
flat at the 24 ms tick floor. ⚠ The heap column is omitted deliberately: it is
whole-JVM, shared with Bitwig, and rose monotonically across five consecutive
reloads, which is as likely to be GC timing as scaling. ⚠ E5 measured the track
side; this is the scene side, and **the default stays where it is** until someone
decides otherwise — the number goes in the record, not into a change.

### ⚠ What it cost the test project, and how the growth was confirmed closed

The open project went from 10 scenes to **170** across one afternoon of live runs, all
of it through the `clip.create` door above — two or three dozen rows per conformance
run. ⚠ 154 of them were outside the 16-wide window and therefore **undeletable through
our wire**: `sceneBank.getScene` is bounded to the window and there is no scroll
handler. ● The operator reloaded the project to its saved state, which removed them
(and restored an FX track that had also gone missing).

⇒ ⚠ **The reload is what makes the fix testable, and it passed**: a full live
conformance run on the restored project leaves the scene count **unchanged**
(14 → 14), against ~24 rows per run before. The suite carried a second, slower leak
too — `C-epoch` and `C-content` each created a scene and never gave it back — now
returned from the END, per E3.

Live conformance on the clean project: ● **43 pass / 1 fail / 6 skipped**, from 30
failures at the start of the session. ⚠ The one red is `C-minted`, verified
PRE-EXISTING against the pre-session tree and carried to session 5: the `track.create`
mint diffs the bank after a fixed 144 ms budget where a readback exists, so under a
loaded session it withholds a mint it should have made. It fails CLOSED, and only in
the full 50-case run.

⚠ **`probe:e21-diag` is kept** — it is the record of how the defect was found, and it
is the cheapest way to re-check the behaviour after a Bitwig upgrade.

---

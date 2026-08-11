---
id: E16s
kind: evidence
state: active
source: FINDINGS.md
---

# E16s — a clip move is DETECTABLE, pushed, and `slot.moveTo` is ours to perform [K] (2026-07-31)

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

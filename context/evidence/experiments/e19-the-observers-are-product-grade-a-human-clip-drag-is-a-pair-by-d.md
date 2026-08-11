---
id: E19
kind: evidence
state: active
source: FINDINGS.md
---

# E19 — ⚠⚠ THE OBSERVERS ARE PRODUCT-GRADE: a human clip drag is a PAIR by DURABLE identity, and a note write is SILENT [K] (2026-08-08)

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

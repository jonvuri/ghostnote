---
title: Phase 1, session 3 — the bridge and the observers
status: ● DONE 2026-08-08. ⚠⚠ RE-SCOPED — the daemon was DELETED (D4 rev) before
        this session ran. Read §Re-scope FIRST; the original text below is kept
        as the record and is STALE wherever it disagrees.
        Filename keeps `-DAEMON` so the spike record's cross-references stay
        valid — the same tombstone convention standing rule 7 got.
updated: 2026-08-08
parent: PHASE-1-ENGINE.md
prev: PHASE-1-SESSION-2-TAKES.md
next: PHASE-1-SESSION-4-CONTROL-LAYER.md
scope: PHASE-1-ENGINE.md §Re-plan session 3
evidence: E1, E3, E8, E9, E15-A, E16p, E16s · D4 rev, D6, D10, D12, D16, D19
---

# Phase 1, session 3 — the bridge and the observers

## ⚠⚠ RE-SCOPE, 2026-08-08 — there is no daemon

> The original document below is KEPT as the record. Where it disagrees with this
> section, `E16-REPLAN.md` §2 session 3, or `DECISIONS.md` D4 rev, **this section
> wins.**

### What happened to `ghostnoted`'s three jobs

| job | disposition |
|---|---|
| own the bridge connection | → **the MCP server holds it** (`brain/src/session.ts`). A fraction of a session, as the re-plan predicted |
| host the take store | → **gone.** The system is stateless and the PROJECT is the take log (D17 rev, D18). What survives is the STASH, which is per-session by construction — so the lifetime a daemon existed to provide is a lifetime nothing needs |
| hold Bitwig observers | → **the EXTENSION**, which is strictly better: it is alive whenever Bitwig is, so it cannot miss an edit made while no client was attached. A daemon spawned on demand by its first client provably can — it would have shipped a blind spot shaped exactly like the one it was built to close |

⚠ And the fourth premise, which was never a constraint: **E16p measured the
revision guard atomic across connections**, so serialising every write through
one process buys ordering that is already guaranteed. Standing rule 7 is struck
and replaced by a statement about coherence rather than topology — **ordered is
not coherent**; a rejected batch must be re-planned by whoever sent it.
*(A single-writer refusal in `Bridge.java` is available and recorded UNADOPTED.
It is not built.)*

### ⚠ The two epochs, and which one clip addressing consults

The extension carries **both**, one indexed observer per bank row — so the whole
grid costs `tracks` observers, not `tracks × scenes` (`Rig.java`).

| | catches | blind to |
|---|---|---|
| **scene-count epoch** (`SceneBank.itemCount`) | scene create/delete, by anyone. E3's compaction | ⚠ a **MOVE**, which changes no count |
| **launcher-content epoch** (`ClipLauncherSlotBank.addHasContentObserver`) | a slot filling or emptying, by anyone — so a move arrives as a **PAIR** | who did it (the callback carries no author) |

E16s measured the asymmetry rather than predicting it: the count observer sat
still at 3 → 3 through a human clip drag that the content observer reported as
`t2s7=emptied` / `t2s3=filled`, agreeing exactly with the human's independent
report. **Clip addressing consults the content epoch.**

### ⚠ Three things this session's build added on top of E16s

1. **The log holds `channelId`, not a bank index.** E16s's log line was
   `"t2s7=emptied"`, and a bank index recorded now names whatever slid into that
   slot after any structural op (E2c/E3, standing rule 2). The durable id is
   captured **at callback time**, when the bank row and the track still agree. An
   event that cannot name its track is `unattributable` and fails the window
   closed rather than being dropped.
2. ⚠ **A generation nonce, minted per `init()`.** Both epochs are counters that
   restart at zero on every load, so after a Bitwig restart a mark taken *before*
   compares **equal** to one taken after — a difference that reads as no
   difference, which is the exact silent agreement the epoch exists to prevent.
   With a generation attached, an old mark is INCOMPARABLE rather than merely
   old, and every consumer refuses instead of concluding.
3. **The mark is one round trip.** `revision.get` now returns
   `{revision, generation, sceneEpoch, contentEpoch, contentEvents[]}`. The events
   ride along because the log is a **ring**: a reader that learned the epoch and
   fetched the names afterwards could have the names it needed pushed out in
   between, and would read the resulting short window as a quiet one.

⚠ **Epochs are DIFFERENCES, never absolutes.** Bitwig delivers initial values
through the same callbacks, so both are nonzero at rest. The three ways a window
can be intact-looking and empty while the world moved are modelled explicitly —
`truncated` (the ring dropped names), `discontinuous` (a previous life of the
extension), `unattributable` (an event with no track) — because each of them
reads as `events: []` if you only count.

### Where the detector is consumed

- **`Executor.run`** → `ApplyReport.concurrent` and `ApplyReport.undecidable`.
  ⚠ Events naming **our own** slots are dropped: the callback has no author, so a
  slot we filled produces exactly the event a human filling it produces, and
  keeping them would report every `clip.create` as a concurrent edit. Our own
  addresses are arbitrated by the verify readback and the stash fingerprint. This
  reaches **the slots we never touched**, where no fingerprint exists to ask.
  It **never refuses** — *"detection matters more than resolution here"*.
- **`Stash.boundary` / `planReversal`** → two new verdicts. ⚠ **`moved`** is the
  one the content fingerprint structurally cannot produce: drag a clip out and an
  identical one in, and every byte compares equal while the address means
  something else. **`undecidable`** downgrades `ours` — and only `ours`, and only
  for launcher cells — when the window cannot be evaluated. A reversal planned
  *without* a window still plans, and says so in its caveats.
- **`Session.ready`** → a reconnect onto a different generation **throws the
  adapter away** rather than reconciling it. Everything it holds is index- or
  epoch-shaped; D6 forbids trusting an index across a structural op and a restart
  is the largest one there is. ⚠ The **stash survives** — it records what we did,
  which is still true, and the boundary already reports its addresses as
  `undecidable` on its own.

### What this session did NOT build, deliberately

- **The MCP tool surface.** Still two tools. Versioned descriptions in fresh,
  jargon-free language and the annotated destructive surface are D18c/D20 work
  and belong to the branch-mechanisms session (3″). Widening the surface here
  would freeze a v0 vocabulary the moment before the vocabulary is designed.
- **A daemon, a local HTTP/WebSocket API, single-instance enforcement, spawn-on-
  demand lifecycle.** All four are original-scope items with no object any more.
- **Push notification** from extension to brain. Session 6, unchanged.
- **A single-writer refusal.** Recorded UNADOPTED; not ours to adopt here.

### Delivered

| where | what |
|---|---|
| `extension/…/Rig.java` | `ContentEvent` ring by durable identity, guarded observer body, `epochGeneration` |
| `extension/…/BatchHandlers.java` | `revision.get` is the MARK: both epochs, the generation, the event window |
| `brain/src/contract/observers.ts` | `ContentEvent`, `ContentDelta`, `deltaComplete`, `contentTouching`, `sliceDelta` |
| `brain/src/contract/snapshot.ts` | `RevisionMark` += `contentEpoch`, `generation` |
| `brain/src/contract/adapter.ts` | `contentSince(mark)` on the contract, so the fake can prove the fail-closed cases |
| `brain/src/adapters/live/adapter.ts` | ⚠ the self-counted `sceneEpoch` is **deleted**; both epochs are read |
| `brain/src/adapters/fake/{model,adapter,control}.ts` | the same ring size, plus `dragClip` / `replaceClipInPlace` / `floodContentEvents` / `restartExtension` |
| `brain/src/engine/executor.ts` | the concurrent-edit detector |
| `brain/src/stash/{record,stash}.ts` | `moved` and `undecidable` |
| `brain/src/session.ts` | the bridge connection and its lifecycle |
| `brain/src/probes/e19-observers.ts` | live PART A (autonomous) + PART B (⚠ human, foreground-gated) |

**279 offline tests green** (was 246): 11 in `observers.test.ts`, 5 conformance
cases that also run live, 5 executor cases, 5 stash cases, 7 session cases.

### Exit criteria, as met

1. ⚠ ~~The daemon spawns on demand and a second instance refuses~~ — **VOID**,
   no daemon. Replaced by: the MCP server holds the connection, opens it lazily,
   and re-handshakes on every reconnect (`N-lazy`, `N-handshake`, `N-version`).
2. ⚠ ~~Two clients through one daemon~~ — **VOID**. E16p already measured the
   guard atomic across connections; the replacement is the coherence statement
   above, which is a rule, not a mechanism.
3. ● **A scene created or deleted BY THE USER bumps the epoch, and a pre-existing
   scene-relative address is refused** — `O-scene`, `C-content`, `E19-A9`.
   Closes `PHASE-0-SESSION-2.md` item 5's first bullet.
4. ● **A user edit inside a take's write-set is detected and surfaced** —
   `X-concurrent` ×5, `B-moved` ×3. ⚠ Sharpened past what the criterion asked:
   the *identical-replacement* case, which no content comparison can see.
5. ● **A reconnect leaves the session working, with nothing stale in use** —
   `N-restart` ×2. The generation nonce is what makes it a detection rather than
   an assumption.
6. ⚠ ~~The MCP client writes only through the daemon~~ — **VOID** (rule 7 struck).
   The privilege split survives as a type split (`STASH_MUTATORS`, `surface.test.ts`).

### ● Proven live, 2026-08-08 — `FINDINGS.md` E19, 17/17

`probe:e19` PART A (12 checks) and PART B (5 checks, operator-driven drag) both
PASS. The three things no offline test could vouch for:

- ⚠⚠ **a note write into an OCCUPIED clip fires NO occupancy event.** The
  load-bearing negative — the detector's whole value is that silence means
  something, and a Bitwig noisier than the fake would make every batch report
  itself as a concurrent edit.
- ⚠⚠ **a human drag is a PAIR while the SCENE epoch sits still (7 → 7).** E16s's
  asymmetry re-measured through the durable-identity path, which is what justifies
  carrying two epochs rather than one.
- ⚠ **the events name the track by `channelId`**, captured at callback time.

⚠ Still unmeasured: a **cross-track** drag (PART B moved within one track, so both
events carried the same id), and a drag **below the bank window**, which §Owed
below predicts is invisible.

### ⚠⚠ OWED, found by this session's own probe: standing rule 5 is not implemented for SCENES

`probe:e19`'s first run stranded a scene in a 99-scene project.
`sceneBank.itemCount()` reports the PROJECT total (99, as `trackBank.itemCount()`
does per E15-A) while `sceneBank.getScene(i)` is bounded to the 16-wide WINDOW, so
`scene.create` appended at index 99 where nothing can address or delete it — rule
5's named failure verbatim, one population down.

⚠ **It is a product defect, not a probe one**, and the throw is the mild half:

| | |
|---|---|
| `encoder.ts` `scene.delete` | sends `op.scene.index` as a BANK index — a `SceneAddress` ≥ window throws from a real batch |
| `assertBankVisible` | covers tracks only; there is no scene budget anywhere |
| ⚠⚠ `Snapshot.unreachable` | **does not report clip rows past the window**, so a project with more scenes than the window has a silent blind spot — the under-delivery D5 forbids |
| ⚠ session 3's own observers | one indexed observer per bank row covers only slots INSIDE the window, so a human drag below the last visible row is undetectable |

⇒ **Owed: a scene-window precondition on `scene.create`, a window guard on
`scene.delete`, and scenes counted into `Snapshot.unreachable`.** Rule 5 already
mandates it, so this is an existing decision to implement rather than a new one to
propose. Not built here — it is executor/adapter work (session 1's territory) and
would have hidden inside this session's diff. `probe:e19` now checks the budget
BEFORE creating and skips that arm with an explanatory failure.
### ⚠⚠ THE FULL CARRY-FORWARD — everything this session leaves behind, with a home

> Written down at the operator's request so none of it is lost. **Homes marked
> ⚠ PROPOSED are recommendations, not decisions** (rule 10): 3‴ does not exist
> until the operator says it does.

#### From session 3's OWN original scope

| # | item | home |
|---|---|---|
| **A1** | ⚠ **Project change is undetected** | ● **CLOSED** — see §Project identity below |
| **A2** | ⚠ **No persistent "what the user did" log.** Observer job 3 of the original scope, verbatim: *"the change log's 'what the user did' side, which Phase 3 renders."* `ApplyReport.concurrent` is per-batch and dies with the take | **Phase 3**, and ⚠ **BLOCKED on B2** — see the reasoning below |
| A3 | The **local API** (loopback, *"designed as the API Phase 3's web view will consume"*) | **Phase 3** — ⚠ which `E16-REPLAN.md` §5 lists as not yet re-planned |
| A4 | **How a human button press is learned** (the original doc recommended polling `ui.state`) | **Session 4** — the button lives there |

⚠ **Why A2 is deferred rather than built, stated as a reason and not as
scheduling.** Its only feed is the content observers, which cover
`config.tracks × config.scenes` and nothing beyond (**B2**). A per-batch REPORT
survives that hole, because `assertVisible` refuses a batch whose addresses are
not visible — the report's scope is bounded to ground that was checked. A LOG
claims to describe the whole project over time, so the same hole becomes a silent
omission in a record Phase 3 renders as complete. **Building it before B2 ships
the failure class this project exists to prevent.** Two supporting reasons: its
only reader is un-replanned, and PHASE-1 §Risks names this exact hazard — *"the
local API grows into Phase 3's UI backend by accident"*. Retention also has no
policy since D17f died with the store, and the log is human-owned under rule 8,
so its privilege boundary needs designing rather than improvising.

#### Falling out of this session, in severity order

| # | item | home |
|---|---|---|
| **B1** | ⚠⚠ **Standing rule 5 is not implemented for SCENES** — a budget precondition on `scene.create`, a window guard on `scene.delete` (`encoder.ts` sends a project index as a bank index), and scenes counted into `Snapshot.unreachable`. Found by `probe:e19`; see §Owed above | ⚠ **PROPOSED: 3‴** |
| **B2** | ⚠⚠ **The observers inherit the same blind spot, in BOTH dimensions.** By construction in `Rig.java`, `addHasContentObserver` is attached per bank row across `config.tracks`, on a slot bank sized by `config.scenes`. An edit on a track past the track window, or a scene row past the scene window, fires **nothing** — and `ContentDelta` reports it as a clean, complete, empty window. ⚠ This partly undercuts session 3's own claim: `deltaComplete` returns `true` for a case where the world moved unobserved. It is a **fourth** way a window can lie and, unlike the three that ARE modelled, it is not detectable from the delta | ⚠ **PROPOSED: 3‴** |
| **B3** | ⚠ **The stash and the whole reversal path are UNWIRED.** Nothing in production calls `stash.record()` or `planReversal()` — `Session` owns a `Stash` nothing writes to, because the MCP surface is still `ping` and `read_notes`. So `moved` and `undecidable`, the verdicts this session's justification rests on, are exercised **by tests only**. Not a session-3 defect (there was no write tool to wire them to), but two obligations that are easy to miss: **record every take**, and pass **`launcher: await adapter.contentSince(take.at)`** to every reversal | **Session 3″** (the tool surface) |
| B4 | **The executor's three selection capture/restore pairs per pipeline** (`adapter.ts`, the ⚠ on `captureSelection`) blamed the daemon for being unable to hoist them to one. There is no daemon; the component that knows a pipeline is in progress is the **executor**, so this is now a plain refactor with no blocker | **Session 5**, or a cleanup pass |
| B5 | **Two unmeasured drags** — ⚠ **cross-track** (E19 PART B moved within one track, so both events shared a `channelId`; the two-track case should produce two, and that is an INFERENCE, not a measurement) and **below the bank window**, which B2 predicts is invisible | **Session 5**'s live sweep |
| B6 | **`config.scenes` scale is unmeasured.** It sizes the scene bank AND every slot bank, so raising it to fit real projects multiplies observer count. E5 measured track-side scale only | ⚠ **PROPOSED: 3‴** |

#### ● Project identity — A1, closed in this diff

The original doc called *"what happens to in-flight state when Bitwig restarts or
the project changes"* the sharpest question in the session. The restart half was
closed by the generation nonce. This is the other half, and it is **worse than the
restart**, which is the reason it was built now rather than deferred:

| | tell |
|---|---|
| extension restart | the counters go **backwards** — anomalous on its face, and `generation` catches it |
| ⚠⚠ **project change** | the extension never re-`init()`s, so the counters **keep climbing** and the window looks like an ordinary busy one — while every `channelId` names a track in a project that is no longer open |

`RevisionMark` therefore carries `project` beside `generation`, read from
`Application.projectName()` (marked at init in its own `try`, with a
`projectStatus` string, because *"the handle does not exist"* and *"the value is
empty"* are indistinguishable in the outcome). `discontinuityBetween` is shared by
both adapters so neither can be more forgiving than the other, and it reports
which of the two happened, because the two need different sentences.

⚠ **Three deliberate properties, each the fail-closed direction:**

- **An UNKNOWN project is not a match.** An older extension, or one whose handle
  was never obtained, reports `''` — and `''` is treated as incomparable, never as
  "the same". "We could not tell" resolving to "unchanged" is the one direction
  that writes into the wrong project.
- ⚠⚠ **A NAME IS NOT AN IDENTITY** (rule 2; E17 method guard 1). Two projects can
  share a name and a rename is not a project change, so this catches the changes
  it SEES and cannot promise it saw them all. It is a **`lossy` detector**,
  documented as one, and may never be used to ADDRESS anything — only to refuse a
  comparison. Strictly better than the nothing it replaces; not a replacement for
  D17a's retired `projectKey`.
- **`Session.ready()` rebuilds the adapter on a project change**, for a stronger
  reason than on a restart: the `channelId → index` map does not merely hold stale
  positions, it holds keys for tracks that no longer exist.

⚠ **Cleanup that fell out:** `EpochDiscontinuityError` was **deleted**. It was
added earlier in this session, exported, and never thrown — because every consumer
is designed to REPORT rather than refuse (`ContentDelta.discontinuous`, the
`undecidable` verdict). A dead error class that looks like a guard is worse than
no guard at all.

● **Proven live 2026-08-08** (`FINDINGS.md` E19): `E19-A11a/b/c` pass, and the
project-change arm measured the premise rather than assuming it —

```
armed in  "gn-scale-test"              contentEpoch 296
read  in  "Channel UUID test project"  contentEpoch 329     generation UNCHANGED
```

⚠⚠ The epoch **climbed by 33**: a stale mark's window is a perfectly ordinary busy
one. Contrast the extension reload measured in the same sitting, where the counters
came back **lower** (308 → 290, 7 → 2). Two discontinuities, two tells, and only one
of them is visible in the numbers.

⚠⚠ **It follows the FOREGROUND project, not the audio engine — so a TAB SWITCH
fires it.** Found because the operator noticed `gn-scale-test` kept the engine while
the extension reported the other project. Good for safety (the dangerous state
begins at the switch, not at the load) and a **cost** to carry: `undecidable` will
appear more often than "project loads" would suggest, and a mechanism that cries
wolf is one nobody honours.

Offline: `O-project` ×3, `N-project`, and `C-mark` extended.

#### ⚠⚠ NEW, owed — the ADDRESS path never consults `generation` or `project`

Found while re-verifying a reviewer's report about the fake's `restartExtension`
(both of that reviewer's findings were real and are fixed — see §Review fixes).
The narrow bug was the fake being more permissive than Bitwig; underneath it is a
gap in the real thing.

`resolve()` and `read()` authorise a scene-relative address on ONE comparison:

```ts
if (sceneRef.epoch !== at.sceneEpoch) → stale-epoch
```

⚠ **No generation, no project.** So an address minted at the RESTING epoch
survives a restart by coincidence — verified, not reasoned:

```
minted at epoch 1 -> restart -> found = true
```

⇒ ⚠⚠ **This is the session's own headline defect, one layer down.** *"A stale
mark is INCOMPARABLE, not merely old"* is enforced at the WINDOW level
(`discontinuityBetween`) and not at the ADDRESS level, where the numeric epoch
can collide across two lives of the extension or two projects — a difference that
reads as no difference, which is exactly what `generation` was introduced to
abolish.

**Reachability, stated honestly rather than talked up.** Two of the three paths
are already covered: `Session.ready()` REPORTS `restarted`/`projectChanged` so a
caller knows to re-resolve, and the stash boundary reports `undecidable` through
`discontinuityBetween`. The hole is a caller holding a RAW address across a
discontinuity and reading through it without consulting either — and per **B3**,
nothing in production mints and holds addresses across batches yet. **Real, and
currently unreachable.** It becomes reachable the moment 3″ wires the write
surface.

⚠ **Fixing it is a DECISION, not a bug fix, which is why it is proposed rather
than built.** The clean form is `SceneAddress` carrying the generation and
project — and this session already **rejected** putting extra identity on the
address (§Decisions proposed by session 3, item 1) on key-grammar grounds. That
argument was about adding a *dimension* to a comparison that worked; this is
about the comparison being sound at all, so it deserves re-litigating on its own
terms rather than inheriting the earlier answer. The alternative — adapter-side
state that refuses everything positional after a discontinuity — has no clean
lifetime, since nothing signals "the caller has re-resolved".

#### ● Review fixes, 2026-08-08

An independent review flagged two issues. **Both were real**, both reproduced with
a failing test before any change, and both were cases the existing tests
structurally could not reach.

1. ⚠⚠ **A REJECTED batch filtered its own intended write-set out of
   `concurrent`.** The rejection path passed the write-set to the same filter the
   applied path uses, so an edit on a slot the batch MEANT to write was dropped —
   and that is the single most informative event the detector can see, because it
   is very likely what caused the rejection. ⚠ Nothing else covered it: a rejected
   take's `verify` IS its stash, so no disagreement is computed, and
   `planReversal` returns empty for an unapplied take, so the boundary never runs.
   The existing reject test dragged on a DIFFERENT track and so never touched the
   filter. **Fixed:** the filter is skipped entirely when nothing applied — zero
   ops means there is no own-event to confuse anything with — and the refusal text
   says so. `whoApplied` had been a string used only in an error message; it is
   now the boolean that drives both.
2. ⚠ **The fake's `restartExtension()` reset the content epoch and not the SCENE
   epoch.** Live, `sceneCountChanges` is an observer like any other and comes back
   at its resting value (measured 7 → 2, `FINDINGS.md` E19). Carrying the old
   value let a scene-relative address minted before a fake restart keep
   AUTHORISING where live it is refused — **the fake being more permissive than
   Bitwig, which is the one direction PHASE-0 §Risks says it must never be wrong
   in.** `O-restart` passed throughout because it checks the window, and the
   window consults `generation`. **Fixed:** `RESTING_SCENE_EPOCH` is a named
   constant the field initialiser and the restart both read, so the two cannot
   drift. The new test mints at a NON-resting epoch deliberately — at the resting
   value it would pass by coincidence and prove nothing.

#### ● CLOSED — `contract.hello` cannot detect a stale extension

Found the expensive way: the first PART A run after deploying failed `E19-A11a/b`
against a jar Bitwig had not picked up, and **`probe:hello` had passed immediately
before** — all green, 135 methods, `methodsHash` matching the golden.

⚠ **`methodsHash` is over method NAMES.** Every field this session added —
`generation`, both epochs, `contentEvents`, `project` — is invisible to the
handshake, so any change that adds fields to an existing method's reply passes a
stale check. The accidental tell was the generation nonce reading byte-identical
to the previous run; nothing was designed to catch it.

⇒ ● **CLOSED 2026-08-08 — `brain/src/deploy.ts`.**

⚠⚠ **The obvious fix was rejected.** A build id stamped into the jar and compared
against a checked-in golden has the flaw that kills this class of guard: it needs
the golden regenerated on every extension change, so the routine action becomes
*"the check is noisy, regenerate it"* — and a check people routinely silence is
not a check. It also only ever detects what someone remembered to stamp.

**What was built asks a question needing no maintenance at all:**

> *was the deployed file written AFTER the running extension started?*

If it was, the running instance predates the file and cannot be it — true
regardless of what changed, so it generalises past the bug that motivated it.
⚠ `initEpochMs` was **already on the wire** (`rig.stats`, E5's init-cost
measurement), so the extension needed **no change whatsoever**.

- `Session.ready()` **refuses** with `StaleExtensionError`, for the same reason a
  contract mismatch does, and re-checks on every reconnect — a redeploy
  mid-session is the ordinary development case and precisely when a stale
  instance appears.
- `probe:hello` gained it as a **check that can fail the run**, not a note. A
  warning printed among passes is what `ALL PASS` already was.
- ⚠ Absence degrades to `unknown` and blocks nothing (D12's loopback posture); the
  `-1` sentinel is `unknown`, never a timestamp.
- ⚠ Not a content check: touching the file reads as stale. Accepted — the remedy
  is one reload, and hashing a zip per handshake buys precision nobody needs for
  a failure whose real cause is always *"I forgot to reload"*.

⚠ **Verified in both directions** (E17 method guard 10): fresh against the live
extension, then the jar's mtime pushed forward to reproduce the FAILURE — it
failed loudly, named the manual reload, and said why the handshake had missed it —
then the mtime restored. A guard only ever shown saying yes is not a guard.
Offline: `D-*` ×5 (pure arithmetic, filesystem injected) and `N-stale` ×3.

⚠ **Also owed, documentation-level, NOT done:** `build.gradle`'s comment says
Bitwig hot-reloads on the atomic rename. It did not, and
`ContractVersionError`'s message already says to reload by hand. One of the two
is wrong and it is the comment.

#### ⚠ PROPOSED — a session 3‴, *the window*

**Recommendation, not a decision.** B1, B2 and B6 plus A1's cousin are all the
same shape: **bank-window truth that the model assumed for tracks and never
generalised.** B1 and B2 share a fix — one scene/track budget that the ops, the
snapshot AND the observers all read — and splitting them across sessions is how
one gets done and the other does not. A2 unblocks the moment B2 lands.

⚠ Note what 3‴ is NOT: it is not new design. Standing rule 5 already mandates
B1 in words that cover scenes verbatim, so this is **implementing an existing
decision**, which is why it is proposed as a small session rather than as a
decision for `DECISIONS.md`.

---

# Phase 1, session 3 — `ghostnoted` *(the original document, kept as the record)*

> **Purpose.** Turn sessions 1 and 2 from libraries into a **process**: the single
> owner of the bridge connection, the adapter, the take store and the change log.
> This is also the only place Bitwig **observers** can live — which is what makes
> the change log trustworthy while the user is editing concurrently (§8d), and
> what finally closes the `sceneEpoch` blind spot Phase 0 shipped knowingly.

## Why this is third

D4 settled the topology, and its reasoning is about *lifetime and privilege*: an
MCP stdio server is a subprocess of the chat client, so in-memory checkpoints die
with the session, and **every channel into that process is a channel the agent can
also use** — leaving revert-as-a-human-verb nowhere to live. The daemon exists to
give the store a lifetime longer than a conversation and a privilege boundary the
agent is on the wrong side of.

It comes after the engine and the store because it *hosts* them. A daemon built
first would have nothing to serve and would acquire lifecycle bugs before anything
it manages had correctness ones.

## Scope

### In

1. **The process.** `ghostnoted`, spawn-on-demand from its first client (the
   expected lifecycle per PHASE-1 §Scope 1). One bridge connection, one adapter,
   one engine, one store.
2. **⚠ Single-instance enforcement.** Two daemons racing for one bridge socket is
   the failure mode PHASE-1 §Risks calls "the classic time sink." A second
   instance must refuse to start, loudly.
3. **The local API.** Loopback only. Minimal for Phase 1 — enough for the MCP
   client to write and for session 4's control layer to be driven — but designed
   as **the API Phase 3's web view will consume**, because it is, and retrofitting
   is what §3's reorderable-seam note is trying to avoid.
4. **The MCP server as a client.** `brain/src/mcp-server.ts` already exists as an
   E9 skeleton and the SDK "sits cleanly on `client.ts` with no surprises." It
   stops owning an adapter and starts calling the daemon.
5. **⚠ Observers — the capability that justifies the process.** Three jobs:
   - **Scene ops.** `LiveAdapter.sceneEpoch` counts only *our own* scene ops
     ([adapter.ts:72](../../brain/src/adapters/live/adapter.ts#L72)); a scene the
     **user** creates or deletes does not move it, so a stale scene-relative
     address still resolves as `found` while E3's compaction has already shifted
     every row beneath it. That is precisely the silent mis-write the epoch exists
     to prevent. Phase 0 documented it at the field, in `address.ts`, and in
     `PHASE-0-SESSION-2.md` item 5 as a **P1 dependency, not an oversight**. This
     session closes it.
   - **User edits inside the write-set** — the stale-take problem. The revision
     guard catches *ordering*; a take whose stash no longer describes the clip is
     a different failure.
   - **The change log's "what the user did"** side, which Phase 3 renders.
6. **All writes through the daemon** (standing rule 7 / D10). The revision counter
   guards ordering across processes but **cannot detect omission** — a bypassing
   write leaves a silent gap in the take log. Make the bypass structurally
   awkward, not merely discouraged.
7. **Lifecycle.** Bitwig restart, project change, bridge disconnect and reconnect,
   stale sockets, orphaned processes.

### Out

- The in-Bitwig panel — session 4. This session may poll a `ui.state` method, but
  builds no UI.
- Push notifications from extension to daemon — session 6 (optional). Polling is
  the Phase-1 answer; see Decisions.
- Authentication. D12 is explicit: **the socket is unauthenticated**, the gate is
  the daemon, and the socket is the soft underbelly. Firewall it; do not mistake
  policy for a boundary. Nothing in this session should imply otherwise.
- The web view — Phase 3.

## Decisions this session must make

- **Daemon lifecycle: spawn-on-demand vs. login agent.** PHASE-1 names
  spawn-on-demand as expected. *Recommendation: keep it* — a login agent is a
  packaging problem and a debugging tax for a personal tool.
- **⚠ What happens to in-flight state when Bitwig restarts or the project
  changes.** The sharpest question in the session. The take store is project-keyed
  (session 2), so a project change is a store switch — but an in-flight batch, a
  pinned cursor pool and a revision counter all belong to a Bitwig that just went
  away. *Recommendation: treat bridge disconnect as fatal to session state and
  cheap to rebuild* (re-`hello`, re-resolve, re-pin) rather than trying to
  reconcile — D6 already forbids trusting any held index across a structural op,
  and a restart is the largest structural op there is.
- **How the daemon learns a human pressed a button.** The Bridge is
  request/response only; a `Signal` fires *inside the extension*. *Recommendation:
  the daemon polls a `ui.state` method at a modest interval.* It needs nothing new,
  and a revert button is a rare deliberate act where 100ms of latency is invisible.
  Session 6 generalizes this into a push, which is the same machinery as deferred
  batch responses — worth knowing, not worth waiting for.
- **What the local API's shape is** — the decision Phase 3 inherits. HTTP +
  WebSocket on loopback is what PHASE-3 §Scope 1 assumes.
- **Detection vs. resolution for stale takes.** PHASE-1 is explicit: *"Detection
  matters more than resolution here — surface it, don't guess."* Decide what
  "surface it" concretely means before writing the detector.

## Exit criteria

1. The daemon spawns on demand, holds **one** bridge connection, and a second
   instance refuses to start.
2. Two clients (the MCP server and a test client) operate through one daemon
   without interfering, and the revision guard arbitrates between them.
3. **A scene created or deleted by the user in Bitwig bumps the epoch** and a
   pre-existing scene-relative address is then refused rather than silently
   resolved — closing `PHASE-0-SESSION-2.md` item 5's first bullet.
4. A user edit inside a take's write-set is **detected and surfaced**, with the
   take marked stale rather than silently reverted over.
5. A bridge disconnect and reconnect leaves the daemon working, with pool cursors
   re-pinned and no stale indices in use.
6. The MCP client can write only through the daemon, and the take log has no
   agent-reachable mutation path (session 2's split API, now across a process
   boundary).

## Risks

- **⚠ Daemon lifecycle bugs are the classic time sink** (PHASE-1 §Risks) — stale
  sockets, orphaned processes, two daemons racing. Mitigation, per that doc: the
  extension's revision counter is **already** the cross-process arbiter of
  ordering (E8, thread-confined to the control-surface thread and therefore atomic
  for free). Lean on it rather than inventing daemon-side locking.
- **Observers are a new failure surface at `init()`.** Standing rule 9 / D11:
  check `@Deprecated` before wiring any handle there, because some deprecations
  throw and take the whole extension down (E7-Finding-0). And D7's amended rule —
  **anything Bitwig hands out is init-only until proven otherwise**, now on four
  independent subsystems. `npm run probe:hello` after every deploy.
- **The local API grows into Phase 3's UI backend by accident.** Mitigation:
  PHASE-3 §Scope 1 already says it must be designed as an API a second client
  would use. Keep Phase 1's surface small and honest rather than convenient.
- **Observer volume.** E5 measured scale on *empty* tracks; device-side scale is
  explicitly unmeasured (`PROJECT_PLAN.md` §7 → P4). Scene and clip observers are
  a different population from device banks, but this is the session that would
  first notice, so watch the control-surface tick.

---
title: Phase 1, session 2 — the take store: persistence, branching, partial revert
status: DONE 2026-07-26 — all six exit criteria met offline; decisions recorded as
        DECISIONS D17. The project-key SOURCE is a port, unwired until session 3.
        ⚠ The BRANCHING TOPOLOGY (D17 §b, §c) is PROVISIONAL pending E16 — see
        ../spike/SPIKE-E16-BRANCHES-AS-TRACKS.md. The build is not invalidated by it.
        See the outcome log at the foot.
updated: 2026-07-26
parent: PHASE-1-ENGINE.md
prev: PHASE-1-SESSION-1-EXECUTOR.md
next: PHASE-1-SESSION-3-DAEMON.md
scope: PHASE-1-ENGINE.md item 4
evidence: E3, E8, E14 (rows A–D) · D5, D8, D14
---

# Phase 1, session 2 — the take store

> **Purpose.** Give session 1's in-memory stashes a durable, branchable, human-owned
> home. A batch creates a **take**; takes can be compared, jumped between, branched
> from, and **partially reverted by musical address**. Still entirely offline.

## Why this is second

Session 1 produces takes as values. This session decides what a take *is* on disk
and what can be done to one — and that shape is load-bearing twice over: the
daemon (session 3) serves it, and **Phase 3's diff renders it**. §8f's "one
mechanism, two features" means a schema mistake here is paid for in a later phase,
which is a good reason to settle it while the only consumer is a test.

It is deliberately *before* the daemon. A store that is a library with a directory
path can be tested exhaustively offline; a store that is born inside a daemon
process acquires lifecycle bugs before it has correctness ones.

## Scope

### In

1. **The take schema.** At minimum: id, parent, timestamp, project key, the ops as
   requested, the **stash** (prior state of exactly the write-set), the receipt,
   the verify snapshot, and the **fidelity summary**. D5 and PHASE-1 §Risks agree
   the label ships in the schema *from the first write* rather than being added
   later — session 1 computes it, this session persists it.
2. **On-disk, project-keyed.** Take contents live in the daemon's store
   (`~/.ghostnote/…`), not in the project document. But the **active take pointer**
   is naturally project-scoped: `getDocumentState()` settings persist inside the
   project file and survive save + full Bitwig restart, per project (● E14). The
   split is deliberate — see Decisions.
3. **Branching.** Reverting to an earlier take and proceeding must not destroy the
   branch left behind ("go back to the sparse hats, keep the new bass"). A parent
   pointer and a head pointer are very nearly the whole model.
4. **Partial revert by musical address.** The write-set is already a list of
   `Address` values with a canonical `addressKey`
   ([address.ts:118](../../brain/src/contract/address.ts#L118)) explicitly built
   "for write-set diffing and partial-revert slicing" — so slicing is a filter over
   the stash, and the result feeds session 1's `revertOps` unchanged.
5. **Retention and pruning.** Depth, and what happens to old branches.
6. **⚠ Human-ownership, made structural.** §8g / standing rule 8: the agent may
   read and explain the log, never mutate it. This session's mitigation is a
   **split API surface** — a read interface and a mutate interface as separate
   types — so session 3 can hand the MCP client the read half and the design makes
   the violation hard rather than merely forbidden. D14 notes the daemon must keep
   the agent off those endpoints; the type split is what makes that reviewable.

### Out

- The daemon process and its lifecycle — session 3.
- **⚠ Any take-switching UI.** D14 sends take navigation to Phase 3, and session 4
  builds no chooser — so this store's A/B verb is exercised by tests and the
  daemon API in Phase 1, and by a human only in Phase 3. **That raises the stakes
  on this session's exit criteria**, which are now the only thing standing between
  a wrong store design and a phase-late discovery.
- Rendering diffs — Phase 3. This session owes the *data*, and owes it in a shape
  a diff can consume, but renders nothing.
- Cross-project take migration. Out of scope permanently unless something asks.

## Decisions this session must make

- **What the project key is.** Take contents are keyed by project, and the store
  must recognise "the same project" across close and reopen. Options: a path hash,
  or a UUID minted into `getDocumentState()` on first write (which survives save +
  restart, ● E14) and used as the key thereafter. *Recommendation: the latter* —
  it survives the file being moved or renamed, and E14 already proved the storage
  works. It also means an unsaved project has no key, which is a case to answer
  rather than discover.
- **⚠ Partial-revert granularity — "cheapest useful answer first."** By clip? By
  track? By time range? By pitch range? *Recommendation: by `addressKey` prefix,
  which gives track and clip for free and needs no new concepts*, with time/pitch
  slicing deferred until a real session asks for it. PHASE-1 §Risks names
  over-modelling here as the phase's top design risk.
- **Where the active take pointer lives**, and what happens when the daemon's
  store and the project document disagree — e.g. the project was reopened from a
  backup, or takes were pruned while it was closed. Detection matters more than
  resolution; surface it.
- **Retention policy.** How deep, and whether takes survive project close (they
  are on disk, so the default is yes — the question is for how long).
- **Whether a take is named.** "That take had a better hi-hat" is D5's motivating
  sentence, and it implies the human can label one. Cheap to add now.

## Exit criteria

1. Two takes can be created, compared, and jumped between; jumping back and
   writing again **branches** rather than truncating, and the abandoned branch is
   still reachable.
2. A **partial** revert restores one clip's notes from a take and leaves the rest
   of that take's write-set untouched.
3. The store survives a process restart: takes written before, readable after,
   with fidelity labels intact.
4. Every take carries a fidelity summary; a take containing a `none`-fidelity
   entry says so before a revert is attempted, not during.
5. The mutating half of the store API is **not reachable** from the read
   interface, asserted by a test in the spirit of `WIRE_METHODS_BANNED`.
6. Offline in CI, with no Bitwig and no daemon.

## Risks

- **⚠ Take branching is more design than expected** (PHASE-1 §Risks, verbatim).
  It is a graph, not a stack, and the temptation is a general VCS. Mitigation: the
  concrete requirements are exactly A/B comparison and partial revert. Build those
  two verbs and stop. If a merge operation appears in the design, something has
  gone wrong.
- **The schema calcifies before Phase 3 knows what it needs.** Mitigation: the
  stash is already the diff source by construction (§8f), so the risk is confined
  to *metadata*, and metadata is cheap to version. Give the on-disk format a
  version field on day one — the project already has a `CONTRACT_TAG` idiom to
  copy.
- **Store corruption from a half-written take.** A crash mid-write should not
  leave an unreadable store. Write-then-rename is the standard answer and is worth
  the twenty minutes now.

---

# Outcome log (2026-07-26)

> **All six exit criteria met against the fake; 214 offline tests green in ~1.1s**
> (26 of them new). Decisions recorded as **D17**. One item is built but unwired —
> see §Handed to session 3.
>
> ⚠ **Read §Under review before building on the branching model.** A proposal
> raised the same day this session closed would change the topology, though not
> most of the code.

## What shipped

`brain/src/store/`, a **library with a directory path** — not a component of the
daemon, which is the whole reason this session came before session 3:

| file | what |
|---|---|
| `format.ts` | `StoredTake`, `STORE_FORMAT`, `TakeSummary`, write-then-rename |
| `graph.ts` | the parent/head graph, the path walk, and the diff — pure, no I/O |
| `slice.ts` | partial revert as a filter over `addressKey` |
| `project.ts` | the project-key port, and who wins a pointer disagreement |
| `store.ts` | `TakeLog` (read) / `TakeWriter` (mutate), retention, disk |

Layout is `~/.ghostnote/projects/<projectKey>/{meta.json,takes/<id>.json}` — one
file per take, so a crash can damage at most the take being written, and
write-then-rename means it cannot damage even that.

## Decisions — recorded in full as D17, summarised here

- **Project key: a UUID minted into `getDocumentState()`** (E14-A3/A4 already
  proved the storage). ⚠ *Rejected: a path hash* — humans move project files, and
  every move would silently orphan the whole log. An unsaved project still gets a
  key; the orphan case is answered, not detected.
- **⚠ Branching is a PATH WALK**, not "restore the target take's write-set" — the
  cheap version leaves the other branch's work in place and calls it the target
  state. Unwind arm takes the oldest stash, replay arm takes the newest verify,
  replay overrides. No merge; the §Risks tripwire is intact.
- **⚠ Navigation moves the HEAD; a partial revert APPENDS.** The sharpest trap in
  the session — recording a navigation as a take makes the next jump undo the
  undo. Every plan carries `lands: 'take' | 'new-state'` so the caller cannot get
  it wrong by accident.
- **Slicing by `addressKey`**, as plain serializable data. ⚠ Time/pitch ranges are
  **refused rather than deferred**: E8-E's truncation means a sub-range restore
  would need a *merge* of stashed and live notes.
- **⚠ On a pointer disagreement the PROJECT wins**, because the pointer and the
  music are written by the same save. A pointer we have never seen moves nothing.
- **Retention: depth 200, childless takes only**, protecting head, labels and any
  take with children. Overshooting the depth beats deleting something protected.
- **⚠ The read/mutate split is an OBJECT, not a cast.** `store.log` is a frozen
  plain object; `STORE_MUTATORS` names the other half; a test asserts none of them
  is reachable, in the `WIRE_METHODS_BANNED` idiom.

## ⚠ Three things the build found

1. **"No slice given" and "a slice that selects nothing" are different, and
   conflating them is DATA LOSS.** The first version tested for empty key lists,
   which made `selectClip(take, aClipTheTakeNeverTouched)` identical to "revert
   everything" — so a human asking to revert one clip would have had the whole
   take reverted, silently, *because their request matched nothing*. Found by a
   test.
2. **An address a take could not VERIFY must not be replayed forward.** E3's case
   leaves no `verify` entry, and an absent notes entry means "no clip here"
   everywhere else — so a forward jump would `note.clear` music we never saw. Same
   distinction, and same reason, as session 1's `ApplyReport.unverified`.
3. **`gain` is withheld on the way FORWARD too, and nobody wrote that.** Replaying
   a take forward replays its *verify*, which holds the doubled readback — a
   direction session 1 never exercised. D16b's withholding is derived from
   `NOTE_PROP_FIDELITY`, so it protects both. Without it every A/B comparison would
   double the gain again, compounding, in silence.

## Exit criteria — how each was met

| # | criterion | test |
|---|---|---|
| 1 | two takes created, compared, jumped between; branching, abandoned branch reachable | `S-branch` ×3, incl. a cross-branch jump the cheap design gets wrong |
| 2 | a partial revert restores one clip and leaves the rest untouched | `S-partial` ×2 |
| 3 | survives a process restart, fidelity labels intact | `S-restart` ×4 (incl. crash debris, a foreign contract, a corrupt meta) |
| 4 | every take carries a fidelity summary; a `none` entry says so before a revert | `S-fidelity` ×3 |
| 5 | the mutate half is unreachable from the read interface | `S-split` ×3 |
| 6 | offline in CI, no Bitwig and no daemon | all of the above, plus `S-offline`, which asserts the module imports no adapter and no process |

## Handed to session 3

- **`ProjectKeySource` is a port with no live implementation.** The daemon owns
  the bridge, so it wires `readKey`/`writeKey`/`readPointer`/`writePointer` to a
  `getDocumentState()` String setting. ⚠ That setting must be **pre-allocated at
  `init()`** (E14-C2 / D7) — it cannot be created later.
- **`store.log` is what the MCP client gets.** Session 3's exit criterion 6 is
  this session's split carried across a process boundary; the type and the test
  are already there to point at.
- **`plan.lands` is the contract for apply-then-record.** `store.test.ts`'s `goTo`
  helper is the reference wiring, written out in the test on purpose: the store
  must not apply anything, because it has no adapter and cannot know whether the
  ops landed.
- **Stale takes are still session 3's.** The store carries each take's
  `RevisionMark` so a detector has something to compare against, and nothing here
  guesses. A navigation that partially fails leaves the world short of the take
  the head names — the plan reports `unrestored`, and only observers can catch the
  rest.

## ⚠ Under review — the branching topology, not the build

Raised the day this session closed, and recorded so nobody builds on §b/§c as
though they were closed: **[SPIKE-E16](../spike/SPIKE-E16-BRANCHES-AS-TRACKS.md)
proposes representing branches as duplicated tracks.** A branch point duplicates
the tracks an operation is about to touch and writes only to the copies, which
would make revert *delete a track* — exact for the whole `none`-fidelity class —
and A/B a *mute toggle*, instant and workable while the transport rolls.

**It is entirely unmeasured.** It rests on whether a top-level `Track` can be
duplicated at all, which nobody has probed (standing rule 10). What this session
should carry forward either way:

- **Nothing here is invalidated.** The write path is unchanged — a write into a
  duplicated track resolves, stashes, applies, verifies and reports exactly as it
  does now. The stash remains mandatory: delete a branch track and the take's
  content is gone unless the store independently holds it. Partial revert cannot
  be expressed by deleting a track.
- **Most of the module is topology-independent**: `format.ts`, `slice.ts`,
  `errors.ts`, the `TakeLog`/`TakeWriter` split, retention's mechanics and the
  project-key half of `project.ts`.
- **`graph.ts` is what changes**, and probably by generalization rather than
  rewrite: the walk operates over addresses, so per-track partitioning makes the
  graph a forest and the same walk runs per component. ⚠ Confirm rather than
  assume.
- **The exit criteria stay honest either way.** They assert on real ops through
  the executor rather than on bookkeeping, so they measure behaviour that survives
  a topology change.

## Not done, deliberately

- **No take-switching UI**, per D14 — so the store's motivating verb is exercised
  by tests only until Phase 3. That was known going in and is why the exit
  criteria drive real ops through the executor rather than asserting on
  bookkeeping.
- **No cross-project migration**, permanently, unless something asks.
- **The whole store loads into memory on open.** Honest at depth 200 for a
  personal tool; the ceiling is stated rather than engineered around.

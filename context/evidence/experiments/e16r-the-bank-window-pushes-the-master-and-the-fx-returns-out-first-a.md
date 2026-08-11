---
id: E16r
kind: evidence
state: active
source: FINDINGS.md
---

# E16r — ⚠ the bank window pushes the MASTER and the FX RETURNS out FIRST, and a fork at the ceiling is an orphan [K] (2026-07-30)

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

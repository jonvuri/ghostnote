---
title: Banks — windows, eviction order and pre-allocation
kind: capability
state: active
updated: 2026-08-15
scope: bank windows, cursor pools, scaffold sizes and init-time allocation
evidence: E1, E5, E14, E15, E16r, E16u, E22; D6, D7, D20
---

# Banks

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number or names its observer and date. Read the four
> rules in [INDEX.md](INDEX.md) before you edit this page.

A bank is a fixed-size window onto a larger project. It is a **hard resource
budget**, not a tuning preference, and the failure modes are silent. This page is
mostly about those failure modes.

---

## 1. `itemCount()` reports the project total, not the window — ●

Measured live: a project of 17 tracks against a 16-track bank reported
`itemCount=17` while only 16 rows were visible. The Master had fallen out of view
[K, [E15](../experiments/e15-phase-0-findings-bank-window-and-same-request-write-semantics.md) §A].

⚠ **This is what makes an overflow refusal implementable at all.** Before it,
*"16 tracks exist"* and *"16 of 54 are visible"* were indistinguishable from the
extension side, because `track.list` iterates to the configured bank size and
filters on `exists()`.

⇒ `rig.stats`, `rig.scanTracks` and `track.list` report `itemCount` and
`bankSize`, and `LiveAdapter` refuses to operate when `itemCount > bankSize`
(`BankWindowOverflowError`) [K, E15].

---

## 2. ⚠⚠ The Master and the FX returns leave the window FIRST

| Row | Result |
|---|---|
| Which tracks fall out, and in what order | ⚠ **Master at 17, then FX 1 at 18**, stable at 14 thereafter |
| Position 0 | never moved |

[K, [E16r](../experiments/e16r-the-bank-window-pushes-the-master-and-the-fx-returns-out-first-a.md)]

**Why, and neither simple model explains it alone.** A flat bank orders regular
tracks, then FX returns, then the Master. Every new track is inserted *before*
that tail. So the tail's positions rise and cross the ceiling, while position 0
never moves. The window is anchored **and** known tracks fall out.

⚠ **The sharp consequence for this project specifically.** Every audibility
verdict reads the Master or an FX return, because a track's own VU tap is
pre-mute and therefore useless for *"does it reach the mix"*.
⇒ **Approaching the ceiling costs the measuring instrument before it costs any
ordinary track** [K, E16r].

⚠ An FX return also cannot be forked at all — other tracks' sends still feed the
original. So the FX returns are both unforkable and the first thing to disappear
as a lineage grows.

---

## 3. ⚠⚠ A create past the window mints a track you can never address

`e16r` learned each new track's `channelId` by diffing `track.list`. **Past the
ceiling a created track never appears there**, so the diff yielded nothing and
three tracks were minted whose identity the probe never learned — and could
therefore never delete. They were swept by name against a keep-set, by hand
[K, E16r].

⇒ The track is **unaddressable and un-cleanable**. `receipt.minted`, which D16
and E2c specify as reporting the `channelId` a new track was found at, silently
has nothing to report.

⚠ **The failure is silent in the worst way.** `resolveByChannelId` on the Master
returns `found:false`, which is byte-identical to the answer a **deleted** track
gives.

### ⇒ The refusal is a precondition, not a detection

> **Check the budget BEFORE the create, never after it.**
> `budget = bankSize − (project tracks + FX returns + master)`

[K, [D6](../../decisions/d6-addressing-pinned-non-following-cursors-identity-never-index-set.md), restated 2026-08-07 from E16r]

A post-hoc check is too late for this one, because the damage is a track that is
audible, consuming engine CPU, and invisible to us. A track **copy** consumes one
row by the same rule.

⚠ **Never a licence to reap.** Destructive initiative is zero
[[D20](../../decisions/d20-destruction-zero-initiative-directed-execution-behind-an-annotat.md)].
⚠ **Never justified on disk grounds.** A copied track costs about **20 KB** and
no measurable save time [K, [E16u](../experiments/e16u-a-branch-costs-20-kb-on-disk-and-nothing-in-save-time-k-2026-07-.md)]. The budget argument is about
addressability alone.

---

## 4. The cursor pool bounds concurrent addressing

- Three pool cursors held three different tracks concurrently, and 20/20
  write-plus-readback cycles stayed correct through continuous user clicking, with
  27 selection changes observed [K, [E1](../experiments/e1-addressing-pointing-pinning-cursor-pool-2026-07-18.md)].
- ⚠ Asking for a cursor past the pool **throws** —
  `Index 3 out of bounds for length 3` — rather than silently aliasing onto
  cursor 0 [K, E16r]. **That is the right failure**: a silent alias would land a
  write intended for one fork onto another.

⇒ A lineage wider than the pool must address its forks in sequence, re-pointing
between them. D6 already requires a re-point after any structural op, so this
costs no new discipline [K, E16r].

⚠ Pool cursors are **non-following by construction**
(`shouldFollowSelection=false`). Pinning is belt-and-braces on top [K, E1].

---

## 5. Pre-allocation is enforced, not conventional

⚠⚠ **Anything the API hands out must be created during `init()`.** The refusal is
one sentence, and it is verbatim across unrelated subsystems:

> *"This can only be called during driver initialization"*

**Five independent occurrences** [K, [D7](../../decisions/d7-pre-allocation-scaffold-sizes-settled-2026-07-25.md), E16t]:

| Subsystem | Evidence |
|---|---|
| Cursor pools | E1 |
| Device and parameter handles | E5 |
| `getDocumentState()` settings | E14-C2 |
| `host.createBitmap` | E14-I5 |
| `createEqualsValue` | E16t |

⇒ This is now the **default assumption** for any Bitwig resource, rather than a
per-subsystem discovery. Anything the human surface will ever show must exist at
init and be revealed with `show()`. Anything Phase 3 will ever draw into must be
allocated at init.

⚠ The refusal is clean, synchronous and catchable. That is the good failure mode.
⚠ A `*Action()` handle is a resource too: fetch it lazily inside a handler and
every arm throws. *"The handle does not exist"* and *"the object declines"* are
indistinguishable in the outcome, so any probe invoking one must prove the handle
first [K, E17 `e17am`].

---

## 6. Scaffold sizes — D7

Shipped: `TRACKS=256`, `SCENES=128`, `CURSOR_POOL=8`, `DEVICE_BANK=16`,
`paramHandles=64`. All are tunable through `~/.ghostnote/rig.json`
[K, [D7](../../decisions/d7-pre-allocation-scaffold-sizes-settled-2026-07-25.md)].

Measured [K, [E5](../experiments/e5-scale-limits-12-5-the-last-open-question-2026-07-19.md), via D7]:

- **No knee below 65 536 slots.** 512 × 128 initialised in 81 ms.
- Latency flat at the ~24 ms control-surface tick floor in every configuration,
  loaded or empty.
- Cold init 108 ms, inside a 13.4 s Bitwig launch. Project-open cost was below
  measurement resolution.

⇒ ⚠ **The binding constraint is not performance. It is the bank window.** Scale
therefore bounds maximum project size, which is a correctness limit rather than a
tuning preference [K, D7].

---

## 7. ⚠ Reading through a bank lags, and the lag looks like a finding

A bank bound to a cursor rebinds **on the host's schedule**, not on ours.

- `device.list` and `chain.inventory` returned the **previous** track's contents.
  A bare new instrument track reported the `Instrument Selector | Filter+`
  belonging to the row above it, and a populated container read as empty
  [K, [E22](../experiments/e22-group-editing-action-does-not-fire-reliably-backgrounded.md) harness lag 2].
- The selected-mixer observer **lags a cursor sweep**. After pointing at 14 rows
  in turn, the pre-fire readback returned the sweep's last row 25 ms after
  `pointTrack` [K, E22 harness lag 1].
- Container scope through `Rig.slotLayerBanks` needed **100 ms**, not the 25 ms
  `cursorPoint` budget it had borrowed — see [containers](containers.md) §6
  for the full 0/25/50/100 ms curve [K, measured 2026-08-15].

**The discipline this earns:**

1. Every per-track reading must **name its own track** in the reply.
2. It must **repeat unchanged across two consecutive reads**. A row that never
   stabilises is recorded as unstable and omitted — never as a change.
3. ⚠ An **impossible delta means you are reading the wrong object**. Abort; do not
   score. E17 `e17ag` recorded `4 -> 2` from a single `Delete` and scored it a
   success, while it had in fact destroyed a whole track.
4. ⚠ Bound a retry by **attempts, not wall-clock**. A clock spins hot wherever
   `settle` is not real time, which is every offline test of this class
   [K, 2026-08-15].

---

## 8. Cost of churn

A burst of forks is **cheaper per fork** than spaced ones: three back-to-back
duplications measured 99/73/71 ms against 143/96/119 ms spaced, a ratio of
**0.61×** [K, E16r].

⇒ An N-track turn need not pace its forks for cost reasons.

⚠ **This measures wall-clock to visible only.** The transport is stopped by
refusal during that probe, so **nothing here says an N-fork burst glitches once
rather than N times**. That remains owed, and it is the question a musician would
actually ask [K, E16r].

---

## Open questions

| # | Question | Tag | Probe |
|---|---|---|---|
| 1 | Does an N-fork burst glitch once or N times? | owed | Repeat the burst with the transport rolling and a listener, against a spaced control |
| 2 | What does a `Group` track do to the window under `ALL_CHANNELS`? | `[U]` | Unmeasured since E16j; D4 still names it |

---

## Supersession record

| Date | Change |
|---|---|
| 2026-08-15 | Page created. It supersedes the *reading* of E5's "state outside the window is unsnapshottable", which E16r sharpened to "unaddressable and un-cleanable". |

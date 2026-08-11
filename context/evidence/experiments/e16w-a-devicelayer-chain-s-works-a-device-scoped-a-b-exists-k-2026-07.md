---
id: E16w
kind: evidence
state: active
source: FINDINGS.md
---

# E16w — ⚠ a DeviceLayer chain's `mute()` WORKS: a device-scoped A/B exists [K] (2026-07-31)

**Verdict: ● the lead holds.** `DeviceLayer` declares zero members of its own and
inherits `Channel`, and the `Channel` mixer works on a layer chain: muting the
chains takes the track out of the mix **as completely as muting the whole track**.
Probes: `e16v-devab.ts` (setup + selector), `e16v-diag.ts`, `e16w-lead.ts`. New
wire: `layer.setMixer`, plus mixer fields on `layer.list`.

| state | subject's own tap | **master** |
|---|---|---|
| open, both chains live | 57 | **57** |
| FLOOR — subject muted at its own mixer | 57 *(pre-mute, trap 1)* | **12** |
| ⚠ **both chains muted** | 11 | **11** |
| unmuted again | 57 | — |
| chain 0 alone (default patch) | **58** | — |
| chain 1 alone (F1FREQ at 19.4 Hz) | **16** | — |

⇒ **A device-scoped A/B is real and costs no bank slot and no C5 duplication
glitch.** It reaches the master and the FX returns — the two places a fork cannot
reach (§4.8) and the first to leave the addressable set as a lineage grows
(E16r). The mute flag reads back as set, so the API accepts the write.

⚠ **The prior said this might not work and was right to.** `DeviceLayer` was a
silent no-op for `duplicateObject` and `duplicate` (E4d routes 1–2) — a supertype
method is a claim, not a capability. What distinguishes this case is that those
are **structural** verbs, which E4e explains architecturally (an insertion point
must bind to a referent, and a layer that does not exist has none), whereas
`mute()` is **state on a chain that already exists**.

⚠ **What it does NOT buy, so the row is not oversold.** Layer chains run in
PARALLEL, so muting is not switching, and the live state lives in **N mute
flags** — which is exactly what §4.4 exists to replace, and is E16m's finding one
level down. A `ChainSelector`'s `activeChainIndex()` is the single readable
integer §4.4 wants. **This is the cheap A/B that works with an asset we have; the
selector remains the answer to §4.4.**

**Free rider: layer chains have their own `channelId`** — `26440486-…` and
`397aff43-…`. E16l enumerated `Channel` for tracks only and never asked whether
this population existed. Unprobed for durability across save/restart.

### ⚠ THREE failed attempts before this one, each caught by a control rather than luck

This row is the strongest argument in the spike for asserting preconditions
separately from the question.

1. **`e16v meter` read only the MASTER** and saw 62 → 56, which looks like "the
   mute does nothing". `e16v-diag` §0 then found **Group 7, gn-E16, gn-sel and
   gn-lay all sounding at 54–58 with nothing of ours launched** — the master was
   measuring the project, not the subject. A count where a name was needed, which
   is `e16r-diag`'s mistake again.
2. **`e16v-diag` read the right meter but its subject had stopped playing** —
   open 5, restored 0. Its "mute silences it" line **PASSED**, comparing silence
   to silence. Only the PRECONDITION and the CONTROL failing beside it revealed
   that a probe asserting just its headline would have published a ●.
3. **`e16w`'s first run destroyed its own subject.** It called `transport.play`
   after each `slot.launch` and `transport.stop` between retries — but launching a
   launcher clip **starts the transport itself** (which is how E16m held a sound
   through eight toggles without touching the transport). The retry loop was
   tearing down the playback it was retrying: attempt 1 caught a decay tail of 5,
   attempts 2 and 3 read 0.

⚠ **And the FLOOR CONTROL is what finally made the numbers mean anything.** The
room's master floor is **12, not 0**, so every reading sits on a pedestal. Muting
both chains gives **11 — at or below that floor**, against 57 open. Without the
floor, 11 would have been an unexplained "not quite silent" and the row would
have been written up as ◐. Recorded rather than rounded away, exactly as E16m
recorded its group-muted 2 against a child-muted floor of 1.

⚠ **A trap for every future audible row:** the per-track VU tap is PRE-MUTE
(trap 1), so **muted tracks still read 56–58 on their own meters**. A "is the room
clean" check written over per-track meters reports contamination that does not
exist. The master is the arbiter for *"does it reach the mix"*; the track's own
tap is the arbiter for *"did the device stop producing"*, and a device-layer mute
is upstream of it.

---

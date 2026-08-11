---
id: E18a
kind: evidence
state: active
source: FINDINGS.md
---

# E18a — §6's load-bearing ASSUMPTION is now a MEASUREMENT: a multi-chain container reaches the Master and an FX return, autonomously [K] (2026-08-02)

**Verdict: ⚠⚠ ●● all nine cells landed.** `E17-VERDICT.md` §6.1 claims layers are
*"the only device-scoped A/B that reaches the Master and the FX returns"* — the
hole §4.8 had no answer for, since an FX return cannot be forked at all (other
tracks' sends still feed the original). ⚠ **That argument rested on a container
being placeable there by us, and nothing had ever tested it.** It is now tested,
and it holds by a wider margin than the argument needed. Probe: `e18a`. No wire
change; `methodsHash b3b9c71954d83b6a`, 133 methods.

| route | gn-B (control) | FX 1 (Effect) | Master |
|---|---|---|---|
| ⚠ **FX Layer by UUID, then `layer.select` + `duplicateChannel`** | ●● 1 → **2 chains** | ●● 1 → **2 chains** | ⚠⚠ ●● 1 → **2 chains** |
| Instrument Layer by UUID | ● lands, 0 chains | ● lands, 0 chains | ● lands, 0 chains |
| `insertFile` (4-chain Instrument Layer preset) | ● **4 chains, filled** | ● **4 chains, filled** | ⚠ ● **4 chains, filled** |

⇒ ⚠⚠ **A multi-chain container can be built on the Master and on an FX return
with no preset, no named action, no focus, no priming and no human.** The `e17ak`
recipe transfers to both destinations unchanged, and the chain selection flag read
`chain 0` at the instant of the call in all four growth arms (`observing:8`).

### ⚠ The discriminator fired the OTHER way, and that is the more useful half

The probe carried an INSTRUMENT-container arm specifically to separate *"the
destination refuses CONTAINERS"* from *"the destination refuses INSTRUMENTS"* —
because every container fixture on disk is instrument-shaped, and an `insertFile`
○ on a Master would otherwise have been scored as a property of the destination
when the honest reading was a property of the preset. That is the `e17v` mistake
(a fixture under which two mechanisms predict the same outcome), pre-empted.

⚠ **It was not needed, and the reason is a finding in its own right: there is no
type restriction to discriminate.** A Master and an FX return each accepted an
Instrument Layer by UUID *and* a 4-chain instrument preset carrying
`[Phase-4, Polysynth, Organ, Sampler]`, every chain arriving filled. Whatever
Bitwig's UI implies about what belongs on a master bus, **the API imposes no
device-type gate we can detect at these destinations.**

### ⚠ Two bootstrap facts re-confirmed at three destinations each

`e17ai` measured these once, on one track. They are destination-independent:

| | ships with |
|---|---|
| a fresh **FX Layer** | ⚠ **1 chain** — so it can be grown from nothing, typed |
| a fresh **Instrument Layer** | **0 chains** — no first chain to copy, so it still needs a preset or `Group` |

⇒ ⚠ **The FX Layer is the right container for these two destinations anyway**,
which is what makes the autonomous route available exactly where §6 wants it.

### ⚠ Cost, stated so it is not over-read

| | gn-B | FX 1 | Master |
|---|---|---|---|
| `insertBitwig` + settle | 469 ms | 469 ms | 500 ms |
| `insertFile` + settle | 463 ms | 464 ms | 465 ms |

⚠ **These are settle-INCLUSIVE and poll-quantised at 200 ms, not call latencies** —
they are not comparable to E16's ~143 ms insert or ~764 ms `insertFile`, which were
measured differently. What they *do* support, because both were measured the same
way here, is the **comparison**: at these destinations `insertFile` costs no more
than a plain device insert. The preset route is not the expensive one.

### Method

- ⚠ **The first run ABORTED on its own readback, and the reason generalises.**
  `cursor.status.trackPosition` reads `clip.getTrack()` — the cursor CLIP's track —
  and an FX return and the Master have **no launcher clip**, so it reports
  `trackPosition=-1, trackName="", trackExists=false` no matter how correctly the
  cursor landed. **A probe waiting on it aborts on precisely the two destinations
  it exists to measure.** The cursor was fine throughout; the instrument was not.
- ⚠⚠ **And the obvious replacement is also wrong, which is the transferable part.**
  `cursorTrack.position()` is **NOT the bank index**: swept across all 13 tracks it
  is the position within the PARENT GROUP. `gn-E16` reads `0` because it is a child
  of `Group 7`, and every track after the group is shifted by one (`gn-sel` bank 10
  → position 9, `Master` bank 12 → 11). ⇒ **Two different tracks share one position
  number**, which is D6's complaint one level down. The probe calibrates the mapping
  per destination and **refuses if two destinations collide** — an ambiguous
  readback is not a readback.
- **Landing was confirmed by CONTENT, not by the number** (rule 3a): pointing at
  `gn-sel` returns its `Instrument Selector`, at `gn-E16` its three devices, and at
  `FX 1`/`Master` genuinely empty chains. That is what rules out a mis-landing.
- **The control brackets the run** (the `e17v` ordering fix): `gn-B` ran the
  identical recipe **before, between and after** the two real destinations and grew
  every time, so a recipe dying mid-run would have produced an early refusal rather
  than false ○s on the destinations that matter.
- **Guards honoured:** destinations resolved by `channelId` with a refusal on
  duplicate names (#1); device list, chain list and devices-inside-chains read every
  arm (#2); track identity compared before and after every arm (#3); Δdevices bound
  to 0/+1 and Δchains to 0/+1 with an abort otherwise (#4); ⚠ **`device.selectInEditor`
  never called** — it is what poisoned `e17ac` (#6); chain 0 renamed `E18·a` before
  the duplicate so growth is verified by NAME (#13).
- ⚠ **Writing to the Master is the global signal path**, so the probe **refuses to
  run while the transport is rolling** (two parallel chains sum the signal), restores
  each destination to its exact device-name sequence after every arm, attempts the
  same restore on abort before exiting, and takes a **cross-track device fingerprint
  at both ends** — the off-subject check `e17ah` lacked. All three destinations back
  to baseline; fingerprint unchanged; track list identical by identity.
- ⚠ The first run's SUMMARY row printed `1 chains` under a body reading `GREW to 2`
  — it recorded the pre-growth count. The body is authoritative for this run; the
  derived line is fixed for future ones. **A derived line that can disagree with its
  own evidence is a defect even when the evidence is right.**

⇒ ⚠ **What this does NOT settle.** It says a container can be PLACED and GROWN
there. It says nothing about §3.1's rebuild strategy, about destroying a chain, or
about `channelId` durability. And it leaves `E17-VERDICT.md` §6.1 standing on
measurement rather than assumption — which strengthens the *layers* column without
touching the three rows that decide the call (destroy, identity, clips).

---

---
id: E16
kind: evidence
state: active
source: FINDINGS.md
---

# E16 §3.4e — chain-selector switching: ● latency and sends, ⚠ glitch owed [K] (2026-07-31)

Measured on `gn-sel`, an **Instrument Selector the user built by hand with two
chains** — Selectors ship with zero and E16o proved no verb seeds one, so the
shell has to come from a human. The chains were then filled by
`layer.insertDevice` at **135 ms and 146 ms**, matching E4c's ~143 ms.

| row | result |
|---|---|
| a Selector's chains appear in the `DeviceLayerBank` | ● **2**, `hasLayers=true` |
| `layer.insertDevice` populates a Selector chain | ● 135 / 146 ms |
| `chainselector.status` | ● `exists=true chainCount=2 activeChainIndex=0` |
| ⚠ **switch latency** | ● **25 ms** to `activeChainIndex==1` (50 ms round trip) |
| the other chain is audible — switching does not silence the track | ● 57 → 58 own tap |
| ⚠ **does switching cut the track's SENDS?** | ● **NO** — FX 1 reads **51 before, 52 after** |
| ⚠ **does switching GLITCH?** | ○ **NO** — **0/4 real vs 0/4 placebo**, forced balance |

⇒ **A chain switch does not touch routing.** A track mute cuts sends (E2); a
chain switch happens *inside* the instrument, upstream of the send tap, so the
send keeps flowing and carries whichever chain is active. **That is the property
that makes a selector usable on an FX RETURN and on the MASTER.**

⚠ **`devcursor.selectFirstInLayer` descends into an Instrument LAYER's chain
(141 ms) but TIMES OUT on an Instrument SELECTOR's** (6 s, cursor stays on the
container). The two container types expose the same 2 chains to `layer.list` and
diverge on cursor descent. Consequence for this row: the Selector's two chains
could not be differentiated by parameter, so both hold the same default
Polysynth.

⚠ **That is not a degraded experiment — it is the right one for the glitch
question.** With both chains identical the switch should be inaudible, so
**anything heard at a switch point IS the glitch**, uncontaminated by a timbre
change. C5 measured duplication's glitch the same way.

### ⚠ The glitch row: ○ no glitch — and the verdict check had to be inverted

8 trials, **forced 4 real / 4 placebo** (not a coin — E16m's coin gave 5/1 and
left that row's ear half resting on a single placebo trial). The user, run in
their own terminal with live trial markers: *"I did not hear glitches or dropouts
at any point."* **0/4 real, 0/4 placebo.** Meter: real avg 58.5 vs placebo 56.5 —
no dropout on the real arm.

⇒ ⚠ **A chain switch is clean where a fork is not.** C5 measured track
duplication glitching **5/5 against 0/3 placebo**. So the device-scoped A/B is
free of the one cost that makes a branch point *"never free and never automatic"*
(§6.4) — and it is 25 ms.

⚠ **The check scored this clean result as a FAILURE**, because it asserted "the
ear separates the real arm from the placebo arm" — correct for the layer-mute
row, and exactly backwards here, where both chains hold the same patch and a
correct switch is **inaudible by construction**. E16m's method note records
catching this same shape *before* its run (*"an earlier draft asserted
`silences || separated`, which would have printed a red X against a perfectly
clean ○"*); this one was caught after. The assertion is now mode-dependent.

⚠ **The weakness, stated rather than buried: a null ear result cannot distinguish
"no glitch" from "this listener and rig could not have heard one anyway."** The
missing arm is a POSITIVE control — a trial where an artifact certainly occurs.
The layer-mute A/B (E16w) is precisely that control and was **not** run in the
same sitting. Until it is, this row rests on the null result plus the meter, and
should not be quoted as strongly as C5, which had an audible artifact in its own
real arm.

### ⚠ The send check that PASSED without asking anything

`e16v meter`'s send row compared `fxOnChain0: 0` against `fxOnChain1: 0` and
passed — because `gn-sel` had **no send configured at all**. The check carried an
`|| open.fx <= 0` escape hatch that let an unasked question look answered: **two
silences making a green**, which is rows D–G trap 6, in a fixture built after
that trap was documented. `e16v-diag` configures the send, **proves it live at 51
before the switch**, and would report the question UNANSWERED rather than answer
it if it could not.

---

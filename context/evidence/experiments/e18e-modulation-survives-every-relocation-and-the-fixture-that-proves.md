---
id: E18e
kind: evidence
state: active
source: FINDINGS.md
---

# E18e — ⚠⚠ MODULATION SURVIVES EVERY RELOCATION — and the fixture that proves it had to be BUILT [K] (2026-08-02)

**Verdict: ⚠⚠ ●● 3/3 legs.** The scariest item on §3.1's list, because the failure
mode was *silent*: a take whose filter quietly stops moving, with no error anywhere.
It does not happen. Probe: `e18e`; fixture built by
`src/tools/build-e18-modfixture.ts`.

| leg | move | rebuild step | max divergence | |
|---|---|---|---|---|
| baseline | (none) | — | **0.00357** | ● |
| 1 | top level → chain `A0` | the patch entering a take container | 0.00239 | ●● |
| 2 | ⚠ chain `A0` → chain `B0`, **different containers** | **reduce** | 0.00303 | ●● |
| 3 | ⚠ chain `B0` → top level | **collapse** | 0.00359 | ●● |

⇒ ⚠ **A modulator riding on the relocated device keeps working**, across containers
and back out to top level.

### ⚠⚠ The instrument was the whole problem, and two of them had to be fixed

**1. Every modulator fixture on disk was UNROUTED.** An offline read settled it —
`mp_one_lfo` `routes=0`, `modzoo` `routes=0` ×2, `mp_one_random` `routes=0`. They
modulate **nothing**. That is not a defect: they were built for `bwmod` FORMAT work
(E11/E13), where the question was whether a modulator *loads*. ⚠ **But a relocation
probe run on them would compare 0 against 0 before and after and report "modulation
survived"** — the emptiest false ● available. The fixture is now authored:
`addModulator` with a routed donor aimed at `CONTENTS/F1FREQ` at amount 1.0, the
route read back out of the written bytes before the file is accepted.

**2. The oracle only saw one remote page.** Liveness had only ever been readable via
`remote.list`, which exposes the 8 controls of the **selected** page — so asking
*"is this parameter modulated"* meant guessing which page it lives on and scanning.
`param.list` now carries `modulatedValue` beside `value` for the 16 named handles,
making it a direct comparison on `F1FREQ` — the same parameter `e18c` marks for its
state check. No new wire method; `modulatedValue` was already marked at init by E7.

### ⚠⚠ The FLOOR is measured, not asserted — and the first draft got it wrong

The probe originally hard-coded a floor of `0.01` as *"safely above noise"*. A live
check then showed the authored fixture swinging only **±0.0036** — real, repeatable
modulation that the gate would have discarded as *"no fixture modulates"*, **turning
a working instrument into a false blocker.**

⚠ **The right framing is not "big vs small", it is "non-zero vs EXACTLY zero":**

| arm | max divergence |
|---|---|
| ⚠ **NEGATIVE CONTROL** — an unrouted modulator | ⚠⚠ **0.000000** |
| `gn_mod_lfo-sampler` (authored, routed) | **0.00357** ● |
| `gn_mod_vibrato-poly` (authored, routed) | ⚠ **0.00000** ○ |

An unmodulated parameter reads `modulatedValue == value` **exactly**, so the
discrimination is ~3600:1 and the small absolute number costs nothing. The negative
control establishes that in the same sitting rather than trusting a constant.

⚠ **Building TWO candidate fixtures paid for itself.** Whether a modulator *runs at
rest* is not knowable offline — an LFO free-runs, a Vibrato apparently wants voices.
`vibrato-poly` loaded correctly, validated correctly, routed correctly, and produced
**exactly zero** movement. Had it been the only fixture, the row would have reported
a blocker instead of an answer.

### ⚠ Scope — stated so this is not over-read

This measures a modulator **on the device being moved**, routed to **its own**
parameter. It does **NOT** measure E11e's cross-device form — a modulator on the
**outer container** routed into a chain, whose Ramona path is
`…/DEVICE_CHAIN/<deviceIndex>:CONTENTS/<PARAM>` and therefore **encodes a device
INDEX**. ⚠ That is precisely the path a rebuild could renumber, and it remains owed.
The green result above says nothing about it.

---

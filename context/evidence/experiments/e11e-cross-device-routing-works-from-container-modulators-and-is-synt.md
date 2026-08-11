---
id: E11e
kind: evidence
state: active
source: FINDINGS.md
---

# E11e — cross-device routing works from CONTAINER modulators, and is SYNTHESISABLE + live [K] (2026-07-24)

**Verdict: ● a modulator on a CONTAINER device (Chain/layer) can target a param in a
DIFFERENT device nested inside it, via a structured `0x0e3d` path — and that route is
SYNTHESISABLE by the ordinary retarget (rewrite `0x0e3d`), producing LIVE modulation on
the chosen nested device+param. Simple (non-container) devices cannot cross-route at
all (user-confirmed — a modulator only reaches its own device).** Probe `e11e-live.ts`
+ retarget builder, on user-authored `gn_crossdev_outer` (Chain ⊃ Polysynth→Delay+, an
outer LFO routed to the inner Delay+ Mix).

### The cross-device path form [K]
```
CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/1:CONTENTS/MIX
└container contents┘└─ nested device chain ─┘└idx┘└ nested device param ┘
```
`CONTENTS/DEVICE_CHAIN/<ContainerName>/DEVICE_CHAIN/<deviceIndex>:CONTENTS/<PARAM>` —
`<deviceIndex>` selects the device within the container's chain (`0`=Polysynth,
`1`=Delay+), then `CONTENTS/<PARAM>` is the same per-device path form as a top-level
route (native `CONTENTS/<NAME>`; a nested CLAP/VST would use its `ROOT_GENERIC_MODULE/
PID<hex>` tail). Compare single-device forms: native `CONTENTS/F1FREQ`, CLAP
`CONTENTS/ROOT_GENERIC_MODULE/PID<hex>` (E4b/E11d).

### Synthesis is live, not just loadable [K]
Retargeting the outer LFO to three targets — all LOAD; liveness read by descending the
device cursor into the container's `CHAIN` slot (`devcursor.selectFirstInSlot{slot:"CHAIN"}`)
and scanning the nested device's remote pages for `modulatedValue ≠ value`:

| synthesized route | loads | live on nested device |
|---|---|---|
| `…/1:CONTENTS/MIX` (control, Delay+) | ● | (target is 2nd device; not scanned) |
| `…/1:CONTENTS/BLUR` (Delay+, other param) | ● | — |
| **`…/0:CONTENTS/F1FREQ`** (the OTHER nested device, Polysynth) | ● | ● **`FILTER/Filt Freq` diverges 0.002** |

Rewriting the path to point at a *different nested device and param* (Polysynth
`F1FREQ`) yields real modulation there — a wrong path would read exactly `0.000`
(silent no-op, E10b). So the container-modulator target set is **arbitrary within the
container** (any nested device by index, any of its params), reachable by the standard
`0x0e3d` retarget — not a curated set.

### Decision impact
- **Cross-device modulation is authored the same way as any route** — `bwmod.retarget`
  handles it with no new primitive; only the path *form* is richer
  (`DEVICE_CHAIN/<name>/DEVICE_CHAIN/<idx>:CONTENTS/<param>`). Same readback caveat
  (a bad path is a silent no-op — verify live).
- **The modulator must live on a container** (Chain/Instrument-Layer/FX-Layer); a
  simple device's modulator is confined to that device. So a patch that wants
  cross-device modulation must wrap the targets in a container (the E4d/E10d container
  work already gives us those).
- Confirms the E7-era "target set is arbitrary vs curated" question → **arbitrary**
  (for container modulators, within the container).
- Gotcha: nested-device modulation is invisible to a container-scoped `remote.list`;
  readback must descend into the nested device (`selectFirstInSlot`) — the container's
  own pages only show its modulator, not the target.

---

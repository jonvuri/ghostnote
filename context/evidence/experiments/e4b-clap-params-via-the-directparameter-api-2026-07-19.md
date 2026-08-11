---
id: E4b
kind: evidence
state: active
source: FINDINGS.md
---

# E4b — CLAP params via the DirectParameter API (2026-07-19)

**Verdict: ● CLAP direct params ARE accessible — my E4 negative was wrong.**
Prompted by a challenge to the E4 CLAP claim. The typed specific-device
path has no CLAP variant, but `Device` carries a second, **format-agnostic
`DirectParameter` API** (the older one `createParameter` "replaced") that
works on CLAP, VST, and Bitwig devices alike. Probe `e04b`.

### What works (proven on a real CLAP: Stochas, `org.surge-synth-team.stochas`)

- **Self-enumeration**: `addDirectParameterIdObserver` emits an array of
  **all** param IDs — no IDs known upfront (unlike `createParameter`).
  Stochas: 55 params; Polysynth via the same API: 55 params.
- **Names**: `addDirectParameterNameObserver(maxChars, cb)` → per-id names
  ("L1 speed", "L1 steps/measure", "OSC1 Pulse Width", "AEG Attack"). All
  55 named on both devices.
- **Values**: `addDirectParameterNormalizedValueObserver(cb)` → per-id 0..1
  (Polysynth reported real defaults: Attack 0.07, Sustain 0.95).
- **Writes**: `setDirectParameterValueNormalized(id, value, resolution)`
  works on Bitwig F1FREQ (0.693→0.200). **⚠ resolution matters:**
  `resolution=1` took; `resolution=128` did NOT within 1.5s. Use
  `resolution=1` (or investigate the intended semantics). Stochas's own
  params didn't move on write — plugin-specific (some plugins reject host
  writes / gate on host-automation state), not an API limit.

### Mechanism comparison — two parameter APIs, pick per case

| | `createParameter` (E4) | `DirectParameter` (E4b) |
|---|---|---|
| Devices | VST2/VST3/Bitwig (typed) | **any incl. CLAP** |
| Discovery | IDs/indices known upfront | **self-enumerates all IDs** |
| Access | pull (`get()`) | **push (observers, init-time)** |
| Handles | pre-allocated at init | one observer set per cursor device |
| Displays | ✅ `displayedValue()` ("2.59 kHz") | ◐ observer didn't populate (below) |
| Writes | `setImmediately` | `setDirectParameterValueNormalized(…,1)` |

**Implication for the param layer:** DirectParameter is the better
*discovery/enumeration* primitive (self-listing, format-agnostic, one
observer set covers any pointed device) and reaches CLAP. `createParameter`
remains better where displayed values and stable pull-reads matter (Bitwig
internal, known VST indices). A pool cursor-device can carry BOTH: direct
observers for enumeration + typed handles for the devices we deeply support.

### Open detail (not blocking)

- **`addDirectParameterValueDisplayObserver` didn't populate** display
  strings for either device (names/values did). Hypothesis: the display
  channel is **page-scoped** (the DirectParameter API has
  `setParameterPage`/`nextParameterPage`/`isParameterPageSectionVisible`),
  so displays may only stream for the active parameter page, needing page
  navigation to cover all params. Deferred; displayed values are available
  anyway via `createParameter` for typed devices, and normalized values
  suffice for CLAP readback. Revisit in Phase 1 if CLAP display strings are
  wanted.

### Decision impact (updates E4)

- **CLAP is IN scope for direct params** (enumerate + name + value + write),
  via DirectParameter. §6a "VST/CLAP" claim restored for CLAP; the
  differentiator is broader than E4 concluded.
- Param layer carries two APIs by role: DirectParameter for enumeration/CLAP,
  createParameter for typed pull-reads + displays.
- Write via DirectParameter: pass `resolution=1`.
- **Lesson:** a negative capability claim from a single missing-method grep
  is unsafe in this API — verify against the whole `Device` surface + a live
  test before recording an ○. (Good catch by the user.)

---

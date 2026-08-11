---
id: E14
kind: evidence
state: active
source: FINDINGS.md
---

# E14 rows H and I — both speculative rows die on the SAME question, and one non-speculative finding falls out [K] (2026-07-25)

**Verdict: ○ on both, for the same reason rows A–G's pane failed — nothing in
Bitwig will stay on screen. D14 is unchanged and now rests on two independent
measurements instead of one.** Everything *else* about both rows works, some of
it better than expected, which is what makes the ○ worth writing down at length:
the obstacle is not the drawing, the layout, the click handling or the API. It is
that there is no persistent window to put any of it in.

Probes: `probe:e14-hw` (row H), `probe:e14-gfx` (row I). Apparatus:
`extension/…/HardwarePanel.java`, `DisplayWindow.java`, `PanelRenderer.java`,
7 wire methods, golden `37665189db86547b` at 100 methods. Render artifacts (PPM
via `Bitmap.saveToDiskAsPPM`, converted to PNG by `brain/src/probes/ppm.ts`) in
`brain/.tmp/e14/`.

### ⚠ The one finding here that is NOT speculative, and it is load-bearing

**`host.createBitmap` is INIT-ONLY, and it refuses with the same words as
settings**:

```
refused: ydq: This can only be called during driver initialization
```

That is verbatim E14-C2's refusal on `getDocumentState()` settings, from a
completely different subsystem. So the §3a pre-allocation idiom is now on its
**fourth** occurrence — cursor pools (E1), device/param handles (E5), settings
(E14-C2) and now graphics — and it is beginning to look like a property of the
extension API as a whole rather than a series of coincidences. **Anything Phase 3
will ever draw into must be allocated at `init()`.** → **D7 amended.**

The refusal is clean, synchronous and catchable — the good failure mode, and the
exact opposite of E14-A1. It was measured last and opt-in for that reason; it
turned out not to need the caution, which is only knowable afterwards.

### Row H — a fully working clickable panel that cannot stay on screen ○

| | verdict |
|---|---|
| H0 | ● `createHardwareSurface()` + 4 buttons, 4 lights, a 2-line text display and a 256×64 pixel display all build at init — 17.6ms, 4 controls, 6 output elements |
| H1 | ● `setBounds` round-trips through Bitwig's physical model (`getX/getY/getWidth/getHeight` return what we set, in mm) |
| H2 | ● the output pipeline is live: `currentValue === lastSentValue` on both lights and text lines after a flush |
| H3 | ● `pressedAction().isSupported()` is **false** on every button, exactly as the javadoc predicts with no matcher set |
| H4 | ● the simulated GUI opens and draws the whole laid-out panel — labels, light colours, both text lines, the embedded graphic |
| H5 | ● **a `HardwareButton` with NO `HardwareActionMatcher` fires on a click**, press *and* release |
| H6 | ● the embedded `HardwarePixelDisplay` renders at 256×64 (418µs for the take strip) |
| **H4e** | ○ **the simulated GUI CLOSES on click-away** — the only question the row existed to answer |

**H5 is the mechanism finding and it is worth keeping.** `HardwareAction`'s
javadoc defines `isSupported()` as "has a `HardwareActionMatcher` that can detect
it", and ghostnote declares zero MIDI ports so no matcher is even constructible.
`isSupported()` duly reported `false` on all four buttons — **and the presses
arrived anyway.** ⇒ **the hardware simulator synthesises actions directly, rather
than routing them through the matcher.** A matcher-less `HardwareButton` is a
real clickable widget, and `isSupported()` is a statement about MIDI wiring, not
about whether the control works. Transferable to any future real-hardware work.

⚠ **H4f, from the operator, is the sharpest version of the negative:** *"It does
not stay open (because changing projects requires clicking out of it), but the
state is maintained — Take D is still highlighted."* The surface state is durable
in the extension; what is lost is purely visibility. That is the same shape as
the controller pane's failure and it fails D5's core verb the same way — an A/B
comparison you reopen a window for between every comparison is not a comparison.

⚠ **`flush()` idles at roughly 1 Hz.** `updateHardware()` calls moved 4 → 5 over a
second at rest, so output state does not reach the surface promptly on its own;
`host.requestFlush()` after a push is what makes it timely, and every `ui.hw*`
handler calls it. Relevant to any future output-pushing surface, not just this one.

### Row I — the renderer is genuinely good; the window does not exist ○

| | verdict |
|---|---|
| I0 | ● `host.createBitmap(640×320, ARGB32)` succeeds at init (5.5–5.7ms) |
| I3a | ● the DEFAULT font face measures text with no `loadFontFace` — `"Take B · 12 notes"` @12px is 91×9, ascent 12, line-height 14 |
| I3b | ● the 8–24px text ladder drew at every size |
| **I1** | ○ **`showDisplayWindow()` produces NOTHING.** No window, no flash, no error — under BOTH `extension-dev` conditions |
| I2/I4 | — unreachable: persistence and redraw-on-demand cannot be asked of a window that never opens |
| I5 | ○ `createBitmap` after init is refused (see above) |

**The rendering itself is the surprise, and it is a ●.** All six artifacts were
inspected as PNGs, not merely counted:

- **text** — clean antialiasing, correct kerning, and both `—` and `·` render, so
  the default face has real Latin-1 coverage. At the 256×64 controller-screen
  size, 12px is crisp, 10px readable, 8px marginal-but-present.
- **paths** — smooth béziers, correct dash phase, and **alpha compositing works**
  (overlapping translucent circles blend properly). That is precisely the
  before/after overlay a Phase-3 diff view would want.
- **cost** — 292–334µs for a warm 640×320 re-render. The `text` scene is
  consistently the slowest at ~5.4ms for six strings, so **text is the expensive
  primitive at roughly 1ms per `showText`**; geometry is nearly free.

⇒ **If an in-Bitwig raster panel is ever wanted, the renderer is not the
obstacle.** `GraphicsOutput` is a competent 2D surface and the take strip it drew
would be perfectly serviceable UI. The obstacle is entirely that
`showDisplayWindow()` does nothing on macOS/Bitwig 6.0.6 and that the only other
route to a window — row H's simulator — will not stay open.

### ⚠ Method note: row I was measured twice, because the first run was confounded

The first `probe:e14-gfx` run happened when `config.json` **did not exist at
all** — so `extension-dev` was unset. The probe's own header asserted row I was
independent of that flag, which was a *javadoc inference* (the flag is documented
only against `HardwareSurface` simulation) and not a measurement. Given that
`showDisplayWindow` is a debug utility by Bitwig's own words, "gated behind the
debug flag" was a live hypothesis, and E14 had already been wrong twice about
premises of exactly this kind (row F's, and D4's panel location).

So it was re-run with `extension-dev : true` set and the simulated device
connected. **Identical result: nothing.** The ○ is now measured under both
conditions rather than assumed under one. Standing rule 10's clause about doc
passes applies to *our own* inferences too, and the re-run cost one minute.

### What this closes, and what it changes

- **D14 stands, and is now doubly-sourced.** Take navigation belongs in the
  Phase-3 web view. Rows A–G found the controller pane closes on click-away; rows
  H and I find that the only two alternatives inside Bitwig either close the same
  way or never open. **Three independent surfaces, one shared verdict: Bitwig has
  no persistent extension-owned window.** That is a much stronger foundation for
  the Phase-3 decision than the single pane measurement was.
- **D7 is amended**: graphics allocation joins settings as init-only, on the same
  refusal string. The §3a idiom is now the default assumption for any Bitwig
  resource, not a per-subsystem discovery.
- **Neither row becomes load-bearing, as specified in advance.** Row H would have
  needed `extension-dev : true`, a restart and two right-click menus even had
  H4e passed — a setup cost no product can put on a musician. Row I's own javadoc
  calls it a debug utility. Both were probed because a ● would have *reopened* a
  question; both returned ○ on the question that mattered, so nothing reopens.
- **Kept for later, cheaply**: the renderer, the artifact pipeline
  (`saveToDiskAsPPM` → PNG), and the H5 matcher finding. If Phase 3 ever grows a
  Bitwig-side raster panel — or ghostnote ever meets real hardware — the drawing
  half is measured and working.

### Decision impact
- **PHASE-0 exit criterion 3 is now MET IN FULL**: every E14 row A–I carries a
  verdict with evidence, and the control-layer decision is D14.
- **D7** gains the init-only graphics constraint (§3a, fourth occurrence).
- **D14** is unchanged in substance and strengthened in evidence.
- New: *`isSupported()` describes MIDI wiring, not usability — the simulator
  fires matcher-less actions directly.*

package com.ghostnote.extension;

import com.bitwig.extension.api.Color;
import com.bitwig.extension.api.graphics.Bitmap;
import com.bitwig.extension.api.graphics.BitmapFormat;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.HardwareButton;
import com.bitwig.extension.controller.api.HardwarePixelDisplay;
import com.bitwig.extension.controller.api.HardwareSurface;
import com.bitwig.extension.controller.api.HardwareTextDisplay;
import com.bitwig.extension.controller.api.OnOffHardwareLight;
import com.bitwig.extension.controller.api.RelativePosition;

/**
 * E14 row H — a `HardwareSurface` panel, probed as a possible PERSISTENT
 * in-Bitwig human surface.
 *
 * ⚠ **PROBED 2026-07-25 — ○, and narrowly.** Every capability here works: the
 * surface builds, `setBounds` round-trips through Bitwig's physical model, lights
 * and text lines reach the GUI (`currentValue == lastSentValue`), the embedded
 * pixel display renders, and **a click on a matcher-less button fires**, press
 * and release. Then the simulated GUI **CLOSES ON CLICK-AWAY**, exactly as the
 * controller pane does — which was the one question the row existed to ask. A
 * complete, working, clickable panel that will not stay on screen. D14 is
 * unchanged and now rests on three surfaces instead of one; `FINDINGS.md` §E14
 * rows H/I has the detail.
 *
 * ⚠ **The mechanism finding is worth keeping**: `isSupported()` reported `false`
 * on all four buttons, exactly as the javadoc predicts with no matcher — and the
 * presses arrived anyway. **The simulator synthesises actions directly rather
 * than routing them through the matcher.** So `isSupported()` describes MIDI
 * wiring, not whether the control works. Transferable to any real-hardware work.
 *
 * ⚠ **Speculative. It must not become load-bearing, and the gate is not a
 * verdict on this file.** Even a perfect ● here ships behind `extension-dev :
 * true` in the user's `config.json`, a Bitwig restart, and two right-click menu
 * items ("Simulate device connected", "Show simulated hardware GUI") — a setup
 * cost no product can impose on a musician. What a ● would buy is a *reopened
 * question*, not a plan.
 *
 * **Why it is worth 20 minutes at all.** E14 established that Bitwig's
 * per-controller pane CANNOT be pinned and closes on click-away, which is what
 * sent A/B take navigation to the Phase-3 web view (D14). The simulated hardware
 * GUI is a real window rather than a pop-over, so it is the only candidate for a
 * *persistent* surface inside Bitwig. If it stays open while the user works, the
 * D14 split is worth re-examining; if it closes too, rows H and I are closed for
 * good and Phase 3 owns the take UI outright. That single question outranks
 * everything else this class measures.
 *
 * **What the javadoc already tells us, so the sitting does not have to.**
 * `HardwareAction.isSupported()` is documented as "has a HardwareActionMatcher
 * that can detect it" — and this panel deliberately sets NO matcher, because a
 * matcher needs MIDI and ghostnote has zero MIDI ports (see
 * `GhostnoteExtensionDefinition`). So `isSupported()` is PREDICTED false on
 * every button here. The row-H question is precisely whether the simulator fires
 * the action anyway, i.e. whether it synthesises the press directly instead of
 * going through the matcher. That is why {@link #pressCounts} and
 * `pressedSupported` are both reported: the interesting result is the pair.
 *
 * ⚠ **Failure is a field, not a throw** — {@link #create} never propagates.
 * `UiPanel` is built inside a try/catch by {@link GhostnoteExtension} for the
 * E7-Finding-0 reason (a hazardous init cost the whole sitting once); this class
 * owns that discipline itself, so the extension gets an object that reports
 * `available: false` with a reason rather than a null and a parallel error
 * string. Everything below tolerates `surface == null`.
 *
 * ⚠ **Bitwig calls back into us here**, through the press actions and through
 * `updateHardware()`. E14-A1's rule cuts both ways: we cannot catch what Bitwig
 * defers, so we must not hand Bitwig anything that throws. Every callback body
 * is arithmetic and field writes; the one that touches the graphics API
 * ({@link #renderPixels}) is wrapped, and repeated `updateHardware()` failures
 * DISABLE the call rather than retrying it on every flush.
 */
public final class HardwarePanel {
    /** The take strip D14 would want here, if any of this were shippable. */
    public static final String[] TAKE_LABELS = { "A", "B", "C", "D" };

    /** Pixel-display size, in the ballpark of a real controller screen. */
    public static final int PIXELS_W = 256;
    public static final int PIXELS_H = 64;

    /** Physical panel size in mm — what `setBounds` coordinates are relative to. */
    public static final double PANEL_W_MM = 120;
    public static final double PANEL_H_MM = 70;

    private static final Color LIGHT_ON = Color.fromRGB255(60, 200, 120);
    private static final Color LIGHT_OFF = Color.fromRGB255(38, 38, 44);

    private final ControllerHost host;

    /** Null when the surface built; the reason otherwise. */
    public final String error;
    /** Null when {@link #error} is set. Every read below is guarded on it. */
    public final HardwareSurface surface;
    public final HardwareButton[] buttons;
    public final OnOffHardwareLight[] lights;
    public final HardwareTextDisplay textDisplay;
    public final HardwarePixelDisplay pixelDisplay;
    public final Bitmap pixelBitmap;

    public final long constructNanos;

    // --- what a human click, if it arrives at all, moves --------------------
    public final int[] pressCounts = new int[TAKE_LABELS.length];
    public final int[] releaseCounts = new int[TAKE_LABELS.length];
    public int lastPressedIndex = -1;
    public long lastPressMs = -1;

    // --- output state the surface is asked to push --------------------------
    public final boolean[] lightOn = new boolean[TAKE_LABELS.length];
    public final String[] lines = { "ghostnote", "take A" };
    public int currentTake = 0;

    // --- the pixel display, and whether it can be redrawn on demand ---------
    public String pixelScene = "takes";
    public int pixelRenderCount = 0;
    public PanelRenderer lastPixelRender;
    private boolean pixelsDirty = true;

    // --- evidence that Bitwig's output pipeline is actually running ---------
    public int updateHardwareCalls = 0;
    public int updateHardwareFailures = 0;
    public String updateHardwareError = "";
    public boolean updateHardwareDisabled = false;

    /**
     * Build the panel, or an unavailable one carrying the reason.
     *
     * Never throws. See the class note: an init-time throw is the E7-Finding-0
     * hazard class, and this whole apparatus is ◐ doc-only surface being touched
     * for the first time.
     */
    public static HardwarePanel create(ControllerHost host) {
        try {
            return new HardwarePanel(host);
        } catch (Throwable t) {
            return new HardwarePanel(host, t.getClass().getSimpleName() + ": " + t.getMessage());
        }
    }

    private HardwarePanel(ControllerHost host, String error) {
        this.host = host;
        this.error = error;
        this.surface = null;
        this.buttons = new HardwareButton[0];
        this.lights = new OnOffHardwareLight[0];
        this.textDisplay = null;
        this.pixelDisplay = null;
        this.pixelBitmap = null;
        this.constructNanos = 0;
    }

    private HardwarePanel(ControllerHost host) {
        long start = System.nanoTime();
        this.host = host;
        this.error = null;
        this.surface = host.createHardwareSurface();
        // Without a physical size Bitwig has no model to draw, and the javadoc
        // ties the simulated GUI to having provided bounds at all.
        surface.setPhysicalSize(PANEL_W_MM, PANEL_H_MM);

        int n = TAKE_LABELS.length;
        buttons = new HardwareButton[n];
        lights = new OnOffHardwareLight[n];

        double pad = 6;
        double buttonW = 24;
        double buttonH = 14;
        double gap = 4;
        for (int i = 0; i < n; i++) {
            final int index = i;
            HardwareButton button = surface.createHardwareButton("gn-take-" + i);
            button.setLabel("Take " + TAKE_LABELS[i]);
            button.setLabelPosition(RelativePosition.INSIDE);
            button.setBounds(pad + i * (buttonW + gap), pad, buttonW, buttonH);
            button.setRoundedCornerRadius(2);
            // Read back in `ui.hwStatus`; needs marking like any other value.
            button.isPressed().markInterested();

            // ⚠ NO setActionMatcher. That is the row-H experiment, not an
            // omission: a matcher needs MIDI input and this extension declares
            // zero MIDI ports. `isSupported()` should therefore read false while
            // these counters may still move, and the pair is the finding.
            button.pressedAction().setBinding(host.createAction(
                () -> onPressed(index), () -> "ghostnote: select take " + TAKE_LABELS[index]));
            button.releasedAction().setBinding(host.createAction(
                () -> releaseCounts[index]++, () -> "ghostnote: release take " + TAKE_LABELS[index]));

            OnOffHardwareLight light = surface.createOnOffHardwareLight("gn-take-light-" + i);
            light.setOnColor(LIGHT_ON);
            light.setOffColor(LIGHT_OFF);
            // A supplier rather than setValue: `updateHardware()` then pulls the
            // current state on every flush, which is what makes `lastSentValue`
            // meaningful as evidence that the pipeline ran at all.
            light.isOn().setValueSupplier(() -> lightOn[index]);
            button.setBackgroundLight(light);
            lights[i] = light;
            buttons[i] = button;
        }
        lightOn[0] = true;

        textDisplay = surface.createHardwareTextDisplay("gn-text", lines.length);
        textDisplay.setBounds(pad, pad + buttonH + 6, PANEL_W_MM - pad * 2, 12);
        for (int i = 0; i < lines.length; i++) {
            final int index = i;
            // Explicit, because nothing documents the default and a maxChars of
            // 0 would silently truncate every push to nothing.
            textDisplay.line(i).text().setMaxChars(32);
            textDisplay.line(i).text().setValueSupplier(() -> lines[index]);
            textDisplay.line(i).textColor().setValue(Color.fromRGB255(220, 222, 228));
            textDisplay.line(i).backgroundColor().setValue(Color.fromRGB255(18, 18, 22));
        }

        pixelBitmap = host.createBitmap(PIXELS_W, PIXELS_H, BitmapFormat.ARGB32);
        pixelDisplay = surface.createHardwarePixelDisplay("gn-pixels", pixelBitmap);
        pixelDisplay.setBounds(pad, pad + buttonH + 22, PANEL_W_MM - pad * 2, 24);

        this.constructNanos = System.nanoTime() - start;
    }

    public boolean available() {
        return surface != null;
    }

    /**
     * A take button was pressed — if the simulator delivers presses at all.
     *
     * ⚠ Runs on Bitwig's callback, so it does nothing that can throw: counters,
     * flags, and a dirty bit. The redraw it implies happens in
     * {@link #updateHardware()}, which is both the documented place to push
     * output state and a frame we already guard.
     */
    private void onPressed(int index) {
        pressCounts[index]++;
        lastPressedIndex = index;
        lastPressMs = System.currentTimeMillis();
        selectTake(index);
    }

    /** Light the given take, darken the rest, and mark the display stale. */
    public void selectTake(int index) {
        currentTake = index;
        for (int i = 0; i < lightOn.length; i++) {
            lightOn[i] = i == index;
        }
        lines[1] = "take " + TAKE_LABELS[index];
        pixelsDirty = true;
    }

    /** Explicit light override — `ui.hwLight` with an index, not a take. */
    public void setLight(int index, boolean on) {
        lightOn[index] = on;
    }

    public void setLine(int index, String text) {
        lines[index] = text;
    }

    /**
     * Render the pixel display now, synchronously, and report what happened.
     *
     * Called from a handler (control-surface thread) so the probe gets an
     * answer in the same request, and from {@link #updateHardware()} when a
     * press marked it stale. `PanelRenderer` cannot throw by construction.
     */
    public PanelRenderer renderPixels(String scene) {
        PanelRenderer renderer = new PanelRenderer(
            scene, PIXELS_W, PIXELS_H, TAKE_LABELS, currentTake, "E14 row H");
        pixelBitmap.render(renderer);
        pixelRenderCount++;
        lastPixelRender = renderer;
        pixelsDirty = false;
        return renderer;
    }

    /**
     * Push output state — called from `flush()`, i.e. constantly.
     *
     * ⚠ Three consecutive failures DISABLE it. `flush()` runs many times a
     * second; a call that throws every time would otherwise turn one bad API
     * assumption into a log flood and a stalled sitting. Disabling leaves the
     * failure legible in `ui.hwStatus` instead, which is the outcome that can
     * still be written up.
     */
    public void updateHardware() {
        if (surface == null || updateHardwareDisabled) {
            return;
        }
        try {
            if (pixelsDirty) {
                renderPixels(pixelScene);
            }
            surface.updateHardware();
            updateHardwareCalls++;
        } catch (Throwable t) {
            updateHardwareFailures++;
            updateHardwareError = t.getClass().getSimpleName() + ": " + t.getMessage();
            if (updateHardwareFailures >= 3) {
                updateHardwareDisabled = true;
                host.errorln("[ghostnote] HardwareSurface.updateHardware() failed 3x, disabling: "
                    + updateHardwareError);
            }
        }
    }

    /** Ask Bitwig to flush soon, so a pushed light or line shows up promptly. */
    public void requestFlush() {
        host.requestFlush();
    }
}

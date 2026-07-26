package com.ghostnote.extension;

import com.bitwig.extension.api.graphics.Bitmap;
import com.bitwig.extension.api.graphics.BitmapFormat;
import com.bitwig.extension.controller.api.ControllerHost;

/**
 * E14 row I — `host.createBitmap` + `GraphicsOutput` + `showDisplayWindow()`.
 *
 * ⚠ **PROBED 2026-07-25 — the verdict is ○, and the window is the ONLY thing that
 * failed.** `showDisplayWindow()` produces nothing on macOS / Bitwig 6.0.6: no
 * window, no flash, no error, measured with `extension-dev : true` both unset and
 * set. Everything below it works — the bitmap allocates in ~5.5ms, all three
 * scenes render, and the renderer turned out to be genuinely capable (see
 * {@link PanelRenderer}). So the finding is "renders fine, cannot be displayed",
 * and `FINDINGS.md` §E14 rows H/I carries the artifacts that show it.
 *
 * ⚠ **The load-bearing finding came from {@link #attemptLateCreate}, not from the
 * window.** `host.createBitmap` after `init()` is REFUSED — *"This can only be
 * called during driver initialization"*, verbatim E14-C2's refusal on
 * `getDocumentState()` settings, from an unrelated subsystem. Pre-allocation is
 * now the default assumption for any Bitwig resource (D7, standing rule 13), on
 * its fourth independent occurrence.
 *
 * ⚠ **Speculative, and gated by its own javadoc**: *"Call this method to show a
 * window which displays the bitmap. You should see this as a debug utility
 * rather than a Control Surface API feature."* That sentence is why row I must
 * not become load-bearing whatever it measures — Bitwig has told us in advance
 * that this is not a supported product surface. The row is probed anyway
 * because the cost is 20 minutes and the payoff, if the window persists and
 * redraws, would change what Phase 3 has to build.
 *
 * **Three questions, in descending order of consequence:**
 * <ol>
 *   <li>Does the window PERSIST while the user works in Bitwig? Same question as
 *       row H's, and for the same reason: E14 found the controller pane closes
 *       on click-away, which is what sent take navigation to the Phase-3 web
 *       view (D14). A surface that also vanishes changes nothing.</li>
 *   <li>Does it REDRAW on demand — does a second `bitmap.render(…)` reach the
 *       already-open window without another `showDisplayWindow()`? A view that
 *       needs re-showing to update is a view that steals focus on every
 *       update.</li>
 *   <li>Does it render text and paths acceptably? Answered twice over: by eye in
 *       the window, and — the part that does not need a human — by
 *       `saveToDiskAsPPM`, which makes the render inspectable offline and turns
 *       "looks fine" into an artifact.</li>
 * </ol>
 *
 * ⚠ **Row I is deliberately independent of row H.** It needs no `extension-dev`
 * flag, no simulated device, and no restart, so it can be run BEFORE the config
 * change that row H requires — which means a failed row-H setup costs row I
 * nothing. Separate objects, separate construction, separate `available` flags,
 * for exactly that reason.
 *
 * ⚠ The bitmap is allocated at INIT, not on demand. Not caution for its own
 * sake: E14-C2 found `getDocumentState()` settings are init-only ("This can only
 * be called during driver initialization"), which is the §3a pre-allocation
 * idiom on its third occurrence, and nothing says graphics allocation is
 * different. Whether it IS different is worth knowing, so
 * {@link #attemptLateCreate} asks — opt-in, reported rather than thrown, and
 * sequenced last in the probe because it is the one call here with no
 * precedent.
 */
public final class DisplayWindow {
    /** Large enough to judge text at real UI sizes rather than at icon sizes. */
    public static final int WIDTH = 640;
    public static final int HEIGHT = 320;
    public static final String DEFAULT_TITLE = "ghostnote — E14 row I";

    /** Null when the bitmap was allocated; the reason otherwise. */
    public final String error;
    /** Null when {@link #error} is set. */
    public final Bitmap bitmap;
    public final long constructNanos;

    public boolean shown = false;
    public int showCalls = 0;
    public String title = "";
    public int renderCount = 0;
    public PanelRenderer lastRender;
    public String lastSavedPath = "";

    /** Result of the opt-in late-allocation probe; never attempted by default. */
    public String lateCreateResult = "(not attempted)";

    /** Never throws — see {@link HardwarePanel#create}, same discipline. */
    public static DisplayWindow create(ControllerHost host) {
        try {
            return new DisplayWindow(host);
        } catch (Throwable t) {
            return new DisplayWindow(t.getClass().getSimpleName() + ": " + t.getMessage());
        }
    }

    private DisplayWindow(String error) {
        this.error = error;
        this.bitmap = null;
        this.constructNanos = 0;
    }

    private DisplayWindow(ControllerHost host) {
        long start = System.nanoTime();
        this.error = null;
        this.bitmap = host.createBitmap(WIDTH, HEIGHT, BitmapFormat.ARGB32);
        this.constructNanos = System.nanoTime() - start;
    }

    public boolean available() {
        return bitmap != null;
    }

    /**
     * Set the title and show the window.
     *
     * ⚠ The title is validated by the CALLER before it gets here (D15 rule 3).
     * Nothing documents what an over-long or null title does, and a handler's
     * try/catch would not save us if Bitwig deferred the complaint — E14-A1.
     */
    public void show(String title) {
        this.title = title;
        bitmap.setDisplayWindowTitle(title);
        bitmap.showDisplayWindow();
        showCalls++;
        shown = true;
    }

    /**
     * Redraw. Question 2 above is whether an already-open window notices.
     *
     * The subtitle carries the render count so the answer is readable off the
     * window itself: if the number on screen tracks the number in the response,
     * the window redraws on demand and no further prompting is needed.
     */
    public PanelRenderer render(String scene) {
        PanelRenderer renderer = new PanelRenderer(
            scene, WIDTH, HEIGHT, HardwarePanel.TAKE_LABELS, renderCount % HardwarePanel.TAKE_LABELS.length,
            "E14 row I · render #" + (renderCount + 1));
        bitmap.render(renderer);
        renderCount++;
        lastRender = renderer;
        return renderer;
    }

    /** ⚠ Path validated by the caller — `UiHandlers.requireSavePath`. */
    public void save(String path) {
        bitmap.saveToDiskAsPPM(path);
        lastSavedPath = path;
    }

    /**
     * Can a bitmap be allocated AFTER init?
     *
     * Reported, never thrown, and never run unless asked — the same shape as
     * `ui.addSetting`, which is what settled E14-C2. "Bitwig refuses" and
     * "Bitwig accepts and hands back something dead" are different answers, so
     * the returned bitmap is measured rather than merely received.
     */
    public String attemptLateCreate(ControllerHost host) {
        try {
            Bitmap late = host.createBitmap(64, 32, BitmapFormat.ARGB32);
            lateCreateResult = late == null
                ? "accepted but returned null"
                : "accepted: " + late.getWidth() + "x" + late.getHeight();
        } catch (Throwable t) {
            lateCreateResult = "refused: " + t.getClass().getSimpleName() + ": " + t.getMessage();
        }
        return lateCreateResult;
    }
}

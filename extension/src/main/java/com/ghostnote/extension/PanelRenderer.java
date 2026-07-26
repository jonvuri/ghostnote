package com.ghostnote.extension;

import com.bitwig.extension.api.graphics.FontExtents;
import com.bitwig.extension.api.graphics.GraphicsOutput;
import com.bitwig.extension.api.graphics.Renderer;
import com.bitwig.extension.api.graphics.TextExtents;

/**
 * E14 rows H and I — the one thing both speculative rows actually need: something
 * to draw.
 *
 * Row H asks whether an embedded {@code createHardwarePixelDisplay} renders
 * usefully; row I asks whether a standalone {@code host.createBitmap} +
 * {@code showDisplayWindow()} renders text and paths acceptably. Both questions
 * are about the SAME `GraphicsOutput`, so both get the same renderer and the
 * answers stay comparable — a difference between them is then a fact about the
 * two surfaces rather than about two different drawing routines.
 *
 * ⚠ **Nothing here may throw.** `Bitmap.render(Renderer)` hands control back to
 * us from inside Bitwig, and E14-A1 established that an exception Bitwig defers
 * to its own thread escapes every extension frame and takes the DAW with it.
 * That crash was Bitwig throwing, which we could not have prevented; this is the
 * inverse and it IS preventable, so the whole body sits inside one
 * `catch (Throwable)` that records the failure into {@link #error} instead of
 * letting it out. Catching here is legitimate precisely because the frame is
 * ours: it is our code that would throw, in our own stack, synchronously.
 * Compare D15 rule 3 — validate before calling — which is what the CALLER of
 * this class does with {@link #SCENES}.
 *
 * ⚠ **No `setFontFace`.** `Host.loadFontFace(String)` wants a path to a font
 * file we would have to ship and locate at runtime, which is a whole failure
 * mode of its own for a timeboxed probe. Everything below uses whatever face the
 * `GraphicsOutput` starts with. If that turns out to be no face at all, the row
 * verdict is "text needs a bundled font", which is worth knowing and is exactly
 * what {@link #textWidth} measures without anyone having to squint at a window.
 * > ● **MEASURED 2026-07-25: the default face is real and no bundled font is
 * > needed.** `"Take B · 12 notes"` at 12px measures 91×9 with ascent 12 and
 * > line-height 14; both `—` and `·` render, so Latin-1 coverage is there.
 *
 * ⚠ **The renderer outlived both rows it was built for, and is the reason they
 * are worth re-reading.** Rows H and I both returned ○ — the hardware GUI closes
 * on click-away and `showDisplayWindow()` never opens — but `GraphicsOutput`
 * itself measured ● on every axis: cleanly antialiased text readable down to
 * ~10px, smooth béziers, correct dash phase, and **working alpha compositing**
 * (which is the before/after overlay a Phase-3 diff view would want). A warm
 * 640×320 re-render costs ~300µs; `showText` is the expensive primitive at
 * roughly 1ms per string, and geometry is nearly free. **If an in-Bitwig raster
 * panel is ever wanted, the drawing is solved and only the window is missing.**
 * Artifacts: `brain/.tmp/e14/*.png` via `brain/src/probes/ppm.ts`.
 *
 * The scenes are deliberately three different questions:
 * <ul>
 *   <li>{@code takes} — the thing D14 would actually want here: an A/B/C/D take
 *       strip with the current one highlighted, plus a sketch of a note diff. It
 *       is the only scene that answers "could this BE the take switcher".</li>
 *   <li>{@code text} — the same string at six sizes, because "renders text
 *       acceptably" is a question about the small sizes, not the large ones.</li>
 *   <li>{@code paths} — strokes, dashes, curves, fills and alpha, because a
 *       diff view is mostly paths and a surface that cannot antialias a curve
 *       cannot draw a velocity ramp either.</li>
 * </ul>
 */
public final class PanelRenderer implements Renderer {
    /** The legal `scene` values. ⚠ Callers validate against this BEFORE calling. */
    public static final String[] SCENES = { "takes", "text", "paths" };

    /** The string whose extents are measured, at {@link #PROBE_FONT_SIZE}. */
    public static final String PROBE_TEXT = "Take B · 12 notes";
    public static final double PROBE_FONT_SIZE = 12;

    private final String scene;
    private final int width;
    private final int height;
    private final String[] chips;
    private final int current;
    private final String subtitle;

    // --- what the render REPORTED, read back over the wire afterwards --------
    /** Null when the render completed; the failure otherwise. */
    public String error;
    /** True once the scene body ran to completion. */
    public boolean rendered;
    /** Nanos spent inside our own body — not including anything Bitwig defers. */
    public long renderNanos;

    /**
     * Text metrics for {@link #PROBE_TEXT}, or -1 when the query failed.
     *
     * The programmatic half of "does text render". A width of 0 or -1 with a
     * clean `rendered` flag means the font system accepted the calls and drew
     * nothing, which looks identical to success from the extension side and is
     * the failure mode most worth catching without eyes on a window.
     */
    public double textWidth = -1;
    public double textHeight = -1;
    public double textAdvanceX = -1;
    public double fontAscent = -1;
    public double fontDescent = -1;
    public double fontHeight = -1;
    /** Set when the metrics query itself threw, separately from the scene body. */
    public String textError;

    public PanelRenderer(String scene, int width, int height, String[] chips, int current, String subtitle) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.chips = chips;
        this.current = current;
        this.subtitle = subtitle;
    }

    /** True when `scene` is one of {@link #SCENES}. */
    public static boolean isKnownScene(String scene) {
        for (String s : SCENES) {
            if (s.equals(scene)) {
                return true;
            }
        }
        return false;
    }

    public String scene() {
        return scene;
    }

    @Override
    public void render(GraphicsOutput g) {
        long start = System.nanoTime();
        try {
            background(g);
            // Measured BEFORE the scene body so a scene that throws still leaves
            // the metrics behind — they are the more transferable finding.
            measureText(g);
            switch (scene) {
                case "text": renderText(g); break;
                case "paths": renderPaths(g); break;
                default: renderTakes(g); break;
            }
            rendered = true;
        } catch (Throwable t) {
            // See the class note: this frame is ours, so this catch works. It
            // exists so a drawing bug degrades to a ○ verdict with a message
            // rather than to whatever Bitwig does with an exception thrown back
            // out of a render callback.
            error = t.getClass().getSimpleName() + ": " + t.getMessage();
        }
        renderNanos = System.nanoTime() - start;
    }

    // ------------------------------------------------------------------ scenes

    private void background(GraphicsOutput g) {
        g.setColor(0.07, 0.07, 0.09);
        g.rectangle(0, 0, width, height);
        g.fill();
    }

    /**
     * Its own try/catch, because "the font system is unavailable" and "the scene
     * failed to draw" are different verdicts and collapsing them would lose the
     * distinction that decides whether row H/I is worth revisiting.
     */
    private void measureText(GraphicsOutput g) {
        try {
            g.setFontSize(PROBE_FONT_SIZE);
            TextExtents te = g.getTextExtents(PROBE_TEXT);
            textWidth = te.getWidth();
            textHeight = te.getHeight();
            textAdvanceX = te.getAdvanceX();
            FontExtents fe = g.getFontExtents();
            fontAscent = fe.getAscent();
            fontDescent = fe.getDescent();
            fontHeight = fe.getHeight();
        } catch (Throwable t) {
            textError = t.getClass().getSimpleName() + ": " + t.getMessage();
        }
    }

    /**
     * The take strip — the only scene that answers a product question.
     *
     * D14 sent take navigation to the Phase-3 web view because the controller
     * pane closes on click-away. If a hardware surface can draw THIS and stay
     * open, that decision is worth re-opening; if it cannot, nothing else about
     * rows H/I matters.
     */
    private void renderTakes(GraphicsOutput g) {
        double pad = Math.max(4, height * 0.08);
        double titleSize = Math.max(9, height * 0.17);

        g.setColor(0.85, 0.86, 0.90);
        g.setFontSize(titleSize);
        g.moveTo(pad, pad + titleSize);
        g.showText("ghostnote — takes");

        int n = Math.max(1, chips.length);
        double chipTop = pad + titleSize * 1.6;
        double chipH = Math.max(10, height * 0.28);
        double gap = Math.max(2, width * 0.015);
        double chipW = (width - pad * 2 - gap * (n - 1)) / n;
        double chipFont = Math.max(8, chipH * 0.55);

        for (int i = 0; i < n; i++) {
            double x = pad + i * (chipW + gap);
            boolean isCurrent = i == current;
            if (isCurrent) {
                g.setColor(0.24, 0.68, 0.44);
            } else {
                g.setColor(0.16, 0.16, 0.19);
            }
            g.rectangle(x, chipTop, chipW, chipH);
            g.fill();

            if (isCurrent) {
                g.setColor(0.05, 0.09, 0.06);
            } else {
                g.setColor(0.72, 0.72, 0.76);
            }
            g.setFontSize(chipFont);
            String label = chips[i];
            double tx = x + chipW / 2;
            try {
                tx -= g.getTextExtents(label).getWidth() / 2;
            } catch (Throwable ignored) {
                // Centering is cosmetic; a font system that cannot measure is
                // already recorded by measureText().
            }
            g.moveTo(tx, chipTop + chipH / 2 + chipFont * 0.35);
            g.showText(label);
        }

        // A sketch of the note diff the take strip would sit above: kept blocks
        // in grey, added ones in the accent colour. Not a real diff — the point
        // is whether small filled rectangles at this density read as anything.
        double sketchTop = chipTop + chipH + Math.max(3, height * 0.06);
        double sketchH = Math.max(4, height - sketchTop - pad);
        if (sketchH > 3) {
            for (int i = 0; i < 16; i++) {
                double bw = (width - pad * 2) / 16.0;
                double x = pad + i * bw;
                double h = sketchH * (0.35 + 0.65 * ((i * 7 % 5) / 4.0));
                boolean added = i % 5 == 2;
                g.setColor(added ? 0.24 : 0.34, added ? 0.68 : 0.34, added ? 0.44 : 0.38);
                g.rectangle(x, sketchTop + (sketchH - h), Math.max(1, bw - 1.5), h);
                g.fill();
            }
        }

        if (subtitle != null && !subtitle.isEmpty()) {
            g.setColor(0.55, 0.56, 0.60);
            g.setFontSize(Math.max(7, height * 0.11));
            g.moveTo(pad, height - pad * 0.35);
            g.showText(subtitle);
        }
    }

    /**
     * The same string at six sizes.
     *
     * "Renders text acceptably" is only ever a question about the SMALL sizes —
     * anything renders 24px — so the ladder starts at 8 and the verdict is read
     * off the top of it, not the bottom. The non-ASCII middle dot is deliberate:
     * a default font face with no Latin-1 coverage fails visibly there first.
     */
    private void renderText(GraphicsOutput g) {
        double[] sizes = { 8, 10, 12, 14, 18, 24 };
        double y = 6;
        for (double size : sizes) {
            y += size * 1.45;
            if (y > height - 2) {
                break;
            }
            g.setColor(0.86, 0.87, 0.90);
            g.setFontSize(size);
            g.moveTo(6, y);
            g.showText((int) size + "px  " + PROBE_TEXT + "  0123456789");
        }
    }

    /**
     * Strokes, dashes, curves, alpha and a fill.
     *
     * A diff view is mostly paths, so this is the scene that decides whether the
     * surface could draw one: a velocity ramp is a curve, a note is a filled
     * rect, a "changed" marker is a dashed outline, and an overlay of before on
     * after is alpha.
     */
    private void renderPaths(GraphicsOutput g) {
        double w = width;
        double h = height;

        g.setColor(0.30, 0.62, 0.90);
        g.setLineWidth(1);
        g.moveTo(6, h * 0.25);
        g.curveTo(w * 0.3, h * 0.02, w * 0.6, h * 0.48, w - 6, h * 0.18);
        g.stroke();

        // save/restore rather than clearing the dash afterwards: an empty dash
        // array is cairo's documented "no dashing", but nothing in the Bitwig
        // javadoc promises that reading, and this is not a surface to guess on.
        g.save();
        g.setColor(0.90, 0.55, 0.25);
        g.setLineWidth(3);
        g.setDash(new double[] { 6, 4 }, 0);
        g.moveTo(6, h * 0.45);
        g.lineTo(w - 6, h * 0.45);
        g.stroke();
        g.restore();

        g.setColor(0.40, 0.80, 0.55, 0.45);
        g.circle(w * 0.25, h * 0.72, Math.min(w, h) * 0.18);
        g.fill();
        g.setColor(0.85, 0.35, 0.45, 0.45);
        g.circle(w * 0.34, h * 0.72, Math.min(w, h) * 0.18);
        g.fill();

        g.setColor(0.75, 0.76, 0.80);
        g.setLineWidth(0.75);
        for (int i = 0; i < 6; i++) {
            double x = w * 0.55 + i * (w * 0.06);
            g.moveTo(x, h * 0.55);
            g.lineTo(x, h * 0.92);
        }
        g.stroke();
    }
}

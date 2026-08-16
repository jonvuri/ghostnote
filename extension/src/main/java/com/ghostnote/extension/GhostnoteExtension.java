package com.ghostnote.extension;

import com.bitwig.extension.controller.ControllerExtension;
import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.handlers.AppHandlers;
import com.ghostnote.extension.handlers.BatchHandlers;
import com.ghostnote.extension.handlers.BranchHandlers;
import com.ghostnote.extension.handlers.ContainerHandlers;
import com.ghostnote.extension.handlers.CoreHandlers;
import com.ghostnote.extension.handlers.CursorHandlers;
import com.ghostnote.extension.handlers.DeviceHandlers;
import com.ghostnote.extension.handlers.ExecState;
import com.ghostnote.extension.handlers.HandlerRegistry;
import com.ghostnote.extension.handlers.NoteHandlers;
import com.ghostnote.extension.handlers.ObservationHandlers;
import com.ghostnote.extension.handlers.ParamHandlers;
import com.ghostnote.extension.handlers.StructureHandlers;
import com.ghostnote.extension.handlers.TrackHandlers;
import com.ghostnote.extension.handlers.UiHandlers;

public class GhostnoteExtension extends ControllerExtension {
    // Spike: hardcoded. Becomes config-driven post-spike.
    private static final int PORT = 8686;

    private Bridge bridge;
    /** E14 row H. Held because `flush()` has to push its output state. */
    private HardwarePanel hardware;

    protected GhostnoteExtension(
            final GhostnoteExtensionDefinition definition,
            final ControllerHost host) {
        super(definition, host);
    }

    @Override
    public void init() {
        final ControllerHost host = getHost();

        final long initStart = System.nanoTime();
        final RigConfig config = RigConfig.load();
        final Rig rig = new Rig(host, config);

        // The panel is the ONLY init-time construction allowed to fail without
        // taking the extension with it. Everything it touches is ◐ doc-only
        // (E14), which is the E7-Finding-0 hazard class — and a dead bridge would
        // cost the whole live sitting the panel exists to serve. `ui.status` then
        // reports `available: false` with the reason instead.
        UiPanel panel = null;
        String panelError = "";
        try {
            panel = new UiPanel(host, config);
        } catch (Throwable t) {
            panelError = t.getClass().getSimpleName() + ": " + t.getMessage();
            host.errorln("[ghostnote] UI panel (E14) failed to build: " + panelError);
        }
        // E14 rows H and I — the two speculative ones. Both own their own
        // failure handling (`create` never throws), so there is no try/catch
        // here and no parallel error string: an unavailable surface reports
        // itself through `ui.hwStatus` / `ui.bitmapStatus` with the reason.
        //
        // ⚠ Neither may become load-bearing. Row H ships behind `extension-dev :
        // true` plus two right-click menus; row I's own javadoc calls
        // `showDisplayWindow` a debug utility. They are probed because a
        // persistent, clickable in-Bitwig panel would reopen D14's split of the
        // human surface — not because anything is planned on top of them.
        hardware = HardwarePanel.create(host);
        if (!hardware.available()) {
            host.errorln("[ghostnote] hardware surface (E14-H) unavailable: " + hardware.error);
        }
        final DisplayWindow display = DisplayWindow.create(host);
        if (!display.available()) {
            host.errorln("[ghostnote] display bitmap (E14-I) unavailable: " + display.error);
        }

        // `panelLayout()` is read by ui.status; marking it here keeps the guarded
        // read in UiHandlers honest rather than silently reporting an error string.
        try {
            rig.application.panelLayout().markInterested();
        } catch (Throwable t) {
            host.errorln("[ghostnote] panelLayout() not markable: " + t.getMessage());
        }

        // The registry is just a map, so it can be handed to the groups that need
        // to dispatch back into it (batch.run) or introspect it (contract.hello)
        // before any of them have registered. Registration happens at construction
        // time, dispatch at request time — no cycle.
        final ExecState state = new ExecState();
        final HandlerRegistry registry = new HandlerRegistry();
        registry.register(
            new CoreHandlers(host, rig, state, registry),
            new TrackHandlers(host, rig, state),
            new CursorHandlers(host, rig, state),
            new NoteHandlers(host, rig, state),
            new StructureHandlers(host, rig, state),
            new DeviceHandlers(host, rig, state),
            new ContainerHandlers(host, rig, state),
            new ParamHandlers(host, rig, state),
            new AppHandlers(host, rig, state),
            new BranchHandlers(host, rig, state),
            new ObservationHandlers(host, rig, state, panel, panelError),
            new UiHandlers(host, rig, state, panel, panelError, hardware, display),
            new BatchHandlers(host, rig, state, registry));

        try {
            bridge = new Bridge(PORT, host, registry);
            bridge.start();
            state.setInitStats(System.nanoTime() - initStart, System.currentTimeMillis());
            host.showPopupNotification("ghostnote bridge listening on 127.0.0.1:" + PORT);
            host.println("[ghostnote] init complete, port " + PORT
                + ", rig=" + config.stamp
                + " tracks=" + config.tracks + " scenes=" + config.scenes
                + " rigConstructMs=" + (rig.constructNanos / 1_000_000)
                + " methods=" + registry.methodNames().size());
        } catch (Exception e) {
            host.errorln("[ghostnote] failed to start bridge: " + e.getMessage());
            host.showPopupNotification("ghostnote bridge FAILED to start: " + e.getMessage());
        }
    }

    @Override
    public void exit() {
        if (bridge != null) {
            bridge.stop();
        }
        getHost().showPopupNotification("ghostnote bridge stopped");
    }

    /**
     * ⚠ Was empty until E14 row H, and the addition is not free: `flush()` runs
     * many times a second, so this is the only ghostnote code on a hot path.
     *
     * `HardwareSurface.updateHardware()` is the documented place to push output
     * state, and it is where the pixel display gets redrawn after a press marked
     * it stale. {@link HardwarePanel#updateHardware()} owns the guard — three
     * consecutive failures disable the call rather than logging on every frame.
     */
    @Override
    public void flush() {
        if (hardware != null) {
            hardware.updateHardware();
        }
    }
}

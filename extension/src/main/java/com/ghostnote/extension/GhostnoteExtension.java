package com.ghostnote.extension;

import com.bitwig.extension.controller.ControllerExtension;
import com.bitwig.extension.controller.api.ControllerHost;

public class GhostnoteExtension extends ControllerExtension {
    // Spike: hardcoded. Becomes config-driven post-spike.
    private static final int PORT = 8686;

    private Bridge bridge;

    protected GhostnoteExtension(
            final GhostnoteExtensionDefinition definition,
            final ControllerHost host) {
        super(definition, host);
    }

    @Override
    public void init() {
        final ControllerHost host = getHost();

        final ProbeHandlers handlers = new ProbeHandlers(host);

        try {
            bridge = new Bridge(PORT, host, handlers);
            bridge.start();
            host.showPopupNotification("ghostnote bridge listening on 127.0.0.1:" + PORT);
            host.println("[ghostnote] init complete, port " + PORT);
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

    @Override
    public void flush() {
    }
}

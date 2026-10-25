package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.ScopeScrollProbe;
import com.google.gson.JsonObject;

/** B08 scrollable-scope research. Probe resources are allocated only in the research profile. */
public final class ScopeScrollHandlers extends HandlerGroup {
    private final ScopeScrollProbe probe;

    public ScopeScrollHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
        probe = rig.profile.hasProbeResources()
            ? new ScopeScrollProbe(rig.cursorTracks[0], rig.cursorDeviceBanks[0], rig.config.deviceBank,
                this::context)
            : null;
    }

    private JsonObject context() {
        JsonObject result = new JsonObject();
        result.addProperty("project", rig.currentProjectName());
        result.addProperty("generation", rig.epochGeneration);
        result.addProperty("trackExists", rig.cursorTracks[0].exists().get());
        result.addProperty("trackId", rig.cursorTracks[0].channelId().get());
        result.addProperty("trackName", rig.cursorTracks[0].name().get());
        result.addProperty("deviceCount", rig.cursorDeviceBanks[0].itemCount().get());
        return result;
    }

    @Override public void register(HandlerRegistry registry) {
        registry.on("probe.scopeScroll", params -> probe.handle(params));
    }
}

package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.BrowserDiscoveryProbe;
import com.ghostnote.extension.Rig;
import com.google.gson.JsonObject;

/** Probe resources are allocated only in the research profile. */
public final class BrowserDiscoveryHandlers extends HandlerGroup {
    private final BrowserDiscoveryProbe probe;

    public BrowserDiscoveryHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
        probe = rig.profile.hasProbeResources()
            ? new BrowserDiscoveryProbe(host.createPopupBrowser(), this::context,
                () -> rig.cursorTracks[0].endOfDeviceChainInsertionPoint().browse()) : null;
    }

    private JsonObject context() {
        JsonObject result = new JsonObject();
        result.addProperty("project", rig.currentProjectName());
        result.addProperty("generation", rig.epochGeneration);
        result.addProperty("trackExists", rig.cursorTracks[0].exists().get());
        result.addProperty("trackId", rig.cursorTracks[0].channelId().get());
        result.addProperty("trackName", rig.cursorTracks[0].name().get());
        result.addProperty("deviceCount", rig.cursorDeviceBanks[0].itemCount().get());
        result.addProperty("selectionRevision", rig.selectionRevision);
        result.addProperty("mixerIndex", rig.selectedMixerTrackIndex);
        result.addProperty("slotTrackIndex", rig.selectedTrackIndex);
        result.addProperty("slotIndex", rig.selectedSlotIndex);
        return result;
    }

    @Override public void register(HandlerRegistry registry) {
        registry.on("probe.browserDiscovery", params -> probe.handle(params));
    }
}

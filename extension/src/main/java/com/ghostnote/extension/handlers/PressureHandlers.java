package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.PressureProbe;
import com.ghostnote.extension.Rig;
import com.google.gson.JsonObject;

/** Probe-only transport for the independently observed public-API pressure experiment. */
public final class PressureHandlers extends HandlerGroup {
    private final PressureProbe probe;

    public PressureHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
        probe = rig.profile.hasProbeResources()
            ? new PressureProbe(rig.cursorTracks[0], () -> rig.epochGeneration + ":" + rig.currentProjectName())
            : null;
    }

    @Override public void register(HandlerRegistry registry) {
        registry.on("probe.pressure", params -> handle(params));
    }

    private JsonObject handle(JsonObject params) {
        String operation = params.get("operation").getAsString();
        return switch (operation) {
            case "status" -> probe.status();
            case "read" -> probe.read();
            case "point" -> probe.point(rig.cursorClips[0], false, false);
            case "writerAway" -> probe.point(rig.cursorClips[0], true, true);
            case "writerBack" -> probe.point(rig.cursorClips[0], true, false);
            case "writePressure" -> probe.write("pressure");
            case "writeVelocity" -> probe.write("velocity");
            default -> throw new IllegalArgumentException("unknown R02 pressure operation");
        };
    }
}

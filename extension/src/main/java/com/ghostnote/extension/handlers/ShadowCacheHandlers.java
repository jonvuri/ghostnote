package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Rig;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Research operations of the probe profile. 8h3e removed the resident-grid research; the 8h3d
 * change-watch probe and the 8h1a fixture writer remain. Every product reader stays authoritative.
 */
public final class ShadowCacheHandlers extends HandlerGroup {
    public ShadowCacheHandlers(ControllerHost host, Rig rig, ExecState state) { super(host, rig, state); }

    @Override public void register(HandlerRegistry r) {
        r.on("cache.shadow", this::dispatch);
    }

    private JsonElement fixture(String operation, JsonObject params) {
        var fixture = rig.kneeFixture;
        if (fixture == null) throw new IllegalStateException("knee fixture resources are not allocated");
        return switch (operation) {
            case "fixtureStatus" -> fixture.status();
            case "fixturePoint" -> fixture.point(requireTrack(params.get("trackIndex").getAsInt()));
            case "fixtureSelect" -> fixture.select(requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt());
            case "fixturePin" -> fixture.pin(params.get("pinned").getAsBoolean());
            case "fixtureWrite" -> fixture.write(params.get("count").getAsLong(), params.get("width").getAsLong(),
                params.get("from").getAsLong(), params.get("size").getAsInt(),
                params.has("semitones") ? params.get("semitones").getAsInt() : 0,
                params.has("durationCap") ? params.get("durationCap").getAsLong() : 64);
            case "fixtureReconstruct" -> fixture.reconstruct(params.get("count").getAsLong(), params.get("width").getAsLong(),
                params.get("from").getAsLong(), params.get("size").getAsInt(),
                params.get("fromShift").getAsInt(), params.get("toShift").getAsInt());
            case "fixtureTranspose" -> fixture.transpose(params.get("semitones").getAsInt());
            case "fixtureRead" -> fixture.read(params.getAsJsonArray("coordinates"));
            case "fixtureEdit" -> fixture.edit(params.getAsJsonArray("ops"));
            case "fixtureDecorate" -> fixture.decorate(params.get("count").getAsLong(), params.get("width").getAsLong(),
                params.get("from").getAsLong(), params.get("size").getAsInt());
            default -> throw new IllegalArgumentException("unknown knee fixture operation");
        };
    }

    /** 8h3d change-awareness research. Every reply keeps complete:false and eligible:false. */
    private JsonElement watch(String operation, JsonObject params) {
        var watch = rig.changeWatchProbe;
        if (watch == null) throw new IllegalStateException("change-watch research resources are not allocated");
        return switch (operation) {
            case "watchStatus" -> params.has("index") ? watch.status(params.get("index").getAsInt()) : watch.status();
            case "watchBind" -> watch.bind(params.get("index").getAsInt(), params.get("trackIndex").getAsInt(),
                params.get("row").getAsInt(), params.get("channelId").getAsString());
            case "watchMark" -> watch.mark(params.get("index").getAsInt());
            case "watchRelease" -> watch.release(params.get("index").getAsInt());
            case "watchValuesBind" -> watch.valuesBind(params.get("trackIndex").getAsInt(), params.get("row").getAsInt(),
                params.get("channelId").getAsString());
            case "watchValuesPin" -> watch.valuesPin(params.get("pinned").getAsBoolean());
            case "watchValuesMark" -> watch.valuesMark();
            case "watchValuesStatus" -> watch.valuesStatus();
            default -> throw new IllegalArgumentException("unknown change-watch research operation");
        };
    }

    private JsonElement dispatch(JsonObject params) {
        String operation = params.get("operation").getAsString();
        if (operation.startsWith("watch")) return watch(operation, params);
        if (operation.startsWith("fixture")) return fixture(operation, params);
        throw new IllegalArgumentException("unknown research operation: " + operation);
    }
}

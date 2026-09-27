package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Track;
import com.ghostnote.extension.CacheScaleProbe;
import com.ghostnote.extension.Rig;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** One probe-only dispatch point for the Phase 8e cache-scale matrix. */
public final class CacheScaleHandlers extends HandlerGroup {
    public CacheScaleHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("cache.scale", this::dispatch);
    }

    private JsonElement dispatch(JsonObject params) {
        CacheScaleProbe probe = rig.cacheScaleProbe;
        if (probe == null) {
            throw new IllegalStateException("cache scale resources are not allocated");
        }
        String operation = params.get("operation").getAsString();
        String kind = params.has("kind") ? params.get("kind").getAsString() : "count";
        int index = params.has("index") ? params.get("index").getAsInt() : 0;
        int limit = params.has("limit") ? params.get("limit").getAsInt() : 0;
        return switch (operation) {
            case "info" -> probe.info();
            case "prepare" -> probe.prepare(kind, limit);
            case "point" -> probe.point(kind, index, requireTrack(params));
            case "bind" -> probe.bind(
                kind, index, requireTrack(params), params.get("row").getAsInt());
            case "select" -> probe.select(
                kind, index, requireTrack(params), params.get("row").getAsInt());
            case "pin" -> probe.pin(kind, index, params.get("pinned").getAsBoolean());
            case "pinTrack" -> probe.pinTrack(
                kind, index, params.get("pinned").getAsBoolean());
            case "status" -> probe.status(kind, index);
            case "read" -> probe.read(kind, limit);
            case "reconcile" -> probe.reconcile(kind, limit);
            case "pause" -> probe.pause(kind, limit, params.get("paused").getAsBoolean());
            case "directRead" -> probe.directRead(
                kind, index, params.get("x").getAsInt(), params.get("y").getAsInt());
            case "mutate" -> probe.mutate(params);
            case "mutateMany" -> probe.mutateMany(params);
            case "mutateBatch" -> probe.mutateBatch(params);
            default -> throw new IllegalArgumentException(
                "unknown cache scale operation: " + operation);
        };
    }

    private Track requireTrack(JsonObject params) {
        return requireTrack(params.get("trackIndex").getAsInt());
    }
}

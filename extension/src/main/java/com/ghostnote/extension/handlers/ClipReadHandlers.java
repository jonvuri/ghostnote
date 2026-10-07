package com.ghostnote.extension.handlers;

import com.ghostnote.extension.ClipReader;
import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonObject;

/**
 * 8h3c: the product clip read. `clip.read` opens one read through the write gate and replies when the read
 * closes, with the first `notes-v1` page or a refusal. `clip.readPage` returns a later page of that read.
 */
public final class ClipReadHandlers extends HandlerGroup {
    private final HandlerRegistry registry;

    public ClipReadHandlers(ControllerHost host, Rig rig, ExecState state, HandlerRegistry registry) {
        super(host, rig, state);
        this.registry = registry;
    }

    @Override
    public void register(HandlerRegistry r) {
        r.onAsync("clip.read", (params, reply) -> {
            try {
                rig.clipReader.open(
                    params.get("trackIndex").getAsInt(),
                    params.get("row").getAsInt(),
                    params.get("channelId").getAsString(),
                    params.has("deadlineMs") ? params.get("deadlineMs").getAsInt() : ClipReader.DEADLINE_MS,
                    params.has("diagnosticFault") ? params.get("diagnosticFault").getAsString() : "",
                    params.has("diagnosticRoute") ? params.get("diagnosticRoute").getAsString() : "",
                    result -> {
                        registry.gate().readClosed();
                        reply.result(result, 0);
                    });
            } catch (RuntimeException error) {
                // A refused precondition changed nothing. Close the gate before the reply.
                registry.gate().readClosed();
                throw error;
            }
        });
        // 8h4a5: point one pool cursor through the expansion of its collapsed parent groups (E243). It holds the
        // gate as a clip read does, so no write runs while a group is expanded.
        r.onAsync("cursor.pointExpanded", (params, reply) -> {
            try {
                rig.groupPoint.open(
                    params.get("cursor").getAsString(),
                    params.get("trackIndex").getAsInt(),
                    params.get("row").getAsInt(),
                    params.get("channelId").getAsString(),
                    result -> {
                        registry.gate().readClosed();
                        reply.result(result, 0);
                    });
            } catch (RuntimeException error) {
                registry.gate().readClosed();
                throw error;
            }
        });
        r.on("clip.readPage", params -> rig.clipReader.page(
            params.get("readId").getAsLong(), params.get("from").getAsInt()));
    }

    /** Reader status for `rig.info` and `rig.stats`, with the write-gate counters. */
    static JsonObject status(Rig rig, HandlerRegistry registry) {
        JsonObject result = rig.clipReader.status();
        JsonObject gate = new JsonObject();
        gate.addProperty("readOpen", registry.gate().readOpen());
        gate.addProperty("waiting", registry.gate().waiting());
        gate.addProperty("leases", registry.gate().leases());
        gate.addProperty("limit", registry.gate().limit());
        gate.addProperty("queuedTotal", registry.gate().queuedTotal());
        gate.addProperty("refusedTotal", registry.gate().refusedTotal());
        result.add("writeGate", gate);
        result.add("groupPoint", rig.groupPoint.status());
        return result;
    }
}

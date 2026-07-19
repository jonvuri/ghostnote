package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Spike experiment handlers. Grows one method group per experiment
 * (E0 ping/info/echo now; E1+ add clip/track/device probes).
 * Throwaway code, but kept idiomatic for lifting into Phase 1.
 */
public class ProbeHandlers implements Bridge.Dispatcher {
    private final ControllerHost host;

    public ProbeHandlers(ControllerHost host) {
        this.host = host;
    }

    @Override
    public JsonElement dispatch(String method, JsonObject params) {
        switch (method) {
            case "ping":
                return ping();
            case "host.info":
                return hostInfo();
            case "echo":
                return params;
            case "notify":
                return notify(params);
            default:
                throw new Bridge.MethodNotFoundException(method);
        }
    }

    private JsonElement ping() {
        JsonObject result = new JsonObject();
        result.addProperty("pong", true);
        result.addProperty("thread", Thread.currentThread().getName());
        return result;
    }

    private JsonElement hostInfo() {
        JsonObject result = new JsonObject();
        result.addProperty("hostApiVersion", host.getHostApiVersion());
        result.addProperty("hostProduct", host.getHostProduct());
        result.addProperty("hostVendor", host.getHostVendor());
        result.addProperty("hostVersion", host.getHostVersion());
        result.addProperty("javaVersion", System.getProperty("java.version"));
        result.addProperty("javaVendor", System.getProperty("java.vendor"));
        return result;
    }

    private JsonElement notify(JsonObject params) {
        String message = params.has("message") ? params.get("message").getAsString() : "ghostnote";
        host.showPopupNotification(message);
        JsonObject result = new JsonObject();
        result.addProperty("shown", true);
        return result;
    }
}

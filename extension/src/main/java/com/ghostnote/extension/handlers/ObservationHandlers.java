package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.UiPanel;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Product transport for the opaque per-project observation record. */
public final class ObservationHandlers extends HandlerGroup {
    private final UiPanel panel;
    private final String panelError;

    public ObservationHandlers(
            ControllerHost host, Rig rig, ExecState state, UiPanel panel, String panelError) {
        super(host, rig, state);
        this.panel = panel;
        this.panelError = panelError;
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("observation.read", params -> read());
        r.on("observation.replace", params -> replace(params));
    }

    private JsonElement read() {
        JsonObject unavailable = unavailable();
        if (unavailable != null) return unavailable;

        JsonObject result = base();
        result.addProperty("available", true);
        result.addProperty("value", panel.recordSetting.get());
        return result;
    }

    private JsonElement replace(JsonObject params) {
        JsonObject unavailable = unavailable();
        if (unavailable != null) return unavailable;
        if (!params.has("value") || !params.get("value").isJsonPrimitive()
                || !params.getAsJsonPrimitive("value").isString()) {
            throw new IllegalArgumentException("value must be a string");
        }

        String value = params.get("value").getAsString();
        JsonObject result = base();
        result.addProperty("available", true);
        result.addProperty("requestedChars", value.length());
        if (value.length() > panel.recordChars) {
            result.addProperty("accepted", false);
            result.addProperty("failure", "size-overflow");
            return result;
        }

        // This is an acceptance only. The brain polls observation.read until the
        // exact value appears. E20d proved that setting writes are asynchronous.
        panel.recordSetting.set(value);
        result.addProperty("accepted", true);
        return result;
    }

    private JsonObject base() {
        JsonObject result = new JsonObject();
        result.addProperty("capacityChars", UiPanel.OBSERVATION_RECORD_CHARS);
        String projectName = "";
        try {
            if (rig.projectName != null) projectName = rig.projectName.get();
        } catch (Throwable ignored) {
            // An empty project name makes the brain fail closed.
        }
        // API 25 exposes no stable project id. This name detects only switches
        // whose before and after names differ. DocumentState supplies the real
        // per-project storage scope.
        result.addProperty("projectName", projectName == null ? "" : projectName);
        return result;
    }

    private JsonObject unavailable() {
        if (panel == null) {
            JsonObject result = base();
            result.addProperty("available", false);
            result.addProperty("failure", "storage-absent");
            result.addProperty("error", "UI panel unavailable: " + panelError);
            return result;
        }
        if (panel.recordSetting == null) {
            JsonObject result = base();
            result.addProperty("available", false);
            result.addProperty("failure", panel.recordUnavailable == null
                ? "storage-absent" : "downcast-refused");
            result.addProperty("error", panel.recordUnavailable == null
                ? "the observation setting was not created during init"
                : panel.recordUnavailable);
            return result;
        }
        return null;
    }
}

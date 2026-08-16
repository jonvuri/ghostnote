package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.UiPanel;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Product transport for the Last change field. */
public final class StatusHandlers extends HandlerGroup {
    private final UiPanel panel;
    private final String panelError;

    public StatusHandlers(
            ControllerHost host, Rig rig, ExecState state, UiPanel panel, String panelError) {
        super(host, rig, state);
        this.panel = panel;
        this.panelError = panelError;
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("status.push", this::push);
    }

    private JsonElement push(JsonObject params) {
        JsonObject result = new JsonObject();
        if (!params.has("value") || !params.get("value").isJsonPrimitive()
                || !params.getAsJsonPrimitive("value").isString()) {
            throw new IllegalArgumentException("value must be a string");
        }
        if (!params.has("expectedGeneration")
                || !params.get("expectedGeneration").isJsonPrimitive()
                || !params.getAsJsonPrimitive("expectedGeneration").isString()) {
            throw new IllegalArgumentException("expectedGeneration must be a string");
        }
        if (!params.has("expectedProject") || !params.get("expectedProject").isJsonPrimitive()
                || !params.getAsJsonPrimitive("expectedProject").isString()) {
            throw new IllegalArgumentException("expectedProject must be a string");
        }

        String projectName = "";
        try {
            if (rig.projectName != null) projectName = rig.projectName.get();
        } catch (Throwable ignored) {
            // An empty project name makes the identity check fail closed.
        }
        projectName = projectName == null ? "" : projectName;
        result.addProperty("generation", rig.epochGeneration);
        result.addProperty("projectName", projectName);

        String expectedGeneration = params.get("expectedGeneration").getAsString();
        String expectedProject = params.get("expectedProject").getAsString();
        if (expectedGeneration.isEmpty() || expectedProject.isEmpty()
                || !rig.epochGeneration.equals(expectedGeneration)
                || !projectName.equals(expectedProject)) {
            result.addProperty("accepted", false);
            result.addProperty("error", "status target does not match the foreground project");
            return result;
        }
        if (panel == null) {
            result.addProperty("accepted", false);
            result.addProperty("error", "UI panel unavailable: " + panelError);
            return result;
        }

        String value = params.get("value").getAsString();
        panel.pushStatus(value);
        result.addProperty("accepted", true);
        result.addProperty("value", value);
        return result;
    }
}

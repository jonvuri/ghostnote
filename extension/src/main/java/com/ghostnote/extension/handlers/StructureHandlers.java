package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Scenes and the native undo stack (E3).
 *
 * Two findings bound this surface. Deleting a scene COMPACTS the rows below it
 * upward, and a pinned cursor's sceneIndex() then goes PERMANENTLY stale — so
 * callers must re-point after any scene op. And native undo is unusable as a
 * revert mechanism: a 4-note write takes exactly 4 undos, there is no grouping
 * hook, and the stack is project-global. `app.undo` is retained for the probes
 * that established that; it is not a product capability.
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class StructureHandlers extends HandlerGroup {
    public StructureHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("scene.create", params -> sceneCreate(params));
        r.on("scene.count", params -> sceneCount());
        r.on("scene.delete", params -> sceneDelete(params));
        r.on("app.undo", params -> appUndo(params));
        r.on("app.redo", params -> appRedo(params));
        r.on("app.undoState", params -> appUndoState());
    }

    private JsonElement sceneCreate(JsonObject params) {
        int count = params.has("count") ? params.get("count").getAsInt() : 1;
        for (int i = 0; i < count; i++) {
            rig.project.createScene();
        }
        JsonObject result = ok();
        result.addProperty("requested", count);
        return result;
    }

    private JsonElement sceneCount() {
        JsonObject result = new JsonObject();
        result.addProperty("sceneCount", rig.sceneBank.itemCount().get());
        return result;
    }

    private JsonElement sceneDelete(JsonObject params) {
        int sceneIndex = params.get("sceneIndex").getAsInt();
        rig.sceneBank.getScene(sceneIndex).deleteObject();
        return ok();
    }

    private JsonElement appUndo(JsonObject params) {
        int times = params.has("times") ? params.get("times").getAsInt() : 1;
        int did = 0;
        for (int i = 0; i < times; i++) {
            if (!rig.application.canUndo().get()) {
                break;
            }
            rig.application.undo();
            did++;
        }
        JsonObject result = ok();
        result.addProperty("undosRequested", times);
        result.addProperty("undosPerformed", did);
        result.addProperty("canUndo", rig.application.canUndo().get());
        return result;
    }

    private JsonElement appRedo(JsonObject params) {
        int times = params.has("times") ? params.get("times").getAsInt() : 1;
        int did = 0;
        for (int i = 0; i < times; i++) {
            if (!rig.application.canRedo().get()) {
                break;
            }
            rig.application.redo();
            did++;
        }
        JsonObject result = ok();
        result.addProperty("redosPerformed", did);
        result.addProperty("canRedo", rig.application.canRedo().get());
        return result;
    }

    private JsonElement appUndoState() {
        JsonObject result = new JsonObject();
        result.addProperty("canUndo", rig.application.canUndo().get());
        result.addProperty("canRedo", rig.application.canRedo().get());
        return result;
    }
}

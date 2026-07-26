package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Named actions and transport (E6).
 *
 * ⚠ `app.invokeAction` IS RETAINED FOR THE PROBES ONLY AND MUST NEVER BE USED.
 * Standing rule 6. Named actions are foreground-and-focus gated, carry zero
 * readback (invoke() returns void and an inapplicable action is a silent
 * no-op), and — the hazard — they fire against the UI selection that our own
 * cursor addressing sets, which is how E6 silently created seven orphan
 * duplicates of a fixture track. The adapter contract has no variant that can
 * reach this method, and an offline test enforces that.
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class AppHandlers extends HandlerGroup {
    public AppHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("app.actions", params -> appActions(params));
        r.on("app.invokeAction", params -> appInvokeAction(params));
        r.on("transport.play", params -> transportPlay());
        r.on("transport.stop", params -> transportStop());
        r.on("transport.status", params -> transportStatus());
    }

    /** Dump the named-action list (E6 overlap): is layer creation an action? */
    private JsonElement appActions(JsonObject params) {
        String filter = params.has("filter") ? params.get("filter").getAsString().toLowerCase() : "";
        JsonArray actions = new JsonArray();
        int total = 0;
        for (com.bitwig.extension.controller.api.Action action : rig.application.getActions()) {
            total++;
            String id = action.getId();
            String name = action.getName();
            if (!filter.isEmpty()
                && !id.toLowerCase().contains(filter)
                && !(name != null && name.toLowerCase().contains(filter))) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("id", id);
            obj.addProperty("name", name);
            try {
                obj.addProperty("category", action.getCategory().getName());
            } catch (Exception e) {
                obj.addProperty("category", "?");
            }
            actions.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("actions", actions);
        result.addProperty("matched", actions.size());
        result.addProperty("total", total);
        return result;
    }

    private JsonElement appInvokeAction(JsonObject params) {
        String id = params.get("id").getAsString();
        com.bitwig.extension.controller.api.Action action = rig.application.getAction(id);
        JsonObject result = ok();
        if (action == null) {
            result.addProperty("resolved", false);
            return result;
        }
        result.addProperty("resolved", true);
        result.addProperty("resolvedName", action.getName());
        action.invoke();
        return result;
    }

    /**
     * E16 rows C5/E: every cost and audibility question is asked with the
     * transport ROLLING, because that is when a branch point would happen.
     * `slot.launch` already starts playback as a side effect; this starts it
     * without also launching a clip.
     */
    private JsonElement transportPlay() {
        rig.transport.play();
        return ok();
    }

    private JsonElement transportStop() {
        rig.transport.stop();
        return ok();
    }

    private JsonElement transportStatus() {
        JsonObject r = new JsonObject();
        r.addProperty("isPlaying", rig.transport.isPlaying().get());
        return r;
    }
}

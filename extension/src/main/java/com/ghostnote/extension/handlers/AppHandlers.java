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
        r.on("app.selectionNotifications", params -> appSelectionNotifications(params));
        r.on("transport.play", params -> transportPlay());
        r.on("transport.stop", params -> transportStop());
        r.on("transport.status", params -> transportStatus());
    }

    /**
     * ⚠⚠ E17 — turn Bitwig's own DEVICE-LAYER SELECTION notification on, as a
     * second and independent oracle.
     *
     * **Why this is worth a wire method.** `NotificationSettings` carries a toggle
     * dedicated to device-layer selection, listed separately from the channel,
     * track and device ones. That Bitwig ships a distinct notification channel for
     * it is independent evidence the concept exists internally — and switched on,
     * it makes the state change VISIBLE, so the open question can be settled by the
     * operator's eyes rather than by the observer alone:
     *
     *   a HUMAN clicks a chain      → does Bitwig announce a layer selection?
     *   we call selectInEditor()    → does it announce the same thing?
     *
     * ⚠ **The point is that this can DISAGREE with `layer.selectionState`.** Two
     * instruments that could contradict each other is evidence; one instrument
     * agreeing with itself is not (rule 10). If the observer says "selected" and
     * Bitwig never announces it, the observer is reporting something other than
     * what the DAW means by a layer selection.
     *
     * ⚠ Every flag is settable here, not just the layer one, so the layer arm has
     * siblings to be read against — a notification that fires for everything is
     * not a signal. Absent params leave a flag untouched.
     */
    private JsonElement appSelectionNotifications(JsonObject params) {
        JsonObject result = new JsonObject();
        result.addProperty("status", rig.notificationsStatus);
        if (rig.notifications == null) {
            result.addProperty("applied", false);
            return result;
        }
        JsonArray applied = new JsonArray();
        // ⚠ Each in its OWN try: one unsupported flag must not cost the others.
        // This session lost a working observer to exactly that mistake.
        setFlag(params, applied, "deviceLayer",
            v -> rig.notifications.setShouldShowDeviceLayerSelectionNotifications(v));
        setFlag(params, applied, "device",
            v -> rig.notifications.setShouldShowDeviceSelectionNotifications(v));
        setFlag(params, applied, "track",
            v -> rig.notifications.setShouldShowTrackSelectionNotifications(v));
        setFlag(params, applied, "channel",
            v -> rig.notifications.setShouldShowChannelSelectionNotifications(v));
        setFlag(params, applied, "selection",
            v -> rig.notifications.setShouldShowSelectionNotifications(v));
        result.add("applied", applied);
        return result;
    }

    private interface FlagSetter { void set(boolean v); }

    private void setFlag(JsonObject params, JsonArray applied, String key, FlagSetter fn) {
        if (!params.has(key)) {
            return;
        }
        boolean v = params.get(key).getAsBoolean();
        try {
            fn.set(v);
            applied.add(key + "=" + v);
        } catch (Throwable t) {
            applied.add(key + "=THREW:" + t.getClass().getSimpleName() + ":" + t.getMessage());
        }
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

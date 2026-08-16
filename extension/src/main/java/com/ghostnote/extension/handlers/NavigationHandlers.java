package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Track;
import com.ghostnote.extension.Rig;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Product transport for explicit navigation to one recorded launcher clip. */
public final class NavigationHandlers extends HandlerGroup {
    public NavigationHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("navigation.showChangedClip", this::showChangedClip);
    }

    /** Validate all current identity and content facts before the first UI call. */
    private JsonElement showChangedClip(JsonObject params) {
        requireString(params, "expectedChannelId");
        requireString(params, "expectedGeneration");
        requireString(params, "expectedProject");
        long expectedRevision = requireLong(params, "expectedRevision");
        int trackIndex = requireIndex(params, "trackIndex");
        int slotIndex = requireIndex(params, "slotIndex");
        int expectedSceneEpoch = requireIndex(params, "expectedSceneEpoch");
        int expectedContentEpoch = requireIndex(params, "expectedContentEpoch");

        JsonObject result = new JsonObject();
        String projectName = "";
        try {
            if (rig.projectName != null) projectName = rig.projectName.get();
        } catch (Throwable ignored) {
            // An empty project name makes the identity check fail closed.
        }
        projectName = projectName == null ? "" : projectName;
        if (!rig.epochGeneration.equals(params.get("expectedGeneration").getAsString())
                || projectName.isEmpty()
                || !projectName.equals(params.get("expectedProject").getAsString())) {
            return refusal(result, "navigation target does not match the foreground project");
        }
        if (state.revision != expectedRevision) {
            return refusal(result, "project revision changed before navigation");
        }
        if (rig.sceneCountChanges != expectedSceneEpoch) {
            return refusal(result, "launcher rows changed before navigation");
        }
        if (rig.launcherContentEpoch != expectedContentEpoch) {
            return refusal(result, "launcher content changed before navigation");
        }

        if (slotIndex < 0 || slotIndex >= rig.config.scenes) {
            return refusal(result, "launcher row is outside the addressable window");
        }
        Track track = requireTrack(trackIndex);
        if (!params.get("expectedChannelId").getAsString().equals(track.channelId().get())) {
            return refusal(result, "the resolved track identity changed before navigation");
        }
        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        if (!slot.exists().get() || !slot.hasContent().get()) {
            return refusal(result, "the recorded launcher slot no longer holds a clip");
        }

        rig.application.setPanelLayout("EDIT");
        slot.showInEditor();
        rig.application.zoomToFit();
        result.addProperty("navigated", true);
        putGuarded(result, "layout", () -> rig.application.panelLayout().get());
        return result;
    }

    private static void requireString(JsonObject params, String name) {
        if (!params.has(name) || !params.get(name).isJsonPrimitive()
                || !params.getAsJsonPrimitive(name).isString()
                || params.get(name).getAsString().isEmpty()) {
            throw new IllegalArgumentException(name + " must be a non-empty string");
        }
    }

    private static int requireIndex(JsonObject params, String name) {
        if (!params.has(name) || !params.get(name).isJsonPrimitive()
                || !params.getAsJsonPrimitive(name).isNumber()) {
            throw new IllegalArgumentException(name + " must be an integer");
        }
        double value = params.get(name).getAsDouble();
        if (!Double.isFinite(value) || value != Math.rint(value)
                || value < Integer.MIN_VALUE || value > Integer.MAX_VALUE) {
            throw new IllegalArgumentException(name + " must be an integer");
        }
        return (int) value;
    }

    private static long requireLong(JsonObject params, String name) {
        if (!params.has(name) || !params.get(name).isJsonPrimitive()
                || !params.getAsJsonPrimitive(name).isNumber()) {
            throw new IllegalArgumentException(name + " must be an integer");
        }
        try {
            return params.get(name).getAsBigDecimal().longValueExact();
        } catch (ArithmeticException error) {
            throw new IllegalArgumentException(name + " must be an integer");
        }
    }

    private static JsonObject refusal(JsonObject result, String error) {
        result.addProperty("navigated", false);
        result.addProperty("error", error);
        return result;
    }
}

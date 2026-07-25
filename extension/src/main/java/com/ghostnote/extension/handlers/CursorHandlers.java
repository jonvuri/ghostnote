package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Cursor-pool addressing and UI-selection observation (E1).
 *
 * The pool is non-following CursorTracks plus their PinnableCursorClips; the
 * only pointing mechanism that works is track-then-slot (E1), and pointing
 * borrows the user's UI selection as a side effect — which is exactly why E6
 * bans named actions, since they would fire against the target we just moved.
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class CursorHandlers extends HandlerGroup {
    public CursorHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("cursor.pin", params -> cursorPin(params));
        r.on("cursor.pinTrack", params -> cursorPinTrack(params));
        r.on("cursor.pointTrack", params -> cursorPointTrack(params));
        r.on("cursor.pointToClipOf", params -> cursorPointToClipOf(params));
        r.on("cursor.status", params -> cursorStatus(params));
        r.on("selection.status", params -> selectionStatus());
    }

    private JsonElement cursorPin(JsonObject params) {
        requirePoolClip(params).isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    private JsonElement cursorPinTrack(JsonObject params) {
        int i = params.get("cursor").getAsInt();
        rig.cursorTracks[i].isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    private JsonElement cursorPointTrack(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Track target = requireTrack(params.get("trackIndex").getAsInt());
        rig.cursorTrack(ref).selectChannel(target);
        return ok();
    }

    /** CursorClip.selectClip: point pool cursor at whatever `from` points at. */
    private JsonElement cursorPointToClipOf(JsonObject params) {
        PinnableCursorClip cursor = requirePoolClip(params);
        Clip from = rig.clip(params.get("from").getAsString());
        cursor.selectClip(from);
        return ok();
    }

    /**
     * Per-field try/catch: on unmarked values this reports the error string
     * instead of failing the whole request — deliberate, to document which
     * reads require markInterested (E2 observer-gotcha probe).
     */
    private JsonElement cursorStatus(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        JsonObject result = new JsonObject();
        putGuarded(result, "exists", () -> clip.exists().get());
        putGuarded(result, "loopLength", () -> clip.getLoopLength().get());
        putGuarded(result, "trackExists", () -> clip.getTrack().exists().get());
        putGuarded(result, "trackName", () -> clip.getTrack().name().get());
        putGuarded(result, "trackPosition", () -> clip.getTrack().position().get());
        putGuarded(result, "slotExists", () -> clip.clipLauncherSlot().exists().get());
        putGuarded(result, "sceneIndex", () -> clip.clipLauncherSlot().sceneIndex().get());
        putGuarded(result, "slotName", () -> clip.clipLauncherSlot().name().get());
        if (clip instanceof PinnableCursorClip pinnable) {
            putGuarded(result, "isPinned", () -> pinnable.isPinned().get());
            putGuarded(result, "cursorTrackPosition", () -> rig.cursorTrack(ref).position().get());
        }
        return result;
    }

    // ------------------------------------------- E1: UI selection tracking

    private JsonElement selectionStatus() {
        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", rig.selectedTrackIndex);
        result.addProperty("slotIndex", rig.selectedSlotIndex);
        result.addProperty("changes", rig.selectionChanges);
        return result;
    }
}

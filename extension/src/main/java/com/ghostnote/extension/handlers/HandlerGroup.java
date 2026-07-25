package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonObject;

/**
 * Base for every handler group: the three collaborators plus the helpers the
 * moved method bodies expect to find in scope.
 *
 * These helpers live here rather than in a static utility class precisely so the
 * bodies moved out of ProbeHandlers compile with ZERO edits — `host`, `rig`,
 * `ok()`, `putGuarded()`, `requireTrack()` and `requirePoolClip()` all resolve
 * exactly as they did inside the monolith. That is what keeps the split
 * reviewable as a pure move.
 */
public abstract class HandlerGroup {
    protected final ControllerHost host;
    protected final Rig rig;
    protected final ExecState state;

    protected HandlerGroup(ControllerHost host, Rig rig, ExecState state) {
        this.host = host;
        this.rig = rig;
        this.state = state;
    }

    /** Bind this group's wire methods into the table. */
    public abstract void register(HandlerRegistry r);

    protected static JsonObject ok() {
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        return result;
    }

    protected interface ValueRead {
        Object get();
    }

    /**
     * Per-field try/catch: on unmarked values this reports the error string
     * instead of failing the whole request — deliberate, to document which
     * reads require markInterested (E2 observer-gotcha probe).
     */
    protected static void putGuarded(JsonObject obj, String key, ValueRead read) {
        try {
            Object v = read.get();
            if (v instanceof Boolean b) {
                obj.addProperty(key, b);
            } else if (v instanceof Number n) {
                obj.addProperty(key, n);
            } else {
                obj.addProperty(key, String.valueOf(v));
            }
        } catch (Exception e) {
            obj.addProperty(key, "ERR:" + e.getMessage());
        }
    }

    protected Track requireTrack(int trackIndex) {
        if (trackIndex < 0 || trackIndex >= rig.config.tracks) {
            throw new IllegalArgumentException("trackIndex out of bank range: " + trackIndex);
        }
        Track track = rig.trackBank.getItemAt(trackIndex);
        if (!track.exists().get()) {
            throw new IllegalArgumentException("no track at index: " + trackIndex);
        }
        return track;
    }

    protected PinnableCursorClip requirePoolClip(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        if (!(clip instanceof PinnableCursorClip pinnable)) {
            throw new IllegalArgumentException("cursor is not pinnable: " + ref);
        }
        return pinnable;
    }
}

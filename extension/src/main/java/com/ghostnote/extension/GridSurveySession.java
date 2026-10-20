package com.ghostnote.extension;

import com.google.gson.*;
import java.util.UUID;

/** Reusable read session. A timeout stays locked until controller replacement. */
public final class GridSurveySession {
    public record Target(String project, String trackId, String trackName, int deviceIndex, String deviceName) {
        public static Target parse(JsonObject p, int deviceBank) {
            String project = text(p, "project"), id = text(p, "trackId");
            UUID.fromString(id);
            JsonElement index = p.get("deviceIndex");
            if (index == null || !index.isJsonPrimitive() || !index.getAsJsonPrimitive().isNumber())
                throw new IllegalArgumentException("device-index-required");
            int i = index.getAsBigDecimal().intValueExact();
            if (i < 0 || i >= deviceBank) throw new IllegalArgumentException("device-index-outside-bank");
            return new Target(project, id, text(p, "trackName"), i, text(p, "deviceName"));
        }
    }
    public static String text(JsonObject p, String key) {
        JsonElement value = p.get(key);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString())
            throw new IllegalArgumentException(key + "-required");
        String s = value.getAsString();
        if (s.isBlank() || s.length() > 256) throw new IllegalArgumentException(key + "-limit");
        return s;
    }
    private Target target;
    private GridReadEpoch epoch;
    private boolean busy, locked;

    public boolean ownsGrid() { return busy || locked || epoch != null; }
    public void idle(boolean foreignOwner, boolean unfinished) {
        if (locked) throw new IllegalStateException("survey-timeout-locked; replace controller");
        if (busy || unfinished || foreignOwner) throw new IllegalStateException("grid-session-or-task-busy");
    }
    public void beginBind() {
        if (epoch != null) throw new IllegalStateException("survey-already-bound; release first");
        busy = true;
    }
    public GridReadEpoch require(Target wanted, String token) {
        if (epoch == null || !epoch.token.equals(token) || !wanted.equals(target))
            throw new IllegalStateException("stale-grid-survey-target");
        return epoch;
    }
    public void beginCapture() { busy = true; }
    public void bound(Target target, GridReadEpoch epoch) {
        if (locked) throw new IllegalStateException("survey-timeout-locked");
        this.target = target; this.epoch = epoch; busy = false;
    }
    public void finish() { busy = false; }
    public void timeout() { locked = true; busy = false; }
    public void release(String token) {
        if (epoch == null || !epoch.token.equals(token)) throw new IllegalStateException("stale-grid-survey-epoch");
        epoch = null; target = null;
    }
    public JsonObject status(boolean unfinished) {
        JsonObject r = new JsonObject();
        r.addProperty("bound", epoch != null); r.addProperty("busy", busy);
        r.addProperty("locked", locked); r.addProperty("nativeUnfinished", unfinished);
        if (epoch != null) r.addProperty("epoch", epoch.token);
        return r;
    }
}

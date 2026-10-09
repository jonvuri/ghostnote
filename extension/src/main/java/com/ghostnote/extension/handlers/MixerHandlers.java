package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * 8i7: the product track mixer read and write (volume, pan, mute, and nonexclusive solo).
 *
 * Units (8i7 gate, E257): the raw volume value is the cube root of the linear gain. The host display is
 * 60 * log10(raw) dB at every measured point, and the normalized value is raw / 2^(1/3). Raw 0 is silence
 * (-Inf dB); raw 2^(1/3) is the maximum, +6.02 dB. `setRaw` lands exactly in one turn; a plain `set` does not
 * land (E16). The raw pan value is -1 (full left) to 1 (full right). The brain converts decibels; this class
 * accepts and reports raw values only.
 *
 * Each write resolves the bank row against the expected channelId and checks the automation flag at execution,
 * immediately before the setters. Every check runs before the first setter, so a refused frame changes nothing.
 */
public final class MixerHandlers extends HandlerGroup {
    /** Deliberate build marker. A cached class cannot report it. */
    public static final String RULE = "track-mixer-raw-v1";
    /** The raw volume maximum: 2^(1/3), +6.02 dB. */
    public static final double VOLUME_RAW_MAX = Math.cbrt(2.0);

    public MixerHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("track.mixer", params -> mixer(params));
        r.on("track.setMixer", params -> setMixer(params));
    }

    /** Read the mixer fields of each named bank row in one turn. A row with another channelId reports no values. */
    private JsonElement mixer(JsonObject params) {
        JsonArray wanted = params.getAsJsonArray("tracks");
        JsonArray rows = new JsonArray();
        for (JsonElement item : wanted) {
            JsonObject request = item.getAsJsonObject();
            int index = request.get("trackIndex").getAsInt();
            String expected = request.get("channelId").getAsString();
            JsonObject row = new JsonObject();
            row.addProperty("trackIndex", index);
            row.addProperty("channelId", expected);
            Track track = index < 0 || index >= rig.config.tracks ? null : rig.trackBank.getItemAt(index);
            boolean matches = track != null && track.exists().get() && expected.equals(track.channelId().get());
            row.addProperty("matches", matches);
            if (matches) {
                row.addProperty("type", track.trackType().get());
                row.addProperty("volumeRaw", track.volume().value().getRaw());
                row.addProperty("volumeNormalized", track.volume().value().get());
                row.addProperty("volumeDisplayed", track.volume().value().displayedValue().get());
                row.addProperty("volumeAutomated", track.volume().hasAutomation().get());
                row.addProperty("panRaw", track.pan().value().getRaw());
                row.addProperty("panAutomated", track.pan().hasAutomation().get());
                row.addProperty("mute", track.mute().get());
                row.addProperty("solo", track.solo().get());
            }
            rows.add(row);
        }
        JsonObject result = new JsonObject();
        result.add("tracks", rows);
        return result;
    }

    /** Set the named fields of one track. Omitted fields get no setter. */
    private JsonElement setMixer(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        String expected = params.get("expectedChannelId").getAsString();
        String actual = track.channelId().get();
        if (!expected.equals(actual)) {
            throw new IllegalArgumentException(
                "track identity changed before the mixer write: expected " + expected + ", found " + actual);
        }
        if ("Master".equals(track.trackType().get())) {
            throw new IllegalArgumentException("the master track mixer is not a supported write target");
        }
        Double volume = params.has("volumeRaw") ? params.get("volumeRaw").getAsDouble() : null;
        Double pan = params.has("panRaw") ? params.get("panRaw").getAsDouble() : null;
        if (volume != null && !(volume >= 0 && volume <= VOLUME_RAW_MAX)) {
            throw new IllegalArgumentException("volumeRaw must be 0.." + VOLUME_RAW_MAX + ": " + volume);
        }
        if (pan != null && !(pan >= -1 && pan <= 1)) {
            throw new IllegalArgumentException("panRaw must be -1..1: " + pan);
        }
        // Automation playback owns an automated field; a write there does not stay (8i7 gate).
        if (volume != null && track.volume().hasAutomation().get()) {
            throw new IllegalArgumentException("the track volume has automation");
        }
        if (pan != null && track.pan().hasAutomation().get()) {
            throw new IllegalArgumentException("the track pan has automation");
        }
        if (volume != null) track.volume().value().setRaw(volume);
        if (pan != null) track.pan().value().setRaw(pan);
        if (params.has("mute")) track.mute().set(params.get("mute").getAsBoolean());
        // SettableBooleanValue.set does not clear the solo of another track (nonexclusive, 8i7).
        if (params.has("solo")) track.solo().set(params.get("solo").getAsBoolean());
        return ok();
    }
}

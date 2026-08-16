package com.ghostnote.extension;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

/**
 * E5: scaffold sizes, loaded from disk at init so the scale sweep can vary
 * them without a rebuild.
 *
 * Read from ~/.ghostnote/rig.json (absent/unreadable → the spike defaults,
 * which are the E0–E4 sizes). Bitwig hot-reloads the .bwextension on file
 * change, so `touch`ing the deployed extension re-runs init() and picks up a
 * new config — that is the sweep loop.
 */
public class RigConfig {
    public static final Path PATH =
        Paths.get(System.getProperty("user.home"), ".ghostnote", "rig.json");

    public int tracks = 16;
    public int scenes = 16;
    public int gridSteps = 64;    // 16 beats at 1/16 grid
    public int gridKeys = 128;    // full MIDI range: y == pitch
    public int cursorPool = 3;
    /**
     * Sends per track (E16 row B5/E2).
     *
     * ⚠ This is a BANK-CREATION-TIME size, not a read option:
     * `createTrackBank(tracks, sends, scenes, flat)` took 0 here until E16, and
     * with 0 the modern `Channel.sendBank()` does not return an empty bank — it
     * THROWS `No send bank exists: Requested a send bank size of 0`, from inside
     * the Rig constructor, which killed the whole extension at init (standing
     * rules 9/13; the same shape as E7-Finding-0). Sends are therefore something
     * you decide before you can look, and asking for them costs scaffold on
     * EVERY track, so it is a config knob rather than a constant.
     */
    public int sends = 4;
    public int deviceBank = 8;
    public int fineSteps = 512;
    public int paramHandles = 16; // typed createParameter handles (E4)
    public boolean directObservers = true; // DirectParameter observers (E4b)
    /**
     * E14 row C: pre-allocated take slots in the Studio I/O panel.
     *
     * Tunable because the question IS the number — "how many settings before the
     * panel is unusable" has no answer in any javadoc, so it gets swept the way
     * E5 swept bank sizes: edit rig.json, touch the deployed extension, look.
     */
    public int uiSlots = 16;
    /**
     * ⚠ E16: what the flat track bank is allowed to SEE.
     *
     * `TrackBankContentFilter`, one of `TOP_LEVEL_CHANNELS`,
     * `ALL_VISIBLE_CHANNELS`, `ALL_CHANNELS`. The legacy
     * `createTrackBank(tracks, sends, scenes, flat)` behaves as
     * ALL_VISIBLE_CHANNELS, and "visible" is the human's mixer folding — so a
     * COLLAPSED group's children leave the bank entirely: `itemCount` drops and
     * `resolveByChannelId` says `found:false`, exactly as a deleted track does,
     * while the child is still audible.
     *
     * `ALL_CHANNELS` is documented as "include all tracks, even the ones that
     * are not visible in the mixer", which is the candidate fix. It is a knob
     * rather than a constant because it changes what EVERY bank read means —
     * including standing rule 5's bank-window accounting — so flipping it is a
     * measurement, not a default.
     */
    public String contentFilter = "";

    /** Echoed back by rig.stats so a probe can prove which config is live. */
    public String stamp = "default";
    /** True when the file was found and parsed. */
    public boolean fromFile = false;

    public static RigConfig load() {
        RigConfig config = new RigConfig();
        try {
            if (!Files.isReadable(PATH)) {
                return config;
            }
            String json = Files.readString(PATH, StandardCharsets.UTF_8);
            JsonObject obj = new Gson().fromJson(json, JsonObject.class);
            if (obj == null) {
                return config;
            }
            config.tracks = intOr(obj, "tracks", config.tracks);
            config.scenes = intOr(obj, "scenes", config.scenes);
            config.gridSteps = intOr(obj, "gridSteps", config.gridSteps);
            config.gridKeys = intOr(obj, "gridKeys", config.gridKeys);
            config.cursorPool = intOr(obj, "cursorPool", config.cursorPool);
            config.sends = intOr(obj, "sends", config.sends);
            config.deviceBank = intOr(obj, "deviceBank", config.deviceBank);
            config.fineSteps = intOr(obj, "fineSteps", config.fineSteps);
            config.paramHandles = intOr(obj, "paramHandles", config.paramHandles);
            config.uiSlots = intOr(obj, "uiSlots", config.uiSlots);
            if (obj.has("contentFilter")) {
                config.contentFilter = obj.get("contentFilter").getAsString();
            }
            if (obj.has("directObservers")) {
                config.directObservers = obj.get("directObservers").getAsBoolean();
            }
            if (obj.has("stamp")) {
                config.stamp = obj.get("stamp").getAsString();
            }
            config.fromFile = true;
        } catch (Exception e) {
            // A bad config must never brick init: fall back to defaults.
            config.stamp = "PARSE_ERROR:" + e.getMessage();
        }
        return config;
    }

    private static int intOr(JsonObject obj, String key, int fallback) {
        return obj.has(key) ? obj.get(key).getAsInt() : fallback;
    }

    public JsonObject toJson() {
        JsonObject obj = new JsonObject();
        obj.addProperty("tracks", tracks);
        obj.addProperty("scenes", scenes);
        obj.addProperty("gridSteps", gridSteps);
        obj.addProperty("gridKeys", gridKeys);
        obj.addProperty("cursorPool", cursorPool);
        obj.addProperty("sends", sends);
        obj.addProperty("deviceBank", deviceBank);
        obj.addProperty("fineSteps", fineSteps);
        obj.addProperty("paramHandles", paramHandles);
        obj.addProperty("uiSlots", uiSlots);
        obj.addProperty("contentFilter", contentFilter);
        obj.addProperty("directObservers", directObservers);
        obj.addProperty("stamp", stamp);
        obj.addProperty("fromFile", fromFile);
        return obj;
    }
}

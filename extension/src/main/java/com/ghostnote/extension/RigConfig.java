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
    public int deviceBank = 8;
    public int fineSteps = 512;
    public int paramHandles = 16; // typed createParameter handles (E4)
    public boolean directObservers = true; // DirectParameter observers (E4b)

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
            config.deviceBank = intOr(obj, "deviceBank", config.deviceBank);
            config.fineSteps = intOr(obj, "fineSteps", config.fineSteps);
            config.paramHandles = intOr(obj, "paramHandles", config.paramHandles);
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
        obj.addProperty("deviceBank", deviceBank);
        obj.addProperty("fineSteps", fineSteps);
        obj.addProperty("paramHandles", paramHandles);
        obj.addProperty("directObservers", directObservers);
        obj.addProperty("stamp", stamp);
        obj.addProperty("fromFile", fromFile);
        return obj;
    }
}

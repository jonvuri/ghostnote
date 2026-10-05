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
 * Read from ~/.ghostnote/rig.json. An absent or unreadable file uses the D7
 * defaults, confirmed with device-populated scale evidence in E50.
 */
public class RigConfig {
    public static final Path PATH =
        Paths.get(System.getProperty("user.home"), ".ghostnote", "rig.json");

    public int tracks = 256;
    public int scenes = 128;
    public int gridSteps = 64;    // 16 beats at 1/16 grid
    public int gridKeys = 128;    // full MIDI range: y == pitch
    public int cursorPool = 8;
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
    public int deviceBank = 16;
    public int fineSteps = 512; // pointable writer cursors (E44)
    public int noteReadSteps = 2048; // independent exact-read cursor (E52)
    public int paramHandles = 64; // typed createParameter handles (E4/E50)
    public int remotePages = 16; // independent complete-page cursors (E61)
    public boolean directObservers = true; // DirectParameter observers (E4b)
    /** Phase 8e probe-only persistent observer handles. Zero disables them. */
    public int cacheScaleObservers = 0;
    /** Fixed `1/512` width for each Phase 8e count observer. */
    public int cacheScaleSteps = 131072;
    /** Phase 8e paired width candidate. Zero disables both width views. */
    public int cacheScaleWidthSteps = 0;
    /** Experimental shadow observer pool. Zero disables the pool. */
    public int cacheShadowObservers = 0;
    /** Research topology capacity. Zero disables topology allocation for the control arm. */
    public int cacheTopologyTracks = 16;
    /** Research route with one master witness handle per flat track. */
    public boolean cacheTopologyCounted = false;
    private boolean tracksExplicit, topologyExplicit, countedExplicit, filterExplicit;

    /** Use the measured scope for active shadow research. Normal scaffold defaults stay at D7. */
    public void configureResearchTopology(RuntimeProfile profile) {
        if (!profile.hasProbeResources() || !cacheLifecycleResearch || cacheShadowObservers <= 0) return;
        if (!topologyExplicit) cacheTopologyTracks = ShadowTopologyControl.MAX_TRACKS;
        if (!countedExplicit) cacheTopologyCounted = true;
        if (!tracksExplicit) tracks = Math.max(tracks, cacheTopologyTracks);
        if (!filterExplicit) contentFilter = "ALL_CHANNELS";
        topologyTracks();
    }

    /** Validate the research capacity before host allocation. */
    public int topologyTracks() {
        if (cacheTopologyTracks < 0 || cacheTopologyTracks > ShadowTopologyControl.RESEARCH_MAX_TRACKS)
            throw new IllegalArgumentException("topology capacity must be 0 through 2048");
        if (cacheTopologyTracks > tracks)
            throw new IllegalArgumentException("topology capacity exceeds the flat bank");
        return cacheTopologyTracks;
    }

    /** Count all step-data observers allocated by the experimental profile. */
    public int experimentalStepDataObservers() {
        if (cacheScaleObservers < 0 || cacheScaleWidthSteps < 0 || cacheShadowObservers < 0)
            throw new IllegalArgumentException("negative experimental observer configuration");
        long total = 1L + cacheScaleObservers + (cacheScaleWidthSteps > 0 ? 2 : 0)
            + cacheShadowObservers + (cacheShadowObservers > 0 ? 1 : 0)
            + (cacheLifecycleResearch ? 2 : 0) + (deliveryResearch ? 1 : 0);
        // 8h1a allocates a research maximum once. The active limit is checked at runtime.
        if (total < 0 || total > ShadowProjectCache.RESEARCH_MAX_OBSERVERS + 16)
            throw new IllegalArgumentException("experimental step-data observer budget exceeded");
        return (int) total;
    }
    /** Fixed 1/512 coverage for each shadow observer. */
    public int cacheShadowSteps = 131072;
    /** Allocate the experimental lifecycle and observer reuse probes. */
    public boolean cacheLifecycleResearch = false;
    /**
     * 8h1a: launcher slots allocated by each shadow cursor track. A negative value uses {@code scenes}.
     * Binding uses the target track's slot bank, so the cursor's own bank may be unnecessary.
     */
    public int cacheShadowCursorScenes = -1;
    public int shadowCursorScenes() {
        if (cacheShadowCursorScenes > scenes) throw new IllegalArgumentException("cursor scenes exceed the scene bank");
        return cacheShadowCursorScenes < 0 ? scenes : cacheShadowCursorScenes;
    }
    /** 8h1a: allocate the research fixture writer at the shadow width. */
    public boolean cacheKneeResearch = false;
    /** Allocate the E216 delivery and coherence recorder in a probe profile. */
    public boolean deliveryResearch = false;
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
            config.tracksExplicit = obj.has("tracks"); config.topologyExplicit = obj.has("cacheTopologyTracks");
            config.countedExplicit = obj.has("cacheTopologyCounted"); config.filterExplicit = obj.has("contentFilter");
            config.tracks = intOr(obj, "tracks", config.tracks);
            config.scenes = intOr(obj, "scenes", config.scenes);
            config.gridSteps = intOr(obj, "gridSteps", config.gridSteps);
            config.gridKeys = intOr(obj, "gridKeys", config.gridKeys);
            config.cursorPool = intOr(obj, "cursorPool", config.cursorPool);
            config.sends = intOr(obj, "sends", config.sends);
            config.deviceBank = intOr(obj, "deviceBank", config.deviceBank);
            config.fineSteps = intOr(obj, "fineSteps", config.fineSteps);
            config.noteReadSteps = intOr(obj, "noteReadSteps", config.noteReadSteps);
            config.paramHandles = intOr(obj, "paramHandles", config.paramHandles);
            config.remotePages = Math.max(1, intOr(obj, "remotePages", config.remotePages));
            config.cacheScaleObservers = Math.max(
                0, intOr(obj, "cacheScaleObservers", config.cacheScaleObservers));
            config.cacheScaleSteps = Math.max(
                1, intOr(obj, "cacheScaleSteps", config.cacheScaleSteps));
            config.cacheScaleWidthSteps = Math.max(
                0, intOr(obj, "cacheScaleWidthSteps", config.cacheScaleWidthSteps));
            config.cacheShadowObservers = intOr(obj, "cacheShadowObservers", config.cacheShadowObservers);
            config.cacheShadowSteps = intOr(obj, "cacheShadowSteps", config.cacheShadowSteps);
            config.cacheTopologyTracks = intOr(obj, "cacheTopologyTracks", config.cacheTopologyTracks);
            if (obj.has("cacheTopologyCounted")) {
                config.cacheTopologyCounted = obj.get("cacheTopologyCounted").getAsBoolean();
            }
            if (obj.has("cacheLifecycleResearch")) {
                config.cacheLifecycleResearch = obj.get("cacheLifecycleResearch").getAsBoolean();
            }
            config.cacheShadowCursorScenes = intOr(obj, "cacheShadowCursorScenes", config.cacheShadowCursorScenes);
            if (obj.has("cacheKneeResearch")) {
                config.cacheKneeResearch = obj.get("cacheKneeResearch").getAsBoolean();
            }
            if (obj.has("deliveryResearch")) {
                config.deliveryResearch = obj.get("deliveryResearch").getAsBoolean();
            }
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
        obj.addProperty("noteReadSteps", noteReadSteps);
        obj.addProperty("paramHandles", paramHandles);
        obj.addProperty("remotePages", remotePages);
        obj.addProperty("cacheScaleObservers", cacheScaleObservers);
        obj.addProperty("cacheScaleSteps", cacheScaleSteps);
        obj.addProperty("cacheScaleWidthSteps", cacheScaleWidthSteps);
        obj.addProperty("cacheShadowObservers", cacheShadowObservers);
        obj.addProperty("cacheShadowSteps", cacheShadowSteps);
        obj.addProperty("cacheTopologyTracks", cacheTopologyTracks);
        obj.addProperty("cacheTopologyCounted", cacheTopologyCounted);
        obj.addProperty("cacheLifecycleResearch", cacheLifecycleResearch);
        obj.addProperty("cacheKneeResearch", cacheKneeResearch);
        obj.addProperty("cacheShadowCursorScenes", cacheShadowCursorScenes);
        obj.addProperty("deliveryResearch", deliveryResearch);
        obj.addProperty("contentFilter", contentFilter);
        obj.addProperty("directObservers", directObservers);
        obj.addProperty("stamp", stamp);
        obj.addProperty("fromFile", fromFile);
        return obj;
    }
}

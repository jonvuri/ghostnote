package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Session liveness, host identity and rig introspection (E0, E1, E5).
 *
 * `rig.stats` and `rig.scanTracks` are Phase-1-quality carry-forward: the scale
 * sweep in E5 ran entirely through them, and `scanTracks` is the warm-up probe
 * (channelId is the last value to stream in after init).
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class CoreHandlers extends HandlerGroup {
    private final HandlerRegistry registry;

    public CoreHandlers(ControllerHost host, Rig rig, ExecState state, HandlerRegistry registry) {
        super(host, rig, state);
        this.registry = registry;
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("ping", params -> ping());
        r.on("host.info", params -> hostInfo());
        r.on("echo", params -> params);
        r.on("notify", params -> notify(params));
        r.on("rig.info", params -> rigInfo());
        r.on("rig.stats", params -> rigStats());
        r.on("rig.scanTracks", params -> rigScanTracks());
        r.on("contract.hello", params -> contractHello());
        r.on("rig.methods", params -> rigMethods());
    }

    // ---------------------------------------------------------------- E0

    private JsonElement ping() {
        JsonObject result = new JsonObject();
        result.addProperty("pong", true);
        result.addProperty("thread", Thread.currentThread().getName());
        return result;
    }

    private JsonElement hostInfo() {
        JsonObject result = new JsonObject();
        result.addProperty("hostApiVersion", host.getHostApiVersion());
        result.addProperty("hostProduct", host.getHostProduct());
        result.addProperty("hostVendor", host.getHostVendor());
        result.addProperty("hostVersion", host.getHostVersion());
        result.addProperty("javaVersion", System.getProperty("java.version"));
        result.addProperty("javaVendor", System.getProperty("java.vendor"));
        return result;
    }

    private JsonElement notify(JsonObject params) {
        String message = params.has("message") ? params.get("message").getAsString() : "ghostnote";
        host.showPopupNotification(message);
        JsonObject result = new JsonObject();
        result.addProperty("shown", true);
        return result;
    }

    // ------------------------------------------------------ E1: fixtures

    private JsonElement rigInfo() {
        JsonObject result = new JsonObject();
        result.addProperty("tracks", rig.config.tracks);
        result.addProperty("scenes", rig.config.scenes);
        result.addProperty("gridSteps", rig.config.gridSteps);
        result.addProperty("fineSteps", rig.config.fineSteps);
        result.addProperty("gridKeys", rig.config.gridKeys);
        result.addProperty("stepSize", Rig.STEP_SIZE);
        result.addProperty("cursorPool", rig.config.cursorPool);
        result.addProperty("deviceBank", rig.config.deviceBank);
        result.addProperty("sceneCount", rig.sceneBank.itemCount().get());
        return result;
    }

    // ----------------------------------------------------------- E5: scale

    /**
     * Init cost + live scaffold sizes. `stamp` proves which config generation
     * is live, so the sweep can tell a completed hot-reload from a stale
     * bridge that never went down.
     */
    private JsonElement rigStats() {
        JsonObject result = new JsonObject();
        result.add("config", rig.config.toJson());
        result.addProperty("rigConstructMicros", rig.constructNanos / 1000);
        result.addProperty("initMicros", state.initNanos < 0 ? -1 : state.initNanos / 1000);
        result.addProperty("initEpochMs", state.initEpochMs);
        result.addProperty("upMs", state.initEpochMs < 0 ? -1 : System.currentTimeMillis() - state.initEpochMs);

        // Derived scaffold volume — the thing that actually scales.
        long slots = (long) rig.config.tracks * rig.config.scenes;
        result.addProperty("slotObjects", slots);
        // ⚠ SIX per slot since E20a, not three: `isPlaying`, `isPlaybackQueued` and
        // `isStopQueued` joined `exists`/`hasContent`/`isSelected` so a quantised
        // launch's pending state is readable. That doubles the per-slot marked
        // volume — 768 more values at the default rig — and `initMicros` beside
        // this number is what says whether it cost anything (E5's measurement,
        // which is only interpretable if this count stays honest).
        result.addProperty("markedValues", slots * 6 + (long) rig.config.tracks * 5);

        // Session 4a: report the device and parameter scaffold explicitly. These
        // values let the scale probe separate project density from resources that
        // exist only because the extension allocated them during init.
        int cursorDeviceBanks = rig.config.cursorPool;
        int layerDeviceBanks = Rig.LAYER_BANK;
        int slotDeviceBanks = Rig.SLOT_SCOPES * Rig.SLOT_LAYER_BANK;
        JsonObject resources = new JsonObject();
        resources.addProperty("cursorDeviceBanks", cursorDeviceBanks);
        resources.addProperty("layerDeviceBanks", layerDeviceBanks);
        resources.addProperty("slotDeviceBanks", slotDeviceBanks);
        resources.addProperty("deviceBanks",
            cursorDeviceBanks + layerDeviceBanks + slotDeviceBanks);
        resources.addProperty("cursorDeviceSlots",
            (long) cursorDeviceBanks * rig.config.deviceBank);
        resources.addProperty("layerDeviceSlots",
            (long) layerDeviceBanks * Rig.LAYER_DEVICE_BANK);
        resources.addProperty("slotDeviceSlots",
            (long) slotDeviceBanks * Rig.SLOT_LAYER_DEVICE_BANK);
        resources.addProperty("deviceSlots",
            (long) cursorDeviceBanks * rig.config.deviceBank
                + (long) layerDeviceBanks * Rig.LAYER_DEVICE_BANK
                + (long) slotDeviceBanks * Rig.SLOT_LAYER_DEVICE_BANK);
        resources.addProperty("cursorDevices", 1);
        resources.addProperty("specificDeviceViews", 1);
        resources.addProperty("typedParameterHandles", rig.config.paramHandles);
        resources.addProperty("remoteParameterHandles", Rig.REMOTE_BANK);
        resources.addProperty("directParameterObservers",
            rig.config.directObservers ? 4 : 0);
        result.add("resources", resources);

        // Whole-JVM heap (shared with Bitwig): a coarse trend signal only.
        Runtime runtime = Runtime.getRuntime();
        result.addProperty("heapUsedMb",
            (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024));
        result.addProperty("heapMaxMb", runtime.maxMemory() / (1024 * 1024));
        return result;
    }

    /**
     * Full track-bank scan: the read whose cost grows with TRACKS, and the
     * warm-up probe (channelId is the last value to stream in after init).
     */
    private JsonElement rigScanTracks() {
        long start = System.nanoTime();
        int existing = 0;
        int withChannelId = 0;
        int slotsWithContent = 0;
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (!track.exists().get()) {
                continue;
            }
            existing++;
            track.name().get();
            track.position().get();
            track.trackType().get();
            if (!track.channelId().get().isEmpty()) {
                withChannelId++;
            }
            for (int j = 0; j < rig.config.scenes; j++) {
                if (track.clipLauncherSlotBank().getItemAt(j).hasContent().get()) {
                    slotsWithContent++;
                }
            }
        }
        JsonObject result = new JsonObject();
        result.addProperty("scanMicros", (System.nanoTime() - start) / 1000);
        result.addProperty("existing", existing);
        result.addProperty("withChannelId", withChannelId);
        result.addProperty("slotsWithContent", slotsWithContent);
        result.addProperty("sceneCount", rig.sceneBank.itemCount().get());
        // See TrackHandlers.trackList: itemCount vs bankSize is the overflow signal.
        result.addProperty("itemCount", rig.trackBank.itemCount().get());
        result.addProperty("bankSize", rig.config.tracks);
        return result;
    }

    /**
     * The adapter-contract handshake (Phase 0). Read-only and Bitwig-free, so it
     * cannot throw at init(). The brain refuses to open a session when
     * `contractVersion` differs from its own — future adapters reject
     * incompatible data rather than guessing (INITIAL_PROMPT §7).
     *
     * `methodsHash` lets a silently drifted wire surface be caught at connect
     * rather than at the first failing write; it is checked against
     * extension/methods.golden.json.
     */
    private JsonElement contractHello() {
        JsonObject r = new JsonObject();
        r.addProperty("contractVersion", Contract.VERSION);
        r.addProperty("extensionVersion", Contract.EXTENSION_VERSION);
        r.addProperty("hostApiVersion", host.getHostApiVersion());
        r.addProperty("methodCount", registry.methodNames().size());
        r.addProperty("methodsHash", Contract.methodsHash(registry.methodNames()));
        return r;
    }

    /** Every registered wire method, sorted — the live half of the split's no-op proof. */
    private JsonElement rigMethods() {
        JsonArray methods = new JsonArray();
        for (String m : registry.methodNames()) {
            methods.add(m);
        }
        JsonObject r = new JsonObject();
        r.add("methods", methods);
        r.addProperty("count", methods.size());
        r.addProperty("methodsHash", Contract.methodsHash(registry.methodNames()));
        return r;
    }
}

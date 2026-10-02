package com.ghostnote.extension;

import com.bitwig.extension.controller.api.BooleanValue;
import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.DeviceLayer;
import com.bitwig.extension.controller.api.DeviceLayerBank;
import com.bitwig.extension.controller.api.IntegerValue;
import com.bitwig.extension.controller.api.MasterTrack;
import com.bitwig.extension.controller.api.Project;
import com.bitwig.extension.controller.api.StringValue;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBank;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.function.Consumer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;

/** Read-only observations for project identity research. No signal proves identity. */
public final class RootIdentityProbe {
    private static final int TRACE_CAPACITY = 2_048;
    private static final int WITNESS_TRACKS = 4;
    private static final int WITNESS_DEVICES = 4;
    private static final int WITNESS_LAYERS = 4;
    private static final String WITNESS_PREFIX = "chainWitness.";
    private final String extensionInitNonce;
    private final String probeInstanceNonce = UUID.randomUUID().toString();
    private final long probeInitAtMs = System.currentTimeMillis();
    private final long probeInitAtNanos = System.nanoTime();
    private final Map<String, Signal> signals = new LinkedHashMap<>();
    private final Map<String, Signal> witnessSignals = new LinkedHashMap<>();
    private final ArrayDeque<JsonObject> events = new ArrayDeque<>(TRACE_CAPACITY);
    private long sequence;
    private long callbackCount;
    private long flushCount;
    private long exitCallCount;
    private long droppedTotal;
    private long droppedSinceClear;
    private long traceClearCount;
    private double constructionMs;
    private long identityEpoch;
    private boolean identityEpochExhausted;
    private String identityChangeReason = "initializing", lastGuardFailure = "";
    private Consumer<String> identityListener;

    /** This guard describes delivered observations. It does not prove a host input fence. */
    public record IdentityGuard(long epoch, String extensionInitNonce, boolean coherent,
        boolean witnessAvailable, String reason, String sourceFingerprint, List<String> chainIds) {
        public IdentityGuard { chainIds = List.copyOf(chainIds); }
    }

    /** The caller allocates this probe only during experimental controller initialization. */
    public RootIdentityProbe(ControllerHost host, Rig rig) {
        this(host, rig.epochGeneration, rig.project, rig.application);
    }

    RootIdentityProbe(ControllerHost host, String initNonce, Project project, Application application) {
        extensionInitNonce = initNonce;
        booleanSignal("projectExists", project::exists);
        stringSignal("projectName", application::projectName);
        booleanSignal("hasActiveEngine", application::hasActiveEngine);
        Track root = null;
        try {
            root = project.getRootTrackGroup();
        } catch (RuntimeException | LinkageError error) {
            unavailable("rootChannelId", error);
            unavailable("rootExists", error);
        }
        if (root != null) {
            final Track capturedRoot = root;
            stringSignal("rootChannelId", capturedRoot::channelId);
            booleanSignal("rootExists", capturedRoot::exists);
        } else {
            missingIfAbsent("rootChannelId");
            missingIfAbsent("rootExists");
        }
        try {
            MasterTrack master = host.createMasterTrack(0);
            if (master == null) missingIfAbsent("masterChannelId");
            else stringSignal("masterChannelId", master::channelId);
        } catch (RuntimeException | LinkageError error) {
            unavailable("masterChannelId", error);
        }
        booleanSignal(WITNESS_PREFIX + "canUndo", application::canUndo);
        booleanSignal(WITNESS_PREFIX + "canRedo", application::canRedo);
        existingChainWitnesses(host);
        constructionMs = elapsedMs();
        record("probe-created", null, null);
    }

    /** Return fresh values and observer state. Unknown values remain null. */
    public JsonObject snapshot() {
        long before = sequence;
        JsonObject result = state();
        JsonObject current = new JsonObject();
        JsonObject observerState = new JsonObject();
        for (Map.Entry<String, Signal> entry : signals.entrySet()) {
            Signal signal = entry.getValue();
            current.add(entry.getKey(), signalValue(signal));
            observerState.add(entry.getKey(), observerValue(signal));
        }
        result.add("current", current);
        result.add("observers", observerState);
        result.add("existingChainWitnesses", witnessSnapshot());
        result.addProperty("sequenceBeforeRead", before);
        result.addProperty("sequenceAfterRead", sequence);
        result.addProperty("callbacksChangedDuringRead", before != sequence);
        return result;
    }

    /** Return a copy of the retained callback trace. */
    public JsonObject trace() {
        JsonObject result = state();
        JsonArray rows = new JsonArray();
        for (JsonObject event : events) rows.add(event.deepCopy());
        result.add("events", rows);
        return result;
    }

    /** Clear retained rows. Keep lifetime callback, sequence, and drop counts. */
    public JsonObject clearTrace() {
        events.clear();
        droppedSinceClear = 0;
        traceClearCount++;
        record("trace-cleared", null, null);
        return state();
    }

    /** Count host flush calls. Flush does not prove input settlement. */
    public void onFlush() { flushCount++; }

    /** Record extension exit. The caller can persist the returned trace in the host log. */
    public JsonObject onExit() {
        exitCallCount++;
        identityChanged("extension-exit");
        record("extension-exit", null, null);
        return trace();
    }

    /** Install one synchronous cache invalidation listener. It must not call the host. */
    public void addIdentityInvalidationListener(Consumer<String> listener) {
        if (identityListener != null) throw new IllegalStateException("identity listener already installed");
        identityListener = Objects.requireNonNull(listener);
    }

    public long identityEpoch() { return identityEpoch; }

    /** Read all relevant values and compare them with their delivered observer values. */
    public IdentityGuard identityGuard() {
        long before = identityEpoch;
        Map<String, Object> values = new LinkedHashMap<>();
        String failure = identityEpochExhausted ? "identity-epoch-exhausted" : "";
        if (failure.isEmpty()) {
            try { readActiveIdentitySources(values); }
            catch (IdentityReadFailure error) { failure = error.getMessage(); }
        }
        List<String> ids = new ArrayList<>();
        boolean rootAvailable = Boolean.TRUE.equals(values.get("projectExists")) && Boolean.TRUE.equals(values.get("rootExists"))
            && nonempty(values.get("rootChannelId")) && nonempty(values.get("masterChannelId"));
        for (int t = 0; t < WITNESS_TRACKS; t++) {
            String tp = WITNESS_PREFIX + "track." + t;
            if (!Boolean.TRUE.equals(values.get(tp + ".exists"))) continue;
            for (int d = 0; d < WITNESS_DEVICES; d++) {
                String dp = tp + ".device." + d;
                if (!Boolean.TRUE.equals(values.get(dp + ".exists")) || !Boolean.TRUE.equals(values.get(dp + ".hasLayers"))) continue;
                for (int l = 0; l < WITNESS_LAYERS; l++) {
                    String lp = dp + ".layer." + l;
                    if (!Boolean.TRUE.equals(values.get(lp + ".exists"))) continue;
                    if (!nonempty(values.get(tp + ".channelId")) || !nonempty(values.get(tp + ".name"))
                        || !nonempty(values.get(dp + ".name")) || !nonempty(values.get(lp + ".name"))
                        || !nonempty(values.get(lp + ".channelId")) || !nonnegative(values.get(tp + ".position"))
                        || !nonnegative(values.get(dp + ".position")) || !nonnegative(values.get(lp + ".deviceCount"))
                        || !positive(values.get(tp + ".deviceCount")) || !positive(values.get(dp + ".layerCount")))
                        { if (failure.isEmpty()) failure = "identity-candidate-unavailable"; }
                    else ids.add((String) values.get(lp + ".channelId"));
                }
            }
        }
        if (!failure.equals(lastGuardFailure)) {
            if (!failure.isEmpty() || !lastGuardFailure.isEmpty()) identityChanged("guard:" + (failure.isEmpty() ? "recovered" : failure));
            lastGuardFailure = failure;
        }
        boolean coherent = failure.isEmpty() && before == identityEpoch && !identityEpochExhausted;
        String reason = !failure.isEmpty() ? failure : !coherent ? "identity-read-window-changed"
            : !rootAvailable ? "identity-root-unavailable" : ids.isEmpty() ? "no-existing-chain-witness" : "candidate-unverified-input-order";
        StringBuilder canonical = new StringBuilder();
        for (Map.Entry<String, Object> value : values.entrySet()) {
            if (value.getKey().contains(".layer.") && value.getKey().endsWith(".channelId")) continue;
            String text = String.valueOf(value.getValue());
            canonical.append(value.getKey().length()).append(':').append(value.getKey()).append(text.length()).append(':').append(text);
        }
        return new IdentityGuard(identityEpoch, extensionInitNonce, coherent, coherent && rootAvailable && !ids.isEmpty(),
            reason, digest(canonical.toString()), ids);
    }

    /** Child values are required only when their parent and bank position exist. */
    private void readActiveIdentitySources(Map<String, Object> values) {
        for (String name : List.of("projectExists", "rootExists", "rootChannelId", "masterChannelId"))
            readGuardValue(name, values);
        int tracks = readGuardCount(WITNESS_PREFIX + "trackCount", values);
        int trackOffset = readGuardCount(WITNESS_PREFIX + "trackOffset", values);
        for (int t = 0; t < Math.min(Math.max(0, tracks - trackOffset), WITNESS_TRACKS); t++) {
            String tp = WITNESS_PREFIX + "track." + t;
            if (!Boolean.TRUE.equals(readGuardValue(tp + ".exists", values))) continue;
            for (String field : List.of("channelId", "name", "position")) readGuardValue(tp + "." + field, values);
            int devices = readGuardCount(tp + ".deviceCount", values);
            int deviceOffset = readGuardCount(tp + ".deviceOffset", values);
            for (int d = 0; d < Math.min(Math.max(0, devices - deviceOffset), WITNESS_DEVICES); d++) {
                String dp = tp + ".device." + d;
                if (!Boolean.TRUE.equals(readGuardValue(dp + ".exists", values))) continue;
                for (String field : List.of("name", "position")) readGuardValue(dp + "." + field, values);
                if (!Boolean.TRUE.equals(readGuardValue(dp + ".hasLayers", values))) continue;
                int layers = readGuardCount(dp + ".layerCount", values);
                int layerOffset = readGuardCount(dp + ".layerOffset", values);
                for (int l = 0; l < Math.min(Math.max(0, layers - layerOffset), WITNESS_LAYERS); l++) {
                    String lp = dp + ".layer." + l;
                    if (!Boolean.TRUE.equals(readGuardValue(lp + ".exists", values))) continue;
                    for (String field : List.of("channelId", "name")) readGuardValue(lp + "." + field, values);
                    readGuardCount(lp + ".deviceCount", values);
                }
            }
        }
    }

    private int readGuardCount(String name, Map<String, Object> values) {
        Object value = readGuardValue(name, values);
        if (!(value instanceof Integer count) || count < 0) throw new IdentityReadFailure("identity-source-count-unavailable");
        return count;
    }

    private Object readGuardValue(String name, Map<String, Object> values) {
        Signal signal = name.startsWith(WITNESS_PREFIX) ? witnessSignals.get(name) : signals.get(name);
        if (signal == null || signal.read == null || signal.callbacks == 0 || !"observed".equals(signal.status))
            throw new IdentityReadFailure("identity-source-unavailable");
        Object value;
        try { value = signal.read.get(); }
        catch (RuntimeException | LinkageError error) { throw new IdentityReadFailure("identity-source-read-error"); }
        if (value == null || !Objects.equals(value, signal.lastValue)) throw new IdentityReadFailure("identity-observer-value-mismatch");
        values.put(name, value);
        return value;
    }
    private static final class IdentityReadFailure extends RuntimeException {
        IdentityReadFailure(String reason) { super(reason); }
    }

    public boolean identityGuardCurrent(IdentityGuard guard) {
        if (guard == null || !guard.coherent() || guard.epoch() != identityEpoch) return false;
        return guard.equals(identityGuard());
    }

    private static boolean nonempty(Object value) { return value instanceof String text && !text.isEmpty(); }
    private static boolean nonnegative(Object value) { return value instanceof Integer number && number >= 0; }
    private static boolean positive(Object value) { return value instanceof Integer number && number > 0; }
    private static String digest(String value) {
        try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    private static boolean identitySignal(String name) {
        return name.equals("projectExists") || name.equals("rootExists") || name.equals("rootChannelId") || name.equals("masterChannelId")
            || (name.startsWith(WITNESS_PREFIX) && !name.equals(WITNESS_PREFIX + "canUndo") && !name.equals(WITNESS_PREFIX + "canRedo"));
    }
    private void identityChanged(String reason) {
        if (identityEpoch != Long.MAX_VALUE) identityEpoch++;
        else identityEpochExhausted = true;
        identityChangeReason = reason;
        if (identityListener != null) identityListener.accept(reason);
    }

    /** Observe existing chains in a fixed window. Do not create content or move selection. */
    private void existingChainWitnesses(ControllerHost host) {
        try {
            TrackBank tracks = host.createMainTrackBank(WITNESS_TRACKS, 0, 0);
            integerSignal(WITNESS_PREFIX + "trackCount", tracks::itemCount);
            integerSignal(WITNESS_PREFIX + "trackOffset", tracks::scrollPosition);
            for (int t = 0; t < WITNESS_TRACKS; t++) {
                String trackPath = WITNESS_PREFIX + "track." + t;
                try {
                    Track track = tracks.getItemAt(t);
                    booleanSignal(trackPath + ".exists", track::exists);
                    stringSignal(trackPath + ".channelId", track::channelId);
                    stringSignal(trackPath + ".name", track::name);
                    integerSignal(trackPath + ".position", track::position);
                    DeviceBank devices = track.createDeviceBank(WITNESS_DEVICES);
                    integerSignal(trackPath + ".deviceCount", devices::itemCount);
                    integerSignal(trackPath + ".deviceOffset", devices::scrollPosition);
                    for (int d = 0; d < WITNESS_DEVICES; d++) {
                        String devicePath = trackPath + ".device." + d;
                        try {
                            Device device = devices.getItemAt(d);
                            booleanSignal(devicePath + ".exists", device::exists);
                            stringSignal(devicePath + ".name", device::name);
                            integerSignal(devicePath + ".position", device::position);
                            booleanSignal(devicePath + ".hasLayers", device::hasLayers);
                            DeviceLayerBank layers = device.createLayerBank(WITNESS_LAYERS);
                            integerSignal(devicePath + ".layerCount", layers::itemCount);
                            integerSignal(devicePath + ".layerOffset", layers::scrollPosition);
                            for (int l = 0; l < WITNESS_LAYERS; l++) {
                                String layerPath = devicePath + ".layer." + l;
                                try {
                                    DeviceLayer layer = layers.getItemAt(l);
                                    booleanSignal(layerPath + ".exists", layer::exists);
                                    stringSignal(layerPath + ".channelId", layer::channelId);
                                    stringSignal(layerPath + ".name", layer::name);
                                    DeviceBank nested = layer.createDeviceBank(1);
                                    integerSignal(layerPath + ".deviceCount", nested::itemCount);
                                } catch (RuntimeException | LinkageError error) {
                                    unavailable(layerPath + ".acquisition", error);
                                }
                            }
                        } catch (RuntimeException | LinkageError error) {
                            unavailable(devicePath + ".acquisition", error);
                        }
                    }
                } catch (RuntimeException | LinkageError error) {
                    unavailable(trackPath + ".acquisition", error);
                }
            }
        } catch (RuntimeException | LinkageError error) {
            unavailable(WITNESS_PREFIX + "acquisition", error);
        }
    }

    private JsonObject witnessSnapshot() {
        JsonObject result = new JsonObject();
        result.addProperty("purpose", "optional-existing-chain-identity-witness");
        result.addProperty("loadedInstanceIdentityProved", false);
        result.addProperty("settlementProved", false);
        result.addProperty("scopeComplete", false);
        result.addProperty("trackWindow", WITNESS_TRACKS);
        result.addProperty("deviceWindowPerTrack", WITNESS_DEVICES);
        result.addProperty("layerWindowPerDevice", WITNESS_LAYERS);
        JsonObject current = new JsonObject();
        JsonObject observers = new JsonObject();
        for (Signal signal : witnessSignals.values()) {
            JsonObject value = signalValue(signal);
            current.add(signal.name, value);
            observers.add(signal.name, observerValue(signal));
        }
        JsonArray candidates = new JsonArray();
        for (int t = 0; t < WITNESS_TRACKS; t++) {
            String trackPath = WITNESS_PREFIX + "track." + t;
            for (int d = 0; d < WITNESS_DEVICES; d++) {
                String devicePath = trackPath + ".device." + d;
                for (int l = 0; l < WITNESS_LAYERS; l++) {
                    String layerPath = devicePath + ".layer." + l;
                    if (!trueValue(current, trackPath + ".exists")
                        || !trueValue(current, devicePath + ".exists")
                        || !trueValue(current, layerPath + ".exists")) continue;
                    JsonObject candidate = new JsonObject();
                    candidate.addProperty("trackWindowIndex", t);
                    candidate.addProperty("deviceWindowIndex", d);
                    candidate.addProperty("layerWindowIndex", l);
                    candidate.add("trackChannelId", capturedValue(current, trackPath + ".channelId"));
                    candidate.add("trackName", capturedValue(current, trackPath + ".name"));
                    candidate.add("trackPosition", capturedValue(current, trackPath + ".position"));
                    candidate.add("trackDeviceCount", capturedValue(current, trackPath + ".deviceCount"));
                    candidate.add("deviceName", capturedValue(current, devicePath + ".name"));
                    candidate.add("devicePosition", capturedValue(current, devicePath + ".position"));
                    candidate.add("hasLayers", capturedValue(current, devicePath + ".hasLayers"));
                    candidate.add("layerCount", capturedValue(current, devicePath + ".layerCount"));
                    candidate.add("chainChannelId", capturedValue(current, layerPath + ".channelId"));
                    candidate.add("chainName", capturedValue(current, layerPath + ".name"));
                    candidate.add("chainDeviceCount", capturedValue(current, layerPath + ".deviceCount"));
                    candidates.add(candidate);
                }
            }
        }
        result.addProperty("candidateCount", candidates.size());
        result.addProperty("status", candidates.isEmpty() ? "no-readable-existing-chain-in-window" : "candidate-values-only");
        result.add("candidates", candidates);
        result.add("current", current);
        result.add("observers", observers);
        result.addProperty("limits", "No chain gives no witness. A replacement can change UUID without a project load. Copies and reload need matched live evidence. Undo state is supporting evidence, not identity. Window coverage and callback ordering remain unproved.");
        return result;
    }

    private static boolean trueValue(JsonObject current, String name) {
        JsonElement value = capturedValue(current, name);
        return value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean() && value.getAsBoolean();
    }

    private static JsonElement capturedValue(JsonObject current, String name) {
        JsonObject row = current.has(name) ? current.getAsJsonObject(name) : null;
        if (row == null || !"read".equals(row.get("status").getAsString())) return JsonNull.INSTANCE;
        return row.get("value").deepCopy();
    }

    private static JsonObject signalValue(Signal signal) {
        JsonObject value = new JsonObject();
        if (signal.read == null) {
            value.addProperty("status", "unavailable");
            value.add("value", JsonNull.INSTANCE);
            if (signal.error != null) value.addProperty("error", signal.error);
        } else {
            try {
                Object observed = signal.read.get();
                value.addProperty("status", observed == null ? "null-value" : "read");
                value.add("value", scalar(observed));
            } catch (RuntimeException | LinkageError error) {
                value.addProperty("status", "read-error");
                value.add("value", JsonNull.INSTANCE);
                value.addProperty("error", describe(error));
            }
        }
        return value;
    }

    private static JsonObject observerValue(Signal signal) {
        JsonObject result = new JsonObject();
        result.addProperty("status", signal.status);
        result.addProperty("callbacks", signal.callbacks);
        result.addProperty("lastSequence", signal.lastSequence);
        result.addProperty("lastElapsedMs", signal.lastElapsedMs);
        result.add("lastValue", scalar(signal.lastValue));
        if (signal.error != null) result.addProperty("error", signal.error);
        return result;
    }

    private void stringSignal(String name, Supplier<StringValue> acquire) {
        Signal signal = addSignal(name);
        try {
            StringValue value = acquire.get();
            if (value == null) { missing(signal); return; }
            value.addValueObserver(observed -> callback(signal, observed));
            signal.read = value::get;
            if (!"observed".equals(signal.status)) signal.status = "registered";
        } catch (RuntimeException | LinkageError error) { unavailable(signal, error); }
    }

    private void booleanSignal(String name, Supplier<BooleanValue> acquire) {
        Signal signal = addSignal(name);
        try {
            BooleanValue value = acquire.get();
            if (value == null) { missing(signal); return; }
            value.addValueObserver(observed -> callback(signal, observed));
            signal.read = value::get;
            if (!"observed".equals(signal.status)) signal.status = "registered";
        } catch (RuntimeException | LinkageError error) { unavailable(signal, error); }
    }

    private void integerSignal(String name, Supplier<IntegerValue> acquire) {
        Signal signal = addSignal(name);
        try {
            IntegerValue value = acquire.get();
            if (value == null) { missing(signal); return; }
            value.addValueObserver(observed -> callback(signal, observed));
            signal.read = value::get;
            if (!"observed".equals(signal.status)) signal.status = "registered";
        } catch (RuntimeException | LinkageError error) { unavailable(signal, error); }
    }

    private Signal addSignal(String name) {
        Signal signal = new Signal(name);
        (name.startsWith(WITNESS_PREFIX) ? witnessSignals : signals).put(name, signal);
        return signal;
    }

    private void callback(Signal signal, Object value) {
        if (identitySignal(signal.name) && (signal.callbacks == 0 || !Objects.equals(signal.lastValue, value)))
            identityChanged("callback:" + signal.name);
        signal.callbacks++;
        callbackCount++;
        signal.lastValue = value;
        signal.status = "observed";
        signal.lastElapsedMs = elapsedMs();
        signal.lastSequence = record("callback", signal.name, value);
    }

    private void unavailable(String name, Throwable error) { unavailable(addSignal(name), error); }

    private void unavailable(Signal signal, Throwable error) {
        if (identitySignal(signal.name)) identityChanged("registration-error:" + signal.name);
        signal.read = null;
        signal.status = "registration-error";
        signal.error = describe(error);
        record("registration-error", signal.name, signal.error);
    }

    private void missingIfAbsent(String name) {
        if (!signals.containsKey(name)) missing(addSignal(name));
    }

    private void missing(Signal signal) {
        if (identitySignal(signal.name)) identityChanged("null-handle:" + signal.name);
        signal.status = "null-handle";
        record("null-handle", signal.name, null);
    }

    private long record(String kind, String name, Object value) {
        sequence++;
        JsonObject event = new JsonObject();
        event.addProperty("sequence", sequence);
        event.addProperty("kind", kind);
        if (name != null) event.addProperty("signal", name);
        event.add("value", scalar(value));
        event.addProperty("elapsedMs", elapsedMs());
        event.addProperty("wallTimeMs", System.currentTimeMillis());
        event.addProperty("flushCount", flushCount);
        if (events.size() == TRACE_CAPACITY) {
            events.removeFirst();
            droppedTotal++;
            droppedSinceClear++;
        }
        events.addLast(event);
        return sequence;
    }

    private JsonObject state() {
        JsonObject result = new JsonObject();
        result.addProperty("purpose", "root-identity-research");
        result.addProperty("instrumentationRevision", "8g-root-existing-chain-v1");
        result.addProperty("identityDetectionProved", false);
        result.addProperty("automaticIdentityEpoch", identityEpoch);
        result.addProperty("automaticIdentityChangeReason", identityChangeReason);
        result.addProperty("hostInputFenceProved", false);
        result.addProperty("extensionInitNonce", extensionInitNonce);
        result.addProperty("probeInstanceNonce", probeInstanceNonce);
        result.addProperty("probeInitAtMs", probeInitAtMs);
        result.addProperty("elapsedMs", elapsedMs());
        result.addProperty("timeOrigin", "probe construction during extension init");
        result.addProperty("constructionMs", constructionMs);
        result.addProperty("sequence", sequence);
        result.addProperty("callbackCount", callbackCount);
        result.addProperty("flushCount", flushCount);
        result.addProperty("initCallCount", 1);
        result.addProperty("exitCallCount", exitCallCount);
        result.addProperty("lifecycleCountScope", "this probe instance");
        result.addProperty("traceCapacity", TRACE_CAPACITY);
        result.addProperty("traceRetained", events.size());
        result.addProperty("traceDroppedTotal", droppedTotal);
        result.addProperty("traceDroppedSinceClear", droppedSinceClear);
        result.addProperty("traceClearCount", traceClearCount);
        return result;
    }

    private double elapsedMs() { return (System.nanoTime() - probeInitAtNanos) / 1_000_000.0; }

    private static String describe(Throwable error) {
        return error.getClass().getSimpleName() + ":" + String.valueOf(error.getMessage());
    }

    private static JsonElement scalar(Object value) {
        if (value == null) return JsonNull.INSTANCE;
        if (value instanceof Boolean bool) return new com.google.gson.JsonPrimitive(bool);
        if (value instanceof Number number) return new com.google.gson.JsonPrimitive(number);
        return new com.google.gson.JsonPrimitive(String.valueOf(value));
    }

    private static final class Signal {
        final String name;
        String status = "not-registered";
        String error;
        Supplier<?> read;
        Object lastValue;
        long callbacks;
        long lastSequence;
        double lastElapsedMs;
        Signal(String name) { this.name = name; }
    }
}

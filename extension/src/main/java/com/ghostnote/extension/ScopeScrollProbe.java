package com.ghostnote.extension;

import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.DeviceLayer;
import com.bitwig.extension.controller.api.DeviceLayerBank;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.function.Supplier;

/**
 * B08 research only: scrollable container scopes.
 *
 * Each scope is a one-wide {@link DeviceBank} on cursor track 0 with a layer
 * bank hung off its single slot, and a nested device bank hung off each layer.
 * Scrolling the one-wide bank to top-level position P should retarget the hung
 * banks to the container at P. That retargeting is the unproved claim this
 * probe measures; the fixed product scopes in {@link Rig#slotLayerBanks} are
 * left untouched.
 *
 * The layer and device windows are deliberately narrower than the product's
 * five and four so that compose-built content (at most five chains and four
 * devices per chain) already needs nested scrolling.
 *
 * Only `status` runs on any track. Scrolls and the one write require the
 * `gn-b08` scratch track, and the write is guarded by the requested scroll
 * position rather than the bank's reported position: right after a scroll the
 * reported position and the slot name can both still describe the old target,
 * so a guard built on them would pass against stale state.
 */
public final class ScopeScrollProbe {
    public static final String MARKER = "b08-scope-scroll-v1";
    public static final int SCOPES = 2;
    public static final int LAYER_WINDOW = 3;
    public static final int DEVICE_WINDOW = 2;
    public static final String SCRATCH_PREFIX = "gn-b08";

    private final CursorTrack track;
    private final DeviceBank reference;
    private final int referenceWidth;
    private final Supplier<JsonObject> context;
    private final DeviceBank[] scopeBanks = new DeviceBank[SCOPES];
    private final Device[] scopeDevices = new Device[SCOPES];
    private final DeviceLayerBank[] layerBanks = new DeviceLayerBank[SCOPES];
    private final DeviceBank[][] layerDeviceBanks = new DeviceBank[SCOPES][LAYER_WINDOW];
    private final String[] status = new String[SCOPES];
    private final int[] requestedPosition = new int[SCOPES];
    private long sequence;

    public ScopeScrollProbe(CursorTrack track, DeviceBank reference, int referenceWidth,
            Supplier<JsonObject> context) {
        this.track = track;
        this.reference = reference;
        this.referenceWidth = referenceWidth;
        this.context = context;
        for (int s = 0; s < SCOPES; s++) {
            // Each scope in its own try, as the product scopes are built: one
            // failure must not take the other down or abort init.
            try {
                scopeBanks[s] = track.createDeviceBank(1);
                markBank(scopeBanks[s]);
                Device device = scopeBanks[s].getDevice(0);
                scopeDevices[s] = device;
                device.exists().markInterested();
                device.name().markInterested();
                device.position().markInterested();
                device.hasLayers().markInterested();
                layerBanks[s] = device.createLayerBank(LAYER_WINDOW);
                markBank(layerBanks[s]);
                for (int l = 0; l < LAYER_WINDOW; l++) {
                    DeviceLayer layer = layerBanks[s].getItemAt(l);
                    layer.exists().markInterested();
                    layer.name().markInterested();
                    layer.solo().markInterested();
                    layer.channelId().markInterested();
                    layerDeviceBanks[s][l] = layer.createDeviceBank(DEVICE_WINDOW);
                    markBank(layerDeviceBanks[s][l]);
                    for (int d = 0; d < DEVICE_WINDOW; d++) {
                        Device nested = layerDeviceBanks[s][l].getDevice(d);
                        nested.exists().markInterested();
                        nested.name().markInterested();
                        nested.position().markInterested();
                    }
                }
                status[s] = "held";
            } catch (Throwable t) {
                status[s] = "FAILED:" + t.getClass().getSimpleName() + ":" + t.getMessage();
            }
        }
    }

    private static void markBank(DeviceBank bank) {
        bank.itemCount().markInterested();
        bank.scrollPosition().markInterested();
        bank.canScrollForwards().markInterested();
        bank.canScrollBackwards().markInterested();
    }

    private static void markBank(DeviceLayerBank bank) {
        bank.itemCount().markInterested();
        bank.scrollPosition().markInterested();
        bank.canScrollForwards().markInterested();
        bank.canScrollBackwards().markInterested();
    }

    public JsonObject handle(JsonObject params) {
        String operation = string(params, "operation");
        if (operation.equals("status")) return status();
        JsonObject target = context.get();
        require(string(target, "trackName").startsWith(SCRATCH_PREFIX),
            "cursor track 0 is not a " + SCRATCH_PREFIX + " scratch track");
        require(string(params, "trackId").equals(string(target, "trackId")), "wrong scratch target");
        int scope = integer(params, "scope", 0, SCOPES - 1);
        require("held".equals(status[scope]), "scope " + scope + " was never built: " + status[scope]);
        JsonObject receipt = new JsonObject();
        receipt.addProperty("operation", operation);
        receipt.addProperty("scope", scope);
        switch (operation) {
            case "scroll" -> {
                int position = integer(params, "position", 0, 1024);
                receipt.addProperty("previousPosition", scopeBanks[scope].scrollPosition().get());
                requestedPosition[scope] = position;
                scopeBanks[scope].scrollPosition().set(position);
                receipt.addProperty("requestedPosition", position);
            }
            case "scrollLayers" -> {
                int position = integer(params, "position", 0, 1024);
                receipt.addProperty("previousPosition", layerBanks[scope].scrollPosition().get());
                layerBanks[scope].scrollPosition().set(position);
                receipt.addProperty("requestedPosition", position);
            }
            case "scrollDevices" -> {
                int layer = integer(params, "layerIndex", 0, LAYER_WINDOW - 1);
                int position = integer(params, "position", 0, 1024);
                receipt.addProperty("layerIndex", layer);
                receipt.addProperty("previousPosition", layerDeviceBanks[scope][layer].scrollPosition().get());
                layerDeviceBanks[scope][layer].scrollPosition().set(position);
                receipt.addProperty("requestedPosition", position);
            }
            case "setSolo" -> {
                JsonElement solo = params.get("solo");
                require(solo != null && solo.isJsonPrimitive() && solo.getAsJsonPrimitive().isBoolean(),
                    "solo must be a boolean");
                DeviceLayer layer = requireSettledLayer(params, scope, target);
                receipt.addProperty("layerIndex", integer(params, "layerIndex", 0, LAYER_WINDOW - 1));
                receipt.addProperty("containerName", scopeDevices[scope].name().get());
                receipt.addProperty("chainName", layer.name().get());
                receipt.addProperty("chainChannelId", layer.channelId().get());
                receipt.addProperty("previousSolo", layer.solo().get());
                receipt.addProperty("requestedSolo", solo.getAsBoolean());
                layer.solo().set(solo.getAsBoolean());
            }
            default -> throw new IllegalArgumentException("unknown scope operation: " + operation);
        }
        sequence++;
        receipt.addProperty("sequence", sequence);
        receipt.addProperty("readbackRequired", true);
        return receipt;
    }

    /**
     * The identity guard. The scope must report the position it was asked to
     * scroll to, its slot must carry the name the 16-wide reference bank reports
     * at that position, and the chain must carry the name the caller observed.
     * Any disagreement is staleness, and staleness refuses.
     */
    private DeviceLayer requireSettledLayer(JsonObject params, int scope, JsonObject target) {
        require(string(params, "expectedTrackChannelId").equals(string(target, "trackId")),
            "track identity changed");
        int requested = requestedPosition[scope];
        int reported = scopeBanks[scope].scrollPosition().get();
        require(reported == requested, "scope " + scope + " reports position " + reported
            + ", not the requested " + requested);
        require(requested < referenceWidth, "requested position is outside the reference bank");
        Device referenceDevice = reference.getDevice(requested);
        String referenceName = referenceDevice.exists().get() ? referenceDevice.name().get() : null;
        String scopeName = scopeDevices[scope].exists().get() ? scopeDevices[scope].name().get() : null;
        String expectedContainer = string(params, "expectedContainerName");
        require(expectedContainer.equals(referenceName), "reference bank names position " + requested
            + " \"" + referenceName + "\", not \"" + expectedContainer + "\"");
        require(expectedContainer.equals(scopeName), "scope " + scope + " slot is named \"" + scopeName
            + "\", not \"" + expectedContainer + "\": the hung bank has not settled");
        int layerIndex = integer(params, "layerIndex", 0, LAYER_WINDOW - 1);
        DeviceLayer layer = layerBanks[scope].getItemAt(layerIndex);
        require(layer.exists().get(), "no chain at window index " + layerIndex);
        String expectedChain = string(params, "expectedChainName");
        require(expectedChain.equals(layer.name().get()), "chain at window index " + layerIndex
            + " is named \"" + layer.name().get() + "\", not \"" + expectedChain + "\"");
        return layer;
    }

    public JsonObject status() {
        JsonObject value = new JsonObject();
        value.addProperty("marker", MARKER);
        value.addProperty("sequence", sequence);
        value.addProperty("scopeCount", SCOPES);
        value.addProperty("layerWindow", LAYER_WINDOW);
        value.addProperty("deviceWindow", DEVICE_WINDOW);
        value.add("context", context.get());
        JsonObject ref = new JsonObject();
        ref.addProperty("width", referenceWidth);
        ref.addProperty("itemCount", reference.itemCount().get());
        JsonArray devices = new JsonArray();
        for (int d = 0; d < referenceWidth; d++) {
            Device device = reference.getDevice(d);
            if (!device.exists().get()) continue;
            JsonObject row = new JsonObject();
            row.addProperty("index", d);
            row.addProperty("name", device.name().get());
            devices.add(row);
        }
        ref.add("devices", devices);
        value.add("reference", ref);
        JsonArray scopes = new JsonArray();
        for (int s = 0; s < SCOPES; s++) scopes.add(scope(s));
        value.add("scopes", scopes);
        return value;
    }

    private JsonObject scope(int s) {
        JsonObject value = new JsonObject();
        value.addProperty("scope", s);
        value.addProperty("status", status[s]);
        value.addProperty("requestedPosition", requestedPosition[s]);
        if (!"held".equals(status[s])) return value;
        bank(value, scopeBanks[s]);
        JsonObject device = new JsonObject();
        device.addProperty("exists", scopeDevices[s].exists().get());
        device.addProperty("name", scopeDevices[s].name().get());
        device.addProperty("position", scopeDevices[s].position().get());
        device.addProperty("hasLayers", scopeDevices[s].hasLayers().get());
        value.add("device", device);
        JsonObject layers = new JsonObject();
        bank(layers, layerBanks[s]);
        JsonArray items = new JsonArray();
        for (int l = 0; l < LAYER_WINDOW; l++) {
            DeviceLayer layer = layerBanks[s].getItemAt(l);
            JsonObject row = new JsonObject();
            row.addProperty("index", l);
            row.addProperty("exists", layer.exists().get());
            if (layer.exists().get()) {
                row.addProperty("name", layer.name().get());
                row.addProperty("solo", layer.solo().get());
                row.addProperty("channelId", layer.channelId().get());
            }
            JsonObject nested = new JsonObject();
            bank(nested, layerDeviceBanks[s][l]);
            JsonArray nestedItems = new JsonArray();
            for (int d = 0; d < DEVICE_WINDOW; d++) {
                Device item = layerDeviceBanks[s][l].getDevice(d);
                JsonObject nestedRow = new JsonObject();
                nestedRow.addProperty("index", d);
                nestedRow.addProperty("exists", item.exists().get());
                if (item.exists().get()) {
                    nestedRow.addProperty("name", item.name().get());
                    nestedRow.addProperty("position", item.position().get());
                }
                nestedItems.add(nestedRow);
            }
            nested.add("items", nestedItems);
            row.add("devices", nested);
            items.add(row);
        }
        layers.add("items", items);
        value.add("layers", layers);
        return value;
    }

    private static void bank(JsonObject value, DeviceBank bank) {
        value.addProperty("scrollPosition", bank.scrollPosition().get());
        value.addProperty("itemCount", bank.itemCount().get());
        value.addProperty("canScrollForwards", bank.canScrollForwards().get());
        value.addProperty("canScrollBackwards", bank.canScrollBackwards().get());
    }

    private static void bank(JsonObject value, DeviceLayerBank bank) {
        value.addProperty("scrollPosition", bank.scrollPosition().get());
        value.addProperty("itemCount", bank.itemCount().get());
        value.addProperty("canScrollForwards", bank.canScrollForwards().get());
        value.addProperty("canScrollBackwards", bank.canScrollBackwards().get());
    }

    private static int integer(JsonObject params, String key, int min, int max) {
        JsonElement value = params.get(key);
        require(value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber(),
            key + " must be an integer");
        double number = value.getAsDouble();
        require(Double.isFinite(number) && number == Math.rint(number) && number >= min && number <= max,
            key + " must be an integer in " + min + ".." + max);
        return (int) number;
    }

    private static String string(JsonObject value, String key) {
        JsonElement item = value.get(key);
        require(item != null && item.isJsonPrimitive() && item.getAsJsonPrimitive().isString()
            && !item.getAsString().isEmpty(), key + " must be a nonempty string");
        return item.getAsString();
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
}

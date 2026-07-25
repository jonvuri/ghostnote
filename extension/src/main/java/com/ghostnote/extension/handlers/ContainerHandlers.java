package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceLayer;
import com.bitwig.extension.controller.api.DrumPad;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Nested containers: device layers, drum pads and chain selectors (E4c, E4d, E4e).
 *
 * Mostly exploration surface, retained because it is what the E4c/E4d probes
 * run against. Findings baked in: hasLayers=true does NOT imply a layer exists
 * (check the bank count, never the capability flag); layers rename themselves
 * after their content so layer names are not identities; and
 * selectFirstInKeyPad takes a MIDI KEY, not a pad index (E4d).
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class ContainerHandlers extends HandlerGroup {
    public ContainerHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("layer.list", params -> layerList());
        r.on("layer.insertDevice", params -> layerInsertDevice(params));
        r.on("layer.duplicate", params -> layerDuplicate(params));
        r.on("layer.duplicateChannel", params -> layerDuplicateChannel(params));
        r.on("layer.copyDeviceInto", params -> layerCopyDeviceInto(params));
        r.on("layer.insertFile", params -> layerInsertFile(params));
        r.on("layer.insertRelative", params -> layerInsertRelative(params));
        r.on("drumpad.list", params -> drumPadList());
        r.on("drumpad.insertDevice", params -> drumPadInsertDevice(params));
        r.on("drumpad.duplicate", params -> drumPadDuplicate(params));
        r.on("chainselector.status", params -> chainSelectorStatus());
        r.on("chainselector.set", params -> chainSelectorSet(params));
    }

    /** Enumerate the layers of the pointed device and the devices inside each. */
    private JsonElement layerList() {
        JsonArray layers = new JsonArray();
        int existing = 0;
        for (int l = 0; l < Rig.LAYER_BANK; l++) {
            DeviceLayer layer = rig.layerBank0.getItemAt(l);
            if (!layer.exists().get()) {
                continue;
            }
            existing++;
            JsonObject obj = new JsonObject();
            obj.addProperty("index", l);
            obj.addProperty("name", layer.name().get());

            JsonArray devices = new JsonArray();
            for (int d = 0; d < Rig.LAYER_DEVICE_BANK; d++) {
                Device nested = rig.layerDeviceBanks[l].getDevice(d);
                if (!nested.exists().get()) {
                    continue;
                }
                JsonObject dev = new JsonObject();
                dev.addProperty("index", d);
                dev.addProperty("name", nested.name().get());
                devices.add(dev);
            }
            obj.add("devices", devices);
            layers.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("layers", layers);
        result.addProperty("count", existing);
        putGuarded(result, "hasLayers", () -> rig.cursorDevice0.hasLayers().get());
        return result;
    }

    /**
     * Insert a Bitwig device INSIDE a layer's device chain. DeviceLayer is a
     * DeviceChain, so it carries its own insertion point — this is how the
     * chain one level down gets populated.
     */
    private JsonElement layerInsertDevice(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        String uuid = params.get("uuid").getAsString();
        rig.layerBank0.getItemAt(layerIndex).endOfDeviceChainInsertionPoint()
            .insertBitwigDevice(java.util.UUID.fromString(uuid));
        return ok();
    }

    // ------------------------- E4c-2: routes to CREATING nesting structure

    /** DeviceLayer implements DuplicableObject — does duplicating make a layer? */
    private JsonElement layerDuplicate(JsonObject params) {
        rig.layerBank0.getItemAt(params.get("layerIndex").getAsInt()).duplicateObject();
        return ok();
    }

    /** DeviceLayer also implements Channel, which has its own duplicate(). */
    private JsonElement layerDuplicateChannel(JsonObject params) {
        rig.layerBank0.getItemAt(params.get("layerIndex").getAsInt()).duplicate();
        return ok();
    }

    /** Copy an existing top-level device into a layer's chain. */
    private JsonElement layerCopyDeviceInto(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        rig.layerBank0.getItemAt(layerIndex).endOfDeviceChainInsertionPoint()
            .copyDevices(rig.cursorDeviceBanks[0].getDevice(deviceIndex));
        return ok();
    }

    /** Insert a file (preset/multisample/etc.) into a layer's chain. */
    private JsonElement layerInsertFile(JsonObject params) {
        rig.layerBank0.getItemAt(params.get("layerIndex").getAsInt())
            .endOfDeviceChainInsertionPoint().insertFile(params.get("path").getAsString());
        return ok();
    }

    /**
     * The last untested InsertionPoint sources: before/after an EXISTING
     * nested device. Does inserting relative to a device inside a layer add
     * to that layer's chain, or spawn a sibling layer?
     */
    private JsonElement layerInsertRelative(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        String uuid = params.get("uuid").getAsString();
        boolean after = !params.has("where") || "after".equals(params.get("where").getAsString());
        Device anchor = rig.layerDeviceBanks[layerIndex].getDevice(deviceIndex);
        java.util.UUID id = java.util.UUID.fromString(uuid);
        if (after) {
            anchor.afterDeviceInsertionPoint().insertBitwigDevice(id);
        } else {
            anchor.beforeDeviceInsertionPoint().insertBitwigDevice(id);
        }
        return ok();
    }

    private JsonElement drumPadList() {
        JsonArray pads = new JsonArray();
        for (int p = 0; p < Rig.DRUM_PAD_BANK; p++) {
            DrumPad pad = rig.drumPadBank0.getItemAt(p);
            if (!pad.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", p);
            obj.addProperty("name", pad.name().get());
            pads.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("pads", pads);
        result.addProperty("count", pads.size());
        putGuarded(result, "hasDrumPads", () -> rig.cursorDevice0.hasDrumPads().get());
        return result;
    }

    /**
     * DrumPad has its OWN insertionPoint() that DeviceLayer lacks — the
     * asymmetry suggests empty pads can be filled, i.e. chains created.
     */
    private JsonElement drumPadInsertDevice(JsonObject params) {
        int padIndex = params.get("padIndex").getAsInt();
        String uuid = params.get("uuid").getAsString();
        rig.drumPadBank0.getItemAt(padIndex).insertionPoint()
            .insertBitwigDevice(java.util.UUID.fromString(uuid));
        return ok();
    }

    private JsonElement drumPadDuplicate(JsonObject params) {
        rig.drumPadBank0.getItemAt(params.get("padIndex").getAsInt()).duplicateObject();
        return ok();
    }

    private JsonElement chainSelectorStatus() {
        JsonObject result = new JsonObject();
        putGuarded(result, "exists", () -> rig.chainSelector0.exists().get());
        putGuarded(result, "chainCount", () -> rig.chainSelector0.chainCount().get());
        putGuarded(result, "activeChainIndex", () -> rig.chainSelector0.activeChainIndex().get());
        return result;
    }

    private JsonElement chainSelectorSet(JsonObject params) {
        if (params.has("cycle")) {
            if ("next".equals(params.get("cycle").getAsString())) {
                rig.chainSelector0.cycleNext();
            } else {
                rig.chainSelector0.cyclePrevious();
            }
        } else {
            rig.chainSelector0.activeChainIndex().set(params.get("index").getAsInt());
        }
        return ok();
    }
}

package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.DrumPad;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Device chains and the device cursor (E3, E4, E4c, E4h).
 *
 * The robust device address is a pinned TRACK cursor plus an explicit device
 * index (E4): CursorDevice.isPinned() is subordinate to its track cursor and
 * does not hold the device when that cursor is repointed. `insertFile` needs an
 * ABSOLUTE path with a `.bwpreset` extension — a relative path, a wrong
 * extension or a missing file are all silent no-ops (E4h).
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class DeviceHandlers extends HandlerGroup {
    public DeviceHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("device.insertBitwig", params -> deviceInsertBitwig(params));
        r.on("device.insertClap", params -> deviceInsertClap(params));
        r.on("device.list", params -> deviceList(params));
        r.on("device.delete", params -> deviceDelete(params));
        r.on("device.duplicate", params -> deviceDuplicate(params));
        r.on("device.insertFile", params -> deviceInsertFile(params));
        r.on("device.insertFileAt", params -> deviceInsertFileAt(params));
        r.on("device.nesting", params -> deviceNesting());
        r.on("devcursor.status", params -> devcursorStatus());
        r.on("devcursor.pin", params -> devcursorPin(params));
        r.on("devcursor.selectInChannel", params -> devcursorSelectInChannel(params));
        r.on("devcursor.selectAt", params -> devcursorSelectAt(params));
        r.on("devcursor.selectFirstInLayer", params -> devcursorSelectFirstInLayer(params));
        r.on("devcursor.selectFirstInSlot", params -> devcursorSelectFirstInSlot(params));
        r.on("devcursor.selectFirstInKeyPad", params -> devcursorSelectFirstInKeyPad(params));
        r.on("devcursor.selectFirstInPad", params -> devcursorSelectFirstInPad(params));
        r.on("devcursor.selectParent", params -> devcursorSelectParent());
    }

    // ---------------------------------------- E3: structural ops & revert

    /**
     * Insert a Bitwig device (by UUID) at the end of a pool cursor's track
     * device chain. The cursor must already be pointed at the target track.
     */
    private JsonElement deviceInsertBitwig(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        String uuid = params.get("uuid").getAsString();
        rig.cursorTrack(ref).endOfDeviceChainInsertionPoint()
            .insertBitwigDevice(java.util.UUID.fromString(uuid));
        return ok();
    }

    /** Insert a CLAP device by its CLAP id string at end of chain. */
    private JsonElement deviceInsertClap(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        String clapId = params.get("clapId").getAsString();
        rig.cursorTrack(ref).endOfDeviceChainInsertionPoint().insertCLAPDevice(clapId);
        return ok();
    }

    /** List devices in a pool cursor's track chain via its DeviceBank. */
    private JsonElement deviceList(JsonObject params) {
        int i = params.get("cursor").getAsInt();
        DeviceBank bank = rig.cursorDeviceBanks[i];
        JsonArray devices = new JsonArray();
        for (int d = 0; d < rig.config.deviceBank; d++) {
            Device device = bank.getDevice(d);
            if (!device.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", d);
            obj.addProperty("name", device.name().get());
            devices.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("devices", devices);
        result.addProperty("count", devices.size());
        result.addProperty("itemCount", bank.itemCount().get());
        return result;
    }

    /** Delete a device by chain index on a pool cursor's track. */
    private JsonElement deviceDelete(JsonObject params) {
        int i = params.get("cursor").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        rig.cursorDeviceBanks[i].getDevice(deviceIndex).deleteObject();
        return ok();
    }

    /** Duplicating a container device — does it bring its layers along? */
    private JsonElement deviceDuplicate(JsonObject params) {
        rig.cursorDeviceBanks[0].getDevice(params.get("deviceIndex").getAsInt()).duplicateObject();
        return ok();
    }

    /**
     * Insert a file at the end of the track's device chain. A .bwpreset of a
     * multi-layer container would create the whole structure in one call.
     */
    private JsonElement deviceInsertFile(JsonObject params) {
        String ref = params.has("cursor") ? params.get("cursor").getAsString() : "0";
        rig.cursorTrack(ref).endOfDeviceChainInsertionPoint()
            .insertFile(params.get("path").getAsString());
        return ok();
    }

    /**
     * Insert a file relative to cursorDevice0 rather than at end-of-chain.
     * where = "after" | "before" | "replace". The creation sweep for
     * modulators: a .bwmodulator has no chain insertion point, so try every
     * device-anchored insertion point too before concluding it cannot be done.
     */
    private JsonElement deviceInsertFileAt(JsonObject params) {
        String path = params.get("path").getAsString();
        String where = params.has("where") ? params.get("where").getAsString() : "after";
        switch (where) {
            case "before":
                rig.cursorDevice0.beforeDeviceInsertionPoint().insertFile(path);
                break;
            case "replace":
                rig.cursorDevice0.replaceDeviceInsertionPoint().insertFile(path);
                break;
            case "after":
            default:
                rig.cursorDevice0.afterDeviceInsertionPoint().insertFile(path);
                break;
        }
        JsonObject result = ok();
        result.addProperty("where", where);
        return result;
    }

    // -------------------------------------------------- E4c: device nesting

    /** Which nesting mechanism (if any) the pointed device offers. */
    private JsonElement deviceNesting() {
        JsonObject result = new JsonObject();
        putGuarded(result, "exists", () -> rig.cursorDevice0.exists().get());
        putGuarded(result, "name", () -> rig.cursorDevice0.name().get());
        putGuarded(result, "hasLayers", () -> rig.cursorDevice0.hasLayers().get());
        putGuarded(result, "hasDrumPads", () -> rig.cursorDevice0.hasDrumPads().get());
        putGuarded(result, "hasSlots", () -> rig.cursorDevice0.hasSlots().get());
        putGuarded(result, "isNested", () -> rig.cursorDevice0.isNested().get());
        JsonArray slots = new JsonArray();
        try {
            for (String name : rig.cursorDevice0.slotNames().get()) {
                slots.add(name);
            }
        } catch (Exception e) {
            result.addProperty("slotNamesError", e.getMessage());
        }
        result.add("slotNames", slots);
        putGuarded(result, "cursorLayerExists", () -> rig.cursorLayer0.exists().get());
        putGuarded(result, "cursorLayerName", () -> rig.cursorLayer0.name().get());
        return result;
    }

    // ------------------------------------------------ E4: direct parameters

    private JsonElement devcursorStatus() {
        JsonObject result = new JsonObject();
        result.addProperty("exists", rig.cursorDevice0.exists().get());
        result.addProperty("name", rig.cursorDevice0.name().get());
        result.addProperty("isPinned", rig.cursorDevice0.isPinned().get());
        return result;
    }

    private JsonElement devcursorPin(JsonObject params) {
        rig.cursorDevice0.isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    /** Point the device cursor at the first device of its current track. */
    private JsonElement devcursorSelectInChannel(JsonObject params) {
        rig.cursorDevice0.selectFirstInChannel(rig.cursorTracks[0]);
        return ok();
    }

    /** Point the device cursor at a specific chain index (via device bank). */
    private JsonElement devcursorSelectAt(JsonObject params) {
        int deviceIndex = params.get("deviceIndex").getAsInt();
        rig.cursorDevice0.selectDevice(rig.cursorDeviceBanks[0].getDevice(deviceIndex));
        return ok();
    }

    /**
     * Move the DEVICE CURSOR into a layer. If this works, the whole E4
     * parameter apparatus follows the cursor down and nested devices need no
     * new machinery.
     */
    private JsonElement devcursorSelectFirstInLayer(JsonObject params) {
        rig.cursorDevice0.selectFirstInLayer(params.get("layerIndex").getAsInt());
        return ok();
    }

    private JsonElement devcursorSelectFirstInSlot(JsonObject params) {
        rig.cursorDevice0.selectFirstInSlot(params.get("slot").getAsString());
        return ok();
    }

    private JsonElement devcursorSelectFirstInKeyPad(JsonObject params) {
        rig.cursorDevice0.selectFirstInKeyPad(params.get("pad").getAsInt());
        return ok();
    }

    /**
     * DrumPad is a Channel, so the generic selectFirstInChannel works on it —
     * the same idiom that points the cursor at a track's first device.
     */
    private JsonElement devcursorSelectFirstInPad(JsonObject params) {
        rig.cursorDevice0.selectFirstInChannel(
            rig.drumPadBank0.getItemAt(params.get("padIndex").getAsInt()));
        return ok();
    }

    private JsonElement devcursorSelectParent() {
        rig.cursorDevice0.selectParent();
        return ok();
    }
}

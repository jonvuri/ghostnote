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
        r.on("device.insertVst3", params -> deviceInsertVst3(params));
        r.on("device.list", params -> deviceList(params));
        r.on("device.delete", params -> deviceDelete(params));
        r.on("device.duplicate", params -> deviceDuplicate(params));
        r.on("device.moveTo", params -> deviceMoveTo(params));
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

    /**
     * Insert a VST3 by its plugin ID (E16 row B2).
     *
     * E4 reached VST3s only through presets; kill criterion 2 asks specifically
     * whether duplication carries **opaque VST3 state**, which needs a real one
     * in the chain. The ID is the 32-hex-char VST3 class UID — the same string
     * Bitwig caches in `~/Library/Caches/Bitwig/vst3-metadata-*`, which is where
     * the probe gets it (there is no plugin-enumeration API).
     */
    private JsonElement deviceInsertVst3(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        String id = params.get("vst3Id").getAsString();
        if (!id.matches("[0-9A-Fa-f]{32}")) {
            throw new IllegalArgumentException("vst3Id must be 32 hex chars, got: " + id);
        }
        rig.cursorTrack(ref).endOfDeviceChainInsertionPoint().insertVST3Device(id);
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
     * ⚠ E16 §3.1 — `InsertionPoint.moveDevices` to a SAME-TRACK destination.
     *
     * **This is the control, and without it the row measures nothing.**
     *
     * `layer.moveDeviceInto` asks whether a device can be moved INTO a layer.
     * If that comes back a silent no-op, there are two completely different
     * worlds consistent with the observation — "layers refuse relocation" and
     * "`moveDevices` does nothing anywhere" — and the first is a finding about
     * layers while the second is a finding about the verb. A probe that cannot
     * separate them has repeated E6's mistake, whose control was a different
     * object read through a different oracle and therefore could not distinguish
     * "the channel is dead" from "this action does nothing".
     *
     * So this moves a device to a destination we have every reason to expect
     * works: another position in the SAME flat device chain, which involves no
     * nesting, no container and no re-parenting — just reordering. A ● here plus
     * a ○ in the layer makes the layer result mean something. A ○ here makes the
     * whole row inconclusive, and the probe should say so rather than writing up
     * a negative about layers.
     *
     * Four destinations, because `InsertionPoint` is reachable from two kinds of
     * anchor and they are not the same object:
     *
     *   before / after   `Device.beforeDeviceInsertionPoint()` / `after…`
     *   chainStart / chainEnd  `DeviceChain.startOfDeviceChainInsertionPoint()` / `end…`
     *
     * ⚠ Every input is validated BEFORE the call (standing rule 3c): an
     * exception Bitwig defers to its own thread escapes every extension frame
     * and takes the DAW down (E14-A1). An unknown `where` throws here, before
     * anything Bitwig-side is touched.
     */
    private JsonElement deviceMoveTo(JsonObject params) {
        String ref = params.has("cursor") ? params.get("cursor").getAsString() : "0";
        int cursorIndex = Integer.parseInt(ref);
        int deviceIndex = params.get("deviceIndex").getAsInt();
        String where = params.has("where") ? params.get("where").getAsString() : "after";
        if (deviceIndex < 0) {
            throw new IllegalArgumentException("deviceIndex must be >= 0: " + deviceIndex);
        }
        if (!"before".equals(where) && !"after".equals(where)
            && !"chainStart".equals(where) && !"chainEnd".equals(where)) {
            throw new IllegalArgumentException(
                "where must be before, after, chainStart or chainEnd: " + where);
        }

        DeviceBank bank = rig.cursorDeviceBanks[cursorIndex];
        Device source = bank.getDevice(deviceIndex);

        JsonObject r = ok();
        r.addProperty("where", where);
        r.addProperty("deviceIndex", deviceIndex);
        // ⚠ Read the source's name BEFORE the move. Afterwards the chain
        // re-indexes (E3: deleting device[0] shifts the survivor from 1 to 0),
        // so this handle no longer necessarily refers to what was moved — and a
        // name read after the fact is how a probe reports the wrong device.
        putGuarded(r, "sourceName", () -> source.name().get());
        putGuarded(r, "sourceExists", () -> source.exists().get());

        switch (where) {
            case "before":
            case "after": {
                int anchorIndex = params.get("anchorIndex").getAsInt();
                if (anchorIndex < 0) {
                    throw new IllegalArgumentException("anchorIndex must be >= 0: " + anchorIndex);
                }
                if (anchorIndex == deviceIndex) {
                    throw new IllegalArgumentException(
                        "anchorIndex must differ from deviceIndex, or the move is a no-op by "
                        + "construction and would be indistinguishable from a failure");
                }
                Device anchor = bank.getDevice(anchorIndex);
                r.addProperty("anchorIndex", anchorIndex);
                putGuarded(r, "anchorName", () -> anchor.name().get());
                if ("before".equals(where)) {
                    anchor.beforeDeviceInsertionPoint().moveDevices(source);
                } else {
                    anchor.afterDeviceInsertionPoint().moveDevices(source);
                }
                break;
            }
            case "chainStart":
                rig.cursorTrack(ref).startOfDeviceChainInsertionPoint().moveDevices(source);
                break;
            case "chainEnd":
            default:
                rig.cursorTrack(ref).endOfDeviceChainInsertionPoint().moveDevices(source);
                break;
        }
        return r;
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

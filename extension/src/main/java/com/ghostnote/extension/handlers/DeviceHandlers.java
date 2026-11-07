package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.DeviceWindow;
import com.ghostnote.extension.WindowPager;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.DeviceLayer;
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
 * Split out of ProbeHandlers.java in Phase 0. Product mutations also verify
 * caller-owned complete-chain guards.
 */
public final class DeviceHandlers extends HandlerGroup {
    public DeviceHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        DeviceMutationHandlers.over(host, rig).register(r);
        r.onAsync("device.list", this::deviceList);
        r.on("device.duplicate", params -> deviceDuplicate(params));
        r.on("device.moveIntoSlot", params -> deviceMoveIntoSlot(params));
        r.on("device.insertFileAt", params -> deviceInsertFileAt(params));
        r.on("device.nesting", params -> deviceNesting());
        r.on("device.selectInEditor", params -> deviceSelectInEditor(params));
        r.on("devcursor.status", params -> devcursorStatus());
        r.on("devcursor.pin", params -> devcursorPin(params));
        r.on("devcursor.selectInChannel", params -> devcursorSelectInChannel(params));
        r.on("devcursor.selectAt", params -> devcursorSelectAt(params));
        r.on("devcursor.selectFirstInLayer", params -> devcursorSelectFirstInLayer(params));
        r.on("devcursor.selectInLayer", params -> devcursorSelectInLayer(params));
        r.on("devcursor.selectFirstInSlot", params -> devcursorSelectFirstInSlot(params));
        r.on("devcursor.selectInSlot", params -> devcursorSelectInSlot(params));
        r.on("devcursor.selectFirstInKeyPad", params -> devcursorSelectFirstInKeyPad(params));
        r.on("devcursor.selectFirstInPad", params -> devcursorSelectFirstInPad(params));
        r.on("devcursor.selectParent", params -> devcursorSelectParent());
    }

    // ---------------------------------------- E3: structural ops & revert

    /** Page the existing bank and restore zero for the next operation. */
    private void deviceList(JsonObject params, Bridge.Reply reply) {
        int cursor = params.get("cursor").getAsInt();
        if (cursor < 0 || cursor >= rig.config.cursorPool) throw new IllegalArgumentException("cursor out of range");
        var lease = rig.writeGate.writeLease();
        String track = rig.cursorTracks[cursor].channelId().get();
        JsonArray devices = new JsonArray();
        new WindowPager(host::scheduleTask).read(
            new DeviceWindow(rig.cursorDeviceBanks[cursor], rig.config.deviceBank),
            (offset, page, next) -> { devices.addAll(page); next.accept(null); },
            (report, error) -> {
                if (error instanceof WindowPager.RestoreFailure) rig.writeGate.blockWrites(error.getMessage());
                lease.release();
                if (error != null) { reply.error(error, 0); return; }
                if (!track.equals(rig.cursorTracks[cursor].channelId().get())) {
                    reply.error(new IllegalStateException("device.list track changed during paging"), 0); return;
                }
                JsonObject result = new JsonObject();
                result.add("devices", devices);
                result.addProperty("count", devices.size());
                result.addProperty("itemCount", report.count());
                result.addProperty("trackChannelId", track);
                result.addProperty("trackPosition", rig.cursorTracks[cursor].position().get());
                result.addProperty("bankSize", rig.config.deviceBank);
                result.addProperty("pages", report.pages());
                result.addProperty("paged", true);
                reply.result(result, 0);
            });
    }

    /** Read and validate a complete-chain fingerprint without accessing Bitwig. */
    private String[] readExpectedDeviceNames(
            JsonObject params, int cursorIndex, String method, boolean required) {
        if (cursorIndex < 0 || cursorIndex >= rig.config.cursorPool) {
            throw new IllegalArgumentException("cursor out of pool range: " + cursorIndex);
        }
        if (!params.has("expectedDeviceNames") || params.get("expectedDeviceNames").isJsonNull()) {
            if (required) {
                throw new IllegalArgumentException(method + " expectedDeviceNames is required");
            }
            return null;
        }
        JsonElement value = params.get("expectedDeviceNames");
        if (!value.isJsonArray()) {
            throw new IllegalArgumentException(method + " expectedDeviceNames must be an array of strings");
        }
        JsonArray array = value.getAsJsonArray();
        if (array.size() > rig.config.deviceBank) {
            throw new IllegalArgumentException(
                method + " expectedDeviceNames has " + array.size()
                    + " items, but the device bank holds " + rig.config.deviceBank);
        }
        String[] names = new String[array.size()];
        for (int i = 0; i < array.size(); i++) {
            JsonElement name = array.get(i);
            if (name == null || !name.isJsonPrimitive() || !name.getAsJsonPrimitive().isString()) {
                throw new IllegalArgumentException(
                    method + " expectedDeviceNames[" + i + "] must be a string");
            }
            names[i] = name.getAsString();
        }
        return names;
    }

    /** Verify the durable track identity for a guarded product mutation. */
    private void verifyExpectedTrackChannelId(
            JsonObject params, int cursorIndex, String[] expectedNames, String method) {
        if (expectedNames == null) {
            return;
        }
        if (!params.has("expectedTrackChannelId")
                || params.get("expectedTrackChannelId").isJsonNull()) {
            throw new IllegalArgumentException(method + " expectedTrackChannelId is required");
        }
        String expected = params.get("expectedTrackChannelId").getAsString();
        String actual = rig.cursorTracks[cursorIndex].channelId().get();
        if (!expected.equals(actual)) {
            throw new IllegalArgumentException(
                method + " track identity changed: expected " + expected + ", got " + actual);
        }
    }

    /** Read the optional enabled fingerprint aligned with the device names. */
    private boolean[] readExpectedDeviceEnabled(
            JsonObject params, String[] expectedNames, String method) {
        if (!params.has("expectedDeviceEnabled")
                || params.get("expectedDeviceEnabled").isJsonNull()) {
            return null;
        }
        if (expectedNames == null) {
            throw new IllegalArgumentException(
                method + " expectedDeviceEnabled requires expectedDeviceNames");
        }
        JsonElement value = params.get("expectedDeviceEnabled");
        if (!value.isJsonArray()) {
            throw new IllegalArgumentException(
                method + " expectedDeviceEnabled must be an array of booleans");
        }
        JsonArray array = value.getAsJsonArray();
        if (array.size() != expectedNames.length) {
            throw new IllegalArgumentException(
                method + " expectedDeviceEnabled must align with expectedDeviceNames");
        }
        boolean[] enabled = new boolean[array.size()];
        for (int i = 0; i < array.size(); i++) {
            JsonElement item = array.get(i);
            if (item == null || !item.isJsonPrimitive()
                    || !item.getAsJsonPrimitive().isBoolean()) {
                throw new IllegalArgumentException(
                    method + " expectedDeviceEnabled[" + i + "] must be a boolean");
            }
            enabled[i] = item.getAsBoolean();
        }
        return enabled;
    }

    /** Compare the current complete bank with the caller's last stable reading. */
    private DeviceBank verifyExpectedDeviceChain(
            JsonObject params, int cursorIndex, String[] expectedNames, String method) {
        DeviceBank bank = rig.cursorDeviceBanks[cursorIndex];
        if (expectedNames == null) {
            return bank;
        }
        boolean[] expectedEnabled = readExpectedDeviceEnabled(params, expectedNames, method);

        int itemCount = bank.itemCount().get();
        if (itemCount < 0 || itemCount > rig.config.deviceBank) {
            throw new IllegalArgumentException(
                method + " device bank is incomplete: itemCount " + itemCount
                    + ", bank size " + rig.config.deviceBank);
        }
        if (itemCount != expectedNames.length) {
            throw new IllegalArgumentException(
                method + " device chain length changed: expected " + expectedNames.length
                    + ", got " + itemCount);
        }
        for (int i = 0; i < expectedNames.length; i++) {
            Device device = bank.getDevice(i);
            if (!device.exists().get()) {
                throw new IllegalArgumentException(
                    method + " device chain is incomplete at index " + i);
            }
            String actualName = device.name().get();
            if (!expectedNames[i].equals(actualName)) {
                throw new IllegalArgumentException(
                    method + " device chain changed at index " + i + ": expected \""
                        + expectedNames[i] + "\", got \"" + actualName + "\"");
            }
            if (expectedEnabled != null) {
                boolean actualEnabled = device.isEnabled().get();
                if (expectedEnabled[i] != actualEnabled) {
                    throw new IllegalArgumentException(
                        method + " device enabled chain changed at index " + i
                            + ": expected " + expectedEnabled[i] + ", got " + actualEnabled);
                }
            }
        }
        return bank;
    }

    /**
     * ⚠ E17 row 1 — make a DEVICE the UI selection. `Device.selectInEditor()`
     * (API v1, not deprecated): *"Selects the device in Bitwig Studio."*
     *
     * **Row 1 cannot be probed without this, and that is the point.** A named
     * action fires against the UI selection (E6 blocker 3), and `devcursor.selectAt`
     * does NOT set it: it calls `CursorDevice.selectDevice()` on a cursor whose
     * owning cursor track was created with `shouldFollowSelection=false`, which
     * moves OUR handle and leaves Bitwig's selection alone. So every previous
     * attempt to reason about device-scoped named actions was reasoning about a
     * selection we had never actually set.
     *
     * ⚠ Which makes the pairing explicit: E4d route 7 swept 781 actions and found
     * none that create chains, and `e17a` has now re-swept the same 781 for the
     * CONCEPT rather than the guess. `Group` (id `Group`, category Editing) is in
     * that list. E16j fired it with a TRACK selected and got a group track — the
     * finding that unblocked the whole track-native model. Nobody has ever fired
     * it with a DEVICE selected, because nobody could.
     *
     * ⚠ **The hazard is real and E6 earned it.** An action fires against whatever
     * is selected NOW, and E16j made seven orphan duplicates exactly this way. So
     * this handler reports the device it is selecting BY NAME, before selecting
     * it, and the probe asserts the selection landed before firing anything — then
     * verifies by `device.list` / `layer.list` DIFF, never by a return value.
     */
    private JsonElement deviceSelectInEditor(JsonObject params) {
        int cursorIndex = params.has("cursor") ? Integer.parseInt(params.get("cursor").getAsString()) : 0;
        int deviceIndex = params.get("deviceIndex").getAsInt();
        // Validate before calling (rule 3c) — a throw Bitwig defers to its own
        // thread escapes every extension frame and takes the DAW down (E14-A1).
        if (cursorIndex < 0 || cursorIndex >= rig.config.cursorPool) {
            throw new IllegalArgumentException("cursor out of pool range: " + cursorIndex);
        }
        if (deviceIndex < 0 || deviceIndex >= rig.config.deviceBank) {
            throw new IllegalArgumentException("deviceIndex out of bank range: " + deviceIndex);
        }
        Device target = rig.cursorDeviceBanks[cursorIndex].getDevice(deviceIndex);
        JsonObject r = ok();
        r.addProperty("deviceIndex", deviceIndex);
        // Named before the act: after this the UI selection has moved, and a probe
        // that cannot say WHAT it selected cannot interpret what an action did.
        putGuarded(r, "deviceName", () -> target.name().get());
        putGuarded(r, "deviceExists", () -> target.exists().get());
        if (!target.exists().get()) {
            throw new IllegalArgumentException(
                "no device at index " + deviceIndex + " — selecting nothing and then firing a "
                + "named action is how E16j made seven orphan duplicates");
        }
        target.selectInEditor();
        return r;
    }

    /** Duplicating a container device — does it bring its layers along? */
    private JsonElement deviceDuplicate(JsonObject params) {
        rig.cursorDeviceBanks[0].getDevice(params.get("deviceIndex").getAsInt()).duplicateObject();
        return ok();
    }

    /** Move one top-level device into the selected named slot of a container. */
    private JsonElement deviceMoveIntoSlot(JsonObject params) {
        int cursorIndex = params.has("cursor") ? params.get("cursor").getAsInt() : 0;
        if (cursorIndex != 0) {
            throw new IllegalArgumentException(
                "device.moveIntoSlot supports only cursor 0");
        }
        int sourceIndex = params.get("sourceDeviceIndex").getAsInt();
        String[] expectedNames = readExpectedDeviceNames(
            params, cursorIndex, "device.moveIntoSlot", true);
        verifyExpectedTrackChannelId(
            params, cursorIndex, expectedNames, "device.moveIntoSlot");
        verifyExpectedDeviceChain(
            params, cursorIndex, expectedNames, "device.moveIntoSlot");
        if (sourceIndex < 0 || sourceIndex >= expectedNames.length) {
            throw new IllegalArgumentException(
                "device.moveIntoSlot sourceDeviceIndex is outside expectedDeviceNames");
        }

        Device source = rig.cursorDeviceBanks[cursorIndex].getDevice(sourceIndex);
        String expectedSource = params.get("expectedSourceName").getAsString();
        if (!source.exists().get() || !expectedSource.equals(source.name().get())) {
            throw new IllegalArgumentException(
                "device.moveIntoSlot source changed at index " + sourceIndex);
        }
        String expectedContainer = params.get("expectedContainerName").getAsString();
        if (!rig.cursorDevice0.exists().get()
                || rig.cursorDevice0.isNested().get()
                || !expectedContainer.equals(rig.cursorDevice0.name().get())) {
            throw new IllegalArgumentException(
                "device.moveIntoSlot container cursor is not on \"" + expectedContainer + "\"");
        }
        String expectedSlot = params.get("expectedSlotName").getAsString();
        if (!rig.cursorDeviceSlot0.exists().get()
                || !expectedSlot.equals(rig.cursorDeviceSlot0.name().get())) {
            throw new IllegalArgumentException(
                "device.moveIntoSlot selected slot is not \"" + expectedSlot + "\"");
        }
        if (sourceIndex == rig.directParameterTopLevelIndex) {
            throw new IllegalArgumentException(
                "device.moveIntoSlot source is the selected container");
        }

        JsonObject result = ok();
        result.addProperty("sourceName", source.name().get());
        result.addProperty("containerName", rig.cursorDevice0.name().get());
        result.addProperty("slotName", rig.cursorDeviceSlot0.name().get());
        rig.cursorDeviceSlot0.endOfDeviceChainInsertionPoint().moveDevices(source);
        return result;
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
        result.addProperty("enabled", rig.cursorDevice0.isEnabled().get());
        result.addProperty("isPinned", rig.cursorDevice0.isPinned().get());
        result.addProperty("deviceIndex", rig.currentDirectParameterDeviceIndex());
        result.addProperty("trackChannelId", rig.cursorTracks[0].channelId().get());
        result.addProperty("trackPosition", rig.cursorTracks[0].position().get());
        result.addProperty("cursorTrackPinned", rig.cursorTracks[0].isPinned().get());
        result.addProperty("isNested", rig.cursorDevice0.isNested().get());
        result.addProperty("routeSignature", rig.currentDirectParameterRouteSignature());
        return result;
    }

    private JsonElement devcursorPin(JsonObject params) {
        rig.cursorDevice0.isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    /** Point the device cursor at the first device of its current track. */
    private JsonElement devcursorSelectInChannel(JsonObject params) {
        rig.beginDirectParameterRoute(0);
        rig.cursorDevice0.selectFirstInChannel(rig.cursorTracks[0]);
        return ok();
    }

    /** Point the device cursor at a specific chain index (via device bank). */
    private JsonElement devcursorSelectAt(JsonObject params) {
        int deviceIndex = params.get("deviceIndex").getAsInt();
        rig.beginDirectParameterRoute(deviceIndex);
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

    /** Select one observed device position inside one observed layer. */
    private JsonElement devcursorSelectInLayer(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        DeviceLayer layer = rig.layerBank0.getItemAt(layerIndex);
        String expectedName = params.has("expectedLayerName")
            ? params.get("expectedLayerName").getAsString() : null;
        if (expectedName != null
                && (!layer.exists().get() || !expectedName.equals(layer.name().get()))) {
            throw new IllegalArgumentException(
                "devcursor.selectInLayer named route changed at layer " + layerIndex);
        }
        // Record the route before the cursor-native selection emits observer
        // callbacks. A fixed-bank selectDevice moves the cursor but does not
        // emit nested DirectParameter IDs in Bitwig 6.0.6.
        rig.addDirectParameterRouteStep("chain", expectedName, null, deviceIndex);
        rig.cursorDevice0.selectFirstInLayer(layerIndex);
        for (int index = 0; index < deviceIndex; index++) {
            rig.cursorDevice0.selectNext();
        }
        return ok();
    }

    private JsonElement devcursorSelectFirstInSlot(JsonObject params) {
        String slot = params.get("slot").getAsString();
        rig.addDirectParameterRouteStep("deviceSlot", slot, null, 0);
        rig.cursorDevice0.selectFirstInSlot(slot);
        return ok();
    }

    /** Select one observed device position inside one observed named slot. */
    private JsonElement devcursorSelectInSlot(JsonObject params) {
        int containerIndex = params.get("containerIndex").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        String slot = params.get("slot").getAsString();
        // B08: the named-slot route is cursor-bound and addresses the container
        // by top-level position in the 16-wide bank, not by scope.
        if (containerIndex < 0 || containerIndex >= rig.config.deviceBank) {
            throw new IllegalArgumentException(
                "devcursor.selectInSlot container index is outside the observed bank");
        }
        if (deviceIndex < 0 || deviceIndex >= Rig.SLOT_LAYER_DEVICE_BANK) {
            throw new IllegalArgumentException(
                "devcursor.selectInSlot device index is outside the observed bank");
        }
        if (rig.directParameterTopLevelIndex != containerIndex
                || !rig.directParameterRouteKinds.isEmpty()) {
            throw new IllegalArgumentException(
                "devcursor.selectInSlot cursor route changed before selection");
        }
        Device parent = rig.cursorDeviceBanks[0].getDevice(containerIndex);
        if (!parent.exists().get() || rig.currentDirectParameterDeviceIndex() != containerIndex
                || !parent.name().get().equals(rig.cursorDevice0.name().get())) {
            throw new IllegalArgumentException(
                "devcursor.selectInSlot container changed before selection");
        }
        String[] slotNames = rig.cursorDevice0.slotNames().get();
        if (!rig.cursorDevice0.hasSlots().get() || slotNames.length != 1
                || !slot.equals(slotNames[0])) {
            throw new IllegalArgumentException(
                "devcursor.selectInSlot named slot changed before selection");
        }
        // Record the route before the cursor-native selection emits observer
        // callbacks. A fixed-bank selectDevice moves the cursor but does not
        // emit nested DirectParameter IDs in Bitwig 6.0.6.
        rig.addDirectParameterRouteStep("deviceSlot", slot, null, deviceIndex);
        rig.cursorDevice0.selectFirstInSlot(slot);
        for (int index = 0; index < deviceIndex; index++) {
            rig.cursorDevice0.selectNext();
        }
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
        int padIndex = params.get("padIndex").getAsInt();
        rig.cursorDevice0.selectFirstInChannel(
            rig.drumPadBank0.getItemAt(padIndex));
        rig.addDirectParameterRouteStep("drumPad", null, padIndex, 0);
        return ok();
    }

    private JsonElement devcursorSelectParent() {
        rig.cursorDevice0.selectParent();
        rig.removeDirectParameterRouteStep();
        return ok();
    }
}

package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
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
        r.on("device.insertBitwig", params -> deviceInsertBitwig(params));
        r.on("device.insertClap", params -> deviceInsertClap(params));
        r.on("device.insertVst3", params -> deviceInsertVst3(params));
        r.on("device.list", params -> deviceList(params));
        r.on("device.setEnabled", params -> deviceSetEnabled(params));
        r.on("device.delete", params -> deviceDelete(params));
        r.on("device.duplicate", params -> deviceDuplicate(params));
        r.on("device.moveTo", params -> deviceMoveTo(params));
        r.on("device.moveIntoSlot", params -> deviceMoveIntoSlot(params));
        r.on("device.insertFile", params -> deviceInsertFile(params));
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

    /**
     * Insert a Bitwig device (by UUID) at the end of a pool cursor's track
     * device chain. The cursor must already be pointed at the target track.
     * Product callers supply the complete chain fingerprint. Archived probes
     * can omit it.
     */
    private JsonElement deviceInsertBitwig(JsonObject params) {
        int cursorIndex = params.get("cursor").getAsInt();
        java.util.UUID uuid = java.util.UUID.fromString(params.get("uuid").getAsString());
        String[] expectedNames = readExpectedDeviceNames(
            params, cursorIndex, "device.insertBitwig", false);
        requireInsertCapacity(expectedNames, "device.insertBitwig");

        verifyExpectedTrackChannelId(
            params, cursorIndex, expectedNames, "device.insertBitwig");
        verifyExpectedDeviceChain(params, cursorIndex, expectedNames, "device.insertBitwig");
        rig.cursorTracks[cursorIndex].endOfDeviceChainInsertionPoint().insertBitwigDevice(uuid);
        return ok();
    }

    /** Insert a CLAP device by its CLAP id string at end of chain. */
    private JsonElement deviceInsertClap(JsonObject params) {
        int cursorIndex = params.get("cursor").getAsInt();
        String clapId = params.get("clapId").getAsString();
        if (clapId.isBlank() || !clapId.equals(clapId.trim())
                || clapId.chars().anyMatch(c -> c < 0x20 || c == 0x7f)) {
            throw new IllegalArgumentException(
                "clapId must be non-empty and contain no surrounding space or control characters");
        }
        String[] expectedNames = readExpectedDeviceNames(
            params, cursorIndex, "device.insertClap", false);
        requireInsertCapacity(expectedNames, "device.insertClap");

        verifyExpectedTrackChannelId(
            params, cursorIndex, expectedNames, "device.insertClap");
        verifyExpectedDeviceChain(params, cursorIndex, expectedNames, "device.insertClap");
        rig.cursorTracks[cursorIndex].endOfDeviceChainInsertionPoint().insertCLAPDevice(clapId);
        return ok();
    }

    /**
     * Insert a VST3 by its class UID (E16 row B2).
     *
     * E4 reached VST3s only through presets; kill criterion 2 asks specifically
     * whether duplication carries **opaque VST3 state**, which needs a real one
     * in the chain. The ID is the 32-hex-char VST3 class UID — the same string
     * Bitwig caches in `~/Library/Caches/Bitwig/vst3-metadata-*`, which is where
     * the probe gets it (there is no plugin-enumeration API).
     */
    private JsonElement deviceInsertVst3(JsonObject params) {
        int cursorIndex = params.get("cursor").getAsInt();
        String id = params.get("vst3Id").getAsString();
        if (!id.matches("[0-9A-Fa-f]{32}")) {
            throw new IllegalArgumentException("vst3Id must be 32 hex chars, got: " + id);
        }
        String[] expectedNames = readExpectedDeviceNames(
            params, cursorIndex, "device.insertVst3", false);
        requireInsertCapacity(expectedNames, "device.insertVst3");

        verifyExpectedTrackChannelId(
            params, cursorIndex, expectedNames, "device.insertVst3");
        verifyExpectedDeviceChain(params, cursorIndex, expectedNames, "device.insertVst3");
        rig.cursorTracks[cursorIndex].endOfDeviceChainInsertionPoint().insertVST3Device(id);
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
            obj.addProperty("enabled", device.isEnabled().get());
            devices.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("devices", devices);
        result.addProperty("count", devices.size());
        result.addProperty("itemCount", bank.itemCount().get());
        // E22/4a: a cursor-bound bank read must name its track. The scale sweep
        // accepts a row only after this identity is the expected channelId and
        // the complete reply repeats unchanged on two consecutive reads.
        result.addProperty("trackChannelId", rig.cursorTracks[i].channelId().get());
        result.addProperty("trackPosition", rig.cursorTracks[i].position().get());
        result.addProperty("bankSize", rig.config.deviceBank);
        return result;
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

    /** Refuse an insert that would move the result outside the observable bank. */
    private void requireInsertCapacity(String[] expectedNames, String method) {
        if (expectedNames != null && expectedNames.length >= rig.config.deviceBank) {
            throw new IllegalArgumentException(
                method + " cannot insert because the complete device bank is full");
        }
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

    /** Set one device's enabled state after all identity and state guards pass. */
    private JsonElement deviceSetEnabled(JsonObject params) {
        int cursorIndex = params.get("cursor").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        boolean enabled = params.get("enabled").getAsBoolean();

        String[] expectedNames = readExpectedDeviceNames(
            params, cursorIndex, "device.setEnabled", true);
        if (deviceIndex < 0 || deviceIndex >= rig.config.deviceBank) {
            throw new IllegalArgumentException("deviceIndex out of bank range: " + deviceIndex);
        }
        if (deviceIndex >= expectedNames.length) {
            throw new IllegalArgumentException("no expected device at index " + deviceIndex);
        }
        if (!params.has("expectedTrackChannelId")) {
            throw new IllegalArgumentException("expectedTrackChannelId is required");
        }
        if (!params.has("expectedEnabled")) {
            throw new IllegalArgumentException("expectedEnabled is required");
        }
        if (params.has("expectedName")) {
            String expectedName = params.get("expectedName").getAsString();
            if (!expectedName.equals(expectedNames[deviceIndex])) {
                throw new IllegalArgumentException(
                    "device.setEnabled expectedName disagrees with expectedDeviceNames["
                        + deviceIndex + "]");
            }
        }

        String expectedTrackChannelId = params.get("expectedTrackChannelId").getAsString();
        String actualTrackChannelId = rig.cursorTracks[cursorIndex].channelId().get();
        if (!expectedTrackChannelId.equals(actualTrackChannelId)) {
            throw new IllegalArgumentException(
                "device.setEnabled track identity changed: expected " + expectedTrackChannelId
                    + ", got " + actualTrackChannelId);
        }

        DeviceBank bank = verifyExpectedDeviceChain(
            params, cursorIndex, expectedNames, "device.setEnabled");
        Device target = bank.getDevice(deviceIndex);
        // Keep both observed comparisons adjacent to the write. They close the
        // races between the caller's independent read and this mutation.
        boolean expectedEnabled = params.get("expectedEnabled").getAsBoolean();
        boolean actualEnabled = target.isEnabled().get();
        if (expectedEnabled != actualEnabled) {
            throw new IllegalArgumentException(
                "device.setEnabled state changed: expected " + expectedEnabled
                    + ", got " + actualEnabled);
        }
        target.isEnabled().set(enabled);
        return ok();
    }

    /**
     * Delete a device by chain index on a pool cursor's track.
     *
     * ⚠⚠ Two guards, and they answer different questions. `expectedName` says
     * *is this the device we meant*; `expectedTrackChannelId` says *is this even
     * the track we meant*. The second is the one a positional cursor needs: the
     * caller points the cursor by BANK ROW, and a track bank that changed since
     * that reading aims the same number at another track — where an identically
     * named container (an "FX Layer" is not a rare name) would satisfy the name
     * guard and be deleted with an `ok` reply. Same guard, same wording, same
     * reason as `device.moveTo` below; a delete cannot be taken back.
     *
     * Product callers also send `expectedDeviceNames`. It verifies the complete
     * observable chain immediately before this method resolves the target.
     * Archived probes can omit that fingerprint.
     */
    private JsonElement deviceDelete(JsonObject params) {
        int i = params.get("cursor").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        String[] expectedNames = readExpectedDeviceNames(
            params, i, "device.delete", false);
        if (deviceIndex < 0 || deviceIndex >= rig.config.deviceBank) {
            throw new IllegalArgumentException("deviceIndex out of bank range: " + deviceIndex);
        }
        if (expectedNames != null && deviceIndex >= expectedNames.length) {
            throw new IllegalArgumentException("no expected device at index " + deviceIndex);
        }
        if (expectedNames != null && params.has("expectedName")) {
            String expectedName = params.get("expectedName").getAsString();
            if (!expectedName.equals(expectedNames[deviceIndex])) {
                throw new IllegalArgumentException(
                    "device.delete expectedName disagrees with expectedDeviceNames["
                        + deviceIndex + "]");
            }
        }
        verifyExpectedTrackChannelId(params, i, expectedNames, "device.delete");

        DeviceBank bank = verifyExpectedDeviceChain(params, i, expectedNames, "device.delete");
        Device target = bank.getDevice(deviceIndex);
        if (expectedNames == null && !target.exists().get()) {
            throw new IllegalArgumentException("no device at index " + deviceIndex);
        }
        if (expectedNames == null && params.has("expectedName")) {
            String expected = params.get("expectedName").getAsString();
            String actual = target.name().get();
            if (!expected.equals(actual)) {
                throw new IllegalArgumentException(
                    "device.delete target changed: expected \"" + expected + "\", got \"" + actual + "\"");
            }
        }
        target.deleteObject();
        return ok();
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
     *
     * Product callers send the complete top-level device-name sequence. The
     * method compares it immediately before it resolves the move endpoints.
     * Archived probes can omit this fingerprint.
     */
    private JsonElement deviceMoveTo(JsonObject params) {
        int cursorIndex = params.has("cursor") ? params.get("cursor").getAsInt() : 0;
        int deviceIndex = params.get("deviceIndex").getAsInt();
        String where = params.has("where") ? params.get("where").getAsString() : "after";
        String[] expectedNames = readExpectedDeviceNames(
            params, cursorIndex, "device.moveTo", false);
        if (deviceIndex < 0 || deviceIndex >= rig.config.deviceBank) {
            throw new IllegalArgumentException("deviceIndex out of bank range: " + deviceIndex);
        }
        if (expectedNames != null && deviceIndex >= expectedNames.length) {
            throw new IllegalArgumentException("no expected source device at index " + deviceIndex);
        }
        if (!"before".equals(where) && !"after".equals(where)
            && !"chainStart".equals(where) && !"chainEnd".equals(where)) {
            throw new IllegalArgumentException(
                "where must be before, after, chainStart or chainEnd: " + where);
        }

        int anchorIndex = -1;
        if ("before".equals(where) || "after".equals(where)) {
            if (!params.has("anchorIndex")) {
                throw new IllegalArgumentException("anchorIndex is required for " + where);
            }
            anchorIndex = params.get("anchorIndex").getAsInt();
            if (anchorIndex < 0 || anchorIndex >= rig.config.deviceBank) {
                throw new IllegalArgumentException("anchorIndex out of bank range: " + anchorIndex);
            }
            if (anchorIndex == deviceIndex) {
                throw new IllegalArgumentException(
                    "anchorIndex must differ from deviceIndex, or the move is a no-op by construction");
            }
            if (expectedNames != null && anchorIndex >= expectedNames.length) {
                throw new IllegalArgumentException("no expected anchor device at index " + anchorIndex);
            }
        }
        if (expectedNames != null && params.has("expectedSourceName")) {
            String expectedSourceName = params.get("expectedSourceName").getAsString();
            if (!expectedSourceName.equals(expectedNames[deviceIndex])) {
                throw new IllegalArgumentException(
                    "device.moveTo expectedSourceName disagrees with expectedDeviceNames["
                        + deviceIndex + "]");
            }
        }
        if (expectedNames != null && anchorIndex >= 0 && params.has("expectedAnchorName")) {
            String expectedAnchorName = params.get("expectedAnchorName").getAsString();
            if (!expectedAnchorName.equals(expectedNames[anchorIndex])) {
                throw new IllegalArgumentException(
                    "device.moveTo expectedAnchorName disagrees with expectedDeviceNames["
                        + anchorIndex + "]");
            }
        }
        verifyExpectedTrackChannelId(
            params, cursorIndex, expectedNames, "device.moveTo");

        JsonObject r = ok();
        r.addProperty("where", where);
        r.addProperty("deviceIndex", deviceIndex);
        if (anchorIndex >= 0) {
            r.addProperty("anchorIndex", anchorIndex);
        }
        if (expectedNames != null) {
            r.addProperty("sourceName", expectedNames[deviceIndex]);
            r.addProperty("sourceExists", true);
            if (anchorIndex >= 0) {
                r.addProperty("anchorName", expectedNames[anchorIndex]);
            }
        }

        DeviceBank bank = verifyExpectedDeviceChain(
            params, cursorIndex, expectedNames, "device.moveTo");
        Device source = bank.getDevice(deviceIndex);
        if (expectedNames == null) {
            if (!source.exists().get()) {
                throw new IllegalArgumentException("no source device at index " + deviceIndex);
            }
            if (params.has("expectedSourceName")) {
                String expected = params.get("expectedSourceName").getAsString();
                String actual = source.name().get();
                if (!expected.equals(actual)) {
                    throw new IllegalArgumentException(
                        "device.moveTo source changed: expected \"" + expected
                            + "\", got \"" + actual + "\"");
                }
            }
            // Read before the move. The source handle can refer to another
            // device after the chain re-indexes.
            putGuarded(r, "sourceName", () -> source.name().get());
            putGuarded(r, "sourceExists", () -> source.exists().get());
        }
        switch (where) {
            case "before":
            case "after": {
                Device anchor = bank.getDevice(anchorIndex);
                if (expectedNames == null) {
                    if (!anchor.exists().get()) {
                        throw new IllegalArgumentException("no anchor device at index " + anchorIndex);
                    }
                    if (params.has("expectedAnchorName")) {
                        String expected = params.get("expectedAnchorName").getAsString();
                        String actual = anchor.name().get();
                        if (!expected.equals(actual)) {
                            throw new IllegalArgumentException(
                                "device.moveTo anchor changed: expected \"" + expected
                                    + "\", got \"" + actual + "\"");
                        }
                    }
                    putGuarded(r, "anchorName", () -> anchor.name().get());
                }
                if ("before".equals(where)) {
                    anchor.beforeDeviceInsertionPoint().moveDevices(source);
                } else {
                    anchor.afterDeviceInsertionPoint().moveDevices(source);
                }
                break;
            }
            case "chainStart":
                rig.cursorTracks[cursorIndex].startOfDeviceChainInsertionPoint().moveDevices(source);
                break;
            case "chainEnd":
            default:
                rig.cursorTracks[cursorIndex].endOfDeviceChainInsertionPoint().moveDevices(source);
                break;
        }
        return r;
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
     * Insert a file at the end of the track's device chain. A .bwpreset of a
     * multi-layer container would create the whole structure in one call.
     * Product callers supply the complete chain fingerprint. Archived probes
     * can omit it.
     */
    private JsonElement deviceInsertFile(JsonObject params) {
        int cursorIndex = params.has("cursor") ? params.get("cursor").getAsInt() : 0;
        String path = params.get("path").getAsString();
        String[] expectedNames = readExpectedDeviceNames(
            params, cursorIndex, "device.insertFile", false);
        requireInsertCapacity(expectedNames, "device.insertFile");

        verifyExpectedTrackChannelId(
            params, cursorIndex, expectedNames, "device.insertFile");
        verifyExpectedDeviceChain(params, cursorIndex, expectedNames, "device.insertFile");
        rig.cursorTracks[cursorIndex].endOfDeviceChainInsertionPoint().insertFile(path);
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
        result.addProperty("enabled", rig.cursorDevice0.isEnabled().get());
        result.addProperty("isPinned", rig.cursorDevice0.isPinned().get());
        result.addProperty("deviceIndex", rig.currentDirectParameterDeviceIndex());
        result.addProperty("trackChannelId", rig.cursorTracks[0].channelId().get());
        result.addProperty("trackPosition", rig.cursorTracks[0].position().get());
        result.addProperty("cursorTrackPinned", rig.cursorTracks[0].isPinned().get());
        result.addProperty("isNested", rig.cursorDevice0.isNested().get());
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
        if (containerIndex < 0 || containerIndex >= Rig.SLOT_SCOPES) {
            throw new IllegalArgumentException(
                "devcursor.selectInSlot container index is outside the observed scope");
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

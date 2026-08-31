package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.Parameter;
import com.bitwig.extension.controller.api.RemoteControl;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Parameters, direct parameters and remote-control pages (E4, E4b, E7).
 *
 * Two silent-no-op traps define this surface, and they are DIFFERENT APIs with
 * different fixes:
 *   - typed Parameter: a plain value().set() is swallowed by the take-over
 *     strategy; only setImmediately() lands (E4);
 *   - DirectParameter: setDirectParameterValueNormalized takes at resolution=1
 *     and silently does nothing at 128 (E4b).
 * `param.modulated` is the modulation-liveness oracle — a base value holding
 * still while modulatedValue() sweeps is how a modulator edit is verified (E7).
 *
 * Split out of ProbeHandlers.java in Phase 0. Product parameter writes also
 * verify caller-owned complete-chain guards.
 */
public final class ParamHandlers extends HandlerGroup {
    public ParamHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("param.list", params -> paramList());
        r.on("param.set", params -> paramSet(params));
        r.on("param.modulated", params -> paramModulated());
        r.on("param.touch", params -> paramTouch(params));
        r.on("directparam.list", params -> directParamList(params));
        r.on("directparam.set", params -> directParamSet(params));
        r.on("directparam.completion", params -> directParamCompletion());
        r.on("remote.list", params -> remoteList(params));
        r.on("remote.set", params -> remoteSet(params));
        r.on("remote.setMapping", params -> remoteSetMapping(params));
        r.on("remote.selectPage", params -> remoteSelectPage(params));
    }

    /** Read typed parameter metadata for each supported current native device. */
    private JsonElement paramList() {
        JsonArray params = new JsonArray();
        int existing = appendTypedParams(params, rig.paramIds, rig.polysynthParams0);
        existing += appendTypedParams(params, rig.v1KickParamIds, rig.v1KickParams0);
        existing += appendTypedParams(params, rig.delayPlusParamIds, rig.delayPlusParams0);
        existing += appendTypedParams(params, rig.zebra3Vst3ParamIds, rig.zebra3Vst3Params0);
        JsonObject result = new JsonObject();
        result.add("params", params);
        result.addProperty("total", rig.polysynthParams0.length + rig.v1KickParams0.length
            + rig.delayPlusParams0.length + rig.zebra3Vst3Params0.length);
        result.addProperty("existing", existing);
        result.addProperty("deviceExists", rig.cursorDevice0.exists().get());
        result.addProperty("deviceName", rig.cursorDevice0.name().get());
        return result;
    }

    /** Append one typed parameter family and return its existing row count. */
    private int appendTypedParams(JsonArray params, String[] ids, Parameter[] handles) {
        int existing = 0;
        for (int i = 0; i < handles.length; i++) {
            Parameter p = handles[i];
            JsonObject obj = new JsonObject();
            obj.addProperty("id", ids[i]);
            boolean exists = p.exists().get();
            obj.addProperty("exists", exists);
            if (exists) {
                existing++;
                obj.addProperty("name", p.name().get());
                obj.addProperty("value", p.value().get());
                obj.addProperty("displayed", p.value().displayedValue().get());
                putGuarded(obj, "origin", () -> p.value().getOrigin().get());
                putGuarded(obj, "discreteValueCount", () -> p.value().discreteValueCount().get());
                try {
                    JsonArray names = new JsonArray();
                    for (String name : p.value().discreteValueNames().get()) names.add(name);
                    obj.add("discreteValueNames", names);
                } catch (Exception e) {
                    obj.addProperty("discreteValueNamesError", e.getMessage());
                }
                // ⚠⚠ E18 §3.4 — the MODULATION oracle, and the reason the row was
                // unprobeable. Liveness has only ever been readable through
                // `remote.list`, which exposes the 8 controls of the SELECTED remote
                // page — so answering "is this parameter modulated" meant guessing
                // which page it lives on and scanning. These handles are named,
                // pre-allocated and stable, and `F1FREQ`/`F1RESO` are already the
                // ones `e18c` marks for its state check. Reading `modulatedValue`
                // beside `value` turns "does modulation survive a relocation" into a
                // direct comparison on a known parameter.
                putGuarded(obj, "modulatedValue", () -> p.modulatedValue().get());
                putGuarded(obj, "hasAutomation", () -> p.hasAutomation().get());
            }
            params.add(obj);
        }
        return existing;
    }

    /**
     * Set a Polysynth param by ID to a normalized 0..1 value.
     * mode "immediate" (default) bypasses the controller take-over strategy
     * that silently swallows plain set(); "smoothed" uses set().
     */
    private JsonElement paramSet(JsonObject params) {
        String id = params.get("id").getAsString();
        double value = params.get("value").getAsDouble();
        String mode = params.has("mode") ? params.get("mode").getAsString() : "immediate";
        int idx = -1;
        for (int i = 0; i < rig.paramIds.length; i++) {
            if (rig.paramIds[i].equals(id)) {
                idx = i;
                break;
            }
        }
        if (idx < 0) {
            throw new IllegalArgumentException("unknown param id: " + id);
        }
        verifyParameterTarget(params, "param.set");
        if ("smoothed".equals(mode)) {
            rig.polysynthParams0[idx].value().set(value);
        } else {
            rig.polysynthParams0[idx].value().setImmediately(value);
        }
        return ok();
    }

    /**
     * Read value() vs modulatedValue() for each param handle: modulatedValue
     * reflects post-modulation state, so a difference is the observable proof a
     * modulation route is live.
     */
    private JsonElement paramModulated() {
        JsonArray params = new JsonArray();
        for (int i = 0; i < rig.polysynthParams0.length; i++) {
            Parameter p = rig.polysynthParams0[i];
            if (!p.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("id", rig.paramIds[i]);
            obj.addProperty("value", p.value().get());
            obj.addProperty("modulatedValue", p.modulatedValue().get());
            obj.addProperty("displayed", p.value().displayedValue().get());
            params.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("params", params);
        result.addProperty("deviceName", rig.cursorDevice0.name().get());
        return result;
    }

    private JsonElement paramTouch(JsonObject params) {
        String id = params.get("id").getAsString();
        boolean touched = params.get("touched").getAsBoolean();
        for (int i = 0; i < rig.paramIds.length; i++) {
            if (rig.paramIds[i].equals(id)) {
                rig.polysynthParams0[i].touch(touched);
                return ok();
            }
        }
        throw new IllegalArgumentException("unknown param id: " + id);
    }

    /**
     * Format-agnostic DirectParameter enumeration for cursorDevice0 — the
     * path that reaches CLAP/VST/Bitwig without a typed specific-device.
     * Reads observer-populated maps (E4b).
     */
    private JsonElement directParamList(JsonObject request) {
        if (request.has("begin") && request.get("begin").getAsBoolean()) {
            rig.beginDirectParameterObservation();
        }
        JsonArray params = new JsonArray();
        for (String id : rig.directParamIds) {
            JsonObject obj = new JsonObject();
            obj.addProperty("id", id);
            obj.addProperty("name", rig.directParamNames.getOrDefault(id, null));
            Double v = rig.directParamValues.get(id);
            if (v != null) {
                obj.addProperty("value", v);
            }
            obj.addProperty("displayed", rig.directParamDisplays.getOrDefault(id, null));
            params.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("params", params);
        result.addProperty("count", rig.directParamIds.length);
        result.addProperty("deviceExists", rig.cursorDevice0.exists().get());
        result.addProperty("deviceName", rig.cursorDevice0.name().get());
        result.addProperty("generation", rig.directParamGeneration);
        result.addProperty("idsGeneration", rig.directParamIdsGeneration);
        result.addProperty("trackChannelId", rig.cursorTracks[0].channelId().get());
        result.addProperty("trackPosition", rig.cursorTracks[0].position().get());
        result.addProperty("deviceIndex", rig.currentDirectParameterDeviceIndex());
        if (rig.directParamObservedTrackId != null) {
            result.addProperty("observedTrackChannelId", rig.directParamObservedTrackId);
        }
        if (rig.directParamObservedDeviceName != null) {
            result.addProperty("observedDeviceName", rig.directParamObservedDeviceName);
        }
        result.addProperty("observedDeviceIndex", rig.directParamObservedDeviceIndex);
        return result;
    }

    /** Write a direct parameter by id (normalized 0..1). */
    private JsonElement directParamSet(JsonObject params) {
        String id = params.get("id").getAsString();
        double value = params.get("value").getAsDouble();
        double resolution = params.has("resolution") ? params.get("resolution").getAsDouble() : 128.0;
        verifyParameterTarget(params, "directparam.set");
        long completionGeneration = rig.beginDirectParameterCompletion(id);
        rig.cursorDevice0.setDirectParameterValueNormalized(id, value, resolution);
        JsonObject result = ok();
        result.addProperty("completionGeneration", completionGeneration);
        return result;
    }

    /** Read the exact targeted callback armed by the last direct write. */
    private JsonElement directParamCompletion() {
        JsonObject result = new JsonObject();
        result.addProperty("generation", rig.directParamCompletionGeneration);
        result.addProperty("observedGeneration", rig.directParamCompletionObservedGeneration);
        if (rig.directParamCompletionId != null) {
            result.addProperty("id", rig.directParamCompletionId);
        }
        if (rig.directParamCompletionValue != null) {
            result.addProperty("value", rig.directParamCompletionValue);
        }
        if (rig.directParamCompletionTrackId != null) {
            result.addProperty("trackChannelId", rig.directParamCompletionTrackId);
        }
        if (rig.directParamCompletionDeviceName != null) {
            result.addProperty("deviceName", rig.directParamCompletionDeviceName);
        }
        result.addProperty("deviceIndex", rig.directParamCompletionDeviceIndex);
        result.addProperty("currentTrackChannelId", rig.cursorTracks[0].channelId().get());
        result.addProperty("currentDeviceName", rig.cursorDevice0.name().get());
        result.addProperty("currentDeviceIndex", rig.currentDirectParameterDeviceIndex());
        return result;
    }

    /** Verify the top-level chain, nested route, and final parameter target. */
    private void verifyParameterTarget(JsonObject params, String method) {
        if (!params.has("expectedDeviceNames") || params.get("expectedDeviceNames").isJsonNull()) {
            return;
        }
        JsonElement namesValue = params.get("expectedDeviceNames");
        if (!namesValue.isJsonArray()) {
            throw new IllegalArgumentException(method + " expectedDeviceNames must be an array");
        }
        if (!params.has("expectedTrackChannelId")
                || params.get("expectedTrackChannelId").isJsonNull()) {
            throw new IllegalArgumentException(method + " expectedTrackChannelId is required");
        }
        if (!params.has("expectedTopLevelDeviceName")
                || params.get("expectedTopLevelDeviceName").isJsonNull()) {
            throw new IllegalArgumentException(method + " expectedTopLevelDeviceName is required");
        }
        if (!params.has("expectedTopLevelDeviceIndex")
                || params.get("expectedTopLevelDeviceIndex").isJsonNull()) {
            throw new IllegalArgumentException(method + " expectedTopLevelDeviceIndex is required");
        }
        if (!params.has("expectedNestedRoute") || !params.get("expectedNestedRoute").isJsonArray()) {
            throw new IllegalArgumentException(method + " expectedNestedRoute must be an array");
        }
        if (!params.has("expectedTargetDeviceName")
                || params.get("expectedTargetDeviceName").isJsonNull()) {
            throw new IllegalArgumentException(method + " expectedTargetDeviceName is required");
        }
        if (!params.has("expectedTargetDeviceIndex")
                || params.get("expectedTargetDeviceIndex").isJsonNull()) {
            throw new IllegalArgumentException(method + " expectedTargetDeviceIndex is required");
        }
        if (!params.has("expectedTargetNested")
                || params.get("expectedTargetNested").isJsonNull()) {
            throw new IllegalArgumentException(method + " expectedTargetNested is required");
        }

        JsonArray namesArray = namesValue.getAsJsonArray();
        if (namesArray.size() > rig.config.deviceBank) {
            throw new IllegalArgumentException(
                method + " expectedDeviceNames exceeds the device bank");
        }
        String[] expectedNames = new String[namesArray.size()];
        for (int i = 0; i < namesArray.size(); i++) {
            JsonElement name = namesArray.get(i);
            if (name == null || !name.isJsonPrimitive() || !name.getAsJsonPrimitive().isString()) {
                throw new IllegalArgumentException(
                    method + " expectedDeviceNames[" + i + "] must be a string");
            }
            expectedNames[i] = name.getAsString();
        }
        boolean[] expectedEnabled = null;
        if (params.has("expectedDeviceEnabled")
                && !params.get("expectedDeviceEnabled").isJsonNull()) {
            JsonElement enabledValue = params.get("expectedDeviceEnabled");
            if (!enabledValue.isJsonArray()) {
                throw new IllegalArgumentException(
                    method + " expectedDeviceEnabled must be an array");
            }
            JsonArray enabledArray = enabledValue.getAsJsonArray();
            if (enabledArray.size() != expectedNames.length) {
                throw new IllegalArgumentException(
                    method + " expectedDeviceEnabled must align with expectedDeviceNames");
            }
            expectedEnabled = new boolean[enabledArray.size()];
            for (int i = 0; i < enabledArray.size(); i++) {
                JsonElement enabled = enabledArray.get(i);
                if (enabled == null || !enabled.isJsonPrimitive()
                        || !enabled.getAsJsonPrimitive().isBoolean()) {
                    throw new IllegalArgumentException(
                        method + " expectedDeviceEnabled[" + i + "] must be a boolean");
                }
                expectedEnabled[i] = enabled.getAsBoolean();
            }
        }

        int expectedTopLevelIndex = params.get("expectedTopLevelDeviceIndex").getAsInt();
        if (expectedTopLevelIndex < 0 || expectedTopLevelIndex >= expectedNames.length) {
            throw new IllegalArgumentException(
                method + " expectedTopLevelDeviceIndex is outside expectedDeviceNames: "
                    + expectedTopLevelIndex);
        }
        String expectedTopLevelName = params.get("expectedTopLevelDeviceName").getAsString();
        if (!expectedTopLevelName.equals(expectedNames[expectedTopLevelIndex])) {
            throw new IllegalArgumentException(
                method + " expectedTopLevelDeviceName disagrees with expectedDeviceNames["
                    + expectedTopLevelIndex + "]");
        }

        String expectedTrackChannelId = params.get("expectedTrackChannelId").getAsString();
        String actualTrackChannelId = rig.cursorTracks[0].channelId().get();
        if (!expectedTrackChannelId.equals(actualTrackChannelId)) {
            throw new IllegalArgumentException(
                method + " track identity changed: expected " + expectedTrackChannelId
                    + ", got " + actualTrackChannelId);
        }

        DeviceBank bank = rig.cursorDeviceBanks[0];
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

        if (rig.directParameterTopLevelIndex != expectedTopLevelIndex) {
            throw new IllegalArgumentException(
                method + " top-level cursor route changed: expected " + expectedTopLevelIndex
                    + ", got " + rig.directParameterTopLevelIndex);
        }

        JsonArray expectedRoute = params.get("expectedNestedRoute").getAsJsonArray();
        if (expectedRoute.size() != rig.directParameterRouteKinds.size()) {
            throw new IllegalArgumentException(
                method + " nested route depth changed: expected " + expectedRoute.size()
                    + ", got " + rig.directParameterRouteKinds.size());
        }
        for (int i = 0; i < expectedRoute.size(); i++) {
            JsonElement routeValue = expectedRoute.get(i);
            if (!routeValue.isJsonObject()) {
                throw new IllegalArgumentException(
                    method + " expectedNestedRoute[" + i + "] must be an object");
            }
            JsonObject step = routeValue.getAsJsonObject();
            String kind = step.get("kind").getAsString();
            int deviceIndex = step.get("deviceIndex").getAsInt();
            if (!kind.equals(rig.directParameterRouteKinds.get(i))
                    || deviceIndex != rig.directParameterRouteDeviceIndices.get(i)) {
                throw new IllegalArgumentException(method + " nested route changed at step " + i);
            }
            if ("drumPad".equals(kind)) {
                if (!step.has("channel")
                        || step.get("channel").getAsInt()
                            != rig.directParameterRouteChannels.get(i)) {
                    throw new IllegalArgumentException(
                        method + " drum-pad route changed at step " + i);
                }
            } else {
                String expectedName = step.get("name").getAsString();
                if (!expectedName.equals(rig.directParameterRouteNames.get(i))) {
                    throw new IllegalArgumentException(
                        method + " named route changed at step " + i);
                }
            }
        }

        int expectedTargetIndex = params.get("expectedTargetDeviceIndex").getAsInt();
        int actualDeviceIndex = rig.currentDirectParameterDeviceIndex();
        if (actualDeviceIndex != expectedTargetIndex) {
            throw new IllegalArgumentException(
                method + " target index changed: expected " + expectedTargetIndex
                    + ", got " + actualDeviceIndex);
        }
        if (!rig.cursorDevice0.exists().get()) {
            throw new IllegalArgumentException(method + " target device does not exist");
        }
        boolean expectedNested = params.get("expectedTargetNested").getAsBoolean();
        boolean actualNested = rig.cursorDevice0.isNested().get();
        if (expectedNested != actualNested || expectedNested != (expectedRoute.size() > 0)) {
            throw new IllegalArgumentException(method + " target nesting changed");
        }
        String expectedTargetName = params.get("expectedTargetDeviceName").getAsString();
        String actualDeviceName = rig.cursorDevice0.name().get();
        if (!expectedTargetName.equals(actualDeviceName)) {
            throw new IllegalArgumentException(
                method + " target changed: expected \"" + expectedTargetName
                    + "\", got \"" + actualDeviceName + "\"");
        }
    }

    // -------------------------------------------- E7: modulators / remotes

    /**
     * Enumerate the remote-controls page of the pointed device — the modern
     * modulation-mapping surface ("use remote controls instead"). Each remote
     * control is a Parameter carrying value/modulatedValue plus isBeingMapped.
     */
    private JsonElement remoteList(JsonObject request) {
        if (request.has("begin") && request.get("begin").getAsBoolean()) {
            rig.beginRemoteObservation();
        }
        JsonArray pageNames = new JsonArray();
        try {
            for (String n : rig.remotePage0.pageNames().get()) {
                pageNames.add(n);
            }
        } catch (Exception e) {
            // The empty array makes the bounded reply incomplete.
        }
        int pageCount = guardedInt(() -> rig.remotePage0.pageCount().get(), -1);
        int visiblePages = Math.min(Math.max(pageCount, 0), rig.config.remotePages);
        JsonArray pages = new JsonArray();
        for (int page = 0; page < visiblePages; page++) {
            JsonObject pageResult = remotePage(page);
            if (page < pageNames.size()) {
                pageResult.addProperty("name", pageNames.get(page).getAsString());
            }
            pages.add(pageResult);
        }
        JsonObject first = visiblePages > 0
            ? pages.get(0).getAsJsonObject() : new JsonObject();
        JsonObject result = new JsonObject();
        result.add("pages", pages);
        result.addProperty("pageBankSize", rig.config.remotePages);
        result.addProperty("pagesComplete", pageCount >= 0 && pageCount <= rig.config.remotePages);
        result.add("remotes", first.has("remotes")
            ? first.getAsJsonArray("remotes") : new JsonArray());
        result.addProperty("existing", first.has("existing")
            ? first.get("existing").getAsInt() : 0);
        result.addProperty("bankSize", Rig.REMOTE_BANK);
        result.addProperty("generation", rig.remoteGeneration);
        result.addProperty("observedGeneration", rig.remoteObservedGeneration);
        if (rig.remoteObservedTrackId != null) {
            result.addProperty("observedTrackChannelId", rig.remoteObservedTrackId);
        }
        if (rig.remoteObservedDeviceName != null) {
            result.addProperty("observedDeviceName", rig.remoteObservedDeviceName);
        }
        result.addProperty("observedDeviceIndex", rig.remoteObservedDeviceIndex);
        if (pageCount >= 0) result.addProperty("pageCount", pageCount);
        if (first.has("selectedPageIndex")) {
            result.add("selectedPageIndex", first.get("selectedPageIndex"));
        }
        result.add("pageNames", pageNames);
        result.addProperty("deviceExists", rig.cursorDevice0.exists().get());
        result.addProperty("deviceName", rig.cursorDevice0.name().get());
        putGuarded(result, "isNested", () -> rig.cursorDevice0.isNested().get());
        if (result.has("selectedPageIndex") && result.has("pageNames")) {
            int selected = result.get("selectedPageIndex").getAsInt();
            JsonArray names = result.getAsJsonArray("pageNames");
            if (selected >= 0 && selected < names.size()) {
                result.addProperty("selectedPageName", names.get(selected).getAsString());
            }
        }
        return result;
    }

    /** Read one independent page cursor for the bounded complete reply. */
    private JsonObject remotePage(int page) {
        JsonArray remotes = new JsonArray();
        int existing = 0;
        for (int r = 0; r < Rig.REMOTE_BANK; r++) {
            RemoteControl rc = rig.remoteControls0[page][r];
            JsonObject obj = new JsonObject();
            obj.addProperty("index", r);
            boolean exists = rc.exists().get();
            obj.addProperty("exists", exists);
            if (exists) {
                existing++;
                obj.addProperty("name", rc.name().get());
                obj.addProperty("value", rc.value().get());
                obj.addProperty("modulatedValue", rc.modulatedValue().get());
                obj.addProperty("isBeingMapped", rc.isBeingMapped().get());
                putGuarded(obj, "hasAutomation", () -> rc.hasAutomation().get());
            }
            remotes.add(obj);
        }
        JsonObject result = new JsonObject();
        result.addProperty("index", page);
        result.add("remotes", remotes);
        result.addProperty("existing", existing);
        result.addProperty("bankSize", Rig.REMOTE_BANK);
        putGuarded(result, "selectedPageIndex",
            () -> rig.remotePages0[page].selectedPageIndex().get());
        result.addProperty("observedGeneration", rig.remotePageObservedGeneration[page]);
        if (rig.remotePageObservedTrackId[page] != null) {
            result.addProperty("observedTrackChannelId", rig.remotePageObservedTrackId[page]);
        }
        if (rig.remotePageObservedDeviceName[page] != null) {
            result.addProperty("observedDeviceName", rig.remotePageObservedDeviceName[page]);
        }
        result.addProperty("observedDeviceIndex", rig.remotePageObservedDeviceIndex[page]);
        return result;
    }

    private int guardedInt(IntReader reader, int fallback) {
        try {
            return reader.get();
        } catch (Exception e) {
            return fallback;
        }
    }

    @FunctionalInterface
    private interface IntReader {
        int get();
    }

    /**
     * Write a remote control's value (normalized 0..1). RemoteControl extends
     * Parameter, so setImmediately bypasses the take-over strategy (E4). Tests
     * whether the agent can DRIVE a remote-mapped control end to end.
     */
    private JsonElement remoteSet(JsonObject params) {
        int page = params.has("pageIndex") ? params.get("pageIndex").getAsInt() : 0;
        int index = params.get("index").getAsInt();
        double value = params.get("value").getAsDouble();
        verifyParameterTarget(params, "remote.set");
        if (page < 0 || page >= rig.config.remotePages) {
            throw new IllegalArgumentException("remote page is outside the configured window: " + page);
        }
        if (params.has("pageName")) {
            String[] names = rig.remotePage0.pageNames().get();
            if (page >= names.length || !params.get("pageName").getAsString().equals(names[page])) {
                throw new IllegalArgumentException("remote page name changed at index " + page);
            }
        }
        RemoteControl control = rig.remoteControls0[page][index];
        if (params.has("controlName")
            && !params.get("controlName").getAsString().equals(control.name().get())) {
            throw new IllegalArgumentException("remote control name changed at index " + index);
        }
        control.value().setImmediately(value);
        return ok();
    }

    /**
     * The map idiom on a remote control: set isBeingMapped so the next touched
     * parameter is mapped to this remote. Tests whether the mapping mode is
     * reachable from a background controller (hypothesis: UI-focus dependent,
     * like the named-action / modulation idioms).
     */
    private JsonElement remoteSetMapping(JsonObject params) {
        int index = params.get("index").getAsInt();
        boolean mapping = !params.has("mapping") || params.get("mapping").getAsBoolean();
        RemoteControl rc = rig.remotes0[index];
        boolean before = rc.isBeingMapped().get();
        rc.isBeingMapped().set(mapping);
        JsonObject result = ok();
        result.addProperty("index", index);
        result.addProperty("requested", mapping);
        result.addProperty("isBeingMappedBefore", before);
        result.addProperty("isBeingMappedAfter", rc.isBeingMapped().get());
        return result;
    }

    /**
     * Select a remote-controls page — by index, or by name-match expression.
     * The rig's RemoteControl handles are bound to the CURSOR page, so they
     * re-scope to the selected page's parameters. Adding a modulator adds a
     * page named after it (E7c), so this is how its own controls are addressed.
     */
    private JsonElement remoteSelectPage(JsonObject params) {
        if (params.has("match")) {
            rig.remotePage0.selectNextPageMatching(params.get("match").getAsString(), true);
        } else {
            rig.remotePage0.selectedPageIndex().set(params.get("index").getAsInt());
        }
        return ok();
    }
}

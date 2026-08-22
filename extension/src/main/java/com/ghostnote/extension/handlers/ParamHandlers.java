package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
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
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
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
        r.on("remote.list", params -> remoteList(params));
        r.on("remote.set", params -> remoteSet(params));
        r.on("remote.setMapping", params -> remoteSetMapping(params));
        r.on("remote.selectPage", params -> remoteSelectPage(params));
    }

    /**
     * Read every pre-allocated Polysynth param handle. This is the §6a
     * "effective enumeration" test: 16 named, valued handles at once.
     */
    private JsonElement paramList() {
        JsonArray params = new JsonArray();
        int existing = 0;
        for (int i = 0; i < rig.polysynthParams0.length; i++) {
            Parameter p = rig.polysynthParams0[i];
            JsonObject obj = new JsonObject();
            obj.addProperty("id", rig.paramIds[i]);
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
                // which page it lives on and scanning. These 16 handles are named,
                // pre-allocated and stable, and `F1FREQ`/`F1RESO` are already the
                // ones `e18c` marks for its state check. Reading `modulatedValue`
                // beside `value` turns "does modulation survive a relocation" into a
                // direct comparison on a known parameter.
                putGuarded(obj, "modulatedValue", () -> p.modulatedValue().get());
                putGuarded(obj, "hasAutomation", () -> p.hasAutomation().get());
            }
            params.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("params", params);
        result.addProperty("total", rig.polysynthParams0.length);
        result.addProperty("existing", existing);
        result.addProperty("deviceExists", rig.cursorDevice0.exists().get());
        result.addProperty("deviceName", rig.cursorDevice0.name().get());
        return result;
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
        rig.cursorDevice0.setDirectParameterValueNormalized(id, value, resolution);
        return ok();
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
        JsonArray remotes = new JsonArray();
        int existing = 0;
        for (int r = 0; r < Rig.REMOTE_BANK; r++) {
            RemoteControl rc = rig.remotes0[r];
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
        result.add("remotes", remotes);
        result.addProperty("existing", existing);
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
        putGuarded(result, "pageCount", () -> rig.remotePage0.pageCount().get());
        putGuarded(result, "selectedPageIndex", () -> rig.remotePage0.selectedPageIndex().get());
        JsonArray pageNames = new JsonArray();
        try {
            for (String n : rig.remotePage0.pageNames().get()) {
                pageNames.add(n);
            }
        } catch (Exception e) {
            result.addProperty("pageNamesError", e.getMessage());
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

    /**
     * Write a remote control's value (normalized 0..1). RemoteControl extends
     * Parameter, so setImmediately bypasses the take-over strategy (E4). Tests
     * whether the agent can DRIVE a remote-mapped control end to end.
     */
    private JsonElement remoteSet(JsonObject params) {
        int index = params.get("index").getAsInt();
        double value = params.get("value").getAsDouble();
        rig.remotes0[index].value().setImmediately(value);
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

package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.Parameter;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Spike experiment handlers. Grows one method group per experiment
 * (E0 ping/info/echo; E1 tracks/clips/cursors/selection).
 * Throwaway code, but kept idiomatic for lifting into Phase 1.
 */
public class ProbeHandlers implements Bridge.Dispatcher {
    private final ControllerHost host;
    private final Rig rig;

    public ProbeHandlers(ControllerHost host, Rig rig) {
        this.host = host;
        this.rig = rig;
    }

    @Override
    public JsonElement dispatch(String method, JsonObject params) {
        switch (method) {
            // --- E0 ---
            case "ping":
                return ping();
            case "host.info":
                return hostInfo();
            case "echo":
                return params;
            case "notify":
                return notify(params);

            // --- E1: fixtures ---
            case "rig.info":
                return rigInfo();
            case "track.create":
                return trackCreate(params);
            case "track.setName":
                return trackSetName(params);
            case "track.list":
                return trackList();
            case "track.delete":
                return trackDelete(params);
            case "track.resolveByChannelId":
                return trackResolveByChannelId(params);
            case "clip.create":
                return clipCreate(params);
            case "slot.status":
                return slotStatus(params);
            case "slot.select":
                return slotSelect(params);

            // --- E1: cursors ---
            case "cursor.pin":
                return cursorPin(params);
            case "cursor.pinTrack":
                return cursorPinTrack(params);
            case "cursor.pointTrack":
                return cursorPointTrack(params);
            case "cursor.pointToClipOf":
                return cursorPointToClipOf(params);
            case "cursor.status":
                return cursorStatus(params);
            case "cursor.setNotes":
                return cursorSetNotes(params);
            case "cursor.getNotes":
                return cursorGetNotes(params);
            case "cursor.clearNotes":
                return cursorClearNotes(params);

            // --- E1: UI selection tracking ---
            case "selection.status":
                return selectionStatus();

            // --- E2: fidelity & grid ---
            case "cursor.setStepSize":
                return cursorSetStepSize(params);
            case "cursor.setAndReadNote":
                return cursorSetAndReadNote(params);
            case "cursor.setNoteProps":
                return cursorSetNoteProps(params);
            case "cursor.getNotesVerbose":
                return cursorGetNotesVerbose(params);
            case "slot.delete":
                return slotDelete(params);

            // --- E3: structural ops & revert ---
            case "device.insertBitwig":
                return deviceInsertBitwig(params);
            case "device.insertClap":
                return deviceInsertClap(params);
            case "device.list":
                return deviceList(params);
            case "device.delete":
                return deviceDelete(params);
            case "scene.create":
                return sceneCreate(params);
            case "scene.count":
                return sceneCount();
            case "scene.delete":
                return sceneDelete(params);
            case "app.undo":
                return appUndo(params);
            case "app.redo":
                return appRedo(params);
            case "app.undoState":
                return appUndoState();

            // --- E4: direct parameters ---
            case "devcursor.status":
                return devcursorStatus();
            case "devcursor.pin":
                return devcursorPin(params);
            case "devcursor.selectInChannel":
                return devcursorSelectInChannel(params);
            case "devcursor.selectAt":
                return devcursorSelectAt(params);
            case "param.list":
                return paramList();
            case "param.set":
                return paramSet(params);
            case "directparam.list":
                return directParamList();
            case "directparam.set":
                return directParamSet(params);

            default:
                throw new Bridge.MethodNotFoundException(method);
        }
    }

    private static JsonObject ok() {
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        return result;
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
        result.addProperty("tracks", Rig.TRACKS);
        result.addProperty("scenes", Rig.SCENES);
        result.addProperty("gridSteps", Rig.GRID_STEPS);
        result.addProperty("gridKeys", Rig.GRID_KEYS);
        result.addProperty("stepSize", Rig.STEP_SIZE);
        result.addProperty("cursorPool", Rig.CURSOR_POOL);
        result.addProperty("sceneCount", rig.sceneBank.itemCount().get());
        return result;
    }

    private JsonElement trackCreate(JsonObject params) {
        int position = params.get("position").getAsInt();
        rig.application.createInstrumentTrack(position);
        return ok();
    }

    private JsonElement trackSetName(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.setName(params.get("name").getAsString());
        return ok();
    }

    private JsonElement trackList() {
        JsonArray tracks = new JsonArray();
        for (int i = 0; i < Rig.TRACKS; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (!track.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", i);
            obj.addProperty("name", track.name().get());
            obj.addProperty("position", track.position().get());
            obj.addProperty("type", track.trackType().get());
            obj.addProperty("channelId", track.channelId().get());
            tracks.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("tracks", tracks);
        result.addProperty("count", tracks.size());
        return result;
    }

    private JsonElement trackDelete(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.deleteObject();
        return ok();
    }

    /**
     * Re-resolve a track to its current bank index by stable channel UUID.
     * This is the candidate stable-addressing primitive: address by UUID,
     * scan the bank to find the current index/name.
     */
    private JsonElement trackResolveByChannelId(JsonObject params) {
        String wanted = params.get("channelId").getAsString();
        JsonObject result = new JsonObject();
        for (int i = 0; i < Rig.TRACKS; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (track.exists().get() && wanted.equals(track.channelId().get())) {
                result.addProperty("found", true);
                result.addProperty("index", i);
                result.addProperty("name", track.name().get());
                result.addProperty("position", track.position().get());
                result.addProperty("type", track.trackType().get());
                return result;
            }
        }
        result.addProperty("found", false);
        return result;
    }

    private JsonElement clipCreate(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        int lengthBeats = params.has("lengthBeats") ? params.get("lengthBeats").getAsInt() : 4;
        track.createNewLauncherClip(slotIndex, lengthBeats);
        return ok();
    }

    private JsonElement slotStatus(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        JsonObject result = new JsonObject();
        result.addProperty("exists", slot.exists().get());
        result.addProperty("hasContent", slot.hasContent().get());
        result.addProperty("isSelected", slot.isSelected().get());
        return result;
    }

    /**
     * Point the *UI selection* at a slot. Mechanisms:
     *  - "slot":  ClipLauncherSlot.select()
     *  - "track": Track.selectSlot(slotIndex)
     */
    private JsonElement slotSelect(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        String mechanism = params.has("mechanism") ? params.get("mechanism").getAsString() : "slot";

        switch (mechanism) {
            case "slot":
                track.clipLauncherSlotBank().getItemAt(slotIndex).select();
                break;
            case "track":
                track.selectSlot(slotIndex);
                break;
            default:
                throw new IllegalArgumentException("unknown mechanism: " + mechanism);
        }
        return ok();
    }

    // ------------------------------------------------------- E1: cursors

    private PinnableCursorClip requirePoolClip(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        if (!(clip instanceof PinnableCursorClip pinnable)) {
            throw new IllegalArgumentException("cursor is not pinnable: " + ref);
        }
        return pinnable;
    }

    private JsonElement cursorPin(JsonObject params) {
        requirePoolClip(params).isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    private JsonElement cursorPinTrack(JsonObject params) {
        int i = params.get("cursor").getAsInt();
        rig.cursorTracks[i].isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    private JsonElement cursorPointTrack(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Track target = requireTrack(params.get("trackIndex").getAsInt());
        rig.cursorTrack(ref).selectChannel(target);
        return ok();
    }

    /** CursorClip.selectClip: point pool cursor at whatever `from` points at. */
    private JsonElement cursorPointToClipOf(JsonObject params) {
        PinnableCursorClip cursor = requirePoolClip(params);
        Clip from = rig.clip(params.get("from").getAsString());
        cursor.selectClip(from);
        return ok();
    }

    /**
     * Per-field try/catch: on unmarked values this reports the error string
     * instead of failing the whole request — deliberate, to document which
     * reads require markInterested (E2 observer-gotcha probe).
     */
    private JsonElement cursorStatus(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        JsonObject result = new JsonObject();
        putGuarded(result, "exists", () -> clip.exists().get());
        putGuarded(result, "loopLength", () -> clip.getLoopLength().get());
        putGuarded(result, "trackExists", () -> clip.getTrack().exists().get());
        putGuarded(result, "trackName", () -> clip.getTrack().name().get());
        putGuarded(result, "trackPosition", () -> clip.getTrack().position().get());
        putGuarded(result, "slotExists", () -> clip.clipLauncherSlot().exists().get());
        putGuarded(result, "sceneIndex", () -> clip.clipLauncherSlot().sceneIndex().get());
        putGuarded(result, "slotName", () -> clip.clipLauncherSlot().name().get());
        if (clip instanceof PinnableCursorClip pinnable) {
            putGuarded(result, "isPinned", () -> pinnable.isPinned().get());
            putGuarded(result, "cursorTrackPosition", () -> rig.cursorTrack(ref).position().get());
        }
        return result;
    }

    private interface ValueRead {
        Object get();
    }

    private static void putGuarded(JsonObject obj, String key, ValueRead read) {
        try {
            Object v = read.get();
            if (v instanceof Boolean b) {
                obj.addProperty(key, b);
            } else if (v instanceof Number n) {
                obj.addProperty(key, n);
            } else {
                obj.addProperty(key, String.valueOf(v));
            }
        } catch (Exception e) {
            obj.addProperty(key, "ERR:" + e.getMessage());
        }
    }

    /** notes: [[x(step), y(pitch), velocity(0-127), duration(beats)], ...] */
    private JsonElement cursorSetNotes(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;
        JsonArray notes = params.getAsJsonArray("notes");
        for (JsonElement el : notes) {
            JsonArray note = el.getAsJsonArray();
            clip.setStep(channel,
                note.get(0).getAsInt(),
                note.get(1).getAsInt(),
                note.get(2).getAsInt(),
                note.get(3).getAsDouble());
        }
        JsonObject result = ok();
        result.addProperty("written", notes.size());
        return result;
    }

    /** Pull-based scan over the full grid; lean format [x, y, vel, dur]. */
    private JsonElement cursorGetNotes(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;
        long start = System.nanoTime();
        JsonArray notes = new JsonArray();
        for (int x = 0; x < rig.gridSteps(ref); x++) {
            for (int y = 0; y < Rig.GRID_KEYS; y++) {
                NoteStep step = clip.getStep(channel, x, y);
                if (step.state() == NoteStep.State.NoteOn) {
                    JsonArray note = new JsonArray();
                    note.add(x);
                    note.add(y);
                    note.add((int) Math.round(step.velocity() * 127));
                    note.add(step.duration());
                    notes.add(note);
                }
            }
        }
        JsonObject result = new JsonObject();
        result.add("notes", notes);
        result.addProperty("count", notes.size());
        result.addProperty("scanMicros", (System.nanoTime() - start) / 1000);
        putGuarded(result, "clipExists", () -> clip.exists().get());
        return result;
    }

    private JsonElement cursorClearNotes(JsonObject params) {
        rig.clip(params.get("cursor").getAsString()).clearSteps();
        return ok();
    }

    // ------------------------------------------------- E2: fidelity & grid

    private JsonElement cursorSetStepSize(JsonObject params) {
        rig.clip(params.get("cursor").getAsString())
            .setStepSize(params.get("stepSize").getAsDouble());
        return ok();
    }

    /**
     * setStep, then read the same step back IN THE SAME REQUEST — probes
     * whether writes are synchronously visible to getStep.
     */
    private JsonElement cursorSetAndReadNote(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;
        int x = params.get("x").getAsInt();
        int y = params.get("y").getAsInt();
        int vel = params.get("vel").getAsInt();
        double dur = params.get("dur").getAsDouble();

        String preState = clip.getStep(channel, x, y).state().name();
        clip.setStep(channel, x, y, vel, dur);
        NoteStep after = clip.getStep(channel, x, y);

        JsonObject result = new JsonObject();
        result.addProperty("preState", preState);
        result.addProperty("postState", after.state().name());
        result.addProperty("postVelocity", after.velocity());
        result.addProperty("postDuration", after.duration());
        return result;
    }

    /** Set arbitrary NoteStep properties on an existing step. */
    private JsonElement cursorSetNoteProps(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;
        NoteStep step = clip.getStep(channel,
            params.get("x").getAsInt(), params.get("y").getAsInt());

        JsonObject props = params.getAsJsonObject("props");
        JsonObject applied = new JsonObject();
        for (String key : props.keySet()) {
            JsonElement v = props.get(key);
            try {
                applyNoteProp(step, key, v);
                applied.addProperty(key, "ok");
            } catch (Exception e) {
                applied.addProperty(key, "ERR:" + e.getMessage());
            }
        }
        JsonObject result = new JsonObject();
        result.add("applied", applied);
        return result;
    }

    private static void applyNoteProp(NoteStep step, String key, JsonElement v) {
        switch (key) {
            case "velocity": step.setVelocity(v.getAsDouble()); break;
            case "releaseVelocity": step.setReleaseVelocity(v.getAsDouble()); break;
            case "velocitySpread": step.setVelocitySpread(v.getAsDouble()); break;
            case "duration": step.setDuration(v.getAsDouble()); break;
            case "gain": step.setGain(v.getAsDouble()); break;
            case "pan": step.setPan(v.getAsDouble()); break;
            case "pressure": step.setPressure(v.getAsDouble()); break;
            case "timbre": step.setTimbre(v.getAsDouble()); break;
            case "transpose": step.setTranspose(v.getAsDouble()); break;
            case "chance": step.setChance(v.getAsDouble()); break;
            case "isChanceEnabled": step.setIsChanceEnabled(v.getAsBoolean()); break;
            case "isMuted": step.setIsMuted(v.getAsBoolean()); break;
            case "isOccurrenceEnabled": step.setIsOccurrenceEnabled(v.getAsBoolean()); break;
            case "occurrence":
                step.setOccurrence(com.bitwig.extension.controller.api.NoteOccurrence.valueOf(v.getAsString()));
                break;
            case "isRecurrenceEnabled": step.setIsRecurrenceEnabled(v.getAsBoolean()); break;
            case "recurrenceLength":
                // recurrence needs (length, mask) together; mask passed separately
                throw new IllegalArgumentException("use 'recurrence': [length, mask]");
            case "recurrence": {
                var arr = v.getAsJsonArray();
                step.setRecurrence(arr.get(0).getAsInt(), arr.get(1).getAsInt());
                break;
            }
            case "isRepeatEnabled": step.setIsRepeatEnabled(v.getAsBoolean()); break;
            case "repeatCount": step.setRepeatCount(v.getAsInt()); break;
            case "repeatCurve": step.setRepeatCurve(v.getAsDouble()); break;
            case "repeatVelocityCurve": step.setRepeatVelocityCurve(v.getAsDouble()); break;
            case "repeatVelocityEnd": step.setRepeatVelocityEnd(v.getAsDouble()); break;
            default: throw new IllegalArgumentException("unknown prop: " + key);
        }
    }

    /** Verbose scan: every NoteStep property for every NoteOn step. */
    private JsonElement cursorGetNotesVerbose(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;
        int maxX = params.has("maxX") ? params.get("maxX").getAsInt() : rig.gridSteps(ref);

        long start = System.nanoTime();
        JsonArray notes = new JsonArray();
        for (int x = 0; x < maxX; x++) {
            for (int y = 0; y < Rig.GRID_KEYS; y++) {
                NoteStep step = clip.getStep(channel, x, y);
                if (step.state() == NoteStep.State.NoteOn) {
                    notes.add(noteStepToJson(step));
                }
            }
        }
        JsonObject result = new JsonObject();
        result.add("notes", notes);
        result.addProperty("count", notes.size());
        result.addProperty("scanMicros", (System.nanoTime() - start) / 1000);
        putGuarded(result, "clipExists", () -> clip.exists().get());
        return result;
    }

    private static JsonObject noteStepToJson(NoteStep step) {
        JsonObject o = new JsonObject();
        o.addProperty("x", step.x());
        o.addProperty("y", step.y());
        o.addProperty("channel", step.channel());
        o.addProperty("velocity", step.velocity());
        o.addProperty("releaseVelocity", step.releaseVelocity());
        o.addProperty("velocitySpread", step.velocitySpread());
        o.addProperty("duration", step.duration());
        o.addProperty("gain", step.gain());
        o.addProperty("pan", step.pan());
        o.addProperty("pressure", step.pressure());
        o.addProperty("timbre", step.timbre());
        o.addProperty("transpose", step.transpose());
        o.addProperty("chance", step.chance());
        o.addProperty("isChanceEnabled", step.isChanceEnabled());
        o.addProperty("isMuted", step.isMuted());
        o.addProperty("isOccurrenceEnabled", step.isOccurrenceEnabled());
        o.addProperty("occurrence", step.occurrence().name());
        o.addProperty("isRecurrenceEnabled", step.isRecurrenceEnabled());
        o.addProperty("recurrenceLength", step.recurrenceLength());
        o.addProperty("recurrenceMask", step.recurrenceMask());
        o.addProperty("isRepeatEnabled", step.isRepeatEnabled());
        o.addProperty("repeatCount", step.repeatCount());
        o.addProperty("repeatCurve", step.repeatCurve());
        o.addProperty("repeatVelocityCurve", step.repeatVelocityCurve());
        o.addProperty("repeatVelocityEnd", step.repeatVelocityEnd());
        return o;
    }

    private JsonElement slotDelete(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        track.clipLauncherSlotBank().getItemAt(slotIndex).deleteObject();
        return ok();
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
        for (int d = 0; d < Rig.DEVICE_BANK; d++) {
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

    private JsonElement sceneCreate(JsonObject params) {
        int count = params.has("count") ? params.get("count").getAsInt() : 1;
        for (int i = 0; i < count; i++) {
            rig.project.createScene();
        }
        JsonObject result = ok();
        result.addProperty("requested", count);
        return result;
    }

    private JsonElement sceneCount() {
        JsonObject result = new JsonObject();
        result.addProperty("sceneCount", rig.sceneBank.itemCount().get());
        return result;
    }

    private JsonElement sceneDelete(JsonObject params) {
        int sceneIndex = params.get("sceneIndex").getAsInt();
        rig.sceneBank.getScene(sceneIndex).deleteObject();
        return ok();
    }

    private JsonElement appUndo(JsonObject params) {
        int times = params.has("times") ? params.get("times").getAsInt() : 1;
        int did = 0;
        for (int i = 0; i < times; i++) {
            if (!rig.application.canUndo().get()) {
                break;
            }
            rig.application.undo();
            did++;
        }
        JsonObject result = ok();
        result.addProperty("undosRequested", times);
        result.addProperty("undosPerformed", did);
        result.addProperty("canUndo", rig.application.canUndo().get());
        return result;
    }

    private JsonElement appRedo(JsonObject params) {
        int times = params.has("times") ? params.get("times").getAsInt() : 1;
        int did = 0;
        for (int i = 0; i < times; i++) {
            if (!rig.application.canRedo().get()) {
                break;
            }
            rig.application.redo();
            did++;
        }
        JsonObject result = ok();
        result.addProperty("redosPerformed", did);
        result.addProperty("canRedo", rig.application.canRedo().get());
        return result;
    }

    private JsonElement appUndoState() {
        JsonObject result = new JsonObject();
        result.addProperty("canUndo", rig.application.canUndo().get());
        result.addProperty("canRedo", rig.application.canRedo().get());
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
     * Read every pre-allocated Polysynth param handle. This is the §6a
     * "effective enumeration" test: 16 named, valued handles at once.
     */
    private JsonElement paramList() {
        JsonArray params = new JsonArray();
        int existing = 0;
        for (int i = 0; i < rig.polysynthParams0.length; i++) {
            Parameter p = rig.polysynthParams0[i];
            JsonObject obj = new JsonObject();
            obj.addProperty("id", Rig.POLYSYNTH_PARAM_IDS[i]);
            boolean exists = p.exists().get();
            obj.addProperty("exists", exists);
            if (exists) {
                existing++;
                obj.addProperty("name", p.name().get());
                obj.addProperty("value", p.value().get());
                obj.addProperty("displayed", p.value().displayedValue().get());
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
        for (int i = 0; i < Rig.POLYSYNTH_PARAM_IDS.length; i++) {
            if (Rig.POLYSYNTH_PARAM_IDS[i].equals(id)) {
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
     * Format-agnostic DirectParameter enumeration for cursorDevice0 — the
     * path that reaches CLAP/VST/Bitwig without a typed specific-device.
     * Reads observer-populated maps (E4b).
     */
    private JsonElement directParamList() {
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

    // ------------------------------------------- E1: UI selection tracking

    private JsonElement selectionStatus() {
        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", rig.selectedTrackIndex);
        result.addProperty("slotIndex", rig.selectedSlotIndex);
        result.addProperty("changes", rig.selectionChanges);
        return result;
    }

    // ---------------------------------------------------------- helpers

    private Track requireTrack(int trackIndex) {
        if (trackIndex < 0 || trackIndex >= Rig.TRACKS) {
            throw new IllegalArgumentException("trackIndex out of bank range: " + trackIndex);
        }
        Track track = rig.trackBank.getItemAt(trackIndex);
        if (!track.exists().get()) {
            throw new IllegalArgumentException("no track at index: " + trackIndex);
        }
        return track;
    }
}

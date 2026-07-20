package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.DeviceLayer;
import com.bitwig.extension.controller.api.DrumPad;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.RemoteControl;
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

    // E5: filled in by the extension once init() completes.
    private volatile long initNanos = -1;
    private volatile long initEpochMs = -1;

    /**
     * E8: the optimistic-concurrency revision counter — the executor's home for
     * "which generation of the world does a write assume?". Every request is
     * dispatched on the single control-surface thread (Bridge marshals all of
     * them via host.scheduleTask), so this counter is touched from ONE thread
     * only and is naturally serialized with the writes it guards — no locking,
     * no atomics needed. It is deliberately plain state on the executor, not on
     * the Rig (which holds pre-allocated API handles), because revision is
     * executor policy, not a Bitwig object.
     */
    private long revision = 0;

    public ProbeHandlers(ControllerHost host, Rig rig) {
        this.host = host;
        this.rig = rig;
    }

    public void setInitStats(long initNanos, long initEpochMs) {
        this.initNanos = initNanos;
        this.initEpochMs = initEpochMs;
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

            // --- E5: scale ---
            case "rig.stats":
                return rigStats();
            case "rig.scanTracks":
                return rigScanTracks();

            // --- E1: fixtures (continued) ---
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

            // --- E4c: device nesting ---
            case "device.nesting":
                return deviceNesting();
            case "layer.list":
                return layerList();
            case "layer.insertDevice":
                return layerInsertDevice(params);
            case "devcursor.selectFirstInLayer":
                return devcursorSelectFirstInLayer(params);
            case "devcursor.selectFirstInSlot":
                return devcursorSelectFirstInSlot(params);
            case "drumpad.list":
                return drumPadList();
            case "chainselector.status":
                return chainSelectorStatus();
            case "chainselector.set":
                return chainSelectorSet(params);

            // --- E4c-2: can nesting structure be CREATED? ---
            case "layer.duplicate":
                return layerDuplicate(params);
            case "layer.duplicateChannel":
                return layerDuplicateChannel(params);
            case "layer.copyDeviceInto":
                return layerCopyDeviceInto(params);
            case "layer.insertFile":
                return layerInsertFile(params);
            case "device.duplicate":
                return deviceDuplicate(params);
            case "device.insertFile":
                return deviceInsertFile(params);
            case "drumpad.insertDevice":
                return drumPadInsertDevice(params);
            case "layer.insertRelative":
                return layerInsertRelative(params);
            case "drumpad.duplicate":
                return drumPadDuplicate(params);
            case "devcursor.selectFirstInKeyPad":
                return devcursorSelectFirstInKeyPad(params);
            case "devcursor.selectFirstInPad":
                return devcursorSelectFirstInPad(params);
            case "devcursor.selectParent":
                return devcursorSelectParent();
            case "app.actions":
                return appActions(params);
            case "app.invokeAction":
                return appInvokeAction(params);

            // --- E7: modulators / remote controls ---
            case "remote.list":
                return remoteList();
            case "remote.setMapping":
                return remoteSetMapping(params);
            case "remote.set":
                return remoteSet(params);
            case "remote.selectPage":
                return remoteSelectPage(params);
            case "param.modulated":
                return paramModulated();
            case "param.touch":
                return paramTouch(params);
            case "slot.launch":
                return slotLaunch(params);
            case "transport.stop":
                rig.transport.stop();
                return ok();
            case "transport.status": {
                JsonObject r = new JsonObject();
                r.addProperty("isPlaying", rig.transport.isPlaying().get());
                return r;
            }
            case "device.insertFileAt":
                return deviceInsertFileAt(params);

            // --- E8: batch execution & optimistic-concurrency revision guard ---
            case "batch.run":
                return batchRun(params);
            case "revision.get":
                return revisionGet();
            case "revision.bump":
                return revisionBump();

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
        result.addProperty("tracks", rig.config.tracks);
        result.addProperty("scenes", rig.config.scenes);
        result.addProperty("gridSteps", rig.config.gridSteps);
        result.addProperty("gridKeys", rig.config.gridKeys);
        result.addProperty("stepSize", Rig.STEP_SIZE);
        result.addProperty("cursorPool", rig.config.cursorPool);
        result.addProperty("sceneCount", rig.sceneBank.itemCount().get());
        return result;
    }

    // ----------------------------------------------------------- E5: scale

    /**
     * Init cost + live scaffold sizes. `stamp` proves which config generation
     * is live, so the sweep can tell a completed hot-reload from a stale
     * bridge that never went down.
     */
    private JsonElement rigStats() {
        JsonObject result = new JsonObject();
        result.add("config", rig.config.toJson());
        result.addProperty("rigConstructMicros", rig.constructNanos / 1000);
        result.addProperty("initMicros", initNanos < 0 ? -1 : initNanos / 1000);
        result.addProperty("initEpochMs", initEpochMs);
        result.addProperty("upMs", initEpochMs < 0 ? -1 : System.currentTimeMillis() - initEpochMs);

        // Derived scaffold volume — the thing that actually scales.
        long slots = (long) rig.config.tracks * rig.config.scenes;
        result.addProperty("slotObjects", slots);
        result.addProperty("markedValues", slots * 3 + (long) rig.config.tracks * 5);

        // Whole-JVM heap (shared with Bitwig): a coarse trend signal only.
        Runtime runtime = Runtime.getRuntime();
        result.addProperty("heapUsedMb",
            (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024));
        result.addProperty("heapMaxMb", runtime.maxMemory() / (1024 * 1024));
        return result;
    }

    /**
     * Full track-bank scan: the read whose cost grows with TRACKS, and the
     * warm-up probe (channelId is the last value to stream in after init).
     */
    private JsonElement rigScanTracks() {
        long start = System.nanoTime();
        int existing = 0;
        int withChannelId = 0;
        int slotsWithContent = 0;
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (!track.exists().get()) {
                continue;
            }
            existing++;
            track.name().get();
            track.position().get();
            track.trackType().get();
            if (!track.channelId().get().isEmpty()) {
                withChannelId++;
            }
            for (int j = 0; j < rig.config.scenes; j++) {
                if (track.clipLauncherSlotBank().getItemAt(j).hasContent().get()) {
                    slotsWithContent++;
                }
            }
        }
        JsonObject result = new JsonObject();
        result.addProperty("scanMicros", (System.nanoTime() - start) / 1000);
        result.addProperty("existing", existing);
        result.addProperty("withChannelId", withChannelId);
        result.addProperty("slotsWithContent", slotsWithContent);
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
        for (int i = 0; i < rig.config.tracks; i++) {
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
        for (int i = 0; i < rig.config.tracks; i++) {
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
            for (int y = 0; y < rig.config.gridKeys; y++) {
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
            for (int y = 0; y < rig.config.gridKeys; y++) {
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
            obj.addProperty("id", rig.paramIds[i]);
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

    private JsonElement drumPadDuplicate(JsonObject params) {
        rig.drumPadBank0.getItemAt(params.get("padIndex").getAsInt()).duplicateObject();
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

    /** Dump the named-action list (E6 overlap): is layer creation an action? */
    private JsonElement appActions(JsonObject params) {
        String filter = params.has("filter") ? params.get("filter").getAsString().toLowerCase() : "";
        JsonArray actions = new JsonArray();
        int total = 0;
        for (com.bitwig.extension.controller.api.Action action : rig.application.getActions()) {
            total++;
            String id = action.getId();
            String name = action.getName();
            if (!filter.isEmpty()
                && !id.toLowerCase().contains(filter)
                && !(name != null && name.toLowerCase().contains(filter))) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("id", id);
            obj.addProperty("name", name);
            try {
                obj.addProperty("category", action.getCategory().getName());
            } catch (Exception e) {
                obj.addProperty("category", "?");
            }
            actions.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("actions", actions);
        result.addProperty("matched", actions.size());
        result.addProperty("total", total);
        return result;
    }

    private JsonElement appInvokeAction(JsonObject params) {
        String id = params.get("id").getAsString();
        com.bitwig.extension.controller.api.Action action = rig.application.getAction(id);
        JsonObject result = ok();
        if (action == null) {
            result.addProperty("resolved", false);
            return result;
        }
        result.addProperty("resolved", true);
        result.addProperty("resolvedName", action.getName());
        action.invoke();
        return result;
    }

    // -------------------------------------------- E7: modulators / remotes

    /**
     * Enumerate the remote-controls page of the pointed device — the modern
     * modulation-mapping surface ("use remote controls instead"). Each remote
     * control is a Parameter carrying value/modulatedValue plus isBeingMapped.
     */
    private JsonElement remoteList() {
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
            }
            remotes.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("remotes", remotes);
        result.addProperty("existing", existing);
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
        return result;
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
     * Touch/release a param handle — the controller-side "finger on the
     * control" signal. E7 routing sweep: with a RemoteControl in mapping mode,
     * does a programmatic touch complete the mapping (the UI idiom is
     * enter-mapping-then-touch-a-param)?
     */
    /** Launch a launcher clip (starts transport). E7e: per-voice modulators
     * only produce output while notes sound. */
    private JsonElement slotLaunch(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.clipLauncherSlotBank().getItemAt(params.get("slotIndex").getAsInt()).launch();
        return ok();
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

    // ------------------------------------------- E1: UI selection tracking

    private JsonElement selectionStatus() {
        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", rig.selectedTrackIndex);
        result.addProperty("slotIndex", rig.selectedSlotIndex);
        result.addProperty("changes", rig.selectionChanges);
        return result;
    }

    // ------------------------------------------ E8: batch executor + revision

    /**
     * Execute a list of ops carried in ONE request.
     *
     * The Bridge already marshals each RPC onto the control-surface thread, so
     * N separate requests pay N scheduling turns (the ~24ms control-surface
     * tick floor each, E5). A batch carries N ops in one request → one task →
     * one turn, dispatching each op through the same handler table. That is the
     * throughput lever for the FAST op classes (note / param writes): they all
     * land in a single turn and become verifiable one turn later (the E2
     * two-turn write rule applies once to the whole batch, not per op).
     *
     * It does NOT help ops that settle across turns — a device insert (~600ms,
     * E3), a track create (~144ms) — and an op that depends on such a settle
     * (write into a device that was inserted earlier in the same batch) would
     * run before the device exists. Those need STAGED pacing: pass `delayMs`
     * and the ops are handed to the scheduler one settle-budget apart, the
     * response returning immediately; completion is confirmed by the caller via
     * readback (the standing verify-by-readback rule).
     *
     * Optimistic concurrency: if `ifRevision` is present and does not match the
     * current revision, the batch is REJECTED whole (nothing is applied) — the
     * stale-write guard. Acceptance claims the next revision immediately, so a
     * second batch submitted against the old revision is rejected even while a
     * paced batch is still draining.
     *
     * NOTE (revert): this executor does not itself snapshot/replay for revert —
     * that is E3's snapshot-replay primitive, which composes on top. A Phase-1
     * executor snapshots the write-set before applying and replays on failure;
     * here per-op failures are recorded and the batch continues, so the probe
     * can see the whole picture.
     */
    private JsonElement batchRun(JsonObject params) {
        JsonArray ops = params.getAsJsonArray("ops");
        int delayMs = params.has("delayMs") ? params.get("delayMs").getAsInt() : 0;

        JsonObject result = new JsonObject();

        // --- revision guard (optimistic concurrency) ---
        if (params.has("ifRevision")) {
            long expected = params.get("ifRevision").getAsLong();
            if (expected != revision) {
                result.addProperty("applied", false);
                result.addProperty("rejected", true);
                result.addProperty("reason", "stale-revision");
                result.addProperty("expected", expected);
                result.addProperty("actual", revision);
                return result;
            }
        }
        long batchRevision = ++revision;

        if (delayMs > 0) {
            // Staged pacing for ops that settle across turns.
            scheduleOps(ops, 0, delayMs);
            result.addProperty("applied", true);
            result.addProperty("paced", true);
            result.addProperty("scheduled", ops.size());
            result.addProperty("delayMs", delayMs);
            result.addProperty("revision", batchRevision);
            return result;
        }

        // Synchronous fast path: every op in this one task/turn.
        long start = System.nanoTime();
        JsonArray results = new JsonArray();
        int failures = 0;
        for (JsonElement el : ops) {
            JsonObject r = runOp(el.getAsJsonObject());
            if (!r.get("ok").getAsBoolean()) {
                failures++;
            }
            results.add(r);
        }
        result.addProperty("applied", true);
        result.addProperty("paced", false);
        result.addProperty("count", ops.size());
        result.addProperty("failures", failures);
        result.addProperty("elapsedMicros", (System.nanoTime() - start) / 1000);
        result.addProperty("revision", batchRevision);
        if (params.has("verbose") && params.get("verbose").getAsBoolean()) {
            result.add("results", results);
        }
        return result;
    }

    /** Dispatch one op through the handler table; never throws (per-op result). */
    private JsonObject runOp(JsonObject op) {
        String m = op.get("method").getAsString();
        JsonObject p = op.has("params") ? op.getAsJsonObject("params") : new JsonObject();
        JsonObject r = new JsonObject();
        r.addProperty("method", m);
        try {
            if (m.startsWith("batch.")) {
                throw new IllegalArgumentException("nested batch not allowed");
            }
            dispatch(m, p);
            r.addProperty("ok", true);
        } catch (Exception e) {
            r.addProperty("ok", false);
            r.addProperty("error", String.valueOf(e.getMessage()));
        }
        return r;
    }

    /** Run op[index] now, then re-schedule op[index+1] delayMs later (staged). */
    private void scheduleOps(JsonArray ops, int index, int delayMs) {
        if (index >= ops.size()) {
            return;
        }
        runOp(ops.get(index).getAsJsonObject());
        host.scheduleTask(() -> scheduleOps(ops, index + 1, delayMs), delayMs);
    }

    private JsonElement revisionGet() {
        JsonObject r = new JsonObject();
        r.addProperty("revision", revision);
        return r;
    }

    /** Simulate an interfering edit that invalidates in-flight optimistic writes. */
    private JsonElement revisionBump() {
        JsonObject r = new JsonObject();
        r.addProperty("revision", ++revision);
        return r;
    }

    // ---------------------------------------------------------- helpers

    private Track requireTrack(int trackIndex) {
        if (trackIndex < 0 || trackIndex >= rig.config.tracks) {
            throw new IllegalArgumentException("trackIndex out of bank range: " + trackIndex);
        }
        Track track = rig.trackBank.getItemAt(trackIndex);
        if (!track.exists().get()) {
            throw new IllegalArgumentException("no track at index: " + trackIndex);
        }
        return track;
    }
}

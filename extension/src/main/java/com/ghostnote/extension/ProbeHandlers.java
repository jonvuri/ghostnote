package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.NoteStep;
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
        int i = params.get("cursor").getAsInt();
        Track target = requireTrack(params.get("trackIndex").getAsInt());
        rig.cursorTracks[i].selectChannel(target);
        return ok();
    }

    /** CursorClip.selectClip: point pool cursor at whatever `from` points at. */
    private JsonElement cursorPointToClipOf(JsonObject params) {
        PinnableCursorClip cursor = requirePoolClip(params);
        Clip from = rig.clip(params.get("from").getAsString());
        cursor.selectClip(from);
        return ok();
    }

    private JsonElement cursorStatus(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        JsonObject result = new JsonObject();
        result.addProperty("exists", clip.exists().get());
        result.addProperty("loopLength", clip.getLoopLength().get());
        result.addProperty("trackExists", clip.getTrack().exists().get());
        result.addProperty("trackName", clip.getTrack().name().get());
        result.addProperty("trackPosition", clip.getTrack().position().get());
        result.addProperty("slotExists", clip.clipLauncherSlot().exists().get());
        result.addProperty("sceneIndex", clip.clipLauncherSlot().sceneIndex().get());
        result.addProperty("slotName", clip.clipLauncherSlot().name().get());
        if (clip instanceof PinnableCursorClip pinnable) {
            result.addProperty("isPinned", pinnable.isPinned().get());
            int i = Integer.parseInt(params.get("cursor").getAsString());
            result.addProperty("cursorTrackPosition", rig.cursorTracks[i].position().get());
            result.addProperty("cursorTrackPinned", rig.cursorTracks[i].isPinned().get());
        }
        return result;
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
        Clip clip = rig.clip(params.get("cursor").getAsString());
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;
        JsonArray notes = new JsonArray();
        for (int x = 0; x < Rig.GRID_STEPS; x++) {
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
        return result;
    }

    private JsonElement cursorClearNotes(JsonObject params) {
        rig.clip(params.get("cursor").getAsString()).clearSteps();
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

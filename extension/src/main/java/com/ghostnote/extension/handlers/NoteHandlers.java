package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.NoteStep;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Clip note content — read, write and the 21-property expression sweep (E2).
 *
 * Three traps live in this surface and are NOT worked around here (the handlers
 * stay a faithful mirror of the API; the mitigation belongs in the brain):
 *   - pressure does not persist in the clip and must be refused (E15-E);
 *   - gain reads back 2x the written value; the brain applies the exact inverse
 *     once (E24);
 *   - an absent MIDI channel means channel 0 for low-level compatibility.
 * A setStep is also not visible to a getStep in the SAME request — only on the
 * next one (E2), which is what `cursor.setAndReadNote` exists to demonstrate.
 *
 * Split out of ProbeHandlers.java in Phase 0. Later product methods keep the
 * same measured note semantics.
 */
public final class NoteHandlers extends HandlerGroup {
    public NoteHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("cursor.setNotes", params -> cursorSetNotes(params));
        r.on("cursor.clearNote", params -> cursorClearNote(params));
        r.on("cursor.moveNote", params -> cursorMoveNote(params));
        r.on("cursor.getNotes", params -> cursorGetNotes(params));
        r.on("cursor.clearNotes", params -> cursorClearNotes(params));
        r.on("cursor.setStepSize", params -> cursorSetStepSize(params));
        r.on("cursor.scrollToStep", params -> cursorScrollToStep(params));
        r.on("cursor.setAndReadNote", params -> cursorSetAndReadNote(params));
        r.on("cursor.setNoteProps", params -> cursorSetNoteProps(params));
        r.on("cursor.getNotesVerbose", params -> cursorGetNotesVerbose(params));
        r.on("cursor.getNotesVerboseAllChannels", params -> cursorGetNotesVerboseAllChannels(params));
        r.on("note.observer.prepare", params -> noteObserverPrepare());
        r.on("note.observer.arm", params -> noteObserverArm(params));
        r.on("note.observer.read", params -> noteObserverRead(params));
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

    /** Remove one note without clearing other channels or cells. */
    private JsonElement cursorClearNote(JsonObject params) {
        rig.clip(params.get("cursor").getAsString()).clearStep(
            params.get("channel").getAsInt(),
            params.get("x").getAsInt(),
            params.get("y").getAsInt());
        return ok();
    }

    /** Move one note by a grid-relative offset. */
    private JsonElement cursorMoveNote(JsonObject params) {
        rig.clip(params.get("cursor").getAsString()).moveStep(
            params.get("channel").getAsInt(),
            params.get("x").getAsInt(),
            params.get("y").getAsInt(),
            params.get("dx").getAsInt(),
            params.get("dy").getAsInt());
        return ok();
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

    /** Clear the complete clip. The host has no channel-scoped clear. */
    private JsonElement cursorClearNotes(JsonObject params) {
        rig.clip(params.get("cursor").getAsString()).clearSteps();
        return ok();
    }

    // ------------------------------------------------- E2: fidelity & grid

    private JsonElement cursorSetStepSize(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        double stepSize = params.get("stepSize").getAsDouble();
        rig.clip(ref).setStepSize(stepSize);
        if ("observer".equals(ref)) rig.noteObserver.setGrid(stepSize);
        return ok();
    }

    /** Put the first visible grid step at one absolute step offset. */
    private JsonElement cursorScrollToStep(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        int step = params.get("step").getAsInt();
        rig.clip(ref).scrollToStep(step);
        if ("observer".equals(ref)) rig.noteObserver.setPage(step);
        return ok();
    }

    private JsonElement noteObserverPrepare() {
        return rig.noteObserver.prepare();
    }

    /** Arm only after the dedicated cursor has the exact pinned target. */
    private JsonElement noteObserverArm(JsonObject params) {
        int generation = params.get("generation").getAsInt();
        JsonObject state = rig.noteObserver.read(Long.MAX_VALUE);
        if (generation != state.get("generation").getAsInt()) {
            throw new IllegalArgumentException("note observer generation is stale");
        }
        String trackId = params.get("trackId").getAsString();
        int trackIndex = params.get("trackIndex").getAsInt();
        int slotIndex = params.get("slotIndex").getAsInt();
        if (!rig.noteObserverClip.exists().get()
                || rig.noteObserverTrack.position().get() != trackIndex
                || !rig.noteObserverTrack.channelId().get().equals(trackId)
                || rig.noteObserverClip.clipLauncherSlot().sceneIndex().get() != slotIndex
                || !rig.noteObserverTrack.isPinned().get()
                || !rig.noteObserverClip.isPinned().get()) {
            throw new IllegalStateException("note observer target is not confirmed and pinned");
        }
        return rig.noteObserver.arm(trackId, trackIndex, slotIndex);
    }

    private JsonElement noteObserverRead(JsonObject params) {
        long afterSequence = params.has("afterSequence")
            ? params.get("afterSequence").getAsLong() : 0;
        return rig.noteObserver.read(afterSequence);
    }

    /**
     * setStep, then read the same step back IN THE SAME REQUEST — probes
     * whether writes are synchronously visible to getStep.
     */
    private JsonElement cursorSetAndReadNote(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;

        // Probe-only precision mode. This keeps raw-bit diagnostics off the
        // product note reader and does not add a wire method.
        if (params.has("measurements")) {
            JsonArray measurements = new JsonArray();
            for (JsonElement el : params.getAsJsonArray("measurements")) {
                JsonObject requested = el.getAsJsonObject();
                int x = requested.get("x").getAsInt();
                int y = requested.get("y").getAsInt();
                double requestedDuration = requested.get("duration").getAsDouble();
                NoteStep settled = clip.getStep(channel, x, y);
                double settledDuration = settled.duration();

                JsonObject measured = new JsonObject();
                measured.addProperty("x", x);
                measured.addProperty("y", y);
                measured.addProperty("requestedDuration", requestedDuration);
                measured.addProperty("requestedRawBits", rawDoubleBits(requestedDuration));
                measured.addProperty("settledDuration", settledDuration);
                measured.addProperty("settledRawBits", rawDoubleBits(settledDuration));
                measured.addProperty("state", settled.state().name());
                measurements.add(measured);
            }
            JsonObject result = new JsonObject();
            result.add("measurements", measurements);
            return result;
        }

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

    private static String rawDoubleBits(double value) {
        return String.format("%016x", Double.doubleToRawLongBits(value));
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
        int maxX = boundedMaxX(params, ref);

        long start = System.nanoTime();
        JsonArray notes = verboseChannelNotes(clip, channel, maxX);
        JsonObject result = new JsonObject();
        result.add("notes", notes);
        result.addProperty("count", notes.size());
        result.addProperty("scanMicros", (System.nanoTime() - start) / 1000);
        putGuarded(result, "clipExists", () -> clip.exists().get());
        return result;
    }

    /** One bounded page scan for every MIDI channel. */
    private JsonElement cursorGetNotesVerboseAllChannels(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        int maxX = boundedMaxX(params, ref);
        long start = System.nanoTime();
        JsonArray channels = new JsonArray();
        int count = 0;
        for (int channel = 0; channel < 16; channel++) {
            JsonArray notes = verboseChannelNotes(clip, channel, maxX);
            JsonObject result = new JsonObject();
            result.addProperty("channel", channel);
            result.add("notes", notes);
            result.addProperty("count", notes.size());
            channels.add(result);
            count += notes.size();
        }
        JsonObject result = new JsonObject();
        result.add("channels", channels);
        result.addProperty("count", count);
        result.addProperty("scanMicros", (System.nanoTime() - start) / 1000);
        putGuarded(result, "clipExists", () -> clip.exists().get());
        return result;
    }

    private int boundedMaxX(JsonObject params, String ref) {
        int limit = rig.gridSteps(ref);
        int maxX = params.has("maxX") ? params.get("maxX").getAsInt() : limit;
        if (maxX < 1 || maxX > limit) {
            throw new IllegalArgumentException("maxX must be from 1 through " + limit);
        }
        return maxX;
    }

    private JsonArray verboseChannelNotes(Clip clip, int channel, int maxX) {
        JsonArray notes = new JsonArray();
        for (int x = 0; x < maxX; x++) {
            for (int y = 0; y < rig.config.gridKeys; y++) {
                NoteStep step = clip.getStep(channel, x, y);
                if (step.state() == NoteStep.State.NoteOn) {
                    notes.add(noteStepToJson(step));
                }
            }
        }
        return notes;
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
}

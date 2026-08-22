package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.NoteStep;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayDeque;
import java.util.Deque;

/** Bounded, generation-gated note observer data for the Phase 4 evidence probe. */
public final class NoteObserverProbe {
    private static final int MAX_EVENTS = 16_384;

    private final long initializedAtNanos = System.nanoTime();
    private final Deque<JsonObject> events = new ArrayDeque<>();
    private long sequence;
    private long dropped;
    private int generation;
    private boolean armed;
    private long armedAtNanos;
    private double grid = Rig.STEP_SIZE;
    private int page;
    private String trackId = "";
    private int trackIndex = -1;
    private int slotIndex = -1;

    /** Register the init-only Bitwig observer. */
    public void attach(Clip clip) {
        clip.addNoteStepObserver(this::record);
    }

    /** Start a target generation before the cursor changes target or view. */
    public JsonObject prepare() {
        generation++;
        armed = false;
        armedAtNanos = 0;
        trackId = "";
        trackIndex = -1;
        slotIndex = -1;
        JsonObject result = state();
        result.addProperty("afterSequence", sequence);
        return result;
    }

    /** Arm the confirmed target. Older generations stay ineligible. */
    public JsonObject arm(String confirmedTrackId, int confirmedTrackIndex, int confirmedSlotIndex) {
        trackId = confirmedTrackId;
        trackIndex = confirmedTrackIndex;
        slotIndex = confirmedSlotIndex;
        armedAtNanos = System.nanoTime();
        armed = true;
        JsonObject result = state();
        result.addProperty("afterSequence", sequence);
        return result;
    }

    public void setGrid(double value) {
        grid = value;
    }

    public void setPage(int value) {
        page = value;
    }

    /** Return events after one sequence without removing evidence needed by later arms. */
    public JsonObject read(long afterSequence) {
        JsonArray found = new JsonArray();
        for (JsonObject event : events) {
            if (event.get("sequence").getAsLong() > afterSequence) {
                found.add(event.deepCopy());
            }
        }
        JsonObject result = state();
        result.addProperty("firstRetainedSequence",
            events.isEmpty() ? sequence + 1 : events.getFirst().get("sequence").getAsLong());
        result.addProperty("dropped", dropped);
        result.add("events", found);
        return result;
    }

    private JsonObject state() {
        JsonObject result = new JsonObject();
        result.addProperty("generation", generation);
        result.addProperty("armed", armed);
        result.addProperty("sequence", sequence);
        result.addProperty("grid", grid);
        result.addProperty("page", page);
        result.addProperty("trackId", trackId);
        result.addProperty("trackIndex", trackIndex);
        result.addProperty("slotIndex", slotIndex);
        result.addProperty("capacity", MAX_EVENTS);
        result.addProperty("retained", events.size());
        result.addProperty("initializedForMicros", (System.nanoTime() - initializedAtNanos) / 1_000);
        return result;
    }

    /** Keep the callback unable to escape into Bitwig's control thread. */
    private void record(NoteStep step) {
        try {
            long now = System.nanoTime();
            JsonObject event = new JsonObject();
            event.addProperty("sequence", ++sequence);
            event.addProperty("generation", generation);
            event.addProperty("armed", armed);
            event.addProperty("callbackEpochMs", System.currentTimeMillis());
            event.addProperty("sinceInitMicros", (now - initializedAtNanos) / 1_000);
            if (armedAtNanos > 0) {
                event.addProperty("sinceArmMicros", (now - armedAtNanos) / 1_000);
            }
            event.addProperty("grid", grid);
            event.addProperty("page", page);
            event.addProperty("trackId", trackId);
            event.addProperty("trackIndex", trackIndex);
            event.addProperty("slotIndex", slotIndex);
            event.add("note", note(step));
            if (events.size() == MAX_EVENTS) {
                events.removeFirst();
                dropped++;
            }
            events.addLast(event);
        } catch (Throwable failure) {
            JsonObject event = new JsonObject();
            event.addProperty("sequence", ++sequence);
            event.addProperty("generation", generation);
            event.addProperty("armed", false);
            event.addProperty("callbackEpochMs", System.currentTimeMillis());
            event.addProperty("error", failure.getClass().getSimpleName() + ":" + failure.getMessage());
            if (events.size() == MAX_EVENTS) {
                events.removeFirst();
                dropped++;
            }
            events.addLast(event);
        }
    }

    private static JsonObject note(NoteStep step) {
        JsonObject result = new JsonObject();
        result.addProperty("x", step.x());
        result.addProperty("y", step.y());
        result.addProperty("channel", step.channel());
        result.addProperty("state", step.state().name());
        result.addProperty("velocity", step.velocity());
        result.addProperty("releaseVelocity", step.releaseVelocity());
        result.addProperty("velocitySpread", step.velocitySpread());
        result.addProperty("duration", step.duration());
        result.addProperty("gain", step.gain());
        result.addProperty("pan", step.pan());
        result.addProperty("pressure", step.pressure());
        result.addProperty("timbre", step.timbre());
        result.addProperty("transpose", step.transpose());
        result.addProperty("chance", step.chance());
        result.addProperty("isChanceEnabled", step.isChanceEnabled());
        result.addProperty("isMuted", step.isMuted());
        result.addProperty("isOccurrenceEnabled", step.isOccurrenceEnabled());
        result.addProperty("occurrence", step.occurrence().name());
        result.addProperty("isRecurrenceEnabled", step.isRecurrenceEnabled());
        result.addProperty("recurrenceLength", step.recurrenceLength());
        result.addProperty("recurrenceMask", step.recurrenceMask());
        result.addProperty("isRepeatEnabled", step.isRepeatEnabled());
        result.addProperty("repeatCount", step.repeatCount());
        result.addProperty("repeatCurve", step.repeatCurve());
        result.addProperty("repeatVelocityCurve", step.repeatVelocityCurve());
        result.addProperty("repeatVelocityEnd", step.repeatVelocityEnd());
        return result;
    }
}

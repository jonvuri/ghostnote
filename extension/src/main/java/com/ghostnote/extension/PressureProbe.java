package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Supplier;

/** R02 public-API reproduction. No document, planner, NoteHandlers, or internal host access. */
public final class PressureProbe {
    public static final String MARKER = "r02-pressure-v1";
    public static final String TRACK = "gn-r02-pressure";
    private static final int[][] CELLS = {{0, 0, 60}, {1, 4, 62}, {0, 8, 64}, {0, 12, 65}};
    private final PinnableCursorClip writer;
    private final PinnableCursorClip reader;
    private final Supplier<String> session;
    private final JsonArray events = new JsonArray();
    private final Set<String> attempted = new HashSet<>();
    private String boundSession;
    private String trackId;
    private long pointedAt;
    private long pointEpochMs;
    private long sequence;
    private long dropped;

    /** Both clips have independent NoteStep caches and callbacks on the same pinned track. */
    public PressureProbe(CursorTrack track, Supplier<String> session) {
        this.session = session;
        writer = track.createLauncherCursorClip(16, 128);
        reader = track.createLauncherCursorClip(16, 128);
        init(writer, "writer");
        init(reader, "reader");
    }

    private void init(PinnableCursorClip clip, String role) {
        clip.setStepSize(0.25);
        clip.exists().markInterested();
        clip.isPinned().markInterested();
        clip.getTrack().channelId().markInterested();
        clip.getTrack().name().markInterested();
        clip.clipLauncherSlot().sceneIndex().markInterested();
        clip.clipLauncherSlot().name().markInterested();
        clip.addNoteStepObserver(step -> {
            for (int[] cell : CELLS) {
                if (step.channel() != cell[0] || step.x() != cell[1] || step.y() != cell[2]) continue;
                JsonObject event = note(step);
                event.addProperty("sequence", ++sequence);
                event.addProperty("role", role);
                event.addProperty("epochMs", System.currentTimeMillis());
                event.addProperty("sincePointMicros", pointedAt == 0 ? -1 : (System.nanoTime() - pointedAt) / 1_000);
                event.addProperty("observedSlot", clip.clipLauncherSlot().sceneIndex().get());
                event.addProperty("observedTrackId", clip.getTrack().channelId().get());
                if (events.size() == 256) { events.remove(0); dropped++; }
                events.add(event);
            }
        });
    }

    /** Source identity is checked before changing a cursor; no mixer or slot selection is issued here. */
    public JsonObject point(Clip source, boolean writerOnly, boolean park) {
        requireSource(source, park ? 1 : 0);
        String id = source.getTrack().channelId().get();
        if (boundSession == null) {
            if (writerOnly || park) throw new IllegalArgumentException("bind both readers to the fixture first");
            boundSession = session.get();
            trackId = id;
        } else if (!boundSession.equals(session.get()) || !trackId.equals(id)) {
            throw new IllegalArgumentException("R02 session or fixture changed; reload before rebinding");
        }
        pointedAt = System.nanoTime();
        pointEpochMs = System.currentTimeMillis();
        writer.selectClip(source);
        writer.isPinned().set(true);
        if (!writerOnly) {
            reader.selectClip(source);
            reader.isPinned().set(true);
        }
        JsonObject result = new JsonObject();
        result.addProperty("marker", MARKER);
        result.addProperty("requestedSlot", park ? 1 : 0);
        result.addProperty("writerOnly", writerOnly);
        result.addProperty("verification", "pending independent read");
        return result;
    }

    private static void requireSource(Clip source, int slot) {
        if (!source.exists().get() || !TRACK.equals(source.getTrack().name().get())
                || source.getTrack().channelId().get().isEmpty()
                || source.clipLauncherSlot().sceneIndex().get() != slot
                || !(slot == 0 ? "gn-r02-notes" : "gn-r02-park").equals(source.clipLauncherSlot().name().get())) {
            throw new IllegalArgumentException("R02 requires the exact owned track and clip");
        }
    }

    private void requireBound(PinnableCursorClip clip) {
        if (boundSession == null || !boundSession.equals(session.get()))
            throw new IllegalArgumentException("R02 is unbound or the session changed");
        requireSource(clip, 0);
        if (!trackId.equals(clip.getTrack().channelId().get()) || !clip.isPinned().get())
            throw new IllegalArgumentException("R02 target or clip pin changed");
        if (System.nanoTime() - pointedAt < 500_000_000L)
            throw new IllegalArgumentException("wait at least 500 ms after pointing before a write");
    }

    /** A case is attempted at most once per extension lifetime, including a thrown setter. */
    public JsonObject write(String property) {
        if (!property.equals("pressure") && !property.equals("velocity"))
            throw new IllegalArgumentException("R02 accepts only pressure or velocity");
        requireBound(writer);
        requireBound(reader);
        for (int[] cell : CELLS) {
            for (Clip clip : new Clip[] {writer, reader}) {
                NoteStep step = clip.getStep(cell[0], cell[1], cell[2]);
                if (step.state() != NoteStep.State.NoteOn)
                    throw new IllegalArgumentException("R02 fixture note identity is not observable");
            }
        }
        if (!attempted.add(property)) throw new IllegalArgumentException("R02 case already attempted; inspect, do not retry");
        int[] cell = CELLS[property.equals("pressure") ? 2 : 3];
        NoteStep step = writer.getStep(cell[0], cell[1], cell[2]);
        double value = property.equals("pressure") ? 0.75 : 0.5;
        if (property.equals("pressure")) step.setPressure(value);
        else step.setVelocity(value);
        JsonObject result = new JsonObject();
        result.addProperty("marker", MARKER);
        result.addProperty("property", property);
        result.addProperty("requestedValue", value);
        result.addProperty("epochMs", System.currentTimeMillis());
        result.addProperty("lastPointEpochMs", pointEpochMs);
        result.addProperty("verification", "setter returned; not proof of application");
        result.add("writerImmediate", note(step));
        return result;
    }

    public JsonObject read() {
        JsonObject result = status();
        result.add("writer", snapshot(writer));
        result.add("reader", snapshot(reader));
        result.add("events", events.deepCopy());
        result.addProperty("droppedEvents", dropped);
        return result;
    }

    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("marker", MARKER);
        result.addProperty("session", session.get());
        result.addProperty("boundSession", boundSession);
        result.addProperty("trackId", trackId);
        result.addProperty("epochMs", System.currentTimeMillis());
        result.addProperty("lastPointEpochMs", pointEpochMs);
        result.addProperty("grid", 0.25);
        result.addProperty("pressureAttempted", attempted.contains("pressure"));
        result.addProperty("velocityAttempted", attempted.contains("velocity"));
        return result;
    }

    private static JsonObject snapshot(PinnableCursorClip clip) {
        JsonObject result = new JsonObject();
        result.addProperty("exists", clip.exists().get());
        result.addProperty("pinned", clip.isPinned().get());
        result.addProperty("trackId", clip.getTrack().channelId().get());
        result.addProperty("trackName", clip.getTrack().name().get());
        result.addProperty("slot", clip.clipLauncherSlot().sceneIndex().get());
        result.addProperty("clipName", clip.clipLauncherSlot().name().get());
        JsonArray notes = new JsonArray();
        for (int[] cell : CELLS) notes.add(note(clip.getStep(cell[0], cell[1], cell[2])));
        result.add("notes", notes);
        return result;
    }

    private static JsonObject note(NoteStep step) {
        JsonObject result = new JsonObject();
        result.addProperty("channel", step.channel());
        result.addProperty("x", step.x());
        result.addProperty("pitch", step.y());
        result.addProperty("state", step.state().name());
        result.addProperty("velocity", step.velocity());
        result.addProperty("duration", step.duration());
        result.addProperty("pressure", step.pressure());
        result.addProperty("timbre", step.timbre());
        return result;
    }
}

package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * 8h1a research fixture writer. One cursor at the allocated width writes a deterministic note set into an
 * owned clip, so a large fixture needs no large request. It has no step-data observer and no cache authority.
 * The brain uses the same spec as its declared oracle.
 */
public final class ShadowKneeFixture {
    public static final String SPEC = "8h1a-even-spread-v1";
    /** The widest fixture: the reader width, 8,192 beats at `1/512`. */
    public static final int MAX_WIDTH = 4_194_304;
    public static final double GRID = 1.0 / 512;
    private final CursorTrack track;
    private final PinnableCursorClip clip;
    private final int width;
    private long written, cleared, transposes;

    public ShadowKneeFixture(ControllerHost host, int width, int scenes) {
        if (width < 1 || width > MAX_WIDTH) throw new IllegalArgumentException("invalid fixture width");
        this.width = width;
        track = host.createCursorTrack("GN_KNEE_FIXTURE", "ghostnote 8h1a fixture", 0, scenes, false);
        track.exists().markInterested();
        track.channelId().markInterested();
        track.position().markInterested();
        track.isPinned().markInterested();
        clip = track.createLauncherCursorClip(width, 128);
        clip.setStepSize(GRID);
        clip.exists().markInterested();
        clip.isPinned().markInterested();
        clip.clipLauncherSlot().sceneIndex().markInterested();
    }

    /** Cell of note {@code index}. The first note is at cell 0 and the last note is at the final cell. */
    public static long cell(long index, long count, long width) {
        check(index, count, width);
        return count == 1 ? width - 1 : index * (width - 1) / (count - 1);
    }
    public static int channel(long index) { return (int) (index % 16); }
    public static int pitch(long index) { return 24 + (int) (index * 7 % 80); }
    public static int velocity(long index) { return 1 + (int) (index * 37 % 127); }
    /** Duration in cells. It never reaches the next note, so same-pitch notes cannot overlap. */
    public static long durationCells(long index, long count, long width) { return durationCells(index, count, width, 64); }
    /** 8h1a: the cap sets how many sustained cells each note covers. The host keeps one step per sounding cell. */
    public static long durationCells(long index, long count, long width, long cap) {
        if (cap < 1) throw new IllegalArgumentException("invalid duration cap");
        long next = index + 1 < count ? cell(index + 1, count, width) : width;
        return Math.max(1, Math.min(cap, next - cell(index, count, width)));
    }
    private static void check(long index, long count, long width) {
        if (count < 1 || count > width || index < 0 || index >= count) throw new IllegalArgumentException("invalid fixture spec");
    }


    public JsonObject point(Track target) {
        clip.isPinned().set(false); track.isPinned().set(false); track.selectChannel(target);
        return status();
    }
    public JsonObject select(Track target, int row) { target.selectSlot(row); return status(); }
    public JsonObject pin(boolean pinned) { track.isPinned().set(pinned); clip.isPinned().set(pinned); return status(); }

    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("spec", SPEC);
        result.addProperty("width", width);
        result.addProperty("trackExists", track.exists().get());
        result.addProperty("trackChannelId", track.channelId().get());
        result.addProperty("trackPosition", track.position().get());
        result.addProperty("trackPinned", track.isPinned().get());
        result.addProperty("clipExists", clip.exists().get());
        result.addProperty("clipPinned", clip.isPinned().get());
        result.addProperty("sceneIndex", clip.clipLauncherSlot().sceneIndex().get());
        result.addProperty("written", written);
        result.addProperty("cleared", cleared);
        result.addProperty("transposes", transposes);
        return result;
    }

    /** Write notes {@code from} through {@code from + size - 1}, shifted by {@code semitones}. */
    public JsonObject write(long count, long noteWidth, long from, int size, int semitones) {
        return write(count, noteWidth, from, size, semitones, 64);
    }
    public JsonObject write(long count, long noteWidth, long from, int size, int semitones, long cap) {
        requireBound(noteWidth);
        long started = System.nanoTime(); int done = 0;
        for (long index = from; index < Math.min(count, from + size); index++) {
            clip.setStep(channel(index), (int) cell(index, count, noteWidth), pitch(index) + semitones, velocity(index),
                durationCells(index, count, noteWidth, cap) * GRID);
            done++;
        }
        written += done;
        return batch(done, started);
    }

    /** Reconstruct transpose: clear each old note, then write it again at the new pitch. */
    public JsonObject reconstruct(long count, long noteWidth, long from, int size, int fromShift, int toShift) {
        requireBound(noteWidth);
        long started = System.nanoTime(); int done = 0;
        for (long index = from; index < Math.min(count, from + size); index++) {
            int x = (int) cell(index, count, noteWidth);
            clip.clearStep(channel(index), x, pitch(index) + fromShift);
            clip.setStep(channel(index), x, pitch(index) + toShift, velocity(index),
                durationCells(index, count, noteWidth) * GRID);
            done++;
        }
        cleared += done; written += done;
        return batch(done, started);
    }

    /** Host-native transpose of the whole bound clip. */
    public JsonObject transpose(int semitones) {
        requireBound(1);
        long started = System.nanoTime(); clip.transpose(semitones); transposes++;
        return batch(0, started);
    }

    /**
     * 8h1b sentinel matrix. Apply every operation in one call, so they share one host update. Cells are
     * 1/512 beat. Operations: set, clear, move, field, loopLength, playStop.
     */
    public JsonObject edit(JsonArray operations) {
        requireBound(1);
        long started = System.nanoTime(); int done = 0;
        for (var value : operations) {
            JsonObject op = value.getAsJsonObject();
            String kind = op.get("op").getAsString();
            switch (kind) {
                case "set" -> clip.setStep(op.get("channel").getAsInt(), cellOf(op, "x"), op.get("y").getAsInt(),
                    op.get("velocity").getAsInt(), op.get("durationCells").getAsLong() * GRID);
                case "clear" -> clip.clearStep(op.get("channel").getAsInt(), cellOf(op, "x"), op.get("y").getAsInt());
                case "move" -> clip.moveStep(op.get("channel").getAsInt(), cellOf(op, "x"), op.get("y").getAsInt(),
                    op.get("dx").getAsInt(), op.get("dy").getAsInt());
                case "field" -> field(clip.getStep(op.get("channel").getAsInt(), cellOf(op, "x"), op.get("y").getAsInt()),
                    op.get("field").getAsString(), op.get("value"));
                case "loopLength" -> clip.getLoopLength().set(op.get("beats").getAsDouble());
                case "playStop" -> clip.getPlayStop().set(op.get("beats").getAsDouble());
                default -> throw new IllegalArgumentException("unknown fixture edit " + kind);
            }
            done++;
        }
        written += done;
        return batch(done, started);
    }

    private int cellOf(JsonObject op, String key) {
        int x = op.get(key).getAsInt();
        if (x < 0 || x >= width) throw new IllegalArgumentException("cell outside fixture cursor");
        return x;
    }

    private static void field(NoteStep step, String field, com.google.gson.JsonElement value) {
        if (step.state() != NoteStep.State.NoteOn) throw new IllegalStateException("field edit needs a note start");
        switch (field) {
            case "velocity" -> step.setVelocity(value.getAsDouble());
            case "gain" -> step.setGain(value.getAsDouble());
            case "chance" -> step.setChance(value.getAsDouble());
            case "chanceEnabled" -> step.setIsChanceEnabled(value.getAsBoolean());
            case "muted" -> step.setIsMuted(value.getAsBoolean());
            case "duration" -> step.setDuration(value.getAsLong() * GRID);
            default -> throw new IllegalArgumentException("unknown note field " + field);
        }
    }

    /**
     * 8h2a decoration: non-default note values on a deterministic subset. Index mod 4 selects the field:
     * 1 sets gain, 2 sets the chance value, 3 mutes. Index mod 8 = 0 disables chance; mod 8 = 4 keeps defaults.
     */
    public static double decoratedGain(long index) { return 0.05 + (index * 13 % 90) / 100.0; }
    public static double decoratedChance(long index) { return 0.1 + (index * 7 % 80) / 100.0; }

    public JsonObject decorate(long count, long noteWidth, long from, int size) {
        requireBound(noteWidth);
        long started = System.nanoTime(); int done = 0;
        for (long index = from; index < Math.min(count, from + size); index++) {
            int kind = (int) (index % 8);
            if (kind == 4) continue;
            NoteStep step = clip.getStep(channel(index), (int) cell(index, count, noteWidth), pitch(index));
            if (step.state() != NoteStep.State.NoteOn) throw new IllegalStateException("decoration needs a note start at index " + index);
            switch (kind % 4) {
                case 0 -> step.setIsChanceEnabled(false);
                case 1 -> step.setGain(decoratedGain(index));
                case 2 -> step.setChance(decoratedChance(index));
                default -> step.setIsMuted(true);
            }
            done++;
        }
        written += done;
        return batch(done, started);
    }

    /** Targeted oracle reads. Each coordinate reads all 16 channels. */
    public JsonObject read(JsonArray coordinates) {
        requireBound(1);
        long started = System.nanoTime();
        JsonArray rows = new JsonArray();
        for (var value : coordinates) {
            JsonArray coordinate = value.getAsJsonArray();
            int x = coordinate.get(0).getAsInt(), y = coordinate.get(1).getAsInt();
            if (x < 0 || x >= width || y < 0 || y > 127) throw new IllegalArgumentException("coordinate outside fixture cursor");
            for (int channel = 0; channel < 16; channel++) {
                NoteStep step = clip.getStep(channel, x, y);
                if (step.state() != NoteStep.State.NoteOn) continue;
                JsonObject note = new JsonObject();
                note.addProperty("channel", channel); note.addProperty("cell", x); note.addProperty("pitch", y);
                note.addProperty("velocity", step.velocity());
                note.addProperty("rawDuration", step.duration());
                note.addProperty("durationCells", normalizeDurationCells(step.duration()));
                note.addProperty("gain", step.gain()); note.addProperty("pan", step.pan());
                note.addProperty("timbre", step.timbre()); note.addProperty("pressure", step.pressure());
                note.addProperty("transpose", step.transpose()); note.addProperty("isMuted", step.isMuted());
                note.addProperty("chance", step.chance()); note.addProperty("isChanceEnabled", step.isChanceEnabled());
                rows.add(note);
            }
        }
        JsonObject result = status();
        result.add("notes", rows);
        result.addProperty("readMs", (System.nanoTime() - started) / 1_000_000.0);
        return result;
    }

    private void requireBound(long noteWidth) {
        if (noteWidth < 1 || noteWidth > width) throw new IllegalArgumentException("fixture width exceeds cursor allocation");
        if (!track.exists().get() || !clip.exists().get() || !track.isPinned().get() || !clip.isPinned().get())
            throw new IllegalStateException("fixture cursor is not bound and pinned");
    }

    private JsonObject batch(int done, long started) {
        JsonObject result = status();
        result.addProperty("batch", done);
        result.addProperty("batchMs", (System.nanoTime() - started) / 1_000_000.0);
        return result;
    }

    /** A host duration in `1/512` cells, rounded half up, at least one cell. */
    static long normalizeDurationCells(double duration) {
        if (!Double.isFinite(duration) || duration <= 0) throw new IllegalArgumentException("invalid host duration");
        double cells = duration * 512;
        if (!Double.isFinite(cells) || cells > 9_007_199_254_740_991L)
            throw new IllegalArgumentException("host duration exceeds exact cell range");
        long lower = (long) Math.floor(cells);
        return Math.max(1, lower + (cells - lower >= 0.5 ? 1 : 0));
    }
}

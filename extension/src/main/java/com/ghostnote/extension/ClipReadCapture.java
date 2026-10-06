package com.ghostnote.extension;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * One binding of the clip reader (8h3c). It decodes notes from note-step callbacks only and never calls
 * {@code getStep} (D30). A callback that arrives while no batch task is pending schedules one zero-delay task
 * (D27). The read closes at the later of the first batch task and the task of the target {@code clipExists}
 * callback. An empty clip closes on the {@code clipExists} task alone. The close task makes the only copy of the
 * notes; later callbacks cannot change it. Callbacks before release enter the step-delta check.
 * Callbacks after release have separate state counters. Both sets remain visible.
 */
final class ClipReadCapture {
    static final int STATE_EMPTY = 0, STATE_SUSTAIN = 1, STATE_ON = 2;

    /** Double fields in frame order. The names are the {@code NoteStep} property names. */
    static final String[] DOUBLES = {"velocity", "releaseVelocity", "velocitySpread", "duration", "gain", "pan",
        "pressure", "timbre", "transpose", "chance", "repeatCurve", "repeatVelocityCurve", "repeatVelocityEnd"};
    /** Integer fields. {@code occurrence} is the {@code NoteOccurrence} ordinal. */
    static final String[] INTS = {"occurrence", "recurrenceLength", "recurrenceMask", "repeatCount"};
    static final String[] FLAGS = {"isChanceEnabled", "isMuted", "isOccurrenceEnabled", "isRecurrenceEnabled",
        "isRepeatEnabled"};

    /** The fields of one NoteOn callback. The observer fills one instance and passes it to {@link #step}. */
    static final class Fields {
        final double[] doubles = new double[DOUBLES.length];
        final int[] ints = new int[INTS.length];
        final boolean[] flags = new boolean[FLAGS.length];
    }

    /** The decoded notes at the close, without removed notes, in first-delivery order. */
    static final class Notes {
        final int count;
        final byte[] channel, pitch;
        final int[] cell;
        final double[][] doubles;
        final int[][] ints;
        final boolean[][] flags;

        private Notes(ClipReadCapture source) {
            int kept = 0;
            for (int i = 0; i < source.notes; i++) if (!source.gone[i]) kept++;
            count = kept;
            channel = new byte[kept]; pitch = new byte[kept]; cell = new int[kept];
            doubles = new double[DOUBLES.length][kept]; ints = new int[INTS.length][kept];
            flags = new boolean[FLAGS.length][kept];
            for (int i = 0, at = 0; i < source.notes; i++) {
                if (source.gone[i]) continue;
                channel[at] = source.channel[i]; pitch[at] = source.pitch[i]; cell[at] = source.cell[i];
                for (int f = 0; f < DOUBLES.length; f++) doubles[f][at] = source.doubles[f][i];
                for (int f = 0; f < INTS.length; f++) ints[f][at] = source.ints[f][i];
                for (int f = 0; f < FLAGS.length; f++) flags[f][at] = source.flags[f][i];
                at++;
            }
        }
    }

    final long id;
    private final Consumer<Runnable> schedule;
    private final Runnable onClose;
    long callbacks, onsets, duplicates;
    /** Callbacks after the close. The step-delta check and the tripwire read this. */
    long afterClose;
    int batches;
    long afterRelease, releaseEmpty, releaseSustain, releaseOn;
    private boolean released;
    final java.util.List<int[]> releaseSamples = new java.util.ArrayList<>();
    private boolean pending, existsTask, firstBatchTask;
    private Notes closed;
    private long closeSeq = -1;

    private final Map<Long, Integer> index = new HashMap<>();
    private int notes;
    private byte[] channel = new byte[64], pitch = new byte[64];
    private int[] cell = new int[64];
    private double[][] doubles = new double[DOUBLES.length][64];
    private int[][] ints = new int[INTS.length][64];
    private boolean[][] flags = new boolean[FLAGS.length][64];
    private boolean[] gone = new boolean[64];

    /** {@code onClose} runs once, in the close task, after the copy. */
    ClipReadCapture(long id, Consumer<Runnable> schedule, Runnable onClose) {
        this.id = id; this.schedule = schedule; this.onClose = onClose;
    }

    static long key(int channel, int x, int y) { return ((long) x << 11) | ((long) channel << 7) | y; }

    boolean isClosed() { return closed != null; }
    long closeSeq() { return closeSeq; }

    /** End the confirmation window before unsubscribe. Release can clear the host step view. */
    void release() {
        if (closed == null) throw new IllegalStateException("release requires a closed capture");
        released = true;
    }

    Notes notes() {
        if (closed == null) throw new IllegalStateException("the read is not closed");
        return closed;
    }

    /** One note-step callback. {@code values} is read only for a NoteOn state. */
    void step(int x, int y, int ch, int state, Fields values) {
        callbacks++;
        if (closed != null) {
            if (!released) afterClose++;
            else {
                afterRelease++;
                if (state == STATE_EMPTY) releaseEmpty++;
                else if (state == STATE_SUSTAIN) releaseSustain++;
                else releaseOn++;
                if (releaseSamples.size() < 8) releaseSamples.add(new int[] {x, y, ch, state});
            }
            return;
        }
        if (!pending) {
            pending = true;
            batches++;
            schedule.accept(this::batchTask);
        }
        long k = key(ch, x, y);
        Integer at = index.get(k);
        if (state == STATE_ON) {
            onsets++;
            if (at != null) {
                // A second callback for one note cell in one binding: the replay is not the only delivery.
                duplicates++;
                gone[at] = false;
                put(at, ch, x, y, values);
            } else {
                grow();
                index.put(k, notes);
                put(notes++, ch, x, y, values);
            }
        } else if (at != null && !gone[at]) {
            gone[at] = true;
            duplicates++;
        }
    }

    /** The target {@code clipExists} callback. Only a true value is a start signal. */
    void exists(boolean value) {
        if (!value || closed != null) return;
        schedule.accept(() -> { existsTask = true; tryClose(); });
    }

    private void batchTask() {
        pending = false;
        if (batches == 1) firstBatchTask = true;
        tryClose();
    }

    private void tryClose() {
        if (closed != null || !existsTask || (callbacks > 0 && !firstBatchTask)) return;
        closeSeq = callbacks;
        closed = new Notes(this);
        onClose.run();
    }

    private void put(int at, int ch, int x, int y, Fields values) {
        channel[at] = (byte) ch; cell[at] = x; pitch[at] = (byte) y;
        for (int f = 0; f < DOUBLES.length; f++) doubles[f][at] = values.doubles[f];
        for (int f = 0; f < INTS.length; f++) ints[f][at] = values.ints[f];
        for (int f = 0; f < FLAGS.length; f++) flags[f][at] = values.flags[f];
    }

    private void grow() {
        if (notes < cell.length) return;
        int size = cell.length * 2;
        channel = Arrays.copyOf(channel, size); pitch = Arrays.copyOf(pitch, size); cell = Arrays.copyOf(cell, size);
        for (int f = 0; f < DOUBLES.length; f++) doubles[f] = Arrays.copyOf(doubles[f], size);
        for (int f = 0; f < INTS.length; f++) ints[f] = Arrays.copyOf(ints[f], size);
        for (int f = 0; f < FLAGS.length; f++) flags[f] = Arrays.copyOf(flags[f], size);
        gone = Arrays.copyOf(gone, size);
    }
}

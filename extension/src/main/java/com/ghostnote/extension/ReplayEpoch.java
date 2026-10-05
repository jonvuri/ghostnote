package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * 8h2a research: one binding of the replay reader. It decodes notes from note-step callbacks only and
 * records the delivery batch shape with zero-delay tasks (D27). Each callback that arrives while no batch
 * task is pending schedules one. A batch task records the callback count when it runs and schedules one
 * confirmation task (the step-delta window). Value callbacks also schedule a task, for the start signal.
 * Every result is research only: complete:false, eligible:false.
 */
public final class ReplayEpoch {
    static final int STATE_EMPTY = 0, STATE_SUSTAIN = 1, STATE_ON = 2;
    static final int MAX_BATCHES = 256, MAX_VALUES = 64;

    /** One delivery batch, closed by the task that its first callback scheduled. */
    static final class Batch {
        long firstSeq, firstNanos, taskSeq = -1, taskNanos, lastNanosAtTask, confirmSeq = -1, confirmNanos;
    }
    /** One value callback and the step count that its scheduled task observed. */
    static final class ValueEvent {
        String kind, value; long seq, nanos, taskSeq = -1, taskNanos;
    }

    private final Consumer<Runnable> schedule;
    final long id, armNanos;
    final String label;
    long callbacks, onset, sustain, empty, firstNanos, lastNanos, handlerNanos, duplicates, removed, droppedBatches, droppedValues;
    private boolean pending;
    final List<Batch> batches = new ArrayList<>();
    final List<ValueEvent> values = new ArrayList<>();
    /** Research edit: run once when the callback count reaches {@code editAt}. */
    private long editAt = -1, editSeq = -1, editNanos;
    private Runnable edit;
    private String editError;

    private final Map<Long, Integer> index = new HashMap<>();
    private int notes;
    private byte[] channel = new byte[64], pitch = new byte[64];
    private int[] cell = new int[64];
    private double[] velocity = new double[64], duration = new double[64], gain = new double[64], chance = new double[64];
    private boolean[] chanceEnabled = new boolean[64], muted = new boolean[64], gone = new boolean[64];

    public ReplayEpoch(long id, String label, long armNanos, Consumer<Runnable> schedule) {
        this.id = id; this.label = label; this.armNanos = armNanos; this.schedule = schedule;
    }

    static long key(int channel, int x, int y) { return ((long) x << 11) | ((long) channel << 7) | y; }

    public void armEdit(long at, Runnable action) {
        if (at < 1 || action == null) throw new IllegalArgumentException("invalid research edit");
        editAt = at; edit = action;
    }

    public void step(int x, int y, int ch, int state, double vel, double dur, double gn, double chc, boolean chcOn, boolean mute, long now) {
        long seq = ++callbacks;
        if (firstNanos == 0) firstNanos = now;
        lastNanos = now;
        if (!pending) {
            pending = true;
            Batch batch = new Batch(); batch.firstSeq = seq; batch.firstNanos = now;
            if (batches.size() < MAX_BATCHES) batches.add(batch); else droppedBatches++;
            schedule.accept(() -> closeBatch(batch));
        }
        long k = key(ch, x, y);
        Integer at = index.get(k);
        if (state == STATE_ON) {
            onset++;
            if (at != null) {
                // A second callback for one note cell in one binding: the replay is not the only delivery.
                duplicates++;
                gone[at] = false;
                put(at, ch, x, y, vel, dur, gn, chc, chcOn, mute);
            } else {
                grow();
                index.put(k, notes);
                put(notes++, ch, x, y, vel, dur, gn, chc, chcOn, mute);
            }
        } else {
            if (state == STATE_SUSTAIN) sustain++; else empty++;
            if (at != null && !gone[at]) { gone[at] = true; removed++; duplicates++; }
        }
        if (seq == editAt && edit != null) {
            editSeq = seq; editNanos = now;
            try { edit.run(); } catch (RuntimeException error) { editError = String.valueOf(error.getMessage()); }
            edit = null;
        }
    }

    /** Add measured handler time. The caller measures the whole observer, including decode. */
    public void handler(long nanos) { handlerNanos += nanos; }

    private void put(int at, int ch, int x, int y, double vel, double dur, double gn, double chc, boolean chcOn, boolean mute) {
        channel[at] = (byte) ch; cell[at] = x; pitch[at] = (byte) y; velocity[at] = vel; duration[at] = dur; gain[at] = gn;
        chance[at] = chc; chanceEnabled[at] = chcOn; muted[at] = mute;
    }

    private void grow() {
        if (notes < cell.length) return;
        int size = cell.length * 2;
        channel = Arrays.copyOf(channel, size); pitch = Arrays.copyOf(pitch, size); cell = Arrays.copyOf(cell, size);
        velocity = Arrays.copyOf(velocity, size); duration = Arrays.copyOf(duration, size); gain = Arrays.copyOf(gain, size);
        chance = Arrays.copyOf(chance, size); chanceEnabled = Arrays.copyOf(chanceEnabled, size);
        muted = Arrays.copyOf(muted, size); gone = Arrays.copyOf(gone, size);
    }

    private void closeBatch(Batch batch) {
        batch.taskSeq = callbacks; batch.taskNanos = System.nanoTime(); batch.lastNanosAtTask = lastNanos;
        pending = false;
        schedule.accept(() -> { batch.confirmSeq = callbacks; batch.confirmNanos = System.nanoTime(); });
    }

    public void value(String kind, String value, long now) {
        ValueEvent event = new ValueEvent();
        event.kind = kind; event.value = value; event.seq = callbacks; event.nanos = now;
        if (values.size() >= MAX_VALUES) { droppedValues++; return; }
        values.add(event);
        schedule.accept(() -> { event.taskSeq = callbacks; event.taskNanos = System.nanoTime(); });
    }

    public int noteCount() { return notes - (int) countGone(); }
    private long countGone() { long n = 0; for (int i = 0; i < notes; i++) if (gone[i]) n++; return n; }

    private double ms(long nanos) { return nanos == 0 ? -1 : (nanos - armNanos) / 1e6; }

    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("epoch", id); result.addProperty("label", label);
        result.addProperty("complete", false); result.addProperty("eligible", false);
        result.addProperty("callbacks", callbacks); result.addProperty("onset", onset);
        result.addProperty("sustain", sustain); result.addProperty("empty", empty);
        result.addProperty("notes", noteCount()); result.addProperty("duplicates", duplicates); result.addProperty("removed", removed);
        result.addProperty("firstCallbackMs", ms(firstNanos)); result.addProperty("lastCallbackMs", ms(lastNanos));
        result.addProperty("msSinceLastCallback", lastNanos == 0 ? -1 : (System.nanoTime() - lastNanos) / 1e6);
        result.addProperty("handlerMs", handlerNanos / 1e6);
        result.addProperty("pending", pending);
        result.addProperty("droppedBatches", droppedBatches); result.addProperty("droppedValues", droppedValues);
        JsonArray rows = new JsonArray();
        for (Batch batch : batches) {
            JsonArray row = new JsonArray();
            row.add(batch.firstSeq); row.add(ms(batch.firstNanos)); row.add(batch.taskSeq); row.add(ms(batch.taskNanos));
            row.add(ms(batch.lastNanosAtTask)); row.add(batch.confirmSeq); row.add(ms(batch.confirmNanos));
            rows.add(row);
        }
        result.add("batches", rows);
        result.addProperty("batchColumns", "firstSeq,firstMs,taskSeq,taskMs,lastCallbackAtTaskMs,confirmSeq,confirmMs");
        JsonArray valueRows = new JsonArray();
        for (ValueEvent event : values) {
            JsonArray row = new JsonArray();
            row.add(event.kind); row.add(event.value); row.add(event.seq); row.add(ms(event.nanos)); row.add(event.taskSeq); row.add(ms(event.taskNanos));
            valueRows.add(row);
        }
        result.add("values", valueRows);
        result.addProperty("valueColumns", "kind,value,seq,ms,taskSeq,taskMs");
        if (editAt > 0) {
            JsonObject editStatus = new JsonObject();
            editStatus.addProperty("at", editAt); editStatus.addProperty("seq", editSeq); editStatus.addProperty("ms", ms(editNanos));
            if (editError != null) editStatus.addProperty("error", editError);
            result.add("edit", editStatus);
        }
        return result;
    }

    /** Decoded notes from {@code from}, in first-delivery order. Removed notes are skipped. */
    public JsonObject notes(int from, int limit) {
        JsonObject result = new JsonObject();
        JsonArray rows = new JsonArray();
        int at = Math.max(0, from);
        for (; at < notes && rows.size() < limit; at++) {
            if (gone[at]) continue;
            JsonArray row = new JsonArray();
            row.add(channel[at]); row.add(cell[at]); row.add(pitch[at]); row.add(velocity[at]);
            row.add(ShadowProjectCache.normalizeDurationCells(duration[at])); row.add(gain[at]); row.add(chance[at]);
            row.add(chanceEnabled[at]); row.add(muted[at]);
            rows.add(row);
        }
        result.addProperty("epoch", id);
        result.addProperty("next", at < notes ? at : -1);
        result.addProperty("columns", "channel,cell,pitch,velocity,durationCells,gain,chance,chanceEnabled,muted");
        result.add("rows", rows);
        return result;
    }
}

package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * 8h4e0 probe (E244): the DirectParameter callbacks in arrival order, with the time since the last restart.
 *
 * <p>Only the probe profile records. The observers and the handlers use the control-surface thread, so the log
 * needs no lock. The log keeps at most {@link #LIMIT} events and counts the events that it drops.
 */
public final class DirectParameterProbeLog {
    public static final int LIMIT = 20_000;

    private final Object[][] events = new Object[LIMIT][];
    private int size;
    private long dropped;
    private long started = System.nanoTime();

    /** Remove all events and start the clock again. */
    public void restart() {
        java.util.Arrays.fill(events, 0, size, null);
        size = 0;
        dropped = 0;
        started = System.nanoTime();
    }

    /** Record one event: its kind ({@code ids}, {@code name}, {@code value}, {@code display}, or {@code mark}). */
    public void add(String kind, String id, Object detail) {
        if (size == LIMIT) {
            dropped++;
            return;
        }
        long micros = (System.nanoTime() - started) / 1_000;
        events[size++] = new Object[] {micros, kind, id, detail};
    }

    /** The events as compact rows {@code [micros, kind, id, detail]}, and the counts. */
    public JsonObject toJson() {
        JsonArray rows = new JsonArray();
        for (int i = 0; i < size; i++) {
            Object[] event = events[i];
            JsonArray row = new JsonArray();
            row.add((Long) event[0]);
            row.add((String) event[1]);
            row.add((String) event[2]);
            Object detail = event[3];
            if (detail instanceof Number number) row.add(number);
            else if (detail instanceof String text) row.add(text);
            else row.add((String) null);
            rows.add(row);
        }
        JsonObject result = new JsonObject();
        result.add("events", rows);
        result.addProperty("size", size);
        result.addProperty("dropped", dropped);
        result.addProperty("elapsedMicros", (System.nanoTime() - started) / 1_000);
        return result;
    }
}

package com.ghostnote.extension;

import com.google.gson.*;

/** A fixed scalar buffer. No host object or callback closure is stored here. */
public final class GridEngineWindow {
    public static final int CAPACITY = 2048;
    private final long[] times = new long[CAPACITY];
    private final int[] kinds = new int[CAPACITY], values = new int[CAPACITY];
    public final String name, track, master, generation;
    public final long start, wallStart;
    public final boolean pulse;
    private int size;
    private long last, onAt = -1, offAt = -1;
    private boolean onAttempted, offAttempted, onObserved, offObserved, collected, cancelled;
    private int notes;
    private String failure = "";
    public GridEngineWindow(String name, String track, String master, String generation, long now, long wall, int initialNotes) {
        this.name = name; this.track = track; this.master = master; this.generation = generation;
        start = last = now; wallStart = wall; pulse = !name.startsWith("Q");
        if (initialNotes != 0) throw new IllegalStateException("engine-notes-before-window");
    }
    public synchronized void sample(int kind, int value, String identity, long now, long wall) {
        if (collected) return;
        if (!identity.equals(kind == 1 ? master : track)) fail("observer-target-changed");
        if (now < last || Math.abs((wall - wallStart) - (now - start) / 1_000_000) > 50) fail("observer-clock-or-order");
        last = now;
        if (size == CAPACITY) { fail("observer-overflow"); return; }
        if (kind < 0 || kind > 2 || value < 0 || value > 127) fail("observer-value");
        times[size] = now - start; kinds[size] = kind; values[size++] = value;
        if (kind == 0 && now - start < 250_000_000L && value > 1) fail("signal-before-note");
        if (kind == 1 && value > 1) fail("master-not-quiet");
        if (kind == 2) {
            notes = value;
            if (value != 0 && (value != 60 || !onAttempted || offAttempted || !pulse)) fail("foreign-or-late-note");
            if (value == 60 && onAttempted && !offAttempted) onObserved = true;
            if (value == 0 && offAttempted && onObserved) offObserved = true;
        }
        if (kind == 0 && now - start >= 400_000_000L && now - start <= 800_000_000L && pulse && notes != 60)
            fail("plateau-note-missing");
    }
    public synchronized void on(long now) {
        requireHealthy();
        if (!pulse || cancelled || onAttempted || now - start < 250_000_000L || now - start > 350_000_000L)
            throw new IllegalStateException("note-on-boundary");
        onAttempted = true; onAt = now - start;
    }
    public synchronized boolean needsOff() { return onAttempted && !offAttempted; }
    public synchronized void off(long now) {
        if (!needsOff()) return;
        offAttempted = true; offAt = now - start;
        if (offAt < 850_000_000L || offAt > 1000_000_000L) fail("note-off-boundary");
    }
    public synchronized void abort(String why) { cancelled = true; fail(why); }
    public synchronized void fail(String why) { if (failure.isEmpty()) failure = why; }
    public synchronized void requireHealthy() { if (!failure.isEmpty()) throw new IllegalStateException(failure); }
    public synchronized JsonObject collect(long now, long wall, long[] packetBegin, long[] packetEnd) {
        if (collected) throw new IllegalStateException("window-already-collected"); collected = true;
        long elapsed = now - start;
        if (elapsed < 1_250_000_000L || elapsed > 2_000_000_000L
                || Math.abs((wall - wallStart) - elapsed / 1_000_000) > 50) fail("window-time");
        for (int i = 0; i < 2; i++) if (packetEnd[i] <= packetBegin[i]
                || packetEnd[i] <= wallStart + (pulse ? Math.max(250, onAt / 1_000_000) : 0)
                || packetEnd[i] > wall) fail("meter-packet-stale-or-clock");
        if (pulse && (!onAttempted || !offAttempted || !onObserved || !offObserved || notes != 0)) fail("note-lifecycle-unavailable");
        int peak = -1, masterCount = 0, end = -1; boolean rise = false;
        for (int i = 0; i < size; i++) {
            if (kinds[i] == 1) masterCount++;
            if (kinds[i] != 0) continue;
            if (times[i] >= 400_000_000L && times[i] <= 800_000_000L) peak = Math.max(peak, values[i]);
            if (times[i] >= 250_000_000L && times[i] <= 800_000_000L && values[i] > 1) rise = true;
            if (times[i] >= 850_000_000L) end = values[i];
            if (!pulse && values[i] > 1) fail("quiet-window-not-quiet");
        }
        if (peak < 0 || masterCount == 0 || end < 0 || end > 1 || (peak > 1 && !rise)) fail("meter-plateau-or-release-unavailable");
        JsonObject r = report(); r.addProperty("peak", peak); r.addProperty("elapsedNanos", elapsed);
        JsonArray samples = new JsonArray();
        for (int i = 0; i < size; i++) { JsonArray row = new JsonArray(); row.add(i); row.add(times[i]); row.add(kinds[i]); row.add(values[i]); samples.add(row); }
        r.add("samples", samples); JsonArray packets = new JsonArray();
        for (int i = 0; i < 2; i++) { JsonArray pair = new JsonArray(); pair.add(packetBegin[i]); pair.add(packetEnd[i]); packets.add(pair); } r.add("packets", packets);
        if (r.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 128 * 1024) fail("window-result-limit");
        r.addProperty("failure", failure); r.addProperty("available", failure.isEmpty()); return r;
    }
    public synchronized JsonObject report() {
        JsonObject r = new JsonObject(); r.addProperty("name", name); r.addProperty("trackId", track); r.addProperty("masterId", master);
        r.addProperty("generation", generation); r.addProperty("samplesCount", size); r.addProperty("failure", failure);
        r.addProperty("noteOnAttempted", onAttempted); r.addProperty("noteOffAttempted", offAttempted);
        r.addProperty("noteOnObserved", onObserved); r.addProperty("noteOffObserved", offObserved);
        r.addProperty("onNanos", onAt); r.addProperty("offNanos", offAt); return r;
    }
}

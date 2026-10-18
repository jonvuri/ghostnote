package com.ghostnote.extension;

import com.google.gson.JsonObject;

/** One engine run per initialization. A failure never permits an inverse edit. */
public final class GridEngineProtocol {
    private static final String[] ORDER = {"Q0", "B+", "stage1", "B0", "stage2", "B-return", "stage3",
        "stage4", "stage5", "N+", "stage6", "N0", "stage7", "N-half", "stage8", "N-return",
        "stage9", "stage10", "stage11", "R+", "Q1"};
    private boolean used, active, locked, factory, recovery;
    private int next;
    private long start;
    private String failure = "";
    private int baseline = -1, unity = -1, half = -1;
    public synchronized boolean used() { return used; }
    public synchronized boolean locked() { return locked; }
    public synchronized boolean complete() { return active && !locked && next == ORDER.length; }
    public synchronized void begin(long now) {
        if (used) throw new IllegalStateException("engine-session-already-used");
        used = active = true; start = now;
    }
    public synchronized void require(String action, long now) {
        if (!active || locked || now < start || now - start > 60_000_000_000L
                || next >= ORDER.length || !ORDER[next].equals(action))
            throw new IllegalStateException("engine-order-deadline-or-lock:" + action);
    }
    public synchronized void advance(String action, long now) { require(action, now); next++; }
    public synchronized void factory(long now) {
        require("stage3", now); if (factory) throw new IllegalStateException("engine-factory-already-used"); factory = true;
    }
    public synchronized void signal(String name, int peak, long now) {
        require(name, now);
        switch (name) {
            case "Q0", "Q1", "B0", "N0" -> { if (peak > 1) throw new IllegalStateException("engine-not-quiet"); }
            case "B+" -> { if (peak < 32 || peak > 110) throw new IllegalStateException("engine-baseline-range"); baseline = peak; }
            case "B-return", "N+", "N-return", "R+" -> {
                if (Math.abs(peak - baseline) > 3) throw new IllegalStateException("engine-unity-mismatch");
                if (name.equals("N+")) unity = peak;
                if (name.equals("N-return")) {
                    if (Math.abs(peak - unity) > 3) throw new IllegalStateException("engine-unity-bracket-mismatch");
                    requireHalf(half, unity, peak);
                }
            }
            case "N-half" -> { half = peak; requireHalf(half, unity, unity); }
            default -> throw new IllegalStateException("engine-unknown-window");
        }
        next++;
    }
    public static void requireHalf(int half, int before, int after) {
        if (half < 0 || before <= 0 || after <= 0 || half >= Math.min(before, after))
            throw new IllegalStateException("engine-half-range");
        double low = Math.pow(half / (double)(Math.max(before, after) + 1), 1 / .3333);
        double high = Math.pow((half + 1) / (double)Math.min(before, after), 1 / .3333);
        if (low < .40 || high > .60) throw new IllegalStateException("engine-half-ratio:" + low + ":" + high);
    }
    public synchronized void fail(String reason) { locked = true; if (failure.isEmpty()) failure = reason.substring(0, Math.min(512, reason.length())); }
    public synchronized void recovery(boolean nativeUnfinished) {
        if (!locked || recovery || nativeUnfinished) throw new IllegalStateException("engine-recovery-not-admitted"); recovery = true;
    }
    public synchronized void release() { active = false; }
    public synchronized JsonObject status() {
        JsonObject r = new JsonObject(); r.addProperty("used", used); r.addProperty("active", active);
        r.addProperty("locked", locked); r.addProperty("factoryAttempted", factory); r.addProperty("recoveryUsed", recovery);
        r.addProperty("next", next == ORDER.length ? "complete" : ORDER[next]); r.addProperty("failure", failure); return r;
    }
}

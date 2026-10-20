package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

/** One operator audio run per initialization. Answers never replace graph reads. */
public final class GridEngineProtocol {
    public static final long SESSION_NANOS = 900_000_000_000L, SEGMENT_NANOS = 60_000_000_000L;
    private static final String[] ORDER = {"B+", "stage1", "B0", "stage2", "B-return", "stage3",
        "stage4", "stage5", "N+", "stage6", "N0", "stage7", "N-half", "stage8", "N-return",
        "stage9", "stage10", "stage11", "R+"};
    private final String session = UUID.randomUUID().toString();
    private final JsonArray answers = new JsonArray();
    private boolean used, active, locked, factory, recovery;
    private int next, completedStage;
    private long start, segmentStart, pendingWall;
    private JsonObject frozen;
    public synchronized boolean used() { return used; }
    public synchronized boolean active() { return active; }
    public synchronized boolean locked() { return locked; }
    public synchronized boolean complete() { return active && !locked && next == ORDER.length; }
    public synchronized boolean running() { return active && !locked && next < ORDER.length; }
    public synchronized String session() { return session; }
    public synchronized void begin(long now, long wall) {
        if (used || locked) throw new IllegalStateException("engine-session-already-used");
        used = active = true; start = segmentStart = now; pendingWall = wall;
    }
    public synchronized void requireSession(String actual) {
        if (!session.equals(actual)) throw new IllegalStateException("engine-session-mismatch");
    }
    public synchronized void require(String action, long now) {
        if (!running() || now < start || now - start > SESSION_NANOS
                || next >= ORDER.length || !ORDER[next].equals(action)
                || action.startsWith("stage") && (now < segmentStart || now - segmentStart > SEGMENT_NANOS))
            throw new IllegalStateException("engine-order-deadline-or-lock:" + action);
    }
    public synchronized void advance(String action, long now, long wall) {
        require(action, now);
        if (!action.startsWith("stage")) throw new IllegalStateException("engine-answer-required");
        completedStage = Integer.parseInt(action.substring(5)); next++; pendingWall = wall;
    }
    public synchronized void factory(long now) {
        require("stage3", now); if (factory) throw new IllegalStateException("engine-factory-already-used"); factory = true;
    }
    public synchronized boolean acknowledge(String actualSession, String name, String verdict, String answer,
            long promptedAt, long answeredAt, long now, long wall) {
        requireSession(actualSession); require(name, now);
        if (name.startsWith("stage") || !Set.of("yes", "no", "unsure").contains(verdict)
                || answer == null || answer.isBlank() || answer.getBytes(StandardCharsets.UTF_8).length > 128
                || promptedAt < pendingWall || answeredAt < promptedAt || answeredAt > wall || answers.size() >= 8)
            throw new IllegalArgumentException("engine-operator-answer-invalid");
        JsonObject row = new JsonObject(); row.addProperty("check", answers.size() + 1);
        row.addProperty("name", name); row.addProperty("completedStage", completedStage);
        row.addProperty("promptedAt", promptedAt); row.addProperty("answeredAt", answeredAt);
        row.addProperty("receivedAt", wall); row.addProperty("verdict", verdict); row.addProperty("answer", answer);
        answers.add(row);
        if (!verdict.equals("yes")) return false;
        next++; segmentStart = now; return true;
    }
    public synchronized void fail(String reason, JsonObject context, long now, long wall) {
        if (locked) return;
        locked = true;
        frozen = evidence();
        // ASCII bounds preserve the first error without an unbounded exception string.
        String bounded = reason.replaceAll("[^ -~]", "?");
        frozen.addProperty("reason", bounded.substring(0, Math.min(512, bounded.length())));
        frozen.addProperty("failureNanos", now); frozen.addProperty("failureWall", wall);
        JsonObject boundedContext = context.deepCopy();
        if (encoded(boundedContext) > 3072) {
            boundedContext = new JsonObject(); boundedContext.addProperty("error", "failure-context-exceeds-3072-bytes");
        }
        frozen.add("atFailure", boundedContext);
        if (encoded(frozen) > 16 * 1024) throw new IllegalStateException("engine-evidence-cap");
    }
    public synchronized void recovery(boolean nativeUnfinished) {
        if (!locked || recovery || nativeUnfinished) throw new IllegalStateException("engine-recovery-not-admitted"); recovery = true;
    }
    public synchronized void release() { active = false; }
    private JsonObject evidence() {
        JsonObject r = new JsonObject(); r.addProperty("session", session);
        r.addProperty("completedStage", completedStage); r.addProperty("next", next == ORDER.length ? "complete" : ORDER[next]);
        r.addProperty("factoryAttempted", factory); r.add("answers", answers.deepCopy()); return r;
    }
    public synchronized JsonObject status() {
        JsonObject r = evidence(); r.addProperty("used", used); r.addProperty("active", active);
        r.addProperty("locked", locked); r.addProperty("recoveryUsed", recovery);
        r.add("firstFailure", frozen == null ? JsonNull.INSTANCE : frozen.deepCopy()); return r;
    }
    public static int encoded(JsonElement value) { return value.toString().getBytes(StandardCharsets.UTF_8).length; }
    public static boolean muteMatches(boolean muted, boolean active) { return muted != active; }
}

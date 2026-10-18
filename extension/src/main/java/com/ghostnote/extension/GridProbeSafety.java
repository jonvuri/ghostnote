package com.ghostnote.extension;

import com.google.gson.*;

/** Controller-session limits. Only JSON and epoch strings are retained. */
public final class GridProbeSafety {
    private boolean locked, recoveryUsed, recovering;
    private int attempts, recoveryReads, afterReads;
    private String factoryEpoch, operationId;
    public synchronized void operation(String id) { operationId = id; terminal = new JsonObject(); }
    public synchronized void error(Throwable error) { terminal.addProperty("requestError", GridModuleAttachment.errorText(error)); }
    private final java.util.Set<String> created = new java.util.HashSet<>();
    public synchronized java.util.List<String> excluded(java.util.List<String> live) {
        var all = new java.util.HashSet<>(live); all.addAll(created); return java.util.List.copyOf(all);
    }
    public synchronized void remember(JsonObject graph) {
        created.add(GridFixtureValue.scalar(GridFixtureValue.node(graph, graph.get("root").getAsInt()), 15).getAsString());
    }
    public synchronized void diagnostics(JsonObject value) { terminal.add("diagnostics", value.deepCopy()); }
    private JsonArray expected;
    private JsonObject witness;
    private JsonObject terminal = new JsonObject();
    public synchronized boolean locked() { return locked; }
    public synchronized boolean pendingReadback() { return expected != null; }
    public synchronized boolean recovering() { return recovering; }
    public synchronized void lock() { locked = true; }
    public synchronized void requireAttempt(String epoch) {
        if (locked || attempts >= 2 || epoch.equals(factoryEpoch)) throw new IllegalStateException("factory-attempt-limit-or-locked");
    }
    public synchronized void attempt(String epoch) {
        requireAttempt(epoch);
        factoryEpoch = epoch; attempts++;
    }
    public synchronized void progress(JsonObject report) { terminal = report.deepCopy(); }
    public synchronized void expect(JsonArray nodes, JsonObject value) {
        expected = nodes.deepCopy(); witness = value.deepCopy(); afterReads = 0;
    }
    public synchronized void readback(JsonObject graph, JsonObject value) {
        if (expected == null) return;
        try {
            if (afterReads >= 2) throw new IllegalStateException("attachment-readback-limit");
            GridAttachmentGraph.requireRead(graph, value, expected, witness); afterReads++;
        } catch (RuntimeException error) { locked = true; throw error; }
    }
    public synchronized void release(boolean failed) {
        if (failed || expected != null && afterReads != 2) locked = true;
        expected = null; witness = null; recovering = false;
    }
    public synchronized void recoveryBind(boolean unfinished) {
        if (!locked || unfinished || recoveryUsed) throw new IllegalStateException("grid-recovery-unavailable");
        recoveryUsed = true; recovering = true; recoveryReads = 0;
    }
    public synchronized void recoveryRead() {
        if (!locked || !recovering || recoveryReads >= 2) throw new IllegalStateException("grid-recovery-read-limit");
        recoveryReads++;
    }
    public synchronized JsonObject status(boolean unfinished) {
        JsonObject result = new JsonObject(); result.addProperty("writeLocked", locked);
        result.addProperty("nativeUnfinished", unfinished); result.addProperty("operationId", operationId); result.addProperty("factoryAttempts", attempts);
        result.addProperty("recoveryUsed", recoveryUsed); result.addProperty("recoveryReads", recoveryReads);
        result.addProperty("afterReads", afterReads); result.add("lifecycle", terminal.deepCopy()); return result;
    }
}

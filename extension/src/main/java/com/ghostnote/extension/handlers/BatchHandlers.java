package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * The batch executor and the optimistic-concurrency revision guard (E8).
 *
 * Phase-1-quality infrastructure, not a throwaway probe: batching 240 note
 * writes into one request measured 232x faster wall-clock than 240 separate
 * RPCs (25ms vs 5804ms), because the Bridge marshals every request onto the
 * one control-surface thread and N requests therefore pay N scheduling turns.
 *
 * Ops are dispatched back through the registry, so this group holds the root
 * dispatcher. That is not a cycle: registration happens at construction time,
 * dispatch at request time.
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class BatchHandlers extends HandlerGroup {
    private final HandlerRegistry registry;

    public BatchHandlers(ControllerHost host, Rig rig, ExecState state, HandlerRegistry registry) {
        super(host, rig, state);
        this.registry = registry;
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("batch.run", params -> batchRun(params));
        r.on("revision.get", params -> revisionGet());
        r.on("revision.bump", params -> revisionBump());
    }

    // ------------------------------------------ E8: batch executor + revision

    /**
     * Execute a list of ops carried in ONE request.
     *
     * The Bridge already marshals each RPC onto the control-surface thread, so
     * N separate requests pay N scheduling turns (the ~24ms control-surface
     * tick floor each, E5). A batch carries N ops in one request → one task →
     * one turn, dispatching each op through the same handler table. That is the
     * throughput lever for the FAST op classes (note / param writes): they all
     * land in a single turn and become verifiable one turn later (the E2
     * two-turn write rule applies once to the whole batch, not per op).
     *
     * It does NOT help ops that settle across turns — a device insert (~600ms,
     * E3), a track create (~144ms) — and an op that depends on such a settle
     * (write into a device that was inserted earlier in the same batch) would
     * run before the device exists. Those need STAGED pacing: pass `delayMs`
     * and the ops are handed to the scheduler one settle-budget apart, the
     * response returning immediately; completion is confirmed by the caller via
     * readback (the standing verify-by-readback rule).
     *
     * Optimistic concurrency: if `ifRevision` is present and does not match the
     * current revision, the batch is REJECTED whole (nothing is applied) — the
     * stale-write guard. Acceptance claims the next revision immediately, so a
     * second batch submitted against the old revision is rejected even while a
     * paced batch is still draining.
     *
     * NOTE (revert): this executor does not itself snapshot/replay for revert —
     * that is E3's snapshot-replay primitive, which composes on top. A Phase-1
     * executor snapshots the write-set before applying and replays on failure;
     * here per-op failures are recorded and the batch continues, so the probe
     * can see the whole picture.
     */
    private JsonElement batchRun(JsonObject params) {
        JsonArray ops = params.getAsJsonArray("ops");
        int delayMs = params.has("delayMs") ? params.get("delayMs").getAsInt() : 0;

        JsonObject result = new JsonObject();

        // --- revision guard (optimistic concurrency) ---
        if (params.has("ifRevision")) {
            long expected = params.get("ifRevision").getAsLong();
            if (expected != state.revision) {
                result.addProperty("applied", false);
                result.addProperty("rejected", true);
                result.addProperty("reason", "stale-revision");
                result.addProperty("expected", expected);
                result.addProperty("actual", state.revision);
                return result;
            }
        }
        long batchRevision = ++state.revision;

        if (delayMs > 0) {
            // Staged pacing for ops that settle across turns.
            scheduleOps(ops, 0, delayMs);
            result.addProperty("applied", true);
            result.addProperty("paced", true);
            result.addProperty("scheduled", ops.size());
            result.addProperty("delayMs", delayMs);
            result.addProperty("revision", batchRevision);
            return result;
        }

        // Synchronous fast path: every op in this one task/turn.
        long start = System.nanoTime();
        JsonArray results = new JsonArray();
        int failures = 0;
        for (JsonElement el : ops) {
            JsonObject r = runOp(el.getAsJsonObject());
            if (!r.get("ok").getAsBoolean()) {
                failures++;
            }
            results.add(r);
        }
        result.addProperty("applied", true);
        result.addProperty("paced", false);
        result.addProperty("count", ops.size());
        result.addProperty("failures", failures);
        result.addProperty("elapsedMicros", (System.nanoTime() - start) / 1000);
        result.addProperty("revision", batchRevision);
        if (params.has("verbose") && params.get("verbose").getAsBoolean()) {
            result.add("results", results);
        }
        return result;
    }

    /** Dispatch one op through the handler table; never throws (per-op result). */
    private JsonObject runOp(JsonObject op) {
        String m = op.get("method").getAsString();
        JsonObject p = op.has("params") ? op.getAsJsonObject("params") : new JsonObject();
        JsonObject r = new JsonObject();
        r.addProperty("method", m);
        try {
            if (m.startsWith("batch.")) {
                throw new IllegalArgumentException("nested batch not allowed");
            }
            registry.dispatch(m, p);
            r.addProperty("ok", true);
        } catch (Exception e) {
            r.addProperty("ok", false);
            r.addProperty("error", String.valueOf(e.getMessage()));
        }
        return r;
    }

    /** Run op[index] now, then re-schedule op[index+1] delayMs later (staged). */
    private void scheduleOps(JsonArray ops, int index, int delayMs) {
        if (index >= ops.size()) {
            return;
        }
        runOp(ops.get(index).getAsJsonObject());
        host.scheduleTask(() -> scheduleOps(ops, index + 1, delayMs), delayMs);
    }

    private JsonElement revisionGet() {
        JsonObject r = new JsonObject();
        r.addProperty("revision", state.revision);
        return r;
    }

    /** Simulate an interfering edit that invalidates in-flight optimistic writes. */
    private JsonElement revisionBump() {
        JsonObject r = new JsonObject();
        r.addProperty("revision", ++state.revision);
        return r;
    }
}

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
            JsonElement opResult = registry.dispatch(m, p);
            r.addProperty("ok", true);
            // E61 needs the target-bound generation from the write turn. Keep
            // every other handler result out of the established batch reply.
            if ("directparam.set".equals(m) && opResult != null && !opResult.isJsonNull()) {
                r.add("result", opResult);
            }
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

    /**
     * ⚠ THE MARK — where in the world a snapshot was taken, in one round trip.
     *
     * It used to carry `revision` alone and the brain kept its own scene epoch, a
     * counter that could only see OUR OWN scene ops and therefore could not see
     * the user at all (`adapters/live/adapter.ts`, and the ⚠ on `address.ts`).
     * D4 rev re-homed that job here: the extension is alive whenever Bitwig is, so
     * an observer here cannot miss an edit made while no client was attached,
     * which a daemon started later provably can.
     *
     * Three counters, three different questions, deliberately not merged:
     *
     *   revision      E8's optimistic-concurrency counter — ORDERING. Whose write
     *                 went first. Bumped by us, never by the human.
     *   sceneEpoch    scene create/delete, by ANYONE. Rows below a deletion
     *                 compact upward (E3) and a held `sceneIndex` goes
     *                 permanently stale while looking healthy.
     *   contentEpoch  launcher slots filling and emptying, by anyone. Catches
     *                 what the scene count structurally cannot: a MOVE changes no
     *                 count, and E16s measured the count observer sitting still at
     *                 3 → 3 through a human clip drag that the content observer
     *                 reported as a pair. That is why clip addressing consults
     *                 this one.
     *
     * ⚠ The events ride along rather than living behind a second call, and the
     * reason is a race, not convenience: the log is a ring of
     * {@link Rig#CONTENT_LOG}, so a reader that learns the epoch here and fetches
     * the names afterwards can have the names it needed pushed out in between —
     * and would read the resulting short window as a quiet one. Delivered together
     * they are one observation. The cost is ≤24 small objects on a local socket.
     *
     * ⚠ Absolute values mean NOTHING (§3.2.3): Bitwig delivers initial values
     * through the same callbacks, so both epochs are already nonzero at rest and
     * only a difference across a known event carries information. `generation`
     * is what stops that difference being computed across two lives of the
     * extension, where the counters restart lower than the mark being compared.
     */
    private JsonElement revisionGet() {
        JsonObject r = new JsonObject();
        r.addProperty("revision", state.revision);
        r.addProperty("generation", rig.epochGeneration);
        // ⚠ Which PROJECT the counters below are counting. A project load does
        // not re-init() the extension, so `generation` cannot see it — and the
        // epochs stay superficially comparable, which is the dangerous shape.
        // ⚠ Guarded: an unobtained handle must read as absent rather than throw
        // from the one call every batch makes. `projectStatus` says which.
        String project = "";
        try {
            if (rig.projectName != null) project = rig.projectName.get();
        } catch (Throwable ignored) {
            // Left empty — the brain treats an unnameable project as unknown.
        }
        r.addProperty("project", project == null ? "" : project);
        r.addProperty("projectStatus", rig.projectStatus);
        r.addProperty("sceneEpoch", rig.sceneCountChanges);
        r.addProperty("sceneCount", rig.lastSceneCount);
        r.addProperty("contentEpoch", rig.launcherContentEpoch);

        // Oldest-first, each event carrying the epoch it produced, so the reader
        // slices `(since, now]` itself and can tell a dropped event from no event.
        JsonArray events = new JsonArray();
        int size = Math.min(rig.launcherContentEpoch, Rig.CONTENT_LOG);
        for (int k = 0; k < size; k++) {
            int idx = (rig.launcherContentEpoch - size + k) % Rig.CONTENT_LOG;
            Rig.ContentEvent event = rig.contentLog[idx];
            if (event == null) continue;
            JsonObject e = new JsonObject();
            e.addProperty("seq", event.seq);
            e.addProperty("channelId", event.channelId);
            e.addProperty("trackIndex", event.trackIndex);
            e.addProperty("slotIndex", event.slotIndex);
            e.addProperty("filled", event.filled);
            events.add(e);
        }
        r.add("contentEvents", events);
        return r;
    }

    /** Simulate an interfering edit that invalidates in-flight optimistic writes. */
    private JsonElement revisionBump() {
        JsonObject r = new JsonObject();
        r.addProperty("revision", ++state.revision);
        return r;
    }
}

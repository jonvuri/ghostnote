package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.*;
import com.google.gson.*;
import java.util.*;
import java.util.function.BooleanSupplier;

/** Private 9b.3 writer. Commands use methods classified as WRITE by RuntimeProfile. */
public final class GridBreadthHandlers extends HandlerGroup {
    public static String marker() { return GridDoctorHandlers.marker(); }
    public static final Set<String> READS = Set.of("breadthStatus", "breadthBind", "breadthRead",
        "breadthInspect", "breadthRelease");
    private final BooleanSupplier foreignOwner;
    private GridSurveySession.Target target;
    private GridReadSymbols symbols;
    private GridReadEpoch epoch;
    private GridReadJob.State job;
    private GridBreadthProtocol protocol;
    private GridBreadthHost nativeHost;
    private Bridge.Reply client;
    private boolean busy, timeoutLocked;
    private String nonce, kind;
    private long selectionRevision;
    public GridBreadthHandlers(ControllerHost host, Rig rig, ExecState state, BooleanSupplier foreignOwner) {
        super(host, rig, state); this.foreignOwner = foreignOwner;
    }
    @Override public void register(HandlerRegistry registry) {}
    private boolean unfinished() { return job != null && job.unfinished(); }
    public boolean ownsGrid() { return target != null || busy || timeoutLocked || unfinished(); }
    private void fail(String reason) { if (protocol != null) protocol.fail(reason); }
    public JsonObject status() {
        JsonObject result = protocol == null ? new JsonObject() : protocol.status();
        result.addProperty("bound", epoch != null); result.addProperty("busy", busy);
        result.addProperty("timeoutLocked", timeoutLocked); result.addProperty("nativeUnfinished", unfinished());
        result.addProperty("marker", marker()); result.addProperty("foreignOwner", foreignOwner.getAsBoolean());
        if (nonce != null) result.addProperty("session", nonce);
        return result;
    }
    private void guard(boolean inspection) {
        if (target == null || !target.project().equals(rig.currentProjectName())
                || !rig.cursorTracks[0].exists().get()
                || !target.trackId().equals(rig.cursorTracks[0].channelId().get())
                || !target.trackName().equals(rig.cursorTracks[0].name().get()))
            throw new IllegalStateException("breadth-project-or-track-changed");
        var device = rig.cursorDeviceBanks[0].getDevice(target.deviceIndex());
        if (!device.exists().get() || !target.deviceName().equals(device.name().get()))
            throw new IllegalStateException("breadth-device-route-changed");
        if (!inspection && (client == null || !client.clientConnected()
                || rig.selectionRevision != selectionRevision || !rig.cursorTracks[0].mute().get()
                || rig.transport.isPlaying().get()))
            throw new IllegalStateException("breadth-client-selection-mute-or-transport-changed");
    }
    private void clear() {
        target = null; epoch = null; protocol = null; nativeHost = null; client = null; nonce = null; kind = null;
    }
    public void request(JsonObject p, Bridge.Reply reply, String writeCase) throws Exception {
        String op = GridSurveySession.text(p, "operation");
        boolean command = op.equals("breadthCommand"), bind = op.equals("breadthBind");
        boolean inspect = op.equals("breadthInspect");
        if (command != (writeCase != null) || !command && !READS.contains(op))
            throw new IllegalArgumentException("breadth-method-operation");
        if (op.equals("breadthStatus")) { reply.result(status(), 0); return; }
        if (busy || unfinished() || foreignOwner.getAsBoolean())
            throw new IllegalStateException("breadth-native-or-foreign-task-busy");
        if (timeoutLocked && !inspect) throw new IllegalStateException("breadth-timeout-locked; inspect only");
        if (bind) {
            if (target != null) throw new IllegalStateException("breadth-already-bound");
            String nextCase = GridSurveySession.text(p, "case");
            if (!GridBreadthProtocol.CASES.contains(nextCase)) throw new IllegalArgumentException("breadth-case");
            var next = GridSurveySession.Target.parse(p, rig.config.deviceBank);
            if (!next.trackName().matches("gn-9b-write-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
                    || !next.deviceName().equals("Poly Grid"))
                throw new IllegalArgumentException("breadth-owned-poly-grid-required");
            JsonElement selected = p.get("selectionRevision");
            if (selected == null || !selected.isJsonPrimitive() || !selected.getAsJsonPrimitive().isNumber())
                throw new IllegalArgumentException("breadth-selection-revision-required");
            long revision = selected.getAsBigDecimal().longValueExact();
            if (revision != rig.selectionRevision) throw new IllegalStateException("breadth-selection-changed-before-bind");
            target = next; kind = nextCase; selectionRevision = revision;
            client = reply; nonce = UUID.randomUUID().toString(); protocol = new GridBreadthProtocol(kind);
            try { guard(false); } catch (Exception error) { clear(); throw error; }
            String session = nonce;
            reply.onClientDisconnect(() -> { if (session.equals(nonce)) fail("client-disconnected"); });
            host.scheduleTask(() -> { if (session.equals(nonce)) fail("session-expired"); }, 900_000);
        } else {
            if (protocol == null || !Objects.equals(nonce, GridSurveySession.text(p, "session")))
                throw new IllegalStateException("breadth-stale-session");
            if (command && !kind.equals(writeCase)) throw new IllegalArgumentException("breadth-wrong-write-method");
            if (op.equals("breadthRelease")) {
                boolean cancel = p.has("cancel") && strictBoolean(p.get("cancel"));
                protocol.release(cancel); clear(); reply.result(ok(), 0); return;
            }
            if (inspect) protocol.inspect();
            else if (command) {
                if (!protocol.action().equals(GridSurveySession.text(p, "action")))
                    throw new IllegalArgumentException("breadth-command-order");
            } else protocol.requireRead();
            try { guard(inspect); }
            catch (Exception error) { fail(error.toString()); throw error; }
        }
        if (symbols == null) {
            try { symbols = new GridReadSymbols(host.getClass()); }
            catch (Exception error) { if (bind) clear(); throw error; }
        }
        Object proxy = rig.cursorDeviceBanks[0].getDevice(target.deviceIndex());
        GridSurveySession.Target boundTarget = target;
        String session = nonce;
        long queued = System.nanoTime();
        busy = true; GridReadJob.State task = new GridReadJob.State(); job = task;
        GridReadJob.start(work -> GridReadSymbols.queue(proxy, work), host::scheduleTask, () -> {
            long entered = System.nanoTime();
            GridReadSymbols.requireDocumentThread(proxy); guard(inspect);
            Object document = GridReadSymbols.document(proxy), track = GridReadSymbols.target(rig.cursorTracks[0]);
            Object device = GridReadSymbols.target(proxy);
            GridReadEpoch proof = bind ? new GridReadEpoch(document, track, device) : epoch;
            proof.require(proof.token, document, track, device);
            GridBreadthRead route = new GridBreadthRead(symbols);
            Object grid = route.grid(device);
            if (bind) nativeHost = new GridBreadthHost(symbols, grid, document, kind);
            nativeHost.requireTarget(grid, document);
            JsonObject result = new JsonObject();
            result.addProperty("marker", marker()); result.addProperty("session", session);
            result.addProperty("queueNanos", entered - queued); result.addProperty("heapUsedBefore", heap());
            if (command) result.add("receipt", protocol.command(GridSurveySession.text(p, "action"), nativeHost, () -> {
                if (task.cancelled() || System.nanoTime() - queued > 4_000_000_000L)
                    throw new IllegalStateException("breadth-precall-deadline");
                guard(false);
                proof.require(proof.token, GridReadSymbols.document(proxy), GridReadSymbols.target(rig.cursorTracks[0]),
                    GridReadSymbols.target(proxy));
                nativeHost.requireTarget(new GridBreadthRead(symbols).grid(GridReadSymbols.target(proxy)),
                    GridReadSymbols.document(proxy));
            }));
            else if (!bind) result.add("snapshot", inspect ? nativeHost.inspect() : protocol.read(nativeHost));
            proof.require(proof.token, GridReadSymbols.document(proxy), GridReadSymbols.target(rig.cursorTracks[0]),
                GridReadSymbols.target(proxy));
            result.add("metrics", nativeHost.metrics()); result.addProperty("routeWork", route.work());
            result.addProperty("heapUsedAfter", heap()); result.addProperty("documentTaskNanos", System.nanoTime() - entered);
            GridBreadthRead.bounded(result);
            return new Outcome(result, proof);
        }, outcome -> {
            busy = false;
            try {
                if (!boundTarget.equals(target) || !session.equals(nonce)) throw new IllegalStateException("breadth-completion-session");
                guard(inspect); epoch = outcome.proof;
                outcome.result.add("status", protocol.status());
                outcome.result.addProperty("completionNanos", System.nanoTime() - queued);
                reply.result(outcome.result, 0);
            } catch (Exception error) { fail(error.toString()); reply.error(error, 0); }
        }, error -> {
            busy = false;
            if (bind && !timeoutLocked) clear(); else fail(error.toString());
            reply.error(error, 0);
        }, () -> {
            busy = false; timeoutLocked = true; fail("native-timeout; no retry");
            reply.error(new IllegalStateException("breadth-timeout; native work may continue; inspect after completion; no retry"), 0);
        }, task);
    }
    private static boolean strictBoolean(JsonElement value) {
        if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isBoolean())
            throw new IllegalArgumentException("breadth-boolean-required");
        return value.getAsBoolean();
    }
    private record Outcome(JsonObject result, GridReadEpoch proof) {}
    private static long heap() {
        Runtime runtime = Runtime.getRuntime(); return runtime.totalMemory() - runtime.freeMemory();
    }
}

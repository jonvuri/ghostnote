package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.*;
import com.google.gson.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.function.BooleanSupplier;

/** Read-only descriptor sessions for explicitly named native devices. */
public final class GridSurveyHandlers extends HandlerGroup {
    public static String marker() { return GridBreadthHandlers.marker(); }
    public static final Set<String> OPERATIONS = Set.of("status", "bind", "schema", "read", "release");
    private final GridSurveySession session = new GridSurveySession();
    private final BooleanSupplier foreignOwner;
    private GridReadSymbols symbols;
    private GridReadJob.State job;

    public GridSurveyHandlers(ControllerHost host, Rig rig, ExecState state, BooleanSupplier foreignOwner) {
        super(host, rig, state); this.foreignOwner = foreignOwner;
    }
    @Override public void register(HandlerRegistry registry) {}
    private boolean unfinished() { return job != null && job.unfinished(); }
    public boolean ownsGrid() { return session.ownsGrid() || unfinished(); }

    private void guard(GridSurveySession.Target t) {
        if (!t.project().equals(rig.currentProjectName()) || !rig.cursorTracks[0].exists().get()
                || !t.trackId().equals(rig.cursorTracks[0].channelId().get())
                || !t.trackName().equals(rig.cursorTracks[0].name().get()))
            throw new IllegalStateException("survey-project-or-track-changed");
        var device = rig.cursorDeviceBanks[0].getDevice(t.deviceIndex());
        if (!device.exists().get() || !t.deviceName().equals(device.name().get()))
            throw new IllegalStateException("survey-device-route-changed");
    }
    public void request(JsonObject p, Bridge.Reply reply) throws Exception {
        String op = GridSurveySession.text(p, "operation");
        if (!OPERATIONS.contains(op)) throw new IllegalArgumentException("unknown-survey-operation");
        if (op.equals("status")) {
            JsonObject r = session.status(unfinished());
            r.addProperty("marker", marker()); r.addProperty("foreignOwner", foreignOwner.getAsBoolean());
            reply.result(r, 0); return;
        }
        session.idle(foreignOwner.getAsBoolean(), unfinished());
        if (op.equals("release")) {
            session.release(GridSurveySession.text(p, "epoch")); reply.result(ok(), 0); return;
        }
        var target = GridSurveySession.Target.parse(p, rig.config.deviceBank);
        var query = GridReadExplore.Query.parse(p);
        var headers = GridReadExplore.Headers.parse(p);
        if (headers != null && !op.equals("schema"))
            throw new IllegalArgumentException("schema-headers-only-for-schema");
        boolean bind = op.equals("bind");
        if (bind && (!query.path().isEmpty() || !query.projection().isEmpty()))
            throw new IllegalArgumentException("bind-has-no-query");
        if (op.equals("schema") && !query.projection().isEmpty())
            throw new IllegalArgumentException("schema-has-no-projection");
        if (op.equals("read") && query.projection().isEmpty())
            throw new IllegalArgumentException("survey-read-needs-projection");
        guard(target);
        GridReadEpoch prior = bind ? null : session.require(target, GridSurveySession.text(p, "epoch"));
        if (symbols == null) symbols = new GridReadSymbols(host.getClass());
        Object proxy = rig.cursorDeviceBanks[0].getDevice(target.deviceIndex());
        if (bind) session.beginBind(); else session.beginCapture();
        long queued = System.nanoTime();
        job = new GridReadJob.State();
        GridReadJob.start(task -> GridReadSymbols.queue(proxy, task), host::scheduleTask, () -> {
            long entered = System.nanoTime();
            GridReadSymbols.requireDocumentThread(proxy); guard(target);
            Object document = GridReadSymbols.document(proxy), track = GridReadSymbols.target(rig.cursorTracks[0]);
            Object device = GridReadSymbols.target(proxy);
            GridReadEpoch proof = bind ? new GridReadEpoch(document, track, device) : prior;
            proof.require(proof.token, document, track, device);
            if (!symbols.name(device).equals("native_device")) throw new IllegalStateException("survey-needs-native-device");
            JsonObject r = new JsonObject();
            r.addProperty("marker", marker()); r.addProperty("epoch", proof.token);
            r.addProperty("jarSha256", GridReadSymbols.JAR_SHA256);
            r.addProperty("queueNanos", entered - queued); r.addProperty("heapUsedBefore", usedHeap());
            if (!bind) {
                GridReadExplore explore = new GridReadExplore(symbols);
                Object root = explore.navigate(device, query.path());
                if (op.equals("schema")) r.add("schema", explore.schema(root, headers));
                else r.add("graph", new GridGraphRead(explore.project(query.projection())).capture(root));
                r.addProperty("queryWork", explore.workUnits());
                if (root != new GridReadExplore(symbols).navigate(device, query.path()))
                    throw new IllegalStateException("survey-path-target-changed");
            }
            proof.require(proof.token, GridReadSymbols.document(proxy),
                GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
            r.addProperty("heapUsedAfter", usedHeap());
            r.addProperty("documentTaskNanos", System.nanoTime() - entered);
            if (r.toString().getBytes(StandardCharsets.UTF_8).length > GridGraphRead.MAX_BYTES)
                throw new IllegalStateException("survey-result-byte-limit");
            return new Capture(r, proof);
        }, capture -> {
            try {
                guard(target);
                session.bound(target, capture.epoch);
                capture.result.addProperty("completionNanos", System.nanoTime() - queued);
                reply.result(capture.result, 0);
            } catch (Exception e) { session.finish(); reply.error(e, 0); }
        }, error -> { session.finish(); reply.error(error, 0); },
        () -> {
            session.timeout();
            reply.error(new IllegalStateException("survey-timeout; native work may continue; no retry; replace controller"), 0);
        }, job);
    }
    private record Capture(JsonObject result, GridReadEpoch epoch) {}
    private static long usedHeap() {
        Runtime r = Runtime.getRuntime(); return r.totalMemory() - r.freeMemory();
    }
}

package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.*;
import com.google.gson.*;
import java.util.*;
import java.util.function.BooleanSupplier;

/** The scratch doctor uses the existing WRITE-classified attachment method. */
public final class GridDoctorHandlers extends HandlerGroup {
    public static final String CONSENT = "I saved first. I consent to one revised V20 scratch doctor pass on the same fingerprint, including boolean and mapping checks. A failed check can require a Bitwig restart.";
    public static String marker() { return "9b-grid-doctor-v20"; }
    public static final Set<String> READS = Set.of("doctorStatus", "doctorPrepare", "doctorBind", "doctorRead", "doctorInspect", "doctorRelease");
    private final BooleanSupplier foreign;
    private GridDoctorSymbols symbols;
    private GridDoctorProtocol protocol;
    private GridDoctorHost nativeHost;
    private GridBreadthHost breadthHost;
    private GridBreadthProtocol breadth;
    private GridDoctorSentinel sentinel;
    private int phase;
    private String kind;
    private boolean failed;
    private static final List<String> CASES = List.of("boolean", "mapping", "core");
    private GridSurveySession.Target target;
    private GridReadEpoch epoch;
    private GridReadJob.State job;
    private Bridge.Reply client;
    private String session;
    private long selection, expires;
    private boolean busy, used, timeoutLocked;
    public GridDoctorHandlers(ControllerHost host, Rig rig, ExecState state, BooleanSupplier foreign) {
        super(host, rig, state); this.foreign = foreign;
    }
    @Override public void register(HandlerRegistry registry) {}
    private boolean unfinished() { return job != null && job.unfinished(); }
    public boolean ownsGrid() { return target != null || busy || timeoutLocked || unfinished(); }
    public JsonObject status() {
        JsonObject r = breadth != null ? breadth.status() : protocol == null ? new JsonObject() : protocol.status();
        r.addProperty("phase", phase); r.addProperty("failed", failed);
        r.addProperty("marker", marker()); r.addProperty("bound", target != null); r.addProperty("busy", busy);
        r.addProperty("used", used); r.addProperty("timeoutLocked", timeoutLocked); r.addProperty("nativeUnfinished", unfinished());
        r.addProperty("foreignOwner", foreign.getAsBoolean());
        if (symbols != null) r.add("metadata", symbols.metadata());
        if (session != null) r.addProperty("session", session);
        if (nativeHost != null) r.add("diagnostics", nativeHost.diagnostics()); return r;
    }
    private void fail(String reason) { failed = true; if (protocol != null) protocol.fail(reason); if (breadth != null) breadth.fail(reason); }
    private void guard(boolean inspect) throws Exception {
        if (target == null || !target.project().equals(rig.currentProjectName())
                || !rig.cursorTracks[0].exists().get() || !target.trackId().equals(rig.cursorTracks[0].channelId().get())
                || !target.trackName().equals(rig.cursorTracks[0].name().get()))
            throw new IllegalStateException("doctor-target-changed");
        var device = rig.cursorDeviceBanks[0].getDevice(target.deviceIndex());
        if (!device.exists().get() || !target.deviceName().equals(device.name().get()))
            throw new IllegalStateException("doctor-device-changed");
        if (!inspect && (client == null || !client.clientConnected() || rig.selectionRevision != selection
                || !rig.cursorTracks[0].mute().get() || rig.transport.isPlaying().get() || System.nanoTime() > expires))
            throw new IllegalStateException("doctor-client-selection-mute-transport-or-deadline");
        symbols.requireFresh();
    }
    private void clear() { target = null; epoch = null; nativeHost = null; breadthHost = null; sentinel = null; client = null; session = null; }
    public void request(JsonObject p, Bridge.Reply reply, boolean write) throws Exception {
        String op = GridSurveySession.text(p, "operation");
        boolean command = op.equals("doctorCommand"), bind = op.equals("doctorBind"), inspect = op.equals("doctorInspect");
        if (write != command || !command && !READS.contains(op)) throw new IllegalArgumentException("doctor-method-operation");
        if (op.equals("doctorStatus")) { reply.result(status(), 0); return; }
        if (busy || unfinished() || foreign.getAsBoolean()) throw new IllegalStateException("doctor-native-or-foreign-busy");
        if (timeoutLocked && !inspect) throw new IllegalStateException("doctor-timeout-locked");
        if (op.equals("doctorPrepare")) {
            if (used || ownsGrid()) throw new IllegalStateException("doctor-already-used");
            if (symbols == null) symbols = new GridDoctorSymbols(host.getClass());
            symbols.requireFresh(); reply.result(status(), 0); return;
        }
        if (bind) {
            if (failed || ownsGrid() || phase >= CASES.size() || symbols == null) throw new IllegalStateException("doctor-unprepared-or-used");
            if (!CONSENT.equals(GridSurveySession.text(p, "consent"))
                    || !symbols.fingerprint.equals(GridSurveySession.text(p, "fingerprint")))
                throw new IllegalArgumentException("doctor-consent-or-fingerprint");
            kind = GridSurveySession.text(p, "case");
            if (!kind.equals(CASES.get(phase))) throw new IllegalArgumentException("doctor-case-order");
            var next = GridSurveySession.Target.parse(p, rig.config.deviceBank);
            if (!next.project().equals("gn-grid-spike") || !next.deviceName().equals("Poly Grid")
                    || !next.trackName().matches("gn-9b-write-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
                throw new IllegalArgumentException("doctor-scratch-target-required");
            selection = p.get("selectionRevision").getAsBigDecimal().longValueExact();
            target = next; client = reply; expires = System.nanoTime() + 900_000_000_000L;
            try { guard(false); } catch (Exception error) { clear(); throw error; }
            used = true; protocol = kind.equals("core") ? new GridDoctorProtocol() : null;
            breadth = kind.equals("core") ? null : new GridBreadthProtocol(kind); session = UUID.randomUUID().toString();
            String token = session;
            reply.onClientDisconnect(() -> { if (token.equals(session)) fail("client-disconnected"); });
            host.scheduleTask(() -> { if (token.equals(session)) fail("session-expired"); }, 900_000);
        } else {
            if (target == null || !Objects.equals(session, GridSurveySession.text(p, "session")))
                throw new IllegalStateException("doctor-stale-session");
            if (op.equals("doctorRelease")) {
                JsonElement cancel = p.get("cancel");
                if (cancel != null && (!cancel.isJsonPrimitive() || !cancel.getAsJsonPrimitive().isBoolean()))
                    throw new IllegalArgumentException("doctor-cancel-boolean");
                boolean cancelled = cancel != null && cancel.getAsBoolean();
                if (breadth != null) breadth.release(cancelled); else protocol.release(cancelled);
                if (cancelled) failed = true; else phase++;
                clear(); reply.result(status(), 0); return;
            }
            if (inspect) { if (breadth != null) breadth.inspect(); else protocol.inspect(); }
            else if (command) {
                if (!(breadth != null ? breadth.action() : protocol.action()).equals(GridSurveySession.text(p, "action"))) throw new IllegalArgumentException("doctor-command-order");
            } else { if (breadth != null) breadth.requireRead(); else protocol.requireRead(); }
            try { guard(inspect); } catch (Exception error) { fail(error.toString()); throw error; }
        }
        Object proxy = rig.cursorDeviceBanks[0].getDevice(target.deviceIndex());
        String token = session; long queued = System.nanoTime(); busy = true;
        GridReadJob.State task = new GridReadJob.State(); job = task;
        GridReadJob.start(work -> GridReadSymbols.queue(proxy, work), host::scheduleTask, () -> {
            long entered = System.nanoTime(), heapBefore = heap(); GridReadSymbols.requireDocumentThread(proxy); guard(inspect);
            Object project = GridReadSymbols.document(proxy), track = GridReadSymbols.target(rig.cursorTracks[0]), device = GridReadSymbols.target(proxy);
            GridReadEpoch proof = bind ? new GridReadEpoch(project, track, device) : epoch;
            proof.require(proof.token, project, track, device);
            GridDoctorProtocol.Guard writeGuard = () -> {
                if (task.cancelled() || System.nanoTime() - queued > 4_000_000_000L) throw new IllegalStateException("doctor-precall-deadline");
                guard(false); proof.require(proof.token, GridReadSymbols.document(proxy), GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
            };
            if (bind) sentinel = new GridDoctorSentinel(new GridReadSymbols(symbols), symbols);
            sentinel.require(device);
            if (bind) {
                if (breadth != null) {
                    GridReadSymbols reader = new GridReadSymbols(symbols);
                    breadthHost = new GridBreadthHost(reader, symbols, new GridBreadthRead(reader).grid(device), project, kind);
                } else nativeHost = new GridDoctorHost(symbols, device, project, writeGuard);
            }
            if (nativeHost != null) nativeHost.guard(writeGuard);
            JsonObject r = new JsonObject(); r.addProperty("marker", marker()); r.addProperty("session", token);
            if (command) r.add("receipt", breadth != null
                ? breadth.command(GridSurveySession.text(p, "action"), breadthHost, writeGuard::check)
                : protocol.command(GridSurveySession.text(p, "action"), nativeHost, writeGuard));
            else if (!bind) r.add("snapshot", breadth != null
                ? (inspect ? breadthHost.inspect() : breadth.read(breadthHost))
                : (inspect ? nativeHost.read() : protocol.read(nativeHost)));
            proof.require(proof.token, GridReadSymbols.document(proxy), GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
            if (nativeHost != null) r.add("metrics", nativeHost.metrics());
            if (breadthHost != null) r.add("metrics", breadthHost.metrics());
            r.addProperty("queueNanos", entered - queued); r.addProperty("documentTaskNanos", System.nanoTime() - entered);
            r.addProperty("heapBefore", heapBefore); r.addProperty("heapAfter", heap());
            if (r.toString().length() > 262144) throw new IllegalStateException("doctor-reply-limit");
            return new Outcome(r, proof);
        }, outcome -> {
            busy = false;
            try {
                if (!token.equals(session)) throw new IllegalStateException("doctor-completion-session");
                guard(inspect); epoch = outcome.proof;
                outcome.result.add("status", breadth != null ? breadth.status() : protocol.status()); outcome.result.addProperty("completionNanos", System.nanoTime() - queued);
                reply.result(outcome.result, 0);
            } catch (Exception error) { fail(error.toString()); reply.error(error, 0); }
        }, error -> { busy = false; fail(error.toString()); reply.error(error, 0); }, () -> {
            busy = false; timeoutLocked = true; fail("native-timeout; no retry");
            reply.error(new IllegalStateException("doctor-timeout; native work may continue; no retry"), 0);
        }, task);
    }
    private record Outcome(JsonObject result, GridReadEpoch proof) {}
    private static long heap() { Runtime r = Runtime.getRuntime(); return r.totalMemory() - r.freeMemory(); }
}

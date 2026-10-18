package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.*;
import com.ghostnote.extension.*;
import com.google.gson.*;
import java.util.*;

/** V12: one fixed active-engine experiment. No public tool uses this handler. */
public final class GridEngineHandlers extends HandlerGroup {
    public static final String MARKER = "9a-grid-engine-v12";
    private final GridEngineProtocol protocol = new GridEngineProtocol();
    private final Track track;
    private final MasterTrack master;
    private GridReadSymbols reader;
    private GridEngineSymbols engine;
    private GridReadJob.State job;
    private GridReadEpoch epoch, sessionProof;
    private String targetId, masterId, mode;
    private int stage, reads, afterReads, noteState;
    private boolean commanded, entryReady, restored, restorationUsed, recoveryReadFailed;
    private volatile boolean notesKnown;
    private JsonArray expected;
    private JsonObject expectedWitness, first, firstWitness, lastWindow, progress;
    private volatile GridEngineWindow window;
    private long[] packets;
    private GridEngineNoteLease lease;
    private boolean busy;

    public GridEngineHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
        track = rig.cursorTracks[0];
        master = rig.profile.hasProbeResources() ? host.createMasterTrack(0) : null;
        if (master == null) return;
        master.exists().markInterested(); master.channelId().markInterested();
        track.mute().markInterested(); track.arm().markInterested(); track.solo().markInterested();
        track.isActivated().markInterested(); track.isMutedBySolo().markInterested(); track.volume().value().markInterested();
        track.playingNotes().markInterested();
        track.addVuMeterObserver(128, -1, true, value -> sample(0, value, track.channelId().get()));
        master.addVuMeterObserver(128, -1, true, value -> sample(1, value, master.channelId().get()));
        track.playingNotes().addValueObserver(notes -> {
            notesKnown = true;
            noteState = notes.length == 0 ? 0 : notes.length == 1 && notes[0].pitch() == 60 ? 60 : 127;
            sample(2, noteState, track.channelId().get());
            if (protocol.used() && window == null && noteState != 0) fail("notes-between-stages");
        });
        track.channelId().addValueObserver(id -> {
            if (protocol.used() && targetId != null && !targetId.equals(id)) fail("observer-track-changed");
        });
        track.mute().addValueObserver(muted -> { if (protocol.used() && !restored && !muted) fail("mute-changed"); });
        rig.transport.isPlaying().addValueObserver(playing -> { if (protocol.used() && !restored && playing) fail("transport-started"); });
    }
    @Override public void register(HandlerRegistry registry) { registry.onAsync("probe.gridEngine", this::request); }
    public boolean used() { return protocol.used(); }
    public boolean unfinished() { return busy || lease != null && lease.unfinished() || job != null && job.unfinished(); }
    private void sample(int kind, int value, String identity) {
        GridEngineWindow w = window;
        if (w != null) {
            w.sample(kind, value, identity, System.nanoTime(), System.currentTimeMillis());
            try { w.requireHealthy(); } catch (Exception error) { fail(error.toString()); }
        }
    }
    private void fail(String reason) { protocol.fail(reason); if (window != null) window.abort(reason); }
    private void guard(boolean active) throws Exception {
        if (!rig.currentProjectName().equals("gn-grid-spike") || !track.exists().get() || targetId == null
                || !targetId.equals(track.channelId().get()) || !track.name().get().equals("grid-probe")
                || !rig.cursorDeviceBanks[0].getDevice(0).exists().get()
                || !rig.cursorDeviceBanks[0].getDevice(0).name().get().equals("Poly Grid")
                || rig.transport.isPlaying().get() || !track.mute().get() || !track.arm().get()
                || !track.isActivated().get() || track.solo().get() || track.isMutedBySolo().get()
                || Math.abs(track.volume().value().getRaw() - Math.pow(10, -10.0 / 60)) > .000001)
            throw new IllegalStateException("engine-fixture-route-or-mixer-changed");
        if (active && (masterId == null || !master.exists().get() || !masterId.equals(master.channelId().get())))
            throw new IllegalStateException("engine-master-changed");
    }
    private Object proxy() { return rig.cursorDeviceBanks[0].getDevice(0); }
    private void nativeGuard(boolean active) throws Exception {
        GridReadSymbols.requireDocumentThread(proxy()); guard(active);
        if (sessionProof != null && active) sessionProof.require(sessionProof.token,
            GridReadSymbols.document(proxy()), GridReadSymbols.target(track), GridReadSymbols.target(proxy()));
        if (active) engine.require(GridReadSymbols.document(proxy()), GridReadSymbols.target(track), GridReadSymbols.target(master));
    }
    private JsonObject status() {
        JsonObject r = protocol.status(); r.addProperty("marker", MARKER); r.addProperty("nativeUnfinished", unfinished());
        r.addProperty("stage", stage); r.addProperty("commandAttempted", commanded); r.addProperty("beforeReads", reads); r.addProperty("afterReads", afterReads);
        r.addProperty("epochOpen", epoch != null); r.addProperty("restored", restored);
        if (window != null) r.add("window", window.report()); if (lastWindow != null) r.add("lastWindow", lastWindow);
        if (progress != null) r.add("attachment", progress); return r;
    }
    public void request(JsonObject p, Bridge.Reply reply) throws Exception {
        String op = p.get("operation").getAsString();
        if (op.equals("status")) { reply.result(status(), 0); return; }
        try {
            if (unfinished()) throw new IllegalStateException("engine-native-task-unfinished");
            if (op.equals("abort")) { fail("client-abort"); reply.result(status(), 0); return; }
            if (op.equals("sessionRelease")) {
                if (window != null || epoch != null || noteState != 0 || !restored)
                    throw new IllegalStateException("engine-restoration-required");
                protocol.release(); if (engine != null) engine.release(); sessionProof = null; lease = null; expected = null; expectedWitness = null;
                reply.result(status(), 0); return;
            }
            if (op.equals("release")) {
                requireEpoch(p);
                if (mode.equals("stage")) {
                    if (!commanded || reads != 2 || afterReads != 2) throw new IllegalStateException("engine-stage-readback-required");
                    protocol.advance("stage" + stage, System.nanoTime());
                } else {
                    if (reads != 2) throw new IllegalStateException("engine-paired-read-required");
                    if (mode.equals("entry")) { entryReady = true; sessionProof = epoch; }
                    if (mode.equals("restored")) restored = true;
                }
                epoch = null; first = firstWitness = null; reply.result(ok(), 0); return;
            }
            if (protocol.locked() && !Set.of("bind", "read").contains(op)) throw new IllegalStateException("engine-session-locked");
            if (op.equals("sessionBegin")) {
                protocol.begin(System.nanoTime());
                if (!entryReady || epoch != null || !notesKnown || noteState != 0 || !p.get("isolationConfirmed").getAsBoolean())
                    throw new IllegalStateException("engine-entry-and-isolation-required");
                fresh(p); masterId = master.channelId().get();
            } else if (op.equals("bind")) {
                if (protocol.locked() && !unfinished() && noteState == 0) {
                    if (window != null && !window.needsOff()) { lastWindow = window.report(); window = null; }
                    epoch = null;
                }
                if (epoch != null || window != null && !p.get("mode").getAsString().equals("restored")) throw new IllegalStateException("engine-scope-open");
                String requested = p.get("mode").getAsString();
                if (!Set.of("entry", "stage", "restored", "recovery").contains(requested)) throw new IllegalArgumentException("engine-mode");
                if (protocol.locked() && !Set.of("recovery", "restored").contains(requested)) throw new IllegalStateException("engine-session-locked");
                if (requested.equals("entry") && (protocol.used() || entryReady)) throw new IllegalStateException("engine-entry-already-used");
                if (requested.equals("recovery")) protocol.recovery(false);
                if (requested.equals("restored")) {
                    if (restorationUsed) throw new IllegalStateException("engine-restoration-read-already-used");
                    restorationUsed = true;
                    if (!protocol.complete() && !protocol.locked()) throw new IllegalStateException("engine-run-not-ended");
                    fresh(p); if (!p.get("restorationConfirmed").getAsBoolean() || !p.get("engineInactive").getAsBoolean()) throw new IllegalStateException("engine-inactive-required");
                }
                if (!p.get("project").getAsString().equals("gn-grid-spike") || !p.get("trackName").getAsString().equals("grid-probe")
                        || p.get("deviceIndex").getAsInt() != 0 || !p.get("deviceName").getAsString().equals("Poly Grid"))
                    throw new IllegalArgumentException("engine-fixed-target-only");
                String id = p.get("trackId").getAsString(); UUID.fromString(id);
                if (targetId != null && !requested.equals("restored") && !targetId.equals(id)) throw new IllegalStateException("engine-target-changed");
                targetId = id; mode = requested; stage = p.has("stage") ? p.get("stage").getAsInt() : 0;
                if (mode.equals("stage")) protocol.require("stage" + stage, System.nanoTime());
                reads = afterReads = 0; commanded = false;
            } else if (op.equals("read") || op.equals("command")) {
                requireEpoch(p);
                if (mode.equals("recovery") && (recoveryReadFailed || reads >= 2)) throw new IllegalStateException("engine-recovery-no-retry");
            }
            else if (op.equals("windowBegin")) {
                if (epoch != null || window != null || noteState != 0) throw new IllegalStateException("engine-window-or-notes-open");
                if (!Set.of("Q0", "B+", "B0", "B-return", "N+", "N0", "N-half", "N-return", "R+", "Q1").contains(p.get("name").getAsString()))
                    throw new IllegalArgumentException("engine-fixed-window-name");
                protocol.require(p.get("name").getAsString(), System.nanoTime());
            } else if (op.equals("windowCollect")) {
                if (window == null || !window.name.equals(p.get("name").getAsString())) throw new IllegalStateException("engine-window-mismatch");
            } else throw new IllegalArgumentException("engine-operation");
            guard(protocol.used() && !Set.of("restored", "recovery").contains(String.valueOf(mode)));
            if (reader == null) reader = new GridReadSymbols(host.getClass());
            queue(op, p, reply);
        } catch (Exception error) { fail(error.toString()); throw error; }
    }
    private static void fresh(JsonObject p) {
        long age = System.currentTimeMillis() - p.get("observedAt").getAsLong();
        if (age < 0 || age > 60_000) throw new IllegalStateException("engine-fresh-ui-witness-required");
    }
    private void requireEpoch(JsonObject p) {
        if (epoch == null || !epoch.token.equals(p.get("epoch").getAsString())) throw new IllegalStateException("engine-stale-epoch");
    }
    private void queue(String op, JsonObject p, Bridge.Reply reply) {
        busy = true;
        long queued = System.nanoTime(); GridReadJob.State task = new GridReadJob.State(); job = task;
        GridReadJob.start(r -> GridReadSymbols.queue(proxy(), r), host::scheduleTask, () -> {
            long start = System.nanoTime(), heap = heap();
            boolean active = protocol.used() && !Set.of("restored", "recovery").contains(String.valueOf(mode)) && !op.equals("sessionBegin");
            nativeGuard(active);
            Object document = GridReadSymbols.document(proxy()), nativeTrack = GridReadSymbols.target(track), device = GridReadSymbols.target(proxy());
            JsonObject r = new JsonObject(); r.addProperty("marker", MARKER); r.addProperty("jarSha256", GridReadSymbols.JAR_SHA256);
            r.addProperty("operation", op); r.addProperty("queueNanos", start - queued);
            if (engine == null) engine = new GridEngineSymbols(host.getClass().getClassLoader());
            if (Set.of("entry", "restored").contains(String.valueOf(mode)) && !op.equals("sessionBegin") && !protocol.used()) engine.requireInactive(document);
            if (mode != null && mode.equals("restored")) {
                engine.requireInactive(document);
                if (noteState != 0) throw new IllegalStateException("engine-notes-after-deactivation");
                if (lease != null) lease.cancelAfterDeactivation();
                if (window != null) { lastWindow = window.report(); window = null; }
            }
            if (op.equals("bind")) {
                if (mode.equals("recovery") && sessionProof != null) sessionProof.require(sessionProof.token, document, nativeTrack, device);
                epoch = new GridReadEpoch(document, nativeTrack, device); r.addProperty("epoch", epoch.token);
            } else if (op.equals("sessionBegin")) {
                sessionProof.require(sessionProof.token, document, nativeTrack, device);
                engine.bind(document, nativeTrack, GridReadSymbols.target(master));
                sessionProof = new GridReadEpoch(document, nativeTrack, device); r.addProperty("generation", engine.generation);
            } else if (op.equals("windowBegin")) {
                lastWindow = null;
                packets = engine.packets(document, nativeTrack, GridReadSymbols.target(master));
                window = new GridEngineWindow(p.get("name").getAsString(), targetId, masterId, engine.generation,
                    System.nanoTime(), System.currentTimeMillis(), noteState);
                lease = new GridEngineNoteLease(nativeTrack, new GridEngineNoteLease.Host() {
                    public void queue(Runnable task) throws Exception { GridReadSymbols.queue(proxy(), task); }
                    public Object target() throws Exception { GridReadSymbols.requireDocumentThread(proxy()); return GridReadSymbols.target(track); }
                    public void guardOn() throws Exception { nativeGuard(true); protocol.require(window.name, System.nanoTime()); }
                    public void note(Object target, boolean on) throws Exception { engine.note(target, on); }
                    public void failure(Exception error) { fail(error.toString()); }
                }, window, System::nanoTime);
                r.add("window", window.report());
            } else if (op.equals("windowCollect")) {
                lastWindow = window.collect(System.nanoTime(), System.currentTimeMillis(), packets,
                    engine.packets(document, nativeTrack, GridReadSymbols.target(master)));
                r.add("window", lastWindow);
                if (!lastWindow.get("available").getAsBoolean()) throw new IllegalStateException(lastWindow.get("failure").getAsString());
                protocol.signal(window.name, lastWindow.get("peak").getAsInt(), System.nanoTime()); window = null; packets = null; lease = null;
            } else {
                epoch.require(epoch.token, document, nativeTrack, device);
                var explore = new GridReadExplore(reader); Object root = explore.navigate(device, GridFixtureValue.query().path());
                JsonObject graph = new GridGraphRead(GridAttachmentGraph.bounded(explore.project(GridFixtureValue.query().projection()), 3),
                    GridGraphRead.MAX_WORK, GridGraphRead.MAX_BYTES, GridGraphRead.MAX_DEPTH, 61).capture(root);
                if (graph.getAsJsonArray("nodes").size() > 61) throw new IllegalStateException("engine-node-limit");
                var nativeHost = new GridAttachmentSymbols(reader, root, graph,
                    graph.get("complete").getAsBoolean() ? GridEngineGraph.uuids(graph) : List.of(), () -> {
                        if (task.cancelled() || System.nanoTime() - queued > 4_000_000_000L) throw new IllegalStateException("engine-precall-deadline");
                        nativeGuard(true); protocol.require("stage" + stage, System.nanoTime());
                    }, () -> protocol.factory(System.nanoTime()));
                r.add("graph", graph);
                JsonObject witness = null;
                if (mode.equals("recovery")) {
                    if (!op.equals("read") || reads >= 2) throw new IllegalStateException("engine-recovery-budget");
                    reads++; r.add("diagnostics", nativeHost.diagnostics());
                    try { r.add("witness", nativeHost.witness(3)); }
                    catch (Exception error) { r.addProperty("witnessError", GridModuleAttachment.errorText(error)); }
                } else {
                    witness = nativeHost.witness(3); r.add("witness", witness);
                }
                if (!mode.equals("recovery") && op.equals("read")) {
                    if (mode.equals("entry") || mode.equals("restored")) {
                        if (reads >= 2) throw new IllegalStateException("engine-read-budget"); GridEngineGraph.baseline(graph); GridEngineGraph.baselineWitness(witness); nativeHost.requireIdle();
                        if (reads == 0) { first = graph.deepCopy(); firstWitness = witness.deepCopy(); }
                        else GridAttachmentGraph.requireRead(graph, witness, first.getAsJsonArray("nodes"), firstWitness);
                        reads++; expected = graph.getAsJsonArray("nodes").deepCopy(); expectedWitness = witness.deepCopy();
                    } else {
                        GridAttachmentGraph.requireRead(graph, witness, expected, expectedWitness);
                        if (commanded) { if (++afterReads > 2) throw new IllegalStateException("engine-read-budget"); }
                        else if (++reads > 2) throw new IllegalStateException("engine-read-budget");
                    }
                } else if (!mode.equals("recovery")) {
                    if (!mode.equals("stage") || reads != 2 || commanded || window != null || noteState != 0)
                        throw new IllegalStateException("engine-command-order");
                    GridAttachmentGraph.requireRead(graph, witness, expected, expectedWitness);
                    nativeGuard(true); protocol.require("stage" + stage, System.nanoTime());
                    if (task.cancelled() || System.nanoTime() - queued > 4_000_000_000L) throw new IllegalStateException("engine-precall-deadline");
                    commanded = true;
                    if (stage == 3) {
                        GridEngineGraph.baseline(graph);
                        JsonObject receipt = GridModuleAttachment.run(nativeHost, value -> progress = value.deepCopy());
                        expected = GridAttachmentGraph.expectedNodes(graph, receipt.getAsJsonObject("capture0"), receipt.getAsJsonObject("attached"));
                        expectedWitness = GridAttachmentGraph.expectedWitness(witness, receipt.getAsJsonObject("attached"));
                        r.add("lifecycle", receipt);
                    } else {
                        JsonArray prediction = GridEngineGraph.expected(graph, stage);
                        mutate(device, root, stage, () -> {
                            if (task.cancelled() || System.nanoTime() - queued > 4_000_000_000L) throw new IllegalStateException("engine-precall-deadline");
                            nativeGuard(true); protocol.require("stage" + stage, System.nanoTime());
                        });
                        expected = prediction; expectedWitness = GridEngineGraph.witnessAfter(witness, stage);
                    }
                    r.addProperty("writeStatus", "command-returned; paired readback required");
                }
            }
            r.addProperty("heapUsedBefore", heap); r.addProperty("heapUsedAfter", heap()); r.addProperty("documentTaskNanos", System.nanoTime() - start);
            if (r.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1024 * 1024) throw new IllegalStateException("engine-response-limit");
            return r;
        }, result -> {
            busy = false;
            try {
                guard(protocol.used() && !Set.of("restored", "recovery").contains(String.valueOf(mode)));
                if (op.equals("windowBegin")) scheduleWindow(window);
                reply.result(result, 0);
            } catch (Exception error) { fail(error.toString()); reply.error(error, 0); }
        }, error -> { busy = false; if ("recovery".equals(mode) && op.equals("read")) recoveryReadFailed = true;
            fail(error.toString()); reply.error(error, 0); }, () -> {
            busy = false; if ("recovery".equals(mode) && op.equals("read")) recoveryReadFailed = true;
            fail("engine-response-timeout; native work is not cancelled");
            reply.error(new IllegalStateException("engine-response-timeout; no retry; inspect cached status"), 0);
        }, task);
    }
    private Object atom(Object device, int module, int atom) throws Exception {
        return new GridReadExplore(reader).navigate(device, GridFixtureCable.atomPath(module, atom));
    }
    private void mutate(Object device, Object root, int stage, GridAttachmentSymbols.Guard guard) throws Exception {
        if (Set.of(1, 2, 6, 7, 8).contains(stage)) {
            Object value = atom(device, stage <= 2 ? 1 : 4, 1);
            var setter = GridWriteSymbols.fixtureValueSetter(value); guard.check();
            setter.invoke(value, GridEngineGraph.value(stage));
        } else if (stage == 11) {
            var path = new ArrayList<>(GridFixtureValue.query().path());
            path.add(new GridReadExplore.Step("module_grid", 6428, "auxiliary_devices", 4));
            Object module = new GridReadExplore(reader).navigate(device, path);
            var setter = GridWriteSymbols.fixtureModuleDelete(root, module); guard.check();
            setter.invoke(module);
        } else {
            int d = GridEngineGraph.destination(stage), b = GridEngineGraph.sourceBefore(stage), a = GridEngineGraph.sourceAfter(stage);
            Object destination = atom(device, d, d == 2 ? 0 : 3), before = b < 0 ? null : atom(device, b, 0), after = a < 0 ? null : atom(device, a, 0);
            var setter = GridWriteSymbols.fixtureCableSetter(destination, before, after); guard.check();
            setter.invoke(destination, after);
        }
    }
    private void scheduleWindow(GridEngineWindow w) {
        // Install note-off before the begin response. It does not depend on the client.
        lease.schedule(host::scheduleTask);
    }
    private static long heap() { return Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory(); }
}

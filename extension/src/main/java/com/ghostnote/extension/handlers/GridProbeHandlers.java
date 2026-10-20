package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.*;
import com.google.gson.JsonObject;
import java.util.UUID;

/** Reusable survey reads and the retained fixed-fixture 9a research paths. */
public final class GridProbeHandlers extends HandlerGroup {
    public static final String MARKER = GridSurveyHandlers.MARKER;
    private final GridEngineHandlers engine;
    private final GridSurveyHandlers survey;
    private GridReadSymbols symbols;
    private GridReadEpoch epoch;
    private boolean busy;
    private final GridProbeSafety safety = new GridProbeSafety();
    private GridReadJob.State job;
    private GridReadEpoch recoveryProof;
    private Target recoveryTarget;
    private Target epochTarget;

    public GridProbeHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
        engine = new GridEngineHandlers(host, rig, state);
        survey = new GridSurveyHandlers(host, rig, state,
            () -> engine.ownsGrid() || busy || job != null && job.unfinished()
                || epoch != null || safety.locked() || safety.pendingReadback());
        engine.otherGridOwner(survey::ownsGrid);
    }

    @Override public void register(HandlerRegistry r) {
        engine.register(r);
        r.onAsync("probe.gridRead", (params, reply) -> {
            if (params.has("operation") && GridSurveyHandlers.OPERATIONS.contains(params.get("operation").getAsString()))
                survey.request(params, reply);
            else request(params, reply, Write.NONE);
        });
        r.onAsync("probe.gridValue", (params, reply) -> request(params, reply, Write.VALUE));
        r.onAsync("probe.gridCable", (params, reply) -> request(params, reply, Write.CABLE));
        r.onAsync("probe.gridModuleDelete", (params, reply) -> request(params, reply, Write.DELETE));
        r.onAsync("probe.gridModuleFactory", (params, reply) -> request(params, reply, Write.FACTORY));
        r.onAsync("probe.gridModuleAttach", (params, reply) -> request(params, reply, Write.ATTACH));
    }

    private enum Write { NONE, VALUE, CABLE, DELETE, FACTORY, ATTACH }

    private record Target(String project, String trackId, String trackName, int deviceIndex, String deviceName) {}

    private void guard(Target target) {
        if (!target.project.equals(rig.currentProjectName())
                || !rig.cursorTracks[0].exists().get()
                || !target.trackId.equals(rig.cursorTracks[0].channelId().get())
                || !target.trackName.equals(rig.cursorTracks[0].name().get()))
            throw new IllegalStateException("project-or-track-changed");
        var device = rig.cursorDeviceBanks[0].getDevice(target.deviceIndex);
        if (!device.exists().get() || !target.deviceName.equals(device.name().get()))
            throw new IllegalStateException("device-route-changed");
    }

    private void request(JsonObject params, Bridge.Reply reply, Write kind) throws Exception {

        if (kind != Write.NONE) throw new IllegalStateException("V12 writes require the fixed engine protocol; V11 cohort is retired");
        if (survey.ownsGrid()) throw new IllegalStateException("survey-session-owns-grid");
        if (engine.used() || engine.unfinished()) throw new IllegalStateException("engine-session-owns-grid; use probe.gridEngine");
        boolean write = kind != Write.NONE;
        String operation = write ? switch (kind) {
            case VALUE -> "setValue"; case CABLE -> "setCable"; case DELETE -> "deleteModule"; case FACTORY -> "detachedFactory"; case ATTACH -> "attachModule";
            default -> throw new IllegalStateException("unexpected write kind");
        } : params.get("operation").getAsString();
        if (operation.equals("attachmentStatus")) {
            reply.result(safety.status(job != null && job.unfinished()), 0); return;
        }
        if (busy || job != null && job.unfinished()) throw new IllegalStateException("grid-native-task-unfinished");
        boolean recovery = operation.startsWith("recovery");
        if (operation.equals("release") || operation.equals("recoveryRelease")) {
            if (epoch == null || !epoch.token.equals(params.get("epoch").getAsString()))
                throw new IllegalStateException("stale-grid-epoch");
            safety.release(params.has("uncertain") && params.get("uncertain").getAsBoolean());
            epoch = null; epochTarget = null;
            reply.result(ok(), 0); return;
        }
        if (!write && !java.util.Set.of("bind", "read", "schema", "attachmentRead", "recoveryBind", "recoveryRead").contains(operation))
            throw new IllegalArgumentException("unknown Grid operation");
        if (safety.locked() && !recovery) throw new IllegalStateException("grid-write-locked; use bounded recovery");
        if (safety.pendingReadback() && !safety.locked() && !operation.equals("attachmentRead"))
            throw new IllegalStateException("attachment-readback-required");
        if (recovery && !safety.locked()) throw new IllegalStateException("grid-recovery-requires-locked-session");
        boolean capture = !operation.equals("bind") && !operation.equals("recoveryBind");
        boolean attachmentRead = operation.equals("attachmentRead") || operation.equals("recoveryRead");
        if (attachmentRead && (params.has("path") || params.has("projection")))
            throw new IllegalArgumentException("attachment reads use the fixed projection");
        if (write && (params.has("path") || params.has("projection") || params.has("operation")))
            throw new IllegalArgumentException("the fixture write has a fixed path and projection");
        GridFixtureValue.Input input = kind == Write.VALUE ? GridFixtureValue.parse(params) : null;
        GridFixtureCable.Input cable = kind == Write.CABLE ? GridFixtureCable.parse(params)
            : kind == Write.DELETE ? GridFixtureModuleDelete.parse(params)
            : kind == Write.FACTORY || kind == Write.ATTACH ? GridFactorySymbols.parse(params) : null;
        GridReadExplore.Query query = write || attachmentRead ? GridFixtureValue.query() : GridReadExplore.Query.parse(params);
        if (operation.equals("read") && !query.path().isEmpty() && query.projection().isEmpty())
            throw new IllegalArgumentException("a read path needs an explicit projection");
        if (operation.equals("schema") && !query.projection().isEmpty())
            throw new IllegalArgumentException("schema does not read projected values");
        int index = params.get("deviceIndex").getAsInt();
        if (index < 0 || index >= rig.config.deviceBank) throw new IllegalArgumentException("device-index-outside-bank");
        Target target = new Target(params.get("project").getAsString(), params.get("trackId").getAsString(),
            params.get("trackName").getAsString(), index, params.get("deviceName").getAsString());
        if (!target.project.equals("gn-grid-spike") || !target.trackName.equals("grid-probe")
                || !target.deviceName.equals("Poly Grid"))
            throw new IllegalArgumentException("only the named 9a disposable fixture is admitted");
        guard(target);
        String token = capture ? params.get("epoch").getAsString() : "";
        GridReadEpoch bound = epoch;
        if (capture && (bound == null || !bound.token.equals(token) || !target.equals(epochTarget)))
            throw new IllegalStateException("stale-grid-epoch");
        if (recovery && (!target.equals(recoveryTarget) || recoveryProof == null))
            throw new IllegalStateException("recovery-target-changed");
        if (operation.equals("recoveryBind")) safety.recoveryBind(false);
        if (operation.equals("recoveryRead")) safety.recoveryRead();
        if (kind == Write.ATTACH || kind == Write.FACTORY) safety.requireAttempt(token);
        if (kind == Write.ATTACH) {
            long observed = params.get("engineInactiveObservedAt").getAsLong();
            long age = System.currentTimeMillis() - observed;
            if (age < 0 || age > 60_000 || rig.transport.isPlaying().get() || !rig.cursorTracks[0].mute().get())
                throw new IllegalStateException("attachment-needs-fresh-engine-inactive-witness-muted-track-and-stopped-transport");
            if (!params.has("expectedWitness") || params.get("expectedWitness").toString().length() > 8192)
                throw new IllegalArgumentException("attachment-needs-bounded-before-witness");
        }
        if (symbols == null) symbols = new GridReadSymbols(host.getClass());
        Object proxy = rig.cursorDeviceBanks[0].getDevice(index);
        String operationId = UUID.randomUUID().toString();
        if (kind == Write.ATTACH || kind == Write.FACTORY) safety.operation(operationId);
        long queued = System.nanoTime();
        var writeAttempted = new java.util.concurrent.atomic.AtomicBoolean();
        busy = true;
        GridReadJob.State taskState = new GridReadJob.State(); job = taskState;
        GridReadJob.start(task -> GridReadSymbols.queue(proxy, task), host::scheduleTask, () -> {
            long entered = System.nanoTime();
            GridReadSymbols.requireDocumentThread(proxy);
            Object document = GridReadSymbols.document(proxy);
            Object track = GridReadSymbols.target(rig.cursorTracks[0]);
            Object device = GridReadSymbols.target(proxy);
            if (recovery) recoveryProof.require(recoveryProof.token, document, track, device);
            GridReadEpoch proof = !capture ? new GridReadEpoch(document, track, device) : bound;
            recoveryProof = proof; recoveryTarget = target;
            if (capture) proof.require(token, document, track, device);
            JsonObject result = new JsonObject();
            result.addProperty("marker", MARKER);
            result.addProperty("jarSha256", GridReadSymbols.JAR_SHA256);
            result.addProperty("operationId", operationId);
            result.addProperty("epoch", proof.token);
            result.addProperty("runtimeClass", device.getClass().getName());
            result.addProperty("className", symbols.name(device));
            result.addProperty("classId", symbols.classId(device));
            result.addProperty("thread", Thread.currentThread().getName());
            result.addProperty("queueNanos", entered - queued);
            result.addProperty("heapUsedBefore", usedHeap());
            if (capture) {
                GridReadExplore explore = new GridReadExplore(symbols);
                Object root = explore.navigate(device, query.path());
                if (operation.equals("schema")) result.add("schema", explore.schema(root));
                else {
                    JsonObject graph;
                    try {
                        GridGraphRead.Reader projection = explore.project(query.projection());
                        graph = new GridGraphRead(kind == Write.ATTACH || attachmentRead ? GridAttachmentGraph.bounded(projection) : projection).capture(root);
                    }
                    catch (Exception error) {
                        if (!recovery) throw error;
                        graph = new JsonObject(); graph.addProperty("complete", false); graph.addProperty("errorCount", 1);
                        graph.addProperty("error", GridModuleAttachment.errorText(error));
                    }
                    result.add("graph", graph);
                    if (kind == Write.ATTACH || attachmentRead) {
                        GridAttachmentSymbols nativeHost = new GridAttachmentSymbols(symbols, root, graph,
                            cable == null ? java.util.List.of() : safety.excluded(cable.moduleUuids()), () -> {
                                if (taskState.cancelled() || System.nanoTime() - queued > 4_000_000_000L)
                                    throw new IllegalStateException("attachment-precall-deadline");
                                guard(target);
                                if (rig.transport.isPlaying().get() || !rig.cursorTracks[0].mute().get())
                                    throw new IllegalStateException("attachment-playback-or-mute-changed");
                                proof.require(token, GridReadSymbols.document(proxy), GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
                            }, () -> { safety.attempt(token); writeAttempted.set(true); });
                        if (recovery) {
                            result.add("diagnostics", nativeHost.diagnostics());
                            try { result.add("witness", nativeHost.witness()); }
                            catch (Exception error) { result.addProperty("witnessError", GridModuleAttachment.errorText(error)); }
                        } else try {
                            JsonObject witness = nativeHost.witness(); result.add("witness", witness);
                            if (kind == Write.ATTACH) {
                                GridFixtureCable.require(graph, cable);
                                if (!witness.equals(params.get("expectedWitness"))) throw new IllegalStateException("attachment-before-witness-changed");
                                JsonObject receipt = GridModuleAttachment.run(nativeHost, safety::progress);
                                safety.remember(receipt.getAsJsonObject("capture0"));
                                safety.expect(GridAttachmentGraph.expectedNodes(graph, receipt.getAsJsonObject("capture0"), receipt.getAsJsonObject("attached")),
                                    GridAttachmentGraph.expectedWitness(witness, receipt.getAsJsonObject("attached")));
                                result.add("lifecycle", receipt);
                                result.addProperty("writeStatus", "attached; independent readback required");
                                result.addProperty("writeAttempted", true);
                                result.addProperty("readbackStatus", "not-attempted");
                            } else safety.readback(graph, witness);
                        } catch (Throwable error) {
                            safety.lock(); safety.diagnostics(nativeHost.diagnostics()); throw error;
                        }
                    } else if (kind == Write.FACTORY) {
                        GridFixtureCable.require(graph, cable);
                        GridFactorySymbols factory = new GridFactorySymbols(symbols, root.getClass().getClassLoader(), safety.excluded(cable.moduleUuids()));
                        proof.require(token, GridReadSymbols.document(proxy),
                            GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
                        if (System.nanoTime() - queued > 4_000_000_000L)
                            throw new IllegalStateException("fixture-factory-deadline; no factory call");
                        safety.attempt(token);
                        writeAttempted.set(true);
                        JsonObject receipt = GridDetachedFactory.run(factory, value -> {
                            safety.progress(com.google.gson.JsonParser.parseString(value).getAsJsonObject());
                        });
                        safety.remember(receipt.getAsJsonObject("capture0"));
                        result.add("lifecycle", receipt);
                        result.addProperty("writeStatus", "detached-disposed; fresh fixture read required");
                        result.addProperty("writeAttempted", true);
                        result.addProperty("readbackStatus", "not-attempted");
                    } else if (write) {
                        Object atom;
                        Object[] arguments;
                        java.lang.reflect.Method setter;
                        if (kind == Write.VALUE) {
                            GridFixtureValue.require(graph, input);
                            atom = new GridReadExplore(symbols).navigate(device, GridFixtureValue.valuePath());
                            setter = GridWriteSymbols.fixtureValueSetter(atom);
                            arguments = new Object[]{input.after()};
                        } else if (kind == Write.DELETE) {
                            GridFixtureCable.require(graph, cable);
                            atom = new GridReadExplore(symbols).navigate(device, GridFixtureModuleDelete.modulePath());
                            setter = GridWriteSymbols.fixtureModuleDelete(root, atom);
                            arguments = new Object[0];
                        } else {
                            GridFixtureCable.require(graph, cable);
                            atom = new GridReadExplore(symbols).navigate(device, GridFixtureCable.atomPath(3, 3));
                            Object sine = new GridReadExplore(symbols).navigate(device, GridFixtureCable.atomPath(0, 2));
                            Object amplifier = new GridReadExplore(symbols).navigate(device, GridFixtureCable.atomPath(1, 0));
                            Object before = GridFixtureCable.source(cable.before(), sine, amplifier);
                            Object argument = GridFixtureCable.source(cable.after(), sine, amplifier);
                            setter = GridWriteSymbols.fixtureCableSetter(atom, before, argument);
                            arguments = new Object[]{argument};
                        }
                        proof.require(token, GridReadSymbols.document(proxy),
                            GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
                        if (System.nanoTime() - queued > 4_000_000_000L)
                            throw new IllegalStateException("fixture-write-deadline; no mutation");
                        writeAttempted.set(true);
                        setter.invoke(atom, arguments);
                        result.addProperty("writeStatus", "command-returned; fresh read required");
                        result.addProperty("writeAttempted", true);
                        result.addProperty("readbackStatus", "not-attempted");
                    }
                }
                result.addProperty("queryWork", explore.workUnits());
                if (root != new GridReadExplore(symbols).navigate(device, query.path()))
                    throw new IllegalStateException("grid-path-target-changed");
            }
            result.addProperty("heapUsedAfter", usedHeap());
            proof.require(proof.token, GridReadSymbols.document(proxy),
                GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
            result.addProperty("documentTaskNanos", System.nanoTime() - entered);
            if (result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1024 * 1024)
                throw new IllegalStateException("grid-result-byte-limit");
            return new Capture(result, proof);
        }, completed -> {
            busy = false;
            try {
                guard(target);
                epoch = completed.epoch;
                epochTarget = target;
                completed.result.addProperty("completionNanos", System.nanoTime() - queued);
                reply.result(completed.result, 0);
            } catch (Exception error) {
                safety.error(error);
                if (writeAttempted.get() || kind == Write.ATTACH || safety.pendingReadback()) safety.lock();
                epoch = null; epochTarget = null;
                reply.error(failure(operationId, writeAttempted.get(), error), 0);
            }
        }, error -> {
            safety.error(error);
            if (writeAttempted.get() || kind == Write.ATTACH || safety.pendingReadback()) safety.lock();
            busy = false; epoch = null; epochTarget = null;
            reply.error(failure(operationId, writeAttempted.get(), error), 0);
        }, () -> {
            busy = false; safety.lock(); epoch = null; epochTarget = null;
            Exception error = new IllegalStateException("grid-operation-timeout; native work is not cancelled; no retry; inspect or restart the host");
            safety.error(error); reply.error(failure(operationId, writeAttempted.get(), error), 0);
        }, taskState);
    }

    private Exception failure(String operationId, boolean attempted, Throwable error) {
        JsonObject lifecycle = safety.status(job != null && job.unfinished()).getAsJsonObject("lifecycle");
        String message = operationId + ":writeAttempted=" + attempted + ":stage=" + lifecycle.get("stage")
            + ":" + GridModuleAttachment.errorText(error) + "; details in attachmentStatus";
        return new IllegalStateException(message.substring(0, Math.min(message.length(), 4096)));
    }

    private record Capture(JsonObject result, GridReadEpoch epoch) {}

    private static long usedHeap() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }
}

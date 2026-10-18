package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.*;
import com.google.gson.JsonObject;
import java.util.UUID;

/** 9a research entry points. Only the named disposable fixture is admitted. */
public final class GridProbeHandlers extends HandlerGroup {
    public static final String MARKER = "9a-grid-factory-v8";
    private GridReadSymbols symbols;
    private GridReadEpoch epoch;
    private boolean busy, timedOut;
    private Target epochTarget;
    private String factoryEpoch;
    private int factoryAttempts;

    public GridProbeHandlers(ControllerHost host, Rig rig, ExecState state) { super(host, rig, state); }

    @Override public void register(HandlerRegistry r) {
        r.onAsync("probe.gridRead", (params, reply) -> request(params, reply, Write.NONE));
        r.onAsync("probe.gridValue", (params, reply) -> request(params, reply, Write.VALUE));
        r.onAsync("probe.gridCable", (params, reply) -> request(params, reply, Write.CABLE));
        r.onAsync("probe.gridModuleDelete", (params, reply) -> request(params, reply, Write.DELETE));
        r.onAsync("probe.gridModuleFactory", (params, reply) -> request(params, reply, Write.FACTORY));
    }

    private enum Write { NONE, VALUE, CABLE, DELETE, FACTORY }

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
        if (timedOut) throw new IllegalStateException("grid-operation-uncertain; reload the probe before another request");
        if (busy) throw new IllegalStateException("grid-read-busy");
        boolean write = kind != Write.NONE;
        String operation = write ? switch (kind) {
            case VALUE -> "setValue"; case CABLE -> "setCable"; case DELETE -> "deleteModule"; case FACTORY -> "detachedFactory";
            default -> throw new IllegalStateException("unexpected write kind");
        } : params.get("operation").getAsString();
        if (operation.equals("release")) {
            if (epoch == null || !epoch.token.equals(params.get("epoch").getAsString()))
                throw new IllegalStateException("stale-grid-epoch");
            epoch = null; epochTarget = null;
            reply.result(ok(), 0); return;
        }
        if (!write && !operation.equals("bind") && !operation.equals("read") && !operation.equals("schema"))
            throw new IllegalArgumentException("operation must be bind, read, schema, or release");
        boolean capture = !operation.equals("bind");
        if (write && (params.has("path") || params.has("projection") || params.has("operation")))
            throw new IllegalArgumentException("the fixture write has a fixed path and projection");
        GridFixtureValue.Input input = kind == Write.VALUE ? GridFixtureValue.parse(params) : null;
        GridFixtureCable.Input cable = kind == Write.CABLE ? GridFixtureCable.parse(params)
            : kind == Write.DELETE ? GridFixtureModuleDelete.parse(params)
            : kind == Write.FACTORY ? GridFactorySymbols.parse(params) : null;
        GridReadExplore.Query query = write ? GridFixtureValue.query() : GridReadExplore.Query.parse(params);
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
        if (kind == Write.FACTORY && (factoryAttempts >= 2 || token.equals(factoryEpoch)))
            throw new IllegalStateException("factory-attempt-limit; use a fresh epoch; maximum two calls per initialization");
        if (symbols == null) symbols = new GridReadSymbols(host.getClass());
        Object proxy = rig.cursorDeviceBanks[0].getDevice(index);
        String operationId = UUID.randomUUID().toString();
        long queued = System.nanoTime();
        var writeAttempted = new java.util.concurrent.atomic.AtomicBoolean();
        var lifecycle = new java.util.concurrent.atomic.AtomicReference<String>("not-attempted");
        busy = true;
        GridReadJob.start(task -> GridReadSymbols.queue(proxy, task), host::scheduleTask, () -> {
            long entered = System.nanoTime();
            GridReadSymbols.requireDocumentThread(proxy);
            Object document = GridReadSymbols.document(proxy);
            Object track = GridReadSymbols.target(rig.cursorTracks[0]);
            Object device = GridReadSymbols.target(proxy);
            GridReadEpoch proof = operation.equals("bind") ? new GridReadEpoch(document, track, device) : bound;
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
                    JsonObject graph = new GridGraphRead(explore.project(query.projection())).capture(root);
                    result.add("graph", graph);
                    if (kind == Write.FACTORY) {
                        GridFixtureCable.require(graph, cable);
                        GridFactorySymbols factory = new GridFactorySymbols(symbols, root.getClass().getClassLoader(), cable.moduleUuids());
                        proof.require(token, GridReadSymbols.document(proxy),
                            GridReadSymbols.target(rig.cursorTracks[0]), GridReadSymbols.target(proxy));
                        if (System.nanoTime() - queued > 4_000_000_000L)
                            throw new IllegalStateException("fixture-factory-deadline; no factory call");
                        factoryEpoch = token; factoryAttempts++;
                        writeAttempted.set(true);
                        result.add("lifecycle", GridDetachedFactory.run(factory, lifecycle::set));
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
                if (writeAttempted.get()) timedOut = true;
                epoch = null; epochTarget = null;
                reply.error(new IllegalStateException("writeAttempted=" + writeAttempted.get() + ":" + error.getMessage() + ":lifecycle=" + lifecycle.get(), error), 0);
            }
        }, error -> {
            if (writeAttempted.get()) timedOut = true;
            busy = false; epoch = null; epochTarget = null;
            reply.error(new IllegalStateException(operationId + ":writeAttempted=" + writeAttempted.get() + ":" + error.getMessage() + ":lifecycle=" + lifecycle.get(), error), 0);
        }, () -> {
            busy = false; timedOut = true; epoch = null; epochTarget = null;
            reply.error(new IllegalStateException("grid-operation-timeout:" + operationId
                + ":writeAttempted=" + writeAttempted.get() + ":lifecycle=" + lifecycle.get() + "; native work is not cancelled; no retry; inspect or restart the host"), 0);
        });
    }

    private record Capture(JsonObject result, GridReadEpoch epoch) {}

    private static long usedHeap() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }
}

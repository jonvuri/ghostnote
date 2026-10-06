package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.RuntimeProfile;
import com.ghostnote.extension.WriteGate;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/**
 * The wire method table: one map, populated by the handler groups at construction
 * time, consulted on every request.
 *
 * This replaces the single 200-line switch that ProbeHandlers used to be. The
 * registry is the Bridge.Dispatcher. Since 8h3c every request passes the
 * {@link WriteGate}: a write waits behind an open clip read.
 */
public final class HandlerRegistry implements Bridge.Dispatcher {
    /** A method that replies in a later controller task. It must call {@code reply} once. */
    @FunctionalInterface
    public interface AsyncHandler {
        void handle(JsonObject params, Bridge.Reply reply) throws Exception;
    }

    private final Map<String, Handler> handlers = new HashMap<>();
    private final Map<String, AsyncHandler> asyncHandlers = new HashMap<>();
    private final HashSet<String> offered = new HashSet<>();
    private final RuntimeProfile profile;
    private final WriteGate gate;

    public HandlerRegistry(RuntimeProfile profile, WriteGate gate) {
        this.profile = profile;
        this.gate = gate;
    }

    /**
     * ⚠ The duplicate check is not defensive padding — it closes a regression the
     * split itself introduced. A `switch` with two identical case labels does not
     * compile; a Map.put silently keeps the last one. Registering the same method
     * from two groups must be as loud as the compile error used to be.
     */
    public void on(String method, Handler handler) {
        if (offer(method) && handlers.put(method, handler) != null) {
            throw new IllegalStateException("duplicate handler registration: " + method);
        }
    }

    /** Register a method that replies later. It cannot run inside `batch.run`. */
    public void onAsync(String method, AsyncHandler handler) {
        if (offer(method) && asyncHandlers.put(method, handler) != null) {
            throw new IllegalStateException("duplicate handler registration: " + method);
        }
    }

    private boolean offer(String method) {
        if (!offered.add(method)) {
            throw new IllegalStateException("duplicate handler declaration: " + method);
        }
        return profile.includes(method);
    }

    public void register(HandlerGroup... groups) {
        for (HandlerGroup group : groups) {
            group.register(this);
        }
        profile.verifyRegistrations(offered);
    }

    @Override
    public void dispatch(String method, JsonObject params, Bridge.Reply reply) {
        Handler handler = handlers.get(method);
        AsyncHandler async = asyncHandlers.get(method);
        if (handler == null && async == null) {
            reply.error(new Bridge.MethodNotFoundException(method), 0);
            return;
        }
        boolean admitted = gate.submit(RuntimeProfile.kind(method), queued -> {
            try {
                if (async != null) {
                    async.handle(params, new Bridge.Reply() {
                        @Override public void result(JsonElement result, long ignored) { reply.result(result, queued); }
                        @Override public void error(Exception error, long ignored) { reply.error(error, queued); }
                    });
                } else {
                    reply.result(handler.handle(params), queued);
                }
            } catch (Exception error) {
                reply.error(error, queued);
            }
        });
        if (!admitted) {
            reply.error(new IllegalStateException("write queue is full: " + gate.waiting()
                + " requests wait behind an open clip read. Nothing was applied."), 0);
        }
    }

    /**
     * Run one synchronous method in the current task. `batch.run` uses this: the batch already passed the gate
     * as one write.
     */
    public JsonElement invoke(String method, JsonObject params) throws Exception {
        if (asyncHandlers.containsKey(method)) {
            throw new IllegalArgumentException(method + " replies later and cannot run inside a batch");
        }
        Handler handler = handlers.get(method);
        if (handler == null) {
            throw new Bridge.MethodNotFoundException(method);
        }
        return handler.handle(params);
    }

    /** Every registered method, sorted — the input to the `methodsHash` handshake. */
    public List<String> methodNames() {
        return java.util.stream.Stream.concat(handlers.keySet().stream(), asyncHandlers.keySet().stream())
            .sorted().toList();
    }

    public RuntimeProfile profile() {
        return profile;
    }

    public WriteGate gate() {
        return gate;
    }
}

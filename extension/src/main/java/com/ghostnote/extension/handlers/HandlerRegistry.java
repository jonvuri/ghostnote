package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Bridge;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The wire method table: one map, populated by the handler groups at construction
 * time, consulted on every request.
 *
 * This replaces the single 200-line switch that ProbeHandlers used to be. Bridge
 * is unchanged — the registry simply IS the Bridge.Dispatcher it already expected.
 */
public final class HandlerRegistry implements Bridge.Dispatcher {
    private final Map<String, Handler> handlers = new HashMap<>();

    /**
     * ⚠ The duplicate check is not defensive padding — it closes a regression the
     * split itself introduced. A `switch` with two identical case labels does not
     * compile; a Map.put silently keeps the last one. Registering the same method
     * from two groups must be as loud as the compile error used to be.
     */
    public void on(String method, Handler handler) {
        if (handlers.put(method, handler) != null) {
            throw new IllegalStateException("duplicate handler registration: " + method);
        }
    }

    public void register(HandlerGroup... groups) {
        for (HandlerGroup group : groups) {
            group.register(this);
        }
    }

    @Override
    public JsonElement dispatch(String method, JsonObject params) throws Exception {
        Handler handler = handlers.get(method);
        if (handler == null) {
            throw new Bridge.MethodNotFoundException(method);
        }
        return handler.handle(params);
    }

    /** Every registered method, sorted — the input to the `methodsHash` handshake. */
    public List<String> methodNames() {
        return handlers.keySet().stream().sorted().toList();
    }
}

package com.ghostnote.extension.handlers;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * One wire method. Runs on the control-surface thread (the Bridge marshals every
 * request through host.scheduleTask), so implementations need no synchronization.
 *
 * Throwing is the normal way to fail: Bridge maps IllegalArgumentException to
 * JSON-RPC -32602 and anything else to -32603.
 */
@FunctionalInterface
public interface Handler {
    JsonElement handle(JsonObject params) throws Exception;
}

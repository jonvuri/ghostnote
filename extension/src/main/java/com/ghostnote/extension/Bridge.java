package com.ghostnote.extension;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;

/**
 * TCP bridge speaking newline-delimited JSON-RPC 2.0.
 *
 * Derived from daw-mcp's MCPServer.java (MIT, see NOTICE) with two changes:
 * - binds to loopback only; the socket is unauthenticated (INITIAL_PROMPT §8j)
 * - strict one-message-per-line framing: a malformed line gets an immediate
 *   -32700 response instead of poisoning an accumulation buffer
 *
 * Requests are marshaled onto the control-surface thread via
 * host.scheduleTask; responses may therefore complete out of order and are
 * correlated by JSON-RPC id.
 */
public class Bridge {
    public interface Dispatcher {
        JsonElement dispatch(String method, JsonObject params) throws Exception;
    }

    /**
     * Research timing sink (8h3b). It records the controller-thread phases of one request. Normal builds set
     * no sink, and the request path is then unchanged.
     */
    public interface Timing {
        void record(String id, String method, long receivedNanos, long startNanos, long dispatchedNanos,
                    long serializedNanos, long writtenNanos, int chars);
    }

    private final int port;
    private final ControllerHost host;
    private final Dispatcher dispatcher;
    private final Gson gson = new Gson();
    private final AtomicBoolean running = new AtomicBoolean(false);

    private ServerSocket serverSocket;
    private ExecutorService executor;
    private volatile Timing timing;

    public Bridge(int port, ControllerHost host, Dispatcher dispatcher) {
        this.port = port;
        this.host = host;
        this.dispatcher = dispatcher;
    }

    public void setTiming(Timing timing) { this.timing = timing; }

    public void start() throws IOException {
        serverSocket = new ServerSocket(port, 8, InetAddress.getLoopbackAddress());
        executor = Executors.newCachedThreadPool();
        running.set(true);

        executor.submit(() -> {
            while (running.get()) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    host.println("[ghostnote] client connected: " + clientSocket.getRemoteSocketAddress());
                    executor.submit(() -> handleClient(clientSocket));
                } catch (IOException e) {
                    if (running.get()) {
                        host.errorln("[ghostnote] accept error: " + e.getMessage());
                    }
                }
            }
        });
    }

    public void stop() {
        running.set(false);
        try {
            if (serverSocket != null) {
                serverSocket.close();
            }
        } catch (IOException e) {
            host.errorln("[ghostnote] error closing server socket: " + e.getMessage());
        }
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    private void handleClient(Socket clientSocket) {
        try (
            BufferedReader in = new BufferedReader(
                new InputStreamReader(clientSocket.getInputStream(), StandardCharsets.UTF_8));
            PrintWriter out = new PrintWriter(clientSocket.getOutputStream(), true)
        ) {
            String line;
            while ((line = in.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }

                JsonObject request;
                try {
                    request = gson.fromJson(line, JsonObject.class);
                    if (request == null) {
                        throw new JsonSyntaxException("empty message");
                    }
                } catch (JsonSyntaxException e) {
                    writeLine(out, errorResponse(null, -32700, "Parse error: not a JSON object"));
                    continue;
                }

                final JsonObject req = request;
                final Timing sink = timing;
                if (sink == null) {
                    host.scheduleTask(() -> writeLine(out, processRequest(req)), 0);
                } else {
                    final long received = System.nanoTime();
                    host.scheduleTask(() -> timed(sink, out, req, received), 0);
                }
            }
        } catch (IOException e) {
            host.println("[ghostnote] client disconnected: " + e.getMessage());
        }
    }

    // Called from the control-surface thread (scheduleTask) per request;
    // synchronized so concurrent in-flight responses can't interleave lines.
    private void writeLine(PrintWriter out, JsonObject response) {
        synchronized (out) {
            out.println(gson.toJson(response));
        }
    }

    private void timed(Timing sink, PrintWriter out, JsonObject request, long received) {
        long start = System.nanoTime();
        JsonObject response = processRequest(request);
        long dispatched = System.nanoTime();
        String line = gson.toJson(response);
        long serialized = System.nanoTime();
        synchronized (out) {
            out.println(line);
        }
        long written = System.nanoTime();
        JsonElement id = request.get("id"), method = request.get("method");
        sink.record(id != null && id.isJsonPrimitive() ? id.getAsString() : null,
            method != null && method.isJsonPrimitive() ? method.getAsString() : null,
            received, start, dispatched, serialized, written, line.length());
    }

    private JsonObject processRequest(JsonObject request) {
        JsonElement id = request.get("id");

        if (!request.has("method") || !request.get("method").isJsonPrimitive()) {
            return errorResponse(id, -32600, "Invalid Request: missing method");
        }

        String method = request.get("method").getAsString();
        JsonObject params = request.has("params") && request.get("params").isJsonObject()
                ? request.getAsJsonObject("params")
                : new JsonObject();

        try {
            JsonElement result = dispatcher.dispatch(method, params);
            JsonObject response = baseResponse(id);
            response.add("result", result);
            return response;
        } catch (Bridge.MethodNotFoundException e) {
            return errorResponse(id, -32601, "Method not found: " + method);
        } catch (IllegalArgumentException e) {
            return errorResponse(id, -32602, "Invalid params: " + e.getMessage());
        } catch (Exception e) {
            host.errorln("[ghostnote] error executing " + method + ": " + e);
            return errorResponse(id, -32603, "Internal error: " + e.getMessage());
        }
    }

    private JsonObject baseResponse(JsonElement id) {
        JsonObject response = new JsonObject();
        response.addProperty("jsonrpc", "2.0");
        if (id != null) {
            response.add("id", id);
        }
        return response;
    }

    private JsonObject errorResponse(JsonElement id, int code, String message) {
        JsonObject response = baseResponse(id);
        JsonObject error = new JsonObject();
        error.addProperty("code", code);
        error.addProperty("message", message);
        response.add("error", error);
        return response;
    }

    public static class MethodNotFoundException extends RuntimeException {
        public MethodNotFoundException(String method) {
            super(method);
        }
    }
}

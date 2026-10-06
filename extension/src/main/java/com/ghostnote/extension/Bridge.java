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
    /**
     * Run one request. The dispatcher calls {@link Reply} once, in this task or in a later controller task:
     * a request can wait behind an open clip read (8h3c).
     */
    public interface Dispatcher {
        void dispatch(String method, JsonObject params, Reply reply);
    }

    /** The one outcome of a request. {@code queuedNanos} is the time that it waited behind a read, or zero. */
    public interface Reply {
        void result(JsonElement result, long queuedNanos);
        void error(Exception error, long queuedNanos);
    }

    private final int port;
    private final ControllerHost host;
    private final Dispatcher dispatcher;
    private final Gson gson = new Gson();
    private final AtomicBoolean running = new AtomicBoolean(false);

    private ServerSocket serverSocket;
    private ExecutorService executor;

    public Bridge(int port, ControllerHost host, Dispatcher dispatcher) {
        this.port = port;
        this.host = host;
        this.dispatcher = dispatcher;
    }

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
                host.scheduleTask(() -> processRequest(req, response -> writeLine(out, response)), 0);
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

    private void processRequest(JsonObject request, java.util.function.Consumer<JsonObject> send) {
        JsonElement id = request.get("id");

        if (!request.has("method") || !request.get("method").isJsonPrimitive()) {
            send.accept(errorResponse(id, -32600, "Invalid Request: missing method"));
            return;
        }

        String method = request.get("method").getAsString();
        JsonObject params = request.has("params") && request.get("params").isJsonObject()
                ? request.getAsJsonObject("params")
                : new JsonObject();

        dispatcher.dispatch(method, params, new Reply() {
            @Override
            public void result(JsonElement result, long queuedNanos) {
                JsonObject response = baseResponse(id);
                response.add("result", result);
                queued(response, queuedNanos);
                send.accept(response);
            }

            @Override
            public void error(Exception e, long queuedNanos) {
                JsonObject response;
                if (e instanceof Bridge.MethodNotFoundException) {
                    response = errorResponse(id, -32601, "Method not found: " + method);
                } else if (e instanceof IllegalArgumentException) {
                    response = errorResponse(id, -32602, "Invalid params: " + e.getMessage());
                } else {
                    host.errorln("[ghostnote] error executing " + method + ": " + e);
                    response = errorResponse(id, -32603, "Internal error: " + e.getMessage());
                }
                queued(response, queuedNanos);
                send.accept(response);
            }
        });
    }

    /** 8h3c: a request that waited behind an open clip read reports its wait. */
    private static void queued(JsonObject response, long queuedNanos) {
        if (queuedNanos > 0) response.addProperty("queuedMs", queuedNanos / 1e6);
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

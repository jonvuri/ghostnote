package com.ghostnote.extension;

import com.google.gson.*;
import java.lang.reflect.Array;
import java.nio.charset.StandardCharsets;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.UUID;

/** Bounded descriptor capture for 9a. References belong to one capture only. */
public final class GridGraphRead {
    public static final int MAX_WORK = 4096;
    public static final int MAX_BYTES = 1024 * 1024;
    public static final int MAX_DEPTH = 12;
    public static final int MAX_SCALAR = 4096;
    public static final int MAX_ARRAY = 256;

    public interface Reader {
        default String scope() { return "serializer-descriptors plus explicit root bridge; semantic Grid gate not yet proved"; }
        default String inclusion() { return "serializer-filter"; }
        default void work() {}
        String name(Object object) throws Exception;
        int classId(Object object) throws Exception;
        List<?> properties(Object object) throws Exception;
        int id(Object property) throws Exception;
        String propertyName(Object property) throws Exception;
        boolean included(Object property, Object object) throws Exception;
        default boolean rootBridge(Object property, Object object) throws Exception { return false; }
        boolean relationship(Object property);
        int childCount(Object property, Object object) throws Exception;
        Object child(Object property, Object object, int index) throws Exception;
        Object value(Object property, Object object) throws Exception;
    }

    private final Reader reader;
    private final int workLimit, byteLimit, depthLimit;
    private final IdentityHashMap<Object, Integer> identities = new IdentityHashMap<>();
    private final JsonArray nodes = new JsonArray(), errors = new JsonArray();
    private int work, bytes = 4096, errorCount, scalarChars;
    private final long deadline = System.nanoTime() + 1_000_000_000L;
    private boolean stopped;

    public GridGraphRead(Reader reader) { this(reader, MAX_WORK, MAX_BYTES, MAX_DEPTH); }

    public GridGraphRead(Reader reader, int workLimit, int byteLimit, int depthLimit) {
        if (workLimit < 1 || workLimit > MAX_WORK || byteLimit < 8192 || byteLimit > MAX_BYTES
                || depthLimit < 0 || depthLimit > MAX_DEPTH) throw new IllegalArgumentException("invalid capture bounds");
        this.reader = reader;
        this.workLimit = workLimit;
        this.byteLimit = byteLimit;
        this.depthLimit = depthLimit;
    }

    public JsonObject capture(Object root) {
        long start = System.nanoTime();
        try {
            visit(root, 0);
            JsonObject result = new JsonObject();
            result.addProperty("complete", errorCount == 0);
            result.addProperty("scope", reader.scope());
            result.addProperty("identityScope", "capture-local; no cross-reload identity");
            result.addProperty("root", 0);
            result.add("nodes", nodes);
            result.add("errors", errors);
            result.addProperty("errorCount", errorCount);
            result.addProperty("work", work);
            result.addProperty("documentReadNanos", System.nanoTime() - start);
            result.addProperty("encodedBytes", 0);
            for (int i = 0; i < 3; i++)
                result.addProperty("encodedBytes", result.toString().getBytes(StandardCharsets.UTF_8).length);
            if (result.toString().getBytes(StandardCharsets.UTF_8).length > byteLimit)
                throw new IllegalStateException("capture byte accounting failed");
            return result;
        } finally {
            identities.clear();
        }
    }

    private boolean step() {
        if (stopped) return false;
        if (work >= workLimit || System.nanoTime() > deadline) {
            issue("work-or-time-limit"); stopped = true; return false;
        }
        work++;
        try { reader.work(); }
        catch (RuntimeException error) { issue(error.getMessage()); stopped = true; return false; }
        return true;
    }

    private void issue(String message) {
        errorCount++;
        String bounded = message.substring(0, Math.min(message.length(), 80)).replaceAll("[^ -~]", "?");
        if (errors.size() < 16) errors.add(bounded);
        if (errorCount >= 16) stopped = true;
    }

    private boolean charge(JsonElement value) {
        int size = value.toString().getBytes(StandardCharsets.UTF_8).length + 16;
        if (bytes + size > byteLimit) {
            issue("byte-limit"); stopped = true; return false;
        }
        bytes += size;
        return true;
    }

    private JsonElement visit(Object object, int depth) {
        if (object == null) { issue("null-relationship"); return JsonNull.INSTANCE; }
        Integer prior = identities.get(object);
        if (prior != null) return new JsonPrimitive(prior);
        if (depth > depthLimit) { issue("depth-limit"); return JsonNull.INSTANCE; }
        if (!step()) return JsonNull.INSTANCE;
        int id = identities.size();
        identities.put(object, id);
        JsonObject node = new JsonObject();
        node.addProperty("id", id);
        node.addProperty("runtimeClass", object.getClass().getName());
        JsonArray properties = new JsonArray();
        try {
            node.addProperty("className", bounded(reader.name(object)));
            node.addProperty("classId", reader.classId(object));
            if (!charge(node)) return JsonNull.INSTANCE;
            node.add("properties", properties);
            nodes.add(node);
            List<?> descriptors = reader.properties(object);
            if (descriptors.isEmpty()) issue("empty-descriptor-list:" + id);
            for (Object descriptor : descriptors) {
                if (!step()) break;
                try {
                    boolean included = reader.included(descriptor, object);
                    boolean bridge = depth == 0 && reader.rootBridge(descriptor, object);
                    if (!included && !bridge) continue;
                    JsonObject property = new JsonObject();
                    property.addProperty("inclusion", bridge ? "explicit-root-bridge" : reader.inclusion());
                    property.addProperty("id", reader.id(descriptor));
                    property.addProperty("name", bounded(reader.propertyName(descriptor)));
                    property.addProperty("descriptorClass", descriptor.getClass().getName());
                    if (reader.relationship(descriptor)) {
                        int count = reader.childCount(descriptor, object);
                        if (count < 0) throw new IllegalStateException("negative child count");
                        property.addProperty("kind", "relationship");
                        property.addProperty("count", count);
                        JsonArray refs = new JsonArray();
                        for (int i = 0; i < count; i++) {
                            if (!step()) break;
                            refs.add(visit(reader.child(descriptor, object, i), depth + 1));
                        }
                        property.add("refs", refs);
                    } else {
                        scalarChars = 0;
                        property.addProperty("kind", "value");
                        property.addProperty("domain", "unknown");
                        property.add("value", scalar(reader.value(descriptor, object), 0));
                    }
                    if (!charge(property)) break;
                    properties.add(property);
                } catch (Exception error) {
                    issue("property:" + id + ":" + cause(error));
                }
            }
        } catch (Exception error) {
            issue("node:" + id + ":" + cause(error));
        }
        return new JsonPrimitive(id);
    }

    private String bounded(String text) {
        if (text == null) return null;
        if (text.length() > MAX_SCALAR) { issue("scalar-limit"); return text.substring(0, MAX_SCALAR); }
        return text;
    }

    private static String cause(Exception error) {
        Throwable cause = error;
        while (cause.getCause() != null) cause = cause.getCause();
        return cause.toString();
    }

    private JsonObject scalar(Object value, int depth) {
        JsonObject out = new JsonObject();
        out.addProperty("type", value == null ? "null" : value.getClass().getName());
        if (value == null) out.add("data", JsonNull.INSTANCE);
        else if (value instanceof String s) {
            if (scalarChars + Math.min(s.length(), MAX_SCALAR) > 32768) issue("value-text-limit");
            else { String text = bounded(s); scalarChars += text.length(); out.addProperty("data", text); }
        }
        else if (value instanceof Boolean b) out.addProperty("data", b);
        else if (value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long) out.addProperty("data", value.toString());
        else if (value instanceof Float || value instanceof Double) {
            double d = ((Number) value).doubleValue();
            if (Double.isFinite(d)) out.addProperty("data", d);
            else { out.addProperty("data", value.toString()); issue("nonfinite-value"); }
        } else if (value instanceof UUID u) out.addProperty("data", u.toString());
        else if (value instanceof Enum<?> e) out.addProperty("data", e.name());
        else if (value.getClass().isArray() && depth == 0) {
            int count = Array.getLength(value);
            out.addProperty("length", count);
            if (count > MAX_ARRAY) issue("array-limit");
            if (value instanceof byte[]) issue("unknown-binary-value");
            JsonArray items = new JsonArray();
            for (int i = 0; i < Math.min(count, MAX_ARRAY); i++) {
                if (!step()) break;
                items.add(scalar(Array.get(value, i), depth + 1));
            }
            out.add("data", items);
        } else issue("unsupported-value:" + value.getClass().getName());
        return out;
    }
}

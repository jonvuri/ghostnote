package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Bounded descriptor discovery and explicit field projections. See E275. */
public final class GridReadExplore {
    public record Step(String parentClass, int propertyId, String propertyName, int index) {}
    public record Query(List<Step> path, Map<String, Set<Integer>> projection) {
        public static Query parse(JsonObject params) {
            List<Step> path = new ArrayList<>();
            if (params.has("path")) {
                JsonArray steps = params.getAsJsonArray("path");
                if (steps.size() > GridGraphRead.MAX_DEPTH) throw new IllegalArgumentException("path-limit");
                for (JsonElement item : steps) {
                    JsonObject step = item.getAsJsonObject();
                    int index = integer(step.get("index"));
                    if (index >= GridGraphRead.MAX_ARRAY) throw new IllegalArgumentException("path-index-limit");
                    path.add(new Step(label(step.get("parentClass")), integer(step.get("propertyId")),
                        label(step.get("propertyName")), index));
                }
            }
            Map<String, Set<Integer>> projection = new LinkedHashMap<>();
            if (params.has("projection")) {
                JsonObject rules = params.getAsJsonObject("projection");
                if (rules.size() < 1 || rules.size() > 32) throw new IllegalArgumentException("projection-class-limit");
                int total = 0;
                for (var entry : rules.entrySet()) {
                    String name = label(new JsonPrimitive(entry.getKey()));
                    Set<Integer> ids = new LinkedHashSet<>();
                    JsonArray values = entry.getValue().getAsJsonArray();
                    if (values.size() < 1 || values.size() > 64) throw new IllegalArgumentException("projection-field-limit");
                    for (JsonElement value : values)
                        if (!ids.add(integer(value))) throw new IllegalArgumentException("duplicate-projection-field");
                    total += ids.size();
                    if (total > 1024) throw new IllegalArgumentException("projection-limit");
                    projection.put(name, Set.copyOf(ids));
                }
            }
            return new Query(List.copyOf(path), Map.copyOf(projection));
        }
        private static int integer(JsonElement value) {
            if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber())
                throw new IllegalArgumentException("integer-required");
            int result = value.getAsBigDecimal().intValueExact();
            if (result < 0) throw new IllegalArgumentException("negative-query-index");
            return result;
        }
        private static String label(JsonElement value) {
            if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString())
                throw new IllegalArgumentException("query-label-required");
            String result = value.getAsString();
            if (result.isEmpty() || result.length() > 128) throw new IllegalArgumentException("query-label-limit");
            return result;
        }
    }

    private final GridGraphRead.Reader reader;
    private final long deadline = System.nanoTime() + 1_000_000_000L;
    private int work;
    public GridReadExplore(GridGraphRead.Reader reader) { this.reader = reader; }
    public int workUnits() { return work; }
    private void step() {
        if (++work > GridGraphRead.MAX_WORK || System.nanoTime() > deadline)
            throw new IllegalStateException("schema-work-or-time-limit");
    }
    private List<?> properties(Object object) throws Exception {
        List<?> result = reader.properties(object);
        if (result.size() > GridGraphRead.MAX_WORK) throw new IllegalStateException("schema-property-limit");
        return result;
    }
    public Object navigate(Object root, List<Step> path) throws Exception {
        Object current = root;
        for (Step part : path) {
            step();
            if (!part.parentClass.equals(reader.name(current))) throw new IllegalStateException("path-parent-changed");
            Object found = null;
            for (Object property : properties(current)) {
                step();
                if (reader.id(property) == part.propertyId) {
                    if (found != null) throw new IllegalStateException("ambiguous-path-property");
                    found = property;
                }
            }
            if (found == null || !reader.propertyName(found).equals(part.propertyName) || !reader.relationship(found))
                throw new IllegalStateException("path-property-changed");
            int count = reader.childCount(found, current);
            if (count < 0 || count > GridGraphRead.MAX_ARRAY || part.index >= count)
                throw new IllegalStateException("path-child-count-or-index");
            current = reader.child(found, current, part.index);
            if (current == null) throw new IllegalStateException("absent-path-child");
        }
        return current;
    }
    private JsonObject header(Object object) throws Exception {
        step();
        JsonObject result = new JsonObject();
        String name = reader.name(object), runtime = object.getClass().getName();
        if (name == null || name.length() > 4096 || runtime.length() > 4096)
            throw new IllegalStateException("schema-name-limit");
        result.addProperty("className", name);
        result.addProperty("classId", reader.classId(object));
        result.addProperty("runtimeClass", runtime);
        return result;
    }
    public JsonObject schema(Object object) throws Exception {
        JsonObject result = header(object);
        result.addProperty("scope", "one-object schema and child headers; no scalar values or semantic gate");
        JsonArray fields = new JsonArray();
        result.add("properties", fields);
        int bytes = 4096;
        for (Object property : properties(object)) {
            step();
            JsonObject field = new JsonObject();
            field.addProperty("id", reader.id(property));
            String name = reader.propertyName(property);
            if (name == null || name.length() > 4096) throw new IllegalStateException("schema-name-limit");
            field.addProperty("name", name);
            field.addProperty("serializerIncluded", reader.included(property, object));
            field.addProperty("relationship", reader.relationship(property));
            if (reader.relationship(property)) {
                int count = reader.childCount(property, object);
                if (count < 0 || count > GridGraphRead.MAX_ARRAY) throw new IllegalStateException("schema-child-limit");
                field.addProperty("count", count);
                JsonArray children = new JsonArray();
                for (int i = 0; i < count; i++) {
                    Object child = reader.child(property, object, i);
                    if (child == null) throw new IllegalStateException("schema-null-child");
                    JsonObject item = header(child); item.addProperty("index", i); children.add(item);
                }
                field.add("children", children);
            }
            bytes += field.toString().getBytes(StandardCharsets.UTF_8).length + 16;
            if (bytes > GridGraphRead.MAX_BYTES) throw new IllegalStateException("schema-byte-limit");
            fields.add(field);
        }
        result.addProperty("work", work);
        result.addProperty("complete", true);
        return result;
    }

    public GridGraphRead.Reader project(Map<String, Set<Integer>> projection) {
        if (projection.isEmpty()) return reader;
        return new GridGraphRead.Reader() {
            public void work() { step(); }
            public String scope() { return "explicit property projection; semantic Grid gate not yet proved"; }
            public String name(Object object) throws Exception { return reader.name(object); }
            public int classId(Object object) throws Exception { return reader.classId(object); }
            public List<?> properties(Object object) throws Exception {
                Set<Integer> wanted = projection.get(name(object));
                if (wanted == null) throw new IllegalStateException("unclassified-projection-class:" + name(object));
                List<Object> selected = new ArrayList<>();
                Set<Integer> found = new HashSet<>();
                for (Object field : GridReadExplore.this.properties(object)) {
                    step();
                    int id = reader.id(field);
                    if (wanted.contains(id)) {
                        if (!found.add(id)) throw new IllegalStateException("ambiguous-projection-field");
                        selected.add(field);
                    }
                }
                if (!found.equals(wanted)) throw new IllegalStateException("missing-projection-field:" + name(object));
                return selected;
            }
            public int id(Object property) throws Exception { return reader.id(property); }
            public String propertyName(Object property) throws Exception { return reader.propertyName(property); }
            public boolean included(Object property, Object object) throws Exception {
                // Evaluate the filter for failure reporting. The explicit projection selects the field.
                reader.included(property, object);
                return true;
            }
            public String inclusion() { return "explicit-projection"; }
            public boolean relationship(Object property) { return reader.relationship(property); }
            public int childCount(Object property, Object object) throws Exception { return reader.childCount(property, object); }
            public Object child(Object property, Object object, int index) throws Exception { return reader.child(property, object, index); }
            public Object value(Object property, Object object) throws Exception { return reader.value(property, object); }
        };
    }
}

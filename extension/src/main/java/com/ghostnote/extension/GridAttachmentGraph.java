package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;
import static com.ghostnote.extension.GridFixtureValue.*;

/** Scalar receipts for independent attachment readback. */
public final class GridAttachmentGraph {
    private GridAttachmentGraph() {}
    public static GridGraphRead.Reader bounded(GridGraphRead.Reader source) {
        return new GridGraphRead.Reader() {
            private int cables;
            public String scope() { return source.scope(); }
            public String inclusion() { return source.inclusion(); }
            public void work() { source.work(); }
            public String name(Object object) throws Exception { return source.name(object); }
            public int classId(Object object) throws Exception { return source.classId(object); }
            public List<?> properties(Object object) throws Exception { return source.properties(object); }
            public int id(Object property) throws Exception { return source.id(property); }
            public String propertyName(Object property) throws Exception { return source.propertyName(property); }
            public boolean included(Object property, Object object) throws Exception { return source.included(property, object); }
            public boolean rootBridge(Object property, Object object) throws Exception { return source.rootBridge(property, object); }
            public boolean relationship(Object property) { return source.relationship(property); }
            public int childCount(Object property, Object object) throws Exception {
                int count = source.childCount(property, object), id = source.id(property);
                if (id == 6428 && count > 5) throw new IllegalStateException("attachment-member-limit");
                if (id == 7125) {
                    if (count < 0 || count > 2 || cables + count > 2) throw new IllegalStateException("attachment-cable-limit");
                    cables += count;
                }
                return count;
            }
            public Object child(Object property, Object object, int index) throws Exception { return source.child(property, object, index); }
            public Object value(Object property, Object object) throws Exception { return source.value(property, object); }
        };
    }
    public static void requireDefaults(JsonObject graph) {
        JsonObject module = node(graph, graph.get("root").getAsInt());
        GridFactorySymbols.requireGraph(graph, scalar(module, 15).getAsString());
        if (graph.get("root").getAsInt() != 0 || scalar(module, 6679).getAsInt() != 0
                || scalar(module, 6680).getAsInt() != 0 || !scalar(module, 6977).getAsBoolean())
            throw new IllegalStateException("attachment-default-position-or-active");
        if (!refs(module, 406).toString().equals("[1]") || !refs(node(graph, 1), 173).toString().equals("[2,3,4,5,6,7]"))
            throw new IllegalStateException("attachment-default-relationships");
        String[] classes = {"module", "module_contents", "audio_source_atom", "bipolar_toggleable_decimal_value_atom",
            "boolean_panel_value", "audio_destination_atom", "nitro_atom", "boolean_value_atom"};
        for (int i = 0; i < 8; i++) if (!node(graph, i).get("className").getAsString().equals(classes[i]))
            throw new IllegalStateException("attachment-default-atom-order");
        JsonObject value = node(graph, 3), bipolar = node(graph, 4), input = node(graph, 5), stereo = node(graph, 7);
        if (!scalar(node(graph, 2), 3640).getAsString().equals("OUT") || !scalar(value, 701).getAsString().equals("VALUE")
                || scalar(value, 712).getAsDouble() != 1 || scalar(value, 949).getAsDouble() != 1 || scalar(value, 6406).getAsBoolean()
                || !scalar(bipolar, 6387).getAsString().equals("BIPOLAR") || scalar(bipolar, 6386).getAsBoolean()
                || !scalar(input, 7124).getAsString().equals("IN") || !refs(input, 7125).isEmpty()
                || scalar(input, 7234).getAsDouble() != 0 || scalar(node(graph, 6), 14).getAsInt() != 0
                || !scalar(stereo, 701).getAsString().equals("STEREOIZE") || scalar(stereo, 210).getAsBoolean()
                || scalar(stereo, 953).getAsBoolean()) throw new IllegalStateException("attachment-native-defaults-changed");
    }
    public static JsonArray expectedNodes(JsonObject before, JsonObject detached, JsonObject attached) {
        requireDefaults(detached);
        int managedId = attached.get("managedObjectId").getAsInt();
        if (managedId <= 0 || !attached.get("managedObjectRegistered").getAsBoolean())
            throw new IllegalStateException("attachment-managed-identity-unproved");
        JsonArray nodes = before.getAsJsonArray("nodes").deepCopy();
        for (JsonElement item : nodes) for (JsonElement p : item.getAsJsonObject().getAsJsonArray("properties")) {
            JsonObject field = p.getAsJsonObject();
            if (field.get("id").getAsInt() == 14 && field.getAsJsonObject("value").get("data").getAsInt() == managedId)
                throw new IllegalStateException("attachment-managed-identity-not-fresh");
        }
        if (nodes.size() != 53) throw new IllegalStateException("attachment-baseline-nodes");
        for (int i = 0; i < nodes.size(); i++) if (nodes.get(i).getAsJsonObject().get("id").getAsInt() != i)
            throw new IllegalStateException("attachment-node-order");
        JsonObject grid = nodes.get(before.get("root").getAsInt()).getAsJsonObject();
        JsonObject membership = property(grid, 6428); membership.getAsJsonArray("refs").add(53); membership.addProperty("count", 5);
        for (JsonElement item : detached.getAsJsonArray("nodes")) {
            JsonObject n = item.deepCopy().getAsJsonObject(); int id = n.get("id").getAsInt(); n.addProperty("id", id + 53);
            for (JsonElement p : n.getAsJsonArray("properties")) {
                JsonObject field = p.getAsJsonObject();
                if (field.has("refs")) {
                    JsonArray mapped = new JsonArray();
                    for (JsonElement ref : field.getAsJsonArray("refs")) mapped.add(ref.getAsInt() + 53);
                    field.add("refs", mapped);
                }
            }
            if (id == 0) property(n, 6679).getAsJsonObject("value").addProperty("data", "2");
            if (id == 6) property(n, 14).getAsJsonObject("value").addProperty("data", Integer.toString(managedId));
            nodes.add(n);
        }
        return nodes;
    }
    public static JsonObject expectedWitness(JsonObject before, JsonObject attached) {
        JsonObject expected = before.deepCopy();
        expected.getAsJsonArray("moduleUuids").add(attached.get("uuid"));
        expected.getAsJsonArray("rectangles").add(attached.get("rectangle").deepCopy());
        return expected;
    }
    public static void requireRead(JsonObject graph, JsonObject witness, JsonArray expected, JsonObject expectedWitness) {
        if (!graph.get("complete").getAsBoolean() || graph.get("errorCount").getAsInt() != 0
                || !graph.getAsJsonArray("nodes").equals(expected) || !witness.equals(expectedWitness))
            throw new IllegalStateException("attachment-independent-readback-disagrees");
    }
}

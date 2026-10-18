package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;
import static com.ghostnote.extension.GridFixtureValue.*;

/** Fixed deltas for the eleven engine stages. Values use the native cubic scale. */
public final class GridEngineGraph {
    public static final double QUARTER = 0.6299605249474366, HALF = 0.7937005259840998;
    private GridEngineGraph() {}
    public static List<String> uuids(JsonObject graph) {
        List<String> ids = new ArrayList<>();
        for (JsonElement id : refs(node(graph, 0), 6428)) ids.add(scalar(node(graph, id.getAsInt()), 15).getAsString());
        return List.copyOf(ids);
    }
    public static void baseline(JsonObject graph) {
        GridFixtureCable.require(graph, new GridFixtureCable.Input(uuids(graph), "none", "sine", graph.getAsJsonArray("nodes")));
    }
    public static void baselineWitness(JsonObject witness) {
        if (!witness.get("parentsVerified").getAsBoolean()) throw new IllegalStateException("engine-baseline-parents");
        JsonObject selection = witness.getAsJsonObject("selection");
        if (selection.size() != 1 || !selection.getAsJsonArray("selected").isEmpty()) throw new IllegalStateException("engine-baseline-selection");
        JsonObject edit = witness.getAsJsonObject("edit");
        for (String key : List.of("frames", "instant", "longer", "locks"))
            if (edit.get(key).getAsInt() != 0) throw new IllegalStateException("engine-baseline-edit");
        if (edit.get("lockSet").getAsBoolean() || edit.get("active").getAsBoolean()) throw new IllegalStateException("engine-baseline-edit");
        int[][] expected = {{-4,-2,3,2},{-1,-2,1,1},{0,-2,1,1},{-1,0,1,1}};
        JsonArray rectangles = witness.getAsJsonArray("rectangles");
        if (rectangles.size() != 4) throw new IllegalStateException("engine-baseline-layout");
        String[] keys = {"x","y","width","height"};
        for (int i=0;i<4;i++) for (int j=0;j<4;j++)
            if (rectangles.get(i).getAsJsonObject().get(keys[j]).getAsInt() != expected[i][j])
                throw new IllegalStateException("engine-baseline-layout");
    }
    public static int atom(JsonObject graph, int module, int index) {
        JsonObject m = node(graph, refs(node(graph, 0), 6428).get(module).getAsInt());
        JsonObject c = node(graph, refs(m, 406).get(0).getAsInt());
        return refs(c, 173).get(index).getAsInt();
    }
    public static double value(int stage) {
        return switch (stage) { case 1, 6 -> 0; case 2 -> QUARTER; case 7 -> HALF; case 8 -> 1;
            default -> throw new IllegalArgumentException("not-value-stage"); };
    }
    public static int destination(int stage) { return switch (stage) { case 4, 10 -> 4; case 5, 9 -> 2;
        default -> throw new IllegalArgumentException("not-cable-stage"); }; }
    public static int sourceBefore(int stage) { return switch (stage) { case 4 -> -1; case 5, 10 -> 1; case 9 -> 4;
        default -> throw new IllegalArgumentException("not-cable-stage"); }; }
    public static int sourceAfter(int stage) { return switch (stage) { case 4, 9 -> 1; case 5 -> 4; case 10 -> -1;
        default -> throw new IllegalArgumentException("not-cable-stage"); }; }
    public static JsonArray expected(JsonObject graph, int stage) {
        JsonObject copy = graph.deepCopy();
        if (Set.of(1, 2, 6, 7, 8).contains(stage)) {
            JsonObject a = node(copy, atom(copy, stage <= 2 ? 1 : 4, 1));
            for (int field : new int[]{712, 949}) property(a, field).getAsJsonObject("value").addProperty("data", value(stage));
        } else if (Set.of(4, 5, 9, 10).contains(stage)) {
            int module = destination(stage), index = module == 2 ? 0 : 3;
            JsonObject p = property(node(copy, atom(copy, module, index)), 7125);
            JsonArray edges = new JsonArray(); int source = sourceAfter(stage);
            if (source >= 0) edges.add(atom(copy, source, 0));
            p.add("refs", edges); p.addProperty("count", edges.size());
        } else if (stage == 11) {
            JsonObject members = property(node(copy, 0), 6428);
            if (members.getAsJsonArray("refs").size() != 5) throw new IllegalStateException("engine-delete-members");
            members.getAsJsonArray("refs").remove(4); members.addProperty("count", 4);
        } else throw new IllegalArgumentException("stage-needs-attachment-receipt");
        return reorder(copy);
    }
    /** An outgoing reference can change traversal order. Reassign capture-local IDs. */
    public static JsonArray reorder(JsonObject graph) {
        JsonArray result = new JsonArray(); Map<Integer,Integer> ids = new HashMap<>();
        visit(graph, graph.get("root").getAsInt(), ids, result);
        if (result.size() > 61) throw new IllegalStateException("engine-node-limit");
        return result;
    }
    private static int visit(JsonObject graph, int old, Map<Integer,Integer> ids, JsonArray result) {
        if (ids.containsKey(old)) return ids.get(old);
        int id = result.size(); ids.put(old, id); JsonObject n = node(graph, old).deepCopy();
        n.addProperty("id", id); result.add(n);
        for (JsonElement item : n.getAsJsonArray("properties")) {
            JsonObject p = item.getAsJsonObject(); if (!p.has("refs")) continue;
            JsonArray mapped = new JsonArray();
            for (JsonElement ref : p.getAsJsonArray("refs")) mapped.add(visit(graph, ref.getAsInt(), ids, result));
            p.add("refs", mapped);
        }
        return id;
    }
    public static JsonObject witnessAfter(JsonObject witness, int stage) {
        JsonObject after = witness.deepCopy();
        if (stage == 11) { after.getAsJsonArray("moduleUuids").remove(4); after.getAsJsonArray("rectangles").remove(4); }
        return after;
    }
}

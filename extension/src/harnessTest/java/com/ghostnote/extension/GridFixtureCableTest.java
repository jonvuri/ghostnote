package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.file.*;
import java.util.function.Consumer;
import static com.ghostnote.extension.GridFixtureValue.*;

/** Check cable guards against an independent host capture and changed copies. */
public final class GridFixtureCableTest {
    private static void refuses(Runnable action) {
        try { action.run(); } catch (RuntimeException expected) { return; }
        throw new AssertionError("expected cable refusal");
    }
    private static JsonObject request(JsonObject graph, String before, String after) {
        JsonObject request = new JsonObject();
        JsonArray uuids = new JsonArray();
        for (JsonElement id : refs(node(graph, graph.get("root").getAsInt()), 6428))
            uuids.add(scalar(node(graph, id.getAsInt()), 15));
        request.add("moduleUuids", uuids);
        request.addProperty("before", before); request.addProperty("after", after);
        request.add("expectedNodes", graph.getAsJsonArray("nodes").deepCopy());
        return request;
    }
    private static void scalarChange(JsonObject graph, int id, int field, JsonElement value) {
        property(node(graph, id), field).getAsJsonObject("value").add("data", value);
    }
    private static void edge(JsonObject graph, int id, Integer source) {
        JsonObject p = property(node(graph, id), 7125);
        JsonArray refs = new JsonArray(); if (source != null) refs.add(source);
        p.add("refs", refs); p.addProperty("count", refs.size());
    }
    private static void changed(JsonObject baseline, Consumer<JsonObject> change) {
        JsonObject copy = baseline.deepCopy(); change.accept(copy);
        refuses(() -> GridFixtureCable.require(copy, GridFixtureCable.parse(request(copy, "none", "sine"))));
    }
    public static void run() throws Exception {
        JsonObject graph = JsonParser.parseString(Files.readString(Path.of(System.getProperty("gridFixtureBaseline"))))
            .getAsJsonObject().getAsJsonObject("graph");
        var input = GridFixtureCable.parse(request(graph, "none", "sine"));
        GridFixtureCable.require(graph, input);
        JsonObject connected = graph.deepCopy(); edge(connected, 50, 5);
        GridFixtureCable.require(connected, GridFixtureCable.parse(request(connected, "sine", "none")));
        GridFixtureCable.require(connected, GridFixtureCable.parse(request(connected, "sine", "amplify")));
        GridFixtureCable.require(graph, GridFixtureCable.parse(request(graph, "none", "amplify")));
        JsonObject retargeted = graph.deepCopy(); edge(retargeted, 50, 26);
        GridFixtureCable.require(retargeted, GridFixtureCable.parse(request(retargeted, "amplify", "sine")));
        GridFixtureCable.require(retargeted, GridFixtureCable.parse(request(retargeted, "amplify", "none")));
        for (JsonObject state : new JsonObject[]{graph, connected, retargeted}) {
            String source = state == graph ? "none" : state == connected ? "sine" : "amplify";
            JsonObject deletion = request(state, source, "unused");
            deletion.remove("after");
            GridFixtureCable.require(state, GridFixtureModuleDelete.parse(deletion));
            deletion.addProperty("before", "other");
            refuses(() -> GridFixtureModuleDelete.parse(deletion));
        }
        refuses(() -> GridFixtureModuleDelete.parse(request(graph, "none", "sine")));
        if (GridFixtureModuleDelete.modulePath().size() != 3
                || GridFixtureModuleDelete.modulePath().get(2).index() != 3)
            throw new AssertionError("module deletion route changed");
        refuses(() -> GridFixtureCable.require(retargeted, GridFixtureCable.parse(request(retargeted, "sine", "amplify"))));
        refuses(() -> GridFixtureCable.require(connected, input));
        refuses(() -> GridFixtureCable.require(graph, GridFixtureCable.parse(request(graph, "sine", "none"))));
        for (String[] pair : new String[][]{{"none", "none"}, {"sine", "sine"}, {"amplify", "amplify"},
                {"none", "spare"}, {"other", "none"}})
            refuses(() -> GridFixtureCable.parse(request(graph, pair[0], pair[1])));
        JsonObject stale = request(graph, "none", "sine");
        stale.getAsJsonArray("moduleUuids").set(0, new JsonPrimitive("00000000-0000-0000-0000-000000000000"));
        refuses(() -> GridFixtureCable.require(graph, GridFixtureCable.parse(stale)));
        stale.getAsJsonArray("moduleUuids").set(0, stale.getAsJsonArray("moduleUuids").get(1));
        refuses(() -> GridFixtureCable.parse(stale));
        changed(graph, g -> g.addProperty("complete", false));
        changed(graph, g -> g.addProperty("errorCount", 1));
        changed(graph, g -> edge(g, 50, 5));
        changed(graph, g -> edge(g, 50, 26));
        changed(graph, g -> edge(g, 34, 47));
        changed(graph, g -> edge(g, 29, null));
        changed(graph, g -> edge(g, 6, 26));
        changed(graph, g -> property(node(g, 50), 7125).addProperty("count", 1));
        changed(graph, g -> scalarChange(g, 48, 712, new JsonPrimitive(GridFixtureValue.CHANGED)));
        changed(graph, g -> scalarChange(g, 3, 949, new JsonPrimitive(1)));
        changed(graph, g -> scalarChange(g, 48, 6406, new JsonPrimitive(true)));
        changed(graph, g -> scalarChange(g, 50, 7124, new JsonPrimitive("OTHER")));
        changed(graph, g -> scalarChange(g, 5, 3640, new JsonPrimitive("OTHER")));
        changed(graph, g -> scalarChange(g, 26, 3640, new JsonPrimitive("OTHER")));
        changed(graph, g -> scalarChange(g, 45, 6680, new JsonPrimitive("1")));
        changed(graph, g -> scalarChange(g, 1, 6977, new JsonPrimitive(false)));
        changed(graph, g -> scalarChange(g, 46, 6369, new JsonPrimitive("other")));
        if (GridFixtureCable.atomPath(3, 3).size() != 5) throw new AssertionError("cable route changed");
        Object sine = new Object(), amplifier = new Object();
        if (GridFixtureCable.source("sine", sine, amplifier) != sine
                || GridFixtureCable.source("amplify", sine, amplifier) != amplifier
                || GridFixtureCable.source("none", sine, amplifier) != null)
            throw new AssertionError("source identity mapping changed");
        refuses(() -> GridFixtureCable.source("spare", sine, amplifier));
    }
}

package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.file.*;

/** Check write refusals against the independently captured fixture. */
public final class GridFixtureValueTest {
    private static void refuses(Runnable action) {
        try { action.run(); } catch (RuntimeException expected) { return; }
        throw new AssertionError("expected refusal");
    }
    private static JsonObject property(JsonObject graph, int node, int property) {
        for (JsonElement n : graph.getAsJsonArray("nodes"))
            if (n.getAsJsonObject().get("id").getAsInt() == node)
                for (JsonElement p : n.getAsJsonObject().getAsJsonArray("properties"))
                    if (p.getAsJsonObject().get("id").getAsInt() == property) return p.getAsJsonObject();
        throw new AssertionError("fixture property missing");
    }
    private static GridFixtureValue.Input input(JsonObject graph) {
        String uuid = property(graph, 45, 15).getAsJsonObject("value").get("data").getAsString();
        return new GridFixtureValue.Input(uuid, GridFixtureValue.BASELINE, GridFixtureValue.CHANGED,
            graph.getAsJsonArray("nodes").deepCopy());
    }
    public static void run() throws Exception {
        JsonObject graph = JsonParser.parseString(Files.readString(Path.of(System.getProperty("gridFixtureBaseline"))))
            .getAsJsonObject().getAsJsonObject("graph");
        var expected = input(graph);
        GridFixtureValue.require(graph, expected);
        JsonObject changed = graph.deepCopy();
        property(changed, 48, 712).getAsJsonObject("value").addProperty("data", GridFixtureValue.CHANGED);
        refuses(() -> GridFixtureValue.require(changed, expected));
        refuses(() -> GridFixtureValue.require(changed, input(changed)));
        JsonObject incomplete = graph.deepCopy(); incomplete.addProperty("complete", false);
        refuses(() -> GridFixtureValue.require(incomplete, expected));
        refuses(() -> GridFixtureValue.require(graph, new GridFixtureValue.Input(
            "00000000-0000-0000-0000-000000000000", expected.before(), expected.after(), expected.expectedNodes())));
        JsonObject connected = graph.deepCopy();
        property(connected, 50, 7125).getAsJsonArray("refs").add(5);
        property(connected, 50, 7125).addProperty("count", 1);
        refuses(() -> GridFixtureValue.require(connected, input(connected)));
        JsonObject outputConnected = graph.deepCopy();
        property(outputConnected, 34, 7125).getAsJsonArray("refs").set(0, new JsonPrimitive(47));
        refuses(() -> GridFixtureValue.require(outputConnected, input(outputConnected)));
        JsonObject moved = graph.deepCopy();
        property(moved, 45, 6680).getAsJsonObject("value").addProperty("data", "1");
        refuses(() -> GridFixtureValue.require(moved, input(moved)));
        JsonObject bipolar = graph.deepCopy();
        property(bipolar, 48, 6406).getAsJsonObject("value").addProperty("data", true);
        refuses(() -> GridFixtureValue.require(bipolar, input(bipolar)));
        JsonObject request = new JsonObject();
        request.addProperty("moduleUuid", expected.moduleUuid());
        request.addProperty("before", expected.before()); request.addProperty("after", expected.after());
        request.add("expectedNodes", expected.expectedNodes());
        GridFixtureValue.parse(request);
        request.addProperty("after", 1.0); refuses(() -> GridFixtureValue.parse(request));
        request.addProperty("after", "0.8434326653017492"); refuses(() -> GridFixtureValue.parse(request));
        request.addProperty("after", Double.NaN); refuses(() -> GridFixtureValue.parse(request));
        request.addProperty("after", expected.after());
        request.add("expectedNodes", new JsonArray()); refuses(() -> GridFixtureValue.parse(request));
        if (GridFixtureValue.valuePath().size() != 5) throw new AssertionError("write route changed");
    }
}

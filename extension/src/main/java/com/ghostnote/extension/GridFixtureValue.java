package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** One guarded value change on the disconnected E276 fixture module. */
public final class GridFixtureValue {
    public static final double BASELINE = 0.7937005259840998;
    public static final double CHANGED = 0.8434326653017492;
    private static final String QUERY = """
        {"path":[{"parentClass":"native_device","propertyId":406,"propertyName":"device_contents","index":0},{"parentClass":"device_contents","propertyId":173,"propertyName":"child_components","index":7}],"projection":{"module_grid":[6428],"module":[15,404,406,6679,6680,6977],"module_contents":[6369,6370,173],"audio_source_atom":[3639,3640],"audio_destination_atom":[7123,7124,7125,7234],"bipolar_toggleable_decimal_value_atom":[701,374,712,949,6406],"decimal_value_atom":[701,374,712,949],"boolean_value_atom":[701,374,210,953],"button_boolean_value_atom":[701,374,210,953],"integer_value_atom":[701,374,828,957],"indexed_value_atom":[701,374,457,955,6928],"boolean_panel_value":[6387,6386],"nitro_atom":[14],"device_input_proxy_atom":[9794],"device_audio_output_proxy_atom":[9817],"audio_voice_sum_atom":[14],"polyphonic_observer_atom":[14]}}
        """;
    public record Input(String moduleUuid, double before, double after, JsonArray expectedNodes) {}
    public static GridReadExplore.Query query() {
        return GridReadExplore.Query.parse(JsonParser.parseString(QUERY).getAsJsonObject());
    }
    public static Input parse(JsonObject params) {
        String uuid = params.get("moduleUuid").getAsString();
        UUID.fromString(uuid);
        double before = number(params.get("before")), after = number(params.get("after"));
        if (!((before == BASELINE && after == CHANGED) || (before == CHANGED && after == BASELINE)))
            throw new IllegalArgumentException("only the observed 50-to-60 percent pair is admitted");
        JsonArray expected = params.getAsJsonArray("expectedNodes");
        if (expected == null || expected.size() != 53 || expected.toString().length() > 131072)
            throw new IllegalArgumentException("need the complete 53-node fixture capture");
        return new Input(uuid, before, after, expected.deepCopy());
    }
    private static double number(JsonElement value) {
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()
                || !Double.isFinite(value.getAsDouble())) throw new IllegalArgumentException("finite number required");
        return value.getAsDouble();
    }
    static JsonObject node(JsonObject graph, int id) {
        JsonObject found = null;
        for (JsonElement value : graph.getAsJsonArray("nodes")) {
            JsonObject n = value.getAsJsonObject();
            if (n.get("id").getAsInt() == id) {
                if (found != null) throw new IllegalStateException("duplicate node");
                found = n;
            }
        }
        if (found == null) throw new IllegalStateException("missing node");
        return found;
    }
    static JsonObject property(JsonObject node, int id) {
        JsonObject found = null;
        for (JsonElement value : node.getAsJsonArray("properties")) {
            JsonObject p = value.getAsJsonObject();
            if (p.get("id").getAsInt() == id) {
                if (found != null) throw new IllegalStateException("duplicate property");
                found = p;
            }
        }
        if (found == null) throw new IllegalStateException("missing property " + id);
        return found;
    }
    static JsonElement scalar(JsonObject node, int id) {
        return property(node, id).getAsJsonObject("value").get("data");
    }
    static JsonArray refs(JsonObject node, int id) {
        JsonObject p = property(node, id);
        JsonArray refs = p.getAsJsonArray("refs");
        if (refs.size() != p.get("count").getAsInt()) throw new IllegalStateException("incomplete relationship");
        return refs;
    }
    /** Refuse a changed graph, identity, route, connection, or expected value before the host call. */
    public static void require(JsonObject graph, Input input) {
        if (!graph.get("complete").getAsBoolean() || graph.get("errorCount").getAsInt() != 0
                || !graph.getAsJsonArray("nodes").equals(input.expectedNodes))
            throw new IllegalStateException("fixture-graph-changed-or-incomplete");
        JsonObject grid = node(graph, graph.get("root").getAsInt());
        JsonArray modules = refs(grid, 6428);
        if (!grid.get("className").getAsString().equals("module_grid") || modules.size() != 4)
            throw new IllegalStateException("fixture-module-count-changed");
        JsonObject module = node(graph, modules.get(3).getAsInt());
        if (!scalar(module, 15).getAsString().equals(input.moduleUuid)
                || !scalar(module, 404).getAsString().equals("Amplify")
                || scalar(module, 6679).getAsInt() != -1 || scalar(module, 6680).getAsInt() != 0
                || !scalar(module, 6977).getAsBoolean()) throw new IllegalStateException("fixture-module-changed");
        JsonArray contentsRefs = refs(module, 406);
        if (contentsRefs.size() != 1) throw new IllegalStateException("fixture-contents-changed");
        JsonObject contents = node(graph, contentsRefs.get(0).getAsInt());
        if (!scalar(contents, 6369).getAsString().equals("a6cd650b-c4de-46c6-8741-c07a0a9bfec2"))
            throw new IllegalStateException("fixture-type-changed");
        JsonArray atoms = refs(contents, 173);
        if (atoms.size() != 6) throw new IllegalStateException("fixture-atoms-changed");
        JsonObject value = node(graph, atoms.get(1).getAsInt());
        JsonObject destination = node(graph, atoms.get(3).getAsInt());
        if (!value.get("className").getAsString().equals("bipolar_toggleable_decimal_value_atom")
                || !scalar(value, 701).getAsString().equals("VALUE")
                || scalar(value, 712).getAsDouble() != input.before
                || scalar(value, 949).getAsDouble() != input.before
                || scalar(value, 6406).getAsBoolean()
                || !destination.get("className").getAsString().equals("audio_destination_atom")
                || !scalar(destination, 7124).getAsString().equals("IN") || !refs(destination, 7125).isEmpty())
            throw new IllegalStateException("fixture-value-or-input-changed");
        int output = atoms.get(0).getAsInt();
        for (JsonElement n : graph.getAsJsonArray("nodes")) {
            JsonObject atom = n.getAsJsonObject();
            if (atom.get("className").getAsString().equals("audio_destination_atom"))
                for (JsonElement ref : refs(atom, 7125))
                    if (ref.getAsInt() == output) throw new IllegalStateException("fixture-output-connected");
        }
    }
    public static List<GridReadExplore.Step> valuePath() {
        List<GridReadExplore.Step> path = new ArrayList<>(query().path());
        path.add(new GridReadExplore.Step("module_grid", 6428, "auxiliary_devices", 3));
        path.add(new GridReadExplore.Step("module", 406, "device_contents", 0));
        path.add(new GridReadExplore.Step("module_contents", 173, "child_components", 1));
        return List.copyOf(path);
    }
}

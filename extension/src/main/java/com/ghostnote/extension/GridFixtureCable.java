package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;
import static com.ghostnote.extension.GridFixtureValue.*;

/** One cable from either fixed source to the spare Amplify IN in the saved fixture. */
public final class GridFixtureCable {
    private GridFixtureCable() {}
    public record Input(List<String> moduleUuids, String before, String after, JsonArray expectedNodes) {}
    private static final String[] NAMES = {"Sine", "Amplify", "Audio Out", "Amplify"};
    private static final String[] TYPES = {"ca05aebd-ecaf-4d57-b0f6-c04ce81674c4",
        "a6cd650b-c4de-46c6-8741-c07a0a9bfec2", "af7b5503-c955-489e-9461-164107d56bb6",
        "a6cd650b-c4de-46c6-8741-c07a0a9bfec2"};
    private static final int[][] POSITIONS = {{-4, -2}, {-1, -2}, {0, -2}, {-1, 0}};
    private static final int[] COUNTS = {21, 6, 11, 6};
    private static final String VALUES = """
        [{"PITCH":0,"TIMBRE":0.5,"WRAP":0,"KEYTRACK":true,"PITCH_MOD":0,"PHASE_MOD":0,
          "STEREO":false,"RETRIGGER":false,"DETUNE":0,"DENOMINATOR":"1","NUMERATOR":"1","BIPOLAR":true},
         {"VALUE":0.6299605249474366,"BIPOLAR":false,"STEREOIZE":false},
         {"AFFECT_VOICE_LIFETIME":false,"SILENCE_THRESHOLD":-96,"HOLD_TIME":0.05,"CLIP_MODE":"1","CLIP_LEVEL":"1"},
         {"VALUE":0.7937005259840998,"BIPOLAR":false,"STEREOIZE":false}]
        """;

    public static Input parse(JsonObject params) {
        List<String> uuids = new ArrayList<>();
        for (JsonElement value : params.getAsJsonArray("moduleUuids")) {
            String uuid = value.getAsString(); UUID.fromString(uuid); uuids.add(uuid);
        }
        if (uuids.size() != 4 || new HashSet<>(uuids).size() != 4)
            throw new IllegalArgumentException("need four distinct current module UUIDs");
        String before = params.get("before").getAsString(), after = params.get("after").getAsString();
        Set<String> sources = Set.of("none", "sine", "amplify");
        if (!sources.contains(before) || !sources.contains(after) || before.equals(after))
            throw new IllegalArgumentException("need different sources from none, sine, or amplify");
        JsonArray expected = params.getAsJsonArray("expectedNodes");
        if (expected == null || expected.size() != 53 || expected.toString().length() > 131072)
            throw new IllegalArgumentException("need the complete 53-node fixture capture");
        return new Input(List.copyOf(uuids), before, after, expected.deepCopy());
    }

    public static void require(JsonObject graph, Input input) {
        if (!graph.get("complete").getAsBoolean() || graph.get("errorCount").getAsInt() != 0
                || !graph.getAsJsonArray("nodes").equals(input.expectedNodes))
            throw new IllegalStateException("fixture-graph-changed-or-incomplete");
        JsonObject grid = node(graph, graph.get("root").getAsInt());
        JsonArray modules = refs(grid, 6428);
        if (!grid.get("className").getAsString().equals("module_grid") || modules.size() != 4)
            throw new IllegalStateException("fixture-module-count-changed");
        JsonArray values = JsonParser.parseString(VALUES).getAsJsonArray();
        List<JsonArray> atoms = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            JsonObject module = node(graph, modules.get(i).getAsInt());
            if (!scalar(module, 15).getAsString().equals(input.moduleUuids.get(i))
                    || !scalar(module, 404).getAsString().equals(NAMES[i])
                    || scalar(module, 6679).getAsInt() != POSITIONS[i][0]
                    || scalar(module, 6680).getAsInt() != POSITIONS[i][1]
                    || !scalar(module, 6977).getAsBoolean())
                throw new IllegalStateException("fixture-module-changed");
            JsonArray children = refs(module, 406);
            if (children.size() != 1) throw new IllegalStateException("fixture-contents-changed");
            JsonObject contents = node(graph, children.get(0).getAsInt());
            if (!scalar(contents, 6369).getAsString().equals(TYPES[i]))
                throw new IllegalStateException("fixture-type-changed");
            JsonArray members = refs(contents, 173);
            if (members.size() != COUNTS[i]) throw new IllegalStateException("fixture-atoms-changed");
            atoms.add(members);
            requireValues(graph, members, values.get(i).getAsJsonObject());
        }
        int sine = atoms.get(0).get(2).getAsInt(), amplifier = atoms.get(1).get(0).getAsInt();
        requirePort(node(graph, sine), true, "OUT");
        requirePort(node(graph, amplifier), true, "OUT");
        requirePort(node(graph, atoms.get(3).get(0).getAsInt()), true, "OUT");
        Map<Integer, Integer> edges = new HashMap<>();
        edges.put(atoms.get(1).get(3).getAsInt(), sine);
        edges.put(atoms.get(2).get(0).getAsInt(), amplifier);
        int spare = atoms.get(3).get(3).getAsInt();
        requirePort(node(graph, spare), false, "IN");
        if (input.before.equals("sine")) edges.put(spare, sine);
        if (input.before.equals("amplify")) edges.put(spare, amplifier);
        int destinations = 0;
        for (JsonElement item : graph.getAsJsonArray("nodes")) {
            JsonObject atom = item.getAsJsonObject();
            if (!atom.get("className").getAsString().equals("audio_destination_atom")) continue;
            destinations++;
            int id = atom.get("id").getAsInt();
            Integer source = edges.remove(id);
            JsonArray actual = refs(atom, 7125);
            if (scalar(atom, 7234).getAsDouble() != 0 || (source == null ? !actual.isEmpty()
                    : actual.size() != 1 || actual.get(0).getAsInt() != source))
                throw new IllegalStateException("fixture-cables-changed");
            if (source != null) requirePort(atom, false, "IN");
        }
        if (destinations != 6 || !edges.isEmpty()) throw new IllegalStateException("fixture-destinations-changed");
    }

    private static void requirePort(JsonObject atom, boolean source, String name) {
        if (!atom.get("className").getAsString().equals(source ? "audio_source_atom" : "audio_destination_atom")
                || !scalar(atom, source ? 3640 : 7124).getAsString().equals(name))
            throw new IllegalStateException("fixture-port-changed");
    }

    private static void requireValues(JsonObject graph, JsonArray atoms, JsonObject expected) {
        Set<String> seen = new HashSet<>();
        for (JsonElement id : atoms) {
            JsonObject atom = node(graph, id.getAsInt());
            String type = atom.get("className").getAsString();
            int[] fields = switch (type) {
                case "decimal_value_atom", "bipolar_toggleable_decimal_value_atom" -> new int[]{712, 949};
                case "boolean_value_atom", "button_boolean_value_atom" -> new int[]{210, 953};
                case "integer_value_atom" -> new int[]{828, 957};
                case "indexed_value_atom" -> new int[]{457, 955, 6928};
                case "boolean_panel_value" -> new int[]{6386};
                default -> new int[0];
            };
            if (fields.length == 0) continue;
            String key = scalar(atom, type.equals("boolean_panel_value") ? 6387 : 701).getAsString();
            if (!seen.add(key) || !expected.has(key)) throw new IllegalStateException("fixture-parameter-changed");
            for (int field : fields)
                if (!scalar(atom, field).equals(expected.get(key))) throw new IllegalStateException("fixture-value-changed");
            if (type.equals("bipolar_toggleable_decimal_value_atom") && scalar(atom, 6406).getAsBoolean())
                throw new IllegalStateException("fixture-bipolar-changed");
        }
        if (!seen.equals(expected.keySet())) throw new IllegalStateException("fixture-parameters-missing");
    }

    public static List<GridReadExplore.Step> atomPath(int module, int atom) {
        List<GridReadExplore.Step> path = new ArrayList<>(query().path());
        path.add(new GridReadExplore.Step("module_grid", 6428, "auxiliary_devices", module));
        path.add(new GridReadExplore.Step("module", 406, "device_contents", 0));
        path.add(new GridReadExplore.Step("module_contents", 173, "child_components", atom));
        return List.copyOf(path);
    }

    public static Object source(String name, Object sine, Object amplifier) {
        return switch (name) {
            case "none" -> null;
            case "sine" -> sine;
            case "amplify" -> amplifier;
            default -> throw new IllegalArgumentException("unsupported fixture source");
        };
    }
}

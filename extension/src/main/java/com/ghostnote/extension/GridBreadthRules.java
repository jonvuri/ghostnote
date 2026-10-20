package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** Predictions use descriptor state. Only the selected mapping gets new identities. */
public final class GridBreadthRules {
    private GridBreadthRules() {}
    public static JsonObject module(JsonObject fixture, int index) {
        return fixture.getAsJsonArray("modules").get(index).getAsJsonObject();
    }
    public static JsonObject atom(JsonObject fixture, int module, int atom) {
        return module(fixture, module).getAsJsonArray("atoms").get(atom).getAsJsonObject();
    }
    public static JsonObject fields(JsonObject atom) { return atom.getAsJsonObject("fields"); }
    public static void require(boolean condition, String reason) {
        if (!condition) throw new IllegalStateException("breadth-" + reason);
    }
    public static void type(JsonObject fixture, int index, String type) {
        require(module(fixture, index).get("type").getAsString().equals(type), "module-type");
    }
    public static void gates(JsonObject module) {
        require(module.get("type").getAsString().equals(GridBreadthCommands.GATES_TYPE), "gates-type");
        JsonArray atoms = module.getAsJsonArray("atoms");
        require(atoms.size() == 17, "gates-atom-count");
        JsonObject data = fields(atoms.get(5).getAsJsonObject());
        require(data.get("6613").getAsInt() == 64 && data.getAsJsonArray("6609").size() == 64, "gates-array-size");
        JsonObject phase = atoms.get(7).getAsJsonObject();
        require(phase.get("class").getAsString().equals("boolean_value_atom")
            && phase.get("runtimeClass").getAsString().equals("QY")
            && fields(phase).get("701").getAsString().equals("DEVICE_PHASE")
            && fields(phase).get("210").isJsonPrimitive()
            && fields(phase).getAsJsonPrimitive("210").isBoolean(), "gates-phase-atom");
        for (int index : new int[]{4, 7, 9, 10})
            require(atoms.get(index).getAsJsonObject().getAsJsonObject("fields").size() >= 4, "gates-stored-values");
    }
    public static String selectedMapping(JsonObject fixture) {
        type(fixture, 13, GridBreadthCommands.SOURCE_TYPE); type(fixture, 24, GridBreadthCommands.TARGET_TYPE);
        JsonObject source = atom(fixture, 13, 1), target = atom(fixture, 24, 0);
        require(source.get("class").getAsString().equals("modulation_source_atom")
            && source.get("runtimeClass").getAsString().equals("com.bitwig.flt.document.core.master.device.NDn")
            && target.get("class").getAsString().equals("decimal_value_atom"), "mapping-atom-class");
        String sourceId = source.get("id").getAsString(), targetId = target.get("id").getAsString(), found = null;
        JsonObject mappings = fixture.getAsJsonObject("mappings");
        for (var entry : mappings.entrySet()) {
            JsonObject mapping = entry.getValue().getAsJsonObject();
            JsonArray destination = mapping.getAsJsonObject("reference").getAsJsonArray("65");
            require(destination.size() == 1, "mapping-destination-reference");
            if (mapping.get("source").getAsString().equals(sourceId)
                    && destination.get(0).getAsString().equals(targetId)) {
                require(found == null, "multiple-selected-mappings"); found = entry.getKey();
            }
        }
        List<String> sourceIds = strings(fields(source).getAsJsonArray("3616"));
        List<String> targetIds = strings(fields(target).getAsJsonArray("3615"));
        if (found != null) {
            require(Collections.frequency(sourceIds, found) == 1 && Collections.frequency(targetIds, found) == 1,
                "mapping-endpoints-disagree");
            JsonObject mapping = mappings.getAsJsonObject(found);
            require(mapping.get("3611").getAsDouble() == 129 && mapping.get("11481").getAsBoolean()
                && mapping.get("11338").getAsString().equals("LINEAR") && mapping.get("3638").getAsBoolean()
                && !mapping.get("11509").getAsBoolean() && !mapping.get("11913").getAsBoolean()
                && mapping.getAsJsonArray("11503").isEmpty(), "mapping-values");
        }
        require(fields(source).getAsJsonArray("11497").isEmpty(), "source-auxiliary-mappings");
        JsonArray ports = source.getAsJsonObject("input").getAsJsonArray("ports");
        require(ports.size() == 1, "source-input-count");
        JsonObject port = ports.get(0).getAsJsonObject();
        require(port.getAsJsonArray("248").size() == 1
            && port.getAsJsonArray("248").get(0).getAsString().equals(atom(fixture, 13, 2).get("id").getAsString())
            && port.get("249").getAsInt() == 0, "source-input-route");
        return found;
    }
    public static List<String> strings(JsonArray array) {
        List<String> result = new ArrayList<>();
        for (JsonElement value : array) result.add(value.getAsString());
        return result;
    }
    private static void mappingLists(JsonObject fixture, String id, boolean replace) {
        for (JsonElement m : fixture.getAsJsonArray("modules")) {
            JsonArray atoms = m.getAsJsonObject().getAsJsonArray("atoms");
            if (atoms == null) continue;
            for (JsonElement a : atoms) {
                JsonObject fields = fields(a.getAsJsonObject());
                for (String key : List.of("3615", "3616", "11497")) {
                    if (!fields.has(key)) continue;
                    JsonArray next = new JsonArray(); boolean found = false;
                    for (JsonElement ref : fields.getAsJsonArray(key)) {
                        if (ref.getAsString().equals(id)) { require(!found, "duplicate-selected-reference"); found = true; }
                        else next.add(ref.deepCopy());
                    }
                    if (replace && found) next.add("$selected-mapping");
                    fields.add(key, next);
                }
            }
        }
    }
    public static JsonObject withoutMapping(JsonObject fixture, String id) {
        JsonObject result = fixture.deepCopy();
        require(result.getAsJsonObject("mappings").remove(id) != null, "missing-mapping");
        mappingLists(result, id, false); return result;
    }
    public static JsonObject normalizedMapping(JsonObject fixture, String id) {
        require(id != null, "missing-selected-mapping");
        JsonObject result = fixture.deepCopy(), all = result.getAsJsonObject("mappings");
        JsonObject selected = all.remove(id).getAsJsonObject();
        selected.getAsJsonObject("reference").addProperty("id", "$selected-reference");
        all.add("$selected-mapping", selected); mappingLists(result, id, true); return result;
    }
    public static JsonObject expectedFixture(JsonObject initial, String kind, int commands) {
        if (kind.equals("boolean")) {
            JsonObject result = initial.deepCopy();
            fields(atom(result, 9, 7)).addProperty("210", commands == 1);
            return result;
        }
        if (kind.equals("mapping") && commands == 1) return withoutMapping(initial, selectedMapping(initial));
        return initial.deepCopy();
    }
    public static void compareFixture(JsonObject initial, JsonObject actual, String kind, int commands) {
        if (kind.equals("mapping") && commands == 2) {
            String oldId = selectedMapping(initial), newId = selectedMapping(actual);
            require(newId != null && !newId.equals(oldId), "restored-mapping-not-fresh");
            String oldRef = initial.getAsJsonObject("mappings").getAsJsonObject(oldId)
                .getAsJsonObject("reference").get("id").getAsString();
            String newRef = actual.getAsJsonObject("mappings").getAsJsonObject(newId)
                .getAsJsonObject("reference").get("id").getAsString();
            require(!oldRef.equals(newRef), "restored-reference-not-fresh");
            Set<String> oldIdentities = new HashSet<>();
            collectIdentities(initial, oldIdentities);
            require(!oldIdentities.contains(newId) && !oldIdentities.contains(newRef)
                && !newId.equals(newRef), "restored-identity-reused");
            require(normalizedMapping(initial, oldId).equals(normalizedMapping(actual, newId)), "mapping-readback-differs");
        } else require(expectedFixture(initial, kind, commands).equals(actual), "fixture-readback-differs");
    }
    private static void collectIdentities(JsonElement value, Set<String> found) {
        if (value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()) found.add(value.getAsString());
        else if (value.isJsonArray()) for (JsonElement child : value.getAsJsonArray()) collectIdentities(child, found);
        else if (value.isJsonObject()) for (var entry : value.getAsJsonObject().entrySet()) {
            found.add(entry.getKey()); collectIdentities(entry.getValue(), found);
        }
    }
}

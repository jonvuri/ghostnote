package com.ghostnote.extension;

import com.google.gson.*;
import java.lang.reflect.Array;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Fixed descriptor projection for 9b.3. No native command is called here. */
public final class GridBreadthRead {
    public static final int MAX_MODULES = 64, MAX_ATOMS = 256, MAX_CLASSES = 32;
    private final GridGraphRead.Reader reader;
    private final Map<Class<?>, Map<Integer, Object>> schemas = new HashMap<>();
    private final IdentityHashMap<Object, String> identities = new IdentityHashMap<>();
    private final Map<String, Object> objects = new HashMap<>();
    private IdentityHashMap<Object, String> detachedIdentities;
    private final long deadline = System.nanoTime() + 1_000_000_000L;
    private int work, scalarChars;
    public GridBreadthRead(GridGraphRead.Reader reader) { this.reader = reader; }
    public int work() { return work; }
    /** Detached objects have no unique document ID. Use the proved ownership order. */
    public void detachedScope(List<Object> owned) {
        if (detachedIdentities != null || owned == null || owned.isEmpty() || owned.size() > 256)
            throw new IllegalStateException("breadth-detached-identity-scope");
        IdentityHashMap<Object, String> scope = new IdentityHashMap<>();
        for (int i = 0; i < owned.size(); i++) {
            charge(); Object object = owned.get(i);
            if (object == null || identities.containsKey(object)
                    || scope.put(object, "detached:" + i) != null)
                throw new IllegalStateException("breadth-detached-identity-scope");
        }
        detachedIdentities = scope;
    }
    public Object grid(Object device) throws Exception {
        named(device, "native_device");
        Object contents = one(device, 406); named(contents, "device_contents");
        Object found = null;
        for (Object child : children(contents, 173, GridGraphRead.MAX_ARRAY)) {
            charge();
            if (reader.name(child).equals("module_grid")) {
                if (found != null) throw new IllegalStateException("breadth-multiple-grids");
                found = child;
            }
        }
        if (found == null) throw new IllegalStateException("breadth-grid-absent");
        return found;
    }
    private void charge() {
        if (++work > GridGraphRead.MAX_WORK || System.nanoTime() > deadline)
            throw new IllegalStateException("breadth-read-work-or-time-limit");
    }
    private Map<Integer, Object> schema(Object object) throws Exception {
        charge();
        if (object == null) throw new IllegalStateException("breadth-null-object");
        Map<Integer, Object> cached = schemas.get(object.getClass());
        if (cached != null) return cached;
        if (schemas.size() >= MAX_CLASSES) throw new IllegalStateException("breadth-class-limit");
        List<?> properties = reader.properties(object);
        if (properties.size() > GridGraphRead.MAX_WORK) throw new IllegalStateException("breadth-property-limit");
        Map<Integer, Object> found = new LinkedHashMap<>();
        for (Object property : properties) {
            charge();
            if (found.put(reader.id(property), property) != null)
                throw new IllegalStateException("breadth-duplicate-property");
        }
        schemas.put(object.getClass(), found);
        return found;
    }
    private Object property(Object object, int id, boolean relationship) throws Exception {
        Object property = schema(object).get(id);
        if (property == null || reader.relationship(property) != relationship)
            throw new IllegalStateException("breadth-field-shape:" + reader.name(object) + ":" + id);
        return property;
    }
    public Object scalar(Object object, int id) throws Exception {
        return reader.value(property(object, id, false), object);
    }
    public List<Object> children(Object object, int id, int limit) throws Exception {
        Object p = property(object, id, true);
        int count = reader.childCount(p, object);
        if (count < 0 || count > limit || limit > GridGraphRead.MAX_ARRAY)
            throw new IllegalStateException("breadth-child-limit:" + id);
        List<Object> result = new ArrayList<>();
        Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (int i = 0; i < count; i++) {
            charge(); Object child = reader.child(p, object, i);
            if (child == null || !seen.add(child)) throw new IllegalStateException("breadth-child-identity");
            result.add(child);
        }
        return result;
    }
    public Object one(Object object, int id) throws Exception {
        List<Object> values = children(object, id, 1);
        if (values.size() != 1) throw new IllegalStateException("breadth-one-child:" + id);
        return values.get(0);
    }
    public String id(Object object) throws Exception {
        if (detachedIdentities != null) {
            String local = detachedIdentities.get(object);
            if (local == null) throw new IllegalStateException("breadth-detached-foreign-reference");
            return local;
        }
        String found = identities.get(object);
        if (found != null) return found;
        Object raw = scalar(object, 14);
        if (!(raw instanceof Integer number)) throw new IllegalStateException("breadth-managed-id-type");
        String value = number.toString();
        if (objects.putIfAbsent(value, object) != null)
            throw new IllegalStateException("breadth-managed-id-alias");
        identities.put(object, value);
        return value;
    }
    public Object object(String id) {
        Object result = objects.get(id);
        if (result == null) throw new IllegalStateException("breadth-object-not-captured");
        return result;
    }
    public void named(Object object, String expected) throws Exception {
        charge();
        if (!expected.equals(reader.name(object))) throw new IllegalStateException("breadth-class:" + expected);
    }
    private JsonElement value(Object raw) {
        charge();
        if (raw == null) return JsonNull.INSTANCE;
        if (raw instanceof Boolean b) return new JsonPrimitive(b);
        if (raw instanceof Number n) {
            if (!Double.isFinite(n.doubleValue())) throw new IllegalStateException("breadth-nonfinite-scalar");
            return new JsonPrimitive(n);
        }
        if (raw instanceof String || raw instanceof UUID || raw instanceof Enum<?>) {
            String text = raw.toString();
            if (text.length() > GridGraphRead.MAX_SCALAR) throw new IllegalStateException("breadth-string-limit");
            scalarChars += text.length();
            if (scalarChars > GridGraphRead.MAX_BYTES / 2) throw new IllegalStateException("breadth-scalar-total-limit");
            return new JsonPrimitive(text);
        }
        if (raw.getClass().isArray() && raw.getClass().getComponentType().isPrimitive()
                && raw.getClass().getComponentType() != byte.class) {
            int count = Array.getLength(raw);
            if (count > GridGraphRead.MAX_ARRAY) throw new IllegalStateException("breadth-array-limit");
            JsonArray result = new JsonArray();
            for (int i = 0; i < count; i++) result.add(value(Array.get(raw, i)));
            return result;
        }
        throw new IllegalStateException("breadth-unsupported-scalar:" + raw.getClass().getName());
    }
    private JsonArray refs(Object object, int field) throws Exception {
        JsonArray result = new JsonArray();
        for (Object child : children(object, field, GridGraphRead.MAX_ARRAY)) result.add(id(child));
        return result;
    }
    private JsonObject fields(Object object, int... ids) throws Exception {
        JsonObject result = new JsonObject();
        for (int field : ids) {
            Object p = schema(object).get(field);
            if (p == null) throw new IllegalStateException("breadth-missing-field:" + field);
            result.add(Integer.toString(field), reader.relationship(p) ? refs(object, field) : value(scalar(object, field)));
        }
        return result;
    }
    public JsonObject module(Object module, boolean detail, JsonObject mappings) throws Exception {
        named(module, "module");
        Object contents = one(module, 406); named(contents, "module_contents");
        JsonObject result = new JsonObject();
        result.addProperty("id", id(module)); result.add("uuid", value(scalar(module, 15)));
        result.add("name", value(scalar(module, 404))); result.add("type", value(scalar(contents, 6369)));
        result.add("x", value(scalar(module, 6679))); result.add("y", value(scalar(module, 6680)));
        if (detail) {
            JsonArray atoms = new JsonArray();
            for (Object atom : children(contents, 173, MAX_ATOMS)) atoms.add(atom(atom, mappings));
            result.add("atoms", atoms);
        }
        return result;
    }
    private JsonObject atom(Object atom, JsonObject mappings) throws Exception {
        String name = reader.name(atom);
        JsonObject result = new JsonObject();
        result.addProperty("id", id(atom)); result.addProperty("class", name);
        result.addProperty("runtimeClass", atom.getClass().getName());
        int[] ids = switch (name) {
            case "boolean_value_atom", "button_boolean_value_atom" -> new int[]{701, 374, 210, 3615};
            case "decimal_value_atom" -> new int[]{701, 374, 712, 3615};
            case "bipolar_toggleable_decimal_value_atom" -> new int[]{701, 374, 712, 6406, 3615};
            case "integer_value_atom" -> new int[]{701, 374, 828, 3615};
            case "indexed_value_atom" -> new int[]{701, 374, 457, 6928, 3615};
            case "data_array_component" -> new int[]{6614, 6609, 6613};
            case "audio_destination_atom" -> new int[]{7123, 7124, 7125, 7234};
            case "audio_source_atom" -> new int[]{3639, 3640};
            case "modulation_source_atom", "nameable_modulation_source_atom" -> new int[]{3639, 3640, 3616, 11497};
            case "boolean_panel_value" -> new int[]{6387, 6386};
            case "string_panel_value" -> new int[]{6387, 6391};
            default -> new int[]{};
        };
        JsonObject projected = fields(atom, ids); result.add("fields", projected);
        for (int field : new int[]{3615, 3616, 11497})
            if (projected.has(Integer.toString(field)))
                for (Object mapping : children(atom, field, GridGraphRead.MAX_ARRAY)) mapping(mapping, mappings);
        if (name.equals("audio_source_atom") || name.equals("modulation_source_atom")
                || name.equals("nameable_modulation_source_atom")) {
            Object settings = one(atom, 6194); named(settings, "component_settings");
            JsonObject route = new JsonObject(); route.addProperty("id", id(settings));
            JsonArray ports = new JsonArray();
            for (Object port : children(settings, 614, GridGraphRead.MAX_ARRAY)) {
                named(port, "inport_connection");
                JsonObject item = fields(port, 248, 249, 250, 6443); item.addProperty("id", id(port)); ports.add(item);
            }
            route.add("ports", ports); result.add("input", route);
        }
        return result;
    }
    private void mapping(Object mapping, JsonObject all) throws Exception {
        String identity = id(mapping);
        if (all.has(identity)) return;
        named(mapping, "device_modulation_mapping");
        JsonObject result = fields(mapping, 3611, 11481, 11338, 3638, 11509, 11913, 11503);
        result.addProperty("source", id(one(mapping, 3635)));
        Object reference = one(mapping, 3739); named(reference, "device_atom_reference");
        JsonObject ref = fields(reference, 65, 4923, 4922, 4924, 4913, 4914);
        ref.addProperty("id", id(reference)); result.add("reference", ref);
        all.add(identity, result);
    }
    public JsonObject fixture(Object grid, String kind) throws Exception {
        named(grid, "module_grid");
        List<Object> modules = children(grid, 6428, MAX_MODULES);
        int minimum = kind.equals("mapping") ? 25 : 10;
        if (modules.size() < minimum) throw new IllegalStateException("breadth-fixture-membership");
        JsonArray members = new JsonArray(); JsonObject mappings = new JsonObject();
        Set<String> uuids = new HashSet<>();
        for (int i = 0; i < modules.size(); i++) {
            JsonObject m = module(modules.get(i), kind.equals("mapping") ? i == 13 || i == 24 : i == 9, mappings);
            if (!uuids.add(m.get("uuid").getAsString())) throw new IllegalStateException("breadth-duplicate-uuid");
            members.add(m);
        }
        JsonObject result = new JsonObject(); result.add("modules", members); result.add("mappings", mappings);
        bounded(result);
        return result;
    }
    public static void bounded(JsonObject value) {
        if (value.toString().getBytes(StandardCharsets.UTF_8).length > GridGraphRead.MAX_BYTES - 4096)
            throw new IllegalStateException("breadth-result-byte-limit");
    }
}

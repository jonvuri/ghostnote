package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** Controls for schema-only reads, path guards, and explicit projections. */
public final class GridExploreTest {
    private record Field(int id, String name, Object value, List<Node> children) {}
    private record Node(String name, List<Field> fields) {}
    private static final class Reader implements GridGraphRead.Reader {
        int scalarReads, childReads;
        boolean filterFails;
        public String name(Object object) { return ((Node) object).name; }
        public int classId(Object object) { return 1; }
        public List<?> properties(Object object) { return ((Node) object).fields; }
        public int id(Object field) { return ((Field) field).id; }
        public String propertyName(Object field) { return ((Field) field).name; }
        public boolean included(Object field, Object object) {
            if (filterFails) throw new IllegalStateException("unresolved-filter");
            return false;
        }
        public boolean relationship(Object field) { return ((Field) field).children != null; }
        public int childCount(Object field, Object object) { return ((Field) field).children.size(); }
        public Object child(Object field, Object object, int index) {
            childReads++; return ((Field) field).children.get(index);
        }
        public Object value(Object field, Object object) { scalarReads++; return ((Field) field).value; }
    }
    private interface Action { void run() throws Exception; }
    private static void require(boolean value) { if (!value) throw new AssertionError(); }
    private static void refuses(Action action) {
        try { action.run(); } catch (Exception expected) { return; }
        throw new AssertionError("expected refusal");
    }
    private static GridReadExplore.Query query(String json) {
        return GridReadExplore.Query.parse(JsonParser.parseString(json).getAsJsonObject());
    }
    public static void run() throws Exception {
        Reader reader = new Reader();
        Node leaf = new Node("leaf", List.of(new Field(2, "gain", 0.25, null)));
        Node root = new Node("root", List.of(new Field(1, "modules", null, List.of(leaf)),
            new Field(3, "opaque", new byte[300], null)));
        var step = new GridReadExplore.Step("root", 1, "modules", 0);
        require(new GridReadExplore(reader).navigate(root, List.of(step)) == leaf);
        refuses(() -> new GridReadExplore(reader).navigate(root,
            List.of(new GridReadExplore.Step("wrong", 1, "modules", 0))));
        refuses(() -> new GridReadExplore(reader).navigate(root,
            List.of(new GridReadExplore.Step("root", 1, "renamed", 0))));
        refuses(() -> new GridReadExplore(reader).navigate(root,
            List.of(new GridReadExplore.Step("root", 1, "modules", 1))));
        refuses(() -> new GridReadExplore(reader).navigate(root,
            List.of(new GridReadExplore.Step("root", 3, "opaque", 0))));
        JsonObject schema = new GridReadExplore(reader).schema(root);
        require(schema.get("complete").getAsBoolean());
        require(schema.getAsJsonArray("properties").size() == 2);
        require(schema.toString().contains("leaf"));
        require(!schema.toString().contains("gain"));
        require(reader.scalarReads == 0);
        Node wide = new Node("root", List.of(new Field(1, "modules", null, Collections.nCopies(257, leaf))));
        refuses(() -> new GridReadExplore(reader).schema(wide));
        refuses(() -> new GridReadExplore(reader).navigate(wide, List.of(step)));
        Node mixed = new Node("root", List.of(root.fields.get(0),
            new Field(4, "engine_objects", null, Collections.nCopies(1000, leaf))));
        var requested = new GridReadExplore.Headers(Set.of(1), 256);
        reader.childReads = 0;
        JsonObject selected = new GridReadExplore(reader).schema(mixed, requested);
        require(selected.get("complete").getAsBoolean());
        require(reader.childReads == 1);
        JsonObject omitted = selected.getAsJsonArray("properties").get(1).getAsJsonObject();
        require(omitted.get("count").getAsInt() == 1000);
        require(!omitted.get("headersRequested").getAsBoolean());
        require(!omitted.get("childrenComplete").getAsBoolean());
        require(!omitted.get("truncated").getAsBoolean());
        reader.childReads = 0;
        JsonObject limited = new GridReadExplore(reader).schema(mixed,
            new GridReadExplore.Headers(Set.of(1, 4), 2));
        require(!limited.get("complete").getAsBoolean() && reader.childReads == 2);
        require(limited.getAsJsonArray("properties").get(1).getAsJsonObject().get("truncated").getAsBoolean());
        reader.childReads = 0;
        require(new GridReadExplore(reader).schema(mixed, new GridReadExplore.Headers(Set.of(), 0))
            .get("complete").getAsBoolean());
        require(reader.childReads == 0);
        refuses(() -> new GridReadExplore(reader).schema(root, new GridReadExplore.Headers(Set.of(3), 1)));
        refuses(() -> new GridReadExplore(reader).schema(root, new GridReadExplore.Headers(Set.of(99), 1)));
        for (String bad : List.of("{\"fields\":[1,1],\"limit\":1}", "{\"fields\":[1],\"limit\":257}",
                "{\"fields\":[-1],\"limit\":1}", "{\"fields\":[],\"limit\":1.5}",
                "{\"fields\":[],\"limit\":0,\"extra\":1}"))
            refuses(() -> GridReadExplore.Headers.parse(JsonParser.parseString("{\"schemaHeaders\":" + bad + "}").getAsJsonObject()));
        require(GridReadExplore.Headers.parse(JsonParser.parseString(
            "{\"schemaHeaders\":{\"fields\":[1],\"limit\":256}}").getAsJsonObject()).fields().equals(Set.of(1)));
        Node huge = new Node("root", Collections.nCopies(4097, root.fields.get(0)));
        refuses(() -> new GridReadExplore(reader).schema(huge));
        Map<String, Set<Integer>> projection = Map.of("root", Set.of(1), "leaf", Set.of(2));
        JsonObject graph = new GridGraphRead(new GridReadExplore(reader).project(projection)).capture(root);
        require(graph.get("complete").getAsBoolean());
        require(graph.getAsJsonArray("nodes").size() == 2);
        require(reader.scalarReads == 1);
        require(graph.toString().contains("explicit-projection"));
        require(!graph.toString().contains("opaque"));
        require(!new GridGraphRead(new GridReadExplore(reader).project(Map.of("root", Set.of(1))))
            .capture(root).get("complete").getAsBoolean());
        require(!new GridGraphRead(new GridReadExplore(reader).project(Map.of("root", Set.of(99))))
            .capture(root).get("complete").getAsBoolean());
        require(!new GridGraphRead(new GridReadExplore(reader).project(Map.of("root", Set.of(3))))
            .capture(root).get("complete").getAsBoolean());
        reader.filterFails = true;
        refuses(() -> new GridReadExplore(reader).schema(root));
        require(!new GridGraphRead(new GridReadExplore(reader).project(projection)).capture(root)
            .get("complete").getAsBoolean());
        reader.filterFails = false;
        List<Field> fields = new ArrayList<>();
        for (int i = 0; i < 4096; i++) fields.add(new Field(i, "field", i, null));
        Node scan = new Node("root", fields);
        require(!new GridGraphRead(new GridReadExplore(reader).project(Map.of("root", Set.of(1))))
            .capture(scan).get("complete").getAsBoolean());
        require(query("{\"path\":[],\"projection\":{\"leaf\":[2]}}").projection().size() == 1);
        refuses(() -> query("{\"projection\":{}}"));
        refuses(() -> query("{\"projection\":{\"leaf\":[2,2]}}"));
        refuses(() -> query("{\"projection\":{\"leaf\":[2.5]}}"));
        refuses(() -> query("{\"projection\":{\"leaf\":[-1]}}"));
        refuses(() -> query("{\"projection\":{\"leaf\":[\"2\"]}}"));
        String part = "{\"parentClass\":\"root\",\"propertyId\":1,\"propertyName\":\"modules\",\"index\":0}";
        refuses(() -> query("{\"path\":[" + String.join(",", Collections.nCopies(13, part)) + "]}"));
        System.out.println("Grid exploration: schema isolation, bounded paths, projections, and query controls pass.");
    }
}

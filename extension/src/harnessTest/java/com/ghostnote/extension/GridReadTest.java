package com.ghostnote.extension;

import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Offline controls for bounds, target epochs, and asynchronous failures. */
public final class GridReadTest {
    private record Property(String name, Object value, List<Node> children) {}
    private record Node(List<Property> properties) {}
    private static final class Reader implements GridGraphRead.Reader {
        boolean filterFails, childFails, rootBridge;
        public String name(Object object) { return "test"; }
        public int classId(Object object) { return 42; }
        public List<?> properties(Object object) { return ((Node) object).properties; }
        public int id(Object property) { return 7; }
        public String propertyName(Object property) { return ((Property) property).name; }
        public boolean included(Object property, Object object) {
            if (filterFails) throw new IllegalStateException("filter-unresolved");
            return !((Property) property).name.equals("excluded");
        }
        public boolean rootBridge(Object property, Object object) {
            return rootBridge && ((Property) property).name.equals("excluded");
        }
        public boolean relationship(Object property) { return ((Property) property).children != null; }
        public int childCount(Object property, Object object) { return ((Property) property).children.size(); }
        public Object child(Object property, Object object, int index) {
            if (childFails) throw new IllegalStateException("child-read-failed");
            return ((Property) property).children.get(index);
        }
        public Object value(Object property, Object object) { return ((Property) property).value; }
    }
    private static Node scalar(Object value) { return new Node(List.of(new Property("value", value, null))); }
    private static Node children(Node... values) { return new Node(List.of(new Property("children", null, List.of(values)))); }
    private static void require(boolean pass) { if (!pass) throw new AssertionError(); }
    private static boolean complete(JsonObject value) { return value.get("complete").getAsBoolean(); }
    private static void refuses(Runnable operation) {
        try { operation.run(); } catch (IllegalStateException | IllegalArgumentException expected) { return; }
        throw new AssertionError("expected refusal");
    }

    public static void main(String[] args) throws Exception {
        GridExploreTest.run();
        GridFixtureValueTest.run();
        GridFixtureCableTest.run();
        Reader reader = new Reader();
        Node a = scalar(2), b = scalar(2);
        JsonObject graph = new GridGraphRead(reader).capture(children(a, b, a));
        require(complete(graph));
        require(graph.getAsJsonArray("nodes").size() == 3);
        require(graph.toString().contains("\"refs\":[1,2,1]"));
        require(graph.get("encodedBytes").getAsInt() == graph.toString().getBytes(StandardCharsets.UTF_8).length);
        require(!complete(new GridGraphRead(reader, 1, 8192, 12).capture(children(a))));
        require(!complete(new GridGraphRead(reader, 4096, 8192, 0).capture(children(a))));
        require(!complete(new GridGraphRead(reader).capture(scalar("x".repeat(4097)))));
        require(!complete(new GridGraphRead(reader).capture(scalar(new byte[3]))));
        require(!complete(new GridGraphRead(reader).capture(scalar(new int[257]))));
        require(!complete(new GridGraphRead(reader).capture(scalar(new Object()))));
        require(!complete(new GridGraphRead(reader).capture(scalar(Double.NaN))));
        String[] strings = new String[256]; Arrays.fill(strings, "\n".repeat(4096));
        graph = new GridGraphRead(reader, 4096, 8192, 12).capture(scalar(strings));
        require(!complete(graph));
        require(graph.toString().getBytes(StandardCharsets.UTF_8).length < 8192);
        reader.filterFails = true;
        require(!complete(new GridGraphRead(reader).capture(a)));
        reader.filterFails = false; reader.childFails = true;
        require(!complete(new GridGraphRead(reader).capture(children(a))));
        reader.childFails = false;
        Node excludedChild = new Node(List.of(new Property("excluded", null, List.of(a))));
        Node excludedRoot = new Node(List.of(new Property("excluded", null, List.of(excludedChild))));
        require(new GridGraphRead(reader).capture(excludedRoot).getAsJsonArray("nodes").size() == 1);
        reader.rootBridge = true;
        graph = new GridGraphRead(reader).capture(excludedRoot);
        require(complete(graph));
        require(graph.getAsJsonArray("nodes").size() == 2);
        require(graph.toString().contains("explicit-root-bridge"));
        require(!complete(new GridGraphRead(reader, 4096, 8192, 0).capture(excludedRoot)));
        reader.filterFails = true;
        require(!complete(new GridGraphRead(reader).capture(excludedRoot)));
        reader.filterFails = false; reader.childFails = true;
        require(!complete(new GridGraphRead(reader).capture(excludedRoot)));
        reader.childFails = false; reader.rootBridge = false;
        ArrayList<Property> properties = new ArrayList<>();
        Node cycle = new Node(properties);
        properties.add(new Property("cycle", null, List.of(cycle)));
        require(complete(new GridGraphRead(reader).capture(cycle)));
        properties.clear(); properties.add(new Property("value", 1, null));
        String before = new GridGraphRead(reader).capture(cycle).getAsJsonArray("nodes").toString();
        properties.clear(); properties.add(new Property("value", 2, null));
        String after = new GridGraphRead(reader).capture(cycle).getAsJsonArray("nodes").toString();
        require(!before.equals(after));
        refuses(() -> new GridGraphRead(reader, 4097, 8192, 12));
        Object document = new Object(), track = new Object(), device = new Object();
        GridReadEpoch epoch = new GridReadEpoch(document, track, device);
        epoch.require(epoch.token, document, track, device);
        refuses(() -> epoch.require("other", document, track, device));
        refuses(() -> epoch.require(epoch.token, new Object(), track, device));
        refuses(() -> epoch.require(epoch.token, document, new Object(), device));
        refuses(() -> epoch.require(epoch.token, document, track, new Object()));
        refuses(() -> epoch.require(epoch.token, document, track, null));
        async();
        require(RuntimeProfile.PROBE.includes("probe.gridRead"));
        require(RuntimeProfile.PROBE.includes("probe.gridValue"));
        require(!RuntimeProfile.NORMAL.includes("probe.gridValue"));
        require(!RuntimeProfile.CAPTURE.includes("probe.gridValue"));
        require(RuntimeProfile.PROBE.includes("probe.gridModuleDelete"));
        require(!RuntimeProfile.NORMAL.includes("probe.gridModuleDelete"));
        require(!RuntimeProfile.CAPTURE.includes("probe.gridModuleDelete"));
        require(RuntimeProfile.kind("probe.gridModuleDelete") == WriteGate.Kind.WRITE);
        require(RuntimeProfile.PROBE.includes("probe.gridCable"));
        require(!RuntimeProfile.NORMAL.includes("probe.gridCable"));
        require(!RuntimeProfile.CAPTURE.includes("probe.gridCable"));
        require(RuntimeProfile.kind("probe.gridCable") == WriteGate.Kind.WRITE);
        require(!RuntimeProfile.NORMAL.includes("probe.gridRead"));
        require(!RuntimeProfile.CAPTURE.includes("probe.gridRead"));
        System.out.println("Grid read: bounds, completeness, identity, fresh reads, async outcomes, and profile checks pass.");
    }

    private static void async() {
        for (String mode : List.of("success", "failure", "queue-failure", "timeout", "late")) {
            List<Runnable> document = new ArrayList<>(), controller = new ArrayList<>(), timers = new ArrayList<>();
            int[] calls = new int[4];
            GridReadJob.start(task -> {
                if (mode.equals("queue-failure")) throw new Exception("queue failed");
                document.add(task);
            }, (task, delay) -> { if (delay == 0) controller.add(task); else timers.add(task); }, () -> {
                calls[0]++;
                if (mode.equals("failure")) throw new Exception("read failed");
                return 42;
            }, value -> { require(value == 42); calls[1]++; }, error -> {
                require(error.getMessage().contains("failed")); calls[2]++;
            }, () -> calls[3]++);
            if (mode.equals("timeout")) timers.forEach(Runnable::run);
            document.forEach(Runnable::run);
            if (mode.equals("late")) timers.forEach(Runnable::run);
            controller.forEach(Runnable::run);
            timers.forEach(Runnable::run);
            require(calls[1] + calls[2] + calls[3] == 1);
            if (mode.equals("success")) require(calls[1] == 1);
            if (mode.equals("failure") || mode.equals("queue-failure")) require(calls[2] == 1);
            if (mode.equals("timeout")) require(calls[0] == 0 && calls[3] == 1);
            if (mode.equals("late")) require(calls[0] == 1 && calls[3] == 1);
        }
    }
}

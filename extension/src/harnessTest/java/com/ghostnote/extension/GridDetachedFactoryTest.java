package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** Exercise failure paths without constructing host objects. */
public final class GridDetachedFactoryTest {
    private static final class Node {
        Node owner;
        boolean disposed;
        final List<Node> children = new ArrayList<>();
        Node add() { Node child = new Node(); child.owner = this; children.add(child); return child; }
    }
    private static final class Fake implements GridDetachedFactory.Host {
        final String mode;
        final Node root = new Node();
        int creates, captures, disposals, guards;
        Fake(String mode) {
            this.mode = mode;
            Node child = root.add();
            if (mode.equals("foreign-child")) child.owner = new Node();
            if (mode.equals("cycle")) child.children.add(root);
            if (mode.equals("too-many")) for (int i = 0; i < 256; i++) root.add();
            if (mode.equals("too-deep")) for (int i = 0; i < 13; i++) child = child.add();
            if (mode.equals("disposed")) child.disposed = true;
        }
        public Object create() {
            creates++;
            if (mode.equals("factory-throw")) throw new IllegalStateException("no result handle");
            return root;
        }
        public void requireRoot(Object module) {
            guards++;
            if (mode.equals("wrong-root") || mode.equals("attached")
                    || mode.equals("changed-owner") && guards == 2)
                throw new IllegalStateException("root is unproved");
        }
        public Object owner(Object object) { return ((Node) object).owner; }
        public List<?> children(Object object) { return ((Node) object).children; }
        public boolean disposed(Object object) { return ((Node) object).disposed; }
        public void requireInitialized(Object module) {
            if (mode.equals("initialization")) throw new IllegalStateException("missing helper");
        }
        public JsonObject capture(Object module) {
            captures++;
            if (mode.equals("capture-throw")) throw new IllegalStateException("incomplete read");
            JsonObject graph = new JsonObject(); JsonArray nodes = new JsonArray();
            nodes.add(mode.equals("mismatch") ? captures : 1); graph.add("nodes", nodes); return graph;
        }
        public void dispose(Object module) {
            disposals++;
            if (mode.equals("dispose-throw")) throw new IllegalStateException("cleanup failed");
            root.disposed = true;
            if (!mode.equals("partial-dispose")) root.children.forEach(child -> child.disposed = true);
        }
    }
    public static void run() throws Exception {
        for (String mode : List.of("success", "factory-throw", "wrong-root", "attached", "foreign-child",
                "cycle", "too-many", "too-deep", "disposed", "initialization", "capture-throw", "mismatch",
                "changed-owner", "dispose-throw", "partial-dispose")) {
            Fake host = new Fake(mode);
            List<String> reports = new ArrayList<>(); boolean failed = false;
            try {
                JsonObject result = GridDetachedFactory.run(host, reports::add);
                check(result.get("disposalVerified").getAsBoolean());
            } catch (IllegalStateException error) {
                failed = true; check(error.getMessage().contains("no retry"));
            }
            check(failed != mode.equals("success")); check(host.creates == 1);
            boolean cleanup = List.of("success", "initialization", "capture-throw", "mismatch",
                "dispose-throw", "partial-dispose").contains(mode);
            check(host.disposals == (cleanup ? 1 : 0));
            JsonObject report = JsonParser.parseString(reports.get(reports.size() - 1)).getAsJsonObject();
            check(report.get("factoryReturned").getAsBoolean() != mode.equals("factory-throw"));
            check(report.get("stage").getAsString().equals(failed ? "uncertain-stop" : "complete"));
        }
        fixtureGuards();
        // A watchdog response does not cancel cleanup when native work returns.
        Fake late = new Fake("success");
        List<Runnable> document = new ArrayList<>(), controller = new ArrayList<>(), timers = new ArrayList<>();
        int[] outcome = new int[3];
        GridReadJob.start(document::add, (task, delay) -> (delay == 0 ? controller : timers).add(task),
            () -> GridDetachedFactory.run(late, report -> {
                if (report.contains("\"factoryAttempted\":true")) timers.forEach(Runnable::run);
            }), result -> outcome[0]++, error -> outcome[1]++, () -> outcome[2]++);
        document.forEach(Runnable::run); controller.forEach(Runnable::run);
        check(late.disposals == 1 && outcome[0] == 0 && outcome[1] == 0 && outcome[2] == 1);
        System.out.println("Detached factory: ownership bounds, failures, cleanup, and late completion pass.");
    }
    private static void fixtureGuards() throws Exception {
        JsonObject live = JsonParser.parseString(java.nio.file.Files.readString(java.nio.file.Path.of(
            System.getProperty("gridFixtureBaseline")))).getAsJsonObject().getAsJsonObject("graph");
        JsonArray modules = GridFixtureValue.refs(GridFixtureValue.node(live, live.get("root").getAsInt()), 6428);
        JsonArray uuids = new JsonArray();
        for (JsonElement id : modules) uuids.add(GridFixtureValue.scalar(GridFixtureValue.node(live, id.getAsInt()), 15));
        JsonObject params = new JsonObject(); params.add("moduleUuids", uuids);
        params.add("expectedNodes", live.getAsJsonArray("nodes"));
        GridFixtureCable.require(live, GridFactorySymbols.parse(params));
        for (String key : List.of("before", "after", "typeUuid")) {
            JsonObject changed = params.deepCopy(); changed.addProperty(key, "other");
            refuses(() -> GridFactorySymbols.parse(changed));
        }
        JsonObject spare = GridFixtureValue.node(live, modules.get(3).getAsInt());
        JsonObject body = GridFixtureValue.node(live, GridFixtureValue.refs(spare, 406).get(0).getAsInt());
        Set<Integer> ids = new HashSet<>(); ids.add(spare.get("id").getAsInt()); ids.add(body.get("id").getAsInt());
        for (JsonElement id : GridFixtureValue.refs(body, 173)) ids.add(id.getAsInt());
        JsonArray nodes = new JsonArray();
        for (JsonElement item : live.getAsJsonArray("nodes"))
            if (ids.contains(item.getAsJsonObject().get("id").getAsInt())) nodes.add(item.deepCopy());
        JsonObject detached = live.deepCopy(); detached.add("nodes", nodes); detached.add("root", spare.get("id"));
        String uuid = GridFixtureValue.scalar(spare, 15).getAsString();
        GridFactorySymbols.requireGraph(detached, uuid);
        refuses(() -> GridFactorySymbols.requireGraph(detached, "stale"));
        for (String mode : List.of("incomplete", "error", "extra", "type", "connected")) {
            JsonObject changed = detached.deepCopy();
            switch (mode) {
                case "incomplete" -> changed.addProperty("complete", false);
                case "error" -> changed.addProperty("errorCount", 1);
                case "extra" -> changed.getAsJsonArray("nodes").add(spare.deepCopy());
                case "type" -> GridFixtureValue.property(GridFixtureValue.node(changed, body.get("id").getAsInt()), 6369)
                    .getAsJsonObject("value").addProperty("data", "other");
                case "connected" -> {
                    int input = GridFixtureValue.refs(body, 173).get(3).getAsInt();
                    JsonObject edge = GridFixtureValue.property(GridFixtureValue.node(changed, input), 7125);
                    edge.addProperty("count", 1); edge.getAsJsonArray("refs").add(999);
                }
            }
            refuses(() -> GridFactorySymbols.requireGraph(changed, uuid));
        }
    }
    private static void refuses(Runnable action) {
        try { action.run(); } catch (RuntimeException expected) { return; }
        throw new AssertionError("expected factory guard refusal");
    }
    private static void check(boolean value) { if (!value) throw new AssertionError("factory lifecycle check failed"); }
}

package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Offline state-machine controls. No host class or command is used. */
public final class GridBreadthTest {
    private static final JsonObject DATA = load();
    private static JsonObject load() {
        try { return JsonParser.parseString(Files.readString(Path.of(
            "src/harnessTest/resources/grid-breadth-fixtures.json"))).getAsJsonObject(); }
        catch (Exception error) { throw new ExceptionInInitializerError(error); }
    }
    private static void require(boolean condition) { if (!condition) throw new AssertionError(); }
    @FunctionalInterface private interface Checked { void run() throws Exception; }
    private static void refuses(Checked action) throws Exception {
        try { action.run(); } catch (IllegalStateException | IllegalArgumentException expected) { return; }
        throw new AssertionError("expected refusal");
    }
    private static JsonObject fixture(String kind) {
        return DATA.getAsJsonObject(kind.equals("factory") ? "boolean" : kind).deepCopy();
    }
    private static JsonObject restored(JsonObject initial) {
        JsonObject next = initial.deepCopy(), f = next.getAsJsonObject("fixture");
        String id = GridBreadthRules.selectedMapping(f);
        JsonObject mapping = f.getAsJsonObject("mappings").getAsJsonObject(id).deepCopy();
        mapping.getAsJsonObject("reference").addProperty("id", "fresh-reference");
        f = GridBreadthRules.withoutMapping(f, id);
        f.getAsJsonObject("mappings").add("fresh-mapping", mapping);
        GridBreadthRules.fields(GridBreadthRules.atom(f, 13, 1)).getAsJsonArray("3616").add("fresh-mapping");
        GridBreadthRules.fields(GridBreadthRules.atom(f, 24, 0)).getAsJsonArray("3615").add("fresh-mapping");
        next.add("fixture", f); return next;
    }
    private static final class Host implements GridBreadthProtocol.Host {
        final String kind;
        final JsonObject initial;
        JsonObject state;
        int commands;
        boolean throwAfterCommand, refuseAdmission;
        CountDownLatch entered, resume;
        Host(String kind) { this.kind = kind; initial = fixture(kind); state = initial.deepCopy(); }
        public JsonObject read() { return state.deepCopy(); }
        public void admit(String action) { if (refuseAdmission) throw new IllegalStateException("domain-refusal"); }
        public void command(String action) throws Exception {
            commands++;
            if (entered != null) { entered.countDown(); require(resume.await(2, TimeUnit.SECONDS)); }
            if (kind.equals("mapping") && commands == 2) state = restored(initial);
            else state.add("fixture", GridBreadthRules.expectedFixture(initial.getAsJsonObject("fixture"), kind, commands));
            if (kind.equals("factory")) {
                if (commands == 1) {
                    JsonObject detached = new JsonObject();
                    JsonObject module = GridBreadthRules.module(initial.getAsJsonObject("fixture"), 9).deepCopy();
                    module.addProperty("uuid", "fresh-factory-uuid");
                    detached.add("module", module); detached.add("mappings", new JsonObject());
                    detached.addProperty("ownedObjects", 100); state.add("detached", detached);
                } else { state.remove("detached"); state.addProperty("disposed", true); }
            }
            if (throwAfterCommand) throw new IllegalStateException("native-failure-after-edit");
        }
    }
    private static void pair(GridBreadthProtocol p, Host h) throws Exception { p.read(h); p.read(h); }
    public static void run() throws Exception {
        Object project = new Object(), edit = new Object();
        var documents = GridBreadthWitness.documents(project, edit, edit);
        require(documents.project() == project && documents.edit() == edit);
        refuses(() -> GridBreadthWitness.documents(project, edit, new Object()));
        refuses(() -> GridBreadthWitness.documents(project, null, null));
        refuses(() -> GridBreadthWitness.documents(null, edit, edit));
        for (String kind : GridBreadthProtocol.CASES) {
            Host h = new Host(kind); GridBreadthProtocol p = new GridBreadthProtocol(kind);
            refuses(p::action); pair(p, h); refuses(() -> p.read(h));
            for (int i = 0; i < 2; i++) {
                p.command(p.action(), h, () -> {}); refuses(() -> p.release(false)); pair(p, h);
            }
            require(h.commands == 2); p.release(false); refuses(p::requireRead);
        }
        // A fresh-baseline change must prevent the native call.
        Host h = new Host("boolean"); GridBreadthProtocol p = new GridBreadthProtocol("boolean"); pair(p, h);
        h.state.getAsJsonObject("fixture").getAsJsonArray("modules").get(0).getAsJsonObject().addProperty("x", 3);
        Host staleHost = h; GridBreadthProtocol stale = p;
        refuses(() -> stale.command(stale.action(), staleHost, () -> {}));
        require(h.commands == 0 && p.locked()); p.release(true);
        Host domainHost = new Host("mapping"); GridBreadthProtocol domain = new GridBreadthProtocol("mapping");
        pair(domain, domainHost); domainHost.refuseAdmission = true;
        refuses(() -> domain.command(domain.action(), domainHost, () -> {}));
        require(domainHost.commands == 0 && domain.locked());
        Host guardHost = new Host("boolean"); GridBreadthProtocol guard = new GridBreadthProtocol("boolean");
        pair(guard, guardHost);
        refuses(() -> guard.command(guard.action(), guardHost, () -> { throw new IllegalStateException("selection"); }));
        require(guardHost.commands == 0 && guard.locked());
        Host pairHost = new Host("boolean"); GridBreadthProtocol mismatch = new GridBreadthProtocol("boolean");
        mismatch.read(pairHost); pairHost.state.getAsJsonObject("witness").addProperty("engineActive", true);
        refuses(() -> mismatch.read(pairHost)); require(mismatch.locked() && pairHost.commands == 0);
        // A failure after native entry must retain the lock and the fixture.
        h = new Host("boolean"); p = new GridBreadthProtocol("boolean"); pair(p, h); h.throwAfterCommand = true;
        Host failedHost = h; GridBreadthProtocol failed = p;
        refuses(() -> failed.command(failed.action(), failedHost, () -> {}));
        require(h.commands == 1 && p.locked()); refuses(() -> failed.release(true));
        refuses(failed::action); p.inspect(); p.inspect(); refuses(p::inspect);
        // A writer receipt cannot stand in for descriptor readback.
        h = new Host("boolean"); p = new GridBreadthProtocol("boolean"); pair(p, h);
        p.command(p.action(), h, () -> {}); h.state = h.initial.deepCopy();
        Host echoHost = h; GridBreadthProtocol echo = p; refuses(() -> echo.read(echoHost)); require(p.locked());
        // A timeout during a native call stays locked after its late return.
        Host lateHost = new Host("boolean"); GridBreadthProtocol late = new GridBreadthProtocol("boolean");
        pair(late, lateHost); lateHost.entered = new CountDownLatch(1); lateHost.resume = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<?> task = executor.submit(() -> {
                try { late.command("boolean-enable", lateHost, () -> {}); }
                catch (Exception error) { throw new RuntimeException(error); }
            });
            require(lateHost.entered.await(2, TimeUnit.SECONDS)); late.fail("timeout");
            lateHost.resume.countDown(); task.get(2, TimeUnit.SECONDS);
            require(late.locked() && lateHost.commands == 1); refuses(late::action); refuses(() -> late.release(false));
        } finally { executor.shutdownNow(); }
        JsonObject base = fixture("mapping"), next = restored(base);
        GridBreadthRules.compareFixture(base.getAsJsonObject("fixture"), next.getAsJsonObject("fixture"), "mapping", 2);
        next.getAsJsonObject("fixture").getAsJsonObject("mappings").getAsJsonObject("fresh-mapping")
            .addProperty("11481", false);
        refuses(() -> GridBreadthRules.compareFixture(base.getAsJsonObject("fixture"),
            next.getAsJsonObject("fixture"), "mapping", 2));
        JsonObject reused = restored(base);
        reused.getAsJsonObject("fixture").getAsJsonObject("mappings").getAsJsonObject("fresh-mapping")
            .getAsJsonObject("reference").addProperty("id",
                GridBreadthRules.atom(base.getAsJsonObject("fixture"), 13, 1).get("id").getAsString());
        refuses(() -> GridBreadthRules.compareFixture(base.getAsJsonObject("fixture"),
            reused.getAsJsonObject("fixture"), "mapping", 2));
        descriptorBounds();
        System.out.println("Breadth: typed fixtures, command order, independent pairs, identity limits, failure locks, and late return pass.");
    }
    private record Node(int id, List<Node> children) {}
    private static void descriptorBounds() throws Exception {
        GridGraphRead.Reader reader = new GridGraphRead.Reader() {
            public String name(Object o) { return "test"; }
            public int classId(Object o) { return 1; }
            public List<?> properties(Object o) { return List.of(14, 7); }
            public int id(Object p) { return (int) p; }
            public String propertyName(Object p) { return "test"; }
            public boolean included(Object p, Object o) { return true; }
            public boolean relationship(Object p) { return (int) p == 7; }
            public int childCount(Object p, Object o) { return ((Node) o).children.size(); }
            public Object child(Object p, Object o, int i) { return ((Node) o).children.get(i); }
            public Object value(Object p, Object o) { return ((Node) o).id; }
        };
        GridBreadthRead read = new GridBreadthRead(reader);
        Node a = new Node(1, List.of()), b = new Node(1, List.of());
        require(read.id(a).equals("1")); refuses(() -> read.id(b));
        GridBreadthRead detached = new GridBreadthRead(reader);
        detached.detachedScope(List.of(a, b));
        require(detached.id(a).equals("detached:0") && detached.id(b).equals("detached:1"));
        require(detached.id(a).equals("detached:0"));
        refuses(() -> detached.id(new Node(1, List.of())));
        refuses(() -> detached.detachedScope(List.of(a)));
        refuses(() -> new GridBreadthRead(reader).detachedScope(List.of(a, a)));
        refuses(() -> new GridBreadthRead(reader).detachedScope(List.of()));
        refuses(() -> new GridBreadthRead(reader).detachedScope(Collections.nCopies(257, a)));
        refuses(() -> read.detachedScope(List.of(a)));
        refuses(() -> new GridBreadthRead(reader).children(new Node(2, List.of(a, a)), 7, 256));
        refuses(() -> new GridBreadthRead(reader).children(new Node(2, Collections.nCopies(257, a)), 7, 256));
        refuses(() -> read.scalar(a, 99));
        GridBreadthRead budget = new GridBreadthRead(reader);
        refuses(() -> { for (int i = 0; i < 4097; i++) budget.scalar(a, 14); });
        JsonObject large = new JsonObject(); large.addProperty("value", "x".repeat(1024 * 1024));
        refuses(() -> GridBreadthRead.bounded(large));
    }
}

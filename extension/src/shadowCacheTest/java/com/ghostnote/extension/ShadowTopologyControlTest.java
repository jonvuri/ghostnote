package com.ghostnote.extension;

import java.util.List;
import java.util.Map;
import com.google.gson.JsonObject;
import static com.ghostnote.extension.ShadowTopologyControl.*;

/** Check independent membership closure and refusal without a running host. */
public final class ShadowTopologyControlTest {
    private static Row row(int index, String id, boolean group, boolean expanded) {
        return new Row(index, id, id, index, group, expanded);
    }
    private static Bank bank(String... ids) { return new Bank(ids.length, 0, List.of(ids)); }
    static Tree plain() { return new Tree(List.of(row(0, "A", false, false)), bank("A"), Map.of()); }
    private static Tree nested(boolean expanded) {
        return new Tree(List.of(row(0, "G", true, expanded), row(1, "H", true, expanded),
            row(2, "A", false, false), row(3, "B", false, false)), bank("G", "B"),
            Map.of("G", bank("H"), "H", bank("A")));
    }
    public static void main(String[] args) {
        validate(plain()); validate(nested(true)); validate(nested(false));
        Row owner = row(0, "G", true, true);
        check(directChildren(bank("A", "G"), List.of(row(0, "A", false, false), row(1, "G", false, false)), owner)
            .equals(bank("A")), "measured group master UUID is removed");
        check(directChildren(bank("G", "A"), List.of(row(0, "G", false, false), row(1, "A", false, false)), owner)
            .equals(bank("A")), "UUID rule does not depend on self position");
        check(directChildren(bank("G"), List.of(row(0, "G", false, false)), owner).equals(bank()), "empty group");
        masterRefuses(bank("A"), List.of(row(0, "A", false, false)), owner);
        masterRefuses(bank("G", "G"), List.of(row(0, "G", false, false), row(1, "G", false, false)), owner);
        masterRefuses(bank("G"), List.of(row(0, "G", true, false)), owner);
        masterRefuses(bank("G"), List.of(row(0, "G", false, true)), owner);
        masterRefuses(bank("G"), List.of(row(0, "wrong", false, false)), owner);
        refuses(new Tree(List.of(row(0, "G", true, true), row(1, "B", false, false), row(2, "A", false, false)),
            bank("G"), Map.of("G", bank("A", "B"))));
        Tree n = nested(true);
        refuses(new Tree(n.flat(), bank("G"), n.children()));
        refuses(new Tree(n.flat(), n.roots(), Map.of("G", bank("H"))));
        refuses(new Tree(n.flat(), n.roots(), Map.of("G", bank("H"), "H", bank())));
        refuses(new Tree(n.flat(), n.roots(), Map.of("G", bank("H"), "H", bank("wrong"))));
        refuses(new Tree(n.flat(), n.roots(), Map.of("G", bank("H", "A"), "H", bank("A"))));
        refuses(new Tree(n.flat(), bank("B"), Map.of("G", bank("H"), "H", bank("G", "A"))));
        refuses(new Tree(n.flat(), new Bank(17, 0, List.of("G", "B")), n.children()));
        refuses(new Tree(n.flat(), new Bank(2, 1, List.of("G", "B")), n.children()));
        refuses(new Tree(List.of(row(0, "A", false, false), row(1, "A", false, false)), bank("A"), Map.of()));
        refuses(new Tree(List.of(row(1, "A", false, false)), bank("A"), Map.of()));
        final ShadowTopologyControl[] holder = new ShadowTopologyControl[1]; final int[] reads = {0};
        holder[0] = new ShadowTopologyControl(() -> { if (++reads[0] == 2) holder[0].changed(); return n; });
        check(!holder[0].snapshot().get("membershipComplete").getAsBoolean(), "callback during read refuses");
        reads[0] = 0;
        ShadowTopologyControl changed = new ShadowTopologyControl(() -> ++reads[0] == 1 ? n : nested(false));
        check(!changed.snapshot().get("membershipComplete").getAsBoolean(), "silent second-read change refuses");
        ShadowTopologyControl errors = new ShadowTopologyControl(() -> { throw new IllegalStateException("unknown-descendant"); });
        check(!errors.snapshot().get("membershipComplete").getAsBoolean(), "unknown descendant refuses");
        var good = new ShadowTopologyControl(() -> n).snapshot();
        check(good.get("membershipComplete").getAsBoolean() && !good.get("complete").getAsBoolean()
            && !good.get("eligible").getAsBoolean() && !good.get("wrapperDeletionAllowed").getAsBoolean(), "bounded membership grants no write authority");
        JsonObject raw = new JsonObject(); raw.addProperty("parent", "G");
        final int[] candidateReads = {0};
        ShadowTopologyControl diagnostic = new ShadowTopologyControl(() -> n, () -> { candidateReads[0]++; return raw.deepCopy(); }, 16);
        diagnostic.snapshot(); check(candidateReads[0] == 0, "normal membership checks do not measure candidates");
        var measured = diagnostic.measurementSnapshot().getAsJsonObject("candidates");
        check(measured.get("coherent").getAsBoolean() && !measured.get("routeProved").getAsBoolean(), "equal candidate reads prove no route");
        check(measured.getAsJsonObject("resources").get("bankTrackHandles").getAsInt() == 272
            && measured.getAsJsonObject("resources").get("parentTrackHandles").getAsInt() == 16, "candidate handle counts");
        reads[0] = 0;
        ShadowTopologyControl divergent = new ShadowTopologyControl(() -> n, () -> {
            JsonObject value = raw.deepCopy(); value.addProperty("parent", ++reads[0]); return value;
        });
        check(!divergent.measurementSnapshot().getAsJsonObject("candidates").get("coherent").getAsBoolean(), "changed parent read refuses");
        holder[0] = new ShadowTopologyControl(() -> n, () -> { holder[0].changed(); return raw.deepCopy(); });
        var interrupted = holder[0].measurementSnapshot();
        check(!interrupted.getAsJsonObject("candidates").get("coherent").getAsBoolean()
            && !interrupted.get("membershipComplete").getAsBoolean(), "callback inside candidate read refuses both results");
        ShadowTopologyControl failed = new ShadowTopologyControl(() -> n, () -> { throw new IllegalStateException("parent-unavailable"); });
        check(!failed.measurementSnapshot().getAsJsonObject("candidates").get("coherent").getAsBoolean(), "parent errors remain diagnostics");
        Tree self = new Tree(n.flat(), n.roots(), Map.of("G", bank("G", "H"), "H", bank("A")));
        var unproved = new ShadowTopologyControl(() -> self, () -> raw.deepCopy()).measurementSnapshot();
        check(!unproved.get("membershipComplete").getAsBoolean()
            && unproved.getAsJsonObject("candidates").get("coherent").getAsBoolean(), "candidate reads cannot drop a self entry to admit a group");
        var flat = new java.util.ArrayList<Row>(); var ids = new java.util.ArrayList<String>();
        for (int index = 0; index < 512; index++) { String id = "T" + index; flat.add(row(index, id, false, false)); ids.add(id); }
        Tree full = new Tree(flat, new Bank(512, 0, ids), Map.of());
        var large = new ShadowTopologyControl(() -> full, null, 512);
        check(large.snapshot().get("membershipComplete").getAsBoolean(), "configured capacity equality passes");
        check(!new ShadowTopologyControl(() -> full, null, 256).snapshot().get("membershipComplete").getAsBoolean(),
            "excess refuses the whole tree");
        flat.add(row(512, "extra", false, false)); ids.add("extra");
        check(!large.snapshot().get("membershipComplete").getAsBoolean(), "512 capacity excess refuses");
        RigConfig config = new RigConfig(); config.tracks = 512;
        for (int size : new int[] {0, 16, 64, 256, 512}) {
            config.cacheTopologyTracks = size; check(config.topologyTracks() == size, "allocation sweep capacity");
            check(config.toJson().get("cacheTopologyTracks").getAsInt() == size, "config echoes capacity");
        }
        for (int size : new int[] {-1, 513}) {
            config.cacheTopologyTracks = size;
            try { config.topologyTracks(); throw new AssertionError("invalid allocation accepted"); }
            catch (IllegalArgumentException expected) { }
        }
        config.cacheTopologyTracks = 512; config.tracks = 256;
        try { config.topologyTracks(); throw new AssertionError("topology exceeds flat bank"); }
        catch (IllegalArgumentException expected) { }
        JsonObject memory = jvmMemory();
        check(memory.get("usedBytes").getAsLong() >= 0 && memory.get("usedBytes").getAsLong()
            <= memory.get("committedBytes").getAsLong() && !memory.get("forcedGc").getAsBoolean(), "shared JVM measurement");
        countedChecks();
        RigConfig normal = new RigConfig(); normal.configureResearchTopology(RuntimeProfile.NORMAL);
        check(normal.tracks == 256 && normal.cacheTopologyTracks == 16 && !normal.cacheTopologyCounted,
            "normal D7 scaffold stays unchanged");
        RigConfig research = new RigConfig(); research.cacheShadowObservers = 2; research.cacheLifecycleResearch = true;
        research.configureResearchTopology(RuntimeProfile.PROBE);
        check(research.tracks == 512 && research.topologyTracks() == 512 && research.cacheTopologyCounted
            && research.contentFilter.equals("ALL_CHANNELS"), "active research defaults select the measured scope and route");
        check(large.bookkeepingEstimatedBytes() == 10544, "512 source estimate excludes host objects");
        System.out.println("Shadow topology controls: 38 test groups passed.");
    }
    private static GroupCount count(String owner, int degree) {
        return new GroupCount(degree + 1, degree, true, row(0, owner, false, false));
    }
    private static void countedChecks() {
        Tree n = nested(true);
        var counts = Map.of("G", count("G", 1), "H", count("H", 1));
        check(countedTree(n.flat(), n.roots(), counts, 16).equals(n), "degree and preorder reconstruct nested membership");
        Tree collapsed = nested(false);
        check(countedTree(collapsed.flat(), collapsed.roots(), counts, 16).equals(collapsed), "collapsed degree tree");
        var changed = countedTree(n.flat(), n.roots(), Map.of("G", count("G", 2), "H", count("H", 0)), 16);
        check(changed.children().get("G").equals(bank("H", "A")) && changed.children().get("H").equals(bank()),
            "a boundary move with unchanged flat UUIDs changes direct degrees");
        var wide = new java.util.ArrayList<Row>(); var ids = new java.util.ArrayList<String>();
        wide.add(row(0, "G", true, true));
        for (int i = 1; i <= 509; i++) { String id = "T" + i; wide.add(row(i, id, false, false)); ids.add(id); }
        wide.add(row(510, "FX", false, false)); wide.add(row(511, "M", false, false));
        Tree full = countedTree(wide, bank("G", "FX", "M"), Map.of("G", count("G", 509)), 512);
        check(full.children().get("G").ids().equals(ids), "512 capacity with a wide group");
        for (GroupCount bad : List.of(new GroupCount(0, 0, true, row(0, "G", false, false)),
            new GroupCount(513, 512, true, row(0, "G", false, false)),
            new GroupCount(2, 0, true, row(0, "G", false, false)),
            new GroupCount(2, 1, false, null), count("foreign", 1),
            new GroupCount(2, 1, true, row(0, "G", true, false)),
            new GroupCount(2, 1, true, row(0, "G", false, true)), count("G", 4))) {
            countedRefuses(n.flat(), n.roots(), Map.of("G", bad, "H", count("H", 1)), 16);
        }
        countedRefuses(n.flat(), bank("G"), counts, 16);
        countedRefuses(n.flat(), n.roots(), Map.of("G", count("G", 1)), 16);
        countedRefuses(wide, bank("G", "FX", "M"), Map.of("G", count("G", 509)), 256);
        checkMasterWindow();
    }
    private static void countedRefuses(List<Row> flat, Bank roots, Map<String, GroupCount> counts, int capacity) {
        try { countedTree(flat, roots, counts, capacity); }
        catch (IllegalStateException expected) { return; }
        throw new AssertionError("expected counted topology refusal");
    }
    private static void checkMasterWindow() {
        int[] values = {3, 0, -1, 0}, requested = {-1};
        Class<?> scrollType;
        try { scrollType = com.bitwig.extension.controller.api.TrackBank.class.getMethod("scrollPosition").getReturnType(); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
        Object count = java.lang.reflect.Proxy.newProxyInstance(ShadowTopologyControlTest.class.getClassLoader(),
            new Class<?>[] {com.bitwig.extension.controller.api.IntegerValue.class}, (proxy, method, args) -> {
                if (method.getName().equals("get")) return values[0]; throw new AssertionError(method);
            });
        Object scroll = java.lang.reflect.Proxy.newProxyInstance(ShadowTopologyControlTest.class.getClassLoader(),
            new Class<?>[] {scrollType}, (proxy, method, args) -> {
                if (method.getName().equals("get")) return values[1];
                if (method.getName().equals("set")) { values[2] = (int) args[0]; values[3]++; return null; }
                throw new AssertionError(method);
            });
        var bank = (com.bitwig.extension.controller.api.TrackBank) java.lang.reflect.Proxy.newProxyInstance(
            ShadowTopologyControlTest.class.getClassLoader(), new Class<?>[] {com.bitwig.extension.controller.api.TrackBank.class},
            (proxy, method, args) -> {
                if (method.getName().equals("itemCount")) return count;
                if (method.getName().equals("scrollPosition")) return scroll; throw new AssertionError(method);
            });
        check(!prepareMasterWindow(bank, 512, requested, 0) && values[2] == 2 && values[3] == 1, "master window warms");
        check(!prepareMasterWindow(bank, 512, requested, 0) && values[3] == 1, "pending window does not repeat commands");
        values[1] = 2;
        check(prepareMasterWindow(bank, 512, requested, 0), "settled master offset permits UUID verification");
        values[0] = 4;
        check(!prepareMasterWindow(bank, 512, requested, 0) && values[2] == 3 && values[3] == 2, "changed degree warms again");
        values[0] = 513;
        try { prepareMasterWindow(bank, 512, requested, 0); throw new AssertionError("excess count accepted"); }
        catch (IllegalStateException expected) { }
    }
    private static void masterRefuses(Bank raw, List<Row> rows, Row owner) {
        try { directChildren(raw, rows, owner); } catch (IllegalStateException expected) { return; }
        throw new AssertionError("expected group master refusal");
    }
    private static void refuses(Tree tree) { try { validate(tree); } catch (IllegalStateException expected) { return; }
        throw new AssertionError("expected incomplete topology refusal"); }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}

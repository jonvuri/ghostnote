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
        ShadowTopologyControl diagnostic = new ShadowTopologyControl(() -> n, () -> { candidateReads[0]++; return raw.deepCopy(); });
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
        System.out.println("Shadow topology controls: 25 test groups passed.");
    }
    private static void masterRefuses(Bank raw, List<Row> rows, Row owner) {
        try { directChildren(raw, rows, owner); } catch (IllegalStateException expected) { return; }
        throw new AssertionError("expected group master refusal");
    }
    private static void refuses(Tree tree) { try { validate(tree); } catch (IllegalStateException expected) { return; }
        throw new AssertionError("expected incomplete topology refusal"); }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}

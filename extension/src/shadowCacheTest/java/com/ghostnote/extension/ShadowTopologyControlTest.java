package com.ghostnote.extension;

import java.util.List;
import java.util.Map;
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
        System.out.println("Shadow topology controls: 10 test groups passed.");
    }
    private static void refuses(Tree tree) { try { validate(tree); } catch (IllegalStateException expected) { return; }
        throw new AssertionError("expected incomplete topology refusal"); }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}

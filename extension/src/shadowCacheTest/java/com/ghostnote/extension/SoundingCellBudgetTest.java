package com.ghostnote.extension;

import java.util.List;
import java.util.Set;

/** Check 8h1b admission by resident sounding cells and the bounded note-step trace. */
public final class SoundingCellBudgetTest {
    private static int passed;

    public static void main(String[] args) {
        run("admission evicts least recently used residents until the clip fits", SoundingCellBudgetTest::lru);
        run("a warm read refreshes the eviction order", SoundingCellBudgetTest::touch);
        run("a clip above the per-clip limit or budget is refused without eviction", SoundingCellBudgetTest::refusal);
        run("busy residents are kept and a clip that cannot fit is refused", SoundingCellBudgetTest::busy);
        run("readmission replaces the prior cell count", SoundingCellBudgetTest::readmission);
        run("release frees cells and configuration is validated", SoundingCellBudgetTest::release);
        run("the trace ring counts states and refuses overwritten ranges", SoundingCellBudgetTest::trace);
        System.out.println("Sounding cell budget: " + passed + " test groups passed.");
    }

    private static void lru() {
        SoundingCellBudget budget = new SoundingCellBudget();
        budget.configure(1_000, 800);
        check(budget.admit("a", 400, Set.of()).admitted(), "a fits");
        check(budget.admit("b", 400, Set.of()).admitted(), "b fits");
        var c = budget.admit("c", 700, Set.of());
        check(c.admitted() && c.evicted().equals(List.of("a", "b")), "c evicts a, then b");
        check(budget.residentCells() == 700 && budget.order().equals(List.of("c")), "only c is resident");
    }

    private static void touch() {
        SoundingCellBudget budget = new SoundingCellBudget();
        budget.configure(1_000, 1_000);
        budget.admit("a", 400, Set.of()); budget.admit("b", 400, Set.of());
        check(budget.touch("a") && !budget.touch("x"), "touch reports residence");
        var c = budget.admit("c", 300, Set.of());
        check(c.evicted().equals(List.of("b")) && budget.order().equals(List.of("a", "c")), "touched a outlives b");
    }

    private static void refusal() {
        SoundingCellBudget budget = new SoundingCellBudget();
        budget.configure(1_000, 600);
        budget.admit("a", 500, Set.of());
        var large = budget.admit("large", 700, Set.of());
        check(!large.admitted() && "clip-sounding-cells-exceed-limit".equals(large.reason()) && large.evicted().isEmpty(),
            "the per-clip limit refuses first");
        check(budget.order().equals(List.of("a")) && budget.residentCells() == 500, "a refusal changes no resident");
    }

    private static void busy() {
        SoundingCellBudget budget = new SoundingCellBudget();
        budget.configure(1_000, 1_000);
        budget.admit("a", 600, Set.of()); budget.admit("b", 300, Set.of());
        var c = budget.admit("c", 500, Set.of("a"));
        check(!c.admitted() && "busy-residents-hold-budget".equals(c.reason()) && c.evicted().equals(List.of("b")),
            "b is evicted, a is busy, and c still does not fit");
        check(budget.order().equals(List.of("a")) && budget.residentCells() == 600, "the evicted b is reported and absent");
    }

    private static void readmission() {
        SoundingCellBudget budget = new SoundingCellBudget();
        budget.configure(1_000, 1_000);
        budget.admit("a", 600, Set.of());
        var again = budget.admit("a", 900, Set.of());
        check(again.admitted() && again.evicted().isEmpty() && budget.residentCells() == 900, "a is counted once");
    }

    private static void release() {
        SoundingCellBudget budget = new SoundingCellBudget();
        budget.configure(1_000, 1_000);
        budget.admit("a", 600, Set.of());
        check(budget.release("a") && !budget.release("a") && budget.residentCells() == 0, "release frees once");
        boolean refused = false;
        try { budget.configure(100, 200); } catch (IllegalArgumentException expected) { refused = true; }
        check(refused, "a per-clip limit above the budget is refused");
    }

    private static void trace() {
        ShadowSoundingProbe.Recorder recorder = new ShadowSoundingProbe.Recorder();
        recorder.record(1, 60, 0, 2, 0.5, 0.25, 0, 1, false, false, 10);
        check(recorder.callbacks == 1 && recorder.onset == 1 && recorder.since(0, 10).getAsJsonArray("rows").isEmpty(),
            "an untraced callback is counted but not stored");
        recorder.tracing = true;
        for (int n = 0; n < ShadowSoundingProbe.TRACE_CAPACITY + 5; n++) recorder.record(n, 60, 3, n % 3, 0.5, 0.25, 0, 1, false, false, 20 + n);
        var all = recorder.since(1, 10);
        check(!all.get("complete").getAsBoolean() && all.get("overwrittenBeforeRead").getAsBoolean(), "an overwritten range is not complete");
        var tail = recorder.since(recorder.callbacks - 2, 10);
        check(tail.get("complete").getAsBoolean() && tail.getAsJsonArray("rows").size() == 2, "the newest entries are complete");
        var row = tail.getAsJsonArray("rows").get(1).getAsJsonArray();
        check(row.get(0).getAsLong() == recorder.callbacks && row.get(3).getAsInt() == 3, "a row keeps sequence and channel");
        check(recorder.empty + recorder.sustain + recorder.onset == recorder.callbacks, "states sum to callbacks");
    }

    private static void run(String name, Runnable test) { test.run(); passed++; System.out.println("PASS  " + name); }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
}

package com.ghostnote.extension;

import com.google.gson.JsonArray;

import java.util.ArrayDeque;

/** Check the 8h2a replay epoch: batch tasks, confirmations, value tasks, decode, and the in-replay edit. */
public final class ReplayEpochTest {
    private static int passed;

    public static void main(String[] args) {
        run("one batch schedules one task and one confirmation", ReplayEpochTest::oneBatch);
        run("a callback after the batch task opens a second batch", ReplayEpochTest::lateBatch);
        run("value callbacks schedule a task that sees the step count", ReplayEpochTest::valueTask);
        run("decode keeps note starts only and flags duplicates and removals", ReplayEpochTest::decode);
        run("an in-replay edit runs once at its callback", ReplayEpochTest::edit);
        run("D30 close preserves notes and detects a later callback", ReplayEpochTest::closeCapture);
        run("D30 waits for the true exists task and the first step task", ReplayEpochTest::closeOrdering);
        System.out.println("Replay epoch: " + passed + " test groups passed.");
    }

    /** A host model: tasks run only when the test drains the queue, that is, after the batch. */
    private static final ArrayDeque<Runnable> queue = new ArrayDeque<>();
    private static ReplayEpoch epoch() { queue.clear(); return new ReplayEpoch(1, "test", 1, queue::add); }
    private static void drain() { while (!queue.isEmpty()) queue.poll().run(); }
    private static void on(ReplayEpoch e, int x, int y, int ch) { e.step(x, y, ch, ReplayEpoch.STATE_ON, 0.5, 4.0 / 512, 0.5, 1, true, false, 2); }

    private static void oneBatch() {
        ReplayEpoch e = epoch();
        on(e, 0, 60, 0); e.step(1, 60, 0, ReplayEpoch.STATE_SUSTAIN, 0, 0, 0, 0, false, false, 3); on(e, 9, 61, 3);
        check(queue.size() == 1, "one batch task");
        drain();
        check(e.batches.size() == 1 && e.batches.get(0).taskSeq == 3 && e.batches.get(0).confirmSeq == 3, "task and confirm see 3");
        check(e.callbacks == 3 && e.onset == 2 && e.sustain == 1 && e.noteCount() == 2, "counts");
    }

    private static void lateBatch() {
        ReplayEpoch e = epoch();
        on(e, 0, 60, 0); drain(); on(e, 5, 60, 0); drain();
        check(e.batches.size() == 2 && e.batches.get(1).firstSeq == 2 && e.batches.get(0).taskSeq == 1, "second batch");
    }

    private static void valueTask() {
        ReplayEpoch e = epoch();
        e.value("clipExists", "true", 2); on(e, 0, 60, 0); drain();
        check(e.values.size() == 1 && e.values.get(0).seq == 0 && e.values.get(0).taskSeq == 1, "value task runs after the batch");
    }

    private static void decode() {
        ReplayEpoch e = epoch();
        on(e, 0, 60, 0); on(e, 0, 60, 1); on(e, 0, 61, 0);
        check(e.noteCount() == 3 && e.duplicates == 0, "channels and pitches stay separate");
        on(e, 0, 60, 0);
        check(e.duplicates == 1 && e.noteCount() == 3, "second note callback is a duplicate");
        e.step(0, 61, 0, ReplayEpoch.STATE_EMPTY, 0, 0, 0, 0, false, false, 4);
        check(e.removed == 1 && e.noteCount() == 2, "an empty callback removes the note");
        JsonArray rows = e.notes(0, 10).getAsJsonArray("rows");
        check(rows.size() == 2 && rows.get(0).getAsJsonArray().get(4).getAsLong() == 4, "rows skip removed notes and keep cells");
        for (int i = 0; i < 200; i++) on(e, 100 + i, 40, 2);
        check(e.noteCount() == 202 && e.notes(0, 50).get("next").getAsInt() > 0, "arrays grow and pages continue");
        check(Math.abs(ShadowKneeFixture.decoratedGain(5) - 0.70) < 1e-9 && Math.abs(ShadowKneeFixture.decoratedChance(2) - 0.24) < 1e-9,
            "decoration goldens match the brain mirror");
        check(ReplayEpoch.key(15, 4_194_303, 127) != ReplayEpoch.key(0, 4_194_303, 127), "key keeps channel at full width");
    }

    private static void edit() {
        ReplayEpoch e = epoch();
        int[] runs = {0};
        e.armEdit(2, () -> runs[0]++);
        on(e, 0, 60, 0); on(e, 1, 60, 0); on(e, 2, 60, 0);
        check(runs[0] == 1 && e.status().getAsJsonObject("edit").get("seq").getAsLong() == 2, "edit at callback 2 only");
    }

    private static void closeCapture() {
        ReplayEpoch e = epoch(); int[] calls = {0};
        e.measureClose(() -> calls[0]++);
        e.value("clipExists", "true", 2); on(e, 0, 60, 0); drain();
        check(e.status().get("closeSeq").getAsLong() == 1 && calls[0] == 1, "one close after both tasks");
        e.step(0, 60, 0, ReplayEpoch.STATE_EMPTY, 0, 0, 0, 0, false, false, 4); drain();
        check(e.status().get("afterClose").getAsLong() == 1, "tripwire counts late callback");
        check(e.closedNotes(0, 10).getAsJsonArray("rows").size() == 1 && e.noteCount() == 0, "snapshot stays exact");
    }

    private static void closeOrdering() {
        ReplayEpoch e = epoch(); e.measureClose(null);
        e.value("clipExists", "false", 2); on(e, 0, 60, 0); drain();
        check(e.status().get("closeSeq").getAsLong() == -1, "false exists does not close");
        e.value("clipExists", "true", 4); drain();
        check(e.status().get("closeSeq").getAsLong() == 1, "later exists task closes");
        e = epoch(); e.measureClose(null); e.value("clipExists", "true", 2); drain();
        check(e.status().get("closeSeq").getAsLong() == 0, "empty clip closes on exists");
    }

    private static void run(String name, Runnable test) { test.run(); passed++; System.out.println("PASS  " + name); }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
}

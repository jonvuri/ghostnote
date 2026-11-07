package com.ghostnote.extension;

import com.google.gson.JsonArray;

/**
 * B18: the content-event window that revision.get returns for a caller's `since`. A window is complete or empty;
 * the caller detects truncation by comparing the count with `now - since`.
 */
public final class ContentWindowTest {
    private static int passed;

    /** A ring of {@code size} after {@code events} recorded events, recorded as Rig's observer does. */
    private static Rig.ContentEvent[] ring(int size, int events) {
        Rig.ContentEvent[] ring = new Rig.ContentEvent[size];
        for (int seq = 1; seq <= events; seq++) {
            ring[(seq - 1) % size] = new Rig.ContentEvent(seq, "ch-" + (seq % 3), seq % 3, seq % 5, seq % 2 == 1);
        }
        return ring;
    }

    public static void main(String[] args) {
        run("a mark without a window returns no events", () -> {
            Rig.ContentEvent[] r = ring(8, 5);
            check(ContentWindow.since(r, 5, 5).size() == 0, "since == now");
            check(ContentWindow.since(r, 5, 9).size() == 0, "since after now (another extension life)");
            check(ContentWindow.since(r, 5, -1).size() == 0, "negative since");
        });
        run("a held window returns every event in (since, now], oldest first, with its fields", () -> {
            Rig.ContentEvent[] r = ring(8, 5);
            JsonArray events = ContentWindow.since(r, 5, 2);
            check(events.size() == 3, "three events: " + events);
            check(events.get(0).getAsJsonObject().get("seq").getAsInt() == 3, "oldest first");
            check(events.get(2).getAsJsonObject().get("seq").getAsInt() == 5, "newest last");
            check(events.get(0).getAsJsonObject().get("channelId").getAsString().equals("ch-0"), "channelId kept");
            check(events.get(0).getAsJsonObject().has("slotIndex") && events.get(0).getAsJsonObject().has("filled")
                && events.get(0).getAsJsonObject().has("trackIndex"), "all wire fields");
            check(ContentWindow.since(r, 5, 0).size() == 5, "from the start of a short ring");
        });
        run("after wraparound, exactly the ring size is held and one more is truncated to none", () -> {
            Rig.ContentEvent[] r = ring(8, 30);
            JsonArray full = ContentWindow.since(r, 30, 22);
            check(full.size() == 8, "the whole ring: " + full.size());
            check(full.get(0).getAsJsonObject().get("seq").getAsInt() == 23
                && full.get(7).getAsJsonObject().get("seq").getAsInt() == 30, "seq 23..30 in order");
            check(ContentWindow.since(r, 30, 21).size() == 0, "nine events through an eight-entry ring");
            check(ContentWindow.since(r, 30, 0).size() == 0, "a very old since");
        });
        run("a slot overwritten out of sequence empties the window rather than skipping it", () -> {
            Rig.ContentEvent[] r = ring(8, 6);
            r[3] = null;
            check(ContentWindow.since(r, 6, 2).size() == 0, "a missing event is not a quiet event");
        });
        run("the product ring holds several thousand events", () -> {
            check(Rig.CONTENT_LOG >= 4096, "CONTENT_LOG " + Rig.CONTENT_LOG);
            Rig.ContentEvent[] r = ring(Rig.CONTENT_LOG, Rig.CONTENT_LOG + 100);
            int now = Rig.CONTENT_LOG + 100;
            check(ContentWindow.since(r, now, now - Rig.CONTENT_LOG).size() == Rig.CONTENT_LOG, "the full window");
            check(ContentWindow.since(r, now, now - Rig.CONTENT_LOG - 1).size() == 0, "one past the bound");
        });
        System.out.println("Content window: " + passed + " test groups passed.");
    }

    private static void run(String name, Runnable test) {
        try {
            test.run();
            passed++;
            System.out.println("PASS " + name);
        } catch (AssertionError | RuntimeException error) {
            System.out.println("FAIL " + name + ": " + error);
            throw error;
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}

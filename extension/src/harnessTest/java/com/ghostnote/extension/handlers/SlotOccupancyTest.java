package com.ghostnote.extension.handlers;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/** The `slot.occupancy` scan over a modeled bank (B19 session 2). */
public final class SlotOccupancyTest {
    private static int groups;

    /** A bank of `tracks` rows; `filled[i]` holds the occupied scenes of row i, and null marks no track. */
    private record Bank(int tracks, int scenes, int[][] filled) implements SlotOccupancyHandlers.Source {
        public boolean exists(int i) { return i < filled.length && filled[i] != null; }
        public String channelId(int i) { return "id-" + i; }
        public String name(int i) { return "Track " + i; }
        public int position(int i) { return i; }
        public String type(int i) { return i == 0 ? "Group" : "Instrument"; }
        public boolean hasContent(int i, int j) {
            for (int scene : filled[i]) if (scene == j) return true;
            return false;
        }
    }

    public static void main(String[] args) {
        run("lists every existing track in bank order with ascending occupied scenes", () -> {
            JsonArray rows = SlotOccupancyHandlers.scan(new Bank(8, 16, new int[][] {
                {0, 3}, null, {}, {15, 2, 7},
            }));
            check(rows.size() == 3, "absent rows are skipped: " + rows);
            JsonObject first = rows.get(0).getAsJsonObject();
            check(first.get("index").getAsInt() == 0 && first.get("channelId").getAsString().equals("id-0")
                && first.get("type").getAsString().equals("Group"), "identity fields: " + first);
            check(first.getAsJsonArray("occupied").toString().equals("[0,3]"), "occupied: " + first);
            JsonObject empty = rows.get(1).getAsJsonObject();
            check(empty.get("index").getAsInt() == 2 && empty.getAsJsonArray("occupied").isEmpty(),
                "a track with no clip is listed with an empty array: " + empty);
            check(rows.get(2).getAsJsonObject().getAsJsonArray("occupied").toString().equals("[2,7,15]"),
                "scenes ascend whatever order the model holds them in");
        });
        run("reads only scenes inside the bank window", () -> {
            JsonArray rows = SlotOccupancyHandlers.scan(new Bank(1, 4, new int[][] {{1, 4, 9}}));
            check(rows.get(0).getAsJsonObject().getAsJsonArray("occupied").toString().equals("[1]"),
                "scene 4 and beyond are outside a 4-scene window: " + rows);
        });
        run("the default 256 x 128 bank is one bounded loop", () -> {
            int[][] filled = new int[256][];
            for (int i = 0; i < filled.length; i++) filled[i] = i % 2 == 0 ? new int[] {0, 64, 127} : new int[0];
            JsonArray rows = SlotOccupancyHandlers.scan(new Bank(256, 128, filled));
            check(rows.size() == 256, "every track is listed");
            int occupied = 0;
            for (var row : rows) occupied += row.getAsJsonObject().getAsJsonArray("occupied").size();
            check(occupied == 128 * 3, "occupied count: " + occupied);
        });
        System.out.println("SlotOccupancyTest: " + groups + " test groups passed.");
    }

    private static void run(String name, Runnable body) {
        body.run();
        groups++;
    }

    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}

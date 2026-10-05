package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/** Check the 8h3b fetch formats: every format gives the rows of the 8h2a format, field for field. */
public final class ReplayFetchTest {
    private static int passed;

    public static void main(String[] args) {
        run("every format decodes to the rows, on every page", ReplayFetchTest::roundTrip);
        run("a default field is omitted only when every note has it", ReplayFetchTest::omission);
        run("value tables use u8, u16, or raw f64 by distinct count", ReplayFetchTest::tables);
        run("removed notes are not in the capture", ReplayFetchTest::removed);
        System.out.println("Replay fetch: " + passed + " test groups passed.");
    }

    private static ReplayFetch.Capture capture(int n, int distinctVelocity, boolean defaults) {
        byte[] channel = new byte[n], pitch = new byte[n]; int[] cell = new int[n];
        double[] velocity = new double[n], duration = new double[n], gain = new double[n], chance = new double[n];
        boolean[] enabled = new boolean[n], muted = new boolean[n], gone = new boolean[n];
        for (int i = 0; i < n; i++) {
            channel[i] = (byte) (i % 16); pitch[i] = (byte) (i % 128); cell[i] = i * 7;
            velocity[i] = (i % distinctVelocity + 1) / 127.0 + (distinctVelocity > 256 ? i * 1e-9 : 0);
            duration[i] = (1 + i % 64) / 512.0;
            gain[i] = defaults ? 0 : (i % 3) * 0.25; chance[i] = defaults ? 1 : 0.5 + (i % 2) * 0.24;
            enabled[i] = defaults || i % 5 != 0; muted[i] = !defaults && i % 7 == 3;
        }
        return new ReplayFetch.Capture(n, channel, pitch, cell, velocity, duration, gain, chance, enabled, muted, gone);
    }

    /** The test decoder. It mirrors the brain decoder and returns rows as the rows format writes them. */
    private static JsonArray decode(JsonObject page) {
        String format = page.get("format").getAsString();
        if (format.equals("rows")) return page.getAsJsonArray("rows");
        int n = page.get("size").getAsInt();
        Map<String, double[]> columns = new HashMap<>();
        JsonObject tables = page.has("tables") ? page.getAsJsonObject("tables") : new JsonObject();
        if (format.startsWith("packed")) {
            ByteBuffer in = ByteBuffer.wrap(Base64.getDecoder().decode(page.get("data").getAsString())).order(ByteOrder.LITTLE_ENDIAN);
            for (JsonElement s : page.getAsJsonArray("sections")) {
                String name = s.getAsJsonArray().get(0).getAsString(), type = s.getAsJsonArray().get(1).getAsString();
                double[] values = new double[n];
                for (int i = 0; i < n; i++) values[i] = switch (type) {
                    case "f64" -> in.getDouble(); case "i32" -> in.getInt(); case "u16" -> in.getShort() & 0xffff; default -> in.get() & 0xff; };
                columns.put(name, values);
            }
        } else {
            for (String name : new String[] {"channel", "cell", "pitch", "durationCells", "velocity", "gain", "chance", "chanceEnabled", "muted"}) {
                if (!page.has(name)) continue;
                JsonArray a = page.getAsJsonArray(name); double[] values = new double[n];
                for (int i = 0; i < n; i++) values[i] = a.get(i).getAsDouble();
                columns.put(name, values);
            }
        }
        for (String name : tables.keySet()) {
            JsonArray t = tables.getAsJsonArray(name); double[] values = columns.get(name);
            for (int i = 0; i < n; i++) values[i] = t.get((int) values[i]).getAsDouble();
        }
        JsonArray rows = new JsonArray();
        for (int i = 0; i < n; i++) {
            JsonArray row = new JsonArray();
            row.add((byte) columns.get("channel")[i]); row.add((int) columns.get("cell")[i]); row.add((byte) columns.get("pitch")[i]);
            row.add(columns.get("velocity")[i]); row.add((long) columns.get("durationCells")[i]);
            row.add(columns.containsKey("gain") ? columns.get("gain")[i] : ReplayFetch.DEFAULT_GAIN);
            row.add(columns.containsKey("chance") ? columns.get("chance")[i] : ReplayFetch.DEFAULT_CHANCE);
            row.add(!columns.containsKey("chanceEnabled") || columns.get("chanceEnabled")[i] == 1);
            row.add(columns.containsKey("muted") && columns.get("muted")[i] == 1);
            rows.add(row);
        }
        return rows;
    }

    private static void roundTrip() {
        for (boolean defaults : new boolean[] {false, true}) {
            ReplayFetch.Capture c = capture(1_000, 40, defaults);
            JsonArray expected = ReplayFetch.encode(c, "rows", 0, Integer.MAX_VALUE).getAsJsonArray("rows");
            for (String format : ReplayFetch.FORMATS) {
                JsonArray all = new JsonArray();
                for (int from = 0; from >= 0; ) {
                    JsonObject page = ReplayFetch.encode(c, format, from, 300);
                    all.addAll(decode(page)); from = page.get("next").getAsInt();
                }
                check(all.equals(expected), format + " pages equal the rows, defaults=" + defaults);
            }
        }
        ReplayFetch.Capture empty = capture(0, 1, false);
        for (String format : ReplayFetch.FORMATS) {
            JsonObject page = ReplayFetch.encode(empty, format, 0, 10);
            check(page.get("size").getAsInt() == 0 && page.get("next").getAsInt() == -1 && decode(page).isEmpty(), format + " empty");
        }
    }

    private static void omission() {
        JsonObject all = ReplayFetch.encode(capture(64, 4, true), "columns", 0, 64);
        check(all.getAsJsonArray("omitted").size() == 4 && !all.has("gain") && !all.has("muted"), "all defaults omitted");
        JsonObject none = ReplayFetch.encode(capture(64, 4, false), "packed", 0, 64);
        check(none.getAsJsonArray("omitted").isEmpty() && none.getAsJsonArray("sections").size() == 9, "no default field omitted");
    }

    private static void tables() {
        JsonObject small = ReplayFetch.encode(capture(1_000, 40, false), "packedDict", 0, 1_000);
        check(type(small, "velocity").equals("u8") && small.getAsJsonObject("tables").getAsJsonArray("velocity").size() == 40, "u8 table");
        JsonObject mid = ReplayFetch.encode(capture(1_000, 999, false), "packedDict", 0, 1_000);
        check(type(mid, "velocity").equals("u16"), "u16 table");
        check(ReplayFetch.table(new double[] {1, 2}, 0, 2, new int[2]).length == 2, "table keeps distinct values");
        double[] many = new double[ReplayFetch.MAX_DICTIONARY + 1];
        for (int i = 0; i < many.length; i++) many[i] = i;
        check(ReplayFetch.table(many, 0, many.length, new int[many.length]) == null, "too many values give no table");
        JsonArray sections = small.getAsJsonArray("sections");
        int last = 8;
        for (JsonElement s : sections) { int size = ReplayFetch.size(s.getAsJsonArray().get(1).getAsString()); check(size <= last, "widest first"); last = size; }
    }

    private static String type(JsonObject page, String name) {
        for (JsonElement s : page.getAsJsonArray("sections"))
            if (s.getAsJsonArray().get(0).getAsString().equals(name)) return s.getAsJsonArray().get(1).getAsString();
        return "";
    }

    private static void removed() {
        boolean[] gone = {false, true, false};
        ReplayFetch.Capture c = new ReplayFetch.Capture(3, new byte[3], new byte[] {60, 61, 62}, new int[] {0, 1, 2},
            new double[] {.5, .5, .5}, new double[] {1 / 512.0, 1 / 512.0, 1 / 512.0}, new double[3], new double[] {1, 1, 1},
            new boolean[] {true, true, true}, new boolean[3], gone);
        JsonArray rows = ReplayFetch.encode(c, "rows", 0, 10).getAsJsonArray("rows");
        check(c.count() == 2 && rows.get(1).getAsJsonArray().get(2).getAsInt() == 62, "removed note skipped");
    }

    private static void run(String name, Runnable test) { test.run(); passed++; System.out.println("PASS " + name); }
    private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
}

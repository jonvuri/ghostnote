package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 8h3b research: fetch formats for one frozen replay capture. Every format carries the same nine fields as the
 * 8h2a rows. A packed format puts little-endian columns into one base64 string in the JSON frame, so the bridge
 * transport does not change. Every result is research only: complete:false, eligible:false.
 */
public final class ReplayFetch {
    public static final List<String> FORMATS = List.of("rows", "columns", "ints", "packed", "packedDict");
    static final double DEFAULT_GAIN = 0, DEFAULT_CHANCE = 1;
    static final int MAX_DICTIONARY = 65_536;

    private ReplayFetch() { }

    /** The decoded notes at the D30 close, without removed notes. The close task makes this copy. */
    public static final class Capture {
        final int count;
        final byte[] channel, pitch;
        final int[] cell;
        final double[] velocity, duration, gain, chance;
        final boolean[] chanceEnabled, muted;

        Capture(int count, byte[] channel, byte[] pitch, int[] cell, double[] velocity, double[] duration, double[] gain,
                double[] chance, boolean[] chanceEnabled, boolean[] muted, boolean[] gone) {
            int kept = 0;
            for (int i = 0; i < count; i++) if (!gone[i]) kept++;
            this.count = kept;
            this.channel = new byte[kept]; this.pitch = new byte[kept]; this.cell = new int[kept];
            this.velocity = new double[kept]; this.duration = new double[kept]; this.gain = new double[kept];
            this.chance = new double[kept]; this.chanceEnabled = new boolean[kept]; this.muted = new boolean[kept];
            for (int i = 0, at = 0; i < count; i++) {
                if (gone[i]) continue;
                this.channel[at] = channel[i]; this.pitch[at] = pitch[i]; this.cell[at] = cell[i];
                this.velocity[at] = velocity[i]; this.duration[at] = duration[i]; this.gain[at] = gain[i];
                this.chance[at] = chance[i]; this.chanceEnabled[at] = chanceEnabled[i]; this.muted[at] = muted[i];
                at++;
            }
        }

        public int count() { return count; }
    }

    /** Encode notes {@code [from, from + limit)} in {@code format}. {@code next} is -1 after the last page. */
    public static JsonObject encode(Capture c, String format, int from, int limit) {
        int start = Math.max(0, Math.min(from, c.count)), end = (int) Math.min((long) start + Math.max(1, limit), c.count);
        JsonObject result = new JsonObject();
        result.addProperty("format", format);
        result.addProperty("count", c.count); result.addProperty("from", start); result.addProperty("size", end - start);
        result.addProperty("next", end < c.count ? end : -1);
        switch (format) {
            case "rows" -> rows(c, start, end, result);
            case "columns" -> columns(c, start, end, result, false);
            case "ints" -> columns(c, start, end, result, true);
            case "packed" -> packed(c, start, end, result, false);
            case "packedDict" -> packed(c, start, end, result, true);
            default -> throw new IllegalArgumentException("unknown fetch format " + format);
        }
        return result;
    }

    private static void rows(Capture c, int start, int end, JsonObject result) {
        JsonArray rows = new JsonArray();
        for (int i = start; i < end; i++) {
            JsonArray row = new JsonArray();
            row.add(c.channel[i]); row.add(c.cell[i]); row.add(c.pitch[i]); row.add(c.velocity[i]);
            row.add(ShadowProjectCache.normalizeDurationCells(c.duration[i])); row.add(c.gain[i]); row.add(c.chance[i]);
            row.add(c.chanceEnabled[i]); row.add(c.muted[i]);
            rows.add(row);
        }
        result.addProperty("columns", "channel,cell,pitch,velocity,durationCells,gain,chance,chanceEnabled,muted");
        result.add("rows", rows);
    }

    /** Fields whose value is the host default on every note of the page. The decoder fills the default. */
    static List<String> omitted(Capture c, int start, int end) {
        boolean gain = true, chance = true, enabled = true, muted = true;
        for (int i = start; i < end; i++) {
            gain &= Double.compare(c.gain[i], DEFAULT_GAIN) == 0; chance &= Double.compare(c.chance[i], DEFAULT_CHANCE) == 0;
            enabled &= c.chanceEnabled[i]; muted &= !c.muted[i];
        }
        List<String> out = new ArrayList<>();
        if (gain) out.add("gain"); if (chance) out.add("chance"); if (enabled) out.add("chanceEnabled"); if (muted) out.add("muted");
        return out;
    }

    private static JsonArray strings(List<String> values) { JsonArray a = new JsonArray(); values.forEach(a::add); return a; }

    private static double[] field(Capture c, String name) {
        return switch (name) { case "velocity" -> c.velocity; case "gain" -> c.gain; case "chance" -> c.chance;
            default -> throw new IllegalArgumentException(name); };
    }

    /** A value table for one double field, or null when the page has more distinct values than the limit. */
    static double[] table(double[] values, int start, int end, int[] index) {
        Map<Long, Integer> seen = new HashMap<>();
        double[] table = new double[16];
        for (int i = start; i < end; i++) {
            long bits = Double.doubleToRawLongBits(values[i]);
            Integer at = seen.get(bits);
            if (at == null) {
                if (seen.size() == MAX_DICTIONARY) return null;
                at = seen.size(); seen.put(bits, at);
                if (at == table.length) table = Arrays.copyOf(table, table.length * 2);
                table[at] = values[i];
            }
            index[i - start] = at;
        }
        return Arrays.copyOf(table, seen.size());
    }

    private static void columns(Capture c, int start, int end, JsonObject result, boolean dictionary) {
        List<String> omit = omitted(c, start, end);
        result.add("omitted", strings(omit));
        JsonArray channel = new JsonArray(), cell = new JsonArray(), pitch = new JsonArray(), duration = new JsonArray();
        for (int i = start; i < end; i++) {
            channel.add(c.channel[i]); cell.add(c.cell[i]); pitch.add(c.pitch[i]);
            duration.add(ShadowProjectCache.normalizeDurationCells(c.duration[i]));
        }
        result.add("channel", channel); result.add("cell", cell); result.add("pitch", pitch); result.add("durationCells", duration);
        JsonObject tables = new JsonObject();
        int[] index = new int[end - start];
        for (String name : List.of("velocity", "gain", "chance")) {
            if (omit.contains(name)) continue;
            double[] values = field(c, name), table = dictionary ? table(values, start, end, index) : null;
            JsonArray column = new JsonArray();
            if (table != null) {
                JsonArray t = new JsonArray(); for (double v : table) t.add(v);
                tables.add(name, t);
                for (int i = 0; i < end - start; i++) column.add(index[i]);
            } else for (int i = start; i < end; i++) column.add(values[i]);
            result.add(name, column);
        }
        if (dictionary) result.add("tables", tables);
        for (String name : List.of("chanceEnabled", "muted")) {
            if (omit.contains(name)) continue;
            boolean[] values = name.equals("muted") ? c.muted : c.chanceEnabled;
            JsonArray column = new JsonArray();
            for (int i = start; i < end; i++) column.add(values[i] ? 1 : 0);
            result.add(name, column);
        }
    }

    /**
     * Little-endian columns in one block. Sections run from the widest element to the narrowest, so each typed
     * column starts at a multiple of its element size. {@code sections} lists the name and type of each column.
     */
    private static void packed(Capture c, int start, int end, JsonObject result, boolean dictionary) {
        int n = end - start;
        List<String> omit = omitted(c, start, end);
        result.add("omitted", strings(omit));
        JsonObject tables = new JsonObject();
        List<String[]> wide = new ArrayList<>(), mid = new ArrayList<>(), narrow = new ArrayList<>();
        Map<String, int[]> indexes = new HashMap<>();
        for (String name : List.of("velocity", "gain", "chance")) {
            if (omit.contains(name)) continue;
            int[] index = new int[n];
            double[] table = dictionary ? table(field(c, name), start, end, index) : null;
            if (table == null) { wide.add(new String[] {name, "f64"}); continue; }
            JsonArray t = new JsonArray(); for (double v : table) t.add(v);
            tables.add(name, t); indexes.put(name, index);
            (table.length <= 256 ? narrow : mid).add(new String[] {name, table.length <= 256 ? "u8" : "u16"});
        }
        List<String[]> order = new ArrayList<>(wide);
        order.add(new String[] {"cell", "i32"}); order.add(new String[] {"durationCells", "i32"});
        order.addAll(mid);
        order.add(new String[] {"channel", "u8"}); order.add(new String[] {"pitch", "u8"});
        order.addAll(narrow);
        for (String name : List.of("chanceEnabled", "muted")) if (!omit.contains(name)) order.add(new String[] {name, "u8"});
        int bytes = 0;
        for (String[] s : order) bytes += n * size(s[1]);
        ByteBuffer out = ByteBuffer.allocate(bytes).order(ByteOrder.LITTLE_ENDIAN);
        JsonArray sections = new JsonArray();
        for (String[] s : order) {
            JsonArray section = new JsonArray(); section.add(s[0]); section.add(s[1]); sections.add(section);
            String name = s[0];
            switch (name) {
                case "cell" -> { for (int i = start; i < end; i++) out.putInt(c.cell[i]); }
                case "durationCells" -> { for (int i = start; i < end; i++) out.putInt((int) ShadowProjectCache.normalizeDurationCells(c.duration[i])); }
                case "channel" -> out.put(c.channel, start, n);
                case "pitch" -> out.put(c.pitch, start, n);
                case "chanceEnabled", "muted" -> {
                    boolean[] values = name.equals("muted") ? c.muted : c.chanceEnabled;
                    for (int i = start; i < end; i++) out.put((byte) (values[i] ? 1 : 0));
                }
                default -> {
                    if (s[1].equals("f64")) { double[] values = field(c, name); for (int i = start; i < end; i++) out.putDouble(values[i]); }
                    else if (s[1].equals("u16")) { for (int v : indexes.get(name)) out.putShort((short) v); }
                    else for (int v : indexes.get(name)) out.put((byte) v);
                }
            }
        }
        result.add("sections", sections);
        if (dictionary) result.add("tables", tables);
        result.addProperty("data", Base64.getEncoder().encodeToString(out.array()));
    }

    static int size(String type) {
        return switch (type) { case "f64" -> 8; case "i32" -> 4; case "u16" -> 2; case "u8" -> 1;
            default -> throw new IllegalArgumentException(type); };
    }
}

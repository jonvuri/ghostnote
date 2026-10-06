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
 * The {@code notes-v1} page of a clip read: the 8h3b {@code packedDict} format (E229) for all note fields.
 *
 * <p>Each column is one of three encodings. {@code const}: every note in the page has one value, which the
 * frame carries in {@code constants}. {@code dict}: a value table in {@code tables} and one u8 or u16 index for
 * each note. {@code raw}: one f64, i32, or u8 value for each note. The {@code data} block holds the dict and raw
 * sections in column order, little-endian, in one base64 string. The decoder reads it with explicit offsets, so
 * the sections need no alignment.
 */
public final class NoteFrame {
    public static final String FORMAT = "notes-v1";
    static final int MAX_DICTIONARY = 65_536;
    private static final String[] OCCURRENCES = occurrences();

    private NoteFrame() { }

    private static String[] occurrences() {
        var values = com.bitwig.extension.controller.api.NoteOccurrence.values();
        String[] names = new String[values.length];
        for (int i = 0; i < values.length; i++) names[i] = values[i].name();
        return names;
    }

    /** Encode notes {@code [from, from + limit)}. {@code next} is -1 after the last page. */
    static JsonObject encode(ClipReadCapture.Notes notes, int from, int limit) {
        int start = Math.max(0, Math.min(from, notes.count));
        int end = (int) Math.min((long) start + Math.max(1, limit), notes.count);
        int n = end - start;
        JsonObject result = new JsonObject();
        result.addProperty("format", FORMAT);
        result.addProperty("count", notes.count);
        result.addProperty("from", start);
        result.addProperty("size", n);
        result.addProperty("next", end < notes.count ? end : -1);
        JsonArray columns = new JsonArray();
        JsonObject constants = new JsonObject(), tables = new JsonObject();
        List<byte[]> sections = new ArrayList<>();

        int[] channel = new int[n], pitch = new int[n];
        for (int i = 0; i < n; i++) { channel[i] = notes.channel[start + i]; pitch[i] = notes.pitch[start + i]; }
        ints("channel", channel, columns, constants, tables, sections, false);
        ints("pitch", pitch, columns, constants, tables, sections, false);
        ints("cell", Arrays.copyOfRange(notes.cell, start, end), columns, constants, tables, sections, false);
        for (int f = 0; f < ClipReadCapture.DOUBLES.length; f++) {
            doubles(ClipReadCapture.DOUBLES[f], Arrays.copyOfRange(notes.doubles[f], start, end),
                columns, constants, tables, sections);
        }
        for (int f = 0; f < ClipReadCapture.INTS.length; f++) {
            String name = ClipReadCapture.INTS[f];
            ints(name, Arrays.copyOfRange(notes.ints[f], start, end), columns, constants, tables, sections,
                name.equals("occurrence"));
        }
        for (int f = 0; f < ClipReadCapture.FLAGS.length; f++) {
            flags(ClipReadCapture.FLAGS[f], Arrays.copyOfRange(notes.flags[f], start, end), columns, constants, sections);
        }
        int bytes = 0;
        for (byte[] section : sections) bytes += section.length;
        ByteBuffer out = ByteBuffer.allocate(bytes);
        for (byte[] section : sections) out.put(section);
        result.add("columns", columns);
        result.add("constants", constants);
        result.add("tables", tables);
        result.addProperty("data", Base64.getEncoder().encodeToString(out.array()));
        return result;
    }

    private static void column(JsonArray columns, String name, String encoding, String type) {
        JsonArray column = new JsonArray();
        column.add(name); column.add(encoding);
        if (type != null) column.add(type);
        columns.add(column);
    }

    private static ByteBuffer buffer(int bytes) { return ByteBuffer.allocate(bytes).order(ByteOrder.LITTLE_ENDIAN); }

    private static void doubles(String name, double[] values, JsonArray columns, JsonObject constants,
                                JsonObject tables, List<byte[]> sections) {
        if (values.length > 0 && constant(values)) {
            constants.addProperty(name, values[0]);
            column(columns, name, "const", null);
            return;
        }
        Map<Long, Integer> seen = new HashMap<>();
        int[] index = new int[values.length];
        double[] table = new double[Math.min(values.length, 16) + 1];
        boolean dictionary = true;
        for (int i = 0; i < values.length && dictionary; i++) {
            long bits = Double.doubleToRawLongBits(values[i]);
            Integer at = seen.get(bits);
            if (at == null) {
                if (seen.size() == MAX_DICTIONARY) { dictionary = false; break; }
                at = seen.size(); seen.put(bits, at);
                if (at == table.length) table = Arrays.copyOf(table, table.length * 2);
                table[at] = values[i];
            }
            index[i] = at;
        }
        if (!dictionary) {
            ByteBuffer out = buffer(values.length * 8);
            for (double value : values) out.putDouble(value);
            sections.add(out.array());
            column(columns, name, "raw", "f64");
            return;
        }
        JsonArray t = new JsonArray();
        for (int i = 0; i < seen.size(); i++) t.add(table[i]);
        tables.add(name, t);
        indexes(name, index, seen.size(), columns, sections);
    }

    private static void indexes(String name, int[] index, int distinct, JsonArray columns, List<byte[]> sections) {
        if (distinct <= 256) {
            ByteBuffer out = buffer(index.length);
            for (int value : index) out.put((byte) value);
            sections.add(out.array());
            column(columns, name, "dict", "u8");
        } else {
            ByteBuffer out = buffer(index.length * 2);
            for (int value : index) out.putShort((short) value);
            sections.add(out.array());
            column(columns, name, "dict", "u16");
        }
    }

    /** An integer column. {@code occurrence} always uses a table of names, because the ordinal is not wire data. */
    private static void ints(String name, int[] values, JsonArray columns, JsonObject constants, JsonObject tables,
                             List<byte[]> sections, boolean occurrence) {
        if (values.length > 0 && constant(values)) {
            if (occurrence) constants.addProperty(name, OCCURRENCES[values[0]]);
            else constants.addProperty(name, values[0]);
            column(columns, name, "const", null);
            return;
        }
        Map<Integer, Integer> seen = new HashMap<>();
        int[] index = new int[values.length];
        List<Integer> table = new ArrayList<>();
        for (int i = 0; i < values.length; i++) {
            Integer at = seen.get(values[i]);
            if (at == null) {
                at = seen.size(); seen.put(values[i], at); table.add(values[i]);
            }
            index[i] = at;
            if (!occurrence && seen.size() > 256) break;
        }
        if (occurrence || seen.size() <= 256) {
            JsonArray t = new JsonArray();
            for (int value : table) {
                if (occurrence) t.add(OCCURRENCES[value]); else t.add(value);
            }
            tables.add(name, t);
            indexes(name, index, seen.size(), columns, sections);
            return;
        }
        ByteBuffer out = buffer(values.length * 4);
        for (int value : values) out.putInt(value);
        sections.add(out.array());
        column(columns, name, "raw", "i32");
    }

    private static void flags(String name, boolean[] values, JsonArray columns, JsonObject constants,
                              List<byte[]> sections) {
        boolean same = true;
        for (boolean value : values) same &= value == values[0];
        if (values.length > 0 && same) {
            constants.addProperty(name, values[0]);
            column(columns, name, "const", null);
            return;
        }
        ByteBuffer out = buffer(values.length);
        for (boolean value : values) out.put((byte) (value ? 1 : 0));
        sections.add(out.array());
        column(columns, name, "raw", "u8");
    }

    private static boolean constant(double[] values) {
        long first = Double.doubleToRawLongBits(values[0]);
        for (double value : values) if (Double.doubleToRawLongBits(value) != first) return false;
        return true;
    }

    private static boolean constant(int[] values) {
        for (int value : values) if (value != values[0]) return false;
        return true;
    }
}

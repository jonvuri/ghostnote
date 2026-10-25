package com.ghostnote.extension;

import com.bitwig.extension.controller.api.BrowserResultsItem;
import com.google.gson.*;
import java.io.File;
import java.io.InputStream;
import java.lang.reflect.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Exact-build, read-only native result census. No native getters or graph traversal. */
public final class BrowserResultMetadata {
    public static final String JAR_SHA256 = "5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f";
    private volatile JsonObject state = state("idle");
    private Symbols symbols;

    public JsonObject status() { return state.deepCopy(); }
    public boolean pending() { return state.get("state").getAsString().equals("pending"); }

    public void start(BrowserResultsItem[] items, int[] indices, String[] names) {
        if (pending()) throw new IllegalStateException("metadata read is pending");
        if (items.length < 1 || items.length > 16 || indices.length != items.length || names.length != items.length)
            throw new IllegalArgumentException("metadata sample outside 1..16 bound");
        state = state("pending");
        try {
            if (symbols == null) symbols = new Symbols(items[0].getClass());
            Symbols admitted = symbols;
            GridReadSymbols.queue(items[0], () -> {
                JsonObject result = state("done");
                try {
                    GridReadSymbols.requireDocumentThread(items[0]);
                    JsonArray rows = new JsonArray();
                    for (int i = 0; i < items.length; i++) {
                        Object target = admitted.target.invoke(items[i]);
                        if (!admitted.base.isInstance(target)) throw new IllegalStateException("native result target unavailable");
                        JsonObject row = new JsonObject();
                        row.addProperty("index", indices[i]);
                        row.addProperty("observedName", names[i]);
                        row.addProperty("nativeClass", target.getClass().getName());
                        row.add("fields", scalarFields(target, admitted.base));
                        Object root = admitted.root.get(target);
                        row.addProperty("rootClass", root == null ? null : root.getClass().getName());
                        File rootFile = root == null ? null : (File) admitted.rootFile.get(root);
                        row.addProperty("rootFile", rootFile == null ? null : rootFile.getPath());
                        if (admitted.target.invoke(items[i]) != target) throw new IllegalStateException("native result target changed during read");
                        rows.add(row);
                    }
                    result.addProperty("jarSha256", JAR_SHA256);
                    result.add("rows", rows);
                } catch (Exception error) { result = error(error); }
                state = result; // Publish only a complete immutable snapshot across threads.
            });
        } catch (Exception error) { state = error(error); }
    }

    /** Shallow scalar values only; never invoke an object's toString or walk its references. */
    static JsonArray scalarFields(Object target, Class<?> stop) throws IllegalAccessException {
        JsonArray rows = new JsonArray();
        int depth = 0, count = 0;
        for (Class<?> type = target.getClass(); type != null; type = type.getSuperclass()) {
            if (++depth > 16) throw new IllegalStateException("native result hierarchy exceeds bound");
            for (Field field : type.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers())) continue;
                if (++count > 96) throw new IllegalStateException("native result fields exceed bound");
                Class<?> valueType = field.getType();
                if (!(valueType.isPrimitive() || valueType == String.class || valueType == UUID.class
                    || valueType == File.class || valueType.isEnum())) continue;
                field.setAccessible(true);
                Object value = field.get(target);
                JsonObject row = new JsonObject();
                row.addProperty("owner", type.getName());
                row.addProperty("field", field.getName());
                row.addProperty("type", valueType.getName());
                if (value == null) row.add("value", JsonNull.INSTANCE);
                else if (value instanceof Number number) row.addProperty("value", number);
                else if (value instanceof Boolean bool) row.addProperty("value", bool);
                else if (value instanceof File file) row.addProperty("value", file.getPath());
                else if (value instanceof Enum<?> entry) row.addProperty("value", entry.name());
                else row.addProperty("value", value.toString()); // String, UUID, or primitive wrapper only.
                rows.add(row);
            }
            if (type == stop) return rows;
        }
        throw new IllegalStateException("native result base missing");
    }

    private static JsonObject state(String name) {
        JsonObject value = new JsonObject(); value.addProperty("state", name); return value;
    }
    private static JsonObject error(Exception error) {
        JsonObject value = state("error"); value.addProperty("error", error.toString()); return value;
    }

    private static final class Symbols {
        final Class<?> base;
        final Method target;
        final Field root, rootFile;
        Symbols(Class<?> proxy) throws Exception {
            Path jar = Path.of(proxy.getProtectionDomain().getCodeSource().getLocation().toURI());
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = Files.newInputStream(jar)) {
                byte[] buffer = new byte[65536];
                for (int n; (n = input.read(buffer)) != -1;) digest.update(buffer, 0, n);
            }
            if (!JAR_SHA256.equals(HexFormat.of().formatHex(digest.digest())))
                throw new IllegalStateException("unsupported-browser-host-jar");
            ClassLoader loader = proxy.getClassLoader();
            base = Class.forName("CN", false, loader);
            Class<?> rootType = Class.forName("EX", false, loader);
            target = proxy.getMethod("getTarget");
            root = base.getDeclaredField("TtY");
            rootFile = rootType.getDeclaredField("eLY");
            if (root.getType() != rootType || rootFile.getType() != File.class)
                throw new IllegalStateException("browser metadata field types changed");
            root.setAccessible(true); rootFile.setAccessible(true);
        }
    }
}

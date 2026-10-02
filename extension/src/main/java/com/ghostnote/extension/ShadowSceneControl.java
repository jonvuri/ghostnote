package com.ghostnote.extension;

import com.bitwig.extension.controller.api.BooleanValue;
import com.bitwig.extension.controller.api.IntegerValue;
import com.bitwig.extension.controller.api.Scene;
import com.bitwig.extension.controller.api.SceneBank;
import com.bitwig.extension.controller.api.SettableStringValue;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/** Experimental mutable scene guards. Names and positions are not identity keys. */
public final class ShadowSceneControl {
    public static final String REVISION = "8g-scene-controls-v1";
    public static final int MAX_SCENES = 128;
    interface Source {
        int totalCount();
        int scrollPosition();
        boolean exists(int index);
        String name(int index);
        int position(int index);
        void setName(int index, String name);
    }
    private final Source source;
    private final int bankSize;
    private long sequence;

    /** Allocate all host values during extension init. Use the existing scene bank. */
    public ShadowSceneControl(SceneBank bank, int configuredSize) {
        this.bankSize = boundedSize(configuredSize);
        IntegerValue count = bank.itemCount(), scroll = bank.scrollPosition();
        BooleanValue[] exists = new BooleanValue[bankSize];
        SettableStringValue[] names = new SettableStringValue[bankSize];
        IntegerValue[] positions = new IntegerValue[bankSize];
        count.markInterested(); scroll.markInterested();
        count.addValueObserver(value -> changed()); scroll.addValueObserver(value -> changed());
        for (int index = 0; index < bankSize; index++) {
            Scene scene = bank.getScene(index);
            exists[index] = scene.exists(); names[index] = scene.name(); positions[index] = scene.sceneIndex();
            exists[index].markInterested(); names[index].markInterested(); positions[index].markInterested();
            exists[index].addValueObserver(value -> changed()); names[index].addValueObserver(value -> changed());
            positions[index].addValueObserver(value -> changed());
        }
        source = new Source() {
            @Override public int totalCount() { return count.get(); }
            @Override public int scrollPosition() { return scroll.get(); }
            @Override public boolean exists(int index) { return exists[index].get(); }
            @Override public String name(int index) { return names[index].get(); }
            @Override public int position(int index) { return positions[index].get(); }
            @Override public void setName(int index, String name) { names[index].set(name); }
        };
    }
    ShadowSceneControl(Source source, int size) { this.source = source; this.bankSize = boundedSize(size); }
    private static int boundedSize(int size) {
        if (size <= 0) throw new IllegalArgumentException("scene bank must be positive");
        return Math.min(size, MAX_SCENES);
    }
    void changed() { sequence = Math.addExact(sequence, 1); }
    private JsonObject base() {
        JsonObject value = new JsonObject();
        value.addProperty("sceneControlRevision", REVISION); value.addProperty("researchOnly", true);
        value.addProperty("sceneIdentityProved", false); value.addProperty("hostInputOrderingProved", false);
        value.addProperty("namesAreMutable", true); value.addProperty("bankSize", bankSize);
        return value;
    }
    /** Coherence covers delivered callbacks and count/window reads only. */
    public JsonObject snapshot() {
        JsonObject result = base(); long before = sequence;
        result.addProperty("sequenceBeforeRead", before);
        JsonArray scenes = new JsonArray(); boolean readable = true;
        try {
            int total = source.totalCount(), offset = source.scrollPosition();
            result.addProperty("totalCount", total); result.addProperty("windowStart", offset);
            boolean full = total >= 0 && total <= bankSize && offset == 0;
            for (int index = 0; index < bankSize; index++) {
                JsonObject scene = new JsonObject(); scene.addProperty("index", index);
                try {
                    boolean exists = source.exists(index); scene.addProperty("exists", exists);
                    if (exists) {
                        String name = source.name(index); if (name == null) throw new IllegalStateException("scene name is null");
                        int position = source.position(index);
                        scene.addProperty("name", name); scene.addProperty("position", position);
                        if (position != offset + index) full = false;
                    }
                    if (exists != (offset + index < total)) full = false;
                } catch (RuntimeException error) { readable = false; scene.addProperty("readError", error.toString()); }
                scenes.add(scene);
            }
            if (source.totalCount() != total || source.scrollPosition() != offset) readable = false;
            result.addProperty("fullWindow", full && readable);
        } catch (RuntimeException error) {
            readable = false; result.addProperty("readError", error.toString()); result.addProperty("fullWindow", false);
        }
        result.add("scenes", scenes); result.addProperty("sequenceAfterRead", sequence);
        result.addProperty("callbacksChangedDuringRead", sequence != before);
        result.addProperty("coherent", readable && sequence == before);
        return result;
    }
    /** Dispatch one guarded rename. The caller must poll to confirm the new name. */
    public JsonObject setSceneName(int index, String expectedName, int expectedPosition,
                                  int expectedTotalCount, int expectedBankSize, String name) {
        if (index < 0 || index >= bankSize || expectedPosition != index || expectedTotalCount < 0
            || expectedBankSize != bankSize || expectedName == null || name == null || name.isBlank() || name.length() > 128)
            throw new IllegalArgumentException("invalid guarded scene rename");
        JsonObject before = snapshot(); requireGuard(before, index, expectedName, expectedPosition, expectedTotalCount);
        JsonObject checked = snapshot(); requireGuard(checked, index, expectedName, expectedPosition, expectedTotalCount);
        if (before.get("sequenceAfterRead").getAsLong() != checked.get("sequenceAfterRead").getAsLong())
            throw new IllegalStateException("scene callbacks changed before rename");
        source.setName(index, name);
        JsonObject result = base(); result.addProperty("index", index); result.addProperty("requestedName", name);
        result.addProperty("renameDispatched", true); result.addProperty("renameConfirmed", false);
        result.add("before", checked); result.add("after", snapshot()); return result;
    }
    private void requireGuard(JsonObject snapshot, int index, String name, int position, int total) {
        if (!snapshot.get("coherent").getAsBoolean() || !snapshot.get("fullWindow").getAsBoolean()
            || snapshot.get("totalCount").getAsInt() != total || snapshot.get("windowStart").getAsInt() != 0)
            throw new IllegalStateException("scene count or window guard changed");
        JsonObject scene = snapshot.getAsJsonArray("scenes").get(index).getAsJsonObject();
        if (!scene.get("exists").getAsBoolean() || !scene.get("name").getAsString().equals(name)
            || scene.get("position").getAsInt() != position)
            throw new IllegalStateException("scene name or position guard changed");
    }
}

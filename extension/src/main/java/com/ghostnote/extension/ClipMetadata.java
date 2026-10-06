package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.google.gson.JsonObject;

/**
 * The launcher clip metadata block (8h4a). {@code cursor.clipMetadata} and the {@code clip.read} reply both use
 * this one method, so the two replies have the same fields, types, and raw values. The D32 source fingerprint
 * depends on that equality.
 */
public final class ClipMetadata {
    private ClipMetadata() { }

    /** A value read that can throw from the host. */
    private interface Read { Object get() throws Exception; }

    /** Read every metadata value through one clip cursor. A failed value reads as {@code "ERR:<message>"}. */
    public static JsonObject read(Clip clip) {
        JsonObject result = new JsonObject();
        put(result, "exists", () -> clip.exists().get());
        put(result, "name", () -> clip.clipLauncherSlot().name().get());
        put(result, "playStart", () -> clip.getPlayStart().get());
        put(result, "playStop", () -> clip.getPlayStop().get());
        put(result, "loopEnabled", () -> clip.isLoopEnabled().get());
        put(result, "loopStart", () -> clip.getLoopStart().get());
        put(result, "loopLength", () -> clip.getLoopLength().get());
        put(result, "colorRed", () -> clip.color().red());
        put(result, "colorGreen", () -> clip.color().green());
        put(result, "colorBlue", () -> clip.color().blue());
        put(result, "colorAlpha", () -> clip.color().alpha());
        return result;
    }

    /** Mark every value that {@link #read} reads. Call at init only (rule 13). */
    public static void markInterested(Clip clip) {
        clip.exists().markInterested();
        clip.clipLauncherSlot().name().markInterested();
        clip.getPlayStart().markInterested();
        clip.getPlayStop().markInterested();
        clip.isLoopEnabled().markInterested();
        clip.getLoopStart().markInterested();
        clip.getLoopLength().markInterested();
        clip.color().markInterested();
    }

    /** The same rule as {@code HandlerGroup.putGuarded}. */
    private static void put(JsonObject obj, String key, Read read) {
        try {
            Object v = read.get();
            if (v instanceof Boolean b) {
                obj.addProperty(key, b);
            } else if (v instanceof Number n) {
                obj.addProperty(key, n);
            } else {
                obj.addProperty(key, String.valueOf(v));
            }
        } catch (Exception e) {
            obj.addProperty(key, "ERR:" + e.getMessage());
        }
    }
}

package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.google.gson.JsonObject;

/**
 * The launcher clip launch settings (8h4a5). {@code cursor.launchSettings} and the {@code clip.read} reply both
 * use this one method, so the two replies have the same fields, types, and raw values. The {@code clip.read}
 * reply holds them in its own {@code launch} block, outside the {@code metadata} block: the D32 source fingerprint
 * reads the metadata block, and it does not change.
 */
public final class ClipLaunch {
    private ClipLaunch() { }

    /** Read the three launch settings through one clip cursor. A failed value reads as {@code "ERR:<message>"}. */
    public static JsonObject read(Clip clip) {
        JsonObject result = new JsonObject();
        put(result, "launchQuantization", () -> clip.launchQuantization().get());
        put(result, "launchMode", () -> clip.launchMode().get());
        put(result, "useLoopStartAsQuantizationReference", () -> clip.useLoopStartAsQuantizationReference().get());
        return result;
    }

    /** Mark every value that {@link #read} reads. Call at init only (rule 13). */
    public static void markInterested(Clip clip) {
        clip.launchQuantization().markInterested();
        clip.launchMode().markInterested();
        clip.useLoopStartAsQuantizationReference().markInterested();
    }

    private interface Read { Object get() throws Exception; }

    /** The same rule as {@code HandlerGroup.putGuarded}. */
    private static void put(JsonObject obj, String key, Read read) {
        try {
            Object v = read.get();
            if (v instanceof Boolean b) obj.addProperty(key, b);
            else obj.addProperty(key, String.valueOf(v));
        } catch (Exception e) {
            obj.addProperty(key, "ERR:" + e.getMessage());
        }
    }
}

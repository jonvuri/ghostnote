package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.function.BiConsumer;
import java.util.function.Supplier;

/** Complete top-level guard shared by paged writers. The caller owns the write lease. */
public final class DeviceFingerprint {
    private DeviceFingerprint() { }

    public static void validate(JsonObject params, boolean required) {
        var names = params.get("expectedDeviceNames");
        if (names == null || names.isJsonNull()) {
            if (required || params.has("expectedDeviceEnabled"))
                throw new IllegalArgumentException("expectedDeviceNames is required");
            return;
        }
        if (!names.isJsonArray()) throw new IllegalArgumentException("expectedDeviceNames must be an array");
        for (var name : names.getAsJsonArray())
            if (!name.isJsonPrimitive() || !name.getAsJsonPrimitive().isString())
                throw new IllegalArgumentException("expectedDeviceNames must contain strings");
        var track = params.get("expectedTrackChannelId");
        if (track == null || !track.isJsonPrimitive() || !track.getAsJsonPrimitive().isString()
                || track.getAsString().isBlank()) throw new IllegalArgumentException("expectedTrackChannelId is required");
        var enabled = params.get("expectedDeviceEnabled");
        if (enabled != null && !enabled.isJsonNull()) {
            if (!enabled.isJsonArray() || enabled.getAsJsonArray().size() != names.getAsJsonArray().size())
                throw new IllegalArgumentException("expectedDeviceEnabled must align with expectedDeviceNames");
            for (var value : enabled.getAsJsonArray())
                if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isBoolean())
                    throw new IllegalArgumentException("expectedDeviceEnabled must contain booleans");
        }
    }

    public static void track(JsonObject params, String actual) {
        if (params.has("expectedTrackChannelId") && !actual.equals(params.get("expectedTrackChannelId").getAsString()))
            throw new IllegalArgumentException("track identity changed");
    }

    public static void read(JsonObject params, WindowPager.Window window, Supplier<String> track,
            BiConsumer<Runnable, Integer> schedule, BiConsumer<JsonArray, Exception> done) {
        validate(params, false);
        String identity = track.get();
        track(params, identity);
        JsonArray rows = new JsonArray();
        new WindowPager(schedule).read(window, (offset, page, next) -> {
            rows.addAll(page); next.accept(null);
        }, (report, error) -> {
            if (error != null) { done.accept(null, error); return; }
            try {
                if (!identity.equals(track.get())) throw new IllegalStateException("track changed during fingerprint paging");
                if (report.count() < 0 || report.count() != rows.size())
                    throw new IllegalStateException("complete device population is unavailable");
                var names = params.get("expectedDeviceNames");
                var enabled = params.get("expectedDeviceEnabled");
                if (names != null && !names.isJsonNull()) {
                    if (rows.size() != names.getAsJsonArray().size()) throw new IllegalArgumentException("device chain length changed");
                    for (int i = 0; i < rows.size(); i++) {
                        JsonObject row = rows.get(i).getAsJsonObject();
                        if (row.get("index").getAsInt() != i || !row.get("name").equals(names.getAsJsonArray().get(i)))
                            throw new IllegalArgumentException("device chain changed at index " + i);
                        if (enabled != null && !enabled.isJsonNull() && !row.get("enabled").equals(enabled.getAsJsonArray().get(i)))
                            throw new IllegalArgumentException("device enabled chain changed at index " + i);
                    }
                }
            } catch (Exception failure) { done.accept(null, failure); return; }
            done.accept(rows, null);
        });
    }
}

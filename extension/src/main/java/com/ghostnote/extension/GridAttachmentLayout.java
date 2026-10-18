package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** Bounded scalar model of the pinned native layout pass. */
public final class GridAttachmentLayout {
    private GridAttachmentLayout() {}
    public record Rect(String uuid, int x, int y, int width, int height) {
        public Rect {
            UUID.fromString(uuid);
            int right = Math.addExact(x, width), bottom = Math.addExact(y, height);
            if (width < 1 || width > 8 || height < 1 || height > 8 || x < -16 || x > 16
                    || y < -16 || y > 16 || right < -16 || right > 24 || bottom < -16 || bottom > 24)
                throw new IllegalStateException("attachment-rectangle-outside-limit");
        }
        public Rect at(int x, int y) { return new Rect(uuid, x, y, width, height); }
        public JsonObject json() { return new Gson().toJsonTree(this).getAsJsonObject(); }
    }
    public static void requireFree(List<Rect> rectangles) {
        if (rectangles.isEmpty() || rectangles.size() > 5
                || rectangles.stream().map(Rect::uuid).distinct().count() != rectangles.size())
            throw new IllegalStateException("attachment-rectangle-count-or-identity");
        int low = rectangles.stream().mapToInt(Rect::y).min().orElseThrow();
        int high = rectangles.stream().mapToInt(r -> Math.addExact(r.y, r.height)).max().orElseThrow();
        if (high - low > 16) throw new IllegalStateException("attachment-vertical-span");
        for (int i = 0; i < rectangles.size(); i++) for (int j = i + 1; j < rectangles.size(); j++) {
            Rect a = rectangles.get(i), b = rectangles.get(j);
            if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)
                throw new IllegalStateException("attachment-overlap");
        }
    }
    public static List<Rect> simulate(List<Rect> rectangles, String inserted) {
        if (rectangles.isEmpty() || rectangles.size() > 5) throw new IllegalStateException("layout-count");
        List<Rect> sorted = new ArrayList<>(rectangles);
        sorted.sort(Comparator.comparingInt(Rect::x).thenComparing(r -> !r.uuid.equals(inserted)).thenComparingInt(Rect::y));
        int low = sorted.stream().mapToInt(Rect::y).min().orElseThrow();
        int high = sorted.stream().mapToInt(r -> r.y + r.height).max().orElseThrow();
        if (high - low > 16) throw new IllegalStateException("attachment-vertical-span");
        int[] edges = new int[high - low]; Arrays.fill(edges, Integer.MIN_VALUE);
        List<Rect> result = new ArrayList<>();
        for (Rect r : sorted) {
            int x = r.x;
            for (int y = r.y; y < r.y + r.height; y++) x = Math.max(x, edges[y - low]);
            for (int y = r.y; y < r.y + r.height; y++) edges[y - low] = Math.addExact(x, r.width);
            result.add(r.at(x, r.y));
        }
        return List.copyOf(result);
    }
    public static JsonArray admit(List<Rect> existing, Rect detached) {
        if (existing.size() != 4 || detached.x != 0 || detached.y != 0)
            throw new IllegalStateException("attachment-baseline-position");
        int[][] positions = {{-4,-2},{-1,-2},{0,-2},{-1,0}};
        for (int i = 0; i < 4; i++) if (existing.get(i).x != positions[i][0] || existing.get(i).y != positions[i][1])
            throw new IllegalStateException("attachment-baseline-position");
        List<Rect> all = new ArrayList<>(existing); all.add(detached.at(2, 0)); requireFree(all);
        JsonArray predicted = new JsonArray();
        for (Rect r : simulate(all, detached.uuid)) {
            if (!all.contains(r)) throw new IllegalStateException("attachment-layout-would-move");
            predicted.add(r.json());
        }
        return predicted;
    }
}

package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * B18: slices the launcher content-event ring for one reader.
 *
 * A reader holds the epoch of its last observation and asks for the events in
 * `(since, now]`. The reply holds every one of them, oldest first, or none when
 * the ring no longer holds all of them. The reader compares the count with
 * `now - since`, so a short reply is a truncated window, never a quiet one, and
 * an incomplete window costs no reply bytes. Host-free, so the harness can test it.
 */
public final class ContentWindow {
    private ContentWindow() {}

    /**
     * The events after `since` in a ring indexed by `(seq - 1) % ring.length`.
     * A `since` that is negative, at or after `now`, or older than the ring
     * yields no events.
     */
    public static JsonArray since(Rig.ContentEvent[] ring, int now, int since) {
        JsonArray events = new JsonArray();
        if (since < 0 || since >= now || now - since > ring.length) return events;
        for (int seq = since + 1; seq <= now; seq++) {
            Rig.ContentEvent event = ring[(seq - 1) % ring.length];
            if (event == null || event.seq != seq) return new JsonArray();
            JsonObject e = new JsonObject();
            e.addProperty("seq", event.seq);
            e.addProperty("channelId", event.channelId);
            e.addProperty("trackIndex", event.trackIndex);
            e.addProperty("slotIndex", event.slotIndex);
            e.addProperty("filled", event.filled);
            events.add(e);
        }
        return events;
    }
}

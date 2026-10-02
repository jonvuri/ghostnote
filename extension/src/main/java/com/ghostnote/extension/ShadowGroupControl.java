package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/** Read probe-only group flags. A flat bank cannot prove descendants. */
public final class ShadowGroupControl {
    public static final String REVISION = "8g-group-controls-v1";
    private ShadowGroupControl() { }
    public static JsonObject snapshot(Rig rig) {
        if (!rig.profile.hasProbeResources()) throw new IllegalStateException("group research is probe-only");
        JsonObject result = new JsonObject(); JsonArray tracks = new JsonArray();
        result.addProperty("groupControlRevision", REVISION); result.addProperty("researchOnly", true);
        result.addProperty("groupMembershipProved", false); result.addProperty("hostInputOrderingProved", false);
        int bound = Math.min(rig.config.tracks, 256), count = rig.trackBank.itemCount().get();
        int offset = rig.trackBank.scrollPosition().get();
        result.addProperty("windowStart", offset);
        result.addProperty("totalCount", count); result.addProperty("bankSize", bound); boolean readable = true;
        for (int index = 0; index < bound; index++) {
            Track track = rig.trackBank.getItemAt(index); JsonObject row = new JsonObject(); row.addProperty("index", index);
            try {
                if (!track.exists().get()) continue;
                row.addProperty("channelId", track.channelId().get()); row.addProperty("name", track.name().get());
                row.addProperty("isGroup", track.isGroup().get()); row.addProperty("isGroupExpanded", track.isGroupExpanded().get());
            } catch (RuntimeException error) { readable = false; row.addProperty("readError", error.toString()); }
            tracks.add(row);
        }
        result.add("tracks", tracks);
        boolean coherent = readable && offset == 0 && count >= 0 && count <= bound && count == tracks.size()
            && rig.trackBank.itemCount().get() == count && rig.trackBank.scrollPosition().get() == offset;
        result.addProperty("coherent", coherent); result.addProperty("fullWindow", coherent);
        return result;
    }
}

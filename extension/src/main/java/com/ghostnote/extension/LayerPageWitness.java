package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

/** Within one read, a layer channel id must stay at its absolute index across overlapping pages and restore.
 * Layer channelIndex is not assumed to mean an index within this bank. The bank supplies the position;
 * channel ids distinguish a stale page from the newly requested one, even when all layer names match.
 */
public final class LayerPageWitness {
    private final Map<String, Integer> positions = new HashMap<>();
    private final Map<Integer, String> identities = new HashMap<>();

    public boolean matches(JsonArray page) {
        var seen = new HashSet<String>();
        for (var value : page) {
            JsonObject row = value.getAsJsonObject();
            if (!row.has("channelId") || !row.get("channelId").isJsonPrimitive()) return false;
            String id = row.get("channelId").getAsString();
            int index = row.get("index").getAsInt();
            if (id.isEmpty() || id.startsWith("ERR") || !seen.add(id)) return false;
            if (positions.containsKey(id) && positions.get(id) != index) return false;
            if (identities.containsKey(index) && !identities.get(index).equals(id)) return false;
        }
        return true;
    }

    public void accept(JsonArray page) {
        if (!matches(page)) throw new IllegalStateException("layer page identity changed");
        for (var value : page) {
            JsonObject row = value.getAsJsonObject();
            String id = row.get("channelId").getAsString();
            int index = row.get("index").getAsInt();
            positions.put(id, index);
            identities.put(index, id);
        }
    }
}

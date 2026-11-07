package com.ghostnote.extension.handlers;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/** Regression for the live Tool scope retaining the previous FX Layer's five-chain count. */
public final class ContainerPagingTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        JsonObject tool = JsonParser.parseString("""
            {"deviceName":"Tool","devicePosition":13,"hasLayers":false,"hasSlots":false,
             "chainCount":5,"visibleChainCount":0,"chains":[],"chainWindowPosition":0}
            """).getAsJsonObject();
        check(ContainerHandlers.completeNonLayerScope(tool), "skip the stale bank before paging");
        check(tool.get("chainCount").getAsInt() == 0 && tool.get("chainPages").getAsInt() == 0,
            "no nonexistent chains or attempted pages");
        check(tool.get("devicePosition").getAsInt() == 13, "retain the settled target");
        tool.addProperty("hasSlots", true);
        tool.addProperty("namedSlotComplete", false);
        check(ContainerHandlers.completeNonLayerScope(tool) && !tool.get("namedSlotComplete").getAsBoolean(),
            "layer completion does not claim named-slot completion");
        for (String value : new String[] {"true", "null", "\"ERR:unreadable\""}) {
            JsonObject scope = JsonParser.parseString("{\"hasLayers\":" + value + ",\"chainCount\":5}")
                .getAsJsonObject();
            JsonObject before = scope.deepCopy();
            check(!ContainerHandlers.completeNonLayerScope(scope) && scope.equals(before),
                "real containers and unknown types must still use the guarded read");
        }
        System.out.println("Container paging: non-layer stale-count regression passed.");
    }
}

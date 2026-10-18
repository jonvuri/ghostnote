package com.ghostnote.extension;

import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;

/** Delete only the spare Amplify, with at most the admitted incoming cable. */
public final class GridFixtureModuleDelete {
    private GridFixtureModuleDelete() {}

    public static GridFixtureCable.Input parse(JsonObject params) {
        if (params.has("after")) throw new IllegalArgumentException("module deletion has no after source");
        JsonObject guard = params.deepCopy();
        String before = guard.get("before").getAsString();
        // The cable guard checks the before state. It does not change a cable.
        guard.addProperty("after", before.equals("none") ? "sine" : "none");
        return GridFixtureCable.parse(guard);
    }

    public static List<GridReadExplore.Step> modulePath() {
        var path = new ArrayList<>(GridFixtureValue.query().path());
        path.add(new GridReadExplore.Step("module_grid", 6428, "auxiliary_devices", 3));
        return List.copyOf(path);
    }
}

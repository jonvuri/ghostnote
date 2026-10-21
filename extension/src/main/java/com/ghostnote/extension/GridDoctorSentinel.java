package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** Compare descriptor names, IDs, and filter results before any doctor command. */
public final class GridDoctorSentinel {
    private final GridReadSymbols reader;
    private final GridDoctorSymbols table;
    private final JsonObject schemaControls;
    public GridDoctorSentinel(GridReadSymbols reader, GridDoctorSymbols table) throws Exception {
        this.reader = reader; this.table = table;
        schemaControls = GridDoctorSymbols.resource("grid-doctor-schema-controls.json");
    }
    private void schemaControl(Object object) throws Exception {
        JsonObject expected = schemaControls.getAsJsonObject(reader.name(object));
        if (expected == null || reader.classId(object) != expected.get("classId").getAsInt())
            throw new IllegalStateException("doctor-schema-control");
        List<?> actual = reader.properties(object); JsonArray wanted = expected.getAsJsonArray("properties");
        if (actual.size() != wanted.size() || actual.size() > 512) throw new IllegalStateException("doctor-schema-property-count");
        Map<Integer, JsonObject> byId = new HashMap<>();
        for (JsonElement row : wanted) byId.put(row.getAsJsonObject().get("id").getAsInt(), row.getAsJsonObject());
        for (Object property : actual) {
            JsonObject row = byId.remove(reader.id(property));
            if (row == null || !reader.propertyName(property).equals(row.get("name").getAsString())
                    || reader.included(property, object) != row.get("serializerIncluded").getAsBoolean()
                    || reader.relationship(property) != row.get("relationship").getAsBoolean())
                throw new IllegalStateException("doctor-serializer-control-mismatch");
        }
    }
    public void require(Object device) throws Exception {
        Object grid = new GridBreadthRead(reader).grid(device);
        if (!reader.name(device).equals("native_device")) throw new IllegalStateException("doctor-device-sentinel");
        Set<Integer> ids = new HashSet<>(); boolean contents = false;
        List<?> properties = reader.properties(device);
        if (properties.size() > 512) throw new IllegalStateException("doctor-schema-limit");
        for (Object p : properties) {
            int id = reader.id(p);
            if (!ids.add(id)) throw new IllegalStateException("doctor-duplicate-property-id");
            if (id == 406) {
                contents = true;
                if (!reader.propertyName(p).equals("device_contents") || !reader.relationship(p)
                        || !(boolean) table.method("enabled-field").invoke(p)
                        || !reader.rootBridge(p, device) || reader.included(p, device) || (boolean) table.method("serialization-filter").invoke(
                            table.field("filter-instance").get(null), p, device))
                    throw new IllegalStateException("doctor-root-bridge-sentinel");
                if (reader.childCount(p, device) != 1 || reader.child(p, device, 0) == null)
                    throw new IllegalStateException("doctor-root-child");
            }
        }
        if (!contents) throw new IllegalStateException("doctor-contents-absent");
        GridBreadthRead route = new GridBreadthRead(reader);
        schemaControl(route.one(device, 406)); schemaControl(grid);
        Object module = route.children(grid, 6428, 64).get(0);
        schemaControl(module); schemaControl(route.one(module, 406));
    }
}

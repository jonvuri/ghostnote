package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
import java.util.function.Consumer;

/** Guard resource provenance and inert refusals. No vendor class is initialized and no field is read. */
final class GridDoctorGuardsTest {
    interface Work { void run() throws Exception; }
    static int checks;
    static void refuses(Work work) throws Exception {
        try { work.run(); } catch (IllegalStateException | IllegalArgumentException | NoSuchFieldException expected) { checks++; return; }
        throw new AssertionError("expected guard refusal");
    }
    static byte[] encode(JsonObject value) { return (value.toString() + "\n").getBytes(java.nio.charset.StandardCharsets.UTF_8); }
    static int run(ClassLoader loader, Path jar, GridDoctorSymbols table) throws Exception {
        byte[] guardsBytes = GridDoctorGuards.resourceBytes("grid-doctor-guards.json");
        byte[] candidateBytes = GridDoctorGuards.resourceBytes("grid-doctor-candidate.json");
        GridDoctorGuards guards = new GridDoctorGuards(loader, jar, table, guardsBytes, candidateBytes);
        JsonObject metadata = guards.metadata();
        if (metadata.get("fields").getAsInt() != 5 || metadata.get("types").getAsInt() != 1
                || metadata.get("ownedTreeClasses").getAsInt() != 33 || metadata.get("writeAuthority").getAsBoolean()
                || !metadata.get("guardsSha256").getAsString().equals(GridDoctorGuards.sha256(guardsBytes)))
            throw new AssertionError("guard metadata");
        checks++;
        JsonObject source = JsonParser.parseString(new String(guardsBytes, java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
        for (Consumer<JsonObject> mutate : List.<Consumer<JsonObject>>of(
                g -> g.addProperty("format", "other"),
                g -> g.addProperty("jarSha256", "0".repeat(64)),
                g -> g.addProperty("candidateSha256", "0".repeat(64)),
                g -> g.addProperty("writeAuthority", true),
                g -> g.getAsJsonArray("fields").remove(0),
                g -> g.getAsJsonArray("fields").get(0).getAsJsonObject().addProperty("flags", 1),
                g -> g.getAsJsonArray("fields").get(0).getAsJsonObject().addProperty("name", "notARealField"),
                g -> g.getAsJsonArray("fields").get(0).getAsJsonObject().addProperty("check", "false"),
                g -> g.getAsJsonArray("fields").get(1).getAsJsonObject().addProperty("role", "helper-list"),
                g -> g.getAsJsonObject("types").addProperty("project-document", g.getAsJsonObject("types").get("project-document").getAsString() + "X"),
                g -> g.getAsJsonObject("ownedTree").addProperty("managedNodes", 2),
                g -> g.getAsJsonObject("ownedTree").addProperty("maxNodes", 1024),
                g -> g.getAsJsonObject("ownedTree").getAsJsonArray("classes").get(0).getAsJsonObject().addProperty("managed", true))) {
            JsonObject changed = source.deepCopy(); mutate.accept(changed);
            // A changed resource also changes its hash; keep the candidate hash valid so the mutation itself refuses.
            try { new GridDoctorGuards(loader, jar, table, encode(changed), candidateBytes); throw new AssertionError("mutation accepted"); }
            catch (IllegalStateException | IllegalArgumentException | ReflectiveOperationException expected) { checks++; }
        }
        // Inert objects are not the project document and are not owned-tree classes.
        refuses(() -> guards.entry(new Object(), new Object(), table.method("document-manager")));
        refuses(() -> guards.entry(null, new Object(), table.method("document-manager")));
        refuses(() -> guards.ownedTree(List.of(), o -> null));
        refuses(() -> guards.ownedTree(List.of(new Object()), o -> null));
        List<Object> many = new ArrayList<>(); for (int i = 0; i < 257; i++) many.add(new Object());
        refuses(() -> guards.ownedTree(many, o -> null));
        return checks;
    }
}

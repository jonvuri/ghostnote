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
                || metadata.get("ownedTreeClasses").getAsInt() != 36 || metadata.get("writeAuthority").getAsBoolean()
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
        replayOwnedTree(guards, source, loader, jar, table, candidateBytes);
        return checks;
    }
    /** Replay the projected E340 rows. These rows are not the full 77-object ownership census. */
    static void replayOwnedTree(GridDoctorGuards guards, JsonObject resource, ClassLoader loader, Path jar,
            GridDoctorSymbols table, byte[] candidateBytes) throws Exception {
        Path evidence = Path.of("../context/evidence/data/phase9b-doctor/614-second-pass/live-v21-second-pass");
        for (String file : List.of("preset-2-stage-5-read-0.json", "preset-2-stage-5-read-1.json", "preset-2-inspection.json")) {
            JsonObject snapshot = JsonParser.parseString(Files.readString(evidence.resolve(file)))
                .getAsJsonObject().getAsJsonObject("snapshot");
            if (snapshot.get("ownedObjects").getAsInt() != 77) throw new AssertionError("E340 owned count");
            List<String> names = new ArrayList<>();
            for (JsonElement node : snapshot.getAsJsonArray("detached"))
                names.add(node.getAsJsonObject().get("runtimeClass").getAsString().replace('.', '/'));
            guards.ownedTree(names, name -> name, name -> null); checks++;
            // E340's projection omits ports. Add each new port class as a separate inert regression input.
            for (String added : List.of("wKx", "dgk", "vta")) {
                List<String> withPort = new ArrayList<>(names); withPort.add(added);
                guards.ownedTree(withPort, name -> name, name -> null); checks++;
            }
            List<String> unknown = new ArrayList<>(names); unknown.add("unknown");
            refuses(() -> guards.ownedTree(unknown, name -> name, name -> null));
            String managed = resource.getAsJsonObject("ownedTree").getAsJsonArray("managed").get(0).getAsString();
            List<String> duplicate = new ArrayList<>(names); duplicate.add(managed);
            refuses(() -> guards.ownedTree(duplicate, name -> name, name -> null));
            List<String> absent = names.stream().filter(name -> !name.equals(managed)).toList();
            refuses(() -> guards.ownedTree(absent, name -> name, name -> null));
            refuses(() -> guards.ownedTree(names, name -> name, name -> name));
        }
        byte[] oldBytes = Files.readAllBytes(Path.of("../context/evidence/data/phase9b-doctor/614-guarded/guards.json"));
        GridDoctorGuards old = new GridDoctorGuards(loader, jar, table, oldBytes, candidateBytes);
        String managed = resource.getAsJsonObject("ownedTree").getAsJsonArray("managed").get(0).getAsString();
        refuses(() -> old.ownedTree(List.of(managed, "wKx"), name -> name, name -> null));
        List<String> maximum = new ArrayList<>(Collections.nCopies(255, "wKx")); maximum.add(managed);
        guards.ownedTree(maximum, name -> name, name -> null); checks++;
        maximum.add("wKx");
        refuses(() -> guards.ownedTree(maximum, name -> name, name -> null));
    }

}

package com.ghostnote.extension;

import com.google.gson.*;
import java.lang.invoke.MethodType;
import java.lang.reflect.*;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;

/** D52 runtime entry guards. Every check reads; none writes, waits, or initializes a vendor class. */
public final class GridDoctorGuards {
    public static final String FORMAT = "grid-doctor-guards-v1";
    public static final List<String> FIELD_ROLES = List.of("helper-list", "pending-helper", "pending-list",
        "disposal-tracking-flag", "listener-tracking-flag");
    private final Class<?> projectDocument;
    private final Map<String, Field> fields = new HashMap<>();
    private final Map<String, String> checks = new HashMap<>();
    private final Set<String> ownedClasses = new HashSet<>(), managedClasses = new HashSet<>();
    private final int managedNodes, maxNodes, maxDepth;
    public final String guardsSha256, candidateSha256;
    public final long validationNanos;

    static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
    public static byte[] resourceBytes(String name) throws java.io.IOException {
        try (var in = GridDoctorGuards.class.getResourceAsStream("/" + name)) {
            if (in == null) throw new java.io.IOException("doctor-resource-absent:" + name);
            byte[] bytes = in.readNBytes(GridDoctorSymbols.MAX_BYTES + 1);
            if (bytes.length > GridDoctorSymbols.MAX_BYTES) throw new java.io.IOException("doctor-resource-limit");
            return bytes;
        }
    }
    public GridDoctorGuards(GridDoctorSymbols table, Class<?> host) throws Exception {
        this(host.getClassLoader(), Path.of(host.getProtectionDomain().getCodeSource().getLocation().toURI()), table,
            resourceBytes("grid-doctor-guards.json"), resourceBytes("grid-doctor-candidate.json"));
    }
    public GridDoctorGuards(ClassLoader loader, Path jar, GridDoctorSymbols table, byte[] guardsBytes, byte[] candidateBytes)
            throws Exception {
        long start = System.nanoTime();
        JsonObject guards = JsonParser.parseString(new String(guardsBytes, java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
        guardsSha256 = sha256(guardsBytes); candidateSha256 = sha256(candidateBytes);
        if (!FORMAT.equals(text(guards, "format")) || guards.get("writeAuthority").getAsBoolean()
                || !text(guards, "candidateSha256").equals(candidateSha256)
                || !text(guards, "jarSha256").equals(table.metadata().get("jarSha256").getAsString()))
            throw new IllegalStateException("doctor-guards-provenance");
        Path real = jar.toRealPath();
        JsonObject types = guards.getAsJsonObject("types");
        if (types.size() != 1) throw new IllegalStateException("doctor-guards-types");
        projectDocument = load(loader, real, text(types, "project-document"));
        if (projectDocument.getSuperclass() != table.type("edit-document") || projectDocument == table.type("project-root"))
            throw new IllegalStateException("doctor-guards-project-document");
        JsonArray rows = guards.getAsJsonArray("fields");
        if (rows.size() != FIELD_ROLES.size()) throw new IllegalStateException("doctor-guards-field-count");
        for (JsonElement item : rows) {
            JsonObject row = item.getAsJsonObject(); String role = text(row, "role");
            if (!FIELD_ROLES.contains(role) || fields.containsKey(role)) throw new IllegalStateException("doctor-guards-role:" + role);
            Class<?> declaring = load(loader, real, text(row, "declaring"));
            Field field = declaring.getDeclaredField(text(row, "name"));
            Class<?> type = MethodType.fromMethodDescriptorString("()" + text(row, "descriptor"), loader).returnType();
            boolean isStatic = Modifier.isStatic(field.getModifiers());
            if (field.getType() != type || field.getModifiers() != row.get("flags").getAsInt()
                    || isStatic != row.get("static").getAsBoolean())
                throw new IllegalStateException("doctor-guards-field-shape:" + role);
            String check = text(row, "check");
            if (!(check.equals("empty") && List.class.isAssignableFrom(type)
                    || check.equals("null") && !type.isPrimitive()
                    || check.equals("false") && type == boolean.class && isStatic))
                throw new IllegalStateException("doctor-guards-check:" + role);
            field.setAccessible(true); fields.put(role, field); checks.put(role, check);
        }
        JsonObject tree = guards.getAsJsonObject("ownedTree");
        for (JsonElement item : tree.getAsJsonArray("classes")) {
            JsonObject row = item.getAsJsonObject(); String name = text(row, "name");
            load(loader, real, name);
            if (!ownedClasses.add(name)) throw new IllegalStateException("doctor-guards-owned-duplicate");
            if (row.get("managed").getAsBoolean()) managedClasses.add(name);
        }
        for (JsonElement item : tree.getAsJsonArray("managed"))
            if (!managedClasses.contains(item.getAsString())) throw new IllegalStateException("doctor-guards-managed");
        managedNodes = tree.get("managedNodes").getAsInt(); maxNodes = tree.get("maxNodes").getAsInt();
        maxDepth = tree.get("maxDepth").getAsInt();
        if (managedClasses.size() != tree.getAsJsonArray("managed").size() || managedNodes != 1
                || maxNodes <= 0 || maxNodes > 256 || maxDepth <= 0 || maxDepth > 12 || ownedClasses.size() > 64)
            throw new IllegalStateException("doctor-guards-owned-tree");
        validationNanos = System.nanoTime() - start;
    }
    private static Class<?> load(ClassLoader loader, Path jar, String name) throws Exception {
        Class<?> type = Class.forName(name.replace('/', '.'), false, loader);
        if (!Path.of(type.getProtectionDomain().getCodeSource().getLocation().toURI()).toRealPath().equals(jar))
            throw new IllegalStateException("doctor-guards-foreign-class:" + name);
        return type;
    }
    public JsonObject metadata() {
        JsonObject r = new JsonObject(); r.addProperty("format", FORMAT); r.addProperty("types", 1);
        r.addProperty("fields", fields.size()); r.addProperty("ownedTreeClasses", ownedClasses.size());
        r.addProperty("guardsSha256", guardsSha256); r.addProperty("candidateSha256", candidateSha256);
        r.addProperty("validationNanos", validationNanos); r.addProperty("writeAuthority", false); return r;
    }
    private boolean check(String role, Object document) throws Exception {
        Field field = fields.get(role); Object value = field.get(Modifier.isStatic(field.getModifiers()) ? null : document);
        return switch (checks.get(role)) {
            case "empty" -> value instanceof List<?> list && list.isEmpty();
            case "null" -> value == null;
            default -> Boolean.FALSE.equals(value);
        };
    }
    /** Read-only entry checks before one native command. A false check refuses the command. */
    public JsonObject entry(Object editDocument, Object manager, Method documentManager) throws Exception {
        long start = System.nanoTime();
        if (editDocument == null || manager == null) throw new IllegalStateException("doctor-entry-guard:inputs");
        // Refuse a foreign class before any field read on it.
        if (editDocument.getClass() != projectDocument) throw new IllegalStateException("doctor-entry-guard:projectDocumentClass");
        JsonObject checks = new JsonObject();
        checks.addProperty("projectDocumentClass", true);
        checks.addProperty("sameManager", documentManager.invoke(editDocument) == manager);
        checks.addProperty("helperList", check("helper-list", editDocument));
        checks.addProperty("pendingHelper", check("pending-helper", editDocument));
        checks.addProperty("pendingList", check("pending-list", editDocument));
        checks.addProperty("disposalTrackingFalse", check("disposal-tracking-flag", null));
        checks.addProperty("listenerTrackingFalse", check("listener-tracking-flag", null));
        List<String> failed = new ArrayList<>();
        for (String key : checks.keySet()) if (!checks.get(key).getAsBoolean()) failed.add(key);
        if (!failed.isEmpty()) throw new IllegalStateException("doctor-entry-guard:" + String.join(",", failed));
        JsonObject r = new JsonObject(); r.addProperty("passed", true); r.add("checks", checks);
        r.addProperty("guardNanos", System.nanoTime() - start); return r;
    }
    public interface Owner { Object owner(Object object) throws Exception; }
    /** Exact-class and single-managed-node checks on a proved owned tree before disposal. */
    public JsonObject ownedTree(List<Object> owned, Owner owner) throws Exception {
        if (owned.isEmpty() || owned.size() > maxNodes) throw new IllegalStateException("doctor-owned-tree-size");
        int managed = 0, depth = 0;
        for (Object object : owned) {
            String name = object.getClass().getName().replace('.', '/');
            if (!ownedClasses.contains(name)) throw new IllegalStateException("doctor-owned-tree-class:" + name);
            if (managedClasses.contains(name)) managed++;
            int level = 0;
            for (Object parent = owner.owner(object); parent != null; parent = owner.owner(parent))
                if (++level > maxDepth) throw new IllegalStateException("doctor-owned-tree-depth");
            depth = Math.max(depth, level);
        }
        if (managed != managedNodes) throw new IllegalStateException("doctor-owned-tree-managed:" + managed);
        JsonObject r = new JsonObject(); r.addProperty("passed", true); r.addProperty("nodes", owned.size());
        r.addProperty("managed", managed); r.addProperty("depth", depth); return r;
    }
    private static String text(JsonObject o, String key) { return o.get(key).getAsString(); }
}

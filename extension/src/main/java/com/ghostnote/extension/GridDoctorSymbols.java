package com.ghostnote.extension;

import com.google.gson.*;
import java.io.*;
import java.lang.invoke.MethodType;
import java.lang.reflect.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Candidate metadata only. This class cannot grant write authority. */
public final class GridDoctorSymbols {
    public static final int MAX_BYTES = 131072;
    private final Map<String, Class<?>> types = new HashMap<>();
    private final Map<String, Method> methods = new HashMap<>();
    private final Map<String, Field> fields = new HashMap<>();
    private final JsonObject report;
    private final Path jar;
    private final long size, mtime;
    public final String fingerprint;
    public final long validationNanos;

    public static JsonObject resource(String name) throws IOException {
        try (InputStream in = GridDoctorSymbols.class.getResourceAsStream("/" + name)) {
            if (in == null) throw new IOException("doctor-resource-absent:" + name);
            byte[] bytes = in.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw new IOException("doctor-resource-limit");
            return JsonParser.parseString(new String(bytes, java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
        }
    }
    public GridDoctorSymbols(Class<?> host) throws Exception {
        this(host.getClassLoader(), Path.of(host.getProtectionDomain().getCodeSource().getLocation().toURI()),
            resource("grid-doctor-candidate.json"), resource("grid-doctor-selectors.json"));
    }
    public GridDoctorSymbols(ClassLoader loader, Path path, JsonObject candidate, JsonObject rules) throws Exception {
        long start = System.nanoTime(); report = candidate.deepCopy(); jar = path.toRealPath();
        size = Files.size(jar); mtime = Files.getLastModifiedTime(jar).to(TimeUnit.NANOSECONDS);
        if (size > 64L * 1024 * 1024 || !jar.toString().equals(text(candidate, "jarPath"))
                || mtime != candidate.get("jarMtimeNs").getAsLong()
                || size != candidate.getAsJsonObject("counts").get("jarBytes").getAsLong())
            throw new IllegalStateException("doctor-jar-fingerprint-changed");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = Files.newInputStream(jar)) {
            byte[] bytes = new byte[65536]; long total = 0;
            for (int n; (n = in.read(bytes)) >= 0;) {
                total += n;
                if (total > 64L * 1024 * 1024 || System.nanoTime() - start > 5_000_000_000L)
                    throw new IllegalStateException("doctor-hash-limit");
                digest.update(bytes, 0, n);
            }
            if (total != size) throw new IllegalStateException("doctor-jar-size-changed");
        }
        String sha = HexFormat.of().formatHex(digest.digest());
        if (!sha.equals(text(candidate, "jarSha256"))) throw new IllegalStateException("doctor-jar-hash-changed");
        fingerprint = sha + ":" + size + ":" + mtime;
        validateReport(candidate, rules);
        JsonObject mapped = candidate.getAsJsonObject("types");
        for (String role : mapped.keySet()) {
            Class<?> type = Class.forName(mapped.get(role).getAsString().replace('/', '.'), false, loader);
            if (!Path.of(type.getProtectionDomain().getCodeSource().getLocation().toURI()).toRealPath().equals(jar))
                throw new IllegalStateException("doctor-foreign-class:" + role);
            types.put(role, type);
        }
        for (JsonElement item : candidate.getAsJsonArray("members")) {
            JsonObject row = item.getAsJsonObject(); String role = text(row, "role");
            Class<?> declaring = Class.forName(text(row, "declaring").replace('/', '.'), false, loader);
            Class<?> lookup = Class.forName(text(row, "lookup").replace('/', '.'), false, loader);
            if (!declaring.isAssignableFrom(lookup)) throw new IllegalStateException("doctor-receiver:" + role);
            String desc = text(row, "descriptor");
            if (text(row, "kind").equals("method")) {
                MethodType shape = MethodType.fromMethodDescriptorString(desc, loader);
                Method method = declaring.getDeclaredMethod(text(row, "name"), shape.parameterArray());
                if (method.getReturnType() != shape.returnType() || method.getModifiers() != row.get("flags").getAsInt())
                    throw new IllegalStateException("doctor-method-shape:" + role);
                method.setAccessible(true); methods.put(role, method);
            } else {
                Field field = declaring.getDeclaredField(text(row, "name"));
                if (field.getType() != MethodType.fromMethodDescriptorString("()" + desc, loader).returnType()
                        || field.getModifiers() != row.get("flags").getAsInt())
                    throw new IllegalStateException("doctor-field-shape:" + role);
                field.setAccessible(true); fields.put(role, field);
            }
        }
        for (JsonElement pair : rules.getAsJsonArray("assignable")) {
            JsonArray p = pair.getAsJsonArray();
            if (!type(p.get(1).getAsString()).isAssignableFrom(type(p.get(0).getAsString())))
                throw new IllegalStateException("doctor-type-relationship");
        }
        requireFresh(); validationNanos = System.nanoTime() - start;
    }
    static void validateReport(JsonObject candidate, JsonObject rules) {
        JsonObject verdict = candidate.getAsJsonObject("verdict");
        if (!text(candidate, "result").equals("pass") || verdict == null
                || !text(verdict, "structuralValidation").equals("pass")
                || !text(verdict, "liveValidation").equals("not-run") || verdict.get("writeAuthority").getAsBoolean())
            throw new IllegalStateException("doctor-unvalidated-candidate");
        JsonObject mapped = candidate.getAsJsonObject("types"), expected = rules.getAsJsonObject("types");
        if (mapped.size() != 55 || !mapped.keySet().equals(expected.keySet())
                || new HashSet<>(mapped.asMap().values()).size() != mapped.size())
            throw new IllegalStateException("doctor-type-table");
        Map<String, JsonObject> rows = new HashMap<>();
        for (JsonElement item : candidate.getAsJsonArray("members")) {
            JsonObject row = item.getAsJsonObject();
            if (rows.put(text(row, "role"), row) != null) throw new IllegalStateException("doctor-duplicate-role");
        }
        if (rows.size() != 76 || rules.getAsJsonArray("members").size() != 76)
            throw new IllegalStateException("doctor-incomplete-table");
        Set<String> required = new HashSet<>();
        for (JsonElement item : rules.getAsJsonArray("members")) {
            JsonObject rule = item.getAsJsonObject(); String role = text(rule, "role");
            if (!required.add(role)) throw new IllegalStateException("doctor-duplicate-rule");
            JsonObject row = rows.get(role);
            String signature = text(rule, "signature");
            for (String type : mapped.keySet()) signature = signature.replace("@" + type + ";", "L" + text(mapped, type) + ";");
            if (row == null || !text(row, "lookup").equals(text(mapped, text(rule, "lookupType")))
                    || !text(row, "declaring").equals(text(mapped, text(rule, "declaringType")))
                    || !text(row, "descriptor").equals(signature) || !row.get("flags").equals(rule.get("flags"))
                    || !row.get("kind").equals(rule.get("kind"))
                    || !rule.get("liveInvariant").equals(candidate.getAsJsonObject("liveInvariants").get(role)))
                throw new IllegalStateException("doctor-role-mismatch:" + role);
        }
        if (!required.equals(candidate.getAsJsonObject("liveInvariants").keySet()))
            throw new IllegalStateException("doctor-invariant-table");
    }
    public void requireFresh() throws IOException {
        if (!jar.toRealPath().equals(jar) || Files.size(jar) != size
                || Files.getLastModifiedTime(jar).to(TimeUnit.NANOSECONDS) != mtime)
            throw new IllegalStateException("doctor-jar-changed-during-pass");
    }
    public Class<?> type(String role) { return Objects.requireNonNull(types.get(role), "doctor-missing-type:" + role); }
    public Method method(String role) { return Objects.requireNonNull(methods.get(role), "doctor-missing-method:" + role); }
    public Field field(String role) { return Objects.requireNonNull(fields.get(role), "doctor-missing-field:" + role); }
    public JsonObject metadata() {
        JsonObject r = new JsonObject(); r.addProperty("fingerprint", fingerprint);
        r.addProperty("jarSha256", text(report, "jarSha256")); r.addProperty("selectorSha256", text(report, "selectorSha256"));
        r.addProperty("members", methods.size() + fields.size()); r.addProperty("types", types.size());
        r.addProperty("validationNanos", validationNanos); r.addProperty("writeAuthority", false); return r;
    }
    private static String text(JsonObject o, String key) { return o.get(key).getAsString(); }
}

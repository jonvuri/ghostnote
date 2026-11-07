package com.ghostnote.extension;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;
import java.util.TreeSet;

/** Execute the real static initializer and compare every runtime surface with its golden. */
public final class RuntimeProfileTest {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args[0]);
        Set<String> declarations = methods(read(root, "methods.historical.json"));
        for (RuntimeProfile profile : RuntimeProfile.values()) {
            String file = switch (profile) {
                case NORMAL -> "methods.golden.json";
                case CAPTURE -> "methods.capture.golden.json";
                case PROBE -> "methods.probe.golden.json";
            };
            JsonObject golden = read(root, file);
            // Unlike source scraping, this executes MethodSets' startup validation.
            Set<String> actual = new TreeSet<>(profile.methodNames());
            require(actual.equals(methods(golden)), profile + " methods differ from golden");
            require(actual.size() == golden.get("count").getAsInt(), profile + " count differs");
            require(profile.identity().equals(golden.get("identity").getAsString()), profile + " identity differs");
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(String.join("\n", actual).getBytes(StandardCharsets.UTF_8))).substring(0, 16);
            require(hash.equals(golden.get("methodsHash").getAsString()), profile + " hash differs");
            profile.verifyRegistrations(declarations);
            require(profile.includes("probe.browserDiscovery") == (profile == RuntimeProfile.PROBE),
                "browser discovery escaped the probe profile");
            require(profile.includes("probe.chainInsert") == (profile == RuntimeProfile.PROBE),
                "direct chain insertion escaped the probe profile");
            require(profile.includes("probe.pressure") == (profile == RuntimeProfile.PROBE),
                "pressure reproduction escaped the probe profile");
            System.out.println(profile.identity() + ": " + actual.size() + " methods, " + hash);
        }
        require(RuntimeProfile.kind("probe.browserDiscovery") == WriteGate.Kind.WRITE,
            "browser writes bypass the write gate");
        require(RuntimeProfile.kind("probe.chainInsert") == WriteGate.Kind.WRITE,
            "direct chain insertion bypasses the write gate");
        require(RuntimeProfile.kind("probe.pressure") == WriteGate.Kind.WRITE,
            "pressure writes bypass the write gate");
        Set<String> missing = new TreeSet<>(declarations);
        missing.remove("probe.browserDiscovery");
        refuses(missing);
        Set<String> unknown = new TreeSet<>(declarations);
        unknown.add("unclassified.testMethod");
        refuses(unknown);
        System.out.println("RuntimeProfileTest: PASS");
    }

    private static JsonObject read(Path root, String file) throws Exception {
        return JsonParser.parseString(Files.readString(root.resolve(file))).getAsJsonObject();
    }

    private static Set<String> methods(JsonObject golden) {
        Set<String> result = new TreeSet<>();
        golden.getAsJsonArray("methods").forEach(value -> result.add(value.getAsString()));
        return result;
    }

    private static void refuses(Set<String> declarations) {
        try {
            RuntimeProfile.PROBE.verifyRegistrations(declarations);
        } catch (IllegalStateException expected) {
            require(expected.getMessage().startsWith("wire classification drift:"), "unexpected refusal");
            return;
        }
        throw new AssertionError("invalid registration set was accepted");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}

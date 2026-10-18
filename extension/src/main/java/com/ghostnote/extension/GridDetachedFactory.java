package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;
import java.util.function.Consumer;

/** One detached factory call. No host object leaves this task. */
public final class GridDetachedFactory {
    private GridDetachedFactory() {}
    public interface Host {
        Object create() throws Exception;
        void requireRoot(Object module) throws Exception;
        Object owner(Object object) throws Exception;
        List<?> children(Object object) throws Exception;
        boolean disposed(Object object) throws Exception;
        void requireInitialized(Object module) throws Exception;
        JsonObject capture(Object module) throws Exception;
        void dispose(Object module) throws Exception;
    }

    public static JsonObject run(Host host, Consumer<String> progress) throws Exception {
        JsonObject report = new JsonObject();
        report.addProperty("factoryAttempted", false);
        report.addProperty("factoryReturned", false);
        report.addProperty("ownershipProved", false);
        report.addProperty("disposeAttempted", false);
        report.addProperty("disposalVerified", false);
        Object module = null;
        List<Object> owned = null;
        Throwable failure = null;
        try {
            stage(report, progress, "factory");
            report.addProperty("factoryAttempted", true);
            progress.accept(report.toString());
            long start = System.nanoTime();
            try { module = host.create(); }
            finally { report.addProperty("factoryNanos", System.nanoTime() - start); }
            report.addProperty("factoryReturned", true);
            stage(report, progress, "ownership");
            owned = ownership(host, module);
            report.addProperty("ownershipProved", true);
            report.addProperty("ownedObjects", owned.size());
            stage(report, progress, "initialization");
            host.requireInitialized(module);
            report.addProperty("initializationHelpersPresent", true);
            stage(report, progress, "captures");
            JsonObject first = host.capture(module);
            report.add("capture0", first); progress.accept(report.toString());
            JsonObject second = host.capture(module);
            report.add("capture1", second);
            if (!first.getAsJsonArray("nodes").equals(second.getAsJsonArray("nodes")))
                throw new IllegalStateException("detached-captures-disagree");
        } catch (Throwable error) {
            failure = error;
            report.addProperty("failedStage", report.get("stage").getAsString());
        } finally {
            if (owned != null) {
                try {
                    stage(report, progress, "disposal-guard");
                    List<Object> current = ownership(host, module);
                    if (current.size() != owned.size()) throw new IllegalStateException("owned-tree-changed");
                    for (int i = 0; i < current.size(); i++)
                        if (current.get(i) != owned.get(i)) throw new IllegalStateException("owned-tree-changed");
                    stage(report, progress, "disposal");
                    report.addProperty("disposeAttempted", true);
                    progress.accept(report.toString());
                    long start = System.nanoTime();
                    try { host.dispose(module); }
                    finally { report.addProperty("disposalNanos", System.nanoTime() - start); }
                    for (Object object : owned)
                        if (!host.disposed(object)) throw new IllegalStateException("owned-object-not-disposed");
                    report.addProperty("disposalVerified", true);
                } catch (Throwable cleanup) {
                    report.addProperty("cleanupError", cleanup.toString());
                    report.addProperty("cleanupFailedStage", report.get("stage").getAsString());
                    if (failure == null) {
                        failure = cleanup;
                        report.addProperty("failedStage", report.get("stage").getAsString());
                    }
                    else failure.addSuppressed(cleanup);
                }
                owned.clear();
            }
            module = null;
            stage(report, progress, failure == null ? "complete" : "uncertain-stop");
        }
        if (failure != null)
            throw new IllegalStateException("detached-factory:" + report + "; no retry; native rollback is unproved", failure);
        return report;
    }

    private static void stage(JsonObject report, Consumer<String> progress, String value) {
        report.addProperty("stage", value); progress.accept(report.toString());
    }

    static List<Object> ownership(Host host, Object module) throws Exception {
        host.requireRoot(module);
        List<Object> result = new ArrayList<>();
        Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        visit(host, module, null, 0, System.nanoTime() + 1_000_000_000L, result, seen);
        return result;
    }

    private static void visit(Host host, Object object, Object parent, int depth, long deadline,
            List<Object> result, Set<Object> seen) throws Exception {
        if (object == null || depth > 12 || result.size() >= 256 || System.nanoTime() > deadline
                || !seen.add(object) || host.owner(object) != parent || host.disposed(object))
            throw new IllegalStateException("unproved-detached-ownership");
        result.add(object);
        List<?> children = host.children(object);
        if (children.size() > 256 || System.nanoTime() > deadline) throw new IllegalStateException("owned-child-limit");
        for (Object child : children) visit(host, child, object, depth + 1, deadline, result, seen);
    }
}

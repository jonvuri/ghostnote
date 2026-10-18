package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;
import java.util.function.Consumer;

/** One factory result and one owned insertion edit. No native handle leaves this task. */
public final class GridModuleAttachment {
    private GridModuleAttachment() {}
    public interface Host extends GridDetachedFactory.Host {
        void preflight() throws Exception;
        default void admitFactory() throws Exception {}
        void guard() throws Exception;
        JsonObject prepare(Object module) throws Exception;
        boolean begin(Object module) throws Exception;
        void proveEdit() throws Exception;
        void associate() throws Exception;
        void requireOwnedEdit() throws Exception;
        void insert(Object module) throws Exception;
        boolean close() throws Exception;
        void requireIdle() throws Exception;
        JsonObject attached(Object module) throws Exception;
        void requireAbsent(Object module) throws Exception;
    }
    public static JsonObject run(Host host, Consumer<JsonObject> progress) throws Exception {
        JsonObject report = new JsonObject();
        for (String key : List.of("factoryAttempted", "factoryReturned", "ownershipProved", "editStartAttempted",
                "editStartReturned", "editOwned", "insertionAttempted", "insertionReturned", "closeAttempted",
                "closeReturned", "disposeAttempted", "disposalVerified")) report.addProperty(key, false);
        Object module = null; List<Object> owned = null;
        Throwable failure = null; boolean editOwned = false, insertionAttempted = false;
        try {
            stage(report, progress, "preflight"); host.preflight(); host.guard();
            host.admitFactory();
            stage(report, progress, "factory"); report.addProperty("factoryAttempted", true); publish(report, progress);
            long start = System.nanoTime();
            try { module = host.create(); } finally { report.addProperty("factoryNanos", System.nanoTime() - start); }
            report.addProperty("factoryReturned", true);
            stage(report, progress, "ownership"); owned = GridDetachedFactory.ownership(host, module);
            report.addProperty("ownershipProved", true); report.addProperty("ownedObjects", owned.size());
            if (owned.size() != 77) throw new IllegalStateException("attachment-owned-count-changed");
            stage(report, progress, "initialization"); host.requireInitialized(module);
            report.addProperty("initializationHelpersPresent", true);
            stage(report, progress, "captures");
            JsonObject first = host.capture(module), second = host.capture(module);
            report.add("capture0", first); report.add("capture1", second);
            if (!first.getAsJsonArray("nodes").equals(second.getAsJsonArray("nodes")))
                throw new IllegalStateException("attachment-detached-captures-disagree");
            stage(report, progress, "admission"); report.add("admission", host.prepare(module)); host.guard();
            stage(report, progress, "edit-start"); report.addProperty("editStartAttempted", true); publish(report, progress);
            start = System.nanoTime(); boolean admitted;
            try { admitted = host.begin(module); } finally { report.addProperty("startNanos", System.nanoTime() - start); }
            report.addProperty("editStartReturned", true); report.addProperty("editAdmitted", admitted);
            if (!admitted) { host.requireIdle(); throw new IllegalStateException("attachment-edit-refused"); }
            host.proveEdit(); editOwned = true; report.addProperty("editOwned", true);
            stage(report, progress, "association"); host.associate();
            stage(report, progress, "insertion-guard"); host.guard(); host.requireOwnedEdit();
            stage(report, progress, "insertion"); insertionAttempted = true;
            report.addProperty("insertionAttempted", true); publish(report, progress);
            start = System.nanoTime();
            try { host.insert(module); } finally { report.addProperty("insertionNanos", System.nanoTime() - start); }
            report.addProperty("insertionReturned", true);
        } catch (Throwable error) {
            failure = error; report.addProperty("failedStage", report.get("stage").getAsString());
            report.addProperty("error", errorText(error));
        } finally {
            if (editOwned) {
                try {
                    stage(report, progress, "close-guard"); host.requireOwnedEdit();
                    stage(report, progress, "close"); report.addProperty("closeAttempted", true); publish(report, progress);
                    long start = System.nanoTime(); boolean closed;
                    try { closed = host.close(); } finally { report.addProperty("closeNanos", System.nanoTime() - start); }
                    report.addProperty("closeReturned", true); report.addProperty("closeAccepted", closed);
                    if (!closed) throw new IllegalStateException("attachment-close-refused");
                    host.requireIdle(); report.addProperty("editClosed", true);
                } catch (Throwable cleanup) { failure = cleanupFailure(report, failure, cleanup); }
            }
            if (!insertionAttempted && owned != null) {
                try {
                    stage(report, progress, "disposal-guard"); host.requireAbsent(module);
                    List<Object> current = GridDetachedFactory.ownership(host, module);
                    if (current.size() != owned.size()) throw new IllegalStateException("owned-tree-changed");
                    for (int i = 0; i < current.size(); i++) if (current.get(i) != owned.get(i))
                        throw new IllegalStateException("owned-tree-changed");
                    stage(report, progress, "disposal"); report.addProperty("disposeAttempted", true); publish(report, progress);
                    long start = System.nanoTime();
                    try { host.dispose(module); } finally { report.addProperty("disposalNanos", System.nanoTime() - start); }
                    for (Object object : owned) if (!host.disposed(object)) throw new IllegalStateException("owned-object-not-disposed");
                    report.addProperty("disposalVerified", true);
                } catch (Throwable cleanup) { failure = cleanupFailure(report, failure, cleanup); }
            }
            if (failure == null) {
                try { stage(report, progress, "ownership-transfer"); report.add("attached", host.attached(module)); }
                catch (Throwable error) { failure = cleanupFailure(report, null, error); }
            }
            if (owned != null) owned.clear(); module = null;
            report.addProperty("uncertain", failure != null);
            stage(report, progress, failure == null ? "complete" : "uncertain-stop");
        }
        if (failure != null) throw new IllegalStateException("attachment-failed:" + errorText(failure) + "; no retry", failure);
        return report;
    }
    private static Throwable cleanupFailure(JsonObject report, Throwable failure, Throwable cleanup) {
        report.addProperty("cleanupFailedStage", report.get("stage").getAsString());
        report.addProperty("cleanupError", errorText(cleanup));
        if (failure == null) { report.addProperty("failedStage", report.get("stage").getAsString()); return cleanup; }
        failure.addSuppressed(cleanup); return failure;
    }
    public static String errorText(Throwable error) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; error != null && i < 8 && text.length() < 4096; i++, error = error.getCause()) {
            if (i > 0) text.append("; caused by ");
            text.append(error.getClass().getName()).append(": ").append(error.getMessage());
        }
        return text.substring(0, Math.min(text.length(), 4096));
    }
    private static void stage(JsonObject report, Consumer<JsonObject> progress, String stage) {
        report.addProperty("stage", stage); publish(report, progress);
    }
    private static void publish(JsonObject report, Consumer<JsonObject> progress) { progress.accept(report.deepCopy()); }
}

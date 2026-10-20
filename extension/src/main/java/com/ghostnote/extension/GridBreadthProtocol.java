package com.ghostnote.extension;

import com.google.gson.*;
import java.util.Set;

/** Two commands per case. A separate pair of reads must follow each command. */
public final class GridBreadthProtocol {
    public static final Set<String> CASES = Set.of("boolean", "mapping", "factory");
    public interface Host {
        JsonObject read() throws Exception;
        void admit(String action) throws Exception;
        void command(String action) throws Exception;
    }
    @FunctionalInterface public interface Guard { void check() throws Exception; }
    private final String kind;
    private JsonObject initial, pair, current;
    private int reads, commands, inspections;
    private boolean locked, finished;
    private String failure = "";
    public GridBreadthProtocol(String kind) {
        if (!CASES.contains(kind)) throw new IllegalArgumentException("breadth-case");
        this.kind = kind;
    }
    public synchronized void requireRead() {
        requireOpen();
        if (reads >= 2) throw new IllegalStateException("breadth-read-budget");
    }
    private void requireOpen() {
        if (locked || finished) throw new IllegalStateException("breadth-locked-or-released");
    }
    public synchronized String action() {
        requireOpen();
        if (reads != 2 || commands >= 2) throw new IllegalStateException("breadth-command-order");
        return switch (kind) {
            case "boolean" -> commands == 0 ? "boolean-enable" : "boolean-restore";
            case "mapping" -> commands == 0 ? "mapping-remove" : "mapping-restore";
            default -> commands == 0 ? "factory-create" : "factory-dispose";
        };
    }
    private void validate(JsonObject snapshot) {
        GridBreadthRead.bounded(snapshot);
        JsonObject fixture = snapshot.getAsJsonObject("fixture");
        GridBreadthRules.require(snapshot.getAsJsonObject("witness").get("editIdle").getAsBoolean(), "edit-not-idle");
        if (initial == null) {
            if (kind.equals("mapping"))
                GridBreadthRules.require(GridBreadthRules.selectedMapping(fixture) != null, "missing-initial-mapping");
            else {
                GridBreadthRules.gates(GridBreadthRules.module(fixture, 9));
                GridBreadthRules.require(!GridBreadthRules.fields(GridBreadthRules.atom(fixture, 9, 7))
                    .get("210").getAsBoolean(), "initial-phase-not-false");
            }
            GridBreadthRules.require(!snapshot.has("detached") && !snapshot.has("disposed"), "initial-factory-state");
        } else {
            GridBreadthRules.compareFixture(initial.getAsJsonObject("fixture"), fixture, kind, commands);
            GridBreadthRules.require(initial.get("witness").equals(snapshot.get("witness")), "witness-readback-differs");
        }
        if (kind.equals("factory") && commands == 1) {
            JsonObject detached = snapshot.getAsJsonObject("detached");
            GridBreadthRules.require(detached != null && !snapshot.has("disposed"), "detached-read-required");
            GridBreadthRules.gates(detached.getAsJsonObject("module"));
            String uuid = detached.getAsJsonObject("module").get("uuid").getAsString();
            for (JsonElement module : fixture.getAsJsonArray("modules"))
                GridBreadthRules.require(!uuid.equals(module.getAsJsonObject().get("uuid").getAsString()), "factory-uuid-reused");
            GridBreadthRules.require(detached.get("ownedObjects").getAsInt() > 0
                && detached.get("ownedObjects").getAsInt() <= 256
                && detached.getAsJsonObject("mappings").size() == 0, "detached-ownership-or-mappings");
        } else if (kind.equals("factory") && commands == 2) {
            GridBreadthRules.require(!snapshot.has("detached") && snapshot.get("disposed").getAsBoolean(),
                "disposal-read-required");
        } else GridBreadthRules.require(!snapshot.has("detached") && !snapshot.has("disposed"), "foreign-factory-state");
    }
    public JsonObject read(Host host) throws Exception {
        requireRead();
        try {
            JsonObject snapshot = host.read();
            synchronized (this) {
                requireRead(); validate(snapshot);
                if (reads == 0) pair = snapshot.deepCopy();
                else GridBreadthRules.require(pair.equals(snapshot), "paired-reads-differ");
                if (initial == null) initial = snapshot.deepCopy();
                current = snapshot.deepCopy(); reads++;
            }
            return snapshot;
        } catch (Exception error) { fail(error.toString()); throw error; }
    }
    public JsonObject command(String requested, Host host, Guard guard) throws Exception {
        synchronized (this) {
            if (!action().equals(requested)) throw new IllegalArgumentException("breadth-wrong-command");
        }
        try {
            JsonObject fresh = host.read();
            synchronized (this) {
                if (!action().equals(requested) || !current.equals(fresh))
                    throw new IllegalStateException("breadth-fresh-baseline-differs");
                validate(fresh);
            }
            host.admit(requested); guard.check();
            synchronized (this) {
                if (!action().equals(requested)) throw new IllegalStateException("breadth-command-changed");
                commands++; reads = 0; pair = null;
            }
            long start = System.nanoTime();
            host.command(requested);
            JsonObject receipt = new JsonObject(); receipt.addProperty("action", requested);
            receipt.addProperty("nativeCommandNanos", System.nanoTime() - start);
            receipt.addProperty("commandReturned", true);
            receipt.addProperty("readback", "pending-independent-pair");
            return receipt;
        } catch (Exception error) { fail(error.toString()); throw error; }
    }
    public synchronized void fail(String reason) {
        locked = true;
        if (failure.isEmpty()) failure = reason.substring(0, Math.min(1024, reason.length()));
    }
    public synchronized void inspect() {
        if (!locked || finished || inspections >= 2) throw new IllegalStateException("breadth-inspection-budget");
        inspections++;
    }
    public synchronized boolean locked() { return locked; }
    public synchronized boolean attempted() { return commands > 0; }
    public synchronized void release(boolean cancel) {
        if (finished || cancel && commands != 0 || !cancel && (locked || commands != 2 || reads != 2))
            throw new IllegalStateException("breadth-unverified-release");
        finished = true; initial = null; current = null; pair = null;
    }
    public synchronized JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("case", kind); result.addProperty("commands", commands);
        result.addProperty("reads", reads); result.addProperty("locked", locked);
        result.addProperty("finished", finished); result.addProperty("inspections", inspections);
        result.addProperty("failure", failure);
        return result;
    }
}

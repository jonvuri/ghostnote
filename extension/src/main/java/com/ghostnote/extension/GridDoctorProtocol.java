package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** One ordered pass. Only independent equal read pairs can advance a command. */
public final class GridDoctorProtocol {
    public static final List<String> ACTIONS = List.of("value-set", "value-restore", "cable-connect", "cable-disconnect",
        "factory-create", "factory-dispose", "delete-connect", "delete", "undo-delete", "delete-disconnect", "attach", "undo-attach");
    public interface Host {
        JsonObject read() throws Exception;
        void validate(JsonObject read, int completed) throws Exception;
        JsonObject command(String action) throws Exception;
    }
    public interface Guard { void check() throws Exception; }
    private int completed, reads, inspections;
    private JsonObject current;
    private boolean attempted, locked, released;
    private String failure = "";
    public synchronized String action() {
        if (locked || released || reads != 2 || completed >= ACTIONS.size())
            throw new IllegalStateException("doctor-command-order-or-lock");
        return ACTIONS.get(completed);
    }
    public synchronized void fail(String reason) {
        locked = true;
        if (failure.isEmpty()) failure = reason.substring(0, Math.min(reason.length(), 1024));
    }
    public synchronized void requireRead() {
        if (locked || released || reads >= 2) throw new IllegalStateException("doctor-read-order-or-lock");
    }
    public JsonObject read(Host host) throws Exception {
        requireRead();
        try {
            JsonObject next = host.read(); host.validate(next, completed);
            synchronized (this) {
                requireRead();
                if (reads == 1 && !current.equals(next)) throw new IllegalStateException("doctor-pair-differs");
                current = next.deepCopy(); reads++;
            }
            return next;
        } catch (Exception error) { fail(error.toString()); throw error; }
    }
    public JsonObject command(String requested, Host host, Guard guard) throws Exception {
        if (!action().equals(requested)) throw new IllegalArgumentException("doctor-wrong-command");
        try {
            JsonObject fresh = host.read(); host.validate(fresh, completed);
            synchronized (this) {
                if (!action().equals(requested) || !current.equals(fresh)) throw new IllegalStateException("doctor-stale-before");
            }
            guard.check();
            synchronized (this) { action(); attempted = true; reads = 0; }
            JsonObject result = host.command(requested);
            synchronized (this) { if (locked) throw new IllegalStateException("doctor-locked-during-command"); completed++; }
            result.addProperty("action", requested); result.addProperty("readback", "pending-independent-pair");
            return result;
        } catch (Exception error) { fail(error.toString()); throw error; }
    }
    public synchronized void inspect() {
        if (!locked || released || inspections++ >= 2) throw new IllegalStateException("doctor-inspection-budget");
    }
    public synchronized void release(boolean cancel) {
        if (released || cancel && attempted || !cancel && (locked || reads != 2 || completed != ACTIONS.size()))
            throw new IllegalStateException("doctor-unverified-release");
        released = true; current = null;
    }
    public synchronized JsonObject status() {
        JsonObject r = new JsonObject(); r.addProperty("completed", completed); r.addProperty("reads", reads);
        r.addProperty("attempted", attempted); r.addProperty("locked", locked); r.addProperty("released", released);
        r.addProperty("failure", failure); r.addProperty("inspections", inspections); return r;
    }
}

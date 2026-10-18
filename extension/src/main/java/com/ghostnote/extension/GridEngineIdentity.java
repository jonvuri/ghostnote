package com.ghostnote.extension;

import java.lang.ref.WeakReference;
import java.util.List;

/** Weak session identities. Reconnection cannot revive a failed binding. */
public final class GridEngineIdentity {
    private final List<WeakReference<Object>> refs;
    private boolean invalid;
    public GridEngineIdentity(Object connection, Object track, Object master, Object trackMeter, Object masterMeter) {
        refs = List.of(connection, track, master, trackMeter, masterMeter).stream().map(WeakReference::new).toList();
    }
    public synchronized void require(boolean connected, Object connection, Object track, Object master, Object trackMeter, Object masterMeter) {
        Object[] actual = {connection, track, master, trackMeter, masterMeter};
        if (!connected) invalid = true;
        for (int i=0;i<actual.length;i++) if (actual[i] == null || actual[i] != refs.get(i).get()) invalid = true;
        if (invalid) throw new IllegalStateException("engine-generation-or-route-changed");
    }
    public synchronized void requireNoteTarget(Object target) {
        if (target == null || target != refs.get(1).get()) throw new IllegalStateException("owned-note-target-lost");
    }
    public synchronized void release() { invalid = true; refs.forEach(WeakReference::clear); }
}

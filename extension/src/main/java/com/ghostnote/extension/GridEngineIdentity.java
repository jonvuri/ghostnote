package com.ghostnote.extension;

import java.lang.ref.WeakReference;
import java.util.List;

/** Weak session identities. Reconnection cannot revive a failed binding. */
public final class GridEngineIdentity {
    private final List<WeakReference<Object>> refs;
    private boolean invalid;
    public GridEngineIdentity(Object connection, Object track, Object master) {
        refs = List.of(connection, track, master).stream().map(WeakReference::new).toList();
    }
    public synchronized void require(boolean connected, Object connection, Object track, Object master) {
        Object[] actual = {connection, track, master};
        if (!connected) invalid = true;
        for (int i = 0; i < actual.length; i++) if (actual[i] == null || actual[i] != refs.get(i).get()) invalid = true;
        if (invalid) throw new IllegalStateException("engine-generation-or-route-changed");
    }
    public synchronized void release() { invalid = true; refs.forEach(WeakReference::clear); }
}

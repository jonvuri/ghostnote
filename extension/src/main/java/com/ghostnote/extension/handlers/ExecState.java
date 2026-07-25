package com.ghostnote.extension.handlers;

/**
 * Executor policy state — deliberately NOT on the Rig, which holds pre-allocated
 * Bitwig API handles. A revision counter is not a DAW object.
 *
 * E8: `revision` is the optimistic-concurrency counter — "which generation of the
 * world does a write assume?". Every request is dispatched on the single
 * control-surface thread (Bridge marshals all of them via host.scheduleTask), so
 * this counter is touched from ONE thread only and is naturally serialized with
 * the writes it guards. That confinement is what makes check-revision → apply →
 * bump atomic for free: no lock, no atomic.
 *
 * `initNanos` / `initEpochMs` stay volatile because they are written once by the
 * extension thread after init() completes and read by handlers afterwards.
 */
public final class ExecState {
    public long revision = 0;

    // E5: filled in by the extension once init() completes.
    public volatile long initNanos = -1;
    public volatile long initEpochMs = -1;

    public void setInitStats(long initNanos, long initEpochMs) {
        this.initNanos = initNanos;
        this.initEpochMs = initEpochMs;
    }
}

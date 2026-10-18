package com.ghostnote.extension;

import java.lang.ref.WeakReference;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.LongSupplier;

/** Two independent timers. Cleanup can address only the original channel. */
public final class GridEngineNoteLease {
    public interface Host {
        void queue(Runnable task) throws Exception;
        Object target() throws Exception;
        void guardOn() throws Exception;
        void note(Object target, boolean on) throws Exception;
        void failure(Exception error);
    }
    private final WeakReference<Object> target;
    private final Host host;
    private final GridEngineWindow window;
    private final LongSupplier clock;
    private volatile boolean deactivated;
    private final AtomicInteger pending = new AtomicInteger();
    public GridEngineNoteLease(Object target, Host host, GridEngineWindow window, LongSupplier clock) {
        if (target == null) throw new IllegalArgumentException("note-target-absent");
        this.target = new WeakReference<>(target); this.host = host; this.window = window; this.clock = clock;
    }
    public void cancelAfterDeactivation() { deactivated = true; }
    public boolean unfinished() { return pending.get() > 0; }
    public void schedule(GridReadJob.Schedule scheduler) {
        scheduler.run(() -> boundary(false), delay(850));
        scheduler.run(() -> boundary(true), delay(250));
    }
    private int delay(int ms) { return Math.max(0, ms - (int)((clock.getAsLong() - window.start) / 1_000_000)); }
    public void boundary(boolean on) {
        if (deactivated || !window.pulse || !on && !window.needsOff()) return;
        pending.incrementAndGet();
        try {
            host.queue(() -> {
                try {
                    if (deactivated) return;
                    Object original = target.get();
                    if (original == null || original != host.target()) throw new IllegalStateException("owned-note-target-lost");
                    if (on) { host.guardOn(); window.on(clock.getAsLong()); }
                    else window.off(clock.getAsLong());
                    host.note(original, on);
                } catch (Exception error) { window.abort(error.toString()); host.failure(error); }
                finally { pending.decrementAndGet(); }
            });
        } catch (Exception error) { pending.decrementAndGet(); window.abort(error.toString()); host.failure(error); }
    }
}

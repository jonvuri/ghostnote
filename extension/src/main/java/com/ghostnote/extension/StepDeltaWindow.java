package com.ghostnote.extension;

import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.LongSupplier;

/**
 * 8g2b step-delta read window under D26. It is not a host input fence.
 *
 * <p>The window value is the init nonce, the delivered identity epoch, the
 * observer binding revision, and the step-callback count across all shadow
 * observers. A read captures the value before target confirmation. The read
 * stays pending until a task that the read callback schedules sees the same
 * value and no pending hints. E217 measured that such a task runs after the
 * rest of a delivery batch. A start/end check inside one callback never admits
 * a read.
 *
 * <p>Observer callbacks only increment counters. They make no host reads.
 */
public final class StepDeltaWindow {
    public static final String PROTOCOL = "step-delta-read-window-v1";
    public enum State { PENDING, CONFIRMED, CHANGED }
    public record Value(String initNonce, long identityEpoch, long bindingRevision, long steps) {}

    /** One read window. Only the owning window can confirm it. */
    public final class Read {
        private final long id;
        private final Value value;
        private State state = State.PENDING;
        private boolean scheduled;
        private Read(long id, Value value) { this.id = id; this.value = value; }
        public long id() { return id; }
        public Value value() { return value; }
        public State state() { return state; }
    }

    private final String initNonce;
    private final LongSupplier identityEpoch;
    private final Consumer<Runnable> scheduler;
    private long steps, bindingRevision, reads, confirmations, changes;

    public StepDeltaWindow(String initNonce, LongSupplier identityEpoch, Consumer<Runnable> scheduler) {
        this.initNonce = Objects.requireNonNull(initNonce);
        this.identityEpoch = Objects.requireNonNull(identityEpoch);
        this.scheduler = Objects.requireNonNull(scheduler);
    }

    /** Count every shadow observer callback, including rejected and retired ones. */
    public void onStep() { steps = Math.incrementExact(steps); }

    /** Observer scrolling, target commands, pins, and retirement start a new window. */
    public void onRebind() { bindingRevision = Math.incrementExact(bindingRevision); }

    public Value value() { return new Value(initNonce, identityEpoch.getAsLong(), bindingRevision, steps); }

    /** Capture the value before target confirmation. */
    public Read open() { reads++; return new Read(reads, value()); }

    /** A necessary check inside one callback. It is never sufficient to admit a read. */
    public boolean unchanged(Read read) { return read != null && read.value.equals(value()); }

    /**
     * Schedule the later-callback confirmation. Call this from the read callback
     * after the last read. A second call for the same read is ignored.
     */
    public void confirmLater(Read read, BooleanSupplier noPendingHints) {
        Objects.requireNonNull(read); Objects.requireNonNull(noPendingHints);
        if (read.scheduled || read.state != State.PENDING) return;
        read.scheduled = true;
        scheduler.accept(() -> {
            if (read.state != State.PENDING) return;
            boolean same = unchanged(read) && noPendingHints.getAsBoolean();
            read.state = same ? State.CONFIRMED : State.CHANGED;
            if (same) confirmations++; else changes++;
        });
    }

    /** Mark a read changed without host reads. Later confirmation cannot revive it. */
    public void discard(Read read) { if (read != null && read.state == State.PENDING) { read.state = State.CHANGED; changes++; } }

    /** A read admits output only after confirmation and while the value is unchanged. */
    public boolean admitted(Read read) { return read != null && read.state == State.CONFIRMED && unchanged(read); }

    public long steps() { return steps; }
    public long bindingRevision() { return bindingRevision; }
    public long readsOpened() { return reads; }
    public long confirmations() { return confirmations; }
    public long changes() { return changes; }
}

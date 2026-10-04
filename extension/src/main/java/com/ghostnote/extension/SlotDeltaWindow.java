package com.ghostnote.extension;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.LongSupplier;

/**
 * 8g5b slot-delta read window for launcher occupancy. It is not a host input fence.
 *
 * <p>The window value is the init nonce, the delivered identity epoch, the
 * structure-callback count, and the slot-callback count. Slot callbacks come from
 * the indexed {@code hasContent} observers on the flat bank. Structure callbacks
 * come from the topology control and the scene count. A read captures the value
 * before its first slot read. It stays pending until a task that a later read
 * callback schedules sees the same value. Under D27, that task runs after the rest
 * of the delivery batch. Any slot or structure callback in the window refuses.
 *
 * <p>D28 accepts complete occupancy delivery as a named assumption. The window
 * admits occupancy only. Equal occupancy is never a clip identity witness: E222
 * measured silent delete and recreate at one slot.
 */
public final class SlotDeltaWindow {
    public static final String PROTOCOL = "slot-delta-read-window-v1";
    public enum State { PENDING, CONFIRMED, CHANGED }
    public record Value(String initNonce, long identityEpoch, long structure, long slots) {}

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
        public boolean scheduled() { return scheduled; }
    }

    private final String initNonce;
    private final LongSupplier identityEpoch, structure, slots;
    private final Consumer<Runnable> scheduler;
    private long reads, confirmations, changes;

    public SlotDeltaWindow(String initNonce, LongSupplier identityEpoch, LongSupplier structure, LongSupplier slots,
                           Consumer<Runnable> scheduler) {
        this.initNonce = Objects.requireNonNull(initNonce);
        this.identityEpoch = Objects.requireNonNull(identityEpoch);
        this.structure = Objects.requireNonNull(structure);
        this.slots = Objects.requireNonNull(slots);
        this.scheduler = Objects.requireNonNull(scheduler);
    }

    /** The suppliers read controller-side counters only. They make no host reads. */
    public Value value() {
        return new Value(initNonce, identityEpoch.getAsLong(), structure.getAsLong(), slots.getAsLong());
    }

    /** Capture the value before the first slot read. */
    public Read open() { reads++; return new Read(reads, value()); }

    /** A necessary check inside one callback. It is never sufficient to admit a read. */
    public boolean unchanged(Read read) { return read != null && read.value.equals(value()); }

    /** Schedule the later-callback confirmation after the last slot read. A second call is ignored. */
    public void confirmLater(Read read) {
        Objects.requireNonNull(read);
        if (read.scheduled || read.state != State.PENDING) return;
        read.scheduled = true;
        scheduler.accept(() -> {
            if (read.state != State.PENDING) return;
            boolean same = unchanged(read);
            read.state = same ? State.CONFIRMED : State.CHANGED;
            if (same) confirmations++; else changes++;
        });
    }

    /** Mark a read changed without host reads. A later confirmation cannot revive it. */
    public void discard(Read read) { if (read != null && read.state == State.PENDING) { read.state = State.CHANGED; changes++; } }

    /** A read admits occupancy only after confirmation and while the value is unchanged. */
    public boolean admitted(Read read) { return read != null && read.state == State.CONFIRMED && unchanged(read); }

    public long readsOpened() { return reads; }
    public long confirmations() { return confirmations; }
    public long changes() { return changes; }
    /** Source estimate for the window, nonce text, and one current read. It makes no host read. */
    public long estimatedBytes(Read read) { return 256L + 40L + 2L * initNonce.length() + (read == null ? 0 : 128L); }
}

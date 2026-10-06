package com.ghostnote.extension;

import java.util.ArrayDeque;
import java.util.function.Consumer;
import java.util.function.LongSupplier;

/**
 * Order Ghostnote writes behind an open clip read (8h3c).
 *
 * <p>Every bridge request and every internal task runs on the controller thread, so this gate needs no lock.
 * A read request ({@link Kind#READ}) changes no project or host state and runs at once. A write
 * ({@link Kind#WRITE}) that arrives while a clip read is open, or while earlier requests wait, waits in one FIFO
 * queue. A clip read ({@link Kind#CLIP_READ}) opens only when no read is open, no write lease is held, and no
 * earlier request waits. When the read closes, the queue runs in arrival order, one entry in each task. No entry
 * is dropped or reordered. A full queue refuses the new request before it runs.
 *
 * <p>A write that continues in later tasks holds a {@link Lease} until its last task ends. A clip read does not
 * open while a lease is held; this is the 8h3a delivery barrier for scheduled writes.
 */
public final class WriteGate {
    public enum Kind { READ, WRITE, CLIP_READ }

    /** One admitted request. {@code queuedNanos} is the time that it waited in the queue, or zero. */
    public interface Task { void run(long queuedNanos); }

    /** Release once, when the last task of the write ends. A second release has no effect. */
    public interface Lease { void release(); }

    public static final int DEFAULT_LIMIT = 256;

    private record Entry(Kind kind, Task task, long arrived) { }

    private final Consumer<Runnable> schedule;
    private final LongSupplier clock;
    private final int limit;
    private final ArrayDeque<Entry> queue = new ArrayDeque<>();
    private boolean readOpen, pumping;
    private int leases;
    private long queuedTotal, refusedTotal, readsOpened;

    public WriteGate(Consumer<Runnable> schedule, LongSupplier clock, int limit) {
        if (limit < 1) throw new IllegalArgumentException("queue limit must be positive");
        this.schedule = schedule; this.clock = clock; this.limit = limit;
    }

    /** Admit or queue one request. Returns false, with no effect, when the queue is full. */
    public boolean submit(Kind kind, Task task) {
        switch (kind) {
            case READ -> { task.run(0); return true; }
            case WRITE -> {
                if (!readOpen && queue.isEmpty()) { task.run(0); return true; }
            }
            case CLIP_READ -> {
                if (!readOpen && leases == 0 && queue.isEmpty()) { open(task, 0); return true; }
            }
        }
        if (queue.size() >= limit) { refusedTotal++; return false; }
        queue.add(new Entry(kind, task, clock.getAsLong()));
        queuedTotal++;
        return true;
    }

    /** The open clip read has closed: its decoded state is captured. Run the queue. */
    public void readClosed() {
        if (!readOpen) throw new IllegalStateException("no clip read is open");
        readOpen = false;
        pump();
    }

    public Lease lease() {
        leases++;
        boolean[] released = {false};
        return () -> {
            if (released[0]) return;
            released[0] = true;
            leases--;
            if (leases == 0) pump();
        };
    }

    public boolean readOpen() { return readOpen; }
    public int waiting() { return queue.size(); }
    public int leases() { return leases; }
    public int limit() { return limit; }
    public long queuedTotal() { return queuedTotal; }
    public long refusedTotal() { return refusedTotal; }
    public long readsOpened() { return readsOpened; }

    private void open(Task task, long queuedNanos) {
        readOpen = true;
        readsOpened++;
        task.run(queuedNanos);
    }

    private boolean ready(Entry head) {
        if (readOpen) return false;
        return head.kind != Kind.CLIP_READ || leases == 0;
    }

    /** Run the head of the queue in its own task, then the next one. */
    private void pump() {
        if (pumping || queue.isEmpty() || !ready(queue.peek())) return;
        pumping = true;
        schedule.accept(() -> {
            pumping = false;
            Entry head = queue.peek();
            if (head == null || !ready(head)) return;
            queue.poll();
            long waited = Math.max(1, clock.getAsLong() - head.arrived);
            try {
                if (head.kind == Kind.CLIP_READ) open(head.task, waited);
                else head.task.run(waited);
            } finally {
                pump();
            }
        });
    }
}

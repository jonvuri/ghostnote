package com.ghostnote.extension;

import com.google.gson.JsonArray;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.function.BiConsumer;

/**
 * Holds an existing window over an absolute range for one asynchronous operation, then restores zero.
 * The caller holds a write lease across acquisition, work (including nested windows), and restoration.
 * This class resolves navigation only: the caller validates track and target identities before writing
 * and performs the independent result readback after the operation replies.
 *
 * <p>The window's snapshot must witness its reported position. Two equal snapshots in separate scheduled
 * tasks establish arrival; a changed population before work starts refuses. Work is invoked once and is
 * never retried, even if it throws or restoration fails. After work, population changes are permitted:
 * insertion and deletion are legitimate effects. Identity witnesses supplied by a window must likewise
 * account for its intended structural edits before completing the work callback.
 */
public final class WindowAccess {
    public interface Work<T> {
        /** offset is the actual, possibly clamped window position; indices remain absolute on the wire. */
        void run(int offset, JsonArray page, BiConsumer<T, Exception> done) throws Exception;
    }

    /** workStarted distinguishes an acquisition refusal from a potentially applied write. */
    public record Result<T>(T value, boolean workStarted, int polls, int scrolls) { }

    private final BiConsumer<Runnable, Integer> schedule;
    private final Map<WindowPager.Window, Boolean> held = new IdentityHashMap<>();

    public WindowAccess(BiConsumer<Runnable, Integer> schedule) { this.schedule = schedule; }

    /**
     * Acquire the earliest window containing first through last. Targets already in the first page
     * therefore need no scroll. Both indices must name existing items. Distant endpoints need independent
     * windows, not two aliases of one bank.
     * Nested use of the same Window instance is rejected before navigation; callers must also avoid
     * wrapping the same host bank twice. Validation errors throw before any scroll or work callback.
     */
    public <T> void withWindow(WindowPager.Window window, int first, int last, Work<T> work,
            BiConsumer<Result<T>, Exception> done) {
        if (first < 0 || last < first) throw new IllegalArgumentException("invalid absolute window range");
        if (window.width() <= 0 || (long) last - first + 1 > window.width())
            throw new IllegalArgumentException("target range needs independent windows");
        if (held.containsKey(window)) throw new IllegalStateException("window is already held");
        held.put(window, true);
        new Access<>(window, first, last, work, done).poll();
    }

    private final class Access<T> {
        final WindowPager.Window window;
        final int first, last;
        final Work<T> work;
        final BiConsumer<Result<T>, Exception> done;
        int total = -1, previousCount = -1, attempts, polls, scrolls;
        boolean restoring, finished, leftZero, workStarted, workCompleted;
        JsonArray previous;
        T value;
        Exception failure;

        Access(WindowPager.Window window, int first, int last, Work<T> work,
                BiConsumer<Result<T>, Exception> done) {
            this.window = window; this.first = first; this.last = last;
            this.work = work; this.done = done;
        }

        void poll() {
            if (finished) return;
            try {
                polls++;
                attempts++;
                int count = window.count();
                if (count < 0) throw new IllegalStateException("window population is unavailable");
                // Record a displaced initial window even when population validation refuses below.
                if (window.position() != 0) leftZero = true;
                if (!restoring) {
                    if (total < 0) total = count;
                    if (count != total) throw new IllegalStateException("window population changed before work");
                    if (last >= count) throw new IllegalArgumentException("target is outside the window population");
                }
                int target = restoring ? 0 : Math.max(0, last - window.width() + 1);
                JsonArray page = window.position() == target ? window.snapshot() : null;
                int size = Math.min(window.width(), Math.max(0, count - target));
                boolean ready = page != null && page.size() == size;
                if (ready && count == previousCount && page.equals(previous)) {
                    if (restoring) { finish(failure); return; }
                    workStarted = true;
                    work.run(target, page.deepCopy(), this::completeWork);
                    return;
                }
                previous = ready ? page.deepCopy() : null;
                previousCount = count;
                if (attempts >= ContainerScopes.MAX_POLLS)
                    throw new IllegalStateException("window did not settle at " + target + ": " + window.describe());
                if (!ready && ((!restoring && attempts == 1) || attempts % ContainerScopes.RESCROLL_POLLS == 0)) {
                    if (target != 0) leftZero = true;
                    window.scroll(target);
                    scrolls++;
                }
                schedule.accept(this::poll, ContainerScopes.POLL_MS);
            } catch (Exception error) {
                if (finished) throw error instanceof RuntimeException runtime ? runtime : new RuntimeException(error);
                if (restoring) finish(new WindowPager.RestoreFailure(error));
                else if (workStarted) completeWork(null, error);
                else restore(error);
            }
        }

        void completeWork(T result, Exception error) {
            if (workCompleted || finished) return;
            workCompleted = true;
            value = result;
            restore(error);
        }

        void restore(Exception error) {
            failure = error;
            restoring = true;
            attempts = 0;
            previous = null;
            previousCount = -1;
            // A nested failed restore does not excuse leaving the outer window displaced.
            // Keep its error, restore this window too, and let the caller latch refusal before release.
            try {
                if (!leftZero && window.position() == 0) { finish(error); return; }
                // Supersede a pending nonzero request even if the reported position is still zero.
                // Merely observing zero twice could otherwise release the lease before that request lands.
                window.scroll(0);
                scrolls++;
            } catch (Exception restoreError) {
                if (finished) throw restoreError;
                finish(new WindowPager.RestoreFailure(restoreError));
                return;
            }
            poll();
        }

        void finish(Exception error) {
            if (finished) return;
            finished = true;
            held.remove(window);
            if (error != null && failure != null && error != failure) error.addSuppressed(failure);
            done.accept(new Result<>(value, workStarted, polls, scrolls), error);
        }
    }
}

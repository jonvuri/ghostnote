package com.ghostnote.extension;

import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/** Queue one document task and deliver one outcome on the controller thread. */
public final class GridReadJob {
    @FunctionalInterface public interface Queue { void run(Runnable task) throws Exception; }
    @FunctionalInterface public interface Schedule { void run(Runnable task, int delayMs); }

    public static final class State {
        private boolean entered, finished, cancelled;
        synchronized boolean enter() { if (cancelled) return false; entered = true; return true; }
        synchronized void finish() { finished = true; }
        synchronized void cancel() { cancelled = true; }
        public synchronized boolean cancelled() { return cancelled; }
        public synchronized boolean unfinished() { return !finished && (entered || !cancelled); }
    }

    public static <T> void start(Queue queue, Schedule controller, Callable<T> work,
            Consumer<T> success, Consumer<Exception> failure, Runnable timeout) {
        start(queue, controller, work, success, failure, timeout, new State());
    }

    public static <T> void start(Queue queue, Schedule controller, Callable<T> work,
            Consumer<T> success, Consumer<Exception> failure, Runnable timeout, State state) {
        AtomicBoolean done = new AtomicBoolean();
        controller.run(() -> { if (done.compareAndSet(false, true)) { state.cancel(); timeout.run(); } }, 5000);
        try {
            queue.run(() -> {
                if (!state.enter()) { state.finish(); return; }
                try {
                    T result = work.call();
                    state.finish();
                    controller.run(() -> { if (done.compareAndSet(false, true)) success.accept(result); }, 0);
                } catch (Throwable error) {
                    Exception report = new IllegalStateException("grid-operation-failed:" + GridModuleAttachment.errorText(error), error);
                    state.finish();
                    controller.run(() -> { if (done.compareAndSet(false, true)) failure.accept(report); }, 0);
                } finally { state.finish(); }
            });
        } catch (Exception error) {
            state.finish();
            if (done.compareAndSet(false, true)) failure.accept(error);
        }
    }
}

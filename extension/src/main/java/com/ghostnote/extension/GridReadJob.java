package com.ghostnote.extension;

import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/** Queue one document task and deliver one outcome on the controller thread. */
public final class GridReadJob {
    @FunctionalInterface public interface Queue { void run(Runnable task) throws Exception; }
    @FunctionalInterface public interface Schedule { void run(Runnable task, int delayMs); }

    public static <T> void start(Queue queue, Schedule controller, Callable<T> work,
            Consumer<T> success, Consumer<Exception> failure, Runnable timeout) {
        AtomicBoolean done = new AtomicBoolean();
        controller.run(() -> { if (done.compareAndSet(false, true)) timeout.run(); }, 5000);
        try {
            queue.run(() -> {
                if (done.get()) return;
                try {
                    T result = work.call();
                    controller.run(() -> { if (done.compareAndSet(false, true)) success.accept(result); }, 0);
                } catch (Throwable error) {
                    Throwable cause = error;
                    while (cause.getCause() != null) cause = cause.getCause();
                    Exception report = new IllegalStateException("grid-operation-failed:" + cause, error);
                    controller.run(() -> { if (done.compareAndSet(false, true)) failure.accept(report); }, 0);
                }
            });
        } catch (Exception error) {
            if (done.compareAndSet(false, true)) failure.accept(error);
        }
    }
}

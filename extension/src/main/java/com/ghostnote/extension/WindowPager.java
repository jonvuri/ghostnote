package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

/** Reads an existing host window in pages, then restores zero before returning to its caller.
 * The caller owns a write lease for the entire traversal, including nested traversals and restoration.
 * Counts and absolute item positions must agree, and a page must repeat in a later host task.
 */
public final class WindowPager {
    public static final String RULE = "paged-windows-v3";
    public interface Window {
        int width();
        int count();
        int position();
        void scroll(int position);
        default String describe() { return "width=" + width() + ", count=" + count() + ", position=" + position(); }
        /** Null while any visible item has not arrived at its absolute position. */
        JsonArray snapshot();
    }
    public interface Visitor {
        void visit(int offset, JsonArray page, Consumer<Exception> done);
    }
    public record Result(int count, int pages, int polls, int scrolls) { }
    private final BiConsumer<Runnable, Integer> schedule;
    public WindowPager(BiConsumer<Runnable, Integer> schedule) { this.schedule = schedule; }

    /** The caller latches write refusal before releasing its lease: fixed-index writers cannot safely resume. */
    public static final class RestoreFailure extends IllegalStateException {
        public RestoreFailure(Exception cause) {
            super("window did not restore; reload ghostnote before writes: " + cause.getMessage(), cause);
        }
    }

    public void read(Window window, Visitor visitor, BiConsumer<Result, Exception> done) {
        new Read(window, visitor, done).poll();
    }

    private final class Read {
        final Window window;
        final Visitor visitor;
        final BiConsumer<Result, Exception> done;
        int total = -1, previousCount = -1, offset, attempts, polls, scrolls, pages;
        boolean restoring, finished, leftZero;
        JsonArray previous;
        Exception failure;
        Read(Window window, Visitor visitor, BiConsumer<Result, Exception> done) {
            this.window = window; this.visitor = visitor; this.done = done;
        }
        void poll() {
            if (finished) return;
            try {
                polls++;
                attempts++;
                int count = window.count();
                if (!restoring && total >= 0 && count != total) {
                    restore(new IllegalStateException("window population changed during paging"));
                    return;
                }
                int target = restoring ? 0 : Math.min(offset, Math.max(0, count - window.width()));
                if (window.position() != 0) leftZero = true;
                JsonArray page = window.position() == target ? window.snapshot() : null;
                int expected = Math.min(window.width(), Math.max(0, count - target));
                boolean ready = page != null && page.size() == expected;
                if (ready && count == previousCount && page.equals(previous)) {
                    if (restoring) { finish(failure); return; }
                    if (total < 0) total = count;
                    pages++;
                    JsonArray captured = new JsonArray();
                    for (int i = offset - target; i < page.size(); i++) captured.add(page.get(i).deepCopy());
                    visitor.visit(target, captured, error -> {
                        if (error != null) { restore(error); return; }
                        offset += captured.size();
                        if (offset >= total) { restore(null); return; }
                        reset();
                        poll();
                    });
                    return;
                }
                previous = ready ? page.deepCopy() : null;
                previousCount = count;
                if (attempts >= ContainerScopes.MAX_POLLS) {
                    Exception error = new IllegalStateException("window did not settle at " + target + ": " + window.describe());
                    if (restoring) finish(new RestoreFailure(error));
                    else restore(error);
                    return;
                }
                if (!ready && (attempts == 1 || attempts % ContainerScopes.RESCROLL_POLLS == 0)) {
                    if (target != 0) leftZero = true;
                    window.scroll(target); scrolls++;
                }
                schedule.accept(this::poll, ContainerScopes.POLL_MS);
            } catch (Exception error) {
                if (restoring) finish(new RestoreFailure(error));
                else restore(error);
            }
        }
        void reset() { attempts = 0; previous = null; previousCount = -1; }
        void restore(Exception error) {
            if (error instanceof RestoreFailure) { finish(error); return; }
            if (!leftZero && window.position() == 0) { finish(error); return; }
            failure = error;
            restoring = true;
            reset();
            poll();
        }
        void finish(Exception error) {
            if (finished) return;
            finished = true;
            done.accept(new Result(total, pages, polls, scrolls), error);
        }
    }

    /** Common device row; its position is the independent witness for the window slot. */
    public static JsonObject device(int index, String name, boolean enabled) {
        JsonObject row = new JsonObject();
        row.addProperty("index", index); row.addProperty("name", name); row.addProperty("enabled", enabled);
        return row;
    }
}

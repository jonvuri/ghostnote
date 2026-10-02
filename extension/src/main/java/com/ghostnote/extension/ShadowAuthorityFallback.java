package com.ghostnote.extension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.LongSupplier;
import static com.ghostnote.extension.ShadowProjectCache.*;

/** Acquire independent authority without admitting a cache residence. */
public final class ShadowAuthorityFallback {
    public interface Source {
        void point(Address address);
        void advance();
        boolean bound(Address address);
        long callbacks();
        Object guard();
        long windowVersion();
        Map<String, Object> metadata();
        List<Note> read(Coordinate coordinate);
    }
    public record Result(String phase, String reason, Address address, Coverage coverage,
                         boolean terminal, boolean authorityAvailable, boolean fallbackPerformed,
                         boolean complete, boolean eligible, long scannedCoordinates, long totalCoordinates,
                         long payloadEstimatedBytes, double elapsedMs, double lastBatchMs,
                         List<Note> authorityNotes, Map<String, Object> authorityMetadata) {}
    private final Source source;
    private final LongSupplier time;
    private Address address;
    private Coverage coverage;
    private Object guard;
    private String phase = "idle", reason = "not-started";
    private long started, boundAt, pollAt, callbacks, quietCallbacks, bytes, next, total, ended, guardVersion;
    private int quietPolls;
    private double lastBatchMs;
    private List<Note> notes = new ArrayList<>();
    private Map<String, Object> metadata;

    public ShadowAuthorityFallback(Source source) { this(source, System::nanoTime); }
    ShadowAuthorityFallback(Source source, LongSupplier time) {
        this.source = Objects.requireNonNull(source); this.time = Objects.requireNonNull(time);
    }
    /** Start an explicit request. Its scope never comes from a retained cache candidate. */
    public Result start(Address target, Coverage request) {
        Objects.requireNonNull(target); Objects.requireNonNull(request);
        if (active()) return result("authority-busy");
        if (request.width() > MAX_WIDTH || !request.allChannels()) throw new IllegalArgumentException("fallback coverage unavailable");
        address = target; coverage = request; guard = null;
        started = time.getAsLong(); ended = boundAt = pollAt = next = bytes = 0;
        total = (long) request.width() * 128; quietPolls = 0; lastBatchMs = 0;
        metadata = null; notes = new ArrayList<>(); phase = "binding"; reason = "authority-binding";
        try {
            guard = source.guard();
            if (guard == null) return refuse("authority-window-unavailable");
            guardVersion = source.windowVersion();
            source.point(target);
            if (!current()) return refuse("authority-window-changed");
        } catch (RuntimeException error) { return refuse("authority-unavailable"); }
        return status();
    }
    /** Read a bounded batch. Only the terminal result exposes acquired notes. */
    public Result poll() {
        if (!active()) return status();
        long batch = time.getAsLong();
        try {
            if (!current()) return refuse("authority-window-changed");
            if (elapsed(started) > 40_000) return refuse("authority-scan-budget");
            source.advance();
            if (!current()) return refuse("authority-window-changed");
            if (!source.bound(address)) {
                if (!"binding".equals(phase)) return refuse("authority-binding-changed");
                if (elapsed(started) > 5_000) return refuse("authority-binding-budget");
                return status();
            }
            if ("binding".equals(phase)) {
                phase = "settling"; reason = "authority-settlement";
                boundAt = time.getAsLong(); quietCallbacks = source.callbacks();
            }
            if ("settling".equals(phase)) {
                if (pollAt == 0 || elapsed(pollAt) >= 50) {
                    long current = source.callbacks();
                    quietPolls = current == quietCallbacks ? quietPolls + 1 : 0;
                    quietCallbacks = current; pollAt = time.getAsLong();
                }
                if (elapsed(boundAt) > 5_000) return refuse("authority-settlement-budget");
                if (elapsed(boundAt) < 1_500 || quietPolls < 10) return status();
                callbacks = source.callbacks(); metadata = Map.copyOf(source.metadata());
                if (!current() || source.callbacks() != callbacks) return refuse("authority-window-changed");
                phase = "scanning"; reason = "authority-scan";
            }
            while (next < total && elapsed(batch) < 40) {
                if (!scanCurrent()) return refuse("authority-window-changed");
                Coordinate coordinate = new Coordinate(coverage.startCell() + next / 128, (int) (next % 128));
                List<Note> values = source.read(coordinate);
                if (!scanCurrent()) return refuse("authority-window-changed");
                for (Note note : values) {
                    if (!coordinate.equals(note.coordinate())) return refuse("authority-address-mismatch");
                    long estimate = 160L + note.fields().size() * 64L;
                    if (estimate > MAX_SNAPSHOT_BYTES - bytes) return refuse("authority-staging-memory-budget");
                    notes.add(note); bytes += estimate;
                }
                next++;
                lastBatchMs = elapsed(batch);
                if (lastBatchMs > 45) return refuse("authority-host-work-budget");
            }
            lastBatchMs = elapsed(batch);
            if (lastBatchMs > 45) return refuse("authority-host-work-budget");
            if (!current() || !scanCurrent()) return refuse("authority-window-changed");
            if (next == total) {
                if (!metadata.equals(source.metadata()) || !scanCurrent() || !current()) return refuse("authority-window-changed");
                lastBatchMs = elapsed(batch);
                if (lastBatchMs > 45) return refuse("authority-host-work-budget");
                notes = List.copyOf(notes); phase = "acquired"; reason = "independent-authority"; ended = time.getAsLong();
            }
        } catch (RuntimeException error) { return refuse("authority-unavailable"); }
        return "acquired".equals(phase) ? result(reason) : status();
    }
    public boolean active() { return List.of("binding", "settling", "scanning").contains(phase); }
    public Result cancel(String cause) {
        if (cause == null || cause.isEmpty()) throw new IllegalArgumentException("invalid authority cancellation");
        return active() || "acquired".equals(phase) ? refuse(cause) : status();
    }
    public Result status() {
        if ("acquired".equals(phase)) {
            long checkedAt = time.getAsLong();
            try {
                if (!current() || !scanCurrent() || !metadata.equals(source.metadata()) || !current()) return refuse("authority-window-changed");
                if (elapsed(checkedAt) > 45) return refuse("authority-host-work-budget");
            } catch (RuntimeException error) { return refuse("authority-unavailable"); }
        }
        return result(reason);
    }
    private Result result(String cause) {
        boolean available = "acquired".equals(phase), terminal = available || "refused".equals(phase);
        return new Result(phase, cause, address, coverage, terminal, available, available, false, false,
            next, total, bytes, "idle".equals(phase) ? 0 : elapsedTo(started, terminal ? ended : time.getAsLong()), lastBatchMs,
            available ? notes : null, available ? metadata : null);
    }
    private Result refuse(String cause) {
        phase = "refused"; reason = cause; notes = new ArrayList<>(); metadata = null; bytes = 0; ended = time.getAsLong();
        return status();
    }
    private boolean current() { return guard != null && guardVersion == source.windowVersion() && guard.equals(source.guard()); }
    private boolean scanCurrent() { return guardVersion == source.windowVersion() && source.bound(address) && callbacks == source.callbacks(); }
    private double elapsed(long from) { return elapsedTo(from, time.getAsLong()); }
    private static double elapsedTo(long from, long to) {
        long nanos = to - from;
        if (nanos < 0) throw new IllegalStateException("authority clock moved backwards");
        return nanos / 1_000_000.0;
    }
}

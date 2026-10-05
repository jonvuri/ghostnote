package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 8h1b research: the host cost of sounding cells. A full-width release proxy measures which cursor action
 * releases a bound grid. A coarse sentinel proxy records which edits its grid delivers. Both record note-step
 * callbacks into bounded primitive traces. Every result is research only: complete:false, eligible:false.
 */
public final class ShadowSoundingProbe {
    public static final String REVISION = "8h1b-sounding-v2";
    /** The sentinel grid covers the full allocation at 1/16 beat. A coarser step covers more than the clip. */
    public static final int SENTINEL_RATIO = 32;
    static final int TRACE_CAPACITY = 1 << 16;

    /** One cursor that can hold a resident clip. Research actions move or release it. */
    public record Cursor(String role, CursorTrack track, PinnableCursorClip clip, int width, boolean windowed) {}

    /** Bounded note-step trace. Primitive arrays keep a one-million-callback replay cheap. */
    static final class Recorder {
        final long[] seq = new long[TRACE_CAPACITY], nanos = new long[TRACE_CAPACITY];
        final int[] x = new int[TRACE_CAPACITY], y = new int[TRACE_CAPACITY];
        final byte[] channel = new byte[TRACE_CAPACITY], state = new byte[TRACE_CAPACITY];
        final double[] velocity = new double[TRACE_CAPACITY], duration = new double[TRACE_CAPACITY],
            gain = new double[TRACE_CAPACITY], chance = new double[TRACE_CAPACITY];
        final boolean[] chanceEnabled = new boolean[TRACE_CAPACITY], muted = new boolean[TRACE_CAPACITY];
        long callbacks, empty, sustain, onset, lastNanos, firstNanos, overwritten;
        boolean tracing;

        void record(int stepX, int stepY, int stepChannel, int stepState, double stepVelocity, double stepDuration,
                    double stepGain, double stepChance, boolean stepChanceEnabled, boolean stepMuted, long now) {
            long n = ++callbacks;
            if (stepState == 0) empty++; else if (stepState == 1) sustain++; else onset++;
            if (firstNanos == 0) firstNanos = now;
            lastNanos = now;
            if (!tracing) return;
            int at = (int) ((n - 1) % TRACE_CAPACITY);
            if (n > TRACE_CAPACITY) overwritten++;
            seq[at] = n; nanos[at] = now; x[at] = stepX; y[at] = stepY; channel[at] = (byte) stepChannel;
            state[at] = (byte) stepState; velocity[at] = stepVelocity; duration[at] = stepDuration; gain[at] = stepGain;
            chance[at] = stepChance; chanceEnabled[at] = stepChanceEnabled; muted[at] = stepMuted;
        }

        /** Entries after {@code since}. Refuse a range that the ring has overwritten. */
        JsonObject since(long since, int limit) {
            JsonObject result = new JsonObject();
            long first = Math.max(since + 1, callbacks - TRACE_CAPACITY + 1);
            result.addProperty("complete", first == since + 1 && callbacks - since <= limit);
            result.addProperty("overwrittenBeforeRead", first > since + 1);
            JsonArray rows = new JsonArray();
            for (long n = first; n <= callbacks && rows.size() < limit; n++) {
                int at = (int) ((n - 1) % TRACE_CAPACITY);
                if (seq[at] != n) continue;
                JsonArray row = new JsonArray();
                row.add(n); row.add(x[at]); row.add(y[at]); row.add(channel[at]); row.add(state[at]);
                row.add(velocity[at]); row.add(duration[at]); row.add(gain[at]); row.add(chance[at]);
                row.add(chanceEnabled[at]); row.add(muted[at]);
                rows.add(row);
            }
            result.add("rows", rows);
            result.addProperty("columns", "seq,x,y,channel,state,velocity,duration,gain,chance,chanceEnabled,muted");
            return result;
        }

        void reset() { callbacks = empty = sustain = onset = lastNanos = firstNanos = overwritten = 0; }
    }

    private final Cursor release, sentinel;
    private final Recorder releaseTrace = new Recorder(), sentinelTrace = new Recorder();
    private final Map<String, Cursor> others = new LinkedHashMap<>();
    private final Map<String, Boolean> subscribed = new LinkedHashMap<>();
    private final SoundingCellBudget budget = new SoundingCellBudget();
    private final int width;

    public ShadowSoundingProbe(ControllerHost host, int width, int scenes) {
        if (width < SENTINEL_RATIO || width > ShadowProjectCache.RESEARCH_MAX_WIDTH || width % SENTINEL_RATIO != 0)
            throw new IllegalArgumentException("invalid sounding research width");
        this.width = width;
        release = cursor(host, "release", width, scenes, ShadowProjectCache.GRID);
        sentinel = cursor(host, "sentinel", width / SENTINEL_RATIO, scenes, SENTINEL_RATIO * ShadowProjectCache.GRID);
        observe(release.clip(), releaseTrace);
        observe(sentinel.clip(), sentinelTrace);
        subscribed.put("release", true); subscribed.put("sentinel", true);
    }

    private static Cursor cursor(ControllerHost host, String role, int steps, int scenes, double stepSize) {
        CursorTrack track = host.createCursorTrack("GN_SOUNDING_" + role.toUpperCase(), "ghostnote 8h1b " + role, 0, scenes, false);
        PinnableCursorClip clip = track.createLauncherCursorClip(steps, 128);
        clip.setStepSize(stepSize);
        markCursor(track, clip);
        return new Cursor(role, track, clip, steps, false);
    }

    /** Mark the values that a research status reads. Call only during init. */
    public static void markCursor(CursorTrack track, PinnableCursorClip clip) {
        track.exists().markInterested(); track.channelId().markInterested(); track.position().markInterested();
        track.isPinned().markInterested();
        clip.exists().markInterested(); clip.isPinned().markInterested(); clip.clipLauncherSlot().sceneIndex().markInterested();
        clip.getLoopLength().markInterested(); clip.getPlayStop().markInterested();
    }

    private static void observe(PinnableCursorClip clip, Recorder recorder) {
        clip.addNoteStepObserver(step -> {
            NoteStep.State value = step.state();
            int code = value == NoteStep.State.Empty ? 0 : value == NoteStep.State.NoteSustain ? 1 : 2;
            recorder.record(step.x(), step.y(), step.channel(), code, step.velocity(), step.duration(), step.gain(),
                step.chance(), step.isChanceEnabled(), step.isMuted(), System.nanoTime());
        });
    }

    /** Add a rig or cache cursor for the resident-cursor census (experiment 2). Call only during init. */
    public void attach(Cursor cursor) {
        if (others.containsKey(cursor.role()) || "release".equals(cursor.role()) || "sentinel".equals(cursor.role()))
            throw new IllegalArgumentException("duplicate research cursor");
        markCursor(cursor.track(), cursor.clip());
        others.put(cursor.role(), cursor);
        subscribed.put(cursor.role(), true);
    }

    private Cursor cursor(String role) {
        if ("release".equals(role)) return release;
        if ("sentinel".equals(role)) return sentinel;
        Cursor cursor = others.get(role);
        if (cursor == null) throw new IllegalArgumentException("unknown research cursor " + role);
        return cursor;
    }
    private Recorder recorder(String role) {
        if ("release".equals(role)) return releaseTrace;
        if ("sentinel".equals(role)) return sentinelTrace;
        throw new IllegalArgumentException("only release and sentinel record callbacks");
    }

    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("revision", REVISION);
        result.addProperty("complete", false); result.addProperty("eligible", false);
        result.addProperty("width", width);
        result.addProperty("sentinelRatio", SENTINEL_RATIO);
        JsonObject cursors = new JsonObject();
        cursors.add("release", cursorStatus(release));
        cursors.add("sentinel", cursorStatus(sentinel));
        for (Cursor cursor : others.values()) cursors.add(cursor.role(), cursorStatus(cursor));
        result.add("cursors", cursors);
        result.add("budget", budget.status());
        return result;
    }

    private JsonObject cursorStatus(Cursor cursor) {
        JsonObject result = new JsonObject();
        result.addProperty("width", cursor.width());
        result.addProperty("windowed", cursor.windowed());
        result.addProperty("subscribed", subscribed.get(cursor.role()));
        result.addProperty("trackExists", cursor.track().exists().get());
        result.addProperty("trackChannelId", cursor.track().channelId().get());
        result.addProperty("trackPosition", cursor.track().position().get());
        result.addProperty("trackPinned", cursor.track().isPinned().get());
        result.addProperty("clipExists", cursor.clip().exists().get());
        result.addProperty("clipPinned", cursor.clip().isPinned().get());
        result.addProperty("sceneIndex", cursor.clip().clipLauncherSlot().sceneIndex().get());
        result.addProperty("loopLength", cursor.clip().getLoopLength().get());
        result.addProperty("playStop", cursor.clip().getPlayStop().get());
        Recorder recorder = cursor == release ? releaseTrace : cursor == sentinel ? sentinelTrace : null;
        if (recorder != null) {
            result.addProperty("callbacks", recorder.callbacks);
            result.addProperty("emptyCallbacks", recorder.empty);
            result.addProperty("sustainCallbacks", recorder.sustain);
            result.addProperty("onsetCallbacks", recorder.onset);
            result.addProperty("tracing", recorder.tracing);
            result.addProperty("traceOverwritten", recorder.overwritten);
            result.addProperty("msSinceLastCallback", recorder.lastNanos == 0 ? -1 : (System.nanoTime() - recorder.lastNanos) / 1e6);
            result.addProperty("firstToLastCallbackMs", recorder.lastNanos == 0 ? 0 : (recorder.lastNanos - recorder.firstNanos) / 1e6);
        }
        return result;
    }

    /**
     * Apply one research action to a cursor. Actions: point (select a track), select (select a slot on the
     * cursor's track), pin, pinTrack, unpin, unpinClip, subscribe, unsubscribe, stepSize, scroll.
     */
    public JsonObject act(String role, String action, JsonObject params, java.util.function.IntFunction<Track> tracks) {
        Cursor cursor = cursor(role);
        switch (action) {
            case "point" -> {
                cursor.clip().isPinned().set(false); cursor.track().isPinned().set(false);
                cursor.track().selectChannel(tracks.apply(params.get("trackIndex").getAsInt()));
            }
            case "select" -> tracks.apply(params.get("trackIndex").getAsInt()).selectSlot(params.get("row").getAsInt());
            case "pin" -> { cursor.track().isPinned().set(true); cursor.clip().isPinned().set(true); }
            case "pinTrack" -> cursor.track().isPinned().set(true);
            case "unpin" -> { cursor.clip().isPinned().set(false); cursor.track().isPinned().set(false); }
            case "unpinClip" -> cursor.clip().isPinned().set(false);
            case "subscribe", "unsubscribe" -> {
                // Configuration owns the subscription of the cache views. Test it only on research proxies.
                if (cursor != release && cursor != sentinel) throw new IllegalArgumentException("subscription is research-proxy only");
                boolean on = "subscribe".equals(action);
                // API 25 subscription is counted. Change it only on a transition.
                if (on != subscribed.get(role)) {
                    if (on) cursor.clip().subscribe(); else cursor.clip().unsubscribe();
                    subscribed.put(role, on);
                }
            }
            case "stepSize" -> cursor.clip().setStepSize(params.get("beats").getAsDouble());
            case "scroll" -> cursor.clip().scrollToStep(params.get("step").getAsInt());
            default -> throw new IllegalArgumentException("unknown research action " + action);
        }
        JsonObject result = cursorStatus(cursor);
        result.addProperty("role", role);
        result.addProperty("action", action);
        return result;
    }

    public JsonObject trace(String role, boolean enabled) {
        Recorder recorder = recorder(role); recorder.tracing = enabled;
        return cursorStatus(cursor(role));
    }
    public JsonObject resetCounters(String role) { recorder(role).reset(); return cursorStatus(cursor(role)); }
    public JsonObject traceSince(String role, long since, int limit) {
        JsonObject result = recorder(role).since(since, Math.max(1, Math.min(limit, TRACE_CAPACITY)));
        result.addProperty("callbacks", recorder(role).callbacks);
        return result;
    }

    public SoundingCellBudget budget() { return budget; }
}

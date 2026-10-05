package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.function.Consumer;
import java.util.function.IntFunction;

/**
 * 8h2a research: a full-width 1/512 reader proxy. Each research action can arm a new binding epoch in the same
 * call, so the epoch measures from the action. The epoch decodes notes from callbacks only; it never calls
 * getStep. Value observers on the target values record the start-signal candidates.
 * Every result is research only: complete:false, eligible:false.
 */
public final class ShadowReplayReader implements Bridge.Timing {
    public static final String REVISION = "8h3b-fetch-v1";
    private final ControllerHost host;
    private final Rig rig;
    private JsonObject restoreResult;
    private int watchX = -1, watchY, watchChannel;
    private double watchVelocity;
    private long watchNanos;
    private JsonObject writeReceipt;
    private final CursorTrack track;
    private final PinnableCursorClip clip;
    private final int width;
    private final Consumer<JsonArray> editor;
    private ReplayEpoch epoch;
    private long epochs;
    private boolean subscribed = true;
    /** 8h3b: bridge request timings, newest last. Only the controller thread writes and reads them. */
    private static final int TIMINGS = 8_192;
    private final String[] timingIds = new String[TIMINGS], timingMethods = new String[TIMINGS];
    private final long[][] timingNanos = new long[TIMINGS][];
    private final int[] timingChars = new int[TIMINGS];
    private long timingCount;
    /** 8h3b: formats encoded off the controller thread from the close capture, in list order. */
    private final java.util.Map<String, JsonObject> prepared = new java.util.concurrent.ConcurrentHashMap<>();
    private volatile long preparedEpoch = -1;

    /** {@code editor} applies research edits through the fixture writer, for the concurrent-edit trial. */
    public ShadowReplayReader(ControllerHost host, Rig rig, int width, int scenes, Consumer<JsonArray> editor) {
        if (width < 1 || width > ShadowProjectCache.RESEARCH_MAX_WIDTH) throw new IllegalArgumentException("invalid replay research width");
        this.host = host; this.rig = rig; this.width = width; this.editor = editor;
        track = host.createCursorTrack("GN_REPLAY_READER", "ghostnote 8h2a reader", 0, scenes, false);
        clip = track.createLauncherCursorClip(width, 128);
        clip.setStepSize(ShadowProjectCache.GRID);
        ShadowSoundingProbe.markCursor(track, clip);
        epoch = new ReplayEpoch(0, "init", System.nanoTime(), this::schedule);
        clip.addNoteStepObserver(step -> {
            long started = System.nanoTime();
            NoteStep.State value = step.state();
            int code = value == NoteStep.State.Empty ? ReplayEpoch.STATE_EMPTY
                : value == NoteStep.State.NoteSustain ? ReplayEpoch.STATE_SUSTAIN : ReplayEpoch.STATE_ON;
            ReplayEpoch current = epoch;
            current.step(step.x(), step.y(), step.channel(), code, step.velocity(), step.duration(), step.gain(), step.chance(),
                step.isChanceEnabled(), step.isMuted(), started);
            current.handler(System.nanoTime() - started);
        });
        rig.kneeFixture.cursor().clip().addNoteStepObserver(step -> {
            if (step.x() == watchX && step.y() == watchY && step.channel() == watchChannel
                    && Math.abs(step.velocity() - watchVelocity) < 1e-6 && step.state() == NoteStep.State.NoteOn
                    && !writeReceipt.get("delivered").getAsBoolean()) {
                writeReceipt.addProperty("delivered", true);
                writeReceipt.addProperty("ms", (System.nanoTime() - watchNanos) / 1e6);
                writeReceipt.addProperty("epoch", epoch.id);
                writeReceipt.addProperty("readerSeq", epoch.callbacks);
            }
        });
        clip.exists().addValueObserver(on -> epoch.value("clipExists", String.valueOf(on), System.nanoTime()));
        clip.clipLauncherSlot().sceneIndex().addValueObserver(row -> epoch.value("sceneIndex", String.valueOf(row), System.nanoTime()));
        clip.getLoopLength().addValueObserver(beats -> epoch.value("loopLength", String.valueOf(beats), System.nanoTime()));
        clip.getPlayStop().addValueObserver(beats -> epoch.value("playStop", String.valueOf(beats), System.nanoTime()));
        track.channelId().addValueObserver(id -> epoch.value("trackChannelId", id, System.nanoTime()));
    }

    private void schedule(Runnable task) { host.scheduleTask(task, 0); }

    public JsonObject status() {
        JsonObject result = cursor();
        result.add("epoch", epoch.status());
        if (writeReceipt != null) result.add("writeReceipt", writeReceipt);
        if (restoreResult != null) result.add("restore", restoreResult);
        JsonArray ready = new JsonArray();
        if (preparedEpoch == epoch.id) prepared.keySet().forEach(ready::add);
        result.add("prepared", ready);
        return result;
    }

    private JsonObject cursor() {
        JsonObject result = new JsonObject();
        result.addProperty("revision", REVISION);
        result.addProperty("complete", false); result.addProperty("eligible", false);
        result.addProperty("width", width);
        result.addProperty("subscribed", subscribed);
        result.addProperty("isPlaying", rig.transport.isPlaying().get());
        result.addProperty("trackChannelId", track.channelId().get());
        result.addProperty("trackPinned", track.isPinned().get());
        result.addProperty("clipExists", clip.exists().get());
        result.addProperty("clipPinned", clip.isPinned().get());
        result.addProperty("sceneIndex", clip.clipLauncherSlot().sceneIndex().get());
        result.addProperty("loopLength", clip.getLoopLength().get());
        result.addProperty("playStop", clip.getPlayStop().get());
        return result;
    }

    /**
     * Apply one research action. With {@code arm}, start a new epoch just before the action. Actions: point,
     * select, pin, unpin, subscribe, unsubscribe, scroll, none. {@code editAt} and {@code editOps} run one
     * fixture edit from inside the replay, at that callback of the new epoch. {@code editNow} runs
     * {@code editOps} in this call, just after the action.
     */
    public JsonObject act(JsonObject params, IntFunction<Track> tracks) {
        String action = params.get("action").getAsString();
        boolean arm = params.has("arm") && params.get("arm").getAsBoolean();
        JsonArray ops = params.has("editOps") ? params.getAsJsonArray("editOps") : null;
        if (arm) {
            epoch = new ReplayEpoch(++epochs, params.has("label") ? params.get("label").getAsString() : action, System.nanoTime(), this::schedule);
            restoreResult = null;
            if (params.has("measureClose") && params.get("measureClose").getAsBoolean()) {
                java.util.List<String> prepare = new java.util.ArrayList<>();
                if (params.has("prepare")) params.getAsJsonArray("prepare").forEach(value -> prepare.add(value.getAsString()));
                for (String format : prepare)
                    if (!ReplayFetch.FORMATS.contains(format)) throw new IllegalArgumentException("unknown fetch format " + format);
                ReplayEpoch armed = epoch;
                preparedEpoch = epoch.id; prepared.clear();
                epoch.measureClose(() -> {
                    track.isPinned().set(true); clip.isPinned().set(true);
                    if (params.has("restoreWhen") && params.get("restoreWhen").getAsString().equals("close")) restore(params, tracks);
                    if (!prepare.isEmpty()) prepare(armed, prepare);
                });
            }
            if (params.has("editAt")) {
                if (ops == null) throw new IllegalArgumentException("editAt needs editOps");
                epoch.armEdit(params.get("editAt").getAsLong(), () -> editor.accept(ops));
            }
        }
        boolean transferred = false;
        switch (action) {
            case "point" -> {
                if (params.has("leaseFromTrack")) {
                    String token = params.get("ownerToken").getAsString();
                    transferred = ReplaySelectionActions.transfer(
                        () -> rig.selectionOwnedBy(token, params.get("leaseFromTrack").getAsInt(), params.get("leaseFromRow").getAsInt()),
                        () -> rig.claimSelectionOwnership(token, params.get("trackIndex").getAsInt(), -1));
                }
                clip.isPinned().set(false); track.isPinned().set(false);
                track.selectChannel(tracks.apply(params.get("trackIndex").getAsInt()));
            }
            case "bind" -> {
                int target = params.get("trackIndex").getAsInt(), row = params.get("row").getAsInt();
                clip.isPinned().set(false); track.isPinned().set(false);
                track.selectChannel(tracks.apply(target));
                if (params.has("ownerToken")) rig.claimSelectionOwnership(params.get("ownerToken").getAsString(), target, row);
                else rig.clearSelectionOwnership();
                tracks.apply(target).selectSlot(row);
                if (params.has("restoreWhen") && params.get("restoreWhen").getAsString().equals("bind")) restore(params, tracks);
            }
            case "play" -> rig.transport.play();
            case "stop" -> rig.transport.stop();
            case "watchWrite" -> {
                watchX = params.get("x").getAsInt(); watchY = params.get("y").getAsInt();
                watchChannel = params.get("channel").getAsInt(); watchVelocity = params.get("velocity").getAsDouble();
                watchNanos = System.nanoTime(); writeReceipt = new JsonObject(); writeReceipt.addProperty("delivered", false);
            }
            case "restore" -> restore(params, tracks);
            case "select" -> tracks.apply(params.get("trackIndex").getAsInt()).selectSlot(params.get("row").getAsInt());
            case "pin" -> { track.isPinned().set(true); clip.isPinned().set(true); }
            case "unpin" -> { clip.isPinned().set(false); track.isPinned().set(false); }
            case "subscribe", "unsubscribe" -> {
                boolean on = "subscribe".equals(action);
                // API 25 subscription is counted. Change it only on a transition.
                if (on != subscribed) { if (on) clip.subscribe(); else clip.unsubscribe(); subscribed = on; }
            }
            case "scroll" -> clip.scrollToStep(params.get("step").getAsInt());
            case "none" -> { }
            default -> throw new IllegalArgumentException("unknown replay research action " + action);
        }
        if (params.has("editNow") && params.get("editNow").getAsBoolean()) {
            if (ops == null) throw new IllegalArgumentException("editNow needs editOps");
            editor.accept(ops);
        }
        JsonObject result = cursor();
        result.addProperty("action", action);
        if (params.has("leaseFromTrack")) result.addProperty("leaseTransferred", transferred);
        result.addProperty("epoch", epoch.id);
        result.addProperty("actMs", (System.nanoTime() - epoch.armNanos) / 1e6);
        return result;
    }

    private void restore(JsonObject params, IntFunction<Track> tracks) {
        boolean owned = ReplaySelectionActions.restore(
            () -> rig.selectionOwnedBy(params.get("ownerToken").getAsString(),
                params.get("trackIndex").getAsInt(), params.get("row").getAsInt()),
            rig::clearSelectionOwnership,
            () -> {
                Track original = tracks.apply(params.get("restoreTrack").getAsInt());
                int row = params.get("restoreRow").getAsInt();
                if (params.has("restoreMechanism") && params.get("restoreMechanism").getAsString().equals("slot"))
                    original.clipLauncherSlotBank().getItemAt(row).select();
                else original.selectSlot(row);
            },
            () -> { if (params.has("restoreMixerTrack")) tracks.apply(params.get("restoreMixerTrack").getAsInt()).selectInEditor(); });
        restoreResult = new JsonObject(); restoreResult.addProperty("selected", owned);
        restoreResult.addProperty("revision", rig.selectionRevision);
    }

    /**
     * Encode the close capture on a new thread, one format after another. The capture is a copy that the
     * controller thread does not change after the close.
     */
    private void prepare(ReplayEpoch armed, java.util.List<String> formats) {
        ReplayFetch.Capture capture = armed.capture();
        long closed = System.nanoTime();
        Thread worker = new Thread(() -> {
            for (String format : formats) {
                long started = System.nanoTime();
                JsonObject result;
                try {
                    result = ReplayFetch.encode(capture, format, 0, Integer.MAX_VALUE);
                } catch (RuntimeException error) {
                    result = new JsonObject(); result.addProperty("error", String.valueOf(error));
                }
                long ended = System.nanoTime();
                result.addProperty("epoch", armed.id);
                result.addProperty("prepareStartMs", (started - closed) / 1e6);
                result.addProperty("prepareMs", (ended - started) / 1e6);
                // A later arm owns the map. Drop the result of an older epoch.
                if (preparedEpoch != armed.id) return;
                prepared.put(format, result);
            }
        }, "ghostnote-8h3b-prepare");
        worker.setDaemon(true);
        worker.start();
    }

    /** The off-thread payload, or {@code ready:false}. The bridge still serializes it on the controller thread. */
    public JsonObject prepared(long id, String format) {
        if (id != epoch.id) throw new IllegalStateException("replay epoch " + id + " is not current");
        JsonObject result = preparedEpoch == id ? prepared.get(format) : null;
        if (result == null) { JsonObject wait = new JsonObject(); wait.addProperty("ready", false); return wait; }
        if (result.has("error")) throw new IllegalStateException("prepare failed: " + result.get("error").getAsString());
        result.addProperty("ready", true);
        return result;
    }

    /** Encode the close capture in one research format on the controller thread. */
    public JsonObject fetch(long id, String format, int from, int limit) {
        if (id != epoch.id) throw new IllegalStateException("replay epoch " + id + " is not current");
        long started = System.nanoTime();
        JsonObject result = epoch.fetch(format, from, Math.max(1, Math.min(limit, 1 << 22)));
        result.addProperty("encodeMs", (System.nanoTime() - started) / 1e6);
        return result;
    }

    @Override
    public void record(String id, String method, long received, long start, long dispatched, long serialized, long written, int chars) {
        int at = (int) (timingCount++ % TIMINGS);
        timingIds[at] = id; timingMethods[at] = method; timingChars[at] = chars;
        timingNanos[at] = new long[] {received, start, dispatched, serialized, written};
    }

    /** Bridge timings for the given request ids that are still in the ring. Times are in ms. */
    public JsonObject timings(JsonArray ids) {
        java.util.Set<String> wanted = new java.util.HashSet<>();
        ids.forEach(value -> wanted.add(value.getAsString()));
        JsonArray rows = new JsonArray();
        long first = Math.max(0, timingCount - TIMINGS);
        for (long n = first; n < timingCount; n++) {
            int at = (int) (n % TIMINGS);
            if (timingIds[at] == null || !wanted.contains(timingIds[at])) continue;
            long[] t = timingNanos[at];
            JsonArray row = new JsonArray();
            row.add(timingIds[at]); row.add(timingMethods[at]); row.add((t[1] - t[0]) / 1e6); row.add((t[2] - t[1]) / 1e6);
            row.add((t[3] - t[2]) / 1e6); row.add((t[4] - t[3]) / 1e6); row.add(timingChars[at]); row.add(t[1] / 1e6); row.add(t[4] / 1e6);
            rows.add(row);
        }
        JsonObject result = new JsonObject();
        result.addProperty("revision", REVISION); result.addProperty("complete", false); result.addProperty("eligible", false);
        result.addProperty("columns", "id,method,queuedMs,dispatchMs,serializeMs,writeMs,chars,startMs,writtenMs");
        result.add("rows", rows);
        return result;
    }

    public JsonObject closedNotes(long id, int from, int limit) {
        if (id != epoch.id) throw new IllegalStateException("epoch changed");
        return epoch.closedNotes(from, Math.max(1, Math.min(limit, 65_536)));
    }

    public JsonObject notes(long id, int from, int limit) {
        if (id != epoch.id) throw new IllegalStateException("replay epoch " + id + " is not current");
        long started = System.nanoTime();
        JsonObject result = epoch.notes(from, Math.max(1, Math.min(limit, 65_536)));
        result.addProperty("encodeMs", (System.nanoTime() - started) / 1e6);
        return result;
    }
}

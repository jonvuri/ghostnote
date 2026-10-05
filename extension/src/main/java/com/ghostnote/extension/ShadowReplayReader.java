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
public final class ShadowReplayReader {
    public static final String REVISION = "8h2a-replay-v1";
    private final ControllerHost host;
    private final CursorTrack track;
    private final PinnableCursorClip clip;
    private final int width;
    private final Consumer<JsonArray> editor;
    private ReplayEpoch epoch;
    private long epochs;
    private boolean subscribed = true;

    /** {@code editor} applies research edits through the fixture writer, for the concurrent-edit trial. */
    public ShadowReplayReader(ControllerHost host, int width, int scenes, Consumer<JsonArray> editor) {
        if (width < 1 || width > ShadowProjectCache.RESEARCH_MAX_WIDTH) throw new IllegalArgumentException("invalid replay research width");
        this.host = host; this.width = width; this.editor = editor;
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
        return result;
    }

    private JsonObject cursor() {
        JsonObject result = new JsonObject();
        result.addProperty("revision", REVISION);
        result.addProperty("complete", false); result.addProperty("eligible", false);
        result.addProperty("width", width);
        result.addProperty("subscribed", subscribed);
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
            if (params.has("editAt")) {
                if (ops == null) throw new IllegalArgumentException("editAt needs editOps");
                epoch.armEdit(params.get("editAt").getAsLong(), () -> editor.accept(ops));
            }
        }
        switch (action) {
            case "point" -> {
                clip.isPinned().set(false); track.isPinned().set(false);
                track.selectChannel(tracks.apply(params.get("trackIndex").getAsInt()));
            }
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
        result.addProperty("epoch", epoch.id);
        result.addProperty("actMs", (System.nanoTime() - epoch.armNanos) / 1e6);
        return result;
    }

    public JsonObject notes(long id, int from, int limit) {
        if (id != epoch.id) throw new IllegalStateException("replay epoch " + id + " is not current");
        long started = System.nanoTime();
        JsonObject result = epoch.notes(from, Math.max(1, Math.min(limit, 65_536)));
        result.addProperty("encodeMs", (System.nanoTime() - started) / 1e6);
        return result;
    }
}

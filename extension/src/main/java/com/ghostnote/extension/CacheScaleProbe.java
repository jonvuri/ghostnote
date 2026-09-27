package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Sparse, probe-only observer bank for Phase 8e scale measurements. */
public final class CacheScaleProbe {
    public static final double GRID = 1.0 / 512.0;
    private static final int KEYS = 128;
    private static final int CONTROL_STEPS = 2048;

    private final View[] countViews;
    private final View[] widthViews;
    private final long constructNanos;

    public CacheScaleProbe(ControllerHost host, RigConfig config) {
        long started = System.nanoTime();
        countViews = new View[config.cacheScaleObservers];
        for (int i = 0; i < countViews.length; i++) {
            countViews[i] = new View(host, "COUNT_" + i, config.scenes, config.cacheScaleSteps);
        }
        if (config.cacheScaleWidthSteps > 0) {
            widthViews = new View[] {
                new View(host, "WIDTH_CONTROL", config.scenes, CONTROL_STEPS),
                new View(host, "WIDTH_CANDIDATE", config.scenes, config.cacheScaleWidthSteps),
            };
        } else {
            widthViews = new View[0];
        }
        constructNanos = System.nanoTime() - started;
    }

    public JsonObject info() {
        JsonObject result = new JsonObject();
        result.addProperty("countViews", countViews.length);
        result.addProperty("widthViews", widthViews.length);
        result.addProperty("countSteps", countViews.length == 0 ? 0 : countViews[0].steps);
        result.addProperty("controlSteps", widthViews.length == 0 ? 0 : widthViews[0].steps);
        result.addProperty("candidateSteps", widthViews.length == 0 ? 0 : widthViews[1].steps);
        result.addProperty("constructMicros", constructNanos / 1_000);
        result.addProperty("cursorTracks", countViews.length + widthViews.length);
        result.addProperty("clipProxies", countViews.length + widthViews.length);
        result.addProperty("stepDataObservers", countViews.length + widthViews.length);
        result.addProperty("extensionReferenceBytes",
            8L * 4L * (countViews.length + widthViews.length));
        return result;
    }

    public JsonObject prepare(String kind, int limit) {
        View[] selected = selected(kind, limit);
        for (View view : selected) view.recorder.prepare();
        return summary(selected);
    }

    public JsonObject point(String kind, int index, Track target) {
        View view = view(kind, index);
        view.track.isPinned().set(false);
        view.clip.isPinned().set(false);
        view.track.selectChannel(target);
        return view.status();
    }

    public JsonObject bind(String kind, int index, Track target, int row) {
        View view = view(kind, index);
        view.clip.isPinned().set(true);
        view.track.isPinned().set(true);
        view.expectedChannelId = target.channelId().get();
        view.expectedRow = row;
        return view.status();
    }

    public JsonObject select(String kind, int index, Track target, int row) {
        target.selectSlot(row);
        return view(kind, index).status();
    }

    public JsonObject pin(String kind, int index, boolean pinned) {
        View view = view(kind, index);
        view.clip.isPinned().set(pinned);
        view.track.isPinned().set(pinned);
        return view.status();
    }

    public JsonObject pinTrack(String kind, int index, boolean pinned) {
        View view = view(kind, index);
        view.track.isPinned().set(pinned);
        return view.status();
    }

    public JsonObject status(String kind, int index) {
        return view(kind, index).status();
    }

    public JsonObject read(String kind, int limit) {
        return summary(selected(kind, limit));
    }

    public JsonObject reconcile(String kind, int limit) {
        View[] selected = selected(kind, limit);
        long started = System.nanoTime();
        int coordinates = 0;
        int noteCount = 0;
        int calls = 0;
        boolean stable = true;
        for (View view : selected) {
            ReconcileResult result = view.recorder.reconcile(view.clip);
            coordinates += result.coordinates;
            noteCount += result.noteCount;
            calls += result.getStepCalls;
            stable &= result.stable;
        }
        JsonObject result = summary(selected);
        result.addProperty("reconcileMicros", (System.nanoTime() - started) / 1_000);
        result.addProperty("reconciledCoordinates", coordinates);
        result.addProperty("noteCount", noteCount);
        result.addProperty("getStepCalls", calls);
        result.addProperty("stable", stable);
        return result;
    }

    public JsonObject pause(String kind, int limit, boolean paused) {
        View[] selected = selected(kind, limit);
        for (View view : selected) view.recorder.setAccepting(!paused);
        return summary(selected);
    }

    public JsonObject directRead(String kind, int index, int x, int y) {
        View view = view(kind, index);
        requireCell(view, x, y);
        JsonArray channels = new JsonArray();
        long started = System.nanoTime();
        for (int channel = 0; channel < 16; channel++) {
            NoteStep step = view.clip.getStep(channel, x, y);
            if (step.state() != NoteStep.State.NoteOn) continue;
            JsonObject note = new JsonObject();
            note.addProperty("channel", channel);
            note.addProperty("x", x);
            note.addProperty("y", y);
            note.addProperty("velocity", step.velocity());
            note.addProperty("duration", step.duration());
            note.addProperty("chance", step.chance());
            channels.add(note);
        }
        JsonObject result = new JsonObject();
        result.add("notes", channels);
        result.addProperty("count", channels.size());
        result.addProperty("scanMicros", (System.nanoTime() - started) / 1_000);
        return result;
    }

    public JsonObject mutate(JsonObject params) {
        View view = view(params.get("kind").getAsString(), params.get("index").getAsInt());
        String mutation = params.get("mutation").getAsString();
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;
        int x = params.get("x").getAsInt();
        int y = params.get("y").getAsInt();
        requireCell(view, x, y);
        long started = System.nanoTime();
        switch (mutation) {
            case "set" -> view.clip.setStep(
                channel, x, y,
                params.has("velocity") ? params.get("velocity").getAsInt() : 100,
                params.has("duration") ? params.get("duration").getAsDouble() : GRID);
            case "clear" -> view.clip.clearStep(channel, x, y);
            case "field" -> {
                NoteStep step = view.clip.getStep(channel, x, y);
                step.setVelocity(params.has("velocity")
                    ? params.get("velocity").getAsDouble() : 0.625);
                step.setChance(params.has("chance") ? params.get("chance").getAsDouble() : 0.75);
                step.setIsChanceEnabled(true);
            }
            default -> throw new IllegalArgumentException("unknown scale mutation: " + mutation);
        }
        JsonObject result = new JsonObject();
        result.addProperty("mutation", mutation);
        result.addProperty("hostMicros", (System.nanoTime() - started) / 1_000);
        return result;
    }

    public JsonObject mutateMany(JsonObject params) {
        String kind = params.get("kind").getAsString();
        int limit = params.get("limit").getAsInt();
        String mutation = params.get("mutation").getAsString();
        View[] selected = selected(kind, limit);
        long started = System.nanoTime();
        for (int index = 0; index < selected.length; index++) {
            View view = selected[index];
            int x = index % Math.min(view.steps, 64);
            int y = 36 + index % 48;
            if ("set".equals(mutation)) {
                view.clip.setStep(index % 16, x, y, 96, GRID);
            } else if ("clear".equals(mutation)) {
                view.clip.clearStep(index % 16, x, y);
            } else if ("field".equals(mutation)) {
                NoteStep step = view.clip.getStep(0, 0, 60);
                if (step.state() == NoteStep.State.NoteOn) {
                    step.setVelocity(index % 2 == 0 ? 0.5 : 0.75);
                }
            } else {
                throw new IllegalArgumentException("unknown scale mutation: " + mutation);
            }
        }
        JsonObject result = new JsonObject();
        result.addProperty("mutation", mutation);
        result.addProperty("views", selected.length);
        result.addProperty("hostMicros", (System.nanoTime() - started) / 1_000);
        return result;
    }

    public JsonObject mutateBatch(JsonObject params) {
        View view = view(params.get("kind").getAsString(), params.get("index").getAsInt());
        String mutation = params.get("mutation").getAsString();
        int count = params.get("count").getAsInt();
        int start = params.has("start") ? params.get("start").getAsInt() : 0;
        if (count < 0 || start < 0 || start + count > view.steps * KEYS) {
            throw new IllegalArgumentException("batch is outside the scale view");
        }
        long started = System.nanoTime();
        for (int offset = 0; offset < count; offset++) {
            int coordinate = start + offset;
            int x = coordinate / KEYS;
            int y = coordinate % KEYS;
            if ("set".equals(mutation)) {
                view.clip.setStep(offset % 16, x, y, 96, GRID);
            } else if ("clear".equals(mutation)) {
                for (int channel = 0; channel < 16; channel++) {
                    view.clip.clearStep(channel, x, y);
                }
            } else if ("field".equals(mutation)) {
                NoteStep step = view.clip.getStep(offset % 16, x, y);
                if (step.state() == NoteStep.State.NoteOn) {
                    step.setVelocity(offset % 2 == 0 ? 0.5 : 0.75);
                    step.setChance(offset % 2 == 0 ? 0.6 : 0.8);
                    step.setIsChanceEnabled(true);
                }
            } else {
                throw new IllegalArgumentException("unknown scale mutation: " + mutation);
            }
        }
        JsonObject result = new JsonObject();
        result.addProperty("mutation", mutation);
        result.addProperty("coordinates", count);
        result.addProperty("hostMicros", (System.nanoTime() - started) / 1_000);
        return result;
    }

    private View view(String kind, int index) {
        View[] views = "count".equals(kind) ? countViews
            : "width".equals(kind) ? widthViews
            : null;
        if (views == null || index < 0 || index >= views.length) {
            throw new IllegalArgumentException("scale view is outside the allocated " + kind + " bank");
        }
        return views[index];
    }

    private View[] selected(String kind, int limit) {
        View[] views = "count".equals(kind) ? countViews
            : "width".equals(kind) ? widthViews
            : null;
        if (views == null || limit < 0 || limit > views.length) {
            throw new IllegalArgumentException("invalid scale view limit for " + kind + ": " + limit);
        }
        return Arrays.copyOf(views, limit);
    }

    private static void requireCell(View view, int x, int y) {
        if (x < 0 || x >= view.steps || y < 0 || y >= KEYS) {
            throw new IllegalArgumentException("cell is outside the scale view");
        }
    }

    private static JsonObject summary(View[] views) {
        long callbacks = 0;
        long rejected = 0;
        long duplicateDirty = 0;
        long occupied = 0;
        long dirty = 0;
        long maxDirty = 0;
        long firstCallbackMicros = Long.MAX_VALUE;
        long lastCallbackMicros = 0;
        long estimatedBytes = 0;
        int bound = 0;
        for (View view : views) {
            SparseRecorder recorder = view.recorder;
            callbacks += recorder.callbacks;
            rejected += recorder.rejectedCallbacks;
            duplicateDirty += recorder.duplicateDirty;
            occupied += recorder.occupied.size();
            dirty += recorder.dirty.size();
            maxDirty += recorder.maxDirty;
            if (recorder.firstCallbackNanos > 0) {
                firstCallbackMicros = Math.min(firstCallbackMicros,
                    (recorder.firstCallbackNanos - recorder.preparedAtNanos) / 1_000);
                lastCallbackMicros = Math.max(lastCallbackMicros,
                    (recorder.lastCallbackNanos - recorder.preparedAtNanos) / 1_000);
            }
            estimatedBytes += recorder.estimatedBytes();
            if (view.bindingReady()) bound++;
        }
        JsonObject result = new JsonObject();
        result.addProperty("views", views.length);
        result.addProperty("callbacks", callbacks);
        result.addProperty("rejectedCallbacks", rejected);
        result.addProperty("duplicateDirty", duplicateDirty);
        result.addProperty("occupiedCoordinates", occupied);
        result.addProperty("pendingDirty", dirty);
        result.addProperty("maxDirty", maxDirty);
        result.addProperty("estimatedRecorderBytes", estimatedBytes);
        result.addProperty("boundViews", bound);
        if (firstCallbackMicros != Long.MAX_VALUE) {
            result.addProperty("firstCallbackMicros", firstCallbackMicros);
            result.addProperty("lastCallbackMicros", lastCallbackMicros);
        }
        return result;
    }

    private static final class View {
        private final CursorTrack track;
        private final PinnableCursorClip clip;
        private final int steps;
        private final SparseRecorder recorder = new SparseRecorder();
        private String expectedChannelId = "";
        private int expectedRow = -1;

        private View(ControllerHost host, String id, int scenes, int steps) {
            this.steps = steps;
            track = host.createCursorTrack(
                "GN_CACHE_SCALE_" + id, "ghostnote cache scale " + id, 0, scenes, false);
            track.exists().markInterested();
            track.position().markInterested();
            track.channelId().markInterested();
            track.isPinned().markInterested();
            clip = track.createLauncherCursorClip(steps, KEYS);
            clip.setStepSize(GRID);
            clip.exists().markInterested();
            clip.isPinned().markInterested();
            clip.clipLauncherSlot().sceneIndex().markInterested();
            clip.addStepDataObserver(recorder::record);
        }

        private JsonObject status() {
            JsonObject result = new JsonObject();
            result.addProperty("steps", steps);
            result.addProperty("trackPosition", track.position().get());
            result.addProperty("channelId", track.channelId().get());
            result.addProperty("trackPinned", track.isPinned().get());
            result.addProperty("clipExists", clip.exists().get());
            result.addProperty("sceneIndex", clip.clipLauncherSlot().sceneIndex().get());
            result.addProperty("clipPinned", clip.isPinned().get());
            return result;
        }

        private boolean bindingReady() {
            return !expectedChannelId.isEmpty()
                && expectedChannelId.equals(track.channelId().get())
                && expectedRow == clip.clipLauncherSlot().sceneIndex().get()
                && track.isPinned().get()
                && clip.isPinned().get();
        }
    }

    private record ReconcileResult(
        int coordinates, int noteCount, int getStepCalls, boolean stable) {}

    private static final class SparseRecorder {
        private final Set<Integer> occupied = new HashSet<>();
        private final Set<Integer> dirty = new HashSet<>();
        private int generation;
        private boolean accepting = true;
        private long preparedAtNanos = System.nanoTime();
        private long firstCallbackNanos;
        private long lastCallbackNanos;
        private long callbacks;
        private long rejectedCallbacks;
        private long duplicateDirty;
        private long maxDirty;

        private void prepare() {
            generation++;
            accepting = true;
            occupied.clear();
            dirty.clear();
            preparedAtNanos = System.nanoTime();
            firstCallbackNanos = 0;
            lastCallbackNanos = 0;
            callbacks = 0;
            rejectedCallbacks = 0;
            duplicateDirty = 0;
            maxDirty = 0;
        }

        private void setAccepting(boolean value) {
            accepting = value;
        }

        private void record(int x, int y, int state) {
            long now = System.nanoTime();
            callbacks++;
            if (firstCallbackNanos == 0) firstCallbackNanos = now;
            lastCallbackNanos = now;
            if (!accepting || x < 0 || y < 0 || y >= KEYS) {
                rejectedCallbacks++;
                return;
            }
            int key = x * KEYS + y;
            if (!dirty.add(key)) duplicateDirty++;
            maxDirty = Math.max(maxDirty, dirty.size());
        }

        private ReconcileResult reconcile(PinnableCursorClip clip) {
            int expectedGeneration = generation;
            long expectedCallbacks = callbacks;
            Integer[] work = dirty.toArray(Integer[]::new);
            int noteCount = 0;
            for (int key : work) {
                int x = key / KEYS;
                int y = key % KEYS;
                boolean any = false;
                for (int channel = 0; channel < 16; channel++) {
                    if (clip.getStep(channel, x, y).state() == NoteStep.State.NoteOn) {
                        any = true;
                        noteCount++;
                    }
                }
                if (any) occupied.add(key);
                else occupied.remove(key);
            }
            boolean stable = generation == expectedGeneration && callbacks == expectedCallbacks;
            if (stable) dirty.removeAll(Arrays.asList(work));
            return new ReconcileResult(work.length, noteCount, work.length * 16, stable);
        }

        private long estimatedBytes() {
            // Object estimate: recorder and two HashSet shells, then one boxed key
            // and one HashMap node for each stored membership.
            return 256L + (occupied.size() + dirty.size()) * 56L;
        }
    }
}

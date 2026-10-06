package com.ghostnote.extension;

import com.bitwig.extension.controller.api.BooleanValue;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.MasterTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.SettableColorValue;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 8h3d research: change awareness without a resident grid. Probe profile only. Every reply keeps
 * {@code complete:false} and {@code eligible:false}.
 *
 * <p>Candidate 3, watched clips. Each watch is one cursor at the clip-reader width and grid. It binds by the
 * 8h3c route: park on the master track, subscribe, select the row, point, and close at the D30 task. A
 * callback before the confirmation refuses the bind. After the confirmation, the watch stays subscribed. Each
 * later note-step callback is a change (D26). A release unsubscribes; its callbacks are counted separately.
 *
 * <p>Candidate 2, clip-level values. One cursor binds a clip with no note-step observer. It records each
 * clip, slot, and flat-bank value callback, so that a driver can tell which values report a note edit.
 *
 * <p>Only one bind runs at a time. A bind holds a write-gate lease, so a clip read waits for it.
 */
public final class ChangeWatchProbe {
    public static final String REVISION = "8h3d-watch-v1";
    public static final int MAX_WATCHES = 32;
    private static final int KEYS = 128;
    private static final int BIND_DEADLINE_MS = 5_000;
    private static final int SAMPLES = 32;

    private final class Watch {
        final int index;
        final CursorTrack track;
        final PinnableCursorClip clip;
        boolean subscribed = true;
        String phase = "idle", reason = "", trackId = "";
        int row = -1;
        ClipReadCapture capture;
        long started, closedNanos, confirmedNanos, releasedNanos, firstChangeNanos, lastChangeNanos;
        long changes, mark, binds;
        final List<long[]> samples = new ArrayList<>();
        JsonObject selection;

        Watch(int index) {
            this.index = index;
            track = host.createCursorTrack("GN_WATCH_" + index, "ghostnote watch " + index, 0, scenes, false);
            clip = track.createLauncherCursorClip(ClipReader.WIDTH, KEYS);
            clip.setStepSize(ClipReader.GRID);
            track.channelId().markInterested();
            track.isPinned().markInterested();
            clip.exists().markInterested();
            clip.isPinned().markInterested();
            clip.clipLauncherSlot().sceneIndex().markInterested();
            clip.addNoteStepObserver(this::onStep);
            clip.exists().addValueObserver(value -> { if (capture != null && !capture.isClosed()) capture.exists(value); });
        }

        void onStep(NoteStep step) {
            ClipReadCapture target = capture;
            if (target == null) { strayCallbacks++; return; }
            NoteStep.State value = step.state();
            int state = value == NoteStep.State.Empty ? ClipReadCapture.STATE_EMPTY
                : value == NoteStep.State.NoteSustain ? ClipReadCapture.STATE_SUSTAIN : ClipReadCapture.STATE_ON;
            if (state == ClipReadCapture.STATE_ON && !target.isClosed()) {
                fields.doubles[0] = step.velocity();
                fields.doubles[3] = step.duration();
            }
            boolean change = target.isClosed() && "watching".equals(phase);
            target.step(step.x(), step.y(), step.channel(), state, fields);
            if (!change) return;
            long now = System.nanoTime();
            changes++;
            if (firstChangeNanos == 0) firstChangeNanos = now;
            lastChangeNanos = now;
            if (samples.size() < SAMPLES) samples.add(new long[] {step.x(), step.y(), step.channel(), state, now});
        }

        boolean atPark() {
            String parkId = park.channelId().get();
            return !parkId.isEmpty() && parkId.equals(track.channelId().get()) && !clip.exists().get();
        }

        JsonObject json(long now) {
            JsonObject r = new JsonObject();
            r.addProperty("index", index);
            r.addProperty("phase", phase);
            r.addProperty("reason", reason);
            r.addProperty("trackId", trackId);
            r.addProperty("row", row);
            r.addProperty("subscribed", subscribed);
            r.addProperty("binds", binds);
            r.addProperty("changes", changes);
            r.addProperty("changesSinceMark", changes - mark);
            r.addProperty("stale", changes > mark);
            r.addProperty("firstChangeAgoMs", firstChangeNanos == 0 ? -1 : (now - firstChangeNanos) / 1e6);
            r.addProperty("lastChangeAgoMs", lastChangeNanos == 0 ? -1 : (now - lastChangeNanos) / 1e6);
            r.addProperty("closeMs", closedNanos == 0 ? -1 : (closedNanos - started) / 1e6);
            r.addProperty("confirmMs", confirmedNanos == 0 ? -1 : (confirmedNanos - started) / 1e6);
            if (capture != null) {
                r.addProperty("callbacks", capture.callbacks);
                r.addProperty("onsets", capture.onsets);
                r.addProperty("batches", capture.batches);
                r.addProperty("duplicates", capture.duplicates);
                r.addProperty("afterClose", capture.afterClose);
                r.addProperty("afterRelease", capture.afterRelease);
                r.addProperty("releaseEmpty", capture.releaseEmpty);
            }
            JsonArray rows = new JsonArray();
            for (long[] s : samples) {
                JsonArray row = new JsonArray();
                for (int i = 0; i < 4; i++) row.add(s[i]);
                row.add((now - s[4]) / 1e6);
                rows.add(row);
            }
            r.add("samples", rows);
            if (selection != null) r.add("selection", selection);
            return r;
        }
    }

    /** One value observer of the values cursor: callback count since the mark, last value, and first time. */
    private static final class ValueTrace {
        long count, firstNanos;
        String last = "";
    }

    private final ControllerHost host;
    private final Rig rig;
    private final int scenes;
    private final MasterTrack park;
    private final ClipReadCapture.Fields fields = new ClipReadCapture.Fields();
    private final Watch[] watches;
    private final CursorTrack valuesTrack;
    private final PinnableCursorClip valuesClip;
    private final Map<String, ValueTrace> values = new LinkedHashMap<>();
    private String valuesTrackId = "";
    private int valuesRow = -1, contentMark;
    private long valuesMarkNanos = System.nanoTime();
    private boolean binding;
    private long strayCallbacks;

    public ChangeWatchProbe(ControllerHost host, Rig rig, int count, int scenes) {
        if (count < 1 || count > MAX_WATCHES) throw new IllegalArgumentException("watch count must be 1.." + MAX_WATCHES);
        this.host = host; this.rig = rig; this.scenes = scenes;
        park = host.createMasterTrack(0);
        park.channelId().markInterested();
        watches = new Watch[count];
        for (int i = 0; i < count; i++) watches[i] = new Watch(i);
        valuesTrack = host.createCursorTrack("GN_WATCH_VALUES", "ghostnote watch values", 0, scenes, false);
        valuesTrack.channelId().markInterested();
        valuesTrack.isPinned().markInterested();
        // A one-cell view with no note-step observer. It holds no grid.
        valuesClip = valuesTrack.createLauncherCursorClip(1, 1);
        valuesClip.isPinned().markInterested();
        valuesClip.clipLauncherSlot().sceneIndex().markInterested();
        observe("clip.exists", valuesClip.exists());
        observe("clip.loopStart", valuesClip.getLoopStart());
        observe("clip.loopLength", valuesClip.getLoopLength());
        observe("clip.playStart", valuesClip.getPlayStart());
        observe("clip.playStop", valuesClip.getPlayStop());
        observe("clip.isLoopEnabled", valuesClip.isLoopEnabled());
        observe("clip.shuffle", valuesClip.getShuffle());
        observe("clip.accent", valuesClip.getAccent());
        observe("clip.color", valuesClip.color());
        observe("clip.canScrollKeysUp", valuesClip.canScrollKeysUp());
        observe("clip.canScrollKeysDown", valuesClip.canScrollKeysDown());
        observe("clip.canScrollStepsBackwards", valuesClip.canScrollStepsBackwards());
        observe("clip.canScrollStepsForwards", valuesClip.canScrollStepsForwards());
        var slot = valuesClip.clipLauncherSlot();
        observe("slot.name", slot.name());
        observe("slot.color", slot.color());
        observe("slot.hasContent", slot.hasContent());
        observe("slot.isPlaying", slot.isPlaying());
        observe("slot.isRecording", slot.isRecording());
        observe("slot.isPlaybackQueued", slot.isPlaybackQueued());
        // Hold no clip until a bind.
        host.scheduleTask(() -> { for (Watch w : watches) if (w.subscribed && w.capture == null) {
            w.clip.unsubscribe(); w.subscribed = false; } }, 0);
    }

    private ValueTrace trace(String name) { return values.computeIfAbsent(name, key -> new ValueTrace()); }

    private void record(String name, String value) {
        ValueTrace t = trace(name);
        t.count++;
        if (t.firstNanos == 0) t.firstNanos = System.nanoTime();
        t.last = value;
    }

    private void observe(String name, BooleanValue value) {
        trace(name); value.addValueObserver(v -> record(name, String.valueOf(v)));
    }

    private void observe(String name, com.bitwig.extension.controller.api.SettableRangedValue value) {
        trace(name); value.addValueObserver(v -> record(name, String.valueOf(v)));
    }

    private void observe(String name, com.bitwig.extension.controller.api.DoubleValue value) {
        trace(name); value.addValueObserver(v -> record(name, String.valueOf(v)));
    }

    private void observe(String name, com.bitwig.extension.controller.api.StringValue value) {
        trace(name); value.addValueObserver(v -> record(name, v));
    }

    private void observe(String name, SettableColorValue value) {
        trace(name); value.addValueObserver((r, g, b) -> record(name, r + "," + g + "," + b));
    }

    private void schedule(Runnable task) { host.scheduleTask(task, 0); }

    private Watch watch(int index) {
        if (index < 0 || index >= watches.length) throw new IllegalArgumentException("no watch " + index);
        return watches[index];
    }

    private Track target(int trackIndex, int row, String channelId) {
        if (binding) throw new IllegalStateException("a watch bind is open");
        if (trackIndex < 0 || trackIndex >= rig.config.tracks) throw new IllegalArgumentException("trackIndex out of range");
        if (row < 0 || row >= rig.config.scenes) throw new IllegalArgumentException("row out of range");
        Track target = rig.trackBank.getItemAt(trackIndex);
        if (!target.exists().get() || !channelId.equals(target.channelId().get())) {
            throw new IllegalArgumentException("track " + trackIndex + " is not " + channelId);
        }
        if (!target.clipLauncherSlotBank().getItemAt(row).hasContent().get()) {
            throw new IllegalArgumentException("slot " + trackIndex + ":" + row + " holds no clip");
        }
        if (park.channelId().get().isEmpty()) throw new IllegalStateException("the park target is not available");
        return target;
    }

    /** Start one watch bind. The driver polls {@link #status} until the phase is watching or refused. */
    public JsonObject bind(int index, int trackIndex, int row, String channelId) {
        Watch w = watch(index);
        if (!"idle".equals(w.phase) && !"released".equals(w.phase) && !"refused".equals(w.phase)) {
            throw new IllegalStateException("watch " + index + " is " + w.phase);
        }
        Track target = target(trackIndex, row, channelId);
        binding = true;
        WriteGate.Lease lease = rig.writeGate.lease();
        int entryTrack = rig.selectedTrackIndex, entryRow = rig.selectedSlotIndex, entryMixer = rig.selectedMixerTrackIndex;
        w.phase = "parking"; w.reason = ""; w.trackId = channelId; w.row = row; w.binds++;
        w.started = System.nanoTime(); w.closedNanos = 0; w.confirmedNanos = 0; w.releasedNanos = 0;
        w.firstChangeNanos = 0; w.lastChangeNanos = 0; w.changes = 0; w.mark = 0; w.samples.clear();
        w.capture = null; w.selection = null;
        long attempt = w.binds;
        Runnable[] done = new Runnable[1];
        done[0] = () -> { binding = false; lease.release(); };
        host.scheduleTask(() -> {
            if (w.binds == attempt && ("parking".equals(w.phase) || "binding".equals(w.phase))) {
                refuse(w, "deadline", entryTrack, entryRow, entryMixer, trackIndex, row);
                done[0].run();
            }
        }, BIND_DEADLINE_MS);
        w.clip.isPinned().set(false);
        w.track.isPinned().set(false);
        if (!w.atPark()) w.track.selectChannel(park);
        schedule(() -> awaitPark(w, attempt, 0, target, trackIndex, row, entryTrack, entryRow, entryMixer, done[0]));
        return status(index);
    }

    private void awaitPark(Watch w, long attempt, int polls, Track target, int trackIndex, int row,
                           int entryTrack, int entryRow, int entryMixer, Runnable done) {
        if (w.binds != attempt || !"parking".equals(w.phase)) return;
        if (!w.atPark()) {
            host.scheduleTask(() -> awaitPark(w, attempt, polls + 1, target, trackIndex, row,
                entryTrack, entryRow, entryMixer, done), polls < 4 ? 0 : 5);
            return;
        }
        long stray = strayCallbacks;
        if (!w.subscribed) { w.clip.subscribe(); w.subscribed = true; }
        schedule(() -> {
            if (w.binds != attempt || !"parking".equals(w.phase)) return;
            if (strayCallbacks != stray) {
                refuse(w, "park-not-empty", entryTrack, entryRow, entryMixer, trackIndex, row); done.run(); return;
            }
            w.phase = "binding";
            String token = "change-watch-" + w.index + "-" + attempt;
            w.capture = new ClipReadCapture(attempt, this::schedule, () -> close(w, attempt, token, trackIndex, row,
                entryTrack, entryRow, entryMixer, done));
            rig.claimSelectionOwnership(token, trackIndex, row);
            target.selectSlot(row);
            w.track.selectChannel(target);
        });
    }

    private void close(Watch w, long attempt, String token, int trackIndex, int row,
                       int entryTrack, int entryRow, int entryMixer, Runnable done) {
        if (w.binds != attempt || !"binding".equals(w.phase)) return;
        w.closedNanos = System.nanoTime();
        w.track.isPinned().set(true);
        w.clip.isPinned().set(true);
        String boundId = w.track.channelId().get();
        int boundRow = w.clip.clipLauncherSlot().sceneIndex().get();
        w.selection = restore(token, entryTrack, entryRow, entryMixer, trackIndex, row);
        w.phase = "confirming";
        schedule(() -> {
            if (w.binds != attempt || !"confirming".equals(w.phase)) return;
            ClipReadCapture c = w.capture;
            if (c.afterClose > 0) fail(w, "step-delta");
            else if (c.batches > 1) fail(w, "replay-batches");
            else if (c.duplicates > 0) fail(w, "duplicate-cell");
            else if (!w.trackId.equals(boundId) || boundRow != w.row) fail(w, "bound-target-mismatch");
            else { w.phase = "watching"; w.confirmedNanos = System.nanoTime(); }
            done.run();
        });
    }

    private void refuse(Watch w, String reason, int entryTrack, int entryRow, int entryMixer, int trackIndex, int row) {
        if ("binding".equals(w.phase)) {
            w.track.isPinned().set(true);
            w.clip.isPinned().set(true);
            w.selection = restore("change-watch-" + w.index + "-" + w.binds, entryTrack, entryRow, entryMixer, trackIndex, row);
        }
        fail(w, reason);
    }

    private void fail(Watch w, String reason) {
        w.phase = "refused"; w.reason = reason;
        if (w.capture != null && w.capture.isClosed()) w.capture.release();
        else w.capture = null;
        if (w.subscribed) { w.clip.unsubscribe(); w.subscribed = false; }
    }

    /** Restore the slot and mixer selection under the lease. A lost lease does not restore. */
    private JsonObject restore(String token, int entryTrack, int entryRow, int entryMixer, int trackIndex, int row) {
        JsonObject s = new JsonObject();
        JsonArray entry = new JsonArray();
        entry.add(entryTrack); entry.add(entryRow); entry.add(entryMixer);
        s.add("entry", entry);
        if (!rig.selectionOwnedBy(token, trackIndex, row)) {
            if (rig.selectionOwnerIs(token)) rig.clearSelectionOwnership();
            s.addProperty("restored", false);
            s.addProperty("reason", "lease-lost");
            return s;
        }
        rig.clearSelectionOwnership();
        boolean slot = entryTrack >= 0 && entryTrack < rig.config.tracks && entryRow >= 0;
        boolean mixer = entryMixer >= 0 && entryMixer < rig.config.tracks;
        if (slot) rig.trackBank.getItemAt(entryTrack).selectSlot(entryRow);
        if (mixer) rig.trackBank.getItemAt(entryMixer).selectInEditor();
        s.addProperty("restored", slot && mixer);
        return s;
    }

    /** Set the stale baseline to now, as after an agent read of the clip. */
    public JsonObject mark(int index) {
        Watch w = watch(index);
        w.mark = w.changes;
        w.firstChangeNanos = 0; w.lastChangeNanos = 0; w.samples.clear();
        return status(index);
    }

    /** Unsubscribe one watch. Later callbacks of its capture are release callbacks. */
    public JsonObject release(int index) {
        Watch w = watch(index);
        if ("parking".equals(w.phase) || "binding".equals(w.phase) || "confirming".equals(w.phase)) {
            throw new IllegalStateException("watch " + index + " is " + w.phase);
        }
        if (w.capture != null && w.capture.isClosed() && "watching".equals(w.phase)) w.capture.release();
        if (w.subscribed) { w.clip.unsubscribe(); w.subscribed = false; }
        w.track.isPinned().set(false);
        w.clip.isPinned().set(false);
        if ("watching".equals(w.phase)) { w.phase = "released"; w.releasedNanos = System.nanoTime(); }
        return status(index);
    }

    /** Point the values cursor at one clip. It changes the selection; the driver restores it. */
    public JsonObject valuesBind(int trackIndex, int row, String channelId) {
        Track target = target(trackIndex, row, channelId);
        valuesTrack.isPinned().set(false);
        valuesClip.isPinned().set(false);
        target.selectSlot(row);
        valuesTrack.selectChannel(target);
        valuesTrackId = channelId; valuesRow = row;
        return valuesStatus();
    }

    public JsonObject valuesPin(boolean pinned) {
        valuesTrack.isPinned().set(pinned);
        valuesClip.isPinned().set(pinned);
        return valuesStatus();
    }

    /** Clear the value counters. The flat-bank content epoch is the rig {@code hasContent} observer. */
    public JsonObject valuesMark() {
        for (ValueTrace t : values.values()) { t.count = 0; t.firstNanos = 0; }
        contentMark = rig.launcherContentEpoch;
        valuesMarkNanos = System.nanoTime();
        return valuesStatus();
    }

    public JsonObject valuesStatus() {
        long now = System.nanoTime();
        JsonObject r = base();
        r.addProperty("trackId", valuesTrackId);
        r.addProperty("row", valuesRow);
        r.addProperty("boundTrackId", valuesTrack.channelId().get());
        r.addProperty("boundRow", valuesClip.clipLauncherSlot().sceneIndex().get());
        r.addProperty("pinned", valuesClip.isPinned().get() && valuesTrack.isPinned().get());
        r.addProperty("sinceMarkMs", (now - valuesMarkNanos) / 1e6);
        r.addProperty("flatBankContentEvents", rig.launcherContentEpoch - contentMark);
        JsonObject list = new JsonObject();
        for (var e : values.entrySet()) {
            JsonObject t = new JsonObject();
            t.addProperty("count", e.getValue().count);
            t.addProperty("last", e.getValue().last);
            t.addProperty("firstAgoMs", e.getValue().firstNanos == 0 ? -1 : (now - e.getValue().firstNanos) / 1e6);
            list.add(e.getKey(), t);
        }
        r.add("values", list);
        return r;
    }

    private JsonObject base() {
        JsonObject r = new JsonObject();
        r.addProperty("revision", REVISION);
        r.addProperty("complete", false);
        r.addProperty("eligible", false);
        return r;
    }

    public JsonObject status(int index) {
        JsonObject r = base();
        r.add("watch", watch(index).json(System.nanoTime()));
        return r;
    }

    public JsonObject status() {
        long now = System.nanoTime();
        JsonObject r = base();
        r.addProperty("count", watches.length);
        r.addProperty("binding", binding);
        r.addProperty("strayCallbacks", strayCallbacks);
        int watching = 0, stale = 0;
        JsonArray list = new JsonArray();
        for (Watch w : watches) {
            if ("watching".equals(w.phase)) { watching++; if (w.changes > w.mark) stale++; }
            list.add(w.json(now));
        }
        r.addProperty("watching", watching);
        r.addProperty("stale", stale);
        r.add("watches", list);
        return r;
    }
}

package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.MasterTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * The product clip reader (8h3c). One dedicated cursor, 1/512 beat, 4,194,304 steps wide (E225), reads one
 * launcher clip completely from its replay (D30, E227).
 *
 * <p>The route follows the 8h3a product rules (E228) and the 8h3c2 open order (E232, {@link ClipReadRoute}):
 * <ol>
 *   <li>Capture the slot track, slot row, and mixer track. Subscribe on the prior target, then remove the clip
 *       and track pins. Then move the reader to the empty park target, the master track, which has no launcher
 *       slots. Wait until the reader reports no clip there. A finder cursor goes to the target. At park,
 *       find each group above the target and expand it if it is collapsed (8h4a3, E241).</li>
 *   <li>In a later task, claim the E99 selection lease, select the target row, and point the reader at the
 *       target track in the same task.</li>
 *   <li>Close at the later of the first replay batch task and the target {@code clipExists} task. The close task
 *       copies the notes, pins the reader, restores all three entry selection values under the lease, and
 *       retains the subscription for confirmation. A lost lease refuses the restore.</li>
 *   <li>One confirmation task later, refuse a step callback after the close, a second replay batch, a duplicate
 *       cell, a different bound target, or a clip wider than the reader. Then unsubscribe. One release task
 *       later, report its callbacks separately and return the first page. Non-empty release callbacks refuse.</li>
 *   <li>After the release, and also after a refusal: when the host reports the restored slot selection, collapse
 *       each group that the read expanded. When the host reports the collapse, select the entry mixer track
 *       again (E241). Then reply.</li>
 * </ol>
 *
 * <p>A read that does not finish within its deadline refuses and releases. A step callback after the
 * release remains visible in the next read and {@code rig.stats}, with its state counters. The prior clip
 * replays when the open task subscribes. These callbacks go to no capture; the reply reports them as
 * {@code unpinCallbacks}.
 */
public final class ClipReader {
    /**
     * 8h4a: v2 adds the {@code metadata} block to the reply ({@link ClipMetadata}). 8h4a5: v3 adds the
     * {@code launch} block ({@link ClipLaunch}).
     */
    public static final String REVISION = "clip-reader-v3";
    public static final String CLOSE_RULE = "confirm-before-release-v1";
    /** 8h3c2 build marker: the open task subscribes before it removes the pins (E232). */
    public static final String OPEN_RULE = "subscribe-before-unpin-v1";
    /** 8h4a3 build marker: the read expands each collapsed parent group and collapses it again (E240, D34). */
    public static final String GROUP_RULE = "expand-collapsed-parent-v1";
    public static final int WIDTH = 4_194_304;
    public static final double GRID = 1.0 / 512;
    public static final double WIDTH_BEATS = WIDTH * GRID;
    public static final int PAGE = 131_072;
    public static final int DEADLINE_MS = 2_000;
    private static final int KEYS = 128;

    /** Receives the result of one read: a frame, or a refusal with {@code refused}. Called once. */
    public interface Done { void finish(JsonObject result); }

    private final class Read {
        final long id;
        final int trackIndex, row;
        final String channelId, token, diagnosticFault, route;
        final Track target;
        /** The person's selection at the open (8h4a: from the current project only, E233). */
        final SelectionEntry entry;
        final long started;
        final Done done;
        long parkedNanos, boundNanos, closedNanos, releasedNanos;
        int parkPolls;
        long openStray, parkStray;
        ClipReadCapture capture;
        boolean finished, faultInjected;
        JsonObject selection, bound, metadata, launch;
        /** The collapsed parent groups above the target (D34). */
        final ParentGroups.Expansion parents;

        Read(long id, int trackIndex, int row, String channelId, Track target, String diagnosticFault, String route,
             Done done) {
            this.id = id; this.trackIndex = trackIndex; this.row = row; this.channelId = channelId;
            this.target = target; this.done = done; this.diagnosticFault = diagnosticFault; this.route = route;
            token = "clip-reader-" + id;
            parents = groups.expansion(channelId);
            entry = SelectionEntry.capture(rig);
            started = System.nanoTime();
        }

        double ms(long nanos) { return nanos == 0 ? -1 : (nanos - started) / 1e6; }

        /** The host steps of this read, in {@link ClipReadRoute} order. */
        final ClipReadRoute.Steps steps = new ClipReadRoute.Steps() {
            public boolean subscribed() { return subscribed; }
            public void subscribe() { clip.subscribe(); subscribed = true; }
            public void unpinClip() { clip.isPinned().set(false); }
            public void unpinTrack() { track.isPinned().set(false); }
            public boolean atPark() { return ClipReader.this.atPark(); }
            public void park() { track.selectChannel(park); }
            public void claimLease() { rig.claimSelectionOwnership(token, trackIndex, row); }
            public void selectRow() { target.selectSlot(row); }
            public void pointTarget() { track.selectChannel(target); }
            public void findParent() { parents.find(target); }
            public void expandParents() { parents.start(); }
            public void collapseParents() { parents.collapse(); }
        };
    }

    private final ControllerHost host;
    private final Rig rig;
    private final CursorTrack track;
    private final PinnableCursorClip clip;
    private final MasterTrack park;
    /** The parent finders (E240, E241). The 8h4a5 cursor point route uses the same instance. */
    final ParentGroups groups;
    private final ClipReadCapture.Fields fields = new ClipReadCapture.Fields();
    /** The capture that receives step callbacks. It stays on the last read to count late callbacks. */
    private ClipReadCapture current;
    private long currentConfirmed;
    private ClipReadCapture last;
    private Read read;
    private boolean subscribed = true;
    private long reads, refusals, lateCallbacks, strayCallbacks;
    private long releaseCallbacks, releaseEmpty, releaseSustain, releaseOn;
    private String lastRefusal = "";

    public ClipReader(ControllerHost host, Rig rig, int scenes) {
        this.host = host; this.rig = rig;
        track = host.createCursorTrack("GN_CLIP_READER", "ghostnote clip reader", 0, scenes, false);
        clip = track.createLauncherCursorClip(WIDTH, KEYS);
        clip.setStepSize(GRID);
        park = host.createMasterTrack(0);
        park.channelId().markInterested();
        track.channelId().markInterested();
        track.isPinned().markInterested();
        clip.isPinned().markInterested();
        clip.clipLauncherSlot().sceneIndex().markInterested();
        ClipMetadata.markInterested(clip);
        ClipLaunch.markInterested(clip);
        clip.addNoteStepObserver(this::onStep);
        clip.exists().addValueObserver(value -> { if (current != null) current.exists(value); });
        groups = new ParentGroups(host, park);
        // Hold no clip between reads. The first read parks before it subscribes again.
        host.scheduleTask(() -> {
            if (read == null && subscribed) { clip.unsubscribe(); subscribed = false; }
        }, 0);
    }

    private void onStep(NoteStep step) {
        ClipReadCapture target = current;
        if (target == null) { strayCallbacks++; return; }
        NoteStep.State value = step.state();
        int state = value == NoteStep.State.Empty ? ClipReadCapture.STATE_EMPTY
            : value == NoteStep.State.NoteSustain ? ClipReadCapture.STATE_SUSTAIN : ClipReadCapture.STATE_ON;
        if (state == ClipReadCapture.STATE_ON && !target.isClosed()) {
            double[] d = fields.doubles;
            d[0] = step.velocity(); d[1] = step.releaseVelocity(); d[2] = step.velocitySpread(); d[3] = step.duration();
            d[4] = step.gain(); d[5] = step.pan(); d[6] = step.pressure(); d[7] = step.timbre(); d[8] = step.transpose();
            d[9] = step.chance(); d[10] = step.repeatCurve(); d[11] = step.repeatVelocityCurve();
            d[12] = step.repeatVelocityEnd();
            int[] n = fields.ints;
            n[0] = step.occurrence().ordinal(); n[1] = step.recurrenceLength(); n[2] = step.recurrenceMask();
            n[3] = step.repeatCount();
            boolean[] f = fields.flags;
            f[0] = step.isChanceEnabled(); f[1] = step.isMuted(); f[2] = step.isOccurrenceEnabled();
            f[3] = step.isRecurrenceEnabled(); f[4] = step.isRepeatEnabled();
        }
        target.step(step.x(), step.y(), step.channel(), state, fields);
        Read active = read;
        if (state == ClipReadCapture.STATE_ON && active != null && !active.finished && !active.faultInjected
                && active.capture == target && active.diagnosticFault.equals("duplicate-cell")) {
            active.faultInjected = true;
            target.step(step.x(), step.y(), step.channel(), state, fields);
        }
    }

    private void schedule(Runnable task) { host.scheduleTask(task, 0); }

    /** Only the research profile admits a research route. */
    static void validateDiagnosticRoute(RuntimeProfile profile, String route) {
        if (route.isEmpty()) return;
        if (!profile.hasProbeResources()) throw new IllegalArgumentException("diagnosticRoute requires the probe profile");
        if (!ClipReadRoute.DIAGNOSTIC_ROUTES.contains(route)) throw new IllegalArgumentException("unknown diagnosticRoute: " + route);
    }

    /** Only the research profile admits a synthetic capture fault. No host note is changed. */
    static void validateDiagnosticFault(RuntimeProfile profile, String fault) {
        if (fault.isEmpty()) return;
        if (!profile.hasProbeResources()) throw new IllegalArgumentException("diagnosticFault requires the probe profile");
        if (!fault.equals("duplicate-cell") && !fault.equals("step-delta")) {
            throw new IllegalArgumentException("unknown diagnosticFault: " + fault);
        }
    }

    /**
     * Open one read. The caller holds the write gate; {@code done} runs once, in a later task. A request that
     * fails its preconditions throws before any host change.
     */
    public void open(int trackIndex, int row, String channelId, int deadlineMs, String diagnosticFault,
                     String diagnosticRoute, Done done) {
        validateDiagnosticFault(rig.profile, diagnosticFault);
        validateDiagnosticRoute(rig.profile, diagnosticRoute);
        if (read != null) throw new IllegalStateException("a clip read is already open");
        if (trackIndex < 0 || trackIndex >= rig.config.tracks) {
            throw new IllegalArgumentException("trackIndex out of bank range: " + trackIndex);
        }
        if (row < 0 || row >= rig.config.scenes) throw new IllegalArgumentException("row out of scene range: " + row);
        if (deadlineMs < 1 || deadlineMs > DEADLINE_MS) {
            throw new IllegalArgumentException("deadlineMs must be from 1 through " + DEADLINE_MS);
        }
        Track target = rig.trackBank.getItemAt(trackIndex);
        if (!target.exists().get()) throw new IllegalArgumentException("no track at index: " + trackIndex);
        if (!channelId.equals(target.channelId().get())) {
            throw new IllegalArgumentException("track " + trackIndex + " is no longer " + channelId);
        }
        // E2: never point at an empty slot.
        if (!target.clipLauncherSlotBank().getItemAt(row).hasContent().get()) {
            throw new IllegalArgumentException("slot " + trackIndex + ":" + row + " holds no clip");
        }
        if (park.channelId().get().isEmpty()) throw new IllegalStateException("the park target is not available");
        Read r = new Read(++reads, trackIndex, row, channelId, target, diagnosticFault, diagnosticRoute, done);
        read = r;
        if (current != null) {
            lateCallbacks += current.afterClose - currentConfirmed;
            releaseCallbacks += current.afterRelease;
            releaseEmpty += current.releaseEmpty;
            releaseSustain += current.releaseSustain;
            releaseOn += current.releaseOn;
        }
        current = null;
        host.scheduleTask(() -> deadline(r), deadlineMs);
        r.openStray = strayCallbacks;
        ClipReadRoute.open(r.steps, r.route);
        schedule(() -> awaitPark(r));
    }

    private boolean atPark() {
        String parkId = park.channelId().get();
        return !parkId.isEmpty() && parkId.equals(track.channelId().get()) && !clip.exists().get();
    }

    /** The finder is on the target and its parent handle exists. The {@code no-expand} route does not wait. */
    private boolean parentReady(Read r) {
        return !ClipReadRoute.expands(r.route) || r.parents.ready();
    }

    private void awaitPark(Read r) {
        if (r.finished) return;
        if (!atPark() || !parentReady(r)) {
            r.parkPolls++;
            host.scheduleTask(() -> awaitPark(r), r.parkPolls < 4 ? 0 : 5);
            return;
        }
        r.parkedNanos = System.nanoTime();
        r.parkStray = strayCallbacks;
        ClipReadRoute.parked(r.steps, r.route);
        schedule(() -> awaitExpanded(r));
    }

    /** Climb the parent levels, one task or more for each. Bind after the host reports each expansion. */
    private void awaitExpanded(Read r) {
        if (r.finished) return;
        r.parents.advance(() -> awaitExpanded(r), () -> bind(r));
    }

    private void bind(Read r) {
        if (r.finished) return;
        if (strayCallbacks != r.parkStray) { refuse(r, "park-not-empty", "the park target delivered note steps"); return; }
        r.capture = new ClipReadCapture(r.id, this::schedule, () -> close(r));
        current = r.capture;
        currentConfirmed = 0;
        ClipReadRoute.bind(r.steps);
        r.boundNanos = System.nanoTime();
    }

    /** The D30 close task. The capture holds its copy before this runs. */
    private void close(Read r) {
        if (r.finished) return;
        r.closedNanos = System.nanoTime();
        track.isPinned().set(true);
        clip.isPinned().set(true);
        JsonObject bound = new JsonObject();
        bound.addProperty("channelId", track.channelId().get());
        bound.addProperty("row", clip.clipLauncherSlot().sceneIndex().get());
        double loopStart = clip.getLoopStart().get(), loopLength = clip.getLoopLength().get();
        bound.addProperty("loopStartBeats", loopStart);
        bound.addProperty("loopEndBeats", loopStart + loopLength);
        bound.addProperty("playStopBeats", clip.getPlayStop().get());
        r.bound = bound;
        // 8h4a: the same block as `cursor.clipMetadata`, from this cursor in the close task. No second point.
        r.metadata = ClipMetadata.read(clip);
        // 8h4a5: the same values as `cursor.launchSettings`, outside the metadata block (D32 fingerprint).
        r.launch = ClipLaunch.read(clip);
        // E241: restore while the target group is expanded. The collapse waits until the host reports the restored
        // slot selection (afterRelease): a slot selection inside a collapsed group does not take.
        r.selection = r.entry.restore(rig, r.token, r.trackIndex, r.row);
        if (r.diagnosticFault.equals("step-delta")) {
            schedule(() -> r.capture.step(0, 0, 0, ClipReadCapture.STATE_EMPTY, fields));
        }
        schedule(() -> confirm(r));
    }

    private void release() {
        if (subscribed) { clip.unsubscribe(); subscribed = false; }
    }

    private void confirm(Read r) {
        if (r.finished) return;
        ClipReadCapture c = r.capture;
        currentConfirmed = c.afterClose;
        double extent = Math.max(r.bound.get("loopEndBeats").getAsDouble(), r.bound.get("playStopBeats").getAsDouble());
        if (c.afterClose > 0) {
            refuse(r, "step-delta", c.afterClose + " note-step callback(s) arrived after the close");
        } else if (c.batches > 1) {
            refuse(r, "replay-batches", "the replay arrived in " + c.batches + " delivery batches");
        } else if (c.duplicates > 0) {
            refuse(r, "duplicate-cell", c.duplicates + " note cell(s) were delivered more than once");
        } else if (!r.channelId.equals(r.bound.get("channelId").getAsString())) {
            refuse(r, "bound-target-mismatch", "the reader bound track " + r.bound.get("channelId").getAsString());
        } else if (r.bound.get("row").getAsInt() != r.row) {
            refuse(r, "bound-target-mismatch", "the reader bound row " + r.bound.get("row").getAsInt());
        } else if (extent > WIDTH_BEATS) {
            refuse(r, "clip-beyond-reader-width",
                "the clip extends to beat " + extent + "; the reader covers " + WIDTH_BEATS + " beats");
        } else {
            long encodeStart = System.nanoTime();
            JsonObject frame = NoteFrame.encode(c.notes(), 0, PAGE);
            JsonObject result = report(r);
            result.addProperty("encodeMs", (System.nanoTime() - encodeStart) / 1e6);
            result.add("frame", frame);
            last = c;
            releaseAndFinish(r, result);
        }
    }

    private void deadline(Read r) {
        if (r.finished) return;
        refuse(r, "deadline", "the read did not close within its deadline");
    }

    private void refuse(Read r, String reason, String message) {
        if (r.capture != null && r.selection == null) {
            track.isPinned().set(true);
            clip.isPinned().set(true);
            r.selection = r.entry.restore(rig, r.token, r.trackIndex, r.row);
        }
        if (r.selection == null) {
            JsonObject selection = new JsonObject();
            selection.addProperty("restored", false);
            selection.addProperty("reason", "refused-before-bind");
            r.selection = selection;
        }
        if (r.capture != null) {
            if (r.capture.isClosed()) currentConfirmed = r.capture.afterClose;
            else current = null;
        }
        refusals++;
        lastRefusal = reason;
        JsonObject result = report(r);
        result.addProperty("refused", reason);
        result.addProperty("message", message);
        releaseAndFinish(r, result);
    }

    /** Confirm before release. Keep the write gate closed through the release task. */
    private void releaseAndFinish(Read r, JsonObject result) {
        r.finished = true;
        if (r.capture != null && r.capture.isClosed()) r.capture.release();
        r.releasedNanos = System.nanoTime();
        release();
        schedule(() -> {
            if (r.capture != null && r.capture.releaseOn + r.capture.releaseSustain > 0 && !result.has("refused")) {
                refusals++;
                lastRefusal = "step-delta";
                result.addProperty("refused", lastRefusal);
                result.addProperty("message", "non-empty note-step callbacks arrived after release");
                result.remove("frame");
            }
            result.addProperty("releaseMs", r.ms(r.releasedNanos));
            result.addProperty("totalMs", r.ms(System.nanoTime()));
            if (r.capture != null) addReleaseReport(result, r.capture);
            r.entry.close(host, rig, r.selection, r.parents, result, new SelectionEntry.Close() {
                public void collapse() { ClipReadRoute.closed(r.steps, r.route); }
                public boolean reselects() { return ClipReadRoute.reselects(r.route); }
                public void finish(JsonObject done) { ClipReader.this.finish(r, done); }
            });
        });
    }

    private void addReleaseReport(JsonObject result, ClipReadCapture capture) {
        result.addProperty("releaseCallbacks", capture.afterRelease);
        result.addProperty("releaseEmpty", capture.releaseEmpty);
        result.addProperty("releaseSustain", capture.releaseSustain);
        result.addProperty("releaseOn", capture.releaseOn);
        JsonArray samples = new JsonArray();
        for (int[] sample : capture.releaseSamples) {
            JsonArray row = new JsonArray();
            for (int value : sample) row.add(value);
            samples.add(row);
        }
        result.add("releaseSamples", samples);
    }

    private void finish(Read r, JsonObject result) {
        r.finished = true;
        read = null;
        if (result.has("refused")) last = null;
        r.done.finish(result);
    }

    private JsonObject report(Read r) {
        JsonObject result = new JsonObject();
        result.addProperty("revision", REVISION);
        result.addProperty("closeRule", CLOSE_RULE);
        result.addProperty("openRule", OPEN_RULE);
        result.addProperty("groupRule", GROUP_RULE);
        result.addProperty("readId", r.id);
        if (!r.diagnosticFault.isEmpty()) result.addProperty("diagnosticFault", r.diagnosticFault);
        if (!r.route.isEmpty()) result.addProperty("diagnosticRoute", r.route);
        result.addProperty("priorReleaseCallbacks", releaseCallbacks);
        result.addProperty("priorReleaseEmpty", releaseEmpty);
        result.addProperty("priorReleaseSustain", releaseSustain);
        result.addProperty("priorReleaseOn", releaseOn);
        result.addProperty("trackIndex", r.trackIndex);
        result.addProperty("row", r.row);
        result.addProperty("channelId", r.channelId);
        result.addProperty("parkMs", r.ms(r.parkedNanos));
        result.addProperty("bindMs", r.ms(r.boundNanos));
        result.addProperty("closeMs", r.ms(r.closedNanos));
        result.addProperty("totalMs", r.ms(System.nanoTime()));
        result.addProperty("parkPolls", r.parkPolls);
        result.addProperty("unpinCallbacks", r.parkedNanos == 0 ? strayCallbacks - r.openStray : r.parkStray - r.openStray);
        if (r.capture != null) {
            result.addProperty("callbacks", r.capture.callbacks);
            result.addProperty("onsets", r.capture.onsets);
            result.addProperty("batches", r.capture.batches);
            result.addProperty("duplicates", r.capture.duplicates);
            result.addProperty("afterClose", r.capture.afterClose);
        }
        if (r.bound != null) result.add("bound", r.bound);
        if (r.metadata != null) result.add("metadata", r.metadata);
        if (r.launch != null) result.add("launch", r.launch);
        r.parents.report(result);
        result.add("selection", r.selection);
        result.addProperty("lateCallbacks", lateCallbacks);
        return result;
    }

    /** One later page of the last successful read. */
    public JsonObject page(long readId, int from) {
        if (last == null || last.id != readId) throw new IllegalArgumentException("read " + readId + " is not current");
        JsonObject result = NoteFrame.encode(last.notes(), from, PAGE);
        result.addProperty("readId", readId);
        return result;
    }

    /** Configuration and counters for {@code rig.info} and {@code rig.stats}. */
    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("revision", REVISION);
        result.addProperty("closeRule", CLOSE_RULE);
        result.addProperty("openRule", OPEN_RULE);
        result.addProperty("groupRule", GROUP_RULE);
        result.addProperty("format", NoteFrame.FORMAT);
        result.addProperty("width", WIDTH);
        result.addProperty("grid", GRID);
        result.addProperty("page", PAGE);
        result.addProperty("deadlineMs", DEADLINE_MS);
        result.addProperty("reads", reads);
        result.addProperty("refusals", refusals);
        result.addProperty("lastRefusal", lastRefusal);
        long pendingLate = current == null || read != null ? 0 : current.afterClose - currentConfirmed;
        result.addProperty("lateCallbacks", lateCallbacks + pendingLate);
        result.addProperty("strayCallbacks", strayCallbacks);
        result.addProperty("releaseCallbacks", releaseCallbacks + (current == null ? 0 : current.afterRelease));
        result.addProperty("releaseEmpty", releaseEmpty + (current == null ? 0 : current.releaseEmpty));
        result.addProperty("releaseSustain", releaseSustain + (current == null ? 0 : current.releaseSustain));
        result.addProperty("releaseOn", releaseOn + (current == null ? 0 : current.releaseOn));
        result.addProperty("subscribed", subscribed);
        result.addProperty("open", read != null);
        return result;
    }
}

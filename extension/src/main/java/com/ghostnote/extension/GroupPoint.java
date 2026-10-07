package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonObject;

/**
 * The cursor point route for a track inside collapsed groups (8h4a5, E243). {@code cursor.pointExpanded} points
 * one pool cursor at one launcher clip and pins it.
 *
 * <p>A slot selection on a child of a collapsed group does not take, so a pool cursor stays on row 0 (E240,
 * E242). A pinned cursor keeps its row when the group collapses (E243 P1). Thus the route opens the groups only
 * for the point, in the D34 order of the clip reader:
 * <ol>
 *   <li>Remove the clip and track pins of the cursor. Point the parent finder at the target.</li>
 *   <li>Expand each collapsed group above the target, up to {@link ParentGroups#DEPTH} levels
 *       ({@link ParentGroups}).</li>
 *   <li>When the host reports each expansion: claim the selection lease, select the target row, and point the
 *       cursor track at the target, in one task (E228).</li>
 *   <li>When the cursor reports the target track by its channel ID and the target row: pin the track and the
 *       clip. When both pins and the target are reported: restore the person's selection while the group is
 *       expanded.</li>
 *   <li>Then, as the reader does ({@link SelectionEntry#close}): collapse after the host reports the restored slot,
 *       and select the entry mixer track again after the host reports the collapse. Then reply.</li>
 * </ol>
 *
 * <p>The request runs in the write gate as a clip read: it opens only when no clip read is open, and writes wait
 * until it replies. A target that does not confirm within the polls, or within {@link #DEADLINE_MS}, refuses; the
 * groups collapse and the selection restores also then. The brain then reports {@code collapsed-group-row}.
 */
public final class GroupPoint {
    /** 8h4a5 build marker, in {@code rig.info} and in each reply. */
    public static final String RULE = "expand-collapsed-point-v1";
    public static final int DEADLINE_MS = 2_000;
    /** Polls of 5 ms for the cursor to report the target track and row. */
    static final int TARGET_POLLS = 100;
    /** Polls of 5 ms for the cursor to report both pins. */
    static final int PIN_POLLS = 40;

    /** Receives the reply of one point: the confirmed status, or a refusal with {@code refused}. Called once. */
    public interface Done { void finish(JsonObject result); }

    /** The host steps of one point, in route order. Tests record their order. */
    interface Steps {
        void unpinClip();
        void unpinTrack();
        void findParent();
        void claimLease();
        void selectRow();
        void pointTarget();
        void pinTrack();
        void pinClip();
    }

    /** The open task: remove both pins, then find the parents. */
    static void open(Steps s) {
        s.unpinClip();
        s.unpinTrack();
        s.findParent();
    }

    /** The bind task (E228): claim the lease, select the row, then point in the same task. */
    static void bind(Steps s) {
        s.claimLease();
        s.selectRow();
        s.pointTarget();
    }

    /** After the target confirms: pin the track, then the clip. */
    static void pin(Steps s) {
        s.pinTrack();
        s.pinClip();
    }

    private final class Point implements Steps {
        final long id;
        final String cursor, channelId, token;
        final int trackIndex, row;
        final Track target;
        final CursorTrack track;
        final PinnableCursorClip clip;
        final SelectionEntry entry;
        final ParentGroups.Expansion parents;
        final long started;
        final Done done;
        int finderPolls, targetPolls, pinPolls;
        long boundNanos, confirmedNanos, pinnedNanos;
        boolean closing;
        JsonObject selection;

        Point(long id, String cursor, int trackIndex, int row, String channelId, Track target, CursorTrack track,
              PinnableCursorClip clip, Done done) {
            this.id = id; this.cursor = cursor; this.trackIndex = trackIndex; this.row = row;
            this.channelId = channelId; this.target = target; this.track = track; this.clip = clip; this.done = done;
            token = "group-point-" + id;
            entry = SelectionEntry.capture(rig);
            parents = groups.expansion(channelId);
            started = System.nanoTime();
        }

        public void unpinClip() { clip.isPinned().set(false); }
        public void unpinTrack() { track.isPinned().set(false); }
        public void findParent() { parents.find(target); }
        public void claimLease() { rig.claimSelectionOwnership(token, trackIndex, row); }
        public void selectRow() { target.selectSlot(row); }
        public void pointTarget() { track.selectChannel(target); }
        public void pinTrack() { track.isPinned().set(true); }
        public void pinClip() { clip.isPinned().set(true); }

        boolean onTarget() {
            return channelId.equals(clip.getTrack().channelId().get())
                && clip.clipLauncherSlot().sceneIndex().get() == row;
        }

        double ms(long nanos) { return nanos == 0 ? -1 : (nanos - started) / 1e6; }
    }

    private final ControllerHost host;
    private final Rig rig;
    private final ParentGroups groups;
    private Point point;
    private long points, refusals;
    private String lastRefusal = "";

    public GroupPoint(ControllerHost host, Rig rig, ParentGroups groups) {
        this.host = host; this.rig = rig; this.groups = groups;
    }

    /**
     * Open one point. The caller holds the write gate; {@code done} runs once, in a later task. A request that
     * fails its preconditions throws before any host change.
     */
    public void open(String cursor, int trackIndex, int row, String channelId, Done done) {
        if (point != null) throw new IllegalStateException("a group point is already open");
        if (trackIndex < 0 || trackIndex >= rig.config.tracks) {
            throw new IllegalArgumentException("trackIndex out of bank range: " + trackIndex);
        }
        if (row < 0 || row >= rig.config.scenes) throw new IllegalArgumentException("row out of scene range: " + row);
        Track target = rig.trackBank.getItemAt(trackIndex);
        if (!target.exists().get()) throw new IllegalArgumentException("no track at index: " + trackIndex);
        if (!channelId.equals(target.channelId().get())) {
            throw new IllegalArgumentException("track " + trackIndex + " is no longer " + channelId);
        }
        // E2: never point at an empty slot.
        if (!target.clipLauncherSlotBank().getItemAt(row).hasContent().get()) {
            throw new IllegalArgumentException("slot " + trackIndex + ":" + row + " holds no clip");
        }
        Clip clip = rig.clip(cursor);
        if (!(clip instanceof PinnableCursorClip pinnable)) {
            throw new IllegalArgumentException("cursor is not pinnable: " + cursor);
        }
        Point p = new Point(++points, cursor, trackIndex, row, channelId, target, rig.cursorTrack(cursor), pinnable,
            done);
        point = p;
        host.scheduleTask(() -> deadline(p), DEADLINE_MS);
        open(p);
        schedule(() -> awaitFinder(p));
    }

    private void schedule(Runnable task) { host.scheduleTask(task, 0); }

    private void awaitFinder(Point p) {
        if (p.closing) return;
        if (!p.parents.ready()) {
            p.finderPolls++;
            host.scheduleTask(() -> awaitFinder(p), p.finderPolls < 4 ? 0 : 5);
            return;
        }
        p.parents.start();
        schedule(() -> awaitExpanded(p));
    }

    private void awaitExpanded(Point p) {
        if (p.closing) return;
        p.parents.advance(() -> awaitExpanded(p), () -> {
            bind(p);
            p.boundNanos = System.nanoTime();
            schedule(() -> awaitTarget(p));
        });
    }

    private void awaitTarget(Point p) {
        if (p.closing) return;
        if (!p.onTarget()) {
            if (++p.targetPolls <= TARGET_POLLS) { host.scheduleTask(() -> awaitTarget(p), 5); return; }
            refuse(p, "target-not-confirmed", "the cursor did not report track " + p.channelId + ", row " + p.row);
            return;
        }
        p.confirmedNanos = System.nanoTime();
        pin(p);
        schedule(() -> awaitPins(p));
    }

    private void awaitPins(Point p) {
        if (p.closing) return;
        boolean pinned = p.clip.isPinned().get() && p.track.isPinned().get();
        if (!pinned || !p.onTarget()) {
            if (++p.pinPolls <= PIN_POLLS) { host.scheduleTask(() -> awaitPins(p), 5); return; }
            refuse(p, "pin-not-confirmed", "the cursor did not report both pins on the target");
            return;
        }
        p.pinnedNanos = System.nanoTime();
        close(p, null, null);
    }

    private void deadline(Point p) {
        if (p.closing) return;
        refuse(p, "deadline", "the point did not confirm within its deadline");
    }

    private void refuse(Point p, String reason, String message) {
        refusals++;
        lastRefusal = reason;
        close(p, reason, message);
    }

    /** Restore the selection while the groups are expanded, then collapse and reply (D34 order). */
    private void close(Point p, String refused, String message) {
        p.closing = true;
        if (p.boundNanos != 0) {
            p.selection = p.entry.restore(rig, p.token, p.trackIndex, p.row);
        } else {
            JsonObject selection = new JsonObject();
            selection.addProperty("restored", false);
            selection.addProperty("reason", "refused-before-bind");
            p.selection = selection;
        }
        JsonObject result = report(p);
        if (refused != null) {
            result.addProperty("refused", refused);
            result.addProperty("message", message);
        }
        p.entry.close(host, rig, p.selection, p.parents, result, new SelectionEntry.Close() {
            public void collapse() { p.parents.collapse(); }
            public boolean reselects() { return true; }
            public void finish(JsonObject done) {
                done.add("status", status(p));
                done.addProperty("totalMs", p.ms(System.nanoTime()));
                point = null;
                p.done.finish(done);
            }
        });
    }

    private JsonObject status(Point p) {
        JsonObject s = new JsonObject();
        s.addProperty("trackChannelId", p.clip.getTrack().channelId().get());
        s.addProperty("sceneIndex", p.clip.clipLauncherSlot().sceneIndex().get());
        s.addProperty("isPinned", p.clip.isPinned().get());
        s.addProperty("cursorTrackPinned", p.track.isPinned().get());
        return s;
    }

    private JsonObject report(Point p) {
        JsonObject result = new JsonObject();
        result.addProperty("rule", RULE);
        result.addProperty("pointId", p.id);
        result.addProperty("cursor", p.cursor);
        result.addProperty("trackIndex", p.trackIndex);
        result.addProperty("row", p.row);
        result.addProperty("channelId", p.channelId);
        result.addProperty("finderPolls", p.finderPolls);
        result.addProperty("targetPolls", p.targetPolls);
        result.addProperty("pinPolls", p.pinPolls);
        result.addProperty("bindMs", p.ms(p.boundNanos));
        result.addProperty("confirmMs", p.ms(p.confirmedNanos));
        result.addProperty("pinMs", p.ms(p.pinnedNanos));
        p.parents.report(result);
        result.add("selection", p.selection);
        return result;
    }

    /** Counters for {@code rig.info} and {@code rig.stats}. */
    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("rule", RULE);
        result.addProperty("points", points);
        result.addProperty("refusals", refusals);
        result.addProperty("lastRefusal", lastRefusal);
        result.addProperty("open", point != null);
        return result;
    }
}

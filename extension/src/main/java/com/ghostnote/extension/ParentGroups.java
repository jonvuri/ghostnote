package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.MasterTrack;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * The collapsed parent groups above one target track (8h4a3, D34). The clip reader and the cursor point route
 * (8h4a5) use one instance. The write gate lets only one of them run at a time, so they never share a finder.
 *
 * <p>Cursors that follow no selection find the parents (E240, E241). Finder 0 goes to the target; its parent
 * handle is level 0. Finder i goes to level 0 and then climbs i levels with {@code selectParent}; it stays at
 * level i. The parent handle of a group track repeats the group itself, so it cannot find level 1 (E241).
 */
public final class ParentGroups {
    /** Parent levels above the target that one operation can expand: a group inside a group inside a group. */
    public static final int DEPTH = 3;
    /**
     * Polls for {@code selectParent} to move a finder. A finder that stays is at a top-level group. Every move in
     * E241 landed at the first poll (about 23 ms). A slower move ends the climb early: the operation then refuses.
     */
    static final int ROOT_POLLS = 3;
    /** Polls of 5 ms for the host to report an expansion. Then continue anyway: the target check refuses. */
    static final int EXPAND_POLLS = 40;

    private final ControllerHost host;
    private final MasterTrack master;
    private final CursorTrack[] finders = new CursorTrack[DEPTH];
    private final Track parent0;

    public ParentGroups(ControllerHost host, MasterTrack master) {
        this.host = host;
        this.master = master;
        for (int i = 0; i < DEPTH; i++) {
            finders[i] = host.createCursorTrack("GN_CLIP_READER_PARENT_" + i, "ghostnote clip reader parent " + i,
                0, 0, false);
            finders[i].channelId().markInterested();
            finders[i].exists().markInterested();
            finders[i].isGroup().markInterested();
            finders[i].isGroupExpanded().markInterested();
        }
        parent0 = finders[0].createParentTrack(0, 0);
        parent0.exists().markInterested();
        parent0.channelId().markInterested();
        parent0.isGroup().markInterested();
        parent0.isGroupExpanded().markInterested();
    }

    /** The track handle of parent level {@code i}. */
    private Track level(int i) { return i == 0 ? parent0 : finders[i]; }

    /** One expansion for one target: the levels that it expanded, and its report. */
    public final class Expansion {
        private final String channelId;
        /** The parent groups that this expansion expanded, by level. */
        private final boolean[] expanded = new boolean[DEPTH];
        /** The report of each parent level. {@code parents} also holds the climb moves, in order. */
        private final JsonObject[] levelReports = new JsonObject[DEPTH];
        private JsonArray parents;
        /**
         * The next parent level to read, or -1. {@code below} is the channel ID of the level under it.
         * {@code climbSteps} counts the {@code selectParent} calls that remain for that level.
         */
        private int climbing = -1, climbSteps, climbPolls, expandPolls;
        private String below, level0, climbFrom;
        private long climbStarted;
        private boolean collapsed;

        Expansion(String channelId) { this.channelId = channelId; }

        /** Point finder 0 at the target. */
        public void find(Track target) { finders[0].selectChannel(target); }

        /** The finder is on the target and its parent handle exists. */
        public boolean ready() {
            return channelId.equals(finders[0].channelId().get()) && parent0.exists().get();
        }

        /** Read level 0, and expand it if it is a collapsed group. Call when {@link #ready()}. */
        public void start() {
            parents = new JsonArray();
            below = channelId;
            climbing = climbLevel(0) ? 1 : -1;
        }

        /**
         * One task of the climb and the expansion wait. Calls {@code done} when each level is read and the host
         * reports each expansion (or the poll limit ends the wait). Otherwise it schedules {@code next}, which must
         * call this method again.
         */
        public void advance(Runnable next, Runnable done) {
            if (climbing > 0) {
                climb(next);
                return;
            }
            for (int i = 0; i < DEPTH; i++) {
                if (expanded[i] && !level(i).isGroupExpanded().get() && ++expandPolls <= EXPAND_POLLS) {
                    host.scheduleTask(next, 5);
                    return;
                }
            }
            done.run();
        }

        /** Collapse each group that this expansion expanded, innermost first. Once only. */
        public void collapse() {
            if (collapsed) return;
            collapsed = true;
            for (int i = DEPTH - 1; i >= 0; i--) {
                if (!expanded[i]) continue;
                level(i).isGroupExpanded().set(false);
                levelReports[i].addProperty("collapsed", true);
            }
        }

        /** True when this expansion expanded a group. */
        public boolean any() {
            for (boolean value : expanded) if (value) return true;
            return false;
        }

        /** True when a group that this expansion expanded is still reported expanded. */
        public boolean pending() {
            for (int i = 0; i < DEPTH; i++) {
                if (expanded[i] && level(i).isGroupExpanded().get()) return true;
            }
            return false;
        }

        /** True after {@link #start()}. */
        public boolean started() { return parents != null; }

        /** Add {@code parents} and {@code expandPolls} to a reply. */
        public void report(JsonObject result) {
            if (parents == null) return;
            result.add("parents", parents);
            result.addProperty("expandPolls", expandPolls);
        }

        /**
         * Read parent level {@code i} of the target. Expand it if it is a collapsed group. Then point the next
         * finder at it. Returns true when the next level is to be read. The parent of a top-level track is the
         * project proxy: it reports the master track's channel ID and {@code isGroup} true (E221, E241). It is no
         * group. A handle that repeats the level below it is no parent (E221).
         */
        private boolean climbLevel(int i) {
            Track p = level(i);
            JsonObject level = new JsonObject();
            String id = p.channelId().get();
            level.addProperty("channelId", id);
            level.addProperty("isGroup", p.isGroup().get());
            level.addProperty("wasExpanded", p.isGroupExpanded().get());
            parents.add(level);
            levelReports[i] = level;
            if (!ClipReadRoute.isParentGroup(p.exists().get(), p.isGroup().get(), id, below, master.channelId().get())) {
                return false;
            }
            if (!p.isGroupExpanded().get()) {
                p.isGroupExpanded().set(true);
                expanded[i] = true;
            }
            level.addProperty("expanded", expanded[i]);
            below = id;
            if (i == 0) level0 = id;
            if (i + 1 >= DEPTH) return false;
            finders[i + 1].selectChannel(parent0);
            climbSteps = i + 1;
            climbPolls = 0;
            return true;
        }

        /**
         * One climb task for level {@code climbing}. The finder first reaches level 0, then calls
         * {@code selectParent} once for each step and waits until it moves. A finder that does not move within
         * {@link #ROOT_POLLS} is at a top-level group: the climb ends.
         */
        private void climb(Runnable next) {
            int i = climbing;
            CursorTrack f = finders[i];
            String at = f.channelId().get();
            // Before its first selectParent, the finder must have reached level 0.
            if (i == climbSteps && climbPolls == 0 && !level0.equals(at)) {
                host.scheduleTask(next, 5);
                return;
            }
            if (climbSteps > 0 && climbPolls == 0) {
                climbFrom = at;
                climbStarted = System.nanoTime();
                f.selectParent();
                climbPolls = 1;
                host.scheduleTask(next, 5);
                return;
            }
            if (climbSteps > 0) {
                if (at.equals(climbFrom)) {
                    if (++climbPolls <= ROOT_POLLS) { host.scheduleTask(next, 5); return; }
                    JsonObject top = new JsonObject();
                    top.addProperty("top", climbFrom);
                    top.addProperty("waitMs", (System.nanoTime() - climbStarted) / 1e6);
                    parents.add(top);
                    climbing = -1;
                    host.scheduleTask(next, 0);
                    return;
                }
                // Read the group values of the new level one task after the move.
                JsonObject move = new JsonObject();
                move.addProperty("movePolls", climbPolls);
                move.addProperty("moveMs", (System.nanoTime() - climbStarted) / 1e6);
                parents.add(move);
                climbSteps--;
                climbPolls = 0;
                host.scheduleTask(next, 5);
                return;
            }
            climbing = climbLevel(i) ? i + 1 : -1;
            host.scheduleTask(next, 0);
        }
    }

    /** Start one expansion for the target with this channel ID. */
    public Expansion expansion(String channelId) { return new Expansion(channelId); }
}

package com.ghostnote.extension;

/**
 * The ordered host steps of the clip-reader route (8h3c2, E232; 8h4a3, E240). {@link ClipReader} runs them on the
 * host. Tests record their order.
 *
 * <p>The close pins the clip on its target track. The host keeps that pin for the cursor and track. A pin change
 * that is sent while the clip is unsubscribed has no effect on the host. A pinned clip then binds its earlier row
 * on each later visit to that track. Thus the open task subscribes on the prior target before it removes the pin.
 *
 * <p>The reader track stays pinned (D43, E250). A pinned cursor track still moves when it is pointed. An unpinned one
 * follows the selection, and drives it, in a project that was saved with the ghostnote cursor records.
 */
final class ClipReadRoute {
    private ClipReadRoute() {}

    /** The host actions of one read. */
    interface Steps {
        boolean subscribed();
        void subscribe();
        void unpinClip();
        boolean atPark();
        void park();
        void claimLease();
        void selectRow();
        void pointTarget();
        /** 8h4a3 (E240): point the parent finder at the target. */
        void findParent();
        /** Expand each collapsed group above the target. */
        void expandParents();
        /** Collapse each group that this read expanded. */
        void collapseParents();
    }

    /**
     * Research routes. The empty route is the product route. {@code legacy-open} is the 8h3c open order.
     * {@code no-expand} is the 8h4a2 product route, which does not expand a collapsed parent group.
     * {@code no-reselect} does not select the entry mixer track again after the collapse.
     */
    static final java.util.List<String> DIAGNOSTIC_ROUTES =
        java.util.List.of("", "legacy-open", "no-expand", "no-reselect");

    static boolean expands(String route) { return !route.equals("no-expand"); }

    static boolean reselects(String route) { return !route.equals("no-reselect"); }

    /**
     * The open task. Subscribe on the prior target, then remove the clip pin, then go to park. The prior clip
     * replays to no capture; the park check starts after it.
     */
    static void open(Steps s, String route) {
        if (expands(route)) s.findParent();
        if (!route.equals("legacy-open") && !s.subscribed()) s.subscribe();
        s.unpinClip();
        if (!s.atPark()) s.park();
    }

    /**
     * The park task, after the reader reports no clip at park and the finder reports the target. Expand each
     * collapsed parent group: the reader binds only row 0 of a track inside a collapsed group (E221, E240).
     */
    static void parked(Steps s, String route) {
        if (!s.subscribed()) s.subscribe();
        if (expands(route)) s.expandParents();
    }

    /** The bind task (E228): claim the E99 lease, select the target row at park, then point in the same task. */
    static void bind(Steps s) {
        s.claimLease();
        s.selectRow();
        s.pointTarget();
    }

    /**
     * True when a parent handle names a group above the target. The parent of a top-level track is the project
     * proxy, which reports the master track's channel ID and {@code isGroup} true (E221, E241). A handle that
     * repeats the level below it is no parent (E221).
     */
    static boolean isParentGroup(boolean exists, boolean isGroup, String id, String below, String masterId) {
        return exists && isGroup && !id.isEmpty() && !id.equals(below) && !id.equals(masterId);
    }

    /** After the release, when the host reports the restored slot selection (E241). */
    static void closed(Steps s, String route) {
        if (expands(route)) s.collapseParents();
    }
}

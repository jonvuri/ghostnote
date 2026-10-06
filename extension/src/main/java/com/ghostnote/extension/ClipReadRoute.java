package com.ghostnote.extension;

/**
 * The ordered host steps of the clip-reader route (8h3c2, E232). {@link ClipReader} runs them on the host. Tests
 * record their order.
 *
 * <p>The close pins the clip on its target track. The host keeps that pin for the cursor and track. A pin change
 * that is sent while the clip is unsubscribed has no effect on the host. A pinned clip then binds its earlier row
 * on each later visit to that track. Thus the open task subscribes on the prior target before it removes the pins.
 */
final class ClipReadRoute {
    private ClipReadRoute() {}

    /** The host actions of one read. */
    interface Steps {
        boolean subscribed();
        void subscribe();
        void unpinClip();
        void unpinTrack();
        boolean atPark();
        void park();
        void claimLease();
        void selectRow();
        void pointTarget();
    }

    /** Research routes. The empty route is the product route. {@code legacy-open} is the 8h3c open order. */
    static final java.util.List<String> DIAGNOSTIC_ROUTES = java.util.List.of("", "legacy-open");

    /**
     * The open task. Subscribe on the prior target, then remove both pins, then go to park. The prior clip
     * replays to no capture; the park check starts after it.
     */
    static void open(Steps s, String route) {
        if (route.equals("legacy-open")) {
            s.unpinClip();
            s.unpinTrack();
        } else {
            if (!s.subscribed()) s.subscribe();
            s.unpinClip();
            s.unpinTrack();
        }
        if (!s.atPark()) s.park();
    }

    /** The park task, after the reader reports no clip at park. */
    static void parked(Steps s) {
        if (!s.subscribed()) s.subscribe();
    }

    /** The bind task (E228): claim the E99 lease, select the target row at park, then point in the same task. */
    static void bind(Steps s) {
        s.claimLease();
        s.selectRow();
        s.pointTarget();
    }
}

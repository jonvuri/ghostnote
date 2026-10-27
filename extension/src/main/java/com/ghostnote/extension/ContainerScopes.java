package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.Arrays;

/**
 * B17: the extension owns the container scopes. One aim settles one or more of the {@link Rig#SLOT_SCOPES}
 * scopes at absolute top-level positions on cursor track 0 and reports once, so the brain names a container by
 * its position and never by a scope slot.
 *
 * <p>An aim runs in the write gate as a write and holds a {@link WriteGate#writeLease() write lease} until the
 * operation that asked for it ends: no clip read opens and no other write runs while the scopes are moving. The
 * first pass runs in the request's own task; when every scope is already settled (a resting position, or a
 * position settled by the previous operation), the operation finishes in that task. Otherwise the aim polls
 * every {@link #POLL_MS} with {@code host.scheduleTask} (E2: a handler cannot see its own scroll in the same
 * task; D27 bounds what one task can observe) until the scopes settle or {@link #MAX_POLLS} pass.
 *
 * <p>Settling (B08, E352, E353): a scope is settled at a position when {@link Rig#scopeSettled} holds for the
 * position it was last asked for. A scope that was asked for the position and has not settled is scrolled
 * again every {@link #RESCROLL_POLLS} polls: a bank scrolled while cursor track 0 sat on a track with fewer
 * devices clamps and stays after the track gains devices (E353), and only a repeated scroll repairs it. The
 * track identity is polled too, with the same bound: after the brain points cursor track 0, the scopes and the
 * reference bank follow it at a structural pace (0/6 correct at 0 ms, 6/6 from 100 ms, containers.md §6).
 *
 * <p>Scope choice: a scope already settled at the position; else the scope already asked for it; else, for a
 * position inside the scope count, the scope resting there; else a scope already away from its resting
 * position, highest slot first; else the highest free slot. A scope chosen for one position of the aim is not
 * chosen for another, so a two-container move holds two scopes at once (E18 §3.1).
 *
 * <p>The host reads and writes go through {@link Scopes}, so the policy runs offline against an in-memory
 * model ({@code ContainerScopesTest}); {@link #over(ControllerHost, Rig)} binds it to the rig.
 */
public final class ContainerScopes {
    /** B17 build marker, in {@code rig.info} and in each reply. */
    public static final String RULE = WindowPager.RULE;
    static final int POLL_MS = 5;
    /** Polls between repeated scrolls of an unsettled scope (E353: a clamped bank needs the repeat). */
    static final int RESCROLL_POLLS = 10;
    /** Polls before an aim refuses: 400 polls of 5 ms, about 2 s. */
    static final int MAX_POLLS = 400;
    /** The slot of a position with no device: the reference bank holds fewer devices (an observation). */
    public static final int EMPTY = -1;

    /** The scope state an aim reads and moves. The rig binding reads the host; tests model it. */
    public interface Scopes {
        int scopeCount();
        /** The reference window width (not a bound on read reach). */
        int deviceBank();
        boolean held(int slot);
        int requestedPosition(int slot);
        boolean settled(int slot);
        void scroll(int slot, int position);
        /** The reference bank's device count on cursor track 0. */
        int deviceCount();
        String trackChannelId();
        /** The scope's reported state for a refusal message. */
        String describe(int slot);
        String scopeStatus(int slot);
        WriteGate.Lease writeLease();
        void schedule(Runnable task, int delayMs);
    }

    /** The settled scopes of one aim. {@link #release} ends the operation; it is idempotent. */
    public interface Settled {
        /** The scope slot settled at {@code position}, or {@link #EMPTY} when the position holds no device. */
        int slotOf(int position);
        /** The reference bank's device count at the settle. */
        int deviceCount();
        /** Polls, scrolls, and elapsed time of the aim, for the reply. */
        JsonObject report();
        void release();
    }

    /** Receives the outcome once: the settled scopes, or a refusal with its reason. */
    public interface Outcome {
        void settled(Settled settled);
        void refused(String reason, String detail, JsonObject report);
    }

    private final class Aim implements Settled {
        final int[] positions;
        final int[] slots;
        final int[] sinceScroll;
        final String expectedTrack;
        final Outcome outcome;
        final WriteGate.Lease lease;
        final long started = System.nanoTime();
        int polls, scrolls, deviceCount;
        boolean closed;

        Aim(int[] positions, String expectedTrack, Outcome outcome) {
            this.positions = positions;
            this.slots = new int[positions.length];
            Arrays.fill(slots, UNCHOSEN);
            this.sinceScroll = new int[positions.length];
            this.expectedTrack = expectedTrack;
            this.outcome = outcome;
            this.lease = scopes.writeLease();
        }

        @Override public int slotOf(int position) {
            for (int i = 0; i < positions.length; i++) {
                if (positions[i] == position) return slots[i];
            }
            throw new IllegalArgumentException("position " + position + " was not aimed at");
        }

        @Override public int deviceCount() { return deviceCount; }

        @Override public JsonObject report() {
            JsonObject r = new JsonObject();
            r.addProperty("rule", RULE);
            JsonArray aimed = new JsonArray();
            for (int i = 0; i < positions.length; i++) {
                JsonObject one = new JsonObject();
                one.addProperty("position", positions[i]);
                one.addProperty("slot", slots[i]);
                aimed.add(one);
            }
            r.add("scopes", aimed);
            r.addProperty("polls", polls);
            r.addProperty("scrolls", scrolls);
            r.addProperty("ms", (System.nanoTime() - started) / 1e6);
            return r;
        }

        @Override public void release() {
            if (closed) return;
            closed = true;
            if (current == this) current = null;
            lease.release();
        }
    }

    private static final int UNCHOSEN = -2;

    private final Scopes scopes;
    private Aim current;
    private long aims, refusals;
    private String lastRefusal = "";

    public ContainerScopes(Scopes scopes) {
        this.scopes = scopes;
    }

    /** The rig binding: the B08 scope banks on cursor track 0 and the host task scheduler. */
    public static ContainerScopes over(ControllerHost host, Rig rig) {
        return new ContainerScopes(new Scopes() {
            @Override public int scopeCount() { return Rig.SLOT_SCOPES; }
            @Override public int deviceBank() { return rig.config.deviceBank; }
            @Override public boolean held(int slot) {
                return "held".equals(rig.slotScopeStatus[slot]) && rig.scopeBanks[slot] != null
                    && rig.slotLayerBanks[slot] != null;
            }
            @Override public int requestedPosition(int slot) { return rig.scopeRequestedPosition[slot]; }
            @Override public boolean settled(int slot) { return rig.scopeSettled(slot); }
            @Override public void scroll(int slot, int position) {
                rig.scopeRequestedPosition[slot] = position;
                rig.scopeBanks[slot].scrollPosition().set(position);
            }
            @Override public int deviceCount() { return rig.cursorDeviceBanks[0].itemCount().get(); }
            @Override public String trackChannelId() { return rig.cursorTracks[0].channelId().get(); }
            @Override public String describe(int slot) {
                return "reports " + rig.scopeBanks[slot].scrollPosition().get() + ", slot \""
                    + rig.scopeDevice(slot).name().get() + "\" at device position "
                    + rig.scopeDevice(slot).position().get();
            }
            @Override public String scopeStatus(int slot) { return rig.slotScopeStatus[slot]; }
            @Override public WriteGate.Lease writeLease() { return rig.writeGate.writeLease(); }
            @Override public void schedule(Runnable task, int delayMs) { host.scheduleTask(task, delayMs); }
        });
    }

    /**
     * Settle one scope for each distinct position. A position past the reference bank's device count settles
     * as {@link #EMPTY}. {@code expectedTrack} may be null when the caller does not know the track (probes);
     * the product always names it. The outcome runs once, in this task when everything is already settled,
     * else in a later task. Validation throws before anything is taken or moved.
     */
    public void aim(int[] requested, String expectedTrack, Outcome outcome) {
        if (current != null) throw new IllegalStateException("a container scope operation is already open");
        int[] positions = Arrays.stream(requested).distinct().toArray();
        for (int position : positions) {
            if (position < 0) {
                throw new IllegalArgumentException(
                    "position must be nonnegative: " + position);
            }
        }
        if (built() == 0) {
            StringBuilder statuses = new StringBuilder();
            for (int s = 0; s < scopes.scopeCount(); s++) {
                if (s > 0) statuses.append(", ");
                statuses.append(scopes.scopeStatus(s));
            }
            throw new IllegalStateException("no container scope was built: " + statuses
                + " (standing rule 13 — a missing handle and an API refusal look identical)");
        }
        Aim aim = new Aim(positions, expectedTrack, outcome);
        current = aim;
        aims++;
        poll(aim);
    }

    public boolean open() { return current != null; }

    public JsonObject status() {
        JsonObject r = new JsonObject();
        r.addProperty("rule", RULE);
        r.addProperty("open", current != null);
        r.addProperty("aims", aims);
        r.addProperty("refusals", refusals);
        r.addProperty("lastRefusal", lastRefusal);
        r.addProperty("pollMs", POLL_MS);
        r.addProperty("maxPolls", MAX_POLLS);
        return r;
    }

    private int built() {
        int n = 0;
        for (int s = 0; s < scopes.scopeCount(); s++) if (scopes.held(s)) n++;
        return n;
    }

    private boolean settledAt(int slot, int position) {
        return scopes.requestedPosition(slot) == position && scopes.settled(slot);
    }

    private void poll(Aim a) {
        if (a.closed) return;
        a.polls++;
        if (a.expectedTrack != null) {
            String actual = scopes.trackChannelId();
            if (!a.expectedTrack.equals(actual)) {
                again(a, "track-not-confirmed",
                    "cursor track 0 reports " + actual + ", not " + a.expectedTrack);
                return;
            }
        }
        a.deviceCount = scopes.deviceCount();
        boolean settled = true;
        for (int i = 0; i < a.positions.length; i++) {
            int position = a.positions[i];
            if (position >= a.deviceCount) {
                // An observation, not a scope that failed to settle: the reference bank holds fewer devices.
                a.slots[i] = EMPTY;
                continue;
            }
            if (a.slots[i] == UNCHOSEN || a.slots[i] == EMPTY) {
                int slot = choose(a, i);
                if (slot < 0) {
                    refuse(a, "scopes-unavailable",
                        "every built scope is held by another position of this operation");
                    return;
                }
                a.slots[i] = slot;
            }
            int slot = a.slots[i];
            if (settledAt(slot, position)) continue;
            settled = false;
            if (++a.sinceScroll[i] >= RESCROLL_POLLS) {
                scroll(a, slot, position);
                a.sinceScroll[i] = 0;
            }
        }
        if (settled) {
            a.outcome.settled(a);
            return;
        }
        again(a, "scope-not-settled", unsettledDetail(a));
    }

    private String unsettledDetail(Aim a) {
        StringBuilder detail = new StringBuilder();
        for (int i = 0; i < a.positions.length; i++) {
            int slot = a.slots[i];
            if (slot < 0 || settledAt(slot, a.positions[i])) continue;
            if (detail.length() > 0) detail.append("; ");
            detail.append("scope ").append(slot).append(" asked for ").append(a.positions[i]).append(' ')
                .append(scopes.describe(slot)).append(", reference count ").append(a.deviceCount);
        }
        return detail.toString();
    }

    /** The slot to aim at {@code a.positions[i]}, scrolled unless already settled there; -1 when none is free. */
    private int choose(Aim a, int i) {
        int position = a.positions[i];
        int count = scopes.scopeCount();
        boolean[] excluded = new boolean[count];
        for (int j = 0; j < a.positions.length; j++) {
            if (j != i && a.slots[j] >= 0) excluded[a.slots[j]] = true;
        }
        for (int s = 0; s < count; s++) {
            if (!excluded[s] && scopes.held(s) && settledAt(s, position)) return s;
        }
        // Asked for it already but not settled: scroll it again (E353), never wait for it.
        for (int s = 0; s < count; s++) {
            if (!excluded[s] && scopes.held(s) && scopes.requestedPosition(s) == position) {
                scroll(a, s, position);
                a.sinceScroll[i] = 0;
                return s;
            }
        }
        int chosen = -1;
        if (position < count && !excluded[position] && scopes.held(position)) {
            chosen = position;
        }
        if (chosen < 0) {
            for (int s = count - 1; s >= 0; s--) {
                if (!excluded[s] && scopes.held(s) && scopes.requestedPosition(s) != s) { chosen = s; break; }
            }
        }
        if (chosen < 0) {
            for (int s = count - 1; s >= 0; s--) {
                if (!excluded[s] && scopes.held(s)) { chosen = s; break; }
            }
        }
        if (chosen < 0) return -1;
        scroll(a, chosen, position);
        a.sinceScroll[i] = 0;
        return chosen;
    }

    private void scroll(Aim a, int slot, int position) {
        a.scrolls++;
        scopes.scroll(slot, position);
    }

    private void again(Aim a, String reason, String detail) {
        if (a.polls >= MAX_POLLS) {
            refuse(a, reason, detail);
            return;
        }
        scopes.schedule(() -> poll(a), POLL_MS);
    }

    private void refuse(Aim a, String reason, String detail) {
        refusals++;
        lastRefusal = reason;
        JsonObject report = a.report();
        a.release();
        a.outcome.refused(reason, detail, report);
    }
}

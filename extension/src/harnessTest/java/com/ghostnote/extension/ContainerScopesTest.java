package com.ghostnote.extension;

import com.google.gson.JsonObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * B17: the extension-owned scope policy against an in-memory model of the three one-wide scope banks, and the
 * write lease that keeps a scope operation alone in the write gate. The model behaves as E352 and E353
 * measured: a scroll inside the device count retargets on the next task; a scroll past the count clamps and
 * stays; a hung bank never moves.
 */
public final class ContainerScopesTest {
    private static int passed;
    private static final ArrayDeque<Runnable> tasks = new ArrayDeque<>();

    /** The three scopes over a track of {@code devices}; scope {@code s} rests at {@code s}. */
    static final class Model implements ContainerScopes.Scopes {
        final List<String> devices;
        String track = "track-a";
        final int[] requested = {0, 1, 2};
        final int[] reported = {0, 1, 2};
        final boolean[] held = {true, true, true};
        /** A scroll records the request but the bank never moves. */
        boolean hung;
        /** Scrolls of this slot apply only from the second request (E353: the clamped bank). */
        int clampedSlot = -1;
        int clampedRequests;
        final List<int[]> scrolls = new ArrayList<>();
        final WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);

        Model(String... devices) { this.devices = new ArrayList<>(Arrays.asList(devices)); }

        @Override public int scopeCount() { return 3; }
        @Override public int deviceBank() { return 16; }
        @Override public boolean held(int slot) { return held[slot]; }
        @Override public int requestedPosition(int slot) { return requested[slot]; }
        @Override public boolean settled(int slot) {
            return reported[slot] == requested[slot] && requested[slot] < devices.size();
        }
        @Override public void scroll(int slot, int position) {
            scrolls.add(new int[] {slot, position});
            requested[slot] = position;
            if (hung) return;
            if (slot == clampedSlot && ++clampedRequests == 1) return;
            // The bank moves in a later task (E2), clamped to the item count.
            tasks.add(() -> reported[slot] = Math.min(position, Math.max(devices.size() - 1, 0)));
        }
        @Override public int deviceCount() { return devices.size(); }
        @Override public String trackChannelId() { return track; }
        @Override public String describe(int slot) { return "reports " + reported[slot]; }
        @Override public String scopeStatus(int slot) { return held[slot] ? "held" : "FAILED:test"; }
        @Override public WriteGate.Lease writeLease() { return gate.writeLease(); }
        @Override public void schedule(Runnable task, int delayMs) { tasks.add(task); }

        String scrollLog() {
            StringBuilder b = new StringBuilder();
            for (int[] s : scrolls) b.append(s[0]).append("->").append(s[1]).append(' ');
            return b.toString().trim();
        }
    }

    /** One outcome: the settled slots by position, or the refusal. */
    static final class Result implements ContainerScopes.Outcome {
        ContainerScopes.Settled settled;
        String refused;
        String detail;
        int polls;
        @Override public void settled(ContainerScopes.Settled s) { settled = s; polls = s.report().get("polls").getAsInt(); }
        @Override public void refused(String reason, String d, JsonObject report) {
            refused = reason; detail = d; polls = report.get("polls").getAsInt();
        }
    }

    public static void main(String[] args) {
        run("a resting position settles in the request's own task without a scroll", ContainerScopesTest::resting);
        run("a far position takes the highest resting scope and settles after one scroll", ContainerScopesTest::far);
        run("a position settled by the previous aim is reused; the displaced scope is re-aimed when its rest is asked for",
            ContainerScopesTest::reuse);
        run("a position past the device count is an empty observation, not a scroll", ContainerScopesTest::empty);
        run("a hung scope is scrolled again every RESCROLL_POLLS polls and refuses at the bound",
            ContainerScopesTest::hung);
        run("a scope clamped on an earlier track is re-aimed, not waited for (E353)", ContainerScopesTest::clamped);
        run("two positions hold two scopes at once; three distinct far positions use all three",
            ContainerScopesTest::twoAtOnce);
        run("the track identity is polled before any scope is read", ContainerScopesTest::trackIdentity);
        run("an unbuilt scope is skipped; no built scope refuses before the lease", ContainerScopesTest::unbuilt);
        run("an aim holds a write lease: writes and clip reads wait, plain reads run; release pumps",
            ContainerScopesTest::lease);
        run("validation throws before anything is taken; a second open aim is refused", ContainerScopesTest::validation);
        System.out.println("Container scopes: " + passed + " test groups passed.");
    }

    private static void drain() { while (!tasks.isEmpty()) tasks.poll().run(); }

    private static Result aim(ContainerScopes scopes, Model model, String track, int... positions) {
        Result result = new Result();
        scopes.aim(positions, track, result);
        return result;
    }

    private static void resting() {
        Model m = new Model("FX Layer", "Tool", "Dual Pan");
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 1);
        check(r.settled != null && r.settled.slotOf(1) == 1 && r.polls == 1, "settled at once through scope 1");
        check(m.scrolls.isEmpty() && tasks.isEmpty(), "no scroll, no scheduled poll");
        check(scopes.open() && m.gate.writeLeases() == 1, "the operation holds the lease until released");
        r.settled.release();
        r.settled.release();
        check(!scopes.open() && m.gate.writeLeases() == 0 && m.gate.leases() == 0, "released once");
    }

    private static void far() {
        Model m = new Model("FX Layer", "Tool", "Dual Pan", "Instrument Layer", "Delay+");
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 3);
        check(r.settled == null && m.scrollLog().equals("2->3"), "the highest resting scope is scrolled: " + m.scrollLog());
        drain();
        check(r.settled != null && r.settled.slotOf(3) == 2 && r.settled.deviceCount() == 5, "settled through scope 2");
        check(r.polls == 2 && m.scrolls.size() == 1, "one scroll, settled on the second poll");
        r.settled.release();
        // Lower scopes keep resting.
        check(m.requested[0] == 0 && m.requested[1] == 1, "scopes 0 and 1 rest");
    }

    private static void reuse() {
        Model m = new Model("FX Layer", "Tool", "Dual Pan", "Instrument Layer");
        ContainerScopes scopes = new ContainerScopes(m);
        Result first = aim(scopes, m, "track-a", 3);
        drain();
        first.settled.release();
        Result again = aim(scopes, m, "track-a", 3);
        check(again.settled != null && again.settled.slotOf(3) == 2 && again.polls == 1, "reused without a scroll");
        again.settled.release();
        check(m.scrollLog().equals("2->3"), "one scroll in all: " + m.scrollLog());
        Result rest = aim(scopes, m, "track-a", 2);
        check(rest.settled == null && m.scrollLog().equals("2->3 2->2"), "the displaced scope is re-aimed at its rest");
        drain();
        check(rest.settled != null && rest.settled.slotOf(2) == 2, "settled at 2 again");
        rest.settled.release();
        // A far position prefers a scope already away from rest over the highest slot.
        m.requested[1] = 7; m.reported[1] = 3; // scope 1 displaced (unsettled) from a previous track
        Result prefer = aim(scopes, m, "track-a", 3);
        check(m.scrolls.get(m.scrolls.size() - 1)[0] == 1, "the displaced scope 1 is chosen for a far read: " + m.scrollLog());
        drain();
        check(prefer.settled != null && prefer.settled.slotOf(3) == 1, "settled through scope 1");
        prefer.settled.release();
    }

    private static void empty() {
        Model m = new Model("FX Layer", "Tool");
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 5);
        check(r.settled != null && r.settled.slotOf(5) == ContainerScopes.EMPTY && r.settled.deviceCount() == 2,
            "empty observation");
        check(m.scrolls.isEmpty(), "nothing scrolled");
        r.settled.release();
    }

    private static void hung() {
        Model m = new Model("FX Layer", "Tool", "Dual Pan", "Instrument Layer");
        m.hung = true;
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 3);
        drain();
        check(r.refused != null && r.refused.equals("scope-not-settled") && r.polls == ContainerScopes.MAX_POLLS,
            "refused at the bound: " + r.refused + " after " + r.polls);
        check(r.detail.contains("scope 2 asked for 3"), "the detail names the scope: " + r.detail);
        int expected = 1 + ContainerScopes.MAX_POLLS / ContainerScopes.RESCROLL_POLLS;
        check(m.scrolls.size() == expected, "scrolled again every RESCROLL_POLLS polls: " + m.scrolls.size());
        check(m.scrolls.stream().allMatch(s -> s[0] == 2 && s[1] == 3), "always the same scope, never another");
        check(!scopes.open() && m.gate.writeLeases() == 0, "the refusal released the lease");
    }

    private static void clamped() {
        Model m = new Model("Tool", "Dual Pan", "Ring-Mod", "FX Layer");
        // Left over from another track: scope 2 was asked for 3 but the bank sits at 0.
        m.requested[2] = 3; m.reported[2] = 0;
        m.requested[1] = 1; m.reported[1] = 0;
        m.clampedSlot = 2;
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 3);
        check(m.scrollLog().equals("2->3"), "the scope already asked for 3 is scrolled again at once: " + m.scrollLog());
        drain();
        check(r.settled != null && r.settled.slotOf(3) == 2, "settled after the repeated scroll");
        check(m.scrollLog().equals("2->3 2->3"), "two scrolls of the same scope: " + m.scrollLog());
        r.settled.release();
        Result rest = aim(scopes, m, "track-a", 1);
        drain();
        check(rest.settled != null && rest.settled.slotOf(1) == 1 && m.scrollLog().endsWith("1->1"),
            "a resting scope that clamped is re-aimed at its own position");
        rest.settled.release();
    }

    private static void twoAtOnce() {
        Model m = new Model("FX Layer", "Tool", "Chain", "Tool", "Instrument Layer", "Delay+", "Selector",
            "FX Layer", "FX Layer", "FX Layer", "FX Layer");
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 4, 2);
        drain();
        check(r.settled != null && r.settled.slotOf(4) == 2 && r.settled.slotOf(2) == 1,
            "4 took the highest resting scope, 2 could not take its own held scope and took the next one down");
        check(m.scrollLog().equals("2->4 1->2"), m.scrollLog());
        r.settled.release();
        Result three = aim(scopes, m, "track-a", 5, 6, 3);
        drain();
        check(three.settled != null && three.settled.slotOf(5) != three.settled.slotOf(6)
            && three.settled.slotOf(6) != three.settled.slotOf(3) && three.settled.slotOf(5) != three.settled.slotOf(3),
            "three distinct scopes");
        three.settled.release();
        Result four = new Result();
        scopes.aim(new int[] {7, 8, 9, 10}, "track-a", four);
        drain();
        check(four.refused != null && four.refused.equals("scopes-unavailable"), "a fourth position refuses: " + four.refused);
        check(!scopes.open(), "released");
        // The same position twice is one scope.
        Result same = aim(scopes, m, "track-a", 3, 3);
        drain();
        check(same.settled != null && same.settled.slotOf(3) >= 0, "distinct positions");
        same.settled.release();
    }

    private static void trackIdentity() {
        Model m = new Model("FX Layer", "Tool", "Dual Pan", "Instrument Layer");
        m.track = "previous-track";
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 3);
        check(r.settled == null && m.scrolls.isEmpty(), "no scope is touched while the track is not confirmed");
        // The cursor track reports the target three polls later.
        for (int i = 0; i < 3; i++) tasks.poll().run();
        m.track = "track-a";
        drain();
        check(r.settled != null && r.settled.slotOf(3) == 2 && m.scrollLog().equals("2->3"), "then the aim proceeds");
        r.settled.release();
        Model never = new Model("FX Layer");
        never.track = "elsewhere";
        ContainerScopes stuck = new ContainerScopes(never);
        Result refused = aim(stuck, never, "track-a", 0);
        drain();
        check(refused.refused != null && refused.refused.equals("track-not-confirmed")
            && refused.detail.contains("elsewhere"), "a cursor that never arrives refuses: " + refused.refused);
        // No expected track: the aim trusts the caller (probes).
        Result blind = aim(stuck, never, null, 0);
        check(blind.settled != null && blind.settled.slotOf(0) == 0, "no identity to poll");
        blind.settled.release();
    }

    private static void unbuilt() {
        Model m = new Model("FX Layer", "Tool", "Dual Pan", "Instrument Layer");
        m.held[2] = false;
        ContainerScopes scopes = new ContainerScopes(m);
        Result r = aim(scopes, m, "track-a", 3);
        drain();
        check(r.settled != null && r.settled.slotOf(3) == 1, "the unbuilt scope is skipped: " + m.scrollLog());
        r.settled.release();
        m.held[0] = false; m.held[1] = false;
        boolean threw = false;
        try { aim(scopes, m, "track-a", 0); } catch (IllegalStateException expected) {
            threw = expected.getMessage().contains("no container scope was built");
        }
        check(threw && m.gate.writeLeases() == 0 && !scopes.open(), "refused before the lease");
    }

    private static void lease() {
        Model m = new Model("FX Layer", "Tool", "Dual Pan", "Instrument Layer");
        ContainerScopes scopes = new ContainerScopes(m);
        List<String> log = new ArrayList<>();
        // The aim is itself an admitted write; it then takes the write lease across its polls.
        check(m.gate.submit(WriteGate.Kind.WRITE, q -> {
            Result r = aim(scopes, m, "track-a", 3);
            log.add("aim");
            tasks.add(() -> { if (r.settled != null) { log.add("settled"); r.settled.release(); } });
        }), "the aim is admitted");
        check(m.gate.writeLeases() == 1, "the lease is held after the first pass");
        check(m.gate.submit(WriteGate.Kind.WRITE, q -> log.add("write")), "a later write is queued");
        check(m.gate.submit(WriteGate.Kind.READ, q -> log.add("read")), "a read runs");
        check(m.gate.submit(WriteGate.Kind.CLIP_READ, q -> log.add("clip-read")), "a clip read is queued");
        check(log.equals(List.of("aim", "read")) && m.gate.waiting() == 2, "writes wait behind the lease: " + log);
        drain();
        check(log.equals(List.of("aim", "read", "settled", "write", "clip-read")) && m.gate.writeLeases() == 0,
            "the release pumps the queue in order: " + log);
        m.gate.readClosed();
    }

    private static void validation() {
        Model m = new Model("FX Layer", "Tool");
        ContainerScopes scopes = new ContainerScopes(m);
        boolean threw = false;
        try { aim(scopes, m, "track-a", 16); } catch (IllegalArgumentException expected) { threw = true; }
        check(threw && m.gate.writeLeases() == 0, "a position past the bank throws before the lease");
        threw = false;
        try { aim(scopes, m, "track-a", -1); } catch (IllegalArgumentException expected) { threw = true; }
        check(threw, "a negative position throws");
        Result open = aim(scopes, m, "track-a", 0);
        threw = false;
        try { aim(scopes, m, "track-a", 1); } catch (IllegalStateException expected) { threw = true; }
        check(threw, "a second aim while one is open is refused");
        open.settled.release();
        Result next = aim(scopes, m, "track-a", 1);
        check(next.settled != null, "and admitted after the release");
        next.settled.release();
        JsonObject status = scopes.status();
        check(status.get("rule").getAsString().equals(ContainerScopes.RULE) && status.get("aims").getAsLong() == 2
            && !status.get("open").getAsBoolean(), "status counts the aims");
    }

    private static void run(String name, Runnable test) {
        tasks.clear();
        try {
            test.run();
            passed++;
            System.out.println("PASS " + name);
        } catch (AssertionError | RuntimeException error) {
            System.out.println("FAIL " + name + ": " + error);
            throw error;
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}

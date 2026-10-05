package com.ghostnote.extension;

import static com.ghostnote.extension.ShadowProjectCache.*;
import static com.ghostnote.extension.ShadowHandlePool.*;

/** Check fixed-capacity selection and caller-controlled binding transactions. */
public final class ShadowHandlePoolTest {
    private static final Address A = new Address("track-a", 0), B = new Address("track-a", 1),
        C = new Address("track-a", 2), D = new Address("track-b", 0);
    private static int passed;

    public static void main(String[] args) {
        run("two handles serve A B C A with deterministic LRU", ShadowHandlePoolTest::lru);
        run("warm requests and touches refresh the eviction order", ShadowHandlePoolTest::warmLru);
        run("equal recency uses the lowest physical index", ShadowHandlePoolTest::ties);
        run("reservations never publish an unconfirmed target", ShadowHandlePoolTest::transaction);
        run("cancellation preserves only unretired targets", ShadowHandlePoolTest::cancellation);
        run("clear and per-index invalidation reject stale reservations", ShadowHandlePoolTest::invalidation);
        run("separate pool instances reject matching reservation counters", ShadowHandlePoolTest::reload);
        run("capacity and invalid configuration are bounded", ShadowHandlePoolTest::capacity);
        run("failed recency update cannot partially commit", ShadowHandlePoolTest::recencyFailure);
        System.out.println("Shadow handle pool: " + passed + " test groups passed.");
    }

    private static void lru() {
        ShadowHandlePool pool = new ShadowHandlePool(2);
        bind(pool, A); bind(pool, B);
        Decision c = pool.acquire(C);
        check(c.index() == 0 && c.victim().equals(A), "C evicts the oldest A on the first handle");
        commit(pool, c);
        Decision a = pool.acquire(A);
        check(a.index() == 1 && a.victim().equals(B), "A reacquires the oldest second handle");
        commit(pool, a);
        check(pool.capacity() == 2 && pool.find(A) == 1 && pool.find(C) == 0 && pool.find(B) == -1,
            "A B C A changes working set without adding handles");
    }

    private static void warmLru() {
        ShadowHandlePool pool = new ShadowHandlePool(2);
        Decision a = bind(pool, A), b = bind(pool, B);
        check(a.index() == 0 && b.index() == 1, "free slots use index order");
        check(pool.acquire(A).kind() == Kind.WARM, "A repeat remains warm and becomes newest");
        Decision c = pool.acquire(C);
        check(c.index() == 1 && c.victim().equals(B), "C chooses the least recently used B");
        commit(pool, c);
        check(pool.find(A) == 0 && pool.find(B) == -1 && pool.find(C) == 1, "only two targets remain resident");
        pool.touch(C);
        Decision bAgain = pool.acquire(B);
        check(bAgain.index() == 0 && bAgain.victim().equals(A), "B miss chooses A after C touch");
        commit(pool, bAgain);
        Decision aAgain = pool.acquire(A);
        check(aAgain.index() == 1 && aAgain.victim().equals(C), "A reacquires the fixed second handle");
        commit(pool, aAgain);
        check(pool.capacity() == 2 && pool.find(A) >= 0 && pool.find(B) >= 0, "working-set recovery allocates no new slots");
    }

    private static void ties() {
        ShadowHandlePool pool = new ShadowHandlePool(2, "tie-test", () -> 7);
        bind(pool, A); bind(pool, B);
        check(pool.acquire(C).index() == 0, "equal ages select the lowest index");
    }

    private static void transaction() {
        ShadowHandlePool pool = new ShadowHandlePool(1); bind(pool, A);
        Decision b = pool.acquire(B); Reservation pending = b.reservation();
        check(pool.find(A) == -1 && pool.find(B) == -1, "pending slot serves neither address");
        check(pool.entries().get(0).address().equals(A), "reservation alone does not evict the committed address");
        check(!pool.accept(pending, true), "settlement cannot commit before retirement");
        check(pool.acquire(B).kind() == Kind.BUSY && pool.acquire(C).kind() == Kind.BUSY,
            "a reserved slot cannot start a concurrent binding");
        check(pool.markRetired(pending) && !pool.accept(pending, false), "unsettled binding cannot commit");
        check(pool.entries().get(0).address() == null, "retirement removes the old address");
        check(pool.summary().equals(new Summary(1, 1, 0, 1, 1)), "the summary counts a retired reservation: " + pool.summary());
        check(pool.accept(pending, true) && pool.find(B) == 0, "guarded settlement commits the pending target");
        check(!pool.accept(pending, true) && !pool.cancel(pending), "consumed reservation cannot act twice");
        check(pool.summary().equals(new Summary(1, 1, 1, 0, 0)), "the summary counts a committed address: " + pool.summary());
    }

    private static void cancellation() {
        ShadowHandlePool pool = new ShadowHandlePool(1); bind(pool, A);
        Decision before = pool.acquire(B);
        check(pool.cancel(before.reservation()) && pool.find(A) == 0, "cancel before retirement preserves A");
        Decision after = pool.acquire(B); pool.markRetired(after.reservation());
        check(pool.cancel(after.reservation()) && pool.find(A) == -1 && pool.find(B) == -1, "cancel after retirement stays free");
        Decision free = pool.acquire(C);
        check(free.victim() == null && free.reason().equals("free-handle"), "recovery starts on a free logical slot");
        commit(pool, free);
    }

    private static void invalidation() {
        ShadowHandlePool pool = new ShadowHandlePool(2); bind(pool, A); bind(pool, B);
        Decision c = pool.acquire(C); pool.clear();
        check(!pool.markRetired(c.reservation()) && !pool.accept(c.reservation(), true) && !pool.cancel(c.reservation()),
            "domain reset rejects every old reservation action");
        Decision a = pool.acquire(A); pool.invalidate(a.index()); Decision d = pool.acquire(D);
        check(!pool.markRetired(a.reservation()), "an old reservation cannot retire its replacement");
        commit(pool, d);
        check(pool.find(A) == -1 && pool.find(D) == 0, "per-index invalidation releases only the selected slot");
    }

    private static void reload() {
        ShadowHandlePool before = new ShadowHandlePool(1, "before", null), after = new ShadowHandlePool(1, "after", null);
        Reservation stale = before.acquire(A).reservation(), current = after.acquire(A).reservation();
        check(stale.reservationId() == current.reservationId() && stale.poolGeneration() == current.poolGeneration(),
            "test repeats local reservation counters");
        check(!after.markRetired(stale) && !after.accept(stale, true) && !after.cancel(stale), "old instance reservation refuses");
        check(after.markRetired(current) && after.accept(current, true), "current instance still commits");
    }

    private static void capacity() {
        ShadowHandlePool zero = new ShadowHandlePool(0);
        check(zero.acquire(A).kind() == Kind.BUSY && zero.entries().isEmpty(), "zero-capacity pool reports a miss");
        check(new ShadowHandlePool(RESEARCH_MAX_OBSERVERS).capacity() == RESEARCH_MAX_OBSERVERS,
            "research allocation equality is allowed");
        expect(IllegalArgumentException.class, () -> new ShadowHandlePool(-1));
        expect(IllegalArgumentException.class, () -> new ShadowHandlePool(RESEARCH_MAX_OBSERVERS + 1));
        // 8h1a: an active prefix selects only its handles and cannot exceed the allocation.
        ShadowHandlePool prefix = new ShadowHandlePool(4);
        check(prefix.acquire(A).kind() == Kind.RESERVED && prefix.entries().get(0).reserved(), "full prefix reserves");
        prefix.setActive(1);
        check(prefix.active() == 1 && prefix.entries().stream().noneMatch(Entry::reserved), "a new prefix clears every slot");
        ShadowHandlePool.Decision first = prefix.acquire(A);
        check(first.kind() == Kind.RESERVED && first.index() == 0, "the prefix selects its first handle");
        check(prefix.acquire(B).kind() == Kind.BUSY, "a handle outside the prefix is never selected");
        expect(IllegalArgumentException.class, () -> prefix.setActive(5));
        expect(IllegalArgumentException.class, () -> new ShadowHandlePool(1, "", null));
        expect(IllegalArgumentException.class, () -> zero.invalidate(0));
        expect(UnsupportedOperationException.class, () -> new ShadowHandlePool(1).entries().clear());
    }

    private static void recencyFailure() {
        long[] age = {10}; ShadowHandlePool pool = new ShadowHandlePool(1, "clock-test", () -> age[0]);
        bind(pool, A); Decision b = pool.acquire(B); pool.markRetired(b.reservation()); age[0] = 9;
        expect(IllegalStateException.class, () -> pool.accept(b.reservation(), true));
        check(pool.find(B) == -1 && pool.entries().get(0).reserved(), "failed clock update keeps an uncommitted reservation");
        age[0] = 11; check(pool.accept(b.reservation(), true), "valid recency allows explicit recovery");
    }

    private static Decision bind(ShadowHandlePool pool, Address target) { Decision decision = pool.acquire(target); commit(pool, decision); return decision; }
    private static void commit(ShadowHandlePool pool, Decision decision) {
        check(decision.kind() == Kind.RESERVED && pool.markRetired(decision.reservation())
            && pool.accept(decision.reservation(), true), "test caller retires and confirms binding settlement");
    }
    private static void check(boolean pass, String reason) { if (!pass) throw new AssertionError(reason); }
    private static void expect(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { if (type.isInstance(error)) return; throw new AssertionError(error); }
        throw new AssertionError("expected " + type.getSimpleName());
    }
    private static void run(String name, Runnable test) {
        try { test.run(); passed++; } catch (Throwable error) { throw new AssertionError(name, error); }
    }
}

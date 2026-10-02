package com.ghostnote.extension;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.LongSupplier;

import static com.ghostnote.extension.ShadowProjectCache.*;

/** Select fixed physical slots. The caller owns retirement, binding, and identity guards. */
public final class ShadowHandlePool {
    public enum Kind { WARM, RESERVED, BUSY }
    public record Reservation(String initDomain, long poolGeneration, long reservationId, int index,
                              Address target, Address victim) {}
    public record Decision(Kind kind, int index, Address target, Address victim, Reservation reservation,
                           String reason) {}
    public record Entry(int index, Address address, long lastUsed, boolean reserved, boolean retired,
                        Reservation reservation) {}

    private static final class Slot {
        Address address;
        long lastUsed;
        Reservation pending;
        boolean retired;
    }
    private final Slot[] slots;
    private final String initDomain;
    private final LongSupplier suppliedRecency;
    private long generation = 1, nextReservation, clock;

    public ShadowHandlePool(int capacity) { this(capacity, UUID.randomUUID().toString(), null); }

    ShadowHandlePool(int capacity, String initDomain, LongSupplier suppliedRecency) {
        if (capacity < 0 || capacity > MAX_OBSERVERS || initDomain == null || initDomain.isEmpty())
            throw new IllegalArgumentException("invalid handle pool configuration");
        this.initDomain = initDomain;
        this.suppliedRecency = suppliedRecency;
        slots = new Slot[capacity];
        for (int index = 0; index < capacity; index++) slots[index] = new Slot();
    }

    public int capacity() { return slots.length; }

    /** A reserved slot cannot serve either the old target or the pending target. */
    public int find(Address target) {
        Objects.requireNonNull(target);
        for (int index = 0; index < slots.length; index++) {
            Slot slot = slots[index];
            if (slot.pending == null && target.equals(slot.address)) return index;
        }
        return -1;
    }

    public boolean touch(Address target) {
        int index = find(target);
        return index >= 0 && touch(index);
    }

    public boolean touch(int index) {
        Slot slot = slot(index);
        if (slot.address == null || slot.pending != null) return false;
        slot.lastUsed = nextAge();
        return true;
    }

    /** Reserve a choice. No eviction or new target becomes visible at this step. */
    public Decision acquire(Address target) {
        Objects.requireNonNull(target);
        int warm = find(target);
        if (warm >= 0) {
            touch(warm);
            return new Decision(Kind.WARM, warm, target, null, null, "current-target");
        }
        for (int index = 0; index < slots.length; index++) {
            if (slots[index].pending != null && target.equals(slots[index].pending.target()))
                return new Decision(Kind.BUSY, index, target, null, null, "target-binding-in-progress");
        }
        int chosen = -1;
        for (int index = 0; index < slots.length; index++) {
            Slot candidate = slots[index];
            if (candidate.pending != null) continue;
            if (candidate.address == null) { chosen = index; break; }
            if (chosen < 0 || candidate.lastUsed < slots[chosen].lastUsed) chosen = index;
        }
        if (chosen < 0) return new Decision(Kind.BUSY, -1, target, null, null, "no-unreserved-handle");
        Slot slot = slots[chosen];
        Reservation reservation = new Reservation(initDomain, generation, Math.incrementExact(nextReservation),
            chosen, target, slot.address);
        nextReservation = reservation.reservationId();
        slot.pending = reservation;
        slot.retired = false;
        return new Decision(Kind.RESERVED, chosen, target, slot.address, reservation,
            slot.address == null ? "free-handle" : "least-recently-used-victim");
    }

    /** Remove the old address before the caller retires its physical binding. */
    public boolean markRetired(Reservation reservation) {
        Slot slot = reserved(reservation);
        if (slot == null) return false;
        slot.address = null; slot.lastUsed = 0; slot.retired = true;
        return true;
    }

    /** Commit only after retirement and the caller's guarded binding settlement. */
    public boolean accept(Reservation reservation, boolean bindingSettled) {
        Slot slot = reserved(reservation);
        if (slot == null || !slot.retired || !bindingSettled) return false;
        long age = nextAge();
        slot.address = reservation.target(); slot.lastUsed = age;
        slot.pending = null; slot.retired = false;
        return true;
    }

    /** A cancelled retired binding remains free. It cannot restore the old target. */
    public boolean cancel(Reservation reservation) {
        Slot slot = reserved(reservation);
        if (slot == null) return false;
        slot.pending = null; slot.retired = false;
        return true;
    }

    public void invalidate(int index) {
        Slot slot = slot(index);
        slot.address = null; slot.lastUsed = 0; slot.pending = null; slot.retired = false;
    }

    /** The parent calls this before a new project or structural identity domain. */
    public void clear() {
        generation = Math.incrementExact(generation);
        for (int index = 0; index < slots.length; index++) invalidate(index);
    }

    public List<Entry> entries() {
        List<Entry> result = new ArrayList<>(slots.length);
        for (int index = 0; index < slots.length; index++) {
            Slot slot = slots[index];
            result.add(new Entry(index, slot.address, slot.lastUsed, slot.pending != null, slot.retired, slot.pending));
        }
        return List.copyOf(result);
    }

    private Slot reserved(Reservation reservation) {
        if (reservation == null || !initDomain.equals(reservation.initDomain())
            || generation != reservation.poolGeneration() || reservation.index() < 0 || reservation.index() >= slots.length)
            return null;
        Slot slot = slots[reservation.index()];
        return reservation.equals(slot.pending) ? slot : null;
    }

    private Slot slot(int index) {
        if (index < 0 || index >= slots.length) throw new IllegalArgumentException("handle index outside pool");
        return slots[index];
    }

    private long nextAge() {
        long age = suppliedRecency == null ? Math.incrementExact(clock) : suppliedRecency.getAsLong();
        if (age < clock) throw new IllegalStateException("pool recency moved backwards");
        clock = age;
        return age;
    }
}

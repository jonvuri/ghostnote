package com.ghostnote.extension;

import java.util.ArrayList;
import java.util.List;

/** An operator change before the handler must prevent every restore write and lease transfer. */
public final class ReplaySelectionActionsTest {
    public static void main(String[] args) {
        boolean[] owned = {true};
        List<String> writes = new ArrayList<>();
        Runnable consume = () -> { owned[0] = false; writes.add("consume"); };
        Runnable slot = () -> writes.add("slot"), mixer = () -> writes.add("mixer");
        // The caller prepared a restore while owned. An operator event then cleared its lease.
        owned[0] = false;
        check(!ReplaySelectionActions.restore(() -> owned[0], consume, slot, mixer) && writes.isEmpty(), "no stale restore writes");
        check(!ReplaySelectionActions.transfer(() -> owned[0], () -> owned[0] = true) && !owned[0], "a transfer cannot renew a lost lease");
        owned[0] = true;
        check(ReplaySelectionActions.restore(() -> owned[0], consume, slot, mixer), "owned restore");
        check(writes.equals(List.of("consume", "slot", "mixer")) && !owned[0], "one consumed lease protects both writes");
        check(!ReplaySelectionActions.restore(() -> owned[0], consume, slot, mixer) && writes.size() == 3, "no second restore");
        System.out.println("Replay selection actions: stale, consumed, and transferred lease checks pass.");
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}

package com.ghostnote.extension;

import java.util.function.BooleanSupplier;

/** Keep research selection actions behind the current E99 lease. */
public final class ReplaySelectionActions {
    private ReplaySelectionActions() {}

    public static boolean restore(BooleanSupplier owned, Runnable consume, Runnable slot, Runnable mixer) {
        if (!owned.getAsBoolean()) return false;
        consume.run(); slot.run(); mixer.run();
        return true;
    }

    public static boolean transfer(BooleanSupplier owned, Runnable claim) {
        if (!owned.getAsBoolean()) return false;
        claim.run();
        return true;
    }
}

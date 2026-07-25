package com.ghostnote.extension.handlers;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * The adapter-contract handshake constants (Phase 0).
 *
 * The contract is the typed seam between the brain and *some* Bitwig — real or
 * fake — and it is versioned so a future adapter rejects incompatible data
 * instead of guessing (INITIAL_PROMPT §7). The check is exact equality: there is
 * deliberately no range negotiation, because nobody ships two adapters at once
 * and range logic is the classic over-engineering trap here.
 *
 * ⚠ Bump VERSION whenever the meaning of any wire method's params or result
 * changes. Adding a method is additive and does not require a bump; the
 * methodsHash carried alongside is what catches that.
 */
public final class Contract {
    private Contract() {}

    /** Contract v0. Must equal CONTRACT_VERSION in brain/src/contract/version.ts. */
    public static final int VERSION = 0;

    public static final String EXTENSION_VERSION = "0.0.1";

    /**
     * sha256 of the sorted method names joined by newline, first 16 hex chars.
     * The brain computes the same value from extension/methods.golden.json, so a
     * wire surface that drifted from the golden is caught at connect rather than
     * at the first failing write.
     */
    public static String methodsHash(List<String> sortedNames) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] out = digest.digest(String.join("\n", sortedNames).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 8; i++) {
                hex.append(String.format("%02x", out[i]));
            }
            return hex.toString();
        } catch (Exception e) {
            // SHA-256 is mandated by the platform; this cannot happen.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}

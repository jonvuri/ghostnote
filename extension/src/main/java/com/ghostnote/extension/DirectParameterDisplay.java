package com.ghostnote.extension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The DirectParameter display text of the current target (8h4e, E244).
 *
 * <p>The display observer reports text only for the IDs that are set on it. After a set, each observed ID reports
 * its text one control-surface turn later. A device switch sends no text, so each new target needs a new set.
 * A write sends the text of the written ID in the same turn.
 *
 * <p>The set is "armed" for one DirectParameter generation and one target stamp. Text counts only when its
 * callback arrives under the armed stamp, for a listed ID. {@link #clear()} removes the text and the arm at each
 * target change. When the target stays the same, {@link #carry(long)} moves the arm to the new generation and
 * keeps the text.
 *
 * <p>The class also holds the pure CLAP ID mapping: on a CLAP plug-in, the ID observer lists
 * {@code CONTENTS/<id>}, but the callbacks after a write use {@code CONTENTS/ROOT_GENERIC_MODULE/<id>} (E244).
 */
public final class DirectParameterDisplay {
    public static final String LISTED_PREFIX = "CONTENTS/";
    public static final String CALLBACK_PREFIX = "CONTENTS/ROOT_GENERIC_MODULE/";

    private final Map<String, String> texts = new LinkedHashMap<>();
    private Set<String> listed = new HashSet<>();
    private String stamp;
    private long armedGeneration = -1;

    /**
     * Map a callback ID to the listed ID. {@code CONTENTS/ROOT_GENERIC_MODULE/<id>} becomes {@code CONTENTS/<id>}
     * when the listed set has that ID and does not have the callback form itself. Each other ID is unchanged.
     */
    public static String listedId(String id, Set<String> listedIds) {
        if (id == null || listedIds.contains(id) || !id.startsWith(CALLBACK_PREFIX)) return id;
        String candidate = LISTED_PREFIX + id.substring(CALLBACK_PREFIX.length());
        return listedIds.contains(candidate) ? candidate : id;
    }

    /**
     * The IDs to set on the display observer. For a plug-in, each listed ID of the form {@code CONTENTS/<id>}
     * also adds its callback form: E244 measured the text after a write only when the callback form is observed.
     */
    public static String[] observedIds(String[] ids, boolean plugin) {
        if (!plugin) return ids.clone();
        List<String> out = new ArrayList<>(Arrays.asList(ids));
        Set<String> present = new HashSet<>(out);
        for (String id : ids) {
            if (!id.startsWith(LISTED_PREFIX) || id.startsWith(CALLBACK_PREFIX)) continue;
            String callback = CALLBACK_PREFIX + id.substring(LISTED_PREFIX.length());
            if (present.add(callback)) out.add(callback);
        }
        return out.toArray(new String[0]);
    }

    /** Arm for one generation and stamp. This removes all text; the set itself is the caller's task. */
    public void arm(long generation, String targetStamp, String[] ids) {
        texts.clear();
        listed = new HashSet<>(Arrays.asList(ids));
        stamp = targetStamp;
        armedGeneration = generation;
    }

    /** Keep the arm and the text for a new generation of the same target. Does nothing when not armed. */
    public void carry(long generation) {
        if (armedGeneration >= 0) armedGeneration = generation;
    }

    /** Remove the text and the arm (a target change or a new ID list). */
    public void clear() {
        texts.clear();
        listed = new HashSet<>();
        stamp = null;
        armedGeneration = -1;
    }

    /**
     * Record one display callback. It counts only under the armed stamp and for a listed ID (after the CLAP
     * mapping). Returns true when it counted.
     */
    public boolean accept(String targetStamp, String id, String text) {
        if (armedGeneration < 0 || stamp == null || !stamp.equals(targetStamp)) return false;
        String key = listedId(id, listed);
        if (!listed.contains(key)) return false;
        texts.put(key, text);
        return true;
    }

    /** The generation that the arm applies to, or -1. */
    public long armedGeneration() { return armedGeneration; }

    /** True when the arm applies to {@code generation}. */
    public boolean armedFor(long generation) { return armedGeneration >= 0 && armedGeneration == generation; }

    /** The current text of one listed ID, or null. */
    public String text(String id) { return texts.get(id); }

    /** The number of listed IDs with text. */
    public int count() { return texts.size(); }

    /** True when armed for {@code generation} and each ID in {@code ids} has text. */
    public boolean complete(long generation, String[] ids) {
        if (!armedFor(generation)) return false;
        for (String id : ids) {
            if (!texts.containsKey(id)) return false;
        }
        return true;
    }
}

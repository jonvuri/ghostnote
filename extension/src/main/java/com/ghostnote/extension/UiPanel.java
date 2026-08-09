package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.DocumentState;
import com.bitwig.extension.controller.api.NotificationSettings;
import com.bitwig.extension.controller.api.SettableBooleanValue;
import com.bitwig.extension.controller.api.SettableEnumValue;
import com.bitwig.extension.controller.api.SettableStringValue;
import com.bitwig.extension.controller.api.Setting;
import com.bitwig.extension.controller.api.Signal;

/**
 * E14 — the in-Bitwig human surface, as a probe apparatus.
 *
 * D4 bet the whole §8g privilege separation on the Studio I/O panel
 * (`host.getDocumentState()`): real buttons, a button-group chooser, text and
 * toggles, persisted inside the project document. Every word of that is marked
 * ◐ doc-only, and standing rule 10 says nothing is banked until probed live.
 * This class is what there is to probe.
 *
 * ⚠ D4's LOCATION is already wrong, before any of the rest is settled. Settings
 * created here appeared in the Studio I/O panel up to Bitwig 4.x, listed under
 * the controller with a disclosure triangle. Bitwig 5.0 moved the per-controller
 * surface to a pane opened from controller icons in the top right of the window,
 * and renamed the old panel (Output Monitoring Panel per the 5.0 notes; "Studio
 * Monitoring Panel" in 6.0.6) — which no longer lists controllers at all. The API
 * is unchanged and still v1; only where Bitwig DRAWS it moved. Verified by
 * looking: the monitoring panel is empty of anything ghostnote.
 *
 * ⚠ Four things the javadoc pass turned up, all of which shape what is below.
 *
 * 1. **`Setting` is an ORPHAN interface.** It declares `show()`, `hide()`,
 *    `enable()` and `disable()` — row C's entire question — and NOTHING in the
 *    public API returns it, extends it, or even links to it. `getEnumSetting`
 *    returns `SettableEnumValue`, whose supertypes are `EnumValue, Subscribable,
 *    Supplier<String>, Value<…>`; `Setting` is not among them, and the same holds
 *    for every other `Settings.get*` return type. So dynamic show/hide is
 *    reachable only by a runtime downcast onto an implementation class that the
 *    javadoc never promises implements both. Guarded with `instanceof`
 *    throughout, never a blind cast — see {@link #asSetting}. Row C's real
 *    verdict is whether that cast succeeds at all.
 * 2. **Notifications default to OFF.** `NotificationSettings`' own javadoc says
 *    "By default all notifications are disabled", which makes row F's premise —
 *    that `setShouldShow*(false)` will suppress the spray E1 saw — suspect: you
 *    cannot turn off what was never on. Those methods govern notifications the
 *    CONTROLLER asks for. The lever that plausibly reaches the user's own is
 *    `getUserNotificationsEnabled()`, a `SettableBooleanValue` the extension can
 *    write. Both are exposed so the probe can tell them apart.
 * 3. **Nothing documents a limit on how many settings may exist**, and nothing
 *    documents that they must be created at init. `ControllerExtension.init()`
 *    only says the extension "should call the various create methods" there. So
 *    row C's slot count is config-tunable ({@link RigConfig#uiSlots}) and
 *    `UiHandlers.uiAddSetting` tries the undocumented late path directly.
 * 4. **`Signal.fire()` exists**, and the extension may call it on its own button.
 *    That is deliberately exposed as a probe-only wire method, banned from the
 *    contract, because it decides whether D4's separation is structural or
 *    merely unexposed — see `UiHandlers`.
 *
 * ⚠ Constructed inside a try/catch by {@link GhostnoteExtension}. This is the
 * E7-Finding-0 hazard class: `getModulationSource(int)` threw at init and took
 * the whole extension down before the bridge could bind. Nothing here is
 * `@Deprecated`, so the risk is low — but a dead bridge would cost the entire
 * live sitting this apparatus exists for, and the trade is one `if (panel ==
 * null)` in the handlers.
 */
public final class UiPanel {
    private static final String CAT_TAKES = "Takes";
    private static final String CAT_STATUS = "Status";
    private static final String CAT_SHAPE = "Enum shape";
    private static final String CAT_SLOTS = "Take slots";
    private static final String CAT_RECORD = "Record";

    /** Option counts to create one enum setting each for — row B's real question. */
    public static final int[] ENUM_OPTION_COUNTS = { 2, 3, 4, 6, 8, 12 };

    private final ControllerHost host;
    public final DocumentState documentState;
    public final NotificationSettings notifications;

    // --- row A: does a Signal button actually fire? ---------------------------
    public final Signal revertSignal;
    /** Bumped by the observer. The whole of row A is whether this ever moves. */
    public int revertFires = 0;
    public long revertLastMs = -1;

    // --- row B: enum as a button group, observable AND writable ---------------
    public final SettableEnumValue takeChooser;
    public static final String[] TAKE_OPTIONS = { "A", "B", "C" };
    public String takeChooserValue = TAKE_OPTIONS[0];
    public int takeChooserChanges = 0;
    /** One per entry of {@link #ENUM_OPTION_COUNTS}; index-parallel. */
    public final SettableEnumValue[] shapeProbes;

    // --- row D: a String setting as a read-only-ish status display ------------
    public final SettableStringValue statusText;
    public String statusTextValue = "";
    /** Counts EVERY change, ours and the user's — row D is whether we can tell. */
    public int statusTextChanges = 0;
    /** What we last pushed, so a change we did not make is identifiable. */
    public String statusTextLastPushed = "";

    // --- row C: pre-allocated slots, shown and hidden at runtime --------------
    public final SettableStringValue[] slotSettings;

    // --- E20d/D18d: how much JSON a document-state setting will hold, HIDDEN --
    /**
     * ⚠⚠ D18d, revised 2026-08-09 (`FINDINGS.md` E20d): null unless {@link
     * RigConfig#recordChars} is nonzero AND the {@link Setting} downcast is
     * available — see {@link #recordUnavailable} for the second case. A
     * 262144-char field DRAWN in the panel hard-locked Bitwig; hiding it at
     * construction (below) is what makes it safe to create at all, so a
     * setting this constructor cannot hide is never created in the first
     * place, rather than created and left visible.
     */
    public final SettableStringValue recordSetting;
    /** The size this setting was DECLARED with, so a reply can report it. Zero
     *  whenever {@link #recordSetting} is null, for either reason. */
    public final int recordChars;
    /**
     * Set only when {@link RigConfig#recordChars} asked for a record but it
     * was refused because it could not be hidden — distinct from "recordChars
     * is 0", which is the ordinary unswept default and carries no error at
     * all (rule 13's lesson: "the knob is zero" and "creation failed" are
     * different facts and must be reported separately, per E17).
     */
    public final String recordUnavailable;
    public String recordValue = "";
    public int recordChanges = 0;

    // --- row F: the notification master switch --------------------------------
    public final SettableBooleanValue userNotificationsEnabled;

    /** Settings created AFTER init by `ui.addSetting`, kept so they stay alive. */
    public final java.util.List<Object> lateSettings = new java.util.ArrayList<>();

    /** Nanos spent in this constructor — the row-C init-cost measurement. */
    public final long constructNanos;

    public UiPanel(ControllerHost host, RigConfig config) {
        long start = System.nanoTime();
        this.host = host;
        this.documentState = host.getDocumentState();
        this.notifications = host.getNotificationSettings();

        // Row A. The button text is the third argument, not the label.
        revertSignal = documentState.getSignalSetting(
            "Revert last change", CAT_TAKES, "Revert");
        revertSignal.addSignalObserver(() -> {
            revertFires++;
            revertLastMs = System.currentTimeMillis();
        });

        // Row B. Three options is the A/B/C take switcher D4 wants; the
        // `shapeProbes` beside it exist only to find where Bitwig stops drawing a
        // button group and starts drawing a chooser, which no javadoc states.
        takeChooser = documentState.getEnumSetting("Take", CAT_TAKES, TAKE_OPTIONS, TAKE_OPTIONS[0]);
        takeChooser.addValueObserver(value -> {
            takeChooserValue = value;
            takeChooserChanges++;
        });
        shapeProbes = new SettableEnumValue[ENUM_OPTION_COUNTS.length];
        for (int i = 0; i < ENUM_OPTION_COUNTS.length; i++) {
            int n = ENUM_OPTION_COUNTS[i];
            String[] options = new String[n];
            for (int o = 0; o < n; o++) {
                options[o] = String.valueOf((char) ('A' + o));
            }
            shapeProbes[i] = documentState.getEnumSetting(
                n + " options", CAT_SHAPE, options, options[0]);
        }

        // Row D. There is no read-only String setting, so the question is whether
        // a user typing into the status readout is survivable — which means
        // knowing that they did. The observer fires for our writes too, so
        // `statusTextLastPushed` is what separates the two.
        statusText = documentState.getStringSetting("Last change", CAT_STATUS, 64, "");
        statusText.addValueObserver(value -> {
            statusTextValue = value;
            statusTextChanges++;
        });

        // Row C. Pre-allocated because settings are believed to be init-only; the
        // count is config-tunable so "how many before the panel is unusable" can
        // be swept by editing rig.json and touching the extension, with no
        // rebuild — the same loop E5 used.
        slotSettings = new SettableStringValue[Math.max(0, config.uiSlots)];
        for (int i = 0; i < slotSettings.length; i++) {
            slotSettings[i] = documentState.getStringSetting(
                "Slot " + (i + 1), CAT_SLOTS, 32, "");
        }

        // ⚠⚠ E20d. D18d's branch record lands in `getDocumentState()`, and how much
        // JSON that holds has never been measured — E14-A3 proved settings survive
        // a full restart and said nothing about SIZE. `getStringSetting` takes a
        // declared char count whose enforcement is undocumented: it may truncate,
        // refuse, or be advisory. The sweep writes a payload of exactly this length
        // and compares the readback byte for byte.
        //
        // ⚠⚠ D18d, revised 2026-08-09: capacity was never the constraint — the
        // field is DRAWN, and drawing it at 262144 chars hard-locked Bitwig (force
        // quit required), with lag reported from as low as 1024 chars. The setting
        // must therefore be HIDDEN, and `hide()` only exists behind the
        // undocumented `Setting` downcast (`asSetting`, below).
        //
        // ⚠⚠ The downcast is checked BEFORE the record setting is created, against
        // `statusText` — already created above, same `SettableStringValue`
        // interface — rather than after. `hide()` is a runtime call: once
        // `getStringSetting` returns, the setting exists in the panel whether or
        // not the following cast succeeds, and Bitwig's API has no "delete this
        // setting" call to undo that. A visible large field IS the hazard E20d
        // measured, so a cast that would fail is caught on an object that already
        // exists (cheap to discard) rather than on the hazardous one itself.
        //
        // ⚠ Created only when asked for. Rule 13 makes it init-only either way, so
        // the knob is read here and nowhere else.
        int requestedChars = Math.max(0, config.recordChars);
        if (requestedChars > 0 && asSetting(statusText) == null) {
            recordSetting = null;
            recordChars = 0;
            recordUnavailable = "Setting downcast unavailable (see UiPanel#asSetting); "
                + "refusing to create a " + requestedChars + "-char record field that "
                + "could not be hidden — a visible field this size hard-locks Bitwig (E20d)";
        } else if (requestedChars > 0) {
            SettableStringValue created = documentState.getStringSetting(
                "Branch record", CAT_RECORD, requestedChars, "");
            // ⚠ Re-checked on `created` itself rather than trusted from the proxy
            // above — never a blind cast, same discipline `asSetting`'s own javadoc
            // states. The two calls share an implementation class in practice, but
            // this is the one guard standing between "proxy passed" and a large
            // field left undismissable if that ever stopped holding.
            Setting hideable = asSetting(created);
            if (hideable == null) {
                recordSetting = null;
                recordChars = 0;
                recordUnavailable = "Setting downcast worked for \"Last change\" but not for "
                    + "\"Branch record\" itself; refusing a " + requestedChars + "-char "
                    + "record field that could not be hidden — a visible field this size "
                    + "hard-locks Bitwig (E20d). ⚠ The field was already created and is "
                    + "now abandoned, undismissable through this API; it will not be wired "
                    + "up or written to.";
            } else {
                // ⚠⚠ Hidden HERE, in the constructor `init()` runs, not by a later
                // runtime call. `hide()` does not persist across a restart —
                // `init()` re-creates the setting visible every time — so hiding
                // anywhere else re-arms the hazard on the next reload
                // (E20d-H1/H2/H3).
                hideable.hide();
                created.addValueObserver(value -> {
                    recordValue = value;
                    recordChanges++;
                });
                recordSetting = created;
                recordChars = requestedChars;
                recordUnavailable = null;
            }
        } else {
            recordSetting = null;
            recordChars = 0;
            recordUnavailable = null;
        }

        // Row F. ⚠ NOT one of the setShouldShow* methods: those govern
        // notifications the controller requests, and they are already off by
        // default, so switching them off cannot suppress anything. This is the
        // master switch, and the only one documented to silence "all automatic
        // notifications" in the Bitwig UI.
        userNotificationsEnabled = notifications.getUserNotificationsEnabled();
        userNotificationsEnabled.markInterested();

        constructNanos = System.nanoTime() - start;
    }

    /**
     * The undocumented downcast row C hangs on, made safe.
     *
     * `Settings.get*` hands back value objects — `SettableEnumValue`,
     * `SettableStringValue`, `Signal` — and none of them declares `Setting` as a
     * supertype anywhere in the API. Bitwig's implementation classes may well
     * implement both, and the community assumes they do, but the javadoc never
     * says so and no bundled controller script demonstrates it. `instanceof` turns
     * "the assumption is wrong" into a clean ○ verdict instead of a
     * ClassCastException mid-probe.
     */
    public static Setting asSetting(Object value) {
        return value instanceof Setting setting ? setting : null;
    }

    /** Named lookup for the probe: "revert", "take", "status", "shape:N", "slot:N". */
    public Object settingByRef(String ref) {
        switch (ref) {
            case "revert": return revertSignal;
            case "take": return takeChooser;
            case "status": return statusText;
            case "record":
                if (recordSetting == null) {
                    // ⚠ Named, never silent. "The knob is zero" and "the setting
                    // failed to create" are different facts and E20d scores them
                    // differently — rule 13's lesson, which cost three false ○s in
                    // E17 before handle status was reported separately from value.
                    String reason = recordUnavailable != null
                        ? recordUnavailable
                        : "recordChars is 0 in ~/.ghostnote/rig.json, so it was never created "
                          + "(settings are init-only, standing rule 13)";
                    throw new IllegalArgumentException("no record setting: " + reason);
                }
                return recordSetting;
            default:
                if (ref.startsWith("shape:")) {
                    int i = Integer.parseInt(ref.substring(6));
                    if (i < 0 || i >= shapeProbes.length) {
                        throw new IllegalArgumentException("shape index out of range: " + ref);
                    }
                    return shapeProbes[i];
                }
                if (ref.startsWith("slot:")) {
                    int i = Integer.parseInt(ref.substring(5));
                    if (i < 0 || i >= slotSettings.length) {
                        throw new IllegalArgumentException("slot index out of range: " + ref);
                    }
                    return slotSettings[i];
                }
                throw new IllegalArgumentException("unknown setting ref: " + ref);
        }
    }

    /**
     * The legal values for an enum setting, or null when `ref` names something
     * else.
     *
     * ⚠ Exists so `ui.set` can refuse an out-of-range value BEFORE calling
     * Bitwig. E14-A1 established that a rejection can arrive asynchronously on
     * Bitwig's own thread, where no extension try/catch reaches it and the DAW
     * dies — so anything Bitwig might reject has to be checked here first.
     */
    public String[] optionsFor(String ref) {
        if ("take".equals(ref)) {
            return TAKE_OPTIONS.clone();
        }
        if (ref.startsWith("shape:")) {
            int i = Integer.parseInt(ref.substring(6));
            if (i < 0 || i >= ENUM_OPTION_COUNTS.length) {
                throw new IllegalArgumentException("shape index out of range: " + ref);
            }
            String[] options = new String[ENUM_OPTION_COUNTS[i]];
            for (int o = 0; o < options.length; o++) {
                options[o] = String.valueOf((char) ('A' + o));
            }
            return options;
        }
        return null;
    }

    /** How many settings this panel contributed to Bitwig's controller surface. */
    public int settingCount() {
        return 3 + shapeProbes.length + slotSettings.length + lateSettings.size()
            + (recordSetting == null ? 0 : 1);
    }

    ControllerHost host() {
        return host;
    }
}

package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.ghostnote.extension.UiPanel;
import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.DeleteableObject;
import com.bitwig.extension.controller.api.DuplicableObject;
import com.bitwig.extension.controller.api.SettableEnumValue;
import com.bitwig.extension.controller.api.SettableStringValue;
import com.bitwig.extension.controller.api.Setting;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * E14 — the in-Bitwig UI probe surface (rows A–G).
 *
 * PHASE-0 §Scope item 5. Everything here is ◐ doc-only until the live sitting;
 * standing rule 10 says nothing is banked until probed, and this group exists
 * only so the probe can ask. It is PROBE surface, not product surface: no op in
 * the adapter contract reaches any of it, and `wiremap.test.ts` asserts that.
 *
 * ⚠ There WAS a `ui.signalFire` here, to test whether the extension could press
 * the human's revert button and so whether D4's privilege separation is
 * structural or merely unexposed. It answered the question and CRASHED BITWIG
 * doing it. The method is gone, the finding is banked, and the long note above
 * `uiNotifications` explains both — including the general rule it produced, which
 * is why every handler below validates its arguments instead of wrapping its
 * calls in try/catch.
 *
 * ⚠ Every handler tolerates a null panel. {@link UiPanel} is built inside a
 * try/catch (the E7-Finding-0 hazard class), and a bridge that answers
 * `available: false` is worth infinitely more during a live sitting than an
 * extension that failed to load.
 */
public final class UiHandlers extends HandlerGroup {
    private final UiPanel panel;
    private final String panelError;

    public UiHandlers(ControllerHost host, Rig rig, ExecState state, UiPanel panel, String panelError) {
        super(host, rig, state);
        this.panel = panel;
        this.panelError = panelError;
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("ui.status", params -> uiStatus());
        r.on("ui.set", params -> uiSet(params));
        r.on("ui.visibility", params -> uiVisibility(params));
        r.on("ui.addSetting", params -> uiAddSetting(params));
        r.on("ui.notifications", params -> uiNotifications(params));
        r.on("ui.showInEditor", params -> uiShowInEditor(params));
        r.on("ui.panelLayout", params -> uiPanelLayout(params));
        r.on("ui.deleteObjects", params -> uiDeleteObjects(params));
        r.on("ui.duplicateObjects", params -> uiDuplicateObjects(params));
    }

    private UiPanel requirePanel() {
        if (panel == null) {
            throw new IllegalStateException("UI panel unavailable: " + panelError);
        }
        return panel;
    }

    // ------------------------------------------------- rows A, B, C, D: readback

    /**
     * Everything the panel knows, in one poll-friendly read.
     *
     * Rows A, B and D are all "did a human interaction reach the extension?",
     * which is a counter the probe watches across a user action. One method for
     * all of them keeps the interactive sitting to a single polling loop.
     */
    private JsonElement uiStatus() {
        JsonObject r = new JsonObject();
        if (panel == null) {
            r.addProperty("available", false);
            r.addProperty("error", panelError);
            return r;
        }
        r.addProperty("available", true);
        r.addProperty("constructMicros", panel.constructNanos / 1000);
        r.addProperty("settingCount", panel.settingCount());
        r.addProperty("slotCount", panel.slotSettings.length);
        r.addProperty("lateSettingCount", panel.lateSettings.size());

        // Row A
        r.addProperty("revertFires", panel.revertFires);
        r.addProperty("revertLastMs", panel.revertLastMs);

        // Row B
        r.addProperty("takeValue", panel.takeChooserValue);
        r.addProperty("takeChanges", panel.takeChooserChanges);
        JsonArray optionCounts = new JsonArray();
        for (int n : UiPanel.ENUM_OPTION_COUNTS) {
            optionCounts.add(n);
        }
        r.add("enumOptionCounts", optionCounts);

        // Row D. `changes` counts our pushes too, so the probe needs both numbers
        // to tell "the user typed into the status readout" from "we wrote it".
        r.addProperty("statusValue", panel.statusTextValue);
        r.addProperty("statusChanges", panel.statusTextChanges);
        r.addProperty("statusLastPushed", panel.statusTextLastPushed);
        r.addProperty("statusUserEdited", !panel.statusTextValue.equals(panel.statusTextLastPushed));

        // Row C's precondition, and the single most consequential unknown here:
        // whether the value objects Bitwig hands back are also `Setting`s. The
        // javadoc says no relationship exists. If this is false everywhere, the
        // pre-allocated-slot idiom has no runtime show/hide and row C is ○.
        JsonObject castable = new JsonObject();
        castable.addProperty("signal", UiPanel.asSetting(panel.revertSignal) != null);
        castable.addProperty("enum", UiPanel.asSetting(panel.takeChooser) != null);
        castable.addProperty("string", UiPanel.asSetting(panel.statusText) != null);
        r.add("settingCastWorks", castable);

        Setting asSetting = UiPanel.asSetting(panel.takeChooser);
        if (asSetting != null) {
            // Only reachable through the cast, so these are also evidence it is real.
            putGuarded(r, "takeSettingLabel", () -> asSetting.getLabel());
            putGuarded(r, "takeSettingCategory", () -> asSetting.getCategory());
        }

        // Row F, read side.
        putGuarded(r, "userNotificationsEnabled", () -> panel.userNotificationsEnabled.get());

        // Row E, read side.
        putGuarded(r, "panelLayout", () -> rig.application.panelLayout().get());
        return r;
    }

    /**
     * Push a value into a setting — row B's "and can the extension WRITE it?" and
     * row D's status readout.
     *
     * Whether push works at all is the half of D4 that matters most: an A/B take
     * switcher the extension cannot set is a switcher that goes out of sync with
     * the take store the moment anything else changes it.
     */
    private JsonElement uiSet(JsonObject params) {
        UiPanel p = requirePanel();
        String ref = params.get("setting").getAsString();
        String value = params.get("value").getAsString();
        Object target = p.settingByRef(ref);

        JsonObject r = ok();
        r.addProperty("setting", ref);
        r.addProperty("requested", value);
        if (target instanceof SettableEnumValue enumValue) {
            // ⚠ Validated BEFORE the call, not caught after it. An enum value
            // outside the option list is the same hazard class as `Signal.fire()`
            // (see the note above): if Bitwig rejects it on its own thread, no
            // try/catch here can contain the throw and the DAW goes down.
            String[] options = p.optionsFor(ref);
            if (options != null && !java.util.Arrays.asList(options).contains(value)) {
                throw new IllegalArgumentException(
                    "value \"" + value + "\" is not one of " + java.util.Arrays.toString(options)
                    + " — refusing rather than letting Bitwig reject it asynchronously");
            }
            enumValue.set(value);
            r.addProperty("kind", "enum");
        } else if (target instanceof SettableStringValue stringValue) {
            stringValue.set(value);
            if (target == p.statusText) {
                p.statusTextLastPushed = value;
            }
            r.addProperty("kind", "string");
        } else {
            throw new IllegalArgumentException("setting is not writable: " + ref);
        }
        return r;
    }

    /**
     * Row C: show / hide / enable / disable at runtime.
     *
     * ⚠ Reachable ONLY through the undocumented downcast. `Setting` is an orphan
     * interface in the published API — nothing returns it and nothing extends it
     * — so if `instanceof` fails here, the pre-allocated take-slot idiom (the §3a
     * pattern, on its third occurrence) has no way to hide the slots it is not
     * using, and the panel is a fixed wall of N rows forever.
     */
    private JsonElement uiVisibility(JsonObject params) {
        UiPanel p = requirePanel();
        String ref = params.get("setting").getAsString();
        String action = params.get("action").getAsString();
        Setting setting = UiPanel.asSetting(p.settingByRef(ref));

        JsonObject r = new JsonObject();
        r.addProperty("setting", ref);
        r.addProperty("action", action);
        if (setting == null) {
            // The ○ verdict, reported rather than thrown: the probe wants to
            // record it for every setting kind, not stop at the first.
            r.addProperty("success", false);
            r.addProperty("castWorked", false);
            r.addProperty("error", "the value object does not implement Setting (orphan interface, see UiPanel)");
            return r;
        }
        r.addProperty("castWorked", true);
        switch (action) {
            case "show": setting.show(); break;
            case "hide": setting.hide(); break;
            case "enable": setting.enable(); break;
            case "disable": setting.disable(); break;
            default: throw new IllegalArgumentException("unknown action: " + action);
        }
        r.addProperty("success", true);
        return r;
    }

    /**
     * Row C, second question: can a setting be created AFTER init?
     *
     * No javadoc forbids it and no javadoc permits it. It matters because the
     * whole pre-allocation idiom exists only if the answer is no — if settings
     * can be added on demand, take slots need no scaffold at all, and D4's UI
     * story gets considerably simpler.
     *
     * Failure is reported, not thrown: "Bitwig refuses" and "Bitwig accepts and
     * silently does nothing" are different verdicts, and the probe distinguishes
     * them by asking the user whether the row appeared.
     */
    private JsonElement uiAddSetting(JsonObject params) {
        UiPanel p = requirePanel();
        String label = params.has("label") ? params.get("label").getAsString() : "Late " + (p.lateSettings.size() + 1);
        JsonObject r = new JsonObject();
        r.addProperty("label", label);
        try {
            SettableStringValue created = p.documentState.getStringSetting(label, "Late", 32, "created at runtime");
            p.lateSettings.add(created);
            r.addProperty("success", true);
            r.addProperty("accepted", true);
            r.addProperty("lateSettingCount", p.lateSettings.size());
        } catch (Exception e) {
            r.addProperty("success", false);
            r.addProperty("accepted", false);
            r.addProperty("error", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        return r;
    }

    /*
     * ⚠⚠ THERE IS NO `ui.signalFire`, AND THERE MUST NEVER BE ONE. It existed for
     * exactly one run, on 2026-07-25, and that run KILLED BITWIG. E14-A1.
     *
     *     java.lang.IllegalStateException: This signal cannot be invoked
     *       at com.bitwig.flt.control_surface.values.SignalProxy.doFire
     *       at com.bitwig.flt.control_surface.proxy.ControlSurfaceObject$1.run
     *       at com.bitwig.flt.app.BitwigStudioMain.main
     *
     * Two findings, and the second is the one with teeth.
     *
     * 1. `Signal.fire()` on a `getDocumentState()` setting is REFUSED — the panel
     *    is a human input surface and the API says so. Which means D4's privilege
     *    separation is stronger than D4 itself claimed: the agent cannot press the
     *    human's revert button even if a method existed, because Bitwig will not
     *    let anything but a real click fire that signal.
     *
     * 2. ⚠ THE REFUSAL IS FATAL, AND UNCATCHABLE. Read the trace: the throw
     *    happens on `BitwigStudioMain`'s thread, inside a runnable Bitwig DEFERRED
     *    from our call. Our `fire()` returned normally and the handler's
     *    try/catch saw nothing. There is no extension-side construct that can
     *    contain it, and Bitwig went down with an unsaved project open.
     *
     * The general rule, which is worth more than the row it came from: a handler's
     * try/catch only protects against a SYNCHRONOUS throw. Anything Bitwig defers
     * to its own thread escapes it and takes the application with it. So the
     * discipline is to VALIDATE INPUTS BEFORE CALLING, not to wrap calls and hope
     * — which is why the handlers below bounds-check indices, check enum values
     * against their own option lists, and refuse unknown panel layouts, rather
     * than passing them through and catching.
     *
     * Compare E7-Finding-0, where `getModulationSource(int)` threw at init and
     * took down the extension. This is the same hazard class one level worse: at
     * runtime, and it takes down the DAW.
     */

    // ------------------------------------------------------------------ row F

    /**
     * Row F: notification hygiene around a batch.
     *
     * ⚠ The row as written asks whether `setShouldShow*Notifications(false)`
     * suppresses the spray E1's cursor pointing causes. The javadoc says those
     * are OFF by default and govern notifications the CONTROLLER requests, so
     * switching them off should be a no-op — the spray, if it is Bitwig's own
     * selection feedback, is governed by `getUserNotificationsEnabled()` instead.
     * Both are exposed so the probe can establish which lever, if either, works,
     * and whether the state can be restored afterwards.
     */
    private JsonElement uiNotifications(JsonObject params) {
        UiPanel p = requirePanel();
        JsonObject r = ok();
        if (params.has("enabled")) {
            boolean enabled = params.get("enabled").getAsBoolean();
            p.userNotificationsEnabled.set(enabled);
            r.addProperty("setEnabled", enabled);
        }
        // The eight controller-side switches, each optional. Their javadoc is
        // copy-pasted verbatim across all of them ("selection changes" regardless
        // of what they control), so the names are all there is to go on.
        applyIf(params, r, "selection", v -> p.notifications.setShouldShowSelectionNotifications(v));
        applyIf(params, r, "channel", v -> p.notifications.setShouldShowChannelSelectionNotifications(v));
        applyIf(params, r, "track", v -> p.notifications.setShouldShowTrackSelectionNotifications(v));
        applyIf(params, r, "device", v -> p.notifications.setShouldShowDeviceSelectionNotifications(v));
        applyIf(params, r, "deviceLayer", v -> p.notifications.setShouldShowDeviceLayerSelectionNotifications(v));
        applyIf(params, r, "preset", v -> p.notifications.setShouldShowPresetNotifications(v));
        applyIf(params, r, "mapping", v -> p.notifications.setShouldShowMappingNotifications(v));
        applyIf(params, r, "value", v -> p.notifications.setShouldShowValueNotifications(v));
        putGuarded(r, "userNotificationsEnabled", () -> p.userNotificationsEnabled.get());
        return r;
    }

    private interface BoolSet {
        void accept(boolean value);
    }

    private static void applyIf(JsonObject params, JsonObject result, String key, BoolSet set) {
        if (!params.has(key)) {
            return;
        }
        boolean value = params.get(key).getAsBoolean();
        set.accept(value);
        result.addProperty("set_" + key, value);
    }

    // ------------------------------------------------------------------ row E

    /**
     * Row E: "show me what changed" — put the user in front of Bitwig's own
     * piano roll rather than rendering one (PROJECT_PLAN §3).
     *
     * Three routes exist and they are NOT the same call:
     * `ClipLauncherSlotBank.showInEditor(int)` (API 1, index is bank-relative),
     * `ClipLauncherSlot.showInEditor()` (API 10) and `Clip.showInEditor()`
     * (API 18, "open the detail editor and show the clip"). The probe drives each
     * so a failure can be attributed rather than guessed at.
     */
    private JsonElement uiShowInEditor(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();
        int slotIndex = requireSlotIndex(params.get("slotIndex").getAsInt());
        String via = params.has("via") ? params.get("via").getAsString() : "slot";
        Track track = requireTrack(trackIndex);

        JsonObject r = ok();
        r.addProperty("via", via);
        switch (via) {
            case "slot":
                track.clipLauncherSlotBank().getItemAt(slotIndex).showInEditor();
                break;
            case "bank":
                track.clipLauncherSlotBank().showInEditor(slotIndex);
                break;
            case "clip":
                // Goes through the pool cursor, so the caller must have pointed it
                // first — which is the realistic shape, since anything we would
                // want to show is something we just wrote.
                rig.clip(params.has("cursor") ? params.get("cursor").getAsString() : "0").showInEditor();
                break;
            default:
                throw new IllegalArgumentException("unknown via: " + via);
        }
        if (params.has("panelLayout")) {
            String requested = requirePanelLayout(params.get("panelLayout").getAsString());
            rig.application.setPanelLayout(requested);
            r.addProperty("panelLayoutRequested", requested);
        }
        if (params.has("zoom")) {
            String zoom = params.get("zoom").getAsString();
            if ("fit".equals(zoom)) {
                rig.application.zoomToFit();
            } else if ("selection".equals(zoom)) {
                rig.application.zoomToSelection();
            } else {
                throw new IllegalArgumentException("unknown zoom: " + zoom);
            }
            r.addProperty("zoom", zoom);
        }
        return r;
    }

    /**
     * Read or set the panel layout.
     *
     * ⚠ Only three constants exist — ARRANGE, MIX, EDIT — and the javadoc
     * DESCRIPTIONS for MIX and EDIT are transposed (the literal values in
     * constant-values.html are correct). The available set also "depends on the
     * active display profile", so a name valid under one profile may be a silent
     * no-op under another — hence reading it back rather than assuming.
     */
    private JsonElement uiPanelLayout(JsonObject params) {
        JsonObject r = ok();
        if (params.has("layout")) {
            String layout = requirePanelLayout(params.get("layout").getAsString());
            rig.application.setPanelLayout(layout);
            r.addProperty("requested", layout);
        }
        if (params.has("zoom")) {
            String zoom = params.get("zoom").getAsString();
            if ("fit".equals(zoom)) {
                rig.application.zoomToFit();
            } else if ("selection".equals(zoom)) {
                rig.application.zoomToSelection();
            }
            r.addProperty("zoom", zoom);
        }
        JsonArray known = new JsonArray();
        known.add(Application.PANEL_LAYOUT_ARRANGE);
        known.add(Application.PANEL_LAYOUT_MIX);
        known.add(Application.PANEL_LAYOUT_EDIT);
        r.add("known", known);
        putGuarded(r, "current", () -> rig.application.panelLayout().get());
        return r;
    }

    // ------------------------------------------------------------------ row G

    /**
     * Row G: do the batch delete/duplicate calls really collapse to ONE named
     * undo entry?
     *
     * E3 concluded "there is no grouping hook in the API", and D4 already flags
     * that as too strong: `ControllerHost.deleteObjects(String undoName,
     * DeleteableObject...)` (API 10) and `duplicateObjects(String undoName,
     * DuplicableObject...)` (API 19) both claim to act "within one undo step".
     * That is the ENTIRE javadoc for all four overloads — nothing documents what
     * `undoName` does or where it appears, so both halves need eyes on Bitwig's
     * history, and the count needs a single `app.undo` to see if everything
     * returns at once.
     *
     * ⚠ This does NOT rescue native undo as a revert mechanism. Note and param
     * writes are still ungrouped and the stack is still project-global (E3), so
     * snapshot-replay revert stands unchanged. What it buys is that OUR bulk
     * deletes need not shred the user's own undo history.
     */
    private JsonElement uiDeleteObjects(JsonObject params) {
        JsonArray targets = params.getAsJsonArray("targets");
        ClipLauncherSlot[] slots = resolveSlots(targets);
        JsonObject r = ok();
        r.addProperty("count", slots.length);
        if (params.has("undoName")) {
            String undoName = params.get("undoName").getAsString();
            host.deleteObjects(undoName, (DeleteableObject[]) slots);
            r.addProperty("undoName", undoName);
        } else {
            host.deleteObjects((DeleteableObject[]) slots);
            r.addProperty("undoName", "");
        }
        return r;
    }

    private JsonElement uiDuplicateObjects(JsonObject params) {
        JsonArray targets = params.getAsJsonArray("targets");
        ClipLauncherSlot[] slots = resolveSlots(targets);
        JsonObject r = ok();
        r.addProperty("count", slots.length);
        if (params.has("undoName")) {
            String undoName = params.get("undoName").getAsString();
            host.duplicateObjects(undoName, (DuplicableObject[]) slots);
            r.addProperty("undoName", undoName);
        } else {
            host.duplicateObjects((DuplicableObject[]) slots);
            r.addProperty("undoName", "");
        }
        return r;
    }

    /** `[{trackIndex, slotIndex}, …]` -> slot handles from the pre-allocated bank. */
    private ClipLauncherSlot[] resolveSlots(JsonArray targets) {
        if (targets == null || targets.size() == 0) {
            throw new IllegalArgumentException("targets must be a non-empty array");
        }
        ClipLauncherSlot[] slots = new ClipLauncherSlot[targets.size()];
        for (int i = 0; i < targets.size(); i++) {
            JsonObject t = targets.get(i).getAsJsonObject();
            Track track = requireTrack(t.get("trackIndex").getAsInt());
            slots[i] = track.clipLauncherSlotBank().getItemAt(requireSlotIndex(t.get("slotIndex").getAsInt()));
        }
        return slots;
    }

    // ---------------------------------------------------- pre-call validation
    //
    // ⚠ Every one of these refuses an argument BEFORE it reaches Bitwig, and
    // that is the whole design. See the E14-A1 note above: an argument Bitwig
    // dislikes can produce a throw on ITS thread, after our handler has already
    // returned, where nothing we write can catch it and the application exits.
    // Validating up front is the only mechanism that actually works.

    private int requireSlotIndex(int slotIndex) {
        if (slotIndex < 0 || slotIndex >= rig.config.scenes) {
            throw new IllegalArgumentException(
                "slotIndex out of the pre-allocated scene bank (0.." + (rig.config.scenes - 1) + "): " + slotIndex);
        }
        return slotIndex;
    }

    /**
     * ⚠ Only three layouts exist, and the javadoc DESCRIPTIONS of MIX and EDIT
     * are transposed (the literal constant values are right). The available set
     * also depends on the active display profile, so even a valid name may be a
     * no-op — which is why callers read `panelLayout()` back afterwards.
     */
    private static String requirePanelLayout(String layout) {
        if (Application.PANEL_LAYOUT_ARRANGE.equals(layout)
            || Application.PANEL_LAYOUT_MIX.equals(layout)
            || Application.PANEL_LAYOUT_EDIT.equals(layout)) {
            return layout;
        }
        throw new IllegalArgumentException("unknown panel layout \"" + layout + "\"; expected one of "
            + Application.PANEL_LAYOUT_ARRANGE + ", " + Application.PANEL_LAYOUT_MIX + ", "
            + Application.PANEL_LAYOUT_EDIT);
    }
}

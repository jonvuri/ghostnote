package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * The person's selection at the start of one clip read or one cursor point route, and its D34 restore (8h4a3,
 * E241). The clip reader and the 8h4a5 cursor point route use this one class.
 *
 * <p>Restore while the target group is expanded: a slot selection inside a collapsed group does not take. Collapse
 * only after the host reports the restored slot selection. The host can then move the mixer selection to the
 * group track, so select the entry mixer track again after the host reports the collapse.
 */
final class SelectionEntry {
    /** Polls of 5 ms for the host to report the restored slot, the collapse, and then the entry mixer track. */
    static final int RESELECT_POLLS = 40;

    final int track, row, mixer;
    final boolean stale;
    final Rig.SelectionLease priorLease;

    private SelectionEntry(int track, int row, int mixer, boolean stale, Rig.SelectionLease priorLease) {
        this.track = track; this.row = row; this.mixer = mixer; this.stale = stale; this.priorLease = priorLease;
    }

    /** Capture the current selection. 8h4a: a selection observed in another project is no selection (E233). */
    static SelectionEntry capture(Rig rig) {
        rig.refreshStaleSlotSelection();
        boolean slotCurrent = rig.slotSelectionCurrent(), mixerCurrent = rig.mixerSelectionCurrent();
        return new SelectionEntry(
            slotCurrent ? rig.selectedTrackIndex : -1,
            slotCurrent ? rig.selectedSlotIndex : -1,
            mixerCurrent ? rig.selectedMixerTrackIndex : -1,
            !slotCurrent || !mixerCurrent,
            rig.selectionLease());
    }

    /**
     * Restore all three entry values under the lease {@code token} on the target, then reinstate a prior
     * workflow lease. A lost lease refuses the restore.
     */
    JsonObject restore(Rig rig, String token, int trackIndex, int targetRow) {
        JsonObject s = new JsonObject();
        JsonArray entry = new JsonArray();
        entry.add(track); entry.add(row); entry.add(mixer);
        s.add("entry", entry);
        if (!rig.selectionOwnedBy(token, trackIndex, targetRow)) {
            if (rig.selectionOwnerIs(token)) rig.clearSelectionOwnership();
            s.addProperty("restored", false);
            s.addProperty("reason", "lease-lost");
            return s;
        }
        rig.clearSelectionOwnership();
        boolean slot = track >= 0 && track < rig.config.tracks && row >= 0;
        boolean mixerOk = mixer >= 0 && mixer < rig.config.tracks;
        boolean changed = track != trackIndex || row != targetRow || mixer != trackIndex;
        if (changed && slot) rig.trackBank.getItemAt(track).selectSlot(row);
        if (changed && mixerOk) rig.trackBank.getItemAt(mixer).selectInEditor();
        rig.reinstateSelectionLease(priorLease);
        s.addProperty("restored", slot && mixerOk);
        s.addProperty("changed", changed);
        if (stale) s.addProperty("reason", "entry-selection-from-another-project");
        else if (!slot || !mixerOk) s.addProperty("reason", "entry-selection-outside-bank");
        return s;
    }

    static boolean restored(JsonObject selection) {
        return selection != null && selection.has("restored") && selection.get("restored").getAsBoolean();
    }

    /** The steps after the restore. {@code collapse} collapses the expanded groups (or does nothing). */
    interface Close {
        void collapse();
        /** True when the entry mixer track is to be selected again after the collapse. */
        boolean reselects();
        void finish(JsonObject result);
    }

    /**
     * After the restore, and also after a refusal: when the host reports the restored slot selection, collapse.
     * When the host reports the collapse, select the entry mixer track again (E241). Then finish.
     */
    void close(ControllerHost host, Rig rig, JsonObject selection, ParentGroups.Expansion parents, JsonObject result,
               Close steps) {
        afterRestore(host, rig, selection, parents, result, steps, 0);
    }

    private void afterRestore(ControllerHost host, Rig rig, JsonObject selection, ParentGroups.Expansion parents,
                              JsonObject result, Close steps, int polls) {
        boolean wait = restored(selection) && selection.get("changed").getAsBoolean() && track >= 0
            && !(rig.selectedTrackIndex == track && rig.selectedSlotIndex == row);
        if (wait && polls < RESELECT_POLLS) {
            host.scheduleTask(() -> afterRestore(host, rig, selection, parents, result, steps, polls + 1), 5);
            return;
        }
        if (parents.started()) {
            result.addProperty("slotPolls", polls);
            result.addProperty("slotRestored", !wait);
        }
        steps.collapse();
        awaitCollapsed(host, rig, selection, parents, result, steps, 0);
    }

    private void awaitCollapsed(ControllerHost host, Rig rig, JsonObject selection, ParentGroups.Expansion parents,
                                JsonObject result, Close steps, int polls) {
        boolean pending = parents.pending();
        if (!parents.any() || !restored(selection) || !steps.reselects()) { steps.finish(result); return; }
        if (pending && polls < RESELECT_POLLS) {
            host.scheduleTask(() -> awaitCollapsed(host, rig, selection, parents, result, steps, polls + 1), 5);
            return;
        }
        JsonObject reselect = new JsonObject();
        reselect.addProperty("collapsePolls", polls);
        reselect.addProperty("collapsed", !pending);
        reselect.addProperty("mixerAfterCollapse", rig.selectedMixerTrackIndex);
        reselect.addProperty("slotTrackAfterCollapse", rig.selectedTrackIndex);
        reselect.addProperty("slotAfterCollapse", rig.selectedSlotIndex);
        rig.trackBank.getItemAt(mixer).selectInEditor();
        result.add("mixerReselect", reselect);
        awaitMixer(host, rig, result, reselect, steps, 0);
    }

    private void awaitMixer(ControllerHost host, Rig rig, JsonObject result, JsonObject reselect, Close steps,
                            int polls) {
        if (rig.selectedMixerTrackIndex != mixer && polls < RESELECT_POLLS) {
            host.scheduleTask(() -> awaitMixer(host, rig, result, reselect, steps, polls + 1), 5);
            return;
        }
        reselect.addProperty("mixerPolls", polls);
        reselect.addProperty("mixer", rig.selectedMixerTrackIndex);
        steps.finish(result);
    }
}

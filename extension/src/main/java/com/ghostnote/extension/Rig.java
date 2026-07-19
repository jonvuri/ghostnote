package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ClipLauncherSlotBank;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.SceneBank;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBank;

/**
 * All pre-allocated Bitwig API objects. Everything here must be created
 * during init() (INITIAL_PROMPT §3a); handlers only use these handles.
 *
 * Spike sizes are deliberately modest; E5 probes the real limits.
 */
public class Rig {
    public static final int TRACKS = 16;
    public static final int SCENES = 16;
    public static final int GRID_STEPS = 64;   // 16 beats at 1/16 grid
    public static final int GRID_KEYS = 128;   // full MIDI range: y == pitch
    public static final double STEP_SIZE = 0.25;
    public static final int CURSOR_POOL = 3;

    public final Application application;
    public final TrackBank trackBank;
    public final SceneBank sceneBank;

    /**
     * E1 pool hypothesis: cursor tracks created with
     * shouldFollowSelection=false, each owning a PinnableCursorClip, can be
     * pointed programmatically and pinned to survive user interaction.
     */
    public final CursorTrack[] cursorTracks = new CursorTrack[CURSOR_POOL];
    public final PinnableCursorClip[] cursorClips = new PinnableCursorClip[CURSOR_POOL];

    /** Host-level cursor clip: always follows the user's clip selection. */
    public final Clip followerClip;

    // UI selection tracking, updated by observers on the control-surface
    // thread; read by handlers on the same thread.
    public int selectedTrackIndex = -1;
    public int selectedSlotIndex = -1;
    public int selectionChanges = 0;

    public Rig(ControllerHost host) {
        application = host.createApplication();

        // Flat track list so tracks nested in groups are addressable
        trackBank = host.createTrackBank(TRACKS, 0, SCENES, true);
        sceneBank = trackBank.sceneBank();
        sceneBank.itemCount().markInterested();

        for (int i = 0; i < TRACKS; i++) {
            Track track = trackBank.getItemAt(i);
            track.exists().markInterested();
            track.name().markInterested();
            track.position().markInterested();
            track.trackType().markInterested();

            ClipLauncherSlotBank slots = track.clipLauncherSlotBank();
            for (int j = 0; j < SCENES; j++) {
                ClipLauncherSlot slot = slots.getItemAt(j);
                slot.exists().markInterested();
                slot.hasContent().markInterested();
                slot.isSelected().markInterested();
            }

            final int trackIdx = i;
            slots.addIsSelectedObserver((slotIdx, selected) -> {
                if (selected) {
                    selectedTrackIndex = trackIdx;
                    selectedSlotIndex = slotIdx;
                    selectionChanges++;
                }
            });
        }

        for (int i = 0; i < CURSOR_POOL; i++) {
            cursorTracks[i] = host.createCursorTrack(
                "GN_CT_" + i, "ghostnote cursor " + i, 0, SCENES, /* shouldFollowSelection= */ false);
            cursorTracks[i].exists().markInterested();
            cursorTracks[i].name().markInterested();
            cursorTracks[i].position().markInterested();
            cursorTracks[i].isPinned().markInterested();

            cursorClips[i] = cursorTracks[i].createLauncherCursorClip(GRID_STEPS, GRID_KEYS);
            markClip(cursorClips[i]);
            cursorClips[i].isPinned().markInterested();
        }

        followerClip = host.createLauncherCursorClip(GRID_STEPS, GRID_KEYS);
        markClip(followerClip);
    }

    private static void markClip(Clip clip) {
        clip.setStepSize(STEP_SIZE);
        clip.exists().markInterested();
        clip.getLoopLength().markInterested();
        clip.getTrack().exists().markInterested();
        clip.getTrack().name().markInterested();
        clip.getTrack().position().markInterested();
        clip.clipLauncherSlot().exists().markInterested();
        clip.clipLauncherSlot().sceneIndex().markInterested();
        clip.clipLauncherSlot().name().markInterested();
    }

    /** Resolve "0".."N-1" to a pool clip, or "follower". */
    public Clip clip(String ref) {
        if ("follower".equals(ref)) {
            return followerClip;
        }
        int i = Integer.parseInt(ref);
        if (i < 0 || i >= CURSOR_POOL) {
            throw new IllegalArgumentException("cursor out of range: " + ref);
        }
        return cursorClips[i];
    }
}

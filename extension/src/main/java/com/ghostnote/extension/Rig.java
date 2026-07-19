package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ClipLauncherSlotBank;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
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
    public final com.bitwig.extension.controller.api.Project project;
    public final TrackBank trackBank;
    public final SceneBank sceneBank;

    /**
     * E1 pool hypothesis: cursor tracks created with
     * shouldFollowSelection=false, each owning a PinnableCursorClip, can be
     * pointed programmatically and pinned to survive user interaction.
     */
    public final CursorTrack[] cursorTracks = new CursorTrack[CURSOR_POOL];
    public final PinnableCursorClip[] cursorClips = new PinnableCursorClip[CURSOR_POOL];

    /** Device chain view for each pool cursor track (E3/E4). */
    public static final int DEVICE_BANK = 8;
    public final DeviceBank[] cursorDeviceBanks = new DeviceBank[CURSOR_POOL];

    /** Host-level cursor clip: always follows the user's clip selection. */
    public final Clip followerClip;

    // --- E2 additions ---
    /** Grid width of the fine-resolution clip cursor. */
    public static final int FINE_STEPS = 512;

    /** Cursor with ZERO markInterested/observer calls: observer-gotcha probe. */
    public final CursorTrack bareTrack;
    public final PinnableCursorClip bareClip;

    /** Large-grid cursor for grid-resolution and scan-cost probing. */
    public final CursorTrack fineTrack;
    public final PinnableCursorClip fineClip;

    /** Arrangement cursor clip (follows arranger clip selection). */
    public final Clip arrangerClip;

    // UI selection tracking, updated by observers on the control-surface
    // thread; read by handlers on the same thread.
    public int selectedTrackIndex = -1;
    public int selectedSlotIndex = -1;
    public int selectionChanges = 0;

    public Rig(ControllerHost host) {
        application = host.createApplication();
        application.canUndo().markInterested();
        application.canRedo().markInterested();
        project = host.getProject();

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

            cursorDeviceBanks[i] = cursorTracks[i].createDeviceBank(DEVICE_BANK);
            cursorDeviceBanks[i].itemCount().markInterested();
            for (int d = 0; d < DEVICE_BANK; d++) {
                Device device = cursorDeviceBanks[i].getDevice(d);
                device.exists().markInterested();
                device.name().markInterested();
            }
        }

        followerClip = host.createLauncherCursorClip(GRID_STEPS, GRID_KEYS);
        markClip(followerClip);

        // E2: deliberately NO markInterested / setStepSize on the bare pair
        bareTrack = host.createCursorTrack("GN_CT_BARE", "ghostnote bare cursor", 0, SCENES, false);
        bareClip = bareTrack.createLauncherCursorClip(GRID_STEPS, GRID_KEYS);

        fineTrack = host.createCursorTrack("GN_CT_FINE", "ghostnote fine cursor", 0, SCENES, false);
        fineTrack.position().markInterested();
        fineClip = fineTrack.createLauncherCursorClip(FINE_STEPS, GRID_KEYS);
        markClip(fineClip);
        fineClip.isPinned().markInterested();

        arrangerClip = host.createArrangerCursorClip(GRID_STEPS, GRID_KEYS);
        markClip(arrangerClip);
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

    /** Resolve "0".."N-1", "follower", "bare", "fine", or "arranger". */
    public Clip clip(String ref) {
        switch (ref) {
            case "follower": return followerClip;
            case "bare": return bareClip;
            case "fine": return fineClip;
            case "arranger": return arrangerClip;
            default:
                int i = Integer.parseInt(ref);
                if (i < 0 || i >= CURSOR_POOL) {
                    throw new IllegalArgumentException("cursor out of range: " + ref);
                }
                return cursorClips[i];
        }
    }

    /** Resolve the cursor track that owns a pointable clip cursor. */
    public CursorTrack cursorTrack(String ref) {
        switch (ref) {
            case "bare": return bareTrack;
            case "fine": return fineTrack;
            default:
                return cursorTracks[Integer.parseInt(ref)];
        }
    }

    /** Grid width of a clip cursor (differs for "fine"). */
    public int gridSteps(String ref) {
        return "fine".equals(ref) ? FINE_STEPS : GRID_STEPS;
    }
}

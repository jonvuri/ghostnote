package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ClipLauncherSlotBank;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.CursorDeviceFollowMode;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.Parameter;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.PinnableCursorDevice;
import com.bitwig.extension.controller.api.SpecificBitwigDevice;
import com.bitwig.extension.controller.api.SceneBank;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBank;

/**
 * All pre-allocated Bitwig API objects. Everything here must be created
 * during init() (INITIAL_PROMPT §3a); handlers only use these handles.
 *
 * Sizes come from {@link RigConfig} (E5) so the scale sweep can vary them
 * via ~/.ghostnote/rig.json + a hot-reload, with no rebuild.
 */
public class Rig {
    public static final double STEP_SIZE = 0.25;

    /** Live scaffold sizes for this init. */
    public final RigConfig config;

    /** Nanos spent inside this constructor — the E5 init-cost measurement. */
    public final long constructNanos;

    public final Application application;
    public final com.bitwig.extension.controller.api.Project project;
    public final TrackBank trackBank;
    public final SceneBank sceneBank;

    /**
     * E1 pool hypothesis: cursor tracks created with
     * shouldFollowSelection=false, each owning a PinnableCursorClip, can be
     * pointed programmatically and pinned to survive user interaction.
     */
    public final CursorTrack[] cursorTracks;
    public final PinnableCursorClip[] cursorClips;

    /** Device chain view for each pool cursor track (E3/E4). */
    public final DeviceBank[] cursorDeviceBanks;

    /** Host-level cursor clip: always follows the user's clip selection. */
    public final Clip followerClip;

    // --- E2 additions ---
    /** Cursor with ZERO markInterested/observer calls: observer-gotcha probe. */
    public final CursorTrack bareTrack;
    public final PinnableCursorClip bareClip;

    /** Large-grid cursor for grid-resolution and scan-cost probing. */
    public final CursorTrack fineTrack;
    public final PinnableCursorClip fineClip;

    /** Arrangement cursor clip (follows arranger clip selection). */
    public final Clip arrangerClip;

    // --- E4: direct-parameter apparatus on pool cursor 0 ---
    /** Polysynth device UUID (harvested from the app bundle, E3). */
    public static final String POLYSYNTH_UUID = "a9ffacb5-33e9-4fc7-8621-b1af31e410ef";
    /**
     * Curated Polysynth parameter IDs (harvested from the device's
     * Default.bwpreset). 16 handles = proof past the 8-per-remote-page
     * ceiling (§6a). Section markers (CONTENTS/MODULATORS/FAKE*) excluded.
     */
    public static final String[] POLYSYNTH_PARAM_IDS = {
        "F1FREQ", "F1RESO", "HPFFREQ", "HPF_RESONANCE",
        "OSCMIX", "OSC1_SHAPE", "OSC2_SHAPE", "OSC1_PITCH",
        "OSC2PITCH", "OSC1_UNISON_VOICES", "GAIN", "GLIDE_TIME",
        "NOISE", "FEGDEPTH", "FEEDBACK", "DEPTH",
    };

    /** Repointable device cursor on pool cursor track 0. */
    public final PinnableCursorDevice cursorDevice0;
    public final SpecificBitwigDevice polysynthView0;
    /** IDs actually bound, index-parallel to {@link #polysynthParams0}. */
    public final String[] paramIds;
    public final Parameter[] polysynthParams0;

    /**
     * DirectParameter API state for cursorDevice0 — the format-AGNOSTIC path
     * (works on VST/CLAP/Bitwig alike, self-enumerating). Maps are written by
     * observer callbacks and read by handlers, both on the control-surface
     * thread, so no synchronization is needed. LinkedHashMap preserves the
     * device's own parameter order.
     */
    public volatile String[] directParamIds = new String[0];
    public final java.util.Map<String, String> directParamNames = new java.util.LinkedHashMap<>();
    public final java.util.Map<String, Double> directParamValues = new java.util.LinkedHashMap<>();
    public final java.util.Map<String, String> directParamDisplays = new java.util.LinkedHashMap<>();

    // UI selection tracking, updated by observers on the control-surface
    // thread; read by handlers on the same thread.
    public int selectedTrackIndex = -1;
    public int selectedSlotIndex = -1;
    public int selectionChanges = 0;

    public Rig(ControllerHost host, RigConfig config) {
        long start = System.nanoTime();
        this.config = config;

        cursorTracks = new CursorTrack[config.cursorPool];
        cursorClips = new PinnableCursorClip[config.cursorPool];
        cursorDeviceBanks = new DeviceBank[config.cursorPool];

        application = host.createApplication();
        application.canUndo().markInterested();
        application.canRedo().markInterested();
        project = host.getProject();

        // Flat track list so tracks nested in groups are addressable
        trackBank = host.createTrackBank(config.tracks, 0, config.scenes, true);
        sceneBank = trackBank.sceneBank();
        sceneBank.itemCount().markInterested();

        for (int i = 0; i < config.tracks; i++) {
            Track track = trackBank.getItemAt(i);
            track.exists().markInterested();
            track.name().markInterested();
            track.position().markInterested();
            track.trackType().markInterested();
            track.channelId().markInterested();

            ClipLauncherSlotBank slots = track.clipLauncherSlotBank();
            for (int j = 0; j < config.scenes; j++) {
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

        for (int i = 0; i < config.cursorPool; i++) {
            cursorTracks[i] = host.createCursorTrack(
                "GN_CT_" + i, "ghostnote cursor " + i, 0, config.scenes, /* shouldFollowSelection= */ false);
            cursorTracks[i].exists().markInterested();
            cursorTracks[i].name().markInterested();
            cursorTracks[i].position().markInterested();
            cursorTracks[i].channelId().markInterested();
            cursorTracks[i].isPinned().markInterested();

            cursorClips[i] = cursorTracks[i].createLauncherCursorClip(config.gridSteps, config.gridKeys);
            markClip(cursorClips[i]);
            cursorClips[i].isPinned().markInterested();

            cursorDeviceBanks[i] = cursorTracks[i].createDeviceBank(config.deviceBank);
            cursorDeviceBanks[i].itemCount().markInterested();
            for (int d = 0; d < config.deviceBank; d++) {
                Device device = cursorDeviceBanks[i].getDevice(d);
                device.exists().markInterested();
                device.name().markInterested();
            }
        }

        followerClip = host.createLauncherCursorClip(config.gridSteps, config.gridKeys);
        markClip(followerClip);

        // E2: deliberately NO markInterested / setStepSize on the bare pair
        bareTrack = host.createCursorTrack("GN_CT_BARE", "ghostnote bare cursor", 0, config.scenes, false);
        bareClip = bareTrack.createLauncherCursorClip(config.gridSteps, config.gridKeys);

        fineTrack = host.createCursorTrack("GN_CT_FINE", "ghostnote fine cursor", 0, config.scenes, false);
        fineTrack.position().markInterested();
        fineClip = fineTrack.createLauncherCursorClip(config.fineSteps, config.gridKeys);
        markClip(fineClip);
        fineClip.isPinned().markInterested();

        arrangerClip = host.createArrangerCursorClip(config.gridSteps, config.gridKeys);
        markClip(arrangerClip);

        // E4: device cursor on pool cursor track 0, auto-following the first
        // instrument of whatever track cursorTracks[0] is pointed at.
        cursorDevice0 = cursorTracks[0].createCursorDevice(
            "GN_DEV_0", "ghostnote device 0", 0, CursorDeviceFollowMode.FIRST_INSTRUMENT);
        cursorDevice0.exists().markInterested();
        cursorDevice0.name().markInterested();
        cursorDevice0.isPinned().markInterested();

        // Param handles: the curated ID list, cycled if the E5 config asks for
        // more handles than we have distinct IDs. Duplicates still allocate
        // distinct handles, which is what the scale measurement is about.
        polysynthView0 = cursorDevice0.createSpecificBitwigDevice(
            java.util.UUID.fromString(POLYSYNTH_UUID));
        paramIds = new String[config.paramHandles];
        polysynthParams0 = new Parameter[config.paramHandles];
        for (int p = 0; p < config.paramHandles; p++) {
            String id = POLYSYNTH_PARAM_IDS[p % POLYSYNTH_PARAM_IDS.length];
            Parameter param = polysynthView0.createParameter(id);
            param.exists().markInterested();
            param.name().markInterested();
            param.value().markInterested();
            param.value().displayedValue().markInterested();
            paramIds[p] = id;
            polysynthParams0[p] = param;
        }

        // Format-agnostic DirectParameter observers (E4b — CLAP access test).
        // Callbacks fire on the control-surface thread.
        if (config.directObservers) {
            cursorDevice0.addDirectParameterIdObserver(ids -> {
                directParamIds = ids != null ? ids : new String[0];
            });
            cursorDevice0.addDirectParameterNameObserver(48, (id, name) -> {
                directParamNames.put(id, name);
            });
            cursorDevice0.addDirectParameterNormalizedValueObserver((id, value) -> {
                directParamValues.put(id, value);
            });
            cursorDevice0.addDirectParameterValueDisplayObserver(48, (id, display) -> {
                directParamDisplays.put(id, display);
            });
        }

        constructNanos = System.nanoTime() - start;
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
                if (i < 0 || i >= config.cursorPool) {
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
        return "fine".equals(ref) ? config.fineSteps : config.gridSteps;
    }
}

package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ClipLauncherSlotBank;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.ChainSelector;
import com.bitwig.extension.controller.api.CursorDeviceFollowMode;
import com.bitwig.extension.controller.api.CursorDeviceLayer;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.DeviceLayer;
import com.bitwig.extension.controller.api.DeviceLayerBank;
import com.bitwig.extension.controller.api.CursorRemoteControlsPage;
import com.bitwig.extension.controller.api.DrumPad;
import com.bitwig.extension.controller.api.DrumPadBank;
import com.bitwig.extension.controller.api.Parameter;
import com.bitwig.extension.controller.api.RemoteControl;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.PinnableCursorDevice;
import com.bitwig.extension.controller.api.Send;
import com.bitwig.extension.controller.api.SendBank;
import com.bitwig.extension.controller.api.SpecificBitwigDevice;
import com.bitwig.extension.controller.api.SceneBank;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBankContentFilter;
import com.bitwig.extension.controller.api.TrackBank;
import com.bitwig.extension.controller.api.Transport;

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

    // --- E4c: device nesting (layers / drum pads / slots / chain selector) ---
    /** Container-device UUIDs, harvested from the bundle like E3/E4. */
    public static final String INSTRUMENT_LAYER_UUID = "5024be2e-65d6-4d40-bbfe-8b2ea993c445";
    public static final String INSTRUMENT_SELECTOR_UUID = "9588fbcf-721a-438b-8555-97e4231f7d2c";

    public static final int LAYER_BANK = 8;
    public static final int LAYER_DEVICE_BANK = 4;
    public static final int DRUM_PAD_BANK = 16;

    /**
     * Nesting views on cursorDevice0. All four Bitwig nesting mechanisms are
     * distinct API surfaces, so the rig carries one of each:
     * layers (Instrument/FX Layer), drum pads (Drum Machine), named slots,
     * and chain selectors (Instrument/FX Selector).
     */
    public final DeviceLayerBank layerBank0;
    /** Device chains INSIDE each layer — how we see/insert one level down. */
    public final DeviceBank[] layerDeviceBanks = new DeviceBank[LAYER_BANK];
    public final CursorDeviceLayer cursorLayer0;
    public final DrumPadBank drumPadBank0;
    public final ChainSelector chainSelector0;

    // --- E7: modulation access via remote controls ---
    /**
     * The classic modulation API (Device.getModulationSource / Macro /
     * ModulationSource) is HARD-deprecated: calling getModulationSource(int)
     * at init throws deprecatedFail ("Use remote controls instead") and takes
     * the whole extension down (verified — see FINDINGS E7). So the only
     * non-deprecated modulation-adjacent surface is the remote-controls page.
     * RemoteControl extends Parameter, so it carries value()/modulatedValue()
     * plus isBeingMapped() — the modern equivalent of the map idiom.
     */
    public static final int REMOTE_BANK = 8;
    public final CursorRemoteControlsPage remotePage0;
    public final RemoteControl[] remotes0 = new RemoteControl[REMOTE_BANK];

    /** E7e: transport, so probes can hold a note playing (per-voice modulators
     * output nothing while the project is silent). */
    public final Transport transport;

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

    // --- E16: mixer state + the audibility oracle ---
    /**
     * Sends per bank track, sized by {@link RigConfig#sends} — see the warning
     * there, and at the `createTrackBank` call below, about why 0 is fatal.
     * Null when the config asks for none, so every reader must check.
     */
    public final SendBank[] sendBanks;

    /**
     * VU meters per bank track — the ONE programmatic oracle for "is this track
     * making sound right now".
     *
     * Rows E2 and E5 are audio-correctness questions ("does mute cut sends",
     * "is there a window where both branches are audible") and the obvious
     * method is human ears, which cannot see a 100ms window. `vuNow` is the last
     * reported level; `vuHold` is a peak that only rises, so a probe can arm it,
     * do something, and ask *did any signal appear at all* — which is the
     * question, and it is answerable in a way ears are not.
     *
     * ⚠ Bank-INDEXED, so a structural change re-points these at whatever track
     * now sits at that index. Callers reset the hold and re-read the bank rather
     * than holding an index across a duplicate.
     */
    /** What `setContentFilter` actually did at init — echoed by rig.stats. */
    public String contentFilterApplied = "not-requested";

    public static final int VU_RANGE = 128;
    public final int[] vuNow;
    public final int[] vuHold;
    /**
     * ⚠ The channelId last seen in each bank SLOT, so a stale hold can be
     * detected instead of silently returned. See the note in `BranchHandlers.vu`:
     * a duplicate shifts every track below it down a slot, and without this the
     * accumulated peak of the slot's PREVIOUS occupant is handed back under the
     * new track's identity.
     */
    public final String[] vuIdentity;

    // UI selection tracking, updated by observers on the control-surface
    // thread; read by handlers on the same thread.
    public int selectedTrackIndex = -1;
    public int selectedSlotIndex = -1;
    public int selectionChanges = 0;

    // --- E16 §3.4f: is a clip move DETECTABLE, and by what? ---
    /**
     * ⚠ The instrument for "what observable, if any, changes when a clip moves".
     *
     * The question is NOT whether `sceneEpoch` moves. That counter lives in the
     * brain and is bumped by our own scene ops, so it definitionally cannot see
     * an edit we did not make — asking it would be asking ourselves. The real
     * question is whether ANYTHING Bitwig-side reports the move, and there are
     * two candidate answers with very different consequences:
     *
     *   POLLED  — `hasContent` differs at the old and new slots, which is only
     *             visible if you re-read both, i.e. only if you already suspected.
     *             That is the §1 tolerant fallback restated, not a detector.
     *   PUSHED  — an observer fires. Then a move is detectable for free, without
     *             polling and without suspicion, and moved clips become cheap.
     *
     * `ClipLauncherSlotBank.addHasContentObserver` is the pushed candidate: one
     * INDEXED callback per bank row covering all its slots, the same shape as the
     * `addIsSelectedObserver` below. A move should therefore arrive as TWO
     * callbacks — false at the source, true at the destination.
     *
     * ⚠ The log holds the last {@link #CONTENT_LOG} events by NAME, not a bare
     * count, and that is deliberate: `e16r-diag` classified a true result as
     * "PARTIAL/OTHER" because it counted the tracks that dropped out of the bank
     * instead of naming them, and naming them turned an unexplained pattern into
     * the headline. A count here would say "something changed"; the log says
     * "(2,1) emptied and (2,5) filled", which is the finding.
     *
     * ⚠ Written by observers on the control-surface thread and read by handlers
     * on the same thread — the `selectedTrackIndex` and directParam-map pattern
     * exactly, so no synchronization (see ExecState's note on confinement).
     *
     * ⚠ Bitwig delivers INITIAL values through these callbacks too, so the epoch
     * is nonzero and meaningless in absolute terms. Only a DIFFERENCE across a
     * known event means anything, and every reader must baseline it first.
     */
    public static final int CONTENT_LOG = 24;
    public int launcherContentEpoch = 0;
    public final String[] contentLog = new String[CONTENT_LOG];

    /**
     * The scene-count observer §3.2 approved moving into the extension.
     *
     * Nearly free here, and it closes the loop on a decision rather than an open
     * question: `adapters/live/adapter.ts` defers foreign-scene-edit detection to
     * the daemon, §3.2.3 moved that job here instead, and this is whether the job
     * can actually be done from here. ⚠ §3.2.3 already names its own limit — a
     * count observer catches create and delete but cannot see a MOVE — so this
     * field and `launcherContentEpoch` above are deliberately separate: if the
     * count sits still while the content log fills, that is the limit measured
     * rather than predicted.
     */
    public int sceneCountChanges = 0;
    public int lastSceneCount = -1;

    // --- E16 §3.4g: ObjectProxy.createEqualsValue, pre-allocated ---
    /**
     * ⚠ E16l's find, and a `create*` — the exact shape that has thrown *"can only
     * be called during driver initialization"* four times (standing rule 13), so
     * every one of these is built HERE and revealed later, never created on demand.
     * `equals.tryCreate` asks the runtime question directly.
     *
     * Keyed by a self-describing name (`ct0=bank3`, `clip0=follower`) rather than
     * indexed, because the probe should read what it is comparing rather than
     * decode a coordinate — the same reason the content log holds names.
     *
     * ⚠ What this can and cannot be. It compares two LIVE PROXIES WE HOLD, so the
     * only pairs that exist are the ones whose both halves are pre-allocated: the
     * 3 pool cursors and the 16 bank rows. That makes two guards buildable —
     * "is my pinned cursor still the track at position n?" (cursor↔bank) and "are
     * two pool cursors aliased onto one object?" (cursor↔cursor, which is E2c's
     * fixture-contamination root cause) — and it makes the guard D6 actually wants
     * for CLIPS unbuildable, because there is no second persistent proxy on the
     * intended clip. Measured rather than assumed; the clip pairs below are what
     * measure it.
     */
    public final java.util.Map<String, com.bitwig.extension.controller.api.BooleanValue>
        equalsProbes = new java.util.LinkedHashMap<>();
    /** Where the equals build got to — a status string, never a throw (see below). */
    public String equalsStatus = "not-attempted";
    /** Ditto for the DeviceLayer mixer handles: E16 §3.4 lead, `Channel` on a layer. */
    public String layerMixerStatus = "not-attempted";

    public Rig(ControllerHost host, RigConfig config) {
        long start = System.nanoTime();
        this.config = config;

        cursorTracks = new CursorTrack[config.cursorPool];
        cursorClips = new PinnableCursorClip[config.cursorPool];
        cursorDeviceBanks = new DeviceBank[config.cursorPool];
        sendBanks = new SendBank[config.tracks];
        vuNow = new int[config.tracks];
        vuHold = new int[config.tracks];
        vuIdentity = new String[config.tracks];

        application = host.createApplication();
        application.canUndo().markInterested();
        application.canRedo().markInterested();
        project = host.getProject();

        // Flat track list so tracks nested in groups are addressable.
        //
        // ⚠ The second argument is the SEND-BANK size and it was 0 until E16.
        // `Channel.sendBank()` on a 0-send bank does not return an empty bank —
        // it throws `No send bank exists: Requested a send bank size of 0` from
        // inside this constructor and the extension never starts (measured, E16;
        // standing rules 9/13). Sends are a bank-creation-time decision, so
        // reading a send later is impossible unless we asked for them here.
        trackBank = host.createTrackBank(config.tracks, config.sends, config.scenes, true);

        // ⚠ E16: what the bank is allowed to SEE, and it is not a cosmetic choice.
        //
        // The legacy createTrackBank above behaves as ALL_VISIBLE_CHANNELS, where
        // "visible" means the human's mixer folding. A COLLAPSED group's children
        // therefore leave the bank: itemCount drops and resolveByChannelId answers
        // `found:false` — indistinguishable from a DELETED track (E2f/D1) — while
        // the child is still audibly playing. ALL_CHANNELS is documented as
        // including tracks "not visible in the mixer" and is the candidate fix.
        //
        // Applied only when asked for, because it changes the meaning of every
        // bank read including standing rule 5's accounting. Guarded: an unknown
        // name must not throw from this constructor (E7-Finding-0 / rule 3c) and
        // a Beta API that disappears in a later Bitwig must not brick init.
        if (!config.contentFilter.isEmpty()) {
            try {
                trackBank.setContentFilter(TrackBankContentFilter.valueOf(config.contentFilter));
                contentFilterApplied = config.contentFilter;
            } catch (Throwable t) {
                contentFilterApplied = "FAILED:" + t.getClass().getSimpleName() + ":" + t.getMessage();
            }
        }

        // Bank-window overflow detection (E5, standing rule 5). Tracks outside the
        // window are ABSENT, not slow — channelId resolves only inside it — which
        // makes an over-large project a checkpoint blind spot rather than a
        // performance problem. Without a total count there is no way to tell "16
        // tracks exist" from "16 are visible of 54", so the rule is unimplementable.
        //
        // ⚠ ◐ UNPROVEN: whether Bank.itemCount() reports the PROJECT's track count
        // or merely the window size is not yet established — E5 measured overflow
        // against a project whose size it already knew. Probed live in Phase 0.
        //
        // ⚠ markInterested() at init() is the E7-Finding-0 hazard class: a handle
        // that throws here takes the whole extension down before the bridge binds.
        // itemCount() is not @Deprecated and the identical call is already marked
        // on sceneBank below, so this is low risk — but it is still the first thing
        // verified after any deploy.
        trackBank.itemCount().markInterested();

        sceneBank = trackBank.sceneBank();
        sceneBank.itemCount().markInterested();
        // §3.2.3's approved extension-side scene epoch, as an actual observer
        // rather than a proposal. Its documented blind spot — a scene MOVE, which
        // changes no count — is what §3.4f is measuring next to it.
        sceneBank.itemCount().addValueObserver(count -> {
            if (count != lastSceneCount) {
                lastSceneCount = count;
                sceneCountChanges++;
            }
        });

        for (int i = 0; i < config.tracks; i++) {
            Track track = trackBank.getItemAt(i);
            track.exists().markInterested();
            track.name().markInterested();
            track.position().markInterested();
            track.trackType().markInterested();
            track.channelId().markInterested();

            // E16 row B5: the mixer state a duplicate either carries or does not.
            // All of these are the MODERN accessors — the `getVolume()`/`getMute()`
            // family is @Deprecated at v25 and standing rule 9 says a deprecated
            // handle marked at init can take the whole extension down.
            track.volume().value().markInterested();
            track.volume().value().displayedValue().markInterested();
            track.pan().value().markInterested();
            track.mute().markInterested();
            track.solo().markInterested();
            track.isMutedBySolo().markInterested();
            track.isActivated().markInterested();
            track.color().markInterested();
            track.isGroup().markInterested();
            // Rows E3/E4/F2: a group's expanded state is the one group control
            // that IS settable from here, so it is the candidate answer to
            // "can the branches be collapsed out of the human's way".
            track.isGroupExpanded().markInterested();

            // Guarded on config.sends because sendBank() THROWS at size 0, and a
            // throw here is the whole extension (E16, above).
            if (config.sends > 0) {
                sendBanks[i] = track.sendBank();
                sendBanks[i].itemCount().markInterested();
                for (int s = 0; s < config.sends; s++) {
                    Send send = sendBanks[i].getItemAt(s);
                    send.exists().markInterested();
                    send.name().markInterested();
                    send.value().markInterested();
                    send.isEnabled().markInterested();
                    send.isPreFader().markInterested();
                    // Row E2 needs to DRIVE pre/post, not just observe it: whether
                    // mute cuts a send is a different question in each mode, and
                    // `isPreFader()` is read-only. `sendMode()` is the settable
                    // side (AUTO/PRE/POST, API v10, not deprecated — rule 9).
                    send.sendMode().markInterested();
                }
            }

            final int vuIdx = i;
            track.addVuMeterObserver(VU_RANGE, -1, true, level -> {
                vuNow[vuIdx] = level;
                if (level > vuHold[vuIdx]) {
                    vuHold[vuIdx] = level;
                }
            });

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

            // §3.4f — the pushed half of "is a clip move detectable". One indexed
            // observer covers every slot in this bank row, so the whole grid costs
            // `tracks` observers rather than `tracks × scenes`.
            slots.addHasContentObserver((slotIdx, has) -> {
                contentLog[launcherContentEpoch % CONTENT_LOG] =
                    "t" + trackIdx + "s" + slotIdx + (has ? "=filled" : "=emptied");
                launcherContentEpoch++;
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
        // E4c: nesting introspection on whatever the cursor points at.
        cursorDevice0.hasLayers().markInterested();
        cursorDevice0.hasDrumPads().markInterested();
        cursorDevice0.hasSlots().markInterested();
        cursorDevice0.slotNames().markInterested();
        cursorDevice0.isNested().markInterested();

        // E4c: one view per nesting mechanism. These are created against a
        // cursor device whose type changes as it repoints, so a view that
        // does not apply to the current device simply reports nothing.
        layerBank0 = cursorDevice0.createLayerBank(LAYER_BANK);
        for (int l = 0; l < LAYER_BANK; l++) {
            DeviceLayer layer = layerBank0.getItemAt(l);
            layer.exists().markInterested();
            layer.name().markInterested();
            layerDeviceBanks[l] = layer.createDeviceBank(LAYER_DEVICE_BANK);
            for (int d = 0; d < LAYER_DEVICE_BANK; d++) {
                Device nested = layerDeviceBanks[l].getDevice(d);
                nested.exists().markInterested();
                nested.name().markInterested();
            }
        }

        // ⚠ E16 — the DeviceLayer-mute lead, and the reason it is a SEPARATE,
        // GUARDED loop rather than five more lines in the one above.
        //
        // `DeviceLayer` declares ZERO members of its own; everything it has is
        // inherited, and its superinterfaces include `Channel` — which carries
        // mute/solo/volume/pan/channelId. If those work on a layer chain then a
        // device-scoped A/B needs no chain selector, no human-built preset and no
        // bank slot, and the 4-chain Instrument Layer fixture already on disk is
        // enough to test it. That reaches the master and the FX returns, which the
        // track-native model cannot, and which E16r showed are the FIRST things to
        // leave the addressable set as a lineage grows.
        //
        // ⚠ But a supertype method is a claim, not a capability, and this exact
        // object has already proved it: `DeviceLayer.duplicateObject()` and
        // `Channel.duplicate()` are both silent no-ops on a layer (E4d routes 1–2).
        // The prior here is better than that — those are STRUCTURAL verbs and E4e
        // explains their failure architecturally (an insertion point must bind to a
        // referent, and a layer that does not exist has none), whereas mute() is
        // state on a chain that already exists. Better is not proof, so the probe
        // brackets it with controls and the ear, exactly as E16n did.
        //
        // The guard is standing rules 9/13: a throw in this constructor is the
        // whole extension, before the bridge binds. `sendBank()` at size 0 already
        // did precisely that once, so an unproven handle gets a status string and
        // not a stack trace. `channelId()` is marked with them because if a layer
        // HAS one, layers have durable identity — a fact nothing has ever asked
        // for and which E16l's "channelId is the only identity" would gain a whole
        // new population from.
        int layerMixerMarked = 0;
        try {
            for (int l = 0; l < LAYER_BANK; l++) {
                DeviceLayer layer = layerBank0.getItemAt(l);
                layer.mute().markInterested();
                layer.solo().markInterested();
                layer.isActivated().markInterested();
                layer.volume().value().markInterested();
                layer.pan().value().markInterested();
                layer.channelId().markInterested();
                layerMixerMarked++;
            }
            layerMixerStatus = "marked:" + layerMixerMarked;
        } catch (Throwable t) {
            layerMixerStatus = "FAILED@" + layerMixerMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }

        cursorLayer0 = cursorDevice0.createCursorLayer();
        cursorLayer0.exists().markInterested();
        cursorLayer0.name().markInterested();

        drumPadBank0 = cursorDevice0.createDrumPadBank(DRUM_PAD_BANK);
        for (int p = 0; p < DRUM_PAD_BANK; p++) {
            DrumPad pad = drumPadBank0.getItemAt(p);
            pad.exists().markInterested();
            pad.name().markInterested();
        }

        chainSelector0 = cursorDevice0.createChainSelector();
        chainSelector0.exists().markInterested();
        chainSelector0.activeChainIndex().markInterested();
        chainSelector0.chainCount().markInterested();

        // E7: remote-controls page on cursorDevice0 (the modern modulation-
        // mapping surface Bitwig points to). Re-scopes as the cursor repoints.
        remotePage0 = cursorDevice0.createCursorRemoteControlsPage(REMOTE_BANK);
        remotePage0.pageCount().markInterested();
        remotePage0.selectedPageIndex().markInterested();
        remotePage0.pageNames().markInterested();
        for (int r = 0; r < REMOTE_BANK; r++) {
            RemoteControl rc = remotePage0.getParameter(r);
            rc.exists().markInterested();
            rc.name().markInterested();
            rc.value().markInterested();
            rc.modulatedValue().markInterested();
            rc.isBeingMapped().markInterested();
            remotes0[r] = rc;
        }

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
            param.modulatedValue().markInterested(); // E7: post-modulation value
            paramIds[p] = id;
            polysynthParams0[p] = param;
        }

        transport = host.createTransport();
        transport.isPlaying().markInterested();

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

        // ⚠ E16 §3.4g — the equals matrix. Last in the constructor deliberately:
        // every proxy it pairs must already exist, and being last means a failure
        // here costs nothing that came before it.
        equalsStatus = buildEqualsProbes();

        constructNanos = System.nanoTime() - start;
    }

    /**
     * Pre-allocate every `createEqualsValue` pair we could want, and mark them.
     *
     * ⚠ Returns a status string and never throws, for the reason standing rule 13
     * exists: this is a `create*` at init and the failure mode it guards against
     * is the extension not starting at all. A bricked init is indistinguishable
     * from a bricked deploy from the probe's side, and we would spend a restart
     * finding that out. `not-attempted` / `built:N` / `FAILED@N:…` says which.
     *
     * The four families, and what each is a guard FOR:
     *
     *   ct{i}=bank{n}   ⚠ the one D6 would actually use — "is pinned cursor i
     *                   still the track at bank position n?". Name-and-position
     *                   verification is what D6 does today; this is identity, and
     *                   it should survive a rename (which the name check fails)
     *                   and go false on a position shift (which nothing catches).
     *   ct{i}=ct{j}     cursor aliasing. E2c's fixture contamination was two
     *                   cursors on one track, diagnosed after the fact from
     *                   symptoms; this would have said so directly. E16r sharpened
     *                   it: a cursor past the pool THROWS, but two cursors pointed
     *                   at one track is silent and still wrong.
     *   clip{i}=clip{j} the same, one level down — and the honest test of whether
     *   clip{i}=follower this helps CLIPS at all. E16l proved clips have no
     *                   identity; if these read true only when two cursors are
     *                   pointed at the same slot, that is a cursor guard wearing a
     *                   clip's clothes, not the clip identity D6 wants.
     *   dev0=chain{d}   "is the device cursor still the device at chain index d?",
     *                   which is the E3 hazard — deleting device[0] slides the
     *                   survivor from 1 to 0 under any index we were holding.
     */
    private String buildEqualsProbes() {
        int built = 0;
        try {
            for (int i = 0; i < config.cursorPool; i++) {
                for (int n = 0; n < config.tracks; n++) {
                    equalsProbes.put("ct" + i + "=bank" + n,
                        cursorTracks[i].createEqualsValue(trackBank.getItemAt(n)));
                    built++;
                }
            }
            for (int i = 0; i < config.cursorPool; i++) {
                for (int j = i + 1; j < config.cursorPool; j++) {
                    equalsProbes.put("ct" + i + "=ct" + j,
                        cursorTracks[i].createEqualsValue(cursorTracks[j]));
                    equalsProbes.put("clip" + i + "=clip" + j,
                        cursorClips[i].createEqualsValue(cursorClips[j]));
                    built += 2;
                }
            }
            for (int i = 0; i < config.cursorPool; i++) {
                equalsProbes.put("clip" + i + "=follower",
                    cursorClips[i].createEqualsValue(followerClip));
                built++;
            }
            for (int d = 0; d < config.deviceBank; d++) {
                equalsProbes.put("dev0=chain" + d,
                    cursorDevice0.createEqualsValue(cursorDeviceBanks[0].getDevice(d)));
                built++;
            }
            // ⚠ Marked in a second pass, not inline. Creating and marking are two
            // separate hazards (E2's observer gotcha is about reading an unmarked
            // value; rule 13 is about creating at the wrong time), and separating
            // them means the status string says which one failed.
            for (com.bitwig.extension.controller.api.BooleanValue v : equalsProbes.values()) {
                v.markInterested();
            }
            return "built:" + built;
        } catch (Throwable t) {
            return "FAILED@" + built + ":" + t.getClass().getSimpleName() + ":" + t.getMessage();
        }
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

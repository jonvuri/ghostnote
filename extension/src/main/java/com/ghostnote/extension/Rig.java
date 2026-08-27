package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.HardwareActionBindable;
import com.bitwig.extension.controller.api.NotificationSettings;
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
import com.bitwig.extension.controller.api.SpecificPluginDevice;
import com.bitwig.extension.controller.api.SceneBank;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBankContentFilter;
import com.bitwig.extension.controller.api.TrackBank;
import com.bitwig.extension.controller.api.Transport;
import com.ghostnote.extension.generated.NativeDeviceCatalog;
import java.util.ArrayList;
import java.util.List;

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
    /**
     * ⚠ E17 — the SECOND, independent oracle for "did the device-layer selection
     * actually change". `NotificationSettings` carries a toggle dedicated to it:
     *
     *     setShouldShowSelectionNotifications
     *     setShouldShowChannelSelectionNotifications
     *     setShouldShowTrackSelectionNotifications
     *     setShouldShowDeviceSelectionNotifications
     *   ⚠ setShouldShowDeviceLayerSelectionNotifications   ← its own channel
     *
     * That Bitwig ships a separate notification for device-layer selection is
     * independent evidence the concept exists internally, distinct from device
     * selection. Switched on, it makes the state change VISIBLE to the operator —
     * so "does a human click change it" and "does our selectInEditor change it"
     * can be compared by eye, without depending on the observer alone.
     *
     * ⚠ Two instruments that can disagree is the point (rule 10). One readback
     * agreeing with itself is not evidence.
     */
    public NotificationSettings notifications;
    public String notificationsStatus = "not-attempted";
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

    /** Dedicated cursor for exact note reads and grid-resolution probes. */
    public final CursorTrack fineTrack;
    public final PinnableCursorClip fineClip;

    /** Dedicated note-event cursor and bounded evidence log. */
    public final CursorTrack noteObserverTrack;
    public final PinnableCursorClip noteObserverClip;
    public final NoteObserverProbe noteObserver = new NoteObserverProbe();

    /** Arrangement cursor clip (follows arranger clip selection). */
    public final Clip arrangerClip;

    // --- E4: direct-parameter apparatus on pool cursor 0 ---
    /** Repointable device cursor on pool cursor track 0. */
    public final PinnableCursorDevice cursorDevice0;
    /** Current-chain siblings, used to confirm a nested cursor position. */
    public final DeviceBank cursorDeviceSiblings0;
    /** Route selected for the current DirectParameter cursor target. */
    public int directParameterTopLevelIndex = -1;
    public final List<String> directParameterRouteKinds = new ArrayList<>();
    public final List<String> directParameterRouteNames = new ArrayList<>();
    public final List<Integer> directParameterRouteChannels = new ArrayList<>();
    public final List<Integer> directParameterRouteDeviceIndices = new ArrayList<>();
    public final SpecificBitwigDevice polysynthView0;
    /** IDs actually bound, index-parallel to {@link #polysynthParams0}. */
    public final String[] paramIds;
    public final Parameter[] polysynthParams0;
    /** Typed v1 Kick parameters that supplement format-agnostic observers. */
    public final SpecificBitwigDevice v1KickView0;
    public final String[] v1KickParamIds;
    public final Parameter[] v1KickParams0;
    /** One measured VST3 parameter witness for general public target proof. */
    public final SpecificPluginDevice zebra3Vst3View0;
    public final String[] zebra3Vst3ParamIds;
    public final Parameter[] zebra3Vst3Params0;

    public void beginDirectParameterRoute(int topLevelIndex) {
        directParameterTopLevelIndex = topLevelIndex;
        directParameterRouteKinds.clear();
        directParameterRouteNames.clear();
        directParameterRouteChannels.clear();
        directParameterRouteDeviceIndices.clear();
    }

    public void addDirectParameterRouteStep(
            String kind, String name, Integer channel, int deviceIndex) {
        directParameterRouteKinds.add(kind);
        directParameterRouteNames.add(name);
        directParameterRouteChannels.add(channel);
        directParameterRouteDeviceIndices.add(deviceIndex);
    }

    public void removeDirectParameterRouteStep() {
        int last = directParameterRouteKinds.size() - 1;
        if (last < 0) {
            return;
        }
        directParameterRouteKinds.remove(last);
        directParameterRouteNames.remove(last);
        directParameterRouteChannels.remove(last);
        directParameterRouteDeviceIndices.remove(last);
    }

    // --- E4c: device nesting (layers / drum pads / slots / chain selector) ---
    /** Container-device UUIDs, harvested from the bundle like E3/E4. */
    public static final String INSTRUMENT_LAYER_UUID = "5024be2e-65d6-4d40-bbfe-8b2ea993c445";
    public static final String INSTRUMENT_SELECTOR_UUID = "9588fbcf-721a-438b-8555-97e4231f7d2c";

    public static final int LAYER_BANK = 8;
    public static final int LAYER_DEVICE_BANK = 4;
    public static final int DRUM_PAD_BANK = 16;

    // --- ⚠⚠ E18 §3.1: container scopes that do NOT depend on the device cursor ---
    /**
     * ⚠ **Why a second way to see a container, when `layerBank0` already exists.**
     *
     * `layerBank0` follows `cursorDevice0`, so **exactly one container is
     * addressable at a time** — and that is fatal for the one direction E18 exists
     * to measure. The operator's REBUILD strategy is *"clone the container with
     * fewer chains, migrate the devices across, delete the old container"*, which
     * requires a SOURCE device inside container A and a DESTINATION chain inside
     * container B to be live **simultaneously**. Through a single cursor they
     * cannot be: scoping to B re-scopes the handle that was pointing into A.
     *
     * ⚠ `Device.createLayerBank(int)` is declared on `Device`, not on
     * `CursorDevice` — checked against the 6.0.6 javadoc index before wiring. So a
     * layer bank can hang off a plain **bank slot**, and two top-level device slots
     * on one track give two container scopes that never contend.
     *
     * ⚠ It also removes the e16o trap from this whole row. Every `layer.*` call is
     * a silent no-op byte-identical to an API refusal when `cursorDevice0` is not
     * on the container; a slot-scoped bank has no such hidden argument, because the
     * container is named by the parameter rather than by cursor state.
     *
     * ⚠ Scoped to the track `cursorTracks[0]` points at, and to its FIRST TWO
     * top-level device slots — which is what the rebuild shape needs (old container
     * and new container, side by side on one track) and no more.
     */
    public static final int SLOT_SCOPES = 2;
    public static final int SLOT_LAYER_BANK = 5;
    public static final int SLOT_LAYER_DEVICE_BANK = 4;
    public final DeviceLayerBank[] slotLayerBanks = new DeviceLayerBank[SLOT_SCOPES];
    public final DeviceBank[][] slotLayerDeviceBanks = new DeviceBank[SLOT_SCOPES][SLOT_LAYER_BANK];
    /**
     * ⚠ Per-scope status, reported by every handler that reads through these banks.
     *
     * Standing rule 13's lesson, stated as instrumentation: *"the handle does not
     * exist"* and *"the API declines"* are indistinguishable in the outcome, and
     * three false ○s in E17 came from not being able to tell them apart. A probe
     * must ABORT unless this reads `held`.
     */
    public final String[] slotScopeStatus = new String[SLOT_SCOPES];

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
    /** Complete device-chain views for the 16 reachable Drum Machine pads. */
    public final DeviceBank[] drumPadDeviceBanks0 = new DeviceBank[DRUM_PAD_BANK];
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
    public final CursorRemoteControlsPage[] remotePages0;
    public final RemoteControl[][] remoteControls0;
    /** Legacy probe aliases for the first independent page cursor. */
    public final CursorRemoteControlsPage remotePage0;
    public final RemoteControl[] remotes0;
    /** Generation reset before each serialized remote-control acquisition. */
    public long remoteGeneration = 0;
    /** Generation in which the page-name observer last followed the cursor. */
    public long remoteObservedGeneration = -1;
    public String remoteObservedTrackId = null;
    public String remoteObservedDeviceName = null;
    public int remoteObservedDeviceIndex = -1;
    public final long[] remotePageObservedGeneration;
    public final String[] remotePageObservedTrackId;
    public final String[] remotePageObservedDeviceName;
    public final int[] remotePageObservedDeviceIndex;
    private final long[] remotePagePendingGeneration;
    private final String[] remotePagePendingTrackId;
    private final String[] remotePagePendingDeviceName;

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
    /** Generation reset before each serialized device-cursor acquisition. */
    public long directParamGeneration = 0;
    /** Generation in which the id observer last delivered a complete list. */
    public long directParamIdsGeneration = -1;
    public String directParamObservedTrackId = null;
    public String directParamObservedDeviceName = null;
    public int directParamObservedDeviceIndex = -1;
    /** One exact callback receipt armed by a direct-parameter mutation. */
    public long directParamCompletionGeneration = 0;
    public long directParamCompletionObservedGeneration = -1;
    public String directParamCompletionId = null;
    public Double directParamCompletionValue = null;
    public String directParamCompletionTrackId = null;
    public String directParamCompletionDeviceName = null;
    public int directParamCompletionDeviceIndex = -1;

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
    /** The actual action-facing channel selection; unlike the two fields above, this is not slot-derived. */
    public int selectedMixerTrackIndex = -1;
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
    public final ContentEvent[] contentLog = new ContentEvent[CONTENT_LOG];

    /**
     * One launcher-content callback, kept by DURABLE IDENTITY.
     *
     * ⚠ The spike version of this log held the string `"t2s7=emptied"`, and the
     * bank index in it is a lie the moment a track is created or deleted — the
     * bank re-indexes (E2c/E3) and `t2` then names whatever slid into slot 2.
     * Standing rule 2 says address by identity, and the E17 method guards say it
     * again for fixtures (*"a name is not an identity"*); a detector the engine
     * is about to trust has to obey both. `channelId` is captured AT CALLBACK
     * TIME, when the bank row and the track still agree.
     *
     * ⚠ `channelId` may be empty — Bitwig delivers initial values through these
     * same callbacks, and at init the id may not have arrived yet. An event that
     * cannot name its track is UNATTRIBUTABLE and the brain fails closed on it
     * rather than guessing; that is why the field is reported rather than
     * dropped.
     *
     * `seq` is the epoch value this event produced, so a consumer holding an
     * older epoch can slice `(since, now]` exactly and can SEE when the ring has
     * dropped events it needed (`oldest.seq > since + 1`) instead of silently
     * reading a short window as a quiet one.
     */
    public static final class ContentEvent {
        public final int seq;
        public final String channelId;
        public final int trackIndex;
        public final int slotIndex;
        public final boolean filled;

        ContentEvent(int seq, String channelId, int trackIndex, int slotIndex, boolean filled) {
            this.seq = seq;
            this.channelId = channelId;
            this.trackIndex = trackIndex;
            this.slotIndex = slotIndex;
            this.filled = filled;
        }

        /** The spike's log line, so the E16s probes keep reading what they read. */
        public String legacy() {
            return "t" + trackIndex + "s" + slotIndex + (filled ? "=filled" : "=emptied");
        }
    }

    /**
     * ⚠ A nonce minted once per `init()`, so an epoch is never compared across
     * two different lives of the extension.
     *
     * Both epochs are COUNTERS that start at zero on every load, and §3.2.3's
     * warning — *"only a difference across a known event means anything"* — has a
     * sharper edge than it first reads: after a Bitwig restart the counters come
     * back SMALLER, and a stale mark taken before the restart compares equal to a
     * fresh one taken after it. That is a difference that reads as no difference,
     * which is the exact silent-agreement failure the epoch exists to prevent.
     *
     * With a generation attached, a mark from a previous life is not stale — it is
     * INCOMPARABLE, and the brain refuses rather than concludes.
     */
    public final String epochGeneration = java.util.UUID.randomUUID().toString();

    /**
     * ⚠ WHICH PROJECT the epochs above are counting, so a project CHANGE is
     * refusable the same way a restart is.
     *
     * The gap the generation nonce does not close, and PHASE-1-SESSION-3's
     * original doc called it *"the sharpest question in the session"*: loading a
     * different project does NOT re-`init()` the extension, so the generation is
     * unchanged and both counters keep climbing — while every `channelId` in the
     * project is different and every positional address means something else.
     * Worse than a restart, because the numbers stay superficially comparable:
     * observers re-fire initial values for the new project, so a stale mark's
     * epoch is genuinely lower and the window looks like an ordinary busy one.
     * D17a's `projectKey` used to cover this and was retired with the store.
     *
     * ⚠⚠ **A NAME IS NOT AN IDENTITY** — standing rule 2, and E17 method guard 1
     * says it again for fixtures. Two projects can share a name, and a rename is
     * not a project change. So this detects a change it SEES and cannot promise
     * it sees all of them: a `lossy` detector, and the brain labels it as one
     * rather than treating it as a key. It is still strictly better than the
     * nothing it replaces. ⚠ `Application.projectName()` is the current member
     * (its sibling is the `@Deprecated` one, so rule 9 points the safe way), and
     * DrivenByMoss marks it at init exactly like this.
     *
     * ⚠ Marked in its OWN try — the `FAILED@0` lesson. `projectStatus` says
     * whether the handle was ever obtained, because *"the handle does not exist"*
     * and *"the value is empty"* are indistinguishable in the outcome and three
     * false ○s in E17 came from not being able to tell them apart.
     */
    public com.bitwig.extension.controller.api.StringValue projectName;
    public String projectStatus = "not-attempted";

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

    // --- ⚠ E18 §3.1: the chain-level state a rebuild must re-apply by hand ---
    /** How many sends to expose per chain. FX returns are few; 8 is generous. */
    public static final int LAYER_SEND_BANK = 8;
    public final SendBank[] layerSendBanks = new SendBank[LAYER_BANK];
    /**
     * ⚠ Reported separately from each other AND from `layerMixerStatus`.
     *
     * "Every chain reads colour 0,0,0 and zero sends" means something completely
     * different depending on whether the handles were ever marked — the same
     * distinction that produced three false ○s in E17 (standing rule 13). A probe
     * must ABORT rather than score when either of these does not read `marked:`.
     */
    public String layerColorStatus = "not-attempted";
    public String layerSendsStatus = "not-attempted";

    /**
     * ⚠⚠ E17 — whether each layer chain is the UI selection, written by observers.
     *
     * The missing instrument of this session. `e17k` could not tell "the named
     * actions ignore layers" from "our selection never landed", and had to spend a
     * human-assisted probe (`e17l`) to find out it was the second. These two flags
     * turn that into a precondition a probe can assert for itself.
     *
     * Both observers exist on `DeviceChain` and neither had ever been allocated —
     * and being init-only (rule 13) is exactly why the gap could not be closed
     * without another restart. Written on the control-surface thread and read by
     * handlers on the same thread, the `selectedTrackIndex` pattern.
     */
    public final boolean[] layerSelectedInEditor = new boolean[LAYER_BANK];
    public final boolean[] layerSelected = new boolean[LAYER_BANK];

    /**
     * ⚠⚠ E17 row 4 — the `*Action()` handles, allocated at INIT because Bitwig
     * refuses to hand them out later.
     *
     * The first attempt called `layer.deleteObjectAction()` lazily inside the
     * handler and every arm threw **"This can only be called during driver
     * initialization"**. That is standing rule 13 verbatim — a
     * `HardwareActionBindable` is a Bitwig RESOURCE, and resources are init-only —
     * and it was walked straight past. The three ○s it produced measured nothing
     * about layers; they measured the handle never being obtained.
     *
     * ⚠ Held per BANK SLOT, not per chain: `layerBank0.getItemAt(i)` is a proxy for
     * "slot i of whatever the bank is currently scoped to", so an action captured
     * here should follow the bank. ⚠ That is an ASSUMPTION about bank semantics and
     * the probe must verify it by NAMING the survivor, never by counting.
     */
    public final HardwareActionBindable[] layerDeleteAction = new HardwareActionBindable[LAYER_BANK];
    public final HardwareActionBindable[] layerDuplicateAction = new HardwareActionBindable[LAYER_BANK];
    public String layerDeleteActionStatus = "not-attempted";
    public String layerDuplicateActionStatus = "not-attempted";
    /** ⚠ The sibling CONTROL: the same inherited call on a Track. */
    public HardwareActionBindable[] trackDeleteAction;
    public String trackDeleteActionStatus = "not-attempted";
    public String layerSelectionStatus = "not-attempted";
    /** ⚠ Reported separately so a @Deprecated failure cannot be read as the current one failing. */
    public String layerSelectionLegacyStatus = "not-attempted";

    public Rig(ControllerHost host, RigConfig config) {
        long start = System.nanoTime();
        this.config = config;

        cursorTracks = new CursorTrack[config.cursorPool];
        cursorClips = new PinnableCursorClip[config.cursorPool];
        cursorDeviceBanks = new DeviceBank[config.cursorPool];
        remotePages0 = new CursorRemoteControlsPage[config.remotePages];
        remoteControls0 = new RemoteControl[config.remotePages][REMOTE_BANK];
        remotePageObservedGeneration = new long[config.remotePages];
        remotePageObservedTrackId = new String[config.remotePages];
        remotePageObservedDeviceName = new String[config.remotePages];
        remotePageObservedDeviceIndex = new int[config.remotePages];
        remotePagePendingGeneration = new long[config.remotePages];
        remotePagePendingTrackId = new String[config.remotePages];
        remotePagePendingDeviceName = new String[config.remotePages];
        java.util.Arrays.fill(remotePageObservedGeneration, -1);
        java.util.Arrays.fill(remotePageObservedDeviceIndex, -1);
        java.util.Arrays.fill(remotePagePendingGeneration, -1);
        sendBanks = new SendBank[config.tracks];
        vuNow = new int[config.tracks];
        vuHold = new int[config.tracks];
        vuIdentity = new String[config.tracks];

        application = host.createApplication();
        application.canUndo().markInterested();
        application.canRedo().markInterested();
        application.panelLayout().markInterested();

        // ⚠ Own try block, own status — see the field. A throw in this
        // constructor is the whole extension, before the bridge binds.
        try {
            projectName = application.projectName();
            projectName.markInterested();
            projectStatus = "marked";
        } catch (Throwable t) {
            projectStatus = "FAILED:" + t.getClass().getSimpleName() + ":" + t.getMessage();
        }

        // ⚠ Rule 13: allocated at init, never mid-probe. Guarded because a throw in
        // this constructor takes the whole extension down before the bridge binds.
        // ⚠ Marked in its OWN try block — the lesson this session paid for twice.
        try {
            notifications = host.getNotificationSettings();
            notificationsStatus = notifications == null ? "null" : "ok";
        } catch (Throwable t) {
            notificationsStatus = "FAILED:" + t.getClass().getSimpleName() + ":" + t.getMessage();
        }
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

            // E22 probe instrumentation: this observer records the selected
            // mixer channel, which the experiment proved is not the invisible
            // primary-focus state consumed by the Group action.
            final int mixerTrackIdx = i;
            track.addIsSelectedInMixerObserver(selected -> {
                if (selected) selectedMixerTrackIndex = mixerTrackIdx;
            });

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
                // ⚠ E20a — the launch state, and the QUEUED half is the point.
                //
                // `launchWithOptions` quantises a switch to a bar or a phrase, so
                // between the call and the switch there is a window in which the
                // slot is neither playing nor idle. E18-VERDICT §4b calls that
                // readable pending state better than anything either device
                // mechanism offers — solo flags have no equivalent — and it is what
                // separates "the launch was quantised" from "the launch was slow".
                //
                // ⚠ Three markInterested per slot is `3 × tracks × scenes` = 768 at
                // the default rig, on top of the three above. Rule 13 gives no
                // choice about WHERE (init only); `rig.stats` reports what it cost.
                slot.isPlaying().markInterested();
                slot.isPlaybackQueued().markInterested();
                slot.isStopQueued().markInterested();
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
            //
            // ⚠ The whole body is guarded. This runs on the control-surface thread,
            // which is the thread every request is marshalled onto (Bridge), so an
            // exception escaping here does not merely lose one event — it lands in
            // Bitwig's own callback dispatch, which is the E14-A1 hazard class. The
            // epoch is bumped in the `finally` so a failed READ still counts as an
            // event: an unattributable event must make the window untrustworthy,
            // never make it look empty.
            slots.addHasContentObserver((slotIdx, has) -> {
                String owner = "";
                try {
                    owner = track.channelId().get();
                } catch (Throwable ignored) {
                    // Left empty on purpose — see ContentEvent.channelId.
                } finally {
                    int seq = ++launcherContentEpoch;
                    contentLog[(seq - 1) % CONTENT_LOG] =
                        new ContentEvent(seq, owner == null ? "" : owner, trackIdx, slotIdx, has);
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

            // Musical writes can use a 1/64-beat grid across an eight-beat clip.
            // A 64-step writer silently drops every note after the first beat.
            cursorClips[i] = cursorTracks[i].createLauncherCursorClip(config.fineSteps, config.gridKeys);
            markClip(cursorClips[i]);
            cursorClips[i].isPinned().markInterested();

            cursorDeviceBanks[i] = cursorTracks[i].createDeviceBank(config.deviceBank);
            cursorDeviceBanks[i].itemCount().markInterested();
            for (int d = 0; d < config.deviceBank; d++) {
                Device device = cursorDeviceBanks[i].getDevice(d);
                device.exists().markInterested();
                device.name().markInterested();
                device.isEnabled().markInterested();
            }
        }

        followerClip = host.createLauncherCursorClip(config.gridSteps, config.gridKeys);
        markClip(followerClip);

        // E2: deliberately NO markInterested / setStepSize on the bare pair
        bareTrack = host.createCursorTrack("GN_CT_BARE", "ghostnote bare cursor", 0, config.scenes, false);
        bareClip = bareTrack.createLauncherCursorClip(config.gridSteps, config.gridKeys);

        fineTrack = host.createCursorTrack("GN_CT_FINE", "ghostnote fine cursor", 0, config.scenes, false);
        fineTrack.position().markInterested();
        fineTrack.isPinned().markInterested();
        fineClip = fineTrack.createLauncherCursorClip(config.noteReadSteps, config.gridKeys);
        markClip(fineClip);
        fineClip.isPinned().markInterested();

        noteObserverTrack = host.createCursorTrack(
            "GN_CT_NOTE_OBSERVER", "ghostnote note observer", 0, config.scenes, false);
        noteObserverTrack.exists().markInterested();
        noteObserverTrack.name().markInterested();
        noteObserverTrack.position().markInterested();
        noteObserverTrack.channelId().markInterested();
        noteObserverTrack.isPinned().markInterested();
        noteObserverClip = noteObserverTrack.createLauncherCursorClip(
            config.noteReadSteps, config.gridKeys);
        markClip(noteObserverClip);
        noteObserverClip.isPinned().markInterested();
        noteObserver.attach(noteObserverClip);

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

        // Device.position() reports -1 for a nested cursor. This siblings bank
        // re-scopes to the cursor's current chain and keeps the position
        // observable through preallocated equality values.
        cursorDeviceSiblings0 = cursorDevice0.createSiblingsDeviceBank(config.deviceBank);
        cursorDeviceSiblings0.itemCount().markInterested();
        for (int d = 0; d < config.deviceBank; d++) {
            Device sibling = cursorDeviceSiblings0.getDevice(d);
            sibling.exists().markInterested();
            sibling.name().markInterested();
        }

        // E4c: one view per nesting mechanism. These are created against a
        // cursor device whose type changes as it repoints, so a view that
        // does not apply to the current device simply reports nothing.
        layerBank0 = cursorDevice0.createLayerBank(LAYER_BANK);
        layerBank0.itemCount().markInterested();
        for (int l = 0; l < LAYER_BANK; l++) {
            DeviceLayer layer = layerBank0.getItemAt(l);
            layer.exists().markInterested();
            layer.name().markInterested();
            layerDeviceBanks[l] = layer.createDeviceBank(LAYER_DEVICE_BANK);
            layerDeviceBanks[l].itemCount().markInterested();
            for (int d = 0; d < LAYER_DEVICE_BANK; d++) {
                Device nested = layerDeviceBanks[l].getDevice(d);
                nested.exists().markInterested();
                nested.name().markInterested();
            }
        }

        // ⚠⚠ E18 §3.1 — the cursor-free container scopes. See SLOT_SCOPES above for
        // why they exist; this is why they are GUARDED and marked per scope.
        //
        // Rule 9/13 discipline: `Device.createLayerBank` on a plain bank slot is
        // documented-current and should work, but "should" is what the E17 rule-13
        // violation also assumed, and a throw here at init would take the whole rig
        // down and cost a Bitwig restart to discover. Each scope is built in its OWN
        // try so one failure cannot take the other with it — the `FAILED@0` lesson,
        // where a @Deprecated sibling marked in the same block killed a
        // documented-current observer and cost the session its readback.
        for (int s = 0; s < SLOT_SCOPES; s++) {
            try {
                Device slot = cursorDeviceBanks[0].getDevice(s);
                // `hasLayers` is not marked by the pool loop above, and a handler
                // that cannot say whether the slot IS a container cannot tell "no
                // chains" from "not a container".
                slot.hasLayers().markInterested();
                slotLayerBanks[s] = slot.createLayerBank(SLOT_LAYER_BANK);
                for (int l = 0; l < SLOT_LAYER_BANK; l++) {
                    DeviceLayer layer = slotLayerBanks[s].getItemAt(l);
                    layer.exists().markInterested();
                    layer.name().markInterested();
                    // 3f-e reads and writes solo through this cursor-free slot
                    // scope. Without subscribing here `get()` is unavailable and
                    // inventory correctly omits the field instead of guessing.
                    layer.solo().markInterested();
                    // Winner collapse reports the chain-level state that device
                    // relocation cannot carry (E18g). These are read through the
                    // same cursor-free scope as the chain name and device order.
                    layer.mute().markInterested();
                    layer.volume().value().markInterested();
                    layer.pan().value().markInterested();
                    layer.color().markInterested();
                    // ⚠ E18 §3.2 will ask whether this survives a reload; it is
                    // marked here so the question is answerable through a scope that
                    // does not move, rather than through a cursor that does.
                    layer.channelId().markInterested();
                    slotLayerDeviceBanks[s][l] = layer.createDeviceBank(SLOT_LAYER_DEVICE_BANK);
                    // Product relocation needs a true population count so a
                    // full bank is distinguishable from an overflowing one.
                    slotLayerDeviceBanks[s][l].itemCount().markInterested();
                    for (int d = 0; d < SLOT_LAYER_DEVICE_BANK; d++) {
                        Device nested = slotLayerDeviceBanks[s][l].getDevice(d);
                        nested.exists().markInterested();
                        nested.name().markInterested();
                    }
                }
                slotScopeStatus[s] = "held";
            } catch (Throwable t) {
                slotScopeStatus[s] = "FAILED:" + t.getClass().getSimpleName() + ":" + t.getMessage();
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

        // ⚠⚠ E18 §3.1 — the two pieces of CHAIN-LEVEL state a rebuild would have to
        // re-apply, and the only two never measured.
        //
        // A chain is a `Channel`, so it carries name, mute, solo, volume, pan,
        // COLOR and SENDS. Moving devices between containers carries the DEVICES and
        // nothing else — so every chain-level property has to be read off the old
        // chain and written onto the new one, or the rebuild silently loses it.
        // Name/mute/solo/volume/pan are already ● (E17 rows 5/6 + layer.setMixer).
        // Colour and sends are not, and a take that comes back a different colour —
        // or missing its reverb send — is a real regression.
        //
        // ⚠ Marked in their OWN try blocks, separately from each other and from the
        // mixer loop above. `DeviceLayer` inherits both from `Channel`, and this
        // spike's record is that an inherited member is a CLAIM and not a
        // capability: `deleteObject()` is inherited and refuses, `duplicateObject()`
        // is inherited and refuses. Either of these may throw, and the `FAILED@0`
        // lesson is that one bad handle in a shared block takes its neighbours down.
        //
        // ⚠ A send bank on a DEVICE layer may legitimately be EMPTY — a layer chain
        // is not a mixer channel routed to FX buses. That would itself be the
        // finding ("there are no sends to lose"), and it is why `itemCount` is
        // marked and reported rather than assumed.
        int layerColorMarked = 0;
        try {
            for (int l = 0; l < LAYER_BANK; l++) {
                layerBank0.getItemAt(l).color().markInterested();
                layerColorMarked++;
            }
            layerColorStatus = "marked:" + layerColorMarked;
        } catch (Throwable t) {
            layerColorStatus = "FAILED@" + layerColorMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }

        int layerSendsMarked = 0;
        try {
            for (int l = 0; l < LAYER_BANK; l++) {
                SendBank bank = layerBank0.getItemAt(l).sendBank();
                bank.itemCount().markInterested();
                layerSendBanks[l] = bank;
                for (int s = 0; s < LAYER_SEND_BANK; s++) {
                    Send send = bank.getItemAt(s);
                    send.exists().markInterested();
                    send.name().markInterested();
                    send.value().markInterested();
                }
                layerSendsMarked++;
            }
            layerSendsStatus = "marked:" + layerSendsMarked;
        } catch (Throwable t) {
            layerSendsStatus = "FAILED@" + layerSendsMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }

        // ⚠⚠ E17 — IS THIS LAYER THE UI SELECTION? The readback whose ABSENCE cost
        // this session two inconclusive rows and a human-assisted probe.
        //
        // `e17k` fired `Duplicate`, `Copy`+`Paste` and `Delete` at a layer we had
        // "selected" via `DeviceChain.selectInEditor()` and got nothing, four
        // routes. That ○ was UNINTERPRETABLE, because two different worlds produce
        // it — the actions ignore layers, or our selection never landed — and
        // **nothing in the API reported which.** `e17l` had to put a human in the
        // loop to split them, and the answer was the second: with a HUMAN-set
        // selection the very same actions worked (Copy+Paste 4→5, Delete 4→3).
        //
        // `DeviceChain` carries two selection observers and neither had ever been
        // allocated. Rule 13 is why they could not simply be added mid-probe: they
        // are init-only, so the missing readback cost a whole extra restart. Both
        // are marked here so a probe can assert "the layer IS selected" as a
        // PRECONDITION, separately from its question — which is the discipline
        // E16o established and the thing `e17k` could not do.
        //
        // ⚠ Guarded for the same reason as the mixer block above: a throw in this
        // constructor is the whole extension, before the bridge binds.
        //
        // ⚠⚠ FIXED 2026-08-01 — the two observers were marked inside ONE try block,
        // and it cost the good one. `addIsSelectedObserver` IS @Deprecated and threw
        // ("deprecated since API version 2") on the very first layer, so the catch
        // fired before `addIsSelectedInEditorObserver` — documented CURRENT — was
        // ever reached for layers 1..N, and the status read `FAILED@0`. Rule 9 says
        // check @Deprecated before wiring; the subtler lesson is that **a guard
        // around two calls reports on neither**. They are split so one can fail
        // without taking the other, and each reports its own status.
        //
        // ⚠ This is no longer load-bearing. `cursorLayer0.name()` turned out to
        // track the chain selection already (5/5 against human eyes in `e17u`,
        // non-disturbing per `e17v` PART 0), so the readback exists without this.
        // It is kept as an INDEPENDENT second instrument — two disagreeing readbacks
        // is a finding, one readback agreeing with itself is not.
        int layerSelMarked = 0;
        try {
            for (int l = 0; l < LAYER_BANK; l++) {
                final int idx = l;
                layerBank0.getItemAt(l).addIsSelectedInEditorObserver(v -> layerSelectedInEditor[idx] = v);
                layerSelMarked++;
            }
            layerSelectionStatus = "observing:" + layerSelMarked;
        } catch (Throwable t) {
            layerSelectionStatus = "FAILED@" + layerSelMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }

        // ⚠ Separately, and expected to fail: @Deprecated since API v2. Marked only
        // so its failure is RECORDED rather than inferred, and so it can never again
        // take the current observer down with it.
        int layerSelLegacyMarked = 0;
        try {
            for (int l = 0; l < LAYER_BANK; l++) {
                final int idx = l;
                layerBank0.getItemAt(l).addIsSelectedObserver(v -> layerSelected[idx] = v);
                layerSelLegacyMarked++;
            }
            layerSelectionLegacyStatus = "observing:" + layerSelLegacyMarked;
        } catch (Throwable t) {
            layerSelectionLegacyStatus = "FAILED@" + layerSelLegacyMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }

        // ⚠⚠ Rule 13: obtain the `*Action()` handles HERE. Bitwig throws
        // "This can only be called during driver initialization" anywhere else.
        // ⚠ Three separate try blocks — one failure must not cost the others, the
        // lesson the selection observers taught earlier this session.
        int ldMarked = 0;
        try {
            for (int l = 0; l < LAYER_BANK; l++) {
                layerDeleteAction[l] = layerBank0.getItemAt(l).deleteObjectAction();
                ldMarked++;
            }
            layerDeleteActionStatus = "held:" + ldMarked;
        } catch (Throwable t) {
            layerDeleteActionStatus = "FAILED@" + ldMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }
        int luMarked = 0;
        try {
            for (int l = 0; l < LAYER_BANK; l++) {
                layerDuplicateAction[l] = layerBank0.getItemAt(l).duplicateObjectAction();
                luMarked++;
            }
            layerDuplicateActionStatus = "held:" + luMarked;
        } catch (Throwable t) {
            layerDuplicateActionStatus = "FAILED@" + luMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }
        int tdMarked = 0;
        try {
            trackDeleteAction = new HardwareActionBindable[config.tracks];
            for (int i = 0; i < config.tracks; i++) {
                trackDeleteAction[i] = trackBank.getItemAt(i).deleteObjectAction();
                tdMarked++;
            }
            trackDeleteActionStatus = "held:" + tdMarked;
        } catch (Throwable t) {
            trackDeleteActionStatus = "FAILED@" + tdMarked + ":"
                + t.getClass().getSimpleName() + ":" + t.getMessage();
        }

        cursorLayer0 = cursorDevice0.createCursorLayer();
        cursorLayer0.exists().markInterested();
        cursorLayer0.name().markInterested();

        drumPadBank0 = cursorDevice0.createDrumPadBank(DRUM_PAD_BANK);
        drumPadBank0.itemCount().markInterested();
        for (int p = 0; p < DRUM_PAD_BANK; p++) {
            DrumPad pad = drumPadBank0.getItemAt(p);
            pad.exists().markInterested();
            pad.name().markInterested();
            drumPadDeviceBanks0[p] = pad.createDeviceBank(config.deviceBank);
            drumPadDeviceBanks0[p].itemCount().markInterested();
            for (int d = 0; d < config.deviceBank; d++) {
                Device nested = drumPadDeviceBanks0[p].getDevice(d);
                nested.exists().markInterested();
                nested.name().markInterested();
            }
        }

        chainSelector0 = cursorDevice0.createChainSelector();
        chainSelector0.exists().markInterested();
        chainSelector0.activeChainIndex().markInterested();
        chainSelector0.chainCount().markInterested();

        // E61: one independent cursor per bounded remote page. Each cursor keeps
        // its page index while cursorDevice0 moves. One handler can therefore
        // return the complete configured page window without page turns.
        for (int page = 0; page < config.remotePages; page++) {
            final int pageIndex = page;
            CursorRemoteControlsPage remotePage = cursorDevice0.createCursorRemoteControlsPage(
                "ghostnote-page-" + page, REMOTE_BANK, "");
            remotePages0[page] = remotePage;
            remotePage.pageCount().markInterested();
            remotePage.selectedPageIndex().markInterested();
            remotePage.pageNames().markInterested();
            remotePage.pageNames().addValueObserver(
                names -> noteRemotePageObservation(pageIndex));
            remotePage.selectedPageIndex().set(page);
            for (int r = 0; r < REMOTE_BANK; r++) {
                RemoteControl rc = remotePage.getParameter(r);
                rc.exists().markInterested();
                rc.name().markInterested();
                rc.value().markInterested();
                rc.modulatedValue().markInterested();
                rc.isBeingMapped().markInterested();
                rc.hasAutomation().markInterested();
                remoteControls0[page][r] = rc;
            }
        }
        remotePage0 = remotePages0[0];
        remotes0 = remoteControls0[0];

        // Typed IDs come from the generated native catalog. Cycle them only when
        // the D7 scale configuration asks for more handles than the device has.
        polysynthView0 = cursorDevice0.createSpecificBitwigDevice(
            java.util.UUID.fromString(NativeDeviceCatalog.POLYSYNTH_UUID));
        paramIds = new String[config.paramHandles];
        polysynthParams0 = new Parameter[config.paramHandles];
        for (int p = 0; p < config.paramHandles; p++) {
            String id = NativeDeviceCatalog.POLYSYNTH_PARAMETER_IDS[
                p % NativeDeviceCatalog.POLYSYNTH_PARAMETER_IDS.length];
            Parameter param = polysynthView0.createParameter(id);
            param.exists().markInterested();
            param.name().markInterested();
            param.value().markInterested();
            param.value().displayedValue().markInterested();
            param.value().getOrigin().markInterested();
            param.value().discreteValueCount().markInterested();
            param.value().discreteValueNames().markInterested();
            param.modulatedValue().markInterested(); // E7: post-modulation value
            param.hasAutomation().markInterested();
            paramIds[p] = id;
            polysynthParams0[p] = param;
        }
        v1KickView0 = cursorDevice0.createSpecificBitwigDevice(
            java.util.UUID.fromString(NativeDeviceCatalog.V1_KICK_UUID));
        v1KickParamIds = NativeDeviceCatalog.V1_KICK_PARAMETER_IDS.clone();
        v1KickParams0 = new Parameter[v1KickParamIds.length];
        for (int p = 0; p < v1KickParamIds.length; p++) {
            Parameter param = v1KickView0.createParameter(v1KickParamIds[p]);
            param.exists().markInterested();
            param.name().markInterested();
            param.value().markInterested();
            param.value().displayedValue().markInterested();
            param.value().getOrigin().markInterested();
            param.value().discreteValueCount().markInterested();
            param.value().discreteValueNames().markInterested();
            param.modulatedValue().markInterested();
            param.hasAutomation().markInterested();
            v1KickParams0[p] = param;
        }
        zebra3Vst3View0 = cursorDevice0.createSpecificVst3Device(
            "D39D5B69D6AF42FA123456785A334D44");
        zebra3Vst3ParamIds = new String[] {"PID411"};
        zebra3Vst3Params0 = new Parameter[] {zebra3Vst3View0.createParameter(0x411)};
        for (Parameter param : zebra3Vst3Params0) {
            param.exists().markInterested();
            param.name().markInterested();
            param.value().markInterested();
            param.value().displayedValue().markInterested();
            param.value().getOrigin().markInterested();
            param.value().discreteValueCount().markInterested();
            param.value().discreteValueNames().markInterested();
            param.modulatedValue().markInterested();
            param.hasAutomation().markInterested();
        }

        transport = host.createTransport();
        transport.isPlaying().markInterested();
        // ⚠ E20a — the corroborating half of the quantisation measurement. Wall
        // clock says a launch was DELAYED; only the play position says it landed on
        // a BAR, which is the property `launchWithOptions("1", …)` actually claims.
        transport.playPosition().markInterested();

        // Format-agnostic DirectParameter observers (E4b — CLAP access test).
        // Callbacks fire on the control-surface thread.
        if (config.directObservers) {
            cursorDevice0.addDirectParameterIdObserver(ids -> {
                directParamIds = ids != null ? ids : new String[0];
                java.util.Set<String> current = new java.util.HashSet<>(
                    java.util.Arrays.asList(directParamIds));
                directParamNames.keySet().retainAll(current);
                directParamValues.keySet().retainAll(current);
                directParamDisplays.keySet().retainAll(current);
                directParamIdsGeneration = directParamGeneration;
                directParamObservedTrackId = cursorTracks[0].channelId().get();
                directParamObservedDeviceName = cursorDevice0.name().get();
                directParamObservedDeviceIndex = currentDirectParameterDeviceIndex();
            });
            cursorDevice0.addDirectParameterNameObserver(48, (id, name) -> {
                directParamNames.put(id, name);
            });
            cursorDevice0.addDirectParameterNormalizedValueObserver((id, value) -> {
                directParamValues.put(id, value);
                noteDirectParameterCompletion(id, value);
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

    /** Clear all state that can belong to the prior cursor target. */
    public long beginDirectParameterObservation() {
        directParamGeneration++;
        directParamIdsGeneration = -1;
        directParamIds = new String[0];
        directParamNames.clear();
        directParamValues.clear();
        directParamDisplays.clear();
        directParamObservedTrackId = null;
        directParamObservedDeviceName = null;
        directParamObservedDeviceIndex = -1;
        return directParamGeneration;
    }

    /** Invalidate remote-control observations from the prior cursor target. */
    public long beginRemoteObservation() {
        remoteGeneration++;
        remoteObservedGeneration = -1;
        remoteObservedTrackId = null;
        remoteObservedDeviceName = null;
        remoteObservedDeviceIndex = -1;
        java.util.Arrays.fill(remotePageObservedGeneration, -1);
        java.util.Arrays.fill(remotePageObservedTrackId, null);
        java.util.Arrays.fill(remotePageObservedDeviceName, null);
        java.util.Arrays.fill(remotePageObservedDeviceIndex, -1);
        java.util.Arrays.fill(remotePagePendingGeneration, -1);
        java.util.Arrays.fill(remotePagePendingTrackId, null);
        java.util.Arrays.fill(remotePagePendingDeviceName, null);
        // Selecting the current device again emits no page-name callback. Seed
        // this generation from the current marked state. A later target change
        // still fails track, name, and index equality until its callbacks run.
        for (int page = 0; page < remotePages0.length; page++) {
            noteRemotePageObservation(page);
        }
        return remoteGeneration;
    }

    private void noteRemotePageObservation(int page) {
        remotePagePendingGeneration[page] = remoteGeneration;
        remotePagePendingTrackId[page] = cursorTracks[0].channelId().get();
        remotePagePendingDeviceName[page] = cursorDevice0.name().get();
        finishRemoteObservation(page);
    }

    /** Finish one page only after its observer and current-chain equality agree. */
    private void finishRemoteObservation(int page) {
        if (remotePagePendingGeneration[page] != remoteGeneration
            || remotePagePendingTrackId[page] == null
            || remotePagePendingDeviceName[page] == null
            || !remotePagePendingTrackId[page].equals(cursorTracks[0].channelId().get())
            || !remotePagePendingDeviceName[page].equals(cursorDevice0.name().get())) {
            return;
        }
        int index = currentDirectParameterDeviceIndex();
        if (index < 0) {
            return;
        }
        remotePageObservedGeneration[page] = remoteGeneration;
        remotePageObservedTrackId[page] = remotePagePendingTrackId[page];
        remotePageObservedDeviceName[page] = remotePagePendingDeviceName[page];
        remotePageObservedDeviceIndex[page] = index;
        if (page == 0) {
            remoteObservedGeneration = remoteGeneration;
            remoteObservedTrackId = remotePagePendingTrackId[page];
            remoteObservedDeviceName = remotePagePendingDeviceName[page];
            remoteObservedDeviceIndex = index;
        }
    }

    /** Arm one exact DirectParameter callback before its mutation. */
    public long beginDirectParameterCompletion(String id) {
        directParamCompletionGeneration++;
        directParamCompletionObservedGeneration = -1;
        directParamCompletionId = id;
        directParamCompletionValue = null;
        directParamCompletionTrackId = cursorTracks[0].channelId().get();
        directParamCompletionDeviceName = cursorDevice0.name().get();
        directParamCompletionDeviceIndex = currentDirectParameterDeviceIndex();
        return directParamCompletionGeneration;
    }

    private void noteDirectParameterCompletion(String id, double value) {
        if (directParamCompletionId == null || !directParamCompletionId.equals(id)
            || directParamCompletionTrackId == null || directParamCompletionDeviceName == null
            || !directParamCompletionTrackId.equals(cursorTracks[0].channelId().get())
            || !directParamCompletionDeviceName.equals(cursorDevice0.name().get())
            || directParamCompletionDeviceIndex != currentDirectParameterDeviceIndex()) {
            return;
        }
        directParamCompletionValue = value;
        directParamCompletionObservedGeneration = directParamCompletionGeneration;
    }

    /** Current position of the device cursor in its own chain, or -1. */
    public int currentDirectParameterDeviceIndex() {
        int sibling = uniqueDeviceEquality("dev0=sibling", config.deviceBank);
        if (sibling >= 0) {
            return sibling;
        }
        return uniqueDeviceEquality("dev0=chain", config.deviceBank);
    }

    private int uniqueDeviceEquality(String prefix, int size) {
        int found = -1;
        for (int d = 0; d < size; d++) {
            var equal = equalsProbes.get(prefix + d);
            if (equal == null || !equal.get()) {
                continue;
            }
            if (found >= 0) {
                return -1;
            }
            found = d;
        }
        return found;
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
     * The five families, and what each is a guard FOR:
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
     *   dev0=sibling{d} the same identity check inside the current nested chain.
     *                   Nested Device.position() reports -1, so this family
     *                   supplies the confirmed current-chain position.
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
                var chainEqual = cursorDevice0.createEqualsValue(cursorDeviceBanks[0].getDevice(d));
                var siblingEqual = cursorDevice0.createEqualsValue(cursorDeviceSiblings0.getDevice(d));
                chainEqual.addValueObserver(value -> {
                    for (int page = 0; page < config.remotePages; page++) {
                        finishRemoteObservation(page);
                    }
                });
                siblingEqual.addValueObserver(value -> {
                    for (int page = 0; page < config.remotePages; page++) {
                        finishRemoteObservation(page);
                    }
                });
                equalsProbes.put("dev0=chain" + d, chainEqual);
                equalsProbes.put("dev0=sibling" + d, siblingEqual);
                built += 2;
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
        // Phase 2 session 2e. These values form the launcher-clip metadata
        // contract. Mark all scalar values at init so an unmarked read cannot
        // look like a missing capability (E2).
        clip.getPlayStart().markInterested();
        clip.getPlayStop().markInterested();
        clip.isLoopEnabled().markInterested();
        clip.getLoopStart().markInterested();
        clip.getLoopLength().markInterested();
        clip.color().markInterested();
        clip.getTrack().exists().markInterested();
        clip.getTrack().name().markInterested();
        clip.getTrack().position().markInterested();
        clip.clipLauncherSlot().exists().markInterested();
        clip.clipLauncherSlot().sceneIndex().markInterested();
        clip.clipLauncherSlot().name().markInterested();
        // Phase 1 session 3e, arm 1. These are per-CLIP defaults, not properties
        // of the launcher slot and not substitutes for launchWithOptions. They
        // are what can make a human click use the same bar-aligned,
        // position-continuous behaviour as an agent-triggered switch.
        clip.launchQuantization().markInterested();
        clip.launchMode().markInterested();
        clip.useLoopStartAsQuantizationReference().markInterested();
        // ⚠ E20a — WHERE INSIDE THE CLIP playback is, which is the only
        // programmatic answer to `"continue_or_synced"`.
        //
        // The claim under test is that take B picks up at A's position instead of
        // restarting (E18-VERDICT §4a″-bis). That is an audible fact, and an ear is
        // one of the two ways it gets checked — but an ear cannot carry a control
        // arm, and `"from_start"` beside it is what makes the reading a measurement
        // rather than an impression. `playingStep()` reports -1 when nothing is
        // playing, so "not playing" and "playing at step 0" stay distinguishable.
        clip.playingStep().markInterested();
    }

    /** Resolve the fixed clip cursor references. */
    public Clip clip(String ref) {
        switch (ref) {
            case "follower": return followerClip;
            case "bare": return bareClip;
            case "fine": return fineClip;
            case "observer": return noteObserverClip;
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
            case "observer": return noteObserverTrack;
            default:
                return cursorTracks[Integer.parseInt(ref)];
        }
    }

    /** Grid width of a clip cursor. Writers and the note reader use separate widths. */
    public int gridSteps(String ref) {
        if ("fine".equals(ref) || "observer".equals(ref)) return config.noteReadSteps;
        try {
            int i = Integer.parseInt(ref);
            if (i >= 0 && i < config.cursorPool) return config.fineSteps;
        } catch (NumberFormatException ignored) {
            // Non-pool cursors keep the standard width.
        }
        return config.gridSteps;
    }
}

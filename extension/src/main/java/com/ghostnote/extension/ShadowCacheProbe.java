package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import static com.ghostnote.extension.ShadowProjectCache.*;

/** Read-only host adapter. Physical hints do not carry logical callback identity. */
public final class ShadowCacheProbe {
    private static final Gson JSON = new Gson();
    private static final int KEYS = 128;
    private static final double BATCH_MS = 40;
    private static final double HOST_WORK_LIMIT_MS = 45;
    /** E139 membership estimate. A queued hint uses one sparse set membership. */
    private static final long PHYSICAL_HINT_BYTES = 56;
    private static final Set<String> FIELDS = Set.of(
        "velocity", "releaseVelocity", "velocitySpread", "duration", "gain", "pan",
        "pressure", "timbre", "rawTimbre", "durationCells", "rawDuration", "rawGain",
        "transpose", "chance", "isChanceEnabled",
        "isMuted", "isOccurrenceEnabled", "occurrence", "isRecurrenceEnabled",
        "recurrenceLength", "recurrenceMask", "isRepeatEnabled", "repeatCount",
        "repeatCurve", "repeatVelocityCurve", "repeatVelocityEnd");
    private static final Set<String> UNKNOWN = Set.of("portableRepeat", "articulation");
    private final boolean hostModel;
    private final ShadowProjectCache cache = new ShadowProjectCache();
    private final View[] views;
    private final View authority;
    private final Coverage coverage;
    private final int scenes;
    private final double constructionMs;
    private boolean canaryPassed, physicalOverload, physicalOverloadApplied;
    private Scan scan;
    private String comparison = "not-run";
    private String fallbackReason = "warming";
    private long scans, matches, mismatches, windowChanges;
    private final Map<String, Long> mismatchesByCause = new TreeMap<>();
    private final Map<String, Long> comparisonRefusalsByCause = new TreeMap<>();
    private long membershipGetStepCalls, authorityGetStepCalls, enrichmentGetStepCalls;
    private long acquisitionNoteObjects, acquisitionFieldMapObjects, acquisitionListObjects;
    private double membershipHostWorkMs, authorityHostWorkMs, enrichmentHostWorkMs;
    private long lastSnapshotSerializedBytes, lastAuthoritySerializedBytes;
    private int contentEpoch = -1, sceneEpoch = -1;
    private String topology;
    private boolean inventoryEnumerated;
    private long inventoryEntries;
    private RootIdentityProbe identityProbe;
    private ShadowTopologyControl topologyControl;
    private boolean topologyUsable = true;
    private long scanSequence;
    private RootIdentityProbe.IdentityGuard activeIdentityGuard;
    private boolean identityPoisoned;
    private long automaticIdentityInvalidations;
    private String automaticIdentityReason = "identity-probe-unattached";
    private int totalExperimentalStepDataObservers;
    private boolean pingMeasurementAvailable;
    private double identityGuardHostWorkMs;
    private ShadowInventoryRebuild inventoryRebuild;
    private Rig currentRig;
    private JsonObject lastRetiredInventoryRebuild;
    private final ShadowHandlePool handlePool;
    private ShadowHandlePool.Reservation reservationBeingBound;
    private final ShadowAuthorityFallback exactFallback;
    private Track exactTarget;
    private Coverage exactCoverage;
    private long authorityWindowVersion;
    /** 8g2b: one step counter and later-callback confirmation for all shadow observers. */
    private final StepDeltaWindow stepWindow;
    private long stepWindowRefusals, retainedStepWindowDiscards;
    /** 8g3: the last ended scan's phase times and candidate status stay as diagnostics only. */
    private JsonObject lastScanPhaseTimes = new JsonObject(), lastCandidate = new JsonObject();
    private long enrichmentBatches;

    /** Reserve and retire a fixed physical slot before the next binding starts. */
    public JsonObject acquire(Track target, int row) { return acquire(target, row, null, -1); }

    public JsonObject acquire(Track target, int row, Track canary, int canaryRow) {
        requireAddress(target, row);
        Address address = new Address(target.channelId().get(), row);
        if (canary != null) {
            requireAddress(canary, canaryRow);
            if (address.equals(new Address(canary.channelId().get(), canaryRow))) return poolRefusal("canary-must-differ-from-target");
        }
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (!acquisitionAllowed(guard)) return poolRefusal(guardRefusal(guard));
        if (totalExperimentalStepDataObservers > MAX_OBSERVERS) return poolRefusal("combined-observer-budget");
        int existing = handlePool.find(address);
        if (existing >= 0) {
            View current = views[existing];
            if (!valid(current) || cache.clipHealth(current.ref) == Health.INVALID || cache.clipHealth(current.ref) == Health.OVERFLOW
                || cache.clipHealth(current.ref) == Health.AMBIGUOUS || !("settled".equals(current.phase) || "complete".equals(current.phase))
                || (identityProbe != null && !guardCurrent(current.identityGuard)))
                handlePool.invalidate(existing);
        }
        ShadowHandlePool.Decision choice = handlePool.acquire(address);
        if (choice.kind() == ShadowHandlePool.Kind.BUSY) return poolRefusal(choice.reason());
        JsonObject result;
        if (choice.kind() == ShadowHandlePool.Kind.WARM) {
            result = point(choice.index(), target, row);
        } else {
            ShadowHandlePool.Reservation reservation = choice.reservation();
            View selected = views[choice.index()];
            if (selected.used && canary == null) {
                handlePool.cancel(reservation);
                return poolRefusal("populated-canary-required-for-rebind");
            }
            if (!handlePool.markRetired(reservation)) return poolRefusal("pool-reservation-invalidated");
            selected.poolReservation = reservation;
            reservationBeingBound = reservation;
            try {
                retire(choice.index());
                if (!guardCurrent(guard)) return poolRefusal("pool-reservation-invalidated");
                result = canary == null ? point(choice.index(), target, row)
                    : point(choice.index(), target, row, canary, canaryRow);
            } catch (RuntimeException error) {
                releasePool(selected); throw error;
            } finally { reservationBeingBound = null; }
            if (!reservation.equals(handlePool.entries().get(choice.index()).reservation())) {
                retire(choice.index()); return poolRefusal("pool-reservation-invalidated");
            }
            if ("retired".equals(selected.phase) || selected.expected == null
                || !address.equals(selected.finalAddress) || !identityEpochCurrent(selected.identityGuard)) releasePool(selected);
        }
        result.addProperty("index", choice.index());
        result.addProperty("poolDecision", choice.kind().name().toLowerCase());
        result.addProperty("poolReason", choice.reason());
        if (choice.victim() != null) result.add("poolVictim", JSON.toJsonTree(choice.victim()));
        result.add("handlePool", JSON.toJsonTree(handlePool.entries()));
        return result;
    }

    private JsonObject poolRefusal(String reason) {
        JsonObject result = info(); result.addProperty("reason", reason); result.addProperty("poolDecision", "refused");
        result.addProperty("terminal", true);
        return result;
    }

    private void releasePool(View view) {
        for (int index = 0; index < views.length; index++) if (views[index] == view) {
            if (view.poolReservation != null) handlePool.cancel(view.poolReservation);
            handlePool.invalidate(index); view.poolReservation = null; return;
        }
    }

    private void acceptPool(View view) {
        if (view.poolReservation == null) return;
        boolean ready = valid(view) && "target".equals(view.stage)
            && ("settled".equals(view.phase) || "complete".equals(view.phase))
            && guardCurrent(view.identityGuard);
        if (ready && handlePool.accept(view.poolReservation, true)) view.poolReservation = null;
    }

    /** Use the fixed authority handle. Cache membership does not select read coordinates. */
    public JsonObject exactStart(Track target, int row) { return exactStart(target, row, coverage); }

    public JsonObject exactStart(Track target, int row, Coverage request) {
        Address address = null;
        if (target != null && row >= 0) {
            String id = target.channelId().get();
            if (id != null && !id.isEmpty()) address = new Address(id, row);
        }
        RootIdentityProbe.IdentityGuard identity = freshIdentityGuard();
        if (!acquisitionAllowed(identity)) return exactRefusal(guardRefusal(identity), address, request);
        if (exactFallback == null) return exactRefusal("authority-unavailable", address, request);
        if (scan != null || exactFallback.active()) return exactRefusal("authority-busy", address, request);
        exactFallback.cancel("superseded-authority-request");
        requireAddress(target, row);
        if (!request.allChannels() || request.startCell() < 0 || request.startCell() + request.width() > coverage.width()
            || !FIELDS.containsAll(request.fields())) return exactRefusal("authority-coverage-unavailable", address, request);
        if (totalExperimentalStepDataObservers > MAX_OBSERVERS) return exactRefusal("combined-observer-budget", address, request);
        authorityWindowVersion = Math.incrementExact(authorityWindowVersion);
        exactTarget = target; exactCoverage = request;
        return exactResult(exactFallback.start(new Address(target.channelId().get(), row), request));
    }

    public JsonObject exactPoll() {
        return exactFallback == null ? exactRefusal("authority-unavailable", null, coverage) : exactResult(exactFallback.poll());
    }

    public JsonObject exactCancel(String cause) {
        return exactFallback == null ? exactRefusal("authority-unavailable", null, coverage) : exactResult(exactFallback.cancel(cause));
    }

    private JsonObject exactRefusal(String reason, Address address, Coverage request) {
        JsonObject result = info();
        result.addProperty("phase", "refused");
        result.addProperty("reason", reason);
        result.addProperty("terminal", true);
        result.addProperty("complete", false);
        result.addProperty("eligible", false);
        result.addProperty("authorityAvailable", false);
        result.addProperty("fallbackPerformed", false);
        result.addProperty("readMode", "refuse");
        result.addProperty("cacheResidenceAdmitted", false);
        result.addProperty("cacheMembershipUsed", false);
        result.addProperty("authorityNoteCount", 0);
        if (address != null) result.add("address", JSON.toJsonTree(address));
        if (request != null) result.add("coverage", JSON.toJsonTree(request));
        return result;
    }

    private JsonObject exactResult(ShadowAuthorityFallback.Result state) {
        JsonObject result = info();
        JsonObject wire = JSON.toJsonTree(state).getAsJsonObject();
        for (Map.Entry<String, com.google.gson.JsonElement> entry : wire.entrySet()) result.add(entry.getKey(), entry.getValue());
        result.addProperty("readMode", state.authorityAvailable() ? "exact-fallback" : "refuse");
        result.addProperty("cacheResidenceAdmitted", false);
        result.addProperty("cacheMembershipUsed", false);
        result.addProperty("authorityNoteCount", state.authorityNotes() == null ? 0 : state.authorityNotes().size());
        if (!state.terminal() && !"idle".equals(state.phase())) result.add("authorityBinding", authorityBindingDiagnostics());
        if (state.authorityAvailable()) {
            lastAuthoritySerializedBytes = JSON.toJson(state.authorityNotes()).getBytes(StandardCharsets.UTF_8).length
                + JSON.toJson(state.authorityMetadata()).getBytes(StandardCharsets.UTF_8).length;
            result.addProperty("lastAuthoritySerializedBytes", lastAuthoritySerializedBytes);
        }
        return result;
    }

    private record AuthorityGuard(RootIdentityProbe.IdentityGuard witness, Object domain) {}
    private record AuthorityControl(Track target, Address address) {}
    private long authorityControlSearchCells;
    private double authorityControlSearchMs;
    private String authorityControlSearchReason = "not-started";
    private boolean authorityDistinctControlConfirmed;

    /** Resolve a distinct control through host inventory. Do not use cache residence. */
    private AuthorityControl hostAuthorityControl(Address requested) {
        authorityControlSearchCells = 0; authorityControlSearchMs = 0;
        authorityControlSearchReason = "direct-source-no-distinct-control";
        if (currentRig == null) return null;
        long started = System.nanoTime();
        try {
            int rows = Math.min(scenes, currentRig.sceneBank.itemCount().get());
            int tracks = Math.min(currentRig.config.tracks, currentRig.trackBank.itemCount().get());
            long total = Math.min(64L, (long) tracks * rows);
            for (long index = 0; index < total; index++) {
                requireIdentityEpoch(activeIdentityGuard);
                Track candidate = currentRig.trackBank.getItemAt((int) (index / rows));
                int row = (int) (index % rows);
                String id = candidate.channelId().get();
                boolean exists = candidate.exists().get();
                boolean filled = candidate.clipLauncherSlotBank().getItemAt(row).hasContent().get();
                authorityControlSearchCells++;
                requireIdentityEpoch(activeIdentityGuard);
                if (elapsed(started) > HOST_WORK_LIMIT_MS) {
                    authorityControlSearchReason = "authority-control-search-budget";
                    throw new IllegalStateException(authorityControlSearchReason);
                }
                if (exists && id != null && !id.isEmpty() && filled) {
                    Address address = new Address(id, row);
                    if (!requested.equals(address)) {
                        authorityControlSearchReason = "host-inventory-distinct-control";
                        return new AuthorityControl(candidate, address);
                    }
                }
            }
            return null;
        } finally { authorityControlSearchMs = elapsed(started); }
    }

    private void startAuthorityBinding(Track target, Address address, AuthorityControl control) {
        authorityDistinctControlConfirmed = false;
        authority.finalTarget = target; authority.finalAddress = address;
        authority.canaryTarget = control == null ? null : control.target();
        authority.canaryAddress = control == null ? null : control.address();
        authority.used = true;
        if (control == null) beginStage(authority, "target", target, address);
        else {
            requireAddress(control.target(), control.address().row());
            if (!control.address().trackId().equals(control.target().channelId().get()) || address.equals(control.address()))
                throw new IllegalStateException("authority-control-changed");
            beginStage(authority, "canary", control.target(), control.address());
        }
    }

    /** Confirm the distinct physical binding before selecting the final source. */
    private void advanceAuthorityBinding() {
        advanceBinding(authority);
        if ("canary".equals(authority.stage) && "settling".equals(authority.phase) && bindingReady(authority)) {
            authorityDistinctControlConfirmed = true;
            beginStage(authority, "target", authority.finalTarget, authority.finalAddress);
        }
    }

    private ShadowAuthorityFallback.Source fallbackSource() {
        return new ShadowAuthorityFallback.Source() {
            public void point(Address address) {
                requireAddress(exactTarget, address.row());
                if (!address.trackId().equals(exactTarget.channelId().get())) throw new IllegalStateException("authority-target-changed");
                authority.identityGuard = activeIdentityGuard;
                startAuthorityBinding(exactTarget, address, hostAuthorityControl(address));
            }
            public void advance() { advanceAuthorityBinding(); }
            public boolean bound(Address address) { return "target".equals(authority.stage) && address.equals(authority.expected) && bindingReady(authority); }
            public long callbacks() { return authority.callbacks; }
            public Object openReadWindow() { return subscribed(authority) ? stepWindow.open() : null; }
            public boolean readWindowUnchanged(Object window) {
                return window instanceof StepDeltaWindow.Read read && stepWindow.unchanged(read);
            }
            public void confirmReadWindow(Object window) {
                if (window instanceof StepDeltaWindow.Read read) stepWindow.confirmLater(read, () -> true);
            }
            public StepDeltaWindow.State readWindowState(Object window) {
                if (!(window instanceof StepDeltaWindow.Read read)) return StepDeltaWindow.State.CHANGED;
                return read.state() == StepDeltaWindow.State.CONFIRMED && !stepWindow.admitted(read) ? StepDeltaWindow.State.CHANGED : read.state();
            }
            public Object guard() {
                RootIdentityProbe.IdentityGuard witness = freshIdentityGuard();
                if (!acquisitionAllowed(witness)) return null;
                return new AuthorityGuard(witness, cache.identityDomain());
            }
            public long windowVersion() {
                return Math.addExact(Math.addExact(authorityWindowVersion, cache.identityWindowVersion()),
                    identityProbe == null ? 0 : identityProbe.identityEpoch());
            }
            public Map<String, Object> metadata() { return ShadowCacheProbe.metadata(authority.clip); }
            public List<Note> read(Coordinate coordinate) {
                requireIdentityEpoch(authority.identityGuard);
                List<Note> values = ShadowCacheProbe.this.read(authority.clip, coordinate, true);
                requireIdentityEpoch(authority.identityGuard);
                return values.stream().map(note -> {
                    Map<String, Object> fields = new LinkedHashMap<>();
                    for (String field : exactCoverage.fields()) fields.put(field, note.fields().get(field));
                    return new Note(note.channel(), note.cell(), note.pitch(), fields);
                }).toList();
            }
        };
    }


    /** Attach the optional read-only witness. The listener must not call the host. */
    public void attachIdentityProbe(RootIdentityProbe probe) {
        if (identityProbe != null) throw new IllegalStateException("identity probe already attached");
        identityProbe = java.util.Objects.requireNonNull(probe);
        probe.addIdentityInvalidationListener(this::poisonIdentity);
        poisonIdentity("identity-probe-attached");
    }

    /** Retire from topology callbacks without a host read. */
    public void attachTopologyControl(ShadowTopologyControl control) {
        if (topologyControl != null) throw new IllegalStateException("topology control already attached");
        topologyControl = java.util.Objects.requireNonNull(control); topologyUsable = false;
        control.addInvalidationListener(() -> { topologyUsable = false; poisonIdentity("group-topology-changed"); });
    }

    public void setTotalExperimentalStepDataObservers(int count) {
        if (count < views.length + (authority == null ? 0 : 1))
            throw new IllegalArgumentException("total observer count is below shadow count");
        totalExperimentalStepDataObservers = count;
        if (count > MAX_OBSERVERS) poisonIdentity("combined-observer-budget");
    }

    /** Retire once per unresolved burst. Do not read a host proxy in this callback. */
    private void poisonIdentity(String reason) {
        automaticIdentityReason = reason;
        activeIdentityGuard = null;
        fallbackReason = reason;
        if (identityPoisoned) return;
        identityPoisoned = true;
        automaticIdentityInvalidations++;
        detachInventoryCoordinator("automatic-identity-invalidated");
        if (exactFallback != null) exactFallback.cancel("automatic-identity-invalidated");
        authorityWindowVersion = Math.incrementExact(authorityWindowVersion);
        handlePool.clear();
        for (View view : views) retireWithoutHost(view);
        if (authority != null) retireWithoutHost(authority);
        if (scan != null) { comparison = "window-changed"; windowChanges++; endScan("automatic-identity-invalidated"); }
        cache.projectChanged();
        inventoryEnumerated = false;
        inventoryEntries = 0;
        topology = null;
        contentEpoch = sceneEpoch = -1;
        canaryPassed = false;
    }

    private void retireWithoutHost(View view) {
        stepWindow.onRebind();
        stepWindow.discard(view.canaryRead); view.canaryRead = null; view.resultRead = null;
        releasePool(view);
        if (view.ref != null && cache.hasClip(view.ref) && !"retired".equals(view.phase)) cache.evict(view.ref);
        view.phase = "retired";
        view.expected = null;
        view.physicalBindingRevision++;
        view.hints.clear();
        view.physicalHintOverflow = false;
        view.usedForRebind |= view.used;
        view.lastResult = null;
        view.identityGuard = null;
        view.recorderPreserved = false;
        view.canaryVerified = false;
    }

    private RootIdentityProbe.IdentityGuard freshIdentityGuard() {
        if (identityProbe == null) {
            if (!hostModel) poisonIdentity("identity-probe-unavailable");
            return null;
        }
        long started = System.nanoTime();
        try {
            RootIdentityProbe.IdentityGuard guard = identityProbe.identityGuard();
            if (!guard.acquisitionAllowed()) { poisonIdentity(guardRefusal(guard)); return guard; }
            if (activeIdentityGuard != null && !activeIdentityGuard.equals(guard))
                poisonIdentity("identity-guard-window-changed");
            activeIdentityGuard = guard;
            identityPoisoned = false;
            automaticIdentityReason = guard.reason();
            return guard;
        } finally { identityGuardHostWorkMs += elapsed(started); }
    }

    private boolean acquisitionAllowed(RootIdentityProbe.IdentityGuard guard) {
        return topologyUsable && (identityProbe == null ? hostModel : guard != null && guard.acquisitionAllowed());
    }

    private String guardRefusal(RootIdentityProbe.IdentityGuard guard) {
        return !topologyUsable ? "group-topology-unproved" : guard == null ? "identity-probe-unavailable" : guard.refusalReason();
    }

    private boolean guardCurrent(RootIdentityProbe.IdentityGuard guard) {
        if (identityProbe == null) return hostModel;
        long started = System.nanoTime();
        try {
            if (guard != null && identityProbe.identityGuardCurrent(guard)) return true;
            poisonIdentity("identity-guard-window-changed");
            return false;
        } finally { identityGuardHostWorkMs += elapsed(started); }
    }

    private boolean identityEpochCurrent(RootIdentityProbe.IdentityGuard guard) {
        return identityProbe == null ? hostModel : !identityPoisoned && identityProbe.identityEpochCurrent(guard);
    }

    private void requireIdentityEpoch(RootIdentityProbe.IdentityGuard guard) {
        if (!identityEpochCurrent(guard)) throw new IllegalStateException("identity-window-changed");
    }


    public ShadowCacheProbe(ControllerHost host, RigConfig config) { this(host, config, false); }

    /** Model tests can supply a fixed host domain without a live identity probe. */
    ShadowCacheProbe(ControllerHost host, RigConfig config, boolean hostModel) {
        this.hostModel = hostModel;
        if (config.cacheShadowObservers < 0 || config.cacheShadowObservers >= MAX_OBSERVERS
            || config.cacheShadowSteps < 1 || config.cacheShadowSteps > MAX_WIDTH)
            throw new IllegalArgumentException("shadow cache configuration exceeds selected limits");
        scenes = config.scenes;
        coverage = new Coverage(0, config.cacheShadowSteps, true, FIELDS, UNKNOWN, "1/512-beat");
        stepWindow = new StepDeltaWindow(java.util.UUID.randomUUID().toString(),
            () -> identityProbe == null ? 0 : identityProbe.identityEpoch(), task -> host.scheduleTask(task, 0));
        long started = System.nanoTime();
        handlePool = new ShadowHandlePool(config.cacheShadowObservers);
        views = new View[config.cacheShadowObservers];
        for (int index = 0; index < views.length; index++) {
            views[index] = new View(host, "RESIDENT_" + index);
        }
        authority = views.length == 0 ? null : new View(host, "AUTHORITY");
        exactFallback = authority == null ? null : new ShadowAuthorityFallback(fallbackSource());
        constructionMs = elapsed(started);
        cache.attachExternalRecorderEstimate(() -> PHYSICAL_HINT_BYTES * physicalPending());
        cache.measureConstruction(constructionMs);
        totalExperimentalStepDataObservers = views.length + (authority == null ? 0 : 1);
    }

    /** Reject unknown structural order. New residence must replay after reset. */
    public void observeRig(Rig rig) {
        currentRig = rig;
        String membership = observeTopology();
        if (!topologyUsable) return;
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (!acquisitionAllowed(guard)) return;
        applyPhysicalOverload();
        StringBuilder ids = new StringBuilder();
        ids.append(rig.trackBank.itemCount().get()).append(':');
        for (int index = 0; index < rig.config.tracks; index++) {
            Track track = rig.trackBank.getItemAt(index);
            if (track.exists().get()) ids.append(track.channelId().get()).append(';');
        }
        if (!guardCurrent(guard)) return;
        String currentTopology = ids.append(membership).toString();
        if (topology != null && (!topology.equals(currentTopology)
            || contentEpoch != rig.launcherContentEpoch || sceneEpoch != rig.sceneCountChanges)) {
            invalidate("structural-event-requires-rebind");
            cache.resetInventoryForUnknownStructure("structural-event-requires-rebind");
            inventoryEnumerated = false;
            inventoryEntries = 0;
        }
        topology = currentTopology;
        contentEpoch = rig.launcherContentEpoch;
        sceneEpoch = rig.sceneCountChanges;
    }

    /** Check the independent topology source before a handler admits work. */
    String observeTopology() {
        if (topologyControl == null) return "";
        JsonObject read = topologyControl.snapshot();
        topologyUsable = read.get("membershipComplete").getAsBoolean();
        if (!topologyUsable) { poisonIdentity("group-topology-unproved"); return ""; }
        return read.get("tree").toString();
    }

    /** Enumerate a private registry. Partial configured banks cannot publish it. */
    public JsonObject inventory(Rig rig) {
        if (!inventoryCovered()) return inventoryRefusal();
        observeRig(rig);
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (!acquisitionAllowed(guard)) return info();
        if (inventoryEnumerated) return info();
        if (inventoryRebuild == null || !"enumerating".equals(inventoryRebuild.status().phase())) {
            invalidate("private-inventory-start");
            inventoryRebuild = inventoryCoordinator(rig);
            inventoryRebuild.start();
        }
        return finishInventoryStep();
    }

    /** Rebuild a fresh registry. Reset handles require a canary transition. */
    public JsonObject rebuildInventory(Rig rig) {
        return prepareInventoryRebuild(rig) ? finishInventoryStep() : info();
    }

    /** Prepare private staging. A caller must poll before any slot is read. */
    public JsonObject beginInventoryRebuild(Rig rig) {
        prepareInventoryRebuild(rig);
        return info();
    }

    private boolean prepareInventoryRebuild(Rig rig) {
        if (!inventoryCovered()) { inventoryRefusal(); return false; }
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (!acquisitionAllowed(guard)) return false;
        invalidate("explicit-inventory-rebuild");
        inventoryEnumerated = false;
        inventoryEntries = 0;
        physicalOverload = physicalOverloadApplied = false;
        observeRig(rig);
        inventoryRebuild = inventoryCoordinator(rig);
        inventoryRebuild.start();
        return true;
    }

    public JsonObject pollInventoryRebuild(Rig rig) {
        if (!inventoryCovered()) return inventoryRefusal();
        observeRig(rig);
        return inventoryRebuild == null ? info() : finishInventoryStep();
    }

    public JsonObject pollInventoryRebuild(Rig rig, int maximumBatchCells) {
        if (maximumBatchCells < 1 || maximumBatchCells > ShadowInventoryRebuild.MAX_CONTROL_BATCH_CELLS)
            throw new IllegalArgumentException("inventory control batch must contain 1 through 64 cells");
        if (!inventoryCovered()) return inventoryRefusal();
        observeRig(rig);
        return finishInventoryStep(maximumBatchCells);
    }

    public JsonObject cancelInventoryRebuild(String reason) {
        if (inventoryRebuild != null) inventoryRebuild.cancel(reason);
        return info();
    }

    /**
     * Slot inventory reads are outside every step observer's coverage. D26 does not
     * cover them, so live inventory publication keeps the 8g2 refusal. Only the fixed
     * host model without an identity probe can publish.
     */
    private boolean inventoryCovered() { return hostModel && identityProbe == null; }

    private JsonObject inventoryRefusal() {
        detachInventoryCoordinator("inventory-outside-step-coverage");
        fallbackReason = "inventory-outside-step-coverage";
        JsonObject result = info();
        result.addProperty("reason", "inventory-outside-step-coverage");
        result.addProperty("terminal", true);
        return result;
    }

    private ShadowInventoryRebuild inventoryCoordinator(Rig rig) {
        return new ShadowInventoryRebuild(cache, new ShadowInventoryRebuild.InventoryProvider() {
            public long cellCount() {
                return (long) rig.trackBank.itemCount().get() * rig.sceneBank.itemCount().get();
            }
            public boolean fullInventory() {
                return rig.trackBank.itemCount().get() <= rig.config.tracks && rig.sceneBank.itemCount().get() <= scenes;
            }
            public ShadowInventoryRebuild.Slot read(long index) {
                int rows = rig.sceneBank.itemCount().get();
                Track track = rig.trackBank.getItemAt((int) (index / rows));
                String id = track.channelId().get();
                if (!track.exists().get() || id == null || id.isEmpty()) throw new IllegalStateException("inventory track unavailable");
                int row = (int) (index % rows);
                return track.clipLauncherSlotBank().getItemAt(row).hasContent().get()
                    ? new ShadowInventoryRebuild.Slot(new Address(id, row), coverage) : null;
            }
        }, () -> {
            RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
            if (!acquisitionAllowed(guard)) return null;
            String source = guard == null ? null : guard.extensionInitNonce() + ":" + guard.continuityWindow() + ":" + guard.sourceFingerprint() + ":" + guard.chainIds();
            return new ShadowInventoryRebuild.Guard(source,
                topology + ":" + rig.launcherContentEpoch + ":" + rig.sceneCountChanges,
                guard == null ? 0 : guard.epoch(), false, true);
        }, (long) rig.config.tracks * scenes);
    }

    private JsonObject finishInventoryStep() {
        return finishInventoryStep(null);
    }

    private JsonObject finishInventoryStep(Integer maximumBatchCells) {
        if (inventoryRebuild == null) return info();
        ShadowInventoryRebuild.Status state = maximumBatchCells == null ? inventoryRebuild.step() : inventoryRebuild.step(maximumBatchCells);
        inventoryEnumerated = state.registryPublished();
        inventoryEntries = state.registryPublished() ? state.presentClips() : 0;
        if (state.terminal() && !state.registryPublished()) fallbackReason = state.reason();
        return info();
    }

    /** Keep the old attempt as history. It cannot restore current inventory flags. */
    private void detachInventoryCoordinator(String cause) {
        if (inventoryRebuild != null) {
            ShadowInventoryRebuild.Status state = inventoryRebuild.cancel(cause);
            lastRetiredInventoryRebuild = JSON.toJsonTree(state).getAsJsonObject();
            lastRetiredInventoryRebuild.addProperty("historicalRegistryWasPublished", state.registryPublished());
            lastRetiredInventoryRebuild.addProperty("registryPublished", false);
            lastRetiredInventoryRebuild.addProperty("phase", "aborted");
            lastRetiredInventoryRebuild.addProperty("reason", cause);
            lastRetiredInventoryRebuild.addProperty("terminal", true);
            lastRetiredInventoryRebuild.addProperty("explicitRetryAvailable", true);
            lastRetiredInventoryRebuild.addProperty("current", false);
            lastRetiredInventoryRebuild.addProperty("retired", true);
            lastRetiredInventoryRebuild.addProperty("retirementReason", cause);
            inventoryRebuild = null;
        }
        inventoryEnumerated = false;
        inventoryEntries = 0;
    }

    public JsonObject info() {
        JsonObject result = JSON.toJsonTree(cache.diagnostics()).getAsJsonObject();
        result.addProperty("inventoryControlRevision", "8g-inventory-preparation-v1");
        result.addProperty("inventoryControlMaximumBatchCells", ShadowInventoryRebuild.MAX_CONTROL_BATCH_CELLS);
        result.addProperty("authorityBindingRevision", "8g-authority-transition-v1");
        result.addProperty("authorityControlSearchCells", authorityControlSearchCells);
        result.addProperty("authorityControlSearchMs", authorityControlSearchMs);
        result.addProperty("authorityControlSearchReason", authorityControlSearchReason);
        result.addProperty("authorityDistinctControlConfirmed", authorityDistinctControlConfirmed);
        result.addProperty("residentHandles", views.length);
        result.add("handlePool", JSON.toJsonTree(handlePool.entries()));
        result.addProperty("exactFallbackActive", exactFallback != null && exactFallback.active());
        result.addProperty("unusedBindingHandles", java.util.Arrays.stream(views).filter(v -> !v.used).count());
        result.addProperty("inventoryEnumerated", inventoryEnumerated);
        result.addProperty("inventoryClipEntries", inventoryEntries);
        result.addProperty("rebuildTerminal", inventoryRebuild != null ? inventoryRebuild.status().terminal() : lastRetiredInventoryRebuild != null);
        result.addProperty("registryPublished", inventoryRebuild != null && inventoryRebuild.status().registryPublished());
        if (inventoryRebuild != null) result.add("inventoryRebuild", JSON.toJsonTree(inventoryRebuild.status()));
        else if (lastRetiredInventoryRebuild != null) result.add("inventoryRebuild", lastRetiredInventoryRebuild.deepCopy());
        if (lastRetiredInventoryRebuild != null) result.add("lastRetiredInventoryRebuild", lastRetiredInventoryRebuild.deepCopy());
        result.addProperty("authorityHandles", authority == null ? 0 : 1);
        result.addProperty("stepDataObservers", views.length + (authority == null ? 0 : 1));
        result.addProperty("shadowStepDataObservers", views.length + (authority == null ? 0 : 1));
        result.addProperty("totalExperimentalStepDataObservers", totalExperimentalStepDataObservers);
        result.addProperty("combinedObserverBudgetAdmitted", totalExperimentalStepDataObservers <= MAX_OBSERVERS);
        result.addProperty("constructionMeasurementAvailable", Double.isFinite(constructionMs) && constructionMs >= 0);
        result.addProperty("pingMeasurementAvailable", pingMeasurementAvailable);
        boolean replayMeasured = java.util.Arrays.stream(views).anyMatch(v -> v.replayElapsedMs > 0
            && "target".equals(v.stage) && ("settled".equals(v.phase) || "complete".equals(v.phase)) && valid(v));
        result.addProperty("requestedReplayMeasurementAvailable", replayMeasured);
        result.addProperty("cacheBudgetMeasurementsComplete", Double.isFinite(constructionMs) && constructionMs >= 0
            && pingMeasurementAvailable && replayMeasured);
        result.addProperty("automaticIdentityProbeAttached", identityProbe != null);
        result.addProperty("automaticIdentityEpoch", identityProbe == null ? -1 : identityProbe.identityEpoch());
        result.addProperty("automaticIdentityInvalidations", automaticIdentityInvalidations);
        result.addProperty("automaticIdentityPoisoned", identityPoisoned);
        result.addProperty("automaticIdentityReason", automaticIdentityReason);
        result.addProperty("identityWitnessAvailable", activeIdentityGuard != null && activeIdentityGuard.witnessAvailable());
        result.addProperty("identityContinuityProved", false);
        result.addProperty("continuityProtocol", StepDeltaWindow.PROTOCOL);
        result.addProperty("stepDataDeliveryAssumption", "D26");
        result.addProperty("callbackOrderingRule", "E217-later-callback-after-batch");
        result.addProperty("stepWindowCallbacks", stepWindow.steps());
        result.addProperty("stepWindowBindingRevision", stepWindow.bindingRevision());
        result.addProperty("stepWindowReadsOpened", stepWindow.readsOpened());
        result.addProperty("stepWindowConfirmations", stepWindow.confirmations());
        result.addProperty("stepWindowChanges", stepWindow.changes());
        result.addProperty("stepWindowRefusals", stepWindowRefusals);
        result.addProperty("retainedStepWindowDiscards", retainedStepWindowDiscards);
        result.addProperty("inventoryPublicationSupported", inventoryCovered());
        result.addProperty("liveAcquisitionSupported", false);
        result.addProperty("hostModel", hostModel);
        result.addProperty("hostInputFenceProved", false);
        result.addProperty("identityGuardHostWorkMs", identityGuardHostWorkMs);
        result.addProperty("authoritySettlementObservers", authority == null ? 0 : 1);
        result.addProperty("steps", coverage.width());
        result.addProperty("grid", GRID);
        result.addProperty("cacheBankConstructionMs", constructionMs);
        result.addProperty("canaryPassed", canaryPassed);
        Health modelHealth = cache.diagnostics().health();
        result.addProperty("cacheModelHealth", modelHealth.name().toLowerCase());
        result.addProperty("cacheModelReason", cache.diagnostics().reason());
        result.addProperty("health", modelHealth == Health.COMPLETE ? "partial" : modelHealth.name().toLowerCase());
        result.addProperty("complete", false);
        result.addProperty("eligible", false);
        result.addProperty("readMode", "refuse");
        result.addProperty("authorityAvailable", false);
        result.addProperty("fallbackPerformed", false);
        result.addProperty("reason", identityPoisoned ? automaticIdentityReason : "lifecycle-unverified");
        result.addProperty("lifecycleSignalsSupported", false);
        result.addProperty("projectScopeComplete", false);
        result.addProperty("lifecycleFallback", "project-lifecycle-fence-unproved");
        result.addProperty("optionalLifecycleWitnessSupported", identityProbe != null);
        result.addProperty("instrumentationRevision", "8g5a-group-topology-v2");
        result.addProperty("topologyUsable", topologyUsable);
        result.addProperty("topologyControlRevision", topologyControl == null ? "unattached" : ShadowTopologyControl.REVISION);
        result.addProperty("observerKind", "addStepDataObserver");
        result.addProperty("rebindPolicy", "preserve-current-or-forced-canary-transition");
        result.addProperty("callbackSourceIdentityKnown", false);
        result.addProperty("physicalPendingHints", physicalPending());
        result.addProperty("physicalHintDrops", java.util.Arrays.stream(views).mapToLong(v -> v.physicalHintDrops).sum());
        result.addProperty("physicalHintOverflow", physicalOverload || java.util.Arrays.stream(views).anyMatch(v -> v.physicalHintOverflow));
        result.addProperty("physicalHintRecorderEstimatedBytes", views.length * 256L + physicalPending() * 56L);
        result.addProperty("pendingWorkItemsIncludingPhysicalHints", physicalPending() + cache.diagnostics().pendingCoordinates());
        result.addProperty("comparison", comparison);
        result.addProperty("fallbackReason", fallbackReason);
        result.addProperty("authorityScans", scans);
        result.addProperty("matches", matches);
        result.addProperty("mismatches", mismatches);
        result.add("mismatchesByCause", JSON.toJsonTree(mismatchesByCause));
        result.add("comparisonRefusalsByCause", JSON.toJsonTree(comparisonRefusalsByCause));
        result.addProperty("windowChanges", windowChanges);
        result.addProperty("membershipGetStepCalls", membershipGetStepCalls);
        result.addProperty("authorityGetStepCalls", authorityGetStepCalls);
        result.addProperty("enrichmentGetStepCalls", enrichmentGetStepCalls);
        result.addProperty("membershipHostWorkMs", membershipHostWorkMs);
        result.addProperty("authorityHostWorkMs", authorityHostWorkMs);
        result.addProperty("enrichmentHostWorkMs", enrichmentHostWorkMs);
        result.addProperty("acquisitionNoteObjectsAllocated", acquisitionNoteObjects);
        result.addProperty("acquisitionMutableFieldMapObjectsAllocated", acquisitionFieldMapObjects);
        result.addProperty("allocationCountsScope", "explicit adapter allocations; excludes host and domain copies");
        result.addProperty("acquisitionListObjectsAllocated", acquisitionListObjects);
        result.addProperty("lastSnapshotSerializedBytes", lastSnapshotSerializedBytes);
        result.addProperty("lastAuthoritySerializedBytes", lastAuthoritySerializedBytes);
        result.addProperty("serializedBytesAreMemoryMeasurement", false);
        result.addProperty("durationTimingBasis", "R07-nearest-1/512-ties-up-minimum-one-cell");
        result.addProperty("gainDomain", "host-amplitude-ratio-portable-amplitude-ratio");
        result.addProperty("scanStagingNoteObjects", scan == null ? 0 : scan.notes.size());
        result.addProperty("scanStagingPayloadEstimatedBytes", scan == null ? 0 : scan.estimatedBytes);
        result.add("resourceAccounting", resourceAccounting());
        result.addProperty("enrichmentBatches", enrichmentBatches);
        result.add("lastScanPhaseTimesMs", lastScanPhaseTimes.deepCopy());
        result.add("lastSnapshotCandidate", lastCandidate.deepCopy());
        return result;
    }

    /**
     * One accounting boundary for extension-owned shadow estimates. Each domain has its selected limit.
     * Authority staging is the independent oracle or exact-fallback buffer; only one can be active.
     * No combined limit is selected. Estimates are not heap, host, or serialized-byte measurements.
     */
    private JsonObject resourceAccounting() {
        ShadowProjectCache.ResourceAccounting core = cache.resources();
        JsonObject result = JSON.toJsonTree(core).getAsJsonObject();
        long comparison = scan == null ? 0 : scan.estimatedBytes;
        long exact = exactFallback == null ? 0 : exactFallback.stagedEstimatedBytes();
        result.addProperty("physicalHintQueueEstimatedBytes", PHYSICAL_HINT_BYTES * physicalPending());
        result.addProperty("comparisonAuthorityStagingEstimatedBytes", comparison);
        result.addProperty("exactAuthorityStagingEstimatedBytes", exact);
        result.addProperty("authorityDomainEstimatedBytes", comparison + exact);
        result.addProperty("authorityLimitBytes", MAX_SNAPSHOT_BYTES);
        long registry = inventoryRebuild == null ? 0 : inventoryRebuild.status().registryMetadataEstimatedBytes();
        result.addProperty("registryAttemptEstimatedBytes", registry);
        result.addProperty("registryAttemptLimitBytes", ShadowInventoryRebuild.DEFAULT_REGISTRY_METADATA_BUDGET_BYTES);
        result.addProperty("totalEstimatedBytes", core.recorderDomainEstimatedBytes() + core.snapshotDomainEstimatedBytes()
            + comparison + exact + registry + core.identityAndWitnessEstimatedBytes());
        result.addProperty("combinedLimitSelected", false);
        result.addProperty("hostMemoryMeasured", false);
        result.addProperty("serializedBytesAreMemoryMeasurement", false);
        result.addProperty("accountingRevision", "8g3-resource-accounting-v1");
        if (topologyControl != null) result.add("topologyControl", topologyControl.resources());
        return result;
    }

    public JsonObject point(int index, Track target, int row) {
        View view = view(index);
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (totalExperimentalStepDataObservers > MAX_OBSERVERS) return fallback(view, "combined-observer-budget");
        if (!acquisitionAllowed(guard)) return fallback(view, guardRefusal(guard));
        applyPhysicalOverload();
        if (physicalOverload) return fallback(view, "physical-hint-backpressure-rebuild-required");
        if (valid(view) && ("settled".equals(view.phase) || "complete".equals(view.phase))
            && view.expected.equals(new Address(target.channelId().get(), row)) && !view.physicalHintOverflow) {
            if (identityProbe != null && !guardCurrent(view.identityGuard))
                return fallback(view, "identity-unverified-requires-forced-canary");
            view.recorderPreserved = true;
            view.sameTargetPreserves++;
            return status(index);
        }
        if (view.used) return fallback(view, "populated-canary-required-for-rebind");
        return startPoint(view, target, row, null, -1);
    }

    /** Reset before a forced populated-canary transition. No fixture is created here. */
    public JsonObject point(int index, Track target, int row, Track canary, int canaryRow) {
        View view = view(index);
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (totalExperimentalStepDataObservers > MAX_OBSERVERS) return fallback(view, "combined-observer-budget");
        if (!acquisitionAllowed(guard)) return fallback(view, guardRefusal(guard));
        applyPhysicalOverload();
        if (physicalOverload) return fallback(view, "physical-hint-backpressure-rebuild-required");
        requireAddress(target, row);
        requireAddress(canary, canaryRow);
        if (target.channelId().get().equals(canary.channelId().get()) && row == canaryRow)
            return fallback(view, "canary-must-differ-from-target");
        return startPoint(view, target, row, canary, canaryRow);
    }

    private void requireAddress(Track target, int row) {
        if (row < 0 || row >= scenes) throw new IllegalArgumentException("row outside configured Launcher bank");
        if (target == null || !target.exists().get() || target.channelId().get() == null
            || target.channelId().get().isEmpty()) throw new IllegalArgumentException("track identity unavailable");
        if (!target.clipLauncherSlotBank().getItemAt(row).hasContent().get())
            throw new IllegalArgumentException("target slot has no clip");
    }

    private JsonObject startPoint(View view, Track target, int row, Track canary, int canaryRow) {
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (!acquisitionAllowed(guard)) return fallback(view, guardRefusal(guard));
        if (row < 0 || row >= scenes) throw new IllegalArgumentException("row outside configured Launcher bank");
        String id = target.channelId().get();
        if (!target.exists().get() || id == null || id.isEmpty()) return fallback(view, "track-identity-unavailable");
        if (!target.clipLauncherSlotBank().getItemAt(row).hasContent().get()) return fallback(view, "absent-slot");
        Address address = new Address(id, row);
        String ref = cache.clipAt(address);
        for (View resident : views) {
            if (resident != view && ref != null && ref.equals(resident.ref) && !"retired".equals(resident.phase))
                return fallback(view, "clip-already-resident");
        }
        boolean alreadyCanary = canary != null && view.track.exists().get() && view.clip.exists().get()
            && canary.channelId().get().equals(view.track.channelId().get())
            && canaryRow == view.clip.clipLauncherSlot().sceneIndex().get();
        if (!guardCurrent(guard)) return fallback(view, "identity-window-changed");
        retire(viewIndex(view));
        if (ref == null) ref = cache.create(address, coverage);
        if (!cache.admit(ref)) return fallback(view, "cache-admission-refused");
        view.used = true;
        view.identityGuard = guard;
        view.ref = ref;
        view.token = cache.bindingToken(ref);
        view.finalTarget = target;
        view.finalAddress = address;
        view.canaryTarget = canary;
        view.canaryAddress = canary == null ? null : new Address(canary.channelId().get(), canaryRow);
        view.canaryVerified = false;
        view.recorderPreserved = false;
        view.requestStarted = System.nanoTime();
        if (canary == null) beginStage(view, "target", target, address);
        else if (alreadyCanary) beginStage(view, "escape", target, address);
        else beginStage(view, "canary", canary, view.canaryAddress);
        if (!guardCurrent(guard)) return fallback(view, "identity-window-changed");
        return status(viewIndex(view));
    }

    private int viewIndex(View view) {
        for (int index = 0; index < views.length; index++) if (views[index] == view) return index;
        throw new IllegalArgumentException("not a resident view");
    }

    private void beginStage(View view, String stage, Track target, Address address) {
        stepWindow.onRebind();
        view.canaryRead = null;
        view.physicalBindingRevision++;
        view.hints.clear();
        view.physicalHintOverflow = false;
        view.onsetCallbacks = 0;
        view.unchanged = 0;
        view.lastPoll = 0;
        view.stage = stage;
        view.target = target;
        view.expected = address;
        view.phase = "track";
        view.started = view.bindingStarted = System.nanoTime();
        view.clip.isPinned().set(false);
        view.track.isPinned().set(false);
        view.track.selectChannel(target);
    }

    private int physicalPending() {
        return java.util.Arrays.stream(views).filter(java.util.Objects::nonNull).mapToInt(v -> v.hints.size()).sum();
    }

    private void applyPhysicalOverload() {
        if (physicalOverload && !physicalOverloadApplied) {
            physicalOverloadApplied = true;
            invalidate("physical-hint-backpressure");
            cache.requireRebuild("physical-hint-backpressure");
        }
    }

    public JsonObject poll(int index) {
        View view = view(index);
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (totalExperimentalStepDataObservers > MAX_OBSERVERS) return fallback(view, "combined-observer-budget");
        if (!acquisitionAllowed(guard)) return fallback(view, guardRefusal(guard));
        applyPhysicalOverload();
        if (physicalOverload) return fallback(view, "physical-hint-backpressure-rebuild-required");
        if (!"unbound".equals(view.phase) && !"settled".equals(view.phase)
            && !"complete".equals(view.phase) && !"retired".equals(view.phase)
            && elapsed(view.bindingStarted) > 5_000) {
            cache.invalidate(view.ref, "binding-budget");
            view.phase = "retired";
            return fallback(view, "binding-budget");
        }
        if (view.requestStarted != 0 && !("complete".equals(view.phase) || "settled".equals(view.phase))
            && elapsed(view.requestStarted) > 40_000) {
            retire(index);
            return fallback(view, "binding-sequence-budget");
        }
        advanceBinding(view);
        if (!guardCurrent(view.identityGuard)) return fallback(view, "identity-window-changed");
        if ("settling".equals(view.phase)) {
            quietPoll(view);
            if (elapsed(view.started) > 5_000) {
                cache.invalidate(view.ref, "replay-budget");
                view.phase = "retired";
                return fallback(view, "replay-budget");
            }
            if (elapsed(view.started) >= 1_500 && view.unchanged >= 10) {
                view.replayElapsedMs = elapsed(view.started);
                view.phase = "settled";
            }
        }
        if ("settled".equals(view.phase) && !"target".equals(view.stage)) {
            if ("escape".equals(view.stage)) {
                beginStage(view, "canary", view.canaryTarget, view.canaryAddress);
            } else if (view.canaryRead == null) {
                // Capture the window before target confirmation. The read stays pending until a later task confirms it.
                StepDeltaWindow.Read read = stepWindow.open();
                if (!subscribed(view)) { retire(index); return fallback(view, "observer-unsubscribed"); }
                boolean populated = false;
                long started = System.nanoTime();
                try {
                    for (Coordinate coordinate : new ArrayList<>(view.hints.keySet())) {
                        if (elapsed(started) >= BATCH_MS) break;
                        if (!guardedMembership(view, coordinate).isEmpty()) { populated = true; break; }
                    }
                } catch (RuntimeException error) { return fallback(view, "identity-window-changed"); }
                if (!guardCurrent(view.identityGuard)) return fallback(view, "identity-window-changed");
                if (!populated || !bindingReady(view) || elapsed(started) > 50 || view.physicalHintOverflow) {
                    retire(index);
                    return fallback(view, "populated-canary-replay-unavailable");
                }
                if (!stepWindow.unchanged(read)) return stepWindowChanged(index, view);
                view.canaryRead = read;
                // Canary hints only locate replayed notes. The step count covers any new hint.
                stepWindow.confirmLater(read, () -> true);
            } else {
                StepDeltaWindow.State state = view.canaryRead.state();
                if (state == StepDeltaWindow.State.PENDING) return status(index);
                if (!stepWindow.admitted(view.canaryRead) || !bindingReady(view)) return stepWindowChanged(index, view);
                view.canaryVerified = true;
                beginStage(view, "target", view.finalTarget, view.finalAddress);
            }
        }
        if (!guardCurrent(view.identityGuard)) return fallback(view, "identity-window-changed");
        acceptPool(view);
        return status(index);
    }

    public JsonObject reconcile(int index) {
        View view = view(index);
        RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
        if (totalExperimentalStepDataObservers > MAX_OBSERVERS) return fallback(view, "combined-observer-budget");
        if (!acquisitionAllowed(guard)) return fallback(view, guardRefusal(guard));
        applyPhysicalOverload();
        if (physicalOverload) return fallback(view, "physical-hint-backpressure-rebuild-required");
        if (!valid(view) || !("settled".equals(view.phase) || "complete".equals(view.phase)))
            return fallback(view, "binding-or-replay-incomplete");
        if (!"target".equals(view.stage)) return fallback(view, "canary-transition-incomplete");
        if (view.physicalHintOverflow) {
            cache.invalidate(view.ref, "physical-hint-backpressure");
            return fallback(view, "physical-hint-backpressure");
        }
        long started = System.nanoTime();
        // These are current-target read requests. Their source callback identity is unknown.
        long revision = view.physicalBindingRevision;
        for (Map.Entry<Coordinate, Long> hint : new ArrayList<>(view.hints.entrySet())) {
            if (!valid(view) || revision != view.physicalBindingRevision) return fallback(view, "hint-binding-changed");
            if (!cache.callback(view.ref, view.token, hint.getKey())) return fallback(view, "hint-admission-refused");
            view.hints.remove(hint.getKey(), hint.getValue());
        }
        if (!guardCurrent(view.identityGuard)) return fallback(view, "identity-window-changed");
        int count = cache.reconcile(view.ref, coordinate -> guardedMembership(view, coordinate), MAX_PENDING, BATCH_MS);
        if (!guardCurrent(view.identityGuard)) return fallback(view, "identity-window-changed");
        JsonObject result = status(index);
        result.addProperty("reconciledCoordinates", count);
        result.addProperty("reconcileMs", elapsed(started));
        return result;
    }

    public JsonObject compareStart(int index) { return compareStart(index, Integer.MAX_VALUE); }

    /** A research control caps enrichment coordinates per poll, so interruption tests can stop partial work. */
    public JsonObject compareStart(int index, int maximumEnrichmentCoordinates) {
        if (maximumEnrichmentCoordinates < 1) throw new IllegalArgumentException("enrichment batch must contain at least one coordinate");
        View view = view(index);
        RootIdentityProbe.IdentityGuard identity = freshIdentityGuard();
        if (!acquisitionAllowed(identity)) return fallback(view, guardRefusal(identity));
        if (scan != null || (exactFallback != null && exactFallback.active())) return fallback(view, "authority-scan-busy");
        if (exactFallback != null) exactFallback.cancel("authority-reused-for-comparison");
        // A fresh read supersedes retained output. The core also drops the retained snapshot before enrichment.
        view.lastResult = null; view.resultRead = null;
        authorityWindowVersion = Math.incrementExact(authorityWindowVersion);
        if (!valid(view) || !("settled".equals(view.phase) || "complete".equals(view.phase)))
            return fallback(view, "binding-or-replay-incomplete");
        // The membership window opens before reconciliation confirms the target.
        StepDeltaWindow.Read membership = stepWindow.open();
        if (!subscribed(view) || !subscribed(authority)) return fallback(view, "observer-unsubscribed");
        reconcile(index);
        if (!valid(view)) return fallback(view, "reconciliation-invalidated-binding");
        if (!"target".equals(view.stage) || !view.hints.isEmpty() || view.physicalHintOverflow)
            return fallback(view, "physical-hints-pending");
        if (!guardCurrent(view.identityGuard)) return fallback(view, "identity-window-changed");
        AuthorityControl control = view.canaryTarget == null || view.canaryAddress == null ? null : new AuthorityControl(view.canaryTarget, view.canaryAddress);
        if (control != null) {
            try { requireAddress(control.target(), control.address().row()); }
            catch (RuntimeException error) { scan = new Scan(view, ++scanSequence); return finishWindowChange("authority-control-unavailable"); }
        }
        if (!stepWindow.unchanged(membership)) return stepWindowChanged(index, view);
        scan = new Scan(view, ++scanSequence);
        scan.enrichmentBatchCoordinates = maximumEnrichmentCoordinates;
        scan.membershipRead = membership;
        stepWindow.confirmLater(membership, () -> view.hints.isEmpty() && !view.physicalHintOverflow);
        comparison = "pending";
        return comparePoll();
    }

    /**
     * Scan authority without using callback coordinates or cached membership.
     * Membership, authority reads, and the result each need a confirmed step-delta
     * window. The authority binding starts a new window. The resident callback
     * count must stay unchanged across that transition.
     */
    public JsonObject comparePoll() {
        if (scan == null) return info();
        Scan work = scan;
        View view = work.view;
        if (!guardCurrent(work.identityGuard)) return finishWindowChange("window-changed");
        // A known change ends the scan before any later stage can use its reads.
        StepDeltaWindow.Read open = "membership".equals(work.stage) ? work.membershipRead
            : "result".equals(work.stage) || "enrichment".equals(work.stage) ? work.resultRead : work.authorityRead;
        if (open != null && (open.state() == StepDeltaWindow.State.CHANGED || !stepWindow.unchanged(open)))
            return finishStepWindowChange(work);
        if (!valid(view) || view.callbacks != work.callbacks || !work.metadata.equals(metadata(view.clip)))
            return finishWindowChange("window-changed");
        if (elapsed(work.started) > 40_000) return finishWindowChange("authority-scan-budget");
        if ("membership".equals(work.stage)) {
            if (work.membershipRead.state() == StepDeltaWindow.State.PENDING) return scanStatus();
            if (!stepWindow.admitted(work.membershipRead)) return finishStepWindowChange(work);
            AuthorityControl control = view.canaryTarget == null || view.canaryAddress == null ? null : new AuthorityControl(view.canaryTarget, view.canaryAddress);
            authority.identityGuard = view.identityGuard;
            try { startAuthorityBinding(view.target, view.expected, control); }
            catch (RuntimeException error) { return finishWindowChange("authority-control-unavailable"); }
            work.stage = "authority"; work.phase("authority-binding");
            return scanStatus();
        }
        if ("settlement".equals(work.stage)) return settleConfirmed(work);
        if ("enrichment".equals(work.stage)) return enrichConfirmed(work);
        if ("result".equals(work.stage)) return publishConfirmed(work);
        try { advanceAuthorityBinding(); }
        catch (RuntimeException error) { return finishWindowChange("authority-binding-unavailable"); }
        if (!"target".equals(authority.stage) || !"settling".equals(authority.phase)) {
            if (elapsed(work.started) > 5_000) return finishWindowChange("authority-binding-budget");
            return scanStatus();
        }
        if (work.authorityBoundAt == 0) work.authorityBoundAt = System.nanoTime();
        quietPoll(authority);
        if (elapsed(work.authorityBoundAt) < 1_500 || authority.unchanged < 10) {
            if (elapsed(work.authorityBoundAt) > 5_000) return finishWindowChange("authority-replay-budget");
            return scanStatus();
        }
        if (!work.authorityReady) {
            work.authorityReady = true; work.phase("authority-reads");
            work.authorityCallbacks = authority.callbacks;
            // The read window opens before the authority target is confirmed.
            work.authorityRead = stepWindow.open();
        }
        if (authority.callbacks != work.authorityCallbacks) return finishWindowChange("window-changed");
        if (!bindingReady(authority)) return finishWindowChange("authority-binding-changed");
        if (!stepWindow.unchanged(work.authorityRead)) return finishStepWindowChange(work);
        long batchStarted = System.nanoTime();
        int end = coverage.width() * KEYS;
        try {
            while (work.next < end && elapsed(batchStarted) < BATCH_MS) {
                Coordinate coordinate = new Coordinate(work.next / KEYS, work.next % KEYS);
                requireIdentityEpoch(work.identityGuard);
                List<Note> notes = read(authority.clip, coordinate, true);
                requireIdentityEpoch(work.identityGuard);
                if (!stepWindow.unchanged(work.authorityRead)) return finishStepWindowChange(work);
                work.notes.addAll(notes);
                work.estimatedBytes += notes.size() * (160L + FIELDS.size() * 64L);
                work.next++;
                if (work.estimatedBytes > MAX_SNAPSHOT_BYTES) return finishWindowChange("authority-staging-memory-budget");
            }
        } catch (RuntimeException error) {
            return finishWindowChange(identityEpochCurrent(work.identityGuard) ? "authority-unavailable" : "window-changed");
        }
        if (!guardCurrent(work.identityGuard)) return finishWindowChange("window-changed");
        double batchMs = elapsed(batchStarted);
        work.hostWorkMs += batchMs;
        if (batchMs > HOST_WORK_LIMIT_MS) return finishWindowChange("authority-host-work-budget");
        if (work.next < end) return scanStatus();
        if (!finalReadsCurrent(work)) return finishWindowChange("window-changed");
        if (!stepWindow.unchanged(work.authorityRead)) return finishStepWindowChange(work);
        // Settlement waits for a later callback that sees the same window.
        work.stage = "settlement"; work.phase("settlement-confirmation");
        stepWindow.confirmLater(work.authorityRead, () -> view.hints.isEmpty() && !view.physicalHintOverflow);
        return scanStatus();
    }

    private boolean finalReadsCurrent(Scan work) { return finalReadsCurrent(work, true); }

    /** Publication omits metadata. The result already compared metadata inside its confirmed window. */
    private boolean finalReadsCurrent(Scan work, boolean metadata) {
        View view = work.view;
        return valid(view) && view.callbacks == work.callbacks && authority.callbacks == work.authorityCallbacks
            && view.hints.isEmpty() && !view.physicalHintOverflow && bindingReady(authority)
            && (!metadata || (work.metadata.equals(metadata(view.clip)) && work.metadata.equals(metadata(authority.clip))))
            && guardCurrent(work.identityGuard);
    }

    /** Apply settlement only after confirmation. Enrichment reads then use the same window value. */
    private JsonObject settleConfirmed(Scan work) {
        if (work.authorityRead.state() == StepDeltaWindow.State.PENDING) return scanStatus();
        if (!stepWindow.admitted(work.authorityRead)) return finishStepWindowChange(work);
        if (!finalReadsCurrent(work)) return finishWindowChange("window-changed");
        View view = work.view;
        boolean populated = view.onsetCallbacks > 0 && !work.notes.isEmpty();
        boolean canary = view.canaryVerified || (!view.usedForRebind && populated);
        work.pendingPopulated = populated;
        boolean settled = cache.settleReplay(view.ref, new ReplayWitness(canary, true, true,
            view.replayElapsedMs, view.unchanged, 50));
        if (!settled && cache.clipHealth(view.ref) != Health.COMPLETE) {
            // No cache content is read. The confirmed authority read supports this refusal.
            work.pendingComparison = canary ? "replay-incomplete" : "populated-canary-unavailable";
            work.resultRead = work.authorityRead;
            return publish(work);
        }
        StepDeltaWindow.Read result = stepWindow.open();
        if (!result.value().equals(work.authorityRead.value())) return finishStepWindowChange(work);
        // Enrichment reads stay inside one result window. Each poll runs one bounded batch.
        work.resultRead = result;
        work.candidate = cache.beginSnapshot(view.ref, coverage, work.metadata, "settled-independent-1/512-authority",
            ENRICHMENT_DEADLINE_MS);
        work.stage = "enrichment"; work.phase("enrichment");
        return enrichConfirmed(work);
    }

    /** Run one enrichment batch. Compare and request confirmation only after the final batch. */
    private JsonObject enrichConfirmed(Scan work) {
        View view = work.view;
        if (!stepWindow.unchanged(work.resultRead)) return finishStepWindowChange(work);
        if (!finalReadsCurrent(work)) return finishWindowChange("window-changed");
        cache.enrich(work.candidate, coordinate -> guardedEnrichment(view, coordinate), BATCH_MS, work.enrichmentBatchCoordinates);
        enrichmentBatches++;
        if (!guardCurrent(work.identityGuard)) return finishWindowChange("window-changed");
        if (view.callbacks != work.callbacks || authority.callbacks != work.authorityCallbacks || !bindingReady(authority))
            return finishWindowChange("window-changed");
        if (!stepWindow.unchanged(work.resultRead)) return finishStepWindowChange(work);
        if ("enriching".equals(work.candidate.phase())) return scanStatus();
        Result candidate = cache.finishSnapshot(work.candidate, true);
        String outcome = candidate.snapshot() == null ? candidate.reason()
            : cache.compare(candidate.snapshot(), coverage, metadata(authority.clip), work.notes);
        if (view.callbacks != work.callbacks || authority.callbacks != work.authorityCallbacks || !bindingReady(authority))
            outcome = "window-changed";
        if ("window-changed".equals(outcome)) return finishWindowChange("window-changed");
        if (!stepWindow.unchanged(work.resultRead)) return finishStepWindowChange(work);
        work.pendingComparison = outcome;
        work.pendingResult = candidate;
        work.stage = "result"; work.phase("result-confirmation");
        stepWindow.confirmLater(work.resultRead, () -> view.hints.isEmpty() && !view.physicalHintOverflow);
        return scanStatus();
    }

    private JsonObject publishConfirmed(Scan work) {
        if (work.resultRead.state() == StepDeltaWindow.State.PENDING) return scanStatus();
        if (!stepWindow.admitted(work.resultRead)) return finishStepWindowChange(work);
        if (!finalReadsCurrent(work, false)) return finishWindowChange("window-changed");
        return publish(work);
    }

    /** Publish one confirmed comparison. */
    private JsonObject publish(Scan work) {
        View view = work.view;
        comparison = work.pendingComparison;
        if (work.pendingResult != null && work.pendingResult.snapshot() != null) {
            if ("match".equals(comparison)) {
                canaryPassed |= work.pendingPopulated;
                view.phase = "complete";
                view.lastResult = work.pendingResult;
                view.resultRead = work.resultRead;
            } else {
                cache.evict(view.ref); releasePool(view); view.phase = "retired";
                view.lastResult = null; view.resultRead = null;
            }
        }
        scans++;
        if ("match".equals(comparison)) matches++;
        else if (Set.of("mismatch", "coverage-mismatch", "metadata-mismatch", "membership-mismatch", "field-mismatch").contains(comparison)) {
            mismatches++;
            mismatchesByCause.merge(comparison, 1L, Long::sum);
        } else comparisonRefusalsByCause.merge(comparison, 1L, Long::sum);
        JsonObject result = scanStatus();
        result.addProperty("comparison", comparison);
        result.addProperty("complete", false);
        result.addProperty("eligible", false);
        result.addProperty("contentComparisonComplete", "match".equals(comparison));
        result.addProperty("readMode", "exact-fallback");
        result.addProperty("reason", "lifecycle-unverified");
        result.addProperty("authorityAvailable", true);
        result.addProperty("fallbackPerformed", true);
        result.addProperty("stepWindowConfirmed", true);
        result.addProperty("authorityNoteCount", work.notes.size());
        result.add("authorityNotes", JSON.toJsonTree(work.notes));
        result.add("authorityMetadata", JSON.toJsonTree(work.metadata));
        lastAuthoritySerializedBytes = JSON.toJson(work.notes).getBytes(StandardCharsets.UTF_8).length
            + JSON.toJson(work.metadata).getBytes(StandardCharsets.UTF_8).length;
        result.addProperty("lastAuthoritySerializedBytes", lastAuthoritySerializedBytes);
        result.add("authorityCoverage", JSON.toJsonTree(coverage));
        if ("match".equals(comparison)) {
            result.add("diagnosticSnapshot", JSON.toJsonTree(view.lastResult.snapshot()));
            lastSnapshotSerializedBytes = JSON.toJson(view.lastResult.snapshot()).getBytes(StandardCharsets.UTF_8).length;
            result.addProperty("lastSnapshotSerializedBytes", lastSnapshotSerializedBytes);
        }
        endScan("published");
        result.add("scanPhaseTimesMs", lastScanPhaseTimes.deepCopy());
        result.add("resourceAccounting", resourceAccounting());
        return result;
    }

    /** A changed or unconfirmed window ends the scan and retires the resident binding. */
    private JsonObject finishStepWindowChange(Scan work) {
        if (scan != work) {
            // Retirement already cancelled this scan and counted its changed window.
            JsonObject result = scanStatus();
            result.addProperty("comparison", comparison); result.addProperty("reason", comparison); result.addProperty("terminal", true);
            return result;
        }
        stepWindowRefusals++;
        stepWindow.discard(work.membershipRead); stepWindow.discard(work.authorityRead); stepWindow.discard(work.resultRead);
        JsonObject result = finishWindowChange("step-window-changed");
        retireStepWindow(viewIndex(work.view));
        return result;
    }

    /** A read schedules a fresh comparison. A retained result is historical. */
    public JsonObject readSnapshot(int index) { return compareStart(index); }

    public JsonObject status(int index) {
        View view = view(index);
        // Retained output needs its confirmed window to be unchanged. A later step or rebind discards it.
        if (view.lastResult != null && !stepWindow.admitted(view.resultRead)) {
            view.lastResult = null; view.resultRead = null; retainedStepWindowDiscards++;
        }
        if (view.lastResult != null) guardCurrent(view.identityGuard);
        JsonObject result = info();
        result.addProperty("index", index);
        result.addProperty("phase", view.phase);
        result.addProperty("clipRef", view.ref);
        result.addProperty("callbacks", view.callbacks);
        result.addProperty("onsetCallbacks", view.onsetCallbacks);
        result.addProperty("rejectedHostCallbacks", view.rejected);
        result.addProperty("quietPolls", view.unchanged);
        result.addProperty("bindingReady", view.expected != null && bindingReady(view));
        result.addProperty("clipExists", view.clip.exists().get());
        result.addProperty("physicalViewPendingHints", view.hints.size());
        result.addProperty("physicalBindingRevision", view.physicalBindingRevision);
        result.addProperty("physicalViewHintDrops", view.physicalHintDrops);
        result.addProperty("canaryPhase", view.stage);
        result.addProperty("canaryVerifiedForBinding", view.canaryVerified);
        result.addProperty("recorderPreserved", view.recorderPreserved);
        result.addProperty("sameTargetPreserves", view.sameTargetPreserves);
        if (view.ref == null || !cache.hasClip(view.ref) || "retired".equals(view.phase)) result.addProperty("health", "invalid");
        else {
            Health state = cache.clipHealth(view.ref);
            result.addProperty("cacheModelHealth", state.name().toLowerCase());
            result.addProperty("health", state == Health.COMPLETE ? "partial" : state.name().toLowerCase());
        }
        result.add("tokens", JSON.toJsonTree(view.token));
        if (view.expected != null) result.add("address", JSON.toJsonTree(view.expected));
        if (view.lastResult != null) {
            result.add("historicalSnapshot", JSON.toJsonTree(view.lastResult.snapshot()));
            if (!guardCurrent(view.identityGuard)) {
                result.remove("historicalSnapshot");
                result.addProperty("phase", "retired");
                result.addProperty("health", "invalid");
            }
        }
        return result;
    }

    public JsonObject retire(int index) {
        View view = view(index);
        if (reservationBeingBound == null || reservationBeingBound.index() != index) releasePool(view);
        if (view.ref != null && cache.hasClip(view.ref) && !"retired".equals(view.phase)) cache.evict(view.ref);
        stepWindow.onRebind();
        stepWindow.discard(view.canaryRead); view.canaryRead = null; view.resultRead = null;
        view.phase = "retired";
        view.physicalBindingRevision++;
        view.hints.clear();
        view.physicalHintOverflow = false;
        view.usedForRebind |= view.used;
        view.lastResult = null;
        if (scan != null && scan.view == view) {
            comparison = "window-changed";
            fallbackReason = "authority-scan-cancelled";
            windowChanges++;
            endScan("authority-scan-cancelled");
        }
        return status(index);
    }

    public JsonObject invalidate(String reason) {
        if (exactFallback != null) exactFallback.cancel(reason);
        authorityWindowVersion = Math.incrementExact(authorityWindowVersion);
        handlePool.clear();
        detachInventoryCoordinator(reason);
        fallbackReason = reason;
        for (int index = 0; index < views.length; index++) if (views[index].used) retire(index);
        endScan(reason);
        canaryPassed = false;
        return info();
    }

    public JsonObject lifecycle(String kind) {
        if ("save".equals(kind)) {
            RootIdentityProbe.IdentityGuard guard = freshIdentityGuard();
            if (acquisitionAllowed(guard) && guardCurrent(guard)) cache.save();
            return info();
        }
        invalidate("explicit-project-lifecycle:" + kind);
        cache.projectChanged();
        inventoryEnumerated = false;
        inventoryEntries = 0;
        topology = null;
        return info();
    }

    public JsonObject ping(double p95Ms) {
        pingMeasurementAvailable = Double.isFinite(p95Ms) && p95Ms >= 0;
        cache.measurePing(p95Ms);
        return info();
    }

    private static void quietPoll(View view) {
        if (view.lastPoll == 0 || elapsed(view.lastPoll) >= 50) {
            view.unchanged = view.callbacks == view.lastCallbacks ? view.unchanged + 1 : 0;
            view.lastCallbacks = view.callbacks;
            view.lastPoll = System.nanoTime();
        }
    }

    private void advanceBinding(View view) {
        Address expected = view.expected;
        Track target = view.target;
        RootIdentityProbe.IdentityGuard guard = view.identityGuard;
        if (expected == null || target == null || !identityEpochCurrent(guard)) return;
        String targetId = target.channelId().get();
        boolean trackExists = view.track.exists().get();
        String trackId = view.track.channelId().get();
        boolean trackPinned = view.track.isPinned().get();
        boolean clipExists = view.clip.exists().get();
        int row = view.clip.clipLauncherSlot().sceneIndex().get();
        boolean clipPinned = view.clip.isPinned().get();
        if (expected != view.expected || !identityEpochCurrent(guard)) return;
        if (!expected.trackId().equals(targetId)) { view.phase = "retired"; return; }
        if ("track".equals(view.phase) && trackExists && expected.trackId().equals(trackId)) {
            stepWindow.onRebind();
            view.track.isPinned().set(true);
            if (expected == view.expected && identityEpochCurrent(guard)) view.phase = "track-pin";
            return;
        }
        if ("track-pin".equals(view.phase) && trackPinned && expected.trackId().equals(trackId)) {
            stepWindow.onRebind();
            target.selectSlot(expected.row());
            if (expected == view.expected && identityEpochCurrent(guard)) view.phase = "slot";
            return;
        }
        if ("slot".equals(view.phase) && trackPinned && expected.trackId().equals(trackId)
            && clipExists && row == expected.row()) {
            stepWindow.onRebind();
            view.clip.isPinned().set(true);
            if (expected == view.expected && identityEpochCurrent(guard)) view.phase = "clip-pin";
            return;
        }
        if ("clip-pin".equals(view.phase) && trackExists && clipExists && trackPinned && clipPinned
            && expected.trackId().equals(trackId) && expected.row() == row) {
            view.phase = "settling";
            view.started = System.nanoTime();
            view.lastPoll = 0;
            view.lastCallbacks = view.callbacks;
        }
    }

    private boolean valid(View view) {
        return identityEpochCurrent(view.identityGuard) && view.ref != null && cache.hasClip(view.ref)
            && !"retired".equals(view.phase) && view.expected != null && bindingReady(view)
            && view.token.equals(cache.bindingToken(view.ref));
    }

    private boolean bindingReady(View view) {
        Address expected = view.expected;
        RootIdentityProbe.IdentityGuard guard = view.identityGuard;
        return expected != null && view.track.exists().get() && view.clip.exists().get()
            && expected.trackId().equals(view.track.channelId().get())
            && expected.row() == view.clip.clipLauncherSlot().sceneIndex().get()
            && view.track.isPinned().get() && view.clip.isPinned().get()
            && expected == view.expected && identityEpochCurrent(guard);
    }

    private JsonObject fallback(View view, String reason) {
        fallbackReason = reason;
        JsonObject result = info();
        result.addProperty("complete", false);
        result.addProperty("readMode", "refuse");
        result.addProperty("authorityAvailable", false);
        result.addProperty("fallbackPerformed", false);
        result.addProperty("reason", reason);
        result.addProperty("phase", view.phase);
        if ("absent-slot".equals(reason)) result.addProperty("slotAbsenceProved", true);
        return result;
    }

    /** Read guarded progress without advancing acquisition or publishing its payload. */
    public JsonObject compareStatus() {
        if (scan != null) {
            Scan work = scan;
            if (!guardCurrent(work.identityGuard)) return finishWindowChange("window-changed");
            StepDeltaWindow.Read read = "membership".equals(work.stage) ? work.membershipRead
                : "result".equals(work.stage) || "enrichment".equals(work.stage) ? work.resultRead : work.authorityRead;
            if (read != null && !stepWindow.unchanged(read)) return finishStepWindowChange(work);
            if (!valid(work.view) || work.callbacks != work.view.callbacks || !work.metadata.equals(metadata(work.view.clip)))
                return finishWindowChange("window-changed");
            if (elapsed(work.started) > 40_000) return finishWindowChange("authority-scan-budget");
            if (work.candidate != null && elapsed(work.started) - work.phases.get("enrichment") > ENRICHMENT_DEADLINE_MS)
                return finishWindowChange("enrichment-deadline");
        }
        return scanStatus();
    }

    private JsonObject scanStatus() {
        JsonObject result = info();
        result.addProperty("complete", false);
        result.addProperty("readMode", "refuse");
        result.addProperty("authorityAvailable", false);
        result.addProperty("fallbackPerformed", false);
        result.addProperty("scanActive", scan != null);
        if (scan != null) {
            result.addProperty("scanId", scan.id);
            result.addProperty("scanProgressCoordinates", scan.next);
            result.addProperty("scanTotalCoordinates", coverage.width() * KEYS);
            result.addProperty("authorityScanMs", elapsed(scan.started));
            result.addProperty("authorityHostWorkMs", scan.hostWorkMs);
            result.addProperty("authorityPhase", authority.phase);
            result.add("authorityBinding", authorityBindingDiagnostics());
            result.addProperty("scanStage", scan.stage);
            result.add("scanPhaseTimesMs", scan.phaseTimes());
            if (scan.candidate != null) result.add("snapshotCandidate", JSON.toJsonTree(scan.candidate.status()));
        }
        return result;
    }

    private JsonObject authorityBindingDiagnostics() {
        JsonObject result = new JsonObject();
        result.addProperty("phase", authority.phase); result.addProperty("stage", authority.stage);
        result.addProperty("strategy", authority.canaryAddress == null ? "direct-source" : "distinct-control-before-target");
        result.addProperty("distinctControlConfirmed", authorityDistinctControlConfirmed);
        result.add("expected", JSON.toJsonTree(authority.expected));
        result.add("finalAddress", JSON.toJsonTree(authority.finalAddress));
        result.add("controlAddress", JSON.toJsonTree(authority.canaryAddress));
        try {
            result.addProperty("trackExists", authority.track.exists().get());
            result.addProperty("trackChannelId", authority.track.channelId().get());
            result.addProperty("trackPosition", authority.track.position().get());
            result.addProperty("trackPinned", authority.track.isPinned().get());
            result.addProperty("clipExists", authority.clip.exists().get());
            result.addProperty("sceneIndex", authority.clip.clipLauncherSlot().sceneIndex().get());
            result.addProperty("clipPinned", authority.clip.isPinned().get());
            result.addProperty("status", "read");
        } catch (Throwable error) {
            result.addProperty("status", "unavailable");
            result.addProperty("errorClass", error.getClass().getSimpleName());
        }
        result.addProperty("cacheMembershipUsed", false);
        return result;
    }

    private JsonObject finishWindowChange(String reason) {
        comparison = reason;
        fallbackReason = reason;
        if (scan != null) {
            if ("window-changed".equals(reason)) windowChanges++;
            else comparisonRefusalsByCause.merge(reason, 1L, Long::sum);
        }
        JsonObject result = scanStatus();
        result.addProperty("comparison", reason);
        result.addProperty("reason", reason);
        result.addProperty("terminal", true);
        result.addProperty("scanActive", false);
        boolean ended = scan != null;
        endScan(reason);
        if (ended) result.add("scanPhaseTimesMs", lastScanPhaseTimes.deepCopy());
        // Report accounting after the scan releases its staging and candidate.
        result.add("resourceAccounting", resourceAccounting());
        return result;
    }

    /** End the scan. An unpublished candidate is retired without a provider read. */
    private void endScan(String cause) {
        if (scan == null) return;
        if (scan.candidate != null) { cache.cancelSnapshot(scan.candidate, cause); lastCandidate = JSON.toJsonTree(scan.candidate.status()).getAsJsonObject(); }
        scan.phase("ended");
        lastScanPhaseTimes = scan.phaseTimes();
        scan = null;
    }

    /** A changed step window retires the binding and discards pending and output state. */
    private JsonObject stepWindowChanged(int index, View view) {
        stepWindowRefusals++;
        retireStepWindow(index);
        return fallback(view, "step-window-changed");
    }

    /** Delete the reference, so recovery needs a new reference and fresh values. */
    private void retireStepWindow(int index) {
        View view = views[index];
        retire(index);
        if (view.ref != null && cache.hasClip(view.ref)) cache.delete(view.ref);
    }

    private static boolean subscribed(View view) {
        try { return view.clip.isSubscribed() && view.track.isSubscribed(); }
        catch (RuntimeException | LinkageError error) { return false; }
    }

    private View view(int index) {
        if (index < 0 || index >= views.length) throw new IllegalArgumentException("shadow handle index outside bank");
        return views[index];
    }

    private static double elapsed(long started) { return (System.nanoTime() - started) / 1_000_000.0; }

    private List<Note> guardedMembership(View view, Coordinate coordinate) {
        requireIdentityEpoch(view.identityGuard);
        List<Note> notes = readMembership(view.clip, coordinate);
        requireIdentityEpoch(view.identityGuard);
        return notes;
    }

    private List<Note> guardedEnrichment(View view, Coordinate coordinate) {
        requireIdentityEpoch(view.identityGuard);
        List<Note> notes = read(view.clip, coordinate, false);
        requireIdentityEpoch(view.identityGuard);
        return notes;
    }

    private List<Note> readMembership(PinnableCursorClip clip, Coordinate coordinate) {
        long started = System.nanoTime();
        List<Note> notes = null;
        RootIdentityProbe.IdentityGuard guard = activeIdentityGuard;
        try {
            for (int channel = 0; channel < 16; channel++) {
                requireIdentityEpoch(guard);
                membershipGetStepCalls++;
                NoteStep step = clip.getStep(channel, (int) coordinate.cell(), coordinate.pitch());
                requireIdentityEpoch(guard);
                if (step.state() == NoteStep.State.NoteOn) {
                    if (notes == null) { notes = new ArrayList<>(); acquisitionListObjects++; }
                    notes.add(new Note(channel, coordinate.cell(), coordinate.pitch(), Map.of()));
                    acquisitionNoteObjects++;
                }
            }
            return notes == null ? List.of() : notes;
        } finally { membershipHostWorkMs += elapsed(started); }
    }

    /** Normalize the binary64 host duration with R07. Preserve the raw value separately. */
    static long normalizeDurationCells(double duration) {
        return ShadowProjectCache.normalizeDurationCells(duration);
    }

    private List<Note> read(PinnableCursorClip clip, Coordinate coordinate, boolean independentAuthority) {
        long started = System.nanoTime();
        List<Note> notes = null;
        RootIdentityProbe.IdentityGuard guard = activeIdentityGuard;
        try {
            for (int channel = 0; channel < 16; channel++) {
                requireIdentityEpoch(guard);
                if (independentAuthority) authorityGetStepCalls++; else enrichmentGetStepCalls++;
                NoteStep step = clip.getStep(channel, (int) coordinate.cell(), coordinate.pitch());
                requireIdentityEpoch(guard);
                if (step.state() != NoteStep.State.NoteOn) continue;
                if (notes == null) { notes = new ArrayList<>(); acquisitionListObjects++; }
                Map<String, Object> fields = new LinkedHashMap<>();
                acquisitionFieldMapObjects++;
                fields.put("velocity", step.velocity());
                fields.put("releaseVelocity", step.releaseVelocity());
                fields.put("velocitySpread", step.velocitySpread());
                double rawDuration = step.duration();
                long durationCells = normalizeDurationCells(rawDuration);
                fields.put("duration", durationCells * GRID);
                fields.put("durationCells", durationCells);
                fields.put("rawDuration", rawDuration);
                double rawGain = step.gain();
                fields.put("gain", rawGain);
                fields.put("rawGain", rawGain);
                fields.put("pan", step.pan());
                fields.put("pressure", step.pressure());
                fields.put("timbre", (step.timbre() + 1) / 2);
                fields.put("rawTimbre", step.timbre());
                fields.put("transpose", step.transpose());
                fields.put("chance", step.chance());
                fields.put("isChanceEnabled", step.isChanceEnabled());
                fields.put("isMuted", step.isMuted());
                fields.put("isOccurrenceEnabled", step.isOccurrenceEnabled());
                fields.put("occurrence", step.occurrence().name());
                fields.put("isRecurrenceEnabled", step.isRecurrenceEnabled());
                fields.put("recurrenceLength", step.recurrenceLength());
                fields.put("recurrenceMask", step.recurrenceMask());
                fields.put("isRepeatEnabled", step.isRepeatEnabled());
                fields.put("repeatCount", step.repeatCount());
                fields.put("repeatCurve", step.repeatCurve());
                fields.put("repeatVelocityCurve", step.repeatVelocityCurve());
                fields.put("repeatVelocityEnd", step.repeatVelocityEnd());
                notes.add(new Note(channel, coordinate.cell(), coordinate.pitch(), fields));
                acquisitionNoteObjects++;
            }
            return notes == null ? List.of() : notes;
        } finally {
            if (independentAuthority) authorityHostWorkMs += elapsed(started);
            else enrichmentHostWorkMs += elapsed(started);
        }
    }

    private static Map<String, Object> metadata(PinnableCursorClip clip) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("name", clip.clipLauncherSlot().name().get());
        values.put("playStart", clip.getPlayStart().get());
        values.put("playStop", clip.getPlayStop().get());
        values.put("isLoopEnabled", clip.isLoopEnabled().get());
        values.put("loopStart", clip.getLoopStart().get());
        values.put("loopLength", clip.getLoopLength().get());
        values.put("colorRed", clip.color().red());
        values.put("colorGreen", clip.color().green());
        values.put("colorBlue", clip.color().blue());
        values.put("colorAlpha", clip.color().alpha());
        return Map.copyOf(values);
    }

    private final class View {
        final CursorTrack track;
        final PinnableCursorClip clip;
        String ref;
        CallbackToken token;
        ShadowHandlePool.Reservation poolReservation;
        RootIdentityProbe.IdentityGuard identityGuard;
        final LinkedHashMap<Coordinate, Long> hints = new LinkedHashMap<>();
        Track finalTarget, canaryTarget;
        Address finalAddress, canaryAddress;
        String stage = "target";
        boolean canaryVerified, recorderPreserved, physicalHintOverflow, usedForRebind;
        long physicalBindingRevision, hintSequence, physicalHintDrops, sameTargetPreserves, requestStarted;
        Track target;
        Address expected;
        String phase = "unbound";
        boolean used;
        long callbacks, onsetCallbacks, rejected, started, bindingStarted, lastPoll, lastCallbacks;
        int unchanged;
        double replayElapsedMs;
        Result lastResult;
        StepDeltaWindow.Read canaryRead, resultRead;

        View(ControllerHost host, String id) {
            track = host.createCursorTrack("GN_SHADOW_" + id, "ghostnote shadow " + id, 0, scenes, false);
            track.exists().markInterested();
            track.position().markInterested();
            track.channelId().markInterested();
            track.isPinned().markInterested();
            clip = track.createLauncherCursorClip(coverage.width(), KEYS);
            clip.setStepSize(GRID);
            clip.exists().markInterested();
            clip.isPinned().markInterested();
            clip.clipLauncherSlot().sceneIndex().markInterested();
            clip.clipLauncherSlot().name().markInterested();
            clip.getPlayStart().markInterested();
            clip.getPlayStop().markInterested();
            clip.isLoopEnabled().markInterested();
            clip.getLoopStart().markInterested();
            clip.getLoopLength().markInterested();
            clip.color().markInterested();
            clip.addStepDataObserver((x, y, state) -> {
                stepWindow.onStep();
                if (x < 0 || x >= coverage.width() || y < 0 || y >= KEYS
                    || expected == null || "retired".equals(phase)) { rejected++; return; }
                callbacks++;
                if (state == 2) onsetCallbacks++;
                if ("AUTHORITY".equals(id)) return;
                Coordinate coordinate = new Coordinate(x, y);
                if (physicalHintOverflow) { physicalHintDrops++; return; }
                if (!hints.containsKey(coordinate) && physicalPending() + cache.diagnostics().pendingCoordinates() >= MAX_PENDING) {
                    physicalOverload = true;
                    physicalHintOverflow = true;
                    physicalHintDrops++;
                    return;
                }
                hints.put(coordinate, ++hintSequence);
            });
        }
    }

    private static final class Scan {
        final View view;
        final long id;
        final long callbacks, started = System.nanoTime();
        final Map<String, Object> metadata;
        final RootIdentityProbe.IdentityGuard identityGuard;
        final List<Note> notes = new ArrayList<>();
        long authorityBoundAt, authorityCallbacks, estimatedBytes;
        boolean authorityReady;
        /** membership -> authority -> settlement -> result. Each later stage needs a confirmed window. */
        String stage = "membership";
        StepDeltaWindow.Read membershipRead, authorityRead, resultRead;
        String pendingComparison;
        Result pendingResult;
        boolean pendingPopulated;
        int next;
        double hostWorkMs;
        ShadowProjectCache.Candidate candidate;
        int enrichmentBatchCoordinates = Integer.MAX_VALUE;
        /** Elapsed wall time at each stage start, measured from the scan start. */
        final LinkedHashMap<String, Double> phases = new LinkedHashMap<>();
        Scan(View view, long id) {
            this.id = id; this.view = view; callbacks = view.callbacks; identityGuard = view.identityGuard; metadata = metadata(view.clip);
            phases.put("membership", 0.0);
        }
        void phase(String name) { phases.putIfAbsent(name, elapsed(started)); }
        JsonObject phaseTimes() {
            JsonObject result = new JsonObject();
            phases.forEach(result::addProperty);
            result.addProperty("authorityHostWorkMs", hostWorkMs);
            if (candidate != null) result.addProperty("enrichmentHostWorkMs", candidate.status().hostWorkMs());
            result.addProperty("scope", "elapsed wall time from scan start at each stage start; host work is separate");
            return result;
        }
    }
}
